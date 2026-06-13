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
//
// Audit GSC 5xx 2026-05-18 — extension exhaustive : tout slug FR ≠ EN doit avoir
// son mapping explicite. Sans cela, le fallback simple `/en → /fr` enverrait vers
// une URL FR inexistante (ex: `/en/audit/strategic-pme` → `/fr/audit/strategic-pme`
// qui n'existe pas, la canonique est `strategique-pme`). Conséquence : chaîne
// 301 → 307/404 → catchall soft 404. Le mapping exhaustif émet un seul 301 vers
// la canonique FR, économisant 1 hop + transmettant 100% du link juice.
const EN_TO_FR_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  // pSEO par-ville (templates services-villes)
  ["/en/audit/by-city/", "/fr/audit/par-ville/"],
  ["/en/interventions/by-city/", "/fr/interventions/par-ville/"],
  ["/en/implementation/by-city/", "/fr/implementation/par-ville/"],

  // Interventions — formations collectives (4 paliers, slugs FR ≠ EN)
  ["/en/interventions/team-trainings/1-day", "/fr/interventions/collectives/1-jour"],
  ["/en/interventions/team-trainings/2-days", "/fr/interventions/collectives/2-jours"],
  ["/en/interventions/team-trainings/3-days-plus", "/fr/interventions/collectives/3-jours-plus"],
  ["/en/interventions/team-trainings/", "/fr/interventions/collectives/"],
  ["/en/interventions/team-trainings", "/fr/interventions/collectives"],

  // Interventions — coaching individuel + autres slugs FR ≠ EN
  ["/en/interventions/ai-express-kickoff", "/fr/interventions/demarrage-ia-express"],
  ["/en/interventions/request", "/fr/interventions/demande"],
  ["/en/interventions/individual", "/fr/interventions/individuel"],
  ["/en/interventions/discovery-coaching", "/fr/interventions/coaching-decouverte"],
  ["/en/interventions/advanced-coaching", "/fr/interventions/coaching-avance"],
  ["/en/interventions/essential", "/fr/interventions/essentielle"],
  ["/en/interventions/deep-dive", "/fr/interventions/approfondie"],
  ["/en/interventions/executive-productivity", "/fr/interventions/dirigeant-productivite"],
  [
    "/en/interventions/executive-strategic-vision",
    "/fr/interventions/dirigeant-vision-strategique",
  ],
  ["/en/interventions/executives", "/fr/interventions/dirigeants"],
  // Formats Claude 1-to-1 retirés (2026-06-13) → page 1-to-1 équivalente.
  ["/en/interventions/claude-executive", "/fr/interventions/dirigeant-vision-strategique"],
  [
    "/en/interventions/claude-implementation-individual",
    "/fr/interventions/coaching-decouverte",
  ],
  ["/en/interventions/save-time", "/fr/interventions/gagner-du-temps"],

  // Audit — sous-routes (cible/strategique-pme/strategique-eti/demande)
  ["/en/audit/targeted", "/fr/audit/cible"],
  ["/en/audit/strategic-pme", "/fr/audit/strategique-pme"],
  ["/en/audit/strategic-eti", "/fr/audit/strategique-eti"],
  ["/en/audit/request", "/fr/audit/demande"],

  // Implementation — slugs FR ≠ EN
  ["/en/implementation/custom-ai", "/fr/implementation/ia-custom"],
  ["/en/implementation/processes", "/fr/implementation/processus"],
  ["/en/implementation/structuring", "/fr/implementation/structuration"],
  ["/en/implementation/by-technology", "/fr/implementation/par-techno"],
  ["/en/implementation/by-function/", "/fr/implementation/par-fonction/"],

  // Routes mappées (FR ≠ EN dans pathnames)
  ["/en/request-quote", "/fr/demande-devis"],
  ["/en/subprocessors", "/fr/sous-processeurs"],
  ["/en/transparency", "/fr/transparence"],
  // Important: /industry/ AVANT /case-studies/ pour matcher la sous-route en premier.
  ["/en/case-studies/industry/", "/fr/cas-concrets/secteur/"],
  ["/en/case-studies/", "/fr/cas-concrets/"],
  ["/en/case-studies", "/fr/cas-concrets"],
  ["/en/about", "/fr/a-propos"],
  ["/en/press", "/fr/presse"],
  ["/en/blog/category/", "/fr/blog/categorie/"],
  ["/en/blog/author/", "/fr/blog/auteur/"],
  ["/en/blog/sector/", "/fr/blog/secteur/"],
  ["/en/blog/size/", "/fr/blog/taille/"],
  // Important: /category/ AVANT /help/ pour matcher la sous-route en premier.
  ["/en/help/category/", "/fr/centre-aide/categorie/"],
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
  // City Domination 2026-05-18 P1-21 — EEAT pages (cross-cut 14)
  ["/en/editorial-policy", "/fr/charte-editoriale"],
  // Sprint S+2 City Domination — 4e verticale un-a-un
  ["/en/one-to-one/by-city/", "/fr/un-a-un/par-ville/"],
  ["/en/one-to-one/by-city", "/fr/un-a-un/par-ville"],
  ["/en/one-to-one/", "/fr/un-a-un/"],
  ["/en/one-to-one", "/fr/un-a-un"],
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
