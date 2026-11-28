/**
 * Search Console 28/11/2026 : Google n'est pas revenu sur /fr/blog depuis le 11/09.
 * Le lastmod de l'accueil du blog suit le dernier article publié (pas une date figée).
 */
import { describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { findMany: vi.fn(async () => []), findFirst },
    category: { findMany: vi.fn(async () => []) },
    knowledgeEntry: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  },
}));

import sitemap from "@/app/sitemap";

const dateDe = (plan: Awaited<ReturnType<typeof sitemap>>) =>
  new Date(plan.find((e) => new URL(e.url).pathname === "/fr/blog")!.lastModified as string | Date);

describe("lastmod de /fr/blog", () => {
  it("avance avec le dernier article publié", async () => {
    findFirst.mockResolvedValue({ publishedAt: new Date("2026-11-27T08:00:00Z"), updatedAt: null });
    const d = dateDe(await sitemap({ id: Promise.resolve("pages") }));
    expect(d.toISOString().slice(0, 10)).toBe("2026-11-27");
  });
  it("ne va jamais dans le futur", async () => {
    findFirst.mockResolvedValue({ publishedAt: new Date(Date.now() + 5 * 86_400_000), updatedAt: null });
    const d = dateDe(await sitemap({ id: Promise.resolve("pages") }));
    expect(d.getTime()).toBeLessThanOrEqual(Date.now());
  });
  it("base injoignable : date éditoriale conservée, pas d'erreur", async () => {
    findFirst.mockRejectedValue(new Error("db"));
    const d = dateDe(await sitemap({ id: Promise.resolve("pages") }));
    expect(Number.isNaN(d.getTime())).toBe(false);
  });
});
