/**
 * Qualiopi — LE libellé français d'un `DocumentType`, écrit une seule fois.
 *
 * ## Le défaut que ce module ferme (2026-09-02, audit certificateur)
 *
 * Trois tables de libellés cohabitaient. Deux étaient des
 * `Record<DocumentType, string>` — donc **exhaustives par construction** : le
 * compilateur refuse d'oublier une valeur d'énumération. La troisième vivait
 * dans `MatriceIndicateurs.tsx`, c'est-à-dire **sur l'écran que le certificateur
 * lit le jour de sa venue**, et c'était la seule à être écrite à la main :
 *
 * ```ts
 * const TYPE_DOCUMENT_LABELS: Record<string, string> = { … } // 13 entrées
 * ```
 *
 * `Record<string, string>` n'oblige à rien. Mesuré sur la base de recette du
 * 2026-09-02 : sur les 8 types réellement présentés à l'auditrice, **7 n'avaient
 * aucun libellé** et retombaient sur le repli `« ${type} »`. La vue manifeste et
 * le Markdown remis au certificateur affichaient donc, en toutes lettres :
 *
 * ```
 * « programme » : 578 pièces      « emargement » : 501 pièces
 * « convention » : 519 pièces     « grille_evaluation » : 133 pièces
 * ```
 *
 * Et six des treize entrées de cette table ne correspondaient à **aucune valeur
 * de l'énumération** (`convention_formation`, `contrat_formation`,
 * `programme_formation`, `feuille_emargement`, `attestation_assiduite`,
 * `attestation_fin_formation`) : elles n'avaient donc jamais servi.
 *
 * ## Pourquoi un module, et pas un import de `nom-fichier.ts`
 *
 * `nom-fichier.ts` porte des libellés destinés à un NOM DE FICHIER (ASCII sûr,
 * concis). L'écran de l'auditrice a besoin du même vocabulaire ; il n'a aucune
 * raison de dépendre d'un module de nommage de fichiers, ni d'en hériter les
 * contraintes le jour où celles-ci changeront. Le vocabulaire est donc ici, et
 * `nom-fichier.ts` le consomme.
 *
 * 🔑 La forme `Record<DocumentType, string>` n'est pas décorative : c'est ELLE
 * la garde. Ajouter une valeur à l'énumération Prisma sans l'ajouter ici casse
 * la compilation — la seule garde qui ne peut pas être oubliée.
 */

import type { DocumentType } from "../../../../prisma/generated/client";

/**
 * Libellé humain de chaque type de pièce du registre.
 *
 * ⚠️ Ces libellés sont lus par un tiers (l'auditrice) qui ne connaît pas notre
 * énumération : ils nomment la PIÈCE telle qu'elle s'appelle dans le vocabulaire
 * du RNQ et du Code du travail, jamais telle qu'elle s'appelle en base.
 */
export const LIBELLES_TYPE_DOCUMENT: Record<DocumentType, string> = {
  convention: "Convention de formation",
  convention_tripartite: "Convention tripartite OPCO",
  contrat: "Contrat de formation",
  convocation: "Convocation",
  emargement: "Feuille d'émargement",
  releve_connexion: "Relevé de connexion",
  positionnement: "Questionnaire de positionnement",
  grille_evaluation: "Grille d'évaluation",
  satisfaction: "Questionnaire de satisfaction",
  attestation: "Attestation de réalisation",
  attestation_partielle: "Attestation partielle",
  certificat_realisation: "Certificat de réalisation",
  facture: "Facture",
  devis: "Devis",
  avoir: "Avoir",
  kit_opco: "Kit OPCO",
  kit_cpf: "Kit CPF",
  kit_france_travail: "Kit France Travail",
  lettre_mission: "Lettre de mission formateur",
  reglement_interieur: "Règlement intérieur",
  livret_accueil: "Livret d'accueil",
  // Valeur d'énumération héritée, plus jamais émise (module AFEST supprimé le
  // 2026-08-10, décision Will) — le Record est exhaustif, l'entrée doit rester.
  protocole_afest: "Protocole AFEST",
  inventaire_moyens: "Inventaire des moyens",
  contrat_sous_traitance: "Contrat de sous-traitance",
  procedure_sous_traitance: "Procédure de sous-traitance",
  cv_formateur: "Fiche formateur",
  programme: "Programme de l'action",
  organisation_action: "Organisation de l'action",
  autorisation_captation: "Autorisation de captation",
  liste_formateurs: "Liste des formateurs",
};

/**
 * Libellé d'un type reçu sous forme de chaîne (le manifeste transporte du JSON,
 * il perd le type nominal en route).
 *
 * Le repli reste VISIBLEMENT anormal — `« … »` autour de la valeur brute — pour
 * qu'un type non libellé se remarque au lieu de passer pour un intitulé. Il ne
 * peut plus survenir par oubli, seulement par donnée corrompue.
 */
export function libelleTypeDocument(type: string): string {
  return LIBELLES_TYPE_DOCUMENT[type as DocumentType] ?? `« ${type} »`;
}
