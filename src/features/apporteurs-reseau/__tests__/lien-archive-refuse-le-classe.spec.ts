import { beforeEach, describe, expect, it, vi } from "vitest";

// PR K (2464) : « Copier le lien d'accès aux pièces » ne sert qu'un résilié NON classé.
// Un résilié classé (retiré du réseau) garde la page neutre : pas de lien.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  retraitDe: vi.fn(async () => null as Date | null),
}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1", role: "OWNER" } }) }));
vi.mock("@/server/auth/habilitations", () => ({ peutEngager: () => true }));
vi.mock("@/lib/prisma", () => ({
  prisma: { apporteurReseau: { findUnique: (...a: unknown[]) => h.findUnique(...a) } },
}));
vi.mock("../retrait", () => ({ retraitDe: (...a: unknown[]) => h.retraitDe(...(a as [])) }));
vi.mock("../jeton", () => ({ urlDossier: () => "https://exemple.test/lien" }));

import { lienArchiveAction } from "../actions-apporteurs";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

beforeEach(() => {
  vi.clearAllMocks();
  h.findUnique.mockResolvedValue({ id: ID, statut: "resilie", versionLien: 2 });
  h.retraitDe.mockResolvedValue(null);
});

describe("lienArchiveAction", () => {
  it("résilié non classé → l'URL", async () => {
    expect(await lienArchiveAction({ apporteurId: ID })).toEqual({
      ok: true,
      message: "https://exemple.test/lien",
    });
  });
  it("résilié classé → refus, aucune URL", async () => {
    h.retraitDe.mockResolvedValue(new Date());
    const r = await lienArchiveAction({ apporteurId: ID });
    expect(r.ok).toBe(false);
    expect(r.message).not.toContain("https://");
  });
});
