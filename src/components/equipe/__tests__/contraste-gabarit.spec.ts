/**
 * Contraste des paires de couleurs du gabarit de fiche (WCAG), lues dans `globals.css` :
 * un jeton modifié là-bas est revérifié ici. 7 : texte courant sur foncé ; 4,5 : texte ailleurs ;
 * 3 : grands chiffres et éléments graphiques.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const hex = (jeton: string): string => {
  const m = new RegExp(`--color-${jeton}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`jeton --color-${jeton} introuvable dans globals.css`);
  return m[1] as string;
};
const lum = (h: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string): number => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

const PAIRES: ReadonlyArray<[string, string, string, number]> = [
  ["texte courant sur foncé", "mocha-fg", "mocha", 7],
  ["grands chiffres sur foncé", "terracotta-on-mocha", "mocha", 3],
  ["texte courant sur bandeau d'appel", "mocha-fg", "terracotta-deep", 7],
  ["accent sur ivoire", "terracotta", "bg", 4.5],
  ["pastille « après »", "terracotta-deep", "terracotta-soft", 4.5],
  ["texte dans les cartes « après »", "fg", "terracotta-soft", 4.5],
  ["légende sur crème", "fg-muted", "sand", 4.5],
  ["icône développeur", "sage", "sage-soft", 4.5],
  ["icône apporteur", "ochre-deep", "ochre-soft", 4.5],
  ["icône spécialiste IA", "plum-deep", "plum-soft", 4.5],
  ["icône partenaire", "mocha", "sand", 4.5],
  ["texte sur crème", "fg", "sand", 4.5],
  ["légende de carte sur papier", "fg-muted", "paper", 4.5],
  ["bordure de pastille sur foncé (graphique)", "border-on-mocha", "mocha", 1],
];

describe("contraste du gabarit de fiche", () => {
  it.each(PAIRES)("%s : %s sur %s ≥ %d", (_nom, texte, fond, seuil) => {
    expect(ratio(texte, fond)).toBeGreaterThanOrEqual(seuil);
  });
  it("l'accent d'un petit sur-titre sur foncé est l'ivoire (terracotta-on-mocha < 7:1)", () => {
    expect(ratio("mocha-fg", "mocha")).toBeGreaterThanOrEqual(7);
    expect(ratio("terracotta-on-mocha", "mocha")).toBeLessThan(7);
  });
});
