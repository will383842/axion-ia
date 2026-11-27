/**
 * Contraste des couleurs de catégorie sur l'ivoire (WCAG) : ≥ 4,5:1 pour le texte, ≥ 3:1 pour les formes.
 * Les valeurs sont lues dans `globals.css` : un jeton modifié là-bas est vérifié ici, sans second hex à tenir à jour.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES_IDS } from "@/lib/equipe";
import { jetonsDe } from "../couleurs-categorie";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const hex = (jeton: string): string => {
  const m = new RegExp(`--color-${jeton}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`jeton --color-${jeton} introuvable dans globals.css`);
  return m[1] as string;
};
const lum = (h: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

const IVOIRE = hex("bg");

describe("contraste des catégories sur l'ivoire", () => {
  it("l'ivoire est bien le canevas du site", () => {
    expect(IVOIRE.toLowerCase()).toBe("#faf8f3"); // hex-ok: valeur de référence du test
  });
  for (const id of CATEGORIES_IDS) {
    const j = jetonsDe(id);
    it(`${id} : forme ≥ 3:1`, () => {
      expect(ratio(hex(j.forme), IVOIRE)).toBeGreaterThanOrEqual(3);
    });
    it(`${id} : texte (variante forte) ≥ 4,5:1 sur l'ivoire`, () => {
      expect(ratio(hex(j.fort), IVOIRE)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${id} : lettre ivoire sur l'avatar ≥ 4,5:1`, () => {
      expect(ratio(IVOIRE, hex(j.fort))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
