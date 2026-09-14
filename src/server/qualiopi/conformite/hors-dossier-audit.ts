/**
 * CE QUI SORT, ET CE QUI NE SORT PAS, DANS UN DOSSIER REMIS À L'AUDITRICE.
 *
 * ## 🔴 Le défaut que ce module ferme (audit initial 2026-09-14)
 *
 * Constats `X-mode-auditeur-05` et `G-lieu-05`. Le ZIP du mode auditeur
 * (`audit-dossier.ts`) et le dossier d'audit d'une session
 * (`dossier-session.ts`) joignaient TOUTES les pièces admissibles du registre,
 * sans regarder leur type. Ils embarquaient donc des pièces d'EMPLOYEUR, de
 * RÉMUNÉRATION et de FACTURATION — contrats de travail, autofactures
 * d'honoraires, factures, devis, avoirs — et `formateurs/pieces.json` listait,
 * avec l'URL de leur fichier, les contrats de travail et les DPAE des salariés.
 *
 * Aucune de ces pièces ne prouve un indicateur du RNQ. Les remettre à un tiers
 * est un traitement sans finalité (RGPD, art. 5 §1 c — minimisation) : la
 * rémunération d'une personne physique, ou ce qu'un particulier a payé, n'a
 * rien à faire dans un dossier de preuves Qualiopi.
 *
 * ⚠️ Rien n'est retiré du REGISTRE. Ces pièces restent numérotées, scellées et
 * consultables ; seul le dossier EXPORTÉ ne les porte plus. Et le dossier le
 * DIT, en comptant ce qu'il n'a pas joint — sans les nommer.
 *
 * ## 🔑 Pourquoi une table EXHAUSTIVE, et pas une liste d'exclusions
 *
 * Une liste d'exclusions échoue OUVERT : la prochaine pièce RH ajoutée à
 * l'énumération partirait dans le dossier sans que rien ne rougisse. Ici,
 * chaque valeur des deux énumérations reçoit une destination déclarée —
 * `Record<…>` complet — et une valeur nouvelle casse la COMPILATION tant que
 * personne n'a décidé où elle va.
 *
 * La ligne de partage est celle que `schema.prisma` pose pour `estFormateur` :
 * pièce PÉDAGOGIQUE ou de preuve (jointe) contre pièce d'EMPLOYEUR, de
 * rémunération ou de facturation (hors dossier). Les kits de financement
 * (OPCO, CPF, France Travail) restent joints : ils décrivent l'action telle
 * qu'elle est présentée au financeur, pas un paiement.
 *
 * Ce module n'importe que des types : appelable depuis n'importe quel
 * producteur de dossier sans cycle.
 */

import type { DocumentType, TrainerDocumentType } from "../../../../prisma/generated/client";

type Destination = "joint" | "hors_dossier";

/** Destination de chaque pièce du registre `DocumentGenere` dans un dossier d'audit. */
const DESTINATION_DOCUMENT: Record<DocumentType, Destination> = {
  convention: "joint",
  convention_tripartite: "joint",
  contrat: "joint",
  convocation: "joint",
  emargement: "joint",
  releve_connexion: "joint",
  positionnement: "joint",
  grille_evaluation: "joint",
  satisfaction: "joint",
  attestation: "joint",
  attestation_partielle: "joint",
  certificat_realisation: "joint",
  kit_opco: "joint",
  kit_cpf: "joint",
  kit_france_travail: "joint",
  lettre_mission: "joint",
  reglement_interieur: "joint",
  livret_accueil: "joint",
  protocole_afest: "joint",
  inventaire_moyens: "joint",
  contrat_sous_traitance: "joint",
  cv_formateur: "joint",
  programme: "joint",
  organisation_action: "joint",
  autorisation_captation: "joint",
  liste_formateurs: "joint",
  procedure_sous_traitance: "joint",
  // Rémunération d'un intervenant, personne physique : aucune exigence du RNQ.
  autofacture_honoraires: "hors_dossier",
  // Pièce d'employeur. La nature du lien contractuel exigée par l'indicateur 21
  // est portée par `liste_formateurs`, pas par le contrat lui-même.
  contrat_travail: "hors_dossier",
  // Pièces commerciales : aucune exigence du RNQ. Une facture à un particulier
  // (CPF, financement personnel) nomme une personne physique et ce qu'elle a payé.
  facture: "hors_dossier",
  devis: "hors_dossier",
  avoir: "hors_dossier",
};

/** Destination de chaque pièce du dossier formateur (`TrainerDocument`). */
const DESTINATION_PIECE_FORMATEUR: Record<TrainerDocumentType, Destination> = {
  // Pièces d'employeur — visent tout salarié, pas l'intervenant pédagogique.
  contrat_travail: "hors_dossier",
  dpae: "hors_dossier",
  // Indicateur 27 — vérification du sous-traitant.
  attestation_vigilance_urssaf: "joint",
  kbis_avis_sirene: "joint",
  nda_sous_traitant: "joint",
  attestation_qualiopi: "joint",
  assurance_rc_pro: "joint",
  contrat_sous_traitance: "joint",
  // Indicateur 21 — compétences des intervenants.
  cv: "joint",
  diplome: "joint",
  certification: "joint",
  autre: "joint",
};

/** `true` si une pièce du registre de ce type a sa place dans un dossier d'audit. */
export function documentJointAuDossierAudit(type: DocumentType): boolean {
  return DESTINATION_DOCUMENT[type] === "joint";
}

/** `true` si une pièce du dossier formateur de ce type a sa place dans un dossier d'audit. */
export function pieceFormateurJointeAuDossierAudit(type: TrainerDocumentType): boolean {
  return DESTINATION_PIECE_FORMATEUR[type] === "joint";
}

/** Libellé pluriel-aware de la ligne d'index qui compte les pièces non jointes. */
export function lignePiecesHorsDossier(nb: number): string {
  return `${nb} pièce${nb > 1 ? "s" : ""} RH, de rémunération ou de facturation (contrat de travail, autofacture d'honoraires, facture, devis, avoir) non jointe${nb > 1 ? "s" : ""} : elle${nb > 1 ? "s" : ""} ne prouve${nb > 1 ? "nt" : ""} aucun indicateur Qualiopi et reste${nb > 1 ? "nt" : ""} consultable${nb > 1 ? "s" : ""} au registre.`;
}
