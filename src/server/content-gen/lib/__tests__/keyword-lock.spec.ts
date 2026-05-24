/**
 * Sprint Final P1-14 — Tests `keyword-lock` global Redis (Fl-08 multi-campagnes).
 *
 * Garanties testées :
 *  - acquire renvoie true sur 1er appel (SET NX EX → "OK")
 *  - acquire renvoie false sur 2e appel concurrent (SET NX EX → null)
 *  - release del la clé
 *  - normalisation FR cohérente (accents, casse, espaces)
 *  - fail-open : erreur Redis n'arrête pas le pipeline
 *  - stub-aware : REDIS_URL=stub.invalid → acquire=true sans touche Redis
 *  - keyword vide / non-string → no-op safe
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted Redis mock ──────────────────────────────────────────────────────

const { redisSetMock, redisDelMock } = vi.hoisted(() => ({
  redisSetMock: vi.fn(),
  redisDelMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    set: redisSetMock,
    del: redisDelMock,
  },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("keyword-lock (Sprint Final P1-14)", () => {
  let originalRedisUrl: string | undefined;

  beforeEach(() => {
    originalRedisUrl = process.env.REDIS_URL;
    // Force prod path (pas stub) sauf override par test
    process.env.REDIS_URL = "redis://test:6379";
    redisSetMock.mockReset();
    redisDelMock.mockReset();
  });

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  describe("acquireKeywordLock", () => {
    it('returns true when Redis SET NX EX returns "OK" (1er appel)', async () => {
      redisSetMock.mockResolvedValueOnce("OK");
      const { acquireKeywordLock } = await import("../keyword-lock");

      const got = await acquireKeywordLock("formation IA Paris");

      expect(got).toBe(true);
      expect(redisSetMock).toHaveBeenCalledOnce();
      expect(redisSetMock).toHaveBeenCalledWith(
        "keyword-lock:formation ia paris",
        "1",
        "EX",
        1800,
        "NX",
      );
    });

    it("returns false when Redis SET NX EX returns null (2e appel concurrent)", async () => {
      redisSetMock.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
      const { acquireKeywordLock } = await import("../keyword-lock");

      const first = await acquireKeywordLock("formation IA Paris");
      const second = await acquireKeywordLock("formation IA Paris");

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(redisSetMock).toHaveBeenCalledTimes(2);
    });

    it("uses custom TTL when provided", async () => {
      redisSetMock.mockResolvedValueOnce("OK");
      const { acquireKeywordLock } = await import("../keyword-lock");

      await acquireKeywordLock("audit RGPD", 60);

      expect(redisSetMock).toHaveBeenCalledWith("keyword-lock:audit rgpd", "1", "EX", 60, "NX");
    });

    it("normalizes FR (lowercase + strip accents + trim) — collision détectée", async () => {
      redisSetMock.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
      const { acquireKeywordLock } = await import("../keyword-lock");

      const a = await acquireKeywordLock("  Implémentation IA  ");
      const b = await acquireKeywordLock("implementation ia");

      expect(a).toBe(true);
      expect(b).toBe(false);
      // Les deux appels visent la même clé normalisée
      const calls = redisSetMock.mock.calls;
      expect(calls[0]?.[0]).toBe("keyword-lock:implementation ia");
      expect(calls[1]?.[0]).toBe("keyword-lock:implementation ia");
    });

    it("returns true (no-op) for empty keyword", async () => {
      const { acquireKeywordLock } = await import("../keyword-lock");

      const got = await acquireKeywordLock("");

      expect(got).toBe(true);
      expect(redisSetMock).not.toHaveBeenCalled();
    });

    it("fail-open on Redis error (timeout / ECONNREFUSED) — pipeline continue", async () => {
      redisSetMock.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:6379"));
      const { acquireKeywordLock } = await import("../keyword-lock");

      const got = await acquireKeywordLock("formation IA");

      // Fail-open : on retourne true pour ne pas bloquer le pipeline. Le
      // DB-level lock du keyword-selector reste la défense primaire.
      expect(got).toBe(true);
    });

    it("returns true (no-op) when REDIS_URL contains stub.invalid (build SSG)", async () => {
      process.env.REDIS_URL = "redis://stub.invalid:6379";
      const { acquireKeywordLock } = await import("../keyword-lock");

      const got = await acquireKeywordLock("formation IA");

      expect(got).toBe(true);
      expect(redisSetMock).not.toHaveBeenCalled();
    });
  });

  describe("releaseKeywordLock", () => {
    it("calls redis.del with the normalized lock key", async () => {
      redisDelMock.mockResolvedValueOnce(1);
      const { releaseKeywordLock } = await import("../keyword-lock");

      await releaseKeywordLock("Formation IA Paris");

      expect(redisDelMock).toHaveBeenCalledOnce();
      expect(redisDelMock).toHaveBeenCalledWith("keyword-lock:formation ia paris");
    });

    it("acquire → release → acquire (same keyword) → succeeds again", async () => {
      redisSetMock
        .mockResolvedValueOnce("OK") // 1er acquire
        .mockResolvedValueOnce("OK"); // 2e acquire après release
      redisDelMock.mockResolvedValueOnce(1);
      const { acquireKeywordLock, releaseKeywordLock } = await import("../keyword-lock");

      const a = await acquireKeywordLock("audit IA");
      await releaseKeywordLock("audit IA");
      const b = await acquireKeywordLock("audit IA");

      expect(a).toBe(true);
      expect(b).toBe(true);
      expect(redisDelMock).toHaveBeenCalledWith("keyword-lock:audit ia");
    });

    it("no-op for empty keyword", async () => {
      const { releaseKeywordLock } = await import("../keyword-lock");

      await releaseKeywordLock("");

      expect(redisDelMock).not.toHaveBeenCalled();
    });

    it("no-op when REDIS_URL is stub.invalid (build SSG)", async () => {
      process.env.REDIS_URL = "redis://stub.invalid:6379";
      const { releaseKeywordLock } = await import("../keyword-lock");

      await releaseKeywordLock("formation IA");

      expect(redisDelMock).not.toHaveBeenCalled();
    });

    it("does not throw on Redis error (lock TTL will auto-expire)", async () => {
      redisDelMock.mockRejectedValueOnce(new Error("Redis down"));
      const { releaseKeywordLock } = await import("../keyword-lock");

      await expect(releaseKeywordLock("formation IA")).resolves.toBeUndefined();
    });
  });

  describe("buildKeywordLockKey", () => {
    it("produces consistent normalized keys", async () => {
      const { buildKeywordLockKey } = await import("../keyword-lock");

      expect(buildKeywordLockKey("Formation IA Paris")).toBe("keyword-lock:formation ia paris");
      expect(buildKeywordLockKey("  Implémentation  ")).toBe("keyword-lock:implementation");
      expect(buildKeywordLockKey("AUDIT RGPD")).toBe("keyword-lock:audit rgpd");
    });
  });
});
