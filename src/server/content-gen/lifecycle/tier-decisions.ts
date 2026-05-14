/**
 * Content Generator — Tier lifecycle decision engine (Sprint 10 V2).
 *
 * Fonction pure qui décide, pour un article publié, s'il doit changer de
 * tier d'indexation selon ses performances mesurées :
 *   - Tier-2 → tier-1 PROMOTE si CTR > seuilPromote sur window N jours
 *   - Tier-1 → tier-2 DEMOTE si CTR < seuilDemote sur window M jours
 *   - Sinon NOOP
 *
 * Les seuils par défaut viennent du master prompt § 3.2 Sprint 10 :
 *   - promote : CTR > 5 % sur 30j (Article publié ≥ 30j)
 *   - demote : CTR < 1 % sur 60j (Article publié ≥ 60j)
 *
 * Garde-fous :
 *   - Pas de promote sur impressions trop faibles (bruit statistique).
 *     Seuil minimum 100 impressions / 30j sinon on attend plus de signal.
 *   - Pas de demote sur tier-1 promu manuellement par Will (`promotedAt`
 *     existe ET `manualPromote=true` côté worker — V1 on demote tous
 *     sauf si flag `respectManualPromote`).
 *   - Pas de promote sur article < 30j (immature).
 *
 * Fonction pure : pas d'I/O, 100% testable.
 */

export type IndexationTier =
  | "tier_1_indexable"
  | "tier_2_noindex_follow"
  | "tier_3_noindex_nofollow";

export type TierDecisionAction = "promote" | "demote" | "noop";

export interface TierDecisionInput {
  readonly currentTier: IndexationTier;
  /** Âge en jours depuis publishedAt. */
  readonly ageDays: number;
  /** CTR observé sur la fenêtre de mesure (0-1, ex 0.045 = 4,5 %). null si pas de data. */
  readonly ctr: number | null;
  /** Nombre d'impressions sur la fenêtre. null si pas de data. */
  readonly impressions: number | null;
  /** Promotion manuelle Will ? Si oui, pas de demote auto. */
  readonly wasManuallyPromoted?: boolean;
}

export interface TierDecisionThresholds {
  /** Seuil CTR pour promote tier-2 → tier-1 (default 0.05 = 5 %). */
  readonly promoteCtrMin: number;
  /** Seuil CTR pour demote tier-1 → tier-2 (default 0.01 = 1 %). */
  readonly demoteCtrMax: number;
  /** Âge minimum pour promote (default 30j). */
  readonly promoteAgeDaysMin: number;
  /** Âge minimum pour demote (default 60j). */
  readonly demoteAgeDaysMin: number;
  /** Impressions minimum pour considérer le CTR fiable (default 100). */
  readonly impressionsMinForDecision: number;
  /** Si true, ne demote jamais un article promu manuellement. */
  readonly respectManualPromote: boolean;
}

export const DEFAULT_TIER_THRESHOLDS: TierDecisionThresholds = {
  promoteCtrMin: 0.05,
  demoteCtrMax: 0.01,
  promoteAgeDaysMin: 30,
  demoteAgeDaysMin: 60,
  impressionsMinForDecision: 100,
  respectManualPromote: true,
};

export interface TierDecision {
  readonly action: TierDecisionAction;
  readonly reason: string;
  readonly nextTier?: IndexationTier;
}

export function computeTierDecision(
  input: TierDecisionInput,
  thresholds: TierDecisionThresholds = DEFAULT_TIER_THRESHOLDS,
): TierDecision {
  // Pas de data → noop (on attend que les workers GSC/Plausible remplissent)
  if (input.ctr === null || input.impressions === null) {
    return { action: "noop", reason: "no_data" };
  }

  // Signal statistique trop faible → noop
  if (input.impressions < thresholds.impressionsMinForDecision) {
    return {
      action: "noop",
      reason: `low_impressions (${input.impressions} < ${thresholds.impressionsMinForDecision})`,
    };
  }

  if (input.currentTier === "tier_2_noindex_follow") {
    // Article tier-2 immature → on attend
    if (input.ageDays < thresholds.promoteAgeDaysMin) {
      return {
        action: "noop",
        reason: `immature (${input.ageDays}j < ${thresholds.promoteAgeDaysMin}j)`,
      };
    }
    if (input.ctr > thresholds.promoteCtrMin) {
      return {
        action: "promote",
        reason: `ctr ${(input.ctr * 100).toFixed(2)}% > ${(thresholds.promoteCtrMin * 100).toFixed(0)}%`,
        nextTier: "tier_1_indexable",
      };
    }
    return {
      action: "noop",
      reason: `ctr ${(input.ctr * 100).toFixed(2)}% below promote threshold`,
    };
  }

  if (input.currentTier === "tier_1_indexable") {
    if (input.ageDays < thresholds.demoteAgeDaysMin) {
      return { action: "noop", reason: `recently promoted (${input.ageDays}j)` };
    }
    if (input.wasManuallyPromoted && thresholds.respectManualPromote) {
      return { action: "noop", reason: "manual_promote_protected" };
    }
    if (input.ctr < thresholds.demoteCtrMax) {
      return {
        action: "demote",
        reason: `ctr ${(input.ctr * 100).toFixed(2)}% < ${(thresholds.demoteCtrMax * 100).toFixed(0)}%`,
        nextTier: "tier_2_noindex_follow",
      };
    }
    return {
      action: "noop",
      reason: `ctr ${(input.ctr * 100).toFixed(2)}% above demote threshold`,
    };
  }

  // tier_3_noindex_nofollow → pas d'auto-lifecycle V1
  return { action: "noop", reason: "tier_3_excluded" };
}
