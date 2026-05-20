/**
 * Content Generator — Édition Article publié (Fix P0-9 audit opérationnel 2026-05-14).
 *
 * § 14 master prompt + M1/P6 audit. Permet à Will d'éditer un Article publié
 * sans devoir dégommer + régénérer : titre, slug, body HTML, meta. Sanitize
 * DOMPurify côté Server Action. Ping IndexNow si tier-1.
 *
 * Inclut aussi le bouton "Supprimer définitivement" avec double confirmation
 * (champ texte `DELETE` à taper).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  deleteArticle,
  getArticleDetail,
  updateArticle,
} from "@/server/actions/content-gen/article";
import { PublicationEditV2 } from "./_v2/PublicationEditV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function ArticleEditPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const article = await getArticleDetail(id);
  if (!article) notFound();
  const t = article.translation;
  if (!t) notFound();

  return (
    <PublicationEditV2
      adminPrefix={adminPrefix}
      article={{
        id: article.id,
        indexationTier: article.indexationTier,
        status: article.status,
        qualityScore: article.qualityScore,
        seoScore: article.seoScore,
        isNews: article.isNews,
        translation: {
          title: t.title,
          slug: t.slug,
          excerpt: t.excerpt,
          metaTitle: t.metaTitle,
          metaDescription: t.metaDescription,
          body: t.body,
        },
      }}
    />
  );
}

