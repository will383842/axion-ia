"use server";

/**
 * Import en masse d'un kit de formation (ZIP) — server actions (2026-06-13).
 *
 * Flux : le navigateur demande une URL d'upload présignée (le ZIP va DIRECTEMENT
 * sur R2, contournant la limite 10 Mo des server actions) → puis déclenche
 * l'import (job BullMQ en arrière-plan, idempotent).
 *
 * RBAC : requireAdminWrite (editor+).
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSignedUploadUrlR2 } from "@/lib/r2-storage";
import { enqueueKitImport } from "@/server/queue/queues";
import { requireAdminWrite } from "@/server/actions/intervention-documents/_guards";

export interface PrepareKitUploadResult {
  ok: boolean;
  error?: string;
  uploadUrl?: string;
  tempKey?: string;
}

const prepareSchema = z.object({ fileName: z.string().trim().max(300).optional() });

export async function prepareKitUploadAction(
  input: z.infer<typeof prepareSchema>,
): Promise<PrepareKitUploadResult> {
  await requireAdminWrite();
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  const tempKey = `tmp/kit-import/${randomUUID()}.zip`;
  try {
    const uploadUrl = await getSignedUploadUrlR2(tempKey, "application/zip", 30 * 60);
    return { ok: true, uploadUrl, tempKey };
  } catch {
    return { ok: false, error: "Stockage indisponible (R2 non configuré ?)." };
  }
}

export interface StartKitImportResult {
  ok: boolean;
  error?: string;
  runId?: string;
}

const startSchema = z.object({
  tempKey: z.string().trim().min(1).max(300),
  fileName: z.string().trim().max(300).optional(),
  // Famille ciblée (défaut `formation` : rétrocompatible avec l'appel historique).
  famille: z.enum(["formation", "un_a_un", "audit"]).default("formation"),
});

export async function startKitImportAction(
  input: z.infer<typeof startSchema>,
): Promise<StartKitImportResult> {
  const session = await requireAdminWrite();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  // Garde-fou : ne traite que les clés temporaires d'import (anti-SSRF de clé).
  if (!parsed.data.tempKey.startsWith("tmp/kit-import/")) {
    return { ok: false, error: "Clé d'upload invalide." };
  }
  const run = await prisma.kitImportRun.create({
    data: {
      statut: "en_attente",
      tempKey: parsed.data.tempKey,
      fileName: parsed.data.fileName ?? null,
      famille: parsed.data.famille,
      startedById: session.userId,
    },
    select: { id: true },
  });
  await enqueueKitImport(run.id);
  // Pas de revalidatePath : le préfixe admin est secret ([adminPrefix]) ; le
  // client rafraîchit la liste lui-même (router.refresh).
  return { ok: true, runId: run.id };
}
