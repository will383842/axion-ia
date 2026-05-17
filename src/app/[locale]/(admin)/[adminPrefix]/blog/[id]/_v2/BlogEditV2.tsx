// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Blog [id] edit V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { BlogForm } from "../../BlogForm";

interface SelectOption {
  id: string;
  slug: string;
  name: string;
}
interface TagOption {
  id: string;
  slug: string;
  nameFr: string;
}

interface ArticleInitial {
  id: string;
  authorId: string | null;
  categoryId: string | null;
  featuredImage: string | null;
  status: string;
  publishedAt: Date | null;
  readingTime: number | null;
  commentsEnabled: boolean;
  tagIds: string[];
  fr: {
    title: string;
    slug: string;
    excerpt: string | null;
    body: string;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
  };
  en: {
    title: string;
    slug: string;
    excerpt: string | null;
    body: string;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
  };
}

interface Props {
  adminPrefix: string;
  authors: ReadonlyArray<SelectOption>;
  categories: ReadonlyArray<SelectOption>;
  tags: ReadonlyArray<TagOption>;
  initial: ArticleInitial;
  title: string;
  viewsCount: number;
  updatedAtIso: string;
}

export function BlogEditV2({
  adminPrefix,
  authors,
  categories,
  tags,
  initial,
  title,
  viewsCount,
  updatedAtIso,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Éditer : ${title}`}
        description={`Vues : ${viewsCount} · Mise à jour : ${updatedAtIso}`}
        breadcrumbs={
          <AdminBreadcrumbs
            items={[{ label: "Blog", href: `/fr/${adminPrefix}/blog` }, { label: title }]}
          />
        }
      />
      <AdminCard>
        <BlogForm authors={authors} categories={categories} tags={tags} initial={initial} />
      </AdminCard>
    </AdminPageShell>
  );
}
