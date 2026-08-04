// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Costs V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Track 2 migration (juin 2026) : table `.admin-table` (par provider) →
// <AdminTable>. La projection reste un paragraphe (pas une table).

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { getCostsStats } from "@/server/actions/content-gen/geo";

export async function CostsV2(): Promise<React.ReactElement> {
  const stats = await getCostsStats();

  type ProviderRow = (typeof stats.byProvider)[number];

  const columns: ReadonlyArray<AdminTableColumn<ProviderRow>> = [
    { key: "provider", header: "Fournisseur", cell: (p) => p.provider },
    { key: "cost", header: "Coût", cell: (p) => `$${p.costUsd.toFixed(2)}` },
    {
      key: "tokensIn",
      header: "Jetons entrée",
      cell: (p) => p.tokensInput.toLocaleString("fr-FR"),
    },
    {
      key: "tokensOut",
      header: "Jetons sortie",
      cell: (p) => p.tokensOutput.toLocaleString("fr-FR"),
    },
    {
      key: "cap",
      header: "Plafond mensuel",
      cell: (p) => {
        const config = stats.providers.find((c) => c.provider === p.provider);
        const cap = config?.monthlyCapUsd ?? 0;
        return cap > 0 ? `$${cap.toFixed(2)}` : "—";
      },
    },
    {
      key: "pct",
      header: "% utilisé",
      cell: (p) => {
        const config = stats.providers.find((c) => c.provider === p.provider);
        const cap = config?.monthlyCapUsd ?? 0;
        const pct = cap > 0 ? Math.round((p.costUsd / cap) * 100) : 0;
        const warn = pct >= 80;
        return (
          <span className={warn ? "font-semibold text-[color:var(--color-admin-destructive)]" : ""}>
            {pct}%
          </span>
        );
      },
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Coûts & budget"
        description={`Mois courant : $${stats.totalMonthUsd.toFixed(2)} · 7 j : $${stats.total7dUsd.toFixed(2)}`}
      />

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Par fournisseur (30 jours)</h2>
        {stats.byProvider.length === 0 ? (
          <AdminEmptyState title="Aucune dépense enregistrée." />
        ) : (
          <AdminTable
            columns={columns}
            rows={stats.byProvider}
            getRowId={(p) => p.provider}
            caption="Coûts par fournisseur (30 jours)"
          />
        )}
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Projection fin de mois</h2>
        <p className="admin-meta-block">
          La projection demande au moins sept jours d&apos;historique sur le mois en cours. Tant
          qu&apos;ils ne sont pas écoulés, le chiffre affiché n&apos;a pas de valeur.
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
