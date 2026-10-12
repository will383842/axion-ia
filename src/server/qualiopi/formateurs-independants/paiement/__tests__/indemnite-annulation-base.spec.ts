// @vitest-environment node

/**
 * Lot D (M11) — l'ÉCRITURE de l'indemnité d'annulation, sur décision de
 * l'administrateur : verrous de période (mois de l'annulation) puis du
 * formateur, puis `ecrireIndemniteAnnulation` (idempotente : « déjà écrite »).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const missionFindUnique = vi.fn();
const tx = { $executeRawUnsafe: vi.fn() };
const transaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
const ecrire = vi.fn();
const verrous = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    missionFormateur: { findUnique: (...a: unknown[]) => missionFindUnique(...a) },
    $transaction: (...a: unknown[]) => transaction(...(a as [never])),
  },
}));
vi.mock("../corrections-mission", () => ({
  ecrireIndemniteAnnulation: (...a: unknown[]) => ecrire(...a),
}));
vi.mock("@/server/qualiopi/remuneration/verrou-remuneration", () => ({
  prendreVerrousRemuneration: (...a: unknown[]) => verrous(...a),
  DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION: {},
}));
vi.mock("../../moteur-mission", () => ({ MOTIF_FERMEE_LETTRE_SIGNEE: "MOTIF" }));

import { ecrireIndemniteDecidee } from "../indemnite-annulation-base";

const M = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T = "22222222-2222-4222-8222-222222222222";
const S = "33333333-3333-4333-8333-333333333333";

function mission(over: Record<string, unknown> = {}) {
  return {
    id: M,
    trainerId: T,
    sessionId: S,
    tarifHtCents: 60_000,
    regimeTvaFige: "assujetti_20",
    lettreBlocageMotif: "MOTIF",
    session: {
      jours: [
        {
          date: new Date("2026-11-16T00:00:00Z"),
          heureDebut: "09:00",
          heureFin: "17:00",
          trainerId: null,
        },
        {
          date: new Date("2026-11-17T00:00:00Z"),
          heureDebut: "09:00",
          heureFin: "12:30",
          trainerId: T,
        },
        {
          date: new Date("2026-11-18T00:00:00Z"),
          heureDebut: "09:00",
          heureFin: "17:00",
          trainerId: "autre",
        },
      ],
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  missionFindUnique.mockResolvedValue(mission());
  ecrire.mockResolvedValue("ecrite");
  transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
});

const decision = { missionId: M, annuleeA: new Date("2026-11-14T08:00:00Z"), parAxion: true };

describe("ecrireIndemniteDecidee", () => {
  it("due : verrous du mois de l'annulation puis du formateur, puis écriture (contre-calcul 450 € HT)", async () => {
    expect(await ecrireIndemniteDecidee(decision)).toEqual({
      issue: "ecrite",
      montantHtCents: 45_000,
      totalTtcCents: 54_000,
    });
    expect(verrous).toHaveBeenCalledWith(tx, {
      periodes: [{ year: 2026, month: 11 }],
      trainerIds: [T],
    });
    const e = ecrire.mock.calls[0]![1];
    expect(e).toMatchObject({
      trainerId: T,
      sessionId: S,
      regimeTva: "assujetti_20",
      tarifJourneeHtCents: 60_000,
    });
    // Les journées d'un AUTRE formateur ne comptent pas (3 demi-journées, pas 5).
    expect(e.indemnite.montantHtCents).toBe(45_000);
  });

  it("montant vu à l'aperçu différent du montant recalculé : « aperçu périmé », aucune transaction", async () => {
    const r = await ecrireIndemniteDecidee({ ...decision, montantVuHtCents: 30_000 });
    expect(r.issue).toBe("apercu_perime");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("montant vu identique (450 € HT) : écrit", async () => {
    const r = await ecrireIndemniteDecidee({ ...decision, montantVuHtCents: 45_000 });
    expect(r.issue).toBe("ecrite");
  });

  it("rejeu : « déjà écrite », rien de plus", async () => {
    ecrire.mockResolvedValue("deja_ecrite");
    expect((await ecrireIndemniteDecidee(decision)).issue).toBe("deja_ecrite");
  });

  it("non due (plus de 72 h, ou pas par Axion) : aucune transaction", async () => {
    expect(
      (await ecrireIndemniteDecidee({ ...decision, annuleeA: new Date("2026-11-01T08:00:00Z") }))
        .issue,
    ).toBe("non_due");
    expect((await ecrireIndemniteDecidee({ ...decision, parAxion: false })).issue).toBe("non_due");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("mission sans décision ouverte, sans tarif ou sans régime figé : refus", async () => {
    for (const over of [
      { lettreBlocageMotif: null },
      { tarifHtCents: null },
      { regimeTvaFige: null },
    ]) {
      missionFindUnique.mockResolvedValueOnce(mission(over));
      expect((await ecrireIndemniteDecidee(decision)).issue).toBe("refusee");
    }
    missionFindUnique.mockResolvedValueOnce(null);
    expect((await ecrireIndemniteDecidee(decision)).issue).toBe("refusee");
    expect(transaction).not.toHaveBeenCalled();
  });
});
