// FAC-1 — L'acte « valider un texte d'e-mail » : super-admin seul, journal dans la même
// transaction, jamais d'identifiant non UUID dans `activity_logs.target_id`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));

const { tx } = vi.hoisted(() => ({
  tx: {
    setting: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
    activityLog: { create: vi.fn(async () => ({})) },
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) },
}));

import { validerTexteEmailAction } from "../textes-valides-actions";
import { cleTexteValide } from "../textes-valides";

const connecte = (role: string) => auth.mockResolvedValue({ user: { id: "u-1", role } });

beforeEach(() => vi.clearAllMocks());

describe("validerTexteEmailAction", () => {
  it.each(["admin", "editor", "responsable_qualite", "reader"])(
    "%s est refusé, rien n'est écrit",
    async (role) => {
      connecte(role);
      const r = await validerTexteEmailAction({ gabarit: "g-un", valide: true });
      expect(r.ok).toBe(false);
      expect(tx.setting.upsert).not.toHaveBeenCalled();
      expect(tx.activityLog.create).not.toHaveBeenCalled();
    },
  );

  it("sans session : refus", async () => {
    auth.mockResolvedValue(null);
    const r = await validerTexteEmailAction({ gabarit: "g-un", valide: true });
    expect(r.ok).toBe(false);
  });

  it("un nom de gabarit invalide est refusé", async () => {
    connecte("super_admin");
    const r = await validerTexteEmailAction({ gabarit: "G UN", valide: true });
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("super_admin : écrit la ligne de la variante et la journalise sans targetId", async () => {
    connecte("super_admin");
    const r = await validerTexteEmailAction({
      gabarit: "g-un",
      variante: "freelance",
      valide: true,
    });
    expect(r.ok).toBe(true);
    const cle = cleTexteValide("g-un", "freelance");
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: cle },
        update: { value: { valide: true }, updatedBy: "u-1" },
      }),
    );
    const log = (
      tx.activityLog.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(log).not.toHaveProperty("targetId");
    expect(log.targetType).toBe("setting");
    expect(log.ipAddress).toBe("203.0.113.7");
    expect(log.action).toBe("email.texte_valide");
    expect(log.changes).toEqual({ cle, avant: false, apres: true });
  });

  it("retirer la validation est journalisé comme tel", async () => {
    connecte("super_admin");
    tx.setting.findUnique.mockResolvedValueOnce({ value: { valide: true } } as never);
    const r = await validerTexteEmailAction({ gabarit: "g-un", valide: false });
    expect(r.ok).toBe(true);
    const log = (
      tx.activityLog.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(log.action).toBe("email.texte_invalide");
    expect(log.changes).toEqual({ cle: cleTexteValide("g-un"), avant: true, apres: false });
  });
});
