// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Blog new V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

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

interface Props {
  adminPrefix: string;
  authors: ReadonlyArray<SelectOption>;
  categories: ReadonlyArray<SelectOption>;
  tags: ReadonlyArray<TagOption>;
}

export function BlogNewV2({ adminPrefix, authors, categories, tags }: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Nouvel article"
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Blog", href: `/fr/${adminPrefix}/blog` },
              { label: "Nouvel article" },
            ]}
          />
        }
      />
      <AdminCard>
        <BlogForm authors={authors} categories={categories} tags={tags} />
      </AdminCard>
    </AdminPageShell>
  );
}
