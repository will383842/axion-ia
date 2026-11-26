#!/usr/bin/env node
/**
 * Retire des pages villes tout trajet, toute origine géographique de l'équipe et toute
 * durée d'accès : « Nos consultants se déplacent / accèdent / viennent via <gare,
 * autoroute> », « Consultants via … », « Depuis <Ville> (N min). », « Depuis Paris, nous
 * rejoignons… », « Depuis <Ville>, nous couvrons… ». Les phrases retirées sont remplacées
 * (si la ligne n'a plus de phrase d'intervention) par la formule neutre
 * « Nous intervenons dans vos locaux à <Ville>, partout en France. ».
 * Les questions de FAQ qui supposent une base ailleurs deviennent « Intervenez-vous à
 * <Ville> ? », avec une réponse générique. Lignes de commentaire ignorées.
 *
 * Usage : node scripts/villes/retirer-trajets-et-origine.mjs [--dry-run]
 * Verrouillé par src/content/villes/__tests__/villes-sans-frais-ni-fausse-presence.spec.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "content",
  "villes",
  "copy",
);
const DRY = process.argv.includes("--dry-run");

const TRAJET = [
  /^(?:Oui\.? )?(?:[Nn]os |[Nn]otre )?(?:[Cc]onsultants?|[Ii]ntervenants?|équipe)\b.*\b(?:via|accèdent|accessibles?|arrivent (?:via|par|facilement|directement|en gare|en \d)|se déplacent (?:via|par|à)|viennent|par la route|interviennent via|sont à)\b/u,
  /\b[Nn]os consultants accèdent\b/u,
  /nous rejoignons/u,
  /^Depuis [A-ZÉ]/u,
  /^(?:Oui\.? )?[Nn]ous (?:venons|nous déplaçons|arrivons|intervenons|couvrons)\b[^.]*\bvia\b/u,
  /^Nous venons sur site via/u,
  /^Nous intervenons à [^,.]+, desservie par/u,
  /^(?:Notre équipe|Nos équipes) se déplace[^.]*\b(?:via|depuis)\b/u,
  /^Notre équipe se déplace sur site à [^.]*\. L['’]accès depuis/u,
];
/** Phrases de réponse de FAQ (`a:`) : desserte, accès par un moyen de transport, durées d'accès. */
const TRAJET_FAQ = [
  /\b(?:[Aa]ccès|accessible|[Dd]esserte|desservi\w*)\b[^.]*\b(?:via|par|depuis|direct\w*|rapide|RER|TGV|TER|gare|tram\w*|métro|A\d{1,3}|autoroute|aéroport)\b/u,
  /\b(?:RER|TGV|TER|gare|aéroport|tram\w*|métro|autoroute|A\d{1,3}|RN ?\d+)\b[^.]*(?:(?<![\p{L}\d])à \d+ ?(?:min|h)|\(\d+ ?(?:min|h)|nous permet|permettent|facilit)/u,
  /^(?!.*(?:devis|séance|audit|livrable|atelier|sous \d)).*(?:(?<![\p{L}\d])(?:à|est à|sont à|en) \d+ ?(?:min\b|minutes|km)|(?<![\p{L}\d])(?:à|est à|sont à) \d+ ?h\d*\b|\(\d+ ?(?:min|h\d*)[^)]*\))/u,
  /(?:rejoindre|venues?|venir)[^.]*depuis [A-ZÉ]/u,
  /^(?:Gare|Aéroport|Proche (?:de l['’])?(?:aéroport|gare)|Proximité (?:directe )?(?:de l['’])?(?:aéroport|gare|Roissy|Orly))\b/u,
];
TRAJET.push(
  /\b(?:Williams|[Nn]os consultants|[Nn]otre équipe)\b[^.]{0,60}\b(?:prenn?ent|prend) (?:le |l['’])?(?:TGV|train|avion|RER)/u,
  /\b(?:Williams|[Nn]os consultants|[Nn]otre équipe) se déplace(?:nt)?\b[^.]{0,80}\b(?:via|par le (?:train|RER|TGV)|grâce au)\b/u,
  /^(?:Oui\.? )?Déplacement[^.]{0,60}\b(?:via|en \d|depuis|grâce)\b/u,
);
const DUREE = /\d+ ?(?:min|h)\b|\dh\d{0,2}\b/u;
const INTERVENTION = /interv(?:en|ient)|venons|déplaçons|sur site|locaux/u;

function nomVille(src) {
  const m = src.match(
    /intervient (à|au|aux|en) ((?:L['’]|Le |La |Les )?[A-ZÉ][^(.,\n"]{1,40}?)(?: \(|[.,]| et | dans |")/u,
  );
  if (!m || /[\d?]|commune|habitants|\s(?:pour|auprès|sur|les|des|aux)\s/u.test(m[2])) return null;
  return `${m[1]} ${m[2].trim()}`;
}

const STRING_LINE = /^(\s*(?:a: |q: )?)"((?:[^"\\]|\\.)*)"(,?)$/u;

/** Contenu métier : une phrase qui promet un livrable n'est jamais retirée par les règles de FAQ. */
const PROTEGE =
  /accompagn|nous déployons|on (?:livre|développe|construit)|nous livrons|nous développons/u;
/** Durées d'accès en ligne : « (Metz à 25 min) », « Mantes-la-Jolie à 10 min ». */
const DUREES_EN_LIGNE = [
  /\s*\([^()]{0,60}?\d+ ?(?:min|h\d*|km)\b[^()]{0,40}\)/gu,
  /(?<![\p{L}\d])(?:à environ|à|en) \d+(?:[.,]\d+)? ?(?:min(?:utes)?|h ?\d*|km)\b(?: (?:de|du|des|d['’])[^,.;)]{0,30})?/gu,
];
const SANS_DUREE = /devis|séance|audit|livrable|atelier|sous \d|jours|délai/u;

function traiterTexte(texte, lieu, avecNeutre) {
  if (/\b(?:Yes|We |Our |The |Axion-IA's)\b/u.test(texte)) return texte; // texte anglais : EN désactivé, hors périmètre
  const protege = texte.replace(/\b(?:[A-Z]\.){2,}/gu, (m) => m.replaceAll(".", "\u0001"));
  const phrases = protege.split(/(?<=[.!?])\s+(?=[A-ZÉÀÂ«"])/u);
  const gardees = [];
  let apresRetrait = false;
  let change = false;
  for (const p of phrases) {
    const regles = avecNeutre && !PROTEGE.test(p) ? [...TRAJET, ...TRAJET_FAQ] : TRAJET;
    if (regles.some((r) => r.test(p))) {
      apresRetrait = true;
      change = true;
      continue;
    }
    if (apresRetrait && p.length < 200 && DUREE.test(p) && !/interv(?:en|ient)|sur site/u.test(p)) {
      change = true;
      continue;
    }
    apresRetrait = false;
    let q = p;
    if (avecNeutre && !SANS_DUREE.test(q)) for (const r of DUREES_EN_LIGNE) q = q.replace(r, "");
    if (q !== p) {
      change = true;
      q = q
        .replace(/ +([,.;])/gu, "$1")
        .replace(/ {2,}/gu, " ")
        .replace(/,\./gu, ".");
    }
    gardees.push(q);
  }
  if (!change) return texte;
  const reste = gardees.filter((p) => !/^Oui\.?$/u.test(p));
  if (reste.length === 0 && !avecNeutre) return texte;
  let sortie;
  if (avecNeutre && (reste.length === 0 || !INTERVENTION.test(gardees.join(" ")))) {
    const neutre = `Nous intervenons dans vos locaux${lieu ? ` ${lieu}` : ""}, partout en France.`;
    const oui = gardees[0] && /^(?:Oui|Non)\b/u.test(gardees[0]);
    sortie = (oui ? [gardees[0], neutre, ...gardees.slice(1)] : [neutre, ...gardees]).join(" ");
  } else sortie = gardees.join(" ");
  return sortie.replaceAll("\u0001", ".");
}

const QUESTION_BASE =
  /^(?:Comment se (?:passe|déroule) une intervention depuis [A-ZÉ][^?]*|Couvrez-vous [^?]*? depuis [A-ZÉ][^?]*|Êtes-vous accessibles[^?]*|Comment (?:accédez-vous à|accéder à|se rendre (?:à|au|aux))[^?]*|Comment [A-ZÉ][^?]* est-elle desservie[^?]*|Quelles communes proches sont couvertes depuis [^?]*|Sous combien de temps intervenez-vous [^?]*? depuis [A-ZÉ][^?]*|Intervenez-vous [^?]*? depuis [A-ZÉ][^?]*)\s*\?$/u;

let modifies = 0;
let lignes = 0;
for (const f of readdirSync(DIR).filter(
  (n) => n.endsWith(".ts") && n !== "types.ts" && !n.startsWith("_"),
)) {
  const chemin = join(DIR, f);
  const src = readFileSync(chemin, "utf8");
  const lieu = nomVille(src);
  const L = src.split("\n");
  for (let i = 0; i < L.length; i++) {
    if (/^\s*(\/\/|\/?\*)/.test(L[i])) continue;
    const m = L[i].match(STRING_LINE);
    if (!m) continue;
    const [, pre, txt, fin] = m;
    if (pre.trim() === "q:" && lieu && QUESTION_BASE.test(txt)) {
      L[i] = `${pre}"Intervenez-vous ${lieu} ?"${fin}`;
      const suiv = L[i + 1]?.match(STRING_LINE);
      if (suiv && suiv[1].trim() === "a:")
        L[i + 1] =
          `${suiv[1]}"Oui. Nous intervenons dans vos locaux ${lieu}, partout en France, sur place ou à distance."${suiv[3]}`;
      lignes++;
      continue;
    }
    if (pre.trim() === "q:") continue;
    let nv = txt.replace(/ entre deux déplacements via l['’]A75 et le Viaduc/u, "");
    nv = traiterTexte(nv, lieu, pre.trim() === "a:");
    if (nv !== txt) {
      L[i] = `${pre}"${nv}"${fin}`;
      lignes++;
    }
  }
  // Questions sur l'accès ou la mission dont la réponse n'est plus que la formule neutre.
  for (let i = 0; i < L.length - 1; i++) {
    const q = L[i].match(STRING_LINE);
    const a = L[i + 1].match(STRING_LINE);
    if (!q || !a || q[1].trim() !== "q:" || a[1].trim() !== "a:") continue;
    const accesEquipe = q[2].match(
      /^(?:Comment (?:se déplace|Axion-IA se déplace|Williams se déplace)[^?]*? ((?:à|au|aux|en) [^?]+?)|Comment [^?]*?(?:est-elle accessible)|(.*)se déplace-t-il[^?]*? ((?:à|au|aux|en) [^?]+?))\s*\?$/u,
    );
    const missionGenerique =
      /^Comment se déroule une mission(?: Axion-IA)? ((?:à|au|aux|en) [^?]+?)\s*\?$/u.exec(q[2]) &&
      /^(?:Oui\. )?Nous intervenons (?:partout en France|dans vos locaux)[^.]*\.(?: Tarifs [^.]*\.)?$/u.test(
        a[2],
      );
    const prep = missionGenerique
      ? /^Comment se déroule une mission(?: Axion-IA)? ((?:à|au|aux|en) [^?]+?)\s*\?$/u.exec(
          q[2],
        )[1]
      : (accesEquipe && (accesEquipe[1] ?? accesEquipe[3])) || lieu;
    if (!missionGenerique && !accesEquipe) continue;
    if (!prep) continue;
    L[i] = `${q[1]}"Intervenez-vous ${prep} ?"${q[3]}`;
    L[i + 1] =
      `${a[1]}"Oui. Nous intervenons dans vos locaux ${prep}, partout en France, sur place ou à distance."${a[3]}`;
    lignes++;
  }
  const out = L.join("\n");
  if (out !== src) {
    modifies++;
    if (!DRY) writeFileSync(chemin, out);
  }
}
console.log(`${modifies} fichiers, ${lignes} lignes${DRY ? " (essai à blanc)" : ""}`);
