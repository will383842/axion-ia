// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Case study new V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { CaseStudyForm } from "../../CaseStudyForm";

interface Props {
  adminPrefix: string;
}

export function CaseStudyNewV2({ adminPrefix }: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Nouveau cas concret"
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Cas concrets", href: `/fr/${adminPrefix}/case-studies` },
              { label: "Nouveau cas concret" },
            ]}
          />
        }
      />
      <AdminCard>
        <CaseStudyForm />
      </AdminCard>
    </AdminPageShell>
  );
}
