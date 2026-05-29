/**
 * Fix contenu villes — relabel « Intervention Essentielle » → « Formation 4 h »
 * (Sprint Pricing SSOT 2026-05-29, décision Will).
 *
 * Bug générateur pré-existant : le prompt présentait l'entrée intervention la
 * moins chère (590 € = Formation 4 h, tier `intervention-4h`) sous le label
 * « Intervention Essentielle » — or l'Essentielle (1 jour) vaut 690 €. Les
 * villes générées ont donc « Intervention Essentielle … {{price:intervention-4h}} »
 * (label faux, prix 590 correct pour la Formation 4 h).
 *
 * Décision Will : garder le prix (590), corriger le LABEL → « Formation 4 h ».
 * On NE touche QU'AUX occurrences directement liées au token intervention-4h
 * (les « interventions essentielles » génériques minuscules et les vraies
 * références à l'Essentielle 690 € via {{price:intervention-essentielle}} sont
 * laissées intactes).
 *
 * DRY-RUN par défaut ; `--apply` pour écrire. Idempotent. EOL préservé.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const COPY_DIR = path.resolve(process.cwd(), "src/content/villes/copy");
const APPLY = process.argv.includes("--apply");

// Connecteur optionnel entre le label et le token (« à »/« dès »/« à partir de »).
const CONN = "(\\s*(?:à partir de|à|dès)?\\s*)";
const TOK = "(\\{\\{price:intervention-4h)";
// Rule A : « l'Intervention Essentielle … {{4h}} » → « la Formation 4 h … {{4h}} »
const RULE_A = new RegExp(`(l'|L')Intervention Essentielle${CONN}${TOK}`, "g");
// Rule B : « Intervention Essentielle … {{4h}} » (hors l'/L', déjà traités) → « Formation 4 h … »
const RULE_B = new RegExp(`Intervention Essentielle${CONN}${TOK}`, "g");

let occurrences = 0;
let filesChanged = 0;

function fixLine(line: string): string {
  let out = line.replace(RULE_A, (_m, art: string, conn: string, tok: string) => {
    occurrences++;
    return `${art === "l'" ? "la " : "La "}Formation 4 h${conn}${tok}`;
  });
  out = out.replace(RULE_B, (_m, conn: string, tok: string) => {
    occurrences++;
    return `Formation 4 h${conn}${tok}`;
  });
  return out;
}

const files = readdirSync(COPY_DIR)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "_auto-generated-index.ts")
  .sort();

const samples: string[] = [];
for (const f of files) {
  const abs = path.join(COPY_DIR, f);
  const content = readFileSync(abs, "utf8");
  if (!content.includes("Intervention Essentielle")) continue;
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  let changed = false;
  const newLines = lines.map((line) => {
    const out = fixLine(line);
    if (out !== line) {
      changed = true;
      if (samples.length < 12) samples.push(`${f}: …${out.trim().slice(0, 120)}…`);
    }
    return out;
  });
  if (changed) {
    filesChanged++;
    if (APPLY) writeFileSync(abs, newLines.join(eol), "utf8");
  }
}

console.log(`\n=== fix-ville-essentielle-label (${APPLY ? "APPLY" : "DRY-RUN"}) ===`);
console.log(`Occurrences relabel : ${occurrences}`);
console.log(`Fichiers modifiés   : ${filesChanged}`);
console.log(`\n--- Échantillons ---`);
for (const s of samples) console.log(`  ${s}`);
console.log("");
