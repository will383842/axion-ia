/** KB-4 — publishAction (approved → published). Side-effect : publishedAt=now. */
"use server";

import { z } from "zod";
import { requireAdminWrite } from "./_guards";
import { executeTransition, type TransitionResult } from "./_transition";

const inputSchema = z.object({ id: z.string().uuid() });

export async function publishAction(input: { id: string }): Promise<TransitionResult> {
  const session = await requireAdminWrite();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  return executeTransition({
    entryId: parsed.data.id,
    toStatus: "published",
    auditAction: "kb.published",
    context: { userRole: session.role, userId: session.userId },
    snapshot: true,
    extraEntryUpdates: { publishedAt: new Date() },
  });
}
