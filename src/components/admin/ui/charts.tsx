// Primitives graphiques de la console — refonte tableau de bord 2026-08-02.
//
// SVG pur, rendu SERVEUR : zéro bibliothèque, zéro octet de JavaScript client,
// CLS nul (dimensions fixées), budget First Load intact. Les couleurs passent
// exclusivement par les jetons `--color-admin-*` (contrat anti-hex + charte).
//
// Specs de marque appliquées (référentiel dataviz) :
//   - ligne 2 px, joints et bouts ronds ; aplat de série à ~10 % d'opacité ;
//   - point terminal r=4 cerclé de 2 px de surface (lisible sur la ligne) ;
//   - barres ≤ 24 px, sommet arrondi 4 px, base CARRÉE sur la ligne de base ;
//   - écart de 2 px entre barres adjacentes — l'air sépare, jamais un trait ;
//   - grille/axes en gris discret, 1 px plein, jamais pointillé ;
//   - le texte porte les jetons de texte, jamais la couleur de série.
//
// Interaction : chaque marque embarque un <title> SVG — l'infobulle native du
// navigateur, sans JavaScript. Suffisant pour un tableau de bord serveur ; les
// valeurs exactes vivent de toute façon dans le texte adjacent.

interface SparklineProps {
  /** Série ordonnée (le plus ancien d'abord). Deux points minimum. */
  points: ReadonlyArray<number>;
  /**
   * Libellés COMPLETS par point (« août : 2 400 € »), pour l'infobulle
   * native — la valeur brute de `points` n'est jamais affichée telle quelle
   * (elle peut être en centimes).
   */
  labels?: ReadonlyArray<string>;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Micro-courbe de tendance d'une tuile KPI.
 *
 * Teinte discrète (la valeur voisine reste le sujet), période courante marquée
 * d'un point accent cerclé de surface. Décorative : la valeur et le delta
 * textuels portent l'information — `aria-hidden` assumé.
 */
export function Sparkline({
  points,
  labels,
  width = 128,
  height = 36,
  className,
}: SparklineProps): React.ReactElement | null {
  if (points.length < 2) return null;

  const PAD = 5; // laisse la place du point terminal (r=4) + son cercle
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i: number): number => PAD + (i / (points.length - 1)) * (width - PAD * 2);
  const y = (v: number): number => PAD + (1 - (v - min) / span) * (height - PAD * 2);

  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const dernier = points[points.length - 1] as number;
  const aire = `${d} L${x(points.length - 1).toFixed(1)},${height - PAD} L${PAD},${height - PAD} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={className}
      style={{ overflow: "visible" }}
    >
      {labels ? <title>{labels.join(" · ")}</title> : null}
      <path d={aire} style={{ fill: "var(--color-admin-accent)", opacity: 0.1 }} />
      <path
        d={d}
        style={{
          fill: "none",
          stroke: "var(--color-admin-fg-disabled)",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
      />
      <circle
        cx={x(points.length - 1)}
        cy={y(dernier)}
        r={4}
        style={{
          fill: "var(--color-admin-accent)",
          stroke: "var(--color-admin-paper)",
          strokeWidth: 2,
        }}
      />
    </svg>
  );
}

interface BarreMensuelle {
  /** Libellé court (« jan. », « fév. »…) — axe et infobulle. */
  label: string;
  value: number;
  /** Texte d'infobulle complet (sinon `label : value`). */
  title?: string;
  /** Marque la période courante (barre en accent, les autres en discret). */
  courant?: boolean;
}

interface BarresMensuellesProps {
  barres: ReadonlyArray<BarreMensuelle>;
  height?: number;
  /** Formatte la valeur pour l'infobulle (euros, heures…). */
  format?: (v: number) => string;
  className?: string;
}

/**
 * Colonnes mensuelles (12 points typiques) — CA par mois, prestations par mois.
 *
 * Forme « emphase » : la période courante seule porte l'accent, le reste est en
 * teinte discrète — le regard va au présent. Ligne de base 1 px pleine en gris
 * de bordure ; libellés d'axe en jetons de texte.
 */
export function BarresMensuelles({
  barres,
  height = 72,
  format,
  className,
}: BarresMensuellesProps): React.ReactElement | null {
  if (barres.length === 0) return null;

  const GAP = 2;
  const AXE = 16; // bande des libellés sous la ligne de base
  const n = barres.length;
  // Largeur logique : barres plafonnées à 24 px, gaps de 2 px.
  const barW = Math.min(24, 14);
  const width = n * barW + (n - 1) * GAP;
  const plotH = height - AXE;
  const max = Math.max(...barres.map((b) => b.value), 1);

  /** Sommet arrondi (4 px), base carrée — clampe le rayon sur les petites barres. */
  const cheminBarre = (bx: number, h: number): string => {
    const yTop = plotH - h;
    const r = Math.min(4, h, barW / 2);
    return [
      `M${bx},${plotH}`,
      `L${bx},${yTop + r}`,
      `Q${bx},${yTop} ${bx + r},${yTop}`,
      `L${bx + barW - r},${yTop}`,
      `Q${bx + barW},${yTop} ${bx + barW},${yTop + r}`,
      `L${bx + barW},${plotH}`,
      "Z",
    ].join(" ");
  };

  const fmt = format ?? ((v: number): string => String(v));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={barres.map((b) => `${b.label} : ${fmt(b.value)}`).join(", ")}
      className={className}
      style={{ width: "100%", height: "auto", maxWidth: width * 1.75 }}
    >
      {barres.map((b, i) => {
        const bx = i * (barW + GAP);
        const h = b.value <= 0 ? 0 : Math.max(2, (b.value / max) * (plotH - 4));
        return (
          <g key={b.label + String(i)}>
            <title>{b.title ?? `${b.label} : ${fmt(b.value)}`}</title>
            {/* zone de survol pleine hauteur — cible plus large que la marque */}
            <rect x={bx} y={0} width={barW} height={plotH} style={{ fill: "transparent" }} />
            {b.value > 0 ? (
              <path
                d={cheminBarre(bx, h)}
                style={{
                  fill: b.courant
                    ? "var(--color-admin-accent)"
                    : "var(--color-admin-border-strong)",
                }}
              />
            ) : null}
            <text
              x={bx + barW / 2}
              y={height - 3}
              textAnchor="middle"
              style={{
                fill: "var(--color-admin-fg-muted)",
                fontSize: 8.5,
                fontFamily: "inherit",
              }}
            >
              {b.label}
            </text>
          </g>
        );
      })}
      <line
        x1={0}
        y1={plotH}
        x2={width}
        y2={plotH}
        style={{ stroke: "var(--color-admin-border)", strokeWidth: 1 }}
      />
    </svg>
  );
}

interface BarreRepartitionProps {
  label: string;
  value: number;
  max: number;
  /** Valeur affichée en bout de barre (sinon `value`). */
  affichage?: string;
}

/**
 * Barre horizontale de comparaison (répartition par activité, top heures…).
 *
 * Une seule teinte — comparer des grandeurs est un travail séquentiel, pas
 * d'identité : l'accent porte la donnée, la piste est le même ton éclairci
 * (jamais un gris étranger, l'état se lit sur toute la longueur).
 */
export function BarreRepartition({
  label,
  value,
  max,
  affichage,
}: BarreRepartitionProps): React.ReactElement {
  const pct = max <= 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-[var(--space-admin-4)]">
      <span className="w-24 shrink-0 truncate text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
        {label}
      </span>
      <span
        className="h-[10px] flex-1 overflow-hidden rounded-[var(--radius-admin-pill)]"
        style={{ background: "var(--color-admin-accent-track)" }}
        role="img"
        aria-label={`${label} : ${affichage ?? value}`}
      >
        <span
          className="block h-full rounded-[var(--radius-admin-pill)]"
          style={{ width: `${pct}%`, background: "var(--color-admin-accent)" }}
        />
      </span>
      <span className="w-10 shrink-0 text-right text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)] tabular-nums">
        {affichage ?? value}
      </span>
    </div>
  );
}
