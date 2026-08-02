/**
 * Tests — pénalités de retard (art. L.441-10 / D.441-5 C. com.).
 *
 * Le point sensible : ce chiffre finit dans un e-mail au client. Aucune entrée
 * ne doit pouvoir produire un NaN, un montant négatif ou une indemnité due sur
 * une facture qui n'est pas en retard.
 */

import { describe, it, expect } from "vitest";
import {
  calculerPenalitesRetard,
  INDEMNITE_FORFAITAIRE_RECOUVREMENT_CENTS,
  TAUX_PENALITES_ANNUEL_DEFAUT_PCT,
} from "./penalites";

const NOW = new Date("2026-08-02T12:00:00Z");
/** Échéance à J-100 par rapport à NOW. */
const ECHEANCE_J100 = new Date("2026-04-24T12:00:00Z");

describe("calculerPenalitesRetard — cas nominal", () => {
  it("intérêts au prorata quotidien + indemnité forfaitaire de 40 €", () => {
    const r = calculerPenalitesRetard({
      resteDuCents: 100_000, // 1 000,00 €
      echeanceAt: ECHEANCE_J100,
      now: NOW,
      tauxAnnuelPct: 12.15,
    });
    expect(r.joursRetard).toBe(100);
    // 100 000 × 0,1215 × 100 / 365 = 3 328,76… → floor = 3 328 centimes.
    expect(r.interetsCents).toBe(3_328);
    expect(r.indemniteForfaitaireCents).toBe(4_000);
    expect(r.totalCents).toBe(7_328);
  });

  it("l'indemnité forfaitaire vaut 40 € et ne se proratise JAMAIS", () => {
    const j1 = calculerPenalitesRetard({
      resteDuCents: 100_000,
      echeanceAt: new Date("2026-08-01T12:00:00Z"),
      now: NOW,
    });
    expect(j1.joursRetard).toBe(1);
    expect(j1.indemniteForfaitaireCents).toBe(INDEMNITE_FORFAITAIRE_RECOUVREMENT_CENTS);
    expect(j1.indemniteForfaitaireCents).toBe(4_000);
  });

  it("utilise le taux BCE + 10 points par défaut quand aucun taux n'est passé", () => {
    const avecDefaut = calculerPenalitesRetard({
      resteDuCents: 100_000,
      echeanceAt: ECHEANCE_J100,
      now: NOW,
    });
    const explicite = calculerPenalitesRetard({
      resteDuCents: 100_000,
      echeanceAt: ECHEANCE_J100,
      now: NOW,
      tauxAnnuelPct: TAUX_PENALITES_ANNUEL_DEFAUT_PCT,
    });
    expect(avecDefaut).toEqual(explicite);
  });

  it("arrondit les intérêts au centime INFÉRIEUR (on ne réclame jamais plus)", () => {
    const r = calculerPenalitesRetard({
      resteDuCents: 99_999,
      echeanceAt: ECHEANCE_J100,
      now: NOW,
      tauxAnnuelPct: 12.15,
    });
    expect(Number.isInteger(r.interetsCents)).toBe(true);
    expect(r.interetsCents).toBeLessThanOrEqual((99_999 * 0.1215 * 100) / 365);
  });
});

describe("calculerPenalitesRetard — rien n'est dû", () => {
  it("facture NON échue → tout à zéro, indemnité comprise", () => {
    const r = calculerPenalitesRetard({
      resteDuCents: 100_000,
      echeanceAt: new Date("2026-09-30T12:00:00Z"),
      now: NOW,
    });
    expect(r).toEqual({
      joursRetard: 0,
      interetsCents: 0,
      indemniteForfaitaireCents: 0,
      totalCents: 0,
    });
  });

  it("échéance le jour même (moins de 24 h) → aucun retard plein, rien dû", () => {
    const r = calculerPenalitesRetard({
      resteDuCents: 100_000,
      echeanceAt: new Date("2026-08-02T06:00:00Z"),
      now: NOW,
    });
    expect(r.totalCents).toBe(0);
  });

  it("échéance inconnue (null) → rien dû, aucun calcul deviné", () => {
    const r = calculerPenalitesRetard({ resteDuCents: 100_000, echeanceAt: null, now: NOW });
    expect(r.totalCents).toBe(0);
  });

  it("créance éteinte (reste dû nul ou négatif) → rien dû", () => {
    for (const montant of [0, -1, -100_000]) {
      const r = calculerPenalitesRetard({
        resteDuCents: montant,
        echeanceAt: ECHEANCE_J100,
        now: NOW,
      });
      expect(r.totalCents).toBe(0);
    }
  });
});

describe("calculerPenalitesRetard — robustesse (ce chiffre part au client)", () => {
  it("ne rend JAMAIS de NaN, quelle que soit l'entrée", () => {
    const entrees = [
      { resteDuCents: NaN, echeanceAt: ECHEANCE_J100, now: NOW },
      { resteDuCents: Infinity, echeanceAt: ECHEANCE_J100, now: NOW },
      { resteDuCents: 100_000, echeanceAt: new Date("date-invalide"), now: NOW },
      { resteDuCents: 100_000, echeanceAt: ECHEANCE_J100, now: new Date("date-invalide") },
      { resteDuCents: 100_000, echeanceAt: ECHEANCE_J100, now: NOW, tauxAnnuelPct: NaN },
      { resteDuCents: 100_000, echeanceAt: ECHEANCE_J100, now: NOW, tauxAnnuelPct: 0 },
      { resteDuCents: 100_000, echeanceAt: ECHEANCE_J100, now: NOW, tauxAnnuelPct: -5 },
    ];
    for (const e of entrees) {
      const r = calculerPenalitesRetard(e);
      expect(Number.isNaN(r.interetsCents)).toBe(false);
      expect(Number.isNaN(r.totalCents)).toBe(false);
      expect(r.totalCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("les montants restent des ENTIERS de centimes (jamais de flottant)", () => {
    const r = calculerPenalitesRetard({
      resteDuCents: 123_457,
      echeanceAt: ECHEANCE_J100,
      now: NOW,
    });
    expect(Number.isInteger(r.interetsCents)).toBe(true);
    expect(Number.isInteger(r.indemniteForfaitaireCents)).toBe(true);
    expect(Number.isInteger(r.totalCents)).toBe(true);
  });

  it("les intérêts croissent avec l'ancienneté du retard", () => {
    const j30 = calculerPenalitesRetard({
      resteDuCents: 100_000,
      echeanceAt: new Date("2026-07-03T12:00:00Z"),
      now: NOW,
    });
    const j100 = calculerPenalitesRetard({
      resteDuCents: 100_000,
      echeanceAt: ECHEANCE_J100,
      now: NOW,
    });
    expect(j100.interetsCents).toBeGreaterThan(j30.interetsCents);
  });
});
