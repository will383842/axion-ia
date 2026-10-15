// Banc @formateurs — vérification n° 2, regard du FORMATEUR NOVICE : LIRE ce qu'il reçoit.
//
// Trois outils, purs (aucun appel réseau, aucune base) :
//   · `routeExiste(url)` : une adresse du site mène-t-elle à une page ou une route RÉELLE
//     de `src/app` ? Les segments `[x]` acceptent tout ; les groupes `(x)` sont
//     transparents ; un attrape-tout `[...x]` ne compte PAS (il sert la page 404) ;
//   · `problemesDuTexte(texte)` : anglais, technique, crochet non rempli, mot du salariat ;
//   · `liensDe(html)` : les adresses des liens d'un e-mail.

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const APP = path.join(RACINE, "src/app");

/** Hôtes du site (adresse publique de production, et celle du banc). */
const HOTES_DU_SITE = new Set(["axion-ia.com", "www.axion-ia.com", "localhost"]);

/** Hôtes extérieurs qu'un e-mail formateur a le droit de citer. */
export const HOTES_EXTERIEURS_ADMIS = [
  "calendly.com",
  "urssaf.fr",
  "www.urssaf.fr",
  "formalites.entreprises.gouv.fr",
  "annuaire-entreprises.data.gouv.fr",
  "www.linkedin.com",
];

function feuille(dossier: string): boolean {
  return ["page.tsx", "page.ts", "route.ts", "route.tsx"].some((f) =>
    existsSync(path.join(dossier, f)),
  );
}

function enfants(dossier: string): string[] {
  try {
    return readdirSync(dossier, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function resoudre(dossier: string, segments: readonly string[]): boolean {
  // Les groupes `(x)` ne consomment aucun segment.
  for (const g of enfants(dossier).filter((n) => /^\(.+\)$/.test(n))) {
    if (resoudre(path.join(dossier, g), segments)) return true;
  }
  if (segments.length === 0) return feuille(dossier);
  const [tete, ...reste] = segments as [string, ...string[]];
  const noms = enfants(dossier);
  if (noms.includes(tete) && resoudre(path.join(dossier, tete), reste)) return true;
  for (const n of noms.filter((x) => /^\[[^.[\]][^\]]*\]$/.test(x))) {
    if (resoudre(path.join(dossier, n), reste)) return true;
  }
  // `[[...x]]` (attrape-tout FACULTATIF) mène à une vraie page ; `[...x]` non.
  for (const n of noms.filter((x) => /^\[\[\.\.\..+\]\]$/.test(x))) {
    if (feuille(path.join(dossier, n))) return true;
  }
  return false;
}

/** L'adresse (absolue ou relative) mène-t-elle à une page ou une route de `src/app` ? */
export function routeExiste(adresse: string): boolean {
  const u = new URL(adresse, "https://axion-ia.com");
  const segments = decodeURIComponent(u.pathname).split("/").filter(Boolean);
  return resoudre(APP, segments);
}

/** L'adresse vise-t-elle le site lui-même ? */
export function estDuSite(adresse: string): boolean {
  try {
    const u = new URL(adresse, "https://axion-ia.com");
    return HOTES_DU_SITE.has(u.hostname);
  } catch {
    return false;
  }
}

/** Les liens (`href`) d'un HTML d'e-mail, entités décodées, sans `mailto:` ni ancres. */
export function liensDe(html: string): string[] {
  const liens = [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1]!.replace(/&amp;/g, "&"))
    .filter((l) => /^https?:\/\//.test(l) || l.startsWith("/"));
  return [...new Set(liens)];
}

/** Un mot entier, accents compris. */
const mot = (liste: string) => new RegExp(`(?<![\\p{L}\\d])(?:${liste})(?![\\p{L}\\d])`, "iu");

const ANGLAIS = mot(
  "click|here|dear|hello|please|account|login|log in|sign in|download|meeting|deadline|feedback|update|unsubscribe|view in browser|booking|onboarding|1-to-1",
);
const TECHNIQUE = mot("null|undefined|NaN|\\[object Object\\]|uuid|payload|webhook|cron");
const SALARIAT = mot("poste|entretien|recrutement|salaire|vous devez|embauche");

/** Ce qu'un novice ne devrait pas lire dans ce texte (vide = rien à redire). */
export function problemesDuTexte(texte: string): string[] {
  const sansLiens = texte.replace(/https?:\/\/\S+/g, " ");
  const p: string[] = [];
  const a = ANGLAIS.exec(sansLiens);
  if (a) p.push(`anglais « ${a[0]} »`);
  const t = TECHNIQUE.exec(sansLiens);
  if (t) p.push(`technique « ${t[0]} »`);
  const s = SALARIAT.exec(sansLiens);
  if (s) p.push(`salariat « ${s[0]} »`);
  const c = /\[[^\]\n]{1,60}\]/.exec(sansLiens);
  if (c) p.push(`crochet non rempli « ${c[0]} »`);
  const snake = /(?<![\p{L}\d/=._-])[a-z]+_[a-z_]+(?![\p{L}\d])/u.exec(sansLiens);
  if (snake) p.push(`valeur brute « ${snake[0]} »`);
  return p;
}

/** Nombre de mots d'un texte (lecture au téléphone). */
export function mots(texte: string): number {
  return texte
    .replace(/https?:\/\/\S+/g, " ")
    .split(/\s+/)
    .filter((m) => /\p{L}/u.test(m)).length;
}
