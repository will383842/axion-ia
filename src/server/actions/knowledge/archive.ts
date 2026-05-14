/** KB-4 — archiveAction (any → archived). OWNER only. State machine valide la transition. */
"use server";

import { z } from "zod";
import { requireAdminDelete } from "./_guards";
import { executeTransition, type TransitionResult } from "./_transition";

const inputSchema = z.object({ id: z.string().uuid() });

export async function archiveAction(input: { id: string }): Promise<TransitionResult> {
  const session = await requireAdminDelete();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  return executeTransition({
    entryId: parsed.data.id,
    toStatus: "archived",
    auditAction: "kb.archived",
    context: { userRole: session.role, userId: session.userId },
    snapshot: true,
  });
}
