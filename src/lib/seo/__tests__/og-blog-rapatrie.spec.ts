/**
 * Chaque image de partage rapatriée doit EXISTER et faire la taille annoncée.
 *
 * 🔴 CE QUE CETTE GARDE EMPÊCHE — recensement OG du 2026-08-17.
 *
 * Les 134 articles de blog servaient une photo hébergée chez un tiers, forcée à
 * `w=1080` : **1080×607 mesuré**, sous le seuil des 1200 px en dessous duquel
 * LinkedIn remplace la grande carte par une vignette. Elles ont été rapatriées
 * en 1200×675 sous `public/og/blog/`.
 *
 * 🔑 Le manifeste DÉCLARE des chemins et le code déclare leurs dimensions. Si
 * un fichier manque, ou s'il ne fait pas la taille annoncée, on est revenu au
 * défaut d'origine — annoncer une taille que le fichier n'a pas — mais cette
 * fois sur nos propres images. Cette garde lit donc les OCTETS, pas le
 * manifeste : ce qui est publié fait foi.
 *
 * Elle reprend le niveau d'exigence de `check-feuilletoir.cjs` (catalogue,
 * PR #699) : URL absolue côté rendu, fichier réellement présent, taille réelle.
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";
import { describe, it, expect } from "vitest";

import { OG_BLOG_RAPATRIE } from "@/content/og-blog-manifest";
import { OG_IMAGE_LARGEUR, OG_IMAGE_HAUTEUR } from "@/lib/og-format";
import { resoudreImagePartageArticle } from "@/lib/seo/og-image-article";

const RACINE_PUBLIQUE = join(process.cwd(), "public");
const entrees = Object.entries(OG_BLOG_RAPATRIE);

/** Limite de poids : au-delà, WhatsApp cesse d'afficher l'aperçu en discussion. */
const POIDS_MAX_OCTETS = 300 * 1024;

describe("images de partage rapatriées", () => {
  it("le manifeste n'est pas vide (sinon le rapatriement n'a jamais eu lieu)", () => {
    expect(entrees.length).toBeGreaterThan(0);
  });

  it("tous les chemins déclarés pointent un fichier réellement présent", () => {
    const manquants = entrees
      .filter(([, chemin]) => !existsSync(join(RACINE_PUBLIQUE, chemin)))
      .map(([slug]) => slug);

    expect(manquants).toEqual([]);
  });

  it("tous les chemins sont servis depuis /og/blog et en .webp", () => {
    const horsFormat = entrees
      .filter(([, c]) => !c.startsWith("/og/blog/") || !c.endsWith(".webp"))
      .map(([slug, c]) => `${slug} → ${c}`);

    expect(horsFormat).toEqual([]);
  });

  it("chaque fichier fait RÉELLEMENT 1200×675 — mesuré, pas déclaré", async () => {
    const fautives: string[] = [];
    for (const [slug, chemin] of entrees) {
      const abs = join(RACINE_PUBLIQUE, chemin);
      if (!existsSync(abs)) continue; // déjà couvert par le test précédent
      const meta = await sharp(abs).metadata();
      if (meta.width !== OG_IMAGE_LARGEUR || meta.height !== OG_IMAGE_HAUTEUR) {
        fautives.push(`${slug} : ${meta.width}×${meta.height}`);
      }
    }

    expect(fautives).toEqual([]);
  });

  it("aucun fichier ne dépasse le poids au-delà duquel WhatsApp n'affiche plus l'aperçu", () => {
    const tropLourdes = entrees
      .filter(([, c]) => existsSync(join(RACINE_PUBLIQUE, c)))
      .filter(([, c]) => statSync(join(RACINE_PUBLIQUE, c)).size > POIDS_MAX_OCTETS)
      .map(
        ([slug, c]) => `${slug} : ${Math.round(statSync(join(RACINE_PUBLIQUE, c)).size / 1024)} Ko`,
      );

    expect(tropLourdes).toEqual([]);
  });

  it("un article du manifeste sert l'image rapatriée, PAS la photo du tiers", () => {
    const [slug] = entrees[0]!;

    const fragment = resoudreImagePartageArticle(
      { slug, featuredImage: "https://images.unsplash.com/photo-123?w=1080" },
      "https://axion-ia.com",
    );

    expect(fragment.ogImage).toBe(`https://axion-ia.com${OG_BLOG_RAPATRIE[slug]}`);
    expect(fragment.ogImage).not.toContain("unsplash");
    expect(fragment.ogImageWidth).toBe(OG_IMAGE_LARGEUR);
    expect(fragment.ogImageHeight).toBe(OG_IMAGE_HAUTEUR);
  });

  it("un article ABSENT du manifeste garde exactement le comportement d'avant", () => {
    const fragment = resoudreImagePartageArticle(
      { slug: "article-cree-apres-le-rapatriement", featuredImage: "/images/hero.webp" },
      "https://axion-ia.com",
    );

    expect(fragment.ogImage).toBe("https://axion-ia.com/images/hero.webp");
    expect(fragment.ogImageWidth).toBeUndefined();
  });

  it("la surcharge console reste au-dessus de l'image rapatriée", () => {
    const [slug] = entrees[0]!;

    const fragment = resoudreImagePartageArticle(
      { slug, ogImage: "/og/choix-manuel.png", featuredImage: "/images/hero.webp" },
      "https://axion-ia.com",
    );

    expect(fragment.ogImage).toBe("https://axion-ia.com/og/choix-manuel.png");
  });
});
