import { beforeEach, describe, expect, it, vi } from "vitest";

const updateManyMock = vi.fn();
const activityCreateMock = vi.fn();
const requireAdminWriteMock = vi.fn();
const revalidateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: { updateMany: (...a: unknown[]) => updateManyMock(...a) },
    activityLog: { create: (...a: unknown[]) => activityCreateMock(...a) },
  },
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "1.2.3.4" }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidateMock(...a) }));
vi.mock("../session", () => ({ requireAdminWrite: () => requireAdminWriteMock() }));

import { marquerFavoriAction } from "../favori-actions";

const ID = "0f6f6b5e-1c1a-4d7e-9a58-5b1c2c3d4e5f";

function form(id: string, favori: string): FormData {
  const f = new FormData();
  f.set("id", id);
  f.set("favori", favori);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminWriteMock.mockResolvedValue({ userId: "u1", role: "super_admin", nom: "Will" });
  updateManyMock.mockResolvedValue({ count: 1 });
  activityCreateMock.mockResolvedValue({});
});

describe("marquerFavoriAction", () => {
  it("sans droit d'écriture : aucune écriture", async () => {
    requireAdminWriteMock.mockRejectedValue(new Error("forbidden"));
    await marquerFavoriAction(form(ID, "1"));
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("identifiant invalide ou valeur inconnue : aucune écriture", async () => {
    await marquerFavoriAction(form("pas-un-uuid", "1"));
    await marquerFavoriAction(form(ID, "2"));
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("favori=1 n'écrit que sur un dossier qui n'est pas déjà favori", async () => {
    await marquerFavoriAction(form(ID, "1"));
    expect(updateManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ID, favoriAt: null, offer: { slug: { in: expect.any(Array) } } },
    });
    expect(activityCreateMock.mock.calls[0]?.[0].data.action).toBe(
      "careers.candidature.favori.ajoute",
    );
    expect(revalidateMock).toHaveBeenCalled();
  });

  it("favori=0 n'écrit que sur un dossier déjà favori", async () => {
    await marquerFavoriAction(form(ID, "0"));
    expect(updateManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ID, favoriAt: { not: null } },
      data: { favoriAt: null },
    });
    expect(activityCreateMock.mock.calls[0]?.[0].data.action).toBe(
      "careers.candidature.favori.retire",
    );
  });

  it("aucun changement (déjà dans l'état voulu) : pas de journal", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    await marquerFavoriAction(form(ID, "1"));
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("un journal en panne ne fait pas échouer l'action", async () => {
    activityCreateMock.mockRejectedValue(new Error("db"));
    await expect(marquerFavoriAction(form(ID, "1"))).resolves.toBeUndefined();
  });
});
