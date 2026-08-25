"use server";

// Server Actions « Kit média » (Salle de presse admin) — UPLOAD de fichiers.
//
// Doctrine Axion-IA :
//   - "use server" en tête.
//   - Auth admin via `auth()` NextAuth v5.
//   - Stockage via les helpers `src/server/console-documents/storage.ts`
//     (volume disque dédié hors web-root ; téléchargement via route auth).
//   - Formats acceptés : PDF / PNG / JPG / WEBP / SVG (SVG ajouté LOCALEMENT
//     ici, sans modifier storage.ts).
//   - FR canonique obligatoire (translation FR créée à l'upload).
//   - exactOptionalPropertyTypes : spreads conditionnels, aucun `undefined`.

import { extname } from "node:path";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  storeConsoleDoc,
  deleteConsoleDocFile,
  sanitizeConsoleDocFileName,
  CONSOLE_DOC_MAX_BYTES,
} from "@/server/console-documents/storage";
import type { PressMediaKind, PublishStatus } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────
// Formats kit presse — sous-ensemble de CONSOLE_DOC + SVG (logos vectoriels).
// On NE modifie PAS storage.ts ; on valide localement ici.
// ─────────────────────────────────────────────────────────────────
const PRESS_MEDIA_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".svg"] as const;
const PRESS_MEDIA_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  // certains navigateurs envoient un type vide pour le SVG → on tolère et on
  // se rabat sur l'extension (validée ci-dessous).
  "",
]);

// ─────────────────────────────────────────────────────────────────
// Auth.
// ─────────────────────────────────────────────────────────────────
async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
}

// ─────────────────────────────────────────────────────────────────
// Zod.
// ─────────────────────────────────────────────────────────────────
const kindSchema = z.enum([
  "logo",
  "wordmark",
  "photo",
  "brand_book",
  "boilerplate",
  "color_charter",
  "graphic_charter",
]);
const statusSchema = z.enum(["draft", "published", "archived"]);

const uploadMetaSchema = z.object({
  kind: kindSchema,
  title: z.string().min(3).max(255),
  description: z.string().max(2000).optional(),
  status: statusSchema.optional(),
});

const updateSchema = z.object({
  kind: kindSchema.optional(),
  title: z.string().min(3).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: statusSchema.optional(),
  // Ordre d'affichage dans le kit public (croissant). Piloté à la main : le kit
  // compte quelques fichiers, un champ numérique suffit — pas besoin des ↑/↓
  // des communiqués.
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export type UpdatePressMediaInput = z.infer<typeof updateSchema>;

function revalidatePresse(): void {
  revalidatePath("/fr/presse");
  // Le kit média n'apparaît que sur /presse, mais un asset renommé change aussi
  // le rendu de la page détail (même layout) — on purge les deux, comme côté
  // communiqués.
  revalidatePath("/fr/presse/[slug]", "page");
}

// ─────────────────────────────────────────────────────────────────
// uploadPressMediaAsset.
// ─────────────────────────────────────────────────────────────────
export async function uploadPressMediaAsset(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    await requireAdmin();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "file_required" };
    }

    const parsed = uploadMetaSchema.safeParse({
      kind: formData.get("kind"),
      title: formData.get("title"),
      description: formData.get("description") ?? undefined,
      status: formData.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const meta = parsed.data;

    // Validation taille.
    if (file.size > CONSOLE_DOC_MAX_BYTES) {
      return { ok: false, error: "file_too_large" };
    }

    // Validation extension + MIME (SVG inclus).
    const ext = extname(file.name).toLowerCase();
    if (!PRESS_MEDIA_EXTENSIONS.includes(ext as (typeof PRESS_MEDIA_EXTENSIONS)[number])) {
      return { ok: false, error: "unsupported_extension" };
    }
    if (!PRESS_MEDIA_MIME.has(file.type)) {
      return { ok: false, error: "unsupported_mime" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeConsoleDoc(buffer, file.name);

    const status = meta.status ?? "draft";
    const fileFormat = ext.replace(/^\./, ""); // extension sans le point

    const created = await prisma.pressMediaAsset.create({
      data: {
        kind: meta.kind,
        status,
        storagePath: stored.storagePath,
        fileName: sanitizeConsoleDocFileName(file.name),
        fileFormat,
        fileSize: file.size,
        hashSha256: stored.hashSha256,
        translations: {
          create: {
            locale: "fr",
            title: meta.title,
            ...(meta.description ? { description: meta.description } : {}),
          },
        },
      },
      select: { id: true },
    });

    revalidatePresse();
    return { ok: true, id: created.id };
  } catch (err) {
    console.error("[uploadPressMediaAsset]", err);
    return { ok: false, error: err instanceof Error ? err.message : "upload_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// updatePressMediaAsset — métadonnées seulement (pas de re-upload).
// ─────────────────────────────────────────────────────────────────
export async function updatePressMediaAsset(
  id: string,
  input: UpdatePressMediaInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const data = parsed.data;

    const existing = await prisma.pressMediaAsset.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.$transaction(async (tx) => {
      const assetData: { kind?: PressMediaKind; status?: PublishStatus; sortOrder?: number } = {};
      if (data.kind !== undefined) assetData.kind = data.kind;
      if (data.status !== undefined) assetData.status = data.status;
      if (data.sortOrder !== undefined) assetData.sortOrder = data.sortOrder;
      if (Object.keys(assetData).length > 0) {
        await tx.pressMediaAsset.update({ where: { id }, data: assetData });
      }

      if (data.title !== undefined || data.description !== undefined) {
        const trData: { title?: string; description?: string } = {};
        if (data.title !== undefined) trData.title = data.title;
        if (data.description !== undefined) trData.description = data.description;

        const existingTr = await tx.pressMediaAssetTranslation.findUnique({
          where: { assetId_locale: { assetId: id, locale: "fr" } },
          select: { id: true },
        });
        if (existingTr) {
          await tx.pressMediaAssetTranslation.update({
            where: { assetId_locale: { assetId: id, locale: "fr" } },
            data: trData,
          });
        } else if (trData.title !== undefined) {
          await tx.pressMediaAssetTranslation.create({
            data: {
              assetId: id,
              locale: "fr",
              title: trData.title,
              ...(trData.description !== undefined ? { description: trData.description } : {}),
            },
          });
        }
      }
    });

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[updatePressMediaAsset]", err);
    return { ok: false, error: err instanceof Error ? err.message : "update_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// deletePressMediaAsset — soft delete + suppression fichier best-effort.
// ─────────────────────────────────────────────────────────────────
export async function deletePressMediaAsset(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const existing = await prisma.pressMediaAsset.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, storagePath: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.pressMediaAsset.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });

    // Best-effort : retrait du binaire du disque.
    await deleteConsoleDocFile(existing.storagePath);

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[deletePressMediaAsset]", err);
    return { ok: false, error: err instanceof Error ? err.message : "delete_failed" };
  }
}
