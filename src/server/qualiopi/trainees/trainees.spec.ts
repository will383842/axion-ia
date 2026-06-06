/**
 * Tests — trainees.ts service (R10 audit E2E 2026-06-06).
 * Stub-safe + exclusion des anonymisés (deletedAt) + recherche.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { listTrainees, getTrainee } from "./trainees";

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindUnique.mockReset();
});

describe("listTrainees", () => {
  it("exclut les stagiaires anonymisés par défaut (deletedAt = null)", async () => {
    mockFindMany.mockResolvedValue([]);
    await listTrainees();
    const arg = mockFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(arg.where).toMatchObject({ deletedAt: null });
  });

  it("inclut les anonymisés si includeDeleted=true", async () => {
    mockFindMany.mockResolvedValue([]);
    await listTrainees({ includeDeleted: true });
    const arg = mockFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(arg.where?.deletedAt).toBeUndefined();
  });

  it("applique une recherche OR sur nom/prénom/email/entreprise", async () => {
    mockFindMany.mockResolvedValue([]);
    await listTrainees({ search: "dupont" });
    const arg = mockFindMany.mock.calls[0]?.[0] as { where?: { OR?: unknown[] } };
    expect(Array.isArray(arg.where?.OR)).toBe(true);
    expect(arg.where?.OR).toHaveLength(4);
  });

  it("retourne [] si la DB jette (stub build)", async () => {
    mockFindMany.mockRejectedValue(new Error("stub"));
    expect(await listTrainees()).toEqual([]);
  });
});

describe("getTrainee", () => {
  it("retourne null si la DB jette", async () => {
    mockFindUnique.mockRejectedValue(new Error("stub"));
    expect(await getTrainee("x")).toBeNull();
  });
});
