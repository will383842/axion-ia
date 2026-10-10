/**
 * L'éditeur générique de réglages refuse les clés `formateurs.*` (lot S0-ter).
 *
 * Ces clés sont des interrupteurs à préalables : les écrire en JSON brut
 * contournerait les préalables, l'habilitation par clé et le journal dédié.
 * Toutes les autres clés passent exactement comme avant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => null }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));

const upsert = vi.fn((a: unknown) => a);
const del = vi.fn((a: unknown) => a);
const logCreate = vi.fn((a: unknown) => a);
const transaction = vi.fn(async (ops: unknown[]) => ops);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { upsert: (a: unknown) => upsert(a), delete: (a: unknown) => del(a) },
    activityLog: { create: (a: unknown) => logCreate(a) },
    $transaction: (ops: unknown[]) => transaction(ops),
  },
}));

import { deleteSettingAction, upsertSettingAction } from "../actions";

const MESSAGE = "Ce réglage se change dans Formateurs freelance › Interrupteurs";

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertSettingAction", () => {
  it("un `admin` qui modifie formateurs.passage_paiement est refusé", async () => {
    auth.mockResolvedValue({ user: { id: "u-1", role: "admin" } });
    const r = await upsertSettingAction(
      { ok: true },
      fd({ key: "formateurs.passage_paiement", valueJson: '{"date":"2026-12-01"}' }),
    );
    expect(r).toEqual({ ok: false, error: MESSAGE });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("même refus pour un `super_admin` et pour une casse différente", async () => {
    auth.mockResolvedValue({ user: { id: "u-1", role: "super_admin" } });
    const r = await upsertSettingAction(
      { ok: true },
      fd({ key: "Formateurs.relances_auto", valueJson: '{"actif":true}' }),
    );
    expect(r).toEqual({ ok: false, error: MESSAGE });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("les autres clés sont strictement inchangées", async () => {
    auth.mockResolvedValue({ user: { id: "u-1", role: "admin" } });
    const r = await upsertSettingAction(
      { ok: true },
      fd({ key: "maintenance.mode", valueJson: '{"actif":false}' }),
    );
    expect(r).toEqual({ ok: true });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "maintenance.mode" } }),
    );
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "setting.updated" }) }),
    );
  });
});

describe("deleteSettingAction", () => {
  it("supprimer une clé formateurs.* est refusé, même au super_admin", async () => {
    auth.mockResolvedValue({ user: { id: "u-1", role: "super_admin" } });
    const r = await deleteSettingAction({ ok: true }, fd({ key: "formateurs.garde_mission" }));
    expect(r).toEqual({ ok: false, error: MESSAGE });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("les autres clés se suppriment comme avant", async () => {
    auth.mockResolvedValue({ user: { id: "u-1", role: "super_admin" } });
    const r = await deleteSettingAction({ ok: true }, fd({ key: "maintenance.mode" }));
    expect(r).toEqual({ ok: true });
    expect(del).toHaveBeenCalledWith({ where: { key: "maintenance.mode" } });
  });
});
