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
const DUREE = /\d+ ?(?:min|h)\b|\dh\d{0,2}\b/u;
const INTERVENTION = /interv(?:en|ient)|venons|déplaçons|sur site|locaux/u;

function nomVille(src) {
  const m = src.match(
    /intervient (à|au|aux|en) ((?:L['’]|Le |La |Les )?[A-ZÉ][^(.,\n"]{1,40}?)(?: \(|[.,]| et | dans |")/u,
  );
  if (!m || /[\d?]|commune|habitants/u.test(m[2])) return null;
  return `${m[1]} ${m[2].trim()}`;
}

const STRING_LINE = /^(\s*(?:a: |q: )?)"((?:[^"\\]|\\.)*)"(,?)$/u;

function traiterTexte(texte, lieu, avecNeutre) {
  const phrases = texte.split(/(?<=[.!?])\s+(?=[A-ZÉÀÂ«"])/u);
  const gardees = [];
  let apresRetrait = false;
  for (const p of phrases) {
    if (TRAJET.some((r) => r.test(p))) {
      apresRetrait = true;
      continue;
    }
    if (apresRetrait && p.length < 200 && DUREE.test(p) && !/interv(?:en|ient)|sur site/u.test(p))
      continue;
    apresRetrait = false;
    gardees.push(p);
  }
  if (gardees.length === phrases.length) return texte;
  const reste = gardees.filter((p) => !/^Oui\.?$/u.test(p));
  if (reste.length === 0 && !avecNeutre) return texte;
  let sortie = gardees.join(" ");
  if (avecNeutre && (reste.length === 0 || !INTERVENTION.test(sortie))) {
    const neutre = `Nous intervenons dans vos locaux${lieu ? ` ${lieu}` : ""}, partout en France.`;
    const oui = gardees[0] && /^Oui\.?$/u.test(gardees[0]);
    sortie = [oui ? "Oui." : null, neutre, ...(oui ? gardees.slice(1) : gardees)]
      .filter(Boolean)
      .join(" ");
  }
  return sortie;
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
  const out = L.join("\n");
  if (out !== src) {
    modifies++;
    if (!DRY) writeFileSync(chemin, out);
  }
}
console.log(`${modifies} fichiers, ${lignes} lignes${DRY ? " (essai à blanc)" : ""}`);
