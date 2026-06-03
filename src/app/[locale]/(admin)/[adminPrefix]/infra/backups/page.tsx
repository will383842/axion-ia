// Dashboard Sauvegardes & DR (ADR 0032) — sous-page de /infra.
//
// Vue d'ensemble par composant + historique paginé + drills + bandeaux.
// Source : tables BackupRun / RestoreDrill (alimentées par les scripts cron VPS
// + drill CI via /api/internal/backups). Lecture seule, FR-only, force-dynamic.
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { computeBanners, getBackupHistory, getBackupOverview } from "@/server/backups/queries";
import { BACKUP_COMPONENTS, type BackupComponentValue } from "@/server/backups/types";
import { BackupsV2 } from "./_v2/BackupsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<{ page?: string; component?: string }>;
}

export default async function AdminBackupsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const { page: pageRaw, component: componentRaw } = await searchParams;

  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const component = BACKUP_COMPONENTS.includes(componentRaw as BackupComponentValue)
    ? (componentRaw as BackupComponentValue)
    : undefined;

  const [overview, history] = await Promise.all([
    getBackupOverview(),
    getBackupHistory({ page, ...(component ? { component } : {}) }),
  ]);
  const banners = computeBanners(overview);

  return (
    <BackupsV2
      adminPrefix={adminPrefix}
      overview={overview}
      history={history}
      banners={banners}
      activeComponent={component ?? null}
    />
  );
}
