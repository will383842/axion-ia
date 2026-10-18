/**
 * CHOIX DES ENCARTS « EN VIDÉO » (lot W4, plan PLAN-W1-W4 §8.1). Une vidéo par encart : la
 * PLUS RÉCENTE du thème, jamais la même deux fois sur une page, aucune si le thème n'a pas de
 * vidéo publiée (ou si l'interrupteur est éteint).
 *
 * VILLES (2 157 pages) : aucune requête par page. Tout passe par `videosPubliees()`, qui lit la
 * base UNE fois par processus et par période de 5 minutes quel que soit le nombre de rendus et
 * de thèmes ; les pages sont en ISR, et la publication / le retrait vident ce cache
 * (`apres-publication.ts`). Rien n'est figé au build : sur la base factice (`stub.invalid`), la
 * lecture rend [] — aucun encart — et l'ISR repeuple.
 */
import { THEMES } from "@/content/videos/themes";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";
import { videosPubliees, type VideoPubliee } from "./lecture";

/** Thème des encarts sur les pages villes (hub de villes : pas de service précis). */
export const THEME_GENERIQUE_VILLES = "audit-ia";

export async function videoPourEncart(
  theme: string,
  exclure: ReadonlyArray<string> = [],
): Promise<VideoPubliee | null> {
  // `videosPubliees()` est déjà trié de la plus récente à la plus ancienne.
  return (
    (await videosPubliees()).find((v) => v.theme === theme && !exclure.includes(v.slug)) ?? null
  );
}

/**
 * Fiches de formation : soumises au drapeau de divulgation de l'organisme de formation. Tant
 * qu'il est éteint, ces pages n'existent pas publiquement : aucun encart non plus.
 */
export async function videoPourFormation(
  exclure: ReadonlyArray<string> = [],
): Promise<VideoPubliee | null> {
  if (!isQualiopiPublicDisclosureEnabled()) return null;
  return videoPourEncart("formations-ia", exclure);
}

/** Thème associé à une page de service (clé de `routing.pathnames`). */
export function themeDuService(href: string): string | null {
  return THEMES.find((t) => t.service === href)?.slug ?? null;
}

/**
 * Mots (segments du slug) → thème. Table explicite : on compare des SEGMENTS entiers, jamais
 * des sous-chaînes (« transformation » ne contient pas « formation » au sens de la table,
 * « webinaire » n'est pas « web », « necessite » n'est pas « site »).
 */
const THEME_PAR_MOT: Readonly<Record<string, string>> = {
  formation: "formations-ia",
  formations: "formations-ia",
  coaching: "coaching-ia",
  audit: "audit-ia",
  audits: "audit-ia",
  implementation: "automatisation",
  automatisation: "automatisation",
  site: "sites-web-ia",
  sites: "sites-web-ia",
  saas: "sites-web-ia",
  web: "sites-web-ia",
};

/** Vrai si `suite` apparaît telle quelle, segments contigus, dans `mots`. */
function contientSuite(mots: ReadonlyArray<string>, suite: ReadonlyArray<string>): boolean {
  for (let i = 0; i + suite.length <= mots.length; i++) {
    if (suite.every((m, k) => mots[i + k] === m)) return true;
  }
  return false;
}

/**
 * Thème d'une catégorie de blog (les catégories viennent de la base, leur liste n'est pas
 * figée dans le code). Catégorie inconnue → pas d'encart. Le thème des formations suit le
 * drapeau de divulgation de l'organisme de formation, comme `videoPourFormation`.
 */
export function themeDeCategorieBlog(categorie: string | null | undefined): string | null {
  const mots = (categorie ?? "").toLowerCase().split("-").filter(Boolean);
  if (mots.length === 0) return null;
  // « un-a-un » et « 1-to-1 » : expressions de plusieurs segments, comparées SEGMENT PAR SEGMENT
  // (une sous-chaîne verrait « un-a-un » dans « jaun-a-unique »).
  const theme =
    contientSuite(mots, ["un", "a", "un"]) || contientSuite(mots, ["1", "to", "1"])
      ? "coaching-ia"
      : (mots.map((m) => THEME_PAR_MOT[m]).find(Boolean) ?? null);
  if (theme === "formations-ia" && !isQualiopiPublicDisclosureEnabled()) return null;
  return theme;
}
