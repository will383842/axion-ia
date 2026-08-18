/**
 * Les dimensions annoncées aux réseaux sociaux doivent décrire l'image RÉELLE.
 *
 * 🔴 CE QUE CETTE GARDE EMPÊCHE DE REVENIR — recensement OG du 2026-08-17.
 *
 * `buildProductMetadata` écrivait `width: 1200, height: 630` en dur pour
 * n'importe quelle image. Mesuré sur la production, sur les 1 667 URLs
 * indexables :
 *
 *   · nos cartes `/api/og`      → 1200×675 réels, 1200×630 déclarés
 *   · les 133 photos de blog    → 1080×607 réels, 1200×630 déclarés
 *
 * LinkedIn et Facebook réservent la vignette d'après ce qui est DÉCLARÉ, avant
 * de télécharger le fichier. Un nombre inventé n'est donc pas cosmétique : il
 * décide de la façon dont le lien s'affiche.
 *
 * 🔑 Le cas le plus important est le troisième : quand l'appelant fournit une
 * image sans la mesurer, la fabrique ne doit RIEN déclarer. C'est le seul
 * comportement qui ne ment pas.
 */

import { describe, it, expect } from "vitest";

import { buildProductMetadata } from "@/lib/seo";
import { OG_IMAGE_LARGEUR, OG_IMAGE_HAUTEUR } from "@/lib/og-format";

/** Première image OpenGraph des métadonnées, sous une forme lisible. */
async function premiereImageOg(meta: ReturnType<typeof buildProductMetadata>) {
  const resolu = await meta;
  const images = resolu.openGraph?.images;
  expect(Array.isArray(images)).toBe(true);
  const premiere = (images as unknown[])[0];
  return premiere as { url: string; width?: number; height?: number; alt?: string };
}

const BASE = {
  locale: "fr" as const,
  path: "/audit",
  title: "Audit IA en entreprise",
  description:
    "Cartographie complète, priorités identifiées et rapport chiffré sous sept jours ouvrés pour votre entreprise.",
};

describe("dimensions déclarées de l'image de partage", () => {
  it("sans image fournie : déclare la taille RÉELLE de notre carte /api/og", async () => {
    const image = await premiereImageOg(buildProductMetadata(BASE));

    expect(image.url).toContain("/api/og?title=");
    expect(image.width).toBe(OG_IMAGE_LARGEUR);
    expect(image.height).toBe(OG_IMAGE_HAUTEUR);
  });

  it("la carte /api/og fait 1200×675, jamais 1200×630", async () => {
    // Valeurs écrites en clair : si quelqu'un modifie la constante partagée,
    // ce test doit l'obliger à venir constater le changement ici, parce que
    // la valeur est aussi celle que le renderer edge produit réellement.
    expect(OG_IMAGE_LARGEUR).toBe(1200);
    expect(OG_IMAGE_HAUTEUR).toBe(675);
    expect(OG_IMAGE_HAUTEUR).not.toBe(630);
  });

  it("image fournie SANS dimensions : n'invente rien, n'émet aucune dimension", async () => {
    const image = await premiereImageOg(
      buildProductMetadata({ ...BASE, ogImage: "https://exemple.test/photo.jpg" }),
    );

    expect(image.url).toBe("https://exemple.test/photo.jpg");
    expect(image.width).toBeUndefined();
    expect(image.height).toBeUndefined();
  });

  it("image fournie AVEC dimensions : reprend celles que l'appelant a mesurées", async () => {
    const image = await premiereImageOg(
      buildProductMetadata({
        ...BASE,
        ogImage: "https://exemple.test/photo.jpg",
        ogImageWidth: 1080,
        ogImageHeight: 607,
      }),
    );

    expect(image.width).toBe(1080);
    expect(image.height).toBe(607);
  });

  it("une seule des deux dimensions ne suffit pas : on n'émet toujours rien", async () => {
    const image = await premiereImageOg(
      buildProductMetadata({
        ...BASE,
        ogImage: "https://exemple.test/photo.jpg",
        ogImageWidth: 1200,
      }),
    );

    expect(image.width).toBeUndefined();
    expect(image.height).toBeUndefined();
  });
});
