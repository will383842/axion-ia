/** Extraction des nombres d'un texte (contrat de faits : R3, R4, R6, R7). Module pur. */

const RE_NOMBRE =
  /(?<![\p{L}\p{N}])(\d{1,3}(?:[  .]\d{3})+|\d+)(?:,(\d+))?(\s?(?:%|€|k€|m€|millions?|milliards?))?(?![\p{L}\p{N}])/giu;

export interface NombreTrouve {
  readonly cle: string;
  readonly valeur: number;
  readonly notable: boolean;
  readonly annee: boolean;
  readonly minutes: boolean;
}

export function nombresDe(texte: string): NombreTrouve[] {
  const sortie: NombreTrouve[] = [];
  for (const m of texte.matchAll(RE_NOMBRE)) {
    const entier = (m[1] ?? "").replace(/[  .]/g, "");
    const dec = m[2];
    const unite = (m[3] ?? "").replace(/\s/g, "").toLowerCase();
    const valeur = Number(dec ? `${entier}.${dec}` : entier);
    const apres = texte.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12);
    const suivant = texte.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 16);
    const suivant40 = texte.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 60);
    const avant = texte.slice(Math.max(0, (m.index ?? 0) - 8), m.index ?? 0);
    // « 8 PME sur 10 », « 3 fois », « 6 heures » : des statistiques, même sous 11.
    const statistique =
      /^[^.!?\d]{0,40}\bsur\s+(?:\d|dix|cent)/i.test(suivant40) ||
      /^\s*(?:sur\s+\d|fois|heures?|jours?|semaines?|mois|ans|salari|personnes?|collaborateurs?|employ|clients?|entreprises?|pme|tpe)/i.test(
        suivant,
      ) ||
      /\bsur\s*$/i.test(avant);
    sortie.push({
      cle: `${dec ? `${entier}.${dec}` : entier}${unite}`,
      valeur,
      notable: unite !== "" || dec !== undefined || valeur > 10 || statistique,
      annee: unite === "" && dec === undefined && valeur >= 1900 && valeur <= 2100,
      minutes: /^\s*minutes?/i.test(apres),
    });
  }
  // Statistiques écrites en lettres : « huit PME sur dix », « la moitié », « 12 pour cent ».
  for (const m of texte.matchAll(RE_LETTRES)) {
    sortie.push({
      cle: `txt:${m[0].toLowerCase().replace(/\s+/g, " ").trim()}`,
      valeur: 0,
      notable: true,
      annee: false,
      minutes: false,
    });
  }
  return sortie;
}

const MOTS_NOMBRE =
  "deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|quarante|cinquante|soixante|cent|mille";
const UNITES_STAT =
  "fois|heures?|jours?|semaines?|mois|ans|salari\\p{L}*|pme|tpe|entreprises?|clients?|collaborateurs?|millions?|milliards?|pour cent";
// Nombre composé : « vingt-cinq », « soixante-dix », « vingt et un » : jamais réduit à son dernier mot.
const NB_LETTRES = `(?:${MOTS_NOMBRE})(?:(?:-|\\s+et\\s+)(?:${MOTS_NOMBRE}|un|une))*`;
const RE_LETTRES = new RegExp(
  `(?<![\\p{L}-])(?:(?:un|une|${NB_LETTRES})\\s+[^.!?\\d]{0,40}?\\bsur\\s+(?:${NB_LETTRES}|\\d+)|(?:${NB_LETTRES})\\s+(?:${UNITES_STAT})|la moitié|un tiers|deux tiers|un quart|trois quarts|\\d+\\s*pour cent)(?![\\p{L}])`,
  "giu",
);
