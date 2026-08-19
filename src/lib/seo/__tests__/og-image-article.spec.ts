/**
 * Le champ « URL de l'image OG » de la console doit DÉCIDER de l'aperçu.
 *
 * 🔴 CE QUE CETTE GARDE EMPÊCHE DE REVENIR — recensement OG du 2026-08-17.
 *
 * `BlogForm.tsx` propose un champ « URL de l'image OG » depuis toujours. Il
 * s'enregistre bien dans `article_translations.og_image`. Et **aucune page ne
 * lisait cette colonne** : `/blog/[slug]` prenait la hero, `/actualites/[slug]`
 * ne la lisait que pour le JSON-LD. On pouvait donc remplir le champ,
 * enregistrer, voir « enregistré », et l'aperçu LinkedIn ne changeait pas.
 *
 * 🔑 Un formulaire qui accepte une valeur sans effet est pire qu'un formulaire
 * qui ne la propose pas : il fait croire que la décision a été prise.
 *
 * Le premier cas de test ci-dessous est exactement celui qui échouait avant.
 */

import { describe, it, expect } from "vitest";

import { resoudreImagePartageArticle } from "@/lib/seo/og-image-article";

const ORIGINE = "https://axion-ia.com";

describe("image de partage d'un article", () => {
  it("la surcharge saisie en console l'emporte sur la hero", () => {
    const fragment = resoudreImagePartageArticle(
      {
        ogImage: "https://axion-ia.com/og/mon-choix.png",
        featuredImage: "https://images.unsplash.com/photo-123?w=1080",
      },
      ORIGINE,
    );

    expect(fragment.ogImage).toBe("https://axion-ia.com/og/mon-choix.png");
  });

  it("sans surcharge, la hero de l'article sert d'image de partage", () => {
    const fragment = resoudreImagePartageArticle(
      { ogImage: null, featuredImage: "https://images.unsplash.com/photo-123?w=1080" },
      ORIGINE,
    );

    expect(fragment.ogImage).toBe("https://images.unsplash.com/photo-123?w=1080");
  });

  it("sans rien, on ne force aucune image : la fabrique posera la carte générique", () => {
    expect(resoudreImagePartageArticle({ ogImage: null, featuredImage: null }, ORIGINE)).toEqual(
      {},
    );
  });

  it("un chemin relatif devient absolu — aucun robot social ne résout un chemin", () => {
    // Le précédent : la garde du feuilletoir (catalogue, PR #699) vérifie
    // exactement cette propriété, pour la même raison.
    const fragment = resoudreImagePartageArticle({ ogImage: "/og/local.png" }, ORIGINE);

    expect(fragment.ogImage).toBe("https://axion-ia.com/og/local.png");
  });

  it("une surcharge vide ou blanche ne compte pas comme un choix", () => {
    const fragment = resoudreImagePartageArticle(
      { ogImage: "   ", featuredImage: "/hero.png" },
      ORIGINE,
    );

    expect(fragment.ogImage).toBe("https://axion-ia.com/hero.png");
  });

  it("dimensions déclarées seulement si la surcharge a été MESURÉE", () => {
    const mesuree = resoudreImagePartageArticle(
      { ogImage: "/og/a.png", ogImageWidth: 1200, ogImageHeight: 675 },
      ORIGINE,
    );
    expect(mesuree.ogImageWidth).toBe(1200);
    expect(mesuree.ogImageHeight).toBe(675);

    const nonMesuree = resoudreImagePartageArticle({ ogImage: "/og/b.png" }, ORIGINE);
    expect(nonMesuree.ogImageWidth).toBeUndefined();
    expect(nonMesuree.ogImageHeight).toBeUndefined();

    // Une hauteur nulle n'est pas une mesure : c'est une colonne jamais remplie.
    const zero = resoudreImagePartageArticle(
      { ogImage: "/og/c.png", ogImageWidth: 1200, ogImageHeight: 0 },
      ORIGINE,
    );
    expect(zero.ogImageWidth).toBeUndefined();
  });
});
