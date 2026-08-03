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
        <StatCard label="Parfaites" value={stats.byQuality.green ?? 0} color="green" />
        <StatCard label="À retoucher" value={stats.byQuality.orange ?? 0} color="orange" />
        <StatCard label="Cassées" value={stats.byQuality.red ?? 0} color="red" />
        {/* « ⚪ » collé au libellé : un emoji en guise de puce, dont le rendu
            dépend de la police du poste. Le ton neutre de la tuile dit déjà
            « pas encore jugé ». */}
        <StatCard label="Non revues" value={stats.byQuality.unset ?? 0} color="gray" />
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
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-2.5 py-1 text-xs text-[color:var(--color-admin-fg-muted)]"
            >
              <span className="font-medium text-[color:var(--color-admin-fg)]">
                {CATEGORY_LABELS[cat] ?? cat}
              </span>
              <span className="text-[color:var(--color-admin-fg-disabled)]">
                {count.toLocaleString("fr-FR")}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="text-xs text-[color:var(--color-admin-fg-muted)]">
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
  /**
   * 🔴 CE QUE J'AVAIS MAL DIAGNOSTIQUÉ À L'ÉCRAN. En voyant cette page je l'ai
   * décrite comme « la seule en palette bleu/vert/rouge vifs, hors charte ».
   * Les couleurs viennent en réalité des jetons `--color-admin-*`, comme
   * partout ailleurs. Le vrai défaut est la DENSITÉ : douze tuiles dont chacune
   * porte un fond teinté PLEIN et une bordure colorée, là où le reste de la
   * console utilise `AdminStatCard` — fond papier neutre, couleur réservée à
   * une pastille d'icône. Douze aplats côte à côte, ça crie ; c'est ce que
   * l'œil lit comme « hors charte ».
   *
   * Second défaut, mesurable celui-là : HUIT noms de couleur pour CINQ tons
   * réels. `blue` et `purple` pointent sur le même jeton, `green` et `emerald`
   * aussi, `amber` et `orange` de même. Trois alias morts qui donnent
   * l'illusion d'un code couleur plus fin qu'il ne l'est.
   *
   * On garde la sémantique (succès / avertissement / danger / neutre) et on
   * abandonne les aplats : le fond redevient papier, la couleur ne porte plus
   * que le chiffre.
   */
  const TON: Record<string, string> = {
    blue: "text-[color:var(--color-admin-info)]",
    purple: "text-[color:var(--color-admin-info)]",
    green: "text-[color:var(--color-admin-success-fg)]",
    emerald: "text-[color:var(--color-admin-success-fg)]",
    amber: "text-[color:var(--color-admin-warning-fg)]",
    orange: "text-[color:var(--color-admin-warning-fg)]",
    red: "text-[color:var(--color-admin-destructive-fg)]",
    gray: "text-[color:var(--color-admin-fg-muted)]",
  };

  return (
    <div className="rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] shadow-[var(--shadow-admin-1)]">
      <div className={`text-2xl font-bold tabular-nums ${TON[color] ?? ""}`}>
        {value.toLocaleString("fr-FR")}
        {total !== undefined && (
          <span className="text-sm font-normal text-[color:var(--color-admin-fg-muted)]">
            {" "}
            / {total.toLocaleString("fr-FR")}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs font-medium text-[color:var(--color-admin-fg-muted)]">
        {label}
      </div>
    </div>
  );
}
