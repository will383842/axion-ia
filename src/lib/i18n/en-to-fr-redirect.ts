// EN locale temporairement désactivé (2026-05-16) — voir AGENTS.md « EN re-enable ».
//
// Toggle : env var `EN_LOCALE_ENABLED=true` à set dans Coolify pour réactiver.
//
// Tant que désactivé, le proxy (`src/proxy.ts`) intercepte toute requête `/en/*`
// et émet un 301 Permanent Redirect vers l'équivalent FR. Le mapping reflète
// exactement les `pathnames` déclarés dans `src/i18n/routing.ts` :
//   - Pour les routes mappées (FR ≠ EN, ex: /a-propos ↔ /about), redirige
//     vers le pathname FR canonique.
//   - Pour les routes identiques (FR = EN, ex: /blog), swap juste le préfixe
//     locale `/en` → `/fr`.
//
// SEO : le 301 transmet le link juice côté Google. Les EN URLs déjà indexées
// seront progressivement remplacées par les FR équivalentes dans l'index.
// Au moment de réactiver EN, les EN URLs seront à nouveau servies normalement
// (et hreflang à nouveau respecté).

// Mapping prefixes — ordre = MATCH LE PLUS LONG D'ABORD (sinon `/en/case-studies/foo`
// matcherait `/en/case-studies` mais perdrait le slug). On déclare donc le
// suffixe `/` avant la version sans slash pour chaque entrée parameterized.
const EN_TO_FR_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  // pSEO par-ville (templates services-villes)
  ["/en/audit/by-city/", "/fr/audit/par-ville/"],
  ["/en/interventions/by-city/", "/fr/interventions/par-ville/"],
  ["/en/implementation/by-city/", "/fr/implementation/par-ville/"],

  // Sous-routes audit
  ["/en/audit/targeted", "/fr/audit/cible"],
  ["/en/audit/request", "/fr/audit/demande"],

  // Routes mappées (FR ≠ EN dans pathnames)
  ["/en/request-quote", "/fr/demande-devis"],
  ["/en/subprocessors", "/fr/sous-processeurs"],
  ["/en/transparency", "/fr/transparence"],
  ["/en/case-studies/", "/fr/cas-concrets/"],
  ["/en/case-studies", "/fr/cas-concrets"],
  ["/en/about", "/fr/a-propos"],
  ["/en/press", "/fr/presse"],
  ["/en/blog/category/", "/fr/blog/categorie/"],
  ["/en/blog/author/", "/fr/blog/auteur/"],
  ["/en/blog/sector/", "/fr/blog/secteur/"],
  ["/en/blog/size/", "/fr/blog/taille/"],
  ["/en/help/", "/fr/centre-aide/"],
  ["/en/help", "/fr/centre-aide"],
  ["/en/book", "/fr/reserver"],
  ["/en/search", "/fr/recherche"],
  ["/en/ai-guide", "/fr/guide-ia"],
  ["/en/methodology", "/fr/methodologie"],
  ["/en/ai-stack", "/fr/stack-ia"],
  ["/en/glossary", "/fr/glossaire"],
  ["/en/comparisons/", "/fr/comparaisons/"],
  ["/en/comparisons", "/fr/comparaisons"],
  ["/en/gallery/", "/fr/galerie/"],
  ["/en/gallery", "/fr/galerie"],
  ["/en/unsubscribe", "/fr/desabonnement"],
  ["/en/cookie-preferences", "/fr/preferences-cookies"],
  ["/en/my-data/export", "/fr/mes-donnees/export"],
  ["/en/my-data", "/fr/mes-donnees"],
  ["/en/accessibility", "/fr/accessibilite"],
  ["/en/locations/", "/fr/implantations/"],
  ["/en/locations", "/fr/implantations"],
  ["/en/legal-notice", "/fr/mentions-legales"],
  ["/en/terms", "/fr/conditions-generales"],
  ["/en/privacy-policy", "/fr/politique-confidentialite"],
  ["/en/travel-policy", "/fr/politique-deplacement"],
];

/**
 * Mappe un pathname `/en/*` vers son équivalent FR.
 * Cas d'usage : `/en/about` → `/fr/a-propos`, `/en/blog` → `/fr/blog`.
 *
 * Si aucun mapping explicite, fallback : remplace juste le préfixe locale.
 * Ex: `/en/foo/bar` → `/fr/foo/bar` (utile pour les routes identiques FR/EN
 * comme `/blog`, `/audit`, `/interventions`, `/implementation`, `/contact`,
 * `/actualites`, `/connaissances`, etc.).
 */
export function mapEnToFr(pathname: string): string {
  for (const [enPrefix, frPrefix] of EN_TO_FR_PREFIXES) {
    if (pathname === enPrefix || pathname.startsWith(enPrefix)) {
      return frPrefix + pathname.slice(enPrefix.length);
    }
  }
  // Fallback : swap /en → /fr (routes avec mêmes noms FR/EN, ex: /en/blog → /fr/blog)
  return pathname.replace(/^\/en(?=\/|$)/, "/fr");
}

/**
 * Vérifie si EN est désactivé via env var. Default = désactivé (FR-only).
 * Pour réactiver EN : set `EN_LOCALE_ENABLED=true` dans Coolify env vars.
 */
export function isEnLocaleDisabled(): boolean {
  return process.env.EN_LOCALE_ENABLED !== "true";
}
