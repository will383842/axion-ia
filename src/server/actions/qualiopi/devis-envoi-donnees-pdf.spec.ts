/**
 * L'envoi d'un devis construit le PDF par `donneesPdfDevis`, la MÊME fonction
 * que l'aperçu du brouillon : l'aperçu montre ce qui partira.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockDonnees = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { devis: { findUnique: (...a: unknown[]) => mockFindUnique(...a) } },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));

// Interception : le bloc PDF est fail-soft, l'action poursuit puis échoue sur
// les mocks absents — le test ne regarde que l'appel.
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: vi.fn().mockResolvedValue({ contexte: true }),
  donneesPdfDevis: (...a: unknown[]) => mockDonnees(...a),
}));

import { sendDevisAction } from "./devis";

const DEVIS_ID = "550e8400-e29b-41d4-a716-446655440001";

beforeEach(() => {
  vi.clearAllMocks();
  mockDonnees.mockImplementation(() => {
    throw new Error("interception du test");
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("sendDevisAction — données du PDF", () => {
  it("appelle donneesPdfDevis avec le devis lu et le contexte", async () => {
    const devis = {
      id: DEVIS_ID,
      numero: "AXI-DEV-2026-001",
      clientId: "c1",
      statut: "brouillon",
      montantTotalHtCents: 150000,
      lignes: [],
      client: { type: "entreprise", raisonSociale: "Client SA" },
    };
    mockFindUnique.mockResolvedValue(devis);
    await sendDevisAction(DEVIS_ID).catch(() => undefined);
    expect(mockDonnees).toHaveBeenCalledOnce();
    const [d, ctx, maintenant] = mockDonnees.mock.calls[0] as [unknown, unknown, unknown];
    expect(d).toBe(devis);
    expect(ctx).toEqual({ contexte: true });
    expect(maintenant).toBeInstanceOf(Date);
  });
});
