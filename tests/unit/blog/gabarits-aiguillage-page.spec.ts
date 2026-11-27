/**
 * PR S1 — la page /blog/[slug] n'a gagné qu'UNE insertion, derrière l'interrupteur.
 * Vérifié sur le code source (la page complète n'est pas montable en test unitaire,
 * cf. fin-article-journee-ia.spec.ts) et par le diff contre la version d'origine.
 */
import { execFileSync } from "node:child_process";
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

  it("generateMetadata est identique à la version d'origine", () => {
    let origine: string;
    try {
      origine = execFileSync("git", ["show", `origin/main:${PAGE}`], { encoding: "utf8" });
    } catch {
      return; // pas d'historique git disponible : le test ne s'applique pas
    }
    const bloc = (s: string) =>
      s.slice(
        s.indexOf("export async function generateMetadata"),
        s.indexOf("export default async function"),
      );
    expect(bloc(src)).toBe(bloc(origine));
  });

  it("hors insertion, la page ne diffère de l'origine que par les imports ajoutés", () => {
    let origine: string;
    try {
      origine = execFileSync("git", ["show", `origin/main:${PAGE}`], { encoding: "utf8" });
    } catch {
      return;
    }
    const debut = src.indexOf("  // Gabarits d'articles (PR S1)");
    const fin = src.indexOf("  return (\n    <>\n      {/* Refonte templates 2026-06-22");
    const sansInsertion = src.slice(0, debut) + src.slice(fin);
    const sansImports = (s: string) =>
      s
        .split("\n")
        .filter(
          (l) =>
            !/gabaritsV2Actifs|gabaritPourType|ArticleGabarit|^\s*chargerTypeContenu,$/.test(l),
        )
        .join("\n");
    expect(sansImports(sansInsertion)).toBe(sansImports(origine));
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
