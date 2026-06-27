/**
 * Tests — archiveFormationAction / duplicateFormationAction (WS6).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "f1" }),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireAdminPublish: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/server/qualiopi/formations/numbering", () => ({
  allocateFormationNumero: vi.fn().mockResolvedValue("AXI-FORM-2026-099"),
}));

vi.mock("@/server/qualiopi/numbering/retry", () => ({
  withNumberRetry: (fn: () => unknown) => fn(),
}));

import { prisma } from "@/lib/prisma";
import { archiveFormationAction, duplicateFormationAction } from "./formations";

const mockPrisma = prisma as unknown as {
  formation: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const ID = "f1234567-89ab-cdef-0123-456789abcdef";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.formation.update.mockResolvedValue({ id: ID });
  mockPrisma.formation.create.mockResolvedValue({ id: "new-id", numero: "AXI-FORM-2026-099" });
});

describe("archiveFormationAction", () => {
  it("passe statut + statutGeneration à archive", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue({ id: ID, slug: "ia-express", statut: "actif" });
    const res = await archiveFormationAction(ID);
    expect("data" in res).toBe(true);
    const data = mockPrisma.formation.update.mock.calls[0]![0].data;
    expect(data.statut).toBe("archive");
    expect(data.statutGeneration).toBe("archive");
  });

  it("idempotent : déjà archivée → pas d'écriture", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue({ id: ID, slug: "x", statut: "archive" });
    const res = await archiveFormationAction(ID);
    expect("data" in res).toBe(true);
    expect(mockPrisma.formation.update).not.toHaveBeenCalled();
  });

  it("introuvable → erreur", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(null);
    const res = await archiveFormationAction(ID);
    expect("error" in res).toBe(true);
  });
});

describe("duplicateFormationAction", () => {
  const source = {
    titre: "IA Express",
    slug: "ia-express",
    offreSiteId: "offre-1",
    clientId: null,
    estSurMesure: false,
    dureeHeures: 7,
    modalite: "presentiel",
    objectifsPedagogiques: [{ id: "obj-1" }],
    programmeDetaille: [],
    methodesPedagogiques: "Atelier",
    moyensTechniques: "Salle",
    ressourcesPedagogiques: [],
    seuilReussitePct: 70,
    ratioPratiquePct: 70,
    accessibleHandicap: true,
    typesActionQualiopi: ["classique"],
    langueGeneration: "fr",
  };

  it("clone le contenu, réinitialise le cycle de vie + slug -copie", async () => {
    // 1er findUnique = source ; 2e (allocateCopySlug) = slug libre.
    mockPrisma.formation.findUnique
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(null);

    const res = await duplicateFormationAction(ID);
    expect("data" in res).toBe(true);
    if ("data" in res) {
      expect(res.data.slug).toBe("ia-express-copie");
    }
    const data = mockPrisma.formation.create.mock.calls[0]![0].data;
    expect(data.titre).toBe("IA Express (copie)");
    expect(data.slug).toBe("ia-express-copie");
    expect(data.statutGeneration).toBe("intention");
    expect(data.statut).toBe("actif");
    expect(data.versionProgramme).toBe("1.0");
    expect(data.objectifsPedagogiques).toEqual(source.objectifsPedagogiques);
    // N'hérite pas de la certification / validation / indicateurs.
    expect(data).not.toHaveProperty("certificationType");
    expect(data).not.toHaveProperty("validatedBy");
    expect(data).not.toHaveProperty("indicateursPublies");
  });

  it("incrémente le suffixe si -copie est pris", async () => {
    mockPrisma.formation.findUnique
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce({ id: "x" }) // -copie pris
      .mockResolvedValueOnce(null); // -copie-2 libre

    const res = await duplicateFormationAction(ID);
    expect("data" in res).toBe(true);
    if ("data" in res) expect(res.data.slug).toBe("ia-express-copie-2");
  });

  it("introuvable → erreur", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(null);
    const res = await duplicateFormationAction(ID);
    expect("error" in res).toBe(true);
  });
});
