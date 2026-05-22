/**
 * Tests détection hallucinations — URLs hors catalogue.
 * (Test isolé du helpers.ts pour éviter import Prisma.)
 */

import { describe, it, expect } from "vitest";
import { ALL_EXTERNAL_LINKS } from "./master";

function detectHallucinations(bodyHtml: string): { valid: string[]; hallucinated: string[] } {
  const matches = bodyHtml.match(/<a[^>]+href="(https?:\/\/[^"]+)"/g) ?? [];
  const externalUrls = matches
    .map((m) => m.match(/href="([^"]+)"/)?.[1] ?? "")
    .filter((url) => url && !url.includes("axion-ia.com"));

  const valid: string[] = [];
  const hallucinated: string[] = [];

  for (const url of externalUrls) {
    const link = ALL_EXTERNAL_LINKS.find((l) => l.url === url);
    if (link) valid.push(link.id);
    else hallucinated.push(url);
  }

  return { valid, hallucinated };
}

describe("detectHallucinations", () => {
  it("Détecte une URL hors catalogue", () => {
    const html = `<p>Voir <a href="https://hallucinated-url-not-in-catalog.example.com/">source</a></p>`;
    const result = detectHallucinations(html);
    expect(result.hallucinated.length).toBe(1);
    expect(result.valid.length).toBe(0);
  });

  it("Valide une URL du catalogue (INSEE)", () => {
    const html = `<p>Source <a href="https://www.insee.fr/fr/statistiques">INSEE</a></p>`;
    const result = detectHallucinations(html);
    expect(result.valid.length).toBe(1);
    expect(result.hallucinated.length).toBe(0);
    expect(result.valid[0]).toBe("fr-nat-insee-001");
  });

  it("Ignore les liens internes axion-ia.com", () => {
    const html = `<p>Voir <a href="https://axion-ia.com/audits">notre offre</a></p>`;
    const result = detectHallucinations(html);
    expect(result.valid.length).toBe(0);
    expect(result.hallucinated.length).toBe(0);
  });

  it("Mixe valid + hallucinated", () => {
    const html = [
      `<a href="https://www.cnil.fr/fr/intelligence-artificielle">CNIL</a>`,
      `<a href="https://fake-source.example/">fake</a>`,
      `<a href="https://www.insee.fr/fr/statistiques">INSEE</a>`,
    ].join("");
    const result = detectHallucinations(html);
    expect(result.valid.length).toBe(2);
    expect(result.hallucinated.length).toBe(1);
    expect(result.hallucinated[0]).toBe("https://fake-source.example/");
  });
});
