#!/usr/bin/env node
/**
 * Passe finale · lot 1/3 : applique la règle générale « jamais de
 * … depuis <Ville> » sur les textes de ville abbeville.ts → avant gentilly.ts
 * (borné par NOM) et liste les résidus (code de sortie 1 s'il en reste).
 * Même motif et même liste blanche que
 * tests/unit/content/villes-sans-fausse-presence-lot-1.spec.ts.
 *   node scripts/villes/verifier-depuis-ville-lot-1.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOSSIER = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "content",
  "villes",
  "copy",
);
const REGLE =
  /(?:se déplac|déplacements?|interventions?|consultants?|équipe|experts?|Williams|[Nn]ous|accès rapide|missions?)[^."?]{0,80}depuis (?!le |la |les |l'|son |sa |votre |vos )[A-ZÉ]/u;
const QUESTION = /Comment se (?:passe|déroule) une (?:mission|intervention)[^"?]* depuis /u;
const BLANCHE = [
  /équipes pilotent l'outil en autonomie depuis /u,
  /qu'elles pilotent l'outil en autonomie depuis /u,
];

const noms = readdirSync(DOSSIER)
  .filter((n) => n.endsWith(".ts") && n !== "types.ts" && !n.startsWith("_"))
  .sort()
  .filter((n) => n >= "abbeville.ts" && n < "gentilly.ts");
let residus = 0;
for (const nom of noms) {
  readFileSync(join(DOSSIER, nom), "utf8")
    .split("\n")
    .forEach((l, i) => {
      const s = BLANCHE.reduce((a, b) => a.replace(b, ""), l);
      if (REGLE.test(s) || QUESTION.test(s)) {
        residus++;
        console.log(`${nom}:${i + 1}`);
      }
    });
}
console.log(`${noms.length} fichiers, ${residus} résidu(s)`);
process.exit(residus ? 1 : 0);
