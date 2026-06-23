import { cn } from "@/lib/utils";

export interface TrendPoint {
  readonly computedAt: string;
  readonly totalResponses: number;
  readonly insights: Record<string, number>;
}

export interface TrendSeries {
  readonly key: string;
  readonly label: string;
  /** Couleur hex (charte). */
  readonly color: string;
}

interface TrendChartProps {
  readonly id: string;
  readonly title: string;
  readonly points: ReadonlyArray<TrendPoint>;
  readonly series: ReadonlyArray<TrendSeries>;
  readonly labels: { date: string; sample: string };
  readonly className?: string;
}

// Géométrie fixe (viewBox) → responsive sans JS, hauteur intrinsèque stable (CLS = 0).
const W = 640;
const H = 260;
const ML = 34;
const MR = 12;
const MT = 12;
const MB = 30;
const PLOT_W = W - ML - MR;
const PLOT_H = H - MT - MB;

function x(i: number, n: number): number {
  return n <= 1 ? ML : ML + (i / (n - 1)) * PLOT_W;
}
function y(v: number): number {
  return MT + (1 - Math.max(0, Math.min(100, v)) / 100) * PLOT_H;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Courbe d'évolution multi-séries 100 % SSR (SVG inline, zéro JS). Repli table
 * `sr-only` pour l'accessibilité + lisibilité LLM. Affiche l'évolution des
 * constats phares de l'observatoire au fil de l'accumulation des réponses.
 */
export function TrendChart({ id, title, points, series, labels, className }: TrendChartProps) {
  if (points.length < 2) return null;
  const n = points.length;
  const captionId = `trend-${id}`;
  const gridVals = [0, 25, 50, 75, 100];

  return (
    <figure
      className={cn("border-border bg-canvas rounded-lg border p-5", className)}
      aria-labelledby={captionId}
    >
      <figcaption id={captionId} className="text-fg mb-4 text-base font-semibold">
        {title}
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-labelledby={captionId}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grille horizontale + graduations Y */}
        {gridVals.map((g) => (
          <g key={g}>
            <line
              x1={ML}
              x2={W - MR}
              y1={y(g)}
              y2={y(g)}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
            />
            <text x={4} y={y(g) + 4} className="fill-fg-muted" fontSize={10}>
              {g}
            </text>
          </g>
        ))}
        {/* Séries */}
        {series.map((s) => {
          const pts = points.map(
            (p, i) => `${x(i, n).toFixed(1)},${y(p.insights[s.key] ?? 0).toFixed(1)}`,
          );
          const last = points[n - 1]?.insights[s.key] ?? 0;
          return (
            <g key={s.key}>
              <polyline
                points={pts.join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={x(n - 1, n)} cy={y(last)} r={3} fill={s.color} />
            </g>
          );
        })}
        {/* Graduations X : première et dernière date */}
        <text x={ML} y={H - 8} className="fill-fg-muted" fontSize={10}>
          {fmtDate(points[0]!.computedAt)}
        </text>
        <text x={W - MR} y={H - 8} textAnchor="end" className="fill-fg-muted" fontSize={10}>
          {fmtDate(points[n - 1]!.computedAt)}
        </text>
      </svg>

      {/* Légende */}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {series.map((s) => (
          <li key={s.key} className="text-fg-soft flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label} — {points[n - 1]?.insights[s.key] ?? 0}%
          </li>
        ))}
      </ul>

      {/* Repli accessible / LLM */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{labels.date}</th>
            <th scope="col">{labels.sample}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.computedAt}>
              <th scope="row">{fmtDate(p.computedAt)}</th>
              <td>{p.totalResponses}</td>
              {series.map((s) => (
                <td key={s.key}>{p.insights[s.key] ?? 0}%</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
