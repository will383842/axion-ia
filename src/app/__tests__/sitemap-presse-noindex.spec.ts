/**
 * S2-2 — le plan du site presse exclut les communiqués que la page met en noindex.
 * Règle partagée : `communiqueIndexable` (PDF → indexable ; sinon corps ≥ 60 mots).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { pressFindMany } = vi.hoisted(() => ({ pressFindMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pressRelease: { findMany: pressFindMany },
    article: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    category: { findMany: vi.fn(async () => []) },
    knowledgeEntry: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  },
}));

import sitemap from "../sitemap";
import { communiqueIndexable, MIN_BODY_WORDS } from "@/server/press/indexabilite";

const mots = (n: number) => Array.from({ length: n }, (_, i) => `mot${i}`).join(" ");

function row(slug: string, body: string | null, pdfStoragePath: string | null = null) {
  return {
    publishedAt: new Date("2026-10-01T00:00:00Z"),
    createdAt: new Date("2026-10-01T00:00:00Z"),
    pdfStoragePath,
    translations: [{ locale: "fr", slug, body }],
  };
}

beforeEach(() => pressFindMany.mockReset());

describe("communiqueIndexable", () => {
  it("seuil à 60 mots sans PDF", () => {
    expect(MIN_BODY_WORDS).toBe(60);
    expect(communiqueIndexable({ pdfUrl: null, body: mots(59) })).toBe(false);
    expect(communiqueIndexable({ pdfUrl: null, body: mots(60) })).toBe(true);
    expect(communiqueIndexable({ pdfUrl: null, body: null })).toBe(false);
  });
  it("un PDF au corps vide est indexable", () => {
    expect(communiqueIndexable({ pdfUrl: "/api/presse/communique/x", body: "" })).toBe(true);
  });
});

describe("sitemap presse", () => {
  it("exclut 59 mots sans PDF, inclut 60 mots, inclut un PDF au corps vide", async () => {
    pressFindMany.mockResolvedValue([
      row("court-59", mots(59)),
      row("limite-60", mots(60)),
      row("pdf-vide", null, "chemin/communique.pdf"),
      row("pdf-corps-vide", "", "chemin/autre.pdf"),
    ]);
    const urls = (await sitemap({ id: Promise.resolve("presse") })).map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/presse/court-59"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/presse/limite-60"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/presse/pdf-vide"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/presse/pdf-corps-vide"))).toBe(true);
  });

  it("la requête sélectionne pdfStoragePath et le corps", async () => {
    pressFindMany.mockResolvedValue([]);
    await sitemap({ id: Promise.resolve("presse") });
    const select = pressFindMany.mock.calls[0]?.[0]?.select;
    expect(select.pdfStoragePath).toBe(true);
    expect(select.translations.select.body).toBe(true);
  });
});

describe("la page et le plan du site importent le même prédicat", () => {
  const src = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
  it("page presse et sitemap.ts", () => {
    for (const f of ["src/app/[locale]/presse/[slug]/page.tsx", "src/app/sitemap.ts"]) {
      const s = src(f);
      expect(s).toContain('from "@/server/press/indexabilite"');
      expect(s).toContain("communiqueIndexable(");
    }
    expect(src("src/app/[locale]/presse/[slug]/page.tsx")).not.toMatch(/const MIN_BODY_WORDS\s*=/);
  });
});
