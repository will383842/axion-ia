import { beforeEach, describe, expect, it, vi } from "vitest";

// `contrat/route.ts` : avant signature, le contrat rempli ; une fois signé des deux
// parties, le PDF signé (D4) ; dans tous les autres cas, 404 neutre.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  lireContratPdf: vi.fn(),
  rendreContratPdf: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/features/apporteurs-reseau/verification", () => ({
  lireContratPdf: (...a: unknown[]) => h.lireContratPdf(...a),
}));
vi.mock("@/features/apporteurs-reseau/contrat-pdf", () => ({
  rendreContratPdf: (...a: unknown[]) => h.rendreContratPdf(...a),
  texteDuContrat: () => "texte",
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => h.checkRateLimit(...a),
}));

import { GET } from "./route";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ctx = { params: Promise.resolve({ id: ID, jeton: "j".repeat(43) }) };
const appel = (suffixe = "") => GET(new Request(`https://axion-ia.com/x${suffixe}`), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  h.checkRateLimit.mockResolvedValue({ allowed: true });
  h.rendreContratPdf.mockResolvedValue(Buffer.from("%PDF-rempli"));
  h.lireContratPdf.mockResolvedValue(Buffer.from("%PDF-signe"));
});

describe("contrat/route.ts", () => {
  it("dossier signé avec contrat des deux parties : le PDF signé est servi (privé, sans cache)", async () => {
    h.lireDossierParLien.mockResolvedValue({ id: ID, statut: "signe", aContratSigne: true });
    const r = await appel("?dl=1");
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("%PDF-signe");
    expect(h.lireContratPdf).toHaveBeenCalledWith(ID, "signe");
    expect(h.rendreContratPdf).not.toHaveBeenCalled();
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Content-Disposition")).toContain("attachment");
    expect(r.headers.get("Content-Disposition")).toContain("signe");
  });

  it("dossier signé mais pièce introuvable : 404 neutre", async () => {
    h.lireDossierParLien.mockResolvedValue({ id: ID, statut: "signe", aContratSigne: true });
    h.lireContratPdf.mockResolvedValue(null);
    expect((await appel()).status).toBe(404);
  });

  it("dossier signé sans contrat contresigné enregistré : 404, R2 non interrogé", async () => {
    h.lireDossierParLien.mockResolvedValue({ id: ID, statut: "signe", aContratSigne: false });
    expect((await appel()).status).toBe(404);
    expect(h.lireContratPdf).not.toHaveBeenCalled();
  });

  it("dossier modifiable : le contrat rempli, comme avant", async () => {
    h.lireDossierParLien.mockResolvedValue({
      id: ID,
      statut: "dossier_en_cours",
      prenom: "Claire",
      nom: "Durand",
      statutJuridique: null,
      siren: null,
      adresse: null,
    });
    const r = await appel();
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("%PDF-rempli");
    expect(h.lireContratPdf).not.toHaveBeenCalled();
  });

  it("lien faux, dossier à vérifier ou refusé : 404 neutre, rien n'est rendu", async () => {
    for (const d of [null, { id: ID, statut: "a_verifier" }, { id: ID, statut: "refuse" }]) {
      h.lireDossierParLien.mockResolvedValue(d);
      expect((await appel()).status).toBe(404);
    }
    expect(h.rendreContratPdf).not.toHaveBeenCalled();
    expect(h.lireContratPdf).not.toHaveBeenCalled();
  });
});
