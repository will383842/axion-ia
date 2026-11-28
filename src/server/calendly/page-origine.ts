/**
 * Page d'origine d'une réservation (chantier « chaîne éditoriale », C12).
 *
 * Le but : savoir QUEL ARTICLE le visiteur lisait avant de réserver le Diagnostic IA 45 min, pour
 * l'attribuer « au dernier article lu » (attribution partielle assumée, jamais « causé par »).
 *
 * ## Pourquoi pas `utm_content`
 *
 * Un `utm_content` posé sur un lien INTERNE écraserait la source réelle de la visite dans
 * Plausible, et les pages publiques n'ont pas de JavaScript. La page d'origine est donc lue
 * CÔTÉ SERVEUR, dans l'en-tête `Referer` de la première page du parcours (`/appel`), puis recopiée
 * de page en page dans le paramètre `po`, comme le sont déjà `depuis` et les UTM d'arrivée.
 *
 * ## Ce que ce paramètre n'est pas
 *
 * - Aucun cookie, aucune donnée sur la personne : un chemin d'article public, d'une forme stricte.
 * - Il ne part jamais chez Calendly (`PARAMS_SUIVI_CALENDLY` ne le contient pas).
 * - ÉTEINT par défaut : sans `CONTENT_CHAINE_SUIVI="true"` exact, on ne lit pas le `Referer` et
 *   on n'enregistre rien. Un `po` présent dans une URL reste inerte.
 */

/** Rubriques dont une page peut être « l'article lu avant la réservation ». */
const RUBRIQUES = ["blog", "guides", "actualites", "glossaire", "comparaisons", "cas-concrets"];

const FORME = new RegExp(`^/(?:fr|en)/(?:${RUBRIQUES.join("|")})/[a-z0-9][a-z0-9-]{0,150}$`);

export const PARAM_PAGE_ORIGINE = "po";

/** Seul `"true"` EXACT allume le suivi. Lu à l'exécution, jamais figé au build. */
export function suiviOrigineActif(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env["CONTENT_CHAINE_SUIVI"] === "true";
}

/** Un chemin d'article de la forme exacte, ou `null`. Aucune réécriture : une valeur douteuse tombe. */
export function normaliserPageOrigine(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  return FORME.test(valeur) ? valeur : null;
}

/** Le chemin de l'article d'où vient le visiteur, d'après son `Referer`, ou `null`. */
export function pageOrigineDepuisReferer(
  referer: string | null | undefined,
  hotes: readonly string[],
): string | null {
  if (!referer) return null;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!hotes.includes(url.hostname.toLowerCase())) return null;
  const chemin = url.pathname.replace(/\/+$/, "");
  return normaliserPageOrigine(chemin);
}

/** Les hôtes du site (avec et sans `www`), pour juger qu'un `Referer` vient bien de chez nous. */
export function hotesDuSite(siteUrl: string): string[] {
  try {
    const hote = new URL(siteUrl).hostname.toLowerCase();
    const nu = hote.replace(/^www\./, "");
    return [nu, `www.${nu}`];
  } catch {
    return [];
  }
}
