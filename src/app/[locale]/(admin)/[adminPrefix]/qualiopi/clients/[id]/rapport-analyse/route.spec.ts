/**
 * Route de téléchargement du rapport d'analyse — session simulée, deux clients A et B, VRAI
 * raccord (`brancher.ts`) sur une base Prisma simulée. Données 100 % fictives.
 *
 * 🔑 Le rapport de B demandé sous l'adresse de A rend un 404 IDENTIQUE (statut, corps,
 * en-têtes) à celui d'un identifiant inexistant : rien ne trahit qu'il existe ailleurs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scellerBase, scellerPropositions } from "@/features/rapport-avant-audit/persistance";
import { baseValide, fausseTable } from "@/features/rapport-avant-audit/__tests__/base.fixture";

const faux = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  db: {} as Record<string, unknown>,
}));

vi.mock("@/auth", () => ({ auth: async () => faux.session }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return faux.db;
  },
}));

const { GET } = await import("./route");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const INEXISTANT = "99999999-9999-4999-8999-999999999999";
const WILL = "aaaaaaaa-0000-4000-8000-000000000001";
const ENV0 = { ...process.env };

let table: ReturnType<typeof fausseTable>;
let journal: ReturnType<typeof vi.fn>;

async function rapportDe(clientId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const b = baseValide();
  const base = { ...b, meta: { ...b.meta, clientId } };
  const s = scellerBase(base);
  const { id } = await table.create({
    data: {
      clientId,
      questionnaireIds: [],
      lanceParId: WILL,
      statut: "termine",
      progression: 100,
      baseAudit: s.chiffre,
      baseEmpreinte: s.empreinte,
      propositionsFiche: scellerPropositions(base.propositions_fiche),
      ...extra,
    },
    select: { id: true },
  });
  return id as string;
}

function appel(clientId: string, rapportId: string, format: string) {
  const url = `https://exemple.test/fr/console/qualiopi/clients/${clientId}/rapport-analyse?r=${encodeURIComponent(rapportId)}&f=${format}`;
  return GET(new Request(url), { params: Promise.resolve({ id: clientId }) });
}

async function lu(r: Response) {
  return {
    statut: r.status,
    corps: await r.text(),
    entetes: Object.fromEntries(r.headers.entries()),
  };
}

beforeEach(() => {
  process.env = { ...ENV0, PII_ENCRYPTION_KEY: "d".repeat(64) };
  table = fausseTable();
  journal = vi.fn(async () => ({}));
  faux.db = {
    rapportAvantAudit: table,
    adminUser: { findMany: async () => [] },
    questionnaireAvantAuditEnvoi: { findMany: async () => [] },
    activityLog: { create: journal },
  };
  faux.session = { user: { id: WILL, role: "super_admin" } };
});
afterEach(() => {
  process.env = { ...ENV0 };
});

describe("route rapport-analyse", () => {
  it("401 sans session", async () => {
    faux.session = null;
    const id = await rapportDe(A);
    expect((await appel(A, id, "base-json")).status).toBe(401);
  });

  it("403 hors super-administrateur", async () => {
    faux.session = { user: { id: WILL, role: "admin" } };
    const id = await rapportDe(A);
    expect((await appel(A, id, "base-json")).status).toBe(403);
  });

  it("400 sur un identifiant invalide (client ou rapport)", async () => {
    const id = await rapportDe(A);
    expect((await appel(A, "r1", "base-json")).status).toBe(400);
    expect((await appel(A, "../../etc/passwd", "base-json")).status).toBe(400);
    expect((await appel("pas-un-uuid", id, "base-json")).status).toBe(400);
  });

  it("404 IDENTIQUE : rapport de B sous l'adresse de A = identifiant inexistant", async () => {
    const rB = await rapportDe(B, { pdfValideLe: new Date(), pdfValideParId: WILL });
    for (const f of ["base-json", "base-md", "fiches-md", "pdf-client"]) {
      const croise = await lu(await appel(A, rB, f));
      const absent = await lu(await appel(A, INEXISTANT, f));
      expect(croise.statut, f).toBe(404);
      expect(croise, f).toEqual(absent);
    }
    expect(journal).not.toHaveBeenCalled();
    // témoin : le même rapport, sous l'adresse de B, sort bien
    expect((await appel(B, rB, "base-json")).status).toBe(200);
  });

  it("200 : pièce jointe, private no-store, nosniff, et trace écrite", async () => {
    const id = await rapportDe(A);
    const r = await appel(A, id, "base-md");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; filename="[^"/\\]+\.md"$/);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(journal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "rapport-avant-audit.telechargement",
          targetId: A,
          changes: expect.objectContaining({ rapportId: id, format: "base-md" }),
        }),
      }),
    );
  });

  it("PDF client refusé tant qu'il n'est pas validé", async () => {
    const id = await rapportDe(A);
    const r = await appel(A, id, "pdf-client");
    expect(r.status).toBe(409);
    expect(await r.text()).toMatch(/pas encore été validé/);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(journal).not.toHaveBeenCalled();
  });

  it("sans trace possible, rien n'est rendu (503)", async () => {
    journal.mockRejectedValueOnce(new Error("base indisponible"));
    const id = await rapportDe(A);
    expect((await appel(A, id, "base-json")).status).toBe(503);
  });
});
