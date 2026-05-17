// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Costs V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { getCostsStats } from "@/server/actions/content-gen/geo";

export async function CostsV2(): Promise<React.ReactElement> {
  const stats = await getCostsStats();

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Coûts & budget"
        description={`Mois courant : $${stats.totalMonthUsd.toFixed(2)} · 7 j : $${stats.total7dUsd.toFixed(2)}`}
      />

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Par provider (30 jours)</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Coût</th>
                <th>Tokens in</th>
                <th>Tokens out</th>
                <th>Cap mensuel</th>
                <th>% utilisé</th>
              </tr>
            </thead>
            <tbody>
              {stats.byProvider.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    Aucune dépense enregistrée.
                  </td>
                </tr>
              ) : (
                stats.byProvider.map((p) => {
                  const config = stats.providers.find((c) => c.provider === p.provider);
                  const cap = config?.monthlyCapUsd ?? 0;
                  const pct = cap > 0 ? Math.round((p.costUsd / cap) * 100) : 0;
                  const warn = pct >= 80;
                  return (
                    <tr key={p.provider}>
                      <td>{p.provider}</td>
                      <td>${p.costUsd.toFixed(2)}</td>
                      <td>{p.tokensInput.toLocaleString()}</td>
                      <td>{p.tokensOutput.toLocaleString()}</td>
                      <td>{cap > 0 ? `$${cap.toFixed(2)}` : "—"}</td>
                      <td
                        className={
                          warn ? "font-semibold text-[color:var(--color-admin-destructive)]" : ""
                        }
                      >
                        {pct}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Projection fin de mois</h2>
        <p className="admin-meta-block">
          La projection nécessite ≥ 7 jours d&apos;historique mensuel. Le calcul devient utile une
          fois le premier mois en prod terminé (Sprint 5+).
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
