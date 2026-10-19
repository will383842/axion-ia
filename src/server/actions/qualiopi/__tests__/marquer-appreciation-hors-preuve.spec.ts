/**
 * NC14 — marquer une appréciation « hors preuve » (essai).
 *
 * Cliquet nominatif : l'action ne SUPPRIME ni ne MODIFIE jamais l'appréciation,
 * un second marquage est sans effet, et sans droit d'écriture elle refuse.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const h = vi.hoisted(() => {
  const tx = {
    siteSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    appreciation: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    requireAdminWrite: vi.fn(),
    log: vi.fn(async () => undefined),
    prisma: {
      siteSetting: { findUnique: vi.fn() },
      appreciation: { delete: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminRead: vi.fn(),
  requireAdminWrite: h.requireAdminWrite,
  requireAdminPublish: vi.fn(),
  logQualiopiActivity: h.log,
}));
vi.mock("@/server/qualiopi/portail/appreciation-service", () => ({
  creerAppreciation: vi.fn(),
  listAppreciations: vi.fn(),
  statsAppreciations: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/rgpd-service", () => ({
  exporterDonneesStagiaire: vi.fn(),
  supprimerStagiaire: vi.fn(),
}));

import { marquerAppreciationHorsPreuveAction } from "../appreciations";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdminWrite.mockResolvedValue({ userId: ADMIN });
  h.prisma.$transaction.mockImplementation(async (fn: (t: typeof h.tx) => unknown) => fn(h.tx));
  h.tx.appreciation.findUnique.mockResolvedValue({ id: ID });
  h.tx.siteSetting.findUnique.mockResolvedValue(null);
});

describe("marquerAppreciationHorsPreuveAction", () => {
  it("marque, journalise, et ne supprime ni ne modifie l'appréciation", async () => {
    const r = await marquerAppreciationHorsPreuveAction({
      appreciationId: ID,
      motif: "Essai confirmé par Will le 19/10",
    });
    expect(r).toEqual({ data: { dejaMarquee: false } });
    expect(h.tx.siteSetting.upsert).toHaveBeenCalledTimes(1);
    expect(h.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.appreciations.marquer_hors_preuve",
        targetType: "Appreciation",
        targetId: ID,
      }),
    );
    for (const o of [h.tx.appreciation, h.prisma.appreciation]) {
      expect(o.delete).not.toHaveBeenCalled();
      expect(o.update).not.toHaveBeenCalled();
      expect(o.updateMany).not.toHaveBeenCalled();
    }
  });

  it("deuxième marquage : sans effet, sans nouvelle écriture", async () => {
    h.tx.siteSetting.findUnique.mockResolvedValue({
      value: [
        {
          appreciationId: ID,
          motif: "déjà fait ici",
          marqueLe: "2026-10-19T00:00:00.000Z",
          marquePar: ADMIN,
        },
      ],
    });
    const r = await marquerAppreciationHorsPreuveAction({
      appreciationId: ID,
      motif: "encore un motif",
    });
    expect(r).toEqual({ data: { dejaMarquee: true } });
    expect(h.tx.siteSetting.upsert).not.toHaveBeenCalled();
  });

  it("motif trop court : refusé", async () => {
    const r = await marquerAppreciationHorsPreuveAction({ appreciationId: ID, motif: "court" });
    expect("error" in r).toBe(true);
    expect(h.tx.siteSetting.upsert).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });

  it("sans droit d'écriture : refusée, rien n'est écrit", async () => {
    h.requireAdminWrite.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(
      marquerAppreciationHorsPreuveAction({ appreciationId: ID, motif: "Essai confirmé par Will" }),
    ).rejects.toThrow("FORBIDDEN");
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });
});
