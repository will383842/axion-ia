/**
 * Verrou GEO-010 / GEO-071 — on ne publie pas une preuve qu'on n'a pas
 * (audit GEO/AEO end-to-end du 2026-08-14, lot 7).
 *
 * ## GEO-071 — la garantie était écrite dans le composant et rompue à l'appel
 *
 * `ArticleTransparencyBlock` documente son propre contrat en toutes lettres :
 * « alimenté par la donnée DB réelle `Article.lastVerifiedAt` → rendu UNIQUEMENT
 * si une vraie date est renseignée, **jamais inventée** ».
 *
 * Or les trois pages appelantes lui passaient `updatedAt` — la date de
 * modification de l'article — et le composant l'affichait sous l'étiquette
 * « Dernière vérification ». On affirmait donc au lecteur et aux moteurs que les
 * sources avaient été contrôlées ce jour-là, alors que personne ne les avait
 * ouvertes. Mesuré en production le 2026-08-16 : deux mentions par article.
 *
 * La donnée réelle existait pourtant : `ExternalReference.lastVerifiedAt`, écrite
 * par `persist-citations.ts` et **lue par personne**.
 *
 * ## GEO-010 — un filtre qui ne testait que le préfixe
 *
 * `/^https?:\/\//` accepte tout ce qui suit, y compris une URL terminée par une
 * backtick (séquelle de génération) ou contenant une espace. Ces URLs étaient
 * servies dans le HTML **et** dans le `CreativeWork` du JSON-LD.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { estUrlServable } from "@/components/content-gen/ArticleSources";

function source(relatif: string): string {
  return readFileSync(path.join(process.cwd(), relatif), "utf8");
}

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("URL de citation — le filtre teste l'URL entière (GEO-010)", () => {
  it("accepte une URL normale", () => {
    expect(estUrlServable("https://www.insee.fr/fr/statistiques/1234")).toBe(true);
    expect(estUrlServable("http://exemple.fr/a?b=c#d")).toBe(true);
  });

  it("🔴 refuse une URL terminée par une backtick — le cas mesuré", () => {
    // C'est exactement la forme que l'ancien filtre laissait passer : le préfixe
    // est correct, donc `/^https?:\/\//` disait oui.
    expect(estUrlServable("https://www.insee.fr/fr/statistiques/1234`")).toBe(false);
    expect(estUrlServable("`https://www.insee.fr/")).toBe(false);
  });

  it("refuse les caractères qui n'ont rien à faire dans une URL servie", () => {
    for (const mauvais of [
      "https://exemple.fr/mon article",
      'https://exemple.fr/"x"',
      "https://exemple.fr/<script>",
      "https://exemple.fr/it's",
    ]) {
      expect(estUrlServable(mauvais), mauvais).toBe(false);
    }
  });

  it("refuse ce qui n'est pas du http(s)", () => {
    for (const mauvais of [
      "javascript:alert(1)",
      "ftp://exemple.fr",
      "//exemple.fr",
      "exemple.fr",
    ]) {
      expect(estUrlServable(mauvais), mauvais).toBe(false);
    }
  });

  it("refuse le vide et l'absence", () => {
    expect(estUrlServable("")).toBe(false);
    expect(estUrlServable("   ")).toBe(false);
    expect(estUrlServable(null)).toBe(false);
    expect(estUrlServable(undefined)).toBe(false);
  });
});

describe("date de vérification — jamais celle de l'article (GEO-071)", () => {
  const PAGES = [
    "src/app/[locale]/blog/[slug]/page.tsx",
    "src/app/[locale]/actualites/[slug]/page.tsx",
    "src/app/[locale]/guides/[slug]/page.tsx",
  ];

  it("garde anti-test-vide : les trois pages sont lues et rendent bien le bloc", () => {
    for (const p of PAGES) {
      const src = source(p);
      expect(src.length, `${p} lu vide`).toBeGreaterThan(1000);
      expect(src, `${p} ne rend plus de bloc de sources`).toContain("ArticleSources");
    }
  });

  for (const p of PAGES) {
    it(`${p.split("/")[3]} ne passe plus la date de l'article comme date de vérification`, () => {
      const code = sansCommentaires(source(p));
      // Toutes les formes rencontrées dans les trois pages.
      for (const interdit of [
        "lastVerified={view.updatedAt",
        "lastVerified={updatedIso}",
        "lastVerified={article.updatedAt",
        "lastVerified={guide.updatedAt",
      ]) {
        expect(
          code.includes(interdit),
          `${interdit} est de retour : le site réaffirme une vérification de sources ` +
            `qui n'a jamais eu lieu.`,
        ).toBe(false);
      }
    });
  }

  it("🔑 /blog lit la VRAIE donnée, il ne se contente pas de masquer la ligne", () => {
    // La différence compte : masquer, c'est se taire ; lire `lastVerifiedAt`,
    // c'est dire la vérité quand elle existe. La colonne était déjà écrite par
    // `persist-citations.ts` et n'était lue nulle part.
    const loader = sansCommentaires(source("src/server/content-gen/blog/loader.ts"));
    expect(loader).toContain("lastVerifiedAt: true");
    expect(loader).toContain("lastVerifiedAt: c.externalReference.lastVerifiedAt");

    const page = sansCommentaires(source("src/app/[locale]/blog/[slug]/page.tsx"));
    expect(page).toContain("sourcesVerifiees");
    expect(
      page.includes("Math.max"),
      "la date retenue doit être la PLUS RÉCENTE des citations — la plus ancienne " +
        "sous-estimerait, une moyenne inventerait.",
    ).toBe(true);
  });

  it("le composant conserve son garde-fou « pas de date = pas de bloc »", () => {
    const bloc = sansCommentaires(
      source("src/components/content-gen/ArticleTransparencyBlock.tsx"),
    );
    expect(
      /if\s*\(!lastVerified\)\s*return null;/.test(bloc),
      "le composant rendrait un bloc de transparence sans date de vérification.",
    ).toBe(true);
  });
});
