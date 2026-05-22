// Image-bank enrich worker (Sprint 5 V1).
//
// Consume la queue `image-bank-enrich` : pour chaque ImageAsset, déclenche
// en cascade taxonomy detection + SEO enrichment FR + translate FR→EN.
// Pattern aligné sur email-worker (singleton via startXxxWorker()).

import { Worker } from "bullmq";
import * as Sentry from "@sentry/nextjs";

import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

export type ImageBankEnrichJobData = {
  imageId: string;
  /** Si false, skip la cascade translate EN. */
  generateEnglish?: boolean;
};

export function startImageBankEnrichWorker(): Worker<ImageBankEnrichJobData, void, string> {
  const worker = new Worker<ImageBankEnrichJobData, void, string>(
    "image-bank-enrich",
    async (job) => {
      const { imageId } = job.data;
      // Marché FR uniquement — pas de génération EN automatique.

      const { ImageSeoEnrichmentService } =
        await import("@/server/image-bank/services/image-seo-enrichment.service");
      const enricher = new ImageSeoEnrichmentService();
      await enricher.enrichAndSave({ imageId, lang: "fr", mode: "regenerate" });
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

  worker.on("ready", () => console.log("[image-bank-enrich-worker] ready"));
  worker.on("completed", (job) =>
    console.log(`[image-bank-enrich-worker] done: ${job.data.imageId}`),
  );
  worker.on("failed", (job, err) => {
    console.error(`[image-bank-enrich-worker] failed: ${job?.data?.imageId}: ${err.message}`);
    Sentry.captureException(err, {
      tags: { worker: "image-bank-enrich" },
      extra: {
        jobId: job?.id,
        imageId: job?.data?.imageId,
        attemptsMade: job?.attemptsMade,
      },
    });
    captureWorkerError("image-bank-enrich", "image-bank-enrich", job, err);
  });

  return worker;
}
