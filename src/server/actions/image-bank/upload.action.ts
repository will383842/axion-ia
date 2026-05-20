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

// Dossiers sources Axion-IA → module DB auto-détecté
const SOURCE_FOLDERS = [
  "Audit",
  "Formations & Interventions",
  "Automatisations et implémentations",
  "Dirigeant 1 TO 1",
  "Membre d'équipe 1 TO 1",
  "Logos",
  "Graphiques et courbes",
  "Tous types de propositions",
  "Villes",
] as const;

type SourceFolder = (typeof SOURCE_FOLDERS)[number];

const FOLDER_MODULE_MAP: Record<SourceFolder, string> = {
  Audit: "audit",
  "Formations & Interventions": "interventions_formations",
  "Automatisations et implémentations": "implementations",
  "Dirigeant 1 TO 1": "un-a-un",
  "Membre d'équipe 1 TO 1": "un-a-un",
  Logos: "logo",
  "Graphiques et courbes": "graphique",
  "Tous types de propositions": "proposition",
  Villes: "ville",
};

const UploadSchema = z.object({
  file: z.instanceof(File, { message: "Fichier requis" }),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(3).max(255),
  alt: z.string().min(30).max(125).optional(),
  caption: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  keywordsPrimary: z.string().max(255).optional(),
  source_folder: z.enum(SOURCE_FOLDERS).optional(),
  target_city: z.string().max(80).optional(),
  sourceType: z.enum(["local", "upload", "ai_generated"]).default("upload"),
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

  // Résolution module depuis le dossier source
  const resolvedModule = meta.source_folder ? FOLDER_MODULE_MAP[meta.source_folder] : undefined;

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
    const isLogo = resolvedModule === "logo";
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
        sourceType: isLogo ? "local" : meta.sourceType,
        isAiGenerated: meta.sourceType === "ai_generated",
        ...(meta.categoryId ? { categoryId: meta.categoryId } : {}),
        ...(resolvedModule ? { module: resolvedModule } : {}),
        ...(meta.source_folder === "Dirigeant 1 TO 1" ? { targetPersona: "dirigeant" } : {}),
        ...(meta.source_folder === "Membre d'équipe 1 TO 1" ? { targetPersona: "equipe" } : {}),
        ...(meta.target_city
          ? { targetCity: meta.target_city, geoPlacename: meta.target_city, geoRegion: "FR" }
          : {}),
      },
      {
        languageCode: "fr",
        title: meta.title,
        slug: slugifyAscii(meta.title),
        // alt vide si non fourni — Claude Vision le génère via enrich worker
        alt: meta.alt ?? "",
        ...(meta.caption ? { caption: meta.caption } : {}),
        ...(meta.description ? { description: meta.description } : {}),
      },
    );

    // 6) Enqueue enrich worker FR uniquement (marché francophone)
    await enqueueImageBankEnrich({ imageId: created.id });

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
