/**
 * Tests — opco-calcul.ts (T11 AGENT A, module PUR).
 *
 * Couverture : tarifHoraireOpco, computeVentilationHoraire, computeForfait.
 * Aucun mock nécessaire (fonctions pures, sans I/O).
 */

import { describe, it, expect } from "vitest";
import { tarifHoraireOpco, computeVentilationHoraire, computeForfait } from "./opco-calcul";
import type { PlafondOpco } from "./opco-calcul";

const PLAFONDS_TEST: PlafondOpco = {
  intraHoraire: 40, // 40 €/h → 4000 cts
  interPresentiel: 25, // 25 €/h → 2500 cts
  interDistanciel: 15, // 15 €/h → 1500 cts
};

// ─────────────────────────────────────────────────────────────────────────────
// tarifHoraireOpco
// ─────────────────────────────────────────────────────────────────────────────

describe("tarifHoraireOpco", () => {
  it("retourne le plafond intra en centimes si intra=true (présentiel)", () => {
    expect(tarifHoraireOpco("presentiel", true, PLAFONDS_TEST)).toBe(4000);
  });

  it("retourne le plafond intra en centimes si intra=true (distanciel)", () => {
    // intra domine toujours la modalité
    expect(tarifHoraireOpco("distanciel", true, PLAFONDS_TEST)).toBe(4000);
  });

  it("retourne le plafond inter distanciel si intra=false + distanciel", () => {
    expect(tarifHoraireOpco("distanciel", false, PLAFONDS_TEST)).toBe(1500);
  });

  it("retourne le plafond inter présentiel si intra=false + présentiel", () => {
    expect(tarifHoraireOpco("presentiel", false, PLAFONDS_TEST)).toBe(2500);
  });

  it("retourne le plafond inter présentiel si intra=false + hybride", () => {
    expect(tarifHoraireOpco("hybride", false, PLAFONDS_TEST)).toBe(2500);
  });

  it("arrondit correctement les valeurs flottantes (ex. 33.33 €/h → 3333 cts)", () => {
    const plafonds: PlafondOpco = { intraHoraire: 33.33, interPresentiel: 0, interDistanciel: 0 };
    expect(tarifHoraireOpco("presentiel", true, plafonds)).toBe(3333);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeVentilationHoraire
// ─────────────────────────────────────────────────────────────────────────────

describe("computeVentilationHoraire", () => {
  it("calcule le total HT : 7 h × 5 participants × 4000 cts/h = 140 000 cts", () => {
    const result = computeVentilationHoraire({
      dureeHeures: 7,
      nbParticipants: 5,
      tarifHoraireCents: 4000,
    });
    expect(result.totalHtCents).toBe(140_000);
    expect(result.lignes).toHaveLength(1);
  });

  it("retourne une seule ligne avec quantite = nbParticipants", () => {
    const result = computeVentilationHoraire({
      dureeHeures: 3,
      nbParticipants: 8,
      tarifHoraireCents: 2500,
    });
    expect(result.lignes[0]!.quantite).toBe(8);
  });

  it("prixUnitaireHtCents = arrondi(dureeHeures × tarifHoraireCents)", () => {
    const result = computeVentilationHoraire({
      dureeHeures: 3.5,
      nbParticipants: 4,
      tarifHoraireCents: 2500,
    });
    // 3.5 × 2500 = 8750 par participant
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(8750);
    expect(result.totalHtCents).toBe(8750 * 4);
  });

  it("totalHtCents = sum(lignes[i].quantite × prixUnitaireHtCents)", () => {
    const result = computeVentilationHoraire({
      dureeHeures: 6,
      nbParticipants: 3,
      tarifHoraireCents: 1500,
    });
    const sumLignes = result.lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaireHtCents, 0);
    expect(result.totalHtCents).toBe(sumLignes);
  });

  it("désignation contient la durée et le nb de participants", () => {
    const result = computeVentilationHoraire({
      dureeHeures: 2,
      nbParticipants: 10,
      tarifHoraireCents: 1500,
    });
    expect(result.lignes[0]!.designation).toContain("2");
    expect(result.lignes[0]!.designation).toContain("10");
  });

  it("gère 1 participant (singulier dans la désignation)", () => {
    const result = computeVentilationHoraire({
      dureeHeures: 1,
      nbParticipants: 1,
      tarifHoraireCents: 4000,
    });
    expect(result.lignes[0]!.designation).not.toContain("participants");
    expect(result.lignes[0]!.designation).toContain("participant");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeForfait
// ─────────────────────────────────────────────────────────────────────────────

describe("computeForfait", () => {
  it("retourne une seule ligne avec quantite=1 et prixUnitaireHtCents=montant", () => {
    const result = computeForfait(250_000);
    expect(result.lignes).toHaveLength(1);
    expect(result.lignes[0]!.quantite).toBe(1);
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(250_000);
  });

  it("totalHtCents = montantHtCents", () => {
    const result = computeForfait(180_000);
    expect(result.totalHtCents).toBe(180_000);
  });

  it("totalHtCents = sum(lignes[i].quantite × prixUnitaireHtCents)", () => {
    const result = computeForfait(99_900);
    const sumLignes = result.lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaireHtCents, 0);
    expect(result.totalHtCents).toBe(sumLignes);
  });

  it("retourne 0 correctement pour un montant nul", () => {
    const result = computeForfait(0);
    expect(result.totalHtCents).toBe(0);
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(0);
  });
});
