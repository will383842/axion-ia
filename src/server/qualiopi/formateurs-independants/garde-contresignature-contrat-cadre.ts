/**
 * Formateurs indépendants — LA porte de contresignature du contrat-cadre
 * (correctif de relecture du lot B).
 *
 * Il n'existe qu'UNE porte pour contresigner le contrat-cadre (v3 ou plus) d'un
 * formateur indépendant : `objectionContresignatureContratCadre`, appelée par le
 * chemin commun de contresignature de l'organisme (`piece-signature.ts`). Tous les
 * chemins y passent :
 *   · « Contresigner » d'une pièce (`contresignerPieceAction`) ;
 *   · la contresignature par lot de la page « À traiter » (`contresignerParLotAction`) ;
 *   · l'écran « Vérifier et contresigner » (W-4), qui appelle `contresignerPieceAction` ;
 *   · un lien à jeton qui porterait la partie `axionia` (refusé de toute façon par
 *     le moteur, `PARTIES_INTERDITES_AU_JETON`).
 *
 * Avant ce correctif, la contresignature hors W-4 ne relisait que le registre.
 * Or le contrat créé dans le dossier (parcours `dossier`) n'exige plus
 * l'attestation URSSAF à sa création : elle n'était donc vérifiée par personne.
 *
 * La porte vérifie TOUT, côté serveur, à l'instant :
 *   1. la pièce est le contrat en VIGUEUR (dernière version arrêtée), non annulé ;
 *   2. le formateur l'a signé (partie `sous_traitant`, signature non révoquée) ;
 *   3. l'attestation URSSAF validée, non échue, avec sa preuve de vérification —
 *      seulement quand le cumul des honoraires HT a atteint le seuil de vigilance
 *      (lot G1, `vigilance-seuil.ts`) ; le SIREN actif (5), lui, est TOUJOURS relu ;
 *   4. les pièces requises présentes et validées (CV de moins de 24 mois, RIB,
 *      RC pro si elle est déposée) ;
 *   5. le SIREN actif relu EN DIRECT au registre, sur le SIRET du contrat
 *      (`objectionContratCadre`, partie `axionia`).
 * Les contrôles 1 à 4 passent d'abord : le registre n'est relu (et une ligne de
 * preuve écrite) que pour un dossier par ailleurs complet.
 *
 * W-4 valide l'attestation et les pièces AVANT d'appeler la contresignature : il
 * passe donc la porte. Ailleurs, chaque refus renvoie vers l'écran W-4.
 *
 * 🔑 Toute autre pièce (convention, lettre de mission, contrat d'organisme v2,
 * contrat de travail…) rend `null` sans rien lire : rien ne change pour elles.
 *
 * Module neutre (Prisma seulement) : aucun journal, aucune donnée personnelle.
 */

import { prisma } from "@/lib/prisma";
import {
  estContratCadre,
  objectionContratCadre,
} from "@/server/qualiopi/documents/signature/contrat-cadre-signature";
import { derniereVersionArretee } from "@/server/qualiopi/documents/templates/versions-arretees";
import { pieceAUnFichier } from "@/server/qualiopi/trainers/piece-competence";
import type { SourceRegistre } from "./controle";
import { versionDuContrat } from "./faits-activation";
import {
  cvProbant,
  vigilanceSatisfaite,
  type PieceLueActivation,
} from "./garde-activation-complete";
import { lireCumulHonorairesHtCents } from "./vigilance-seuil-lecture";

/** Le nom de l'écran vers lequel chaque refus renvoie. */
const ECRAN_W4 = "écran Vérifier et contresigner";

export const MESSAGES_CONTRESIGNATURE_CONTRAT_CADRE = {
  attestation: `Vérifiez d'abord l'attestation URSSAF (${ECRAN_W4}).`,
  pieces: `Validez d'abord les pièces du dossier : CV de moins de 24 mois, RIB, et RC pro si elle est déposée (${ECRAN_W4}).`,
  nonSigne: `Le formateur n'a pas encore signé ce contrat : il se contresigne après sa signature (${ECRAN_W4}).`,
  version:
    "Ce contrat n'est pas dans la version en vigueur : émettez un contrat à jour depuis la fiche du formateur.",
  annule: "Ce contrat est annulé : il ne se contresigne plus.",
  dossier: `Le dossier du formateur n'a pas été envoyé : il est encore en cours de saisie, ou un complément lui a été demandé. Attendez son envoi (${ECRAN_W4}).`,
  fiche: `La fiche du cocontractant n'est pas celle d'un formateur indépendant (${ECRAN_W4}).`,
} as const;

type Doc = PieceLueActivation;

/**
 * Pièces requises : CV probant, RIB validé, RC pro validée si elle est déposée. Un fichier
 * est une adresse OU les octets déposés dans le dossier en ligne (V1-A-6) : `contenu` est
 * chargé par la lecture ci-dessous.
 */
function piecesRequisesValidees(docs: ReadonlyArray<Doc>, maintenant: Date): boolean {
  if (!cvProbant(docs, maintenant)) return false;
  if (
    !docs.some((d) => d.type === "rib" && d.statutValidation === "valide" && pieceAUnFichier(d))
  ) {
    return false;
  }
  const rcPro = docs.filter(
    (d) => d.type === "assurance_rc_pro" && d.statutValidation !== "rejete" && pieceAUnFichier(d),
  );
  return rcPro.length === 0 || rcPro.some((d) => d.statutValidation === "valide");
}

/**
 * Ce qui s'oppose à la contresignature de l'organisme sur cette pièce, ou `null`.
 * Hors contrat-cadre d'un formateur indépendant : `null` sans rien lire.
 */
export async function objectionContresignatureContratCadre(input: {
  readonly documentGenereId: string;
  readonly type: string;
  readonly metadata: unknown;
  readonly adminId?: string | null;
  readonly maintenant?: Date;
  readonly source?: SourceRegistre;
}): Promise<{ message: string } | null> {
  if (!estContratCadre(input.type, input.metadata)) return null;
  const maintenant = input.maintenant ?? new Date();
  const m = MESSAGES_CONTRESIGNATURE_CONTRAT_CADRE;

  const piece = await prisma.documentGenere.findUnique({
    where: { id: input.documentGenereId },
    select: { trainerId: true, annuleeAt: true },
  });
  if (piece === null) return { message: "Pièce introuvable." };
  // Contrat d'organisme : `objectionContratCadre` le refuse avec son propre message.
  if (piece.trainerId !== null && piece.trainerId !== undefined) {
    if (piece.annuleeAt !== null && piece.annuleeAt !== undefined) return { message: m.annule };

    // 1. Version en vigueur : la dernière arrêtée, jamais une version dépassée.
    if (versionDuContrat(input.metadata) !== derniereVersionArretee("contrat_sous_traitance")) {
      return { message: m.version };
    }

    // 2. Le formateur a signé.
    const signee = await prisma.documentSignature.findMany({
      where: {
        documentGenereId: input.documentGenereId,
        revokedAt: null,
        partie: "sous_traitant",
      },
      select: { partie: true },
    });
    if (!signee.some((s) => s.partie === "sous_traitant")) return { message: m.nonSigne };

    // 3 et 4. Attestation prouvée et pièces validées, relues en base à l'instant.
    const trainerId = piece.trainerId;
    const [t, preuves, cumul] = await Promise.all([
      prisma.trainer.findUnique({
        where: { id: trainerId },
        select: {
          statut: true,
          dossierStatut: true,
          documents: {
            where: {
              type: { in: ["attestation_vigilance_urssaf", "cv", "assurance_rc_pro", "rib"] },
              archiveAt: null,
            },
            select: {
              id: true,
              type: true,
              statutValidation: true,
              fichierUrl: true,
              contenu: { select: { trainerDocumentId: true } },
              dateEmission: true,
              dateExpiration: true,
            },
          },
        },
      }),
      prisma.preuveVigilance.findMany({
        where: { trainerId },
        select: { trainerDocumentId: true, resultat: true },
      }),
      lireCumulHonorairesHtCents(trainerId),
    ]);
    if (t === null || t.statut !== "sous_traitant") return { message: m.fiche };
    // C4 — on ne contresigne pas un dossier encore ouvert au formateur (même
    // règle que W-4, `dossierAContresigner`) : une fiche créée en console (sans
    // dossier en ligne) ou un dossier envoyé passent.
    if (t.dossierStatut === "en_cours" || t.dossierStatut === "a_completer") {
      return { message: m.dossier };
    }
    const docs: Doc[] = t.documents ?? [];
    if (!vigilanceSatisfaite(docs, preuves ?? [], maintenant, cumul)) {
      return { message: m.attestation };
    }
    if (!piecesRequisesValidees(docs, maintenant)) return { message: m.pieces };
  }

  // 5. SIREN actif relu EN DIRECT, sur le SIRET du contrat.
  return objectionContratCadre({
    documentGenereId: input.documentGenereId,
    type: input.type,
    metadata: input.metadata,
    partie: "axionia",
    adminId: input.adminId ?? null,
    maintenant,
    ...(input.source === undefined ? {} : { source: input.source }),
  });
}
