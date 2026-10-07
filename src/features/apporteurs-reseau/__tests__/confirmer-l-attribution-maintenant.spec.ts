// « Confirmer l'attribution maintenant » (2026-10-07) : administrateurs seulement, même
// écriture que « L'entreprise a répondu » datée d'aujourd'hui, et journalisée.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  confirmer: vi.fn(),
  journal: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { create: h.journal } } }));
vi.mock("../presentations", () => ({
  confirmerPresentation: (...a: unknown[]) => h.confirmer(...a),
}));

import { confirmerAttributionMaintenantAction } from "../actions-attribution";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const fd = (id = ID) => {
  const f = new FormData();
  f.set("id", id);
  return f;
};
const INITIAL = { etat: "initial" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  h.confirmer.mockResolvedValue({ ok: true });
});

describe("confirmer l'attribution maintenant", () => {
  it.each([
    ["sans session", null],
    ["rôle éditeur", { user: { id: "u", role: "editor" } }],
  ])("%s : refusé, rien n'est écrit", async (_c, session) => {
    h.session = session;
    const r = await confirmerAttributionMaintenantAction(INITIAL, fd());
    expect(r.etat).toBe("erreur");
    expect(h.confirmer).not.toHaveBeenCalled();
    expect(h.journal).not.toHaveBeenCalled();
  });

  it("administrateur : confirmée aujourd'hui, définitive, journalisée avec l'auteur", async () => {
    h.session = { user: { id: "adm-1", role: "admin" } };
    const avant = Date.now();
    const r = await confirmerAttributionMaintenantAction(INITIAL, fd());
    expect(r).toMatchObject({ etat: "ok" });
    const [id, date] = h.confirmer.mock.calls[0] as [string, Date];
    expect(id).toBe(ID);
    expect(date.getTime()).toBeGreaterThanOrEqual(avant);
    expect(h.journal.mock.calls[0]![0].data).toMatchObject({
      adminUserId: "adm-1",
      action: "presentation.attribution_confirmee_maintenant",
      targetId: ID,
    });
  });

  it("présentation déjà traitée : le refus du métier est rendu, pas de journal", async () => {
    h.session = { user: { id: "adm-1", role: "admin" } };
    h.confirmer.mockResolvedValue({
      ok: false,
      message: "Seule une présentation en attente peut être confirmée.",
    });
    const r = await confirmerAttributionMaintenantAction(INITIAL, fd());
    expect(r).toMatchObject({ etat: "erreur" });
    expect(h.journal).not.toHaveBeenCalled();
  });
});
