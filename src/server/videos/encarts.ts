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
 * Thème d'une catégorie de blog, par mots du slug (les catégories viennent de la base, leur
 * liste n'est pas figée dans le code). Catégorie inconnue → pas d'encart.
 */
export function themeDeCategorieBlog(categorie: string | null | undefined): string | null {
  const c = (categorie ?? "").toLowerCase();
  if (!c) return null;
  if (c.includes("formation")) return "formations-ia";
  if (c.includes("coaching") || c.includes("1-to-1") || c.includes("un-a-un")) return "coaching-ia";
  if (c.includes("audit")) return "audit-ia";
  if (c.includes("implementation") || c.includes("automatisation")) return "automatisation";
  if (c.includes("site") || c.includes("saas") || c.includes("web")) return "sites-web-ia";
  return null;
}
