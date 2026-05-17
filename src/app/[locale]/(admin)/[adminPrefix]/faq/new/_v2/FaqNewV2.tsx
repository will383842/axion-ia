// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// FAQ new V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { FAQForm } from "../../FAQForm";

interface Props {
  adminPrefix: string;
}

export function FaqNewV2({ adminPrefix }: Props): React.ReactElement {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouvelle question"
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "FAQ", href: `/fr/${adminPrefix}/faq` },
              { label: "Nouvelle question" },
            ]}
          />
        }
      />
      <AdminCard>
        <FAQForm />
      </AdminCard>
    </AdminPageShell>
  );
}
