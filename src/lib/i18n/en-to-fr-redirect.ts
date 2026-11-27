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

import { routing } from "../../i18n/routing";

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
export const EN_TO_FR_PREFIXES: ReadonlyArray<readonly [string, string]> = [
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
  ["/en/interventions/claude-implementation-individual", "/fr/interventions/coaching-decouverte"],
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
  ["/en/about", "/fr/a-propos"],
  ["/en/press", "/fr/presse"],
  ["/en/blog/category/", "/fr/blog/categorie/"],
  // Hub des catégories (2026-06-24) — SANS slash final : le préfixe `/category/`
  // ci-dessus ne matche pas `/en/blog/category` (hub), qui sans cette entrée
  // tomberait dans le fallback `/fr/blog/category` (404, route FR = `/categorie`).
  // Placé APRÈS la version slug pour que `/en/blog/category/<slug>` matche d'abord.
  ["/en/blog/category", "/fr/blog/categorie"],
  ["/en/blog/author/", "/fr/blog/auteur/"],
  ["/en/blog/sector/", "/fr/blog/secteur/"],
  ["/en/blog/size/", "/fr/blog/taille/"],
  // Important: /category/ AVANT /help/ pour matcher la sous-route en premier.
  ["/en/help/category/", "/fr/centre-aide/categorie/"],
  ["/en/help/", "/fr/centre-aide/"],
  ["/en/help", "/fr/centre-aide"],
  // `/book-a-call` est le pathname EN canonique de `/appel` (`routing.ts:277`),
  // et la règle next.config `/en/book` → `/en/book-a-call` (qui s'exécute AVANT
  // le middleware) alimente cette URL. Déclaré AVANT `/en/book` : match le plus
  // long d'abord (audit GEO/AEO 2026-08-14, GEO-060).
  ["/en/book-a-call", "/fr/appel"],
  ["/en/book", "/fr/appel"],
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

// Paires dont la traduction dérivée est volontairement écartée : la page des prix ne se
// touche pas sans décision de Will (`/en/pricing` reste traité comme avant).
const PAIRES_ECARTEES = new Set(["/tarifs"]);

type RegleDerivee = { re: RegExp; fr: string[] };

function compilerRouting(): { statiques: Map<string, string>; dynamiques: RegleDerivee[] } {
  const statiques = new Map<string, string>();
  const dynamiques: RegleDerivee[] = [];
  const echapper = (t: string) => t.replace(/[.*+?^${}()|\\]/g, "\\$&");
  for (const [cle, val] of Object.entries(routing.pathnames as Record<string, unknown>)) {
    if (typeof val !== "object" || val === null || PAIRES_ECARTEES.has(cle)) continue;
    const { fr, en } = val as { fr?: string; en?: string };
    if (!fr || !en || fr === en) continue; // identiques : le repli /en → /fr suffit
    if (!en.includes("[")) {
      statiques.set(`/en${en}`, `/fr${fr}`);
      continue;
    }
    // `[x]` = un segment ; `[...x]` / `[[...x]]` = le reste du chemin.
    const motif = en
      .split(/(\[\[?\.\.\.[^\]]+\]\]?|\[[^\]]+\])/)
      .map((morceau) => {
        if (/^\[\[?\.\.\./.test(morceau)) {
          return "(.*)";
        }
        if (/^\[/.test(morceau)) {
          return "([^/]+)";
        }
        return echapper(morceau);
      })
      .join("");
    dynamiques.push({ re: new RegExp(`^/en${motif}/?$`), fr: fr.split(/(\[[^\]]+\])/) });
  }
  return { statiques, dynamiques };
}

let tableRouting: ReturnType<typeof compilerRouting> | undefined;

function mapDepuisRouting(pathname: string): string | null {
  tableRouting ??= compilerRouting();
  const chemin = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const direct = tableRouting.statiques.get(chemin);
  if (direct) return direct;
  for (const regle of tableRouting.dynamiques) {
    const m = regle.re.exec(chemin);
    if (!m) continue;
    let i = 1;
    return (
      "/fr" +
      regle.fr.map((morceau) => (morceau.startsWith("[") ? (m[i++] ?? "") : morceau)).join("")
    );
  }
  return null;
}

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
  // Cas concrets éteints (2026-11-08) : un seul saut vers /fr/methodologie, jamais vers
  // /fr/cas-concrets (qui redirigerait à son tour : chaîne, voire 404). Pas de table de
  // préfixes ici : elle recolle le reste du chemin.
  if (pathname === "/en/case-studies" || pathname.startsWith("/en/case-studies/")) {
    return "/fr/methodologie";
  }
  // S1 (404) : d'abord la table DÉRIVÉE de `routing.pathnames` (source de vérité), puis
  // la table écrite à la main pour les slugs EN retirés. Aucun accès base, aucun réseau.
  const derive = mapDepuisRouting(pathname);
  if (derive) return derive;
  for (const [enPrefix, frPrefix] of EN_TO_FR_PREFIXES) {
    // Frontière de SEGMENT (GEO-060) : un préfixe sans `/` final ne doit matcher
    // que le chemin exact ou un sous-chemin `<préfixe>/…`. Sans cette borne,
    // `/en/book-a-call` matchait `/en/book` et devenait `/fr/appel-a-call` (404) ;
    // `/en/booking/<token>/cancel` devenait `/fr/appeling/<token>/cancel`.
    // Les préfixes AVEC `/` final gardent le match par préfixe (paramétrés).
    const matches = enPrefix.endsWith("/")
      ? pathname.startsWith(enPrefix)
      : pathname === enPrefix || pathname.startsWith(`${enPrefix}/`);
    if (matches) {
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
