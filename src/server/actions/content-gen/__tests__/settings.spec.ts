/**
 * Tests — ContentGenConfig settings helpers (_settings.ts)
 *
 * Couvre : readContentGenConfig, writeContentGenConfig, listContentGenConfig
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const authMock = vi.fn();
const configFindUniqueMock = vi.fn();
const configUpsertMock = vi.fn();
const configFindManyMock = vi.fn();
const auditLogMock = vi.fn();
const rateLimitMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenConfig: {
      findUnique: (args: unknown) => configFindUniqueMock(args),
      upsert: (args: unknown) => configUpsertMock(args),
      findMany: (args: unknown) => configFindManyMock(args),
    },
    contentGenAuditLog: {
      create: vi.fn(async () => ({ id: "audit-1" })),
    },
  },
}));

vi.mock("@/server/content-gen/audit-log", () => ({
  writeAuditLog: (args: unknown) => auditLogMock(args),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string, opts: unknown) => rateLimitMock(key, opts),
}));

import { readContentGenConfig, writeContentGenConfig, listContentGenConfig } from "../_settings";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  user: { id: "admin-1", email: "admin@axion-ia.com", role: "admin" },
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(ADMIN_SESSION);
  configFindUniqueMock.mockResolvedValue(null);
  configUpsertMock.mockResolvedValue({ key: "test_key" });
  configFindManyMock.mockResolvedValue([]);
  auditLogMock.mockResolvedValue(undefined);
  rateLimitMock.mockResolvedValue({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  });
});

// ─── readContentGenConfig ─────────────────────────────────────────────────────

describe("readContentGenConfig", () => {
  it("retourne defaultValue si la clé n'existe pas en DB", async () => {
    configFindUniqueMock.mockResolvedValue(null);
    const result = await readContentGenConfig("missing_key", 42);
    expect(result).toBe(42);
  });

  it("retourne la valeur DB si la clé existe", async () => {
    configFindUniqueMock.mockResolvedValue({ key: "my_key", value: { threshold: 75 } });
    const result = await readContentGenConfig("my_key", {});
    expect(result).toEqual({ threshold: 75 });
  });

  it("retourne defaultValue si prisma throw (fail-safe)", async () => {
    configFindUniqueMock.mockRejectedValue(new Error("db_error"));
    const result = await readContentGenConfig("broken_key", "fallback");
    expect(result).toBe("fallback");
  });

  it("ne requiert PAS de session admin (workers BullMQ sans session)", async () => {
    authMock.mockResolvedValue(null);
    configFindUniqueMock.mockResolvedValue({ key: "k", value: true });
    await expect(readContentGenConfig("k", false)).resolves.toBe(true);
  });
});

// ─── writeContentGenConfig ────────────────────────────────────────────────────

describe("writeContentGenConfig", () => {
  it("appelle prisma.contentGenConfig.upsert avec key+value", async () => {
    await writeContentGenConfig("my_key", { enabled: true }, "admin-1");
    expect(configUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "my_key" },
        create: expect.objectContaining({ key: "my_key", value: { enabled: true } }),
        update: expect.objectContaining({ value: { enabled: true } }),
      }),
    );
  });

  it("throw unauthorized si pas de session", async () => {
    authMock.mockResolvedValue(null);
    await expect(writeContentGenConfig("k", "v", "unknown")).rejects.toThrow("unauthorized");
  });

  it("throw rate_limited si rate limit dépassé", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, count: 61, remaining: 0 });
    await expect(writeContentGenConfig("k", "v", "admin-1")).rejects.toThrow("rate_limited");
  });

  it("appelle writeAuditLog avec oldValue + newValue", async () => {
    configFindUniqueMock.mockResolvedValue({ value: "old_value" });
    await writeContentGenConfig("k", "new_value", "admin-1", "desc");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "writeContentGenConfig",
        settingKey: "k",
        oldValue: "old_value",
        newValue: "new_value",
      }),
    );
  });
});

// ─── listContentGenConfig ─────────────────────────────────────────────────────

describe("listContentGenConfig", () => {
  it("retourne les configs triées par clé", async () => {
    configFindManyMock.mockResolvedValue([
      { key: "a_key", value: 1, description: "desc A", updatedAt: new Date() },
      { key: "b_key", value: 2, description: null, updatedAt: new Date() },
    ]);
    const result = await listContentGenConfig();
    expect(result).toHaveLength(2);
    expect(result[0]!.key).toBe("a_key");
    expect(result[1]!.description).toBeNull();
  });

  it("throw unauthorized si pas de session", async () => {
    authMock.mockResolvedValue(null);
    await expect(listContentGenConfig()).rejects.toThrow("unauthorized");
  });
});
