/**
 * Tests — audit-dossier.ts (T12 — AGENT B, T17 — CLUSTER 2).
 *
 * Stratégie : mock @/lib/prisma + ./conformite-service + site-settings + r2-storage.
 * Vérifie la structure du manifeste JSON, le contenu Markdown,
 * le comportement stub.invalid, et les preuves enrichies off.21/26/30.
 * Vérifie également genererDossierAuditZip (ZIP manifeste + PDFs).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    veille: { count: vi.fn() },
    appreciation: { count: vi.fn() },
    trainer: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/r2-storage", () => ({
  getObjectBufferR2: vi.fn(),
}));

vi.mock("./conformite-service", () => ({
  evaluerConformite: vi.fn(),
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(""),
}));

// LOT 2 : les exports d'état des registres sont rendus à la volée dans le ZIP —
// mockés ici (le rendu react-pdf réel est testé dans registres-pdf.spec).
vi.mock("@/server/qualiopi/registres/registres-pdf", () => ({
  REGISTRE_TYPES: [
    "reclamations",
    "veille",
    "revue_direction",
    "partenariats",
    "sous_traitants",
  ] as const,
  renderRegistrePdfBuffer: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { evaluerConformite } from "./conformite-service";
import { getObjectBufferR2 } from "@/lib/r2-storage";
import { renderRegistrePdfBuffer } from "@/server/qualiopi/registres/registres-pdf";
import { genererManifesteAudit, genererDossierAuditZip } from "./audit-dossier";
import { INDICATEURS_RNQ } from "./indicateurs-registre";
import JSZip from "jszip";

const mockPrisma = prisma as unknown as {
  documentGenere: { groupBy: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  veille: { count: ReturnType<typeof vi.fn> };
  appreciation: { count: ReturnType<typeof vi.fn> };
  trainer: { findMany: ReturnType<typeof vi.fn> };
};
const mockEvaluerConformite = evaluerConformite as ReturnType<typeof vi.fn>;
const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;
const mockGetObjectBufferR2 = getObjectBufferR2 as ReturnType<typeof vi.fn>;
const mockRenderRegistrePdfBuffer = renderRegistrePdfBuffer as ReturnType<typeof vi.fn>;

// Résultat de conformité simulé avec 32 indicateurs
function makeConformiteResult(
  overrides: { nbCouverts?: number; nbApplicables?: number; scorePct?: number } = {},
) {
  const indicateurs = INDICATEURS_RNQ.map((ind) => ({
    numero: ind.numero,
    libelle: ind.libelleOfficiel,
    critere: ind.critere,
    super: ind.super,
    statut: "a_completer" as const,
    preuves: [],
  }));
  return {
    indicateurs,
    nbCouverts: overrides.nbCouverts ?? 0,
    nbApplicables: overrides.nbApplicables ?? 25,
    scorePct: overrides.scorePct ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("genererManifesteAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluerConformite.mockResolvedValue(makeConformiteResult());
    mockPrisma.documentGenere.groupBy.mockResolvedValue([]);
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);
    mockPrisma.veille.count.mockResolvedValue(0);
    mockPrisma.appreciation.count.mockResolvedValue(0);
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    mockGetConfig.mockResolvedValue("");
    mockGetObjectBufferR2.mockResolvedValue(null);
  });

  it("retourne un objet { json, markdown }", async () => {
    const result = await genererManifesteAudit();
    expect(result).toHaveProperty("json");
    expect(result).toHaveProperty("markdown");
  });

  it("json.meta contient genereAt (ISO string)", async () => {
    const result = await genererManifesteAudit();
    expect(result.json.meta.genereAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("json.meta.version est 'RNQ-V9'", async () => {
    const result = await genererManifesteAudit();
    expect(result.json.meta.version).toBe("RNQ-V9");
  });

  it("json.indicateurs contient exactement 32 entrées", async () => {
    const result = await genererManifesteAudit();
    expect(result.json.indicateurs).toHaveLength(32);
  });

  it("tous les numéros de 1 à 32 sont présents dans le manifeste", async () => {
    const result = await genererManifesteAudit();
    const nums = result.json.indicateurs.map((i) => i.numero).sort((a, b) => a - b);
    for (let n = 1; n <= 32; n++) {
      expect(nums[n - 1]).toBe(n);
    }
  });

  it("json.meta.scorePct reflète le score de conformité", async () => {
    mockEvaluerConformite.mockResolvedValue(
      makeConformiteResult({ nbCouverts: 10, nbApplicables: 25, scorePct: 40 }),
    );
    const result = await genererManifesteAudit();
    expect(result.json.meta.scorePct).toBe(40);
    expect(result.json.meta.nbCouverts).toBe(10);
    expect(result.json.meta.nbApplicables).toBe(25);
  });

  it("documents sont comptabilisés depuis groupBy", async () => {
    mockPrisma.documentGenere.groupBy.mockResolvedValue([
      { type: "emargement", _count: { _all: 7 } },
      { type: "convention", _count: { _all: 3 } },
    ]);
    const result = await genererManifesteAudit();
    // off.12 utilise "emargement" — doit avoir count=7
    const ind12 = result.json.indicateurs.find((i) => i.numero === 12);
    expect(ind12?.documents.some((d) => d.type === "emargement" && d.count === 7)).toBe(true);
  });

  it("documents avec count=0 sont filtrés (non affichés)", async () => {
    mockPrisma.documentGenere.groupBy.mockResolvedValue([]);
    const result = await genererManifesteAudit();
    for (const ind of result.json.indicateurs) {
      expect(ind.documents).toHaveLength(0);
    }
  });

  it("markdown contient '# Manifeste d'audit Qualiopi'", async () => {
    const result = await genererManifesteAudit();
    expect(result.markdown).toMatch(/# Manifeste d'audit Qualiopi/);
  });

  it("markdown contient 'Critère 1' et 'Critère 7'", async () => {
    const result = await genererManifesteAudit();
    expect(result.markdown).toContain("Critère 1");
    expect(result.markdown).toContain("Critère 7");
  });

  it("markdown contient le score", async () => {
    mockEvaluerConformite.mockResolvedValue(
      makeConformiteResult({ nbCouverts: 15, nbApplicables: 25, scorePct: 60 }),
    );
    const result = await genererManifesteAudit();
    expect(result.markdown).toContain("60");
  });

  it("retourne un manifeste vide en mode stub.invalid (PAS d'appel Prisma)", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await genererManifesteAudit();
      expect(result.json.meta.nbIndicateurs).toBe(0);
      expect(result.markdown).toContain("indisponibles");
      expect(mockPrisma.documentGenere.groupBy).not.toHaveBeenCalled();
      expect(mockEvaluerConformite).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  // ── Preuves enrichies (T17 — CLUSTER 2) ───────────────────────────────────

  it("off.30 : manifeste affiche le compte d'appréciations multi-parties", async () => {
    mockPrisma.appreciation.count.mockResolvedValue(4);
    const result = await genererManifesteAudit();
    const ind30 = result.json.indicateurs.find((i) => i.numero === 30);
    const preuvesText = ind30?.preuves.join(" ") ?? "";
    expect(preuvesText).toMatch(/4/);
    expect(preuvesText).toMatch(/appr[eé]ciation/i);
  });

  it("off.26 : manifeste expose le nom du référent handicap si renseigné", async () => {
    mockGetConfig.mockResolvedValue("Williams Jullin");
    const result = await genererManifesteAudit();
    const ind26 = result.json.indicateurs.find((i) => i.numero === 26);
    const preuvesText = ind26?.preuves.join(" ") ?? "";
    expect(preuvesText).toContain("Williams Jullin");
  });

  it("off.26 : manifeste signale référent non renseigné si config vide", async () => {
    mockGetConfig.mockResolvedValue("");
    const result = await genererManifesteAudit();
    const ind26 = result.json.indicateurs.find((i) => i.numero === 26);
    const preuvesText = ind26?.preuves.join(" ") ?? "";
    expect(preuvesText).toMatch(/non renseigné/i);
  });

  it("off.21 : manifeste liste les formateurs avec CV", async () => {
    mockPrisma.trainer.findMany.mockResolvedValue([
      { id: "t-1", nom: "Jullin", prenom: "Williams", cvUrl: "https://example.com/cv.pdf" },
    ]);
    const result = await genererManifesteAudit();
    const ind21 = result.json.indicateurs.find((i) => i.numero === 21);
    const preuvesText = ind21?.preuves.join(" ") ?? "";
    expect(preuvesText).toContain("Jullin");
    expect(preuvesText).toMatch(/1 formateur/i);
  });

  it("off.21 : manifeste signale 0 formateur avec CV si aucun", async () => {
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    const result = await genererManifesteAudit();
    const ind21 = result.json.indicateurs.find((i) => i.numero === 21);
    const preuvesText = ind21?.preuves.join(" ") ?? "";
    expect(preuvesText).toMatch(/aucun formateur/i);
  });

  // ── off.1 : NDA DREETS requis pour couverture (S5) ────────────────────────

  it("off.1 : manifeste affiche le NDA si renseigné", async () => {
    // getQualiopiConfig : 1er appel = referent_handicap_nom, 2e = nda_numero
    mockGetConfig.mockResolvedValueOnce("").mockResolvedValueOnce("11075XXXX75");
    const result = await genererManifesteAudit();
    const ind1 = result.json.indicateurs.find((i) => i.numero === 1);
    const preuvesText = ind1?.preuves.join(" ") ?? "";
    expect(preuvesText).toContain("11075XXXX75");
    expect(preuvesText).toMatch(/NDA DREETS obtenu/i);
  });

  it("off.1 : manifeste signale NDA manquant si config vide", async () => {
    // Les deux appels retournent ""
    mockGetConfig.mockResolvedValue("");
    const result = await genererManifesteAudit();
    const ind1 = result.json.indicateurs.find((i) => i.numero === 1);
    const preuvesText = ind1?.preuves.join(" ") ?? "";
    expect(preuvesText).toMatch(/non renseigné/i);
    expect(preuvesText).toMatch(/off\.1/i);
  });

  it("off.23/24/25 : manifeste affiche le compte de veille par type", async () => {
    mockPrisma.veille.count
      .mockResolvedValueOnce(3) // legale
      .mockResolvedValueOnce(2) // metiers
      .mockResolvedValueOnce(1); // pedagogique
    const result = await genererManifesteAudit();
    const ind23 = result.json.indicateurs.find((i) => i.numero === 23);
    const ind24 = result.json.indicateurs.find((i) => i.numero === 24);
    const ind25 = result.json.indicateurs.find((i) => i.numero === 25);
    expect(ind23?.preuves.join(" ")).toContain("3");
    expect(ind24?.preuves.join(" ")).toContain("2");
    expect(ind25?.preuves.join(" ")).toContain("1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// genererDossierAuditZip
// ─────────────────────────────────────────────────────────────────────────────

describe("genererDossierAuditZip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluerConformite.mockResolvedValue(makeConformiteResult());
    mockPrisma.documentGenere.groupBy.mockResolvedValue([]);
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);
    mockPrisma.veille.count.mockResolvedValue(0);
    mockPrisma.appreciation.count.mockResolvedValue(0);
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    mockGetConfig.mockResolvedValue("");
    mockGetObjectBufferR2.mockResolvedValue(null);
    mockRenderRegistrePdfBuffer.mockImplementation((type: string) =>
      Promise.resolve({
        buffer: Buffer.from(`%PDF-1.4 registre ${type}`),
        filename: `${type}.pdf`,
      }),
    );
  });

  it("retourne { base64, filename } avec filename horodaté", async () => {
    const result = await genererDossierAuditZip();
    expect(result).toHaveProperty("base64");
    expect(result).toHaveProperty("filename");
    expect(result.filename).toMatch(/^dossier-audit-qualiopi-\d{4}-\d{2}-\d{2}$/);
    expect(typeof result.base64).toBe("string");
    expect(result.base64.length).toBeGreaterThan(0);
  });

  it("le ZIP contient manifeste.json et manifeste.md", async () => {
    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    expect(zip.files["manifeste.json"]).toBeDefined();
    expect(zip.files["manifeste.md"]).toBeDefined();
  });

  it("manifeste.json dans le ZIP est un JSON valide avec meta.version = 'RNQ-V9'", async () => {
    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    const jsonStr = await zip.files["manifeste.json"]!.async("string");
    const parsed = JSON.parse(jsonStr) as { meta?: { version?: string } };
    expect(parsed?.meta?.version).toBe("RNQ-V9");
  });

  it("manifeste.md dans le ZIP contient le titre du manifeste", async () => {
    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    const md = await zip.files["manifeste.md"]!.async("string");
    expect(md).toMatch(/# Manifeste d'audit Qualiopi/);
  });

  it("un PDF disponible dans R2 est inclus sous preuves/<type>/<numero>.pdf", async () => {
    const fakePdf = Buffer.from("%PDF-1.4 fake content");
    mockGetObjectBufferR2.mockResolvedValue(fakePdf);
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      {
        id: "doc-1",
        type: "attestation",
        numero: "AXI-ATT-2026-001",
        createdAt: new Date("2026-03-15T10:00:00Z"),
      },
    ]);

    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    expect(zip.files["preuves/attestation/AXI-ATT-2026-001.pdf"]).toBeDefined();
  });

  it("un PDF absent dans R2 est omis (fail-soft) — le ZIP reste valide", async () => {
    mockGetObjectBufferR2.mockResolvedValue(null);
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      {
        id: "doc-2",
        type: "convention",
        numero: "AXI-CONV-2026-001",
        createdAt: new Date("2026-04-01T08:00:00Z"),
      },
    ]);

    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    // Le PDF manquant ne doit PAS être dans le ZIP
    expect(zip.files["preuves/convention/AXI-CONV-2026-001.pdf"]).toBeUndefined();
    // Mais le manifeste et l'index doivent être présents
    expect(zip.files["manifeste.json"]).toBeDefined();
    expect(zip.files["index.txt"]).toBeDefined();
  });

  it("index.txt mentionne les PDF omis", async () => {
    mockGetObjectBufferR2.mockResolvedValue(null);
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      {
        id: "doc-3",
        type: "emargement",
        numero: "AXI-EMAR-2026-007",
        createdAt: new Date("2026-05-10T09:00:00Z"),
      },
    ]);

    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    const index = await zip.files["index.txt"]!.async("string");
    expect(index).toContain("[OMIS]");
    expect(index).toContain("AXI-EMAR-2026-007");
  });

  it("en mode stub.invalid retourne un ZIP minimal avec manifeste.json + manifeste.md", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await genererDossierAuditZip();
      const zip = await JSZip.loadAsync(result.base64, { base64: true });
      expect(zip.files["manifeste.json"]).toBeDefined();
      expect(zip.files["manifeste.md"]).toBeDefined();
      // Pas d'appel Prisma ni R2 en mode stub — ni de rendu de registres
      expect(mockPrisma.documentGenere.findMany).not.toHaveBeenCalled();
      expect(mockGetObjectBufferR2).not.toHaveBeenCalled();
      expect(mockRenderRegistrePdfBuffer).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  // ── Exports d'état des registres (LOT 2 — A3/A7/A8/A17/A18) ───────────────

  it("le ZIP contient les 5 exports d'état des registres sous registres/", async () => {
    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    for (const type of [
      "reclamations",
      "veille",
      "revue_direction",
      "partenariats",
      "sous_traitants",
    ]) {
      expect(zip.files[`registres/${type}.pdf`], `registres/${type}.pdf`).toBeDefined();
    }
    expect(mockRenderRegistrePdfBuffer).toHaveBeenCalledTimes(5);
  });

  it("un registre en erreur est omis (fail-soft) et consigné dans index.txt", async () => {
    mockRenderRegistrePdfBuffer.mockImplementation((type: string) =>
      type === "veille"
        ? Promise.reject(new Error("rendu impossible"))
        : Promise.resolve({
            buffer: Buffer.from(`%PDF-1.4 registre ${type}`),
            filename: `${type}.pdf`,
          }),
    );
    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    expect(zip.files["registres/veille.pdf"]).toBeUndefined();
    expect(zip.files["registres/reclamations.pdf"]).toBeDefined();
    const index = await zip.files["index.txt"]!.async("string");
    expect(index).toContain("[OMIS] registres/veille");
  });
});
