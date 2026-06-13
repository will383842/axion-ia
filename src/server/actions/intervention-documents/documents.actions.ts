// Documents interventions — Server Actions (upload presigned R2 + versioning).
//
// Flux d'une nouvelle version (orchestré côté client) :
//   1. prepareUploadAction(source) → crée/réutilise le doc + un brouillon de
//      version, renvoie une URL signée PUT R2 + la clé.
//   2. le navigateur PUT le fichier directement sur R2 (gros .pptx OK).
//   3. attachFileAction → enregistre la clé sur la version brouillon.
//   4. (option : refaire 1-3 pour le PDF figé)
//   5. publishVersionAction(changeNote) → publie : version immuable courante.
//
// RBAC : write = editor+ (dépôt) ; publish = admin+ (publication).

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSignedUploadUrlR2, deleteFromR2, isR2Configured } from "@/lib/r2-storage";
import { logActivity } from "@/server/intervention-documents/activity-log";
import { buildR2Key } from "@/server/intervention-documents/keys";
import { notifyNewVersion } from "@/server/intervention-documents/notifications";
import { getSlot, type InterventionFamille } from "@/content/intervention-documents-catalog";
import { requireAdminWrite, requireAdminPublish } from "./_guards";

const FAMILLES = ["formation", "un_a_un", "audit"] as const;
const KINDS = ["source", "pdf"] as const;

const prepareSchema = z.object({
  interventionSlug: z.string().min(1).max(80),
  famille: z.enum(FAMILLES),
  slot: z.string().min(1).max(80),
  kind: z.enum(KINDS),
  filename: z.string().min(1).max(260),
  contentType: z.string().min(1).max(160),
});

type PrepareUploadResult =
  | {
      ok: true;
      documentId: string;
      versionId: string;
      version: number;
      kind: "source" | "pdf";
      key: string;
      uploadUrl: string;
    }
  | { ok: false; error: string };

/** Étape 1 : prépare le dépôt — doc + brouillon de version + URL signée PUT. */
export async function prepareUploadAction(raw: unknown): Promise<PrepareUploadResult> {
  const session = await requireAdminWrite();
  const parsed = prepareSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  const { interventionSlug, famille, slot, kind, filename, contentType } = parsed.data;

  if (!isR2Configured()) return { ok: false, error: "Stockage R2 non configuré." };

  const slotDef = getSlot(famille as InterventionFamille, slot);
  if (!slotDef) return { ok: false, error: "Slot inconnu pour cette famille." };
  if (slotDef.generatedOnly) {
    return { ok: false, error: "Ce document est généré par le Formation Engine (pas d'upload)." };
  }

  // Upsert du document (slot logique).
  const doc = await prisma.interventionDocument.upsert({
    where: { interventionSlug_slot: { interventionSlug, slot } },
    create: {
      interventionSlug,
      famille,
      categorie: slotDef.categorie,
      slot,
      titre: slotDef.titre,
      visibilite: slotDef.visibilite,
      source: "upload",
    },
    update: {},
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  // Brouillon de version : on réutilise celui en cours, sinon on en crée un.
  let draft = await prisma.interventionDocumentVersion.findFirst({
    where: { documentId: doc.id, statut: "brouillon" },
  });
  if (!draft) {
    const nextVersion = (doc.versions[0]?.version ?? 0) + 1;
    draft = await prisma.interventionDocumentVersion.create({
      data: { documentId: doc.id, version: nextVersion, statut: "brouillon" },
    });
  }

  const ext = filename.includes(".") ? filename.split(".").pop()! : "bin";
  const key = buildR2Key(interventionSlug, slot, draft.version, kind, ext);
  let uploadUrl: string;
  try {
    uploadUrl = await getSignedUploadUrlR2(key, contentType);
  } catch {
    return { ok: false, error: "Impossible de générer l'URL d'upload." };
  }

  await logActivity({
    action: "documents-interventions.upload.prepare",
    targetType: "InterventionDocumentVersion",
    targetId: draft.id,
    changes: { interventionSlug, slot, kind, version: draft.version },
    session,
  });

  return {
    ok: true,
    documentId: doc.id,
    versionId: draft.id,
    version: draft.version,
    kind,
    key,
    uploadUrl,
  };
}

const attachSchema = z.object({
  versionId: z.string().uuid(),
  kind: z.enum(KINDS),
  key: z.string().min(1).max(400),
  sizeBytes: z
    .number()
    .int()
    .nonnegative()
    .max(500 * 1024 * 1024),
  sourceFormat: z.string().max(10).optional(),
});

/** Étape 3 : enregistre la clé R2 sur la version brouillon après le PUT. */
export async function attachFileAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  await requireAdminWrite();
  const parsed = attachSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  const { versionId, kind, key, sizeBytes, sourceFormat } = parsed.data;

  const version = await prisma.interventionDocumentVersion.findUnique({ where: { id: versionId } });
  if (!version) return { ok: false, error: "Version introuvable." };
  if (version.statut !== "brouillon") return { ok: false, error: "Version déjà publiée." };

  await prisma.interventionDocumentVersion.update({
    where: { id: versionId },
    data:
      kind === "source"
        ? { sourceKey: key, sourceSizeBytes: sizeBytes, sourceFormat: sourceFormat ?? null }
        : { pdfKey: key, pdfSizeBytes: sizeBytes },
  });
  return { ok: true };
}

const publishSchema = z.object({
  versionId: z.string().uuid(),
  changeNote: z.string().max(2000).optional(),
});

/** Étape 5 : publie la version brouillon (devient la version courante). */
export async function publishVersionAction(
  raw: unknown,
): Promise<{ ok: boolean; error?: string; version?: number }> {
  const session = await requireAdminPublish();
  const parsed = publishSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  const { versionId, changeNote } = parsed.data;

  const version = await prisma.interventionDocumentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  });
  if (!version) return { ok: false, error: "Version introuvable." };
  if (version.statut !== "brouillon") return { ok: false, error: "Version déjà publiée." };
  if (!version.sourceKey && !version.pdfKey) {
    return { ok: false, error: "Aucun fichier déposé sur cette version." };
  }

  const previousCurrentId = version.document.currentVersionId;

  await prisma.$transaction(async (tx) => {
    await tx.interventionDocumentVersion.update({
      where: { id: versionId },
      data: {
        statut: "publie",
        changeNote: changeNote ?? null,
        publishedAt: new Date(),
        publishedById: session.userId,
      },
    });
    if (previousCurrentId && previousCurrentId !== versionId) {
      await tx.interventionDocumentVersion.update({
        where: { id: previousCurrentId },
        data: { statut: "archive" },
      });
    }
    await tx.interventionDocument.update({
      where: { id: version.documentId },
      data: { currentVersionId: versionId },
    });
  });

  await logActivity({
    action: "documents-interventions.version.publish",
    targetType: "InterventionDocumentVersion",
    targetId: versionId,
    changes: {
      documentId: version.documentId,
      version: version.version,
      changeNote: changeNote ?? null,
    },
    session,
  });

  // Notifie les destinataires e-mail (fail-soft : ne bloque jamais la publication).
  await notifyNewVersion(versionId).catch(() => undefined);

  return { ok: true, version: version.version };
}

const discardSchema = z.object({ versionId: z.string().uuid() });

/** Annule un brouillon non publié (+ purge best-effort des fichiers R2). */
export async function discardDraftAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  await requireAdminWrite();
  const parsed = discardSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  const version = await prisma.interventionDocumentVersion.findUnique({
    where: { id: parsed.data.versionId },
  });
  if (!version) return { ok: false, error: "Version introuvable." };
  if (version.statut !== "brouillon")
    return { ok: false, error: "Seul un brouillon peut être annulé." };

  for (const key of [version.sourceKey, version.pdfKey]) {
    if (key && isR2Configured()) {
      try {
        await deleteFromR2(key);
      } catch {
        /* fail-soft : purge R2 non bloquante */
      }
    }
  }
  await prisma.interventionDocumentVersion.delete({ where: { id: version.id } });
  return { ok: true };
}
