// Hero orbital v2 — version travaillée du schéma orbital pour la page hub
// /interventions/collectives. Sprint 2026-05-28 (Will).
//
// Différences vs `ImplementationHeroSchema` (orbital générique) :
//  - Glyphes brand SVG inline dans chaque satellite (ChatGPT, Claude, Mistral,
//    Copilot, Perplexity, Midjourney, Sora, HeyGen) au lieu de dots colorés.
//  - Plus de profondeur visuelle : gradients radiaux sur les satellites, ombre
//    portée subtile, anneau supplémentaire de raffinement.
//  - Animations CSS pures (pulse halo lent, fade-in stagger) avec respect
//    `prefers-reduced-motion`.
//  - Typo serif italique sur les labels d'outils (cohérent identité Axion-IA
//    éditoriale).
//
// Le composant reste pur SVG inline (0 network call, 0 JS, ~8 KB gz),
// Server Component. CLS = 0, LCP optimal.

import type { ReactNode } from "react";

type Accent = "terracotta" | "primary" | "sage" | "mocha";

interface ToolNode {
  slug:
    | "chatgpt"
    | "claude"
    | "mistral"
    | "copilot"
    | "perplexity"
    | "midjourney"
    | "sora"
    | "heygen";
  label: string;
  benefit: string;
  accent: Accent;
}

// Paths SVG des glyphes brand — dupliqués depuis `brand-logos.tsx` pour
// inliner dans le SVG principal (évite `<foreignObject>` et garantit le
// rendu pur SSR sans boundary client).
const BRAND_GLYPHS: Record<ToolNode["slug"], string> = {
  chatgpt:
    "M12 4 L18 8 L18 16 L12 20 L6 16 L6 8 Z M12 4 L12 12 L18 16 M6 8 L12 12 L18 8 M6 16 L12 12 L12 20",
  claude: "M12 3 L13.2 10.5 L20 12 L13.2 13.5 L12 21 L10.8 13.5 L4 12 L10.8 10.5 Z",
  mistral: "M4 18 L4 7 L8 13 L12 7 L12 18 M15 9 L20 9 M15 13 L18 13 M15 17 L20 17",
  copilot:
    "M12 4 C8 4 4 8 4 12 M12 4 C16 4 20 8 20 12 M12 20 C8 20 4 16 4 12 M12 20 C16 20 20 16 20 12",
  perplexity:
    "M12 4 L12 7 M12 17 L12 20 M4 12 L7 12 M17 12 L20 12 M6.3 6.3 L8.5 8.5 M15.5 15.5 L17.7 17.7 M17.7 6.3 L15.5 8.5 M8.5 15.5 L6.3 17.7",
  midjourney:
    "M12 4 L12 16 M12 6 L18 14 L12 14 Z M12 6 L6 14 L12 14 Z M4 18 L20 18 M6 18 L8 20 L16 20 L18 18",
  sora: "M12 4 L13 11 L20 12 L13 13 L12 20 L11 13 L4 12 L11 11 Z",
  heygen: "M6 4 L6 20 M18 4 L18 20 M6 12 Q12 9 18 12",
};

const accentColor: Record<Accent, string> = {
  terracotta: "var(--color-terracotta)",
  primary: "var(--color-primary)",
  sage: "var(--color-sage)",
  mocha: "var(--color-mocha)",
};

export interface HeroOrbitalProps {
  centerLabel: string;
  nodes: ReadonlyArray<ToolNode>;
  ariaLabel: string;
  className?: string;
}

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

export function HeroOrbital({
  centerLabel,
  nodes,
  ariaLabel,
  className,
}: HeroOrbitalProps): ReactNode {
  // Canvas 1:1 cohérent doctrine .hero-schema v3.3.
  const W = 560;
  const H = 560;
  const cx = W / 2;
  const cy = H / 2;
  const rx = 200;
  const ry = 188;

  // 8 angles répartis sens horaire depuis le haut, écartés pour minimiser
  // les collisions visuelles entre satellites + leurs labels.
  const angles = [-90, -45, 0, 45, 90, 135, 180, -135];

  function labelLayout(angle: number) {
    if (angle === -90) {
      return { anchor: "middle" as const, dx: 0, dyTitle: -48, dyBenefit: -30 };
    }
    if (angle === 90) {
      return { anchor: "middle" as const, dx: 0, dyTitle: 46, dyBenefit: 64 };
    }
    if (angle > -90 && angle < 90) {
      return { anchor: "start" as const, dx: 32, dyTitle: -4, dyBenefit: 14 };
    }
    return { anchor: "end" as const, dx: -32, dyTitle: -4, dyBenefit: 14 };
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className ?? "hero-orbital pointer-events-none"}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
      >
        <defs>
          {/* Halos atmosphériques diffus — terracotta centre, primary haut-droit,
              sage bas-gauche. Crée un effet de lumière naturelle. */}
          <radialGradient id="ho-halo-tc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.32" />
            <stop offset="55%" stopColor="var(--color-terracotta)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ho-halo-pr" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ho-halo-sg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
          </radialGradient>

          {/* Gradient sur les satellites — bg paper → sand pour profondeur 3D
              légère, donne un effet de "bouton physique" plutôt qu'un dot plat. */}
          <radialGradient id="ho-satellite-bg" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="var(--color-paper)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--color-sand)" stopOpacity="1" />
          </radialGradient>

          {/* Ombre portée légère pour les satellites — donne profondeur sans
              être tape-à-l'œil. */}
          <filter id="ho-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="3"
              floodColor="var(--color-mocha)"
              floodOpacity="0.15"
            />
          </filter>

          {/* Pattern grille très subtile en fond — texture papier */}
          <pattern id="ho-grid" width="52" height="52" patternUnits="userSpaceOnUse">
            <path
              d="M 52 0 L 0 0 0 52"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="0.5"
              strokeOpacity="0.15"
            />
          </pattern>
          <radialGradient id="ho-grid-mask" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.6" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="ho-vignette">
            <rect width="100%" height="100%" fill="url(#ho-grid-mask)" />
          </mask>
        </defs>

        {/* Background grille avec masque vignette */}
        <rect width={W} height={H} fill="url(#ho-grid)" mask="url(#ho-vignette)" />

        {/* 3 halos atmosphériques superposés */}
        <circle cx={cx} cy={cy} r={380} fill="url(#ho-halo-tc)" />
        <circle cx={W - 80} cy={110} r={200} fill="url(#ho-halo-pr)" />
        <circle cx={80} cy={H - 100} r={190} fill="url(#ho-halo-sg)" />

        {/* Anneaux décoratifs concentriques — 3 couches pour profondeur.
            Le plus extérieur est dashed (suggestion d'orbite). */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 60}
          ry={ry + 60}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.15"
          strokeDasharray="2 10"
          fill="none"
          className="ho-ring-outer"
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke="var(--color-terracotta)"
          strokeOpacity="0.35"
          strokeDasharray="3 7"
          fill="none"
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx - 76}
          ry={ry - 72}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.28"
          fill="none"
        />

        {/* Liaisons centre → satellites — lignes radiales dashed */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          return (
            <line
              key={`line-${idx}`}
              x1={cx}
              y1={cy}
              x2={pos.x}
              y2={pos.y}
              stroke={accentColor[node.accent]}
              strokeOpacity="0.40"
              strokeWidth="1.2"
              strokeDasharray="3 6"
            />
          );
        })}

        {/* Satellites — 8 outils IA avec leur glyph brand */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          const layout = labelLayout(angle);
          const accent = accentColor[node.accent];
          const glyphPath = BRAND_GLYPHS[node.slug];

          return (
            <g
              key={`sat-${idx}`}
              className="ho-satellite"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Halo externe diffus (le plus large) — donne ambiance lumineuse */}
              <circle cx={pos.x} cy={pos.y} r={38} fill={accent} fillOpacity="0.08" />
              {/* Halo intermédiaire — couleur accent atténuée */}
              <circle cx={pos.x} cy={pos.y} r={28} fill={accent} fillOpacity="0.15" />
              {/* Disque blanc avec gradient + ombre portée — base du satellite */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={22}
                fill="url(#ho-satellite-bg)"
                stroke={accent}
                strokeWidth="2"
                filter="url(#ho-shadow)"
              />
              {/* Glyph brand au centre du disque — couleur accent */}
              <g
                transform={`translate(${pos.x - 12} ${pos.y - 12})`}
                stroke={accent}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              >
                <path d={glyphPath} />
              </g>
              {/* Label outil — serif italique terracotta */}
              <text
                x={pos.x + layout.dx}
                y={pos.y + layout.dyTitle}
                textAnchor={layout.anchor}
                fontFamily="var(--font-serif), serif"
                fontStyle="italic"
                fontSize="17"
                fontWeight="500"
                fill="var(--color-terracotta-deep)"
              >
                {node.label}
              </text>
              {/* Bénéfice — sans-serif doux */}
              <text
                x={pos.x + layout.dx}
                y={pos.y + layout.dyBenefit}
                textAnchor={layout.anchor}
                fontFamily="var(--font-manrope), system-ui, sans-serif"
                fontSize="12"
                fontWeight="500"
                fill="var(--color-fg-soft)"
              >
                {node.benefit}
              </text>
            </g>
          );
        })}

        {/* Centre — votre équipe (sujet du schéma) */}
        <circle
          cx={cx}
          cy={cy}
          r={92}
          fill="url(#ho-satellite-bg)"
          stroke="var(--color-terracotta)"
          strokeWidth="2.5"
          filter="url(#ho-shadow)"
        />
        <circle
          cx={cx}
          cy={cy}
          r={92}
          fill="none"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.20"
          strokeWidth="16"
        />
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fontFamily="var(--font-serif), serif"
          fontStyle="italic"
          fontSize="28"
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
          fontSize="15"
          fontWeight="600"
          fill="var(--color-fg)"
        >
          {centerLabel.split(" ").slice(1).join(" ")}
        </text>

        {/* Particules décoratives — étoiles fines pour signature éditoriale */}
        <circle cx={56} cy={86} r={2.5} fill="var(--color-terracotta)" opacity="0.6" />
        <circle cx={W - 56} cy={H - 86} r={2.5} fill="var(--color-sage)" opacity="0.55" />
        <circle cx={W - 76} cy={66} r={2} fill="var(--color-primary)" opacity="0.6" />
        <circle cx={66} cy={H - 56} r={2} fill="var(--color-terracotta)" opacity="0.55" />
        <path
          d={`M ${W - 46} ${H / 2 - 104} l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z`}
          fill="var(--color-terracotta)"
          opacity="0.6"
        />
        <path
          d={`M 46 ${H / 2 + 104} l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z`}
          fill="var(--color-sage)"
          opacity="0.55"
        />
      </svg>

      {/* Animations CSS — fade-in stagger des satellites + pulse halo lent.
          Respecte `prefers-reduced-motion`. */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .ho-satellite {
            animation: ho-fade-in 700ms ease-out backwards;
          }
          .ho-ring-outer {
            animation: ho-ring-rotate 80s linear infinite;
            transform-origin: ${cx}px ${cy}px;
          }
          @keyframes ho-fade-in {
            from { opacity: 0; transform: scale(0.92); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes ho-ring-rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        }
      `}</style>
    </div>
  );
}
