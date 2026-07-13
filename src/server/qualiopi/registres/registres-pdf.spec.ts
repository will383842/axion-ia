/**
 * Tests — registres/registres-pdf.ts (LOT 2 — A3/A7/A8/A17/A18).
 *
 * Stratégie : mock @/lib/prisma + organisme ; rendu react-pdf RÉEL (fallback
 * polices built-in) → buffer %PDF + filename horodaté. Vérifie que chaque
 * builder sélectionne les données réelles du bon modèle Prisma.
 */

import { beforeAll, describe, it, expect, vi, beforeEach } from "vitest";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reclamation: { findMany: vi.fn() },
    veille: { findMany: vi.fn() },
    revueDirection: { findMany: vi.fn() },
    partenariat: { findMany: vi.fn() },
    sousTraitant: { findMany: vi.fn() },
    incident: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA SAS (test)",
    nda: "84691234567",
    qualiopi: "FR-2026-0001",
    siret: "12345678900001",
    adresseSiege: "11 Avenue Paul Verlaine, 38100 Grenoble",
    adresseExercice: "11 Avenue Paul Verlaine, 38100 Grenoble",
    email: "formation@axion-ia.fr",
    telephone: "+33 4 00 00 00 00",
    site: "https://axion-ia.com",
  }),
}));

import { prisma } from "@/lib/prisma";
import { renderRegistrePdfBuffer, REGISTRE_TYPES } from "./registres-pdf";

const mockPrisma = prisma as unknown as {
  reclamation: { findMany: ReturnType<typeof vi.fn> };
  veille: { findMany: ReturnType<typeof vi.fn> };
  revueDirection: { findMany: ReturnType<typeof vi.fn> };
  partenariat: { findMany: ReturnType<typeof vi.fn> };
  sousTraitant: { findMany: ReturnType<typeof vi.fn> };
  incident: { findMany: ReturnType<typeof vi.fn> };
};

beforeAll(() => {
  registerPdfTestFontsFallback();
});

function setupEmpty() {
  vi.clearAllMocks();
  mockPrisma.reclamation.findMany.mockResolvedValue([]);
  mockPrisma.veille.findMany.mockResolvedValue([]);
  mockPrisma.revueDirection.findMany.mockResolvedValue([]);
  mockPrisma.partenariat.findMany.mockResolvedValue([]);
  mockPrisma.sousTraitant.findMany.mockResolvedValue([]);
  mockPrisma.incident.findMany.mockResolvedValue([]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("renderRegistrePdfBuffer", () => {
  beforeEach(setupEmpty);

  it("expose les 6 types de registres attendus", () => {
    expect([...REGISTRE_TYPES]).toEqual([
      "reclamations",
      "veille",
      "revue_direction",
      "partenariats",
      "sous_traitants",
      "incidents",
    ]);
  });

  it("veille : sélectionne les données réelles et rend un PDF %PDF", async () => {
    mockPrisma.veille.findMany.mockResolvedValue([
      {
        dateVeille: new Date("2026-06-01T00:00:00.000Z"),
        type: "legale",
        titre: "Nouveau décret formation",
        source: "Legifrance",
        impact: "Mise à jour du règlement intérieur",
        actionDecidee: "Réviser le modèle de convention",
      },
    ]);
    const result = await renderRegistrePdfBuffer("veille");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^journal-veille-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(mockPrisma.veille.findMany).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("reclamations : rend un PDF avec filename registre-reclamations-*", async () => {
    mockPrisma.reclamation.findMany.mockResolvedValue([
      {
        numero: "AXI-REC-2026-001",
        dateReception: new Date("2026-05-02T00:00:00.000Z"),
        reclamantNom: "Jean Dupont",
        objet: "Support illisible",
        statut: "resolue",
        dateReponse: new Date("2026-05-05T00:00:00.000Z"),
        actionsCorrectives: "Réédition du support",
      },
    ]);
    const result = await renderRegistrePdfBuffer("reclamations");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^registre-reclamations-/);
  }, 30_000);

  it("revue_direction : résume participants/décisions/plan d'actions (Json)", async () => {
    mockPrisma.revueDirection.findMany.mockResolvedValue([
      {
        annee: 2026,
        dateRevue: new Date("2026-01-15T00:00:00.000Z"),
        statut: "validee",
        participants: ["Williams Jullin"],
        decisions: [{ libelle: "Mettre à jour la veille" }],
        planActions: [],
      },
    ]);
    const result = await renderRegistrePdfBuffer("revue_direction");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^revues-direction-plan-amelioration-/);
  }, 30_000);

  it("partenariats + sous_traitants : rendent un PDF même registre vide", async () => {
    const p = await renderRegistrePdfBuffer("partenariats");
    const s = await renderRegistrePdfBuffer("sous_traitants");
    expect(p.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(s.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(p.filename).toMatch(/^registre-partenariats-/);
    expect(s.filename).toMatch(/^registre-sous-traitants-/);
  }, 30_000);

  it("incidents : sélectionne les données réelles (session liée) et rend un PDF", async () => {
    mockPrisma.incident.findMany.mockResolvedValue([
      {
        dateIncident: new Date("2026-03-12T00:00:00.000Z"),
        type: "technique",
        gravite: "majeur",
        titre: "Coupure visio 40 min",
        statut: "resolu",
        actionCorrective: "Connexion 4G de secours pour les sessions distancielles",
        resoluAt: new Date("2026-03-13T00:00:00.000Z"),
        session: { numero: "AXI-SES-2026-004" },
      },
    ]);
    const result = await renderRegistrePdfBuffer("incidents");
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(result.filename).toMatch(/^registre-incidents-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(mockPrisma.incident.findMany).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("lève en mode stub.invalid (aucun appel Prisma)", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(renderRegistrePdfBuffer("veille")).rejects.toThrow(/stub\.invalid/);
      expect(mockPrisma.veille.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});
