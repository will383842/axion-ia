/**
 * Verrou de source (P13) : le pilotage n'écrit JAMAIS de fichier et n'importe jamais les sources
 * de vérité du site (prix, légal, positionnement, journée IA). Les modules de `actions/` ne peuvent
 * donc pas modifier `pricing.ts`, `legal.ts`, `positionnement.ts` ni `journee-ia-commun.ts`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(__dirname, "..");
const modules = readdirSync(DOSSIER).filter((f) => f.endsWith(".ts"));

const IMPORTS_INTERDITS = /(pricing|legal|positionnement|journee-ia-commun)/;
const ECRITURE_FICHIER =
  /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|rename|renameSync|unlink|unlinkSync|rm|rmSync|copyFile|copyFileSync|truncate|mkdir|mkdirSync)\b/;
const IMPORT_FS = /from\s+["'](node:)?(fs|fs\/promises)["']|require\(["'](node:)?fs/;

describe("verrou de source des actions du pilotage SEO", () => {
  it("il y a des modules à contrôler", () => {
    expect(modules).toEqual(expect.arrayContaining(["journal.ts", "annuler.ts"]));
  });

  for (const m of modules) {
    const src = readFileSync(join(DOSSIER, m), "utf8");
    const imports = [...src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((x) => x[1]!);

    it(`${m} n'importe ni pricing, ni legal, ni positionnement, ni journee-ia-commun`, () => {
      expect(imports.filter((i) => IMPORTS_INTERDITS.test(i))).toEqual([]);
    });

    it(`${m} n'importe pas fs et n'écrit aucun fichier`, () => {
      expect(IMPORT_FS.test(src)).toBe(false);
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(ECRITURE_FICHIER.test(code)).toBe(false);
    });
  }
});
