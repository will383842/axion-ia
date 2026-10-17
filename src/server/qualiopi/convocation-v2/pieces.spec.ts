/**
 * Chantier QNC, L05 — les pièces de la convocation : produites si elles
 * manquent, réutilisées sinon, rectifiées (jamais supprimées) quand leur texte
 * passe en v2, datées « envoyées » par le serveur.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const findUnique = vi.fn();
const updateMany = vi.fn(async (_a: unknown) => ({ count: 1 }));
const produire = {
  produireConvocation: vi.fn(),
  produireProgramme: vi.fn(),
  produireReglementInterieur: vi.fn(),
  produireLivretAccueil: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findMany: (a: unknown) => findMany(a),
      findUnique: (a: unknown) => findUnique(a),
      updateMany: (a: unknown) => updateMany(a),
    },
  },
}));
vi.mock("@/server/qualiopi/documents/production/producteurs", () => produire);

import {
  MARQUE_TEXTE_V2,
  MOTIF_RECTIFICATION_V2,
  assurerPiecesConvocation,
  estTexteV2,
  marquerPiecesEnvoyees,
  nomFichierPiece,
} from "./pieces";

const CREE = new Date("2026-11-03T09:00:00Z");
const IN = { enrollmentId: "e1", sessionId: "s1", traineeId: "t1" };

function doc(type: string, numero: string, over: Record<string, unknown> = {}) {
  return {
    id: `id-${numero}`,
    type,
    numero,
    createdAt: CREE,
    pdfUrl: "https://r2/signed",
    metadata: {},
    ...over,
  };
}

/** Le registre : ce que `findMany` rend pour chaque type demandé. */
function registre(parType: Record<string, unknown[]>) {
  findMany.mockImplementation(
    async (a: { where: { type: string } }) => parType[a.where.type] ?? [],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const p of Object.values(produire)) {
    p.mockImplementation(async () => ({ ok: true, documentId: "neuf", numero: "AXI-DOC-NEUF" }));
  }
});

describe("estTexteV2", () => {
  it("lit la marque posée à la production", () => {
    expect(estTexteV2({ [MARQUE_TEXTE_V2]: true })).toBe(true);
    for (const v of [null, {}, { convocationV2: "oui" }, [], "x"])
      expect(estTexteV2(v)).toBe(false);
  });
});

describe("assurerPiecesConvocation", () => {
  it("rien n'existe : les quatre pièces sont PRODUITES, les textes v2 marqués", async () => {
    registre({});
    findUnique.mockResolvedValue(doc("convocation", "AXI-DOC-NEUF"));

    const r = await assurerPiecesConvocation(IN);

    expect(r.ok).toBe(true);
    expect(produire.produireConvocation).toHaveBeenCalledWith("e1", {
      versionTexte: 2,
      metadata: { convocationV2: true },
    });
    expect(produire.produireLivretAccueil).toHaveBeenCalledWith("s1", {
      versionTexte: 2,
      metadata: { convocationV2: true },
    });
    // Programme et règlement : texte inchangé, aucune option v2.
    expect(produire.produireProgramme).toHaveBeenCalledWith("s1", {});
    expect(produire.produireReglementInterieur).toHaveBeenCalledWith("s1", {});
  });

  it("pièces vivantes déjà là : réutilisées, jamais doublées", async () => {
    registre({
      convocation: [doc("convocation", "AXI-DOC-1", { metadata: { convocationV2: true } })],
      programme: [doc("programme", "AXI-DOC-2")],
      reglement_interieur: [doc("reglement_interieur", "AXI-DOC-3")],
      livret_accueil: [doc("livret_accueil", "AXI-DOC-4", { metadata: { convocationV2: true } })],
    });

    const r = await assurerPiecesConvocation(IN);

    expect(r.ok).toBe(true);
    for (const p of Object.values(produire)) expect(p).not.toHaveBeenCalled();
    if (r.ok) {
      expect(r.pieces.map((p) => p.numero)).toEqual([
        "AXI-DOC-1",
        "AXI-DOC-2",
        "AXI-DOC-3",
        "AXI-DOC-4",
      ]);
      expect(r.pieces[0]!.r2Key).toBe("documents/2026/convocation/AXI-DOC-1.pdf");
      expect(r.pieces[0]!.nomFichier).toBe("AXI-DOC-1 - Convocation.pdf");
    }
  });

  it("une convocation v1 déjà produite est RECTIFIÉE (annulée, jamais supprimée), pas doublée en copie", async () => {
    registre({
      convocation: [doc("convocation", "AXI-DOC-1")],
      programme: [doc("programme", "AXI-DOC-2")],
      reglement_interieur: [doc("reglement_interieur", "AXI-DOC-3")],
      livret_accueil: [doc("livret_accueil", "AXI-DOC-4", { metadata: { convocationV2: true } })],
    });
    findUnique.mockResolvedValue(doc("convocation", "AXI-DOC-NEUF"));

    await assurerPiecesConvocation(IN);

    expect(produire.produireConvocation).toHaveBeenCalledWith("e1", {
      versionTexte: 2,
      metadata: { convocationV2: true },
      rectificationMotif: MOTIF_RECTIFICATION_V2,
    });
    expect(produire.produireLivretAccueil).not.toHaveBeenCalled();
  });

  it("la convocation est cherchée PAR stagiaire, les autres par session ; ni annulée ni copie", async () => {
    registre({});
    findUnique.mockResolvedValue(doc("x", "AXI-DOC-NEUF"));
    await assurerPiecesConvocation(IN);
    const wheres = findMany.mock.calls.map(
      (c) => (c[0] as { where: Record<string, unknown> }).where,
    );
    const conv = wheres.find((w) => w["type"] === "convocation")!;
    expect(conv).toMatchObject({
      sessionId: "s1",
      traineeId: "t1",
      annuleeAt: null,
      estCopie: false,
    });
    const prog = wheres.find((w) => w["type"] === "programme")!;
    expect(prog).not.toHaveProperty("traineeId");
  });

  it("une production qui échoue : pas de liste partielle, le motif est dit", async () => {
    registre({});
    produire.produireProgramme.mockResolvedValue({ ok: false, motif: "Session introuvable" });
    findUnique.mockResolvedValue(doc("convocation", "AXI-DOC-NEUF"));
    const r = await assurerPiecesConvocation(IN);
    expect(r).toEqual({
      ok: false,
      motif: "Programme de formation non produite : Session introuvable",
    });
  });

  it("une pièce sans PDF stocké ne peut pas être jointe : refus", async () => {
    registre({
      convocation: [
        doc("convocation", "AXI-DOC-1", { pdfUrl: null, metadata: { convocationV2: true } }),
      ],
    });
    const r = await assurerPiecesConvocation(IN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motif).toMatch(/PDF non stocké/);
  });
});

describe("marquerPiecesEnvoyees", () => {
  it("pose envoye_at (date du serveur) sur les pièces jointes, sans écraser une date déjà posée", async () => {
    const instant = new Date("2026-11-05T07:00:00Z");
    await marquerPiecesEnvoyees(["a", "b"], instant);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] }, envoyeAt: null },
      data: { envoyeAt: instant },
    });
  });

  it("aucune pièce : aucune écriture", async () => {
    await marquerPiecesEnvoyees([], new Date());
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("nomFichierPiece", () => {
  it("numéro d'abord, libellé lisible", () => {
    expect(nomFichierPiece("reglement_interieur", "AXI-DOC-2026-012")).toBe(
      "AXI-DOC-2026-012 - Reglement interieur.pdf",
    );
  });
});
