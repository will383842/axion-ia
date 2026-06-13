"use server";

/**
 * Espace ressources — téléchargement à la demande (2026-06-13).
 * Génère une URL R2 signée courte (5 min) APRÈS avoir vérifié que le
 * destinataire a bien le droit d'accéder à ce document, puis trace un
 * accusé de téléchargement (RessourceTelechargement).
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSignedUrlR2, isR2Configured } from "@/lib/r2-storage";
import { requireRecipientAction } from "@/server/ressources/guard";
import { listDocumentsForRecipientEmail } from "@/server/ressources/queries";

export interface DownloadResult {
  readonly ok: boolean;
  readonly url?: string;
  readonly error?: string;
}

const schema = z.object({
  versionId: z.string().uuid(),
  kind: z.enum(["source", "pdf"]),
});

export async function getRessourceDownloadUrlAction(
  input: z.infer<typeof schema>,
): Promise<DownloadResult> {
  const session = await requireRecipientAction();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  const { versionId, kind } = parsed.data;

  // Sécurité : la version doit faire partie des documents accessibles à cette
  // personne (mêmes critères que l'affichage).
  const accessible = await listDocumentsForRecipientEmail(session.email);
  if (!accessible.some((d) => d.versionId === versionId)) {
    return { ok: false, error: "Accès refusé." };
  }

  const version = await prisma.interventionDocumentVersion.findUnique({
    where: { id: versionId },
    select: { sourceKey: true, pdfKey: true },
  });
  const key = kind === "source" ? version?.sourceKey : version?.pdfKey;
  if (!key) return { ok: false, error: "Fichier indisponible." };
  if (!isR2Configured()) return { ok: false, error: "Stockage non configuré." };

  let url: string;
  try {
    url = await getSignedUrlR2(key, 5 * 60); // 5 min
  } catch {
    return { ok: false, error: "Lien indisponible, réessayez." };
  }

  // Accusé de téléchargement (fail-soft : ne bloque pas le téléchargement).
  try {
    await prisma.ressourceTelechargement.create({
      data: { recipientId: session.recipientId, versionId, kind },
    });
  } catch {
    /* trace best-effort */
  }

  return { ok: true, url };
}
