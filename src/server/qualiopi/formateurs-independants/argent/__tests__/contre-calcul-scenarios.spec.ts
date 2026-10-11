// @vitest-environment node

/**
 * CONTRE-CALCUL DES SCÉNARIOS DE LA RELECTURE ARGENT (L15b).
 *
 * Les montants et dates ATTENDUS sont recopiés de la relecture argent, calculés
 * À LA MAIN à partir des seules règles écrites (contrat-cadre v3 arrêté). Ils ne
 * sont jamais dérivés du code testé. Là où la relecture listait plusieurs
 * lectures (⚠), le contrat v3 a tranché et la valeur retenue est celle du contrat
 * (art. 9.2 : demi-journée signée ; 10.2 : une demi-journée hors département =
 * une journée de déplacement ; 11.1 et 11.3 : 50 % des journées annulées, hors
 * forfait, dû dès l'acceptation).
 *
 * Les scénarios qui relèvent de la base (S18 double passage, S19 revendication)
 * sont prouvés par `tests/integration/formateurs-paiement/` ; ceux d'un moteur
 * (S05 co-animation, S14b, S20b) par les lots qui les portent.
 */

import { describe, expect, it } from "vitest";

import {
  demiJourneesSignees,
  parMoisCivil,
  type ContresignatureLue,
} from "@/server/qualiopi/remuneration/heures-animees";

import {
  avoirDe,
  calculerReleveDuMois,
  calculerReleveOrganisme,
  indemniteAnnulation,
  nouvelIbanUtilisableDes,
  planTropPercu,
  presentationMethode,
  retardDePaiement,
  totaliser,
  type ConditionsMission,
} from "../calcul-mission";
import { dateCibleVirement, echeanceLegale } from "../dates";
import { PARAMETRES_ARGENT_FORMATEURS } from "../parametres";

const FRANCHISE: ConditionsMission = {
  tarifJourneeHtCents: 35_000,
  forfaitDeplacementParJourHtCents: null,
  regimeTva: "franchise_293b",
};

const sig = (jour: string, demiJournee: ContresignatureLue["demiJournee"]): ContresignatureLue => ({
  jour,
  demiJournee,
});

function moisUnique(cs: ContresignatureLue[]) {
  const m = parMoisCivil(demiJourneesSignees(cs));
  expect(m).toHaveLength(1);
  return m[0]!;
}

describe("contre-calcul — journée, demi-journée, durée", () => {
  it("S01 journée 7 h : 350,00 HT, TVA 0, échéance sam. 05/12, virement ven. 04/12", () => {
    const r = calculerReleveDuMois(moisUnique([sig("2026-11-05", "journee")]), FRANCHISE);
    expect([r.totalHtCents, r.tvaCents, r.totalTtcCents]).toEqual([35_000, 0, 35_000]);
    expect([r.echeance, r.dateCible]).toEqual(["2026-12-05", "2026-12-04"]);
    expect(r.mentionTva).toMatch(/293 B/);
  });

  it("S02 demi-journée 3 h 30 : 175,00", () => {
    const r = calculerReleveDuMois(moisUnique([sig("2026-11-05", "matin")]), FRANCHISE);
    expect(r.totalHtCents).toBe(17_500);
  });

  it("S03 / S03b / S04 : deux feuilles signées = 350,00, quelle que soit la durée (5 h, 4 h 30, 8 h)", () => {
    for (const cs of [
      [sig("2026-11-05", "matin"), sig("2026-11-05", "apres_midi")],
      [sig("2026-11-05", "journee")],
    ]) {
      expect(calculerReleveDuMois(moisUnique(cs), FRANCHISE).totalHtCents).toBe(35_000);
    }
  });

  it("une même demi-journée signée deux fois, ou révoquée, ne se paie pas deux fois", () => {
    const m = moisUnique([
      sig("2026-11-05", "journee"),
      sig("2026-11-05", "matin"),
      { jour: "2026-11-06", demiJournee: "matin", revoquee: true },
    ]);
    expect(calculerReleveDuMois(m, FRANCHISE).totalHtCents).toBe(35_000);
  });

  it("S06 remplaçant d'un jour : R payé sur SES signatures, 350,00, échéance 04/12", () => {
    const r = calculerReleveDuMois(moisUnique([sig("2026-11-04", "journee")]), FRANCHISE);
    expect([r.totalHtCents, r.echeance, r.dateCible]).toEqual([35_000, "2026-12-04", "2026-12-04"]);
  });
});

describe("contre-calcul — session sur plusieurs mois", () => {
  it("S07 : octobre 350 (éch. 25/11), novembre 700 (23/12), décembre 700 (13/01/2027) ; total = lettre 1 750", () => {
    const mois = parMoisCivil(
      demiJourneesSignees(
        ["2026-10-26", "2026-11-09", "2026-11-23", "2026-12-07", "2026-12-14"].map((j) =>
          sig(j, "journee"),
        ),
      ),
    );
    const r = mois.map((m) => calculerReleveDuMois(m, FRANCHISE));
    expect(r.map((x) => [x.mois, x.totalHtCents, x.echeance])).toEqual([
      ["2026-10", 35_000, "2026-11-25"],
      ["2026-11", 70_000, "2026-12-23"],
      ["2026-12", 70_000, "2027-01-13"],
    ]);
    expect(r.reduce((s, x) => s + x.totalHtCents, 0)).toBe(175_000);
  });

  it("S10c : forfait 120 €/journée sur la session de 3 mois = 600 € une seule fois au total", () => {
    const c = { ...FRANCHISE, forfaitDeplacementParJourHtCents: 12_000 };
    const mois = parMoisCivil(
      demiJourneesSignees(
        ["2026-10-26", "2026-11-09", "2026-11-23", "2026-12-07", "2026-12-14"].map((j) =>
          sig(j, "journee"),
        ),
      ),
    );
    const deplacement = mois
      .map((m) => calculerReleveDuMois(m, c))
      .flatMap((r) => r.lignes.filter((l) => l.objet === "deplacement"))
      .reduce((s, l) => s + l.montantHtCents, 0);
    expect(deplacement).toBe(60_000);
  });
});

describe("contre-calcul — déplacement et TVA", () => {
  it("S10 Lyon → Grenoble, 2 jours, forfait 120 €/j, assujetti : 940,00 HT / 188,00 / 1 128,00 ; éch. dim. 13/12 → ven. 11/12", () => {
    const r = calculerReleveDuMois(
      moisUnique([sig("2026-11-12", "journee"), sig("2026-11-13", "journee")]),
      {
        tarifJourneeHtCents: 35_000,
        forfaitDeplacementParJourHtCents: 12_000,
        regimeTva: "assujetti_20",
      },
    );
    expect([r.totalHtCents, r.tvaCents, r.totalTtcCents]).toEqual([94_000, 18_800, 112_800]);
    expect([r.echeance, r.dateCible]).toEqual(["2026-12-13", "2026-12-11"]);
    expect(r.lignes.map((l) => [l.objet, l.montantHtCents])).toEqual([
      ["animation", 70_000],
      ["deplacement", 24_000],
    ]);
  });

  it("S10b demi-journée hors département : une journée de déplacement, forfait plein (150,00)", () => {
    const r = calculerReleveDuMois(moisUnique([sig("2026-11-05", "matin")]), {
      ...FRANCHISE,
      forfaitDeplacementParJourHtCents: 15_000,
    });
    expect(r.totalHtCents).toBe(17_500 + 15_000);
  });

  it("un forfait au-dessus du plafond de 150 € par journée est refusé", () => {
    expect(() =>
      calculerReleveDuMois(moisUnique([sig("2026-11-05", "journee")]), {
        ...FRANCHISE,
        forfaitDeplacementParJourHtCents: 15_001,
      }),
    ).toThrow(/plafond/);
  });

  it("S11 franchise : 700,00 TTC, mention 293 B ; S12 exonéré : 700,00, mention 261-4-4° a", () => {
    const m = moisUnique([sig("2026-11-05", "journee"), sig("2026-11-06", "journee")]);
    const f = calculerReleveDuMois(m, FRANCHISE);
    expect([f.totalTtcCents, f.mentionTva]).toEqual([70_000, expect.stringMatching(/293 B/)]);
    const e = calculerReleveDuMois(m, { ...FRANCHISE, regimeTva: "exonere_formation" });
    expect([e.totalTtcCents, e.mentionTva]).toEqual([70_000, expect.stringMatching(/261/)]);
  });

  it("S11b régime FIGÉ à la lettre (franchise) : 700,00 TTC même si la fiche est passée à 20 %", () => {
    const r = calculerReleveDuMois(
      moisUnique([sig("2026-11-05", "journee"), sig("2026-11-06", "journee")]),
      FRANCHISE, // le moteur passe `MissionFormateur.regimeTvaFige`, jamais la fiche
    );
    expect(r.totalTtcCents).toBe(70_000);
  });

  it("S13 assujetti, 3 jours + forfait 47,33 €/j : 1 191,99 HT, TVA 238,40 (sur le total), TTC 1 430,39", () => {
    const r = calculerReleveDuMois(
      moisUnique(["2026-11-03", "2026-11-04", "2026-11-05"].map((j) => sig(j, "journee"))),
      {
        tarifJourneeHtCents: 35_000,
        forfaitDeplacementParJourHtCents: 4_733,
        regimeTva: "assujetti_20",
      },
    );
    expect([r.totalHtCents, r.tvaCents, r.totalTtcCents]).toEqual([119_199, 23_840, 143_039]);
  });

  it("tarif impair : deux demi-journées font toujours le tarif exact (reliquat sur la seconde)", () => {
    const c = { ...FRANCHISE, tarifJourneeHtCents: 35_001 };
    expect(calculerReleveDuMois(moisUnique([sig("2026-11-05", "matin")]), c).totalHtCents).toBe(
      17_500,
    );
    expect(calculerReleveDuMois(moisUnique([sig("2026-11-05", "journee")]), c).totalHtCents).toBe(
      35_001,
    );
  });
});

describe("contre-calcul — annulation", () => {
  const base = { tarifJourneeHtCents: 35_000, accepteeAvant: true, parAxion: true } as const;

  it("S08 annulation par Axion à 48 h (2 jours) : 350,00 (50 %, hors forfait), échéance 10/12", () => {
    const i = indemniteAnnulation({
      ...base,
      annuleeA: new Date("2026-11-10T08:00:00Z"), // 09 h à Paris
      debutPremiereAnnulee: new Date("2026-11-12T08:00:00Z"),
      demiJourneesAnnulees: 4,
    });
    expect([i.due, i.montantHtCents, i.echeance, i.dateCible]).toEqual([
      true,
      35_000,
      "2026-12-10",
      "2026-12-10",
    ]);
  });

  it("S08b accord donné, lettre non partie : 350,00 aussi (dû dès l'acceptation, art. 11.3)", () => {
    const i = indemniteAnnulation({
      ...base,
      annuleeA: new Date("2026-11-10T08:00:00Z"),
      debutPremiereAnnulee: new Date("2026-11-12T08:00:00Z"),
      demiJourneesAnnulees: 4,
    });
    expect(i.montantHtCents).toBe(35_000);
  });

  it("S09 annulation à 5 jours : 0", () => {
    const i = indemniteAnnulation({
      ...base,
      annuleeA: new Date("2026-11-07T08:00:00Z"),
      debutPremiereAnnulee: new Date("2026-11-12T08:00:00Z"),
      demiJourneesAnnulees: 4,
    });
    expect([i.due, i.montantHtCents]).toEqual([false, 0]);
  });

  it("à 72 h pile : rien (« moins de 72 heures ») ; désistement du formateur : rien", () => {
    const a = {
      ...base,
      annuleeA: new Date("2026-11-09T08:00:00Z"),
      debutPremiereAnnulee: new Date("2026-11-12T08:00:00Z"),
      demiJourneesAnnulees: 4,
    };
    expect(indemniteAnnulation(a).due).toBe(false);
    expect(
      indemniteAnnulation({ ...a, annuleeA: new Date("2026-11-10T08:00:00Z"), parAxion: false })
        .due,
    ).toBe(false);
  });

  it("S26 report refusé à 48 h : traité comme une annulation, 350,00", () => {
    const i = indemniteAnnulation({
      ...base,
      annuleeA: new Date("2026-11-10T08:00:00Z"),
      debutPremiereAnnulee: new Date("2026-11-12T08:00:00Z"),
      demiJourneesAnnulees: 4,
    });
    expect(i.montantHtCents).toBe(35_000);
  });

  it("S27 annulation partielle : 12/11 fait (350) + 13-14/11 annulés à 48 h (350) = 700,00 ; deux échéances", () => {
    const fait = calculerReleveDuMois(moisUnique([sig("2026-11-12", "journee")]), FRANCHISE);
    const i = indemniteAnnulation({
      ...base,
      annuleeA: new Date("2026-11-11T08:00:00Z"),
      debutPremiereAnnulee: new Date("2026-11-13T08:00:00Z"),
      demiJourneesAnnulees: 4,
    });
    expect(fait.totalHtCents + i.montantHtCents).toBe(70_000);
    expect([fait.echeance, fait.dateCible, i.echeance]).toEqual([
      "2026-12-12",
      "2026-12-11",
      "2026-12-11",
    ]);
  });
});

describe("contre-calcul — avoir, trop-perçu, contestation", () => {
  it("S15 contestation acceptée : avoir −700,00 puis réémission 875,00 (5 demi-journées)", () => {
    const initial = calculerReleveDuMois(
      moisUnique([sig("2026-11-05", "journee"), sig("2026-11-06", "journee")]),
      FRANCHISE,
    );
    const av = avoirDe(initial, initial.lignes);
    expect([av.totalHtCents, av.totalTtcCents]).toEqual([-70_000, -70_000]);
    const reemis = calculerReleveDuMois(
      moisUnique([
        sig("2026-11-05", "journee"),
        sig("2026-11-06", "journee"),
        sig("2026-11-04", "apres_midi"),
      ]),
      FRANCHISE,
    );
    expect(reemis.totalHtCents).toBe(87_500);
  });

  it("S16 avoir d'une pièce au mauvais régime : −840,00 TTC (TVA niée, jamais recalculée) puis 700,00", () => {
    const faux = totaliser([{ montantHtCents: 70_000 }], "assujetti_20");
    expect(avoirDe(faux, []).totalTtcCents).toBe(-84_000);
    expect(totaliser([{ montantHtCents: 70_000 }], "franchise_293b").totalTtcCents).toBe(70_000);
  });

  it("S15b trop-perçu de 175 sans relevé suivant : rien à J+59, remboursement demandé à J+60, une fois", () => {
    const avoir = {
      statementId: "a1",
      resteHtCents: 17_500,
      emisLe: "2026-12-01",
      remboursementDemande: false,
    };
    expect(planTropPercu([avoir], null, "2027-01-29").demandesRemboursement).toEqual([]);
    expect(planTropPercu([avoir], null, "2027-01-30").demandesRemboursement).toEqual(["a1"]);
    expect(
      planTropPercu([{ ...avoir, remboursementDemande: true }], null, "2027-03-01")
        .demandesRemboursement,
    ).toEqual([]);
  });

  it("trop-perçu imputé sur le relevé suivant, sans jamais le rendre négatif", () => {
    const p = planTropPercu(
      [
        {
          statementId: "a1",
          resteHtCents: 50_000,
          emisLe: "2026-12-01",
          remboursementDemande: false,
        },
      ],
      { totalHtCents: 35_000 },
      "2026-12-10",
    );
    expect(p.imputations).toEqual([{ avoirId: "a1", montantHtCents: -35_000 }]);
    expect(p.demandesRemboursement).toEqual([]);
  });
});

describe("contre-calcul — virement, retard, IBAN", () => {
  it("S14 vigilance périmée, virement le 10/12 pour une échéance au 05/12 : 5 jours, 40 € ; pénalités à la main tant que le taux BCE manque", () => {
    const r = retardDePaiement({
      totalTtcCents: 35_000,
      echeance: "2026-12-05",
      payeLe: "2026-12-10",
    });
    expect(r).toEqual({
      joursDeRetard: 5,
      penalitesCents: null,
      indemniteRecouvrementCents: 4_000,
    });
    // Avec un taux BCE de 2,15 % : 350 × 12,15 % × 5 / 365 = 0,5825 € → 0,58 €.
    const avecTaux = retardDePaiement(
      { totalTtcCents: 35_000, echeance: "2026-12-05", payeLe: "2026-12-10" },
      { ...PARAMETRES_ARGENT_FORMATEURS, tauxBceBp: 215 },
    );
    expect(avecTaux.penalitesCents).toBe(58);
    expect(
      retardDePaiement({ totalTtcCents: 35_000, echeance: "2026-12-05", payeLe: "2026-12-04" }),
    ).toEqual({
      joursDeRetard: 0,
      penalitesCents: 0,
      indemniteRecouvrementCents: 0,
    });
  });

  it("S17 changement d'IBAN demandé le 01/12, validé le 03/12 : nouveau compte utilisable le 03/12 (48 h ET accord)", () => {
    expect(
      nouvelIbanUtilisableDes({
        demandeA: new Date("2026-12-01T09:00:00Z"),
        valideA: new Date("2026-12-03T10:00:00Z"),
      })?.toISOString(),
    ).toBe("2026-12-03T10:00:00.000Z");
    // Validé tout de suite : le délai de 48 h tient.
    expect(
      nouvelIbanUtilisableDes({
        demandeA: new Date("2026-12-01T09:00:00Z"),
        valideA: new Date("2026-12-01T10:00:00Z"),
      })?.toISOString(),
    ).toBe("2026-12-03T09:00:00.000Z");
    expect(nouvelIbanUtilisableDes({ demandeA: new Date(), valideA: null })).toBeNull();
  });

  it("S20 fin de contrat, mission 25-26/11 : 700,00, éch. sam. 26/12 → jeu. 24/12 (25/12 férié)", () => {
    const r = calculerReleveDuMois(
      moisUnique([sig("2026-11-25", "journee"), sig("2026-11-26", "journee")]),
      FRANCHISE,
    );
    expect([r.totalHtCents, r.echeance, r.dateCible]).toEqual([70_000, "2026-12-26", "2026-12-24"]);
  });

  it("S21 organisme, deux intervenants × 2 jours, assujetti : 1 400 HT, 1 680 TTC, UNE fois, éch. 13/12", () => {
    const i1 = moisUnique([sig("2026-11-12", "journee"), sig("2026-11-13", "journee")]);
    const i2 = moisUnique([sig("2026-11-12", "journee"), sig("2026-11-13", "journee")]);
    const r = calculerReleveOrganisme([i1, i2], { ...FRANCHISE, regimeTva: "assujetti_20" });
    expect([r.totalHtCents, r.totalTtcCents, r.echeance]).toEqual([140_000, 168_000, "2026-12-13"]);
  });

  it("S22 présentation de la méthode le 20/11 : 175,00 HT, éch. dim. 20/12 → ven. 18/12", () => {
    const p = presentationMethode("2026-11-20", "assujetti_20");
    expect([p.totalHtCents, p.tvaCents, p.totalTtcCents, p.echeance, p.dateCible]).toEqual([
      17_500,
      3_500,
      21_000,
      "2026-12-20",
      "2026-12-18",
    ]);
  });

  it("S23 et S24 : l'échéance suit la DERNIÈRE JOURNÉE, jamais la facture reçue ni le clic tardif", () => {
    expect(echeanceLegale("2026-11-05")).toBe("2026-12-05");
    expect(dateCibleVirement(echeanceLegale("2026-11-05"))).toBe("2026-12-04");
  });
});
