// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { baseEnMemoire } from "@/features/dossier-client/documents/__tests__/_base-en-memoire";
import { cspSiteAudit } from "@/features/site-audit/config";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const AUTRE = "44444444-4444-4444-8444-444444444444";
const PROJET = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

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

import { GET } from "../route";

const OCTETS = new TextEncoder().encode("<html><script>1</script></html>");

function monter(extra: Record<string, unknown> = {}) {
  const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
  etat.base = s.db;
  const doc = s.poser(
    {
      clientId: CLIENT,
      projetId: PROJET,
      fichierNom: "site.html",
      fichierFormat: "html",
      fichierTailleOctets: OCTETS.length,
      analyseAntivirus: "sain",
      analyseLe: new Date(),
      ...extra,
    },
    OCTETS,
  );
  vi.stubEnv("SITE_AUDIT_DOCUMENTS", `${CLIENT}:${PROJET}:${doc.id}`);
  return { s, doc };
}

function appeler(clientId = CLIENT, headers: Record<string, string> = {}) {
  return GET(new Request("https://axion-ia.com/x", { headers: { host: "axion-ia.com", ...headers } }) as never, {
    params: Promise.resolve({ clientId }),
  });
}

describe("seul le super_admin ouvre le site d'audit", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    etat.verdict = { issue: "sain" };
    etat.session = { user: { id: ADMIN, role: "super_admin" } };
  });

  it("sans session → 401 et aucun appel base", async () => {
    const { s } = monter();
    etat.session = null;
    expect((await appeler()).status).toBe(401);
    expect(s.compteurs.requetes).toBe(0);
  });

  it("rôle admin des échanges → 403", async () => {
    const { s } = monter();
    etat.session = { user: { id: ADMIN, role: "admin" } };
    expect((await appeler()).status).toBe(403);
    expect(s.compteurs.requetes).toBe(0);
  });

  it("super_admin sans variable → 404", async () => {
    monter();
    vi.stubEnv("SITE_AUDIT_DOCUMENTS", "");
    expect((await appeler()).status).toBe(404);
  });

  it("variable d'un autre client → 404", async () => {
    monter();
    expect((await appeler(AUTRE)).status).toBe(404);
  });

  it("document archivé → 404", async () => {
    monter({ archiveLe: new Date(), archiveParId: ADMIN });
    expect((await appeler()).status).toBe(404);
  });

  it("format pdf → 404", async () => {
    monter({ fichierFormat: "pdf" });
    expect((await appeler()).status).toBe(404);
  });

  it("infecté → 409", async () => {
    monter({ analyseAntivirus: "infecte" });
    expect((await appeler()).status).toBe(409);
  });

  it("RSC → 204 sans journal", async () => {
    const { s } = monter();
    const r = await appeler(CLIENT, { RSC: "1" });
    expect(r.status).toBe(204);
    expect(s.etat.evenements).toHaveLength(0);
  });

  it("nominal → 200, octets, CSP exacte, no-store, un journal", async () => {
    const { s, doc } = monter();
    const r = await appeler();
    expect(r.status).toBe(200);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(OCTETS);
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("content-security-policy")).toBe(cspSiteAudit("axion-ia.com", CLIENT));
    expect(r.headers.get("content-security-policy")).toContain(
      `connect-src https://axion-ia.com/api/admin/site-audit/${CLIENT}/;`,
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-length")).toBe(String(OCTETS.length));
    expect(s.etat.evenements).toEqual([
      expect.objectContaining({
        action: "document_telecharge",
        documentId: doc.id,
        parAdminId: ADMIN,
      }),
    ]);
  });

  it("hôte illisible → connect-src 'none'", async () => {
    monter();
    const r = await appeler(CLIENT, { host: "evil.com/x y" });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-security-policy")).toContain("connect-src 'none';");
  });
});
