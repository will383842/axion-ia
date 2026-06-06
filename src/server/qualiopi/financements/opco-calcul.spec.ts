/**
 * Tests — opco-calcul.ts (T11 AGENT A, module PUR).
 *
 * Couverture : tarifHoraireOpco, computeVentilationHoraire, computeForfait.
 * Aucun mock nécessaire (fonctions pures, sans I/O).
 */

import { describe, it, expect } from "vitest";
import {
  tarifHoraireOpco,
  computeVentilationHoraire,
  computeForfait,
  computeVentilationDossier,
} from "./opco-calcul";
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

// ─────────────────────────────────────────────────────────────────────────────
// computeVentilationDossier
// ─────────────────────────────────────────────────────────────────────────────

describe("computeVentilationDossier", () => {
  // ── euro_heure ─────────────────────────────────────────────────────────────

  it("euro_heure : total = dureeHeures × nbParticipants × montantCents", () => {
    const result = computeVentilationDossier({
      unite: "euro_heure",
      montantCents: 4000, // 40 €/h
      dureeHeures: 7,
      nbParticipants: 5,
    });
    // 7 h × 4000 cts/h = 28 000 cts/participant × 5 = 140 000 cts
    expect(result.totalHtCents).toBe(140_000);
    expect(result.lignes).toHaveLength(1);
    expect(result.lignes[0]!.quantite).toBe(5);
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(28_000);
  });

  it("euro_heure : désignation mentionne l'unité €/h", () => {
    const result = computeVentilationDossier({
      unite: "euro_heure",
      montantCents: 3500,
      dureeHeures: 3.5,
      nbParticipants: 2,
    });
    expect(result.lignes[0]!.designation).toContain("€/h");
  });

  // ── euro_jour ──────────────────────────────────────────────────────────────

  it("euro_jour : nbJours = ceil(7/7)=1, total = 1 × 5 × 5000 = 25 000", () => {
    const result = computeVentilationDossier({
      unite: "euro_jour",
      montantCents: 5000, // 50 €/j
      dureeHeures: 7,
      nbParticipants: 5,
    });
    expect(result.totalHtCents).toBe(25_000);
  });

  it("euro_jour : ceil(8/7)=2 jours", () => {
    const result = computeVentilationDossier({
      unite: "euro_jour",
      montantCents: 5000,
      dureeHeures: 8,
      nbParticipants: 3,
    });
    // 2 j × 5000 = 10 000 par participant × 3 = 30 000
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(10_000);
    expect(result.totalHtCents).toBe(30_000);
  });

  // ── euro_formation ─────────────────────────────────────────────────────────

  it("euro_formation : total = nbParticipants × montantCents", () => {
    const result = computeVentilationDossier({
      unite: "euro_formation",
      montantCents: 60_000, // 600 €/formation
      dureeHeures: 14,
      nbParticipants: 4,
    });
    expect(result.totalHtCents).toBe(240_000);
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(60_000);
  });

  // ── euro_an_salarie ────────────────────────────────────────────────────────

  it("euro_an_salarie : total = nbParticipants × montantCents", () => {
    const result = computeVentilationDossier({
      unite: "euro_an_salarie",
      montantCents: 100_000, // 1000 €/an/salarié
      dureeHeures: 21,
      nbParticipants: 3,
    });
    expect(result.totalHtCents).toBe(300_000);
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(100_000);
  });

  // ── Plafonds ───────────────────────────────────────────────────────────────

  it("plafondFormationCents : plafonne le coût par participant si brut > plafond", () => {
    // 7h × 4000 cts/h = 28 000 par participant ; plafond = 20 000
    const result = computeVentilationDossier({
      unite: "euro_heure",
      montantCents: 4000,
      dureeHeures: 7,
      nbParticipants: 5,
      plafondFormationCents: 20_000,
    });
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(20_000);
    expect(result.totalHtCents).toBe(100_000); // 20 000 × 5
  });

  it("plafondFormationCents : pas d'impact si brut <= plafond", () => {
    const result = computeVentilationDossier({
      unite: "euro_heure",
      montantCents: 4000,
      dureeHeures: 7,
      nbParticipants: 5,
      plafondFormationCents: 50_000, // plafond supérieur au brut → pas de cap
    });
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(28_000);
  });

  it("plafondAnnuelCents : plafonne si brut > plafond annuel", () => {
    const result = computeVentilationDossier({
      unite: "euro_an_salarie",
      montantCents: 150_000, // 1500 €
      dureeHeures: 7,
      nbParticipants: 2,
      plafondAnnuelCents: 100_000,
    });
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(100_000);
    expect(result.totalHtCents).toBe(200_000);
  });

  it("plafond annuel < plafond formation → plafond annuel s'applique (le plus restrictif)", () => {
    // brut = 7h × 4000 = 28 000 ; plafondFormation=25 000 ; plafondAnnuel=15 000
    const result = computeVentilationDossier({
      unite: "euro_heure",
      montantCents: 4000,
      dureeHeures: 7,
      nbParticipants: 3,
      plafondFormationCents: 25_000,
      plafondAnnuelCents: 15_000,
    });
    expect(result.lignes[0]!.prixUnitaireHtCents).toBe(15_000);
    expect(result.totalHtCents).toBe(45_000);
  });

  it("désignation mentionne 'plafonné' si plafond actif", () => {
    const result = computeVentilationDossier({
      unite: "euro_heure",
      montantCents: 4000,
      dureeHeures: 7,
      nbParticipants: 2,
      plafondFormationCents: 10_000,
    });
    expect(result.lignes[0]!.designation).toContain("plafonné");
  });

  it("désignation ne mentionne pas 'plafonné' si pas de cap", () => {
    const result = computeVentilationDossier({
      unite: "euro_formation",
      montantCents: 50_000,
      dureeHeures: 7,
      nbParticipants: 1,
    });
    expect(result.lignes[0]!.designation).not.toContain("plafonné");
  });

  it("totalHtCents = lignes[0].quantite × lignes[0].prixUnitaireHtCents", () => {
    const result = computeVentilationDossier({
      unite: "euro_heure",
      montantCents: 2500,
      dureeHeures: 4,
      nbParticipants: 6,
    });
    const sumLignes = result.lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaireHtCents, 0);
    expect(result.totalHtCents).toBe(sumLignes);
  });
});
