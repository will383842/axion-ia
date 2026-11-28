import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** C4 est un module PUR : seuls des imports relatifs du même dossier sont permis. */
describe("pureté du module chaîne (C4)", () => {
  for (const fichier of ["codes-refus.ts", "contrat-porte.ts"]) {
    it(`${fichier} n'importe que des fichiers voisins`, () => {
      const source = readFileSync(join(__dirname, fichier), "utf8");
      const imports = [
        ...source.matchAll(/(?:from|import|require\()\s*\(?\s*["']([^"']+)["']/g),
      ].map((m) => m[1]);
      expect(source).not.toMatch(/\brequire\(|\bimport\(/);
      for (const i of imports) expect(i, i).toMatch(/^\.\/[a-z-]+$/);
      expect(source).not.toMatch(/process\.env|fetch\(|prisma|redis/i);
    });
  }
});

/** C10 : l'orchestration est injectée ; aucune entrée-sortie, aucune base, aucun réseau. */
describe("pureté de l'orchestration (C10)", () => {
  for (const fichier of ["orchestrateur.ts", "journee.ts"]) {
    it(`${fichier} n'a ni base, ni Redis, ni réseau, ni lecture d'environnement`, () => {
      const source = readFileSync(join(__dirname, fichier), "utf8");
      expect(source).not.toMatch(/process\.env|\bfetch\(|@\/lib\/(prisma|redis)|@prisma|ioredis/);
      expect(source).not.toMatch(/\brequire\(|\bimport\(/);
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const i of imports) expect(i, i).toMatch(/^(\.\/[a-z-]+(\/[a-z-]+)?|zod)$/);
    });
  }
});
