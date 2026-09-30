/**
 * TARIFS OpenAI du circuit visio (ADR 0055 ; LOTS-EXECUTION §1.4).
 *
 * Source : https://developers.openai.com/pricing, lue le 29/09/2026.
 *   · `gpt-6-sol` : 2 $ par million de jetons d'entrée, 0,20 $ en cache,
 *     10 $ par million de jetons de sortie ;
 *   · `gpt-4o-transcribe-diarize` : 2,50 $ par million de jetons d'entrée
 *     (audio), 10 $ par million de jetons de sortie ; ≈ 0,006 $ par minute
 *     quand l'API ne rend qu'une durée.
 *
 * ⚠️ On ne touche PAS `PRICING` de `content-gen/providers/openai.ts` : ce
 * tableau-ci est celui du circuit, et un test exige un tarif pour CHAQUE
 * modèle de `modeles.ts` (`chaque-modele-a-son-tarif.spec.ts`) — un modèle
 * ajouté sans tarif serait tracé à 0 $, donc invisible sous le plafond.
 *
 * Module PUR.
 */

import { MODELES_VISIO, type ModeleVisio } from "./modeles";

export interface TarifModele {
  /** $ par million de jetons d'entrée. */
  readonly entreeParMillion: number;
  /** $ par million de jetons d'entrée servis depuis le cache. */
  readonly entreeEnCacheParMillion: number;
  /** $ par million de jetons de sortie. */
  readonly sortieParMillion: number;
  /** $ par minute d'audio, quand l'usage n'est rendu qu'en durée. */
  readonly parMinuteAudio: number | null;
}

export const TARIFS_OPENAI_VISIO: Readonly<Record<ModeleVisio, TarifModele>> = {
  "gpt-4o-transcribe-diarize": {
    entreeParMillion: 2.5,
    entreeEnCacheParMillion: 2.5,
    sortieParMillion: 10,
    parMinuteAudio: 0.006,
  },
  "gpt-6-sol": {
    entreeParMillion: 2,
    entreeEnCacheParMillion: 0.2,
    sortieParMillion: 10,
    parMinuteAudio: null,
  },
};

/** Ce qu'un appel a consommé, sous une forme commune aux deux API. */
export interface UsageAppel {
  readonly jetonsEntree: number;
  readonly jetonsEntreeEnCache: number;
  readonly jetonsSortie: number;
  /** Durée d'audio facturée, quand l'API ne rend pas de jetons. */
  readonly secondesAudio: number | null;
}

export const USAGE_NUL: UsageAppel = {
  jetonsEntree: 0,
  jetonsEntreeEnCache: 0,
  jetonsSortie: 0,
  secondesAudio: null,
};

/** Le tarif d'un modèle servi ; lève pour un modèle inconnu (jamais 0 $ en silence). */
export function tarifDe(modele: string): TarifModele {
  const connu = (MODELES_VISIO as readonly string[]).includes(modele)
    ? TARIFS_OPENAI_VISIO[modele as ModeleVisio]
    : // `response.model` peut porter un suffixe de version (« gpt-6-sol-2026-09-01 »).
      MODELES_VISIO.map((m) => (modele.startsWith(`${m}-`) ? TARIFS_OPENAI_VISIO[m] : null)).find(
        (t) => t !== null,
      );
  if (!connu) throw new Error(`[visio/tarifs] aucun tarif pour le modèle « ${modele} ».`);
  return connu;
}

/** Coût en dollars d'un appel. */
export function coutUsd(modele: string, usage: UsageAppel): number {
  const t = tarifDe(modele);
  const jetons = usage.jetonsEntree + usage.jetonsSortie;
  if (jetons === 0 && usage.secondesAudio !== null && t.parMinuteAudio !== null) {
    return (usage.secondesAudio / 60) * t.parMinuteAudio;
  }
  const horsCache = Math.max(0, usage.jetonsEntree - usage.jetonsEntreeEnCache);
  return (
    (horsCache * t.entreeParMillion +
      usage.jetonsEntreeEnCache * t.entreeEnCacheParMillion +
      usage.jetonsSortie * t.sortieParMillion) /
    1_000_000
  );
}
