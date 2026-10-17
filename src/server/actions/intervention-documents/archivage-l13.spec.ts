/**
 * CHANTIER QNC, L13 — un brouillon de version du hub Documents s'ARCHIVE au
 * lieu d'être supprimé (ligne et fichiers R2 gardés). Éteint : comme avant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  setting: { findUnique: vi.fn() },
  interventionDocumentVersion: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  activityLog: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "admin-1", email: "", role: "admin" })),
  requireAdminPublish: vi.fn(),
}));
const r2 = vi.hoisted(() => ({ deleteFromR2: vi.fn(), isR2Configured: vi.fn(() => true) }));
vi.mock("@/lib/r2-storage", () => ({ ...r2, getSignedUploadUrlR2: vi.fn() }));
vi.mock("@/server/intervention-documents/notifications", () => ({ notifyNewVersion: vi.fn() }));

import { discardDraftAction } from "./documents.actions";

const V = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  db.interventionDocumentVersion.findUnique.mockResolvedValue({
    id: V,
    documentId: "d",
    version: 3,
    statut: "brouillon",
    sourceKey: "k/source.pptx",
    pdfKey: "k/v3.pdf",
  });
  db.activityLog.create.mockResolvedValue({});
});

describe("annuler un brouillon de version", () => {
  it("actif : le brouillon est archivé, ni la ligne ni les fichiers ne sont effacés", async () => {
    db.setting.findUnique.mockResolvedValue({ value: { etat: "actif" } });
    expect(await discardDraftAction({ versionId: V })).toEqual({ ok: true });
    expect(db.interventionDocumentVersion.update).toHaveBeenCalledWith({
      where: { id: V },
      data: { statut: "archive" },
    });
    expect(db.interventionDocumentVersion.delete).not.toHaveBeenCalled();
    expect(r2.deleteFromR2).not.toHaveBeenCalled();
  });

  it("éteint : comme avant le lot", async () => {
    db.setting.findUnique.mockResolvedValue(null);
    expect(await discardDraftAction({ versionId: V })).toEqual({ ok: true });
    expect(db.interventionDocumentVersion.delete).toHaveBeenCalledTimes(1);
    expect(r2.deleteFromR2).toHaveBeenCalledTimes(2);
  });
});
