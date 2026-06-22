"use server";

// Server Actions CRUD « Communiqués de presse » (Salle de presse admin).
//
// Doctrine Axion-IA :
//   - "use server" en tête (Server Actions, pas REST).
//   - Auth admin via `auth()` NextAuth v5 (mirror du pattern admin-faq).
//   - Zod aux frontières.
//   - `prisma` depuis `@/lib/prisma`, `slugify` depuis `@/lib/slug`.
//   - FR canonique obligatoire, EN optionnel.
//   - exactOptionalPropertyTypes : aucun `undefined` injecté dans les data
//     Prisma → spreads conditionnels.
//   - Toute mutation revalide `/fr/presse`.

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
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

const translationSchema = z.object({
  title: z.string().min(3).max(255),
  dek: z.string().max(320).optional(),
  body: z.string().min(1),
});

const createSchema = z.object({
  tag: tagSchema,
  status: statusSchema.optional(),
  fr: translationSchema,
  en: translationSchema.optional(),
});

const updateSchema = z.object({
  tag: tagSchema.optional(),
  fr: translationSchema.partial().optional(),
  en: translationSchema.partial().optional(),
});

export type CreatePressReleaseInput = z.infer<typeof createSchema>;
export type UpdatePressReleaseInput = z.infer<typeof updateSchema>;

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
// createPressRelease.
// ─────────────────────────────────────────────────────────────────
export async function createPressRelease(
  input: CreatePressReleaseInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    await requireAdmin();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const data = parsed.data;
    const status = data.status ?? "draft";

    const frSlug = await uniqueSlug("fr", data.fr.title);
    const translations: Array<{
      locale: Locale;
      title: string;
      slug: string;
      body: string;
      dek?: string;
    }> = [
      {
        locale: "fr",
        title: data.fr.title,
        slug: frSlug,
        body: data.fr.body,
        ...(data.fr.dek ? { dek: data.fr.dek } : {}),
      },
    ];

    if (data.en) {
      const enSlug = await uniqueSlug("en", data.en.title);
      translations.push({
        locale: "en",
        title: data.en.title,
        slug: enSlug,
        body: data.en.body,
        ...(data.en.dek ? { dek: data.en.dek } : {}),
      });
    }

    const created = await prisma.pressRelease.create({
      data: {
        tag: data.tag,
        status,
        ...(status === "published" ? { publishedAt: new Date() } : {}),
        translations: { create: translations },
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
// updatePressRelease.
// ─────────────────────────────────────────────────────────────────
export async function updatePressRelease(
  id: string,
  input: UpdatePressReleaseInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const data = parsed.data;

    const existing = await prisma.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.$transaction(async (tx) => {
      if (data.tag) {
        await tx.pressRelease.update({ where: { id }, data: { tag: data.tag } });
      }

      for (const locale of ["fr", "en"] as const) {
        const patch = data[locale];
        if (!patch) continue;

        const updateData: { title?: string; body?: string; dek?: string; slug?: string } = {};
        if (patch.title !== undefined) {
          updateData.title = patch.title;
          updateData.slug = await uniqueSlug(locale, patch.title, id);
        }
        if (patch.body !== undefined) updateData.body = patch.body;
        if (patch.dek !== undefined) updateData.dek = patch.dek;
        if (Object.keys(updateData).length === 0) continue;

        const existingTr = await tx.pressReleaseTranslation.findUnique({
          where: { releaseId_locale: { releaseId: id, locale } },
          select: { id: true },
        });

        if (existingTr) {
          await tx.pressReleaseTranslation.update({
            where: { releaseId_locale: { releaseId: id, locale } },
            data: updateData,
          });
        } else {
          // Création d'une nouvelle traduction (ex. ajout EN) — title + body requis.
          if (updateData.title === undefined || updateData.body === undefined) continue;
          await tx.pressReleaseTranslation.create({
            data: {
              releaseId: id,
              locale,
              title: updateData.title,
              slug: updateData.slug ?? (await uniqueSlug(locale, updateData.title, id)),
              body: updateData.body,
              ...(updateData.dek !== undefined ? { dek: updateData.dek } : {}),
            },
          });
        }
      }
    });

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
// deletePressRelease — soft delete.
// ─────────────────────────────────────────────────────────────────
export async function deletePressRelease(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const existing = await prisma.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.pressRelease.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[deletePressRelease]", err);
    return { ok: false, error: err instanceof Error ? err.message : "delete_failed" };
  }
}
