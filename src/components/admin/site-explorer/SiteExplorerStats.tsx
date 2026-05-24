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

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      <StatCard label="URLs publiques" value={stats.total} color="blue" />
      <StatCard label="Statiques" value={stats.byType.static ?? 0} color="green" />
      <StatCard label="Dynamiques DB" value={stats.byType.dynamic_db ?? 0} color="purple" />
      <StatCard label="Templates" value={stats.byType.dynamic_template ?? 0} color="gray" />
      <StatCard label="Live" value={stats.byStatus.live ?? 0} color="green" />
      <StatCard
        label="404"
        value={stats.byStatus.not_found ?? 0}
        color={stats.byStatus.not_found ? "red" : "gray"}
      />
      {stats.anomaliesHigh > 0 && (
        <StatCard
          label="Anomalies HIGH"
          value={stats.anomaliesHigh}
          color="red"
          total={stats.anomaliesTotal}
        />
      )}
      <div className="col-span-2 flex items-center gap-2 text-xs text-gray-500">
        Dernière inspection : {formatDate(stats.lastScanAt)}
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
  color: "blue" | "green" | "purple" | "gray" | "red";
  total?: number;
}) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    gray: "bg-gray-50 border-gray-200 text-gray-600",
    red: "bg-red-50 border-red-200 text-red-700",
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
