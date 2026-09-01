/**
 * Content Generator — Helper Sentry capture transverse pour workers BullMQ.
 *
 * Sprint S+4 action C (audit content-gen deep 2026-05-18 — gap P1-7) :
 * « 0/16 Sentry capture dans workers BullMQ — toute observabilité erreur passe
 * console.error + Telegram tag INCIDENT (business uniquement, pas stack traces). »
 *
 * Pattern DRY pour les 4 workers chokepoint :
 *   - `content-publish-worker` (queue `content-publish`)
 *   - `content-gen-worker` (queue `content-gen`)
 *   - `content-orchestrator-worker` (queue `content-orchestrator`)
 *   - `content-indexnow-worker` (queue `content-indexnow`)
 *
 * Usage cible dans le worker :
 *
 * ```ts
 * import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
 *
 * workerInstance.on("failed", (job, err) => {
 *   console.error(`[content-publish-worker] job ${job?.id} failed:`, err);
 *   captureWorkerError("publish", "content-publish", job, err);
 *   // Telegram alertIncident inchangé en-dessous (orthogonal)
 * });
 * ```
 *
 * Propriétés clés :
 *   - Fail-soft : un crash interne Sentry NE DOIT PAS faire crasher le worker
 *     (try/catch global → log warn, continue). Le worker.on("failed") est
 *     déjà un gestionnaire d'erreur, pas le moment de cascader.
 *   - PII safe : `sanitizeJobData()` est appelé sur `job.data` avant injection
 *     dans `extra` (cf. RGPD art. 32 + ADR 0010 Sentry SaaS US).
 *   - Fingerprint déterministe : `[workerName, errorName, errorMessage.slice(0,100)]`
 *     pour grouper les erreurs récurrentes (le worker chokepoint génère
 *     potentiellement plusieurs centaines d'occurrences/jour sur même cause).
 *   - Préserve console.error / Telegram existants (additif, pas remplacement).
 *
 * NB : volontairement pas d'export `Sentry` direct — les callers utilisent
 * @sentry/nextjs pour autre chose (custom spans, breadcrumbs) sans passer ici.
 */

import { createRequire } from "node:module";

import * as Sentry from "@sentry/nextjs";
import type { Job } from "bullmq";

import { sanitizeJobData } from "./sanitize-job-data";

/**
 * Identifiants courts/canoniques des workers content-gen monitored.
 * Match les tags Sentry pour groupage cohérent dashboards.
 */
export type WorkerName =
  | "publish"
  | "gen"
  | "orchestrator"
  | "indexnow"
  | "quality-improver"
  | "fact-check"
  | "weekly-report"
  // Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22)
  | "content-gen-scheduler"
  | "content-gen-deadline-checker"
  // Phase F Sprint Perfection 2026 — embeddings backfill daily cron
  | "embeddings-backfill"
  // Sprint Perfection 2026 — brand-voice drift monitor
  | "brand-voice-drift-monitor"
  // Phase 8 Sprint Keywords Perfection 2026-05-22
  | "keyword-opportunity-detector"
  // Sprint External Links Database 2026-05-22 — cron mensuel HEAD verification
  | "external-links-monitor"
  // Sprint Final 2026-05-22 (P0-2 audit final) — reset compteurs cost mensuel
  | "cost-cap-reset"
  // Observatoire IA 2026 — auto-update snapshot + analyse LLM (cron 6 h)
  | "observatoire-snapshot"
  // Sprint Final 2026-05-22 (P1-2 ratchet Sentry 17/33 → 33/33 audit final)
  | "google-indexing"
  | "keyword-sync"
  | "content-monitoring"
  | "news-lifecycle"
  | "psi-monitor"
  | "qa-extract"
  | "rss-fetch"
  | "similarity-monitor"
  | "tier-lifecycle"
  | "web-vitals-monitor"
  | "email"
  | "image-bank-auto-convert"
  | "image-bank-crons"
  | "image-bank-enrich"
  | "image-bank-import"
  | "image-bank-translate"
  | "retention-purge"
  // Sprint Site Explorer Admin 2026-05-22
  | "site-route-inspector"
  | "site-route-anomaly-detector"
  // Onglet « Toutes les URLs » 2026-06-08
  | "site-route-discovery"
  | "site-route-gsc"
  // Chatbot (T-05) — ingestion RAG chat_kb_chunks
  | "chatbot-ingest"
  // Sprint v7 Phase 9 — GSC HCU monitoring daily cron
  | "gsc-hcu-monitor"
  // Sprint v7 Phase 13 — Content refresh monthly cron
  | "content-refresh"
  // Qualiopi T6 — auto-transitions formation crons
  | "formation-crons"
  // Import en masse kit formation (ZIP → documents-interventions) 2026-06-13
  | "kit-import"
  // Sondage Calendly 2026-08-09 — découverte des réservations + annulations
  | "calendly-poll"
  // Lot L2 2026-08-14 — synchro sortante de l'outbox vers Axion CRM Pro
  | "crm-sync"
  // Lot L4 2026-08-14 — intégration au vivier à échéance de la fenêtre
  // d'opposition de 30 jours (passage quotidien)
  | "vivier-crons"
  // Qualiopi S5 2026-08-26 — production documentaire au jalon (queue horaire
  // `documents-auto`). Nom distinct de `formation-crons` : le rendu react-pdf
  // et l'upload R2 echouent pour d'autres raisons que les crons d'e-mail, et
  // un fingerprint partage les aurait melanges dans le meme groupe Sentry.
  | "documents-auto";

/**
 * Resout `captureException`, en contournant les exports conditionnels du paquet.
 *
 * ── LA CAUSE, mesuree le 2026-09-01 ─────────────────────────────────────────
 *
 * Le worker tourne en Node pur (`tsx src/server/queue/worker.ts`), HORS du
 * bundler Next. Sur la MEME machine et la MEME version (`@sentry/nextjs`
 * 10.70.0), les deux facons de charger le paquet ne rendent pas le meme
 * module :
 *
 *   import * as S from "@sentry/nextjs"   ->  28 symboles, captureException ABSENT
 *   require("@sentry/nextjs")             -> 201 symboles, captureException PRESENT
 *
 * Ce n'est donc pas un paquet casse : ce sont ses **exports conditionnels**, qui
 * font pointer la condition `import` et la condition `require` vers deux builds
 * differents. Le worker prend la premiere, Next prend la seconde. L'audit du
 * 2026-07-21 avait bien constate le symptome (27 symboles) mais conclu qu'il
 * fallait ajouter `@sentry/node` et changer le lockfile. Il n'en faut rien :
 * il suffit de redemander le meme paquet par l'autre resolution.
 *
 * ── CE QUI A ETE VERIFIE AVANT DE POSER CE CORRECTIF ────────────────────────
 *
 * Les deux builds sont deux instances de module DISTINCTES. Un correctif qui
 * appelle une vraie fonction sur un client vide n'aurait rien envoye, tout en
 * ayant l'air de marcher — le pire des correctifs. Mesure du 2026-09-01 :
 * apres un `init()` fait par le chemin ESM, un `captureException()` fait par le
 * chemin CJS atteint bien le `beforeSend` de cette configuration. Les deux
 * instances partagent le porteur global `globalThis.__SENTRY__`.
 *
 * ── PORTEE ──────────────────────────────────────────────────────────────────
 *
 * Le defaut ne touchait pas que l'e-mail : les 33 workers de `WorkerName`
 * passent par ce helper, donc AUCUNE erreur de worker n'a atteint Sentry depuis
 * juillet. Et l'echec de l'observabilite etait lui-meme muet.
 */
type CaptureException = (err: Error, hint?: unknown) => unknown;

let captureResolue: CaptureException | null | undefined;

function resoudreCapture(): CaptureException | null {
  if (captureResolue !== undefined) return captureResolue;

  // Chemin nominal : dans le bundle Next, l'export ESM porte la fonction.
  const direct = (Sentry as { captureException?: unknown }).captureException;
  if (typeof direct === "function") {
    captureResolue = direct as CaptureException;
    return captureResolue;
  }

  // Repli worker : meme paquet, resolution CJS. Enferme dans un try/catch car
  // `createRequire` n'existe pas dans tous les runtimes ou ce module peut etre
  // embarque (edge, navigateur) — et une observabilite qui casse son appelant
  // est pire que pas d'observabilite.
  try {
    const requis = createRequire(import.meta.url)("@sentry/nextjs") as {
      captureException?: unknown;
    };
    if (typeof requis.captureException === "function") {
      captureResolue = requis.captureException as CaptureException;
      return captureResolue;
    }
  } catch {
    // On tombe dans le `null` ci-dessous, qui journalise bruyamment.
  }

  captureResolue = null;
  return null;
}

/**
 * Capture une exception worker dans Sentry avec tags + extras PII-safe.
 *
 * Appelé depuis `worker.on("failed", (job, err) => ...)`. Fail-soft :
 * si Sentry est down ou la DSN absente, log warn + continue (le worker
 * BullMQ ne doit pas crasher sur un échec d'observabilité).
 *
 * @param workerName Nom court canonique (cf. {@link WorkerName})
 * @param queueName Nom complet de la queue BullMQ (utilisé en tag pour
 *   corréler avec les dashboards Redis/BullMQ board admin)
 * @param job Le job BullMQ qui a failed (undefined si erreur pré-pickup)
 * @param error L'erreur capturée par BullMQ
 */
export function captureWorkerError(
  workerName: WorkerName,
  queueName: string,
  job: Job | undefined,
  error: Error | unknown,
): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const errName = err.name || "Error";
    const errMsg = (err.message ?? "unknown").slice(0, 100);

    const tags: Record<string, string> = {
      worker: workerName,
      queue: queueName,
    };
    if (job?.id !== undefined && job.id !== null) {
      tags["jobId"] = String(job.id);
    }
    if (job?.name) {
      tags["jobName"] = job.name;
    }

    // La résolution vit dans `resoudreCapture()` au-dessus, avec la mesure qui
    // l'a motivée. Ici on garde le signalement bruyant du cas où elle échoue :
    // si un jour les DEUX résolutions cessent d'exposer la fonction, ce
    // `console.error` est la seule chose qui le dira.
    const capture = resoudreCapture();
    if (capture === null) {
      console.error(
        `[sentry-worker] ⛔ Sentry INDISPONIBLE dans le worker (captureException absent ` +
          `des DEUX résolutions, ESM et CJS) — erreur NON remontée : ` +
          `${workerName}/${queueName} · ${errName}: ${errMsg}`,
      );
      return;
    }

    capture(err, {
      tags,
      extra: {
        jobId: job?.id ?? null,
        jobName: job?.name ?? null,
        jobData: job?.data ? sanitizeJobData(job.data) : null,
        attemptsMade: job?.attemptsMade ?? 0,
        failedReason: job?.failedReason ?? null,
        timestamp: job?.timestamp ?? null,
        queueName,
      },
      fingerprint: [workerName, errName, errMsg],
    });
  } catch (sentryErr) {
    // Fail-soft : ne pas cascader. Mais en `error`, pas en `warn` — un helper
    // d'observabilité qui échoue en silence est pire que pas d'observabilité.
    console.error(
      `[sentry-worker] capture failed for ${workerName}/${queueName}:`,
      sentryErr instanceof Error ? sentryErr.message : String(sentryErr),
    );
  }
}
