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
 *
 * Fix 2026-08-15 (audit e2e, C3) — garanties de PROPRIÉTÉ ajoutées : un job qui
 * retrouve SON PROPRE lock (re-génération boucle qualité, retry BullMQ < TTL)
 * doit le considérer acquis (ré-entrant, TTL rafraîchi) au lieu de se faire
 * `cancelled` « held by another worker » ; le lock d'un job CONCURRENT reste
 * refusé.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted Redis mock ──────────────────────────────────────────────────────

const { redisSetMock, redisDelMock, redisGetMock } = vi.hoisted(() => ({
  redisSetMock: vi.fn(),
  redisDelMock: vi.fn(),
  redisGetMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    set: redisSetMock,
    del: redisDelMock,
    get: redisGetMock,
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
    redisGetMock.mockReset();
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

  // Fix 2026-08-15 (audit e2e, C3) — token de propriété : le pipeline ne doit
  // plus s'auto-annuler quand un job retombe sur son propre lock.
  describe("acquireKeywordLock — token de propriété (C3)", () => {
    it("stores the owner token as lock value on first acquire", async () => {
      redisSetMock.mockResolvedValueOnce("OK");
      const { acquireKeywordLock } = await import("../keyword-lock");

      const got = await acquireKeywordLock("formation IA Paris", 1800, "job-abc");

      expect(got).toBe(true);
      expect(redisSetMock).toHaveBeenCalledWith(
        "keyword-lock:formation ia paris",
        "job-abc",
        "EX",
        1800,
        "NX",
      );
      // 1er acquire réussi : pas besoin d'inspecter le propriétaire.
      expect(redisGetMock).not.toHaveBeenCalled();
    });

    it("ré-entrant : retrouver SON PROPRE lock = acquis + TTL rafraîchi (regen boucle qualité / retry)", async () => {
      // SET NX refuse (clé déjà présente)…
      redisSetMock.mockResolvedValueOnce(null);
      // …mais la valeur porte NOTRE token → ré-entrant.
      redisGetMock.mockResolvedValueOnce("job-abc");
      // Refresh TTL (SET XX).
      redisSetMock.mockResolvedValueOnce("OK");
      const { acquireKeywordLock } = await import("../keyword-lock");

      const got = await acquireKeywordLock("formation IA Paris", 1800, "job-abc");

      expect(got).toBe(true);
      expect(redisGetMock).toHaveBeenCalledWith("keyword-lock:formation ia paris");
      // 2e SET = rafraîchissement du TTL en mode XX (ne recrée pas la clé si expirée).
      expect(redisSetMock).toHaveBeenLastCalledWith(
        "keyword-lock:formation ia paris",
        "job-abc",
        "EX",
        1800,
        "XX",
      );
    });

    it("refuse toujours le lock d'un job CONCURRENT (token différent)", async () => {
      redisSetMock.mockResolvedValueOnce(null);
      redisGetMock.mockResolvedValueOnce("job-autre");
      const { acquireKeywordLock } = await import("../keyword-lock");

      const got = await acquireKeywordLock("formation IA Paris", 1800, "job-abc");

      expect(got).toBe(false);
    });

    it("sans token (appels historiques) : lock tenu = false, aucune inspection du propriétaire", async () => {
      redisSetMock.mockResolvedValueOnce(null);
      const { acquireKeywordLock } = await import("../keyword-lock");

      const got = await acquireKeywordLock("formation IA Paris");

      expect(got).toBe(false);
      expect(redisGetMock).not.toHaveBeenCalled();
    });

    it("fail-open si le GET propriétaire échoue (panne Redis à mi-chemin)", async () => {
      redisSetMock.mockResolvedValueOnce(null);
      redisGetMock.mockRejectedValueOnce(new Error("Redis down"));
      const { acquireKeywordLock } = await import("../keyword-lock");

      const got = await acquireKeywordLock("formation IA Paris", 1800, "job-abc");

      // Même politique que l'acquire : une panne Redis ne bloque pas le pipeline.
      expect(got).toBe(true);
    });

    it("exports KEYWORD_LOCK_TTL_SEC aligned with the default TTL", async () => {
      redisSetMock.mockResolvedValueOnce("OK");
      const { acquireKeywordLock, KEYWORD_LOCK_TTL_SEC } = await import("../keyword-lock");

      expect(KEYWORD_LOCK_TTL_SEC).toBe(1800);
      // Le défaut implicite (2e arg omis) doit rester égal à la constante exportée.
      await acquireKeywordLock("audit ia");
      expect(redisSetMock).toHaveBeenCalledWith(
        "keyword-lock:audit ia",
        "1",
        "EX",
        KEYWORD_LOCK_TTL_SEC,
        "NX",
      );
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
