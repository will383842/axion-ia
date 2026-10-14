// @vitest-environment node

/**
 * Lot D (M11) — de la mission annulée à l'indemnité : quelles demi-journées sont
 * annulées, quand commence la première, puis LE calcul existant
 * (`indemniteAnnulation`, `totaliser`). Contre-calcul chiffré HT / TVA / TTC.
 */

import { describe, expect, it } from "vitest";

import { instantParis } from "../../argent/dates";
import { apercuIndemniteAnnulation } from "../indemnite-annulation-decision";

const JOURS = [
  { jour: "2026-11-16", heureDebut: "09:00", heureFin: "17:00" },
  { jour: "2026-11-17", heureDebut: "09:00", heureFin: "12:30" },
];
const base = {
  journeesPrevues: JOURS,
  tarifJourneeHtCents: 60_000,
  accepteeAvant: true,
  parAxion: true,
  regimeTva: "assujetti_20" as const,
  contresignatures: [],
};

describe("instantParis", () => {
  it("heure de Paris → instant, été comme hiver", () => {
    expect(instantParis("2026-11-16", "09:00").toISOString()).toBe("2026-11-16T08:00:00.000Z");
    expect(instantParis("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });
});

describe("aperçu de l'indemnité d'annulation", () => {
  it("annulée 48 h avant : 3 demi-journées annulées, 50 % hors forfait ; assujetti", () => {
    const a = apercuIndemniteAnnulation({ ...base, annuleeA: new Date("2026-11-14T08:00:00Z") });
    // 3 demi-journées × 600 € / 2 = 900 € HT ; 50 % = 450 € HT.
    expect(a.demiJourneesAnnulees).toBe(3);
    expect(a.indemnite.due).toBe(true);
    expect(a.indemnite.montantHtCents).toBe(45_000);
    // Contre-calcul : TVA 20 % = 90 € ; TTC 540 €.
    expect(a.totaux.totalHtCents).toBe(45_000);
    expect(a.totaux.tvaCents).toBe(9_000);
    expect(a.totaux.totalTtcCents).toBe(54_000);
    expect(a.indemnite.jourAnnulation).toBe("2026-11-14");
    expect(a.indemnite.echeance).toBe("2026-12-14");
  });

  it("franchise en base : aucune TVA, TTC = HT", () => {
    const a = apercuIndemniteAnnulation({
      ...base,
      regimeTva: "franchise_293b",
      annuleeA: new Date("2026-11-14T08:00:00Z"),
    });
    expect([a.totaux.totalHtCents, a.totaux.tvaCents, a.totaux.totalTtcCents]).toEqual([
      45_000, 0, 45_000,
    ]);
  });

  it("annulée en cours de première journée (12 h 30) : seules l'après-midi et le lendemain comptent", () => {
    const a = apercuIndemniteAnnulation({ ...base, annuleeA: new Date("2026-11-16T11:30:00Z") });
    expect(a.demiJourneesAnnulees).toBe(2);
    // 2 × 600 / 2 = 600 € ; 50 % = 300 € HT ; TVA 60 € ; TTC 360 €.
    expect(a.totaux.totalHtCents).toBe(30_000);
    expect(a.totaux.totalTtcCents).toBe(36_000);
  });

  it("plus de 72 h avant, désistement du formateur, mission non acceptée : rien n'est dû", () => {
    expect(
      apercuIndemniteAnnulation({ ...base, annuleeA: new Date("2026-11-12T08:00:00Z") }).indemnite
        .due,
    ).toBe(false);
    expect(
      apercuIndemniteAnnulation({
        ...base,
        parAxion: false,
        annuleeA: new Date("2026-11-15T08:00:00Z"),
      }).indemnite.due,
    ).toBe(false);
    expect(
      apercuIndemniteAnnulation({
        ...base,
        accepteeAvant: false,
        annuleeA: new Date("2026-11-15T08:00:00Z"),
      }).totaux.totalHtCents,
    ).toBe(0);
  });

  it("annulée après la dernière journée : aucune demi-journée annulée, rien n'est dû", () => {
    const a = apercuIndemniteAnnulation({ ...base, annuleeA: new Date("2026-11-18T08:00:00Z") });
    expect(a.demiJourneesAnnulees).toBe(0);
    expect(a.indemnite.due).toBe(false);
  });
});

describe("chantier C4 (défaut 2) — jamais deux fois la même demi-journée", () => {
  it("🔴 instant saisi AVANT une demi-journée contresignée : refus, rien n'est dû", () => {
    // Le 16 au matin a été animé ET signé : une annulation saisie le 14 la
    // compterait « annulée » et la paierait une seconde fois (50 %).
    const a = apercuIndemniteAnnulation({
      ...base,
      contresignatures: [{ jour: "2026-11-16", demiJournee: "matin" }],
      annuleeA: new Date("2026-11-14T08:00:00Z"),
    });
    expect(a.refus).toBe("instant_anterieur_a_une_signature");
    // Début de la dernière demi-journée signée : 16/11 09:00 Paris.
    expect(a.debutDerniereSignee?.toISOString()).toBe("2026-11-16T08:00:00.000Z");
    expect(a.demiJourneesAnnulees).toBe(0);
    expect(a.indemnite.due).toBe(false);
    expect([a.totaux.totalHtCents, a.totaux.tvaCents, a.totaux.totalTtcCents]).toEqual([0, 0, 0]);
  });

  it("une révoquée ne compte pas : le témoin passe comme sans signature", () => {
    const a = apercuIndemniteAnnulation({
      ...base,
      contresignatures: [{ jour: "2026-11-16", demiJournee: "journee", revoquee: true }],
      annuleeA: new Date("2026-11-14T08:00:00Z"),
    });
    expect(a.refus).toBeNull();
    expect(a.indemnite.montantHtCents).toBe(45_000);
  });

  it("annulée après la journée signée du 16 : seule la matinée du 17 compte, la signée est exclue", () => {
    // Le 16 entier signé ; annulation le 16 à 18 h (Paris) : reste le 17 au matin.
    const a = apercuIndemniteAnnulation({
      ...base,
      contresignatures: [{ jour: "2026-11-16", demiJournee: "journee" }],
      annuleeA: new Date("2026-11-16T17:00:00Z"),
    });
    expect(a.refus).toBeNull();
    expect(a.demiJourneesAnnulees).toBe(1);
    // Contre-calcul : 1 × 60 000 / 2 = 30 000 ; 50 % = 15 000 HT ; TVA 3 000 ; TTC 18 000.
    expect(a.totaux.totalHtCents).toBe(15_000);
    expect(a.totaux.tvaCents).toBe(3_000);
    expect(a.totaux.totalTtcCents).toBe(18_000);
  });

  it("une demi-journée signée n'est jamais comptée « annulée », même postérieure au découpage prévu", () => {
    // Le 17 au matin signé (journée courte) ; annulation le 17 à 10 h : signée après
    // son début, donc pas de refus — et elle n'est pas comptée.
    const a = apercuIndemniteAnnulation({
      ...base,
      contresignatures: [
        { jour: "2026-11-16", demiJournee: "journee" },
        { jour: "2026-11-17", demiJournee: "matin" },
      ],
      annuleeA: new Date("2026-11-17T09:00:00Z"),
    });
    expect(a.refus).toBeNull();
    expect(a.demiJourneesAnnulees).toBe(0);
    expect(a.indemnite.due).toBe(false);
  });
});
