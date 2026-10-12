// @vitest-environment node

/**
 * Relecture #1511 (lot C) — `passerLesSansReponse` bascule une proposition en
 * `sans_reponse` par une écriture CONDITIONNELLE sur `statut: "en_attente"`.
 *
 * Le passage est horaire : entre la lecture des propositions échues et
 * l'écriture, le formateur peut avoir répondu. Une écriture sans condition
 * effaçait sa réponse et retirait son affectation. Ici, la ligne n'est plus en
 * attente : rien n'est retiré, rien n'est archivé, rien n'est envoyé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const updateMany = vi.fn();
const txUpdate = vi.fn();
const txUpdateMany = vi.fn();
const txSessionUpdate = vi.fn();
const txDeleteMany = vi.fn();
const lireAvant = vi.fn();
const archiver = vi.fn();
const notifier = vi.fn();

const tx = {
  missionFormateur: { update: txUpdate, updateMany: txUpdateMany },
  trainingSession: { update: txSessionUpdate },
  sessionFormateur: { deleteMany: txDeleteMany },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    missionFormateur: {
      findMany: (...a: unknown[]) => findMany(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  },
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/qualiopi/trainers/affectation-retiree", () => ({
  lireAffectationsAvantRetrait: (...a: unknown[]) => lireAvant(...a),
  archiverAffectationsRetirees: (...a: unknown[]) => archiver(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/proposition-close", () => ({
  notifierPropositionClose: (...a: unknown[]) => notifier(...a),
}));

import { relancerEtExpirerMissions } from "../mission-formateur";

const M = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const T = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-11-02T10:00:00Z");

const echue = {
  id: M,
  sessionId: S,
  trainerId: T,
  solliciteAt: new Date("2026-10-30T10:00:00Z"),
  session: { formateurPrincipalId: T },
  trainer: {
    statut: "sous_traitant",
    organismeSousTraitantId: null,
    prenom: "Paule",
    email: "f@exemple.test",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 0 });
  // 1er findMany : les propositions échues ; 2e : les relances (aucune).
  findMany.mockResolvedValueOnce([echue]).mockResolvedValueOnce([]);
  lireAvant.mockResolvedValue([]);
  txUpdate.mockResolvedValue({});
});

describe("passerLesSansReponse — écriture conditionnelle", () => {
  it("le formateur a répondu entre la lecture et l'écriture : rien n'est retiré", async () => {
    txUpdateMany.mockResolvedValue({ count: 0 });
    const bilan = await relancerEtExpirerMissions(NOW);
    expect(bilan.sansReponse).toBe(0);
    expect(txUpdate).not.toHaveBeenCalled();
    expect(txUpdateMany).toHaveBeenCalledWith({
      where: { id: M, statut: "en_attente" },
      data: { statut: "sans_reponse" },
    });
    expect(txSessionUpdate).not.toHaveBeenCalled();
    expect(txDeleteMany).not.toHaveBeenCalled();
    expect(archiver).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it("toujours en attente : bascule, libère la session, archive et prévient", async () => {
    txUpdateMany.mockResolvedValue({ count: 1 });
    const bilan = await relancerEtExpirerMissions(NOW);
    expect(bilan.sansReponse).toBe(1);
    expect(txSessionUpdate).toHaveBeenCalledWith({
      where: { id: S },
      data: { formateurPrincipalId: null },
    });
    expect(txDeleteMany).toHaveBeenCalledWith({ where: { sessionId: S, trainerId: T } });
    expect(archiver).toHaveBeenCalledTimes(1);
    expect(notifier).toHaveBeenCalledTimes(1);
  });
});
