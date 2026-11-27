// Les modules « visites venues des IA » sont SERVEUR uniquement. En vitest, `server-only` est un
// bouchon (vitest.config.ts) : retirer l'import ne ferait rougir aucun test, alors que la vraie
// protection est l'erreur du build Next si un composant client l'importe (relecture V1-10 v3,
// mutation G12). On lit donc le source : `import "server-only"` doit être une instruction réelle.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FICHIERS = ["src/server/analytics/visites-ia.ts", "src/lib/analytics/referents-ia.ts"];

/** Retire les commentaires : l'import ne doit pas être « gardé » par un simple commentaire. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("visites IA : modules serveur seulement", () => {
  it.each(FICHIERS)('%s commence (hors commentaires) par import "server-only"', (f) => {
    const code = sansCommentaires(readFileSync(resolve(process.cwd(), f), "utf8")).trimStart();
    expect(code.startsWith('import "server-only";')).toBe(true);
  });
});
