/**
 * Scanner de FAUSSE PRÉSENCE LOCALE dans `src/content/villes/copy/*.ts`.
 *
 * Axion-IA n'a aucun bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Ce scanner est un OUTIL de
 * lecture seule : il ne modifie aucun contenu. Il sort un CSV
 *   fichier;ligne;motif;extrait;verdict
 * pour toute phrase qui laisse croire à une présence locale.
 *
 * Verdicts :
 *   · FAUTIF       : la phrase affirme une présence/base/agence/consultants locaux.
 *   · A_VERIFIER   : formulation ambiguë (ex. « à deux pas », « en métro »), à
 *                    relire : elle peut décrire la ville et non Axion-IA.
 *
 * LISTE BLANCHE (documentée) : avant toute détection, ces formulations neutres
 * sont masquées (remplacées par des blancs de même longueur, les colonnes ne
 * bougent pas) :
 *   · « Nous intervenons partout en France, sur place ou à distance » ;
 *   · « partout en France » ;
 *   · « sur place ou à distance » / « sur place et à distance » ;
 *   · « à distance ou sur place » / « à distance et sur place ».
 *
 * Limite assumée : analyse PAR LIGNE. Une phrase coupée sur deux lignes n'est
 * pas vue ; les fichiers de copy gardent leurs chaînes sur une ligne (prettier).
 *
 * Usage :
 *   pnpm exec tsx scripts/villes/scan-fausse-presence.ts [dossier] [--sortie=fichier.csv] [--strict]
 * Sans argument : `src/content/villes/copy` (résolu depuis le script). Le
 * résumé (nombre par motif) est écrit sur stderr. `--strict` : code 1 s'il
 * reste au moins un FAUTIF.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Verdict = "FAUTIF" | "A_VERIFIER";

export interface Detection {
  fichier: string;
  ligne: number;
  motif: string;
  extrait: string;
  verdict: Verdict;
}

/** Plie accents/apostrophes SANS changer la longueur (colonnes conservées). */
export function plier(s: string): string {
  let out = "";
  for (const c of s) {
    const base = c.normalize("NFD")[0] ?? c;
    out += base === "’" || base === "‘" ? "'" : base;
  }
  return out;
}

const LISTE_BLANCHE: RegExp[] = [
  /nous intervenons partout en france(?:,\s*sur place (?:ou|et) a distance)?/gi,
  /partout en france/gi,
  /sur place (?:ou|et) a distance/gi,
  /a distance (?:ou|et) sur place/gi,
];

export function masquerListeBlanche(plie: string): string {
  let t = plie;
  for (const re of LISTE_BLANCHE) {
    t = t.replace(re, (m) => " ".repeat(m.length));
  }
  return t;
}

const NOMBRE = "(?:\\d+|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze|vingt|trente)";
const CONTEXTE_NOUS = /\b(?:nous|notre|nos|williams|consultants?|equipes?)\b/i;
const VERBE_PRESENCE =
  /(?:interven|venon|vien|part|travaill|oper|rayonn|deplac|consultant|equipe|nous)/i;

interface Regle {
  motif: string;
  re: RegExp;
  verdict: Verdict | ((ligne: string, index: number) => Verdict);
}

const REGLES: Regle[] = [
  {
    motif: "depuis <Ville>",
    re: /\b[Dd]epuis\s+(?!Janvier|Fevrier|Mars|Avril|Mai|Juin|Juillet|Aout|Septembre|Octobre|Novembre|Decembre|Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)[A-Z][\p{L}'-]+/gu,
    verdict: (ligne, i) =>
      VERBE_PRESENCE.test(ligne.slice(Math.max(0, i - 45), i)) ? "FAUTIF" : "A_VERIFIER",
  },
  { motif: "base(e)(s) à <Ville>", re: /\bbase(?:es|e|s)?\s+a\s+[A-Z]/g, verdict: "FAUTIF" },
  { motif: "notre base", re: /\bnotre\s+base\b/gi, verdict: "FAUTIF" },
  {
    motif: "nos consultants sont/viennent",
    re: /\bnos\s+consultants\s+(?:sont|viennent)\b/gi,
    verdict: "FAUTIF",
  },
  {
    motif: "à N min de",
    re: new RegExp(
      `\\b(?:(?:est|sont|se\\s+trouvons?|se\\s+trouvent|se\\s+trouve)\\s+)?a\\s+(?:environ\\s+|pres\\s+de\\s+|moins\\s+de\\s+|seulement\\s+|a\\s+peine\\s+)?${NOMBRE}\\s*(?:min\\b|minutes?\\b|h\\b(?:\\s*\\d+)?|heures?\\b)\\s+(?:de\\b|du\\b|des\\b|d')`,
      "gi",
    ),
    verdict: (ligne) => (CONTEXTE_NOUS.test(ligne) ? "FAUTIF" : "A_VERIFIER"),
  },
  { motif: "proche de nous", re: /\bproches?\s+de\s+nous\b/gi, verdict: "FAUTIF" },
  {
    motif: "notre agence/bureau/antenne",
    re: /\b(?:notre\s+(?:agence|bureau|antenne|local)|nos\s+(?:agences|bureaux|antennes|locaux))\b/gi,
    verdict: "FAUTIF",
  },
  {
    motif: "en métro/RER/tram/bus ligne",
    re: /\b(?:en\s+(?:metro|rer|tram|tramway|bus)\b(?:\s+ligne\b)?|(?:metro|rer|tram|tramway|bus)\s+ligne\b)/gi,
    verdict: (ligne) => (/\bligne\b/i.test(ligne) ? "FAUTIF" : "A_VERIFIER"),
  },
  {
    motif: "Williams se déplace",
    re: /\bwilliams\s+(?:se\s+deplace(?:ra|nt)?|vient|debarque|passe)\b/gi,
    verdict: "FAUTIF",
  },
  {
    motif: "sur place à <Ville> en N min",
    re: new RegExp(
      `\\b[Ss]ur\\s+[Pp]lace\\s+a\\s+[A-Z][\\p{L}'-]+[^.;]*?\\ben\\s+${NOMBRE}\\s*(?:min\\b|minutes?\\b)`,
      "gu",
    ),
    verdict: "FAUTIF",
  },
  {
    motif: "sur place à <Ville>",
    re: /\b[Ss]ur\s+[Pp]lace\s+a\s+[A-Z][\p{L}'-]+/gu,
    verdict: "A_VERIFIER",
  },
  { motif: "à deux pas", re: /\ba\s+deux\s+pas\b/gi, verdict: "A_VERIFIER" },
];

/** Détections d'un texte, ligne par ligne. */
export function scannerTexte(contenu: string, fichier: string): Detection[] {
  const res: Detection[] = [];
  const lignes = contenu.split(/\r?\n/);
  lignes.forEach((brute, idx) => {
    const plie = masquerListeBlanche(plier(brute));
    const vus = new Set<string>();
    for (const regle of REGLES) {
      regle.re.lastIndex = 0;
      for (const m of plie.matchAll(regle.re)) {
        const i = m.index ?? 0;
        const cle = `${regle.motif}@${i}`;
        if (vus.has(cle)) continue;
        vus.add(cle);
        const verdict =
          typeof regle.verdict === "function" ? regle.verdict(plie, i) : regle.verdict;
        const debut = Math.max(0, i - 60);
        const extrait = brute.slice(debut, i + m[0].length + 60).trim();
        res.push({ fichier, ligne: idx + 1, motif: regle.motif, extrait, verdict });
      }
    }
  });
  return res;
}

function champCsv(v: string | number): string {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function versCsv(detections: Detection[]): string {
  const lignes = ["fichier;ligne;motif;extrait;verdict"];
  for (const d of detections) {
    lignes.push([d.fichier, d.ligne, d.motif, d.extrait, d.verdict].map(champCsv).join(";"));
  }
  return lignes.join("\n") + "\n";
}

export function compterParMotif(
  detections: Detection[],
): Map<string, { FAUTIF: number; A_VERIFIER: number }> {
  const m = new Map<string, { FAUTIF: number; A_VERIFIER: number }>();
  for (const d of detections) {
    const c = m.get(d.motif) ?? { FAUTIF: 0, A_VERIFIER: 0 };
    c[d.verdict] += 1;
    m.set(d.motif, c);
  }
  return m;
}

export function scannerDossier(dossier: string): Detection[] {
  const out: Detection[] = [];
  const fichiers = readdirSync(dossier)
    .filter((f) => f.endsWith(".ts") && !f.startsWith("_"))
    .sort();
  for (const f of fichiers) {
    out.push(...scannerTexte(readFileSync(join(dossier, f), "utf8"), f));
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const sortie = args.find((a) => a.startsWith("--sortie="))?.slice(9);
  const strict = args.includes("--strict");
  const dossierArg = args.find((a) => !a.startsWith("--"));
  const defaut = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/content/villes/copy");
  const dossier = dossierArg ? resolve(dossierArg) : defaut;
  const detections = scannerDossier(dossier);
  const csv = versCsv(detections);
  if (sortie) writeFileSync(sortie, csv);
  else process.stdout.write(csv);
  const f = detections.filter((d) => d.verdict === "FAUTIF").length;
  process.stderr.write(
    `Résumé : ${detections.length} détection(s), ${f} FAUTIF, ${detections.length - f} A_VERIFIER\n`,
  );
  for (const [motif, c] of compterParMotif(detections)) {
    process.stderr.write(`  ${motif} : FAUTIF ${c.FAUTIF}, A_VERIFIER ${c.A_VERIFIER}\n`);
  }
  if (strict && f > 0) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
