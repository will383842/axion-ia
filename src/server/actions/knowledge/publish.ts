/**
 * KB-4 — publishAction (approved → published).
 * Side-effects : publishedAt=now + alt-text validation (KB-10 bloquant).
 */
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateAltText } from "@/lib/knowledge/alt-text-validation";
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

  // KB-10 : validation alt text bloquante avant publish (WCAG 2.2 AA 1.1.1).
  if (!parsed.data.forceOverride) {
    const translations = await prisma.knowledgeTranslation.findMany({
      where: { entryId: parsed.data.id },
      select: { locale: true, body: true },
    });
    for (const t of translations) {
      const validation = validateAltText(t.body);
      if (!validation.valid) {
        return {
          ok: false,
          error: "alt_text_violation",
          reason: `${t.locale}: ${validation.imagesWithoutAlt}/${validation.totalImages} images sans alt — publication refusée (override admin requis)`,
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
