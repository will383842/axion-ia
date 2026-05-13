/**
 * KB-3 — Server action listEntriesAction (lecture admin filtrable).
 *
 * Utilise les helpers `src/lib/knowledge/prisma-helpers.ts` (`buildListWhere`).
 * Pagination cursor-friendly (page-based pour UI admin V1).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminRead } from "./_guards";
import { KB_AUDIENCES } from "@/content/knowledge/audiences";
import { KB_DOMAINS } from "@/content/knowledge/domains";
import { KB_STATUSES } from "@/content/knowledge/statuses";
import { KB_TYPES } from "@/content/knowledge/types";
import { buildListWhere, COMMON_ENTRY_INCLUDE } from "@/lib/knowledge/prisma-helpers";
import type { KbAudience, KbStatus, KbType } from "../../../../prisma/generated/client";

const listInputSchema = z.object({
  type: z
    .enum(KB_TYPES as unknown as readonly [string, ...string[]])
    .optional()
    .nullable(),
  audience: z
    .enum([...KB_AUDIENCES, "all"] as unknown as readonly [string, ...string[]])
    .default("all"),
  status: z
    .enum(KB_STATUSES as unknown as readonly [string, ...string[]])
    .optional()
    .nullable(),
  domain: z
    .enum(KB_DOMAINS as unknown as readonly [string, ...string[]])
    .optional()
    .nullable(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

export type ListEntriesInput = z.infer<typeof listInputSchema>;

export async function listEntriesAction(input: Partial<ListEntriesInput> = {}) {
  await requireAdminRead();
  const parsed = listInputSchema.parse(input);

  const where = buildListWhere({
    audience: parsed.audience as KbAudience | "all",
    ...(parsed.type ? { type: parsed.type as KbType } : {}),
    ...(parsed.status ? { statuses: [parsed.status as KbStatus] } : {}),
    ...(parsed.domain ? { domain: parsed.domain } : {}),
    ...(parsed.search ? { search: parsed.search } : {}),
  });

  const [total, items] = await Promise.all([
    prisma.knowledgeEntry.count({ where }),
    prisma.knowledgeEntry.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      include: COMMON_ENTRY_INCLUDE,
    }),
  ]);

  return {
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
    items,
  };
}
