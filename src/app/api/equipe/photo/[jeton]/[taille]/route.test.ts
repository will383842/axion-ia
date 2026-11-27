/**
 * @vitest-environment node
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { teamMember: { findFirst: m.findFirst } } }));

const racine = mkdtempSync(join(tmpdir(), "equipe-route-"));
process.env["TEAM_PHOTO_PUBLIC_PATH"] = racine;
const J = "a".repeat(32);
writeFileSync(join(racine, `${J}-256.webp`), "webp-256");

import { GET } from "./route";

const appel = (jeton: string, taille: string) =>
  GET(new Request("http://x"), { params: Promise.resolve({ jeton, taille }) });
const ok = {
  status: "publie",
  photoKind: "reelle",
  photoConsentAt: new Date(),
  erasureRequestedAt: null,
  photoUrl256: `/api/equipe/photo/${J}/256`,
  photoUrl1024: null,
};
beforeEach(() => m.findFirst.mockReset());
afterAll(() => rmSync(racine, { recursive: true, force: true }));

describe("GET /api/equipe/photo/[jeton]/[taille]", () => {
  it("sert la variante quand la règle d'affichage est remplie", async () => {
    m.findFirst.mockResolvedValue(ok);
    const r = await appel(J, "256");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/webp");
    expect(r.headers.get("cache-control")).not.toMatch(/immutable/);
  });
  it.each([
    ["non publiée", { status: "retire" }],
    ["avatar", { photoKind: "avatar" }],
    ["sans consentement", { photoConsentAt: null }],
    ["effacement demandé", { erasureRequestedAt: new Date() }],
  ])("404 : %s", async (_n, over) => {
    m.findFirst.mockResolvedValue({ ...ok, ...over });
    expect((await appel(J, "256")).status).toBe(404);
  });
  it("404 : jeton inconnu en base", async () => {
    m.findFirst.mockResolvedValue(null);
    expect((await appel(J, "256")).status).toBe(404);
  });
  it.each([
    ["../../etc/passwd", "256"],
    [J, "512"],
    [J, "original"],
    ["A".repeat(32), "256"],
  ])("404 sans lire la base : %s/%s", async (j, t) => {
    expect((await appel(j, t)).status).toBe(404);
    expect(m.findFirst).not.toHaveBeenCalled();
  });
});
