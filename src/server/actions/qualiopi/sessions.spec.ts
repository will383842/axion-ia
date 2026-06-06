/**
 * Tests — transitionSessionAction (enforcement garde financement).
 *
 * Stratégie :
 *   - Mock @/lib/prisma pour simuler la session courante.
 *   - Mock @/server/qualiopi/financements/validation-service pour simuler
 *     les validations bloquantes.
 *   - Mock @/server/actions/qualiopi/_guards pour simuler l'authentification.
 *   - Mock @/server/qualiopi/formations/state-machine (no-throw par défaut).
 *   - Mock @/server/qualiopi/formations/transition-helper (no-op).
 *   - Mock @/server/qualiopi/formations/numbering (non utilisé ici).
 *   - Mock @/server/qualiopi/formations/formations (non utilisé ici).
 *
 * Cas couverts :
 *   1. Transition → en_cours avec alerte critique → retourne { error: ... }.
 *   2. Transition → en_cours sans alerte critique (warning only) → passe.
 *   3. Transition → en_cours sans aucune alerte → passe.
 *   4. Transition → annulee (pas en_cours) → pas de vérification financement.
 *   5. getFinancementValidations lève → fail-soft, transition non bloquée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockEnrollmentCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    enrollment: {
      count: (...args: unknown[]) => mockEnrollmentCount(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({
    userId: "user-admin-uuid",
    role: "super_admin",
  }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/formations/state-machine", () => ({
  assertSessionTransition: vi.fn(), // ne lève pas par défaut
}));

vi.mock("@/server/qualiopi/formations/transition-helper", () => ({
  writeSessionTransition: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/formations/numbering", () => ({
  allocateSessionNumero: vi.fn().mockResolvedValue("S-2026-001"),
}));

vi.mock("@/server/qualiopi/formations/formations", () => ({
  canCreateSessionFor: vi.fn().mockReturnValue(true),
}));

const mockGetFinancementValidations = vi.fn();

vi.mock("@/server/qualiopi/financements/validation-service", () => ({
  getFinancementValidations: (...args: unknown[]) => mockGetFinancementValidations(...args),
}));

import { transitionSessionAction } from "./sessions";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_ID = "aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb";

function makePlanifieeSession() {
  return { id: SESSION_ID, statut: "planifiee" };
}

// ─────────────────────────────────────────────────────────────────────────────
// transitionSessionAction — garde financement
// ─────────────────────────────────────────────────────────────────────────────

describe("transitionSessionAction — garde financement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : $transaction exécute le callback
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        trainingSession: { update: vi.fn().mockResolvedValue(undefined) },
        formationTransition: { create: vi.fn().mockResolvedValue(undefined) },
      });
    });
  });

  it("bloque la transition en_cours si une alerte critique existe", async () => {
    mockFindUnique.mockResolvedValue(makePlanifieeSession());
    mockGetFinancementValidations.mockResolvedValue([
      {
        code: "opco_accord",
        result: {
          ok: false,
          gravite: "critique",
          alerte: "Accord OPCO non reçu — JAMAIS commencer avant accord écrit.",
        },
      },
    ]);

    const result = await transitionSessionAction({
      id: SESSION_ID,
      toStatus: "en_cours",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/Démarrage bloqué/);
      expect(result.error).toMatch(/OPCO/);
    }
    // La transaction ne doit pas avoir été appelée
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("bloque si plusieurs alertes critiques (message concaténé)", async () => {
    mockFindUnique.mockResolvedValue(makePlanifieeSession());
    mockGetFinancementValidations.mockResolvedValue([
      {
        code: "opco_accord",
        result: { ok: false, gravite: "critique", alerte: "Accord OPCO manquant." },
      },
      {
        code: "cpf_edof",
        result: { ok: false, gravite: "critique", alerte: "EDOF non vérifié." },
      },
    ]);

    const result = await transitionSessionAction({ id: SESSION_ID, toStatus: "en_cours" });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/Accord OPCO manquant/);
      expect(result.error).toMatch(/EDOF non vérifié/);
    }
  });

  it("laisse passer la transition en_cours si seulement un avertissement (warning)", async () => {
    mockFindUnique.mockResolvedValue(makePlanifieeSession());
    mockGetFinancementValidations.mockResolvedValue([
      {
        code: "france_travail",
        result: { ok: false, gravite: "warning", alerte: "Dispositif AIF non renseigné." },
      },
    ]);

    const result = await transitionSessionAction({ id: SESSION_ID, toStatus: "en_cours" });

    // Pas d'erreur liée au financement ; la transaction doit avoir été tentée
    expect(mockTransaction).toHaveBeenCalled();
    // Si on arrive ici sans erreur financement, c'est ok (peut échouer sur state-machine mock)
    expect("error" in result ? result.error : "").not.toMatch(/Démarrage bloqué/);
  });

  it("laisse passer la transition en_cours si aucune alerte", async () => {
    mockFindUnique.mockResolvedValue(makePlanifieeSession());
    mockGetFinancementValidations.mockResolvedValue([
      { code: "opco_accord", result: { ok: true } },
      { code: "cpf_edof", result: { ok: true } },
      { code: "cpf_eligibilite", result: { ok: true } },
      { code: "france_travail", result: { ok: true } },
    ]);

    const result = await transitionSessionAction({ id: SESSION_ID, toStatus: "en_cours" });

    expect(mockTransaction).toHaveBeenCalled();
    if ("error" in result) {
      expect(result.error).not.toMatch(/Démarrage bloqué/);
    }
  });

  it("ne vérifie pas le financement pour une transition vers annulee", async () => {
    mockFindUnique.mockResolvedValue(makePlanifieeSession());

    await transitionSessionAction({ id: SESSION_ID, toStatus: "annulee" });

    // getFinancementValidations ne doit pas avoir été appelé
    expect(mockGetFinancementValidations).not.toHaveBeenCalled();
  });

  it("fail-soft si getFinancementValidations lève — la transition est quand même tentée", async () => {
    mockFindUnique.mockResolvedValue(makePlanifieeSession());
    mockGetFinancementValidations.mockRejectedValue(new Error("DB unavailable"));

    const result = await transitionSessionAction({ id: SESSION_ID, toStatus: "en_cours" });

    // Pas d'erreur financement : la transition a été tentée (transaction appelée)
    expect(mockTransaction).toHaveBeenCalled();
    if ("error" in result) {
      expect(result.error).not.toMatch(/Démarrage bloqué/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// transitionSessionAction — garde émargement à la clôture (R1 audit)
// ─────────────────────────────────────────────────────────────────────────────

describe("transitionSessionAction — garde émargement (realisee)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ id: SESSION_ID, statut: "en_cours" });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        trainingSession: { update: vi.fn().mockResolvedValue(undefined) },
        formationTransition: { create: vi.fn().mockResolvedValue(undefined) },
      });
    });
  });

  it("bloque la clôture s'il y a des inscrits mais aucun émargement", async () => {
    mockEnrollmentCount.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    const result = await transitionSessionAction({ id: SESSION_ID, toStatus: "realisee" });
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/Clôture bloquée/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("laisse clôturer si au moins un émargement est saisi", async () => {
    mockEnrollmentCount.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    const result = await transitionSessionAction({ id: SESSION_ID, toStatus: "realisee" });
    expect(mockTransaction).toHaveBeenCalled();
    if ("error" in result) expect(result.error).not.toMatch(/Clôture bloquée/);
  });

  it("laisse clôturer une session sans aucun inscrit", async () => {
    mockEnrollmentCount.mockResolvedValueOnce(0);
    const result = await transitionSessionAction({ id: SESSION_ID, toStatus: "realisee" });
    expect(mockTransaction).toHaveBeenCalled();
    if ("error" in result) expect(result.error).not.toMatch(/Clôture bloquée/);
  });
});
