/**
 * LE VOCABULAIRE DU SUIVI DE CANDIDATURE — une seule table pour tout le dossier.
 *
 * 🔴 POURQUOI CE FICHIER EXISTE.
 *
 * Avant lui, la liste des statuts était recopiée à TROIS endroits :
 *   - `features/admin-job-applications/reads.ts` (`STATUSES`, pour le filtre) ;
 *   - `ApplicationStatusForm.tsx` (les paires clé/libellé du menu déroulant) ;
 *   - `ApplicationsV2.tsx` (`STATUS_LABELS` + la table des tons).
 * Trois listes tenues à la main, aucune ne connaissant les autres. Ajouter un
 * état à l'enum Postgres les laissait toutes les trois muettes : le nouvel état
 * s'écrivait en base, s'affichait « interview » brut dans la liste, et restait
 * introuvable au filtre. Ce dépôt a déjà payé ce défaut deux fois avec
 * `EmailJobName`.
 *
 * 🔑 LA GARDE EST DANS LE TYPE, PAS DANS UN TEST.
 *
 * `Record<JobApplicationStatus, …>` oblige le compilateur à refuser une table
 * incomplète. Un état ajouté à `schema.prisma` fait donc rougir `pnpm typecheck`
 * AVANT tout rendu — c'est-à-dire au seul moment où la correction est gratuite.
 * Un test d'exhaustivité aurait dit la même chose, mais plus tard.
 *
 * ⚠️ L'import du type est `import type` : il est effacé à la compilation, donc
 * ce module reste importable depuis un composant client sans embarquer le
 * client Prisma dans le bundle.
 */

import type { JobApplicationStatus, JobRejectionReason } from "../../../prisma/generated/client";

/**
 * L'ordre du menu déroulant, et lui seul : c'est l'ordre du PARCOURS, de la
 * réception à la sortie. Trier alphabétiquement mettrait « archivée » en tête
 * et « recrutée » au milieu — la liste ne raconterait plus rien.
 */
export const STATUTS_CANDIDATURE = [
  "new",
  "reviewing",
  "shortlisted",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
  "archived",
] as const satisfies readonly JobApplicationStatus[];

export const LIBELLE_STATUT: Record<JobApplicationStatus, string> = {
  new: "Nouvelle",
  reviewing: "En revue",
  shortlisted: "Présélection",
  interview: "En entretien",
  offer: "Proposition faite",
  hired: "Recrutée",
  rejected: "Écartée",
  withdrawn: "Retirée par le candidat",
  archived: "Archivée",
};

/**
 * Tons de la pastille — le vocabulaire EXACT d'`AdminBadge`.
 *
 * ⚠️ Recopié plutôt qu'importé : `AdminBadge` ne l'exporte pas, et l'exporter
 * ferait passer un composant client dans la chaîne d'import de ce module pur.
 * Un ton hors vocabulaire ne rendrait aucune classe — la pastille sortirait
 * transparente, sans erreur.
 */
export type TonStatut = "neutral" | "info" | "success" | "warning" | "destructive";

export const TON_STATUT: Record<JobApplicationStatus, TonStatut> = {
  new: "info",
  reviewing: "neutral",
  shortlisted: "warning",
  interview: "warning",
  offer: "warning",
  hired: "success",
  rejected: "destructive",
  // 🔑 Un retrait n'est PAS un échec de notre côté : le peindre en rouge comme
  // un refus ferait lire une décision du candidat comme une de nos décisions.
  withdrawn: "neutral",
  archived: "neutral",
};

/**
 * Les états où le MOTIF est obligatoire.
 *
 * ⚠️ Cette liste et son jumeau ci-dessous doivent rester le miroir exact de la
 * contrainte SQL `job_applications_motif_coherent_check`. Elles ne la
 * remplacent pas : la base reste seule juge — elles servent à REFUSER PLUS TÔT,
 * avec une phrase lisible, plutôt que de laisser remonter une erreur Postgres.
 * La preuve des deux sens est jouée par
 * `prisma/scripts/verifier-contrainte-decision.sql`.
 */
export const STATUTS_EXIGEANT_UN_MOTIF = ["rejected", "withdrawn"] as const;

/** Les états où un motif n'aurait aucun sens — un dossier en cours n'a pas de fin. */
export const STATUTS_INTERDISANT_UN_MOTIF = [
  "new",
  "reviewing",
  "shortlisted",
  "interview",
  "offer",
] as const;

export function exigeUnMotif(statut: JobApplicationStatus): boolean {
  return (STATUTS_EXIGEANT_UN_MOTIF as readonly string[]).includes(statut);
}

export function interditUnMotif(statut: JobApplicationStatus): boolean {
  return (STATUTS_INTERDISANT_UN_MOTIF as readonly string[]).includes(statut);
}

/** Les états qui referment le dossier : ils datent une décision et un auteur. */
export function estUneDecision(statut: JobApplicationStatus): boolean {
  return statut === "rejected" || statut === "withdrawn" || statut === "hired";
}

/**
 * Les états d'un dossier OUVERT — reçu, pas encore refermé.
 *
 * 🔑 C'est EXACTEMENT l'ensemble ci-dessus, et ce n'est pas un hasard : les
 * deux notions reposent sur le même fait — le dossier n'est pas refermé. Un
 * dossier en cours ne peut pas porter de motif de sortie (raison de
 * `STATUTS_INTERDISANT_UN_MOTIF`) et c'est le seul qui puisse être « oublié »
 * (raison du lot 4) : archiver un refus n'est pas l'oublier, c'est le ranger.
 *
 * Un ALIAS et non une seconde liste, délibérément. Deux listes identiques
 * tenues à la main sont la mécanique exacte des trois copies que ce fichier
 * vient de solder. Le jour où les deux notions devraient diverger, c'est ICI
 * qu'on les sépare — et la séparation sera visible.
 */
export const STATUTS_OUVERTS = STATUTS_INTERDISANT_UN_MOTIF;

/** Le dossier attend encore quelque chose de nous. */
export function estOuvert(statut: JobApplicationStatus): boolean {
  return interditUnMotif(statut);
}

/**
 * Les motifs, dans l'ordre où un recruteur les cherche : d'abord ce qui relève
 * du profil, puis ce qui relève du candidat, puis ce qui relève de nous, et en
 * dernier les cas d'hygiène.
 */
export const MOTIFS_REFUS = [
  "competences_insuffisantes",
  "pretentions_hors_budget",
  "hors_zone",
  "profil_hors_cible",
  "sans_reponse_candidat",
  "absent_entretien",
  "candidat_a_decline",
  "poste_pourvu",
  "doublon",
  "hors_sujet",
  "non_renseigne",
] as const satisfies readonly JobRejectionReason[];

export const LIBELLE_MOTIF_REFUS: Record<JobRejectionReason, string> = {
  competences_insuffisantes: "Compétences insuffisantes pour le poste",
  pretentions_hors_budget: "Prétentions salariales hors budget",
  hors_zone: "Trop éloigné géographiquement",
  profil_hors_cible: "Profil hors de la cible du poste",
  sans_reponse_candidat: "Sans réponse du candidat",
  absent_entretien: "Ne s'est pas présenté à l'entretien",
  candidat_a_decline: "A décliné notre proposition",
  poste_pourvu: "Poste déjà pourvu",
  doublon: "Doublon d'une candidature existante",
  hors_sujet: "Candidature hors sujet",
  non_renseigne: "Non renseigné (reprise de l'existant)",
};

/**
 * Les motifs proposés à la SAISIE.
 *
 * 🔴 `non_renseigne` en est EXCLU, et c'est tout l'intérêt du lot : il existe
 * pour dire la vérité sur le stock antérieur, pas pour offrir une porte de
 * sortie à qui ne veut pas choisir. Le laisser dans le menu aurait rendu la
 * contrainte SQL décorative — on aurait rempli un champ obligatoire avec
 * « je ne sais pas », et rien n'aurait été appris.
 */
export const MOTIFS_REFUS_SAISISSABLES = MOTIFS_REFUS.filter((m) => m !== "non_renseigne");

/**
 * La règle de décision, DITE EN FRANÇAIS, avant que Postgres ne la dise en
 * anglais.
 *
 * 🔑 La contrainte `job_applications_motif_coherent_check` reste seule juge —
 * elle tient même si quelqu'un écrit en base par un autre chemin. Ce contrôle
 * ne la double pas : il évite de faire remonter à un recruteur un message
 * Postgres qui ne lui apprend rien (« violates check constraint … »), et il
 * nomme le champ à corriger. Preuve des deux sens :
 * `prisma/scripts/verifier-contrainte-decision.sql`.
 *
 * 🔴 ELLE VIT ICI, ET PLUS DANS `actions.ts`. Le lot 4 ajoute un second module
 * de Server Actions (les gestes en masse) qui doit appliquer la MÊME règle. La
 * laisser dans `actions.ts` imposait de la recopier — or un module
 * `"use server"` ne peut pas exporter une fonction synchrone, donc la copie
 * aurait été inévitable. Deux écritures d'une règle de cohérence, c'est la
 * garantie qu'un écran finira par accepter ce que l'autre refuse.
 */
export function incoherenceDeLaDecision(
  statut: JobApplicationStatus,
  motif: string | undefined,
): string | null {
  if (exigeUnMotif(statut) && !motif) {
    return `Un motif est obligatoire pour « ${LIBELLE_STATUT[statut]} » : un refus sans motif ne s'apprend pas.`;
  }
  if (interditUnMotif(statut) && motif) {
    return `« ${LIBELLE_STATUT[statut]} » est un état en cours : il ne peut pas porter de motif de sortie.`;
  }
  return null;
}
