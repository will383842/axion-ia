// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Connaissances [id] edit V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { ConnaissancesEditForm, type EntrySnapshot } from "../ConnaissancesEditForm";
import { WorkflowPanel } from "../WorkflowPanel";
import { getKbTypeMeta } from "@/content/knowledge/types";
import { getDomainLabel } from "@/content/knowledge/domains";
import { getAudienceLabel } from "@/content/knowledge/audiences";
import { getStatusLabel } from "@/content/knowledge/statuses";
import type { KbPipelineStage, KbStatus } from "../../../../../../../../prisma/generated/client";

interface Props {
  adminPrefix: string;
  entry: EntrySnapshot;
  entryId: string;
  status: KbStatus;
  pipelineStage: KbPipelineStage;
  userRole: string;
  title: string;
  type: string;
  domain: string;
  audience: string;
}

export function ConnaissancesEditV2({
  adminPrefix,
  entry,
  entryId,
  status,
  pipelineStage,
  userRole,
  title,
  type,
  domain,
  audience,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={title}
        description={`${getKbTypeMeta(type as never).labelFr} · ${getDomainLabel(domain as never, "fr")} · ${getAudienceLabel(audience as never, "fr")} · statut ${getStatusLabel(status, "fr")}`}
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Connaissances", href: `/fr/${adminPrefix}/connaissances` },
              { label: title },
            ]}
          />
        }
        actions={
          <>
            <a
              href={`/fr/${adminPrefix}/connaissances/${entryId}/apercu`}
              className="admin-button-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              Aperçu ↗
            </a>
            <a href={`/fr/${adminPrefix}/connaissances`} className="admin-button-ghost">
              ← Liste
            </a>
          </>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <WorkflowPanel
          entryId={entryId}
          status={status}
          pipelineStage={pipelineStage}
          userRole={userRole}
        />
      </AdminCard>

      <AdminCard>
        <ConnaissancesEditForm adminPrefix={adminPrefix} entry={entry} />
      </AdminCard>
    </AdminPageShell>
  );
}
