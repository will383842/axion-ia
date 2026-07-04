import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { listRegionCoverage } from "@/server/prospection/admin/queries";

export const dynamic = "force-dynamic";

// Choroplèthe léger : cellules colorées par complétion (0 lib carto client →
// Web Vitals). Le fond vert s'intensifie avec la complétion.
function tone(pct: number): string {
  const alpha = Math.max(0.08, Math.min(1, pct));
  return `rgba(34, 139, 87, ${alpha})`;
}

export default async function CartePage() {
  const regions = await listRegionCoverage();
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Carte de couverture"
        description="Complétion par région (SVG statique / sans lib carto — Web Vitals). Mode : complétion %."
      />
      {regions.length === 0 ? (
        <AdminEmptyState
          title="Aucune donnée de couverture"
          description="Le rollup s'exécute après la première collecte."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          }}
        >
          {regions.map((r) => (
            <div
              key={r.scopeId}
              style={{
                padding: "0.75rem",
                borderRadius: "8px",
                background: tone(r.pctCompletion),
                border: "1px solid var(--color-admin-border)",
              }}
            >
              <strong>{r.regionLabel}</strong>
              <div>
                {Math.round(r.pctCompletion * 100)} % · {r.collectees.toLocaleString("fr-FR")}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPageShell>
  );
}
