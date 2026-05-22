/**
 * Tests — RSS source server actions (rss.ts)
 *
 * Couvre : listRssSources, addRssSource, removeRssSource,
 *          updateRssSource, toggleRssSource
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const authMock = vi.fn();
const configFindUniqueMock = vi.fn();
const configUpsertMock = vi.fn();
const revalidatePathMock = vi.fn();
const rateLimitMock = vi.fn();
const auditLogMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenConfig: {
      findUnique: (args: unknown) => configFindUniqueMock(args),
      upsert: (args: unknown) => configUpsertMock(args),
      findMany: vi.fn(async () => []),
    },
    contentGenAuditLog: {
      create: vi.fn(async () => ({ id: "audit-1" })),
    },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePathMock(p) }));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string, opts: unknown) => rateLimitMock(key, opts),
}));

vi.mock("@/server/content-gen/audit-log", () => ({
  writeAuditLog: (args: unknown) => auditLogMock(args),
}));

import {
  listRssSources,
  addRssSource,
  removeRssSource,
  updateRssSource,
  toggleRssSource,
} from "../rss";
import type { RssSource } from "../rss";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  user: { id: "admin-1", email: "admin@axion-ia.com", role: "admin" },
};

const VALID_SOURCE: RssSource = {
  url: "https://example.com/feed.xml",
  name: "Example RSS",
  tags: ["ia", "tech"],
  pollIntervalMin: 60,
  autoPublish: false,
  enabled: true,
};

const SECOND_SOURCE: RssSource = {
  url: "https://other.com/rss",
  name: "Other Feed",
  tags: [],
  pollIntervalMin: 30,
  autoPublish: true,
  enabled: true,
};

function mockExistingConfig(sources: RssSource[]) {
  configFindUniqueMock.mockResolvedValue({ key: "rss_sources", value: sources });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(ADMIN_SESSION);
  configFindUniqueMock.mockResolvedValue(null); // empty by default
  configUpsertMock.mockResolvedValue({ key: "rss_sources" });
  revalidatePathMock.mockReturnValue(undefined);
  auditLogMock.mockResolvedValue(undefined);
  rateLimitMock.mockResolvedValue({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  });
});

// ─── listRssSources ───────────────────────────────────────────────────────────

describe("listRssSources", () => {
  it("retourne [] si aucune config en DB", async () => {
    const result = await listRssSources();
    expect(result).toEqual([]);
  });

  it("retourne les sources depuis la config DB", async () => {
    mockExistingConfig([VALID_SOURCE]);
    const result = await listRssSources();
    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://example.com/feed.xml");
  });
});

// ─── addRssSource ─────────────────────────────────────────────────────────────

describe("addRssSource", () => {
  it("ajoute une source valide et appelle upsert", async () => {
    await addRssSource(VALID_SOURCE);
    expect(configUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "rss_sources" },
        create: expect.objectContaining({ key: "rss_sources" }),
      }),
    );
  });

  it("throw url_already_added si URL déjà présente", async () => {
    mockExistingConfig([VALID_SOURCE]);
    await expect(addRssSource(VALID_SOURCE)).rejects.toThrow("url_already_added");
  });

  it("throw si URL invalide (non-http)", async () => {
    const badSource = { ...VALID_SOURCE, url: "ftp://bad.com/feed" };
    await expect(addRssSource(badSource)).rejects.toThrow();
  });

  it("throw si pollIntervalMin hors range (Zod ou manual check)", async () => {
    // Zod schema min(5) fires before manual check — any throw is valid
    const badSource = { ...VALID_SOURCE, pollIntervalMin: 2 };
    await expect(addRssSource(badSource)).rejects.toThrow();
  });

  it("throw si name trop court (Zod ou manual check)", async () => {
    // Zod schema min(2) fires before manual name_too_short check — any throw is valid
    const badSource = { ...VALID_SOURCE, name: "X" };
    await expect(addRssSource(badSource)).rejects.toThrow();
  });

  it("throw unauthorized si pas de session", async () => {
    authMock.mockResolvedValue(null);
    await expect(addRssSource(VALID_SOURCE)).rejects.toThrow("unauthorized");
  });

  it("appelle revalidatePath après ajout", async () => {
    await addRssSource(VALID_SOURCE);
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});

// ─── removeRssSource ──────────────────────────────────────────────────────────

describe("removeRssSource", () => {
  it("filtre la source et appelle upsert sans elle", async () => {
    mockExistingConfig([VALID_SOURCE, SECOND_SOURCE]);
    await removeRssSource("https://example.com/feed.xml");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = configUpsertMock.mock.calls[0] as [{ update: { value: any } }];
    const saved: RssSource[] = call[0].update.value as RssSource[];
    expect(saved).toHaveLength(1);
    expect(saved[0]!.url).toBe("https://other.com/rss");
  });

  it("throw si URL invalide (Zod)", async () => {
    await expect(removeRssSource("not-a-url")).rejects.toThrow();
  });

  it("appelle revalidatePath après suppression", async () => {
    await removeRssSource("https://example.com/feed.xml");
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});

// ─── updateRssSource ──────────────────────────────────────────────────────────

describe("updateRssSource", () => {
  it("remplace la source à l'index correct", async () => {
    mockExistingConfig([VALID_SOURCE, SECOND_SOURCE]);
    const updated: RssSource = { ...VALID_SOURCE, name: "Updated Name", pollIntervalMin: 120 };
    await updateRssSource("https://example.com/feed.xml", updated);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = configUpsertMock.mock.calls[0] as [{ update: { value: any } }];
    const saved: RssSource[] = call[0].update.value as RssSource[];
    expect(saved[0]!.name).toBe("Updated Name");
    expect(saved[0]!.pollIntervalMin).toBe(120);
    expect(saved).toHaveLength(2);
  });

  it("throw source_not_found si URL absente", async () => {
    mockExistingConfig([SECOND_SOURCE]);
    await expect(updateRssSource("https://example.com/feed.xml", VALID_SOURCE)).rejects.toThrow(
      "source_not_found",
    );
  });

  it("throw url_already_added si nouvelle URL conflicte avec une autre source", async () => {
    mockExistingConfig([VALID_SOURCE, SECOND_SOURCE]);
    const conflicting: RssSource = { ...VALID_SOURCE, url: SECOND_SOURCE.url };
    await expect(updateRssSource("https://example.com/feed.xml", conflicting)).rejects.toThrow(
      "url_already_added",
    );
  });

  it("accepte un changement d'URL sans conflit", async () => {
    mockExistingConfig([VALID_SOURCE]);
    const updated: RssSource = { ...VALID_SOURCE, url: "https://newurl.com/feed.xml" };
    await expect(updateRssSource("https://example.com/feed.xml", updated)).resolves.toBeUndefined();
  });
});

// ─── toggleRssSource ──────────────────────────────────────────────────────────

describe("toggleRssSource", () => {
  it("flip enabled=false sur une source active", async () => {
    mockExistingConfig([VALID_SOURCE]); // VALID_SOURCE.enabled = true
    await toggleRssSource("https://example.com/feed.xml", false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = configUpsertMock.mock.calls[0] as [{ update: { value: any } }];
    const saved: RssSource[] = call[0].update.value as RssSource[];
    expect(saved[0]!.enabled).toBe(false);
  });

  it("flip enabled=true sur une source désactivée", async () => {
    mockExistingConfig([{ ...VALID_SOURCE, enabled: false }]);
    await toggleRssSource("https://example.com/feed.xml", true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = configUpsertMock.mock.calls[0] as [{ update: { value: any } }];
    const saved: RssSource[] = call[0].update.value as RssSource[];
    expect(saved[0]!.enabled).toBe(true);
  });

  it("throw source_not_found si URL absente", async () => {
    mockExistingConfig([]);
    await expect(toggleRssSource("https://missing.com/rss", true)).rejects.toThrow(
      "source_not_found",
    );
  });

  it("throw si URL invalide (Zod)", async () => {
    await expect(toggleRssSource("not-a-url", true)).rejects.toThrow();
  });

  it("appelle revalidatePath après toggle", async () => {
    mockExistingConfig([VALID_SOURCE]);
    await toggleRssSource("https://example.com/feed.xml", false);
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});
