/**
 * Content Generator — paires de contenus trop proches : la forme, en un seul endroit.
 *
 * 🔴 CE MODULE EXISTE PARCE QUE LA FORME ÉTAIT PRIVÉE AU WORKER. Le worker
 * `content-similarity-monitor` écrit ses paires dans `ContentGenConfig` sous la
 * clé `similarity_pairs` depuis mai, et la page « Détection de doublons »
 * annonçait pendant ce temps que « la comparaison n'est pas encore active ».
 * Mesuré le 2026-09-19 en production : **57 paires, écrites le 16/09**. Le
 * travail existait, personne ne le voyait.
 *
 * Brancher la page sur la clé sans rien d'autre aurait recopié la forme des dix
 * champs à un deuxième endroit. Le jour où le worker ajoute ou renomme un champ,
 * la page continuerait d'afficher l'ancien, sans erreur et sans trace — la page
 * lit du JSON, pas un type. On déclare donc la forme ICI, et les deux côtés
 * l'importent.
 */

/** La clé de `ContentGenConfig` sous laquelle le worker dépose ses paires. */
export const CLE_PAIRES_SIMILAIRES = "similarity_pairs";

/** Deux contenus publiés dont les titres se ressemblent trop. */
export interface PaireSimilaire {
  readonly jobIdA: string;
  readonly jobIdB: string;
  readonly contentTypeA: string;
  readonly contentTypeB: string;
  readonly titleA: string;
  readonly titleB: string;
  readonly anchorVilleA: string | null;
  readonly anchorVilleB: string | null;
  /** Indice de Jaccard sur les mots des deux titres, entre 0 et 1. */
  readonly jaccard: number;
  /** Date ISO du passage du worker qui a détecté la paire. */
  readonly detectedAt: string;
}

function chaineNonVide(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * 🔑 On VALIDE au lieu de transtyper.
 *
 * `readContentGenConfig` rend la valeur stockée sous un transtypage non vérifié
 * (c'est écrit dans son propre en-tête, et une production l'a déjà payé en
 * affichant « NaN % »). Ici la valeur vient d'un worker qui a pu tourner sur une
 * version plus ancienne du code : une paire à laquelle il manque `titleB`
 * afficherait une case vide, et un `jaccard` absent afficherait « NaN % » —
 * exactement la même panne, au même endroit du même fichier.
 *
 * Une entrée mal formée est donc ÉCARTÉE, pas rendue. Mieux vaut une paire de
 * moins qu'une ligne qui ment.
 */
export function lirePairesSimilaires(valeur: unknown): readonly PaireSimilaire[] {
  if (!Array.isArray(valeur)) return [];
  const paires: PaireSimilaire[] = [];
  for (const brut of valeur) {
    if (typeof brut !== "object" || brut === null) continue;
    const p = brut as Record<string, unknown>;
    if (!chaineNonVide(p.jobIdA) || !chaineNonVide(p.jobIdB)) continue;
    if (!chaineNonVide(p.titleA) || !chaineNonVide(p.titleB)) continue;
    if (typeof p.jaccard !== "number" || !Number.isFinite(p.jaccard)) continue;
    if (!chaineNonVide(p.detectedAt)) continue;
    paires.push({
      jobIdA: p.jobIdA,
      jobIdB: p.jobIdB,
      contentTypeA: chaineNonVide(p.contentTypeA) ? p.contentTypeA : "",
      contentTypeB: chaineNonVide(p.contentTypeB) ? p.contentTypeB : "",
      titleA: p.titleA,
      titleB: p.titleB,
      anchorVilleA: chaineNonVide(p.anchorVilleA) ? p.anchorVilleA : null,
      anchorVilleB: chaineNonVide(p.anchorVilleB) ? p.anchorVilleB : null,
      jaccard: p.jaccard,
      detectedAt: p.detectedAt,
    });
  }
  return paires;
}
