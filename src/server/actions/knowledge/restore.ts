/** KB-4 — restoreAction (archived → draft, OR deprecated → published). OWNER only. */
"use server";

import { z } from "zod";
import type { KbStatus } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { requireAdminDelete } from "./_guards";
import { raisonDoctrineEntree } from "./_doctrine";
import { executeTransition, type TransitionResult } from "./_transition";

const inputSchema = z.object({ id: z.string().uuid() });

export async function restoreAction(input: { id: string }): Promise<TransitionResult> {
  const session = await requireAdminDelete();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: parsed.data.id },
    select: { status: true },
  });
  if (!entry) return { ok: false, error: "not_found" };

  let toStatus: KbStatus;
  if (entry.status === "archived") toStatus = "draft";
  else if (entry.status === "deprecated") toStatus = "published";
  else
    return {
      ok: false,
      error: "transition_refused",
      reason: "entry must be archived or deprecated",
    };

  if (toStatus === "published") {
    const raison = await raisonDoctrineEntree(parsed.data.id);
    if (raison) return { ok: false, error: "banned_words_violation", reason: raison };
  }

  return executeTransition({
    entryId: parsed.data.id,
    toStatus,
    auditAction: "kb.restored",
    context: { userRole: session.role, userId: session.userId },
    snapshot: true,
  });
}
