"use server";

// Template : src/server/actions/image-bank/upload.action.ts
//
// Server Action — upload image admin (multipart FormData) + Sharp pipeline + DB insert
// + enqueue enrich worker BullMQ.
//
// Doctrine Axion-IA :
//   - "use server" en tête (Server Action)
//   - Zod aux frontières (FormData → typed input)
//   - Role check via `auth()` NextAuth v5 + redirect 403 si non-admin
//   - `prisma` depuis `@/lib/prisma`
//   - Returns serializable `{ success, error? }` pour client useFormState
//   - revalidateTag pour invalidation cache Next 16

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { imageImportService } from "@/server/image-bank/services/image-import.service";
import { imageBankService } from "@/server/image-bank/services/image-bank.service";
import { enqueueImageBankEnrich } from "@/server/queue/queues";

const UploadSchema = z.object({
  file: z.instanceof(File, { message: "Fichier requis" }),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(3).max(255),
  alt: z.string().min(30).max(125),
  caption: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  keywordsPrimary: z.string().max(255).optional(),
  photographerName: z.string().max(255).optional(),
  photographerUrl: z.string().url().optional().or(z.literal("")),
  sourceType: z.enum(["local", "upload", "ai_generated"]).default("upload"),
  aiModel: z.string().max(50).optional(),
});

export type UploadActionResult =
  | { success: true; imageId: string; seoScore: number }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function uploadImageAction(formData: FormData): Promise<UploadActionResult> {
  // 1) Role check
  const session = await auth();
  if (!session?.user?.role || session.user.role !== "admin") {
    redirect("/api/auth/signin?error=Unauthorized");
  }

  // 2) Validate Zod
  const raw = Object.fromEntries(formData.entries());
  const parsed = UploadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { file, ...meta } = parsed.data;

  try {
    // 3) Sharp pipeline (variants + LQIP)
    const buffer = Buffer.from(await file.arrayBuffer());
    const imported = await imageImportService.importImage({
      buffer,
      mimetype: file.type,
      originalFilename: file.name,
    });

    // 4) Dedup check via fileHash
    const existing = await prisma.imageAsset.findFirst({
      where: { fileHash: imported.fileHash, deletedAt: null },
      include: { translations: true },
    });
    if (existing) {
      return { success: true, imageId: existing.id, seoScore: existing.seoScore };
    }

    // 5) DB insert (transaction)
    const created = await imageBankService.create(
      {
        filePath: imported.filePath,
        thumbnailPath: imported.thumbnailPath,
        ...(imported.avifPath ? { avifPath: imported.avifPath } : {}),
        lqipDataUri: imported.lqipDataUri,
        fileFormat: imported.fileFormat,
        fileSize: imported.fileSize,
        width: imported.width,
        height: imported.height,
        orientation: imported.orientation,
        aspectRatio: imported.aspectRatio,
        srcset: imported.srcset,
        fileHash: imported.fileHash,
        slug: slugifyAscii(meta.title),
        ...(meta.keywordsPrimary ? { keywordsPrimary: meta.keywordsPrimary } : {}),
        ...(meta.photographerName ? { photographerName: meta.photographerName } : {}),
        ...(meta.photographerUrl ? { photographerUrl: meta.photographerUrl } : {}),
        sourceType: meta.sourceType,
        ...(meta.aiModel ? { aiModel: meta.aiModel } : {}),
        ...(meta.categoryId ? { categoryId: meta.categoryId } : {}),
      },
      {
        languageCode: "fr",
        title: meta.title,
        slug: slugifyAscii(meta.title),
        alt: meta.alt,
        ...(meta.caption ? { caption: meta.caption } : {}),
        ...(meta.description ? { description: meta.description } : {}),
      },
    );

    // 6) Enqueue enrich worker (translate EN + country detect + SEO score)
    //    Patch post-audit 2026-05-16 P1-2 — enqueue wired (était TODO).
    //    No-op proprement si BullMQ désactivé (build GH Actions stub).
    await enqueueImageBankEnrich({
      imageId: created.id,
      generateEnglish: true,
    });

    revalidateTag("image-bank", "default");
    revalidateTag("image-bank:fr", "default");

    return { success: true, imageId: created.id, seoScore: 0 };
  } catch (err) {
    console.error("[uploadImageAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

function slugifyAscii(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "image"
  );
}
