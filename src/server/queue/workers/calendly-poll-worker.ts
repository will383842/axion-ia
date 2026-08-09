/**
 * Sondage Calendly — worker BullMQ (2026-08-09).
 *
 * POURQUOI CE WORKER EXISTE
 * -------------------------
 * Calendly Free n'émet aucun webhook, et depuis l'ADR 0038 le visiteur réserve
 * sur calendly.com dans un nouvel onglet : plus aucun signal ne revient au site
 * au moment de la réservation. La découverte se faisait donc par un cron GitHub
 * Actions horaire — sauf que GitHub ne garantit pas l'heure. Relevé le
 * 2026-08-09 sur 8 passages consécutifs : un trou de **2 h 44** entre 23:45 et
 * 02:29, et un rendez-vous du 06/08 à 16:30 découvert à 15:29. Une réservation
 * prise 30 min avant le créneau pouvait donc être signalée APRÈS le début du
 * rendez-vous.
 *
 * BullMQ, lui, déclenche à la minute. La latence passe de « jusqu'à 2 h 44 » à
 * « moins de 60 s ».
 *
 * DEUX RYTHMES, ET C'EST DÉLIBÉRÉ
 * -------------------------------
 * L'API Calendly plafonne à **60 requêtes/minute** (plan gratuit comme Standard).
 * Les deux passes n'ont pas du tout le même coût, donc pas la même cadence :
 *
 *   · `discover` — toutes les MINUTES. Coût : 2 requêtes (`/users/me` + la liste
 *     des évènements), plus 1 par réservation réellement nouvelle. C'est ce qui
 *     doit être rapide : une réservation qui n'existe pas encore en base
 *     n'apparaît nulle part et ne déclenche aucune alerte.
 *   · `refresh` — toutes les 10 MINUTES. Coût : jusqu'à `MAX_PER_RUN` (25)
 *     enrichissements, chacun 1 à 2 requêtes, soit ~50 requêtes. À la minute, on
 *     saturerait le quota à lui seul. Une annulation connue avec 10 min de retard
 *     reste très en deçà de l'heure d'avant.
 *
 * 🔴 NE PAS passer `refresh` à la minute « pour aller plus vite » : on
 * dépasserait le quota, Calendly répondrait 429, et c'est `discover` — la passe
 * qui compte — qui serait rejetée en premier.
 *
 * INERTE PAR DÉFAUT
 * -----------------
 * Sans `CALENDLY_API_TOKEN`, `discoverNewCalendlyEvents()` et
 * `refreshUpcomingCalendlyEvents()` sortent immédiatement sans émettre la
 * moindre requête. ⚠️ Cette variable est présente sur l'application WEB mais
 * devait être AJOUTÉE sur l'application WORKER (deux applications Coolify
 * distinctes) — sans elle ce worker tourne à vide en silence.
 */

import { Worker, type Job } from "bullmq";
import { discoverNewCalendlyEvents } from "@/server/calendly/discover";
import { refreshUpcomingCalendlyEvents } from "@/server/calendly/refresh";
import { isCalendlyApiConfigured } from "@/server/calendly/api";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

export const CALENDLY_POLL_QUEUE_NAME = "calendly-poll";

/** Les deux passes, à deux cadences différentes — voir l'en-tête. */
export type CalendlyPollJobType = "discover" | "refresh";

export interface CalendlyPollJobData {
  readonly type: CalendlyPollJobType;
  /** Horodatage d'enfilement — purement diagnostique. */
  readonly tick?: string;
}

async function processJob(job: Job<CalendlyPollJobData>): Promise<void> {
  // Garde explicite en plus de celle des deux modules appelés : elle évite
  // d'écrire une ligne de log toutes les minutes sur une installation sans jeton.
  if (!isCalendlyApiConfigured()) return;

  if (job.data.type === "discover") {
    const res = await discoverNewCalendlyEvents();
    // On ne journalise QUE ce qui s'est passé. Une ligne par minute annonçant
    // « 0 nouvelle réservation » noierait les logs du worker (1440 lignes/jour)
    // et rendrait invisible la seule qui compte.
    if (res.created > 0) {
      console.warn(`[calendly-poll] ${res.created} réservation(s) découverte(s)`);
    }
    if (!res.ok) {
      console.warn(`[calendly-poll] découverte en échec : ${res.reason ?? "inconnu"}`);
    }
    if (res.remaining) console.warn(`[calendly-poll] ${res.remaining}`);
    return;
  }

  const res = await refreshUpcomingCalendlyEvents();
  if (res.updated > 0) {
    console.warn(`[calendly-poll] ${res.updated} réservation(s) mise(s) à jour`);
  }
  if (!res.ok) {
    console.warn(`[calendly-poll] rafraîchissement en échec : ${res.reason ?? "inconnu"}`);
  }
  if (res.overflow) {
    console.warn(
      "[calendly-poll] plafond MAX_PER_RUN atteint — des réservations n'ont pas été vues",
    );
  }
}

let workerInstance: Worker<CalendlyPollJobData> | null = null;

export function startCalendlyPollWorker(): Worker<CalendlyPollJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — calendly-poll-worker cannot start");
  workerInstance = new Worker<CalendlyPollJobData>(CALENDLY_POLL_QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    // 🔴 concurrency 1, non négociable : deux `discover` en parallèle liraient la
    // même liste Calendly avant que l'un ait écrit, et créeraient deux lignes
    // pour la même réservation — donc DEUX alertes Telegram/WhatsApp. La
    // contrainte UNIQUE sur `invitee_uri` rattrape l'écriture (P2002 ignoré dans
    // `discover.ts`), mais elle ne rattrape pas l'alerte déjà partie.
    concurrency: 1,
    // Un passage `refresh` fait jusqu'à 25 appels séquentiels : 2 min de marge.
    lockDuration: 120_000,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[calendly-poll-worker] job ${job?.id} failed:`, err);
    captureWorkerError("calendly-poll", CALENDLY_POLL_QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopCalendlyPollWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
