// Page admin /blog/[id] — edition article (M9 T2.4).

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getArticleDetailAction,
  listAuthorsAction,
  listBlogCategoriesAction,
  listAllTagsAction,
} from "@/features/admin-blog/actions";
import { BlogForm } from "../BlogForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function EditBlogPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [article, authors, categoriesRaw, tags] = await Promise.all([
    getArticleDetailAction(id),
    listAuthorsAction(),
    listBlogCategoriesAction(),
    listAllTagsAction(),
  ]);
  if (!article) notFound();
  const categories = categoriesRaw.map((c) => ({ id: c.id, slug: c.slug, name: c.nameFr }));

  const fr = article.translations.find((t) => t.locale === "fr");
  const en = article.translations.find((t) => t.locale === "en");

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/blog`} className="admin-link admin-back">
            ← Blog
          </a>
          <h1 className="admin-h1-large">Éditer : {fr?.title ?? "(sans titre)"}</h1>
          <p className="admin-meta">
            Vues : {article.viewsCount} • Mise à jour :{" "}
            {article.updatedAt.toISOString().slice(0, 10)}
          </p>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <BlogForm
          authors={authors}
          categories={categories}
          tags={tags}
          initial={{
            id: article.id,
            authorId: article.authorId,
            categoryId: article.categoryId,
            featuredImage: article.featuredImage,
            status: article.status,
            publishedAt: article.publishedAt,
            readingTime: article.readingTime,
            commentsEnabled: article.commentsEnabled,
            tagIds: article.tags.map((t) => t.tagId),
            fr: {
              title: fr?.title ?? "",
              slug: fr?.slug ?? "",
              excerpt: fr?.excerpt ?? null,
              body: fr?.body ?? "",
              metaTitle: fr?.metaTitle ?? null,
              metaDescription: fr?.metaDescription ?? null,
              ogImage: fr?.ogImage ?? null,
            },
            en: {
              title: en?.title ?? "",
              slug: en?.slug ?? "",
              excerpt: en?.excerpt ?? null,
              body: en?.body ?? "",
              metaTitle: en?.metaTitle ?? null,
              metaDescription: en?.metaDescription ?? null,
              ogImage: en?.ogImage ?? null,
            },
          }}
        />
      </div>
    </section>
  );
}
