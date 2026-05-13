/** KB-4 — schedulePublishAction (approved → scheduled). Cron BullMQ Sprint KB-17 publiera. */
"use server";

import { z } from "zod";
import { requireAdminWrite } from "./_guards";
import { executeTransition, type TransitionResult } from "./_transition";

const inputSchema = z.object({
  id: z.string().uuid(),
  scheduledFor: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: "scheduledFor doit être dans le futur",
  }),
});

export async function schedulePublishAction(input: {
  id: string;
  scheduledFor: string | Date;
}): Promise<TransitionResult> {
  const session = await requireAdminWrite();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", reason: parsed.error.message };

  return executeTransition({
    entryId: parsed.data.id,
    toStatus: "scheduled",
    auditAction: "kb.scheduled",
    context: { userRole: session.role, userId: session.userId },
    snapshot: true,
    extraEntryUpdates: { scheduledFor: parsed.data.scheduledFor },
    auditChanges: { scheduledFor: parsed.data.scheduledFor.toISOString() },
  });
}
