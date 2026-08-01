// Correctif P0 audit UX 2026-08 — la file « Qualité » (requiresHumanReview /
// requiresHumanTaxonomy) renvoyait vers une fiche détail purement en lecture :
// aucune action pour en sortir une image. Tests des deux nouvelles Server
// Actions qui donnent enfin un sens à cette file.

import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  imageAssetUpdate: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    imageAsset: { update: mocks.imageAssetUpdate },
  },
}));

vi.mock("@/auth", () => ({
  auth: () => mocks.authMock(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

// `redirect()` de next/navigation throw en interne (comportement réel Next) —
// on le simule ainsi pour vérifier qu'aucun admin non autorisé n'atteint la
// mutation Prisma.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { validateImageAction, correctImageModuleAction } from "./review.action";

const ADMIN_SESSION = { user: { id: "user-uuid-1", role: "admin" } };
const IMAGE_ID = "8f14e45f-ceea-467e-9c00-000000000001";

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authMock.mockResolvedValue(ADMIN_SESSION);
  mocks.imageAssetUpdate.mockResolvedValue({ id: IMAGE_ID });
});

describe("validateImageAction — P0 file Qualité", () => {
  it("happy path : efface requiresHumanReview + requiresHumanTaxonomy", async () => {
    const result = await validateImageAction(
      { ok: false, error: "" },
      buildFormData({ imageId: IMAGE_ID }),
    );

    expect(result.ok).toBe(true);
    expect(mocks.imageAssetUpdate).toHaveBeenCalledWith({
      where: { id: IMAGE_ID },
      data: { requiresHumanReview: false, requiresHumanTaxonomy: false },
    });
  });

  it("refuse un imageId invalide (Zod uuid)", async () => {
    const result = await validateImageAction(
      { ok: false, error: "" },
      buildFormData({ imageId: "not-a-uuid" }),
    );

    expect(result.ok).toBe(false);
    expect(mocks.imageAssetUpdate).not.toHaveBeenCalled();
  });

  it("refuse un admin non authentifié (redirect)", async () => {
    mocks.authMock.mockResolvedValueOnce(null);

    await expect(
      validateImageAction({ ok: false, error: "" }, buildFormData({ imageId: IMAGE_ID })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.imageAssetUpdate).not.toHaveBeenCalled();
  });
});

describe("correctImageModuleAction — P0 file Qualité", () => {
  it("happy path : réécrit module + efface requiresHumanTaxonomy", async () => {
    const result = await correctImageModuleAction(
      { ok: false, error: "" },
      buildFormData({ imageId: IMAGE_ID, module: "audits" }),
    );

    expect(result.ok).toBe(true);
    expect(mocks.imageAssetUpdate).toHaveBeenCalledWith({
      where: { id: IMAGE_ID },
      data: { module: "audits", requiresHumanTaxonomy: false },
    });
  });

  it("refuse un module hors taxonomie SSOT", async () => {
    const result = await correctImageModuleAction(
      { ok: false, error: "" },
      buildFormData({ imageId: IMAGE_ID, module: "pas-un-module" }),
    );

    expect(result.ok).toBe(false);
    expect(mocks.imageAssetUpdate).not.toHaveBeenCalled();
  });
});
