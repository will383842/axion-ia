import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { contientAffirmationQualiopi } from "@/server/videos/gardes-contenu";
import { THEMES, THEME_SLUGS, themeParSlug } from "../themes";

const nbMots = (t: string) => t.trim().split(/\s+/).length;

describe("liste fermée des thèmes (D3)", () => {
  it("4 à 6 thèmes", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(4);
    expect(THEMES.length).toBeLessThanOrEqual(6);
  });

  it("slugs uniques, en minuscules et tirets", () => {
    expect(new Set(THEME_SLUGS).size).toBe(THEMES.length);
    for (const s of THEME_SLUGS) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("chaque page liée existe dans routing.ts", () => {
    const pathnames = Object.keys(routing.pathnames);
    for (const t of THEMES) {
      expect(t.pagesLiees.length, `${t.slug} sans page liée`).toBeGreaterThan(0);
      for (const p of t.pagesLiees) {
        expect(pathnames, `${t.slug} → ${p.href} absent de routing.ts`).toContain(p.href);
      }
    }
  });

  it("chaque thème a un service associé parmi ses pages liées", () => {
    for (const t of THEMES) expect(t.pagesLiees.map((p) => p.href)).toContain(t.service);
  });

  it("intro éditoriale d'au moins 150 mots (pas de page de thème mince)", () => {
    for (const t of THEMES) {
      expect(nbMots(t.intro), `${t.slug} : ${nbMots(t.intro)} mots`).toBeGreaterThanOrEqual(150);
    }
  });

  it("aucune intro ne viole les gardes de contenu du site", () => {
    for (const t of THEMES) {
      const texte = `${t.libelle} ${t.description} ${t.intro}`;
      expect(texte).not.toMatch(/grenoble/i);
      expect(texte).not.toMatch(/aucun\s+gain\s+garanti/i);
      expect(contientAffirmationQualiopi(texte)).toBe(false);
      expect(texte).not.toMatch(/\b(?:CPF|OPCO|EDOF)\b/);
    }
  });

  it("themeParSlug", () => {
    expect(themeParSlug(THEMES[0]!.slug)?.slug).toBe(THEMES[0]!.slug);
    expect(themeParSlug("inconnu")).toBeNull();
  });
});
