// @vitest-environment node

/**
 * Charte v1 — valeurs figées et contraste des couples texte / fond réellement utilisés.
 */

import { describe, expect, it } from "vitest";
import {
  CHARTE_COULEURS,
  CHARTE_COUPLES_TEXTE,
  CHARTE_ESPACES,
  CHARTE_RAYONS,
  CHARTE_TYPO,
} from "./couleurs";

/** Luminance relative WCAG 2.x d'une couleur `#RRGGBB`. */
function luminance(hex: string): number {
  const canal = (i: number): number => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair! + 0.05) / (sombre! + 0.05);
}

describe("charte v1 — valeurs figées", () => {
  it("couleurs exactes", () => {
    expect(CHARTE_COULEURS).toEqual({
      fond: "#FAF9F5",
      texte: "#141413",
      grisChaud: "#E8E6DC",
      carte: "#FFFFFF",
      bordureCarte: "#E8E6DC",
      terracotta: "#B23F16",
      sombre: "#141413",
      sombreTexte: "#FAF9F5",
      sombreSurTitre: "#D97757",
      sombreSecondaire: "#B0AEA5",
      bleuDoux: "#E8F0FA",
      bleu: "#1F5FA8",
      lisere: ["#2F7FC8", "#F0B323", "#C2185B", "#A8C93A"],
    });
  });

  it("rayons exacts", () => {
    expect(CHARTE_RAYONS).toEqual({ carte: 11, tuile: 10, ligneTableau: 7.5, pastille: 99 });
  });

  it("typographie exacte, graisses 400/500/700 seulement", () => {
    expect(CHARTE_TYPO.police).toBe("Manrope");
    expect(CHARTE_TYPO.graisses).toEqual({ normale: 400, moyenne: 500, grasse: 700 });
    expect(CHARTE_TYPO.corps).toEqual({ taille: 10, interligne: 1.4 });
    expect(CHARTE_TYPO.petit).toEqual({ taille: 8.8 });
    expect(CHARTE_TYPO.pied).toEqual({ taille: 8 });
    expect(CHARTE_TYPO.surTitre).toEqual({ taille: 7.8, interlettrage: 0.9 });
    expect(CHARTE_TYPO.marque).toEqual({ taille: 12.5 });
    expect(CHARTE_TYPO.titre1).toEqual({ taille: 26, interligne: 1.05, interlettrage: -0.75 });
    expect(CHARTE_TYPO.titre2).toEqual({ taille: 14, interlettrage: -0.3 });
    expect(CHARTE_TYPO.titreCarte).toEqual({ taille: 11 });
    expect(CHARTE_TYPO.montantTotal).toEqual({ taille: 26 });
  });

  it("espaces exacts", () => {
    expect(CHARTE_ESPACES).toEqual({
      margeHaut: 37,
      margeCote: 40,
      basReserve: 64,
      ecartCartes: 7,
      carteV: 11,
      carteH: 13,
      hauteurLisere: 5,
    });
  });
});

describe("charte v1 — contraste des couples réellement utilisés", () => {
  it("la liste des couples n'est pas vide", () => {
    expect(CHARTE_COUPLES_TEXTE.length).toBeGreaterThanOrEqual(8);
  });

  it.each(CHARTE_COUPLES_TEXTE.map((c) => [c.nom, c.texte, c.fond] as const))(
    "%s : %s sur %s ≥ 4,5",
    (_nom, texte, fond) => {
      expect(contraste(texte, fond)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("toute couleur de texte utilisée est une couleur de la charte", () => {
    const valeurs = new Set<string>(
      Object.values(CHARTE_COULEURS).flatMap((v) => (Array.isArray(v) ? v : [v])),
    );
    for (const c of CHARTE_COUPLES_TEXTE) {
      expect(valeurs.has(c.texte)).toBe(true);
      expect(valeurs.has(c.fond)).toBe(true);
    }
  });
});
