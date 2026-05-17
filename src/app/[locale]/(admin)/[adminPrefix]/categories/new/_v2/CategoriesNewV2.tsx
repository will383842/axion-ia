// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Categories new V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

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

interface Props {
  adminPrefix: string;
  parents: ReadonlyArray<ParentOption>;
}

export function CategoriesNewV2({ adminPrefix, parents }: Props): React.ReactElement {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouvelle catégorie"
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Catégories", href: `/fr/${adminPrefix}/categories` },
              { label: "Nouvelle catégorie" },
            ]}
          />
        }
      />
      <AdminCard>
        <CategoryForm parents={parents} />
      </AdminCard>
    </AdminPageShell>
  );
}
