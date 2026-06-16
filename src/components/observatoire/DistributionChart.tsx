import { cn } from "@/lib/utils";

export interface ChartRow {
  readonly label: string;
  readonly value: string;
  readonly count: number;
  readonly pct: number;
}

interface DistributionChartProps {
  /** Identifiant de la question (ancre + id figcaption). */
  readonly id: string;
  /** Intitulé de la question (figcaption + caption table). */
  readonly title: string;
  readonly rows: ReadonlyArray<ChartRow>;
  /** Libellés i18n. */
  readonly labels: { share: string; responses: string };
  readonly className?: string;
}

/**
 * Graphique à barres horizontal 100 % SSR — aucune lib de charting cliente,
 * aucun JS. Table sémantique (`<th scope="row">`) pour l'accessibilité (WCAG
 * 2.1 AA) + barres CSS à hauteur fixe (CLS = 0). Lisible par les LLM (données
 * tabulaires structurées) et par les lecteurs d'écran.
 */
export function DistributionChart({ id, title, rows, labels, className }: DistributionChartProps) {
  const figcaptionId = `chart-${id}`;
  return (
    <figure
      className={cn("border-border bg-canvas rounded-lg border p-5", className)}
      aria-labelledby={figcaptionId}
    >
      <figcaption id={figcaptionId} className="text-fg mb-4 text-base font-semibold">
        {title}
      </figcaption>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{title}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{title}</th>
            <th scope="col">{labels.share}</th>
            <th scope="col">{labels.responses}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.value}>
              <th
                scope="row"
                className="text-fg-soft w-[42%] py-1.5 pr-3 text-left align-middle font-normal"
              >
                {r.label}
              </th>
              <td className="py-1.5 align-middle">
                {/* Piste + barre : hauteur fixe 14px → zéro CLS. */}
                <div className="bg-sand relative h-3.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-terracotta absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </td>
              <td className="text-fg w-[64px] py-1.5 pl-3 text-right align-middle font-medium tabular-nums">
                {r.pct}&nbsp;%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
