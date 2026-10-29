// @vitest-environment node
/**
 * La copie complète des réponses : rôle, interrupteur, appartenance à la fiche, trace d'abord,
 * code du dirigeant masqué, réponse écartée sans contenu, empreinte stable.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const CODE_DIR = "DIRIGEANTSECRET0000AAAA";
const SECRET = "TEXTE-SECRET-XYZ";
const QID = "00000000-0000-4000-8000-000000000001";
const FICHE = "11111111-1111-4111-8111-111111111111";

const etat = vi.hoisted(() => ({
  role: "super_admin" as string | null,
  user: true,
  appartient: true,
  traceEchoue: false,
  traces: [] as unknown[],
}));

vi.mock("@/auth", () => ({
  auth: async () => (etat.user ? { user: { id: "u1", role: etat.role } } : null),
}));
vi.mock("@/server/visio/questionnaire-en-ligne/jeton", () => ({
  codeDirigeantPreauditValide: (_id: string, m: unknown) => m === CODE_DIR,
}));
vi.mock("../de-la-fiche", () => ({
  fichesCouvertes: async () => [FICHE],
  questionnairesDesFiches: (ids: string[]) => ({ clientId: { in: ids } }),
}));

import { chiffrerParole } from "@/lib/chiffrer-parole";

process.env["PII_ENCRYPTION_KEY"] = "d".repeat(64);

const donnees = {
  envois: [
    {
      id: "e1",
      mode: "emp",
      membre: CODE_DIR,
      recuLe: new Date("2026-10-26T10:00:00Z"),
      ecarteLe: null,
      donnees: chiffrerParole(
        JSON.stringify({ mode: "emp", membre: CODE_DIR, donnees: { b_1: SECRET } }),
      ),
    },
    {
      id: "e2",
      mode: "emp",
      membre: "aaaaaaaaaaa1",
      recuLe: new Date("2026-10-26T11:00:00Z"),
      ecarteLe: new Date("2026-10-27T08:00:00Z"),
      donnees: chiffrerParole(JSON.stringify({ donnees: { b_1: "ECARTE-SECRET" } })),
    },
  ],
  brouillons: [
    {
      id: "b1",
      mode: "main",
      membre: "",
      majLe: new Date("2026-10-27T09:00:00Z"),
      horodatage: new Date("2026-10-27T08:59:00Z"),
      donnees: chiffrerParole(JSON.stringify({ data: { m: CODE_DIR, a_nom: "x" } })),
    },
  ],
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaireAvantAudit: {
      findFirst: async () => (etat.appartient ? { id: QID } : null),
      findUnique: async () => ({
        id: QID,
        ref: "refabc",
        envoyeLe: new Date("2026-10-25T09:00:00Z"),
        expireLe: null,
        closLe: null,
      }),
    },
    questionnaireAvantAuditEnvoi: { findMany: async () => donnees.envois },
    questionnaireAvantAuditBrouillon: { findMany: async () => donnees.brouillons },
    activityLog: {
      create: async (a: unknown) => {
        if (etat.traceEchoue) throw new Error("journal indisponible");
        etat.traces.push(a);
      },
    },
  },
}));

import { GET } from "../../../app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/questionnaire/export/route";

const appeler = (q: string = QID) =>
  GET(new Request(`http://x/export?q=${q}`), { params: Promise.resolve({ id: FICHE }) });

beforeEach(() => {
  etat.role = "super_admin";
  etat.user = true;
  etat.appartient = true;
  etat.traceEchoue = false;
  etat.traces = [];
  process.env["QUESTIONNAIRE_EXPORT_COMPLET_ENABLED"] = "true";
});

describe("route d'export complet", () => {
  it("sans session : 401", async () => {
    etat.user = false;
    expect((await appeler()).status).toBe(401);
  });
  it("rôle administrateur : 403", async () => {
    etat.role = "admin";
    expect((await appeler()).status).toBe(403);
  });
  it("interrupteur absent : 404", async () => {
    delete process.env["QUESTIONNAIRE_EXPORT_COMPLET_ENABLED"];
    expect((await appeler()).status).toBe(404);
  });
  it("interrupteur à une autre valeur que true : 404", async () => {
    process.env["QUESTIONNAIRE_EXPORT_COMPLET_ENABLED"] = "1";
    expect((await appeler()).status).toBe(404);
  });
  it("identifiant mal formé : 400", async () => {
    expect((await appeler("pas-un-uuid")).status).toBe(400);
  });
  it("questionnaire d'une autre fiche : 404", async () => {
    etat.appartient = false;
    expect((await appeler()).status).toBe(404);
  });
  it("trace en échec : 503 et aucun corps", async () => {
    etat.traceEchoue = true;
    const r = await appeler();
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain(SECRET);
  });
  it("copie : trace écrite d'abord, code du dirigeant absent, écartée sans contenu", async () => {
    const r = await appeler();
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toContain("no-store");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(r.headers.get("Content-Disposition")).toContain("attachment");
    const corps = await r.text();
    expect(corps).not.toContain(CODE_DIR);
    expect(corps).toContain("(code du dirigeant, masqué)");
    expect(corps).toContain(SECRET);
    expect(corps).not.toContain("ECARTE-SECRET");
    const copie = JSON.parse(corps);
    expect(copie.reponses[1].charge).toBeNull();
    expect(copie.comptes).toEqual({ reponses: 2, ecartees: 1, illisibles: 0, brouillons: 1 });
    expect(etat.traces).toHaveLength(1);
    const trace = JSON.stringify(etat.traces[0]);
    expect(trace).toContain("questionnaire-preaudit.export-complet");
    expect(trace).not.toContain(SECRET);
  });
  it("même empreinte pour deux appels identiques", async () => {
    const a = JSON.parse(await (await appeler()).text());
    const b = JSON.parse(await (await appeler()).text());
    expect(a.empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(a.empreinte).toBe(b.empreinte);
  });
});
