/**
 * Content Generator — Anti-burst scheduler (Sprint 7 V2).
 *
 * Fonction pure qui décide pour chaque type combien de jobs enqueue *maintenant*
 * pour respecter une cible quotidienne étalée uniformément sur 24h.
 *
 * Algorithme :
 *   - On a un targetByType (ex : { blog_article: 24 }) → 24 jobs/jour.
 *   - 24h = 86 400 000 ms → 1 job toutes les 3 600 000 ms (1h).
 *   - À l'instant t (ms depuis startOfDay), nombre de jobs attendus :
 *       expected = ceil((t / 86_400_000) * target)
 *   - Si createdToday < expected ∧ createdToday < target → enqueue (expected - createdToday).
 *
 * Garantie : sur 24h pleines, on enqueue exactement `target` jobs, distribués
 * de façon (quasi) uniforme. Si un tick rate (15 min) passe à côté → rattrapage
 * automatique au tick suivant.
 *
 * Si anti-burst désactivé : retourne `target - createdToday` (rattrape tout d'un coup).
 *
 * Fonction pure : pas d'I/O, 100% testable.
 */

import type { ContentType } from "../../../../prisma/generated/client";
import {
  equipeEditorialeActive,
  type EnvEquipeEditoriale,
} from "../fact-check/equipe-editoriale-drapeau";
import { plafondsCoherents } from "../providers/blog-claude-plafonds";

export interface AntiBurstInput {
  /** Cibles/jour par type. Type absent ou target=0 → ignoré. */
  readonly targetByType: Partial<Record<ContentType, number>>;
  /** Nb de jobs déjà créés today (status != cancelled) par type. */
  readonly createdTodayByType: Partial<Record<ContentType, number>>;
  /** Temps écoulé depuis startOfDay UTC (ms). 0 ≤ t ≤ 86_400_000. */
  readonly msSinceStartOfDay: number;
  /** Si true : étalement uniforme sur 24h. Si false : rattrape tout d'un coup. */
  readonly antiBurstEnabled: boolean;
}

export interface AntiBurstDecision {
  /** Type concerné. */
  readonly contentType: ContentType;
  /** Nb de jobs à enqueue maintenant pour rattraper la cible. */
  readonly enqueueCount: number;
}

const MS_PER_DAY = 86_400_000;

export function computeAntiBurstSchedule(input: AntiBurstInput): ReadonlyArray<AntiBurstDecision> {
  const decisions: AntiBurstDecision[] = [];
  const tClamped = Math.max(0, Math.min(MS_PER_DAY, input.msSinceStartOfDay));

  for (const [typeRaw, targetRaw] of Object.entries(input.targetByType)) {
    const target = typeof targetRaw === "number" ? targetRaw : 0;
    if (target <= 0) continue;

    const contentType = typeRaw as ContentType;
    const created = input.createdTodayByType[contentType] ?? 0;
    if (created >= target) continue;

    let enqueueCount: number;
    if (!input.antiBurstEnabled) {
      enqueueCount = target - created;
    } else {
      const expected = Math.ceil((tClamped / MS_PER_DAY) * target);
      const clampedExpected = Math.min(expected, target);
      enqueueCount = Math.max(0, clampedExpected - created);
    }

    if (enqueueCount > 0) {
      decisions.push({ contentType, enqueueCount });
    }
  }

  return decisions;
}

export interface CampaignTickBudgetInput {
  /** Cible quotidienne de la campagne (`dailyArticles`). */
  readonly dailyTarget: number;
  /** Jobs déjà créés aujourd'hui POUR CETTE CAMPAGNE (status != cancelled). */
  readonly createdToday: number;
  /** Temps écoulé depuis startOfDay UTC (ms). */
  readonly msSinceStartOfDay: number;
  /** Si false : rattrape le reste de la journée d'un coup. */
  readonly antiBurstEnabled: boolean;
}

/**
 * Budget d'un tick pour une campagne en mode `dailyArticles` (sans
 * `dailyTargetByType`).
 *
 * Fix 2026-08-15 (audit e2e) — l'ancienne formule `max(1, ceil(daily / 96))` ne
 * comptait JAMAIS les jobs déjà créés dans la journée : le plancher à 1 faisait
 * enqueue 1 job à chacun des 96 ticks quotidiens, soit ~96 jobs/jour quelle que
 * soit la cible. Mesuré en prod les 23-24/07 : ~88 jobs/jour pour une campagne
 * réglée à 20. La cible était donc dépassée d'un facteur ~5, et le crédit
 * provider brûlé d'autant.
 *
 * Même algorithme que `computeAntiBurstSchedule`, appliqué à la campagne entière
 * plutôt que par type : on n'enqueue que le retard réel sur la courbe idéale,
 * et jamais au-delà de la cible du jour. Le rattrapage d'un tick manqué reste
 * automatique (le retard est repris au tick suivant).
 */
/**
 * Plafond quotidien GLOBAL de génération, tous canaux confondus (décision Will
 * 2026-08-15, clé `ContentGenConfig.daily_generation_cap` ; 15/jour en prod
 * depuis le 16/08, valeur par défaut 20 si la clé est absente).
 *
 * Déplacé ici depuis l'orchestrateur le 2026-09-02 : le monitoring doit
 * connaître le même plafond pour savoir si « rien lancé depuis 4 h » est une
 * panne ou simplement un budget consommé. Une seule définition, deux lecteurs.
 */
export interface DailyGenerationCap {
  readonly maxPerDay: number;
}

export const DEFAULT_DAILY_GENERATION_CAP: DailyGenerationCap = { maxPerDay: 20 };

/**
 * Plafond effectif : défensif, une valeur absente ou aberrante retombe sur le
 * défaut et ne produit jamais un budget NaN (qui gèlerait la production).
 */
export function resolveCapPerDay(cap: DailyGenerationCap | null | undefined): number {
  const raw = cap?.maxPerDay;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_DAILY_GENERATION_CAP.maxPerDay;
}

export function computeCampaignTickBudget(input: CampaignTickBudgetInput): number {
  const target = Math.max(0, Math.floor(input.dailyTarget));
  if (target <= 0) return 0;

  const created = Math.max(0, input.createdToday);
  if (created >= target) return 0;

  if (!input.antiBurstEnabled) return target - created;

  const tClamped = Math.max(0, Math.min(MS_PER_DAY, input.msSinceStartOfDay));
  const expected = Math.min(Math.ceil((tClamped / MS_PER_DAY) * target), target);
  return Math.max(0, expected - created);
}

/** Helper pour les workers : extraire le ms depuis startOfDay UTC. */
export function msSinceStartOfDay(now: Date = new Date()): number {
  const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return now.getTime() - startOfDay;
}

// ── Rythme de l'équipe éditoriale (derrière CONTENT_EQUIPE_EDITORIALE) ────────

/** Clés `ContentGenConfig` : lecture tolérante, aucune migration. */
export const CLE_ARTICLES_MAX_JOUR = "equipe_articles_max_jour";
export const CLE_MAJ_MAX_JOUR = "equipe_maj_max_jour";
export const ARTICLES_MAX_JOUR_DEFAUT = 3;
export const MAJ_MAX_JOUR_DEFAUT = 1;
/** Borne de garde : au-delà, la clé est jugée aberrante et le défaut s'applique. */
export const BORNE_RYTHME_MAX_JOUR = 20;

export interface RythmeEquipe {
  readonly articlesMaxJour: number;
  readonly majMaxJour: number;
}

/** Entier ≥ 0 sinon valeur par défaut (clé absente, texte, négatif, décimal). */
function entierOuDefaut(v: unknown, defaut: number): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= BORNE_RYTHME_MAX_JOUR
    ? v
    : defaut;
}

export function resoudreRythmeEquipe(config: unknown): RythmeEquipe {
  const o =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  return {
    articlesMaxJour: entierOuDefaut(o[CLE_ARTICLES_MAX_JOUR], ARTICLES_MAX_JOUR_DEFAUT),
    majMaxJour: entierOuDefaut(o[CLE_MAJ_MAX_JOUR], MAJ_MAX_JOUR_DEFAUT),
  };
}

export interface DecisionRythmeEquipe {
  readonly autorise: boolean;
  readonly raison?: string;
}

/**
 * Refuse un nouvel article (au-delà de 3/jour) ou une mise à jour (au-delà de 1/jour).
 * Interrupteur éteint : toujours autorisé (comportement d'avant). Si les plafonds USD
 * sont fournis, refuse aussi l'incohérence jour > mois.
 */
export function decisionRythmeEquipe(input: {
  readonly nature: "article" | "maj";
  readonly creesAujourdhui: number;
  readonly rythme: RythmeEquipe | null | undefined;
  readonly env?: EnvEquipeEditoriale;
  readonly plafondJourUsd?: number;
  readonly plafondMoisUsd?: number;
}): DecisionRythmeEquipe {
  if (!equipeEditorialeActive(input.env)) return { autorise: true };
  if (
    input.plafondJourUsd !== undefined &&
    input.plafondMoisUsd !== undefined &&
    !plafondsCoherents(input.plafondJourUsd, input.plafondMoisUsd)
  ) {
    return { autorise: false, raison: "plafond du jour supérieur au plafond du mois" };
  }
  if (!Number.isInteger(input.creesAujourdhui) || input.creesAujourdhui < 0) {
    return { autorise: false, raison: "compteur du jour invalide" };
  }
  const r = resoudreRythmeEquipe({
    [CLE_ARTICLES_MAX_JOUR]: input.rythme?.articlesMaxJour,
    [CLE_MAJ_MAX_JOUR]: input.rythme?.majMaxJour,
  });
  const max = input.nature === "article" ? r.articlesMaxJour : r.majMaxJour;
  if (input.creesAujourdhui >= max) {
    return {
      autorise: false,
      raison:
        input.nature === "article"
          ? `plafond de ${max} nouvel(s) article(s) par jour atteint`
          : `plafond de ${max} mise(s) à jour par jour atteint`,
    };
  }
  return { autorise: true };
}
