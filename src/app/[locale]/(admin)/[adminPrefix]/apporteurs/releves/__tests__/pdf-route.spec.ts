// @vitest-environment node

/** Lot 3e — le PDF STOCKÉ d'un relevé, servi sous garde de rôle ; jamais une clé construite à la main. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  session: null as unknown,
  releve: null as null | { pdfR2Key: string | null; numero: string },
  octets: Buffer.from("%PDF-1.7 test") as Buffer | null,
  cleLue: "",
  where: undefined as unknown,
}));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("@/server/auth/garde-route-console", () => ({ refuserSiHorsConsole: async () => null }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    releveMensuelApporteur: {
      findFirst: async (arg: { where: unknown }) => {
        d.where = arg.where;
        return d.releve;
      },
    },
  },
}));
vi.mock("@/lib/r2-storage", () => ({
  getObjectBufferR2: async (cle: string) => {
    d.cleLue = cle;
    return d.octets;
  },
}));

import { GET } from "../[periode]/pdf/route";

const req = (numero: string) =>
  ({ nextUrl: { searchParams: new URLSearchParams({ numero }) } }) as never;
const ctx = (periode = "2026-10") => ({
  params: Promise.resolve({ locale: "fr", adminPrefix: "gestion", periode }),
});

beforeEach(() => {
  d.session = { user: { id: "u1", role: "admin" } };
  d.releve = {
    pdfR2Key: "apporteurs/releves/a1/REL-2026-10-0001-abcd1234.pdf",
    numero: "REL-2026-10-0001",
  };
  d.octets = Buffer.from("%PDF-1.7 test");
});

describe("GET releves/[periode]/pdf", () => {
  it("401 sans session", async () => {
    d.session = null;
    expect((await GET(req("REL-2026-10-0001"), ctx())).status).toBe(401);
  });
  it("403 sans droit de facturation (consultation)", async () => {
    d.session = { user: { id: "u2", role: "reader" } };
    expect((await GET(req("REL-2026-10-0001"), ctx())).status).toBe(403);
  });
  it("400 sur un numéro ou une période mal formés", async () => {
    expect((await GET(req("../etc"), ctx())).status).toBe(400);
    expect((await GET(req("REL-2026-10-0001"), ctx("2026-99"))).status).toBe(400);
  });
  it("404 quand le relevé n'existe pas ou n'a pas de PDF", async () => {
    d.releve = null;
    expect((await GET(req("REL-2026-10-0001"), ctx())).status).toBe(404);
    d.releve = { pdfR2Key: null, numero: "REL-2026-10-0001" };
    expect((await GET(req("REL-2026-10-0001"), ctx())).status).toBe(404);
  });
  it("200 : sert la clé enregistrée en base, jamais une clé construite", async () => {
    const r = await GET(req("REL-2026-10-0001"), ctx());
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(d.cleLue).toBe("apporteurs/releves/a1/REL-2026-10-0001-abcd1234.pdf");
  });
  it("cherche le couple (numéro, période) : un numéro d'une autre période ne sert pas", async () => {
    await GET(req("REL-2026-10-0001"), ctx("2026-10"));
    expect(d.where).toEqual({ numero: "REL-2026-10-0001", periode: "2026-10" });
  });
});
