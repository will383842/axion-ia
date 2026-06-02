// Server Component — schéma visuel du hero /implementation (et, via ServiceHero,
// des hubs un-a-un / audit / sites-web / interventions collectives).
//
// Format carré 1:1 (560×560) — harmonisé doctrine `.hero-schema` v3.3
// (2026-05-08). Orbite quasi-circulaire pour caser 8 satellites autour du
// centre sans collision de labels.
//
// Refonte design v4 (2026-06-02, Will) — montée en gamme visuelle :
//   • connecteurs COURBES (quadratic bezier) à dégradé radial qui s'estompe
//     vers le centre → impression d'énergie qui irradie
//   • satellites en SPHÈRES (anneau + cœur + reflet glossy + ombre douce)
//     au lieu de dots plats
//   • anneau de précision GRADUÉ (ticks tous les 15°, ticks longs aux nœuds)
//   • centre MULTI-COUCHES : disque + halo intérieur + anneaux hairline
//   • ombres portées douces (filter feDropShadow) pour la profondeur
//
// Pas d'animation ; SSR-friendly ; aria-label au niveau du wrapper.

import type { ReactNode } from "react";

type Accent = "terracotta" | "primary" | "sage" | "mocha";

export interface ImplementationHeroSchemaProps {
  /** Label central (ex "Votre entreprise", "Vous"). */
  centerLabel: string;
  /** Huit satellites — un par fonction / objectif. */
  nodes: ReadonlyArray<{
    label: string;
    benefit: string;
    accent: Accent;
  }>;
  /** Texte alternatif pour les lecteurs d'écran (le SVG est décoratif). */
  ariaLabel: string;
  className?: string;
}

const ACCENTS: readonly Accent[] = ["terracotta", "primary", "sage", "mocha"];

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
  // Canvas carré 1:1 — harmonisé doctrine .hero-schema v3.3 (2026-05-08).
  const W = 560;
  const H = 560;
  const cx = W / 2;
  const cy = H / 2;
  // Orbite quasi-circulaire (rx légèrement > ry).
  const rx = 195;
  const ry = 180;

  // 8 angles répartis pour minimiser les collisions de labels.
  const angles = [-90, -45, 0, 45, 90, 135, 180, -135];

  // Ticks de l'anneau de précision (tous les 15°).
  const tickAngles = Array.from({ length: 24 }, (_, i) => i * 15);

  // Quadrant du satellite → anchor du texte + offset.
  function labelLayout(angle: number): {
    anchor: "start" | "middle" | "end";
    dx: number;
    dyTitle: number;
    dyBenefit: number;
  } {
    if (angle === -90) {
      return { anchor: "middle", dx: 0, dyTitle: -38, dyBenefit: -20 };
    }
    if (angle === 90) {
      return { anchor: "middle", dx: 0, dyTitle: 36, dyBenefit: 54 };
    }
    if (angle > -90 && angle < 90) {
      return { anchor: "start", dx: 26, dyTitle: -3, dyBenefit: 16 };
    }
    return { anchor: "end", dx: -26, dyTitle: -3, dyBenefit: 16 };
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
          {/* Halos diffus de fond */}
          <radialGradient id="im-halo-tc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.26" />
            <stop offset="55%" stopColor="var(--color-terracotta)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="im-halo-pr" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="im-halo-sg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
          </radialGradient>

          {/* Grille texturée + masque vignette */}
          <pattern id="im-grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path
              d="M 44 0 L 0 0 0 44"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="0.5"
              strokeOpacity="0.16"
            />
          </pattern>
          <radialGradient id="im-grid-mask" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="im-vignette-mask">
            <rect width="100%" height="100%" fill="url(#im-grid-mask)" />
          </mask>

          {/* Reflet glossy réutilisable pour les sphères (highlight blanc). */}
          <radialGradient id="im-node-gloss" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Halo intérieur du centre (sheen). */}
          <radialGradient id="im-center-sheen" cx="42%" cy="36%" r="68%">
            <stop offset="0%" stopColor="white" stopOpacity="0.85" />
            <stop offset="55%" stopColor="var(--color-paper)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-paper)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="im-center-base" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-paper)" />
            <stop offset="78%" stopColor="var(--color-paper)" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0.07" />
          </radialGradient>

          {/* Dégradé radial des connecteurs : faible au centre, vif au nœud.
              userSpaceOnUse → s'aligne quel que soit l'angle du spoke. */}
          {ACCENTS.map((a) => (
            <radialGradient
              key={`spoke-${a}`}
              id={`im-spoke-${a}`}
              gradientUnits="userSpaceOnUse"
              cx={cx}
              cy={cy}
              r={rx}
            >
              <stop offset="0%" stopColor={accentColor[a]} stopOpacity="0.04" />
              <stop offset="50%" stopColor={accentColor[a]} stopOpacity="0.20" />
              <stop offset="100%" stopColor={accentColor[a]} stopOpacity="0.55" />
            </radialGradient>
          ))}

          {/* Dégradé de l'anneau principal (fade gauche/droite). */}
          <linearGradient id="im-orbit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.04" />
            <stop offset="50%" stopColor="var(--color-terracotta)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0.04" />
          </linearGradient>

          {/* Ombre portée douce (profondeur). */}
          <filter id="im-soft-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#3a2a22" floodOpacity="0.16" />
          </filter>
          <filter id="im-center-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="14"
              floodColor="#3a2a22"
              floodOpacity="0.18"
            />
          </filter>
        </defs>

        {/* Grille texturée fade vignette */}
        <rect width={W} height={H} fill="url(#im-grid)" mask="url(#im-vignette-mask)" />

        {/* Halos diffus */}
        <circle cx={cx} cy={cy} r={360} fill="url(#im-halo-tc)" />
        <circle cx={W - 90} cy={120} r={180} fill="url(#im-halo-pr)" />
        <circle cx={90} cy={H - 110} r={170} fill="url(#im-halo-sg)" />

        {/* Anneaux gyroscopiques inclinés — profondeur d'un système en orbite */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 16}
          ry={72}
          transform={`rotate(32 ${cx} ${cy})`}
          stroke="var(--color-primary)"
          strokeOpacity="0.12"
          strokeWidth="1"
          fill="none"
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 16}
          ry={72}
          transform={`rotate(-32 ${cx} ${cy})`}
          stroke="var(--color-sage)"
          strokeOpacity="0.12"
          strokeWidth="1"
          fill="none"
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 8}
          ry={108}
          transform={`rotate(90 ${cx} ${cy})`}
          stroke="var(--color-terracotta)"
          strokeOpacity="0.08"
          strokeWidth="1"
          fill="none"
        />

        {/* Anneau extérieur hairline pointillé */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 52}
          ry={ry + 52}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.16"
          strokeDasharray="2 9"
          fill="none"
        />

        {/* Anneau de précision gradué — ticks tous les 15°, longs aux nœuds */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke="url(#im-orbit)"
          strokeWidth="1.25"
          fill="none"
        />
        {tickAngles.map((a) => {
          const isNode = angles.includes(a) || angles.includes(a - 360);
          const inner = ellipsePos(a, rx - (isNode ? 9 : 5), ry - (isNode ? 9 : 5), cx, cy);
          const outer = ellipsePos(a, rx + (isNode ? 9 : 5), ry + (isNode ? 9 : 5), cx, cy);
          return (
            <line
              key={`tick-${a}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--color-terracotta)"
              strokeOpacity={isNode ? 0.42 : 0.2}
              strokeWidth={isNode ? 1.6 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* Anneau intérieur plein subtil */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx - 72}
          ry={ry - 66}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.26"
          fill="none"
        />

        {/* Connecteurs courbes centre → satellites (dégradé radial) */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          // Point de contrôle = milieu décalé perpendiculairement (bow doux).
          const mx = (cx + pos.x) / 2;
          const my = (cy + pos.y) / 2;
          const dxv = pos.x - cx;
          const dyv = pos.y - cy;
          const len = Math.hypot(dxv, dyv) || 1;
          const bow = 18;
          const ctrlX = mx + (-dyv / len) * bow;
          const ctrlY = my + (dxv / len) * bow;
          // Point de mesure sur la courbe quadratique à t = 0.62.
          const t = 0.62;
          const mt = 1 - t;
          const markX = mt * mt * cx + 2 * mt * t * ctrlX + t * t * pos.x;
          const markY = mt * mt * cy + 2 * mt * t * ctrlY + t * t * pos.y;
          return (
            <g key={`l-${idx}`}>
              <path
                d={`M ${cx} ${cy} Q ${ctrlX} ${ctrlY} ${pos.x} ${pos.y}`}
                fill="none"
                stroke={`url(#im-spoke-${node.accent})`}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Marqueur de mesure */}
              <circle
                cx={markX}
                cy={markY}
                r={3.2}
                fill="var(--color-paper)"
                stroke={accentColor[node.accent]}
                strokeOpacity="0.6"
                strokeWidth="1.4"
              />
            </g>
          );
        })}

        {/* Satellites — sphères fonction × bénéfice */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          const layout = labelLayout(angle);
          const col = accentColor[node.accent];
          return (
            <g key={`n-${idx}`}>
              {/* Glow diffus */}
              <circle cx={pos.x} cy={pos.y} r={26} fill={col} fillOpacity="0.09" />
              {/* Anneau fin de halo */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={15.5}
                fill="none"
                stroke={col}
                strokeOpacity="0.35"
                strokeWidth="1"
              />
              {/* Cœur (sphère) avec ombre douce */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={10.5}
                fill={col}
                stroke="var(--color-paper)"
                strokeWidth="3"
                filter="url(#im-soft-shadow)"
              />
              {/* Reflet glossy haut-gauche */}
              <circle cx={pos.x - 3.2} cy={pos.y - 3.6} r={4.2} fill="url(#im-node-gloss)" />

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

        {/* Aura concentrique — le centre comme source d'énergie */}
        <circle
          cx={cx}
          cy={cy}
          r={98}
          fill="none"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.1"
          strokeWidth="1"
          strokeDasharray="1 7"
        />
        <circle
          cx={cx}
          cy={cy}
          r={110}
          fill="none"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.06"
          strokeWidth="1"
          strokeDasharray="1 9"
        />

        {/* Centre — sujet du schéma, multi-couches */}
        <g filter="url(#im-center-shadow)">
          {/* Anneau extérieur épais translucide */}
          <circle
            cx={cx}
            cy={cy}
            r={84}
            fill="none"
            stroke="var(--color-terracotta)"
            strokeOpacity="0.14"
            strokeWidth="14"
          />
          {/* Disque de base (dégradé subtil) */}
          <circle cx={cx} cy={cy} r={78} fill="url(#im-center-base)" />
          {/* Anneau net */}
          <circle
            cx={cx}
            cy={cy}
            r={78}
            fill="none"
            stroke="var(--color-terracotta)"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
        </g>
        {/* Sheen intérieur (au-dessus, hors ombre) */}
        <circle cx={cx} cy={cy} r={78} fill="url(#im-center-sheen)" />
        {/* Anneau hairline intérieur */}
        <circle
          cx={cx}
          cy={cy}
          r={66}
          fill="none"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.16"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontFamily="var(--font-serif), serif"
          fontStyle="italic"
          fontSize="26"
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
        <circle cx={60} cy={90} r={2.5} fill="var(--color-terracotta)" opacity="0.5" />
        <circle cx={W - 60} cy={H - 90} r={2.5} fill="var(--color-sage)" opacity="0.45" />
        <circle cx={W - 80} cy={70} r={2} fill="var(--color-primary)" opacity="0.5" />
        <circle cx={70} cy={H - 60} r={2} fill="var(--color-terracotta)" opacity="0.45" />
        <path
          d={`M ${W - 50} ${H / 2 - 100} l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z`}
          fill="var(--color-terracotta)"
          opacity="0.5"
        />
        <path
          d={`M 50 ${H / 2 + 100} l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z`}
          fill="var(--color-sage)"
          opacity="0.45"
        />
      </svg>
    </div>
  );
}
