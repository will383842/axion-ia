/**
 * Local SEO citations FR (Sprint v7 Phase 14).
 *
 * Catalogue des annuaires FR de référence où Axion-IA doit être listé pour
 * maximiser le signal "Local Business" Google + Bing Places + Apple Maps.
 *
 * Cohérence avec doctrine projet :
 *   - Axion-IA = société française avec 1 siège (Paris) + zone de service
 *     nationale (Service Area Business pattern, cf. P1-1 audit E2E)
 *   - Les annuaires servent à triangulation NAP (Name + Address + Phone)
 *     même si on n'a pas de téléphone publique (cohérence brand : email-first)
 *
 * Helper exposé :
 *   - LOCAL_CITATIONS_FR catalog (annuaires + URLs + statut listing)
 *   - buildLocalBusinessSameAsFR() → array URLs annuaires actifs pour
 *     injection dans schema LocalBusiness.sameAs (signal cross-platform)
 */

export interface LocalCitationEntry {
  /** Slug stable pour reporting/admin. */
  readonly slug: string;
  /** Nom affiché annuaire (PagesJaunes, Mappy…). */
  readonly name: string;
  /** URL profil Axion-IA sur cet annuaire (null si pas encore listé). */
  readonly listingUrl: string | null;
  /** URL annuaire racine (fallback si listing pas encore créé). */
  readonly directoryUrl: string;
  /** Priorité création listing : 1=critique, 5=optionnel. */
  readonly priority: 1 | 2 | 3 | 4 | 5;
  /** Catégorie ciblée (B2B, IT, Conseil, etc.). */
  readonly category: string;
}

/**
 * Catalogue annuaires FR — priorité ordonnée critique → optionnel.
 * Listing URLs initialement null (action Will à compléter post-validation
 * profil). buildLocalBusinessSameAsFR filtre sur listingUrl non-null.
 */
export const LOCAL_CITATIONS_FR: ReadonlyArray<LocalCitationEntry> = [
  // ─── Priorité 1 — Critique (signal NAP majeur Google) ─────────────────────
  {
    slug: "pages-jaunes",
    name: "PagesJaunes",
    listingUrl: null,
    directoryUrl: "https://www.pagesjaunes.fr",
    priority: 1,
    category: "Annuaire généraliste",
  },
  {
    slug: "google-business",
    name: "Google Business Profile",
    listingUrl: null,
    directoryUrl: "https://www.google.com/business",
    priority: 1,
    category: "GMB",
  },
  {
    slug: "bing-places",
    name: "Bing Places for Business",
    listingUrl: null,
    directoryUrl: "https://www.bingplaces.com",
    priority: 1,
    category: "Bing Maps",
  },
  // ─── Priorité 2 — Important (B2B-spécifique) ──────────────────────────────
  {
    slug: "kompass",
    name: "Kompass France",
    listingUrl: null,
    directoryUrl: "https://fr.kompass.com",
    priority: 2,
    category: "B2B",
  },
  {
    slug: "societe-com",
    name: "Societe.com",
    listingUrl: null,
    directoryUrl: "https://www.societe.com",
    priority: 2,
    category: "Données légales",
  },
  {
    slug: "infogreffe",
    name: "Infogreffe",
    listingUrl: null,
    directoryUrl: "https://www.infogreffe.fr",
    priority: 2,
    category: "Données légales",
  },
  // ─── Priorité 3 — Tech/Consulting spécialisé ──────────────────────────────
  {
    slug: "linkedin-company",
    name: "LinkedIn Company Page",
    listingUrl: null,
    directoryUrl: "https://www.linkedin.com/company",
    priority: 3,
    category: "Réseau pro",
  },
  {
    slug: "frenchtech-directory",
    name: "La French Tech Directory",
    listingUrl: null,
    directoryUrl: "https://lafrenchtech.com",
    priority: 3,
    category: "Tech FR",
  },
  // ─── Priorité 4 — Géo (par ville/région) ──────────────────────────────────
  {
    slug: "mappy",
    name: "Mappy",
    listingUrl: null,
    directoryUrl: "https://fr.mappy.com",
    priority: 4,
    category: "Géolocalisation",
  },
  {
    slug: "118000",
    name: "118 000 (annuaire)",
    listingUrl: null,
    directoryUrl: "https://www.118000.fr",
    priority: 4,
    category: "Annuaire",
  },
];

/**
 * Retourne array URLs des annuaires où Axion-IA est effectivement listé
 * (filtré sur listingUrl non-null). Injectable dans LocalBusiness.sameAs.
 *
 * V1 : retourne [] tant que les listings ne sont pas créés.
 * Quand Will créera un profil, mettre listingUrl: "https://..." dans le catalog.
 */
export function buildLocalBusinessSameAsFR(): ReadonlyArray<string> {
  return LOCAL_CITATIONS_FR.filter(
    (c): c is LocalCitationEntry & { listingUrl: string } => c.listingUrl !== null,
  ).map((c) => c.listingUrl);
}

/**
 * Status helper pour admin UI — coverage citations par priorité.
 * Utilisable côté `/content-gen/settings/local-seo` pour visualiser l'état.
 */
export function getLocalCitationsCoverage(): {
  readonly total: number;
  readonly listed: number;
  readonly byPriority: Record<1 | 2 | 3 | 4 | 5, { total: number; listed: number }>;
} {
  const byPriority: Record<1 | 2 | 3 | 4 | 5, { total: number; listed: number }> = {
    1: { total: 0, listed: 0 },
    2: { total: 0, listed: 0 },
    3: { total: 0, listed: 0 },
    4: { total: 0, listed: 0 },
    5: { total: 0, listed: 0 },
  };
  let total = 0;
  let listed = 0;
  for (const c of LOCAL_CITATIONS_FR) {
    total++;
    byPriority[c.priority].total++;
    if (c.listingUrl !== null) {
      listed++;
      byPriority[c.priority].listed++;
    }
  }
  return { total, listed, byPriority };
}
