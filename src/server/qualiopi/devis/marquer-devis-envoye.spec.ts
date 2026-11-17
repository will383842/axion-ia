/**
 * `marquerDevisEnvoye` — l'étape « écritures » de l'envoi d'un devis, extraite de
 * `sendDevisAction` (module NON BRANCHÉ). Même comportement : écriture gardée, statut client,
 * clôture de la version remplacée, événement « devis émis », tout dans le `tx` reçu.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  devisUpdateMany: vi.fn(),
  clientUpdateMany: vi.fn(),
  clore: vi.fn(),
  emettre: vi.fn(),
  ordre: [] as string[],
}));

vi.mock("@/server/qualiopi/devis/version-remplacee", () => ({
  cloreVersionRemplacee: (...a: unknown[]) => h.clore(...a),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: (...a: unknown[]) => h.emettre(...a),
}));

import { marquerDevisEnvoye } from "./marquer-devis-envoye";

const tx = {
  devis: { updateMany: (...a: unknown[]) => h.devisUpdateMany(...a) },
  client: { updateMany: (...a: unknown[]) => h.clientUpdateMany(...a) },
} as never;

const ENTREE = {
  devisId: "d-1",
  clientId: "c-1",
  numero: "AXI-DEV-2026-001",
  updatedAt: new Date("2026-11-01T10:00:00Z"),
  pdfCle: "documents/2026/devis/AXI-DEV-2026-001.pdf",
  documentGenereId: "p-1",
  replacesDevisId: "d-0",
  replacesDevis: { statut: "envoye", documentGenereId: "p-0" },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.ordre.length = 0;
  h.devisUpdateMany.mockImplementation(async () => {
    h.ordre.push("devis");
    return { count: 1 };
  });
  h.clientUpdateMany.mockImplementation(async () => {
    h.ordre.push("client");
    return { count: 1 };
  });
  h.clore.mockImplementation(async () => void h.ordre.push("clore"));
  h.emettre.mockImplementation(async () => void h.ordre.push("emettre"));
});

describe("marquerDevisEnvoye", () => {
  it("écrit « envoye » sous garde brouillon + updatedAt, avec la clé PDF et la pièce", async () => {
    await marquerDevisEnvoye(tx, ENTREE);
    const arg = h.devisUpdateMany.mock.calls[0]?.[0] as {
      where: unknown;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "d-1", statut: "brouillon", updatedAt: ENTREE.updatedAt });
    expect(arg.data).toMatchObject({
      statut: "envoye",
      fichierPdfUrl: ENTREE.pdfCle,
      documentGenereId: "p-1",
    });
    expect(arg.data["sentAt"]).toBeInstanceOf(Date);
  });

  it("lève si l'écriture ne touche pas exactement une ligne, sans rien écrire d'autre", async () => {
    h.devisUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(marquerDevisEnvoye(tx, ENTREE)).rejects.toThrow(/envoye/);
    expect(h.clientUpdateMany).not.toHaveBeenCalled();
    expect(h.clore).not.toHaveBeenCalled();
    expect(h.emettre).not.toHaveBeenCalled();
  });

  it("ne fait passer à « devis_envoye » que prospect|perdu", async () => {
    await marquerDevisEnvoye(tx, ENTREE);
    expect(h.clientUpdateMany).toHaveBeenCalledWith({
      where: { id: "c-1", statut: { in: ["prospect", "perdu"] } },
      data: { statut: "devis_envoye" },
    });
  });

  it("clôt la version remplacée puis émet « devis émis », avec le même tx", async () => {
    await marquerDevisEnvoye(tx, ENTREE);
    expect(h.clore).toHaveBeenCalledWith(tx, {
      replacesDevisId: "d-0",
      documentGenereIdRemplace: "p-0",
      numero: ENTREE.numero,
      statutRemplace: "envoye",
    });
    expect(h.emettre).toHaveBeenCalledWith(tx, "d-1");
    expect(h.ordre).toEqual(["devis", "client", "clore", "emettre"]);
  });

  it("sans version remplacée : appelle quand même la clôture avec des valeurs nulles", async () => {
    await marquerDevisEnvoye(tx, { ...ENTREE, replacesDevisId: null, replacesDevis: null });
    expect(h.clore).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        replacesDevisId: null,
        documentGenereIdRemplace: undefined,
        statutRemplace: undefined,
      }),
    );
  });
});
