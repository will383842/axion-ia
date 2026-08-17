/**
 * Tests — Server Action exporterManifesteAuditAction (T12 AGENT C).
 *
 * Stratégie :
 *   - Mock @/server/qualiopi/conformite/audit-dossier + _guards.
 *   - Vérifie : résultat nominal (json+markdown+filename), log activité,
 *     propagation d'erreur service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/qualiopi/conformite/audit-dossier", () => ({
  genererManifesteAudit: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { genererManifesteAudit } from "@/server/qualiopi/conformite/audit-dossier";
import { logQualiopiActivity, requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { exporterManifesteAuditAction } from "@/server/actions/qualiopi/conformite";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockGenererManifeste = genererManifesteAudit as ReturnType<typeof vi.fn>;

const MANIFESTE_STUB = {
  json: {
    meta: {
      genereAt: "2026-06-06T12:00:00.000Z",
      version: "RNQ-V9",
      nbIndicateurs: 32,
      nbCouverts: 20,
      nbApplicables: 29,
      scorePct: 69,
    },
    indicateurs: [],
  },
  markdown: "# Manifeste d'audit Qualiopi\n\nScore : 69 %",
};

// ─────────────────────────────────────────────────────────────────────────────
// exporterManifesteAuditAction
// ─────────────────────────────────────────────────────────────────────────────

describe("exporterManifesteAuditAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockGenererManifeste.mockResolvedValue(MANIFESTE_STUB);
  });

  it("retourne { data: { json, markdown, filename } }", async () => {
    const result = await exporterManifesteAuditAction();

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.json).toBeDefined();
    expect(typeof result.data.markdown).toBe("string");
    expect(typeof result.data.filename).toBe("string");
  });

  it("le markdown contient le contenu du service", async () => {
    const result = await exporterManifesteAuditAction();

    if (!("data" in result)) return;
    expect(result.data.markdown).toContain("Manifeste");
  });

  it("le filename commence par 'manifeste-audit-qualiopi-'", async () => {
    const result = await exporterManifesteAuditAction();

    if (!("data" in result)) return;
    expect(result.data.filename).toMatch(/^manifeste-audit-qualiopi-\d{4}-\d{2}-\d{2}$/);
  });

  it("délègue à genererManifesteAudit", async () => {
    await exporterManifesteAuditAction();

    expect(mockGenererManifeste).toHaveBeenCalledOnce();
  });

  it("logge qualiopi.manifeste_audit.export", async () => {
    await exporterManifesteAuditAction();

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockLogActivity.mock.calls[0]?.[0] as {
      action: string;
      targetType: string;
      changes: { scorePct: number };
    };
    expect(logCall.action).toBe("qualiopi.manifeste_audit.export");
    expect(logCall.targetType).toBe("ManifesteAudit");
    expect(logCall.changes.scorePct).toBe(69);
  });

  it("appelle requireAdminWrite avant de générer", async () => {
    await exporterManifesteAuditAction();

    expect(mockRequireAdminWrite).toHaveBeenCalledOnce();
  });

  it("retourne { error } si genererManifesteAudit lève", async () => {
    mockGenererManifeste.mockRejectedValue(new Error("DB unavailable"));

    await expect(exporterManifesteAuditAction()).rejects.toThrow("DB unavailable");
  });
});
