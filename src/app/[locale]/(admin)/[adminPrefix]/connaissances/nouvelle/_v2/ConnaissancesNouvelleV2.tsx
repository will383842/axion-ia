// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Connaissances nouvelle V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { ConnaissancesNouvelleForm } from "../ConnaissancesNouvelleForm";

interface Props {
  adminPrefix: string;
}

export function ConnaissancesNouvelleV2({ adminPrefix }: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Nouvelle entrée connaissance"
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Connaissances", href: `/fr/${adminPrefix}/connaissances` },
              { label: "Nouvelle entrée" },
            ]}
          />
        }
      />
      <AdminCard>
        <ConnaissancesNouvelleForm adminPrefix={adminPrefix} />
      </AdminCard>
    </AdminPageShell>
  );
}
