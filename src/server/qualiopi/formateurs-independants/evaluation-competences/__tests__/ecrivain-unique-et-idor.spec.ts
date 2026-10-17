// @vitest-environment node

/**
 * Qualiopi ind. 21 — deux verrous de texte, sans base.
 *
 * 1. ÉCRIVAIN UNIQUE, AJOUT SEUL : `ecriture.ts` est le seul fichier de `src/**` qui écrit
 *    dans `evaluationCompetenceFormateur`, et il n'y fait que des `create`. (La base refuse
 *    de toute façon UPDATE, DELETE et TRUNCATE : triggers `…_ajout_seul`.)
 * 2. IDOR : aucun écran ni aucune action du FORMATEUR (dossier en ligne, espace
 *    formateur, serveur `src/server/formateur`) ne lit ni n'écrit les grilles.
 *
 * Mutation qui fait rougir : ajouter `prisma.evaluationCompetenceFormateur.update(` dans
 * un fichier, ou importer `evaluation-competences/lecture` depuis le dossier en ligne.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const SRC = join(RACINE, "src");
const ECRIVAIN = [
  "src",
  "server",
  "qualiopi",
  "formateurs-independants",
  "evaluation-competences",
  "ecriture.ts",
].join(sep);

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom === "node_modules" || nom === "generated" || nom === "__tests__") continue;
      out.push(...fichiers(p));
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.(ts|tsx)$/.test(nom)) {
      out.push(p);
    }
  }
  return out;
}

const TOUS = fichiers(SRC);

describe("évaluations de compétences — écrivain unique, ajout seul", () => {
  it("aucune écriture hors de `ecriture.ts`", () => {
    const fautes = TOUS.filter((f) => relative(RACINE, f) !== ECRIVAIN).filter((f) =>
      /evaluationCompetenceFormateur\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(fautes.map((f) => relative(RACINE, f))).toEqual([]);
  });

  it("`ecriture.ts` ne fait que des `create`", () => {
    const src = readFileSync(join(RACINE, ECRIVAIN), "utf8");
    expect(src).toMatch(/evaluationCompetenceFormateur\.create\(/);
    expect(src).not.toMatch(
      /evaluationCompetenceFormateur\s*\.\s*(createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/,
    );
  });
});

describe("IDOR — le formateur ne voit ni n'écrit jamais les grilles", () => {
  const COTE_FORMATEUR = [
    join(SRC, "app", "formateur"),
    join(SRC, "app", "[locale]", "espace-formateur"),
    join(SRC, "components", "espace-formateur"),
    join(SRC, "server", "formateur"),
  ];
  it.each(COTE_FORMATEUR)("%s n'importe ni ne lit les évaluations", (dir) => {
    const fautes = fichiers(dir).filter((f) => {
      const s = readFileSync(f, "utf8");
      return /evaluation-competences|evaluationCompetenceFormateur|evaluationsCompetences/.test(s);
    });
    expect(fautes.map((f) => relative(RACINE, f))).toEqual([]);
  });
});
