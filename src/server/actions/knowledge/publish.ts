/**
 * KB-4 — publishAction (approved → published).
 * Side-effects : publishedAt=now + alt-text (KB-10) + banned words (V4) bloquants.
 */
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateAltText } from "@/lib/knowledge/alt-text-validation";
import { checkTranslationBannedWords } from "@/lib/knowledge/banned-words";
import { requireAdminWrite } from "./_guards";
import { executeTransition, type TransitionResult } from "./_transition";

const inputSchema = z.object({
  id: z.string().uuid(),
  /** Override admin justifié pour publier malgré violations alt-text (loggé). */
  forceOverride: z.boolean().optional(),
});

export async function publishAction(input: {
  id: string;
  forceOverride?: boolean;
}): Promise<TransitionResult> {
  const session = await requireAdminWrite();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  // KB-10 + V4 : validations bloquantes avant publish.
  if (!parsed.data.forceOverride) {
    const translations = await prisma.knowledgeTranslation.findMany({
      where: { entryId: parsed.data.id },
      select: {
        locale: true,
        title: true,
        excerpt: true,
        body: true,
        bodyText: true,
        metaTitle: true,
        metaDescription: true,
      },
    });
    for (const t of translations) {
      // KB-10 — alt text WCAG 2.2 AA 1.1.1
      const altValidation = validateAltText(t.body);
      if (!altValidation.valid) {
        return {
          ok: false,
          error: "alt_text_violation",
          reason: `${t.locale}: ${altValidation.imagesWithoutAlt}/${altValidation.totalImages} images sans alt — publication refusée (override admin requis)`,
        };
      }
      // V4 — banned words (doctrine axionia-core, mot « formation » interdit)
      const bannedCheck = checkTranslationBannedWords(t);
      if (!bannedCheck.valid) {
        return {
          ok: false,
          error: "banned_words_violation",
          reason: `${t.locale}: mot banni dans ${bannedCheck.fieldViolations.map((v) => v.field).join(", ")} — utiliser intervention_module ou competence_boost`,
        };
      }
    }
  }

  return executeTransition({
    entryId: parsed.data.id,
    toStatus: "published",
    auditAction: "kb.published",
    context: { userRole: session.role, userId: session.userId },
    snapshot: true,
    extraEntryUpdates: { publishedAt: new Date() },
    ...(parsed.data.forceOverride
      ? { auditChanges: { altTextOverride: true, overrideBy: session.userId } }
      : {}),
  });
}
