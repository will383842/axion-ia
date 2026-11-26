// Le bas de chaque article de blog pousse vers la Journée IA, plus vers /formations.
// Vérifié sur le code source : la page complète n'est pas montable en test unitaire.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHEMIN_JOURNEE_IA } from "@/content/journee-ia-commun";

const code = (f: string) =>
  readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const PAGE = "src/app/[locale]/blog/[slug]/page.tsx";

describe("fin d'article de blog", () => {
  const src = code(PAGE);
  const fin = src.slice(src.indexOf("<CtaBlock"), src.indexOf("<JsonLd data={articleJsonLd}"));

  it("le bloc final mène à la page Journée IA", () => {
    expect(fin).toContain("CHEMIN_JOURNEE_IA");
    expect(src).toMatch(
      /import \{[^}]*CHEMIN_JOURNEE_IA[^}]*\} from "@\/content\/journee-ia-commun"/,
    );
    expect(CHEMIN_JOURNEE_IA).toBe("/journee-ia");
  });

  it("le bloc final ne pointe plus vers /formations", () => {
    expect(fin).not.toContain("/formations");
    expect(fin).not.toMatch(/formation/i);
    expect(fin.length).toBeGreaterThan(0);
  });

  it("le bloc final respecte la doctrine (ni prix en dur, ni garantie détaillée, ni réservation)", () => {
    expect(fin).not.toMatch(/Grenoble|€|4\s?470|5 fois|barr|Aucun gain garanti|réserv/i);
  });
});
