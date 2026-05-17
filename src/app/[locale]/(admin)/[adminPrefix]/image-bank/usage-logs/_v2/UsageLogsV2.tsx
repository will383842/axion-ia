// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Image bank Usage logs RGPD V2 — AdminPageShell + AdminPageHeader.
// ForgetIpHashForm client component conserve intact (RGPD art. 17).

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { ForgetIpHashForm } from "@/components/admin/image-bank/ForgetIpHashForm";

interface UsageLog {
  id: string;
  action: string;
  imageId: string;
  createdAt: string;
}

interface DownloadLog {
  id: string;
  variant: string;
  imageId: string;
  downloadedAt: string;
}

interface Props {
  ipHash: string | undefined;
  resultsLimit: number;
  usageLogs: ReadonlyArray<UsageLog>;
  downloadLogs: ReadonlyArray<DownloadLog>;
}

export function UsageLogsV2({
  ipHash,
  resultsLimit,
  usageLogs,
  downloadLogs,
}: Props): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Usage logs — RGPD art. 17"
        description="Recherche et effacement définitif des traces (ImageUsageLog + ImageDownloadLog) associées à un ipHash SHA-256."
      />
      <AdminCard>
        <p className="admin-meta-small mb-[var(--space-admin-4)]">
          Cap : {resultsLimit} entrées max par requête. Audit trail conservé dans{" "}
          <code>activity_logs</code> (action <code>rgpd.image_bank.forget_ip_hash</code>).
        </p>
        <ForgetIpHashForm
          {...(ipHash ? { initialIpHash: ipHash } : {})}
          usageLogs={usageLogs as Array<UsageLog>}
          downloadLogs={downloadLogs as Array<DownloadLog>}
        />
      </AdminCard>
    </AdminPageShell>
  );
}
