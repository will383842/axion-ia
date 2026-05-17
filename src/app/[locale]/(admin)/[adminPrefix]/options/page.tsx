// Listing options 48h admin (M9 Tier 1 section 2).
//
// Filtre status URL param. Sort par status (pending d'abord) puis expiresAt
// croissant pour mettre les plus urgentes en haut. Affiche countdown 48h.

import { listOptionsAction } from "@/features/admin-options/actions";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { OptionsV2 } from "./_v2/OptionsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  refused: "Refusée",
  expired: "Expirée",
  converted: "Validée → réservation",
};

function formatExpiry(expiresAt: Date, status: string): string {
  if (status !== "pending") return "—";
  const now = Date.now();
  const diffMs = expiresAt.getTime() - now;
  if (diffMs <= 0) return "Expirée à l'instant";
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 24) return `Dans ${Math.floor(hours / 24)}j ${hours % 24}h`;
  return `Dans ${hours}h ${minutes}min`;
}

function expiryUrgency(expiresAt: Date, status: string): string {
  if (status !== "pending") return "";
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return "admin-urgency-critical";
  if (diffMs < 12 * 3600000) return "admin-urgency-high";
  if (diffMs < 24 * 3600000) return "admin-urgency-medium";
  return "";
}

export default async function OptionsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  if (await isAdminV2Enabled()) {
    return <OptionsV2 adminPrefix={adminPrefix} searchParams={sp} />;
  }

  const result = await listOptionsAction({
    status: sp.status as never,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Options 48h</h1>
          <p className="admin-meta">
            {result.total} option{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages}
          </p>
        </div>
      </div>

      <div className="admin-card admin-filters">
        <div className="admin-filters-grid">
          <a
            href={`/fr/${adminPrefix}/options`}
            className={`admin-button-ghost ${!sp.status ? "admin-button-active" : ""}`}
          >
            Toutes
          </a>
          {(["pending", "confirmed", "refused", "expired", "converted"] as const).map((s) => (
            <a
              key={s}
              href={`/fr/${adminPrefix}/options?status=${s}`}
              className={`admin-button-ghost ${sp.status === s ? "admin-button-active" : ""}`}
            >
              {STATUS_LABELS[s]}
            </a>
          ))}
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date créneau</th>
              <th>Société</th>
              <th>Contact</th>
              <th>Intervention</th>
              <th>Participants</th>
              <th>Statut</th>
              <th>Échéance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-table-empty">
                  Aucune option trouvée.
                </td>
              </tr>
            ) : (
              result.items.map((o) => (
                <tr key={o.id} className={expiryUrgency(o.expiresAt, o.status)}>
                  <td>{o.slotDate.toISOString().slice(0, 10)}</td>
                  <td>
                    <div>{o.companyName}</div>
                    <div className="admin-meta-small">{o.companySector}</div>
                  </td>
                  <td>
                    <div>{o.contactName}</div>
                    <div className="admin-meta-small">{o.contactEmail}</div>
                  </td>
                  <td>{o.interventionType}</td>
                  <td>{o.participantsCount}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${o.status}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td>{formatExpiry(o.expiresAt, o.status)}</td>
                  <td>
                    <a href={`/fr/${adminPrefix}/options/${o.id}`} className="admin-link">
                      Détail →
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
