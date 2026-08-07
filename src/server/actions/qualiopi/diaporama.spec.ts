/**
 * Tests — génération du diaporama .pptx d'une formation.
 *
 * Ce qui se joue ici n'est pas « le fichier se produit » (le rendu OOXML a ses
 * propres tests) mais les quatre décisions qui protègent l'existant :
 *
 *  1. on refuse de produire un deck vide plutôt que de laisser croire que la
 *     formation est outillée ;
 *  2. on refuse quand la formation n'a pas de kit — le fichier n'aurait pas
 *     d'emplacement ;
 *  3. un contenu identique ne crée PAS de version ;
 *  4. une génération crée TOUJOURS une nouvelle version, jamais la réutilisation
 *     d'un brouillon qui peut appartenir à un dépôt manuel en cours.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { findUnique: vi.fn() },
    interventionDocument: { upsert: vi.fn() },
    interventionDocumentVersion: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/actions/qualiopi/_revalidate", () => ({
  revalidateFormationPages: vi.fn(),
}));

const uploadToR2 = vi.fn().mockResolvedValue({ key: "k" });
vi.mock("@/lib/r2-storage", () => ({
  uploadToR2: (...args: unknown[]) => uploadToR2(...args),
  isR2Configured: () => true,
}));

const resolveSlug = vi.fn<(f: { slug: string }) => string | null>();
vi.mock("@/server/qualiopi/vente/kit-formation", () => ({
  resolveInterventionSlugForFormation: (f: { slug: string }) => resolveSlug(f),
}));

import { prisma } from "@/lib/prisma";
import { genererDiaporamaAction } from "./diaporama";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { buildFormationImportData } from "@/server/qualiopi/formations/catalog-import";

const ID = "11111111-1111-4111-8111-111111111111";

/** Le programme RÉEL du pilote, tel qu'il arrive en base après import. */
function programmePilote(): unknown {
  const f = FORMATIONS_V2.find((x) => x.id === "ia-pour-les-rh")!;
  return buildFormationImportData(f, "offre-x").programmeDetaille;
}

/** Un programme de squelette : des titres, aucun contenu rédigé. */
const PROGRAMME_NU = [
  { moduleId: "mod-1", titre: "Module 1 — Découvrir", sequences: [{ titre: "Accueil" }] },
];

function poserFormation(programmeDetaille: unknown): void {
  vi.mocked(prisma.formation.findUnique).mockResolvedValue({
    id: ID,
    slug: "ia-pour-les-rh",
    titre: "IA pour les RH",
    dureeHeures: 7,
    programmeDetaille,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveSlug.mockReturnValue("ia-pour-les-rh");
  uploadToR2.mockResolvedValue({ key: "k" });
  vi.mocked(prisma.interventionDocument.upsert).mockResolvedValue({ id: "doc-1" } as never);
  vi.mocked(prisma.interventionDocumentVersion.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.interventionDocumentVersion.create).mockImplementation(((args: {
    data: { version: number };
  }) => Promise.resolve({ id: "v", ...args.data })) as never);
});

describe("genererDiaporamaAction — ce qu'on refuse de produire", () => {
  /**
   * 🔴 Une couverture et un sommaire se construisent à partir des seuls titres.
   * Un deck qui n'a QUE cela est vide, et le déposer donnerait à croire que la
   * formation est outillée — c'est précisément ce que le chantier corrige.
   */
  it("refuse un programme sans contenu rédigé, en le disant", async () => {
    poserFormation(PROGRAMME_NU);
    const r = await genererDiaporamaAction({ formationId: ID });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("contenu rédigé");
    expect(prisma.interventionDocumentVersion.create).not.toHaveBeenCalled();
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it("refuse une formation sans kit documentaire — le fichier n'aurait pas d'emplacement", async () => {
    poserFormation(programmePilote());
    resolveSlug.mockReturnValue(null);

    const r = await genererDiaporamaAction({ formationId: ID });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("kit documentaire");
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it("refuse une formation introuvable", async () => {
    vi.mocked(prisma.formation.findUnique).mockResolvedValue(null as never);
    const r = await genererDiaporamaAction({ formationId: ID });
    expect(r.ok).toBe(false);
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const r = await genererDiaporamaAction({ formationId: "pas-un-uuid" });
    expect(r.ok).toBe(false);
    expect(prisma.formation.findUnique).not.toHaveBeenCalled();
  });
});

describe("genererDiaporamaAction — ce qui protège l'existant", () => {
  it("produit une première version depuis le programme rédigé", async () => {
    poserFormation(programmePilote());
    const r = await genererDiaporamaAction({ formationId: ID });

    expect(r.ok).toBe(true);
    expect(r.ok === true && r.version).toBe(1);
    expect(r.ok === true && r.slides).toBeGreaterThan(20);
    expect(r.ok === true && r.inchange).toBe(false);

    // Déposé en .pptx, sous la clé versionnée du slot « diaporama ».
    const [cle, , mime] = uploadToR2.mock.calls[0] as [string, Buffer, string];
    expect(cle).toBe("interventions/ia-pour-les-rh/diaporama/v1/source.pptx");
    expect(mime).toContain("presentationml.presentation");
  });

  /**
   * 🔴 La version est créée en BROUILLON. Tant que Will n'a pas publié, c'est la
   * version déposée à la main qui reste servie : l'import manuel ne fait pas que
   * rester possible, il garde la main.
   */
  it("crée la version en brouillon, jamais publiée d'office", async () => {
    poserFormation(programmePilote());
    await genererDiaporamaAction({ formationId: ID });

    const data = vi.mocked(prisma.interventionDocumentVersion.create).mock.calls[0]![0]!.data as {
      statut: string;
      sourceFormat: string;
      hashSha256: string;
    };
    expect(data.statut).toBe("brouillon");
    expect(data.sourceFormat).toBe("pptx");
    expect(data.hashSha256).toHaveLength(64);
  });

  /**
   * 🔴 Cliquer deux fois ne doit pas produire deux versions. On compare
   * l'empreinte du fichier, pas une date : régénérer après une modification qui
   * ne touche pas ce diaporama ne produit rien non plus.
   */
  it("ne crée AUCUNE version quand le contenu est identique", async () => {
    poserFormation(programmePilote());
    await genererDiaporamaAction({ formationId: ID });
    const empreinte = (
      vi.mocked(prisma.interventionDocumentVersion.create).mock.calls[0]![0]!.data as {
        hashSha256: string;
      }
    ).hashSha256;

    vi.clearAllMocks();
    poserFormation(programmePilote());
    resolveSlug.mockReturnValue("ia-pour-les-rh");
    vi.mocked(prisma.interventionDocument.upsert).mockResolvedValue({ id: "doc-1" } as never);
    vi.mocked(prisma.interventionDocumentVersion.findFirst).mockResolvedValue({
      version: 1,
      hashSha256: empreinte,
    } as never);

    const r = await genererDiaporamaAction({ formationId: ID });
    expect(r.ok === true && r.inchange).toBe(true);
    expect(prisma.interventionDocumentVersion.create).not.toHaveBeenCalled();
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  /**
   * 🔴 Le point le plus important. Un brouillon existant peut appartenir à un
   * dépôt MANUEL en cours ; le réutiliser écraserait un travail sans le dire. On
   * incrémente toujours.
   */
  it("incrémente la version au lieu de réutiliser un brouillon existant", async () => {
    poserFormation(programmePilote());
    vi.mocked(prisma.interventionDocumentVersion.findFirst).mockResolvedValue({
      version: 4,
      hashSha256: "empreinte-d-un-depot-manuel",
    } as never);

    const r = await genererDiaporamaAction({ formationId: ID });
    expect(r.ok === true && r.version).toBe(5);

    const [cle] = uploadToR2.mock.calls[0] as [string];
    expect(cle).toBe("interventions/ia-pour-les-rh/diaporama/v5/source.pptx");
  });

  it("n'enregistre rien si le dépôt sur le stockage échoue", async () => {
    poserFormation(programmePilote());
    uploadToR2.mockRejectedValue(new Error("R2 indisponible"));

    const r = await genererDiaporamaAction({ formationId: ID });
    expect(r.ok).toBe(false);
    expect(prisma.interventionDocumentVersion.create).not.toHaveBeenCalled();
  });
});
