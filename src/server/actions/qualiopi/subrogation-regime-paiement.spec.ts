/**
 * Garde SERVEUR de la subrogation après la réforme TVA (chantier OPCO A3).
 *
 * Quand le régime calculé vaut `remboursement_entreprise`, cocher ou garder la
 * subrogation exige la case « L'accord écrit de l'OPCO prévoit le paiement
 * direct à l'organisme ». Sans elle : refus nommé. Pour `inconnu` : un
 * avertissement, jamais un blocage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
}));

const { mockSessionFindUnique, mockSessionUpdate, mockDossierUpdate, mockLog, mockRegime } =
  vi.hoisted(() => ({
    mockSessionFindUnique: vi.fn(),
    mockSessionUpdate: vi.fn(),
    mockDossierUpdate: vi.fn(),
    mockLog: vi.fn(),
    mockRegime: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: mockSessionFindUnique, update: mockSessionUpdate },
    dossierFinancement: { update: mockDossierUpdate },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: mockLog,
}));

vi.mock("@/server/qualiopi/financements/regime-paiement-session", () => ({
  regimePaiementDeSession: mockRegime,
}));

import { setFinancementSessionAction } from "@/server/actions/qualiopi/financements";

const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const DOSSIER_ID = "44444444-4444-4444-8444-444444444444";

function regime(r: "subrogation_possible" | "remboursement_entreprise" | "inconnu") {
  return {
    regime: r,
    motif: "motif de test",
    source: "https://exemple.test",
    dossierId: DOSSIER_ID,
  };
}

describe("subrogation × régime de paiement OPCO — garde serveur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
    mockDossierUpdate.mockResolvedValue({ id: DOSSIER_ID });
  });

  it("🔴 REFUSE la subrogation en régime « remboursement entreprise » sans la case", async () => {
    mockRegime.mockResolvedValue(regime("remboursement_entreprise"));

    const r = await setFinancementSessionAction({ sessionId: SESSION_ID, opcoSubrogation: true });

    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toContain("Subrogation refusée");
    expect((r as { error: string }).error).toContain("accord écrit");
    expect(mockSessionUpdate).not.toHaveBeenCalled();
    expect(mockDossierUpdate).not.toHaveBeenCalled();
  });

  it("ACCEPTE avec la case, pose subrogationConfirmeeParAccord et trace au journal", async () => {
    mockRegime.mockResolvedValue(regime("remboursement_entreprise"));

    const r = await setFinancementSessionAction({
      sessionId: SESSION_ID,
      opcoSubrogation: true,
      accordPrevoitPaiementDirect: true,
    });

    expect(r).toEqual({ data: { id: SESSION_ID } });
    expect(mockDossierUpdate).toHaveBeenCalledWith({
      where: { id: DOSSIER_ID },
      data: { subrogationConfirmeeParAccord: true },
    });
    const trace = mockLog.mock.calls
      .map((c) => c[0])
      .find((e) => e.action === "qualiopi.financement.subrogation_confirmee_par_accord");
    expect(trace, "la confirmation n'est pas tracée").toBeDefined();
    expect(trace.targetType).toBe("DossierFinancement");
    expect(trace.targetId).toBe(DOSSIER_ID);
    // Aucune donnée personnelle : le régime et la session, rien d'autre.
    expect(Object.keys(trace.changes).sort()).toEqual(["regime", "sessionId"]);
    // La case ne s'écrit pas sur la session.
    expect(mockSessionUpdate.mock.calls[0]![0].data).not.toHaveProperty(
      "accordPrevoitPaiementDirect",
    );
  });

  it("régime « inconnu » : pas de blocage, un avertissement", async () => {
    mockRegime.mockResolvedValue(regime("inconnu"));

    const r = await setFinancementSessionAction({ sessionId: SESSION_ID, opcoSubrogation: true });

    expect("data" in r).toBe(true);
    expect((r as { data: { avertissement?: string } }).data.avertissement).toContain(
      "Régime de paiement OPCO non déterminé",
    );
    expect(mockSessionUpdate).toHaveBeenCalled();
  });

  it("régime « subrogation possible » : rien à confirmer", async () => {
    mockRegime.mockResolvedValue(regime("subrogation_possible"));

    const r = await setFinancementSessionAction({ sessionId: SESSION_ID, opcoSubrogation: true });

    expect(r).toEqual({ data: { id: SESSION_ID } });
    expect(mockDossierUpdate).not.toHaveBeenCalled();
  });

  it("décocher la subrogation ne consulte même pas le régime", async () => {
    const r = await setFinancementSessionAction({ sessionId: SESSION_ID, opcoSubrogation: false });

    expect(r).toEqual({ data: { id: SESSION_ID } });
    expect(mockRegime).not.toHaveBeenCalled();
  });
});
