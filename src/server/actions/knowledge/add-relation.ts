/**
 * KB-4 — add/remove relation entry-to-entry (graphe typé + cycle detection DAG).
 */

"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { isDagKind, KB_RELATION_KINDS } from "@/content/knowledge/relation-kinds";
import { requireAdminWrite } from "./_guards";
import { logKbActivity } from "./_audit";
import { revalidateAdminKbRoutes } from "./_revalidate";
import type { KbRelationKind } from "../../../../prisma/generated/client";

const addInputSchema = z.object({
  fromEntryId: z.string().uuid(),
  toEntryId: z.string().uuid(),
  kind: z.enum(KB_RELATION_KINDS as unknown as readonly [string, ...string[]]),
});

const removeInputSchema = z.object({ id: z.string().uuid() });

export interface RelationResult {
  readonly ok: boolean;
  readonly relationId?: string;
  readonly error?: string;
  readonly reason?: string;
}

async function wouldCreateCycle(
  fromEntryId: string,
  toEntryId: string,
  kind: KbRelationKind,
): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [toEntryId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === fromEntryId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = await prisma.knowledgeRelation.findMany({
      where: { fromEntryId: current, kind },
      select: { toEntryId: true },
    });
    for (const n of neighbors) queue.push(n.toEntryId);
    if (visited.size > 100) break;
  }
  return false;
}

export async function addRelationAction(input: {
  fromEntryId: string;
  toEntryId: string;
  kind: string;
}): Promise<RelationResult> {
  const session = await requireAdminWrite();
  const parsed = addInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  if (parsed.data.fromEntryId === parsed.data.toEntryId) {
    return { ok: false, error: "self_loop", reason: "fromEntryId === toEntryId" };
  }

  const [from, to] = await Promise.all([
    prisma.knowledgeEntry.findUnique({
      where: { id: parsed.data.fromEntryId },
      select: { id: true, deletedAt: true },
    }),
    prisma.knowledgeEntry.findUnique({
      where: { id: parsed.data.toEntryId },
      select: { id: true, deletedAt: true },
    }),
  ]);
  if (!from || from.deletedAt || !to || to.deletedAt) {
    return { ok: false, error: "not_found" };
  }

  const kind = parsed.data.kind as KbRelationKind;

  if (isDagKind(kind)) {
    const cycle = await wouldCreateCycle(parsed.data.fromEntryId, parsed.data.toEntryId, kind);
    if (cycle) return { ok: false, error: "cycle_detected", reason: `Cycle DAG sur kind=${kind}` };
  }

  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get("user-agent");

  try {
    const relation = await prisma.knowledgeRelation.create({
      data: {
        fromEntryId: parsed.data.fromEntryId,
        toEntryId: parsed.data.toEntryId,
        kind,
        createdById: session.userId,
      },
      select: { id: true },
    });

    await logKbActivity({
      action: "kb.updated",
      entryId: parsed.data.fromEntryId,
      adminUserId: session.userId,
      ipAddress: ip,
      userAgent: ua,
      changes: {
        relationAdded: { id: relation.id, toEntryId: parsed.data.toEntryId, kind },
      },
    });

    revalidateAdminKbRoutes(parsed.data.fromEntryId);
    revalidateAdminKbRoutes(parsed.data.toEntryId);

    return { ok: true, relationId: relation.id };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique")) {
      return { ok: false, error: "already_exists" };
    }
    console.error("[kb.addRelation] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function removeRelationAction(input: { id: string }): Promise<RelationResult> {
  const session = await requireAdminWrite();
  const parsed = removeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const relation = await prisma.knowledgeRelation.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, fromEntryId: true, toEntryId: true, kind: true },
  });
  if (!relation) return { ok: false, error: "not_found" };

  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get("user-agent");

  try {
    await prisma.knowledgeRelation.delete({ where: { id: parsed.data.id } });

    await logKbActivity({
      action: "kb.updated",
      entryId: relation.fromEntryId,
      adminUserId: session.userId,
      ipAddress: ip,
      userAgent: ua,
      changes: {
        relationRemoved: { id: relation.id, toEntryId: relation.toEntryId, kind: relation.kind },
      },
    });

    revalidateAdminKbRoutes(relation.fromEntryId);
    revalidateAdminKbRoutes(relation.toEntryId);

    return { ok: true };
  } catch (err) {
    console.error("[kb.removeRelation] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
