/**
 * Tests — Server Actions Financements + Facturation (T11 AGENT B).
 *
 * Stratégie :
 *   - Mock `@/lib/prisma` + `@/server/actions/qualiopi/_guards`
 *     (requireAdminWrite + logQualiopiActivity).
 *   - Vérifie les flux principaux + bloquants métier :
 *       OPCO accord, CPF EDOF, subrogation dossier, validations FT.
 *   - Pas d'import `next/headers` en test (mocké via _guards).
 *
 * Couverture T11 :
 *   setFinancementSessionAction    ✓
 *   validerAccordOpcoAction        ✓
 *   genererFactureFormationAction  ✓ (validations bloquantes + cas nominal)
 *   setMoyensFormationAction       ✓
 *   verifierSousTraitantAction     ✓
 *   exportComptaCsvAction          ✓
 */

import { describe, it, expect, vi, beforeEach, assert } from "vitest";

/** Accès sûr à un appel de mock (lève si absent). */
function mockCall<T>(fn: ReturnType<typeof vi.fn>, callIndex = 0): T {
  const call = fn.mock.calls[callIndex];
  assert(call !== undefined, `mockCall: aucun appel à l'index ${callIndex}`);
  return call[0] as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks déclarés AVANT tout import des modules testés
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    factureFormation: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    formation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    trainer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-test-id" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (après mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

import {
  setFinancementSessionAction,
  validerAccordOpcoAction,
  genererFactureFormationAction,
  setMoyensFormationAction,
  verifierSousTraitantAction,
  exportComptaCsvAction,
} from "@/server/actions/qualiopi/financements";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers typés
// ─────────────────────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  trainingSession: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  factureFormation: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  formation: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  trainer: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;

// UUIDs valides pour les tests
const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440000";
const FORMATION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const TRAINER_UUID = "550e8400-e29b-41d4-a716-446655440002";
const FACTURE_UUID = "550e8400-e29b-41d4-a716-446655440003";

/** Session de base pour les tests de facturation */
function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_UUID,
    financementType: "opco",
    opcoStatut: "accord_recu",
    opcoSubrogation: false,
    numeroDossierOpco: null,
    edofVerifieAt: null,
    montantHtCents: 150000, // 1500 €
    dureeReelleHeures: 7,
    nbParticipantsReels: 5,
    nbParticipantsPrevus: 6,
    modalite: "presentiel",
    titreSession: "IA pour les équipes commerciales",
    numero: "AXI-SESS-2026-001",
    ftDispositif: null,
    ftAifPrescriptionDate: null,
    ftPoeiAccordFinancementAt: null,
    ftPoeiEngagementSigneAt: null,
    statut: "planifiee",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// setFinancementSessionAction
// ─────────────────────────────────────────────────────────────────────────────

describe("setFinancementSessionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.trainingSession.findUnique.mockResolvedValue({ id: SESSION_UUID });
    mockPrisma.trainingSession.update.mockResolvedValue({ id: SESSION_UUID });
  });

  it("retourne { data: { id } } pour une mise à jour valide", async () => {
    const result = await setFinancementSessionAction({
      sessionId: SESSION_UUID,
      financementType: "opco",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(SESSION_UUID);
  });

  it("met à jour uniquement les champs fournis (spread conditionnel)", async () => {
    await setFinancementSessionAction({
      sessionId: SESSION_UUID,
      opcoStatut: "accord_recu",
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.trainingSession.update,
    );
    expect(updateCall.data["opcoStatut"]).toBe("accord_recu");
    expect("financementType" in updateCall.data).toBe(false);
  });

  it("ne passe pas les champs optionnels absents (exactOptionalPropertyTypes)", async () => {
    await setFinancementSessionAction({
      sessionId: SESSION_UUID,
      opcoSubrogation: true,
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.trainingSession.update,
    );
    expect(updateCall.data["opcoSubrogation"]).toBe(true);
    expect("financementType" in updateCall.data).toBe(false);
    expect("numeroDossierOpco" in updateCall.data).toBe(false);
  });

  it("retourne { error } si sessionId invalide", async () => {
    const result = await setFinancementSessionAction({
      sessionId: "pas-un-uuid",
      financementType: "opco",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si financementType invalide", async () => {
    const result = await setFinancementSessionAction({
      sessionId: SESSION_UUID,
      financementType: "inconnu" as "opco",
    });

    expect("error" in result).toBe(true);
  });

  it("logge l'activité avec le bon action", async () => {
    await setFinancementSessionAction({
      sessionId: SESSION_UUID,
      financementType: "cpf",
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.financement.set");
    expect(logCall.targetType).toBe("TrainingSession");
    expect(logCall.targetId).toBe(SESSION_UUID);
  });

  it("accepte conventionTripartiteSigneeAt comme Date", async () => {
    const date = new Date("2026-06-10T10:00:00.000Z");
    await setFinancementSessionAction({
      sessionId: SESSION_UUID,
      conventionTripartiteSigneeAt: date,
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.trainingSession.update,
    );
    expect(updateCall.data["conventionTripartiteSigneeAt"]).toBeInstanceOf(Date);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validerAccordOpcoAction
// ─────────────────────────────────────────────────────────────────────────────

describe("validerAccordOpcoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      id: SESSION_UUID,
      financementType: "opco",
      opcoStatut: "demande_en_cours",
    });
    mockPrisma.trainingSession.update.mockResolvedValue({ id: SESSION_UUID });
  });

  it("retourne { data: { id } } pour une session OPCO", async () => {
    const result = await validerAccordOpcoAction({ sessionId: SESSION_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(SESSION_UUID);
  });

  it("met opcoStatut=accord_recu", async () => {
    await validerAccordOpcoAction({ sessionId: SESSION_UUID });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.trainingSession.update,
    );
    expect(updateCall.data["opcoStatut"]).toBe("accord_recu");
  });

  it("retourne { error } si la session n'est pas OPCO", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      id: SESSION_UUID,
      financementType: "direct",
      opcoStatut: "non_demande",
    });

    const result = await validerAccordOpcoAction({ sessionId: SESSION_UUID });

    expect("error" in result).toBe(true);
  });

  it("retourne { error } si session introuvable", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);

    const result = await validerAccordOpcoAction({ sessionId: SESSION_UUID });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Session introuvable");
  });

  it("retourne { error } si sessionId invalide", async () => {
    const result = await validerAccordOpcoAction({ sessionId: "pas-un-uuid" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("logge l'activité avec l'action correcte", async () => {
    await validerAccordOpcoAction({ sessionId: SESSION_UUID });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string }>(mockLogActivity);
    expect(logCall.action).toBe("qualiopi.financement.opco.accord_recu");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// genererFactureFormationAction
// ─────────────────────────────────────────────────────────────────────────────

describe("genererFactureFormationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.trainingSession.findUnique.mockResolvedValue(makeSession());
    mockPrisma.factureFormation.count.mockResolvedValue(2); // seq = 3 → AXI-FACT-2026-003
    mockPrisma.factureFormation.create.mockResolvedValue({
      id: FACTURE_UUID,
      numero: "AXI-FACT-2026-003",
      documentId: null,
    });
  });

  it("retourne { data } avec factureId, numero, documentId=null (cas nominal)", async () => {
    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.factureId).toBe(FACTURE_UUID);
    expect(result.data.numero).toBe("AXI-FACT-2026-003");
    expect(result.data.documentId).toBeNull();
  });

  it("crée la facture avec tvaExoneree=true (art. 261-4-4° CGI)", async () => {
    await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    const createCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.factureFormation.create,
    );
    expect(createCall.data["tvaExoneree"]).toBe(true);
  });

  // ── BLOQUANT : OPCO accord ────────────────────────────────────────────────

  it("BLOQUANT OPCO : refuse si opcoStatut != accord_recu (demande_en_cours)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({ financementType: "opco", opcoStatut: "demande_en_cours" }),
    );

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "forfait",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/accord OPCO/i);
  });

  it("BLOQUANT OPCO : refuse si opcoStatut=refuse", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({ financementType: "opco", opcoStatut: "refuse" }),
    );

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "forfait",
    });

    expect("error" in result).toBe(true);
  });

  it("autorise si opcoStatut=paiement_recu", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({ financementType: "opco", opcoStatut: "paiement_recu" }),
    );

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "forfait",
    });

    expect("data" in result).toBe(true);
  });

  // ── BLOQUANT : CPF/EDOF ───────────────────────────────────────────────────

  it("BLOQUANT CPF : refuse si edofVerifieAt=null", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({ financementType: "cpf", opcoStatut: "non_demande", edofVerifieAt: null }),
    );

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "stagiaire",
      ventilation: "forfait",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/EDOF/i);
  });

  it("CPF autorisé si edofVerifieAt renseigné", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({
        financementType: "cpf",
        opcoStatut: "non_demande",
        edofVerifieAt: new Date("2026-05-01"),
      }),
    );

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "stagiaire",
      ventilation: "forfait",
    });

    expect("data" in result).toBe(true);
  });

  // ── BLOQUANT : subrogation sans dossier ──────────────────────────────────

  it("BLOQUANT subrogation : refuse si numeroDossierOpco absent", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({
        financementType: "opco",
        opcoStatut: "accord_recu",
        opcoSubrogation: true,
        numeroDossierOpco: null,
      }),
    );

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "forfait",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/subrogation/i);
  });

  it("subrogation autorisée si numeroDossierOpco renseigné", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({
        financementType: "opco",
        opcoStatut: "accord_recu",
        opcoSubrogation: true,
        numeroDossierOpco: "DOSSIER-2026-001",
      }),
    );

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "forfait",
    });

    expect("data" in result).toBe(true);
  });

  it("subrogation : destinataire forcé à 'opco' même si entreprise passé", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({
        financementType: "opco",
        opcoStatut: "accord_recu",
        opcoSubrogation: true,
        numeroDossierOpco: "DOSSIER-2026-001",
      }),
    );

    await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "entreprise", // forcé → opco
      ventilation: "forfait",
    });

    const createCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.factureFormation.create,
    );
    expect(createCall.data["destinataire"]).toBe("opco");
    expect(createCall.data["subrogation"]).toBe(true);
  });

  // ── Ventilation ───────────────────────────────────────────────────────────

  it("ventilation forfait : lignes avec montantHtCents de la session", async () => {
    await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    const createCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.factureFormation.create,
    );
    expect(createCall.data["montantHtCents"]).toBe(150000);
  });

  it("ventilation horaire : refuse si dureeReelleHeures=0", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(makeSession({ dureeReelleHeures: 0 }));

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "horaire",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/durée/i);
  });

  it("ventilation horaire : crée la facture si dureeReelleHeures renseigné", async () => {
    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "horaire",
    });

    expect("data" in result).toBe(true);
  });

  // ── Cas d'erreur ──────────────────────────────────────────────────────────

  it("retourne { error } si session introuvable", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Session introuvable");
  });

  it("retourne { error } si sessionId invalide", async () => {
    const result = await genererFactureFormationAction({
      sessionId: "pas-un-uuid",
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si destinataire invalide", async () => {
    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "inconnu" as "entreprise",
      ventilation: "forfait",
    });

    expect("error" in result).toBe(true);
  });

  it("logge l'activité après création de la facture", async () => {
    await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.facture.generer");
    expect(logCall.targetType).toBe("FactureFormation");
    expect(logCall.targetId).toBe(FACTURE_UUID);
  });

  it("ne logge pas si validation échoue", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({ financementType: "opco", opcoStatut: "non_demande" }),
    );

    await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "forfait",
    });

    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setMoyensFormationAction
// ─────────────────────────────────────────────────────────────────────────────

describe("setMoyensFormationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.formation.findUnique.mockResolvedValue({ id: FORMATION_UUID });
    mockPrisma.formation.update.mockResolvedValue({ id: FORMATION_UUID });
  });

  it("retourne { data: { id } } pour une mise à jour valide", async () => {
    const result = await setMoyensFormationAction({
      formationId: FORMATION_UUID,
      moyensTechniques: "PC fourni + accès LMS dédié",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(FORMATION_UUID);
  });

  it("met à jour moyensTechniques uniquement si fourni", async () => {
    await setMoyensFormationAction({
      formationId: FORMATION_UUID,
      moyensTechniques: "Salle équipée",
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(mockPrisma.formation.update);
    expect(updateCall.data["moyensTechniques"]).toBe("Salle équipée");
    expect("ressourcesPedagogiques" in updateCall.data).toBe(false);
  });

  it("met à jour ressourcesPedagogiques uniquement si fourni", async () => {
    const ressources = [{ type: "pdf", url: "https://example.com/support.pdf" }];
    await setMoyensFormationAction({
      formationId: FORMATION_UUID,
      ressourcesPedagogiques: ressources,
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(mockPrisma.formation.update);
    expect("moyensTechniques" in updateCall.data).toBe(false);
  });

  it("retourne { error } si aucun champ fourni", async () => {
    const result = await setMoyensFormationAction({
      formationId: FORMATION_UUID,
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Aucun champ à mettre à jour");
  });

  it("retourne { error } si formationId invalide", async () => {
    const result = await setMoyensFormationAction({
      formationId: "pas-un-uuid",
      moyensTechniques: "test",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("logge l'activité avec l'action correcte", async () => {
    await setMoyensFormationAction({
      formationId: FORMATION_UUID,
      moyensTechniques: "Test",
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.formation.moyens.set");
    expect(logCall.targetType).toBe("Formation");
    expect(logCall.targetId).toBe(FORMATION_UUID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifierSousTraitantAction
// ─────────────────────────────────────────────────────────────────────────────

describe("verifierSousTraitantAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.trainer.update.mockResolvedValue({ id: TRAINER_UUID });
  });

  it("retourne { data: { id } } pour un formateur valide", async () => {
    const result = await verifierSousTraitantAction({
      trainerId: TRAINER_UUID,
      sousTraitantNda: "NDA-2026-001",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(TRAINER_UUID);
  });

  it("met à jour sousTraitantVerifieAt=now et sousTraitantNda", async () => {
    await verifierSousTraitantAction({
      trainerId: TRAINER_UUID,
      sousTraitantNda: "NDA-2026-001",
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(mockPrisma.trainer.update);
    expect(updateCall.data["sousTraitantNda"]).toBe("NDA-2026-001");
    expect(updateCall.data["sousTraitantVerifieAt"]).toBeInstanceOf(Date);
  });

  it("retourne { error } si trainerId invalide", async () => {
    const result = await verifierSousTraitantAction({
      trainerId: "pas-un-uuid",
      sousTraitantNda: "NDA-2026-001",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si sousTraitantNda trop long (>20 chars)", async () => {
    const result = await verifierSousTraitantAction({
      trainerId: TRAINER_UUID,
      sousTraitantNda: "A".repeat(21),
    });

    expect("error" in result).toBe(true);
  });

  it("logge l'activité avec l'action correcte", async () => {
    await verifierSousTraitantAction({
      trainerId: TRAINER_UUID,
      sousTraitantNda: "NDA-2026-001",
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.trainer.sous_traitant.verifie");
    expect(logCall.targetType).toBe("Trainer");
    expect(logCall.targetId).toBe(TRAINER_UUID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// exportComptaCsvAction
// ─────────────────────────────────────────────────────────────────────────────

describe("exportComptaCsvAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.factureFormation.findMany.mockResolvedValue([
      {
        numero: "AXI-FACT-2026-001",
        emiseAt: new Date("2026-03-15T10:00:00.000Z"),
        destinataire: "entreprise",
        destinataireNom: "Acme SA",
        montantHtCents: 150000,
        tvaExoneree: true,
        statut: "emise",
        session: { numero: "AXI-SESS-2026-001", titreSession: "IA pour les équipes" },
      },
      {
        numero: "AXI-FACT-2026-002",
        emiseAt: null,
        destinataire: "opco",
        destinataireNom: "OPCO Atlas",
        montantHtCents: 90000,
        tvaExoneree: true,
        statut: "brouillon",
        session: { numero: "AXI-SESS-2026-002", titreSession: "IA Générative" },
      },
    ]);
  });

  it("retourne { data: { csv, filename } } pour une année valide", async () => {
    const result = await exportComptaCsvAction({ annee: 2026 });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.filename).toBe("axion-ia-factures-formation-2026.csv");
    expect(typeof result.data.csv).toBe("string");
    expect(result.data.csv.length).toBeGreaterThan(0);
  });

  it("le CSV contient le numéro de facture et le montant HT", async () => {
    const result = await exportComptaCsvAction({ annee: 2026 });

    if (!("data" in result)) return;
    const { csv } = result.data;
    expect(csv).toContain("AXI-FACT-2026-001");
    expect(csv).toContain("1500"); // 150000 centimes → 1500,00 €
  });

  it("le CSV contient la mention TVA exonérée", async () => {
    const result = await exportComptaCsvAction({ annee: 2026 });

    if (!("data" in result)) return;
    expect(result.data.csv).toMatch(/Exon/i);
  });

  it("le CSV a un header sur la première ligne", async () => {
    const result = await exportComptaCsvAction({ annee: 2026 });

    if (!("data" in result)) return;
    const firstLine = result.data.csv.split("\n")[0];
    expect(firstLine).toBeDefined();
    expect(firstLine).toContain("Numéro");
  });

  it("génère le bon filename pour l'année", async () => {
    const result = await exportComptaCsvAction({ annee: 2025 });

    if (!("data" in result)) return;
    expect(result.data.filename).toBe("axion-ia-factures-formation-2025.csv");
  });

  it("retourne { error } si annee invalide (< 2020)", async () => {
    const result = await exportComptaCsvAction({ annee: 1999 });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si annee invalide (> 2100)", async () => {
    const result = await exportComptaCsvAction({ annee: 2101 });

    expect("error" in result).toBe(true);
  });

  it("retourne { data } avec CSV vide si aucune facture sur l'année", async () => {
    mockPrisma.factureFormation.findMany.mockResolvedValue([]);

    const result = await exportComptaCsvAction({ annee: 2024 });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    // Seulement le header
    const lines = result.data.csv.split("\n").filter(Boolean);
    expect(lines).toHaveLength(1); // header uniquement
  });
});
