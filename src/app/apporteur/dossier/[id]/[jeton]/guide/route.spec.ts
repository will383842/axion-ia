import { beforeEach, describe, expect, it, vi } from "vitest";

// `guide/route.ts` : le guide de démarrage en PDF, ouvert à l'apporteur qui arrive par SON lien personnel.
// Tout le reste : le même 404 neutre.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  checkRateLimit: vi.fn(),
  r2: vi.fn(),
}));

vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => true,
  getObjectBufferR2: (...a: unknown[]) => h.r2(...a),
}));
vi.mock("@/features/apporteurs-reseau/signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => h.checkRateLimit(...a),
}));

import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { NOM_FICHIER_GUIDE } from "@/features/apporteurs-reseau/guide-demarrage";

import { GET } from "./route";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "j".repeat(43);
const ctx = (id = ID) => ({ params: Promise.resolve({ id, jeton: JETON }) });
const appel = (suffixe = "", id = ID) =>
  GET(new Request(`https://axion-ia.com/x${suffixe}`), ctx(id));
const PDF = Buffer.from("%PDF-1.7 guide de test");
const TAILLE = PDF.byteLength;

beforeEach(() => {
  vi.clearAllMocks();
  h.r2.mockResolvedValue(PDF);
  h.checkRateLimit.mockResolvedValue({ allowed: true });
  h.lireDossierParLien.mockImplementation(async (id: string, jeton: string) =>
    id === ID && jeton === JETON ? { id: ID, statut: "signe", restreint: false } : null,
  );
});

describe("guide/route.ts : apporteur signé ou en cours", () => {
  it("le guide en PDF, ouvert dans le navigateur, privé et sans cache", async () => {
    const r = await appel();
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
    const corps = Buffer.from(await r.arrayBuffer());
    expect(corps.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.headers.get("Content-Length")).toBe(String(TAILLE));
    expect(r.headers.get("Content-Disposition")).toBe(`inline; filename="${NOM_FICHIER_GUIDE}"`);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("?dl=1 : enregistrement ; ?dl=0 : reste ouvert", async () => {
    expect((await appel("?dl=1")).headers.get("Content-Disposition")).toMatch(/^attachment;/);
    expect((await appel("?dl=0")).headers.get("Content-Disposition")).toMatch(/^inline;/);
  });

  it.each(["dossier_en_cours", "a_completer", "a_verifier"])(
    "dossier %s : le guide est ouvert aussi",
    async (statut) => {
      h.lireDossierParLien.mockResolvedValue({ id: ID, statut, restreint: false });
      expect((await appel()).status).toBe(200);
    },
  );

  it("le lien est vérifié avec l'identifiant ET le jeton", async () => {
    await appel();
    expect(h.lireDossierParLien).toHaveBeenCalledTimes(1);
    expect(h.lireDossierParLien).toHaveBeenCalledWith(ID, JETON);
  });
});

describe("guide/route.ts : 404 neutre, toujours le même", () => {
  const CAS: ReadonlyArray<readonly [string, unknown, (string | undefined)?]> = [
    ["lien invalide", null],
    ["dossier refusé", { id: ID, statut: "refuse", restreint: false }],
    ["dossier résilié", { id: ID, statut: "resilie", restreint: false }],
    ["fiche retirée du réseau", { id: ID, statut: "signe", restreint: true }],
    ["lien d'exemple", { id: ID, statut: "signe", restreint: false }, ID_DOSSIER_EXEMPLE],
  ];

  it.each(CAS)("%s", async (_c, dossier, id) => {
    h.lireDossierParLien.mockResolvedValue(dossier);
    const r = await appel("", (id as string | undefined) ?? ID);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Introuvable");
    expect(r.headers.get("Cache-Control")).toContain("no-store");
    expect(r.headers.get("X-Robots-Tag")).toContain("noindex");
    if (id) expect(h.lireDossierParLien).not.toHaveBeenCalled();
  });

  it("le lien d'un autre apporteur (jeton qui ne correspond pas) : 404", async () => {
    const autre = "7a1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
    const r = await appel("", autre);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Introuvable");
  });

  it("🔴 guide absent de R2 : 404 neutre (jamais de 500)", async () => {
    h.r2.mockResolvedValue(null);
    const r = await appel();
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Introuvable");
  });

  it("trop de demandes : 429 sans PDF", async () => {
    h.checkRateLimit.mockResolvedValue({ allowed: false });
    const r = await appel();
    expect(r.status).toBe(429);
    expect(h.lireDossierParLien).not.toHaveBeenCalled();
    expect(await r.text()).not.toContain("%PDF");
  });
});
