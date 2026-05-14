/**
 * KB-3 — Server action getEntryAction (lecture admin détail).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminRead } from "./_guards";
import { DETAILED_ENTRY_INCLUDE } from "@/lib/knowledge/prisma-helpers";

const inputSchema = z.object({ id: z.string().uuid() });

export async function getEntryAction(input: { id: string }) {
  await requireAdminRead();
  const parsed = inputSchema.parse(input);

  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: parsed.id },
    include: DETAILED_ENTRY_INCLUDE,
  });

  return entry;
}
