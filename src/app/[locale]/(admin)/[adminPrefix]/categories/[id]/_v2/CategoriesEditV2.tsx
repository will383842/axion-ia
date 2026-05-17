// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Categories [id] edit V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { CategoryForm } from "../../CategoryForm";

interface ParentOption {
  id: string;
  slug: string;
  nameFr: string;
  module: string | null;
}

interface CategoryInitial {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  parentId: string | null;
  module: string | null;
  icon: string | null;
  colorAccent: string | null;
  displayOrder: number;
  status: string;
  seoTitleFr: string | null;
  seoTitleEn: string | null;
  seoDescFr: string | null;
  seoDescEn: string | null;
  pageContentFr: string | null;
  pageContentEn: string | null;
}

interface Props {
  adminPrefix: string;
  parents: ReadonlyArray<ParentOption>;
  initial: CategoryInitial;
  title: string;
  updatedAtIso: string;
}

export function CategoriesEditV2({
  adminPrefix,
  parents,
  initial,
  title,
  updatedAtIso,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title={`Éditer : ${title}`}
        description={`Mise à jour : ${updatedAtIso}`}
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Catégories", href: `/fr/${adminPrefix}/categories` },
              { label: title },
            ]}
          />
        }
      />
      <AdminCard>
        <CategoryForm parents={parents} initial={initial} />
      </AdminCard>
    </AdminPageShell>
  );
}
