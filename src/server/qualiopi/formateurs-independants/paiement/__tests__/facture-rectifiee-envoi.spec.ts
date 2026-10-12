// @vitest-environment node

/**
 * Lot D2 (M10) — F39 « Facture rectifiée » : trois numéros DISTINCTS (facture
 * d'origine, avoir, nouvelle facture), l'avoir numéroté d'abord, les deux PDF
 * joints, une fois par avoir. Un relevé mensuel n'envoie rien.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { remplir } from "@/lib/email/templates/_formateur-independant";
import {
  CROCHET_NON_REMPLI,
  TEXTES_FORMATEUR,
} from "@/lib/email/templates/formateur-independant-textes";

const findUnique = vi.fn();
const findFirst = vi.fn();
const docFind = vi.fn();
const piece = vi.fn();
const envoyer = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
    },
    documentGenere: { findUnique: (...a: unknown[]) => docFind(...a) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({
  documentPdfKey: (d: { numero: string }) => `pdf/${d.numero}`,
}));
vi.mock("@/server/qualiopi/remuneration/autofacture-emission", () => ({
  emettrePieceAvoirMission: (...a: unknown[]) => piece(...a),
}));
vi.mock("../../envois", () => ({ envoyer: (...a: unknown[]) => envoyer(...a) }));

import { envoyerFactureRectifiee } from "../facture-rectifiee-envoi";

const N = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const R = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({
    id: N,
    origine: "passage_mission",
    trainerId: "t",
    numeroFacture: "AXI-AUTOF-2026-0012",
    autofactureDocumentId: "doc-n",
    echeanceAt: new Date("2026-12-16T12:00:00Z"),
    remplaceId: R,
    remplace: { numeroFacture: "AXI-AUTOF-2026-0007" },
    trainer: { email: "f@exemple.test", prenom: "Paule" },
  });
  findFirst.mockResolvedValue({ id: A });
  piece.mockResolvedValue({ numero: "AXI-AUTOF-2026-0009", documentId: "doc-a" });
  docFind.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    type: "autofacture_honoraires",
    numero: where.id,
    createdAt: new Date(),
  }));
  envoyer.mockResolvedValue("envoye");
});

describe("envoyerFactureRectifiee", () => {
  it("trois numéros distincts, avoir et nouvelle facture joints, clé par avoir", async () => {
    expect(await envoyerFactureRectifiee(N)).toBe("envoye");
    const e = envoyer.mock.calls[0]![0];
    expect(e.gabarit).toBe("formateur-facture-rectifiee");
    expect(e.jobId).toBe(`formateur-facture-rectifiee-${A}`);
    expect(e.payload.valeurs).toEqual({
      numéro: "AXI-AUTOF-2026-0007",
      "numéro de l'avoir": "AXI-AUTOF-2026-0009",
      "numéro de la nouvelle facture": "AXI-AUTOF-2026-0012",
      date: "16 décembre 2026",
    });
    expect(e.attachments.map((x: { filename: string }) => x.filename)).toEqual([
      "AXI-AUTOF-2026-0009.pdf",
      "AXI-AUTOF-2026-0012.pdf",
    ]);
    // Le texte rempli n'a plus aucun crochet, et chaque numéro y est à sa place.
    const texte = TEXTES_FORMATEUR["formateur-facture-rectifiee"].variantes[0].paragraphes
      .map((p) => remplir(p, e.payload))
      .join("\n");
    expect(texte).not.toMatch(CROCHET_NON_REMPLI);
    expect(texte).toContain("corrigé la facture n° AXI-AUTOF-2026-0007");
    expect(texte).toContain("l'avoir n° AXI-AUTOF-2026-0009");
    expect(texte).toContain("le n° AXI-AUTOF-2026-0012");
  });

  it("relevé mensuel ou pièce sans remplacement : rien ne part", async () => {
    findUnique.mockResolvedValue({ origine: "releve_mensuel", remplaceId: null });
    expect(await envoyerFactureRectifiee(N)).toBe("ignore");
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("l'avoir ne peut pas être numéroté : rien ne part", async () => {
    piece.mockResolvedValue(null);
    expect(await envoyerFactureRectifiee(N)).toBe("avoir_sans_numero");
    expect(envoyer).not.toHaveBeenCalled();
  });
});
