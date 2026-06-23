"use server";

// Server Actions CRUD « Couverture médias » (retombées presse externes).
//
// Une retombée = un média (outlet) + l'URL externe de l'article + une date de
// publication + un titre traduit (FR canonique, EN miroir optionnel). Pas
// d'upload : le contenu reste hébergé chez le média.
//
// Doctrine Axion-IA :
//   - "use server" en tête (Server Actions, pas REST).
//   - Auth admin via `auth()` NextAuth v5 (mirror `releases.ts`).
//   - Zod aux frontières.
//   - `prisma` depuis `@/lib/prisma`.
//   - FR canonique ; titre EN optionnel.
//   - exactOptionalPropertyTypes : aucun `undefined` injecté → spreads conditionnels.
//   - Toute mutation revalide `/fr/presse` + la liste admin.

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { PublishStatus } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────
// Auth (mirror releases.ts).
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
const statusSchema = z.enum(["draft", "published", "archived"]);

const inputSchema = z.object({
  outlet: z.string().min(2).max(255),
  url: z.string().url().max(2000),
  publishedAt: z.coerce.date(),
  titleFr: z.string().min(3).max(255),
  titleEn: z.string().max(255).optional(),
  status: statusSchema.optional(),
});

function revalidateAll(): void {
  revalidatePath("/fr/presse");
  revalidatePath("/[locale]/(admin)/[adminPrefix]/presse/couverture", "page");
}

// ─────────────────────────────────────────────────────────────────
// createMediaCoverage — FormData : outlet, url, publishedAt, titleFr, titleEn?, status?.
// ─────────────────────────────────────────────────────────────────
export async function createMediaCoverage(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    await requireAdmin();

    const parsed = inputSchema.safeParse({
      outlet: formData.get("outlet"),
      url: formData.get("url"),
      publishedAt: formData.get("publishedAt"),
      titleFr: formData.get("titleFr"),
      titleEn: formData.get("titleEn") || undefined,
      status: formData.get("status") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const data = parsed.data;
    const status = data.status ?? "draft";

    const created = await prisma.mediaCoverage.create({
      data: {
        outlet: data.outlet,
        url: data.url,
        publishedAt: data.publishedAt,
        status,
        translations: {
          create: [
            { locale: "fr", title: data.titleFr },
            ...(data.titleEn ? [{ locale: "en" as const, title: data.titleEn }] : []),
          ],
        },
      },
      select: { id: true },
    });

    revalidateAll();
    return { ok: true, id: created.id };
  } catch (err) {
    console.error("[createMediaCoverage]", err);
    return { ok: false, error: err instanceof Error ? err.message : "create_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// updateMediaCoverage — FormData : outlet?, url?, publishedAt?, titleFr?, titleEn?, status?.
// Le titre EN vide retire la traduction EN (delete) ; non fourni = inchangé.
// ─────────────────────────────────────────────────────────────────
export async function updateMediaCoverage(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();

    const parsed = inputSchema.partial().safeParse({
      outlet: formData.get("outlet") ?? undefined,
      url: formData.get("url") ?? undefined,
      publishedAt: formData.get("publishedAt") ?? undefined,
      titleFr: formData.get("titleFr") ?? undefined,
      // EN : on distingue "absent" (clé manquante) de "vidé" ("").
      titleEn: formData.has("titleEn") ? (formData.get("titleEn") ?? "") : undefined,
      status: formData.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const data = parsed.data;

    const existing = await prisma.mediaCoverage.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.$transaction(async (tx) => {
      const coverageData: {
        outlet?: string;
        url?: string;
        publishedAt?: Date;
        status?: z.infer<typeof statusSchema>;
      } = {};
      if (data.outlet !== undefined) coverageData.outlet = data.outlet;
      if (data.url !== undefined) coverageData.url = data.url;
      if (data.publishedAt !== undefined) coverageData.publishedAt = data.publishedAt;
      if (data.status !== undefined) coverageData.status = data.status;
      if (Object.keys(coverageData).length > 0) {
        await tx.mediaCoverage.update({ where: { id }, data: coverageData });
      }

      // Traduction FR (upsert sur titre).
      if (data.titleFr !== undefined) {
        await tx.mediaCoverageTranslation.upsert({
          where: { coverageId_locale: { coverageId: id, locale: "fr" } },
          create: { coverageId: id, locale: "fr", title: data.titleFr },
          update: { title: data.titleFr },
        });
      }

      // Traduction EN : titre fourni → upsert ; titre vidé ("") → suppression.
      if (data.titleEn !== undefined) {
        if (data.titleEn.trim().length > 0) {
          await tx.mediaCoverageTranslation.upsert({
            where: { coverageId_locale: { coverageId: id, locale: "en" } },
            create: { coverageId: id, locale: "en", title: data.titleEn },
            update: { title: data.titleEn },
          });
        } else {
          await tx.mediaCoverageTranslation.deleteMany({
            where: { coverageId: id, locale: "en" },
          });
        }
      }
    });

    revalidateAll();
    return { ok: true };
  } catch (err) {
    console.error("[updateMediaCoverage]", err);
    return { ok: false, error: err instanceof Error ? err.message : "update_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// setMediaCoverageStatus — publie / dépublie (mirror setPressReleaseStatus).
// ─────────────────────────────────────────────────────────────────
export async function setMediaCoverageStatus(
  id: string,
  status: PublishStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!statusSchema.safeParse(status).success) {
      return { ok: false, error: "invalid_status" };
    }

    const existing = await prisma.mediaCoverage.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.mediaCoverage.update({ where: { id }, data: { status } });

    revalidateAll();
    return { ok: true };
  } catch (err) {
    console.error("[setMediaCoverageStatus]", err);
    return { ok: false, error: err instanceof Error ? err.message : "status_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// softDeleteMediaCoverage — soft delete (mirror deletePressRelease).
// ─────────────────────────────────────────────────────────────────
export async function softDeleteMediaCoverage(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const existing = await prisma.mediaCoverage.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.mediaCoverage.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });

    revalidateAll();
    return { ok: true };
  } catch (err) {
    console.error("[softDeleteMediaCoverage]", err);
    return { ok: false, error: err instanceof Error ? err.message : "delete_failed" };
  }
}
