/**
 * Tests — rechercheGlobaleAction (recherche globale de données, palette ⌘K).
 *
 * Stratégie alignée sur les specs qualiopi (ex. clients.spec.ts) : Prisma et
 * les guards sont mockés, le Zod et l'assemblage des groupes tournent pour de
 * vrai. Cas couverts : q trop court, admin → groupes remplis (hrefs vérifiés,
 * dont le repli clients/[id] (fiche 360) et le repli coaching → liste des séances),
 * non-admin → error, environnement stub → data vide sans toucher Prisma.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRequireAdminPublish = vi.fn();

const mockClientFindMany = vi.fn();
const mockSessionFindMany = vi.fn();
const mockFactureFindMany = vi.fn();
const mockDevisFindMany = vi.fn();
const mockTraineeFindMany = vi.fn();
const mockFormationFindMany = vi.fn();
const mockCoachingFindMany = vi.fn();
const mockAuditFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findMany: (...a: unknown[]) => mockClientFindMany(...a) },
    trainingSession: { findMany: (...a: unknown[]) => mockSessionFindMany(...a) },
    factureFormation: { findMany: (...a: unknown[]) => mockFactureFindMany(...a) },
    devis: { findMany: (...a: unknown[]) => mockDevisFindMany(...a) },
    trainee: { findMany: (...a: unknown[]) => mockTraineeFindMany(...a) },
    formation: { findMany: (...a: unknown[]) => mockFormationFindMany(...a) },
    coachingContract: { findMany: (...a: unknown[]) => mockCoachingFindMany(...a) },
    auditMission: { findMany: (...a: unknown[]) => mockAuditFindMany(...a) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminPublish: () => mockRequireAdminPublish(),
}));

import { rechercheGlobaleAction } from "../admin-recherche";

const DATABASE_URL_INITIALE = process.env.DATABASE_URL;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminPublish.mockResolvedValue({ userId: "u1", role: "admin" });
  mockClientFindMany.mockResolvedValue([]);
  mockSessionFindMany.mockResolvedValue([]);
  mockFactureFindMany.mockResolvedValue([]);
  mockDevisFindMany.mockResolvedValue([]);
  mockTraineeFindMany.mockResolvedValue([]);
  mockFormationFindMany.mockResolvedValue([]);
  mockCoachingFindMany.mockResolvedValue([]);
  mockAuditFindMany.mockResolvedValue([]);
});

afterEach(() => {
  if (DATABASE_URL_INITIALE === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = DATABASE_URL_INITIALE;
  }
});

describe("rechercheGlobaleAction — validation", () => {
  it("q trop court (1 caractère) → error, Prisma jamais appelé", async () => {
    const r = await rechercheGlobaleAction("a", "console");

    expect("error" in r).toBe(true);
    expect(mockClientFindMany).not.toHaveBeenCalled();
  });

  it("q trop long (> 80) → error", async () => {
    const r = await rechercheGlobaleAction("x".repeat(81), "console");
    expect("error" in r).toBe(true);
  });
});

describe("rechercheGlobaleAction — admin", () => {
  it("retourne les groupes non vides avec hrefs de fiche corrects", async () => {
    mockClientFindMany.mockResolvedValue([
      { id: "c1", numero: "AXI-CLI-001", raisonSociale: "Invest Sun", contactNom: "S. Blanc" },
    ]);
    mockSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        numero: "AXI-SESS-2026-001",
        titreSession: "IA générative",
        dateDebut: new Date("2026-09-01T08:00:00Z"),
        dateFin: new Date("2026-09-02T16:00:00Z"),
      },
    ]);
    mockCoachingFindMany.mockResolvedValue([
      { id: "k1", numero: "AXI-COACH-2026-001", interventionSlug: "coaching-ia" },
    ]);

    const r = await rechercheGlobaleAction("invest", "console");

    expect("data" in r).toBe(true);
    if (!("data" in r)) return;

    // Seuls les groupes non vides sont retournés.
    expect(r.data.map((g) => g.type)).toEqual(["clients", "sessions", "coaching"]);

    const clients = r.data.find((g) => g.type === "clients");
    expect(clients?.label).toBe("Clients");
    // Fiche 360 /qualiopi/clients/[id] (chantier client-360, mergé avant).
    expect(clients?.items[0]?.href).toBe("/fr/console/qualiopi/clients/c1");
    expect(clients?.items[0]?.titre).toBe("Invest Sun");
    expect(clients?.items[0]?.sous).toContain("AXI-CLI-001");
    expect(clients?.items[0]?.sous).toContain("S. Blanc");

    const sessions = r.data.find((g) => g.type === "sessions");
    expect(sessions?.items[0]?.href).toBe("/fr/console/qualiopi/sessions/s1");
    expect(sessions?.items[0]?.sous).toContain("AXI-SESS-2026-001");

    // Repli documenté : aucune fiche contrat coaching → liste des séances.
    const coaching = r.data.find((g) => g.type === "coaching");
    expect(coaching?.label).toBe("Contrats coaching");
    expect(coaching?.items[0]?.href).toBe("/fr/console/coaching/seances");
  });

  it("q numérique → le filtre client inclut siret startsWith", async () => {
    await rechercheGlobaleAction("12345", "console");

    const where = mockClientFindMany.mock.calls[0]?.[0]?.where;
    expect(where.OR).toContainEqual({ siret: { startsWith: "12345" } });
  });

  it("q non numérique → pas de clause siret", async () => {
    await rechercheGlobaleAction("invest", "console");

    const where = mockClientFindMany.mock.calls[0]?.[0]?.where;
    expect(where.OR.some((c: Record<string, unknown>) => "siret" in c)).toBe(false);
  });
});

describe("rechercheGlobaleAction — accès", () => {
  it("non-admin (guard throw) → error", async () => {
    mockRequireAdminPublish.mockRejectedValue(new Error("forbidden"));

    const r = await rechercheGlobaleAction("invest", "console");

    expect("error" in r).toBe(true);
    expect(mockClientFindMany).not.toHaveBeenCalled();
  });
});

describe("rechercheGlobaleAction — build stub (ADR 0026)", () => {
  it("DATABASE_URL stub.invalid → data vide, Prisma jamais touché", async () => {
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";

    const r = await rechercheGlobaleAction("invest", "console");

    expect(r).toEqual({ data: [] });
    expect(mockClientFindMany).not.toHaveBeenCalled();
    expect(mockAuditFindMany).not.toHaveBeenCalled();
  });
});
