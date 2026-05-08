// Page admin /blog/new — creation article (M9 T2.4).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listAuthorsAction,
  listBlogCategoriesAction,
  listAllTagsAction,
} from "@/features/admin-blog/actions";
import { BlogForm } from "../BlogForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewBlogPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [authors, categoriesRaw, tags] = await Promise.all([
    listAuthorsAction(),
    listBlogCategoriesAction(),
    listAllTagsAction(),
  ]);
  // Normalise category shape (nameFr → name) pour BlogForm
  const categories = categoriesRaw.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.nameFr,
  }));

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/blog`} className="admin-link admin-back">
            ← Blog
          </a>
          <h1 className="admin-h1-large">Nouvel article</h1>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <BlogForm authors={authors} categories={categories} tags={tags} />
      </div>
    </section>
  );
}
