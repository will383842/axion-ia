// SSOT — Énumérations internes du module Prospection & Base Entreprises (T1).
//
// Contrat unique partagé par les mappings SSOT (T1), le schéma Prisma (T2 — les
// `enum` Prisma reflètent ces listes), les workers (T3-T5) et l'UI admin (T6-T7).
// Valeurs en `snake_case` (compatibles enum Postgres/Prisma). Chaque enum « ouvert »
// (dérivé d'une source externe) possède une valeur de repli explicite (`autre`,
// `inconnu`…) pour ne JAMAIS perdre une donnée non mappée (cf. 01-DATA-MODEL).

/** Taille dérivée de la tranche d'effectif INSEE (cf. `taille.ts`). */
export const TAILLES = ["TPE", "PME", "ETI", "GE"] as const;
export type Taille = (typeof TAILLES)[number];

/** Provenance de la taille (traçabilité). */
export const TAILLE_SOURCES = ["effectif", "categorie_insee"] as const;
export type TailleSource = (typeof TAILLE_SOURCES)[number];

/** Catégorie entreprise INSEE brute (quand présente). */
export const CATEGORIES_ENTREPRISE = ["PME", "ETI", "GE"] as const;
export type CategorieEntreprise = (typeof CATEGORIES_ENTREPRISE)[number];

/** Regroupement métier interne (dérivé du NAF — cf. `naf-to-secteur.ts`). Exhaustif + repli `autre`. */
export const SECTEURS = [
  "btp",
  "sante",
  "action_sociale",
  "droit",
  "numerique",
  "conseil",
  "finance_assurance",
  "immobilier",
  "commerce",
  "industrie",
  "agriculture",
  "transport_logistique",
  "hotellerie_restauration",
  "enseignement",
  "administration_publique",
  "arts_culture_sport",
  "services_aux_entreprises",
  "services_aux_particuliers",
  "autre",
] as const;
export type Secteur = (typeof SECTEURS)[number];

/** Libellés FR des secteurs (affichage console — « Par activité »). */
export const SECTEUR_LABELS: Record<Secteur, string> = {
  btp: "BTP",
  sante: "Santé",
  action_sociale: "Action sociale",
  droit: "Droit",
  numerique: "Numérique",
  conseil: "Conseil",
  finance_assurance: "Finance / Assurance",
  immobilier: "Immobilier",
  commerce: "Commerce",
  industrie: "Industrie",
  agriculture: "Agriculture",
  transport_logistique: "Transport / Logistique",
  hotellerie_restauration: "Hôtellerie / Restauration",
  enseignement: "Enseignement",
  administration_publique: "Administration publique",
  arts_culture_sport: "Arts / Culture / Sport",
  services_aux_entreprises: "Services aux entreprises",
  services_aux_particuliers: "Services aux particuliers",
  autre: "Autre",
};

/** Type d'organisation (dérivé de la nature juridique INSEE). */
export const TYPES_ORGANISATION = [
  "privee",
  "publique",
  "parapublique",
  "association",
  "collectivite",
  "epic",
] as const;
export type TypeOrganisation = (typeof TYPES_ORGANISATION)[number];

/** Exploitabilité principale d'une entreprise (cf. 07-DECISIONS Q2). */
export const CONTACTABILITES = ["exploitable", "partiel", "non_contactable"] as const;
export type Contactabilite = (typeof CONTACTABILITES)[number];

/** Nuance d'exploitabilité (pèse dans le leadScore). */
export const CONTACTABILITE_NUANCES = [
  "exploitable_nominatif",
  "exploitable_generique",
  "aucune",
] as const;
export type ContactabiliteNuance = (typeof CONTACTABILITE_NUANCES)[number];

/** Séniorité d'un rôle (cf. `qualite-to-fonction.ts`). */
export const SENIORITES = [
  "dirigeant",
  "directeur",
  "responsable",
  "manager",
  "cadre",
  "autre",
] as const;
export type Seniorite = (typeof SENIORITES)[number];

/** Département fonctionnel d'un rôle. */
export const DEPARTEMENTS_FONCTIONNELS = [
  "direction",
  "commercial",
  "rh",
  "achats",
  "finance",
  "technique",
  "dsi",
  "marketing",
  "juridique",
  "production",
  "qhse",
  "autre",
] as const;
export type DepartementFonctionnel = (typeof DEPARTEMENTS_FONCTIONNELS)[number];

/** Fonction normalisée (enum via SSOT `qualite-to-fonction.ts`, repli `autre` obligatoire). */
export const FONCTIONS_NORMALISEES = [
  "gerant",
  "president",
  "directeur_general",
  "directeur_general_delegue",
  "directeur",
  "directeur_administratif_financier",
  "directeur_commercial",
  "directeur_technique",
  "directeur_des_systemes_information",
  "directeur_marketing",
  "directeur_ressources_humaines",
  "directeur_achats",
  "directeur_production",
  "responsable_commercial",
  "responsable_rh",
  "responsable_achats",
  "responsable_marketing",
  "responsable_technique",
  "responsable_qhse",
  "responsable_administratif",
  "associe",
  "manager",
  "cadre",
  "autre",
] as const;
export type FonctionNormalisee = (typeof FONCTIONS_NORMALISEES)[number];

/** Statut d'enrichissement d'une entreprise. */
export const ENRICHMENT_STATUSES = [
  "pending",
  "enriching",
  "enriched",
  "failed",
  "no_data",
] as const;
export type EnrichmentStatus = (typeof ENRICHMENT_STATUSES)[number];

/** Statut d'une campagne de prospection. */
export const CAMPAIGN_STATUTS = [
  "brouillon",
  "active",
  "en_pause",
  "en_pause_quota",
  "terminee",
] as const;
export type CampaignStatut = (typeof CAMPAIGN_STATUTS)[number];

/** Statut d'une cellule de couverture (= work-list). */
export const CELL_STATUTS = ["a_faire", "en_cours", "fait", "erreur"] as const;
export type CellStatut = (typeof CELL_STATUTS)[number];

/** Statut de diffusion INSEE (RGPD — `non_diffusible` = exclu partout). */
export const STATUTS_DIFFUSION = ["diffusible", "non_diffusible", "partiel"] as const;
export type StatutDiffusion = (typeof STATUTS_DIFFUSION)[number];

/** Statut de vérification d'un contact (email + téléphone). */
export const VERIF_STATUSES = [
  "verified_syntax",
  "mx_ok",
  "role",
  "invalid",
  "e164_ok",
  "invalide",
] as const;
export type VerifStatus = (typeof VERIF_STATUSES)[number];

/** État administratif d'une unité légale / établissement. */
export const ETATS_ADMINISTRATIFS = ["actif", "cesse"] as const;
export type EtatAdministratif = (typeof ETATS_ADMINISTRATIFS)[number];

/** Source d'une donnée (provenance / réconciliation multi-sources). */
export const SOURCES = [
  "stock_sirene",
  "sirene",
  "recherche_entreprises",
  "rne",
  "annuaire_administration",
  "bodacc",
  "ban",
  "site_scrape",
  "manuel",
] as const;
export type Source = (typeof SOURCES)[number];

/** Méthode de preuve d'appartenance du domaine au SIREN. */
export const DOMAIN_MATCH_METHODS = [
  "siren_on_page",
  "denomination_on_page",
  "open_data_field",
  "heuristic",
  "none",
] as const;
export type DomainMatchMethod = (typeof DOMAIN_MATCH_METHODS)[number];

/** État du site web découvert. */
export const SITE_WEB_STATUSES = ["verifie", "mort", "redirige", "inconnu"] as const;
export type SiteWebStatus = (typeof SITE_WEB_STATUSES)[number];

/** Type de contact. */
export const CONTACT_TYPES = ["email", "telephone"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

/** Origine d'une assignation de tag. */
export const ASSIGNED_BYS = ["auto", "user"] as const;
export type AssignedBy = (typeof ASSIGNED_BYS)[number];

/** Type hiérarchique d'un tag. */
export const TAG_TYPES = ["SECTEUR", "TAILLE", "DEPARTEMENT", "SOURCE", "QUALITE"] as const;
export type TagType = (typeof TAG_TYPES)[number];

/** Clé d'une entrée d'opposition (opt-out multi-clé — RGPD). */
export const SUPPRESSION_TYPES = ["siren", "email", "domaine", "personKey"] as const;
export type SuppressionType = (typeof SUPPRESSION_TYPES)[number];

/** Type d'événement (journal append-only). */
export const PROSPECTION_EVENT_TYPES = [
  "company_collected",
  "person_added",
  "contact_scraped",
  "opt_out",
  "export",
  "campaign_started",
  "paused",
  "resumed",
  "completed",
  "refresh",
] as const;
export type ProspectionEventType = (typeof PROSPECTION_EVENT_TYPES)[number];

/** Action journalisée d'accès aux données personnelles (RGPD). */
export const ACCESS_LOG_ACTIONS = ["view_person", "search", "export"] as const;
export type AccessLogAction = (typeof ACCESS_LOG_ACTIONS)[number];

/** Statut d'un run de collecte de cellule. */
export const COLLECT_RUN_STATUSES = ["running", "done", "error"] as const;
export type CollectRunStatus = (typeof COLLECT_RUN_STATUSES)[number];

/** Scope d'un rollup de couverture géographique. */
export const GEO_SCOPES = ["departement", "region", "france"] as const;
export type GeoScope = (typeof GEO_SCOPES)[number];
