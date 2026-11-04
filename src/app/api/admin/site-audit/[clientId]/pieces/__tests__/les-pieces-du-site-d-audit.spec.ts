// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { baseEnMemoire } from "@/features/dossier-client/documents/__tests__/_base-en-memoire";
import { TITRE_PIECE } from "@/features/site-audit/notes";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const DOC = "55555555-5555-4555-8555-555555555555";

const etat = vi.hoisted(() => ({
  session: null as unknown,
  base: null as unknown,
  verdict: { issue: "sain" } as unknown,
}));

vi.mock("@/auth", () => ({ auth: async () => etat.session }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return etat.base;
  },
}));
vi.mock("@/server/careers/clamav", () => ({
  analyserOctets: async () => etat.verdict,
}));

import { GET as LIRE } from "../[documentId]/route";
import { POST } from "../route";

const BONS = {
  host: "axion-ia.com",
  "sec-fetch-site": "same-origin",
  origin: "https://axion-ia.com",
  "x-site-audit": "1",
  "x-nom": encodeURIComponent("Photo n°1.png"),
};
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function monter() {
  const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
  etat.base = s.db;
  vi.stubEnv("SITE_AUDIT_DOCUMENTS", `${CLIENT}:${PROJET}:${DOC}`);
  return s;
}

function poster(type: string, corps: Uint8Array | string) {
  return POST(
    new Request("https://axion-ia.com/x", {
      method: "POST",
      headers: { ...BONS, "content-type": type },
      body: corps as never,
    }) as never,
    { params: Promise.resolve({ clientId: CLIENT }) },
  );
}

function lire(documentId: string) {
  return LIRE(
    new Request("https://axion-ia.com/x", { headers: { host: "axion-ia.com" } }) as never,
    { params: Promise.resolve({ clientId: CLIENT, documentId }) },
  );
}

describe("les pièces du site d'audit", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    etat.verdict = { issue: "sain" };
    etat.session = { user: { id: ADMIN, role: "super_admin" } };
  });

  it("jpeg accepté → 200 {id}", async () => {
    const s = monter();
    const r = await poster("image/jpeg", JPEG);
    expect(r.status).toBe(200);
    const d = s.etat.documents[0]!;
    expect(d.titre).toBe(TITRE_PIECE);
    expect(d.cote).toBe("interne");
    expect(d.fichierFormat).toBe("jpg");
    expect(d.fichierNom).toBe("Photo n_1.jpg");
  });

  it("text/html → 415", async () => {
    monter();
    expect((await poster("text/html", "<html></html>")).status).toBe(415);
  });

  it("signature fausse → 400", async () => {
    monter();
    expect((await poster("image/jpeg", new Uint8Array([1, 2, 3, 4]))).status).toBe(400);
  });

  it("plus de 15 Mo → 413", async () => {
    monter();
    const gros = new Uint8Array(15 * 1024 * 1024 + 1);
    gros.set([0xff, 0xd8, 0xff]);
    expect((await poster("image/jpeg", gros)).status).toBe(413);
  });

  it("GET d'un document html du même projet → 404", async () => {
    const s = monter();
    const d = s.poser(
      {
        clientId: CLIENT,
        projetId: PROJET,
        titre: TITRE_PIECE,
        fichierNom: "x.html",
        fichierFormat: "html",
        analyseAntivirus: "sain",
      },
      new TextEncoder().encode("<html></html>"),
    );
    expect((await lire(d.id)).status).toBe(404);
  });

  it("GET d'un document archivé → 404", async () => {
    const s = monter();
    const d = s.poser(
      {
        clientId: CLIENT,
        projetId: PROJET,
        titre: TITRE_PIECE,
        fichierNom: "x.jpg",
        fichierFormat: "jpg",
        analyseAntivirus: "sain",
        archiveLe: new Date(),
        archiveParId: ADMIN,
      },
      JPEG,
    );
    expect((await lire(d.id)).status).toBe(404);
  });

  it("GET nominal → octet-stream avec sandbox", async () => {
    const s = monter();
    const d = s.poser(
      {
        clientId: CLIENT,
        projetId: PROJET,
        titre: TITRE_PIECE,
        fichierNom: "x.jpg",
        fichierFormat: "jpg",
        analyseAntivirus: "sain",
      },
      JPEG,
    );
    const r = await lire(d.id);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/octet-stream");
    expect(r.headers.get("content-security-policy")).toContain("sandbox");
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(JPEG);
  });
});
