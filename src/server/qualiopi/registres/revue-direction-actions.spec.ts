/**
 * Tests — Server Actions Revue de direction (T12 AGENT C).
 *
 * Stratégie :
 *   - Mock @/server/qualiopi/registres/revue-direction-service + _guards.
 *   - Vérifie : creerRevueDirectionAction, updateRevueDirectionAction.
 *   - Délégation totale au service (pas de Prisma direct).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/qualiopi/registres/revue-direction-service", () => ({
  creerRevue: vi.fn(),
  updateRevue: vi.fn(),
  reporterConstatRevue: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  creerRevue,
  updateRevue,
  reporterConstatRevue,
} from "@/server/qualiopi/registres/revue-direction-service";
import { logQualiopiActivity, requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import {
  creerRevueDirectionAction,
  updateRevueDirectionAction,
  reporterEnRevueDirectionAction,
} from "@/server/actions/qualiopi/revue-direction";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockCreerRevue = creerRevue as ReturnType<typeof vi.fn>;
const mockUpdateRevue = updateRevue as ReturnType<typeof vi.fn>;
const mockReporterConstat = reporterConstatRevue as ReturnType<typeof vi.fn>;

const REVUE_UUID = "550e8400-e29b-41d4-a716-446655440050";
const DATE_REVUE = new Date("2026-06-15T14:00:00.000Z");

// ─────────────────────────────────────────────────────────────────────────────
// creerRevueDirectionAction
// ─────────────────────────────────────────────────────────────────────────────

describe("creerRevueDirectionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockCreerRevue.mockResolvedValue({ id: REVUE_UUID, annee: 2026 });
  });

  it("retourne { data: { id, annee } } pour une revue valide", async () => {
    const result = await creerRevueDirectionAction({
      annee: 2026,
      dateRevue: DATE_REVUE,
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(REVUE_UUID);
    expect(result.data.annee).toBe(2026);
  });

  it("délègue à creerRevue avec l'année et la date", async () => {
    await creerRevueDirectionAction({ annee: 2026, dateRevue: DATE_REVUE });

    expect(mockCreerRevue).toHaveBeenCalledOnce();
    const [anneeArg, inputArg] = mockCreerRevue.mock.calls[0] as [number, { dateRevue: Date }];
    expect(anneeArg).toBe(2026);
    expect(inputArg.dateRevue).toStrictEqual(DATE_REVUE);
  });

  it("retourne { error: 'Une revue ... existe déjà' } sur P2002", async () => {
    mockCreerRevue.mockRejectedValue({ code: "P2002" });

    const result = await creerRevueDirectionAction({ annee: 2026, dateRevue: DATE_REVUE });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("2026");
  });

  it("retourne { error } générique sur erreur inattendue", async () => {
    mockCreerRevue.mockRejectedValue(new Error("DB down"));

    const result = await creerRevueDirectionAction({ annee: 2026, dateRevue: DATE_REVUE });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Erreur lors de la création de la revue de direction");
  });

  it("retourne { error } si annee est hors limites (< 2020)", async () => {
    const result = await creerRevueDirectionAction({
      annee: 1999,
      dateRevue: DATE_REVUE,
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("logge qualiopi.revue_direction.create", async () => {
    await creerRevueDirectionAction({ annee: 2026, dateRevue: DATE_REVUE });

    const logCall = mockLogActivity.mock.calls[0]?.[0] as {
      action: string;
      targetType: string;
      targetId: string;
    };
    expect(logCall.action).toBe("qualiopi.revue_direction.create");
    expect(logCall.targetType).toBe("RevueDirection");
    expect(logCall.targetId).toBe(REVUE_UUID);
  });

  it("ne logge pas si Zod échoue", async () => {
    await creerRevueDirectionAction({ annee: 1999, dateRevue: DATE_REVUE });

    expect(mockCreerRevue).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateRevueDirectionAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 2026-08-23 — ces quatre tests écrivaient `statut: "finalisee"`.
 *
 * Ce statut n'existe NULLE PART ailleurs : l'écran ne propose que
 * `brouillon` / `validee` / `archivee`, l'export PDF ne le connaît pas, et la
 * règle de couverture d'off.32 filtre sur `statut: "validee"`. Il passait parce
 * que le schéma Zod disait `z.string().max(20)` — donc une revue « finalisée »
 * pouvait exister en base et ne couvrir rien, sans que personne ne soit prévenu.
 * Le spec de l'action documentait ainsi, à son insu, le trou qu'il aurait dû
 * garder. Le statut est désormais un enum ; ces tests portent sur `archivee`,
 * qui est un vrai statut et n'appelle pas la garde de validation.
 */
describe("updateRevueDirectionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockUpdateRevue.mockResolvedValue({ id: REVUE_UUID });
  });

  it("retourne { data: { id } } pour une mise à jour valide", async () => {
    const result = await updateRevueDirectionAction({
      id: REVUE_UUID,
      statut: "archivee",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(REVUE_UUID);
  });

  it("délègue à updateRevue avec les bons champs", async () => {
    await updateRevueDirectionAction({ id: REVUE_UUID, statut: "archivee" });

    expect(mockUpdateRevue).toHaveBeenCalledOnce();
    const [idArg, inputArg] = mockUpdateRevue.mock.calls[0] as [string, { statut?: string }];
    expect(idArg).toBe(REVUE_UUID);
    expect(inputArg.statut).toBe("archivee");
  });

  it("retourne { error } si id n'est pas un UUID", async () => {
    const result = await updateRevueDirectionAction({ id: "pas-uuid", statut: "archivee" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("logge qualiopi.revue_direction.update", async () => {
    await updateRevueDirectionAction({ id: REVUE_UUID, statut: "archivee" });

    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.revue_direction.update");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reporterEnRevueDirectionAction (LOT 4)
// ─────────────────────────────────────────────────────────────────────────────

describe("reporterEnRevueDirectionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockReporterConstat.mockResolvedValue({
      id: REVUE_UUID,
      annee: new Date().getFullYear(),
      creee: false,
    });
  });

  it("reporte le constat sur l'année courante et retourne { data }", async () => {
    const result = await reporterEnRevueDirectionAction({
      texte: "Prévoir une pause supplémentaire l'après-midi.",
      source: "Verbatim satisfaction — session AXI-SES-2026-007",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(REVUE_UUID);
    expect(mockReporterConstat).toHaveBeenCalledOnce();
    const [annee, constat] = mockReporterConstat.mock.calls[0] as [
      number,
      { texte: string; source: string },
    ];
    expect(annee).toBe(new Date().getFullYear());
    expect(constat.texte).toContain("pause supplémentaire");
    expect(constat.source).toContain("AXI-SES-2026-007");
  });

  it("trace l'action dans l'audit log", async () => {
    await reporterEnRevueDirectionAction({ texte: "Constat", source: "Synthèse satisfaction" });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const arg = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(arg.action).toBe("qualiopi.revue_direction.reporter_constat");
  });

  it("rejette un texte vide (Zod)", async () => {
    const result = await reporterEnRevueDirectionAction({ texte: "", source: "Synthèse" });
    expect(result).toEqual({ error: "Données invalides" });
    expect(mockReporterConstat).not.toHaveBeenCalled();
  });

  it("retourne { error } si le service lève", async () => {
    mockReporterConstat.mockRejectedValue(new Error("DB down"));
    const result = await reporterEnRevueDirectionAction({ texte: "Constat", source: "Synthèse" });
    expect(result).toEqual({ error: "Erreur lors du report en revue de direction" });
  });
});
