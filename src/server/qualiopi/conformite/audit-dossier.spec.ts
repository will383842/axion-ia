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
    trainerDocument: {
      findMany: vi.fn(),
    },
    documentGenere: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    veille: { count: vi.fn() },
    appreciation: { count: vi.fn() },
    trainer: { findMany: vi.fn() },
    // off.32 ⭐ : le manifeste lit desormais le CONTENU de la revue de direction
    // de l'annee courante, pas seulement le nom de son pilote.
    revueDirection: { findFirst: vi.fn() },
  },
}));

// `documentPdfKey` reste RÉEL : c'est la clé sur laquelle porte l'assertion des
// tests d'inclusion des PDF. La remplacer par un double la recopierait ici, et
// on ne testerait plus que la copie.
vi.mock("@/lib/r2-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2-storage")>()),
  getObjectBufferR2: vi.fn(),
  isR2Configured: vi.fn(() => true),
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
import { getObjectBufferR2, isR2Configured } from "@/lib/r2-storage";
import { renderRegistrePdfBuffer } from "@/server/qualiopi/registres/registres-pdf";
import {
  genererManifesteAudit,
  genererDossierAuditZip,
  MAX_FORMATEURS_NOMMES,
  MAX_PIECES_LISTEES,
  pieceAdmissibleAuDossier,
} from "./audit-dossier";
import { INDICATEURS_RNQ } from "./indicateurs-registre";
import JSZip from "jszip";
// Type réel de l'énumération Prisma : un type de document mal orthographié dans
// une fixture ci-dessous devient une erreur de compilation, et non une
// assertion `not.toContain` qui passe parce qu'elle ne trouve jamais rien.
import type { DocumentType } from "../../../../prisma/generated/client";

const mockPrisma = prisma as unknown as {
  trainerDocument: { findMany: ReturnType<typeof vi.fn> };
  documentGenere: { groupBy: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  veille: { count: ReturnType<typeof vi.fn> };
  appreciation: { count: ReturnType<typeof vi.fn> };
  trainer: { findMany: ReturnType<typeof vi.fn> };
  revueDirection: { findFirst: ReturnType<typeof vi.fn> };
};
const mockEvaluerConformite = evaluerConformite as ReturnType<typeof vi.fn>;
const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;
const mockGetObjectBufferR2 = getObjectBufferR2 as ReturnType<typeof vi.fn>;
const mockIsR2Configured = isR2Configured as ReturnType<typeof vi.fn>;
const mockRenderRegistrePdfBuffer = renderRegistrePdfBuffer as ReturnType<typeof vi.fn>;

type StatutIndicateur = "couvert" | "a_completer" | "non_applicable";

// Résultat de conformité simulé avec 32 indicateurs
function makeConformiteResult(
  overrides: {
    nbCouverts?: number;
    nbApplicables?: number;
    scorePct?: number;
    /** Statuts forcés, par numéro d'indicateur (défaut : "a_completer"). */
    statuts?: Readonly<Record<number, StatutIndicateur>>;
  } = {},
) {
  const indicateurs = INDICATEURS_RNQ.map((ind) => ({
    numero: ind.numero,
    libelle: ind.libelleOfficiel,
    critere: ind.critere,
    super: ind.super,
    statut: overrides.statuts?.[ind.numero] ?? ("a_completer" as StatutIndicateur),
    preuves: [] as string[],
  }));
  return {
    indicateurs,
    nbCouverts: overrides.nbCouverts ?? 0,
    nbApplicables: overrides.nbApplicables ?? 25,
    scorePct: overrides.scorePct ?? 0,
  };
}

/**
 * Double de `prisma.documentGenere.groupBy` qui HONORE le filtre
 * `where.annuleeAt`, comme le fait Postgres.
 *
 * Sans cela, aucun test ne pourrait distinguer un comptage qui EXCLUT les
 * pièces annulées d'un comptage qui les additionne : le double retournerait la
 * même chose dans les deux cas, et la garde ne garderait rien. Ici, retirer le
 * `where` du code de production fait revenir les pièces annulées dans le
 * comptage — et les assertions rougissent.
 */
function groupByHonorantAnnulation(
  pieces: ReadonlyArray<{ type: DocumentType; annulee: boolean }>,
) {
  return (args?: { where?: { annuleeAt?: Date | null } }): Promise<unknown[]> => {
    const retenues = args?.where?.annuleeAt === null ? pieces.filter((p) => !p.annulee) : pieces;
    const comptes = new Map<string, number>();
    for (const piece of retenues) {
      comptes.set(piece.type, (comptes.get(piece.type) ?? 0) + 1);
    }
    return Promise.resolve(
      [...comptes.entries()].map(([type, n]) => ({ type, _count: { _all: n } })),
    );
  };
}

/** Types de documents annoncés par le manifeste pour un indicateur donné. */
function typesAnnonces(
  manifeste: Awaited<ReturnType<typeof genererManifesteAudit>>,
  numero: number,
): string[] {
  return (manifeste.json.indicateurs.find((i) => i.numero === numero)?.documents ?? []).map(
    (d) => d.type as string,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("genererManifesteAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluerConformite.mockResolvedValue(makeConformiteResult());
    mockPrisma.documentGenere.groupBy.mockResolvedValue([]);
    // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour : sans ce
    // repositionnement, l'export des pièces formateur reçoit `undefined`.
    mockPrisma.trainerDocument.findMany.mockResolvedValue([]);
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);
    mockPrisma.veille.count.mockResolvedValue(0);
    mockPrisma.appreciation.count.mockResolvedValue(0);
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    // `null` = aucune revue VALIDEE pour l'annee courante : etat par defaut,
    // sous lequel off.32 ⭐ doit rester NON couvert.
    mockPrisma.revueDirection.findFirst.mockResolvedValue(null);
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

  it("off.26 : manifeste expose le référent handicap s'il est nommé ET joignable", async () => {
    mockGetConfig.mockImplementation((cle: string) => {
      if (cle === "referent_handicap_nom") return Promise.resolve("Williams Jullin");
      if (cle === "referent_handicap_email") return Promise.resolve("referent@axion-ia.com");
      return Promise.resolve("");
    });
    const result = await genererManifesteAudit();
    const ind26 = result.json.indicateurs.find((i) => i.numero === 26);
    const preuvesText = ind26?.preuves.join(" ") ?? "";
    expect(preuvesText).toContain("Williams Jullin");
    expect(preuvesText).toMatch(/désigné/i);
  });

  it("🔴 off.26 : un nom SANS e-mail ne vaut pas désignation dans le manifeste", async () => {
    // C'est le cas réel sur une base vierge : `referent_handicap_nom` porte au
    // registre le défaut « Williams Jullin », donc le manifeste remis au
    // certificateur affirmait une désignation que personne n'avait faite.
    // Le nom reste imprimé — le cacher priverait l'auditeur d'une information —
    // mais il est explicitement présenté comme insuffisant.
    mockGetConfig.mockImplementation((cle: string) => {
      if (cle === "referent_handicap_nom") return Promise.resolve("Williams Jullin");
      return Promise.resolve("");
    });
    const result = await genererManifesteAudit();
    const ind26 = result.json.indicateurs.find((i) => i.numero === 26);
    const preuvesText = ind26?.preuves.join(" ") ?? "";
    expect(
      preuvesText,
      "Le manifeste ne doit pas affirmer une désignation sur la seule foi d'un " +
        "nom qui a une valeur par défaut.",
    ).not.toMatch(/désigné/i);
    expect(preuvesText).toMatch(/aucun e-mail/i);
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

  // 🔴 2026-09-02 — le libellé disait « CV téléversé », et c'était FAUX : quand
  // l'outil génère la fiche formateur, c'est LUI qui pose `cvUrl`. L'audit blanc
  // du 2026-08-15 l'avait corrigé dans le moteur ; le MANIFESTE, lui, n'avait
  // pas suivi et réaffirmait « CV téléversé » deux lignes sous le libellé
  // corrigé. Cette garde refuse le retour de l'affirmation fausse.
  it("off.21 : manifeste signale l'absence de fiche formateur, sans parler de « CV téléversé »", async () => {
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    const result = await genererManifesteAudit();
    const ind21 = result.json.indicateurs.find((i) => i.numero === 21);
    const preuvesText = ind21?.preuves.join(" ") ?? "";
    expect(preuvesText).toMatch(/aucune fiche formateur/i);
    expect(preuvesText).not.toMatch(/téléversé/i);
  });

  // 🔴 2026-09-02 — cette énumération n'avait AUCUN plafond : sur un OF à cent
  // intervenants, l'indicateur 21 rendait cent lignes d'annuaire au milieu du
  // manifeste d'audit. Et chaque ligne commençait par « - », se faisant passer
  // pour une sous-puce Markdown : le rendu écrivait « - - Sophie Durand ».
  it("off.21 : la liste des fiches est plafonnée, la troncature se DIT, et aucune ligne ne recommence par un tiret", async () => {
    mockPrisma.trainer.findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        id: `t-${i}`,
        nom: `Nom${i}`,
        prenom: `Prenom${i}`,
        cvUrl: `https://exemple.invalid/cv-${i}.pdf`,
      })),
    );
    const result = await genererManifesteAudit();
    const preuves = result.json.indicateurs.find((i) => i.numero === 21)?.preuves ?? [];
    const nommes = preuves.filter((p) => p.startsWith("Fiche au dossier :"));
    expect(nommes).toHaveLength(MAX_FORMATEURS_NOMMES);
    expect(preuves.join(" ")).toContain("Liste plafonnée : 12 fiches au registre");
    expect(preuves.some((p) => p.trimStart().startsWith("-"))).toBe(false);
    // L'URL brute de la fiche n'a rien à faire dans une preuve lue en séance :
    // elle n'est ni cliquable dans le Markdown imprimé, ni parlante.
    expect(preuves.join(" ")).not.toContain("exemple.invalid");
  });

  // ── off.1 : NDA DREETS requis pour couverture (S5) ────────────────────────

  it("off.1 : manifeste affiche le NDA si renseigné", async () => {
    // 🔴 2026-08-23 — ce mock était positionnel (« 1er appel = referent_handicap_nom,
    // 2e = nda_numero ») et s'est cassé le jour où une lecture de configuration a
    // été ajoutée en amont, pour une raison sans aucun rapport avec le NDA. Un
    // mock qui dépend de l'ORDRE des appels transforme tout ajout de lecture en
    // faux rouge, et le rouge accuse le mauvais coupable.
    // Il est désormais indexé par CLÉ : il ne peut plus être décalé.
    mockGetConfig.mockImplementation((cle: string) =>
      Promise.resolve(cle === "nda_numero" ? "11075XXXX75" : ""),
    );
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
    // `null` = aucune revue VALIDEE pour l'annee courante : etat par defaut,
    // sous lequel off.32 ⭐ doit rester NON couvert.
    mockPrisma.revueDirection.findFirst.mockResolvedValue(null);
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

  it("[P1] R2 non configuré → AVERTISSEMENTS.txt visible (dossier non silencieux)", async () => {
    mockIsR2Configured.mockReturnValue(false);
    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    expect(zip.files["AVERTISSEMENTS.txt"]).toBeDefined();
    const txt = await zip.files["AVERTISSEMENTS.txt"]!.async("string");
    expect(txt).toMatch(/R2 NON CONFIGUR/i);
    // L'index reprend aussi la bannière en tête.
    const index = await zip.files["index.txt"]!.async("string");
    expect(index).toMatch(/AVERTISSEMENTS/);
  });

  it("[P1] documents en base mais aucun PDF joint → avertissement explicite", async () => {
    mockIsR2Configured.mockReturnValue(true);
    mockGetObjectBufferR2.mockResolvedValue(null); // toutes les clés introuvables
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      {
        id: "d1",
        type: "convention",
        numero: "AXI-CONV-2026-0001",
        createdAt: new Date("2026-03-01"),
      },
    ]);
    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    expect(zip.files["AVERTISSEMENTS.txt"]).toBeDefined();
    const txt = await zip.files["AVERTISSEMENTS.txt"]!.async("string");
    expect(txt).toMatch(/AUCUN PDF de preuve joint/i);
  });

  it("[P1] R2 configuré + aucun document → pas d'AVERTISSEMENTS.txt", async () => {
    mockIsR2Configured.mockReturnValue(true);
    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    expect(zip.files["AVERTISSEMENTS.txt"]).toBeUndefined();
  });

  // ── [C3] Statut d'incomplétude exposé dans le type de retour ──────────────

  it("[C3] R2 configuré + aucun document → complet (incomplet=false, 0/0)", async () => {
    mockIsR2Configured.mockReturnValue(true);
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);
    const result = await genererDossierAuditZip();
    expect(result.incomplet).toBe(false);
    expect(result.nbPreuvesAttendues).toBe(0);
    expect(result.nbPreuvesJointes).toBe(0);
    expect(result.avertissements).toEqual([]);
  });

  it("[C3] R2 non configuré → incomplet=true + avertissement R2", async () => {
    mockIsR2Configured.mockReturnValue(false);
    const result = await genererDossierAuditZip();
    expect(result.incomplet).toBe(true);
    expect(result.avertissements.join(" ")).toMatch(/R2 NON CONFIGUR/i);
  });

  it("[C3] documents en base mais aucun PDF joint → incomplet=true, jointes < attendues", async () => {
    mockIsR2Configured.mockReturnValue(true);
    mockGetObjectBufferR2.mockResolvedValue(null);
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      {
        id: "d1",
        type: "convention",
        numero: "AXI-CONV-2026-0001",
        createdAt: new Date("2026-03-01"),
      },
      {
        id: "d2",
        type: "attestation",
        numero: "AXI-ATT-2026-0002",
        createdAt: new Date("2026-03-02"),
      },
    ]);
    const result = await genererDossierAuditZip();
    expect(result.incomplet).toBe(true);
    expect(result.nbPreuvesAttendues).toBe(2);
    expect(result.nbPreuvesJointes).toBe(0);
    expect(result.avertissements.join(" ")).toMatch(/AUCUN PDF de preuve joint/i);
  });

  it("[C3] toutes les preuves jointes → incomplet=false, jointes = attendues", async () => {
    mockIsR2Configured.mockReturnValue(true);
    mockGetObjectBufferR2.mockResolvedValue(Buffer.from("%PDF-1.4 ok"));
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      {
        id: "d1",
        type: "convention",
        numero: "AXI-CONV-2026-0001",
        createdAt: new Date("2026-03-01"),
      },
    ]);
    const result = await genererDossierAuditZip();
    expect(result.incomplet).toBe(false);
    expect(result.nbPreuvesAttendues).toBe(1);
    expect(result.nbPreuvesJointes).toBe(1);
    expect(result.avertissements).toEqual([]);
  });

  it("[C3] preuves partiellement jointes → incomplet=true, jointes < attendues", async () => {
    mockIsR2Configured.mockReturnValue(true);
    // 1er doc trouvé dans R2, 2e absent
    mockGetObjectBufferR2
      .mockResolvedValueOnce(Buffer.from("%PDF-1.4 ok"))
      .mockResolvedValueOnce(null);
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      {
        id: "d1",
        type: "convention",
        numero: "AXI-CONV-2026-0001",
        createdAt: new Date("2026-03-01"),
      },
      {
        id: "d2",
        type: "attestation",
        numero: "AXI-ATT-2026-0002",
        createdAt: new Date("2026-03-02"),
      },
    ]);
    const result = await genererDossierAuditZip();
    expect(result.incomplet).toBe(true);
    expect(result.nbPreuvesAttendues).toBe(2);
    expect(result.nbPreuvesJointes).toBe(1);
  });

  it("[C3] mode stub.invalid → incomplet=true avec avertissement", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await genererDossierAuditZip();
      expect(result.incomplet).toBe(true);
      expect(result.nbPreuvesAttendues).toBe(0);
      expect(result.nbPreuvesJointes).toBe(0);
      expect(result.avertissements.length).toBeGreaterThan(0);
    } finally {
      process.env["DATABASE_URL"] = original;
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Constat F15 — une absence n'est pas une preuve.
//
// Le manifeste remis au certificateur listait sous « Preuves » des constats
// d'ABSENCE produits par le même code que les preuves réelles :
// « 0 réclamation enregistrée et traitée », « Procédure de réclamations : non
// attestée publiée », « Responsable qualité : non renseigné ».
//
// `preuves: string[]` ne porte aucune polarité. Tant que le typage ternaire
// (probant / neutre / lacune) n'est pas en place, le document ne doit pas
// AFFIRMER ce qu'il ne sait pas.
// ─────────────────────────────────────────────────────────────────────────────

describe("Manifeste — ne présente plus un manque comme une preuve", () => {
  it("l'en-tête de section est neutre, sur le document remis au certificateur", async () => {
    const r = await genererManifesteAudit();
    expect(r.markdown).toContain("**Éléments constatés :**");
    expect(r.markdown).not.toContain("**Preuves :**");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Audit blanc 2026-08-15 — le manifeste annonçait des preuves que le ZIP ne
// contenait pas.
//
// La constitution du ZIP exclut les pièces annulées (`where: { annuleeAt: null }`),
// pas le comptage du manifeste. L'auditrice lisait « lettre_mission — 1 document »
// à l'indicateur 17, ouvrait `preuves/lettre_mission/` et n'y trouvait rien.
// Une pièce annulée ne se compte NULLE PART.
// ─────────────────────────────────────────────────────────────────────────────

describe("Manifeste — une pièce annulée ne se compte nulle part", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluerConformite.mockResolvedValue(makeConformiteResult());
    mockPrisma.documentGenere.groupBy.mockResolvedValue([]);
    mockPrisma.trainerDocument.findMany.mockResolvedValue([]);
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);
    mockPrisma.veille.count.mockResolvedValue(0);
    mockPrisma.appreciation.count.mockResolvedValue(0);
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    // `null` = aucune revue VALIDEE pour l'annee courante : etat par defaut,
    // sous lequel off.32 ⭐ doit rester NON couvert.
    mockPrisma.revueDirection.findFirst.mockResolvedValue(null);
    mockGetConfig.mockResolvedValue("");
    mockGetObjectBufferR2.mockResolvedValue(null);
    mockIsR2Configured.mockReturnValue(true);
    mockRenderRegistrePdfBuffer.mockImplementation((type: string) =>
      Promise.resolve({
        buffer: Buffer.from(`%PDF-1.4 registre ${type}`),
        filename: `${type}.pdf`,
      }),
    );
  });

  it("le comptage passe le MÊME filtre que la constitution du ZIP", async () => {
    // 🔴 Mis à jour le 2026-08-20 (`D2-5-12`). Ce test comparait le `where` à un
    // littéral recopié ici. Il a donc ROUGI quand le prédicat a gagné
    // l'exclusion des sessions annulées et reportées — et c'était son travail.
    //
    // 🔑 Mais on ne recopie PAS le nouveau littéral à sa place : ce serait
    // recréer la divergence qu'on vient de fermer, à un endroit de plus. Le
    // test compare désormais à `pieceAdmissibleAuDossier()` LUI-MÊME. Ce qu'il
    // garde n'est plus la valeur du prédicat — d'autres tests s'en chargent —
    // mais le fait que le comptage et le ZIP passent le MÊME.
    await genererManifesteAudit();
    expect(mockPrisma.documentGenere.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: pieceAdmissibleAuDossier() }),
    );
    // ⚠️ Pas d'assertion sur `findMany` ICI : dans ce test le `groupBy` rend un
    // ensemble vide, donc aucun type n'est interrogé et `findMany` n'est jamais
    // appelé. Une assertion posée là aurait rougi pour une raison qui n'a rien à
    // voir avec ce qu'elle prétend garder. Les trois lectures sont couvertes
    // par le test statique « les TROIS lectures passent par le même prédicat ».
  });

  it("off.17 n'annonce pas la seule lettre de mission du registre si elle est annulée", async () => {
    mockPrisma.documentGenere.groupBy.mockImplementation(
      groupByHonorantAnnulation([{ type: "lettre_mission", annulee: true }]),
    );
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 17)).not.toContain("lettre_mission");
    expect(manifeste.markdown).not.toContain("`lettre_mission`");
  });

  it("off.17 annonce les lettres de mission EN VIGUEUR, sans compter l'annulée", async () => {
    // Contrôle de sensibilité : le double n'est pas muet, il sait compter.
    mockPrisma.documentGenere.groupBy.mockImplementation(
      groupByHonorantAnnulation([
        { type: "lettre_mission", annulee: false },
        { type: "lettre_mission", annulee: true },
      ]),
    );
    const manifeste = await genererManifesteAudit();
    const ind17 = manifeste.json.indicateurs.find((i) => i.numero === 17);
    // `pieces` est vide ici : le double de `findMany` du bloc ne rend rien.
    // Le comptage, lui, vient du `groupBy` — c'est bien lui qui est testé.
    expect(ind17?.documents).toContainEqual({ type: "lettre_mission", count: 1, pieces: [] });
  });

  it("le manifeste du ZIP n'annonce aucune pièce que le ZIP ne contient pas", async () => {
    // Registre : une seule pièce, annulée. Le ZIP (qui filtre déjà) n'en porte
    // aucune ; le manifeste ne doit donc en annoncer aucune non plus.
    mockPrisma.documentGenere.groupBy.mockImplementation(
      groupByHonorantAnnulation([{ type: "lettre_mission", annulee: true }]),
    );
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);

    const result = await genererDossierAuditZip();
    const zip = await JSZip.loadAsync(result.base64, { base64: true });
    const parsed = JSON.parse(await zip.files["manifeste.json"]!.async("string")) as {
      indicateurs: { numero: number; documents: { type: string; count: number }[] }[];
    };

    const totalAnnonce = parsed.indicateurs.reduce(
      (n, ind) => n + ind.documents.reduce((m, d) => m + d.count, 0),
      0,
    );
    expect(totalAnnonce).toBe(0);
    expect(Object.keys(zip.files).some((f) => f.startsWith("preuves/"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Audit blanc 2026-08-15 — les pièces étaient rattachées aux mauvais
// indicateurs. Une pièce présentée en face d'une exigence qu'elle ne prouve pas
// n'est pas neutre : elle ouvre un écart.
// ─────────────────────────────────────────────────────────────────────────────

describe("Manifeste — chaque pièce en face de l'exigence qu'elle prouve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluerConformite.mockResolvedValue(makeConformiteResult());
    mockPrisma.trainerDocument.findMany.mockResolvedValue([]);
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);
    mockPrisma.veille.count.mockResolvedValue(0);
    mockPrisma.appreciation.count.mockResolvedValue(0);
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    // `null` = aucune revue VALIDEE pour l'annee courante : etat par defaut,
    // sous lequel off.32 ⭐ doit rester NON couvert.
    mockPrisma.revueDirection.findFirst.mockResolvedValue(null);
    mockGetConfig.mockResolvedValue("");
    mockGetObjectBufferR2.mockResolvedValue(null);
    // Le registre contient une pièce de chaque type utile aux assertions.
    mockPrisma.documentGenere.groupBy.mockImplementation(
      groupByHonorantAnnulation([
        { type: "programme", annulee: false },
        { type: "convocation", annulee: false },
        { type: "convention", annulee: false },
        { type: "convention_tripartite", annulee: false },
        { type: "contrat_sous_traitance", annulee: false },
        { type: "procedure_sous_traitance", annulee: false },
        { type: "grille_evaluation", annulee: false },
        { type: "positionnement", annulee: false },
        { type: "reglement_interieur", annulee: false },
        { type: "certificat_realisation", annulee: false },
        { type: "attestation", annulee: false },
        { type: "lettre_mission", annulee: false },
        { type: "liste_formateurs", annulee: false },
        { type: "cv_formateur", annulee: false },
        { type: "inventaire_moyens", annulee: false },
        { type: "kit_opco", annulee: false },
        { type: "kit_cpf", annulee: false },
        { type: "kit_france_travail", annulee: false },
      ]),
    );
  });

  it("off.5 et off.6 s'appuient sur le PROGRAMME (objectifs et contenus)", async () => {
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 5)).toContain("programme");
    expect(typesAnnonces(manifeste, 6)).toContain("programme");
    // La convention tripartite EST présente au registre simulé : les assertions
    // `not.toContain` des indicateurs 18 et 27 ne passent donc pas à vide.
    expect(typesAnnonces(manifeste, 6)).toContain("convention_tripartite");
  });

  it("off.5 ne présente plus la convocation ; elle reste à off.9", async () => {
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 5)).not.toContain("convocation");
    expect(typesAnnonces(manifeste, 9)).toContain("convocation");
  });

  it("off.8 présente la grille d'évaluation avec le positionnement", async () => {
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 8)).toEqual(
      expect.arrayContaining(["positionnement", "grille_evaluation"]),
    );
  });

  it("off.9 présente le règlement intérieur ; off.1 ne le présente plus", async () => {
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 9)).toContain("reglement_interieur");
    expect(typesAnnonces(manifeste, 1)).not.toContain("reglement_interieur");
  });

  it("off.27 s'appuie sur les pièces de SOUS-TRAITANCE, pas sur une convention de financement", async () => {
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 27)).toEqual(
      expect.arrayContaining(["procedure_sous_traitance", "contrat_sous_traitance"]),
    );
    expect(typesAnnonces(manifeste, 27)).not.toContain("convention_tripartite");
  });

  it("off.19 ne présente pas les kits de financement comme des ressources pédagogiques", async () => {
    const manifeste = await genererManifesteAudit();
    const types19 = typesAnnonces(manifeste, 19);
    expect(types19).not.toContain("kit_opco");
    expect(types19).not.toContain("kit_cpf");
    expect(types19).not.toContain("kit_france_travail");
    expect(types19).toContain("inventaire_moyens");
  });

  it("off.18 mobilise les intervenants (lettre de mission, sous-traitance), pas un financeur", async () => {
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 18)).toEqual(
      expect.arrayContaining(["lettre_mission", "contrat_sous_traitance"]),
    );
    expect(typesAnnonces(manifeste, 18)).not.toContain("convention_tripartite");
  });

  it("off.21 présente la LISTE des formateurs, pas seulement des fiches", async () => {
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 21)).toEqual(
      expect.arrayContaining(["cv_formateur", "liste_formateurs"]),
    );
  });

  it("off.3, off.7 et off.16 (certifiants) ne présentent aucune pièce qui ne les prouve pas", async () => {
    // Statut volontairement « à compléter » : c'est bien le RATTACHEMENT qui est
    // testé ici, pas le filtrage des indicateurs non applicables.
    const manifeste = await genererManifesteAudit();
    for (const numero of [3, 7, 16]) {
      expect(typesAnnonces(manifeste, numero), `off.${numero}`).toEqual([]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Audit blanc 2026-08-15 — l'indicateur 7 s'affichait « Non applicable » et
// listait malgré tout deux rubriques de documents dans la vue manifeste de la
// console (le Markdown, lui, les masquait déjà). Hors périmètre = rien à
// montrer, dans les DEUX sorties.
// ─────────────────────────────────────────────────────────────────────────────

describe("Manifeste — un indicateur non applicable ne présente aucune pièce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.trainerDocument.findMany.mockResolvedValue([]);
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);
    mockPrisma.veille.count.mockResolvedValue(0);
    mockPrisma.appreciation.count.mockResolvedValue(0);
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    // `null` = aucune revue VALIDEE pour l'annee courante : etat par defaut,
    // sous lequel off.32 ⭐ doit rester NON couvert.
    mockPrisma.revueDirection.findFirst.mockResolvedValue(null);
    mockGetConfig.mockResolvedValue("");
    mockGetObjectBufferR2.mockResolvedValue(null);
    mockPrisma.documentGenere.groupBy.mockImplementation(
      groupByHonorantAnnulation([
        { type: "emargement", annulee: false },
        { type: "releve_connexion", annulee: false },
      ]),
    );
  });

  it("off.12 hors périmètre : aucune rubrique de documents dans le JSON", async () => {
    mockEvaluerConformite.mockResolvedValue(
      makeConformiteResult({ statuts: { 12: "non_applicable" } }),
    );
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 12)).toEqual([]);
    expect(manifeste.markdown).toContain("*Non applicable au périmètre de l'OF.*");
  });

  it("off.12 applicable : les mêmes pièces sont bien annoncées (le filtre ne masque pas tout)", async () => {
    mockEvaluerConformite.mockResolvedValue(makeConformiteResult());
    const manifeste = await genererManifesteAudit();
    expect(typesAnnonces(manifeste, 12)).toEqual(
      expect.arrayContaining(["emargement", "releve_connexion"]),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 2026-08-17 — le manifeste annonçait des pièces qu'il ne permettait pas
// d'ouvrir.
//
// `PreuveDocument` valait `{ type, count }` : un libellé et un nombre. L'écran
// de l'auditrice affichait « Feuille d'émargement — 3 pièces » sans un seul
// numéro, sans un seul lien. La cause était EN AMONT de l'affichage : le modèle
// ne portait aucun identifiant, donc aucune vue ne POUVAIT en proposer.
//
// Le remède porte sa propre limite : une session peut cumuler des dizaines de
// pièces d'un même type, et une liste de deux cents liens n'est pas une preuve,
// c'est un annuaire. D'où un plafond — qui doit se DIRE quand il mord : une
// troncature muette se lit comme une liste complète.
// ─────────────────────────────────────────────────────────────────────────────

interface PieceDeRegistre {
  readonly id: string;
  readonly type: DocumentType;
  readonly numero: string;
  readonly createdAt: Date;
  readonly annulee: boolean;
}

/**
 * Double de `prisma.documentGenere.findMany` qui HONORE `where.type`,
 * `where.annuleeAt`, `orderBy: { createdAt: "desc" }` et surtout `take`.
 *
 * 🔴 `take` est honoré EXPRÈS. Si le double tronquait de lui-même, le test du
 * plafond ne testerait que le double : retirer `take: MAX_PIECES_LISTEES` du
 * code de production ne changerait rien et la garde ne garderait rien. Ici,
 * le retirer fait remonter les douze pièces — et les assertions rougissent.
 */
function findManyPiecesBornees(registre: ReadonlyArray<PieceDeRegistre>) {
  return (args?: {
    where?: { type?: DocumentType; annuleeAt?: Date | null };
    take?: number;
  }): Promise<unknown[]> => {
    const retenues = registre
      .filter((p) => args?.where?.type === undefined || p.type === args.where.type)
      .filter((p) => (args?.where?.annuleeAt === null ? !p.annulee : true))
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const bornees = args?.take === undefined ? retenues : retenues.slice(0, args.take);
    return Promise.resolve(bornees.map((p) => ({ id: p.id, numero: p.numero })));
  };
}

/** Fabrique `n` émargements datés croissants — le plus récent porte le n° le plus haut. */
function emargements(n: number): PieceDeRegistre[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `doc-${String(i + 1).padStart(3, "0")}`,
    type: "emargement" as DocumentType,
    numero: `AXI-EMAR-2026-${String(i + 1).padStart(3, "0")}`,
    createdAt: new Date(2026, 0, i + 1),
    annulee: false,
  }));
}

describe("Manifeste — les pièces sont DÉSIGNABLES, et le plafond se dit", () => {
  function armerRegistre(registre: ReadonlyArray<PieceDeRegistre>): void {
    mockPrisma.documentGenere.groupBy.mockImplementation(
      groupByHonorantAnnulation(registre.map((p) => ({ type: p.type, annulee: p.annulee }))),
    );
    mockPrisma.documentGenere.findMany.mockImplementation(findManyPiecesBornees(registre));
  }

  /** La rubrique « Documents » d'un indicateur, pour un type donné. */
  function rubrique(
    manifeste: Awaited<ReturnType<typeof genererManifesteAudit>>,
    numero: number,
    type: string,
  ) {
    return manifeste.json.indicateurs
      .find((i) => i.numero === numero)
      ?.documents.find((d) => (d.type as string) === type);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluerConformite.mockResolvedValue(makeConformiteResult());
    mockPrisma.trainerDocument.findMany.mockResolvedValue([]);
    mockPrisma.veille.count.mockResolvedValue(0);
    mockPrisma.appreciation.count.mockResolvedValue(0);
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    // `null` = aucune revue VALIDEE pour l'annee courante : etat par defaut,
    // sous lequel off.32 ⭐ doit rester NON couvert.
    mockPrisma.revueDirection.findFirst.mockResolvedValue(null);
    mockGetConfig.mockResolvedValue("");
    mockGetObjectBufferR2.mockResolvedValue(null);
    mockIsR2Configured.mockReturnValue(true);
    armerRegistre([]);
  });

  it("chaque pièce annoncée porte son identifiant ET son numéro", async () => {
    armerRegistre(emargements(2));
    const manifeste = await genererManifesteAudit();

    // off.12 (émargement / relevé de connexion), les plus récentes d'abord.
    expect(rubrique(manifeste, 12, "emargement")?.pieces).toEqual([
      { id: "doc-002", numero: "AXI-EMAR-2026-002" },
      { id: "doc-001", numero: "AXI-EMAR-2026-001" },
    ]);
  });

  it("une pièce ANNULÉE n'est jamais proposée au téléchargement", async () => {
    armerRegistre([
      ...emargements(1),
      {
        id: "doc-mort",
        type: "emargement" as DocumentType,
        numero: "AXI-EMAR-2026-666",
        createdAt: new Date(2026, 5, 1),
        annulee: true,
      },
    ]);
    const manifeste = await genererManifesteAudit();
    const r = rubrique(manifeste, 12, "emargement");
    expect(r?.count).toBe(1);
    expect(r?.pieces.map((p) => p.id)).toEqual(["doc-001"]);
  });

  it("le plafond mord : le compte reste EXACT, l'énumération est bornée", async () => {
    armerRegistre(emargements(12));
    const manifeste = await genererManifesteAudit();
    const r = rubrique(manifeste, 12, "emargement");

    // Le compte est celui du registre — jamais remplacé par le nombre affiché.
    expect(r?.count).toBe(12);
    expect(r?.pieces).toHaveLength(MAX_PIECES_LISTEES);
    expect(r?.pieces[0]).toEqual({ id: "doc-012", numero: "AXI-EMAR-2026-012" });
  });

  it("le plafond est ANNONCÉ dans le Markdown remis au certificateur", async () => {
    armerRegistre(emargements(12));
    const manifeste = await genererManifesteAudit();
    expect(manifeste.markdown).toContain(
      `- **Feuille d'émargement** (\`emargement\`) : 12 documents — ${MAX_PIECES_LISTEES} numéros listés sur 12 :`,
    );
  });

  it("sous le plafond, aucune troncature n'est annoncée (contrôle de sensibilité)", async () => {
    armerRegistre(emargements(2));
    const manifeste = await genererManifesteAudit();
    expect(manifeste.markdown).toContain(
      "- **Feuille d'émargement** (`emargement`) : 2 documents — AXI-EMAR-2026-002, AXI-EMAR-2026-001",
    );
    expect(manifeste.markdown).not.toMatch(/numéros? listés? sur/);
  });

  it("la ligne Markdown nomme la pièce en français, garde sa valeur technique, et ne verse aucun identifiant", async () => {
    armerRegistre(emargements(1));
    const manifeste = await genererManifesteAudit();
    // 🔴 2026-09-02 — la ligne s'écrivait « - `emargement` : 1 document ». Le
    // premier mot que lit l'auditrice était la valeur d'énumération. Le libellé
    // français passe devant ; la valeur technique RESTE, entre parenthèses,
    // parce que c'est elle qui nomme le dossier `preuves/<type>/` du ZIP —
    // la retirer romprait le lien entre le manifeste et le dossier remis.
    expect(manifeste.markdown).toContain(
      "- **Feuille d'émargement** (`emargement`) : 1 document — AXI-EMAR-2026-001",
    );
    expect(manifeste.markdown).not.toContain("doc-001");
  });

  it("aucune requête de pièces pour un type absent du registre", async () => {
    armerRegistre(emargements(1));
    await genererManifesteAudit();
    const typesInteroges = mockPrisma.documentGenere.findMany.mock.calls.map(
      (appel) => (appel[0] as { where: { type: string } }).where.type,
    );
    expect(typesInteroges).toEqual(["emargement"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// `D2-5-12` (2026-08-20) — le dossier remis au certificateur ne doit pas se
// contredire lui-même
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La branche du `OR` qui filtre par statut de session.
 *
 * Écrite une fois : trois tests l'interrogent, et la retrouver « à la main »
 * dans chacun aurait recréé, dans le SPEC, la triple recopie que le correctif
 * vient de supprimer dans le CODE.
 */
function brancheParSession(): { session: { statut: { notIn: readonly string[] } } } {
  const branche = pieceAdmissibleAuDossier().OR.find((clause) => "session" in clause);
  expect(branche, "une branche doit filtrer par statut de session").toBeDefined();
  return branche as { session: { statut: { notIn: readonly string[] } } };
}

describe("`D2-5-12` — pièces d'une session annulée ou reportée", () => {
  it("🔴 le prédicat exclut les sessions ANNULÉES et REPORTÉES", () => {
    const notIn = brancheParSession().session.statut.notIn;
    expect(notIn).toContain("annulee");
    // 🔑 `reportee` est le cœur du constat, et le cas le plus insidieux : la
    // pièce n'est PAS annulée — la convention a bien été signée — mais aucune
    // formation n'a eu lieu aux dates qu'elle porte. Le certificateur recevait
    // deux conventions pour la même prestation, dont une pour une période vide.
    expect(notIn).toContain("reportee");
  });

  it("🔴 les pièces SANS session restent admises — sinon le dossier se vide", () => {
    // 🔑 Témoin négatif indispensable. Un filtre naïf `session: { statut: … }`
    // sans la branche `sessionId: null` écarterait TOUTES les pièces générales
    // — procédures, registres, lettres-cadres — c'est-à-dire ce que la moitié
    // des indicateurs réclame. On aurait « corrigé » le dossier en le vidant.
    const where = pieceAdmissibleAuDossier();
    expect(where.OR).toContainEqual({ sessionId: null });
  });

  it("les pièces annulées restent exclues — la correction n'a rien relâché", () => {
    // Témoin de non-régression : le filtre d'origine survit à l'ajout du
    // nouveau. Deux exclusions, pas une qui remplace l'autre.
    expect(pieceAdmissibleAuDossier().annuleeAt).toBeNull();
  });

  it("🔴 les sessions PLANIFIÉE, EN COURS et RÉALISÉE restent dans le dossier", () => {
    // 🔑 Le second témoin négatif, et le plus important : un prédicat qui
    // exclurait tout statut viderait le dossier de ses vraies preuves. Une
    // session planifiée a déjà sa convention signée, et c'est précisément la
    // pièce que l'indicateur 10 réclame.
    const exclus = brancheParSession().session.statut.notIn;
    for (const statut of ["planifiee", "en_cours", "realisee"]) {
      expect(exclus, `« ${statut} » ne doit PAS être exclu`).not.toContain(statut);
    }
  });

  it("🔴 les TROIS lectures du dossier passent par le même prédicat", async () => {
    // Le prédicat vivait en littéral à trois endroits — comptage, liste par
    // type, ZIP — chacun coiffé d'un commentaire priant de les garder
    // identiques. Une prière n'est pas une garantie : `regleSignatureEnAttente`
    // a divergé de `enAttente()` exactement ainsi (`D3-4-06`), et une alerte
    // critique partait chaque nuit sur des pièces annulées.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src", "server", "qualiopi", "conformite", "audit-dossier.ts"),
      "utf-8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    const appels = source.match(/pieceAdmissibleAuDossier\(\)/g) ?? [];
    // 🔴 2026-08-24 — le seuil était de 4 : « 3 lectures + 1 définition + 1
    // `return` interne ». La DÉFINITION a quitté ce fichier pour
    // `piece-admissible.ts`, afin que `conformite-service.ts` puisse enfin
    // l'appeler sans créer de cycle d'import (cahier D1-4). Il ne reste donc
    // que les 3 lectures ici.
    //
    // ⚠️ Le seuil n'est pas « baissé pour passer » : il compte maintenant ce
    // qu'il doit compter — les LECTURES — et le test qui suit exige que la
    // définition existe bien ailleurs. Sans ce second contrôle, supprimer le
    // prédicat partagé laisserait celui-ci vert.
    expect(appels.length, `lectures trouvées : ${appels.length}`).toBeGreaterThanOrEqual(3);
    // Et plus aucun littéral `annuleeAt: null` posé à la main dans une requête.
    const litteraux = source.match(/where:\s*\{[^}]*annuleeAt:\s*null/g) ?? [];
    expect(litteraux, `littéraux résiduels : ${litteraux.length}`).toHaveLength(0);
  });

  it("🔴 la définition du prédicat existe bien dans le module partagé", async () => {
    // 🔑 Le contre-témoin du test précédent, et il n'est pas facultatif.
    //
    // Depuis que la définition a quitté `audit-dossier.ts`, un compte de
    // lectures ne dit plus rien de son existence : supprimer le prédicat
    // partagé, ou le vider de sa substance, laisserait le test ci-dessus
    // parfaitement vert. On vérifie donc la source ELLE-MÊME.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src", "server", "qualiopi", "conformite", "piece-admissible.ts"),
      "utf-8",
    );

    expect(
      source,
      "`piece-admissible.ts` ne définit plus le prédicat : les lectures d'" +
        "`audit-dossier.ts` pointent vers un module vide.",
    ).toContain("export function pieceAdmissibleAuDossier()");

    for (const statut of ["annulee", "reportee"]) {
      expect(
        source,
        `le prédicat partagé n'exclut plus « ${statut} » : les pièces d'une ` +
          `session qui n'a pas eu lieu redeviennent des preuves d'indicateur.`,
      ).toContain(`"${statut}"`);
    }
  });
});
