/**
 * Validation Zod de la config `search_intent_distribution` (clé
 * ContentGenConfig). Robustesse intent (P1).
 *
 * Contexte du désalignement :
 *  - la table `keywords` stocke `search_intent` en vocabulaire FR/custom mixte
 *  - l'enum Prisma `SearchIntent` est en anglais
 *    (informational / commercial_investigation / transactional / navigational /
 *     local / voice_search / ai_overview / featured_snippet)
 *  - la config `search_intent_distribution` utilise des clés anglaises
 *    SIMPLIFIÉES (`commercial` = alias de `commercial_investigation`), telles
 *    que lues par `content-orchestrator-worker.ts`.
 *
 * Ce schéma valide que les clés de la config appartiennent à l'ensemble connu
 * (clés simplifiées tolérées + valeurs brutes de l'enum), et que les valeurs
 * sont des pourcentages plausibles. Comportement FAIL-OPEN : le helper
 * `validateIntentDistribution` ne throw JAMAIS — il log un warn explicite par
 * clé inconnue/typo, l'ignore, et renvoie l'objet nettoyé. L'orchestration
 * n'est jamais cassée par une config mal saisie côté admin.
 */

import { z } from "zod";
import { SearchIntent } from "../../../prisma/generated/client";

/**
 * Clés simplifiées acceptées dans `search_intent_distribution` (UI admin
 * `/settings/search-intent-distribution`). `commercial` est l'alias de
 * `commercial_investigation` résolu dans l'orchestrateur.
 */
export const INTENT_DISTRIBUTION_ALIASES = {
  commercial: "commercial_investigation",
} as const satisfies Partial<Record<string, SearchIntent>>;

/**
 * Ensemble des clés connues : toutes les valeurs brutes de l'enum
 * `SearchIntent` PLUS les alias simplifiés tolérés. Dérivé de l'enum pour
 * rester synchronisé automatiquement si l'enum évolue.
 */
export const KNOWN_INTENT_KEYS: ReadonlySet<string> = new Set<string>([
  ...Object.values(SearchIntent),
  ...Object.keys(INTENT_DISTRIBUTION_ALIASES),
]);

/**
 * Schéma d'une valeur de distribution : pourcentage 0–100 (number fini).
 * Tolérant sur les flottants ; on borne juste pour éviter des poids absurdes.
 */
const intentWeightSchema = z.number().finite().min(0).max(100);

/**
 * Schéma de la config complète. `passthrough` pour ne PAS rejeter en bloc :
 * les clés inconnues sont filtrées au niveau du helper (fail-open), pas ici.
 */
export const intentDistributionSchema = z.record(z.string(), intentWeightSchema).nullable();

export type IntentDistribution = Record<string, number>;

/**
 * Valide + nettoie une config `search_intent_distribution` lue depuis la DB.
 *
 * FAIL-OPEN : ne throw jamais.
 *  - clé inconnue (typo, intent non supporté) → warn + ignorée
 *  - valeur invalide (non-number, < 0, > 100, NaN) → warn + ignorée
 *  - input non-objet (null / array / scalaire) → warn + renvoie `{}`
 *
 * @param raw       valeur brute issue de `readContentGenConfig`
 * @param logWarn   sink de log (défaut `console.warn`) — injectable pour tests
 * @returns         objet ne contenant QUE les clés/valeurs connues et valides
 */
export function validateIntentDistribution(
  raw: unknown,
  logWarn: (msg: string) => void = (msg) => console.warn(msg),
): IntentDistribution {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    logWarn(
      `[intent-distribution] config invalide (attendu objet, reçu ${
        Array.isArray(raw) ? "array" : typeof raw
      }) — fallback vide`,
    );
    return {};
  }

  const cleaned: IntentDistribution = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN_INTENT_KEYS.has(key)) {
      logWarn(
        `[intent-distribution] clé inconnue « ${key} » ignorée (clés connues : ${[
          ...KNOWN_INTENT_KEYS,
        ].join(", ")})`,
      );
      continue;
    }
    const parsed = intentWeightSchema.safeParse(value);
    if (!parsed.success) {
      logWarn(
        `[intent-distribution] valeur invalide pour « ${key} » (${JSON.stringify(
          value,
        )}) ignorée — attendu pourcentage 0–100`,
      );
      continue;
    }
    cleaned[key] = parsed.data;
  }
  return cleaned;
}
