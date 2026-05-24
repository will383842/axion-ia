/**
 * Sprint v7 Phase 6 — Tests CRUD RSS sources Prisma-backed.
 *
 * 8 scénarios :
 *   R1. listRssSourcesFromDb retourne [] si DB vide (stub.invalid build-time)
 *   R2. addRssSourceToDb crée + revalidatePath + retourne row typée
 *   R3. addRssSourceToDb throw 'url_already_added' si conflit URL unique
 *   R4. updateRssSourceInDb modifie + retourne row mise à jour
 *   R5. updateRssSourceInDb throw 'source_not_found' si id inconnu
 *   R6. removeRssSourceFromDb delete + revalidatePath
 *   R7. toggleRssSourceInDb flip enabled + retourne row
 *   R8. backfillRssSourcesFromJsonConfig upsert legacy JSON → DB (idempotent)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────

const findManyMock = vi.fn();
const findUniqueMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const configFindUniqueMock = vi.fn();
const revalidatePathMock = vi.fn();
const requireAdminWriteRateLimitedMock = vi.fn();
const requireAdminMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rssSource: {
      findMany: (args: unknown) => findManyMock(args),
      findUnique: (args: unknown) => findUniqueMock(args),
      create: (args: unknown) => createMock(args),
      update: (args: unknown) => updateMock(args),
      delete: (args: unknown) => deleteMock(args),
    },
    contentGenConfig: {
      findUnique: (args: unknown) => configFindUniqueMock(args),
    },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePathMock(p) }));

vi.mock("../_auth", () => ({
  requireAdmin: () => requireAdminMock(),
  requireAdminWriteRateLimited: (actionId: string, opts: unknown) =>
    requireAdminWriteRateLimitedMock(actionId, opts),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const ADMIN_SESSION = { userId: "user-1", email: "admin@axion-ia.com", role: "admin" };

const FAKE_ROW = {
  id: "row-1",
  url: "https://example.com/feed.xml",
  name: "Test Feed",
  enabled: true,
  verticale: null,
  tags: ["test"],
  pollIntervalMin: 60,
  autoPublish: false,
  language: "fr",
  lastFetchedAt: null,
  lastSuccessAt: null,
  failureCount: 0,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"),
};

beforeEach(() => {
  // Use mockReset (not clearAllMocks) — clears both call history AND queued
  // mockResolvedValueOnce implementations to avoid bleed-over between tests.
  findManyMock.mockReset();
  findUniqueMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  configFindUniqueMock.mockReset();
  revalidatePathMock.mockReset();
  requireAdminMock.mockReset();
  requireAdminWriteRateLimitedMock.mockReset();
  requireAdminMock.mockResolvedValue(ADMIN_SESSION);
  requireAdminWriteRateLimitedMock.mockResolvedValue(ADMIN_SESSION);
  delete process.env.DATABASE_URL;
});

// ─── Tests ────────────────────────────────────────────────────────────────

import {
  listRssSourcesFromDb,
  addRssSourceToDb,
  updateRssSourceInDb,
  removeRssSourceFromDb,
  toggleRssSourceInDb,
  backfillRssSourcesFromJsonConfig,
} from "../rss-sources";

describe("RSS sources Prisma CRUD (Phase 6)", () => {
  it("R1: listRssSourcesFromDb retourne [] en mode build stub.invalid", async () => {
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    const result = await listRssSourcesFromDb();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("R2: addRssSourceToDb crée + revalidatePath + retourne row typée", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    createMock.mockResolvedValueOnce(FAKE_ROW);

    const result = await addRssSourceToDb({
      url: "https://example.com/feed.xml",
      name: "Test Feed",
      enabled: true,
      tags: ["test"],
      pollIntervalMin: 60,
      autoPublish: false,
      language: "fr",
    });

    expect(createMock).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalledWith(expect.stringContaining("/content-gen/rss"));
    expect(result.id).toBe("row-1");
    expect(result.tags).toEqual(["test"]);
  });

  it("R3: addRssSourceToDb throw 'url_already_added' si URL conflit", async () => {
    findUniqueMock.mockResolvedValueOnce(FAKE_ROW);
    await expect(
      addRssSourceToDb({
        url: "https://example.com/feed.xml",
        name: "Test Feed",
        enabled: true,
        tags: [],
        pollIntervalMin: 60,
        autoPublish: false,
        language: "fr",
      }),
    ).rejects.toThrow("url_already_added");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("R4: updateRssSourceInDb modifie + retourne row mise à jour", async () => {
    findUniqueMock.mockResolvedValueOnce(FAKE_ROW); // exists check
    updateMock.mockResolvedValueOnce({ ...FAKE_ROW, name: "Renamed Feed" });

    const result = await updateRssSourceInDb("row-1", {
      url: "https://example.com/feed.xml",
      name: "Renamed Feed",
      enabled: true,
      tags: ["test"],
      pollIntervalMin: 60,
      autoPublish: false,
      language: "fr",
    });

    expect(updateMock).toHaveBeenCalledOnce();
    expect(result.name).toBe("Renamed Feed");
  });

  it("R5: updateRssSourceInDb throw 'source_not_found' si id inconnu", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    await expect(
      updateRssSourceInDb("missing", {
        url: "https://example.com/feed.xml",
        name: "Valid Name",
        enabled: true,
        tags: [],
        pollIntervalMin: 60,
        autoPublish: false,
        language: "fr",
      }),
    ).rejects.toThrow("source_not_found");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("R6: removeRssSourceFromDb delete + revalidatePath", async () => {
    findUniqueMock.mockResolvedValueOnce(FAKE_ROW);
    deleteMock.mockResolvedValueOnce(FAKE_ROW);

    await removeRssSourceFromDb("row-1");

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "row-1" } });
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("R7: toggleRssSourceInDb flip enabled + retourne row", async () => {
    findUniqueMock.mockResolvedValueOnce(FAKE_ROW);
    updateMock.mockResolvedValueOnce({ ...FAKE_ROW, enabled: false });

    const result = await toggleRssSourceInDb("row-1", false);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: { enabled: false },
    });
    expect(result.enabled).toBe(false);
  });

  it("R8: backfillRssSourcesFromJsonConfig copie legacy JSON sources → DB (skip URLs déjà présentes)", async () => {
    configFindUniqueMock.mockResolvedValueOnce({
      key: "rss_sources",
      value: [
        {
          url: "https://a.com/feed.xml",
          name: "A",
          enabled: true,
          tags: [],
          pollIntervalMin: 60,
          autoPublish: false,
        },
        {
          url: "https://b.com/feed.xml",
          name: "B",
          enabled: false,
          tags: [],
          pollIntervalMin: 120,
          autoPublish: true,
        },
      ],
    });
    // a.com déjà en DB (skip), b.com absent (insert).
    findUniqueMock
      .mockResolvedValueOnce(FAKE_ROW) // a.com exists
      .mockResolvedValueOnce(null); // b.com missing
    createMock.mockResolvedValueOnce({ ...FAKE_ROW, url: "https://b.com/feed.xml", name: "B" });

    const result = await backfillRssSourcesFromJsonConfig();

    expect(result).toEqual({ inserted: 1, skipped: 1 });
    expect(createMock).toHaveBeenCalledOnce();
  });
});
