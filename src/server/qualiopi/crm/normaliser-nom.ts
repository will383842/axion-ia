/**
 * Nom d'entreprise NORMALISÉ — pour reconnaître « Martin SAS » et « martin »
 * comme la même société (chantier visio, plan §3.17 point 3, signal 4).
 *
 * Règle : minuscules, sans accents ni ponctuation, sans forme juridique ni mot
 * générique (« SAS », « SARL », « société », « groupe »…), espaces réduits.
 * Puis, si la ville (ou le code postal) concorde, une distance d'édition ≤ 2
 * suffit : « Boulangerie Martin » et « Boulangeri Martin » sont proches.
 *
 * Module PUR : aucun import. Il est lu par la porte unique de création des
 * fiches (`porte-client.ts`) et par ses tests.
 */

/**
 * Formes juridiques et mots génériques retirés du nom.
 *
 * ⚠️ Liste FERMÉE, en mots entiers (jamais en sous-chaîne) : retirer « sa » en
 * sous-chaîne mangerait « Sabatier » ; retirer le MOT « sa » ne touche que la
 * forme juridique.
 */
export const MOTS_RETIRES_DU_NOM: ReadonlySet<string> = new Set([
  "sas",
  "sasu",
  "sarl",
  "sarlu",
  "sa",
  "eurl",
  "sci",
  "snc",
  "scop",
  "selarl",
  "ets",
  "etablissements",
  "societe",
  "groupe",
]);

/** Retire les accents : « Société Générale » → « Societe Generale ». */
function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Nom normalisé. Une chaîne vide (ou faite seulement de formes juridiques)
 * rend `""` : elle ne rapproche JAMAIS deux fiches (voir `nomsProches`).
 */
export function normaliserNom(nom: string | null | undefined): string {
  if (!nom) return "";
  const mots = sansAccents(nom)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((m) => m !== "" && !MOTS_RETIRES_DU_NOM.has(m));
  return mots.join(" ");
}

/** Ville normalisée : même traitement, sans retirer de mot (« Saint-Étienne » → « saint etienne »). */
export function normaliserVille(ville: string | null | undefined): string {
  if (!ville) return "";
  return sansAccents(ville)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Distance d'édition (Levenshtein) : insertions, suppressions, substitutions. */
export function distanceEdition(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let precedente = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const courante = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      courante[j] = Math.min(
        (courante[j - 1] ?? 0) + 1,
        (precedente[j] ?? 0) + 1,
        (precedente[j - 1] ?? 0) + cout,
      );
    }
    precedente = courante;
  }
  return precedente[b.length] ?? 0;
}

/** Distance d'édition admise entre deux noms normalisés quand la ville concorde. */
export const DISTANCE_NOM_MAX = 2;

/**
 * Deux noms désignent-ils probablement la même société ?
 *
 * · noms normalisés égaux → oui ;
 * · sinon, distance ≤ 2 → oui, mais SEULEMENT pour des noms d'au moins 5
 *   lettres : sur « abc » / « abd », deux lettres de distance ne prouvent rien.
 * Un nom vide ne rapproche jamais rien.
 */
export function nomsProches(a: string, b: string): boolean {
  const na = normaliserNom(a);
  const nb = normaliserNom(b);
  if (na === "" || nb === "") return false;
  if (na === nb) return true;
  if (Math.min(na.length, nb.length) < 5) return false;
  return distanceEdition(na, nb) <= DISTANCE_NOM_MAX;
}
