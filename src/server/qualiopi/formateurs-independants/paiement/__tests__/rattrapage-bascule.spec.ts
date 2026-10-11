// @vitest-environment node

/**
 * L12e — rattrapage à l'allumage : tout le stock d'avant la bascule appartient
 * au relevé mensuel, liste nominative comparée avant / après.
 *
 *   · S19 : session 28/09, 29/09, 05/10, relevé de septembre en brouillon,
 *     bascule au 01/10 → revendiquée au mensuel, le passage s'abstient : 1 050 €
 *     une seule fois, jamais 1 400 € ;
 *   · S19b : journées des 22-23/09, AUCUN relevé encore, bascule au 01/10 → le
 *     couple est revendiqué quand même ; le run de septembre lancé APRÈS la
 *     bascule le garde : 700 € payés, jamais 0 ;
 *   · une session commencée à la bascule ou après n'est jamais revendiquée ici ;
 *   · un couple déjà revendiqué par mission avant la bascule est un CONFLIT, signalé.
 */

import { describe, expect, it, vi } from "vitest";

import { cleRevendication, filtrerPrestationsApresBascule } from "../apres-bascule";
import { planifierPassage } from "../passage-mission";
import { apercuRattrapage, inscrireRattrapage } from "../rattrapage-bascule";

const D = "2026-10-01";

describe("aperçu du rattrapage (pur)", () => {
  it("S19 et S19b revendiqués au mensuel ; une session d'après la bascule ignorée ; doublons fusionnés", () => {
    const a = apercuRattrapage(
      D,
      [
        { trainerId: "t1", sessionId: "s19", premiereJournee: "2026-09-28" },
        { trainerId: "t1", sessionId: "s19", premiereJournee: "2026-09-28" },
        { trainerId: "t2", sessionId: "s19b", premiereJournee: "2026-09-22" },
        { trainerId: "t3", sessionId: "apres", premiereJournee: "2026-10-01" },
      ],
      [],
    );
    expect(a.couples.map((c) => [c.trainerId, c.sessionId, c.regimeActuel])).toEqual([
      ["t2", "s19b", null],
      ["t1", "s19", null],
    ]);
    expect(a.aRevendiquer).toBe(2);
    expect(a.conflits).toEqual([]);
  });

  it("un couple d'avant la bascule déjà revendiqué PAR MISSION est un conflit à trancher", () => {
    const a = apercuRattrapage(
      D,
      [{ trainerId: "t1", sessionId: "s1", premiereJournee: "2026-09-10" }],
      [{ trainerId: "t1", sessionId: "s1", regime: "par_mission" }],
    );
    expect(a.aRevendiquer).toBe(0);
    expect(a.conflits.map((c) => c.sessionId)).toEqual(["s1"]);
  });

  it("n'inscrit que les couples sans revendication, en ajout seul", async () => {
    const db = { $executeRawUnsafe: vi.fn(async () => 1) };
    const a = apercuRattrapage(
      D,
      [
        { trainerId: "t1", sessionId: "s1", premiereJournee: "2026-09-10" },
        { trainerId: "t2", sessionId: "s2", premiereJournee: "2026-09-11" },
      ],
      [{ trainerId: "t2", sessionId: "s2", regime: "releve_mensuel" }],
    );
    expect(await inscrireRattrapage(db, a)).toBe(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(String((db.$executeRawUnsafe.mock.calls as unknown[][])[0]![0])).toMatch(
      /ON CONFLICT .* DO NOTHING/s,
    );
  });
});

describe("S19 / S19b de bout en bout (pur)", () => {
  it("S19b : après rattrapage, le run de septembre lancé après la bascule garde l'indépendant (700 €)", () => {
    const run = filtrerPrestationsApresBascule(
      [{ sessionId: "s19b", affectations: [{ trainerId: "t2" }] }],
      {
        dateBascule: D,
        statutParTrainer: new Map([["t2", "sous_traitant"]]),
        revendiqueesMensuel: new Set([cleRevendication("t2", "s19b")]),
      },
    );
    expect(run[0]!.affectations).toEqual([{ trainerId: "t2" }]);
  });

  it("S19 : le passage par mission ne touche jamais une session commencée avant la bascule", () => {
    const p = planifierPassage(
      [
        {
          trainerId: "t1",
          sessionId: "s19",
          premiereJournee: "2026-09-28",
          conditions: {
            tarifJourneeHtCents: 35_000,
            forfaitDeplacementParJourHtCents: null,
            regimeTva: "franchise_293b",
          },
          contresignatures: ["2026-09-28", "2026-09-29", "2026-10-05"].map((jour) => ({
            jour,
            demiJournee: "journee" as const,
          })),
          journeesPrevues: [],
          conditionFinanceurEnAttente: false,
        },
      ],
      D,
    );
    expect(p.aEcrire).toEqual([]);
  });
});
