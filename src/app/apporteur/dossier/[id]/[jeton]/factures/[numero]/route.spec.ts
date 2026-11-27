import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  numeroDePiece: vi.fn(),
  getObjectBufferR2: vi.fn(),
  checkRateLimit: vi.fn(),
}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/features/apporteurs-reseau/espace-commissions", async () => ({
  NUMERO_PIECE: /^AXI-APP-\d{4}-\d{4,}$/,
  NUMERO_PIECE_MAX: 40,
  numeroDePieceDeLApporteur: (...a: unknown[]) => h.numeroDePiece(...a),
}));
vi.mock("@/lib/r2-storage", () => ({
  getObjectBufferR2: (...a: unknown[]) => h.getObjectBufferR2(...a),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => h.checkRateLimit(...a),
}));
vi.mock("@/features/apporteurs-reseau/signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { GET } from "./route";

const A = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const appel = (numero: string, q = "") =>
  GET(new Request(`https://axion-ia.com/x${q}`), {
    params: Promise.resolve({ id: A, jeton: "j".repeat(43), numero }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APPORTEUR_MES_COMMISSIONS_ENABLED = "true";
  h.checkRateLimit.mockResolvedValue({ allowed: true });
  h.lireDossierParLien.mockResolvedValue({ id: A, statut: "signe" });
  h.numeroDePiece.mockImplementation(async (_i: string, n: string) => n);
  h.getObjectBufferR2.mockResolvedValue(Buffer.from("%PDF-facture"));
});

describe("factures/[numero]/route.ts", () => {
  it("sert le PDF de l'apporteur, privé, sans cache, avec la clé reconstruite côté serveur", async () => {
    const r = await appel("AXI-APP-2026-0014", "?dl=1");
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("%PDF-facture");
    expect(h.getObjectBufferR2).toHaveBeenCalledWith(
      `apporteurs/autofactures/${A}/AXI-APP-2026-0014.pdf`,
    );
    expect(h.numeroDePiece).toHaveBeenCalledWith(A, "AXI-APP-2026-0014");
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(r.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("IDOR : numéro d'un autre apporteur → 404, R2 jamais appelé", async () => {
    h.numeroDePiece.mockResolvedValue(null);
    const r = await appel("AXI-APP-2026-0099");
    expect(r.status).toBe(404);
    expect(h.getObjectBufferR2).not.toHaveBeenCalled();
  });

  it("même réponse pour « numéro d'un autre » et « numéro inexistant »", async () => {
    h.numeroDePiece.mockResolvedValue(null);
    const a = await appel("AXI-APP-2026-0099");
    const b = await appel("AXI-APP-2026-0098");
    expect(a.status).toBe(b.status);
    expect(await a.text()).toBe(await b.text());
    expect([...a.headers]).toEqual([...b.headers]);
  });

  it.each(["../x", "axi-app-2026-0001", `AXI-APP-2026-${"1".repeat(40)}`, "%2e%2e%2f"])(
    "numéro mal formé %s : 404 sans requête",
    async (n) => {
      expect((await appel(n)).status).toBe(404);
      expect(h.lireDossierParLien).not.toHaveBeenCalled();
      expect(h.numeroDePiece).not.toHaveBeenCalled();
    },
  );

  it("interrupteur éteint : 404 sans lire le dossier", async () => {
    delete process.env.APPORTEUR_MES_COMMISSIONS_ENABLED;
    expect((await appel("AXI-APP-2026-0014")).status).toBe(404);
    expect(h.lireDossierParLien).not.toHaveBeenCalled();
  });

  it("lien faux, mode restreint, dossier non signé : 404", async () => {
    for (const d of [
      null,
      { id: A, statut: "signe", restreint: true },
      { id: A, statut: "dossier_en_cours" },
    ]) {
      h.lireDossierParLien.mockResolvedValue(d);
      expect((await appel("AXI-APP-2026-0014")).status).toBe(404);
    }
    expect(h.getObjectBufferR2).not.toHaveBeenCalled();
  });

  it("PDF absent ou stockage qui lève : 404 neutre", async () => {
    h.getObjectBufferR2.mockResolvedValue(null);
    expect((await appel("AXI-APP-2026-0014")).status).toBe(404);
    h.getObjectBufferR2.mockRejectedValue(new Error("r2"));
    expect((await appel("AXI-APP-2026-0014")).status).toBe(404);
  });

  it("limite de débit : 429", async () => {
    h.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await appel("AXI-APP-2026-0014")).status).toBe(429);
  });
});
