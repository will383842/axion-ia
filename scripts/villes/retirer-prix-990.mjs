#!/usr/bin/env node
/**
 * Retire l'ancien tarif « €990 excl. VAT » des variantes anglaises de
 * `src/content/villes/copy/*.ts` et le remplace par « Price on request »,
 * SANS montant. La Journée IA à 1 490 € HT est le seul prix affiché.
 *
 * Méthode (même contrat que `nettoyer-fausse-presence.mjs`) : une TABLE de
 * remplacements par chaîne EXACTE, chaque entrée BORNÉE à sa liste de
 * fichiers : [avant, après, fichiers]. Aucune expression régulière appliquée
 * au texte. Les phrases les plus longues passent d'abord, pour que la forme
 * courte « From €990 excl. VAT » ne coupe pas une phrase plus spécifique.
 *
 * Usage :
 *   node scripts/villes/retirer-prix-990.mjs --dry-run   # fichier:ligne avant/après
 *   node scripts/villes/retirer-prix-990.mjs             # écrit
 *   node scripts/villes/retirer-prix-990.mjs --dossier=<chemin>
 *
 * Idempotent : relancé après écriture, il annonce « 0 fichier à modifier ».
 * Échoue (code 1) si une seule occurrence de « €990 » subsiste après la passe.
 *
 * Verrouillé par `tests/unit/content/villes-sans-prix-990.spec.ts`.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ARG_DOSSIER = process.argv.find((a) => a.startsWith("--dossier="));
const DOSSIER = ARG_DOSSIER
  ? resolve(ARG_DOSSIER.slice("--dossier=".length))
  : resolve(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "content",
      "villes",
      "copy",
    );
const DRY_RUN = process.argv.includes("--dry-run");

const COACHING_A = [
  "nantes.ts",
  "rennes.ts",
  "reims.ts",
  "montpellier.ts",
  "saint-etienne.ts",
  "nimes.ts",
];
const COACHING_B = ["tours.ts", "strasbourg.ts", "toulouse.ts"];

/** [avant exact, après, fichiers concernés]. */
const TABLE = [
  [
    "You start with the first session at €990 excl. VAT.",
    "You start with a first session, priced on request.",
    COACHING_A,
  ],
  [
    "The entry rate is €990 excl. VAT for a short programme (2-3 sessions).",
    "The entry rate for a short programme (2-3 sessions) is quoted on request.",
    ["toulouse.ts"],
  ],
  [
    "The entry rate is €990 excl. VAT for a short programme",
    "The entry rate for a short programme is quoted on request",
    COACHING_B,
  ],
  [
    "Fixed entry rate at €990 excl. VAT for the discovery session:",
    "Fixed entry rate for the discovery session, quoted on request:",
    ["nice.ts"],
  ],
  [
    "The discovery session at €990 excl. VAT already produces",
    "The discovery session already produces",
    ["nice.ts"],
  ],
  [
    '"Discovery session — from €990 excl. VAT"',
    '"Discovery session — price on request"',
    ["nice.ts"],
  ],
  ["Entry rate from €990 excl. VAT.", "Price on request.", [...COACHING_B, "nice.ts"]],
  ['price: "From €990 excl. VAT"', 'price: "Price on request"', [...COACHING_A, "paris.ts"]],
  ['price: "from €990 excl. VAT"', 'price: "Price on request"', [...COACHING_B, "lyon.ts"]],
  ["From €990 excl. VAT.", "Price on request.", COACHING_A],
];

const fichiers = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts")
  .sort();

let modifies = 0;
const restes = [];
for (const nom of fichiers) {
  const chemin = join(DOSSIER, nom);
  const avant = readFileSync(chemin, "utf8");
  let texte = avant;
  for (const [ancien, nouveau, cibles] of TABLE) {
    if (!cibles.includes(nom) || !texte.includes(ancien)) continue;
    if (DRY_RUN) {
      texte.split("\n").forEach((ligne, i) => {
        if (ligne.includes(ancien)) console.log(`${nom}:${i + 1}\n  - ${ancien}\n  + ${nouveau}`);
      });
    }
    texte = texte.split(ancien).join(nouveau);
  }
  if (texte.includes("€990")) restes.push(nom);
  if (texte === avant) continue;
  modifies += 1;
  if (!DRY_RUN) writeFileSync(chemin, texte);
}

console.log(`${modifies} fichier(s) ${DRY_RUN ? "à modifier" : "modifié(s)"}.`);
if (restes.length > 0) {
  console.error(`« €990 » subsiste dans : ${restes.join(", ")}`);
  process.exit(1);
}
