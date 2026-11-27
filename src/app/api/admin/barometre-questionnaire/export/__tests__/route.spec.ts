/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock, findMany } = vi.hoisted(() => ({ authMock: vi.fn(), findMany: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ prisma: { barometreQuestionnaireReponse: { findMany } } }));

import { GET } from "../route";

const LIGNE = {
  jour: new Date("2026-12-05T00:00:00.000Z"),
  questionnaireVersion: "q-v5",
  reponses: { q1: "5-9", q2: "commerce", q10: ["temps", "cout"] },
  texteUsage: '=HYPERLINK("http://x")',
  texteQuestion: "Une question ; avec point-virgule",
};

describe("export CSV du questionnaire", () => {
  beforeEach(() => {
    authMock.mockReset();
    findMany.mockReset();
    findMany.mockResolvedValue([LIGNE]);
  });

  it("401 sans session", async () => {
    authMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("403 pour tout rôle autre que super_admin", async () => {
    for (const role of ["admin", "editor", "reader"]) {
      authMock.mockResolvedValue({ user: { id: "u1", role } });
      expect((await GET()).status, role).toBe(403);
    }
    expect(findMany).not.toHaveBeenCalled();
  });

  it("200 pour super_admin : CSV UTF-8 avec BOM, no-store, sans empreinte ni id", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "super_admin" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toContain("text/csv");
    const octets = new Uint8Array(await res.arrayBuffer());
    // BOM UTF-8 : EF BB BF (`Response.text()` le retirerait, d'où la lecture des octets).
    expect(Array.from(octets.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const [entete, ligne] = new TextDecoder().decode(octets.slice(3)).split("\r\n");
    expect(entete).not.toMatch(/hash|empreinte|(^|;)id(;|$)/i);
    expect(ligne).toContain("2026-12-05;q-v5;5-9;commerce");
    expect(ligne).toContain("temps|cout");
    // La requête ne sélectionne ni l'identifiant ni l'empreinte.
    const arg = findMany.mock.calls[0]![0] as { select: Record<string, boolean> };
    expect(arg.select).not.toHaveProperty("id");
    expect(arg.select).not.toHaveProperty("codeRetraitHash");
  });

  it("injection de formule neutralisée (préfixe ')", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "super_admin" } });
    const corps = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      await (await GET()).arrayBuffer(),
    );
    expect(corps).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(corps).not.toMatch(/;=HYPERLINK/);
  });
});
