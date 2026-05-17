// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Help new V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { HelpForm } from "../../HelpForm";

interface CategoryOption {
  id: string;
  slug: string;
  nameFr: string;
}

interface Props {
  adminPrefix: string;
  categories: ReadonlyArray<CategoryOption>;
}

export function HelpNewV2({ adminPrefix, categories }: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Nouvel article"
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Centre d'aide", href: `/fr/${adminPrefix}/help` },
              { label: "Nouvel article" },
            ]}
          />
        }
      />
      <AdminCard>
        <HelpForm categories={categories} />
      </AdminCard>
    </AdminPageShell>
  );
}
