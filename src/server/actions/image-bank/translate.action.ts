"use server";

// Template : src/server/actions/image-bank/translate.action.ts
//
// Server Action — trigger une (re-)traduction Claude Sonnet 4.6 vision.

import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { ImageTranslationService } from "@/server/image-bank/services/image-translation.service";

const TranslateSchema = z.object({
  imageId: z.string().uuid(),
  sourceLang: z.enum(["fr", "en"]),
  targetLang: z.enum(["fr", "en"]),
});

export type TranslateActionResult = { success: true } | { success: false; error: string };

const translator = new ImageTranslationService();

export async function translateImageAction(
  input: z.input<typeof TranslateSchema>,
): Promise<TranslateActionResult> {
  const session = await auth();
  if (
    !session?.user?.role ||
    (session.user.role !== "admin" && session.user.role !== "super_admin")
  ) {
    redirect("/api/auth/signin?error=Unauthorized");
  }

  const parsed = TranslateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  if (parsed.data.sourceLang === parsed.data.targetLang) {
    return { success: false, error: "Source and target languages must differ" };
  }

  try {
    await translator.translateAndSave(parsed.data);
    return { success: true };
  } catch (err) {
    console.error("[translateImageAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Translation failed" };
  }
}
