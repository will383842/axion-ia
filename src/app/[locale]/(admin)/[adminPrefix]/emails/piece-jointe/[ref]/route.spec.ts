import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  piece: { filename: "Contrat.pdf", r2Key: "contrats/x.pdf", contentType: "application/pdf" } as {
    filename: string;
    r2Key: string;
    contentType: string;
  } | null,
  resolu: null as unknown,
}));

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1", role: "ADMIN" } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { create: vi.fn() } } }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("@/server/auth/garde-route-console", () => ({ refuserSiHorsConsole: async () => null }));
vi.mock("@/server/auth/habilitations", () => ({ peutConsulter: () => true }));
vi.mock("@/server/email/pieces-jointes-apercu", () => ({ pieceDeLaReference: () => h.piece }));
vi.mock("@/server/email/pieces-jointes", () => ({
  resoudrePiecesJointes: async () => {
    if (h.resolu instanceof Error) throw h.resolu;
    return h.resolu;
  },
}));

import { GET } from "./route";

const appeler = (): Promise<Response> =>
  GET(new Request("http://x/"), {
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm", ref: "r" }),
  });

function avec(contentType: string): void {
  h.resolu = {
    pieces: [{ filename: "f", content: Buffer.from("x"), contentType }],
    omises: [],
    empreintes: [],
  };
}

beforeEach(() => {
  h.piece = { filename: "Contrat.pdf", r2Key: "k", contentType: "application/pdf" };
});

describe("route piece-jointe : en-têtes", () => {
  it("PDF : pas de `sandbox` (Chromium), mais object-src 'none' et nosniff", async () => {
    avec("application/pdf");
    const r = await appeler();
    const csp = r.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("sandbox");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("image et autre type : `sandbox` conservé", async () => {
    avec("image/png");
    expect((await appeler()).headers.get("Content-Security-Policy")).toContain("sandbox");
    avec("text/html");
    const r = await appeler();
    expect(r.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(r.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  it("pièce trop lourde : 413 « trop lourd », pas « introuvable »", async () => {
    h.resolu = new Error("[email-worker] pièces jointes trop lourdes : 11.0 Mo");
    const r = await appeler();
    expect(r.status).toBe(413);
    expect(await r.text()).toMatch(/trop lourd/);
  });

  it("pièce absente : 404 « introuvable »", async () => {
    h.resolu = new Error("PJ introuvable");
    const r = await appeler();
    expect(r.status).toBe(404);
    expect(await r.text()).toMatch(/introuvable/);
  });
});
