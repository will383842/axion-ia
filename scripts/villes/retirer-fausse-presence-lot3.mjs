#!/usr/bin/env node
/**
 * Lot 3 sur 3 des textes de ville `src/content/villes/copy/*.ts` : retire les
 * phrases qui font « venir » ou « intervenir depuis » les consultants d'une
 * autre ville (fausse présence locale), la phrase autonome « Depuis <Ville>
 * (n min). » et les tarifs « From €NNN excl. VAT ».
 *
 * Périmètre : le dernier tiers des fichiers (tri par nom, indice 2N/3 → N),
 * `parthenay.ts` et suivants. Une phrase entière est remplacée par
 * « Nous intervenons partout en France, sur place ou à distance. » (ou retirée
 * si la chaîne le dit déjà : jamais de doublon, jamais de chaîne vide).
 *
 * Usage : node scripts/villes/retirer-fausse-presence-lot3.mjs [--dry-run] [--compter]
 * Verrouillé par `tests/unit/content/villes-lot3-sans-fausse-presence.spec.ts`.
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
export const PREMIER_FICHIER = "parthenay.ts";
export const NOUVELLE = "Nous intervenons partout en France, sur place ou à distance.";

/** Phrase entière, bornée par un début de chaîne ou « . ! ? » et par « . » + espace/guillemet/fin. */
export const PHRASE =
  /(^|["“] ?|[.!?] |, )((?:[Nn]os (?:consultants|équipes|experts)(?: seniors)? [^."]*?(?:\bdepuis\b|\bviennent de\b|\bsont basés\b|\bbasés à\b)[^."]*)|(?:Depuis [A-ZÉ][^."(]{1,40} \(\d+ ?(?:min|h)[^."]*))\.(?= |"|$)/gu;
export const PRIX = /From €\d+ excl\. VAT/gu;

export function nettoyer(ligne) {
  let dejaDit = ligne.includes("partout en France");
  const sansPrix = ligne.replace(PRIX, "Price on request");
  return sansPrix.replace(PHRASE, (m, avant) => {
    const sep = avant === ", " ? ", " : avant;
    if (!dejaDit) {
      dejaDit = true;
      return `${sep === ", " ? ". " : sep}${NOUVELLE}`;
    }
    return avant.startsWith('"') || avant === "" ? avant : avant === ", " ? "" : avant.slice(0, -1);
  });
}

/**
 * Passe finale : RÈGLE GÉNÉRALE (même motif que le test). Aucun texte ne doit laisser
 * croire que l'équipe part d'une ville. Liste blanche : « Vos équipes pilotent l'outil
 * en autonomie depuis <Ville> » (équipes du client), accès du lieu pour le client.
 */
export const REGLE_GENERALE =
  /(?:se déplac|déplacements?|interventions?|consultants?|équipe|experts?|Williams|[Nn]ous|accès rapide|missions?)[^."?]{0,80}depuis (?!le |la |les |l'|son |sa |votre |vos )[A-ZÉ]/u;
export const QUESTION = /Comment se (?:passe|déroule) une (?:mission|intervention)[^"?]* depuis /u;
export const LISTE_BLANCHE = /autonomie depuis|accès direct depuis Roissy/u;

export function residu(ligne) {
  return (REGLE_GENERALE.test(ligne) || QUESTION.test(ligne)) && !LISTE_BLANCHE.test(ligne);
}

const fichiers = readdirSync(DOSSIER)
  .filter((n) => n.endsWith(".ts"))
  .sort();
const tiers = fichiers.slice(Math.floor((2 * fichiers.length) / 3));
let modifs = 0;
const touches = [];
for (const nom of tiers) {
  const chemin = join(DOSSIER, nom);
  const lignes = readFileSync(chemin, "utf8").split("\n");
  const apres = lignes.map((l, i) => {
    const n = nettoyer(l);
    if (n !== l) {
      modifs++;
      if (DRY_RUN) console.log(`${nom}:${i + 1}\n  - ${l.trim()}\n  + ${n.trim()}`);
    }
    return n;
  });
  if (apres.join("\n") !== lignes.join("\n")) {
    touches.push(nom);
    if (!DRY_RUN) writeFileSync(chemin, apres.join("\n"));
  }
}
console.log(
  `${tiers.length} fichiers dans le tiers (dès ${tiers[0]}) ; ${touches.length} touché(s), ${modifs} ligne(s).`,
);

if (process.argv.includes("--verifier")) {
  const restes = tiers.flatMap((nom) =>
    readFileSync(join(DOSSIER, nom), "utf8")
      .split("\n")
      .flatMap((l, i) => (residu(l) ? [`${nom}:${i + 1}`] : [])),
  );
  console.log(`Règle générale : ${restes.length} résidu(s).`, restes.join(" "));
  if (restes.length) process.exitCode = 1;
}
