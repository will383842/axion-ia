/**
 * Lot S5 — lettre de mission v2 : ce qu'elle CALCULE (texte arrêté par Will le
 * 10/10/2026 : une lettre couvre 1 à N jours ; 350 € HT la journée, 175 € HT la
 * demi-journée ; paiement au plus tard dernière journée + 30 jours, avancé au
 * jour ouvré précédent ; un virement par mois de journées réalisées).
 *
 * Montants en CENTIMES entiers, jamais de flottant.
 */

import { describe, expect, it } from "vitest";

import {
  TARIF_DEMI_JOURNEE_HT_CENTS,
  TARIF_JOURNEE_HT_CENTS,
  decompterJournees,
  demiJourneesDuJour,
  echeancePaiement,
  echeancesParMois,
  honorairesLettre,
  mentionTvaLettre,
} from "../lettre-mission-v2-calcul";

const jour = (date: string, heureDebut = "09:00", heureFin = "17:00") => ({
  date,
  heureDebut,
  heureFin,
});

describe("tarifs arrêtés", () => {
  it("350 € HT la journée, 175 € HT la demi-journée, en centimes", () => {
    expect(TARIF_JOURNEE_HT_CENTS).toBe(35_000);
    expect(TARIF_DEMI_JOURNEE_HT_CENTS).toBe(17_500);
  });
});

describe("journées et demi-journées", () => {
  it("une journée 9 h - 17 h compte 2 demi-journées ; un matin ou un après-midi, 1", () => {
    expect(demiJourneesDuJour(jour("2026-11-04"))).toBe(2);
    expect(demiJourneesDuJour(jour("2026-11-04", "09:00", "12:30"))).toBe(1);
    expect(demiJourneesDuJour(jour("2026-11-04", "14:00", "17:30"))).toBe(1);
  });

  it("une lettre couvre 1 à N jours, consécutifs ou non", () => {
    expect(
      decompterJournees([
        jour("2026-11-04"),
        jour("2026-11-05", "09:00", "12:30"),
        jour("2026-12-10"),
      ]),
    ).toEqual({ journees: 2, demiJournees: 1 });
    expect(decompterJournees([jour("2026-11-04")])).toEqual({ journees: 1, demiJournees: 0 });
  });
});

describe("honoraires", () => {
  it("4 journées = 1 400 € HT ; forfait de déplacement par journée de déplacement", () => {
    const h = honorairesLettre({
      jours: [jour("2026-11-04"), jour("2026-11-05"), jour("2026-11-06"), jour("2026-11-07")],
      tarifJourneeHtCents: 35_000,
      forfaitDeplacementParJourHtCents: 8_000,
      joursDeplacement: 2,
    });
    expect(h).toEqual({
      journees: 4,
      demiJournees: 0,
      honorairesHtCents: 140_000,
      deplacementHtCents: 16_000,
      totalHtCents: 156_000,
    });
  });

  it("la demi-journée vaut la moitié du tarif de la journée, sans forfait = « compris »", () => {
    const h = honorairesLettre({
      jours: [jour("2026-11-04"), jour("2026-11-05", "09:00", "12:30")],
      tarifJourneeHtCents: 35_000,
      forfaitDeplacementParJourHtCents: null,
      joursDeplacement: 0,
    });
    expect(h.honorairesHtCents).toBe(52_500);
    expect(h.deplacementHtCents).toBe(0);
    expect(Number.isInteger(h.totalHtCents)).toBe(true);
  });

  it("refuse un tarif qui n'est pas un nombre entier de centimes", () => {
    expect(() =>
      honorairesLettre({
        jours: [jour("2026-11-04")],
        tarifJourneeHtCents: 350.5,
        forfaitDeplacementParJourHtCents: null,
        joursDeplacement: 0,
      }),
    ).toThrow();
  });
});

describe("échéance de paiement : dernière journée + 30 jours, jour ouvré précédent", () => {
  it("un jour ouvré reste tel quel", () => {
    // 04/11/2026 + 30 j = 04/12/2026, un vendredi.
    expect(echeancePaiement("2026-11-04")).toBe("2026-12-04");
  });

  it("un samedi recule au vendredi", () => {
    // 07/11/2026 + 30 j = 07/12/2026 lundi ; 06/11 + 30 = 06/12 dimanche → vendredi 04/12.
    expect(echeancePaiement("2026-11-06")).toBe("2026-12-04");
  });

  it("un jour férié recule aussi (25/12 → 24/12)", () => {
    // 25/11/2026 + 30 j = 25/12/2026, Noël (vendredi) → jeudi 24/12.
    expect(echeancePaiement("2026-11-25")).toBe("2026-12-24");
  });

  it("plusieurs mois : un virement par mois de journées réalisées", () => {
    expect(echeancesParMois([jour("2026-11-04"), jour("2026-11-20"), jour("2026-12-10")])).toEqual([
      { mois: "2026-11", echeance: echeancePaiement("2026-11-20") },
      { mois: "2026-12", echeance: echeancePaiement("2026-12-10") },
    ]);
  });
});

describe("mention de TVA", () => {
  it("les trois régimes, mots exacts du texte arrêté", () => {
    expect(mentionTvaLettre("franchise_293b", 140_000)).toBe(
      "TVA non applicable, art. 293 B du CGI",
    );
    expect(mentionTvaLettre("exonere_formation", 140_000)).toBe(
      "Exonération de TVA, art. 261-4-4° a du CGI",
    );
    expect(mentionTvaLettre("assujetti_20", 140_000)).toBe("TVA 20 % : 280,00 €");
  });
});
