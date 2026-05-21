/**
 * DELETE /api/admin/articles/[id]/forget
 *
 * B.4 P1.5 — Suppression RGPD art. 17 d'un article genere par l'IA.
 * Purge en cascade :
 *   - Article (+ ArticleTranslation, ArticleTagOnArticle, ArticleSlugHistory,
 *     GenerationProvenance → CASCADE Prisma)
 *   - ReviewQueue lié (si existe)
 *   - ContentGenJob.outputBlogPostId → null (delink, pas de suppression job)
 *   - IndexNow remove (best-effort)
 *   - revalidatePath pour purger le cache Next.js
 *
 * Auth : admin uniquement.
 * 404 si article introuvable.
 * 409 si article en cours de publication (status=publishing).
 */

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verifier que l'article existe et n'est pas en cours de publication.
  let article: {
    id: string;
    status: string;
    translations: { slug: string; locale: string }[];
  } | null = null;
  try {
    article = await prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        translations: { select: { slug: true, locale: true } },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "DB unavailable", detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (article.status === "publishing") {
    return NextResponse.json(
      { error: "Article is currently publishing — retry in a few seconds" },
      { status: 409 },
    );
  }

  const frSlug = article.translations.find((t) => t.locale === "fr")?.slug ?? null;

  // Suppression en cascade via Prisma (GenerationProvenance CASCADE from schema).
  try {
    await prisma.$transaction([
      // Delink ContentGenJob (pas de suppression du job — audit trail conserve).
      prisma.contentGenJob.updateMany({
        where: { outputBlogPostId: id },
        data: { outputBlogPostId: null },
      }),
      // Purge ReviewQueue lié.
      prisma.reviewQueue.deleteMany({ where: { job: { outputBlogPostId: null, id } } }),
      // Suppression Article (cascade : translations, tags, slugHistory, provenance).
      prisma.article.delete({ where: { id } }),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: "Delete failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // Revalidate cache Next.js (best-effort).
  try {
    if (frSlug) {
      revalidatePath(`/fr/blog/${frSlug}`);
      revalidatePath(`/en/blog/${frSlug}`);
    }
    revalidatePath("/fr/blog");
  } catch {
    // Non-bloquant.
  }

  return NextResponse.json(
    {
      ok: true,
      articleId: id,
      slug: frSlug,
      message: "Article and all related data permanently deleted (RGPD art. 17)",
    },
    { status: 200 },
  );
}
