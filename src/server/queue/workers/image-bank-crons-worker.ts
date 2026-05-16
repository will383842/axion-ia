// Image-bank crons worker (Sprint 5 V1).
//
// Mutualise un worker BullMQ pour les jobs de fond image-bank :
//   - dispatch SEO score recalc nightly
//   - taxonomy re-detection batch
//   - watermark legacy backfill
//
// Pattern emprunté à booking-crons-worker (un worker, jobs dispatched par
// `type`). Chaque handler est idempotent.

import { Worker } from "bullmq";

import { getBullConnectionOrThrow } from "../connection";

export type ImageBankCronJobType =
  | "seo-score-recalc"
  | "taxonomy-redetect-batch"
  | "watermark-backfill";

export type ImageBankCronJobData = {
  type: ImageBankCronJobType;
  /** Limite items traités par batch (anti-blast-radius). */
  limit?: number;
};

export function startImageBankCronsWorker(): Worker<ImageBankCronJobData, void, string> {
  const worker = new Worker<ImageBankCronJobData, void, string>(
    "image-bank-crons",
    async (job) => {
      const { type, limit = 100 } = job.data;
      console.log(`[image-bank-crons] dispatching ${type} (limit=${limit})`);

      switch (type) {
        case "seo-score-recalc": {
          // TODO Sprint 5.1+ : recalc seoScore via image-seo.service
          //   pour les N premières images updatedAt > X.
          break;
        }
        case "taxonomy-redetect-batch": {
          // TODO Sprint 5.1+ : re-run detectTaxonomy()
          //   pour les N premières flagged requiresHumanTaxonomy = true.
          break;
        }
        case "watermark-backfill": {
          // TODO Sprint 6.x : backfill watermarkEnabled selon Will rules.
          break;
        }
        default: {
          const _exhaustive: never = type;
          throw new Error(`[image-bank-crons] unknown type: ${String(_exhaustive)}`);
        }
      }
    },
    { connection: getBullConnectionOrThrow(), concurrency: 1 },
  );

  worker.on("ready", () => console.log("[image-bank-crons-worker] ready"));
  worker.on("completed", (job) => console.log(`[image-bank-crons-worker] done: ${job.data.type}`));
  worker.on("failed", (job, err) =>
    console.error(`[image-bank-crons-worker] failed: ${job?.data?.type}: ${err.message}`),
  );

  return worker;
}
