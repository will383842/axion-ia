import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// /design n'affiche que la palette définitive ; le vert sauge reste une exception documentée.
const SOURCE = readFileSync(resolve(process.cwd(), "src/app/[locale]/design/page.tsx"), "utf8");
const AUTORISES = new Set(
  [
    "faf9f5",
    "e8e6dc",
    "141413",
    "b23f16",
    "d97757",
    "b0aea5",
    "8f3412",
    "5e7050",
    "5e5d59",
    "eef1eb",
  ].map((h) => `#${h}`),
);

describe("vitrine /design", () => {
  it("n'affiche que des hexadécimaux de la palette définitive", () => {
    const trouves = (SOURCE.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase());
    expect(trouves.length).toBeGreaterThan(8); // contre-témoin : le nuancier n'est pas vide
    expect(trouves.filter((h) => !AUTORISES.has(h))).toEqual([]);
  });

  it("garde le vert sauge comme exception documentée, sans bleu ni violet", () => {
    expect(SOURCE).toContain("#5e7050");
    expect(SOURCE).toMatch(/exception/i);
    expect(SOURCE).not.toMatch(/Editorial Blue|#(?:1a4dd9|ff6b00|7a3dff)/i);
  });
});
