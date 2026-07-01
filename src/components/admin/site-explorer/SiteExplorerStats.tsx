// Composant stats Site Explorer — Sprint Site Explorer Admin 2026-05-22.
// Server Component pur.

import type { SiteRouteStats } from "@/server/actions/site-explorer/site-routes";

interface Props {
  stats: SiteRouteStats;
}

export function SiteExplorerStats({ stats }: Props) {
  const formatDate = (d: Date | null) =>
    d
      ? new Date(d).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "jamais";

  const CATEGORY_LABELS: Record<string, string> = {
    commercial: "Commercial",
    villes: "Villes",
    contenu: "Contenu",
    aide: "Aide/FAQ",
    conversion: "Formulaires",
    transversal: "Transversal",
    galerie: "Galerie",
    legal: "Légal/footer",
    autre: "Autre",
  };
  const categories = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      {/* Compteurs principaux */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="URLs publiques" value={stats.total} color="blue" />
        <StatCard label="Indexables" value={stats.indexableCount} color="emerald" />
        <StatCard label="Noindex" value={stats.noindexCount} color="amber" />
        <StatCard label="GSC demandés" value={stats.gscRequestedCount} color="blue" />
        <StatCard label="Clics GSC (28j)" value={stats.gscClicksTotal} color="purple" />
        <StatCard label="Impressions GSC" value={stats.gscImpressionsTotal} color="purple" />
        <StatCard label="🟢 Parfaites" value={stats.byQuality.green ?? 0} color="green" />
        <StatCard label="🟠 À retoucher" value={stats.byQuality.orange ?? 0} color="orange" />
        <StatCard label="🔴 Cassées" value={stats.byQuality.red ?? 0} color="red" />
        <StatCard label="⚪ Non revues" value={stats.byQuality.unset ?? 0} color="gray" />
        {stats.anomaliesHigh > 0 && (
          <StatCard
            label="Anomalies élevées"
            value={stats.anomaliesHigh}
            color="red"
            total={stats.anomaliesTotal}
          />
        )}
        {stats.removedCount > 0 && (
          <StatCard label="Disparues" value={stats.removedCount} color="gray" />
        )}
      </div>

      {/* Compteurs par catégorie */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map(([cat, count]) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600"
            >
              <span className="font-medium text-gray-800">{CATEGORY_LABELS[cat] ?? cat}</span>
              <span className="text-gray-400">{count.toLocaleString("fr-FR")}</span>
            </span>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500">
        Dernière inspection HTTP : {formatDate(stats.lastScanAt)}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  total,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "purple" | "gray" | "red" | "emerald" | "amber" | "orange";
  total?: number;
}) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    gray: "bg-gray-50 border-gray-200 text-gray-600",
    red: "bg-red-50 border-red-200 text-red-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
  };

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <div className="text-2xl font-bold">
        {value.toLocaleString("fr-FR")}
        {total !== undefined && (
          <span className="text-sm font-normal"> / {total.toLocaleString("fr-FR")}</span>
        )}
      </div>
      <div className="mt-1 text-xs font-medium">{label}</div>
    </div>
  );
}
