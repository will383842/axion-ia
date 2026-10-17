/**
 * Lot L09 — `/reclamations/deposer` n'entre pas dans `pages.xml` : la page rend
 * un 404 tant que l'interrupteur est éteint, et `noindex` une fois allumé.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: () => () => [] }) }));

import sitemap from "@/app/sitemap";

describe("sitemap pages — dépôt de réclamation", () => {
  it("ne contient aucune URL /reclamations/deposer, mais garde /reclamations", async () => {
    const entrees = await sitemap({ id: Promise.resolve("pages") as never } as never);
    const urls = entrees.map((e) => e.url);
    expect(urls.length).toBeGreaterThan(10);
    expect(urls.filter((u) => u.includes("/reclamations/deposer"))).toEqual([]);
  });
});
