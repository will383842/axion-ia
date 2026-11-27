import { beforeEach, describe, expect, it, vi } from "vitest";

// `fiche-commissions/route.ts` et `livret/route.ts` : la fiche des commissions et le livret
// d'accueil, ouverts par le lien personnel AVANT (modifiable, à vérifier) et APRÈS la signature.
// Tout le reste : le même 404 neutre. Changement de règle d'accès : relecture sécurité prévue.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => h.checkRateLimit(...a),
}));

import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import {
  NOM_FICHIER_FICHE_COMMISSIONS,
  NOM_FICHIER_LIVRET,
} from "@/features/apporteurs-reseau/documents-prives";

import { GET as GET_FICHE } from "../fiche-commissions/route";
import { GET as GET_LIVRET } from "../livret/route";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "j".repeat(43);
type Get = typeof GET_FICHE;

const ROUTES: ReadonlyArray<readonly [string, Get, string]> = [
  ["fiche-commissions", GET_FICHE, NOM_FICHIER_FICHE_COMMISSIONS],
  ["livret", GET_LIVRET, NOM_FICHIER_LIVRET],
];

const appel = (get: Get, suffixe = "", id = ID, jeton = JETON) =>
  get(new Request(`https://axion-ia.com/x${suffixe}`), {
    params: Promise.resolve({ id, jeton }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.checkRateLimit.mockResolvedValue({ allowed: true });
  h.lireDossierParLien.mockImplementation(async (id: string, jeton: string) =>
    id === ID && jeton === JETON ? { id: ID, statut: "dossier_en_cours", restreint: false } : null,
  );
});

describe.each(ROUTES)("%s/route.ts", (_nom, get, nomFichier) => {
  it("404 neutre : jeton invalide", async () => {
    const r = await appel(get, "", ID, "x".repeat(43));
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Introuvable");
    expect(r.headers.get("Cache-Control")).toContain("no-store");
    expect(r.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("200 : dossier modifiable, PDF privé sans cache, vérifié avec identifiant ET jeton", async () => {
    const r = await appel(get);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
    expect(
      Buffer.from(await r.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    expect(r.headers.get("Content-Disposition")).toBe(`inline; filename="${nomFichier}"`);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.lireDossierParLien).toHaveBeenCalledWith(ID, JETON);
  });

  it.each(["dossier_en_cours", "a_completer", "a_verifier", "signe"])(
    "200 : dossier %s",
    async (statut) => {
      h.lireDossierParLien.mockResolvedValue({ id: ID, statut, restreint: false });
      expect((await appel(get)).status).toBe(200);
    },
  );

  it("?dl=1 : enregistrement ; ?dl=0 : reste ouvert", async () => {
    expect((await appel(get, "?dl=1")).headers.get("Content-Disposition")).toMatch(/^attachment;/);
    expect((await appel(get, "?dl=0")).headers.get("Content-Disposition")).toMatch(/^inline;/);
  });

  const CAS: ReadonlyArray<readonly [string, unknown, (string | undefined)?]> = [
    ["lien invalide", null],
    ["dossier refusé", { id: ID, statut: "refuse", restreint: false }],
    ["dossier résilié", { id: ID, statut: "resilie", restreint: false }],
    ["fiche retirée du réseau", { id: ID, statut: "signe", restreint: true }],
    ["lien d'exemple", { id: ID, statut: "signe", restreint: false }, ID_DOSSIER_EXEMPLE],
  ];

  it.each(CAS)("404 neutre : %s", async (_c, dossier, id) => {
    h.lireDossierParLien.mockResolvedValue(dossier);
    const r = await appel(get, "", (id as string | undefined) ?? ID);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Introuvable");
    if (id) expect(h.lireDossierParLien).not.toHaveBeenCalled();
  });

  it("trop de demandes : 429 sans PDF", async () => {
    h.checkRateLimit.mockResolvedValue({ allowed: false });
    const r = await appel(get);
    expect(r.status).toBe(429);
    expect(h.lireDossierParLien).not.toHaveBeenCalled();
  });
});
