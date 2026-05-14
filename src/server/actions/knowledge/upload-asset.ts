/**
 * KB-11 — uploadAssetAction (V1 minimal, sans sharp encore).
 *
 * Reçoit un FormData avec un fichier + metadata.
 * V1 : stocke metadata dans `KnowledgeAsset`, calcule hash sha256, dédupliquage,
 * stockage path indicatif. sharp + AVIF/WebP + EXIF strip → Sprint KB-11 v2
 * quand volume Coolify confirmé + dépendance ajoutée.
 *
 * Important : ne PAS gérer le fichier binaire ici tant que le pipeline complet
 * n'est pas en place. Cette V1 expose l'API + persiste l'audit, mais le fichier
 * physique reste à câbler quand `sharp` + volume `/data/knowledge-assets/` OK.
 */

"use server";

import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "./_guards";
import { logKbActivity } from "./_audit";

const inputSchema = z.object({
  mimeType: z.string().regex(/^[a-z0-9.+\-]+\/[a-z0-9.+\-]+$/i),
  bytes: z
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024),
  width: z.number().int().min(0).optional().nullable(),
  height: z.number().int().min(0).optional().nullable(),
  altText: z.string().max(2000).optional().nullable(),
  caption: z.string().max(500).optional().nullable(),
  hashHex: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "hashHex doit être sha256 hex 64 chars")
    .optional(),
  originalFilename: z.string().max(255),
});

export interface UploadAssetInput {
  readonly mimeType: string;
  readonly bytes: number;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly altText?: string | null;
  readonly caption?: string | null;
  /** SHA-256 hex du fichier (calculé côté client si possible). */
  readonly hashHex?: string;
  readonly originalFilename: string;
}

export interface UploadAssetResult {
  readonly ok: boolean;
  readonly assetId?: string;
  readonly hash?: string;
  readonly duplicate?: boolean;
  readonly error?: string;
}

export async function uploadAssetAction(input: UploadAssetInput): Promise<UploadAssetResult> {
  const session = await requireAdminWrite();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  // V1 minimal : hash fourni par le client OU généré pseudo-aléatoirement
  // (vrai pipeline avec stream sera Sprint KB-11 v2).
  const hash = parsed.data.hashHex ?? crypto.randomBytes(32).toString("hex");

  // Dédupliquage sur hash
  const existing = await prisma.knowledgeAsset.findUnique({
    where: { hash },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, assetId: existing.id, hash, duplicate: true };
  }

  // Path indicatif (à câbler quand volume Coolify monté KB-11 v2)
  const originalPath = `/data/knowledge-assets/${hash.slice(0, 2)}/${hash}-${parsed.data.originalFilename}`;

  try {
    const asset = await prisma.knowledgeAsset.create({
      data: {
        mimeType: parsed.data.mimeType,
        originalPath,
        bytes: parsed.data.bytes,
        width: parsed.data.width ?? null,
        height: parsed.data.height ?? null,
        hash,
        altText: parsed.data.altText ?? null,
        caption: parsed.data.caption ?? null,
        uploadedById: session.userId,
        usageCount: 0,
      },
      select: { id: true },
    });

    await logKbActivity({
      action: "kb.updated", // V1 : pas d'event dédié kb.asset.uploaded encore
      entryId: asset.id, // utilise asset.id comme targetId
      adminUserId: session.userId,
      changes: {
        action: "asset.uploaded",
        assetId: asset.id,
        hash,
        bytes: parsed.data.bytes,
        mimeType: parsed.data.mimeType,
      },
    });

    return { ok: true, assetId: asset.id, hash, duplicate: false };
  } catch (err) {
    console.error("[kb.uploadAsset] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
