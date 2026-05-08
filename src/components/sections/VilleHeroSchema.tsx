// Server Component — schéma visuel hero des pages villes pSEO.
// Format CARRÉ 560×560 — harmonisé doctrine `.hero-schema` v3.3
// (2026-05-08), orbite quasi-circulaire avec 6 satellites représentant
// l'écosystème économique local (secteurs NAF dominants, hubs, gares, etc.).
// Centre = nom de la ville en serif italique terracotta.
//
// Doctrine v3.3 .hero-schema : zéro animation, zéro halo massif débordant,
// SSR-friendly, palette tokens uniquement (anti-hex strict). Réutilisable
// pour tous les pilotes ville (Paris d'abord, puis Lyon, Marseille, etc.
// à mesure que Will publie un copy).

import type { ReactNode } from "react";

export interface VilleHeroSatellite {
  /** Label gras (~12-18 caractères max). */
  label: string;
  /** Sous-label détail (~25 caractères max). */
  detail: string;
  /** Accent éditorial cohérent doctrine v3 (4 couleurs autorisées). */
  accent: "terracotta" | "primary" | "sage" | "mocha";
}

export interface VilleHeroSchemaProps {
  /** Nom de la ville (ex "Paris"). Affiché en italic Fraunces terracotta. */
  centerLabel: string;
  /** Légende sous le label (ex "Écosystème IA · 215 K entreprises"). */
  centerSubLabel?: string;
  /** Six satellites — ordre = sens horaire à partir du haut-gauche. */
  nodes: ReadonlyArray<VilleHeroSatellite>;
  /** Texte alternatif pour les lecteurs d'écran. */
  ariaLabel: string;
  className?: string;
}

const ACCENT_TOKEN: Record<"terracotta" | "primary" | "sage" | "mocha", string> = {
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

export function VilleHeroSchema({
  centerLabel,
  centerSubLabel,
  nodes,
  ariaLabel,
  className,
}: VilleHeroSchemaProps): ReactNode {
  // Canvas carré 1:1 — harmonisé doctrine .hero-schema v3.3 (2026-05-08).
  const W = 560;
  const H = 560;
  const cx = W / 2;
  const cy = H / 2;
  // Orbite quasi-circulaire (ry légèrement > rx) — 6 satellites distribués
  // sur les arcs haut + bas pour éviter chevauchement labels gauche/droite.
  const rx = 180;
  const ry = 180;

  // 6 satellites distribués pour éviter chevauchement labels :
  //   0 top-left (-115°) · 1 top-right (-65°)
  //   2 right (-5°)      · 3 bottom-right (60°)
  //   4 bottom-left (115°) · 5 left (180°)
  const angles = [-115, -65, -5, 60, 115, 180];

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
          <radialGradient id="vh-halo-tc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.22" />
            <stop offset="60%" stopColor="var(--color-terracotta)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vh-halo-pr" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vh-halo-sg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
          </radialGradient>
          <pattern id="vh-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="0.5"
              strokeOpacity="0.18"
            />
          </pattern>
          <radialGradient id="vh-grid-mask" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="vh-vignette-mask">
            <rect width="100%" height="100%" fill="url(#vh-grid-mask)" />
          </mask>
        </defs>

        {/* Grille texturée fade vignette */}
        <rect width={W} height={H} fill="url(#vh-grid)" mask="url(#vh-vignette-mask)" />

        {/* Halos doux — terracotta centre, primary haut-droite, sage bas-gauche */}
        <circle cx={cx} cy={cy} r={360} fill="url(#vh-halo-tc)" />
        <circle cx={W - 60} cy={130} r={170} fill="url(#vh-halo-pr)" />
        <circle cx={70} cy={H - 120} r={150} fill="url(#vh-halo-sg)" />

        {/* Anneaux concentriques décoratifs (orbite) */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 45}
          ry={ry + 45}
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
          rx={rx - 55}
          ry={ry - 80}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.30"
          fill="none"
        />

        {/* Liaisons centre → satellites */}
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
              stroke={ACCENT_TOKEN[node.accent]}
              strokeOpacity="0.40"
              strokeWidth="1.25"
              strokeDasharray="3 6"
            />
          );
        })}

        {/* Satellites */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          const isRight = pos.x > cx + 4;
          const isLeft = pos.x < cx - 4;
          const tx = isRight ? pos.x + 22 : isLeft ? pos.x - 22 : pos.x;
          const anchor = isRight ? "start" : isLeft ? "end" : "middle";
          return (
            <g key={`n-${idx}`}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={32}
                fill={ACCENT_TOKEN[node.accent]}
                fillOpacity="0.10"
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={22}
                fill={ACCENT_TOKEN[node.accent]}
                fillOpacity="0.20"
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={11}
                fill={ACCENT_TOKEN[node.accent]}
                stroke="var(--color-bg)"
                strokeWidth="3"
              />
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
              <text
                x={tx}
                y={pos.y + 16}
                textAnchor={anchor}
                fontFamily="var(--font-manrope), system-ui, sans-serif"
                fontSize="12.5"
                fontWeight="500"
                fill="var(--color-fg-soft)"
              >
                {node.detail}
              </text>
            </g>
          );
        })}

        {/* Centre — ville pivot du schéma */}
        <circle
          cx={cx}
          cy={cy}
          r={82}
          fill="var(--color-paper)"
          stroke="var(--color-terracotta)"
          strokeWidth="2.5"
        />
        <circle
          cx={cx}
          cy={cy}
          r={82}
          fill="none"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.20"
          strokeWidth="14"
        />
        <text
          x={cx}
          y={centerSubLabel ? cy - 6 : cy + 6}
          textAnchor="middle"
          fontFamily="var(--font-serif), serif"
          fontStyle="italic"
          fontSize="32"
          fontWeight="500"
          fill="var(--color-terracotta)"
        >
          {centerLabel}
        </text>
        {centerSubLabel ? (
          <text
            x={cx}
            y={cy + 22}
            textAnchor="middle"
            fontFamily="var(--font-manrope), system-ui, sans-serif"
            fontSize="11"
            fontWeight="600"
            fill="var(--color-fg)"
            letterSpacing="0.08em"
          >
            {centerSubLabel.toUpperCase()}
          </text>
        ) : null}

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
