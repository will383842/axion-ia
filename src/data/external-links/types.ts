/**
 * EXTERNAL LINKS DATABASE — Types & SSOT
 *
 * Catalogue centralisé d'autorité (~2 400 liens) injecté automatiquement
 * dans tous les articles générés. Source d'autorité réelle — anti-hallucination IA,
 * co-citation autorité Google E-E-A-T, conformité AEO/GEO 2026.
 *
 * Cf. _AUDIT/EXTERNAL-LINKS-2026-05-22/PHASE-0-RACCORDEMENT.md
 */

export type ExternalLinkCategory =
  | "gov_fr" // .gouv.fr / .fr public (autorité 5)
  | "gov_eu" // .europa.eu (autorité 4-5)
  | "academic" // .edu / Stanford / MIT / ESSEC / HEC (autorité 5)
  | "research_industry" // McKinsey RI / Gartner / Forrester / IDC / Capgemini RI (autorité 4)
  | "press_top" // JDN / Frenchweb / Numerama / Les Échos Tech (autorité 3)
  | "industry_assoc" // Syntec, observatoires sectoriels (autorité 3)
  | "official_doc" // ISO, AFNOR, IEEE, ArXiv (autorité 5)
  | "mairie" // Mairie officielle .fr (autorité 4)
  | "cci" // CCI .fr (autorité 4)
  | "opco" // OPCO formation (autorité 4)
  | "international"; // OECD, UNESCO, World Bank (autorité 4)

export type ExternalLinkScope = "national" | "regional" | "local" | "international";

export type ExternalLinkStatus =
  "active" | "redirect_acceptable" | "redirect_problem" | "404" | "deprecated" | "pending_verify";

export type ExternalLinkAuthority = 1 | 2 | 3 | 4 | 5;

export type ExternalLinkRotationMode =
  | "round_robin" // Privilégie liens peu utilisés (default)
  | "weighted_authority" // Pondération autorité pure
  | "random";

export interface ExternalLink {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly organization: string;
  readonly category: ExternalLinkCategory;
  readonly scope: ExternalLinkScope;
  readonly regionSlug?: string;
  readonly cityIds?: readonly string[];
  readonly verticales: readonly string[];
  readonly topics: readonly string[];
  readonly language: "fr" | "en";
  readonly authority: ExternalLinkAuthority;
  readonly publishedYear?: number;
  readonly verifiedAt: string;
  readonly lastCheckedAt: string;
  readonly status: ExternalLinkStatus;
  readonly notes?: string;

  // === FILTRES DURS QUALITÉ SEO/AEO 2026 ===
  readonly isCompetitor: boolean;
  readonly paywall: boolean;
  readonly indexable: boolean;
  readonly isHttps: boolean;
  readonly hasSchemaOrg?: boolean;

  // === ROTATION ÉQUITABLE (hydraté depuis DB ExternalLinkUsage) ===
  usageCount: number;
  lastUsedAt?: string;
  readonly usageQuota?: number;
}

export interface SelectExternalLinksOptions {
  readonly vertical?: string;
  readonly cityId?: string;
  readonly regionSlug?: string;
  readonly topic?: string;
  readonly minAuthority?: ExternalLinkAuthority;
  readonly count?: number;
  readonly excludeIds?: readonly string[];
  readonly language?: "fr" | "en";
  readonly rotationMode?: ExternalLinkRotationMode;
  readonly maxRecentUsageHours?: number;
}

/**
 * Domaines concurrents à exclure (filtre dur).
 * Reflet de la matrice concurrentielle FR IA 2026 + décisions Will.
 */
export const COMPETITOR_DOMAINS: readonly string[] = [
  // Conseil IA grandes marques
  "axionai.fr",
  "kpmg.fr",
  "kpmg.com",
  "mckinsey.com",
  "wavestone.com",
  "siapartners.com",
  "onepoint.com",
  "devoteam.com",
  // Note : Capgemini = concurrent direct, MAIS Capgemini Research Institute = research_industry OK
  // → géré via COMPETITOR_EXCEPTIONS

  // Formation IA concurrentes
  "cegos.fr",
  "demos.fr",
  "openclassrooms.com",
  "lewagon.com",
  "simplon.co",
  "datacamp.com",
  "ib-formation.com",

  // Plateformes IA potentiellement concurrentes
  "dust.tt",
  "crisp.chat",
  "akkodis.com",
];

/**
 * Sous-domaines/chemins acceptables même si domaine racine est concurrent
 * (ex : sites recherche/insight indépendants).
 */
export const COMPETITOR_EXCEPTIONS: readonly string[] = [
  "capgemini-research-institute.com",
  "research.kpmg.com",
];

/**
 * Mots-clés détection paywall (en + fr).
 */
export const PAYWALL_KEYWORDS: readonly string[] = [
  "abonnez-vous",
  "abonnement requis",
  "réservé aux abonnés",
  "subscriber edition",
  "subscriber exclusive",
  "premium plus",
  "paywall",
  "register to read",
  "sign in to continue reading",
  "this article is available to subscribers",
];

/**
 * Vérifie si un hostname matche un domaine concurrent.
 */
export function isCompetitorDomain(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (COMPETITOR_EXCEPTIONS.some((ex) => host.includes(ex))) return false;
  return COMPETITOR_DOMAINS.some((dom) => host === dom || host.endsWith(`.${dom}`));
}

/**
 * Libellés français des trois enums ci-dessus.
 *
 * 🔴 L'ÉCRAN DU CATALOGUE ÉTAIT EN ANGLAIS ET EN VALEURS BRUTES. Titre
 * « External Links Database », en-têtes « ID / Title / Authority / Scope /
 * Status / Flags / Usage », et les menus de filtre listaient `gov_fr`,
 * `research_industry`, `pending_verify` tels quels. La colonne « Status »
 * réaffichait ensuite la même valeur brute.
 *
 * Les tables sont posées ICI, à côté des types qu'elles décrivent, pour qu'une
 * catégorie ajoutée sans libellé casse la compilation plutôt que de fuir à
 * l'écran. Deux valeurs manquaient d'ailleurs au filtre — `industry_assoc` et
 * `cci` pour les catégories, `redirect_problem` pour les statuts : elles
 * étaient donc INFILTRABLES, alors qu'elles existent en base.
 */
export const EXTERNAL_LINK_CATEGORY_LABELS: Record<ExternalLinkCategory, string> = {
  gov_fr: "Administration française",
  gov_eu: "Institutions européennes",
  academic: "Universitaire",
  research_industry: "Recherche et cabinets d'études",
  press_top: "Presse de référence",
  industry_assoc: "Fédération ou observatoire sectoriel",
  official_doc: "Norme ou document officiel",
  mairie: "Mairie",
  cci: "Chambre de commerce",
  opco: "OPCO",
  international: "Organisation internationale",
};

export const EXTERNAL_LINK_SCOPE_LABELS: Record<ExternalLinkScope, string> = {
  national: "National",
  regional: "Régional",
  local: "Local",
  international: "International",
};

export const EXTERNAL_LINK_STATUS_LABELS: Record<ExternalLinkStatus, string> = {
  active: "Actif",
  redirect_acceptable: "Redirection acceptable",
  redirect_problem: "Redirection problématique",
  "404": "Introuvable (404)",
  deprecated: "Obsolète",
  pending_verify: "À vérifier",
};
