/**
 * Garde X-6 (vérification finale du 2026-11-11) : le JSON-LD des pages ville ne
 * déclare aucune adresse locale. La ville de la page est une zone servie
 * (`areaServed`), jamais une `PostalAddress` : 2 160 pages affirmeraient sinon
 * une présence physique dans chaque ville.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const FICHIERS = [
  "src/app/[locale]/implantations/[region]/[ville]/page.tsx",
  "src/lib/seo/ville-service-jsonld.ts",
];

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("JSON-LD des pages ville : pas d'adresse locale", () => {
  for (const rel of FICHIERS) {
    const code = sansCommentaires(readFileSync(path.join(ROOT, rel), "utf8"));

    it(`${rel} : aucun addressLocality/addressRegion/streetAddress ni code postal de la ville`, () => {
      expect(code).not.toMatch(/addressLocality|addressRegion|streetAddress|\bpostalCode:\s*ville/);
    });

    it(`${rel} : adresse = pays seul, zone servie via areaServed`, () => {
      expect(code).toMatch(
        /address:\s*\{\s*"@type":\s*"PostalAddress",\s*addressCountry:\s*"FR"\s*\}/,
      );
      expect(code).toMatch(/areaServed:\s*\{\s*"@type":\s*"City"/);
    });
  }
});
