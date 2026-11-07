/**
 * V8-P2a — parité de la palette des pièces (e-mails, PDF) avec
 * `couleurs-marque.json` du dépôt axion-brand (version 2026-11-07).
 */
import { describe, it, expect } from "vitest";
import { COULEURS_PIECES, COULEURS_PIECES_A_CONFIRMER } from "./couleurs-pieces";

const JSON_MARQUE = {
  ivoire: "#FAF9F5",
  "gris-chaud": "#E8E6DC",
  noir: "#141413",
  blanc: "#FFFFFF",
  terracotta: "#B23F16",
  orange: "#D97757",
  "gris-moyen": "#B0AEA5",
  "texte-secondaire": "#5E5D59",
  reussite: "#5E7050",
  erreur: "#B8341C",
};
const A_CONFIRMER = { "terracotta-survol": "#8F3412", attention: "#8F3412" };

function teinte(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe("couleurs-pieces : parité avec couleurs-marque.json", () => {
  it("les valeurs confirmées sont identiques", () => {
    expect(COULEURS_PIECES).toEqual(JSON_MARQUE);
  });
  it("les valeurs À CONFIRMER sont isolées et identiques", () => {
    expect(COULEURS_PIECES_A_CONFIRMER).toEqual(A_CONFIRMER);
  });
  it("aucun bleu ni jaune", () => {
    for (const hex of [
      ...Object.values(COULEURS_PIECES),
      ...Object.values(COULEURS_PIECES_A_CONFIRMER),
    ]) {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      const t = teinte(hex);
      const saturee =
        Math.max(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))) -
          Math.min(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))) >
        40;
      if (saturee) expect(t < 40 || t > 330).toBe(true);
    }
  });
});
