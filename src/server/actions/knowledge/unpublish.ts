/** KB-4 — unpublishAction (published → archived). OWNER only. */
"use server";

import { z } from "zod";
import { requireAdminDelete } from "./_guards";
import { executeTransition, type TransitionResult } from "./_transition";

const inputSchema = z.object({ id: z.string().uuid() });

export async function unpublishAction(input: { id: string }): Promise<TransitionResult> {
  const session = await requireAdminDelete();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  return executeTransition({
    entryId: parsed.data.id,
    toStatus: "archived",
    auditAction: "kb.unpublished",
    context: { userRole: session.role, userId: session.userId },
    snapshot: true,
  });
}
