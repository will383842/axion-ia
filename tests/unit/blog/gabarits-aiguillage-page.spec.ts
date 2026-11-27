/**
 * PR S1 — la page /blog/[slug] n'a gagné qu'UNE insertion, derrière l'interrupteur.
 * Vérifié sur le code source (la page complète n'est pas montable en test unitaire,
 * cf. fin-article-journee-ia.spec.ts). Pas de comparaison à origin/main : la CI clone
 * en profondeur 1 et, après fusion, origin/main contient déjà l'insertion.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/[locale]/blog/[slug]/page.tsx";
const src = readFileSync(PAGE, "utf8");

describe("aiguillage dans page.tsx", () => {
  it("l'insertion est gardée par gabaritsV2Actifs() et avant le return principal du JSX V1", () => {
    const garde = src.indexOf("if (gabaritsV2Actifs())");
    const retourV1 = src.indexOf("return (\n    <>\n      {/* Refonte templates 2026-06-22");
    expect(garde).toBeGreaterThan(0);
    expect(retourV1).toBeGreaterThan(garde);
  });

  it("chargerTypeContenu n'est appelé qu'à l'intérieur de la garde", () => {
    const appels = [...src.matchAll(/chargerTypeContenu\(/g)].map((m) => m.index!);
    expect(appels).toHaveLength(1);
    const garde = src.indexOf("if (gabaritsV2Actifs())");
    const retourV1 = src.indexOf("return (\n    <>\n      {/* Refonte templates 2026-06-22");
    expect(appels[0]).toBeGreaterThan(garde);
    expect(appels[0]).toBeLessThan(retourV1);
  });

  it("le JSX V1 garde ses marqueurs : max-w-[52rem], « Mis à jour », aucun data-gabarit", () => {
    const debut = src.indexOf("return (\n    <>\n      {/* Refonte templates 2026-06-22");
    const v1 = src.slice(debut);
    expect(v1).toContain("max-w-[52rem]");
    expect(v1).toContain("Mis à jour le ");
    expect(v1).not.toContain("data-gabarit");
    expect(v1).not.toContain("ArticleGabarit");
  });

  it("aucun use client dans le socle", () => {
    for (const f of [
      "src/components/article-v2/ArticleGabarit.tsx",
      "src/lib/blog/gabarits-v2.ts",
      "src/server/content-gen/blog/gabarits.ts",
    ]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/["']use client["']/);
    }
  });
});
