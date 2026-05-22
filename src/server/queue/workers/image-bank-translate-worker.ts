// Image-bank translate worker (Sprint 5 V1).
//
// Consume la queue `image-bank-translate` : Claude Sonnet 4.6 vision
// traduit FR ↔ EN les metadata d'une ImageAsset.

import { Worker } from "bullmq";
import * as Sentry from "@sentry/nextjs";

import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

export type ImageBankTranslateJobData = {
  imageId: string;
  sourceLang: "fr" | "en";
  targetLang: "fr" | "en";
};

export function startImageBankTranslateWorker(): Worker<ImageBankTranslateJobData, void, string> {
  const worker = new Worker<ImageBankTranslateJobData, void, string>(
    "image-bank-translate",
    async (job) => {
      const { imageId, sourceLang, targetLang } = job.data;
      if (sourceLang === targetLang) return;

      const { ImageTranslationService } =
        await import("@/server/image-bank/services/image-translation.service");
      const translator = new ImageTranslationService();
      await translator.translateAndSave({ imageId, sourceLang, targetLang });
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 2,
      lockDuration: 120_000,
      // P0-7 — Rate limit Claude : 10 jobs/min max (aligné quota Claude API).
      limiter: { max: 10, duration: 60_000 },
      // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
      // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
      // Évite saturation Redis long-terme sur high-volume workers.
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on("ready", () => console.log("[image-bank-translate-worker] ready"));
  worker.on("completed", (job) =>
    console.log(
      `[image-bank-translate-worker] done: ${job.data.imageId} ${job.data.sourceLang}→${job.data.targetLang}`,
    ),
  );
  worker.on("failed", (job, err) => {
    console.error(`[image-bank-translate-worker] failed: ${job?.data?.imageId}: ${err.message}`);
    Sentry.captureException(err, {
      tags: { worker: "image-bank-translate" },
      extra: {
        jobId: job?.id,
        imageId: job?.data?.imageId,
        sourceLang: job?.data?.sourceLang,
        targetLang: job?.data?.targetLang,
        attemptsMade: job?.attemptsMade,
      },
    });
    captureWorkerError("image-bank-translate", "image-bank-translate", job, err);
  });

  return worker;
}
