// Simulateur de gains v2 — fonctions de l'entreprise et grandeurs mesurables.
//
// Ces deux tables sont le vocabulaire commun du questionnaire et du référentiel
// de tâches. Le wizard demande QUELLES fonctions existent, puis pose les
// questions de volume rattachées à ces seules fonctions. Les tâches de
// `tasks.ts` consomment ensuite les volumes collectés.
//
// Règle de rédaction des libellés de volume : la question doit pouvoir recevoir
// une réponse de tête, en moins de dix secondes, sans ouvrir de logiciel. Si
// une question exige d'aller compter, elle est mal posée — c'est exactement le
// défaut qui a coulé la v1.

import type {
  BusinessFunction,
  BusinessFunctionDef,
  RoiSectorKey,
  VolumeDef,
  VolumeKey,
} from "./types";

export const BUSINESS_FUNCTIONS: readonly BusinessFunctionDef[] = [
  {
    id: "administratif",
    labelFr: "Administratif",
    questionLabelFr: "Administratif et secrétariat",
    hintFr: "Facturation, saisie, classement, planification des rendez-vous.",
  },
  {
    id: "commercial",
    labelFr: "Commercial",
    questionLabelFr: "Commercial et devis",
    hintFr: "Devis, propositions, prospection, relances.",
  },
  {
    id: "relation_client",
    labelFr: "Relation client",
    questionLabelFr: "Relation client et SAV",
    hintFr: "Appels entrants, demandes écrites, réclamations.",
  },
  {
    id: "production",
    labelFr: "Production et métier",
    questionLabelFr: "Le cœur de votre métier",
    hintFr: "Comptes-rendus, dossiers, recherche d'information, contrôles.",
  },
  {
    id: "marketing",
    labelFr: "Marketing et communication",
    questionLabelFr: "Marketing et communication",
    hintFr: "Publications, contenus, site web, newsletters.",
  },
  {
    id: "rh",
    labelFr: "Ressources humaines",
    questionLabelFr: "Recrutement et RH",
    hintFr: "Candidatures, entretiens, intégration des nouveaux arrivants.",
  },
  {
    id: "finance",
    labelFr: "Finance et pilotage",
    questionLabelFr: "Finance et pilotage",
    hintFr: "Reporting, tableaux de bord, rapprochements comptables.",
  },
  {
    id: "direction",
    labelFr: "Direction",
    questionLabelFr: "Direction et coordination",
    hintFr: "Réunions, arbitrages, suivi d'activité.",
  },
] as const;

const FUNCTION_BY_ID: ReadonlyMap<BusinessFunction, BusinessFunctionDef> = new Map(
  BUSINESS_FUNCTIONS.map((f) => [f.id, f]),
);

export function getBusinessFunction(id: BusinessFunction): BusinessFunctionDef | undefined {
  return FUNCTION_BY_ID.get(id);
}

export function businessFunctionLabel(id: BusinessFunction): string {
  return FUNCTION_BY_ID.get(id)?.labelFr ?? id;
}

// ---------------------------------------------------------------------------
// Grandeurs mesurables
// ---------------------------------------------------------------------------

export const VOLUME_DEFS: readonly VolumeDef[] = [
  // ── Administratif ────────────────────────────────────────────────────────
  {
    key: "factures_emises_mois",
    fn: "administratif",
    period: "mois",
    unitFr: ["facture", "factures"],
  },
  {
    key: "saisie_documents_mois",
    fn: "administratif",
    period: "mois",
    unitFr: ["document", "documents"],
  },
  {
    key: "emails_traites_jour",
    fn: "administratif",
    period: "jour",
    unitFr: ["e-mail", "e-mails"],
  },
  {
    key: "rdv_planifies_semaine",
    fn: "administratif",
    period: "semaine",
    unitFr: ["rendez-vous", "rendez-vous"],
  },

  // ── Commercial ───────────────────────────────────────────────────────────
  { key: "devis_emis_semaine", fn: "commercial", period: "semaine", unitFr: ["devis", "devis"] },
  {
    key: "relances_commerciales_mois",
    fn: "commercial",
    period: "mois",
    unitFr: ["relance", "relances"],
  },
  {
    key: "prospects_qualifies_mois",
    fn: "commercial",
    period: "mois",
    unitFr: ["prospect", "prospects"],
  },
  {
    key: "propositions_longues_mois",
    fn: "commercial",
    period: "mois",
    unitFr: ["proposition", "propositions"],
  },

  // ── Relation client ──────────────────────────────────────────────────────
  {
    key: "appels_entrants_jour",
    fn: "relation_client",
    period: "jour",
    unitFr: ["appel", "appels"],
  },
  {
    key: "demandes_ecrites_jour",
    fn: "relation_client",
    period: "jour",
    unitFr: ["demande", "demandes"],
  },
  {
    key: "reclamations_mois",
    fn: "relation_client",
    period: "mois",
    unitFr: ["réclamation", "réclamations"],
  },

  // ── Production / métier ──────────────────────────────────────────────────
  {
    key: "comptes_rendus_semaine",
    fn: "production",
    period: "semaine",
    unitFr: ["compte-rendu", "comptes-rendus"],
  },
  {
    key: "recherches_documentaires_semaine",
    fn: "production",
    period: "semaine",
    unitFr: ["recherche", "recherches"],
  },
  {
    key: "documents_rediges_semaine",
    fn: "production",
    period: "semaine",
    unitFr: ["document", "documents"],
  },
  {
    key: "controles_conformite_mois",
    fn: "production",
    period: "mois",
    unitFr: ["contrôle", "contrôles"],
  },

  // ── Marketing ────────────────────────────────────────────────────────────
  {
    key: "publications_mois",
    fn: "marketing",
    period: "mois",
    unitFr: ["publication", "publications"],
  },
  {
    key: "articles_rediges_mois",
    fn: "marketing",
    period: "mois",
    unitFr: ["article", "articles"],
  },

  // ── RH ───────────────────────────────────────────────────────────────────
  {
    key: "candidatures_recues_mois",
    fn: "rh",
    period: "mois",
    unitFr: ["candidature", "candidatures"],
  },
  { key: "entretiens_menes_mois", fn: "rh", period: "mois", unitFr: ["entretien", "entretiens"] },
  { key: "onboardings_an", fn: "rh", period: "an", unitFr: ["intégration", "intégrations"] },

  // ── Finance / direction ──────────────────────────────────────────────────
  {
    key: "reportings_produits_mois",
    fn: "finance",
    period: "mois",
    unitFr: ["rapport", "rapports"],
  },
  {
    key: "rapprochements_mois",
    fn: "finance",
    period: "mois",
    unitFr: ["rapprochement", "rapprochements"],
  },
] as const;

// ---------------------------------------------------------------------------
// Pré-remplissage sectoriel
// ---------------------------------------------------------------------------

/**
 * Fonctions PRÉ-COCHÉES à l'écran « qu'est-ce qui vous prend du temps ? »,
 * selon le secteur déclaré juste avant.
 *
 * ── Pourquoi ce pré-remplissage existe ────────────────────────────────────
 * Cet écran est le seul du parcours qui demande une VRAIE décision (huit cases
 * à arbitrer) et le seul qui exige un appui supplémentaire pour continuer.
 * C'est mécaniquement le point de décrochage le plus probable. Il commande en
 * outre toute la suite : trop de cases cochées, et le questionnaire s'allonge
 * jusqu'à l'abandon.
 *
 * En proposant d'emblée les deux ou trois fonctions qui existent chez
 * quasiment tous les acteurs du secteur, l'écran passe d'un arbitrage à une
 * simple confirmation — un appui — tout en restant entièrement modifiable.
 *
 * ── Règle de composition ──────────────────────────────────────────────────
 * DEUX à TROIS fonctions, jamais plus : chacune ajoute deux questions de
 * volume. On ne retient que celles dont la présence ne fait aucun doute dans
 * le secteur. `marketing`, `rh` et `finance` sont volontairement rares ici —
 * ce sont précisément les fonctions qu'une TPE n'a pas, et les pré-cocher
 * ferait répondre « je ne sais pas » à des questions inutiles.
 */
export const SECTOR_DEFAULT_FUNCTIONS: Readonly<Record<RoiSectorKey, readonly BusinessFunction[]>> =
  {
    generique: ["administratif", "commercial", "production"],
    comptabilite_finance: ["administratif", "production", "finance"],
    btp_immobilier: ["administratif", "commercial", "production"],
    restauration_hotellerie: ["administratif", "relation_client"],
    sante_medecine: ["administratif", "relation_client", "production"],
    juridique: ["administratif", "production"],
    commerce_retail: ["administratif", "commercial", "relation_client"],
    industrie_logistique: ["administratif", "production", "commercial"],
    artisanat_services: ["administratif", "commercial"],
    rh_recrutement: ["administratif", "rh", "relation_client"],
    collectivites_public: ["administratif", "production", "relation_client"],
  };

const VOLUME_BY_KEY: ReadonlyMap<VolumeKey, VolumeDef> = new Map(
  VOLUME_DEFS.map((v) => [v.key, v]),
);

export function getVolumeDef(key: VolumeKey): VolumeDef | undefined {
  return VOLUME_BY_KEY.get(key);
}

/** Accorde l'unité d'une grandeur avec la valeur (« 1 devis », « 12 devis »). */
export function volumeUnitLabel(key: VolumeKey, value: number): string {
  const def = VOLUME_BY_KEY.get(key);
  if (!def) return "";
  return Math.abs(value) >= 2 ? def.unitFr[1] : def.unitFr[0];
}
