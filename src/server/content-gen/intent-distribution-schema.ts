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
    // 🔴 L'ALIAS ÉTAIT DOCUMENTÉ MAIS JAMAIS APPLIQUÉ.
    //
    // Ce module déclare `commercial` comme alias simplifié de
    // `commercial_investigation` et dit qu'il est « résolu dans
    // l'orchestrateur ». Il ne l'était pas : l'orchestrateur lit
    // `intentDist.commercial` et rien d'autre. La config de production, elle,
    // stocke `commercial_investigation` — la clé passait la validation, puis
    // était perdue à la lecture. Résultat mesuré en production le 2026-08-03 :
    // la part commerciale (0,25 sur 1) valait **zéro** dans le mix d'intentions
    // appliqué aux campagnes sans mix propre. Et sur l'écran de réglage, la
    // même clé manquante affichait « Somme actuelle : NaN % ».
    //
    // On replie donc ici, une fois pour toutes : les deux consommateurs
    // reçoivent le même vocabulaire. Si les deux clés coexistent, on additionne
    // — ce sont deux écritures de la même part, pas deux parts distinctes.
    const canonique = key === "commercial_investigation" ? "commercial" : key;
    cleaned[canonique] = (cleaned[canonique] ?? 0) + parsed.data;
  }
  return cleaned;
}

/**
 * Répartition par défaut, EN POURCENTAGES (somme 100).
 *
 * 🔴 SOURCE UNIQUE — ne pas en recopier une variante ailleurs. Ces valeurs
 * vivaient en double (écran de réglage + orchestrateur). C'est précisément ce
 * doublon qui a laissé les deux échelles diverger sans que rien ne le signale.
 */
export const INTENT_DISTRIBUTION_DEFAULTS: IntentDistribution = {
  informational: 50,
  commercial: 25,
  local: 15,
  transactional: 5,
  navigational: 5,
};

/**
 * Lit une répartition stockée et applique les défauts EN BLOC si rien
 * d'exploitable n'en sort. **C'est le seul point d'entrée légitime** pour les
 * deux consommateurs (écran via `policies.ts`, génération via l'orchestrateur).
 *
 * 🔴 POURQUOI « EN BLOC » ET JAMAIS CLÉ PAR CLÉ.
 *
 * Une répartition ne se lit pas champ par champ : ses poids n'ont de sens que
 * les uns par rapport aux autres. Compléter les clés manquantes avec des
 * défauts revient à mélanger deux échelles. Vécu en production le 2026-08-04 :
 * la ligne stockée est en fractions (somme 1), les défauts en pourcentages
 * (somme 100) ; la fusion a injecté `commercial: 25` au milieu de voisins à
 * 0,1 et l'écran affichait **97,1 %** pour la part commerciale — pire que le
 * zéro qu'on venait de corriger.
 *
 * Corollaire, valable pour tout appelant : lire cette clé avec
 * `readContentGenConfig(..., {})`. Passer des défauts à cette lecture les
 * ferait fusionner clé par clé et rouvrirait exactement ce piège.
 */
export function resolveIntentDistribution(
  raw: unknown,
  logWarn?: (msg: string) => void,
): IntentDistribution {
  const valide = logWarn
    ? validateIntentDistribution(raw, logWarn)
    : validateIntentDistribution(raw);
  const somme = Object.values(valide).reduce((s, v) => s + v, 0);
  // Somme nulle = aucune clé exploitable. On rend les défauts entiers plutôt
  // qu'une grille de zéros, qui laisserait croire qu'aucune intention n'est
  // générée.
  if (somme <= 0) return { ...INTENT_DISTRIBUTION_DEFAULTS };
  return valide;
}

/**
 * Ramène des pondérations à des pourcentages de somme 100.
 *
 * Les pondérations sont RELATIVES en aval (l'orchestrateur les passe à un
 * tirage pondéré, `weightedEnumRecord` accepte 0–1000) : la production les
 * stocke en fractions de somme 1, tandis que l'écran de réglage les présente
 * — et les valide — en pourcentages de somme 100. Les deux disent la même
 * chose ; seul l'affichage a besoin d'une échelle fixe.
 *
 * Une somme nulle renvoie `{}` : sans poids, il n'y a pas de répartition à
 * montrer, et diviser par zéro produirait le `NaN` qu'on vient de corriger.
 */
export function toPourcentages(poids: IntentDistribution): IntentDistribution {
  const total = Object.values(poids).reduce((s, v) => s + v, 0);
  if (total <= 0) return {};
  const out: IntentDistribution = {};
  for (const [k, v] of Object.entries(poids)) out[k] = Math.round((v / total) * 1000) / 10;
  return out;
}
