// Image-bank enrich worker (Sprint 5 V1).
//
// Consume la queue `image-bank-enrich` : pour chaque ImageAsset, déclenche
// en cascade taxonomy detection + SEO enrichment FR + translate FR→EN.
// Pattern aligné sur email-worker (singleton via startXxxWorker()).

import { Worker } from "bullmq";

import { getBullConnectionOrThrow } from "../connection";

export type ImageBankEnrichJobData = {
  imageId: string;
  /** Si false, skip la cascade translate EN. */
  generateEnglish?: boolean;
};

export function startImageBankEnrichWorker(): Worker<ImageBankEnrichJobData, void, string> {
  const worker = new Worker<ImageBankEnrichJobData, void, string>(
    "image-bank-enrich",
    async (job) => {
      const { imageId, generateEnglish = true } = job.data;

      // Taxonomy detection deferred (function-based API → wiring V1.5,
      // see image-taxonomy-detector.service.ts detectTaxonomy()).

      const { ImageSeoEnrichmentService } =
        await import("@/server/image-bank/services/image-seo-enrichment.service");
      const enricher = new ImageSeoEnrichmentService();
      await enricher.enrichAndSave({ imageId, lang: "fr", mode: "regenerate" });

      if (generateEnglish) {
        try {
          const { ImageTranslationService } =
            await import("@/server/image-bank/services/image-translation.service");
          const translator = new ImageTranslationService();
          await translator.translateAndSave({
            imageId,
            sourceLang: "fr",
            targetLang: "en",
          });
        } catch (err) {
          console.error(`[image-bank-enrich] EN translate failed:`, err);
        }
      }
    },
    { connection: getBullConnectionOrThrow(), concurrency: 2 },
  );

  worker.on("ready", () => console.log("[image-bank-enrich-worker] ready"));
  worker.on("completed", (job) =>
    console.log(`[image-bank-enrich-worker] done: ${job.data.imageId}`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[image-bank-enrich-worker] failed: ${job?.data?.imageId}: ${err.message}`),
  );

  return worker;
}
