/**
 * Content Generator — reprise du retard (drain des échecs + déblocage des jobs figés).
 *
 * Ajouté 2026-08-15 (audit e2e). Le système sort de trois pannes de crédit
 * provider et porte, au 15/08 : 1 532 jobs `failed` (dont ~1 340 pour cause de
 * quota/réseau, donc parfaitement régénérables) et 56 jobs figés en
 * `quality_improving` depuis le 20/07.
 *
 * ## Pourquoi ce module est nécessaire
 *
 * Un slot de campagne est consommé À VIE : `generatedCount` s'incrémente à
 * l'enqueue et n'est jamais décrémenté ; l'orchestrateur ne repasse jamais sur un
 * slot servi. Une fois le crédit rechargé, la production reprend donc sur des
 * slots NEUFS, et les 1 500 contenus perdus le restent définitivement — sauf à
 * relancer explicitement leurs jobs. C'est ce trou que ce module comble, et il le
 * fait sans jamais rien perdre : on relance les LIGNES EXISTANTES (même `id`,
 * même `slotIndex`, même `idempotencyKey`), on n'en crée aucune.
 *
 * ## Deux mécanismes distincts
 *
 * 1. `drainFailedJobs` — relance les échecs de cause EXTERNE et passagère
 *    (cf. `failure-classifier.ts`), par petits lots. Les échecs de qualité sont
 *    laissés de côté : les relancer reproduirait le même résultat en dépensant
 *    du crédit.
 *
 * 2. `sweepStuckJobs` — remet en circulation les jobs figés dans un état
 *    non terminal alors que plus aucun job BullMQ ne les porte. C'est la classe
 *    de panne « zombie » déjà documentée : un statut en base sans exécutant.
 *
 * ## Garde-fous
 *
 * - Rythmé : plafond par tick ET plafond quotidien, pour que la reprise s'étale
 *   au lieu de vider le crédit rechargé en quelques minutes (concurrence 3).
 * - Borné : au-delà de `maxRetries` tentatives, un job n'est plus repris.
 * - Réutilise `resolveReenqueueAction` (fix #342) : jamais de `add` sur une clé
 *   squattée par un job terminé, jamais de `remove` sur un job en vol.
 * - Fail-open : toute erreur est journalisée sans interrompre le tick.
 */

import type { Queue } from "bullmq";
import { prisma } from "@/lib/prisma";
import { resolveReenqueueAction, type BullJobState } from "../queue/reenqueue-policy";
import { isAutoRetryable, isTopicStillFresh } from "./failure-classifier";

/** Réglages de la reprise, surchargeables via la clé ContentGenConfig `backlog_recovery`. */
export interface BacklogRecoverySettings {
  /** Drain des échecs actif. */
  readonly enabled: boolean;
  /** Nombre maximum de jobs relancés par tick (96 ticks/jour). */
  readonly maxPerTick: number;
  /**
   * Plafond quotidien PROPRE aux relances.
   *
   * Depuis le 2026-08-15, ce n'est plus le plafond qui compte en pratique : le
   * tick de l'orchestrateur impose au-dessus un **plafond quotidien GLOBAL**
   * partagé avec la production neuve (décision Will : 20 contenus/jour tous
   * canaux confondus). Ce champ reste comme garde-fou secondaire, utile quand la
   * reprise est appelée hors du tick.
   */
  readonly maxPerDay: number;
  /** Nombre de tentatives au-delà duquel un job n'est plus repris. */
  readonly maxRetries: number;
  /** Âge (minutes) au-delà duquel un job non terminal est considéré figé. */
  readonly stuckAfterMinutes: number;
}

export const DEFAULT_RECOVERY_SETTINGS: BacklogRecoverySettings = {
  enabled: true,
  maxPerTick: 5,
  // Aligné sur le plafond global de 20/jour (décision Will 2026-08-15) : la
  // reprise ne doit jamais, à elle seule, dépasser ce que le système entier
  // s'autorise sur une journée.
  maxPerDay: 20,
  maxRetries: 3,
  // 60 min : très au-dessus de la durée d'un job (lock BullMQ = 120 s) et des
  // pauses de kill switch courtes, donc aucun risque de doubler un job vivant.
  stuckAfterMinutes: 60,
};

export interface RecoveryOutcome {
  /** Jobs remis en file. */
  readonly requeued: number;
  /** Jobs examinés puis écartés (cause permanente, budget épuisé, job en vol). */
  readonly skipped: number;
}

const MS_PER_MINUTE = 60_000;

/**
 * Remet un ContentGenJob en file d'attente sans jamais dupliquer un job vivant.
 *
 * Applique le motif du fix #342 : on interroge l'état BullMQ de la clé
 * `gen-<id>`, on ne touche pas à un job en vol, et on supprime la clé d'un job
 * terminé avant de ré-enfiler (sans quoi BullMQ ignorerait le `add` en silence
 * et fabriquerait un zombie).
 *
 * @returns true si le job a réellement été remis en file.
 */
export async function requeueContentGenJob(
  queue: Queue,
  job: {
    readonly id: string;
    readonly contentType: string;
    readonly targetSearchIntent: string;
    readonly inputPayload: unknown;
    readonly retryCount: number;
  },
): Promise<boolean> {
  const jobId = `gen-${job.id}`;
  const existing = await queue.getJob(jobId);
  const state = existing ? ((await existing.getState()) as BullJobState) : null;
  const action = resolveReenqueueAction(state);

  if (action === "skip-in-flight") return false;
  if (action === "remove-then-enqueue" && existing) {
    await existing.remove();
  }

  // Le statut DB passe à `queued` AVANT le `add` : si le `add` échoue, le job
  // reste visible comme en attente et le tick suivant le reprendra (plutôt qu'un
  // job enfilé que la base croirait encore en échec).
  await prisma.contentGenJob.update({
    where: { id: job.id },
    data: {
      status: "queued",
      retryCount: { increment: 1 },
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    },
  });

  await queue.add(
    "generate",
    {
      contentGenJobId: job.id,
      contentType: job.contentType,
      targetSearchIntent: job.targetSearchIntent,
      inputPayload: job.inputPayload,
    },
    { jobId },
  );
  return true;
}

/**
 * Relance un lot d'échecs de cause externe et passagère.
 *
 * Ne crée aucun job : les lignes existantes sont réutilisées, donc aucun slot de
 * campagne n'est consommé et aucun contenu déjà produit n'est touché.
 */
export async function drainFailedJobs(
  queue: Queue,
  settings: BacklogRecoverySettings,
  /**
   * Budget imposé par l'appelant pour ce tick (plafond quotidien GLOBAL partagé
   * avec la production neuve). Quand il est fourni, il prime : la reprise ne
   * peut pas puiser au-delà de ce que le système entier s'autorise ce jour-là.
   */
  sharedBudget?: number,
): Promise<RecoveryOutcome> {
  if (!settings.enabled || settings.maxPerTick <= 0) return { requeued: 0, skipped: 0 };
  if (sharedBudget !== undefined && sharedBudget <= 0) return { requeued: 0, skipped: 0 };

  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  // Plafond quotidien des relances. Un job relancé porte `retryCount > 0` et un
  // `updatedAt` du jour. Volontairement SANS filtre de statut : un job relancé
  // puis re-tombé en échec doit rester compté, sinon un provider durablement
  // dégradé ferait boucler la reprise bien au-delà du plafond. La mesure est
  // approchée par excès, ce qui est le bon côté pour une garde de dépense.
  const alreadyToday = await prisma.contentGenJob.count({
    where: { retryCount: { gt: 0 }, updatedAt: { gte: startOfDayUtc } },
  });
  const dailyRoom = Math.max(0, settings.maxPerDay - alreadyToday);
  if (dailyRoom === 0) return { requeued: 0, skipped: 0 };

  const budget = Math.min(settings.maxPerTick, dailyRoom, sharedBudget ?? Number.MAX_SAFE_INTEGER);
  if (budget <= 0) return { requeued: 0, skipped: 0 };

  // On lit un peu plus large que le budget : une partie des candidats sera
  // écartée par la classification (échecs de qualité mêlés aux échecs d'infra).
  const candidates = await prisma.contentGenJob.findMany({
    where: { status: "failed", retryCount: { lt: settings.maxRetries } },
    orderBy: { updatedAt: "asc" },
    take: budget * 6,
    select: {
      id: true,
      contentType: true,
      targetSearchIntent: true,
      inputPayload: true,
      retryCount: true,
      errorMessage: true,
    },
  });

  let requeued = 0;
  let skipped = 0;
  for (const job of candidates) {
    if (requeued >= budget) break;
    // Le job est passé en entier au test : la fraîcheur du sujet se juge sur sa
    // charge utile, pas sur son message d'erreur (incident RSS du 2026-08-15).
    if (!isAutoRetryable(job.errorMessage, job.retryCount, settings.maxRetries, job)) {
      skipped++;
      continue;
    }
    try {
      const ok = await requeueContentGenJob(queue, job);
      if (ok) requeued++;
      else skipped++;
    } catch (err) {
      // Isolation par job : une exception sur le job k ne doit pas empêcher
      // k+1..N d'être repris (leçon du fix `retryAllFailed`).
      skipped++;
      console.warn(
        `[backlog-recovery] relance échouée job=${job.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { requeued, skipped };
}

/**
 * Remet en circulation les jobs figés dans un état non terminal.
 *
 * Trois familles, toutes constatées en production :
 *  - `running` / `generating_*` / `running_qa` anciens : le worker est mort en
 *    cours de route (redéploiement, OOM) et plus rien ne les porte ;
 *  - `queued` anciens sans job BullMQ : les fameux zombies.
 *
 * Les jobs figés en `quality_improving` sont traités séparément par
 * `sweepStrandedQualityJobs` : ils portent déjà un contenu généré qu'il ne faut
 * surtout pas régénérer.
 *
 * Le garde-fou décisif est `resolveReenqueueAction` : un job encore en vol
 * renvoie `skip-in-flight` et n'est pas touché. On ne double donc jamais un
 * traitement en cours, quel que soit son âge.
 */
export async function sweepStuckJobs(
  queue: Queue,
  settings: BacklogRecoverySettings,
  /** Budget partagé du tick (cf. `drainFailedJobs`). Prime quand il est fourni. */
  sharedBudget?: number,
): Promise<RecoveryOutcome> {
  if (sharedBudget !== undefined && sharedBudget <= 0) return { requeued: 0, skipped: 0 };
  const threshold = new Date(Date.now() - settings.stuckAfterMinutes * MS_PER_MINUTE);

  const stuck = await prisma.contentGenJob.findMany({
    where: {
      status: { in: ["queued", "running", "generating_text", "generating_image", "running_qa"] },
      updatedAt: { lt: threshold },
    },
    orderBy: { updatedAt: "asc" },
    take: Math.max(1, settings.maxPerTick) * 4,
    select: {
      id: true,
      contentType: true,
      targetSearchIntent: true,
      inputPayload: true,
      retryCount: true,
      status: true,
    },
  });

  let requeued = 0;
  let skipped = 0;
  for (const job of stuck) {
    if (sharedBudget !== undefined && requeued >= sharedBudget) break;
    if (job.retryCount >= settings.maxRetries) {
      skipped++;
      continue;
    }
    // Même garde que le drain : un job figé qui porte une dépêche périmée ne
    // doit pas être remis en circulation (incident RSS du 2026-08-15).
    if (!isTopicStillFresh(job.contentType, job.inputPayload)) {
      skipped++;
      continue;
    }
    try {
      const ok = await requeueContentGenJob(queue, job);
      if (ok) {
        requeued++;
        console.warn(
          `[backlog-recovery] job figé remis en file id=${job.id} (était ${job.status})`,
        );
      } else {
        skipped++;
      }
    } catch (err) {
      skipped++;
      console.warn(
        `[backlog-recovery] déblocage échoué job=${job.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { requeued, skipped };
}

/**
 * Remet en circulation les jobs figés en `quality_improving`.
 *
 * Traités à part des autres jobs figés, et pour une raison importante : ces jobs
 * ONT DÉJÀ un contenu généré (`outputJsonRaw`). Les renvoyer vers `content-gen`
 * le régénérerait de zéro — donc jetterait un contenu déjà payé, et
 * re-dépenserait pour l'obtenir. On les réinjecte dans la boucle qualité, qui
 * reprend l'évaluation là où elle s'était arrêtée.
 *
 * Cas constaté au 15/08 : 56 jobs figés depuis le 20/07, victimes du jobId fixe
 * `quality-<id>` (la 2ᵉ passe était silencieusement dédupliquée par BullMQ) et de
 * l'action « Demander des modifications », qui posait le statut sans jamais rien
 * enfiler. Les deux causes sont corrigées par ailleurs ; ce balayage rattrape les
 * jobs déjà bloqués.
 *
 * Le jobId inclut le numéro de tentative : aucune collision possible avec la clé
 * d'une passe précédente restée en mémoire dans Redis.
 */
export async function sweepStrandedQualityJobs(
  improverQueue: Queue,
  settings: BacklogRecoverySettings,
): Promise<RecoveryOutcome> {
  const threshold = new Date(Date.now() - settings.stuckAfterMinutes * MS_PER_MINUTE);

  const stranded = await prisma.contentGenJob.findMany({
    where: { status: "quality_improving", updatedAt: { lt: threshold } },
    orderBy: { updatedAt: "asc" },
    take: Math.max(1, settings.maxPerTick) * 4,
    select: { id: true, qualityScore: true, qualityImprovementAttempts: true },
  });

  let requeued = 0;
  let skipped = 0;
  for (const job of stranded) {
    const jobId = `quality-${job.id}-a${job.qualityImprovementAttempts}`;
    try {
      const existing = await improverQueue.getJob(jobId);
      const state = existing ? ((await existing.getState()) as BullJobState) : null;
      const action = resolveReenqueueAction(state);
      if (action === "skip-in-flight") {
        skipped++;
        continue;
      }
      if (action === "remove-then-enqueue" && existing) {
        await existing.remove();
      }
      await improverQueue.add(
        "improve",
        { contentGenJobId: job.id, previousScore: job.qualityScore ?? 0 },
        { jobId },
      );
      requeued++;
    } catch (err) {
      skipped++;
      console.warn(
        `[backlog-recovery] réinjection boucle qualité échouée job=${job.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (requeued > 0) {
    console.warn(`[backlog-recovery] ${requeued} job(s) figé(s) en boucle qualité réinjecté(s)`);
  }
  return { requeued, skipped };
}
