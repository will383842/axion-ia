/**
 * Lecture d'un workflow GitHub par les gardes de `tests/unit/ci/` : lignes de
 * CODE seulement, et découpage par job. Partagé pour que deux gardes ne bornent
 * pas un job de deux façons différentes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

/** Le workflow, privé de ses commentaires : seules les lignes de code comptent. */
export function codeYaml(chemin: string): string {
  return readFileSync(path.join(process.cwd(), chemin), "utf8")
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

/**
 * Le corps d'un job : de sa clé `  <cle>:` jusqu'à la PROCHAINE clé de même
 * niveau ou de niveau supérieur (indentation 0 ou 2), quel que soit son nom —
 * ou jusqu'à la fin du fichier. `null` si le job n'existe pas.
 *
 * 🔴 2026-09-19 — la borne était d'abord `gate-b:`, puis « le prochain
 * `gate-` ». Les deux ratent un job intercalé dont la clé ne commence pas par
 * `gate-` : une garde déplacée dedans resterait comptée dans gate-a, en vert.
 */
export function corpsDuJob(yaml: string, cle: string): string | null {
  const debut = yaml.indexOf(`\n  ${cle}:`);
  if (debut === -1) return null;
  const suivante = /\n {0,2}[A-Za-z0-9_-]+:/g;
  suivante.lastIndex = debut + 1;
  const m = suivante.exec(yaml);
  return yaml.slice(debut, m ? m.index : yaml.length);
}
