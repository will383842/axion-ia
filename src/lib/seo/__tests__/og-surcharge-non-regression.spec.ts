/**
 * SANS surcharge, la fabrique doit rendre EXACTEMENT ce qu'elle rendait avant.
 *
 * 🔴 CE QUE CETTE GARDE PROTÈGE — recensement OG du 2026-08-17.
 *
 * `buildProductMetadata` est le point de passage de 146 des 150 pages du site.
 * Y brancher la surcharge d'aperçu les rend toutes modifiables — et les met
 * toutes en risque d'un coup. La condition posée était : « une page sans
 * surcharge doit rendre exactement ce qu'elle rend aujourd'hui — vérifie-le,
 * ne le suppose pas ».
 *
 * 🔑 Un défaut ici serait invisible en développement et visible sur 1 667 URLs
 * en production. Le test fige donc la sortie complète, champ par champ, dans
 * les deux cas qui couvrent la quasi-totalité du site : une page de service
 * (carte générée) et un article (image propre + balises `article:*`).
 *
 * Les cas AVEC surcharge sont couverts par `og-overrides.spec.ts`, qui teste la
 * sélection sans toucher à la base.
 */

import { describe, it, expect } from "vitest";

import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { OG_IMAGE_LARGEUR, OG_IMAGE_HAUTEUR } from "@/lib/og-format";

describe("aucune surcharge posée : sortie inchangée", () => {
  it("page de service — la carte générée, ses dimensions, et rien d'autre", async () => {
    const meta = await buildProductMetadata({
      locale: "fr",
      path: "/audit",
      title: "Audit IA en entreprise",
      description:
        "Cartographie complète, priorités identifiées et rapport chiffré sous sept jours ouvrés.",
    });

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.type).toBe("website");
    expect(og.locale).toBe("fr_FR");
    expect(og.siteName).toBe("Axion-IA");
    // L'aperçu reprend le titre de la page tant que rien ne le surcharge.
    expect(og.title).toBe("Audit IA en entreprise");
    // `SITE_URL` et non le domaine en dur : en test, l'origine retombe sur
    // localhost. Coder le domaine ferait échouer la garde pour une raison
    // étrangère à ce qu'elle surveille.
    expect(og.url).toBe(`${SITE_URL}/fr/audit`);

    const image = (og.images as Array<Record<string, unknown>>)[0]!;
    expect(String(image.url)).toContain("/api/og?title=");
    expect(String(image.url)).not.toContain("eyebrow=");
    expect(image.width).toBe(OG_IMAGE_LARGEUR);
    expect(image.height).toBe(OG_IMAGE_HAUTEUR);

    // La canonique et le hreflang ne sont PAS du ressort de l'aperçu.
    expect(meta.alternates?.canonical).toBe("/fr/audit");
  });

  it("article avec image propre — dimensions reprises telles que mesurées", async () => {
    const meta = await buildProductMetadata({
      locale: "fr",
      path: "/blog/exemple",
      title: "Automatiser la relance client sans perdre la main",
      description:
        "Dix minutes pour comprendre ce qui se délègue et ce qui ne se délègue pas dans la relance.",
      ogType: "article",
      ogImage: "https://axion-ia.com/og/blog/exemple.webp",
      ogImageWidth: 1200,
      ogImageHeight: 675,
    });

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.type).toBe("article");
    const image = (og.images as Array<Record<string, unknown>>)[0]!;
    expect(image.url).toBe("https://axion-ia.com/og/blog/exemple.webp"); // fournie telle quelle par l appelant
    expect(image.width).toBe(1200);
    expect(image.height).toBe(675);
  });

  it("🔑 le titre de la PAGE et le titre de l'APERÇU partent identiques", async () => {
    // C'est la propriété qui garantit l'absence de régression : tant qu'aucune
    // surcharge n'existe, les deux titres sont le même. Le jour où ils
    // divergent, c'est qu'une surcharge a été posée — jamais par accident.
    const titre = "Formation IA en entreprise à Grenoble (38)";
    const meta = await buildProductMetadata({
      locale: "fr",
      path: "/formations/par-ville/grenoble",
      title: titre,
      description: "Formation IA sur site à Grenoble, tarifs publics affichés, calendrier réel.",
    });

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.title).toBe(titre);
    expect(meta.title).toBe(titre);
  });

  it("la description de l'aperçu reste celle de la page, bornée à 158 caractères", async () => {
    const longue = "A".repeat(400);
    const meta = await buildProductMetadata({
      locale: "fr",
      path: "/audit",
      title: "Audit IA",
      description: longue,
    });

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.description).toBe(meta.description);
    expect(String(og.description).length).toBeLessThanOrEqual(158);
  });
});
