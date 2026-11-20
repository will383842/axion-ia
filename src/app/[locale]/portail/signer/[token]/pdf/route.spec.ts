/**
 * Route de lecture du PDF de la pièce, gardée par le jeton de signature.
 * L'URL de stockage est signée AU CLIC, jamais au chargement de la page.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ verif: vi.fn(), piece: vi.fn(), signer: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: (...a: unknown[]) => m.verif(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { documentGenere: { findUnique: (...a: unknown[]) => m.piece(...a) } },
}));
vi.mock("@/lib/r2-storage", () => ({
  signedDocumentPdfUrl: (...a: unknown[]) => m.signer(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/parties-requises", () => ({
  circuitPour: (t: string) => (t === "inconnu" ? null : { libelleDefini: "le devis" }),
}));

import { GET } from "./route";

const appeler = (token = "t".repeat(40)) =>
  GET(new Request("http://x/fr/portail/signer/" + token + "/pdf") as never, {
    params: Promise.resolve({ locale: "fr", token }),
  });

const pieceOk = (over: Record<string, unknown> = {}) => ({
  type: "devis",
  numero: "AXI-DOC-2026-001",
  pdfUrl: "documents/x.pdf",
  createdAt: new Date(),
  annuleeAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db:5432/x";
  m.verif.mockResolvedValue({ ok: true, documentGenereId: "doc1", partie: "client" });
  m.piece.mockResolvedValue(pieceOk());
  m.signer.mockResolvedValue("https://stockage.example/signe?sig=abc");
});

describe("GET pdf gardé par le jeton", () => {
  it("jeton valide : 302 vers l'URL signée au moment du clic, en-têtes stricts", async () => {
    const r = await appeler();
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://stockage.example/signe?sig=abc");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(m.signer).toHaveBeenCalledTimes(1);
  });

  it("ne lit que la pièce du jeton", async () => {
    await appeler();
    expect(m.piece.mock.calls[0]![0].where).toEqual({ id: "doc1" });
  });

  it.each(["expire", "revoque", "inconnu", "signature_invalide"])(
    "jeton refusé (%s) : 404 neutre identique, rien n'est signé",
    async (raison) => {
      m.verif.mockResolvedValue({ ok: false, raison });
      const r = await appeler();
      expect(r.status).toBe(404);
      expect(await r.text()).toBe("");
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("referrer-policy")).toBe("no-referrer");
      expect(m.signer).not.toHaveBeenCalled();
      expect(m.piece).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["pièce absente", null],
    ["pièce annulée", pieceOk({ annuleeAt: new Date() })],
    ["sans PDF", pieceOk({ pdfUrl: "" })],
    ["circuit inconnu", pieceOk({ type: "inconnu" })],
  ])("%s : 404 neutre", async (_n, piece) => {
    m.piece.mockResolvedValue(piece);
    const r = await appeler();
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("");
    expect(m.signer).not.toHaveBeenCalled();
  });

  it("stockage indisponible (null ou erreur) : 404 neutre, aucune fuite", async () => {
    m.signer.mockResolvedValueOnce(null);
    expect((await appeler()).status).toBe(404);
    m.signer.mockRejectedValueOnce(new Error("NoSuchKey secret-key"));
    const r = await appeler();
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("");
  });

  it("build SSG (stub.invalid) : 404", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect((await appeler()).status).toBe(404);
  });
});
