// Kit-import worker — traite l'import en masse d'un kit de formation (ZIP).
//
// Consomme la queue `kit-import` : charge le ZIP depuis R2 (clé temporaire),
// décompresse, range chaque document (idempotent par hash), supprime le ZIP
// temporaire, et écrit le récap dans `KitImportRun`. Tourne côté serveur (accès
// prod légitime) — jamais côté agent.

import { Worker } from "bullmq";
import * as Sentry from "@sentry/nextjs";

import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-storage";
import { importKitFromR2Key } from "@/server/intervention-documents/kit-import";

export type KitImportJobData = { runId: string };

export function startKitImportWorker(): Worker<KitImportJobData, void, string> {
  const worker = new Worker<KitImportJobData, void, string>(
    "kit-import",
    async (job) => {
      const { runId } = job.data;
      const run = await prisma.kitImportRun.findUnique({
        where: { id: runId },
        select: { id: true, tempKey: true, famille: true },
      });
      if (!run) {
        console.warn(`[kit-import] run ${runId} introuvable, ignoré`);
        return;
      }
      if (!run.tempKey) {
        await prisma.kitImportRun.update({
          where: { id: runId },
          data: { statut: "erreur", error: "ZIP temporaire manquant", finishedAt: new Date() },
        });
        return;
      }

      await prisma.kitImportRun.update({
        where: { id: runId },
        data: { statut: "en_cours", startedAt: new Date() },
      });

      try {
        const summary = await importKitFromR2Key(run.tempKey, run.famille);
        // Statut final AVANT de supprimer le ZIP : si cet update échoue, le
        // ZIP reste présent → un retry re-télécharge et re-importe (idempotent).
        await prisma.kitImportRun.update({
          where: { id: runId },
          data: {
            statut: "termine",
            summary: summary as unknown as object,
            tempKey: null,
            finishedAt: new Date(),
          },
        });
        // Nettoyage du ZIP temporaire APRÈS le statut final (best-effort).
        try {
          await deleteFromR2(run.tempKey);
        } catch {
          /* le ZIP temporaire sera nettoyé plus tard ; non bloquant */
        }
        console.log(
          `[kit-import] run=${runId} OK : +${summary.created} maj ${summary.updated} inchangés ${summary.unchanged}`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await prisma.kitImportRun.update({
          where: { id: runId },
          data: { statut: "erreur", error: message, finishedAt: new Date() },
        });
        throw e; // remonte pour Sentry + retry BullMQ
      }
    },
    { connection: getBullConnectionOrThrow(), concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[kit-import-worker] failed: job=${job?.id}: ${err.message}`);
    captureWorkerError("kit-import", "kit-import", job, err);
    Sentry.captureException(err);
  });

  return worker;
}
