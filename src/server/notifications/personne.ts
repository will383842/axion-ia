/**
 * Ce qu'un message Telegram peut dire d'une personne physique (décision du
 * 11/10/2026).
 *
 * Règle unique : le prénom et l'INITIALE du nom (« Marie D. »), plus un lien
 * vers la fiche dans la console. Ni nom complet, ni e-mail, ni téléphone, ni
 * texte saisi par la personne : le détail se lit dans la console.
 *
 * Module sans dépendance lourde (`SITE_URL` et `adminPath` seulement) : il est
 * importé par le formateur du hub, que chaque worker charge.
 */

import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/site-url";

/** Rendu quand aucun nom exploitable n'a été fourni. */
export const PERSONNE_NON_NOMMEE = "(non communiqué)";

/**
 * Particules ignorées pour choisir l'initiale du nom : « de la Fontaine » → F.
 * Comparées en minuscules ; un nom fait SEULEMENT de particules garde la
 * première (« Le » → L.).
 */
const PARTICULES = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "van",
  "von",
  "der",
  "den",
  "da",
  "di",
  "del",
  "della",
  "dos",
  "das",
  "ben",
  "bin",
  "ibn",
  "el",
  "al",
]);

/** Élision en tête de mot : « d'Alembert », « l’Isle ». */
const ELISION = /^[dl]['’]/i;

/**
 * Un mot qui ne peut pas être un nom : il porte un chiffre ou une arobase (une
 * adresse ou un numéro tapé au mauvais endroit). On l'écarte plutôt que de
 * risquer d'en recopier un morceau.
 */
function estUnMotDeNom(mot: string): boolean {
  return /\p{L}/u.test(mot) && !/[\d@]/.test(mot);
}

function mots(texte: string | null | undefined): string[] {
  return (texte ?? "")
    .split(/\s+/)
    .map((m) => m.replace(/^[^\p{L}]+|[^\p{L}'’.-]+$/gu, ""))
    .filter((m) => m.length > 0 && estUnMotDeNom(m));
}

/** « MARIE-ÈVE » ou « marie-ève » → « Marie-Ève » ; une casse mixte est respectée. */
function casseDuPrenom(prenom: string): string {
  const uniforme = prenom === prenom.toUpperCase() || prenom === prenom.toLowerCase();
  if (!uniforme) return prenom;
  return prenom
    .toLowerCase()
    .replace(/(^|[-'’\s])(\p{L})/gu, (_m, sep: string, l: string) => sep + l.toUpperCase());
}

/** Première lettre significative d'un nom, en majuscule, suivie d'un point. */
function initialeDuNom(nom: string | null | undefined): string {
  const parties = mots(nom);
  if (parties.length === 0) return "";
  const significatif =
    parties.find((m) => !PARTICULES.has(m.toLowerCase()) && !ELISION.test(m) && m !== "'") ??
    parties.find((m) => ELISION.test(m)) ??
    parties[0]!;
  const sansElision = significatif.replace(ELISION, "");
  const lettre = sansElision.match(/\p{L}/u)?.[0] ?? "";
  return lettre ? `${lettre.toUpperCase()}.` : "";
}

/**
 * « Marie », « Dupont » → « Marie D. ».
 *
 * - nom vide → le prénom seul ;
 * - prénom vide → l'initiale seule ;
 * - les deux vides → `PERSONNE_NON_NOMMEE` ;
 * - noms composés (« Martin-Durand » → M.) et particules (« de la Fontaine »
 *   → F., « d'Alembert » → A.) ;
 * - casse normalisée quand elle est uniforme (« MARIE » → « Marie »).
 */
export function prenomEtInitiale(
  prenom: string | null | undefined,
  nom: string | null | undefined,
): string {
  const p = mots(prenom).map(casseDuPrenom).join(" ");
  const i = initialeDuNom(nom);
  const rendu = [p, i].filter(Boolean).join(" ");
  return rendu || PERSONNE_NON_NOMMEE;
}

/**
 * Même règle quand seul le nom COMPLET est connu (« Marie Dupont ») : le
 * premier mot est pris pour le prénom, le reste pour le nom. Un repère entre
 * parenthèses (« (non communiqué) ») rend `PERSONNE_NON_NOMMEE`.
 */
export function prenomEtInitialeDepuisNomComplet(nomComplet: string | null | undefined): string {
  const brut = (nomComplet ?? "").trim();
  if (brut === "" || /^\(.*\)$/.test(brut)) return PERSONNE_NON_NOMMEE;
  const parties = mots(brut);
  if (parties.length === 0) return PERSONNE_NON_NOMMEE;
  const [prenom, ...reste] = parties;
  return prenomEtInitiale(prenom, reste.join(" "));
}

/**
 * Lien absolu vers un écran de la console : `NEXT_PUBLIC_SITE_URL` +
 * `/fr/<ADMIN_URL_PREFIX>/<chemin>`.
 */
export function lienConsole(chemin: string): string {
  return `${SITE_URL}${adminPath("fr", chemin)}`;
}
