// Fraîcheur éditoriale : UNE source pour le `<lastmod>` des sitemaps ET le
// `dateModified` JSON-LD (audit SEO indépendant du 2026-11-11, I2).
//
// Avant : deux constantes recopiées « à garder en sync à la main »
// (`SITE_EDITORIAL_DATE` dans `seo.ts`, `EDITORIAL_BASELINE` dans `sitemap.ts`),
// et une date par FAMILLE pour toutes les pages statiques — les 87 URL de
// `pages.xml` déclaraient le même `<lastmod>`, et leur JSON-LD une autre date
// encore (la baseline figée du 2026-06-08).
//
// Désormais :
//   - `DATES_EDITORIALES` porte les dates AFFICHÉES sur la page (accueil,
//     Journée IA), prioritaires ;
//   - `EDITORIAL_BASELINE_ISO` est la seule date figée ; les deux anciennes
//     constantes en DÉRIVENT ;
//   - `dateRoute(cle)` lit la date réelle de la route (dernier commit git de ses
//     sources, `scripts/gen-content-freshness.mjs`), puis retombe sur la famille
//     `pages`, puis sur la baseline. Le sitemap et le JSON-LD appellent la même
//     fonction : ils ne peuvent plus diverger.
//
// Aucune date n'est inventée ici : une route jamais retouchée garde la date de
// son commit de création ; une route inconnue du manifeste (clone superficiel,
// git absent) garde l'ancien comportement.

import { CONTENT_FRESHNESS, ROUTE_FRESHNESS } from "@/generated/content-freshness";
import { routing } from "@/i18n/routing";
import { DATE_MISE_A_JOUR_JOURNEE_IA } from "@/content/journee-ia-commun";

/**
 * Date éditoriale FIGÉE (audit fraîcheur 2026-06-08) — dernier repli quand le
 * manifeste ne connaît ni la route ni la famille.
 */
export const EDITORIAL_BASELINE_ISO = "2026-06-08T00:00:00.000Z";

function isoValide(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Dates éditoriales TENUES À LA MAIN, prioritaires sur le manifeste git : une
 * page qui AFFICHE sa date de mise à jour (`<time>` visible) doit déclarer la
 * même au sitemap et au JSON-LD. Sans ce registre, l'accueil affichait le
 * 9 novembre et son `<lastmod>` disait le jour du dernier commit de la page.
 *
 * N'y inscrire qu'une date réellement montrée au lecteur, réglée quand le
 * contenu change — jamais pour « rafraîchir » une page.
 */
export const DATES_EDITORIALES: Readonly<Record<string, string>> = {
  "/": DATE_MISE_A_JOUR_JOURNEE_IA,
  "/journee-ia": DATE_MISE_A_JOUR_JOURNEE_IA,
};

/** Date réelle d'une famille de contenu (`CONTENT_FRESHNESS`), sinon la baseline. */
export function dateFamille(famille: string): string {
  return isoValide(CONTENT_FRESHNESS[famille]) ?? EDITORIAL_BASELINE_ISO;
}

/**
 * Date de dernière modification d'une route statique, par sa clé interne
 * (`routing.pathnames`, ex. `/a-propos`). Repli : famille `pages`, puis baseline.
 */
export function dateRoute(cle: string): string {
  return (
    isoValide(DATES_EDITORIALES[cle]) ?? isoValide(ROUTE_FRESHNESS[cle]) ?? dateFamille("pages")
  );
}

type Pathnames = Record<string, string | Record<string, string>>;

/** Index « chemin localisé → clé interne », construit une fois. */
let indexChemins: Map<string, string> | null = null;

function index(): Map<string, string> {
  if (indexChemins) return indexChemins;
  const m = new Map<string, string>();
  for (const [cle, valeur] of Object.entries(routing.pathnames as Pathnames)) {
    if (cle.includes("[")) continue;
    m.set(`*${cle}`, cle);
    if (typeof valeur === "string") continue;
    for (const [locale, chemin] of Object.entries(valeur)) m.set(`${locale}${chemin}`, cle);
  }
  indexChemins = m;
  return m;
}

/**
 * Clé interne d'une route STATIQUE à partir du chemin localisé qu'une page passe
 * à ses fabriques JSON-LD (sans préfixe de locale). `undefined` pour une route
 * dynamique ou inconnue de `routing.pathnames`.
 */
export function cleDeChemin(chemin: string, locale: string): string | undefined {
  const norm = chemin === "" ? "/" : chemin.replace(/\/+$/, "") || "/";
  const m = index();
  return m.get(`${locale}${norm}`) ?? m.get(`*${norm}`);
}

/**
 * `dateModified` JSON-LD d'une page statique, lu à la même source que son
 * `<lastmod>` de `pages.xml`. `undefined` hors routes statiques connues : la
 * fabrique omet alors le champ (comportement d'avant, aucune date inventée).
 */
export function dateModifiedDeChemin(chemin: string, locale: string): string | undefined {
  const cle = cleDeChemin(chemin, locale);
  return cle ? dateRoute(cle) : undefined;
}
