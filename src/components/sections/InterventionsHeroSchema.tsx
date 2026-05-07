// Server Component — schéma visuel du hero /interventions.
// Format PORTRAIT (haut > large) : ~560 × 740, orbit elliptique pour
// caser 5 satellites dans une boîte verticale sans collision de labels.
// Reprend la grammaire du PageHeroDecoration (anneaux + halos terracotta /
// primary / sage + particules) mais avec l'entreprise au centre et les
// 5 formats en orbite, chacun affichant son bénéfice concret.
//
// Pas d'animation ; SSR-friendly ; `aria-label` au niveau du wrapper.

import type { ReactNode } from "react";

export interface InterventionsHeroSchemaProps {
  /** Label central (ex "Votre entreprise"). */
  centerLabel: string;
  /** Cinq satellites. Ordre = haut-gauche → bas-gauche dans le sens horaire. */
  nodes: ReadonlyArray<{
    label: string;
    benefit: string;
    accent: "terracotta" | "primary" | "sage" | "mocha";
  }>;
  /** Texte alternatif pour les lecteurs d'écran (le SVG est décoratif). */
  ariaLabel: string;
  className?: string;
}

const accentColor: Record<"terracotta" | "primary" | "sage" | "mocha", string> = {
  terracotta: "var(--color-terracotta)",
  primary: "var(--color-primary)",
  sage: "var(--color-sage)",
  mocha: "var(--color-mocha)",
};

/**
 * Position d'un satellite sur une orbite elliptique.
 * angleDeg = 0 → droit, -90 → haut, 90 → bas.
 */
function ellipsePos(
  angleDeg: number,
  rx: number,
  ry: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * rx, y: cy + Math.sin(rad) * ry };
}

export function InterventionsHeroSchema({
  centerLabel,
  nodes,
  ariaLabel,
  className,
}: InterventionsHeroSchemaProps): ReactNode {
  // Canvas portrait — plus haut que large.
  const W = 560;
  const H = 760;
  const cx = W / 2;
  const cy = H / 2;
  // Orbite elliptique : verticale plus longue que l'horizontale pour
  // tenir dans la boîte portrait.
  const rx = 170;
  const ry = 270;

  // 5 angles répartis verticalement autour du centre.
  // Top, top-right, right, bottom-right, bottom-left, top-left… on en utilise 5.
  // Disposition retenue (sens horaire depuis le haut) :
  //   0 : top-left  (-110°)
  //   1 : top-right ( -65°)
  //   2 : right     (   0°)
  //   3 : bottom    (  65°)
  //   4 : bottom-left ( 130°)
  const angles = [-110, -65, 0, 65, 130];

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className ?? "pointer-events-none mx-auto w-full max-w-md"}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="iv-halo-tc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.25" />
            <stop offset="60%" stopColor="var(--color-terracotta)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="iv-halo-pr" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="iv-halo-sg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
          </radialGradient>
          <pattern id="iv-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="0.5"
              strokeOpacity="0.18"
            />
          </pattern>
          <radialGradient id="iv-grid-mask" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="iv-vignette-mask">
            <rect width="100%" height="100%" fill="url(#iv-grid-mask)" />
          </mask>
        </defs>

        {/* Grille texturée fade vignette */}
        <rect width={W} height={H} fill="url(#iv-grid)" mask="url(#iv-vignette-mask)" />

        {/* Halos diffus — top-right primary, bottom-left sage, centre terracotta */}
        <circle cx={cx} cy={cy} r={360} fill="url(#iv-halo-tc)" />
        <circle cx={W - 70} cy={120} r={160} fill="url(#iv-halo-pr)" />
        <circle cx={70} cy={H - 110} r={150} fill="url(#iv-halo-sg)" />

        {/* Anneaux concentriques décoratifs centre — ellipses pour matcher orbit */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 40}
          ry={ry + 40}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.20"
          strokeDasharray="2 8"
          fill="none"
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke="var(--color-terracotta)"
          strokeOpacity="0.30"
          strokeDasharray="3 6"
          fill="none"
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx - 50}
          ry={ry - 75}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.30"
          fill="none"
        />

        {/* Liaisons centre → satellites (pointillé doux accent) */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          return (
            <line
              key={`l-${idx}`}
              x1={cx}
              y1={cy}
              x2={pos.x}
              y2={pos.y}
              stroke={accentColor[node.accent]}
              strokeOpacity="0.40"
              strokeWidth="1.25"
              strokeDasharray="3 6"
            />
          );
        })}

        {/* Satellites — 5 nœuds bénéfice */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          // Décalage du label hors du nœud selon l'angle.
          // Côté gauche/droite du centre → le texte se met du même côté
          // (plus loin du centre).
          const isRight = pos.x > cx;
          const tx = isRight ? pos.x + 22 : pos.x - 22;
          const anchor = isRight ? "start" : "end";
          return (
            <g key={`n-${idx}`}>
              {/* Halos doubles autour du dot */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={32}
                fill={accentColor[node.accent]}
                fillOpacity="0.10"
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={22}
                fill={accentColor[node.accent]}
                fillOpacity="0.20"
              />
              {/* Dot principal */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={11}
                fill={accentColor[node.accent]}
                stroke="var(--color-bg)"
                strokeWidth="3"
              />
              {/* Label format (gras) */}
              <text
                x={tx}
                y={pos.y - 3}
                textAnchor={anchor}
                fontFamily="var(--font-manrope), system-ui, sans-serif"
                fontSize="15"
                fontWeight="700"
                fill="var(--color-fg)"
              >
                {node.label}
              </text>
              {/* Bénéfice concret (sous-label) */}
              <text
                x={tx}
                y={pos.y + 16}
                textAnchor={anchor}
                fontFamily="var(--font-manrope), system-ui, sans-serif"
                fontSize="12.5"
                fontWeight="500"
                fill="var(--color-fg-soft)"
              >
                {node.benefit}
              </text>
            </g>
          );
        })}

        {/* Centre — entreprise, sujet du schéma */}
        <circle
          cx={cx}
          cy={cy}
          r={78}
          fill="var(--color-paper)"
          stroke="var(--color-terracotta)"
          strokeWidth="2.5"
        />
        <circle
          cx={cx}
          cy={cy}
          r={78}
          fill="none"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.20"
          strokeWidth="14"
        />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontFamily="var(--font-serif), serif"
          fontStyle="italic"
          fontSize="24"
          fontWeight="500"
          fill="var(--color-terracotta)"
        >
          {centerLabel.split(" ")[0]}
        </text>
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fontFamily="var(--font-manrope), system-ui, sans-serif"
          fontSize="14"
          fontWeight="600"
          fill="var(--color-fg)"
        >
          {centerLabel.split(" ").slice(1).join(" ")}
        </text>

        {/* Particules décoratives */}
        <circle cx={50} cy={90} r={2.5} fill="var(--color-terracotta)" opacity="0.55" />
        <circle cx={W - 50} cy={H - 90} r={2.5} fill="var(--color-sage)" opacity="0.5" />
        <circle cx={W - 70} cy={70} r={2} fill="var(--color-primary)" opacity="0.55" />
        <circle cx={60} cy={H - 60} r={2} fill="var(--color-terracotta)" opacity="0.5" />
        <path
          d={`M ${W - 40} ${H / 2 - 80} l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z`}
          fill="var(--color-terracotta)"
          opacity="0.55"
        />
        <path
          d={`M 40 ${H / 2 + 80} l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z`}
          fill="var(--color-sage)"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}
