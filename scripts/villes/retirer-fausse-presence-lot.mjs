#!/usr/bin/env node
/**
 * Retire la fausse présence locale des textes `src/content/villes/copy/*.ts`,
 * LOT 1 SUR 3, borné PAR NOM DE FICHIER (abbeville.ts incluse → gentilly.ts
 * exclue). Les bornes ne dépendent plus du nombre de fichiers : ajouter une
 * ville ne déplace plus la frontière entre les lots, et aucun fichier n'est
 * traité par deux lots (le lot 2 commence à gentilly.ts).
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Phrases traitées, PHRASE PAR
 * PHRASE (jamais un fragment), remplacées par `NOUVELLE` — ou retirées si la
 * ligne dit déjà « partout en France » :
 *   · « Nos consultants/équipes/experts (IA) viennent de X », « interviennent
 *     (à X) depuis Y », « rejoignent X … », « couvrent … depuis Y »,
 *     « se déplacent … depuis Y », « sont basés … » (ainsi que « Notre équipe »
 *     et « Williams » quand ils « se déplacent … depuis ») ;
 *   · A · « Consultants depuis <Ville> (n min). » (sans « Nos ») ;
 *   · la phrase autonome « Depuis <Ville> (n min). » ;
 *   · B · la question « Comment se passe/déroule une mission … depuis <Ville> ? »
 *     devient « Comment se déroule une mission à <Ville> ? » (au / aux / à) ;
 *   · C · « Depuis Paris, nous rejoignons X… », « …rejoignent le site depuis
 *     Paris-Montparnasse », « — environ N km depuis Paris… ».
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

/** Bornes du lot 1, par NOM de fichier : [DEBUT, FIN[ (FIN exclue = début du lot 2). */
export const DEBUT = "abbeville.ts";
export const FIN_EXCLUE = "gentilly.ts";

const FIN = String.raw`[^."]*\.(?= |"|$)`;
const SUJET = String.raw`[Nn]os (?:consultants|équipes|experts)(?: IA)?(?: seniors)? `;
const VERBE = String.raw`(?:viennent (?:de|depuis|via)|rejoignent|sont basés?|[^."]{0,100}\bdepuis (?:[A-ZÉ]|la gare|le centre|l['’]))`;
export const PHRASE_PRESENCE = new RegExp(
  String.raw`(^ *|["“] ?|[.!?] |Oui, )${SUJET}${VERBE}${FIN}`,
  "gu",
);
export const PHRASE_DEPUIS = new RegExp(
  String.raw`(^ *|["“] ?|[.!?] )[Dd]epuis [A-ZÉ][^."()]{1,40}\(\d+ ?(?:h ?\d*|min)[^."()]*\)\.(?= |"|$)`,
  "gu",
);
/** A · « Consultants depuis <Ville> (n min) ou … (n min). » (sans « Nos »). */
export const PHRASE_CONSULTANTS_DEPUIS = new RegExp(
  String.raw`(^ *|["“] ?|[.!?] )[Cc]onsultants depuis ${FIN}`,
  "gu",
);
/** C · « Depuis Paris, nous rejoignons Cergy en RER A … ». */
export const PHRASE_DEPUIS_NOUS_REJOIGNONS = new RegExp(
  String.raw`(^ *|["“] ?|[.!?] )[Dd]epuis [A-ZÉ][^."(),]{1,40}, nous rejoignons ${FIN}`,
  "gu",
);
/** C · « Notre équipe / Williams se déplace … depuis Paris en 25 minutes … ». */
export const PHRASE_PARIS_EN_MINUTES = new RegExp(
  String.raw`(^ *|["“] ?|[.!?] )(?:[Nn]otre équipe|Williams) se déplace[^."]{0,40}depuis Paris en \d+ ?min${FIN}`,
  "gu",
);
/** C · bouts de phrase à retirer sans toucher au reste de la phrase. */
export const BOUTS = [
  // « …; nos consultants rejoignent le site depuis Paris-Montparnasse via Angers ou Nantes. »
  / ?; [Nn]os (?:consultants|experts)(?: IA)? rejoignent le site depuis [^."]*(?=\.)/gu,
  // « …mise en route — environ 10 km depuis Paris via T1, T2. »
  / [—–-] environ \d+ ?km depuis [A-ZÉ][^."]*(?=\.)/gu,
];

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

/** B · « Comment se passe/déroule une mission [IA|Axion-IA] [à X] depuis … ? » */
export const QUESTION_MISSION_DEPUIS =
  /"Comment se (?:passe|déroule) une mission((?: IA| Axion-IA| transfrontalière)?(?: à [^"?]+?| en Corse)?) depuis [^"]*\?"/gu;

/** « Abbeville » → « à Abbeville » ; « Le Havre » → « au Havre » ; « Les Mureaux » → « aux Mureaux ». */
export function aLaVille(nom) {
  if (/^Le /u.test(nom)) return `au ${nom.slice(3)}`;
  if (/^Les /u.test(nom)) return `aux ${nom.slice(4)}`;
  return `à ${nom}`;
}

/** Nom de la ville, lu dans le commentaire d'en-tête « // <Ville> (80, Somme) … ». */
export function nomVille(texte) {
  return /^\/\/ (.+?) \(\d[\dAB]*[,)]/mu.exec(texte)?.[1] ?? null;
}

function reecrireQuestion(ligne, ville) {
  return ligne.replace(QUESTION_MISSION_DEPUIS, (m, milieu) => {
    if (/ (?:à|en) /u.test(milieu)) return `"Comment se déroule une mission${milieu} ?"`;
    if (!ville) return m;
    return `"Comment se déroule une mission${milieu} ${aLaVille(ville)} ?"`;
  });
}

function nettoyer(ligne, ville) {
  const dejaDit = ligne.includes("partout en France");
  const remplace = (_m, avantBrut, decalage, tout) => {
    const avant = avantBrut === "Oui, " ? "Oui. " : avantBrut;
    if (!dejaDit) return `${avant}${NOUVELLE}`;
    const seule = avant.startsWith('"') && tout[decalage + _m.length] === '"';
    if (seule) return `${avant}${NOUVELLE}`;
    return avant.startsWith('"') || avant.trim() === "" ? avant : avant.slice(0, -1);
  };
  let l = reecrireQuestion(ligne, ville);
  l = l
    .replace(PHRASE_PRESENCE, remplace)
    .replace(PHRASE_DEPUIS, remplace)
    .replace(PHRASE_CONSULTANTS_DEPUIS, remplace)
    .replace(PHRASE_DEPUIS_NOUS_REJOIGNONS, remplace)
    .replace(PHRASE_PARIS_EN_MINUTES, remplace);
  for (const b of BOUTS) l = l.replace(b, "");
  for (const o of ORPHELINS) l = l.replace(o, "");
  return l.replace(/ (?=")/g, (m, i, t) => (t[i - 1] === "." ? "" : m));
}

export function tranche() {
  return readdirSync(DOSSIER)
    .filter((n) => n.endsWith(".ts") && n !== "types.ts" && !n.startsWith("_"))
    .sort()
    .filter((n) => n >= DEBUT && n < FIN_EXCLUE);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let lignes = 0;
  let fichiers = 0;
  for (const nom of tranche()) {
    const chemin = join(DOSSIER, nom);
    const texte = readFileSync(chemin, "utf8");
    const ville = nomVille(texte);
    const avant = texte.split("\n");
    const apres = avant.map((l, i) => {
      const n = nettoyer(l, ville);
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
