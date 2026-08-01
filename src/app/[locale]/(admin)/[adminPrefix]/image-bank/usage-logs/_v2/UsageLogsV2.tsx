// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Image bank "Demandes d'effacement (RGPD)" V2 — AdminPageShell + AdminPageHeader.
// ForgetIpHashForm client component conserve intact (RGPD art. 17).
//
// Correctif P0 audit UX 2026-08 : renommage + langage clair (ex-« Usage logs —
// RGPD art. 17 », formulaire par ipHash). Les détails techniques (nom de table,
// action d'audit) passent en repli `<details>` (info-bulle native) au lieu
// d'être affichés en clair sur l'écran principal.

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
  ip: string | undefined;
  resultsLimit: number;
  usageLogs: ReadonlyArray<UsageLog>;
  downloadLogs: ReadonlyArray<DownloadLog>;
}

export function UsageLogsV2({
  ip,
  resultsLimit,
  usageLogs,
  downloadLogs,
}: Props): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Demandes d'effacement (RGPD)"
        description="Quand quelqu'un demande la suppression de ses traces, collez son adresse IP ici."
      />
      <AdminCard>
        <p className="admin-meta-small mb-[var(--space-admin-4)]">
          Recherche limitée à {resultsLimit} résultats.
        </p>
        <ForgetIpHashForm
          {...(ip ? { initialIp: ip } : {})}
          usageLogs={usageLogs as Array<UsageLog>}
          downloadLogs={downloadLogs as Array<DownloadLog>}
        />
        <details className="admin-meta-small mt-[var(--space-admin-5)]">
          <summary className="cursor-pointer select-none">Détails techniques</summary>
          <p className="mt-[var(--space-admin-2)]">
            L&apos;effacement supprime les lignes <code>image_usage_logs</code> +{" "}
            <code>image_download_logs</code> associées. Audit trail conservé dans{" "}
            <code>activity_logs</code> (action <code>rgpd.image_bank.forget_ip_hash</code>) — preuve
            de la demande, sans conserver l&apos;adresse IP en clair.
          </p>
        </details>
      </AdminCard>
    </AdminPageShell>
  );
}
