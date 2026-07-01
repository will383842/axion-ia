// Refonte admin mai 2026 — PR 7. P0-1 Sprint P5 — pause/resume icons lucide.

import Link from "next/link";
import { Pause, Play, PlayCircle } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import {
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  launchCampaign,
} from "@/server/actions/content-gen/coverage";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import type {
  CoverageStatus,
  ServiceSector,
} from "../../../../../../../../prisma/generated/client";

const STATUS_LABELS_FR: Record<string, string> = {
  draft: "Brouillon",
  running: "En cours",
  paused: "En pause",
  completed: "Terminée",
  cancelled: "Annulée",
};

const STATUSES: ReadonlyArray<CoverageStatus> = [
  "draft",
  "running",
  "paused",
  "completed",
  "cancelled",
];

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

async function pauseRow(id: string) {
  "use server";
  await pauseCampaign(id);
}

async function resumeRow(id: string) {
  "use server";
  await resumeCampaign(id);
}

async function launchRow(id: string) {
  "use server";
  await launchCampaign(id);
}

export async function CoverageListV2({
  adminPrefix,
  searchParams: sp,
}: Props): Promise<React.ReactElement> {
  const status = (sp["status"] as CoverageStatus | undefined) || undefined;
  const sector = (sp["serviceSector"] as ServiceSector | undefined) || undefined;
  const rows = await listCampaigns(status, sector);
  const base = `/fr/${adminPrefix}/content-gen/coverage`;

  type CampaignRow = (typeof rows)[number];
  const columns: ReadonlyArray<AdminTableColumn<CampaignRow>> = [
    {
      key: "name",
      header: "Nom",
      cell: (r) => (
        <Link href={`${base}/${r.id}`} className="admin-link">
          {r.name}
        </Link>
      ),
    },
    {
      key: "sector",
      header: "Secteur",
      cell: (r) =>
        r.serviceSector ? (
          <AdminBadge tone="info">{SERVICE_SECTOR_LABELS[r.serviceSector]}</AdminBadge>
        ) : (
          <span className="admin-meta">—</span>
        ),
    },
    { key: "scope", header: "Scope", cell: (r) => r.scope },
    { key: "target", header: "Cible", cell: (r) => r.totalTargetCount },
    { key: "status", header: "Statut", cell: (r) => STATUS_LABELS_FR[r.status] ?? r.status },
    {
      key: "counts",
      header: "Gén/Pub/Éch",
      cell: (r) => `${r.generatedCount} / ${r.publishedCount} / ${r.failedCount}`,
    },
    {
      key: "cost",
      header: "Coût est.",
      cell: (r) =>
        r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(2)}` : "—",
    },
    {
      key: "createdAt",
      header: "Créée",
      cell: (r) => r.createdAt.toISOString().slice(0, 10),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Campagnes de couverture"
        description={`${rows.length} campagne${rows.length > 1 ? "s" : ""}${status ? ` · ${status}` : ""}${sector ? ` · secteur ${SERVICE_SECTOR_LABELS[sector]}` : ""}`}
        actions={
          <Link href={`${base}/new`} className="admin-button-cta">
            + Nouvelle campagne
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="status" className="admin-label">
                Statut
              </label>
              <select
                id="status"
                name="status"
                defaultValue={sp["status"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS_FR[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="serviceSector" className="admin-label">
                Secteur
              </label>
              <select
                id="serviceSector"
                name="serviceSector"
                defaultValue={sp["serviceSector"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {SERVICE_SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {SERVICE_SECTOR_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Filtrer
            </button>
            <Link href={base} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {rows.length === 0 ? (
        <AdminEmptyState title="Aucune campagne. Créez-en une." />
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          caption="Liste des campagnes de couverture"
          rowAction={(r) => (
            <div className="flex items-center gap-[var(--space-admin-2)]">
              {r.status === "running" ? (
                <form action={pauseRow.bind(null, r.id)} className="inline">
                  <button
                    type="submit"
                    title="Mettre en pause"
                    aria-label="Mettre en pause cette campagne"
                    className="admin-button-ghost"
                  >
                    <Pause size={16} />
                  </button>
                </form>
              ) : r.status === "paused" ? (
                <form action={resumeRow.bind(null, r.id)} className="inline">
                  <button
                    type="submit"
                    title="Reprendre"
                    aria-label="Reprendre cette campagne"
                    className="admin-button-ghost"
                  >
                    <Play size={16} />
                  </button>
                </form>
              ) : r.status === "draft" ? (
                <form action={launchRow.bind(null, r.id)} className="inline">
                  <button
                    type="submit"
                    title="Lancer la campagne"
                    aria-label="Lancer cette campagne"
                    className="admin-button-ghost"
                  >
                    <PlayCircle size={16} />
                  </button>
                </form>
              ) : null}
            </div>
          )}
        />
      )}
    </AdminPageShell>
  );
}
