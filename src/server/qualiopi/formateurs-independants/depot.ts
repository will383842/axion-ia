/**
 * Formateurs indépendants — DÉPÔT d'une pièce par le formateur depuis son
 * dossier en ligne (lot L5b, ADR 0066).
 *
 * Le contrôle (format, taille, antivirus, empreinte) est celui du dépôt commun
 * (FAC-6, `server/pieces/depot-controle.ts`) : ce module n'en réécrit rien. Il
 * ne fait que l'ÉCRITURE propre aux formateurs, dans une seule transaction :
 *   - la pièce `TrainerDocument`, EN ATTENTE (un humain la valide) ;
 *   - ses octets chiffrés au repos (« AXB1 ») dans `TrainerDocumentContenu` ;
 *   - la trace « dépôt du formateur » (`adminUserId` nul), celle que la garde
 *     des quatre yeux lit (`vigilance.ts`).
 *
 * 🔴 LIVRÉ ÉTEINT : tant que `formateurs.dossier_en_ligne` n'est pas allumé,
 * rien n'est contrôlé ni écrit. L'appelant (le dossier à jeton, lot L5) a déjà
 * vérifié le jeton : ce module ne connaît que l'identifiant de la fiche.
 *
 * Sans `server-only` : sûr pour le worker.
 */

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { journaliser } from "@/server/journal/journaliser";
import {
  alerteAntivirusLimitee,
  chiffrerPieceAuRepos,
  controlerPiece,
} from "@/server/pieces/depot-controle";

import type { TrainerDocumentType } from "../../../../prisma/generated/client";
import { echeanceCalculee, estPieceGardee } from "./gardes";
import { envoiAllume } from "./interrupteurs-envoi";
import { ACTION_DEPOT_FORMATEUR } from "./vigilance";

/**
 * Les pièces que le formateur dépose lui-même. Les contrats et la DPAE naissent
 * en console ou à la signature : jamais par un dépôt.
 */
export const TYPES_DEPOSABLES = [
  "attestation_vigilance_urssaf",
  "kbis_avis_sirene",
  "nda_sous_traitant",
  "recepisse_declaration_activite",
  "attestation_qualiopi",
  "assurance_rc_pro",
  "rib",
  "cv",
  "diplome",
  "certification",
  "autre",
] as const satisfies readonly TrainerDocumentType[];

export type TypeDeposable = (typeof TYPES_DEPOSABLES)[number];

/** Par fiche et par quart d'heure. Panne de Redis : laisser passer (le jeton garde). */
const LIMITE_DEPOT: RateLimitConfig = {
  limit: 20,
  windowSec: 900,
  surPanne: "laisser-passer",
};

export const MESSAGES_DEPOT_FORMATEUR = {
  indisponible: "Le dépôt de pièces n'est pas ouvert pour le moment.",
  debit: "Trop de dépôts en peu de temps. Réessayez dans un quart d'heure.",
  type: "Ce type de pièce ne se dépose pas ici.",
  erreur: "Le dépôt n'a pas pu s'enregistrer. Réessayez dans un instant.",
  emission: "Indiquez la date d'émission de cette pièce : sa durée de validité en dépend.",
  emissionFuture: "La date d'émission ne peut pas être dans le futur.",
} as const;

// Antivirus muet : une alerte au plus par quart d'heure, sans donnée personnelle.
const alerteAntivirus = alerteAntivirusLimitee(() => {
  try {
    Sentry.captureException(new Error("pièce formateur refusée : antivirus muet"), {
      tags: { action: "formateur-depot:antivirus_muet" },
    });
  } catch {
    // Observabilité : jamais bloquante.
  }
});

/** Nom d'origine affichable : sans chemin ni balise, 255 signes au plus. */
export function nomPropre(nom: string): string {
  const base = nom.split(/[\\/]/).pop() ?? "";
  const propre = base.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(-255);
  return propre === "" ? "piece" : propre;
}

export interface EntreeDepot {
  readonly trainerId: string;
  readonly type: string;
  readonly nomFichier: string;
  readonly octets: Uint8Array;
  readonly numeroPiece?: string | null;
  readonly dateEmission?: Date | null;
}

export type ResultatDepot =
  | { readonly ok: true; readonly documentId: string }
  | { readonly ok: false; readonly message: string };

export async function deposerPieceFormateur(entree: EntreeDepot): Promise<ResultatDepot> {
  if (!(await envoiAllume("dossier_en_ligne"))) {
    return { ok: false, message: MESSAGES_DEPOT_FORMATEUR.indisponible };
  }
  if (!(TYPES_DEPOSABLES as readonly string[]).includes(entree.type)) {
    return { ok: false, message: MESSAGES_DEPOT_FORMATEUR.type };
  }
  // Pièces lues par la garde d'activation : mêmes règles que la saisie console
  // (`createTrainerDocumentAction`) — émission exigée, jamais future, échéance
  // CALCULÉE, jamais saisie.
  let dateExpiration: Date | null = null;
  if (estPieceGardee(entree.type)) {
    const emission = entree.dateEmission ?? null;
    if (emission === null || Number.isNaN(emission.getTime())) {
      return { ok: false, message: MESSAGES_DEPOT_FORMATEUR.emission };
    }
    if (emission.getTime() > Date.now()) {
      return { ok: false, message: MESSAGES_DEPOT_FORMATEUR.emissionFuture };
    }
    dateExpiration = echeanceCalculee(entree.type, emission);
  }
  const debit = await checkRateLimit(`formateur-dossier:piece:${entree.trainerId}`, LIMITE_DEPOT);
  if (!debit.allowed) return { ok: false, message: MESSAGES_DEPOT_FORMATEUR.debit };

  const fiche = await prisma.trainer.findUnique({
    where: { id: entree.trainerId },
    select: { id: true, statut: true },
  });
  if (fiche === null || fiche.statut !== "sous_traitant") {
    return { ok: false, message: MESSAGES_DEPOT_FORMATEUR.indisponible };
  }

  const controle = await controlerPiece(entree.nomFichier, entree.octets, {
    alerterAntivirusIndisponible: () => alerteAntivirus.alerter(),
  });
  if (!controle.ok) return controle;

  // Chiffré HORS de la transaction : sans clé, `chiffrerPieceAuRepos` lève, et
  // rien n'est écrit (jamais de repli en clair).
  let chiffre: Buffer;
  try {
    chiffre = chiffrerPieceAuRepos(entree.octets);
  } catch {
    return { ok: false, message: MESSAGES_DEPOT_FORMATEUR.erreur };
  }

  try {
    const documentId = await prisma.$transaction(async (tx) => {
      // Jamais deux pièces actives du type (comme `dossier.ts`) : la précédente, non vérifiée,
      // est ARCHIVÉE dans la même transaction — jamais supprimée.
      await tx.trainerDocument.updateMany({
        where: {
          trainerId: fiche.id,
          type: entree.type as TypeDeposable,
          archiveAt: null,
          statutValidation: { not: "valide" },
        },
        data: { archiveAt: new Date(), archiveMotif: "remplacee_par_le_formateur" },
      });
      const doc = await tx.trainerDocument.create({
        data: {
          trainerId: fiche.id,
          type: entree.type as TypeDeposable,
          hashSha256: controle.sha256,
          // Jamais de numéro sur un RIB : l'IBAN n'est pas recopié dans un champ
          // que toute la console lit (il vit chiffré sur `Trainer.iban`).
          numeroPiece: entree.type === "rib" ? null : (entree.numeroPiece?.slice(0, 60) ?? null),
          dateEmission: entree.dateEmission ?? null,
          dateExpiration,
        },
        select: { id: true },
      });
      await tx.trainerDocumentContenu.create({
        data: {
          trainerDocumentId: doc.id,
          octets: chiffre,
          taille: chiffre.length,
          sha256: controle.sha256,
          mime: controle.typeMime,
          nomOriginal: nomPropre(entree.nomFichier),
        },
      });
      await journaliser(
        tx,
        {
          action: ACTION_DEPOT_FORMATEUR,
          targetType: "TrainerDocument",
          targetId: doc.id,
          changes: { trainerId: fiche.id, type: entree.type },
          session: null,
        },
        { exiger: true },
      );
      return doc.id;
    });
    return { ok: true, documentId };
  } catch {
    return { ok: false, message: MESSAGES_DEPOT_FORMATEUR.erreur };
  }
}
