/**
 * Content Generator — Campagnes de couverture list (§ 25).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCampaigns } from "@/server/actions/content-gen/coverage";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import type {
  CoverageStatus,
  ServiceSector,
} from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUSES: ReadonlyArray<CoverageStatus> = [
  "draft",
  "running",
  "paused",
  "completed",
  "cancelled",
];

function sectorLabel(s: ServiceSector | null): string {
  return s ? SERVICE_SECTOR_LABELS[s] : "—";
}

export default async function CoverageListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const status = (sp.status as CoverageStatus | undefined) || undefined;
  const sector = (sp.serviceSector as ServiceSector | undefined) || undefined;
  const rows = await listCampaigns(status, sector);
  const base = `/fr/${adminPrefix}/content-gen/coverage`;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Campagnes de couverture</h1>
          <p className="admin-meta">
            {rows.length} campagne{rows.length > 1 ? "s" : ""}
            {status ? ` · ${status}` : ""}
            {sector ? ` · secteur ${SERVICE_SECTOR_LABELS[sector]}` : ""}
          </p>
        </div>
        <a href={`${base}/new`} className="admin-button">
          + Nouvelle campagne
        </a>
      </div>

      <form className="admin-card admin-filters">
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={sp.status ?? ""}
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
              defaultValue={sp.serviceSector ?? ""}
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
          <a href={base} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </form>

      <div className="admin-card admin-table-wrapper">
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
                <td colSpan={8}>Aucune campagne. Créez-en une.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a href={`${base}/${r.id}`}>{r.name}</a>
                  </td>
                  <td>
                    {r.serviceSector ? (
                      <span
                        className="admin-badge"
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          backgroundColor: "var(--color-terracotta-soft, #f5e8e2)",
                          color: "var(--color-terracotta, #c2552d)",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {sectorLabel(r.serviceSector)}
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
                  <td>
                    {r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(2)}` : "—"}
                  </td>
                  <td>{r.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
