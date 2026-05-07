// Server Component — schéma visuel du hero /stack-ia (FR) /ai-stack (EN).
// Pattern : copie strict de InterventionsHeroSchema — orbite elliptique
// portrait, centre serif italique terracotta, 6 satellites (vs 5 sur
// /interventions) chacun avec son accent. Aucun JS, SSR pur.
//
// Narration : votre business au centre, les 6 bénéfices ultimes que la
// stack IA opérationnelle débloque autour. Pas d'icône — typographie
// éditoriale Fraunces italique en signature, dans la lignée du titleEm
// du hero. Plus premium et plus on-brand que des icônes "tech startup".
//
// Will, 2026-05-07.

import type { ReactNode } from "react";

export type StackHeroAccent = "terracotta" | "primary" | "sage" | "mocha";

export interface StackHeroNode {
  /** Mot principal (ex « Futur », « Performance »). Affiché en serif italique. */
  label: string;
  /** Sous-titre concret (ex « Anticiper, pas subir »). */
  detail: string;
  accent: StackHeroAccent;
}

export interface StackHeroSchemaProps {
  /** Label central (ex « Votre business »). Premier mot mis en serif italique. */
  centerLabel: string;
  /** Légende sous le label central (ex « propulsé par 11 IA »). */
  centerCaption: string;
  /** Six satellites — ordre = sens horaire depuis le haut-gauche. */
  nodes: ReadonlyArray<StackHeroNode>;
  /** Texte alternatif pour lecteurs d'écran (le SVG est décoratif). */
  ariaLabel: string;
  className?: string;
}

const accentColor: Record<StackHeroAccent, string> = {
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

export function StackHeroSchema({
  centerLabel,
  centerCaption,
  nodes,
  ariaLabel,
  className,
}: StackHeroSchemaProps): ReactNode {
  // Canvas portrait — même proportion que InterventionsHeroSchema.
  const W = 560;
  const H = 760;
  const cx = W / 2;
  const cy = H / 2;
  // Orbite légèrement resserrée vs /interventions (rx 185→160) car on a
  // 6 satellites au lieu de 5 → labels risquent moins de déborder en
  // largeur dans la colonne voisine du hero.
  const rx = 160;
  const ry = 280;

  // 6 angles répartis dans l'arc haut + bas, tous dans la zone safe
  // [-130°, 130°] → AUCUN satellite ne se retrouve sur la face gauche
  // (180°) où les labels déborderaient sur la colonne titre du hero.
  // Distribution : 3 en haut (gauche-haut → centre-haut → droite-haut),
  // 3 en bas symétrique.
  const angles = [-115, -70, -25, 25, 70, 115];

  // Premier mot du label central → serif italique terracotta.
  const centerWords = centerLabel.split(" ");
  const centerHead = centerWords[0] ?? centerLabel;
  const centerTail = centerWords.slice(1).join(" ");

  // Mini-cluster des 11 outils dans le centre — points organisés en
  // constellation pour signifier visuellement la stack sans logo tiers.
  // Coordonnées relatives au centre (cx, cy), rayon ~46 px.
  const stackDots: ReadonlyArray<{ dx: number; dy: number; accent: StackHeroAccent }> = [
    { dx: 0, dy: -34, accent: "terracotta" },
    { dx: 28, dy: -22, accent: "primary" },
    { dx: 38, dy: 0, accent: "primary" },
    { dx: 28, dy: 22, accent: "sage" },
    { dx: 0, dy: 34, accent: "sage" },
    { dx: -28, dy: 22, accent: "mocha" },
    { dx: -38, dy: 0, accent: "mocha" },
    { dx: -28, dy: -22, accent: "mocha" },
    { dx: 14, dy: -8, accent: "terracotta" },
    { dx: -14, dy: 8, accent: "terracotta" },
    { dx: 0, dy: 0, accent: "terracotta" },
  ];

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className ?? "pointer-events-none mx-auto w-full max-w-md"}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
      >
        <defs>
          <radialGradient id="sk-halo-tc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.25" />
            <stop offset="60%" stopColor="var(--color-terracotta)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sk-halo-pr" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sk-halo-sg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
          </radialGradient>
          <pattern id="sk-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="0.5"
              strokeOpacity="0.18"
            />
          </pattern>
          <radialGradient id="sk-grid-mask" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="sk-vignette-mask">
            <rect width="100%" height="100%" fill="url(#sk-grid-mask)" />
          </mask>
        </defs>

        {/* Grille texturée fade vignette (cohérence /interventions) */}
        <rect width={W} height={H} fill="url(#sk-grid)" mask="url(#sk-vignette-mask)" />

        {/* Halos diffus — terracotta centre, primary haut-droite, sage bas-gauche */}
        <circle cx={cx} cy={cy} r={380} fill="url(#sk-halo-tc)" />
        <circle cx={W - 70} cy={120} r={170} fill="url(#sk-halo-pr)" />
        <circle cx={70} cy={H - 110} r={160} fill="url(#sk-halo-sg)" />

        {/* Anneaux concentriques décoratifs centre (ellipses) */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 50}
          ry={ry + 45}
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
          strokeOpacity="0.32"
          strokeDasharray="3 6"
          fill="none"
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx - 45}
          ry={ry - 80}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.28"
          fill="none"
        />

        {/* Liaisons centre → satellites (pointillé doux par accent) */}
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

        {/* Satellites — 6 bénéfices ultimes */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
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
              {/* Label bénéfice — Fraunces italique pour cohérence titleEm */}
              <text
                x={tx}
                y={pos.y - 3}
                textAnchor={anchor}
                fontFamily="var(--font-serif), serif"
                fontStyle="italic"
                fontSize="22"
                fontWeight="500"
                fill={accentColor[node.accent]}
              >
                {node.label}
              </text>
              {/* Détail concret — sans-serif sobre */}
              <text
                x={tx}
                y={pos.y + 18}
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

        {/* Centre — Votre business + cluster des 11 outils.
            Cercle agrandi (r 92→108) + cluster remonté + textes recentrés
            verticalement → la composition tient TOUJOURS dans le cercle,
            même avec un caption plus long. */}
        {/* Anneau extérieur diffus */}
        <circle
          cx={cx}
          cy={cy}
          r={108}
          fill="none"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.16"
          strokeWidth="14"
        />
        {/* Cercle papier principal */}
        <circle
          cx={cx}
          cy={cy}
          r={108}
          fill="var(--color-paper)"
          stroke="var(--color-terracotta)"
          strokeWidth="2.5"
        />

        {/* Cluster des 11 outils — constellation, remontée pour laisser
            place aux 3 lignes de texte en bas. Position cy-30 (était cy-8). */}
        <g transform={`translate(${cx}, ${cy - 30})`} opacity="0.85">
          {stackDots.map((d, i) => (
            <circle
              key={`s-${i}`}
              cx={d.dx}
              cy={d.dy}
              r={3}
              fill={accentColor[d.accent]}
              opacity="0.7"
            />
          ))}
          {/* Liaisons internes du cluster — montrent la cohérence stack */}
          <line
            x1={stackDots[0]?.dx ?? 0}
            y1={stackDots[0]?.dy ?? 0}
            x2={stackDots[4]?.dx ?? 0}
            y2={stackDots[4]?.dy ?? 0}
            stroke="var(--color-terracotta)"
            strokeOpacity="0.20"
            strokeWidth="0.6"
          />
          <line
            x1={stackDots[2]?.dx ?? 0}
            y1={stackDots[2]?.dy ?? 0}
            x2={stackDots[6]?.dx ?? 0}
            y2={stackDots[6]?.dy ?? 0}
            stroke="var(--color-terracotta)"
            strokeOpacity="0.20"
            strokeWidth="0.6"
          />
        </g>

        {/* Label central — 3 lignes recentrées dans le cercle r=108.
            Chord disponible à y=cy+62 = 2·√(108²-62²) = 177px → assez
            pour un caption de 14 chars en uppercase letter-spacing 0.08em. */}
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fontFamily="var(--font-serif), serif"
          fontStyle="italic"
          fontSize="22"
          fontWeight="500"
          fill="var(--color-terracotta)"
        >
          {centerHead}
        </text>
        {centerTail ? (
          <text
            x={cx}
            y={cy + 42}
            textAnchor="middle"
            fontFamily="var(--font-manrope), system-ui, sans-serif"
            fontSize="13"
            fontWeight="600"
            fill="var(--color-fg)"
          >
            {centerTail}
          </text>
        ) : null}
        <text
          x={cx}
          y={cy + 64}
          textAnchor="middle"
          fontFamily="var(--font-manrope), system-ui, sans-serif"
          fontSize="10.5"
          fontWeight="500"
          fill="var(--color-fg-muted)"
          letterSpacing="0.08em"
        >
          {centerCaption.toUpperCase()}
        </text>

        {/* Particules décoratives (cohérence /interventions) */}
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
        <path
          d={`M ${W - 30} ${H - 200} l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z`}
          fill="var(--color-primary)"
          opacity="0.45"
        />
      </svg>
    </div>
  );
}
