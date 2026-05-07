// Server Component — schéma visuel du hero /implementation.
// Format quasi-carré (~660 × 700) pour caser 8 satellites autour du centre
// "Votre entreprise" sans collision de labels. Reprend la grammaire du
// PageHeroDecoration / InterventionsHeroSchema (anneaux + halos terracotta /
// primary / sage + particules) avec 8 fonctions métier en orbite, chacune
// affichant son bénéfice concret (gain mesurable).
//
// Pas d'animation ; SSR-friendly ; aria-label au niveau du wrapper.

import type { ReactNode } from "react";

type Accent = "terracotta" | "primary" | "sage" | "mocha";

export interface ImplementationHeroSchemaProps {
  /** Label central (ex "Votre entreprise"). */
  centerLabel: string;
  /** Huit satellites — un par fonction métier. */
  nodes: ReadonlyArray<{
    label: string;
    benefit: string;
    accent: Accent;
  }>;
  /** Texte alternatif pour les lecteurs d'écran (le SVG est décoratif). */
  ariaLabel: string;
  className?: string;
}

const accentColor: Record<Accent, string> = {
  terracotta: "var(--color-terracotta)",
  primary: "var(--color-primary)",
  sage: "var(--color-sage)",
  mocha: "var(--color-mocha)",
};

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

export function ImplementationHeroSchema({
  centerLabel,
  nodes,
  ariaLabel,
  className,
}: ImplementationHeroSchemaProps): ReactNode {
  // Canvas légèrement paysage pour caser 8 satellites + labels.
  const W = 720;
  const H = 700;
  const cx = W / 2;
  const cy = H / 2;
  // Orbite quasi-circulaire (rx légèrement > ry) — on a la place horizontale
  // pour éviter les chevauchements de labels gauche/droite.
  const rx = 250;
  const ry = 230;

  // 8 angles répartis pour minimiser les collisions de labels.
  // Sens horaire depuis le haut. On évite 0° et 180° pile (= labels horizontaux
  // qui se collent), on les décale légèrement vers le haut pour placer le
  // sous-label en dessous sans empiéter sur le voisin.
  const angles = [-90, -45, 0, 45, 90, 135, 180, -135];

  // Quadrant du satellite → anchor du texte + offset.
  function labelLayout(angle: number): {
    anchor: "start" | "middle" | "end";
    dx: number;
    dyTitle: number;
    dyBenefit: number;
  } {
    // Top (~-90°) : label au-dessus du dot, centré.
    if (angle === -90) {
      return { anchor: "middle", dx: 0, dyTitle: -34, dyBenefit: -16 };
    }
    // Bottom (~90°) : label en-dessous, centré.
    if (angle === 90) {
      return { anchor: "middle", dx: 0, dyTitle: 32, dyBenefit: 50 };
    }
    // Côté droit (-45, 0, 45) : label à droite du dot.
    if (angle > -90 && angle < 90) {
      return { anchor: "start", dx: 22, dyTitle: -3, dyBenefit: 16 };
    }
    // Côté gauche (135, 180, -135) : label à gauche.
    return { anchor: "end", dx: -22, dyTitle: -3, dyBenefit: 16 };
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className ?? "hero-schema pointer-events-none"}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
      >
        <defs>
          <radialGradient id="im-halo-tc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.28" />
            <stop offset="60%" stopColor="var(--color-terracotta)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="im-halo-pr" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="im-halo-sg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
          </radialGradient>
          <pattern id="im-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="0.5"
              strokeOpacity="0.18"
            />
          </pattern>
          <radialGradient id="im-grid-mask" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="im-vignette-mask">
            <rect width="100%" height="100%" fill="url(#im-grid-mask)" />
          </mask>
        </defs>

        {/* Grille texturée fade vignette */}
        <rect width={W} height={H} fill="url(#im-grid)" mask="url(#im-vignette-mask)" />

        {/* Halos diffus — top-right primary, bottom-left sage, centre terracotta */}
        <circle cx={cx} cy={cy} r={360} fill="url(#im-halo-tc)" />
        <circle cx={W - 90} cy={120} r={180} fill="url(#im-halo-pr)" />
        <circle cx={90} cy={H - 110} r={170} fill="url(#im-halo-sg)" />

        {/* Anneaux concentriques décoratifs */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 50}
          ry={ry + 50}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.18"
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
          rx={rx - 70}
          ry={ry - 65}
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
              strokeOpacity="0.38"
              strokeWidth="1.25"
              strokeDasharray="3 6"
            />
          );
        })}

        {/* Satellites — 8 nœuds fonction × bénéfice */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          const layout = labelLayout(angle);
          return (
            <g key={`n-${idx}`}>
              {/* Halos doubles autour du dot */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={30}
                fill={accentColor[node.accent]}
                fillOpacity="0.10"
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={20}
                fill={accentColor[node.accent]}
                fillOpacity="0.20"
              />
              {/* Dot principal */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={10}
                fill={accentColor[node.accent]}
                stroke="var(--color-bg)"
                strokeWidth="3"
              />
              {/* Label fonction (gras) */}
              <text
                x={pos.x + layout.dx}
                y={pos.y + layout.dyTitle}
                textAnchor={layout.anchor}
                fontFamily="var(--font-manrope), system-ui, sans-serif"
                fontSize="15"
                fontWeight="700"
                fill="var(--color-fg)"
              >
                {node.label}
              </text>
              {/* Bénéfice concret (sous-label, plus doux) */}
              <text
                x={pos.x + layout.dx}
                y={pos.y + layout.dyBenefit}
                textAnchor={layout.anchor}
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

        {/* Centre — votre entreprise, sujet du schéma */}
        <circle
          cx={cx}
          cy={cy}
          r={84}
          fill="var(--color-paper)"
          stroke="var(--color-terracotta)"
          strokeWidth="2.5"
        />
        <circle
          cx={cx}
          cy={cy}
          r={84}
          fill="none"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.18"
          strokeWidth="14"
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontFamily="var(--font-serif), serif"
          fontStyle="italic"
          fontSize="25"
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
        <circle cx={60} cy={90} r={2.5} fill="var(--color-terracotta)" opacity="0.55" />
        <circle cx={W - 60} cy={H - 90} r={2.5} fill="var(--color-sage)" opacity="0.5" />
        <circle cx={W - 80} cy={70} r={2} fill="var(--color-primary)" opacity="0.55" />
        <circle cx={70} cy={H - 60} r={2} fill="var(--color-terracotta)" opacity="0.5" />
        <path
          d={`M ${W - 50} ${H / 2 - 100} l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z`}
          fill="var(--color-terracotta)"
          opacity="0.55"
        />
        <path
          d={`M 50 ${H / 2 + 100} l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z`}
          fill="var(--color-sage)"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}
