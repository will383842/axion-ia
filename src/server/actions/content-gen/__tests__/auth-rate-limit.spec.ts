// City Domination 2026-05-18 P1-30 (audit A10) — Tests requireAdminWriteRateLimited.
// Couvre over-limit throw + pass-through + fail-open Redis.

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted() — déclaration des mocks avant le bootstrap du module testé.
const { authMock, checkRateLimitMock } = vi.hoisted(() => {
  return {
    authMock: vi.fn<
      () => Promise<{
        user: { id: string; email: string; role: string };
      } | null>
    >(async () => ({
      user: { id: "user-uuid-1", email: "admin@axion-ia.com", role: "admin" },
    })),
    checkRateLimitMock: vi.fn<
      (
        key: string,
        config: { limit: number; windowSec: number },
      ) => Promise<{ allowed: boolean; count: number; remaining: number; resetAt: number }>
    >(async () => ({
      allowed: true,
      count: 1,
      remaining: 59,
      resetAt: Date.now() + 60_000,
    })),
  };
});

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string, config: { limit: number; windowSec: number }) =>
    checkRateLimitMock(key, config),
}));

import { requireAdminWriteRateLimited } from "../_auth";

describe("requireAdminWriteRateLimited — P1-30 admin write throttle", () => {
  beforeEach(() => {
    authMock.mockClear();
    authMock.mockImplementation(async () => ({
      user: { id: "user-uuid-1", email: "admin@axion-ia.com", role: "admin" },
    }));
    checkRateLimitMock.mockClear();
    checkRateLimitMock.mockImplementation(async () => ({
      allowed: true,
      count: 1,
      remaining: 59,
      resetAt: Date.now() + 60_000,
    }));
  });

  it("retourne session admin si rate-limit OK (allowed)", async () => {
    const session = await requireAdminWriteRateLimited("updateBatchSettings");
    expect(session.userId).toBe("user-uuid-1");
    expect(session.email).toBe("admin@axion-ia.com");
    expect(session.role).toBe("admin");
  });

  it("compose key Redis avec userId + actionId (isolation par admin)", async () => {
    await requireAdminWriteRateLimited("updateBatchSettings");
    expect(checkRateLimitMock).toHaveBeenCalledTimes(1);
    const [key, config] = checkRateLimitMock.mock.calls[0]! as [
      string,
      { limit: number; windowSec: number },
    ];
    expect(key).toBe("admin:write:user-uuid-1:updateBatchSettings");
    expect(config.limit).toBe(60); // default
    expect(config.windowSec).toBe(60); // default 60 writes/min
  });

  it("respecte options override (limit + windowSec)", async () => {
    await requireAdminWriteRateLimited("kill-switch-toggle", { limit: 5, windowSec: 300 });
    const [, config] = checkRateLimitMock.mock.calls[0]! as [
      string,
      { limit: number; windowSec: number },
    ];
    expect(config.limit).toBe(5);
    expect(config.windowSec).toBe(300);
  });

  it("throw 'rate_limited' si over-limit", async () => {
    checkRateLimitMock.mockImplementation(async () => ({
      allowed: false,
      count: 61,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    }));
    await expect(requireAdminWriteRateLimited("updateBatchSettings")).rejects.toThrow(
      /^rate_limited:updateBatchSettings:61\/60$/,
    );
  });

  it("throw 'unauthorized' si pas de session", async () => {
    authMock.mockImplementation(
      async () => null as unknown as { user: { id: string; email: string; role: string } },
    );
    await expect(requireAdminWriteRateLimited("action")).rejects.toThrow("unauthorized");
  });

  it("throw 'forbidden' si rôle non-admin", async () => {
    authMock.mockImplementation(async () => ({
      user: { id: "u", email: "reader@axion-ia.com", role: "reader" },
    }));
    await expect(requireAdminWriteRateLimited("action")).rejects.toThrow("forbidden");
  });

  it("autorise rôle editor (multi-tier admin)", async () => {
    authMock.mockImplementation(async () => ({
      user: { id: "u", email: "editor@axion-ia.com", role: "editor" },
    }));
    const session = await requireAdminWriteRateLimited("action");
    expect(session.role).toBe("editor");
  });

  it("autorise rôle super_admin", async () => {
    authMock.mockImplementation(async () => ({
      user: { id: "u", email: "super@axion-ia.com", role: "super_admin" },
    }));
    const session = await requireAdminWriteRateLimited("action");
    expect(session.role).toBe("super_admin");
  });

  it("fail-open Redis (checkRateLimit returns allowed=true même si Redis down)", async () => {
    // checkRateLimit fait failOpen() interne si Redis throw — on simule ce comportement
    checkRateLimitMock.mockImplementation(async () => ({
      allowed: true, // fail-open
      count: 0,
      remaining: 60,
      resetAt: Date.now() + 60_000,
    }));
    const session = await requireAdminWriteRateLimited("action");
    expect(session).toBeDefined();
  });
});
