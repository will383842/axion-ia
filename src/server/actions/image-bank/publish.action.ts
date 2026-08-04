"use server";

// Template : src/server/actions/image-bank/publish.action.ts
//
// Server Action — publish une translation après gate SEO score ≥ 80.

import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { imageBankService } from "@/server/image-bank/services/image-bank.service";

const PublishSchema = z.object({
  imageId: z.string().uuid(),
  lang: z.enum(["fr", "en"]),
  /** Si true, force le publish même si SEO score < 80 (override admin). */
  force: z.boolean().optional().default(false),
});

export type PublishActionResult =
  { success: true; publishedAt: string } | { success: false; error: string; seoScore?: number };

export async function publishTranslationAction(
  input: z.input<typeof PublishSchema>,
): Promise<PublishActionResult> {
  const session = await auth();
  if (
    !session?.user?.role ||
    (session.user.role !== "admin" && session.user.role !== "super_admin")
  ) {
    redirect("/api/auth/signin?error=Unauthorized");
  }

  const parsed = PublishSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  const { imageId, lang, force } = parsed.data;

  // Gate SEO score ≥ 80
  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: { seoScore: true },
  });
  if (!image) return { success: false, error: "Image not found" };

  if (image.seoScore < 80 && !force) {
    return {
      success: false,
      error: `SEO score ${image.seoScore} < 80 (gate). Améliorez metadata ou force=true.`,
      seoScore: image.seoScore,
    };
  }

  const tr = await imageBankService.publish(imageId, lang);
  return {
    success: true,
    publishedAt: (tr.publishedAt ?? new Date()).toISOString(),
  };
}
