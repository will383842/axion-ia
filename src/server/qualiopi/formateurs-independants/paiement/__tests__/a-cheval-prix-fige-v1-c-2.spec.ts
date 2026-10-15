// @vitest-environment node

/**
 * Vérification 1, défaut V1-C-2 — une session À CHEVAL sur la bascule (première
 * journée avant `D`, une journée à `D` ou après) dont la mission a été ACCEPTÉE À PRIX
 * FIGÉ est payée par le PASSAGE, au prix figé, une seule fois. Le relevé mensuel ne la
 * paie jamais (correctif L11b) : avant ce correctif, personne ne la payait.
 *
 * Exemple (E26) : 28/09, 29/09, 05/10/2037, 9 h – 17 h, 350 €/jour, D = 01/10/2037.
 * Contre-calcul indépendant en centimes : 6 demi-journées × 17 500 c = 105 000 c
 * (1 050 €), jamais 1 400 € ; septembre 4 × 17 500 = 70 000 c, octobre 2 × 17 500 =
 * 35 000 c.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { aChevalSurLaBascule } from "../apres-bascule";
import { appartientAuPassage, planifierPassage, type CandidatMission } from "../passage-mission";

const D = "2037-10-01";
const A_CHEVAL = ["2037-09-28", "2037-09-29", "2037-10-05"];
const TARIF = 35_000;
const DEMI = 17_500;

function candidat(over: Partial<CandidatMission> = {}): CandidatMission {
  return {
    trainerId: "t1",
    sessionId: "s1",
    premiereJournee: A_CHEVAL[0]!,
    derniereJourneeSession: A_CHEVAL[2]!,
    conditions: {
      tarifJourneeHtCents: TARIF,
      forfaitDeplacementParJourHtCents: null,
      regimeTva: "franchise_293b",
    },
    contresignatures: A_CHEVAL.map((jour) => ({ jour, demiJournee: "journee" as const })),
    journeesPrevues: A_CHEVAL.map((jour) => ({ jour, heureDebut: "09:00", heureFin: "17:00" })),
    conditionFinanceurEnAttente: false,
    ...over,
  };
}

describe("aChevalSurLaBascule (pur)", () => {
  it("première journée avant D, dernière à D ou après : à cheval", () => {
    expect(
      aChevalSurLaBascule({ premiereJournee: "2037-09-28", derniereJournee: "2037-10-05" }, D),
    ).toBe(true);
    expect(
      aChevalSurLaBascule({ premiereJournee: "2037-09-30", derniereJournee: "2037-10-01" }, D),
    ).toBe(true);
  });
  it("entièrement avant ou entièrement après : pas à cheval", () => {
    expect(
      aChevalSurLaBascule({ premiereJournee: "2037-09-01", derniereJournee: "2037-09-30" }, D),
    ).toBe(false);
    expect(
      aChevalSurLaBascule({ premiereJournee: "2037-10-01", derniereJournee: "2037-10-05" }, D),
    ).toBe(false);
    expect(aChevalSurLaBascule({ premiereJournee: "2037-09-28", derniereJournee: null }, D)).toBe(
      false,
    );
  });
});

describe("V1-C-2 — à cheval, mission à prix figé : le passage paie, au prix figé, une fois", () => {
  it("le passage écrit septembre et octobre : 70 000 c + 35 000 c = 105 000 c (1 050 €)", () => {
    const p = planifierPassage([candidat()], D, undefined, "2037-10-07");
    expect(p.anomalies).toEqual([]);
    expect(p.enAttente).toEqual([]);
    expect(p.aEcrire.map((m) => [m.releve.mois, m.releve.totalHtCents])).toEqual([
      ["2037-09", 4 * DEMI],
      ["2037-10", 2 * DEMI],
    ]);
    const total = p.aEcrire.reduce((t, m) => t + m.releve.totalHtCents, 0);
    expect(total).toBe(105_000);
    expect(total).not.toBe(140_000);
  });

  it("à cheval SANS prix figé : le passage n'y touche pas (le relevé mensuel paie)", () => {
    const p = planifierPassage([candidat({ conditions: null })], D, undefined, "2037-10-07");
    expect(p).toEqual({ aEcrire: [], enAttente: [], anomalies: [] });
  });

  it("entièrement avant la bascule, même à prix figé : jamais au passage", () => {
    const p = planifierPassage(
      [candidat({ derniereJourneeSession: "2037-09-29" })],
      D,
      undefined,
      "2037-10-07",
    );
    expect(p).toEqual({ aEcrire: [], enAttente: [], anomalies: [] });
  });

  it("appartientAuPassage : la règle partagée par le passage et la relance des feuilles", () => {
    expect(appartientAuPassage(candidat(), D)).toBe(true);
    expect(appartientAuPassage(candidat({ conditions: null }), D)).toBe(false);
    expect(appartientAuPassage(candidat({ premiereJournee: D }), D)).toBe(true);
    expect(appartientAuPassage(candidat({ conditions: null, revendiqueParMission: true }), D)).toBe(
      true,
    );
  });
});
