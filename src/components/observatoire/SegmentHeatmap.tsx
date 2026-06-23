import { cn } from "@/lib/utils";
import type { SegmentMetric } from "@/server/observatoire/snapshot";

export interface HeatmapColumn {
  /** Clé de lecture : "maturityScore" ou une clé de `insights`. */
  readonly key: string;
  readonly label: string;
  /** Lit la valeur 0-100 dans le segment. */
  readonly get: (s: SegmentMetric) => number;
}

interface SegmentHeatmapProps {
  readonly id: string;
  readonly title: string;
  readonly rows: ReadonlyArray<SegmentMetric>;
  /** Résout le libellé lisible d'une valeur de segment. */
  readonly labelFor: (value: string) => string;
  readonly columns: ReadonlyArray<HeatmapColumn>;
  readonly labels: { segment: string; sample: string };
  /** Trie les lignes par cette colonne (clé), décroissant. Défaut : 1ʳᵉ colonne. */
  readonly sortByKey?: string;
  readonly className?: string;
}

/** Intensité terracotta (#c24a1b) proportionnelle à la valeur 0-100 — SSR, zéro JS. */
function cellStyle(value: number): React.CSSProperties {
  const alpha = 0.06 + (Math.max(0, Math.min(100, value)) / 100) * 0.82;
  return { backgroundColor: `rgba(194, 74, 27, ${alpha.toFixed(3)})` };
}

/**
 * Heatmap segment×métrique 100 % SSR (table sémantique + cellules colorées CSS).
 * Aucune lib de charting, aucun JS, hauteurs fixes → CLS = 0. Lisible LLM
 * (données tabulaires) et lecteurs d'écran (`<th scope>` + caption).
 */
export function SegmentHeatmap({
  id,
  title,
  rows,
  labelFor,
  columns,
  labels,
  sortByKey,
  className,
}: SegmentHeatmapProps) {
  const sortKey = sortByKey ?? columns[0]?.key;
  const sortCol = columns.find((c) => c.key === sortKey) ?? columns[0];
  const sorted = sortCol ? [...rows].sort((a, b) => sortCol.get(b) - sortCol.get(a)) : [...rows];
  const captionId = `heatmap-${id}`;

  return (
    <figure
      className={cn("border-border bg-canvas overflow-x-auto rounded-lg border p-5", className)}
      aria-labelledby={captionId}
    >
      <figcaption id={captionId} className="text-fg mb-4 text-base font-semibold">
        {title}
      </figcaption>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-fg-muted py-2 pr-3 text-left font-medium">
              {labels.segment}
            </th>
            <th scope="col" className="text-fg-muted px-2 py-2 text-right font-medium">
              {labels.sample}
            </th>
            {columns.map((c) => (
              <th key={c.key} scope="col" className="text-fg-muted px-2 py-2 text-center font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.value} className="border-border border-t">
              <th scope="row" className="text-fg py-2 pr-3 text-left font-normal">
                {labelFor(s.value)}
              </th>
              <td className="text-fg-soft px-2 py-2 text-right tabular-nums">{s.total}</td>
              {columns.map((c) => {
                const v = c.get(s);
                return (
                  <td
                    key={c.key}
                    className="text-fg px-2 py-2 text-center font-medium tabular-nums"
                    style={cellStyle(v)}
                  >
                    {v}
                    <span className="text-fg-muted">&nbsp;{c.key === "maturityScore" ? "/100" : "%"}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
