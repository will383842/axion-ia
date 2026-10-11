// @vitest-environment node

/**
 * L12i — présentation de la méthode payée (E12c, décision 20), règle pure.
 *
 *   · 175 € HT, TVA du régime de la fiche (3 régimes), échéance = date + 30 jours ;
 *   · une seule par formateur ;
 *   · contrat-cadre non signé, date avant le contrat ou dans le futur : refus ;
 *   · seul un formateur indépendant en son nom (pas un salarié, pas l'intervenant
 *     d'un organisme, pas une fiche sans régime de TVA) est payé ainsi.
 */

import { describe, expect, it } from "vitest";

import { verdictPresentationMethode, type FaitsPresentation } from "../presentation-methode";

const base: FaitsPresentation = {
  statut: "sous_traitant",
  organismeSousTraitantId: null,
  regimeTva: "franchise_293b",
  contratSigneLe: "2026-11-02",
  contratVersion: 3,
  jour: "2026-11-20",
  aujourdhui: "2026-11-21",
  dejaPayee: false,
};

describe("L12i — présentation de la méthode", () => {
  it("S22 : faite le 20/11, franchise → 175,00 € HT = TTC, échéance 20/12, date cible 18/12 (20/12/2026 est un dimanche)", () => {
    const v = verdictPresentationMethode(base);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect([v.calcul.totalHtCents, v.calcul.tvaCents, v.calcul.totalTtcCents]).toEqual([
      17_500, 0, 17_500,
    ]);
    expect(v.calcul.echeance).toBe("2026-12-20");
    expect(v.calcul.dateCible).toBe("2026-12-18");
    expect(v.mois).toEqual({ year: 2026, month: 11 });
    expect(v.calcul.lignes).toEqual([
      { objet: "presentation_methode", demiJournees: 1, montantHtCents: 17_500 },
    ]);
  });

  it("assujetti : 175,00 HT + 35,00 TVA = 210,00 TTC ; exonération formation : 175,00 TTC", () => {
    const a = verdictPresentationMethode({ ...base, regimeTva: "assujetti_20" });
    const e = verdictPresentationMethode({ ...base, regimeTva: "exonere_formation" });
    expect(a.ok && [a.calcul.totalHtCents, a.calcul.tvaCents, a.calcul.totalTtcCents]).toEqual([
      17_500, 3_500, 21_000,
    ]);
    expect(e.ok && [e.calcul.totalHtCents, e.calcul.tvaCents, e.calcul.totalTtcCents]).toEqual([
      17_500, 0, 17_500,
    ]);
    // La mention vient de la source unique des mentions de TVA : trois mentions distinctes.
    const f = verdictPresentationMethode(base);
    const mentions = [a, e, f].map((v) => (v.ok ? v.calcul.mentionTva : ""));
    expect(new Set(mentions).size).toBe(3);
  });

  it("une seconde présentation est refusée", () => {
    expect(verdictPresentationMethode({ ...base, dejaPayee: true })).toEqual({
      ok: false,
      motif: "deja_payee",
    });
  });

  it("contrat-cadre non signé → refus ; présentation datée avant la signature → refus", () => {
    expect(verdictPresentationMethode({ ...base, contratSigneLe: null })).toEqual({
      ok: false,
      motif: "contrat_non_signe",
    });
    expect(verdictPresentationMethode({ ...base, jour: "2026-11-01" })).toEqual({
      ok: false,
      motif: "date_avant_contrat",
    });
    // Un contrat signé d'avant la version 3 ne prévoit pas la présentation payée.
    expect(verdictPresentationMethode({ ...base, contratVersion: 2 })).toEqual({
      ok: false,
      motif: "contrat_sans_presentation",
    });
    // Le jour même de la signature : permis.
    expect(verdictPresentationMethode({ ...base, jour: "2026-11-02" }).ok).toBe(true);
  });

  it("une présentation pas encore faite (date future) ou une date illisible → refus", () => {
    expect(verdictPresentationMethode({ ...base, jour: "2026-11-22" })).toEqual({
      ok: false,
      motif: "date_future",
    });
    expect(verdictPresentationMethode({ ...base, jour: "2026-11-21" }).ok).toBe(true);
    expect(verdictPresentationMethode({ ...base, jour: "20/11/2026" })).toEqual({
      ok: false,
      motif: "date_invalide",
    });
  });

  it("salarié, dirigeant, intervenant d'un organisme, régime de TVA absent → refus", () => {
    expect(verdictPresentationMethode({ ...base, statut: "salarie" })).toEqual({
      ok: false,
      motif: "pas_independant",
    });
    expect(verdictPresentationMethode({ ...base, statut: "dirigeant" })).toEqual({
      ok: false,
      motif: "pas_independant",
    });
    expect(
      verdictPresentationMethode({
        ...base,
        organismeSousTraitantId: "7d2f3a7e-1c4b-4a8e-9b51-2f0a6c3d9e11",
      }),
    ).toEqual({ ok: false, motif: "intervenant_d_organisme" });
    expect(verdictPresentationMethode({ ...base, regimeTva: null })).toEqual({
      ok: false,
      motif: "regime_tva_inconnu",
    });
  });

  it("présentation faite en fin de mois : rattachée au mois de la présentation, échéance le mois suivant", () => {
    const v = verdictPresentationMethode({ ...base, jour: "2026-11-30", aujourdhui: "2026-12-01" });
    expect(v.ok && v.mois).toEqual({ year: 2026, month: 11 });
    expect(v.ok && v.calcul.echeance).toBe("2026-12-30");
  });
});
