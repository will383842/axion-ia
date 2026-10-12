// @vitest-environment node

/**
 * Lot D2 (M22) — les anomalies du passage sont CONSERVÉES sur le relevé de
 * mission et le relevé reste « à valider » (validation humaine gardée) :
 *   · écart avec la part prévue du mois : « prévu X c HT, calculé Y c HT » ;
 *   · demi-journées signées après l'écriture : une anomalie, une seule fois ;
 *   · sans écart : aucune anomalie, toujours « à valider ».
 * Contre-calcul du prévu : 4 demi-journées × 30 000 + 2 jours × 5 000 = 130 000 HT.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/remuneration/verrou-remuneration", () => ({
  prendreVerrousRemuneration: vi.fn(),
}));

import { montantPrevuDuMoisHtCents } from "../../argent/calcul-mission";
import { ecrireMoisDansTransaction } from "../passage-mission-base";
import type { MoisAEcrire } from "../passage-mission";

const T = "22222222-2222-4222-8222-222222222222";
const S = "33333333-3333-4333-8333-333333333333";
const R = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MAINTENANT = new Date("2026-11-20T09:00:00Z");

function mois(over: Partial<MoisAEcrire> = {}): MoisAEcrire {
  return {
    trainerId: T,
    sessionId: S,
    regimeTva: "assujetti_20",
    tarifJourneeHtCents: 60_000,
    sansEcart: false,
    prevuHtCents: 130_000,
    releve: {
      mois: "2026-11",
      lignes: [{ objet: "animation", montantHtCents: 60_000, demiJournees: 2 }],
      totalHtCents: 60_000,
      tvaCents: 12_000,
      totalTtcCents: 72_000,
      echeance: "2026-12-17",
      derniereJournee: "2026-11-17",
      mentionTva: "",
    } as unknown as MoisAEcrire["releve"],
    ...over,
  };
}

let existant: { id: string } | null;
let anomalies: unknown;
const tx = {
  $executeRawUnsafe: vi.fn(),
  activityLog: { create: vi.fn() },
  revendicationPaiement: { findUnique: vi.fn(async () => ({ regime: "par_mission" })) },
  trainerFeeLine: {
    count: vi.fn(async () => 0),
    createMany: vi.fn(),
    aggregate: vi.fn(async () => ({ _sum: { demiJournees: 2 } })),
  },
  trainerStatement: {
    findFirst: vi.fn(async () => existant),
    count: vi.fn(async () => 0),
    create: vi.fn(async (_a: { data: Record<string, unknown> }) => ({ id: R })),
    findUnique: vi.fn(async (a: { select: Record<string, unknown> }) =>
      "anomaliesMission" in a.select
        ? { anomaliesMission: anomalies }
        : { statut: "valide", echeanceAt: null, tvaRegime: "assujetti_20", feeLines: [] },
    ),
    update: vi.fn(async (a: { data: { anomaliesMission?: unknown } }) => {
      anomalies = a.data.anomaliesMission;
    }),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  existant = null;
  anomalies = null;
});

describe("montantPrevuDuMoisHtCents — une seule formule pour l'écart", () => {
  it("4 demi-journées à 600 €/j + 2 jours de déplacement à 50 € = 130 000 c HT", () => {
    expect(
      montantPrevuDuMoisHtCents(
        { demiJournees: 4, journees: 2 },
        {
          tarifJourneeHtCents: 60_000,
          forfaitDeplacementParJourHtCents: 5_000,
          regimeTva: "assujetti_20",
        },
      ),
    ).toBe(130_000);
  });
});

describe("passage — anomalies conservées sur le relevé", () => {
  it("écart avec le prévu : le relevé « à valider » porte l'anomalie chiffrée", async () => {
    expect(await ecrireMoisDansTransaction(tx as never, mois(), MAINTENANT)).toBe("ecrit");
    const data = tx.trainerStatement.create.mock.calls[0]![0].data;
    expect(data.statut).toBe("a_valider");
    expect(data.anomaliesMission).toEqual([
      {
        code: "ecart_prevu",
        detail: "prévu 130000 c HT, calculé 60000 c HT",
        constateLe: "2026-11-20",
      },
    ]);
  });

  it("sans écart : aucune anomalie, toujours « à valider »", async () => {
    await ecrireMoisDansTransaction(tx as never, mois({ sansEcart: true }), MAINTENANT);
    const data = tx.trainerStatement.create.mock.calls[0]![0].data;
    expect(data.statut).toBe("a_valider");
    expect(data).not.toHaveProperty("anomaliesMission");
  });

  it("demi-journées signées après l'écriture : une anomalie, conservée une seule fois", async () => {
    existant = { id: R };
    const plus = mois({
      releve: {
        ...mois().releve,
        lignes: [{ objet: "animation", montantHtCents: 120_000, demiJournees: 4 }],
      },
    });
    expect(await ecrireMoisDansTransaction(tx as never, plus, MAINTENANT)).toBe(
      "complement_a_traiter",
    );
    expect(anomalies).toEqual([
      {
        code: "complement_signe",
        detail: "4 demi-journée(s) signée(s), 2 payée(s)",
        constateLe: "2026-11-20",
      },
    ]);
    // Le passage du lendemain la constate de nouveau : rien n'est réécrit.
    await ecrireMoisDansTransaction(tx as never, plus, new Date("2026-11-21T09:00:00Z"));
    expect(tx.trainerStatement.update).toHaveBeenCalledTimes(1);
  });
});
