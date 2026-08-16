/**
 * Tests — Server Actions Financements + Facturation (T11 AGENT B + T16).
 *
 * Stratégie :
 *   - Mock `@/lib/prisma` + `@/server/actions/qualiopi/_guards`
 *     (requireAdminWrite + logQualiopiActivity).
 *   - Mock `@/server/qualiopi/documents/organisme` + `@/server/qualiopi/documents/documents-service`
 *     + `@/server/qualiopi/documents/templates/facture` (pour genererFacturePdfAction T16).
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
 *
 * Couverture T16 :
 *   genererFacturePdfAction        ✓ (cas nominal + facture introuvable + PDF fail-soft)
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
      count: vi.fn(),
    },
    factureFormation: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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

// Mocks pour genererFacturePdfAction (T16)
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA SAS",
    nda: "11380000038",
    qualiopi: "FR-2024-001",
    siret: "12345678900001",
    adresseSiege: "Paris 75001",
    adresseExercice: "Saint-Lattier, Isère",
    email: "contact@axion-ia.com",
    telephone: "+33600000000",
    site: "https://axion-ia.com",
  }),
}));

vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn().mockResolvedValue({
    id: "doc-uuid-pdf-test",
    numero: "AXI-FACT-2026-001",
    pdfUrl: null,
    hashSha256: "abc",
  }),
}));

vi.mock("@/server/qualiopi/documents/templates/facture", () => ({
  FacturePdf: vi.fn(() => null),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-test-id" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (après mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";

import {
  setFinancementSessionAction,
  validerAccordOpcoAction,
  genererFactureFormationAction,
  genererFacturePdfAction,
  setMoyensFormationAction,
  verifierSousTraitantAction,
  exportComptaCsvAction,
  setPriseEnChargeAction,
} from "@/server/actions/qualiopi/financements";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers typés
// ─────────────────────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  trainingSession: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  factureFormation: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
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

const mockGenerateDocument = generateDocument as ReturnType<typeof vi.fn>;

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
    // Barème prise en charge (T18) — valide par défaut pour les tests ventilation horaire
    priseEnChargeMontantCents: 4000, // 40 €/h
    priseEnChargeUnite: "euro_heure",
    priseEnChargePlafondFormationCents: null,
    priseEnChargePlafondAnnuelCents: null,
    client: { raisonSociale: "ACME SAS" },
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
    // 🔴 V20 — le dénominateur n'est plus une cardinalité mais la SÉRIE lue par
    // préfixe. Deux factures émises {001, 002} → la suivante est 003. Le pin sur
    // `count` épinglait le comportement fautif et ne disait RIEN du prédicat :
    // c'est cette absence qui a laissé passer le dénominateur `createdAt`.
    mockPrisma.factureFormation.findMany.mockResolvedValue([
      { numero: "AXI-FACT-2026-001" },
      { numero: "AXI-FACT-2026-002" },
    ]);
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

  it("crée la facture en régime assujetti par défaut (TVA 20 %, Qualiopi n'exonère pas)", async () => {
    await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    const createCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.factureFormation.create,
    );
    expect(createCall.data["regimeTva"]).toBe("assujetti");
    expect(createCall.data["tvaExoneree"]).toBe(false);
    expect(createCall.data["montantTvaCents"]).toBeGreaterThan(0);
    expect(createCall.data["montantTtcCents"]).toBeGreaterThan(
      createCall.data["montantHtCents"] as number,
    );
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

  // 🔴 CE TEST VERROUILLAIT UN DÉFAUT — retourné le 16/08.
  //
  // Il s'appelait « subrogation : destinataire forcé à 'opco' même si
  // entreprise passé » et exigeait que le choix de l'humain soit ÉCRASÉ. C'est
  // exactement le comportement qui rendait **le reste à charge facturable à
  // personne** : impossible d'émettre la seconde facture, celle de l'entreprise.
  //
  // Or la règle métier n'a jamais été douteuse (plan console, Lot 8, étape 6) :
  // *l'OPCO paie sa part, le client le reste à charge*. Deux factures.
  //
  // 🔑 C'est le piège du test-photographie : il enregistrait ce que le code
  // FAISAIT, pas ce qu'il DEVAIT faire — et lui donnait par là l'apparence d'une
  // décision réfléchie. Le même piège a été trouvé le même jour sur `mixte`
  // (« ne dit rien non plus sur un financement mixte »).
  //
  // Le test est retourné : sans dossier de financement, le destinataire demandé
  // est RESPECTÉ. La subrogation reste bien tracée sur la facture — c'est un
  // fait du dossier, pas un arbitrage de destinataire.
  it("subrogation : le destinataire demandé est RESPECTÉ, plus jamais écrasé", async () => {
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
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    const createCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.factureFormation.create,
    );
    expect(
      createCall.data["destinataire"],
      "le destinataire a été écrasé : le reste à charge redevient infacturable",
    ).toBe("entreprise");
    // La subrogation reste tracée : elle décrit le dossier, pas le destinataire.
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

  it("ventilation horaire : crée la facture si dureeReelleHeures renseigné + barème présent", async () => {
    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "horaire",
    });

    expect("data" in result).toBe(true);
  });

  it("ventilation horaire : retourne { error } si barème absent (priseEnChargeMontantCents=null)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({ priseEnChargeMontantCents: null, priseEnChargeUnite: null }),
    );

    const result = await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "opco",
      ventilation: "horaire",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/barème|prise en charge/i);
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
    mockPrisma.formation.findUnique.mockResolvedValue({
      id: FORMATION_UUID,
      statutGeneration: "intention",
      validatedBy: null,
      versionProgramme: "1.0",
      versionHistorique: [],
    });
    mockPrisma.formation.update.mockResolvedValue({ id: FORMATION_UUID });
    mockPrisma.trainingSession.count.mockResolvedValue(0);
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

  it("BLOQUE si une session est en cours/réalisée (garde WS4)", async () => {
    mockPrisma.trainingSession.count.mockResolvedValue(1);
    const result = await setMoyensFormationAction({
      formationId: FORMATION_UUID,
      moyensTechniques: "Salle équipée",
    });
    expect("error" in result).toBe(true);
    expect(mockPrisma.formation.update).not.toHaveBeenCalled();
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

  it("logge l'activité qualiopi.compta.csv.export après l'export", async () => {
    const result = await exportComptaCsvAction({ annee: 2026 });

    expect("data" in result).toBe(true);
    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; changes: { annee: number; nbFactures: number } }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.compta.csv.export");
    expect(logCall.changes.annee).toBe(2026);
    expect(typeof logCall.changes.nbFactures).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// genererFacturePdfAction (T16 — réconcile dette PDF)
// ─────────────────────────────────────────────────────────────────────────────

/** Facture minimale pour les tests PDF. */
function makeFacture(overrides: Record<string, unknown> = {}) {
  return {
    id: FACTURE_UUID,
    numero: "AXI-FACT-2026-003",
    destinataireNom: "Acme SA",
    destinataireSiret: null,
    destinataireAdresse: null,
    montantHtCents: 150000,
    lignes: [
      {
        designation: "Formation professionnelle — forfait",
        quantite: 1,
        prixUnitaireHtCents: 150000,
      },
    ],
    subrogation: false,
    numeroDossierOpco: null,
    emiseAt: new Date("2026-06-01T10:00:00.000Z"),
    echeanceAt: new Date("2026-07-01T10:00:00.000Z"),
    sessionId: SESSION_UUID,
    ...overrides,
  };
}

describe("genererFacturePdfAction (T16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.factureFormation.findUnique.mockResolvedValue(makeFacture());
    mockPrisma.factureFormation.update.mockResolvedValue({
      id: FACTURE_UUID,
      documentId: "doc-uuid-pdf-test",
    });
    mockGenerateDocument.mockResolvedValue({
      id: "doc-uuid-pdf-test",
      numero: "AXI-FACT-2026-003",
      pdfUrl: null,
      hashSha256: "abc",
    });
  });

  it("retourne { data: { factureId, documentId } } en cas nominal", async () => {
    const result = await genererFacturePdfAction({ factureId: FACTURE_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.factureId).toBe(FACTURE_UUID);
    expect(result.data.documentId).toBe("doc-uuid-pdf-test");
  });

  it("met à jour documentId sur la facture en base", async () => {
    await genererFacturePdfAction({ factureId: FACTURE_UUID });

    expect(mockPrisma.factureFormation.update).toHaveBeenCalledOnce();
    const updateCall = mockCall<{ where: { id: string }; data: { documentId: string } }>(
      mockPrisma.factureFormation.update,
    );
    expect(updateCall.where.id).toBe(FACTURE_UUID);
    expect(updateCall.data.documentId).toBe("doc-uuid-pdf-test");
  });

  it("logge l'activité avec l'action correcte", async () => {
    await genererFacturePdfAction({ factureId: FACTURE_UUID });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.facture.pdf.generer");
    expect(logCall.targetType).toBe("FactureFormation");
    expect(logCall.targetId).toBe(FACTURE_UUID);
  });

  it("retourne { error } si factureId invalide (pas UUID)", async () => {
    const result = await genererFacturePdfAction({ factureId: "pas-un-uuid" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si la facture est introuvable", async () => {
    mockPrisma.factureFormation.findUnique.mockResolvedValue(null);

    const result = await genererFacturePdfAction({ factureId: FACTURE_UUID });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Facture introuvable");
  });

  it("fail-soft : retourne { error } si generateDocument rejette (PDF renderer failure)", async () => {
    mockGenerateDocument.mockRejectedValue(new Error("Renderer PDF indisponible"));

    const result = await genererFacturePdfAction({ factureId: FACTURE_UUID });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/PDF non généré/i);
    // La facture ne doit pas être mise à jour si le PDF a échoué
    expect(mockPrisma.factureFormation.update).not.toHaveBeenCalled();
  });

  it("supporte la subrogation OPCO (mention dans FactureData)", async () => {
    mockPrisma.factureFormation.findUnique.mockResolvedValue(
      makeFacture({
        subrogation: true,
        numeroDossierOpco: "DOSSIER-2026-001",
        destinataireNom: "OPCO Atlas",
      }),
    );

    const result = await genererFacturePdfAction({ factureId: FACTURE_UUID });

    expect("data" in result).toBe(true);
    // generateDocument doit avoir été appelé (PDF construit avec subrogationOpco)
    expect(mockGenerateDocument).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setPriseEnChargeAction (T18)
// ─────────────────────────────────────────────────────────────────────────────

describe("setPriseEnChargeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.trainingSession.update.mockResolvedValue({ id: SESSION_UUID });
  });

  it("retourne { data: { id } } pour une mise à jour valide (euro_heure)", async () => {
    const result = await setPriseEnChargeAction({
      sessionId: SESSION_UUID,
      montantCents: 4000,
      unite: "euro_heure",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(SESSION_UUID);
  });

  it("met à jour priseEnChargeMontantCents et priseEnChargeUnite", async () => {
    await setPriseEnChargeAction({
      sessionId: SESSION_UUID,
      montantCents: 5000,
      unite: "euro_jour",
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.trainingSession.update,
    );
    expect(updateCall.data["priseEnChargeMontantCents"]).toBe(5000);
    expect(updateCall.data["priseEnChargeUnite"]).toBe("euro_jour");
  });

  it("met à jour les plafonds si fournis", async () => {
    await setPriseEnChargeAction({
      sessionId: SESSION_UUID,
      montantCents: 4000,
      unite: "euro_heure",
      plafondFormationCents: 20_000,
      plafondAnnuelCents: 50_000,
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.trainingSession.update,
    );
    expect(updateCall.data["priseEnChargePlafondFormationCents"]).toBe(20_000);
    expect(updateCall.data["priseEnChargePlafondAnnuelCents"]).toBe(50_000);
  });

  it("ne passe pas les plafonds si absents (exactOptionalPropertyTypes)", async () => {
    await setPriseEnChargeAction({
      sessionId: SESSION_UUID,
      montantCents: 4000,
      unite: "euro_formation",
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.trainingSession.update,
    );
    expect("priseEnChargePlafondFormationCents" in updateCall.data).toBe(false);
    expect("priseEnChargePlafondAnnuelCents" in updateCall.data).toBe(false);
  });

  it("retourne { error } si sessionId invalide", async () => {
    const result = await setPriseEnChargeAction({
      sessionId: "pas-un-uuid",
      montantCents: 4000,
      unite: "euro_heure",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si unite invalide", async () => {
    const result = await setPriseEnChargeAction({
      sessionId: SESSION_UUID,
      montantCents: 4000,
      unite: "euro_inconnu" as "euro_heure",
    });

    expect("error" in result).toBe(true);
  });

  it("retourne { error } si montantCents négatif", async () => {
    const result = await setPriseEnChargeAction({
      sessionId: SESSION_UUID,
      montantCents: -1,
      unite: "euro_heure",
    });

    expect("error" in result).toBe(true);
  });

  it("accepte toutes les unités PriseEnChargeUnite", async () => {
    const unites = ["euro_heure", "euro_jour", "euro_formation", "euro_an_salarie"] as const;
    for (const unite of unites) {
      mockPrisma.trainingSession.update.mockResolvedValue({ id: SESSION_UUID });
      const result = await setPriseEnChargeAction({
        sessionId: SESSION_UUID,
        montantCents: 1000,
        unite,
      });
      expect("data" in result).toBe(true);
    }
  });

  it("logge l'activité qualiopi.session.prise_en_charge", async () => {
    await setPriseEnChargeAction({
      sessionId: SESSION_UUID,
      montantCents: 4000,
      unite: "euro_heure",
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.financement.prise_en_charge.set");
    expect(logCall.targetType).toBe("TrainingSession");
    expect(logCall.targetId).toBe(SESSION_UUID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 V20 étape 0 — le dénominateur de la série AXI-FACT.
//
// `genererNumeroFacture` comptait TOUTES les lignes de `factures_formation`
// créées dans l'année, par `createdAt`. Or cette table héberge QUATRE séries :
// les factures `AXI-FACT-`, les AVOIRS `AXI-AVO-` (série légale distincte), les
// brouillons `BROUILLON-<uuid>` des plans récurrents, et les reprises
// d'historique dont le `createdAt` est la date d'IMPORT.
//
// Deux clics suffisaient : facture 001 → avoir 001 → la facture suivante voyait
// 2 lignes et sortait 003. Le 002 n'existait jamais — rupture de la séquence
// continue exigée par l'art. 242 nonies A ann. II du CGI. Et les cinq AUTRES
// allocateurs de la même série comptent, eux, par préfixe : ils voyaient 2
// factures, réémettaient 003, et prenaient un P2002 sur une pièce comptable.
// ─────────────────────────────────────────────────────────────────────────────

describe("Numérotation des factures — dénominateur de la série", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.trainingSession.findUnique.mockResolvedValue(makeSession());
    mockPrisma.factureFormation.create.mockResolvedValue({
      id: FACTURE_UUID,
      numero: "AXI-FACT-2026-001",
      documentId: null,
    });
  });

  // 🔴 L'allocateur est passé de `count()` (V20 étape 0) à `findMany()` + MAX
  // de séquence (V20 complet, L7). Ce qui est verrouillé ici n'a pas changé :
  // le DÉNOMINATEUR ne doit jamais être une fenêtre de dates.
  //
  // `factures_formation` héberge QUATRE séries — factures `AXI-FACT-`, AVOIRS
  // `AXI-AVO-` (série légale distincte), brouillons `BROUILLON-<uuid>` des plans
  // récurrents, et reprises d'historique dont le `createdAt` est la date
  // d'IMPORT. Compter par date les additionnait : facture 001 → avoir 001 → la
  // facture suivante sortait 003, et le 002 n'existait jamais. Rupture de la
  // séquence continue exigée par l'art. 242 nonies A ann. II du CGI.
  it("interroge par PRÉFIXE de série, jamais par fenêtre de création", async () => {
    const wheres: Array<Record<string, unknown>> = [];
    const capture = (args: { where?: Record<string, unknown> }) => {
      wheres.push(args?.where ?? {});
      return Promise.resolve([]);
    };
    mockPrisma.factureFormation.findMany.mockImplementation(capture);
    mockPrisma.factureFormation.count.mockImplementation(() => Promise.resolve(0));

    await genererFactureFormationAction({
      sessionId: SESSION_UUID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    const requetesSerie = wheres.filter((w) => "numero" in w || "createdAt" in w);
    expect(requetesSerie.length).toBeGreaterThan(0);
    for (const w of requetesSerie) {
      // Un AVOIR ou un BROUILLON ne doit jamais entrer au dénominateur.
      expect(w["createdAt"]).toBeUndefined();
      expect(JSON.stringify(w["numero"])).toContain("AXI-FACT-");
    }
  });
});
