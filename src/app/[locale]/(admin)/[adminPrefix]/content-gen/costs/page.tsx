/**
 * Content Generator — Costs dashboard (§ 12.1).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCostsStats } from "@/server/actions/content-gen/geo";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CostsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const stats = await getCostsStats();

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Coûts &amp; budget</h1>
          <p className="admin-meta">
            Mois courant : ${stats.totalMonthUsd.toFixed(2)} · 7 j : ${stats.total7dUsd.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <h2>Par provider (30 jours)</h2>
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
                <td colSpan={6}>Aucune dépense enregistrée.</td>
              </tr>
            ) : (
              stats.byProvider.map((p) => {
                const config = stats.providers.find((c) => c.provider === p.provider);
                const cap = config?.monthlyCapUsd ?? 0;
                const pct = cap > 0 ? Math.round((p.costUsd / cap) * 100) : 0;
                return (
                  <tr key={p.provider}>
                    <td>{p.provider}</td>
                    <td>${p.costUsd.toFixed(2)}</td>
                    <td>{p.tokensInput.toLocaleString()}</td>
                    <td>{p.tokensOutput.toLocaleString()}</td>
                    <td>{cap > 0 ? `$${cap.toFixed(2)}` : "—"}</td>
                    <td style={{ color: pct >= 80 ? "var(--color-terracotta)" : undefined }}>
                      {pct}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h2>Projection fin de mois</h2>
        <p>
          La projection nécessite ≥ 7 jours d&apos;historique mensuel. Le calcul devient utile une
          fois le premier mois en prod terminé (Sprint 5+).
        </p>
      </div>
    </section>
  );
}
