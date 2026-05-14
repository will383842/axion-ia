/**
 * Content Generator — CRUD BannedPhrase (admin /settings/banned-phrases).
 *
 * § 21 master prompt — phrases interdites doctrine (« unique », « le meilleur »,
 * « révolutionnaire »…). Le quality module `doctrine-check` lit cette table à
 * chaque génération et rejette si severity=block, log warn si severity=warn.
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./_auth";

const VALID_SEVERITY = new Set(["warn", "block"]);

export interface BannedPhraseRow {
  readonly id: string;
  readonly pattern: string;
  readonly reason: string | null;
  readonly severity: string;
  readonly isActive: boolean;
  readonly updatedAt: Date;
}

export async function listBannedPhrases(): Promise<ReadonlyArray<BannedPhraseRow>> {
  const rows = await prisma.bannedPhrase.findMany({
    orderBy: [{ isActive: "desc" }, { pattern: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    reason: r.reason,
    severity: r.severity,
    isActive: r.isActive,
    updatedAt: r.updatedAt,
  }));
}

export async function createBannedPhrase(input: {
  pattern: string;
  reason?: string;
  severity: string;
}): Promise<void> {
  await requireAdmin();
  const pattern = input.pattern.trim();
  if (pattern.length < 2 || pattern.length > 200) throw new Error("pattern_length_invalid");
  if (!VALID_SEVERITY.has(input.severity)) throw new Error("severity_invalid");
  await prisma.bannedPhrase.create({
    data: {
      pattern,
      reason: input.reason?.trim() || null,
      severity: input.severity,
      isActive: true,
    },
  });
  revalidatePath(
    `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/banned-phrases`,
  );
}

export async function toggleBannedPhrase(id: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  await prisma.bannedPhrase.update({
    where: { id },
    data: { isActive },
  });
  revalidatePath(
    `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/banned-phrases`,
  );
}

export async function deleteBannedPhrase(id: string): Promise<void> {
  await requireAdmin();
  await prisma.bannedPhrase.delete({ where: { id } });
  revalidatePath(
    `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/banned-phrases`,
  );
}
