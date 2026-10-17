/**
 * L14 (NC13 ind. 27) — remplacer une procédure de sous-traitance par la v2.0.
 *
 * Le mécanisme existe, la GÉNÉRATION est éteinte (le texte de la v2.0 n'existe
 * pas). Vit dans son propre fichier : `documents.spec.ts` est un spec partagé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

const PIECES: Record<string, { id: string; numero: string; type: string; annuleeAt: Date | null }> =
  {
    "AXI-DOC-2026-044": {
      id: "00000000-0000-4000-8000-000000000044",
      numero: "AXI-DOC-2026-044",
      type: "procedure_sous_traitance",
      annuleeAt: null,
    },
    "AXI-DOC-2026-029": {
      id: "00000000-0000-4000-8000-000000000029",
      numero: "AXI-DOC-2026-029",
      type: "procedure_sous_traitance",
      annuleeAt: null,
    },
  };

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
    adminUser: { findUnique: async () => ({ name: "Williams Jullin" }) },
    documentSignature: { count: async () => 0 },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

const mockGenerate = vi.fn();
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => mockGenerate(...a),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({ raisonSociale: "Axion-IA SAS" }),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  revoquerTokensDocument: vi.fn().mockResolvedValue(0),
}));

let texteRedige = false;
vi.mock("@/server/qualiopi/documents/procedure-sous-traitance-v2", async (importOriginal) => {
  const orig =
    await importOriginal<
      typeof import("@/server/qualiopi/documents/procedure-sous-traitance-v2")
    >();
  return { ...orig, texteProcedureV2Redige: () => texteRedige };
});

import { remplacerProcedureSousTraitanceAction } from "./documents";

const MOTIF = "Mise à jour de la procédure de sous-traitance : les pièces demandées changent.";

beforeEach(() => {
  vi.clearAllMocks();
  texteRedige = false;
  mockFindUnique.mockImplementation(
    async ({ where }: { where: { numero?: string; id?: string } }) => {
      if (where.numero) return PIECES[where.numero] ?? null;
      return Object.values(PIECES).find((p) => p.id === where.id) ?? null;
    },
  );
  mockUpdate.mockResolvedValue({});
  mockGenerate.mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000050",
    numero: "AXI-DOC-2026-050",
  });
});

describe("remplacerProcedureSousTraitanceAction", () => {
  it("🔴 génération ÉTEINTE : rien n'est créé, remplacé ni annulé", async () => {
    const r = await remplacerProcedureSousTraitanceAction({
      numeroRemplacee: "AXI-DOC-2026-044",
      numeroAAnnuler: "AXI-DOC-2026-029",
      motif: MOTIF,
    });
    expect(r).toMatchObject({ error: expect.stringContaining("n'est pas encore rédigée") });
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  describe("génération allumée (texte rédigé)", () => {
    beforeEach(() => {
      texteRedige = true;
    });

    it("génère la v2.0 AVEC lien explicite vers la pièce remplacée, puis annule l'ancienne, motif à l'appui", async () => {
      const r = await remplacerProcedureSousTraitanceAction({
        numeroRemplacee: "AXI-DOC-2026-044",
        numeroAAnnuler: "AXI-DOC-2026-029",
        motif: MOTIF,
      });
      expect(r).toEqual({
        data: {
          documentId: "00000000-0000-4000-8000-000000000050",
          numero: "AXI-DOC-2026-050",
          remplacee: "AXI-DOC-2026-044",
          annulee: "AXI-DOC-2026-029",
        },
      });

      const gen = mockGenerate.mock.calls[0]![0] as {
        type: string;
        rectifie: { numero: string; motif: string };
      };
      expect(gen.type).toBe("procedure_sous_traitance");
      expect(gen.rectifie).toEqual({ numero: "AXI-DOC-2026-044", motif: MOTIF });

      // L'ancienne est ANNULÉE (jamais supprimée), avec un motif qui nomme la v2.0.
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const upd = mockUpdate.mock.calls[0]![0] as {
        where: { id: string };
        data: { annuleeAt: Date; annuleeMotif: string };
      };
      expect(upd.where.id).toBe(PIECES["AXI-DOC-2026-029"]!.id);
      expect(upd.data.annuleeAt).toBeInstanceOf(Date);
      expect(upd.data.annuleeMotif).toContain("AXI-DOC-2026-050");
      expect(upd.data.annuleeMotif).toContain("v2.0");
    });

    it("sans pièce à annuler, seule la v2.0 est produite", async () => {
      const r = await remplacerProcedureSousTraitanceAction({
        numeroRemplacee: "AXI-DOC-2026-044",
        motif: MOTIF,
      });
      expect(r).toMatchObject({ data: { numero: "AXI-DOC-2026-050", annulee: null } });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("refuse AVANT d'écrire quand une pièce n'est pas une procédure", async () => {
      PIECES["AXI-DOC-2026-029"]!.type = "convention_formation";
      try {
        const r = await remplacerProcedureSousTraitanceAction({
          numeroRemplacee: "AXI-DOC-2026-044",
          numeroAAnnuler: "AXI-DOC-2026-029",
          motif: MOTIF,
        });
        expect(r).toMatchObject({ error: expect.stringContaining("n'est pas une procédure") });
        expect(mockGenerate).not.toHaveBeenCalled();
      } finally {
        PIECES["AXI-DOC-2026-029"]!.type = "procedure_sous_traitance";
      }
    });

    it("motif trop court : refusé, rien n'est lu ni écrit", async () => {
      const r = await remplacerProcedureSousTraitanceAction({
        numeroRemplacee: "AXI-DOC-2026-044",
        motif: "court",
      });
      expect(r).toMatchObject({ error: expect.stringContaining("Motif obligatoire") });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("v2.0 produite mais annulation refusée : le dit explicitement, sans perdre la v2.0", async () => {
      PIECES["AXI-DOC-2026-029"]!.annuleeAt = null;
      mockUpdate.mockRejectedValueOnce(new Error("boom"));
      const r = await remplacerProcedureSousTraitanceAction({
        numeroRemplacee: "AXI-DOC-2026-044",
        numeroAAnnuler: "AXI-DOC-2026-029",
        motif: MOTIF,
      });
      expect(r).toMatchObject({ error: expect.stringContaining("AXI-DOC-2026-050") });
      expect(r).toMatchObject({ error: expect.stringContaining("AXI-DOC-2026-029") });
    });
  });
});
