#!/usr/bin/env node
/**
 * Retire, pour le LOT 2 sur 3 de `src/content/villes/copy/*.ts`, les phrases
 * qui font « venir » les consultants d'une ville voisine (fausse présence
 * locale). Axion-IA n'a ni bureau ni consultant basé localement : elle
 * intervient partout en France, sur place ou à distance.
 *
 * Périmètre, borné PAR NOM de fichier (indépendant du nombre de fichiers) :
 * de `gerardmer.ts` (inclus ; le lot 1 s'arrête à `gentilly.ts`) à `parmain.ts`
 * (inclus ; le lot 3 commence à `parthenay.ts`). Les fichiers `_*` et
 * `types.ts` sont exclus. Aucun chevauchement, aucun trou.
 *
 * Règles (phrase par phrase, jamais un fragment) — la phrase est remplacée par
 * « Nous intervenons partout en France, sur place ou à distance. » :
 *   · « Nos consultants / équipes / experts … » (N insensible à la casse) qui
 *     dit « viennent de », « depuis <Ville> », « rejoignent », « sont basés »,
 *     « couvrent » ;
 *   · A : « Consultants depuis <Ville> (n min). » (sans « Nos ») ;
 *   · « Depuis <Ville> (n min)… » et « Depuis <Ville>, nous / nos … » ;
 *   · « depuis nos bureaux », « bureaux proches de » ;
 * et, au niveau du bout de phrase :
 *   · C : « nos experts IA se déplacent depuis <Ville> » → « nous intervenons
 *     partout en France, sur place ou à distance » ; « (N km depuis Paris) »,
 *     « environ N km depuis Paris », « depuis Paris en N min », « depuis le
 *     littoral azuréen », « frais de déplacement depuis <Ville> » : le bout fautif est retiré sans laisser de phrase
 *     orpheline ;
 *   · B : « Comment se passe une mission depuis <Ville> ? » (et variantes
 *     « à <X> depuis <Y> ») → « Comment se déroule une mission à <Ville> ? »,
 *     <Ville> = ville de la page (ligne d'en-tête du fichier), article et
 *     élision corrects (« au Havre », « aux Mureaux »).
 * Si la ligne dit déjà « partout en France », la phrase est retirée (pas de
 * doublon) ; seule dans sa chaîne, elle est remplacée (jamais de chaîne vide).
 *
 * Usage :
 *   node scripts/villes/retirer-fausse-presence-tranche.mjs --dry-run
 *   node scripts/villes/retirer-fausse-presence-tranche.mjs
 *   node scripts/villes/retirer-fausse-presence-tranche.mjs --compter
 *
 * Relecture Opus 2 : « Comment se déroule une mission depuis X ? » (même
 * remplacement que B), « Consultants … depuis X », « Nous arrivons … depuis X »,
 * « Williams se déplace … depuis Paris » et « déplacement rapide depuis Paris ».
 *
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

export const NOUVELLE = "Nous intervenons partout en France, sur place ou à distance.";

/** Une phrase bornée, précédée d'un séparateur (lookbehind). */
const PHRASE_GENERIQUE = /(?<=^|["“] ?|[.!?] )([^."]*\.)(?= |"|$)/gu;

export function estFautive(phrase) {
  if (/^[Nn]os (?:consultants|équipes|experts)\b/u.test(phrase)) {
    return /viennent (?:de|depuis)|depuis (?:[A-ZÉ]|le centre|la gare)|rejoignent|sont basés|couvrent/u.test(
      phrase,
    );
  }
  if (/^Consultants depuis [A-ZÉ]/u.test(phrase)) return true;
  // 2/3 : « Consultants sur place en 10 min depuis Caen centre. », « …disponibilité consultant depuis Paris … ».
  if (/\bconsultants?\b[^.]{0,60}depuis [A-ZÉ]/iu.test(phrase)) return true;
  // 3 : « Nous arrivons en 1h10 depuis Paris-Montparnasse … ».
  if (/^Nous arrivons\b[^.]*depuis/u.test(phrase)) return true;
  // Passe finale : « Déplacement depuis Lille (27 km). », « Accès rapide par RER B depuis Paris. »
  if (/^(?:[Dd]éplacements?|[Aa]ccès rapide)\b[^.]*depuis [A-ZÉ]/u.test(phrase)) return true;
  if (/^[Dd]epuis [A-ZÉ][^()]{0,40}\(/u.test(phrase)) return true;
  if (/^[Dd]epuis [A-ZÉ][^,.]{0,40}, (?:nous|nos)\b/u.test(phrase)) return true;
  return /depuis nos bureaux|bureaux proches de/u.test(phrase);
}

/** Bouts de phrase fautifs (C), traités avant le découpage en phrases. */
const BOUTS_C = [
  // Passe finale : « …, des tarifs publics dès X et des consultants qui se déplacent en tramway T4 ou voiture
  // depuis Paris. » (Les Pavillons-sous-Bois) → seul le segment fautif est remplacé, la liste des cibles reste.
  [
    /, des tarifs publics dès (\{\{[^}]*\}\}) et des consultants qui se déplacent en tramway T4 ou voiture depuis Paris\./gu,
    " et des tarifs publics dès $1. Nous intervenons partout en France, sur place ou à distance.",
  ],
  // Passe finale : « Nos consultants se déplacent sur site depuis Paris pour auditer… » → la finalité est
  // un fait, pas une origine : elle est conservée.
  [
    /\b[Nn]os (?:consultants|équipes|experts)(?: IA)? se déplacent(?: sur site)? depuis [A-ZÉ][\p{L}'’-]*(?: [A-ZÉ][\p{L}'’-]*)*(?: \([^)]*\))? (pour [^.]*)\./gu,
    "Nous intervenons partout en France, sur place ou à distance, $1.",
  ],
  // « …: nos experts IA se déplacent depuis Paris, avec des frais… »
  [
    /\b[Nn]os experts(?: IA)? se déplacent depuis [A-ZÉ][\p{L}'’ -]*?(?=[,.;])/gu,
    "nous intervenons partout en France, sur place ou à distance",
  ],
  // « Oui, nos consultants se déplacent [à X] depuis Paris (…). » → clause entière
  [
    /(?<=[,:;] )nos consultants se déplacent (?:à [^.?"]*? )?depuis [A-ZÉ][^.?"]*\./gu,
    "nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    /nos consultants viennent cadrer sur site depuis [A-ZÉ]\p{L}+ en ≈ \d+ min/gu,
    "nous intervenons partout en France, sur place ou à distance",
  ],
  [/ ?\((?:environ )?\d+ ?km depuis Paris\)/gu, ""],
  [/,? (?:à )?environ \d+ ?km depuis Paris/gu, ""],
  [/ depuis Paris en \d+ ?(?:min(?:utes)?|h)\b/gu, ""],
  [/ depuis le littoral azuréen/gu, ""],
  [/(frais de déplacement) depuis [A-ZÉ][\p{L}-]*/gu, "$1"],
  // 4 : « Williams se déplace [sur site] depuis Paris (3 km…) pour… » → l'origine est retirée,
  // le reste (moyen d'accès, finalité) demeure ; idem « …-t-il à X depuis Paris ? ».
  [/(Williams se déplac[^."?]*?) depuis (?:Paris|notre base nationale)(?: \(\d[^)]*\))?/gu, "$1"],
  // 4 : variantes « Williams intervient / se déplaçant depuis Paris », « déplacement Williams depuis Paris ».
  [/(Williams (?:intervient|se déplaçant)|déplacement Williams) depuis Paris/gu, "$1"],
  // 4 : « Williams prend le RER E depuis Paris (…, environ 35 min depuis Magenta) » (Ozoir).
  [
    /Williams prend le RER E depuis Paris \(([^)]*?), environ 35 min depuis Magenta\)/gu,
    "Williams prend le RER E ($1)",
  ],
  // 4 : « Nous nous déplaçons depuis Martigues vers A, B ainsi que vers Marseille » (Martigues).
  [
    /Nous nous déplaçons depuis Martigues vers ([^"]*?), ainsi que vers Marseille/gu,
    "Nous nous déplaçons à $1, ainsi qu'à Marseille",
  ],
  // 4 : « …, déplacement rapide depuis Paris (16 km). » (Gonesse).
  [/,? déplacement rapide depuis Paris(?: \(\d+ ?km\))?/gu, ""],
];

const NOM = "[A-ZÉ][\\p{L}'’-]*(?: [A-ZÉ][\\p{L}'’-]*)*";
const re = (src, flags = "gu") => new RegExp(src.replaceAll("<NOM>", NOM), flags);

/**
 * Passe finale — règle générale : un texte ne dit jamais que l'équipe, un
 * consultant ou Williams PART d'une ville (« depuis <Ville> »). On retire le
 * segment d'origine, on garde le reste (délai, moyen d'accès, finalité).
 */
const REGLE_GENERALE = [
  // Délai conservé : « Déplacement depuis Lille (27 km) … sous 5 jours ouvrés. »
  [re("\\bDéplacement depuis [^.]*? (sous \\d+ jours ouvrés)"), "Déplacement $1"],
  // Questions de FAQ : « …-t-il à X depuis Paris ? », « Couvrez/Intervenez-vous … depuis Nice ? ».
  [re('(se déplace-t-il à [^"?]*?) depuis Paris(?= ?\\?)'), "$1"],
  [
    re(
      '((?:[Cc]ouvrez|[Ii]ntervenez)-vous [^"?]*?|communes proches (?:couvrez-vous|sont couvertes)) depuis <NOM>(?= ?\\?)',
    ),
    "$1",
  ],
  [re("(pour une intervention) depuis Paris ou la banlieue"), "$1"],
  // Bouts de phrase.
  [re("(On se déplace sur site) depuis <NOM>(?= pour)"), "$1"],
  [re("(sans surcoût de déplacement) depuis <NOM>"), "$1"],
  [re(" \\(déplacement depuis <NOM>\\)"), ""],
  [re("(déplacements?) depuis (?:<NOM>)( est inclus)"), "$1$2"],
  [re(", déplacement (?:rapide )?depuis <NOM>(?: ou <NOM>)?(?=\\.)"), ""],
  [re(", avec déplacements depuis <NOM>[^.]*(?=\\.)"), ""],
  [re("(déplacement très simple) depuis <NOM>"), "$1"],
  [re("(accès direct) depuis <NOM>(?: centre)? (par)"), "$1 $2"],
  [re("(interventions? (?:express|courtes|rapides?)) depuis <NOM>(?: ou <NOM>)?"), "$1"],
  [re("(intervenons [^.]*?visio) depuis <NOM>(?: centre)? \\(\\d+ min\\)"), "$1"],
  [re("(accès rapide) depuis <NOM> (via [^.]*)"), "accès $2"],
  [re("((?:l'|un )accès rapide) depuis [^.]*(?=\\.)"), "$1"],
  [re(",? (?:et )?accès rapide[^.]*? depuis <NOM>[^.]*(?=\\.)"), ""],
  [re(" \\(souvent moins, étant basé à Paris\\)"), ""],
  [re("(itérations à distance) depuis <NOM>(?: \\([^)]*\\))?"), "$1"],
  // Relecture Opus 4 : « Accès / Couverture / accédez-vous / Intervenir … depuis <Ville> ».
  [
    re('Comment accédez-vous à ([^"?]*?) depuis [^"?]*? ?\\?'),
    "Comment se déroule une intervention à $1 ?",
  ],
  [re(" (?:Accès|Couverture) depuis [A-ZÉ][^.]*\\."), ""],
  [re("(Intervenir [^(]*?) \\([^)]*depuis [A-ZÉ][^)]*\\)"), "$1"],
  // EN
  [re("(travel costs) from [A-Z][\\p{L}-]+"), "$1"],
  [
    re("Our consultants travel from Paris \\(([^)]*)\\) across the western Hauts-de-Seine\\."),
    "We work across France, on site or remotely, including the western Hauts-de-Seine ($1).",
  ],
];

function regleGenerale(ligne, ville) {
  let r = ligne;
  for (const [motif, remplacement] of REGLE_GENERALE) r = r.replace(motif, remplacement);
  // « Démos hebdomadaires en visio depuis Lille » : seulement si ce n'est pas la ville de la page (client).
  r = r.replace(re("(Démos hebdomadaires en visio) depuis (<NOM>)"), (m, a, v) =>
    v === ville ? m : a,
  );
  return r;
}

function boutsC(ligne) {
  let r = ligne;
  for (const [motif, remplacement] of BOUTS_C) r = r.replace(motif, remplacement);
  return r;
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

/** Ville de la page, lue sur la 2ᵉ ligne d'en-tête : « // Gisors (27, Eure) — … ». */
export function villeDuFichier(source) {
  const m = /^﻿?\/\/[^\n]*\n\/\/ (.+?) \(/u.exec(source);
  return m ? m[1] : null;
}

/** « à Lyon », « au Havre », « aux Mureaux » (La/L' gardent « à »). */
export function aLaVille(ville) {
  if (/^Le /u.test(ville)) return `au ${ville.slice(3)}`;
  if (/^Les /u.test(ville)) return `aux ${ville.slice(4)}`;
  return `à ${ville}`;
}

const QUESTION_B =
  /Comment se (?:passe|déroule|deroule) une (mission|intervention)(?: Axion-IA| IA)?[^"?]*? depuis [^"?]*\?/gu;

export function questionB(ligne, ville) {
  if (!ville) return ligne;
  return ligne.replace(
    QUESTION_B,
    (_m, nom) => `Comment se déroule une ${nom} ${aLaVille(ville)} ?`,
  );
}

export function nettoyerLigne(ligne, ville = null) {
  const base = regleGenerale(finaliser(nettoyer(boutsC(questionB(ligne, ville)))), ville);
  if (base === ligne) return ligne;
  return base.replace(APRES_NOUVELLE, (m, nouvelle, suite) =>
    ORPHELIN.test(suite) ? nouvelle : m,
  );
}

export const PREMIER = "gerardmer.ts";
export const SUIVANT = "parthenay.ts";
export const TRANCHE = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts" && !nom.startsWith("_"))
  .sort()
  .filter((nom) => nom >= PREMIER && nom < SUIVANT);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let lignes = 0;
  const touches = [];
  for (const nom of TRANCHE) {
    const chemin = join(DOSSIER, nom);
    const source = readFileSync(chemin, "utf8");
    const ville = villeDuFichier(source);
    const avant = source.split("\n");
    const apres = avant.map((l, i) => {
      const n = nettoyerLigne(l, ville);
      if (n !== l) {
        lignes += 1;
        if (DRY_RUN) console.log(`${nom}:${i + 1}\n  - ${l.trim()}\n  + ${n.trim()}`);
      }
      return n;
    });
    if (apres.join("\n") !== source) {
      touches.push(nom);
      if (!DRY_RUN && !COMPTER) writeFileSync(chemin, apres.join("\n"));
    }
  }
  console.log(
    `Lot 2/3 : ${TRANCHE.length} fichiers (${TRANCHE[0]} → ${TRANCHE.at(-1)}) ; ${touches.length} fichier(s), ${lignes} ligne(s) ${DRY_RUN || COMPTER ? "à modifier" : "modifiée(s)"}.`,
  );
}
