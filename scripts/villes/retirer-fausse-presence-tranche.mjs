#!/usr/bin/env node
/**
 * Retire, pour UNE TRANCHE alphabétique (k sur 3) de
 * `src/content/villes/copy/*.ts`, les phrases qui font « venir » les
 * consultants d'une ville voisine (fausse présence locale). Axion-IA n'a ni
 * bureau ni consultant basé localement : elle intervient partout en France,
 * sur place ou à distance.
 *
 * Tranche : fichiers triés par nom, indices [(k-1)·N/3 ; k·N/3[ (N = nombre de
 * fichiers hors `types.ts`). Défaut : k = 2 (lot 2 sur 3).
 *
 * Règle PHRASE PAR PHRASE (jamais un fragment) : une phrase (début de chaîne,
 * ou après « . ! ? » ou un guillemet ; fin au point suivi d'une espace, d'un
 * guillemet ou de la fin de ligne) est remplacée par
 * « Nous intervenons partout en France, sur place ou à distance. » quand :
 *   · elle commence par « Nos consultants / équipes / experts » ET dit
 *     « viennent de », « depuis <Ville> », « rejoignent », « sont basés »,
 *     « interviennent à X depuis Y » ou « couvrent … depuis Y » ;
 *   · elle est la phrase autonome « Depuis <Ville> (n min)… » ;
 *   · elle contient « depuis nos bureaux » ou « bureaux proches de ».
 * Si la ligne dit déjà « partout en France », la phrase est retirée (pas de
 * doublon) ; seule dans sa chaîne, elle est remplacée (jamais de chaîne vide).
 *
 * Usage :
 *   node scripts/villes/retirer-fausse-presence-tranche.mjs --dry-run
 *   node scripts/villes/retirer-fausse-presence-tranche.mjs [--tranche=2]
 *   node scripts/villes/retirer-fausse-presence-tranche.mjs --compter
 *
 * Plafond de lot : `--max-lignes=390` (défaut) pour tenir sous ~800 lignes de diff ;
 * les fichiers sont pris en préfixe alphabétique.
 * Idempotent. Verrouillé par `tests/unit/content/villes-tranche-2-sans-fausse-presence.spec.ts`.
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
const ARG_K = process.argv.find((a) => a.startsWith("--tranche="));
const K = ARG_K ? Number(ARG_K.slice("--tranche=".length)) : 2;

const ARG_MAX = process.argv.find((a) => a.startsWith("--max-lignes="));
const MAX_LIGNES = ARG_MAX ? Number(ARG_MAX.slice("--max-lignes=".length)) : 390;

export const NOUVELLE = "Nous intervenons partout en France, sur place ou à distance.";

/** Une phrase bornée, précédée d'un séparateur (lookbehind). */
const PHRASE_GENERIQUE = /(?<=^|["“] ?|[.!?] )([^."]*\.)(?= |"|$)/gu;

export function estFautive(phrase) {
  if (/^Nos (?:consultants|équipes|experts)\b/u.test(phrase)) {
    return /viennent (?:de|depuis)|depuis [A-ZÉ]|rejoignent|sont basés|couvrent/u.test(phrase);
  }
  if (/^Depuis [A-ZÉ][^()]{0,40}\(/u.test(phrase)) return true;
  return /depuis nos bureaux|bureaux proches de/u.test(phrase);
}

export function nettoyer(ligne) {
  const dejaDit = ligne.includes("partout en France");
  return ligne.replace(PHRASE_GENERIQUE, (m, _p, decalage, tout) => {
    if (!estFautive(m)) return m;
    const avant = tout.slice(0, decalage);
    if (!dejaDit) return NOUVELLE;
    // Retrait pur : phrase seule dans sa chaîne → remplacée ; sinon on mange
    // l'espace qui la suit (ou celle qui la précède si elle est en fin).
    const seule = /["“] ?$/u.test(avant) && tout[decalage + m.length] === '"';
    if (seule) return NOUVELLE;
    return tout[decalage + m.length] === " " ? "\u0000SUIV" : "\u0000PREC";
  });
}

/** Résout les marqueurs de retrait (espace voisine mangée). */
function finaliser(ligne) {
  return ligne.replace(/\u0000SUIV /gu, "").replace(/ ?\u0000PREC/gu, "");
}

/**
 * Bout orphelin laissé par le remplacement : « Lens est à 5 min. »,
 * « Saint-Alban-Leysse à 3 min. », « Déplacements quotidiens sans surcoût… ».
 * Les gares, aéroports et RER/TER restent (information logistique réelle).
 */
const ORPHELIN =
  /^(?!(?:La |Les |L'|Gare|Aéroport|Aeroport|Orly|Roissy)|[^.]*(?:gare|aéroport|RER|TER|TGV|Orly)\b)(?:[A-ZÉ][^.]{0,50} (?:est )?à \d+ ?(?:min|minutes|km)(?: de [A-ZÉ][^.]{0,30})?|[^.]{0,80}[Dd]éplacements? quotidiens?[^.]{0,80})\./u;
const APRES_NOUVELLE = new RegExp(
  `(${NOUVELLE.replace(/[.]/g, "\\.")}) ([^."]*\\.)(?= |"|$)`,
  "gu",
);

export function nettoyerLigne(ligne) {
  const base = finaliser(nettoyer(ligne));
  if (base === ligne) return ligne;
  return base.replace(APRES_NOUVELLE, (m, nouvelle, suite) =>
    ORPHELIN.test(suite) ? nouvelle : m,
  );
}

const tous = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts")
  .sort();
const N = tous.length;
export const TRANCHE = tous.slice(Math.floor(((K - 1) * N) / 3), Math.floor((K * N) / 3));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let lignes = 0;
  let reste = 0;
  let plein = false;
  const touches = [];
  for (const nom of TRANCHE) {
    const chemin = join(DOSSIER, nom);
    const avant = readFileSync(chemin, "utf8").split("\n");
    const n = avant.filter((l) => nettoyerLigne(l) !== l).length;
    if (n === 0) continue;
    if (plein || lignes + n > MAX_LIGNES) {
      plein = true; // lot fermé : préfixe alphabétique, pour que le cliquet reste net
      reste += n;
      continue;
    }
    const apres = avant.map((l, i) => {
      const n = nettoyerLigne(l);
      if (n !== l) {
        lignes += 1;
        if (DRY_RUN) console.log(`${nom}:${i + 1}\n  - ${l.trim()}\n  + ${n.trim()}`);
      }
      return n;
    });
    if (apres.join("\n") !== avant.join("\n")) {
      touches.push(nom);
      if (!DRY_RUN && !COMPTER) writeFileSync(chemin, apres.join("\n"));
    }
  }
  console.log(
    `Reste hors lot : ${reste} ligne(s). Tranche ${K}/3 : ${TRANCHE.length} fichiers (${TRANCHE[0]} → ${TRANCHE.at(-1)}) ; ${touches.length} fichier(s), ${lignes} ligne(s) ${DRY_RUN || COMPTER ? "à modifier" : "modifiée(s)"}.`,
  );
}
