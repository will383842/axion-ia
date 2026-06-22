"use server";

// Server Actions CRUD « Communiqués de presse » (Salle de presse admin).
//
// 2026-06-22 — BASCULE PDF : un communiqué = un PDF uploadé (+ titre, date,
// tag, dek). Plus de saisie du corps texte (`body`) côté admin. Le PDF est
// stocké via les helpers `console-documents/storage.ts` (volume hors web-root)
// et servi publiquement via `/api/presse/communique/[id]`.
//
// Doctrine Axion-IA :
//   - "use server" en tête (Server Actions, pas REST).
//   - Auth admin via `auth()` NextAuth v5.
//   - Upload via FormData (mirror du pattern `uploadPressMediaAsset`).
//   - Zod aux frontières.
//   - `prisma` depuis `@/lib/prisma`, `slugify` depuis `@/lib/slug`.
//   - FR canonique (FR-only ici).
//   - exactOptionalPropertyTypes : aucun `undefined` injecté dans les data
//     Prisma → spreads conditionnels.
//   - Toute mutation revalide `/fr/presse`.

import { extname } from "node:path";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import {
  storeConsoleDoc,
  deleteConsoleDocFile,
  sanitizeConsoleDocFileName,
  CONSOLE_DOC_MAX_BYTES,
} from "@/server/console-documents/storage";
import { pdfBufferToText } from "@/server/press/pdf-extract";
import type { Locale, PublishStatus } from "../../../../prisma/generated/client";

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
const tagSchema = z.enum(["launch", "partnership", "study", "product", "milestone"]);
const statusSchema = z.enum(["draft", "published", "archived"]);

const metaSchema = z.object({
  title: z.string().min(3).max(255),
  dek: z.string().max(320).optional(),
  tag: tagSchema,
  status: statusSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────
// Validation PDF — extension + MIME.
// ─────────────────────────────────────────────────────────────────
const PDF_MIME = new Set<string>([
  "application/pdf",
  // certains navigateurs envoient un type vide → on tolère et on se rabat sur
  // l'extension (validée juste avant).
  "",
]);

interface StoredPdf {
  pdfStoragePath: string;
  pdfFileName: string;
  pdfFileSize: number;
  pdfHashSha256: string;
  /** Corps HTML extrait du PDF (SEO/AEO landing). "" si extraction impossible. */
  bodyHtml: string;
}

/**
 * Valide + stocke un PDF issu d'un champ FormData. Retourne `null` si aucun
 * fichier n'est fourni (cas update : conserver le PDF actuel). Throw une Error
 * (message = code) si le fichier est présent mais invalide.
 */
async function validateAndStorePdf(file: FormDataEntryValue | null): Promise<StoredPdf | null> {
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > CONSOLE_DOC_MAX_BYTES) throw new Error("file_too_large");

  const ext = extname(file.name).toLowerCase();
  if (ext !== ".pdf") throw new Error("unsupported_extension");
  if (!PDF_MIME.has(file.type)) throw new Error("unsupported_mime");

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeConsoleDoc(buffer, file.name);

  // Extraction texte (best-effort, jamais bloquant) pour peupler la landing
  // /presse/[slug] (SEO/AEO). "" si PDF scanné / illisible.
  const bodyHtml = await pdfBufferToText(buffer);

  return {
    pdfStoragePath: stored.storagePath,
    pdfFileName: sanitizeConsoleDocFileName(file.name),
    pdfFileSize: file.size,
    pdfHashSha256: stored.hashSha256,
    bodyHtml,
  };
}

// ─────────────────────────────────────────────────────────────────
// Slug unique par locale (suffixe -2, -3, … en cas de collision).
// `excludeReleaseId` permet de réutiliser le slug du communiqué en cours d'édition.
// ─────────────────────────────────────────────────────────────────
async function uniqueSlug(
  locale: Locale,
  title: string,
  excludeReleaseId?: string,
): Promise<string> {
  const base = slugify(title, { maxLen: 200, fallback: "communique" });
  let candidate = base;
  let n = 1;
  for (;;) {
    const clash = await prisma.pressReleaseTranslation.findFirst({
      where: {
        locale,
        slug: candidate,
        ...(excludeReleaseId ? { releaseId: { not: excludeReleaseId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

function revalidatePresse(): void {
  revalidatePath("/fr/presse");
}

// ─────────────────────────────────────────────────────────────────
// createPressRelease — FormData : title, dek?, tag, status?, file (PDF).
// ─────────────────────────────────────────────────────────────────
export async function createPressRelease(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    await requireAdmin();

    const parsed = metaSchema.safeParse({
      title: formData.get("title"),
      dek: formData.get("dek") ?? undefined,
      tag: formData.get("tag"),
      status: formData.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const meta = parsed.data;
    const status = meta.status ?? "draft";

    // PDF requis à la création.
    const pdf = await validateAndStorePdf(formData.get("file"));
    if (!pdf) return { ok: false, error: "file_required" };

    const frSlug = await uniqueSlug("fr", meta.title);

    const created = await prisma.pressRelease.create({
      data: {
        tag: meta.tag,
        status,
        ...(status === "published" ? { publishedAt: new Date() } : {}),
        pdfStoragePath: pdf.pdfStoragePath,
        pdfFileName: pdf.pdfFileName,
        pdfFileSize: pdf.pdfFileSize,
        pdfHashSha256: pdf.pdfHashSha256,
        translations: {
          create: {
            locale: "fr",
            title: meta.title,
            slug: frSlug,
            // `body` = HTML extrait du PDF (SEO/AEO). Null si extraction vide.
            ...(pdf.bodyHtml ? { body: pdf.bodyHtml } : {}),
            ...(meta.dek ? { dek: meta.dek } : {}),
          },
        },
      },
      select: { id: true },
    });

    revalidatePresse();
    return { ok: true, id: created.id };
  } catch (err) {
    console.error("[createPressRelease]", err);
    return { ok: false, error: err instanceof Error ? err.message : "create_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// updatePressRelease — FormData : title?, dek?, tag?, file? (PDF optionnel).
// Si un nouveau PDF est fourni, on remplace l'ancien (best-effort delete).
// ─────────────────────────────────────────────────────────────────
export async function updatePressRelease(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();

    const parsed = metaSchema.partial().safeParse({
      title: formData.get("title") ?? undefined,
      dek: formData.get("dek") ?? undefined,
      tag: formData.get("tag") ?? undefined,
      status: formData.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const meta = parsed.data;

    const existing = await prisma.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, pdfStoragePath: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    // PDF optionnel à l'update (vide = conserver l'actuel).
    const pdf = await validateAndStorePdf(formData.get("file"));

    await prisma.$transaction(async (tx) => {
      const releaseData: {
        tag?: z.infer<typeof tagSchema>;
        pdfStoragePath?: string;
        pdfFileName?: string;
        pdfFileSize?: number;
        pdfHashSha256?: string;
      } = {};
      if (meta.tag !== undefined) releaseData.tag = meta.tag;
      if (pdf) {
        releaseData.pdfStoragePath = pdf.pdfStoragePath;
        releaseData.pdfFileName = pdf.pdfFileName;
        releaseData.pdfFileSize = pdf.pdfFileSize;
        releaseData.pdfHashSha256 = pdf.pdfHashSha256;
      }
      if (Object.keys(releaseData).length > 0) {
        await tx.pressRelease.update({ where: { id }, data: releaseData });
      }

      // Traduction FR (titre + dek + body). Sur remplacement du PDF, on
      // ré-extrait le texte → met à jour `body` (la landing se repeuple).
      const trData: { title?: string; dek?: string; slug?: string; body?: string } = {};
      if (meta.title !== undefined) {
        trData.title = meta.title;
        trData.slug = await uniqueSlug("fr", meta.title, id);
      }
      if (meta.dek !== undefined) trData.dek = meta.dek;
      // PDF remplacé avec un texte exploitable → on rafraîchit le corps HTML.
      if (pdf && pdf.bodyHtml) trData.body = pdf.bodyHtml;

      if (Object.keys(trData).length > 0) {
        const existingTr = await tx.pressReleaseTranslation.findUnique({
          where: { releaseId_locale: { releaseId: id, locale: "fr" } },
          select: { id: true },
        });
        if (existingTr) {
          await tx.pressReleaseTranslation.update({
            where: { releaseId_locale: { releaseId: id, locale: "fr" } },
            data: trData,
          });
        } else if (trData.title !== undefined) {
          await tx.pressReleaseTranslation.create({
            data: {
              releaseId: id,
              locale: "fr",
              title: trData.title,
              slug: trData.slug ?? (await uniqueSlug("fr", trData.title, id)),
              ...(trData.dek !== undefined ? { dek: trData.dek } : {}),
              ...(trData.body !== undefined ? { body: trData.body } : {}),
            },
          });
        }
      }
    });

    // Remplacement PDF réussi → retrait best-effort de l'ancien binaire.
    if (pdf && existing.pdfStoragePath && existing.pdfStoragePath !== pdf.pdfStoragePath) {
      await deleteConsoleDocFile(existing.pdfStoragePath);
    }

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[updatePressRelease]", err);
    return { ok: false, error: err instanceof Error ? err.message : "update_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// setPressReleaseStatus — publie/dépublie. Pose publishedAt au 1er publish.
// ─────────────────────────────────────────────────────────────────
export async function setPressReleaseStatus(
  id: string,
  status: PublishStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!statusSchema.safeParse(status).success) {
      return { ok: false, error: "invalid_status" };
    }

    const existing = await prisma.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, publishedAt: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.pressRelease.update({
      where: { id },
      data: {
        status,
        // 1er publish uniquement : on pose publishedAt=now (sinon on préserve).
        ...(status === "published" && !existing.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[setPressReleaseStatus]", err);
    return { ok: false, error: err instanceof Error ? err.message : "status_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// deletePressRelease — soft delete + suppression PDF best-effort.
// ─────────────────────────────────────────────────────────────────
export async function deletePressRelease(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const existing = await prisma.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, pdfStoragePath: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.pressRelease.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });

    // Best-effort : retrait du binaire PDF du disque.
    await deleteConsoleDocFile(existing.pdfStoragePath);

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[deletePressRelease]", err);
    return { ok: false, error: err instanceof Error ? err.message : "delete_failed" };
  }
}
