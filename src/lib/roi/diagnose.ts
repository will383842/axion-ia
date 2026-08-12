// Simulateur de gains v2 — LE MOTEUR.
//
// Transforme les réponses du questionnaire en rapport complet. Pure compute :
// aucun import React, aucun I/O, aucune date — donc utilisable à l'identique
// dans le navigateur (rendu live), sur le serveur (PDF, e-mail) et en test.
//
// ── Chaîne de calcul, pour une tâche ──────────────────────────────────────
//   volume_annuel  = réponse × facteur d'annualisation de la grandeur
//   minutes        = minutes de référence × facteur sectoriel
//   heures_actuel  = volume_annuel × minutes / 60
//   heures_gagnées = heures_actuel × taux d'automatisation × facteur maturité
//   fourchette     = heures_gagnées × (1 ∓ écart lié à la confiance)
//   euros          = heures_gagnées × coût horaire chargé
//
// ── Trois garde-fous, dans cet ordre ──────────────────────────────────────
//   1. Une grandeur non renseignée EXCLUT sa tâche. Jamais d'estimation au
//      jugé : le rapport annonce moins que la réalité, jamais plus.
//   2. Une tâche sectorielle est écartée hors de ses secteurs, et écartée tout
//      court en profil générique — on ne prétend pas connaître un métier que
//      l'utilisateur n'a pas nommé.
//   3. Le total est plafonné à `CAPACITY_GUARD_SHARE` de la capacité de
//      l'équipe (cf. le commentaire de cette constante).

import {
  ANNUALIZATION,
  CAPACITY_GUARD_SHARE,
  CONFIDENCE_SPREAD,
  CONFIDENCE_WEIGHT,
  MATURITY_LEVELS,
  HEADCOUNT_BANDS,
  ROI_MODEL_CONSTANTS,
  type AutomatableTask,
  type BusinessFunction,
  type FunctionResult,
  type NonAutomatableTask,
  type RoadmapWave,
  type RoiAnswers,
  type RoiReport,
  type TaskResult,
} from "@/content/roi/model/types";
import { AUTOMATABLE_TASKS } from "@/content/roi/model/tasks";
import { NON_AUTOMATABLE_TASKS } from "@/content/roi/model/non-automatable";
import { VOLUME_DEFS } from "@/content/roi/model/functions";
import type { ClientSectorSlug } from "@/content/sectors";

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const VOLUME_PERIOD = new Map(VOLUME_DEFS.map((v) => [v.key, v.period]));

/** Effectif retenu pour les calculs — la médiane de la tranche déclarée. */
export function headcountOf(answers: RoiAnswers): number {
  return HEADCOUNT_BANDS.find((b) => b.id === answers.headcount)?.midpoint ?? 1;
}

/** Coût horaire chargé retenu, borné aux valeurs plausibles. */
export function hourlyCostOf(answers: RoiAnswers): number {
  const raw = answers.hourlyCostEur ?? ROI_MODEL_CONSTANTS.defaultHourlyCostEur;
  return clamp(raw, ROI_MODEL_CONSTANTS.hourlyCostMinEur, ROI_MODEL_CONSTANTS.hourlyCostMaxEur);
}

/**
 * Une tâche est-elle applicable au secteur déclaré ?
 *
 * Une tâche sans champ `sectors` est transversale : toujours applicable. Une
 * tâche sectorielle n'est retenue que pour ses secteurs — et jamais en profil
 * générique, où nous n'avons pas assez d'information pour affirmer qu'elle
 * concerne l'entreprise.
 */
export function isTaskApplicable(
  task: AutomatableTask,
  sector: ClientSectorSlug | "generique",
): boolean {
  if (!task.sectors) return true;
  if (sector === "generique") return false;
  return task.sectors.includes(sector);
}

// ---------------------------------------------------------------------------
// Calcul d'une tâche
// ---------------------------------------------------------------------------

interface TaskContext {
  readonly sector: ClientSectorSlug | "generique";
  readonly maturityFactor: number;
  readonly weeksPenalty: number;
  readonly hourlyCostEur: number;
}

/**
 * Chiffre une tâche. Retourne `null` quand la tâche ne s'applique pas, quand la
 * grandeur n'a pas été renseignée, ou quand le volume déclaré est nul — un
 * dirigeant qui ne publie rien n'a pas à lire une ligne « publications ».
 */
function computeTask(
  task: AutomatableTask,
  answers: RoiAnswers,
  ctx: TaskContext,
): TaskResult | null {
  if (!isTaskApplicable(task, ctx.sector)) return null;

  const volume = answers.volumes[task.volumeKey];
  if (volume === undefined || volume === null || volume <= 0) return null;

  const period = VOLUME_PERIOD.get(task.volumeKey);
  if (!period) return null;

  const annualVolume = volume * ANNUALIZATION[period];

  const sectorFactor =
    ctx.sector === "generique" ? 1 : (task.sectorMinutesFactor?.[ctx.sector] ?? 1);
  const minutesPerUnit = task.minutesPerUnit * sectorFactor;

  const currentHoursPerYear = (annualVolume * minutesPerUnit) / 60;
  const savedHoursPerYear = currentHoursPerYear * task.automationRate * ctx.maturityFactor;

  const spread = CONFIDENCE_SPREAD[task.confidence];

  // La pénalité de maturité s'applique à proportion de l'EFFORT, pas
  // uniformément. Une entreprise encore sur papier met effectivement plus
  // longtemps à brancher sa facturation sur son logiciel de gestion (effort 5,
  // pénalité pleine) — mais elle peut faire rédiger ses comptes-rendus dès la
  // semaine prochaine, exactement comme une entreprise outillée (effort 1,
  // pénalité nulle). Appliquer la pénalité à plat repoussait les gains
  // immédiats hors de la première vague, ce qui privait précisément les
  // entreprises les moins matures du seul plan qu'elles peuvent suivre.
  const weeksToValue = Math.round(task.weeksToValue + ctx.weeksPenalty * ((task.effort - 1) / 4));

  // Le score récompense le gain, pénalise l'effort ET le délai, et corrige par
  // la confiance : un gain énorme mais incertain et lointain ne doit pas passer
  // devant un gain modeste, sûr et disponible la semaine prochaine.
  const priorityScore =
    (savedHoursPerYear * CONFIDENCE_WEIGHT[task.confidence]) / (task.effort + weeksToValue / 4);

  return {
    task,
    annualVolume,
    minutesPerUnit,
    currentHoursPerYear,
    savedHoursPerYear,
    savedHoursLow: savedHoursPerYear * (1 - spread),
    savedHoursHigh: savedHoursPerYear * (1 + spread),
    savedEurPerYear: savedHoursPerYear * ctx.hourlyCostEur,
    weeksToValue,
    priorityScore,
  };
}

/** Applique un facteur d'échelle à un résultat de tâche (garde-fou de capacité). */
function scaleTask(r: TaskResult, factor: number): TaskResult {
  return {
    ...r,
    currentHoursPerYear: r.currentHoursPerYear * factor,
    savedHoursPerYear: r.savedHoursPerYear * factor,
    savedHoursLow: r.savedHoursLow * factor,
    savedHoursHigh: r.savedHoursHigh * factor,
    savedEurPerYear: r.savedEurPerYear * factor,
    priorityScore: r.priorityScore * factor,
  };
}

// ---------------------------------------------------------------------------
// Feuille de route
// ---------------------------------------------------------------------------

const WAVE_DEFS = [
  { id: "wave1", labelFr: "Ce que vous pouvez lancer tout de suite", horizonFr: "30 jours" },
  { id: "wave2", labelFr: "Ce qui demande un peu de préparation", horizonFr: "3 mois" },
  { id: "wave3", labelFr: "Les chantiers de fond", horizonFr: "6 mois" },
] as const;

/**
 * Répartit les tâches en trois vagues selon leur délai réel de mise en œuvre
 * (pénalité de maturité comprise). Le classement à l'intérieur d'une vague suit
 * le score de priorité.
 */
function buildRoadmap(tasks: readonly TaskResult[]): readonly RoadmapWave[] {
  const buckets: Record<RoadmapWave["id"], TaskResult[]> = { wave1: [], wave2: [], wave3: [] };

  for (const r of tasks) {
    // Les seuils collent aux horizons ANNONCÉS : ce qui est promis à 30 jours
    // doit être livrable en 4 semaines, sinon la feuille de route ment.
    if (r.weeksToValue <= 4) buckets.wave1.push(r);
    else if (r.weeksToValue <= 12) buckets.wave2.push(r);
    else buckets.wave3.push(r);
  }

  return WAVE_DEFS.map((def) => {
    const items = buckets[def.id];
    return {
      id: def.id,
      labelFr: def.labelFr,
      horizonFr: def.horizonFr,
      taskIds: items.map((r) => r.task.id),
      savedHoursPerYear: Math.round(items.reduce((s, r) => s + r.savedHoursPerYear, 0)),
      savedEurPerYear: Math.round(items.reduce((s, r) => s + r.savedEurPerYear, 0)),
    };
  }).filter((w) => w.taskIds.length > 0);
}

// ---------------------------------------------------------------------------
// Ce qui ne s'automatise pas
// ---------------------------------------------------------------------------

/**
 * Choisit les mises en garde à afficher : d'abord celles propres au secteur
 * déclaré (les plus percutantes, parce qu'elles prouvent qu'on connaît le
 * métier), puis les transversales rattachées à une fonction déclarée présente.
 */
export function selectNonAutomatable(
  sector: ClientSectorSlug | "generique",
  functions: readonly BusinessFunction[],
  limit = 3,
): readonly NonAutomatableTask[] {
  const fnSet = new Set(functions);

  const sectorial =
    sector === "generique" ? [] : NON_AUTOMATABLE_TASKS.filter((t) => t.sectors?.includes(sector));

  const transversal = NON_AUTOMATABLE_TASKS.filter((t) => !t.sectors && fnSet.has(t.fn));

  // Repli : si le dirigeant n'a coché aucune fonction correspondante, on montre
  // quand même des mises en garde générales plutôt qu'un bloc vide.
  const fallback = NON_AUTOMATABLE_TASKS.filter((t) => !t.sectors);

  const ordered = [...sectorial, ...transversal, ...fallback];
  const seen = new Set<string>();
  const out: NonAutomatableTask[] = [];
  for (const t of ordered) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Moteur
// ---------------------------------------------------------------------------

export function diagnose(answers: RoiAnswers): RoiReport {
  const hourlyCostEur = hourlyCostOf(answers);
  const headcount = headcountOf(answers);
  const maturity = MATURITY_LEVELS.find((m) => m.id === answers.maturity) ?? MATURITY_LEVELS[2]!;

  const ctx: TaskContext = {
    sector: answers.sector,
    maturityFactor: maturity.factor,
    weeksPenalty: maturity.weeksPenalty,
    hourlyCostEur,
  };

  let results = AUTOMATABLE_TASKS.map((t) => computeTask(t, answers, ctx)).filter(
    (r): r is TaskResult => r !== null,
  );

  // ── Garde-fou de capacité ────────────────────────────────────────────────
  // Les volumes sont déclarés par tranche : rien n'empêche un dirigeant de trois
  // personnes de cocher partout la tranche haute. On ramène alors l'ensemble à
  // une part plausible de la capacité de l'équipe, proportionnellement, pour ne
  // pas privilégier arbitrairement une tâche sur une autre.
  const teamCapacityHours = headcount * ROI_MODEL_CONSTANTS.annualHoursPerFte;
  const rawCurrentHours = results.reduce((s, r) => s + r.currentHoursPerYear, 0);
  const capacityCeiling = teamCapacityHours * CAPACITY_GUARD_SHARE;
  const capacityCapped = rawCurrentHours > capacityCeiling && rawCurrentHours > 0;
  if (capacityCapped) {
    const factor = capacityCeiling / rawCurrentHours;
    results = results.map((r) => scaleTask(r, factor));
  }

  results.sort((a, b) => b.priorityScore - a.priorityScore);

  // ── Totaux ───────────────────────────────────────────────────────────────
  const totalCurrentHoursPerYear = results.reduce((s, r) => s + r.currentHoursPerYear, 0);
  const totalSavedHoursPerYear = results.reduce((s, r) => s + r.savedHoursPerYear, 0);
  const totalSavedHoursLow = results.reduce((s, r) => s + r.savedHoursLow, 0);
  const totalSavedHoursHigh = results.reduce((s, r) => s + r.savedHoursHigh, 0);

  // ── Ventilation par fonction ─────────────────────────────────────────────
  const byFunctionMap = new Map<BusinessFunction, { hours: number; count: number }>();
  for (const r of results) {
    const acc = byFunctionMap.get(r.task.fn) ?? { hours: 0, count: 0 };
    acc.hours += r.savedHoursPerYear;
    acc.count += 1;
    byFunctionMap.set(r.task.fn, acc);
  }
  const byFunction: FunctionResult[] = [...byFunctionMap.entries()]
    .map(([fn, acc]) => ({
      fn,
      savedHoursPerYear: Math.round(acc.hours),
      savedEurPerYear: Math.round(acc.hours * hourlyCostEur),
      sharePct:
        totalSavedHoursPerYear > 0 ? Math.round((acc.hours / totalSavedHoursPerYear) * 100) : 0,
      taskCount: acc.count,
    }))
    .sort((a, b) => b.savedHoursPerYear - a.savedHoursPerYear);

  // ── Fonctions déclarées mais non mesurées ────────────────────────────────
  // `direction` est exclue : elle n'a délibérément aucune question de volume
  // (son temps est déjà compté via les comptes-rendus et les reportings), donc
  // la signaler comme « non mesurée » serait un faux signal.
  const measuredFns = new Set(results.map((r) => r.task.fn));
  const unmeasuredFunctions = answers.functions.filter(
    (fn) => fn !== "direction" && !measuredFns.has(fn),
  );

  return {
    answers,
    hourlyCostEur,
    headcount,
    tasks: results,
    topTasks: results.slice(0, ROI_MODEL_CONSTANTS.topTasksInReport),
    byFunction,
    roadmap: buildRoadmap(results),
    nonAutomatable: selectNonAutomatable(answers.sector, answers.functions),
    totalCurrentHoursPerYear: Math.round(totalCurrentHoursPerYear),
    totalSavedHoursPerYear: Math.round(totalSavedHoursPerYear),
    totalSavedHoursLow: Math.round(totalSavedHoursLow),
    totalSavedHoursHigh: Math.round(totalSavedHoursHigh),
    totalSavedEurPerYear: Math.round(totalSavedHoursPerYear * hourlyCostEur),
    totalSavedEurLow: Math.round(totalSavedHoursLow * hourlyCostEur),
    totalSavedEurHigh: Math.round(totalSavedHoursHigh * hourlyCostEur),
    fteRecovered: round1(totalSavedHoursPerYear / ROI_MODEL_CONSTANTS.annualHoursPerFte),
    daysFreedPerMonth: Math.round(totalSavedHoursPerYear / ROI_MODEL_CONSTANTS.hoursPerDay / 12),
    pctOfTeamCapacity:
      teamCapacityHours > 0 ? Math.round((totalSavedHoursPerYear / teamCapacityHours) * 100) : 0,
    unmeasuredFunctions,
    isEmpty: results.length === 0,
    capacityCapped,
  };
}
