// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Coverage list V2 — utilise AdminPageShell + AdminPageHeader + AdminCard.
// Server Component, re-fetch identique V1. Filtres status + sector préservés.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { listCampaigns } from "@/server/actions/content-gen/coverage";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import type {
  CoverageStatus,
  ServiceSector,
} from "../../../../../../../../prisma/generated/client";

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

export async function CoverageListV2({
  adminPrefix,
  searchParams: sp,
}: Props): Promise<React.ReactElement> {
  const status = (sp["status"] as CoverageStatus | undefined) || undefined;
  const sector = (sp["serviceSector"] as ServiceSector | undefined) || undefined;
  const rows = await listCampaigns(status, sector);
  const base = `/fr/${adminPrefix}/content-gen/coverage`;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Campagnes de couverture"
        description={`${rows.length} campagne${rows.length > 1 ? "s" : ""}${status ? ` · ${status}` : ""}${sector ? ` · secteur ${SERVICE_SECTOR_LABELS[sector]}` : ""}`}
        actions={
          <Link href={`${base}/new`} className="admin-button">
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
                    {s}
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

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Secteur</th>
                <th>Scope</th>
                <th>Cible</th>
                <th>Statut</th>
                <th>Gen/Pub/Fail</th>
                <th>Coût est.</th>
                <th>Créée</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    Aucune campagne. Créez-en une.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`${base}/${r.id}`} className="admin-link">
                        {r.name}
                      </Link>
                    </td>
                    <td>
                      {r.serviceSector ? (
                        <span className="admin-badge admin-badge-sector">
                          {SERVICE_SECTOR_LABELS[r.serviceSector]}
                        </span>
                      ) : (
                        <span className="admin-meta">—</span>
                      )}
                    </td>
                    <td>{r.scope}</td>
                    <td>{r.totalTargetCount}</td>
                    <td>{r.status}</td>
                    <td>
                      {r.generatedCount} / {r.publishedCount} / {r.failedCount}
                    </td>
                    <td>{r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(2)}` : "—"}</td>
                    <td>{r.createdAt.toISOString().slice(0, 10)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
