/**
 * Content Generator — CRUD BannedPhrase (admin /settings/banned-phrases).
 *
 * § 21 master prompt — phrases interdites doctrine (« unique », « le meilleur »,
 * « révolutionnaire »…). Le quality module `doctrine-check` lit cette table à
 * chaque génération et rejette si severity=block, log warn si severity=warn.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { requireAdmin } from "./_auth";

const VALID_SEVERITY = new Set(["warn", "block"]);

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const IdSchema = z.string().min(1).max(64);
const CreateBannedPhraseSchema = z
  .object({
    pattern: z.string().min(1).max(500),
    reason: z.string().max(500).optional(),
    severity: z.enum(["warn", "block"]),
  })
  .strict();
const ScanPhraseSchema = z.string().min(1).max(500);

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
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  CreateBannedPhraseSchema.parse(input);
  const pattern = input.pattern.trim();
  if (pattern.length < 2 || pattern.length > 200) throw new Error("pattern_length_invalid");
  if (!VALID_SEVERITY.has(input.severity)) throw new Error("severity_invalid");
  const row = await prisma.bannedPhrase.create({
    data: {
      pattern,
      reason: input.reason?.trim() || null,
      severity: input.severity,
      isActive: true,
    },
    select: { id: true },
  });
  revalidatePath(
    `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/banned-phrases`,
  );
  await logActivity({
    session,
    action: "content-gen.banned-phrase.create",
    targetType: "BannedPhrase",
    targetId: row.id,
    changes: { pattern, severity: input.severity },
  });
}

export async function toggleBannedPhrase(id: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  IdSchema.parse(id);
  z.boolean().parse(isActive);
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
  // Sprint Final P1-3 — Zod runtime validation.
  IdSchema.parse(id);
  await prisma.bannedPhrase.delete({ where: { id } });
  revalidatePath(
    `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/banned-phrases`,
  );
}

/**
 * Scan rétroactif d'Article publiés contenant une phrase interdite (P2-E fix
 * audit opérationnel 2026-05-15).
 *
 * Quand Will ajoute une phrase au banned-list, les Articles déjà publiés
 * passent sous le radar (doctrine-check ne tourne qu'à la génération). Cette
 * action retourne la liste des articles potentiellement contaminés pour
 * permettre un retraitement manuel (edit / demote / archive).
 *
 * Limite 200 résultats. Match case-insensitive sur ArticleTranslation.body
 * + .title + .metaTitle + .metaDescription. Locale FR uniquement.
 */
export interface PhraseScanHit {
  readonly articleId: string;
  readonly slug: string;
  readonly title: string;
  readonly publishedAt: Date | null;
  readonly indexationTier: string;
  readonly matchedIn: ReadonlyArray<"title" | "body" | "metaTitle" | "metaDescription">;
}

export async function scanArticlesForPhrase(phrase: string): Promise<{
  readonly phrase: string;
  readonly hits: ReadonlyArray<PhraseScanHit>;
  readonly capped: boolean;
}> {
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ScanPhraseSchema.parse(phrase);
  const needle = phrase.trim();
  if (needle.length < 2 || needle.length > 200) throw new Error("phrase_length_invalid");

  const LIMIT = 200;
  const rows = await prisma.articleTranslation.findMany({
    where: {
      locale: "fr",
      article: { status: "published" },
      OR: [
        { title: { contains: needle, mode: "insensitive" } },
        { body: { contains: needle, mode: "insensitive" } },
        { metaTitle: { contains: needle, mode: "insensitive" } },
        { metaDescription: { contains: needle, mode: "insensitive" } },
      ],
    },
    include: {
      article: {
        select: { id: true, publishedAt: true, indexationTier: true },
      },
    },
    orderBy: { article: { publishedAt: "desc" } },
    take: LIMIT + 1,
  });

  const hits: PhraseScanHit[] = rows.slice(0, LIMIT).map((t) => {
    const matchedIn: PhraseScanHit["matchedIn"][number][] = [];
    const lc = needle.toLowerCase();
    if (t.title.toLowerCase().includes(lc)) matchedIn.push("title");
    if (t.body.toLowerCase().includes(lc)) matchedIn.push("body");
    if (t.metaTitle?.toLowerCase().includes(lc)) matchedIn.push("metaTitle");
    if (t.metaDescription?.toLowerCase().includes(lc)) matchedIn.push("metaDescription");
    return {
      articleId: t.article.id,
      slug: t.slug,
      title: t.title,
      publishedAt: t.article.publishedAt,
      indexationTier: t.article.indexationTier,
      matchedIn,
    };
  });

  return {
    phrase: needle,
    hits,
    capped: rows.length > LIMIT,
  };
}
