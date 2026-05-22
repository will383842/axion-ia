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
  | "active"
  | "redirect_acceptable"
  | "redirect_problem"
  | "404"
  | "deprecated"
  | "pending_verify";

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
