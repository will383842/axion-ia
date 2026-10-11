/**
 * Formateurs indépendants — la séquence S3 : RELANCES DU DOSSIER (F9), lot L6
 * (08 §12.3, table des séquences ; 05 E7).
 *
 * Une DÉCLARATION du registre des campagnes (CAMP-3) — aucune règle de relance propre :
 *   - origine = le dernier LIEN du dossier envoyé (F5 « retenu », F8 « renvoi du lien »,
 *     F12 « il manque un élément » : S5 passe par ici), jamais une relance ;
 *   - J+3 puis J+7, deux au plus, rien après 14 jours, de 8 h à 19 h, une par jour ;
 *   - arrêt : dossier envoyé, fiche fermée ou effacée, adresse morte, opposition ;
 *   - interrupteurs : `dossier_en_ligne` (clé mère) ET `relances_auto`, plus le texte
 *     validé (adaptateur d'envoi). ÉTEINT tant qu'un seul manque.
 *
 * Le lien de la relance est RECALCULÉ à la version d'accès courante : il ne rouvre jamais
 * un lien révoqué.
 *
 * Module neutre (ni `server-only`, ni Next) : le passage tourne dans le worker.
 */

import type { GabaritFormateurIndependant } from "@/lib/email/templates/formateur-independant-textes";
import { FENETRE_ENVOI_PAR_DEFAUT, type RegleCampagne } from "@/lib/relances/campagne";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { normaliserAdresse } from "@/server/email/opposition-jeton";
import type { DeclarationCampagne, FaitsCampagne } from "@/server/relances/registre-campagnes";

import { urlDossierFormateur } from "./jeton-dossier";

const JOUR_MS = 86_400_000;

/** Les e-mails qui portent le lien du dossier : chacun ouvre une nouvelle origine. */
export const ORIGINES_RELANCE_DOSSIER: readonly GabaritFormateurIndependant[] = [
  "formateur-issue-retenu",
  "formateur-dossier-lien",
  "formateur-dossier-a-completer",
];

export const GABARIT_RELANCE_DOSSIER: GabaritFormateurIndependant = "formateur-dossier-relance";

export const REGLE_RELANCE_DOSSIER: RegleCampagne<"j3" | "j7"> = {
  etapes: [
    { id: "j3", delaiMs: 3 * JOUR_MS },
    { id: "j7", delaiMs: 7 * JOUR_MS },
  ],
  ecartMinMs: 2 * JOUR_MS,
  silenceApresMs: 14 * JOUR_MS,
  max: 2,
  unParJour: true,
  fenetre: FENETRE_ENVOI_PAR_DEFAUT,
};

/** Ce qui est lu en base pour une fiche (pur à partir d'ici). */
export interface LigneRelanceDossier {
  readonly id: string;
  readonly email: string;
  readonly prenom: string;
  readonly accesVersion: number;
  readonly dossierModifiable: boolean;
  readonly fermee: boolean;
  /** Dernier envoi d'un lien (`ORIGINES_RELANCE_DOSSIER`), parti ou en file. */
  readonly origine: { readonly id: string; readonly at: Date } | null;
  /** Relances F9 tentées depuis l'origine. */
  readonly relances: readonly Date[];
  readonly adresseMorte: boolean;
  readonly opposition: boolean;
}

const estEffacee = (adresse: string): boolean =>
  adresse.endsWith("@erased.local") || adresse === "[erased-rgpd-art17]";

/** Les faits de campagne d'une fiche, ou `null` si elle n'est pas concernée. */
export function faitsRelanceDossier(
  l: LigneRelanceDossier,
  maintenant: Date,
): FaitsCampagne | null {
  if (l.origine === null) return null;
  const lien = urlDossierFormateur(l.id, l.accesVersion, maintenant);
  if (lien === null) return null;
  return {
    entityId: l.id,
    personneId: l.id,
    origineId: l.origine.id,
    destinataire: l.email,
    etat: {
      origine: l.origine.at,
      envois: l.relances,
      efface: estEffacee(l.email),
      opposition: l.opposition,
      adresseMorte: l.adresseMorte,
      close: l.fermee,
      actionFaite: !l.dossierModifiable,
      reponseHumaine: false,
    },
    payload: { prenom: l.prenom, lien },
  };
}

/** L'empreinte sous laquelle une opposition est enregistrée (`opposition.ts`, `estOpposee`). */
function empreinteOpposition(email: string): string | null {
  return hashEmailForLookup(normaliserAdresse(email));
}

/** Lecture EN LOT des fiches à relancer (trois requêtes, quel que soit leur nombre). */
export async function lireFaitsRelanceDossier(maintenant: Date): Promise<FaitsCampagne[]> {
  const depuis = new Date(maintenant.getTime() - 15 * JOUR_MS);
  const fiches = await prisma.trainer.findMany({
    where: {
      statut: "sous_traitant",
      dossierStatut: { in: ["en_cours", "a_completer"] },
      finCollaborationAt: null,
      organismeSousTraitantId: null,
    },
    select: {
      id: true,
      email: true,
      prenom: true,
      accesVersion: true,
      dossierStatut: true,
      finCollaborationAt: true,
    },
    take: 500,
  });
  if (fiches.length === 0) return [];
  const ids = fiches.map((f) => f.id);
  const [journal, oppositions] = await Promise.all([
    prisma.emailLog.findMany({
      where: {
        entityType: "Trainer",
        entityId: { in: ids },
        template: { in: [...ORIGINES_RELANCE_DOSSIER, GABARIT_RELANCE_DOSSIER] },
        status: { not: "failed" },
        createdAt: { gte: depuis },
      },
      select: { id: true, entityId: true, template: true, createdAt: true, bounceType: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.emailOpposition.findMany({
      where: {
        emailHash: {
          in: fiches
            .map((f) => empreinteOpposition(f.email))
            .filter((h): h is string => h !== null),
        },
      },
      select: { emailHash: true },
    }),
  ]);
  const opposes = new Set(oppositions.map((o) => o.emailHash));
  const faits: FaitsCampagne[] = [];
  for (const f of fiches) {
    const lignes = journal.filter((j) => j.entityId === f.id);
    const origines = lignes.filter((j) =>
      (ORIGINES_RELANCE_DOSSIER as readonly string[]).includes(j.template),
    );
    const derniere = origines.at(-1) ?? null;
    const empreinte = empreinteOpposition(f.email);
    const r = faitsRelanceDossier(
      {
        id: f.id,
        email: f.email,
        prenom: f.prenom,
        accesVersion: f.accesVersion,
        dossierModifiable: f.dossierStatut === "en_cours" || f.dossierStatut === "a_completer",
        fermee: f.finCollaborationAt !== null,
        origine: derniere ? { id: derniere.id, at: derniere.createdAt } : null,
        relances: derniere
          ? lignes
              .filter(
                (j) => j.template === GABARIT_RELANCE_DOSSIER && j.createdAt > derniere.createdAt,
              )
              .map((j) => j.createdAt)
          : [],
        adresseMorte: lignes.some((j) => j.bounceType === "hard"),
        opposition: empreinte !== null && opposes.has(empreinte),
      },
      maintenant,
    );
    if (r) faits.push(r);
  }
  return faits;
}

/** La déclaration S3 (S5 passe par l'origine F12). */
export const CAMPAGNE_RELANCE_DOSSIER: DeclarationCampagne<"j3" | "j7"> = {
  id: "dossier-relance",
  gabarit: GABARIT_RELANCE_DOSSIER,
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_RELANCE_DOSSIER,
  interrupteurs: ["dossier_en_ligne", "relances_auto"],
  lireFaits: lireFaitsRelanceDossier,
};
