// @vitest-environment node

/**
 * Relecture argent de L12c/L12e et L12d…m — petits défauts, règles pures.
 *
 *   · couper la bascule APRÈS des paiements par mission ne fait pas repayer ces
 *     sessions par le relevé mensuel : une revendication `par_mission` écarte le
 *     couple même sans date ; sans revendication, rien ne change ;
 *   · une session déjà revendiquée par mission reste au passage, même si une
 *     journée ajoutée après coup tombe avant la bascule.
 */

import { describe, expect, it } from "vitest";

import { cleRevendication, filtrerPrestationsApresBascule } from "../apres-bascule";
import { planifierPassage, type CandidatMission } from "../passage-mission";

const statutParTrainer = new Map([
  ["ind", "sous_traitant"],
  ["sal", "salarie"],
]);
const prestations = [
  { sessionId: "s1", affectations: [{ trainerId: "ind" }, { trainerId: "sal" }] },
  { sessionId: "s2", affectations: [{ trainerId: "ind" }] },
  { sessionId: null, affectations: [{ trainerId: "ind" }] },
];

describe("run mensuel — bascule coupée après des paiements par mission", () => {
  it("sans date, une revendication `par_mission` écarte le couple ; le reste est inchangé", () => {
    const r = filtrerPrestationsApresBascule(prestations, {
      dateBascule: null,
      statutParTrainer,
      revendications: new Map([[cleRevendication("ind", "s1"), "par_mission" as const]]),
      premiereJourneeParSession: new Map(),
    });
    expect(r).toEqual([
      { sessionId: "s1", affectations: [{ trainerId: "sal" }] },
      prestations[1],
      prestations[2],
    ]);
  });

  it("sans date et sans revendication `par_mission` : les prestations telles quelles", () => {
    expect(
      filtrerPrestationsApresBascule(prestations, {
        dateBascule: null,
        statutParTrainer,
        revendications: new Map([[cleRevendication("ind", "s1"), "releve_mensuel" as const]]),
        premiereJourneeParSession: new Map(),
      }),
    ).toEqual(prestations);
  });
});

describe("passage — journée ajoutée avant la bascule sur une session déjà revendiquée", () => {
  const C: CandidatMission = {
    trainerId: "t1",
    sessionId: "s1",
    premiereJournee: "2026-11-30",
    conditions: {
      tarifJourneeHtCents: 35_000,
      forfaitDeplacementParJourHtCents: null,
      regimeTva: "franchise_293b",
    },
    contresignatures: [{ jour: "2026-12-03", demiJournee: "journee" }],
    journeesPrevues: [{ jour: "2026-12-03", heureDebut: "09:00", heureFin: "17:00" }],
    conditionFinanceurEnAttente: false,
  };

  it("non revendiquée : la première journée avant la bascule l'écarte (inchangé)", () => {
    expect(planifierPassage([C], "2026-12-01").aEcrire).toHaveLength(0);
  });

  it("revendiquée `par_mission` : le passage la garde, décembre est écrit (350 €)", () => {
    const p = planifierPassage([{ ...C, revendiqueParMission: true }], "2026-12-01");
    expect(p.aEcrire.map((m) => [m.releve.mois, m.releve.totalHtCents])).toEqual([
      ["2026-12", 35_000],
    ]);
  });
});
