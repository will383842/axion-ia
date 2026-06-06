/**
 * Tests — Server Actions Appreciations + Traitement RGPD (AGENT B — T14).
 *
 * Strategie :
 *   - Mock @/lib/prisma (rgpdDemande.findUnique, rgpdDemande.update)
 *   - Mock @/server/actions/qualiopi/_guards
 *   - Mock services AGENT A (appreciation-service, rgpd-service)
 *   - Verifie : creerAppreciationAction (admin), traiterDemandeRgpdAction (admin)
 */

import { describe, it, expect, vi, beforeEach, assert } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks declares AVANT tout import des modules testes
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rgpdDemande: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid-1" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/portail/appreciation-service", () => ({
  creerAppreciation: vi.fn(),
  listAppreciations: vi.fn().mockResolvedValue([]),
  statsAppreciations: vi.fn().mockResolvedValue({
    global: { count: 0, moyenne: null },
    parSource: {
      stagiaire: { count: 0, moyenne: null },
      entreprise: { count: 0, moyenne: null },
      financeur: { count: 0, moyenne: null },
      formateur: { count: 0, moyenne: null },
    },
  }),
}));

vi.mock("@/server/qualiopi/portail/rgpd-service", () => ({
  exporterDonneesStagiaire: vi.fn(),
  supprimerStagiaire: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (apres mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { creerAppreciation } from "@/server/qualiopi/portail/appreciation-service";
import {
  exporterDonneesStagiaire,
  supprimerStagiaire,
} from "@/server/qualiopi/portail/rgpd-service";
import { prisma } from "@/lib/prisma";
import {
  creerAppreciationAction,
  traiterDemandeRgpdAction,
} from "@/server/actions/qualiopi/appreciations";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockCall<T>(fn: ReturnType<typeof vi.fn>, callIndex = 0): T {
  const call = fn.mock.calls[callIndex];
  assert(call !== undefined, `mockCall: aucun appel a l'index ${callIndex}`);
  return call[0] as T;
}

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockCreerAppreciation = creerAppreciation as ReturnType<typeof vi.fn>;
const mockExporterDonnees = exporterDonneesStagiaire as ReturnType<typeof vi.fn>;
const mockSupprimerStagiaire = supprimerStagiaire as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  rgpdDemande: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const TRAINEE_UUID = "550e8400-e29b-41d4-a716-446655440001";
const DEMANDE_UUID = "550e8400-e29b-41d4-a716-446655440003";
const APP_UUID = "550e8400-e29b-41d4-a716-446655440004";
const ENROLLMENT_UUID = "550e8400-e29b-41d4-a716-446655440005";
const DATE_APPR = new Date("2026-06-01");

// ─────────────────────────────────────────────────────────────────────────────
// creerAppreciationAction
// ─────────────────────────────────────────────────────────────────────────────

describe("creerAppreciationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid-1" });
    mockLogActivity.mockResolvedValue(undefined);
    mockCreerAppreciation.mockResolvedValue({ id: APP_UUID });
  });

  it("retourne { data: { id } } pour une appreciation valide", async () => {
    const result = await creerAppreciationAction({
      source: "stagiaire",
      traineeId: TRAINEE_UUID,
      note: 4,
      commentaire: "Excellent formateur",
      dateAppreciation: DATE_APPR,
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(APP_UUID);
  });

  it("appelle creerAppreciation avec les bons parametres", async () => {
    await creerAppreciationAction({
      source: "entreprise",
      enrollmentId: ENROLLMENT_UUID,
      note: 5,
      dateAppreciation: DATE_APPR,
    });

    expect(mockCreerAppreciation).toHaveBeenCalledOnce();
    const call = mockCall<{
      source: string;
      enrollmentId: string;
      note: number;
    }>(mockCreerAppreciation);
    expect(call.source).toBe("entreprise");
    expect(call.enrollmentId).toBe(ENROLLMENT_UUID);
    expect(call.note).toBe(5);
  });

  it("ne transmet pas les champs optionnels absents (exactOptionalPropertyTypes)", async () => {
    await creerAppreciationAction({
      source: "financeur",
      dateAppreciation: DATE_APPR,
    });

    const call = mockCall<Record<string, unknown>>(mockCreerAppreciation);
    expect("note" in call).toBe(false);
    expect("commentaire" in call).toBe(false);
    expect("enrollmentId" in call).toBe(false);
    expect("traineeId" in call).toBe(false);
  });

  it("logge l'activite admin avec la bonne action", async () => {
    await creerAppreciationAction({
      source: "formateur",
      note: 3,
      dateAppreciation: DATE_APPR,
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.appreciations.creer");
    expect(logCall.targetType).toBe("Appreciation");
    expect(logCall.targetId).toBe(APP_UUID);
  });

  it("retourne { error } si source est invalide", async () => {
    const result = await creerAppreciationAction({
      source: "inconnu" as never,
      dateAppreciation: DATE_APPR,
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si note hors plage [1..5]", async () => {
    const result = await creerAppreciationAction({
      source: "stagiaire",
      note: 6,
      dateAppreciation: DATE_APPR,
    });

    expect("error" in result).toBe(true);
  });

  it("ne logge pas si la validation Zod echoue", async () => {
    await creerAppreciationAction({ source: "invalide" as never, dateAppreciation: DATE_APPR });

    expect(mockCreerAppreciation).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// traiterDemandeRgpdAction
// ─────────────────────────────────────────────────────────────────────────────

describe("traiterDemandeRgpdAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid-1" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.rgpdDemande.update.mockResolvedValue({});
  });

  describe("type=export", () => {
    beforeEach(() => {
      mockPrisma.rgpdDemande.findUnique.mockResolvedValue({
        id: DEMANDE_UUID,
        traineeId: TRAINEE_UUID,
        type: "export",
        statut: "demandee",
      });
      mockExporterDonnees.mockResolvedValue({ stagiaire: { nom: "Martin" } });
    });

    it("retourne { data: { type, exportData } } pour un export", async () => {
      const result = await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      expect("data" in result).toBe(true);
      if (!("data" in result)) return;
      expect(result.data.type).toBe("export");
      expect(result.data.exportData).toBeDefined();
    });

    it("appelle exporterDonneesStagiaire avec le traineeId", async () => {
      await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      expect(mockExporterDonnees).toHaveBeenCalledOnce();
      expect(mockExporterDonnees).toHaveBeenCalledWith(TRAINEE_UUID);
    });

    it("marque la demande comme traitee", async () => {
      await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      expect(mockPrisma.rgpdDemande.update).toHaveBeenCalledOnce();
      const call = mockCall<{ data: { statut: string; traiteeAt: Date } }>(
        mockPrisma.rgpdDemande.update,
      );
      expect(call.data.statut).toBe("traitee");
      expect(call.data.traiteeAt).toBeInstanceOf(Date);
    });

    it("logge l'activite avec qualiopi.rgpd.traiter.export", async () => {
      await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      expect(mockLogActivity).toHaveBeenCalledOnce();
      const logCall = mockCall<{ action: string }>(mockLogActivity);
      expect(logCall.action).toBe("qualiopi.rgpd.traiter.export");
    });

    it("ne fait PAS appel a supprimerStagiaire pour un export", async () => {
      await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      expect(mockSupprimerStagiaire).not.toHaveBeenCalled();
    });
  });

  describe("type=suppression", () => {
    beforeEach(() => {
      mockPrisma.rgpdDemande.findUnique.mockResolvedValue({
        id: DEMANDE_UUID,
        traineeId: TRAINEE_UUID,
        type: "suppression",
        statut: "demandee",
      });
      mockSupprimerStagiaire.mockResolvedValue(undefined);
    });

    it("appelle supprimerStagiaire (soft-delete + anonymisation)", async () => {
      await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      expect(mockSupprimerStagiaire).toHaveBeenCalledOnce();
      expect(mockSupprimerStagiaire).toHaveBeenCalledWith(TRAINEE_UUID);
    });

    it("ne retourne PAS exportData pour une suppression", async () => {
      const result = await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      if (!("data" in result)) return;
      expect(result.data.exportData).toBeUndefined();
    });

    it("logge l'activite avec qualiopi.rgpd.traiter.suppression", async () => {
      await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      const logCall = mockCall<{ action: string }>(mockLogActivity);
      expect(logCall.action).toBe("qualiopi.rgpd.traiter.suppression");
    });
  });

  describe("erreurs", () => {
    it("retourne { error } si demande introuvable", async () => {
      mockPrisma.rgpdDemande.findUnique.mockResolvedValue(null);

      const result = await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      expect("error" in result).toBe(true);
      if (!("error" in result)) return;
      expect(result.error).toBe("Demande RGPD introuvable");
    });

    it("retourne { error } si demande deja traitee", async () => {
      mockPrisma.rgpdDemande.findUnique.mockResolvedValue({
        id: DEMANDE_UUID,
        traineeId: TRAINEE_UUID,
        type: "export",
        statut: "traitee",
      });

      const result = await traiterDemandeRgpdAction({ demandeId: DEMANDE_UUID });

      expect("error" in result).toBe(true);
    });

    it("retourne { error } si demandeId n'est pas un UUID", async () => {
      const result = await traiterDemandeRgpdAction({ demandeId: "pas-uuid" });

      expect("error" in result).toBe(true);
      expect(mockPrisma.rgpdDemande.findUnique).not.toHaveBeenCalled();
    });
  });
});
