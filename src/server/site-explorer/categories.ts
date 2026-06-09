// Catégorisation canonique des URLs publiques — onglet « Toutes les URLs ».
//
// Regroupe les ~3000+ routes du Site Explorer en grandes familles métier pour
// que Will les retrouve facilement (décision 2026-06-08). La catégorie est
// dérivée du `section` (1er segment d'URL après la locale) calculé par
// `route-enumerator.ts`, avec un fallback sur le pathPattern.
//
// SSOT : ce fichier est l'unique source de vérité du mapping section→catégorie.
// L'UI (filtres + compteurs) et le worker de découverte le réutilisent.

/** Familles de regroupement affichées dans l'onglet « Toutes les URLs ». */
export type RouteCategory =
  | "commercial" // Hubs services + pages-intention (audit, formation, implémentation, un-à-un, sites web)
  | "villes" // Pages par-ville (5 verticales) + implantations région/ville
  | "contenu" // Blog, guides, actualités, connaissances, glossaire, cas-concrets, comparaisons, presse
  | "aide" // FAQ, centre d'aide
  | "legal" // Mentions légales, CGV, RGPD, cookies, footer juridique
  | "conversion" // Formulaires : contact, devis, demande, réservation, appel
  | "transversal" // À-propos, équipe, méthodo, stack-IA, ROI, tarifs, transparence…
  | "galerie" // Galerie d'images + téléchargements
  | "autre"; // Non classé (fallback)

/** Libellés FR affichés dans l'UI. */
export const ROUTE_CATEGORY_LABELS: Record<RouteCategory, string> = {
  commercial: "Commercial & offres",
  villes: "Villes & implantations",
  contenu: "Contenu éditorial",
  aide: "Aide & FAQ",
  legal: "Légal & footer",
  conversion: "Formulaires & conversion",
  transversal: "Transversal",
  galerie: "Galerie",
  autre: "Autre",
};

/** Ordre d'affichage stable des catégories (compteurs + filtres). */
export const ROUTE_CATEGORY_ORDER: ReadonlyArray<RouteCategory> = [
  "commercial",
  "villes",
  "contenu",
  "aide",
  "conversion",
  "transversal",
  "galerie",
  "legal",
  "autre",
];

// Mapping section (1er segment FR) → catégorie. Une section absente tombe dans
// le fallback pathPattern puis "autre".
const SECTION_TO_CATEGORY: Record<string, RouteCategory> = {
  // Commercial — 5 verticales services + hubs/intentions
  audit: "commercial",
  interventions: "commercial",
  implementation: "commercial",
  "un-a-un": "commercial",
  "sites-web-augmentes": "commercial",

  // Villes & implantations
  implantations: "villes",

  // Contenu éditorial
  blog: "contenu",
  guides: "contenu",
  actualites: "contenu",
  connaissances: "contenu",
  ressources: "contenu",
  glossaire: "contenu",
  "cas-concrets": "contenu",
  comparaisons: "contenu",
  presse: "contenu",

  // Aide
  faq: "aide",
  "centre-aide": "aide",

  // Transversal
  "a-propos": "transversal",
  equipe: "transversal",
  methodologie: "transversal",
  "stack-ia": "transversal",
  "guide-ia": "transversal",
  roi: "transversal",
  tarifs: "transversal",
  transparence: "transversal",
  "charte-editoriale": "transversal",
  corrections: "transversal",
  "sous-processeurs": "transversal",
  recherche: "transversal",

  // Conversion / formulaires
  contact: "conversion",
  "demande-devis": "conversion",
  reserver: "conversion",
  appel: "conversion",
  booking: "conversion",

  // Galerie
  galerie: "galerie",

  // Légal & footer
  "mentions-legales": "legal",
  "conditions-generales": "legal",
  "politique-confidentialite": "legal",
  "politique-deplacement": "legal",
  cookies: "legal",
  "preferences-cookies": "legal",
  rgpd: "legal",
  accessibilite: "legal",
  "mes-donnees": "legal",
  desabonnement: "legal",
  confirmation: "legal",
};

// Les pages-intention de service vivent sous le hub mais peuvent avoir un 2e
// segment ; elles restent "commercial". Sections villes×service sont déjà
// "commercial" par la map (audit/interventions/...) — on les bascule en "villes"
// uniquement quand le pattern contient `/par-ville/`.
const VILLE_SERVICE_MARKER = "/par-ville/";

/**
 * Catégorise une route à partir de son `section` (1er segment FR) et de son
 * pathPattern. Déterministe, sans I/O.
 */
export function categorizeRoute(section: string | null, pathPattern: string): RouteCategory {
  // Pages ville×service (ex. /fr/audit/par-ville/[ville]) → catégorie villes,
  // pas commercial (ce sont des pages géolocalisées, pas le hub d'offre).
  if (pathPattern.includes(VILLE_SERVICE_MARKER)) return "villes";

  if (section && section in SECTION_TO_CATEGORY) {
    return SECTION_TO_CATEGORY[section]!;
  }

  // Home (`/fr` sans section) = commercial (page d'accueil = vitrine offre).
  const segments = pathPattern.split("/").filter(Boolean);
  if (segments.length <= 1) return "commercial";

  return "autre";
}
