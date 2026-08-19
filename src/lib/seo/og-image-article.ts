/**
 * Choix de l'image de partage d'un article (blog, actualités).
 *
 * 🔴 POURQUOI CE MODULE EXISTE — recensement OG du 2026-08-17.
 *
 * Trois endroits décidaient de l'image de partage d'un article, et aucun ne
 * connaissait les deux autres :
 *
 *   · `/blog/[slug]` prenait `featuredImage` (la hero de l'article) ;
 *   · `/actualites/[slug]` ne passait rien du tout → carte générique ;
 *   · la console écrivait `article_translations.og_image`… que **personne ne
 *     lisait**. Le champ « URL de l'image OG » du formulaire blog était une
 *     commande morte : on pouvait le remplir, l'aperçu ne bougeait pas.
 *
 * 🔑 La hero et l'image de partage ne sont pas la même décision. La hero est
 * ce qu'on voit DANS l'article ; l'image de partage est ce que LinkedIn
 * affiche à quelqu'un qui n'a pas encore cliqué. Les faire coïncider par
 * défaut est raisonnable ; empêcher de les séparer ne l'est pas.
 *
 * L'ordre de priorité est donc : ce qu'un humain a choisi d'abord, la hero
 * ensuite, la carte générique en dernier recours (gérée par `seo.ts` quand ce
 * module ne renvoie rien).
 */

import { imagePartageRapatriee } from "@/content/og-blog-manifest";
import { OG_IMAGE_LARGEUR, OG_IMAGE_HAUTEUR } from "@/lib/og-format";

/** Ce qu'une source d'article sait de ses images, sans supposer de backend. */
export interface SourcesImageArticle {
  /** Surcharge saisie en console (`ArticleTranslation.ogImage`). */
  readonly ogImage?: string | null;
  /** Dimensions de la surcharge si elles ont été MESURÉES ; jamais devinées. */
  readonly ogImageWidth?: number | null;
  readonly ogImageHeight?: number | null;
  /** Image hero de l'article (`Article.featuredImage`). */
  readonly featuredImage?: string | null;
  /**
   * Slug de l'article — sert à retrouver son image de partage rapatriée dans
   * `og-blog-manifest.ts`. Facultatif : sans lui, on saute simplement cette
   * étape et le comportement est celui d'avant le rapatriement.
   */
  readonly slug?: string | null;
}

/**
 * Fragment prêt à être étalé dans `buildProductMetadata`. Vide quand aucune
 * image propre à l'article n'existe — la fabrique retombe alors sur la carte
 * `/api/og`, ce qui reste le comportement de la très grande majorité du site.
 */
export interface FragmentImagePartage {
  readonly ogImage?: string;
  readonly ogImageWidth?: number;
  readonly ogImageHeight?: number;
}

/** Rend une URL absolue : les robots sociaux ne résolvent pas les chemins relatifs. */
function absolutiser(url: string, origine: string): string {
  return url.startsWith("http") ? url : `${origine}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Résout l'image de partage d'un article.
 *
 * @param sources ce que la base sait de cet article
 * @param origine origine canonique du site (`SITE_URL`)
 */
export function resoudreImagePartageArticle(
  sources: SourcesImageArticle,
  origine: string,
): FragmentImagePartage {
  // 1. La surcharge humaine gagne toujours. Si elle est mesurée, on déclare
  //    ses dimensions ; sinon on n'en déclare aucune (cf. `og-format.ts` :
  //    une dimension inventée est pire qu'une dimension absente).
  const surcharge = sources.ogImage?.trim();
  if (surcharge) {
    const mesuree =
      typeof sources.ogImageWidth === "number" &&
      typeof sources.ogImageHeight === "number" &&
      sources.ogImageWidth > 0 &&
      sources.ogImageHeight > 0;
    return {
      ogImage: absolutiser(surcharge, origine),
      ...(mesuree
        ? {
            ogImageWidth: sources.ogImageWidth as number,
            ogImageHeight: sources.ogImageHeight as number,
          }
        : {}),
    };
  }

  // 2. L'image rapatriée, si elle existe. C'est la hero de l'article recadrée
  //    en 1200×675 et servie depuis notre domaine — donc au-dessus du seuil
  //    LinkedIn, et sans dépendance à un tiers. Ses dimensions sont connues par
  //    construction : le script vérifie chaque fichier produit avant de
  //    l'inscrire au manifeste.
  const rapatriee = sources.slug ? imagePartageRapatriee(sources.slug) : null;
  if (rapatriee) {
    return {
      ogImage: absolutiser(rapatriee, origine),
      ogImageWidth: OG_IMAGE_LARGEUR,
      ogImageHeight: OG_IMAGE_HAUTEUR,
    };
  }

  // 3. À défaut, la hero de l'article. Ses dimensions ne sont pas connues ici
  //    — les heros Unsplash hotlinkées sont servies en 1080 de large, pas en
  //    1200 (mesuré le 2026-08-17). On ne déclare donc rien.
  const hero = sources.featuredImage?.trim();
  if (hero) {
    return { ogImage: absolutiser(hero, origine) };
  }

  // 4. Rien de propre à l'article : `buildProductMetadata` posera la carte
  //    `/api/og`, dont les dimensions, elles, sont connues.
  return {};
}
