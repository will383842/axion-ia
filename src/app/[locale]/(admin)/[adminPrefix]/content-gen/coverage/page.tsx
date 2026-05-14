/**
 * Content Generator — Campagnes de couverture list (§ 25).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCampaigns } from "@/server/actions/content-gen/coverage";
import type { CoverageStatus } from "../../../../../../../prisma/generated/client";

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

export default async function CoverageListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const status = (sp.status as CoverageStatus | undefined) || undefined;
  const rows = await listCampaigns(status);
  const base = `/fr/${adminPrefix}/content-gen/coverage`;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Campagnes de couverture</h1>
          <p className="admin-meta">
            {rows.length} campagne{rows.length > 1 ? "s" : ""}
            {status ? ` · filtrées sur ${status}` : ""}
          </p>
        </div>
        <a href={`${base}/new`} className="admin-button">
          + Nouvelle campagne
        </a>
      </div>

      <form className="admin-card admin-filters">
        <div className="admin-field">
          <label htmlFor="status" className="admin-label">
            Statut
          </label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="admin-input">
            <option value="">Tous</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Filtrer
          </button>
        </div>
      </form>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nom</th>
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
                <td colSpan={7}>Aucune campagne. Créez-en une.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a href={`${base}/${r.id}`}>{r.name}</a>
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
