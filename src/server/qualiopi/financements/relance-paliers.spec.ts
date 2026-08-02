/**
 * Tests — échelle des paliers de relance.
 *
 * Le défaut d'origine : l'échelle s'arrêtait à J30, donc une créance de plus de
 * trente jours ne remontait plus jamais. Ces tests verrouillent le fait qu'AUCUN
 * retard, si ancien soit-il, ne retombe dans un trou.
 */

import { describe, it, expect } from "vitest";
import {
  PALIERS_RELANCE_FACTURE,
  palierPourJours,
  definitionPalier,
  libellePalier,
  tonPalier,
} from "./relance-paliers";

describe("PALIERS_RELANCE_FACTURE — invariants de l'échelle", () => {
  it("les seuils sont strictement croissants (la sélection en dépend)", () => {
    const seuils = PALIERS_RELANCE_FACTURE.map((d) => d.joursMin);
    for (let i = 1; i < seuils.length; i++) {
      expect(seuils[i]!).toBeGreaterThan(seuils[i - 1]!);
    }
  });

  it("couvre J1 à J60 sans trou d'identifiant", () => {
    expect(PALIERS_RELANCE_FACTURE.map((d) => d.palier)).toEqual([
      "j1",
      "j15",
      "j30",
      "j45",
      "j60",
    ]);
  });

  it("chaque identifiant tient dans VarChar(10) (colonne `palier`)", () => {
    for (const d of PALIERS_RELANCE_FACTURE) {
      expect(d.palier.length).toBeLessThanOrEqual(10);
    }
  });
});

describe("palierPourJours", () => {
  it("rend le palier LE PLUS ÉLEVÉ atteint, pas toute la série franchie", () => {
    expect(palierPourJours(50)).toBe("j45");
    expect(palierPourJours(200)).toBe("j60");
  });

  it("sélectionne le bon palier à chaque seuil exact", () => {
    expect(palierPourJours(1)).toBe("j1");
    expect(palierPourJours(15)).toBe("j15");
    expect(palierPourJours(30)).toBe("j30");
    expect(palierPourJours(45)).toBe("j45");
    expect(palierPourJours(60)).toBe("j60");
  });

  it("juste sous un seuil, reste au palier précédent", () => {
    expect(palierPourJours(14)).toBe("j1");
    expect(palierPourJours(29)).toBe("j15");
    expect(palierPourJours(44)).toBe("j30");
    expect(palierPourJours(59)).toBe("j45");
  });

  // 🔴 Le trou d'origine : au-delà de J30 aucune relance n'était proposée.
  it("une créance très ancienne reste relançable (plus de trou après J30)", () => {
    for (const jours of [31, 46, 61, 90, 365, 3_000]) {
      expect(palierPourJours(jours)).not.toBeNull();
    }
  });

  it("facture non échue → aucun palier (rien à relancer)", () => {
    expect(palierPourJours(0)).toBeNull();
    expect(palierPourJours(-5)).toBeNull();
  });

  it("entrée non finie → aucun palier plutôt qu'un choix arbitraire", () => {
    expect(palierPourJours(NaN)).toBeNull();
    expect(palierPourJours(Infinity)).toBeNull();
  });
});

describe("définitions, libellés et tons", () => {
  it("le ton durcit avec l'ancienneté", () => {
    expect(tonPalier("j1")).toBe("rappel");
    expect(tonPalier("j30")).toBe("ferme");
    expect(tonPalier("j45")).toBe("mise_en_demeure");
    expect(tonPalier("j60")).toBe("avant_contentieux");
  });

  it("un palier inconnu (donnée ancienne) reste lisible et non agressif", () => {
    expect(definitionPalier("j99")).toBeNull();
    expect(libellePalier("j99")).toBe("J99");
    // Repli sur le ton le MOINS agressif : jamais de mise en demeure par défaut.
    expect(tonPalier("j99")).toBe("rappel");
  });

  it("les libellés admin ne sont jamais vides", () => {
    for (const d of PALIERS_RELANCE_FACTURE) {
      expect(libellePalier(d.palier).length).toBeGreaterThan(0);
    }
  });
});
