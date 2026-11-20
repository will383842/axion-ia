// @vitest-environment node
/**
 * Décision de Williams (20/11/2026) : « Aucun suivi nulle part ».
 *
 * La base de connaissances de génération (articles, FAQ, chatbot RAG) nourrit du texte
 * PUBLIC : elle ne doit pas promettre de suivi après la prestation. Pendant de
 * `tests/unit/seo/aucune-promesse-de-suivi.spec.ts` (qui ne peut pas citer ce dossier :
 * garde d'isolation content-gen). Motifs volontairement étroits.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DOSSIER_KB = "src/server/content-gen/kb";
const PROMESSES_KB: ReadonlyArray<readonly [string, RegExp]> = [
  ["suivi post-formation", /suivi post-formation/i],
  ["évaluation à froid à 30 et 90 jours", /évaluation à froid à 30 et 90 jours/i],
  ["30 jours de support", /(?:30|trente) (?:jours|j) de support/i],
];

function* fichiers(dossier: string): Generator<string> {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (/(\.test\.|\.spec\.|__tests__)/.test(chemin)) continue;
    if (statSync(chemin).isDirectory()) yield* fichiers(chemin);
    else if (/\.ts$/.test(nom)) yield chemin;
  }
}

describe("décision du 20/11 — base de connaissances sans promesse de suivi", () => {
  const corpus = [...fichiers(join(RACINE, DOSSIER_KB))];

  it("le corpus est bien lu", () => {
    expect(corpus.length).toBeGreaterThan(5);
  });

  for (const [nom, motif] of PROMESSES_KB) {
    it(`« ${nom} » n'apparaît nulle part`, () => {
      const trouves: string[] = [];
      for (const chemin of corpus) {
        const rel = relative(RACINE, chemin).replaceAll("\\", "/");
        readFileSync(chemin, "utf8")
          .split("\n")
          .forEach((ligne, i) => {
            if (motif.test(ligne)) trouves.push(`${rel}:${i + 1}`);
          });
      }
      expect(trouves, `promesse de suivi dans la base de connaissances : ${nom}`).toEqual([]);
    });
  }
});
