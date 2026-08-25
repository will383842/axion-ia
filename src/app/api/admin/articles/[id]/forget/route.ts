/**
 * DELETE /api/admin/articles/[id]/forget
 *
 * B.4 P1.5 — Suppression RGPD art. 17 d'un article genere par l'IA.
 * Purge en cascade :
 *   - Article (+ ArticleTranslation, ArticleTagOnArticle, ArticleSlugHistory
 *     → CASCADE Prisma)
 *   - GenerationProvenance → ARCHIVEE, jamais effacee : elle est en
 *     `onDelete: Restrict` (AI Act art. 50). Cf. le bloc de suppression.
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
import { logActivity } from "@/server/content-gen/shared/activity-log";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; email?: string; role?: string } | undefined;
  const role = sessionUser?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
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

  // 🔴 2026-08-25, cahier D6-4 — CE BLOC RENDAIT 500 SUR LES ARTICLES QU'IL
  // EXISTE POUR EFFACER.
  //
  // Le commentaire qui vivait ici affirmait « GenerationProvenance CASCADE from
  // schema ». Le schéma dit l'inverse : `onDelete: Restrict`
  // (`prisma/schema.prisma:1394`). Or TOUT article généré par l'IA porte au
  // moins une ligne de provenance — c'est la définition de la table. Le DELETE
  // violait donc la clé étrangère, la transaction était annulée, et la route
  // rendait « Delete failed » en 500.
  //
  // Le `Restrict` n'est pas l'erreur : la migration `20260521150000` l'a posé
  // exprès pour que les traces AI Act art. 50 ne soient pas emportées, et a
  // écrit la consigne — « archiver les lignes provenance AVANT de supprimer
  // l'article ». Cette procédure n'existait pas. La voici.
  //
  // 🔑 L'ORDRE EST LA GARANTIE : archiver, purger, supprimer. Archiver après
  // avoir supprimé ne garderait rien ; supprimer sans purger échoue toujours.
  // Le tout dans UNE transaction — un effacement partiel laisserait des traces
  // orphelines et un article vivant.
  //
  // ⚠️ Les deux droits ne s'opposent pas : la provenance ne porte AUCUNE donnée
  // personnelle (fournisseur, modèle, empreintes, jetons, coût). L'article est
  // effacé, la preuve qu'une IA l'a produit est conservée. Un cliquet vérifie
  // cette prémisse : `effacement-art17.spec.ts`.
  try {
    const provenances = await prisma.generationProvenance.findMany({
      where: { articleId: id },
    });

    await prisma.$transaction([
      // 1. ARCHIVER — la table cible n'a aucune clé étrangère vers l'article,
      //    sans quoi elle serait détruite par la suppression qu'elle survit.
      prisma.generationProvenanceArchive.createMany({
        data: provenances.map((p) => ({
          articleId: p.articleId,
          articleSlugSnapshot: frSlug,
          step: p.step,
          provider: p.provider,
          model: p.model,
          modelVersion: p.modelVersion,
          promptHash: p.promptHash,
          inputTokens: p.inputTokens,
          outputTokens: p.outputTokens,
          cacheReadInputTokens: p.cacheReadInputTokens,
          cost: p.cost,
          regulationVersion: p.regulationVersion,
          previousHash: p.previousHash,
          hash: p.hash,
          timestamp: p.timestamp,
        })),
      }),
      // 2. PURGER la provenance — c'est elle que le `Restrict` protégeait, et
      //    elle est désormais en lieu sûr.
      prisma.generationProvenance.deleteMany({ where: { articleId: id } }),
      // Delink ContentGenJob (pas de suppression du job — audit trail conserve).
      prisma.contentGenJob.updateMany({
        where: { outputBlogPostId: id },
        data: { outputBlogPostId: null },
      }),
      // Purge ReviewQueue lié.
      prisma.reviewQueue.deleteMany({ where: { job: { outputBlogPostId: null, id } } }),
      // 3. SUPPRIMER l'article (cascade : translations, tags, slugHistory).
      prisma.article.delete({ where: { id } }),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: "Delete failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // Audit trail RGPD art. 17 / art. 30 — qui (acteur session), quoi (articleId),
  // quand (timestamp ActivityLog), pourquoi (action canonique). Best-effort :
  // n'altère JAMAIS la suppression (déjà committée ci-dessus).
  await logActivity({
    action: "admin.articles.forget",
    targetType: "Article",
    targetId: id,
    changes: {
      reason: "RGPD art. 17 — droit à l'effacement",
      status: article.status,
      slug: frSlug,
      // 🔴 `GenerationProvenance` figurait ici, en CASCADE. Elle est en
      // `Restrict`, et elle est désormais ARCHIVÉE — pas effacée. Une trace
      // d'audit RGPD qui affirme un effacement qui n'a pas eu lieu est pire
      // qu'une trace absente : elle se lit comme une preuve. La trace dit
      // maintenant ce qui a réellement eu lieu, et le distingue.
      cascade: ["ArticleTranslation", "ArticleTagOnArticle", "ArticleSlugHistory", "ReviewQueue"],
      archive: ["GenerationProvenance → GenerationProvenanceArchive (AI Act art. 50)"],
      contentGenJobDelinked: true,
    },
    session: {
      userId: sessionUser?.id ?? "unknown",
      email: sessionUser?.email ?? "unknown",
      role: role ?? "unknown",
    },
  });

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
