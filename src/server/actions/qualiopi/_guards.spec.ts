/**
 * Tests — logQualiopiActivity (CLUSTER 4 — A-02 RGPD).
 *
 * Vérifie :
 *   - L'IP est hachée via hashIp avant stockage (jamais en clair).
 *   - ipAddress absente → null stocké.
 *   - Fail-soft : une erreur prisma ne remonte pas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: { create: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/security/ip-hash", () => ({
  hashIp: vi.fn((ip: string | null | undefined) => (ip ? `hashed:${ip}` : null)),
}));

vi.mock("@/server/actions/knowledge/_guards", () => ({
  requireAdminRead: vi.fn(),
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireAdminPublish: vi.fn(),
  requireAdminDelete: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockHeaders = headers as ReturnType<typeof vi.fn>;
const mockActivityCreate = (
  prisma as unknown as { activityLog: { create: ReturnType<typeof vi.fn> } }
).activityLog.create;
const mockHashIp = hashIp as ReturnType<typeof vi.fn>;

function makeHeadersMap(overrides: Record<string, string> = {}): {
  get: (k: string) => string | null;
} {
  return {
    get: (key: string) => overrides[key] ?? null,
  };
}

const SESSION = { userId: "admin-uuid-1", role: "admin" as const };

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("logQualiopiActivity — A-02 RGPD : hachage IP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivityCreate.mockResolvedValue({});
  });

  it("hache l'IP x-forwarded-for avant stockage (jamais en clair)", async () => {
    mockHeaders.mockResolvedValue(makeHeadersMap({ "x-forwarded-for": "1.2.3.4" }));

    await logQualiopiActivity({
      action: "qualiopi.test.action",
      session: SESSION,
    });

    expect(mockHashIp).toHaveBeenCalledWith("1.2.3.4");
    const createCall = mockActivityCreate.mock.calls[0]?.[0] as { data: { ipAddress: string } };
    expect(createCall.data.ipAddress).toBe("hashed:1.2.3.4");
  });

  // 🔴 Retourné le 2026-09-25 (plan « IP client unifiée »). Ce test disait
  // « cf-connecting-ip si x-forwarded-for absent » : l'en-tête était cru SEUL.
  // Or l'origine répond aussi sans Cloudflare, donc il se forge. Il n'est cru
  // désormais que si la connexion (`x-real-ip`) vient d'un relais Cloudflare —
  // la forme exacte des requêtes réelles en production.
  it("derrière Cloudflare : hache l'IP du VISITEUR (cf-connecting-ip), pas celle du relais", async () => {
    mockHeaders.mockResolvedValue(
      makeHeadersMap({ "x-real-ip": "162.159.122.108", "cf-connecting-ip": "5.6.7.8" }),
    );

    await logQualiopiActivity({
      action: "qualiopi.test.action",
      session: SESSION,
    });

    expect(mockHashIp).toHaveBeenCalledWith("5.6.7.8");
  });

  it("🔴 cf-connecting-ip SEUL (origine contournée) n'est jamais cru", async () => {
    mockHeaders.mockResolvedValue(makeHeadersMap({ "cf-connecting-ip": "5.6.7.8" }));

    await logQualiopiActivity({
      action: "qualiopi.test.action",
      session: SESSION,
    });

    expect(mockHashIp).not.toHaveBeenCalledWith("5.6.7.8");
    expect(mockHashIp).toHaveBeenCalledWith(null);
  });

  it("stocke null si aucune IP dans les headers", async () => {
    mockHeaders.mockResolvedValue(makeHeadersMap({}));

    await logQualiopiActivity({
      action: "qualiopi.test.action",
      session: SESSION,
    });

    expect(mockHashIp).toHaveBeenCalledWith(null);
    const createCall = mockActivityCreate.mock.calls[0]?.[0] as { data: { ipAddress: null } };
    expect(createCall.data.ipAddress).toBeNull();
  });

  it("n'expose jamais l'IP brute dans ActivityLog.ipAddress", async () => {
    mockHeaders.mockResolvedValue(makeHeadersMap({ "x-real-ip": "10.0.0.1" }));

    await logQualiopiActivity({
      action: "qualiopi.test.action",
      session: SESSION,
    });

    const createCall = mockActivityCreate.mock.calls[0]?.[0] as { data: { ipAddress: string } };
    // La valeur stockée ne doit PAS être l'IP brute
    expect(createCall.data.ipAddress).not.toBe("10.0.0.1");
    expect(createCall.data.ipAddress).toBe("hashed:10.0.0.1");
  });

  it("fail-soft : une erreur prisma ne remonte pas", async () => {
    mockHeaders.mockResolvedValue(makeHeadersMap({ "x-forwarded-for": "1.2.3.4" }));
    mockActivityCreate.mockRejectedValue(new Error("DB offline"));

    await expect(
      logQualiopiActivity({
        action: "qualiopi.test.action",
        session: SESSION,
      }),
    ).resolves.toBeUndefined();
  });

  it("stocke le bon action, adminUserId, targetType et targetId", async () => {
    mockHeaders.mockResolvedValue(makeHeadersMap({}));

    await logQualiopiActivity({
      action: "qualiopi.formation.publish",
      targetType: "Formation",
      targetId: "form-uuid-1",
      changes: { slug: "ma-formation" },
      session: SESSION,
    });

    const createCall = mockActivityCreate.mock.calls[0]?.[0] as {
      data: { action: string; adminUserId: string; targetType: string; targetId: string };
    };
    expect(createCall.data.action).toBe("qualiopi.formation.publish");
    expect(createCall.data.adminUserId).toBe("admin-uuid-1");
    expect(createCall.data.targetType).toBe("Formation");
    expect(createCall.data.targetId).toBe("form-uuid-1");
  });
});
