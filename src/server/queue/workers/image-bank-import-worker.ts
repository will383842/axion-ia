// Image-bank import worker (Sprint 5 V1).
//
// Consume la queue `image-bank-import` : décodage tmp file, pipeline Sharp
// variants, DB insert. Pour uploads > 5 MB (la version synchrone est
// `imageImportService.importImage()` appelée depuis upload.action.ts).

import fs from "node:fs/promises";

import { Worker } from "bullmq";
import * as Sentry from "@sentry/nextjs";

import { getBullConnectionOrThrow } from "../connection";
import { prisma } from "@/lib/prisma";

export type ImageBankImportJobData = {
  batchId?: string;
  tmpFilePath: string;
  originalFilename: string;
  mimetype: string;
  uploadedBy: string;
  initialMetadata?: {
    slug?: string;
    titleFr?: string;
    altFr?: string;
    captionFr?: string;
    keywordsPrimary?: string;
    keywordsSecondary?: string[];
    licenseUrl?: string;
    sourceType?: "photo" | "ai_generated" | "illustration" | "schema";
    aiModel?: string;
    photographerName?: string;
    photographerUrl?: string;
    geoPlacename?: string;
    geoRegion?: string;
    geoPosition?: string;
  };
  triggerEnrich: boolean;
};

export function startImageBankImportWorker(): Worker<ImageBankImportJobData, void, string> {
  const worker = new Worker<ImageBankImportJobData, void, string>(
    "image-bank-import",
    async (job) => {
      const { tmpFilePath, originalFilename, mimetype, batchId, triggerEnrich } = job.data;

      try {
        const buffer = await fs.readFile(tmpFilePath);
        console.log(
          `[image-bank-import] read ${buffer.length} bytes (${originalFilename}) job=${job.id}`,
        );

        // Pipeline Sharp + DB insert via service singleton.
        const { imageImportService } =
          await import("@/server/image-bank/services/image-import.service");
        const result = await imageImportService.importImage({
          buffer,
          originalFilename,
          mimetype,
        });

        if (batchId) {
          await prisma.imageImportBatch.update({
            where: { id: batchId },
            data: { successCount: { increment: 1 } },
          });
        }

        await fs.unlink(tmpFilePath).catch(() => undefined);

        // Enqueue enrich job — utilise le client BullMQ Queue directement.
        if (triggerEnrich && result.uuid) {
          const { Queue } = await import("bullmq");
          const enrichQueue = new Queue("image-bank-enrich", {
            connection: getBullConnectionOrThrow(),
          });
          await enrichQueue.add(`enrich-${result.uuid}`, {
            imageId: result.uuid,
            generateEnglish: true,
          });
        }
      } catch (err) {
        if (batchId) {
          await prisma.imageImportBatch
            .update({
              where: { id: batchId },
              data: {
                errorCount: { increment: 1 },
                errors: [
                  {
                    file: originalFilename,
                    message: err instanceof Error ? err.message : String(err),
                  },
                ],
              },
            })
            .catch(() => undefined);
        }
        throw err;
      }
    },
    { connection: getBullConnectionOrThrow(), concurrency: 1 },
  );

  worker.on("ready", () => console.log("[image-bank-import-worker] ready"));
  worker.on("completed", (job) =>
    console.log(`[image-bank-import-worker] done: ${job.data.originalFilename}`),
  );
  worker.on("failed", (job, err) => {
    console.error(
      `[image-bank-import-worker] failed: ${job?.data?.originalFilename}: ${err.message}`,
    );
    Sentry.captureException(err, {
      tags: { worker: "image-bank-import" },
      extra: {
        jobId: job?.id,
        originalFilename: job?.data?.originalFilename,
        batchId: job?.data?.batchId,
        attemptsMade: job?.attemptsMade,
      },
    });
  });

  return worker;
}
