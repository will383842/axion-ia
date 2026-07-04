"use server";

/**
 * Prospection — Actions d'exploitation (ops) déclenchables depuis la console.
 * Évite d'avoir à lancer l'ingestion Stock depuis un script/REPL (vérif backend).
 */

import { requireProspectionAccess } from "./_auth";
import { enqueueProspectionStockIngest } from "@/server/prospection/queue/queues";
import { prisma } from "@/lib/prisma";

/**
 * Enfile un job d'ingestion du Stock Sirene (chemins pris du job-data ou des env
 * `PROSPECTION_STOCK_*_PATH`). Réservé `admin` (capacité config).
 */
export async function triggerProspectionStockIngest(_formData?: FormData): Promise<void> {
  const session = await requireProspectionAccess("config");
  await enqueueProspectionStockIngest({});
  await prisma.prospectionEvent.create({
    data: {
      type: "refresh",
      actorId: session.userId,
      reason: "ingestion Stock Sirene déclenchée (console)",
    },
  });
}
