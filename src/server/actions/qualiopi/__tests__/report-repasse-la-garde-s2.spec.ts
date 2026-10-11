/**
 * Lot S2 (N5, T7) — le report fait repasser la garde à TOUS les formateurs
 * reconduits, co-formateurs compris, et refuse un indépendant déjà pris aux
 * nouvelles dates. Livré éteint : interrupteur `formateurs.affectation_sure`
 * absent, le report est celui d'avant S2 (premier cas de chaque bloc).
 *
 * Mêmes doublures que `sessions-recurrentes.spec.ts`, plus le réglage et le
 * planning.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ADR 0060 — le verrou du dossier de session a sa propre suite
// (`src/server/qualiopi/sessions/__tests__/`) ; ici, le dossier est ouvert.
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Mocks (hoistés)
// ─────────────────────────────────────────────────────────────────────────────

const mockSessionFindUnique = vi.fn();
const mockSessionCreate = vi.fn();
const mockSessionUpdate = vi.fn();
const mockSessionJourCreateMany = vi.fn();
const mockEnrollmentUpdate = vi.fn();
const mockSessionFormateurCreateMany = vi.fn();
const mockTrainerFindUnique = vi.fn();
const mockSettingFindUnique = vi.fn();
const mockConflits = vi.fn();

vi.mock("@/features/admin-planning/queries", () => ({
  getTrainerConflicts: (...a: unknown[]) => mockConflits(...a),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    trainingSession: {
      create: (...a: unknown[]) => mockSessionCreate(...a),
      update: (...a: unknown[]) => mockSessionUpdate(...a),
    },
    sessionJour: { createMany: (...a: unknown[]) => mockSessionJourCreateMany(...a) },
    enrollment: { update: (...a: unknown[]) => mockEnrollmentUpdate(...a) },
    sessionFormateur: { createMany: (...a: unknown[]) => mockSessionFormateurCreateMany(...a) },
  };
  return {
    prisma: {
      trainingSession: {
        findUnique: (...a: unknown[]) => mockSessionFindUnique(...a),
        create: (...a: unknown[]) => mockSessionCreate(...a),
        update: (...a: unknown[]) => mockSessionUpdate(...a),
      },
      trainer: { findUnique: (...a: unknown[]) => mockTrainerFindUnique(...a) },
      setting: { findUnique: (...a: unknown[]) => mockSettingFindUnique(...a) },
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/formations/numbering", () => ({
  allocateSessionNumero: vi.fn().mockResolvedValue("AXI-SESS-2026-042"),
}));

vi.mock("@/server/qualiopi/formations/transition-helper", () => ({
  writeSessionTransition: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/emargement/token-service", () => ({
  revoquerTokensInscription: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { reportSessionAction } from "../sessions-recurrentes";

const SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const NOUVELLE_ID = "11111111-2222-3333-4444-555555555555";
const PRINCIPAL = "99999999-8888-7777-6666-555555555555";
const CO = "77777777-6666-5555-4444-333333333333";
const FORMATION_ID = "ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb";

const INPUT = {
  sessionId: SESSION_ID,
  nouvelleDateDebut: new Date("2026-11-02T09:00:00.000Z"),
  nouvelleDateFin: new Date("2026-11-03T17:00:00.000Z"),
  motif: "Indisponibilité du client",
};

function ancienne() {
  return {
    id: SESSION_ID,
    numero: "AXI-SESS-2026-003",
    statut: "planifiee",
    titreSession: "IA opérationnelle",
    formationId: FORMATION_ID,
    modalite: "presentiel",
    nbParticipantsPrevus: 8,
    montantHtCents: 150000,
    formationSnapshot: null,
    clientId: null,
    financementType: null,
    sessionParentId: null,
    lieuType: "distanciel",
    lieuIntitule: null,
    lieuAdresse: null,
    lieuCodePostal: null,
    lieuVille: null,
    lieuSalle: null,
    lieuVisioUrl: null,
    contactSurPlaceNom: null,
    contactSurPlaceTelephone: null,
    consignesAcces: null,
    formateurPrincipalId: PRINCIPAL,
    coFormateurs: [{ trainerId: CO, role: "co_formateur" }],
    sessionFormateurs: [
      { trainerId: PRINCIPAL, role: "principal", tarifHtCents: 35000 },
      { trainerId: CO, role: "co_formateur", tarifHtCents: 35000 },
    ],
    formation: { dureeHeures: 14 },
    enrollments: [],
  };
}

function formateur(over: Record<string, unknown> = {}) {
  return {
    actif: true,
    statut: "salarie",
    sousTraitantVerifieAt: null,
    habilitations: [{ formationId: FORMATION_ID }],
    ...over,
  };
}

const CONFLIT = {
  key: "formation:autre",
  titre: "Autre formation",
  debut: new Date("2026-11-02T09:00:00.000Z"),
  fin: new Date("2026-11-02T17:00:00.000Z"),
  statut: "planifiee",
};

function allumer(oui: boolean): void {
  mockSettingFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) =>
    oui && where.key === "formateurs.affectation_sure" ? { value: { actif: true } } : null,
  );
}

function lignesReportees(): string[] {
  const appel = mockSessionFormateurCreateMany.mock.calls[0]?.[0] as
    { data: Array<{ trainerId: string }> } | undefined;
  return (appel?.data ?? []).map((r) => r.trainerId).sort();
}

function dataCreee(): Record<string, unknown> {
  return (mockSessionCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionFindUnique.mockResolvedValue(ancienne());
  mockSessionCreate.mockResolvedValue({ id: NOUVELLE_ID, numero: "AXI-SESS-2026-042" });
  mockSessionUpdate.mockResolvedValue({});
  mockSessionJourCreateMany.mockResolvedValue({ count: 2 });
  mockSessionFormateurCreateMany.mockResolvedValue({ count: 2 });
  mockConflits.mockResolvedValue([]);
  allumer(false);
});

describe("T7 — un co-formateur reconduit repasse la garde", () => {
  beforeEach(() => {
    mockTrainerFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === CO ? formateur({ actif: false }) : formateur(),
    );
  });

  it("arrêté : le co-formateur désactivé est recopié, comme avant S2", async () => {
    await reportSessionAction(INPUT);
    expect(lignesReportees()).toEqual([CO, PRINCIPAL].sort());
  });

  it("allumé : le co-formateur désactivé n'est reconduit ni en ligne ni dans le Json", async () => {
    allumer(true);
    const r = await reportSessionAction(INPUT);
    expect(r).toHaveProperty("data");
    expect(lignesReportees()).toEqual([PRINCIPAL]);
    expect(dataCreee()["coFormateurs"]).toEqual([]);
    expect(dataCreee()["formateurPrincipalId"]).toBe(PRINCIPAL);
  });
});

describe("N5 — un indépendant déjà pris aux nouvelles dates n'est pas réinstallé", () => {
  beforeEach(() => {
    mockSessionFindUnique.mockResolvedValue({
      ...ancienne(),
      coFormateurs: [],
      sessionFormateurs: [{ trainerId: PRINCIPAL, role: "principal", tarifHtCents: 35000 }],
    });
    mockConflits.mockResolvedValue([CONFLIT]);
  });

  it("arrêté : il est reconduit malgré le chevauchement, comme avant S2", async () => {
    mockTrainerFindUnique.mockResolvedValue(
      formateur({ statut: "sous_traitant", sousTraitantVerifieAt: new Date("2026-01-01") }),
    );
    await reportSessionAction(INPUT);
    expect(dataCreee()["formateurPrincipalId"]).toBe(PRINCIPAL);
  });

  it("allumé : l'indépendant pris ailleurs n'est pas reconduit", async () => {
    allumer(true);
    mockTrainerFindUnique.mockResolvedValue(
      formateur({ statut: "sous_traitant", sousTraitantVerifieAt: new Date("2026-01-01") }),
    );
    await reportSessionAction(INPUT);
    expect(dataCreee()["formateurPrincipalId"]).toBeUndefined();
    expect(mockSessionFormateurCreateMany).not.toHaveBeenCalled();
    const cible = mockConflits.mock.calls[0]?.[1] as { key: string; debut: Date };
    // L'ancienne session, qui passe à `reportee`, n'est pas un conflit.
    expect(cible.key).toBe(`formation:${SESSION_ID}`);
    expect(cible.debut).toEqual(INPUT.nouvelleDateDebut);
  });

  it("allumé : un salarié reste reconduit (jamais bloqué au report)", async () => {
    allumer(true);
    mockTrainerFindUnique.mockResolvedValue(formateur({ statut: "salarie" }));
    await reportSessionAction(INPUT);
    expect(dataCreee()["formateurPrincipalId"]).toBe(PRINCIPAL);
  });
});
