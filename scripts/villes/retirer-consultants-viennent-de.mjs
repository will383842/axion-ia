#!/usr/bin/env node
/**
 * Retire, par LOTS, la phrase « Nos consultants viennent de X (20 min). » et
 * ses variantes (« se déplacent … depuis X », « interviennent depuis X ») des
 * textes `src/content/villes/copy/*.ts`.
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Une phrase qui fait « venir » les
 * consultants d'une ville voisine en N minutes affirme une base qui n'existe
 * pas. #1862 a traité « sont basés » et « depuis nos bureaux » et a laissé
 * cette famille hors périmètre ; ce script la reprend.
 *
 * Règle appliquée, PHRASE PAR PHRASE (jamais un fragment) :
 *   · la phrase commence par « Nos consultants » en début de chaîne ou après
 *     « . ! ? » et se termine au premier point suivi d'une espace, d'un
 *     guillemet ou de la fin de ligne ;
 *   · elle est remplacée par « Nous intervenons partout en France, sur place ou
 *     à distance. » ;
 *   · si la ligne dit déjà « partout en France », la phrase est simplement
 *     retirée (pas de doublon) ; si elle était seule dans sa chaîne, elle est
 *     remplacée quand même (jamais de chaîne vide).
 *
 * Lots : les fichiers sont pris dans l'ordre alphabétique, en sautant ceux qui
 * sont déjà propres, jusqu'à `--max-lignes` lignes modifiées (défaut 190, pour
 * garder chaque PR sous 600 lignes de diff). Relancer le script fait le lot
 * suivant.
 *
 * Usage :
 *   node scripts/villes/retirer-consultants-viennent-de.mjs --dry-run
 *   node scripts/villes/retirer-consultants-viennent-de.mjs [--max-lignes=190]
 *   node scripts/villes/retirer-consultants-viennent-de.mjs --compter   # reste à traiter
 *
 * Verrouillé par `tests/unit/content/villes-consultants-viennent-de.spec.ts`
 * (cliquet : le nombre de lignes fautives ne peut que baisser).
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
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
const DRY_RUN = process.argv.includes("--dry-run");
const COMPTER = process.argv.includes("--compter");
const ARG_MAX = process.argv.find((a) => a.startsWith("--max-lignes="));
const MAX_LIGNES = ARG_MAX ? Number(ARG_MAX.slice("--max-lignes=".length)) : 190;

export const NOUVELLE = "Nous intervenons partout en France, sur place ou à distance.";

/** Même motif que le test : une phrase entière, bornée. */
const PHRASE =
  /(^|["“] ?|[.!?] )Nos consultants (?:seniors )?(?:viennent (?:de|depuis)|se déplacent[^."]{0,40}depuis|interviennent depuis)[^."]*\.(?= |"|$)/gu;

function nettoyer(ligne) {
  const dejaDit = ligne.includes("partout en France");
  return ligne.replace(PHRASE, (_m, avant, decalage, tout) => {
    if (!dejaDit) return `${avant}${NOUVELLE}`;
    // Retrait pur : on garde le séparateur d'avant, on mange l'espace d'après.
    const fin = decalage + _m.length;
    const seule = avant.startsWith('"') && tout[fin] === '"';
    if (seule) return `${avant}${NOUVELLE}`;
    return avant.startsWith('"') || avant === "" ? avant : avant.slice(0, -1);
  });
}

const fichiers = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts")
  .sort();

let lignesModifiees = 0;
let restantes = 0;
let plein = COMPTER;
const touches = [];
for (const nom of fichiers) {
  const chemin = join(DOSSIER, nom);
  const avant = readFileSync(chemin, "utf8");
  const lignes = avant.split("\n");
  const fautives = lignes.filter((l) => new RegExp(PHRASE.source, "u").test(l)).length;
  if (fautives === 0) continue;
  if (plein || lignesModifiees + fautives > MAX_LIGNES) {
    plein = true; // lot fermé : aucun fichier suivant, pour garder un préfixe alphabétique
    restantes += fautives;
    continue;
  }
  const apres = lignes.map((l, i) => {
    const n = nettoyer(l);
    if (n !== l && DRY_RUN) console.log(`${nom}:${i + 1}\n  - ${l.trim()}\n  + ${n.trim()}`);
    return n;
  });
  lignesModifiees += fautives;
  touches.push(nom);
  if (!DRY_RUN) writeFileSync(chemin, apres.join("\n"));
}

if (!COMPTER) {
  console.log(
    `${touches.length} fichier(s), ${lignesModifiees} ligne(s) ${DRY_RUN ? "à modifier" : "modifiée(s)"}.`,
  );
}
console.log(`Reste après ce lot : ${restantes} ligne(s).`);
