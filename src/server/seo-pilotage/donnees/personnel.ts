/**
 * Filtre des données personnelles dans les requêtes de recherche, AVANT tout stockage.
 * Module PUR : les noms à protéger sont injectés (la jointure en base est faite ailleurs).
 *
 * Aucun seuil journalier d'impressions : sur un site à quelques centaines d'impressions par
 * semaine, il viderait les détecteurs. Seule la purge en texte des requêtes à moins de
 * 3 impressions cumulées sur 90 jours est prévue (`requetesARetirerDuTexte`).
 */
import { normaliserPourControle } from "@/lib/contenu/interdits-publication";

export interface LigneRequete {
  readonly requete: string;
  readonly impressions: number;
  readonly clics: number;
}

export interface OptionsPersonnel {
  /** Noms complets (« Prénom Nom ») ou noms seuls de personnes connues en base. */
  readonly noms: ReadonlyArray<string>;
}

export interface ResultatFiltre<T extends LigneRequete> {
  readonly conservees: T[];
  /** Ce qui a été retiré : compté pour l'agrégat de la page, jamais stocké en texte. */
  readonly retirees: { lignes: number; impressions: number; clics: number };
}

// « @ » entouré d'espaces ou sans domaine de premier niveau compris : on préfère trop retirer.
const RE_EMAIL = /[a-z0-9._%+-]+\s?@\s?[a-z0-9-]+/;
// Téléphone français (0X XX XX XX XX, +33 X XX XX XX XX, 0033…) ou international en « + ».
// Volontairement étroit : « iso 27001 2022 » ne doit pas être pris pour un numéro.
const RE_TELEPHONE =
  /(?<![0-9])(?:(?:\+33|0033|0)[ .-]?[1-9](?:[ .-]?[0-9]){8}|\+[1-9][0-9]{0,2}(?:[ .-]?[0-9]){8,12})(?![0-9])/;

/** Texte normalisé : sans accents, minuscules, ponctuation → espace, espaces compactées. */
function lisse(t: string): string {
  return normaliserPourControle(t)
    .replace(/[^a-z0-9@+.\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mots(t: string): string[] {
  return lisse(t)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function jeuxDeNoms(noms: ReadonlyArray<string>): string[][] {
  return noms.map((n) => mots(n)).filter((m) => m.length > 0 && m.join("").length >= 3);
}

function estDonneePersonnelle(requete: string, nomsConnus: string[][]): boolean {
  const t = lisse(requete);
  if (RE_EMAIL.test(t)) return true;
  if (RE_TELEPHONE.test(t)) return true;
  const motsRequete = new Set(mots(requete));
  if (nomsConnus.some((nom) => nom.every((m) => motsRequete.has(m)))) return true;
  // Nom collé (« elodiemartin ») : mots accolés dans l'un ou l'autre ordre.
  const collee = [...motsRequete].join(" ");
  return nomsConnus.some(
    (nom) =>
      nom.length > 1 && [nom.join(""), [...nom].reverse().join("")].some((c) => collee.includes(c)),
  );
}

export function filtrerDonneesPersonnelles<T extends LigneRequete>(
  lignes: ReadonlyArray<T>,
  opts: OptionsPersonnel,
): ResultatFiltre<T> {
  const noms = jeuxDeNoms(opts.noms);
  const conservees: T[] = [];
  const retirees = { lignes: 0, impressions: 0, clics: 0 };
  for (const l of lignes) {
    if (estDonneePersonnelle(l.requete, noms)) {
      retirees.lignes += 1;
      retirees.impressions += l.impressions;
      retirees.clics += l.clics;
    } else {
      conservees.push({ ...l });
    }
  }
  return { conservees, retirees };
}

/**
 * Textes (tels que stockés) à purger : un groupe de variantes (casse, accents, ponctuation) dont
 * le cumul d'impressions (90 j) est strictement sous le seuil. On rend les textes d'ORIGINE,
 * pour qu'une purge `WHERE requete IN (…)` les retrouve.
 */
export function requetesARetirerDuTexte(
  lignes: ReadonlyArray<Pick<LigneRequete, "requete" | "impressions">>,
  seuil = 3,
): string[] {
  const groupes = new Map<string, { n: number; textes: Set<string> }>();
  for (const l of lignes) {
    const k = mots(l.requete).join(" ");
    const g = groupes.get(k) ?? { n: 0, textes: new Set<string>() };
    g.n += l.impressions;
    g.textes.add(l.requete);
    groupes.set(k, g);
  }
  return [...groupes.values()].filter((g) => g.n < seuil).flatMap((g) => [...g.textes]);
}
