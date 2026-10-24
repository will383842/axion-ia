/**
 * Content Generator — anti-redite de l'accroche.
 *
 * Audit du 24/10/2026 : le plagiat lexical (`plagiarism.ts`) compare le corps
 * ENTIER à 0,30 de Jaccard. Deux articles qui s'ouvrent par la même phrase
 * mais divergent ensuite passent donc sans bruit, alors que le lecteur (et
 * Google) ne voient que l'ouverture. Ici on compare seulement les 300
 * premiers caractères de la réponse directe et du premier paragraphe au début
 * des articles déjà publiés.
 *
 * Réutilise `jaccardSimilarity` (5-grammes de mots) de `plagiarism.ts` : pas
 * de seconde implémentation de la similarité.
 *
 * Fonction pure : aucune base, aucun Next. Le corpus est celui que le worker
 * charge déjà (`loadPlagiarismCorpus`, slug → texte brut).
 */

import { jaccardSimilarity } from "./plagiarism";

/** Longueur de l'accroche comparée. */
export const ACCROCHE_LONGUEUR = 300;
/** Au-delà de ce Jaccard (5-grammes), l'article est retenu en relecture. */
export const ACCROCHE_SEUIL = 0.6;
/** Sous 5 mots il n'y a aucun 5-gramme : rien à comparer. */
const ACCROCHE_MOTS_MIN = 5;

export interface AccrocheTropProche {
  readonly bloque: boolean;
  /** Plus forte similarité trouvée (0 à 1). */
  readonly similarite: number;
  /** Slug de l'article le plus proche, `null` si aucune comparaison possible. */
  readonly slugProche: string | null;
  /** Quelle accroche a déclenché la plus forte similarité. */
  readonly source: "reponse-directe" | "premier-paragraphe" | null;
}

function textePropre(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texte du premier `<p>` du HTML (vide s'il n'y en a pas). */
export function premierParagraphe(bodyHtml: string): string {
  const m = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(bodyHtml ?? "");
  return m?.[1] ? textePropre(m[1]) : "";
}

function accroche(texte: string): string {
  return textePropre(texte).slice(0, ACCROCHE_LONGUEUR);
}

function assezLong(texte: string): boolean {
  return texte.split(/\s+/).filter(Boolean).length >= ACCROCHE_MOTS_MIN;
}

/**
 * Compare les deux accroches de l'article au début de chaque article du corpus.
 * `corpus` : slug → texte brut de l'article publié (début compris).
 */
export function verifierAccrocheTropProche(
  article: { readonly directAnswer: string; readonly bodyHtml: string },
  corpus: ReadonlyMap<string, string>,
  seuil: number = ACCROCHE_SEUIL,
): AccrocheTropProche {
  const candidates: Array<{ source: "reponse-directe" | "premier-paragraphe"; texte: string }> = [
    { source: "reponse-directe", texte: accroche(article.directAnswer ?? "") },
    { source: "premier-paragraphe", texte: accroche(premierParagraphe(article.bodyHtml ?? "")) },
  ];

  let similarite = 0;
  let slugProche: string | null = null;
  let source: AccrocheTropProche["source"] = null;

  for (const cand of candidates) {
    if (!assezLong(cand.texte)) continue;
    for (const [slug, texteCorpus] of corpus) {
      const debut = accroche(texteCorpus);
      if (!assezLong(debut)) continue;
      const sim = jaccardSimilarity(cand.texte, debut);
      if (sim > similarite) {
        similarite = sim;
        slugProche = slug;
        source = cand.source;
      }
    }
  }

  return { bloque: similarite > seuil, similarite, slugProche, source };
}
