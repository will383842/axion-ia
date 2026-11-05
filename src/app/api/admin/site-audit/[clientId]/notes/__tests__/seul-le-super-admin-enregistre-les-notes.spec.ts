// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { baseEnMemoire } from "@/features/dossier-client/documents/__tests__/_base-en-memoire";
import { TITRE_NOTES } from "@/features/site-audit/notes";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const AUTRE = "44444444-4444-4444-8444-444444444444";
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

import { GET, POST } from "../route";

const BONS = {
  host: "axion-ia.com",
  "sec-fetch-site": "same-origin",
  origin: "https://axion-ia.com",
  "x-site-audit": "1",
};
const CORPS = JSON.stringify({
  base: null,
  notes: { "audit-oury-q3-abc-1": { t: "x", d: "2026-11-04T10:00:00.000Z" } },
});

function monter() {
  const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
  etat.base = s.db;
  vi.stubEnv("SITE_AUDIT_DOCUMENTS", `${CLIENT}:${PROJET}:${DOC}`);
  return s;
}

function poster(headers: Record<string, string> = BONS, corps: string = CORPS, id = CLIENT) {
  return POST(
    new Request("https://axion-ia.com/x", { method: "POST", headers, body: corps }) as never,
    {
      params: Promise.resolve({ clientId: id }),
    },
  );
}

function lire(id = CLIENT) {
  return GET(
    new Request("https://axion-ia.com/x", { headers: { host: "axion-ia.com" } }) as never,
    {
      params: Promise.resolve({ clientId: id }),
    },
  );
}

describe("seul le super_admin enregistre les notes", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    etat.verdict = { issue: "sain" };
    etat.session = { user: { id: ADMIN, role: "super_admin" } };
  });

  it("sans session → 401 sans appel à la base", async () => {
    const s = monter();
    etat.session = null;
    expect((await poster()).status).toBe(401);
    expect(s.compteurs.requetes).toBe(0);
  });

  it("rôle admin → 403", async () => {
    const s = monter();
    etat.session = { user: { id: ADMIN, role: "admin" } };
    expect((await poster()).status).toBe(403);
    expect(s.compteurs.requetes).toBe(0);
  });

  it("sans sec-fetch-site → 403", async () => {
    monter();
    const { "sec-fetch-site": _x, ...h } = BONS;
    expect((await poster(h)).status).toBe(403);
  });

  it("origin étranger → 403", async () => {
    monter();
    expect((await poster({ ...BONS, origin: "https://evil.example" })).status).toBe(403);
  });

  it("origin null avec same-origin → accepté", async () => {
    monter();
    expect((await poster({ ...BONS, origin: "null" })).status).toBe(200);
  });

  it("sans x-site-audit → 403", async () => {
    monter();
    const { "x-site-audit": _x, ...h } = BONS;
    expect((await poster(h)).status).toBe(403);
  });

  it("client hors variable → 404", async () => {
    monter();
    expect((await poster(BONS, CORPS, AUTRE)).status).toBe(404);
  });

  it("plus de 2 Mo → 413", async () => {
    monter();
    expect((await poster(BONS, "x".repeat(2 * 1024 * 1024 + 1))).status).toBe(413);
  });

  it("JSON cassé → 400", async () => {
    monter();
    expect((await poster(BONS, "{pas du json")).status).toBe(400);
  });

  it("0 clé → 400", async () => {
    monter();
    expect((await poster(BONS, JSON.stringify({ base: null, notes: {} }))).status).toBe(400);
  });

  it("nominal → 200 {version}, puis GET renvoie la version et journalise", async () => {
    const s = monter();
    const r = await poster();
    expect(r.status).toBe(200);
    const { version } = (await r.json()) as { version: string };
    const g = await lire();
    expect(g.status).toBe(200);
    expect(g.headers.get("cache-control")).toBe("private, no-store");
    const corps = (await g.json()) as { version: string; notes: Record<string, unknown> };
    expect(corps.version).toBe(version);
    expect(Object.keys(corps.notes)).toEqual(["audit-oury-q3-abc-1"]);
    expect(s.etat.evenements.map((e) => e.action)).toContain("document_telecharge");
  });

  it("base périmée → 409 avec la version", async () => {
    monter();
    const { version } = (await (await poster()).json()) as { version: string };
    const r = await poster(BONS, CORPS);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { version: string }).version).toBe(version);
  });

  it("antivirus indisponible → 503", async () => {
    monter();
    etat.verdict = { issue: "indisponible" };
    expect((await poster()).status).toBe(503);
  });

  it("corps ≤ 2 Mo mais contenu réécrit > 2 Mo → 413 (pas 400)", async () => {
    monter();
    const fab = (n: number) =>
      JSON.stringify({ notes: { "audit-oury-q3-abc-1": { t: "x".repeat(n), d: "d" } } });
    const MAX = 2 * 1024 * 1024;
    const corps = fab(MAX - fab(0).length);
    expect(corps.length).toBe(MAX);
    expect((await poster(BONS, corps)).status).toBe(413);
  });

  it("moins de notes que la version précédente → 409 raison « moins »", async () => {
    monter();
    const deux = JSON.stringify({
      base: null,
      notes: { "audit-oury-q3-abc-1": { t: "x" }, "audit-oury-q3-abc-2": { t: "y" } },
    });
    const { version } = (await (await poster(BONS, deux)).json()) as { version: string };
    const un = JSON.stringify({ base: version, notes: { "audit-oury-q3-abc-1": { t: "x" } } });
    const r = await poster(BONS, un);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ version, raison: "moins" });
  });

  it("archivage de l'ancienne version en échec → la réponse reste ok", async () => {
    const s = monter();
    const { version } = (await (await poster()).json()) as { version: string };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = s.db as unknown as Record<string, Record<string, unknown>>;
    for (const k of ["update", "updateMany"]) {
      if (db.documentProjet && k in db.documentProjet) {
        db.documentProjet[k] = async () => {
          throw new Error("panne");
        };
      }
    }
    const suite = JSON.stringify({
      base: version,
      notes: { "audit-oury-q3-abc-1": { t: "x" }, "audit-oury-q3-abc-2": { t: "y" } },
    });
    const r = await poster(BONS, suite);
    err.mockRestore();
    expect(r.status).toBe(200);
  });

  it("clientId en majuscules → accepté, enregistré en minuscules", async () => {
    const s = monter();
    const r = await poster(BONS, CORPS, CLIENT.toUpperCase());
    expect(r.status).toBe(200);
    expect(s.etat.documents[0]!.clientId).toBe(CLIENT);
    expect((await lire(CLIENT.toUpperCase())).status).toBe(200);
  });

  it("GET sans version → 204", async () => {
    monter();
    expect((await lire()).status).toBe(204);
  });

  it("GET : titre des notes jamais lu hors liste blanche", async () => {
    monter();
    expect((await lire(AUTRE)).status).toBe(404);
    expect(TITRE_NOTES).toContain("Site d'audit");
  });
});
