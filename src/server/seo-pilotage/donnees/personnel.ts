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

const RE_EMAIL = /[a-z0-9._%+-]+\s?@\s?[a-z0-9-]+(?:\.[a-z0-9-]+)+/;
// Téléphone français (0X XX XX XX XX, +33 X XX XX XX XX, 0033…) ou international en « + ».
// Volontairement étroit : « iso 27001 2022 » ne doit pas être pris pour un numéro.
const RE_TELEPHONE =
  /(?<![0-9])(?:(?:\+33|0033|0)[ .-]?[1-9](?:[ .-]?[0-9]{2}){4}|\+[1-9][0-9]{0,2}(?:[ .-]?[0-9]){8,12})(?![0-9])/;

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

export function estDonneePersonnelle(requete: string, nomsConnus: string[][]): boolean {
  const t = lisse(requete);
  if (RE_EMAIL.test(t)) return true;
  if (RE_TELEPHONE.test(t)) return true;
  const motsRequete = new Set(mots(requete));
  return nomsConnus.some((nom) => nom.every((m) => motsRequete.has(m)));
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

/** Requêtes dont le texte doit être purgé : cumul d'impressions (90 j) strictement sous le seuil. */
export function requetesARetirerDuTexte(
  lignes: ReadonlyArray<Pick<LigneRequete, "requete" | "impressions">>,
  seuil = 3,
): string[] {
  const cumul = new Map<string, number>();
  for (const l of lignes) {
    const k = mots(l.requete).join(" ");
    cumul.set(k, (cumul.get(k) ?? 0) + l.impressions);
  }
  return [...cumul].filter(([, n]) => n < seuil).map(([k]) => k);
}
