import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  cle: vi.fn(),
  getObjectBufferR2: vi.fn(),
  checkRateLimit: vi.fn(),
}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/features/apporteurs-reseau/releve-mensuel/espace", async (orig) => ({
  ...(await orig<typeof import("@/features/apporteurs-reseau/releve-mensuel/espace")>()),
  cleDuReleveDeLApporteur: (...a: unknown[]) => h.cle(...a),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
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
const NUMERO = "REL-2026-10-0004";
const CLE = `apporteurs/releves/${A}/${NUMERO}-abcd1234.pdf`;
const appel = (numero: string, q = "") =>
  GET(new Request(`https://axion-ia.com/x${q}`), {
    params: Promise.resolve({ id: A, jeton: "j".repeat(43), numero }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APPORTEUR_MES_COMMISSIONS_ENABLED = "true";
  h.checkRateLimit.mockResolvedValue({ allowed: true });
  h.lireDossierParLien.mockResolvedValue({ id: A, statut: "signe" });
  h.cle.mockImplementation(async (_i: string, n: string) => ({ numero: n, r2Key: CLE }));
  h.getObjectBufferR2.mockResolvedValue(Buffer.from("%PDF-releve"));
});

describe("releves/[numero]/route.ts", () => {
  it("sert le PDF du relevé ENVOYÉ de l'apporteur, privé et sans cache", async () => {
    const r = await appel(NUMERO, "?dl=1");
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("%PDF-releve");
    expect(h.cle).toHaveBeenCalledWith(A, NUMERO);
    expect(h.getObjectBufferR2).toHaveBeenCalledWith(CLE);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("sert aussi un rectificatif (-R1)", async () => {
    expect((await appel("REL-2026-10-0004-R1")).status).toBe(200);
  });

  it("jeton d'un autre apporteur / numéro d'un autre / relevé non envoyé : la MÊME 404, R2 jamais appelé", async () => {
    h.cle.mockResolvedValue(null);
    const a = await appel("REL-2026-10-0099");
    const b = await appel("REL-2026-10-0098");
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(await a.text()).toBe(await b.text());
    expect([...a.headers]).toEqual([...b.headers]);
    expect(h.getObjectBufferR2).not.toHaveBeenCalled();
  });

  it("le dossier d'un autre apporteur est lu avec SON identifiant, jamais celui de l'adresse seule", async () => {
    h.lireDossierParLien.mockResolvedValue({ id: "autre-id", statut: "signe" });
    await appel(NUMERO);
    expect(h.cle).toHaveBeenCalledWith("autre-id", NUMERO);
  });

  it.each([
    "../x",
    "rel-2026-10-0001",
    "REL-2026-13-0001",
    "REL-2026-10-1",
    `REL-2026-10-${"1".repeat(40)}`,
    "%2e%2e%2f",
    "AXI-APP-2026-0001",
  ])("numéro mal formé %s : 404 sans requête", async (n) => {
    expect((await appel(n)).status).toBe(404);
    expect(h.lireDossierParLien).not.toHaveBeenCalled();
    expect(h.cle).not.toHaveBeenCalled();
  });

  it("interrupteur éteint : 404 avant toute lecture", async () => {
    process.env.APPORTEUR_MES_COMMISSIONS_ENABLED = "false";
    expect((await appel(NUMERO)).status).toBe(404);
    expect(h.lireDossierParLien).not.toHaveBeenCalled();
  });

  it("lien faux, dossier non signé ou mode restreint : 404", async () => {
    h.lireDossierParLien.mockResolvedValue(null);
    expect((await appel(NUMERO)).status).toBe(404);
    h.lireDossierParLien.mockResolvedValue({ id: A, statut: "dossier_en_cours" });
    expect((await appel(NUMERO)).status).toBe(404);
    h.lireDossierParLien.mockResolvedValue({ id: A, statut: "signe", restreint: true });
    expect((await appel(NUMERO)).status).toBe(404);
    expect(h.cle).not.toHaveBeenCalled();
  });

  it("limite de débit : 429", async () => {
    h.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await appel(NUMERO)).status).toBe(429);
  });

  it("R2 en panne ou objet absent : 404 neutre", async () => {
    h.getObjectBufferR2.mockRejectedValue(new Error("r2"));
    expect((await appel(NUMERO)).status).toBe(404);
    h.getObjectBufferR2.mockResolvedValue(null);
    expect((await appel(NUMERO)).status).toBe(404);
  });
});
