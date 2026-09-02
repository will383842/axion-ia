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
 * - Borné : au-delà de `maxRetries` tentatives, un job n'est plus repris — et,
 *   s'il était figé dans un état non terminal, il est CLOS plutôt que laissé
 *   en place (sans quoi il affame la fenêtre du balayage, cf. `sweepStuckJobs`).
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
  /**
   * Part du plafond quotidien GLOBAL que la reprise peut consommer (0 à 1).
   *
   * 2026-09-02 — sans cette part, la reprise, servie AVANT les campagnes et
   * dotée d'un `maxPerDay` (20) supérieur au plafond global (15), absorbait
   * tout le budget du jour : 1 385 échecs à rejouer, soit 4 à 5 mois pendant
   * lesquels les campagnes `running` n'auraient produit AUCUN contenu neuf.
   * À 0,5, la reprise prend au plus la moitié du plafond ; le reste va aux
   * campagnes. Surchargeable via la clé `backlog_recovery`.
   */
  readonly shareOfDailyCap: number;
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
  shareOfDailyCap: 0.5,
};

export interface RecoveryOutcome {
  /** Jobs remis en file. */
  readonly requeued: number;
  /** Jobs examinés puis écartés (budget épuisé, job en vol, erreur isolée). */
  readonly skipped: number;
  /**
   * Jobs irrécupérables passés en état TERMINAL par ce passage.
   *
   * Distinct de `skipped` à dessein : un job écarté sera réexaminé au tick
   * suivant, un job clos ne le sera plus jamais. Confondre les deux, c'est
   * exactement ce qui a rendu la famine de fenêtre invisible pendant 12 jours
   * (cf. `sweepStuckJobs`).
   */
  readonly closed: number;
}

/**
 * Préfixe commun des motifs écrits par `resolveStuckClosure`.
 *
 * Il sert de marqueur : un job `failed` dont le message commence ainsi a été
 * CLOS par le balayage, pas relancé. `requeuedTodayWhere` s'en sert pour ne pas
 * le compter comme une dépense du jour. Une seule définition, dérivée des deux
 * côtés — la recopier ailleurs recréerait le fantôme.
 */
export const STUCK_CLOSURE_PREFIX = "Job figé clos automatiquement : ";

/**
 * Clause Prisma « jobs RELANCÉS depuis `startOfDay` », partagée par le drain
 * (`alreadyToday`) et par l'orchestrateur (`requeuedTodayAll`).
 *
 * 🔴 2026-09-02 — le fantôme qui a décalé la reprise de 08:15 à 09:45 UTC.
 *
 * L'ancien comptage lisait `retryCount > 0 AND updatedAt >= minuit`, sans
 * filtre de statut, avec cette justification : « un job relancé puis re-tombé
 * en échec doit rester compté ». Juste — mais un job CLOS ce jour-là porte
 * exactement la même signature : l'arbitrage manuel du 02/09 a passé en
 * `cancelled` un job à `retryCount = 2`, et le budget global l'a compté comme
 * une relance (6/15 consommés au lieu de 5). Idem pour les clôtures du balayage
 * (`closeStuckJob`) : 21 jobs clos `failed` le 01/09, tous à `retryCount = 3`,
 * tous comptés comme des relances du jour.
 *
 * Ce qui distingue une relance d'une clôture, en base :
 *  - `cancelled` n'est JAMAIS l'issue d'une relance (queued → running →
 *    published / needs_review / quarantined / failed) ;
 *  - un `failed` de clôture porte le motif `STUCK_CLOSURE_PREFIX` ; un `failed`
 *    de relance porte l'erreur du provider.
 * Un `failed` d'arbitrage manuel n'existe pas (l'arbitrage écrit `cancelled`).
 *
 * La mesure reste approchée par excès pour tout le reste, qui est le bon côté
 * pour une garde de dépense.
 */
export function requeuedTodayWhere(startOfDay: Date) {
  return {
    retryCount: { gt: 0 },
    updatedAt: { gte: startOfDay },
    ...CLOSED_WITHOUT_RUNNING_EXCLUSION,
  } as const;
}

/** Un `failed` écrit par `closeStuckJob` : clos par le balayage, jamais exécuté. */
export const STUCK_CLOSURE_FAILED_WHERE = {
  status: "failed",
  errorMessage: { startsWith: STUCK_CLOSURE_PREFIX },
} as const;

/**
 * Exclut d'un comptage les jobs qui ont été CLOS sans avoir tourné : les
 * `cancelled` (arbitrage humain ou sujet périmé) et les `failed` de clôture.
 *
 * Partagée par le budget du jour (`requeuedTodayWhere`) et par l'alarme de
 * taux de rejet du monitoring : le 02/09, celle-ci annonçait « 27/50 (54 %)
 * sur 24 h » alors que 21 de ces 27 « rejets » étaient des clôtures du
 * balayage et 14 du dénominateur des annulations — aucun n'avait consommé un
 * appel provider. Une alarme de rejet mesure ce que la MACHINE n'a pas réussi ;
 * un job qu'on a renoncé à lancer n'en fait pas partie.
 */
export const CLOSED_WITHOUT_RUNNING_EXCLUSION = {
  status: { not: "cancelled" },
  NOT: STUCK_CLOSURE_FAILED_WHERE,
} as const;

/**
 * Budget que la reprise peut consommer sur ce tick.
 *
 * Fonction PURE : `min(budget global restant, part quotidienne de la reprise
 * moins ce qu'elle a déjà relancé aujourd'hui)`. La part est bornée à ]0, 1] ;
 * une valeur absente ou aberrante retombe sur la part par défaut, jamais sur
 * « tout le budget » — c'est précisément la dérive qu'on corrige.
 */
export function computeRecoveryRoom(input: {
  readonly capPerDay: number;
  readonly shareOfDailyCap: number | undefined;
  readonly requeuedToday: number;
  readonly globalRoom: number;
}): number {
  const raw = input.shareOfDailyCap;
  const share =
    typeof raw === "number" && Number.isFinite(raw) && raw > 0 && raw <= 1
      ? raw
      : DEFAULT_RECOVERY_SETTINGS.shareOfDailyCap;
  const dailyShare = Math.floor(Math.max(0, input.capPerDay) * share);
  const shareRoom = Math.max(0, dailyShare - Math.max(0, input.requeuedToday));
  return Math.max(0, Math.min(input.globalRoom, shareRoom));
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
  if (!settings.enabled || settings.maxPerTick <= 0) return { requeued: 0, skipped: 0, closed: 0 };
  if (sharedBudget !== undefined && sharedBudget <= 0)
    return { requeued: 0, skipped: 0, closed: 0 };

  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  // Plafond quotidien des relances. Un job relancé porte `retryCount > 0` et un
  // `updatedAt` du jour. Un job relancé puis re-tombé en échec reste compté,
  // sinon un provider durablement dégradé ferait boucler la reprise bien
  // au-delà du plafond — mais un job CLOS ce jour-là n'est pas une relance,
  // cf. `requeuedTodayWhere`.
  const alreadyToday = await prisma.contentGenJob.count({
    where: requeuedTodayWhere(startOfDayUtc),
  });
  const dailyRoom = Math.max(0, settings.maxPerDay - alreadyToday);
  if (dailyRoom === 0) return { requeued: 0, skipped: 0, closed: 0 };

  const budget = Math.min(settings.maxPerTick, dailyRoom, sharedBudget ?? Number.MAX_SAFE_INTEGER);
  if (budget <= 0) return { requeued: 0, skipped: 0, closed: 0 };

  // 🔴 2026-09-01 — LA MÊME FAMINE DE FENÊTRE QUE `sweepStuckJobs`, EN PIRE.
  //
  // L'ancien code lisait UNE page de `budget * 6` lignes (30 au plus) et
  // espérait y trouver de quoi remplir le budget. Mesuré en production ce
  // jour-là, sur les 1 441 échecs encore relançables :
  //
  //   rang 1 à 29  : échecs PERMANENTS (« plan invalide », « aucun output
  //                  valide », « quality_gate », parse errors) — début juillet
  //   rang 30      : le PREMIER échec relançable
  //   rangs 30+    : 1 383 échecs de quota, tous parfaitement régénérables
  //
  // La fenêtre s'ouvrait donc sur 29 cadavres. Ils sont écartés par
  // `isAutoRetryable` mais restent `failed` avec `retryCount < maxRetries`,
  // donc ils reprenaient la même place au tick suivant, indéfiniment. Le drain
  // n'atteignait le premier job relançable que si le budget valait exactement 5
  // — et le budget est lissé sur la journée, donc il vaut le plus souvent 1 à 3.
  // Résultat : le rechargement du crédit n'aurait rien rattrapé du tout.
  //
  // 🔑 Une fenêtre doit être dimensionnée par CE QU'ON CHERCHE, pas par ce
  // qu'on espère trouver. On pagine donc jusqu'à remplir le budget, avec un
  // plafond de balayage par tick.
  //
  // L'offset se calcule exactement, sans champ curseur : les seules lignes qui
  // QUITTENT l'ensemble pendant le tick sont celles qu'on vient de remettre en
  // file (leur statut passe à `queued`), et elles sont toutes derrière nous.
  // La page suivante commence donc à `scanned - requeued`.
  const PAGE_SIZE = Math.max(budget * 6, 100);
  const MAX_SCAN_PER_TICK = 600;
  const candidatesWhere = { status: "failed", retryCount: { lt: settings.maxRetries } } as const;
  const candidatesSelect = {
    id: true,
    contentType: true,
    targetSearchIntent: true,
    inputPayload: true,
    retryCount: true,
    errorMessage: true,
  } as const;

  let requeued = 0;
  let skipped = 0;
  let scanned = 0;

  while (requeued < budget && scanned < MAX_SCAN_PER_TICK) {
    const candidates = await prisma.contentGenJob.findMany({
      where: candidatesWhere,
      // Fix 2026-08-15 — reprise dans l'ORDRE DU PLAN, pas dans l'ordre des échecs.
      //
      // `updatedAt` datait la dernière tentative : les jobs déjà rejoués une fois
      // (la relance-test du 18/07) remontaient donc en tête, et le plan était
      // repris en désordre. `createdAt` est l'ordre dans lequel l'orchestrateur a
      // enfilé les slots — vérifié en base : il suit exactement le `slotIndex`
      // (2, 77, 102, 241, 242…).
      //
      // Ce n'est pas cosmétique. Chaque job en échec porte sa place dans le plan
      // et ce qui en découle : `slotIndex`, type de contenu, ville d'ancrage et
      // intention de recherche, tous échantillonnés déterministement à partir du
      // slot. Reprendre dans cet ordre, c'est rejouer la campagne telle qu'elle
      // avait été conçue, en repartant là où elle s'était interrompue.
      orderBy: { createdAt: "asc" },
      skip: scanned - requeued,
      take: PAGE_SIZE,
      select: candidatesSelect,
    });
    if (candidates.length === 0) break;

    for (const job of candidates) {
      if (requeued >= budget || scanned >= MAX_SCAN_PER_TICK) break;
      scanned++;
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
    if (candidates.length < PAGE_SIZE) break;
  }

  // Le signal qui manquait : un drain qui balaie son plafond sans rien trouver
  // n'est pas « au repos », il est affamé. Sans cette ligne, la famine de
  // fenêtre est parfaitement silencieuse — c'est ce qui l'a laissée vivre.
  if (requeued === 0 && scanned >= MAX_SCAN_PER_TICK) {
    console.warn(
      `[backlog-recovery] drain affamé — ${scanned} candidats balayés, aucun relançable. ` +
        `Tête de file probablement occupée par des échecs permanents.`,
    );
  }

  return { requeued, skipped, closed: 0 };
}

/**
 * Statut terminal et motif d'un job figé que plus aucun passage ne pourra sauver.
 *
 * `null` = le job reste récupérable, il sera remis en file.
 */
export interface StuckClosure {
  readonly status: "failed" | "cancelled";
  readonly reason: string;
}

/**
 * Décide si un job figé est DÉFINITIVEMENT irrécupérable.
 *
 * Fonction PURE (aucun accès BullMQ/Prisma) : c'est la règle métier de la
 * clôture, testable sans mock.
 *
 * Deux causes, toutes deux constatées en production le 2026-09-01 :
 *  - tentatives épuisées : le job a déjà consommé `maxRetries` passages, aucun
 *    passage supplémentaire ne lui est dû ;
 *  - sujet périmé : le job porte une dépêche figée trop vieille pour être
 *    publiée (incident RSS du 2026-08-15). Le relancer republierait du vieux.
 *
 * Le statut retenu diffère selon la cause, et ce n'est pas cosmétique :
 * `failed` dit « la machine n'y est pas arrivée » (il compte dans les échecs et
 * peut être rejoué à la main si Will le décide), `cancelled` dit « on a renoncé
 * volontairement » — c'est le statut employé pour la remédiation des 74 jobs RSS
 * du 2026-08-15, on garde le même vocabulaire.
 */
export function resolveStuckClosure(
  job: {
    readonly contentType: string;
    readonly inputPayload: unknown;
    readonly retryCount: number;
  },
  settings: BacklogRecoverySettings,
): StuckClosure | null {
  if (job.retryCount >= settings.maxRetries) {
    return {
      status: "failed",
      reason:
        `${STUCK_CLOSURE_PREFIX}${job.retryCount} tentative(s) pour un plafond de ` +
        `${settings.maxRetries}. Plus aucune reprise n'est due à ce job.`,
    };
  }
  if (!isTopicStillFresh(job.contentType, job.inputPayload)) {
    return {
      status: "cancelled",
      reason:
        `${STUCK_CLOSURE_PREFIX}le sujet qu'il porte est périmé, le relancer ` +
        "republierait une actualité dépassée.",
    };
  }
  return null;
}

/**
 * Fait passer un job figé irrécupérable dans son état terminal.
 *
 * ⚠️ Garde-fou non négociable : on interroge d'abord BullMQ. Un job encore en
 * vol (`active` / `waiting` / `delayed`) N'EST PAS clos, quel que soit son âge
 * en base — le statut DB peut être en retard sur un traitement bien vivant, et
 * clore un job en cours le rendrait fantôme au moment où il finirait.
 *
 * @returns true si le job a réellement été clos.
 */
export async function closeStuckJob(
  queue: Queue,
  jobId: string,
  closure: StuckClosure,
): Promise<boolean> {
  const existing = await queue.getJob(`gen-${jobId}`);
  const state = existing ? ((await existing.getState()) as BullJobState) : null;
  if (resolveReenqueueAction(state) === "skip-in-flight") return false;

  await prisma.contentGenJob.update({
    where: { id: jobId },
    data: {
      status: closure.status,
      errorMessage: closure.reason,
      completedAt: new Date(),
    },
  });
  return true;
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
 *
 * ## 🔴 Famine de fenêtre — corrigé le 2026-09-01
 *
 * Mesuré en production : **60 jobs `running` figés, dont 20 depuis le 19/08**,
 * alors que ce balayage tournait 96 fois par jour depuis 12 jours. Il n'en avait
 * remis AUCUN en file.
 *
 * La fenêtre est bornée (`take: maxPerTick * 4` = 20) et triée par `updatedAt`
 * croissant. Or les 20 plus anciens portaient tous `retryCount = 3 = maxRetries`.
 * L'ancien code les comptait `skipped` et passait au suivant — mais ils
 * restaient `running` en base, donc ils **revenaient occuper la même fenêtre au
 * tick suivant**, indéfiniment. Les 40 jobs derrière eux, dont une vingtaine
 * parfaitement récupérables, n'ont jamais été regardés.
 *
 * 🔑 **Un candidat écarté sans être retiré de l'ensemble des candidats affame la
 * file qu'il occupe.** Le drain (`drainFailedJobs`) n'a jamais eu le problème :
 * il exclut `retryCount >= maxRetries` **dans la requête SQL**. L'asymétrie
 * entre les deux passages est ce qui a laissé le défaut vivre.
 *
 * Le correctif ne consiste PAS à recopier ce filtre ici : un job exclu de la
 * requête resterait `running` à vie, à mentir dans la console et dans tous les
 * comptages. Un job qu'aucun passage ne peut plus sauver doit passer en état
 * **terminal**, avec son motif écrit dans `errorMessage` (cf.
 * `resolveStuckClosure`). C'est cette clôture qui vide la tête de fenêtre.
 */
export async function sweepStuckJobs(
  queue: Queue,
  settings: BacklogRecoverySettings,
  /**
   * Budget partagé du tick (cf. `drainFailedJobs`). Il plafonne les REMISES EN
   * FILE, pas les clôtures.
   *
   * ⚠️ 2026-09-01, mesuré en production dans l'heure suivant le déploiement du
   * correctif de famine : ce passage portait ici un `return` anticipé dès que le
   * budget valait 0. Or le plafond quotidien est atteint presque tous les jours
   * en fin de journée — le tick a rendu `tickBudget=0`, le balayage s'est arrêté
   * net, et les 59 jobs figés sont restés figés. Le correctif se bloquait
   * lui-même, en contradiction avec son propre commentaire (« clore ne
   * déclenche aucun appel provider, donc ne dépense rien »).
   *
   * 🔑 Un nettoyage qui ne coûte rien ne doit jamais être gardé par un budget de
   * DÉPENSE. Le plafond continue de s'appliquer aux relances, ligne par ligne,
   * dans la boucle.
   */
  sharedBudget?: number,
): Promise<RecoveryOutcome> {
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
  let closed = 0;
  for (const job of stuck) {
    // 1. Irrécupérable → état terminal. Volontairement AVANT le contrôle de
    //    budget et sans `break` : clore ne déclenche aucun appel provider, donc
    //    ne dépense rien. Un budget serré ne doit pas laisser la tête de fenêtre
    //    se re-remplir des mêmes cadavres au tick suivant.
    const closure = resolveStuckClosure(job, settings);
    if (closure) {
      try {
        if (await closeStuckJob(queue, job.id, closure)) {
          closed++;
          console.warn(
            `[backlog-recovery] job figé clos id=${job.id} (était ${job.status}) → ` +
              `${closure.status} : ${closure.reason}`,
          );
        } else {
          skipped++;
        }
      } catch (err) {
        skipped++;
        console.warn(
          `[backlog-recovery] clôture échouée job=${job.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
      continue;
    }

    // 2. Récupérable → remise en file, dans la limite du budget partagé.
    if (sharedBudget !== undefined && requeued >= sharedBudget) {
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

  return { requeued, skipped, closed };
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
  return { requeued, skipped, closed: 0 };
}
