/**
 * Liste FERMÉE des codes de raison de refus de la chaîne éditoriale IA (C4).
 *
 * Module PUR : aucune entrée-sortie, aucune base, rien de branché. Il est la
 * source unique que partageront la chaîne (table `ContenuRefus`, § 7.1 de
 * `CONCEPTION-CHAINE-EDITORIALE-IA.md`) et la porte qualité (§ 5.1 de
 * `CONCEPTION-PORTE-QUALITE.md`) : un seul mécanisme d'enregistrement des refus.
 *
 * Règle d'évolution : un code ne se renomme pas (il est écrit en base). On en
 * ajoute ; on n'en retire un qu'après avoir vérifié qu'aucune ligne ne le porte.
 * Une raison qui tombe dans `autre` plus de 10 % du temps appelle un nouveau code.
 */

export const CODES_REFUS = [
  // Verdicts des rôles amont (R2, R3) et raisons d'abandon.
  "pas_d_angle",
  "pas_de_matiere",
  "dossier_insuffisant",
  // Faits.
  "fait_non_source",
  "chiffre_retire",
  // Intention, doublons.
  "intention_couverte",
  "doublon_semantique",
  "doublon_plan",
  "intention_non_respectee",
  // Fond du contenu.
  "apport_absent",
  "generique",
  "non_actionnable",
  "appel_incoherent",
  "date_ou_auteur",
  "texte_cache",
  "lien_mort",
  "doctrine",
  "plagiat",
  // Forme et structure.
  "style",
  "structure_titres",
  "longueur_hors_fourchette",
  "reponse_directe_absente",
  // Système et humains.
  "coupe_circuit",
  "plafond_atteint",
  "refus_humain",
  "autre",
] as const;

export type CodeRefus = (typeof CODES_REFUS)[number];

const ENSEMBLE_CODES: ReadonlySet<string> = new Set(CODES_REFUS);

/** Vrai seulement pour un des codes de la liste fermée. */
export function estCodeRefus(valeur: unknown): valeur is CodeRefus {
  return typeof valeur === "string" && ENSEMBLE_CODES.has(valeur);
}

/** Libellés en français simple, pour la console (aucun jargon, aucun identifiant). */
export const LIBELLES_CODES: Readonly<Record<CodeRefus, string>> = {
  pas_d_angle: "Aucun angle que les pages concurrentes ne disent pas",
  pas_de_matiere: "Pas de note de terrain ni d'apport original disponible",
  dossier_insuffisant: "Pas assez de faits sourcés et datés",
  fait_non_source: "Un fait ou un chiffre n'a pas de source",
  chiffre_retire: "Le chiffre cité n'est pas retrouvé dans la source",
  intention_couverte: "Cette question est déjà traitée par une autre page",
  doublon_semantique: "Trop proche d'un contenu déjà publié",
  doublon_plan: "Plan quasi identique à celui d'un autre contenu",
  intention_non_respectee: "Le contenu ne répond pas à l'intention de recherche visée",
  apport_absent: "Aucun apport original (exemple, chiffre sourcé, angle PME)",
  generique: "Contenu trop général, rien d'unique à apprendre",
  non_actionnable: "Le lecteur ne sait pas quoi décider ni quoi demander",
  appel_incoherent: "L'appel à l'action est absent, multiple ou incohérent",
  date_ou_auteur: "Auteur ou dates non honnêtes",
  texte_cache: "Texte caché ou consigne adressée à une IA",
  lien_mort: "Lien interne ou externe cassé",
  doctrine: "Règle de marque enfreinte",
  plagiat: "Texte trop proche d'un autre texte",
  style: "Forme à reprendre (métadonnées, complétude, style)",
  structure_titres: "Structure des titres fautive (H1 unique, 3 à 8 H2)",
  longueur_hors_fourchette: "Longueur hors de la fourchette attendue",
  reponse_directe_absente: "Pas de réponse directe en tête de page",
  coupe_circuit: "Mis en attente : plafond du jour ou coupe-circuit déclenché",
  plafond_atteint: "Abandon : plafond de coût ou de tentatives atteint",
  refus_humain: "Refusé par une personne (motif saisi à part)",
  autre: "Autre raison (voir le détail)",
};

/** Critères bloquants de la porte qualité, B01 à B17 (noms figés, § 4.1). */
export const CRITERES_BLOQUANTS = [
  "B01",
  "B02",
  "B03",
  "B04",
  "B05",
  "B06",
  "B07",
  "B08",
  "B09",
  "B10",
  "B11",
  "B12",
  "B13",
  "B14",
  "B15",
  "B16",
  "B17",
] as const;

export type CritereBloquant = (typeof CRITERES_BLOQUANTS)[number];

/**
 * Correspondance Bnn → code(s). Le PREMIER code est le code par défaut (table du
 * § 8 de la chaîne, sauf B08, voir plus bas) ; les suivants sont des précisions permises quand la cause
 * est connue (le détail enregistré garde de toute façon le critère exact).
 *
 * - B02 : `fait_non_source` si la source manque, `chiffre_retire` si le chiffre
 *   n'est pas retrouvé dans la source.
 * - B08 : ÉCART ASSUMÉ avec le § 8 de la chaîne (qui dit `style`) : le défaut est
 *   `reponse_directe_absente`, code demandé par C4 ; le § 8 doit être mis à jour.
 *   `reponse_directe_absente` (C4) ; `style` si la réponse existe mais est
 *   mal formée (hors fourchette de 40 à 60 mots, trop tardive).
 * - B11 : `style` par défaut ; `longueur_hors_fourchette` ou `structure_titres`
 *   (H1 unique, 3 à 8 H2) quand la complétude échoue pour l'une de ces causes.
 * - Autres écarts avec le § 5.1 de la porte, où la chaîne prime : B05, B06
 *   (`intention_couverte`, `doublon_semantique`, pas `doublon_plan`), B07
 *   (`apport_absent`, pas `generique`), B16 (`generique` seul ; `non_actionnable`
 *   reste propre à R5, hors critère).
 * - B04 reste `fait_non_source` : pas de code « réglementation » (§ 8 de la chaîne,
 *   qui prime sur la mention contraire du § 5.1 de la porte).
 * - B17 est un REPORT (le contenu attend), jamais un refus.
 */
export const CORRESPONDANCE_BNN: Readonly<
  Record<CritereBloquant, readonly [CodeRefus, ...CodeRefus[]]>
> = {
  B01: ["doctrine"],
  B02: ["fait_non_source", "chiffre_retire"],
  B03: ["fait_non_source"],
  B04: ["fait_non_source"],
  B05: ["intention_couverte"],
  B06: ["doublon_semantique"],
  B07: ["apport_absent"],
  B08: ["reponse_directe_absente", "style"],
  B09: ["dossier_insuffisant"],
  B10: ["appel_incoherent"],
  B11: ["style", "longueur_hors_fourchette", "structure_titres"],
  B12: ["style"],
  B13: ["lien_mort"],
  B14: ["date_ou_auteur"],
  B15: ["texte_cache"],
  B16: ["generique"],
  B17: ["coupe_circuit"],
};

/**
 * Codes qu'aucun Bnn ne produit : verdicts des rôles amont (R2, R3, R5), contrôles
 * existants hors porte (SimHash, plagiat, intention), abandon, refus humain.
 */
export const CODES_HORS_CRITERE = [
  "pas_d_angle",
  "pas_de_matiere",
  "doublon_plan",
  "intention_non_respectee",
  "non_actionnable",
  "plagiat",
  "plafond_atteint",
  "refus_humain",
  "autre",
] as const satisfies readonly CodeRefus[];

/**
 * Code à enregistrer pour un critère. `precision` n'est retenue que si la
 * correspondance la permet ; sinon on retombe sur le code par défaut, jamais sur
 * un code étranger au critère.
 */
export function codePourCritere(critere: CritereBloquant, precision?: CodeRefus): CodeRefus {
  const codes = CORRESPONDANCE_BNN[critere];
  if (precision !== undefined && codes.includes(precision)) return precision;
  return codes[0];
}

/** Critères bloquants qui peuvent mener à ce code (liste vide : code hors critère). */
export function criteresPourCode(code: CodeRefus): CritereBloquant[] {
  return CRITERES_BLOQUANTS.filter((b) => CORRESPONDANCE_BNN[b].includes(code));
}

/**
 * Un REPORT n'est pas un refus : pas de réécriture, pas d'abandon, exclu du taux
 * de refus (porte, § 5, ligne `reporte`).
 */
export function estReport(code: CodeRefus): boolean {
  return code === "coupe_circuit";
}
