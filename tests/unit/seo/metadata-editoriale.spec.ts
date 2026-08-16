/**
 * Verrou GEO-058 / GEO-142 — métadonnées éditoriales et aperçus sociaux
 * (audit GEO/AEO end-to-end du 2026-08-14, lot 14).
 *
 *  - **GEO-058** — aucune image OG générée n'était mise en cache par le CDN.
 *    Mesuré en production le 2026-08-16 : `Cache-Control: public, max-age=0,
 *    must-revalidate` et `cf-cache-status: DYNAMIC`. Chaque partage, chaque
 *    re-crawl, chaque aperçu Slack refaisait un rendu Satori complet (~2 s) à
 *    l'origine, pour une image entièrement déterminée par sa query string.
 *  - **GEO-142** — les 126 articles de blog n'émettaient AUCUNE balise
 *    `article:*`, alors que `/actualites/[slug]` les émet depuis toujours par
 *    le même mécanisme (`buildProductMetadata({ article })`). Mesuré live :
 *    0 balise sur un article de blog, 2 sur une actualité.
 *
 * ## Ce qui n'est PAS dans ce lot, et pourquoi
 *
 * **GEO-143** (« aucune date d'article n'est balisée `<time datetime>` ») n'est
 * **pas reproductible** : la mesure en production du 2026-08-16 montre quatre
 * `<time dateTime="…">` sur un article de blog. Aucun correctif n'est posé — on
 * ne fabrique pas un patch pour un défaut qui n'existe plus. Le test ci-dessous
 * fige simplement l'état constaté, pour que la régression se voie.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relatif: string): string {
  return readFileSync(path.join(process.cwd(), relatif), "utf8");
}

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const OG = sansCommentaires(source("src/app/api/og/route.tsx"));
const BLOG = sansCommentaires(source("src/app/[locale]/blog/[slug]/page.tsx"));

describe("image OG générée — le CDN doit pouvoir la garder (GEO-058)", () => {
  it("garde anti-test-vide : les deux sources sont lues", () => {
    expect(OG.length).toBeGreaterThan(1000);
    expect(BLOG.length).toBeGreaterThan(1000);
  });

  it("la réponse porte un `Cache-Control` cachable", () => {
    const m = /"Cache-Control":\s*"([^"]+)"/.exec(OG);
    expect(
      m,
      "aucun en-tête Cache-Control : le CDN repasse en DYNAMIC et " +
        "chaque fetch relance un rendu Satori de ~2 s à l'origine.",
    ).not.toBeNull();
    const valeur = m?.[1] ?? "";
    expect(valeur).toContain("public");
    expect(
      /max-age=(\d+)/.exec(valeur)?.[1],
      "`max-age=0` équivaut à pas de cache du tout — c'est l'état d'origine.",
    ).not.toBe("0");
  });

  it("le rendu reste une fonction pure de la query — ce qui rend `immutable` exact", () => {
    // `immutable` n'est légitime que parce que le contenu est entièrement
    // déterminé par l'URL. Si le rendu se mettait à dépendre d'autre chose (base,
    // date, en-tête), la même URL pourrait servir deux images différentes et
    // l'en-tête deviendrait un mensonge.
    expect(OG).toContain("searchParams.get");

    // ⚠️ `fetch(` n'est PAS un critère : la route en fait quatre, au niveau
    // module, pour charger les fichiers de police. Ce sont des constantes —
    // identiques à chaque rendu, sans effet sur le contenu de l'image. Ma
    // première version de ce test les comptait comme « source variable » et
    // rougissait sur du code parfaitement sain : un test trop large ne protège
    // pas mieux, il apprend à ignorer les alertes.
    //
    // Les vrais signaux d'une sortie qui cesserait d'être déterminée par l'URL :
    // une lecture en base, ou une dépendance à l'heure.
    expect(
      /prisma|Date\.now|new Date\(\)/.test(OG),
      "le générateur d'image OG lit désormais une source variable (base ou " +
        "horloge) : la même URL peut servir deux images différentes, donc " +
        "`immutable` est devenu un mensonge. Revoir l'en-tête de cache.",
    ).toBe(false);
  });
});

describe("articles de blog — dater et attribuer (GEO-142)", () => {
  it("la page passe un bloc `article` à buildProductMetadata", () => {
    expect(
      /article:\s*\{/.test(BLOG),
      "les balises `article:*` ont disparu des articles de blog : Facebook, " +
        "LinkedIn et les crawlers news n'ont plus de date ni d'attribution.",
    ).toBe(true);
  });

  for (const champ of ["publishedTime", "modifiedTime", "authors", "section", "tags"]) {
    it(`le champ \`${champ}\` est renseigné`, () => {
      expect(BLOG).toContain(champ);
    });
  }

  it("🔴 les dates sont REPRISES, jamais recalculées", () => {
    // Do-not-touch du plan : le signal porteur reste `datePublished` /
    // `dateModified` du JSON-LD. Deux sources de date sur une même page
    // finissent toujours par diverger — et une date qui recule est pire que
    // pas de date.
    expect(BLOG).toContain("publishedTime: view.publishedAt");
    expect(
      /publishedTime:\s*new Date\(|publishedTime:\s*Date\./.test(BLOG),
      "une date est fabriquée au lieu d'être reprise de la vue : elle divergera " +
        "du JSON-LD de la même page.",
    ).toBe(false);
  });

  it("le mécanisme est celui déjà en place sur /actualites, pas un doublon", () => {
    // Si `/actualites` cessait d'utiliser `article:`, c'est que le mécanisme
    // aurait changé et que ce lot devrait suivre.
    const actus = sansCommentaires(source("src/app/[locale]/actualites/[slug]/page.tsx"));
    expect(actus).toContain("publishedTime");
  });
});
