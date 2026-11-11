#!/usr/bin/env node
/**
 * Retire la fausse présence locale des textes `src/content/villes/copy/*.ts`,
 * TRANCHE 1 SUR 3 (le premier tiers des fichiers, par ordre alphabétique).
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Phrases traitées, PHRASE PAR
 * PHRASE (jamais un fragment), remplacées par `NOUVELLE` — ou retirées si la
 * ligne dit déjà « partout en France » :
 *   · « Nos consultants/équipes/experts viennent de X », « interviennent
 *     (à X) depuis Y », « rejoignent X … », « couvrent … depuis Y »,
 *     « se déplacent … depuis Y », « sont basés … » ;
 *   · la phrase autonome « Depuis <Ville> (n min). ».
 * Même méthode que `retirer-consultants-viennent-de.mjs` (#1911).
 *
 * Usage :
 *   node scripts/villes/retirer-fausse-presence-lot.mjs --dry-run
 *   node scripts/villes/retirer-fausse-presence-lot.mjs
 *
 * Verrouillé par `tests/unit/content/villes-sans-fausse-presence-lot-1.spec.ts`.
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

export const NOUVELLE = "Nous intervenons partout en France, sur place ou à distance.";

const FIN = String.raw`[^."]*\.(?= |"|$)`;
const SUJET = String.raw`Nos (?:consultants|équipes|experts)(?: seniors)? `;
const VERBE = String.raw`(?:viennent (?:de|depuis)|se déplacent[^."]{0,40}depuis|interviennent (?:à [^."]{0,40} )?depuis|rejoignent|couvrent[^."]{0,80}depuis|sont basés?)`;
export const PHRASE_PRESENCE = new RegExp(
  String.raw`(^ *|["“] ?|[.!?] )${SUJET}${VERBE}${FIN}`,
  "gu",
);
export const PHRASE_DEPUIS = new RegExp(
  String.raw`(^ *|["“] ?|[.!?] )Depuis [A-ZÉ][^."()]{1,40}\(\d+ ?(?:h ?\d*|min)[^."()]*\)\.(?= |"|$)`,
  "gu",
);

/** Bouts orphelins laissés par le remplacement : retirés (jamais remplacés). */
export const ORPHELINS = [
  // « Saint-Alban-Leysse à 3 min. » juste après la phrase de remplacement.
  new RegExp(
    String.raw`(?<=${NOUVELLE.replace(/\./g, "\\.")} )[A-ZÉ][\p{L}'’ -]{2,40} à \d+ ?min\.(?: |(?="|$))`,
    "gu",
  ),
  // « …, déplacements quotidiens sans surcoût hébergement. » (phrase entière).
  /(?<=\. )[^."]*sans surcoût hébergement\.(?: |(?="|$))/gu,
  // « Depuis Bordeaux centre (15 min) ou Paris (TGV 2h). » (phrase autonome).
  /(?<=[.!?] )Depuis [A-ZÉ][^."()]{1,40}\(\d+ ?(?:min|h)[^."()]*\) ou [^."]*\.(?: |(?="|$))/gu,
];

function nettoyer(ligne) {
  const dejaDit = ligne.includes("partout en France");
  const remplace = (_m, avant, decalage, tout) => {
    if (!dejaDit) return `${avant}${NOUVELLE}`;
    const seule = avant.startsWith('"') && tout[decalage + _m.length] === '"';
    if (seule) return `${avant}${NOUVELLE}`;
    return avant.startsWith('"') || avant.trim() === "" ? avant : avant.slice(0, -1);
  };
  let l = ligne.replace(PHRASE_PRESENCE, remplace).replace(PHRASE_DEPUIS, remplace);
  for (const o of ORPHELINS) l = l.replace(o, "");
  return l.replace(/ (?=")/g, (m, i, t) => (t[i - 1] === "." ? "" : m));
}

export function tranche(k) {
  const tous = readdirSync(DOSSIER)
    .filter((n) => n.endsWith(".ts") && n !== "types.ts" && !n.startsWith("_"))
    .sort();
  const N = tous.length;
  return tous.slice(Math.floor(((k - 1) * N) / 3), Math.floor((k * N) / 3));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let lignes = 0;
  let fichiers = 0;
  for (const nom of tranche(1)) {
    const chemin = join(DOSSIER, nom);
    const avant = readFileSync(chemin, "utf8").split("\n");
    const apres = avant.map((l, i) => {
      const n = nettoyer(l);
      if (n !== l) {
        lignes++;
        if (DRY_RUN) console.log(`${nom}:${i + 1}\n  - ${l.trim()}\n  + ${n.trim()}`);
      }
      return n;
    });
    if (apres.join("\n") !== avant.join("\n")) {
      fichiers++;
      if (!DRY_RUN) writeFileSync(chemin, apres.join("\n"));
    }
  }
  console.log(
    `${fichiers} fichier(s), ${lignes} ligne(s) ${DRY_RUN ? "à modifier" : "modifiée(s)"}.`,
  );
}
