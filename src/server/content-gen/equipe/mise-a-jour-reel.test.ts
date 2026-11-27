import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));

import { phrasesAVerifier, cleQuotaMaj } from "./mise-a-jour-reel";
import { sansBalises } from "./mise-a-jour";

describe("phrasesAVerifier", () => {
  const html =
    "<h2>Titre 2026 du jour</h2><p>Une phrase sans chiffre ici.</p><p>Le coût baisse de 12 % en moyenne.</p><ul><li>Gain de 30 minutes par semaine</li></ul>";
  it("ne garde que les phrases chiffrées, hors titres", () => {
    expect(phrasesAVerifier(html)).toEqual([
      "Le coût baisse de 12 % en moyenne.",
      "Gain de 30 minutes par semaine",
    ]);
  });
  it("chaque phrase se retrouve telle quelle dans le texte brut", () => {
    for (const p of phrasesAVerifier(html)) expect(sansBalises(html)).toContain(p);
  });
  it("plafonne à 25", () => {
    const beaucoup = Array.from(
      { length: 40 },
      (_, i) => `<p>La phrase numéro ${i} dépasse vingt caractères.</p>`,
    ).join("");
    expect(phrasesAVerifier(beaucoup)).toHaveLength(25);
  });
  it("clé de quota par jour", () => {
    expect(cleQuotaMaj(new Date("2026-11-27T10:00:00Z"))).toBe("equipe-maj:quota:2026-11-27");
  });
});
