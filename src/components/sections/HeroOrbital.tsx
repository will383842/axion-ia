// Hero orbital v2 — version travaillée du schéma orbital pour la page hub
// /interventions/collectives. Sprint 2026-05-28 (Will).
//
// Différences vs `ImplementationHeroSchema` (orbital générique) :
//  - Glyphes brand SVG inline dans chaque satellite (ChatGPT, Claude, Mistral,
//    Copilot, Perplexity, Midjourney, Sora, HeyGen) au lieu de dots colorés.
//  - Plus de profondeur visuelle : gradients radiaux sur les satellites, ombre
//    portée subtile, anneau supplémentaire de raffinement.
//  - Typo serif italique sur les labels d'outils (cohérent identité Axion-IA
//    éditoriale).
//
// viewBox 560×560 + `overflow:visible` + classe `.hero-schema` — aligné sur
// ImplementationHeroSchema pour une taille/enveloppe IDENTIQUES (fix « cadre »
// + parité de taille, 2026-06-02). Les labels qui dépassent l'horizontale sont
// peints hors viewBox grâce à overflow:visible (plus besoin du viewBox élargi).
//
// Harmonisation visuelle v4.1 (2026-06-02) : mêmes anneaux gyroscopiques,
// connecteurs courbes à dégradé + marqueurs, anneau gradué et centre
// multi-couches que les autres service heros — seuls les satellites diffèrent
// (logos d'outils IA au lieu de dots/sphères concept).
//
// Composant pur SVG inline (0 network call, 0 JS), Server Component.
// Pas d'animations CSS (les rotations CSS sur SVG ellipse via transform-origin
// ont des comportements aléatoires cross-browser et débordaient). CLS = 0.

import type { ReactNode } from "react";
// Sprint logos brand 2026-05-28 (Will) — utilise les vrais logos SVG officiels
// pour 5 marques via `simple-icons` (CC0 1.0, licence libre pour usage
// commercial éditorial). Les 3 manquantes (ChatGPT/OpenAI, Midjourney, Sora,
// HeyGen) tombent en fallback sur des glyphes minimalistes stroke-based —
// simple-icons ne contient pas ces logos (OpenAI retiré pour copyright,
// Midjourney/Sora/HeyGen pas encore indexés).
import { siClaude, siMistralai, siPerplexity, siGithubcopilot } from "simple-icons";

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

// Brand glyphs — mix logos officiels simple-icons (fill mode, paths solides)
// + glyphes fallback minimalistes (stroke mode, paths filaires) pour les 4
// marques absentes du registre simple-icons.
const BRAND_LOGOS: Record<ToolNode["slug"], { path: string; mode: "fill" | "stroke" }> = {
  // simple-icons (vrais logos officiels)
  claude: { path: siClaude.path, mode: "fill" },
  mistral: { path: siMistralai.path, mode: "fill" },
  perplexity: { path: siPerplexity.path, mode: "fill" },
  // GitHub Copilot comme proxy visuel pour Microsoft Copilot (simple-icons
  // n'indexe pas Microsoft Copilot directement, mais le glyphe Copilot est
  // visuellement identique sur les 2 produits depuis 2024).
  copilot: { path: siGithubcopilot.path, mode: "fill" },
  // Fallbacks stroke-based pour les marques non indexées par simple-icons.
  // À migrer vers simple-icons si/quand elles sont ajoutées au registre.
  chatgpt: {
    path: "M12 4 L18 8 L18 16 L12 20 L6 16 L6 8 Z M12 4 L12 12 L18 16 M6 8 L12 12 L18 8 M6 16 L12 12 L12 20",
    mode: "stroke",
  },
  midjourney: {
    path: "M12 4 L12 16 M12 6 L18 14 L12 14 Z M12 6 L6 14 L12 14 Z M4 18 L20 18 M6 18 L8 20 L16 20 L18 18",
    mode: "stroke",
  },
  sora: {
    path: "M12 4 L13 11 L20 12 L13 13 L12 20 L11 13 L4 12 L11 11 Z",
    mode: "stroke",
  },
  heygen: {
    path: "M6 4 L6 20 M18 4 L18 20 M6 12 Q12 9 18 12",
    mode: "stroke",
  },
};

const ACCENTS: readonly Accent[] = ["terracotta", "primary", "sage", "mocha"];

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
  // Canvas carré 560×560 — aligné sur ImplementationHeroSchema pour une taille
  // affichée IDENTIQUE entre tous les service heros (un-a-un / audit / implem /
  // collectives). Les labels qui dépassent à droite/gauche sont gérés par
  // `overflow:visible` (le viewBox élargi 720×600 d'avant n'est plus nécessaire).
  const W = 560;
  const H = 560;
  const cx = W / 2;
  const cy = H / 2;
  const rx = 195;
  const ry = 180;

  // 8 angles répartis sens horaire depuis le haut, écartés pour minimiser
  // les collisions visuelles entre satellites + leurs labels.
  const angles = [-90, -45, 0, 45, 90, 135, 180, -135];

  // Ticks de l'anneau de précision (tous les 15°) — cohérence v4.1.
  const tickAngles = Array.from({ length: 24 }, (_, i) => i * 15);

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

          {/* Dégradé radial des connecteurs : faible au centre, vif au nœud.
              userSpaceOnUse → s'aligne quel que soit l'angle. (cohérence v4.1) */}
          {ACCENTS.map((a) => (
            <radialGradient
              key={`ho-spoke-${a}`}
              id={`ho-spoke-${a}`}
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
          <linearGradient id="ho-orbit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.04" />
            <stop offset="50%" stopColor="var(--color-terracotta)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0.04" />
          </linearGradient>

          {/* Sheen + base du centre (cohérence v4.1). */}
          <radialGradient id="ho-center-sheen" cx="42%" cy="36%" r="68%">
            <stop offset="0%" stopColor="white" stopOpacity="0.85" />
            <stop offset="55%" stopColor="var(--color-paper)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-paper)" stopOpacity="0" />
          </radialGradient>

          {/* Ombre portée du centre. */}
          <filter id="ho-center-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="14"
              floodColor="#3a2a22"
              floodOpacity="0.18"
            />
          </filter>
        </defs>

        {/* Background grille avec masque vignette */}
        <rect width={W} height={H} fill="url(#ho-grid)" mask="url(#ho-vignette)" />

        {/* 3 halos atmosphériques superposés */}
        <circle cx={cx} cy={cy} r={380} fill="url(#ho-halo-tc)" />
        <circle cx={W - 80} cy={110} r={200} fill="url(#ho-halo-pr)" />
        <circle cx={80} cy={H - 100} r={190} fill="url(#ho-halo-sg)" />

        {/* Anneaux gyroscopiques inclinés — profondeur d'un système en orbite */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 16}
          ry={74}
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
          ry={74}
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
          ry={112}
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
          rx={rx + 56}
          ry={ry + 56}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.15"
          strokeDasharray="2 10"
          fill="none"
        />

        {/* Anneau de précision gradué — ticks tous les 15°, longs aux nœuds */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke="url(#ho-orbit)"
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
          rx={rx - 76}
          ry={ry - 72}
          stroke="var(--color-border-strong)"
          strokeOpacity="0.26"
          fill="none"
        />

        {/* Connecteurs courbes centre → satellites (dégradé radial + marqueur) */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          const mx = (cx + pos.x) / 2;
          const my = (cy + pos.y) / 2;
          const dxv = pos.x - cx;
          const dyv = pos.y - cy;
          const len = Math.hypot(dxv, dyv) || 1;
          const bow = 18;
          const ctrlX = mx + (-dyv / len) * bow;
          const ctrlY = my + (dxv / len) * bow;
          const t = 0.62;
          const mt = 1 - t;
          const markX = mt * mt * cx + 2 * mt * t * ctrlX + t * t * pos.x;
          const markY = mt * mt * cy + 2 * mt * t * ctrlY + t * t * pos.y;
          return (
            <g key={`line-${idx}`}>
              <path
                d={`M ${cx} ${cy} Q ${ctrlX} ${ctrlY} ${pos.x} ${pos.y}`}
                fill="none"
                stroke={`url(#ho-spoke-${node.accent})`}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
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

        {/* Satellites — 8 outils IA avec leur glyph brand */}
        {nodes.map((node, idx) => {
          const angle = angles[idx] ?? 0;
          const pos = ellipsePos(angle, rx, ry, cx, cy);
          const layout = labelLayout(angle);
          const accent = accentColor[node.accent];
          const logo = BRAND_LOGOS[node.slug];

          return (
            <g key={`sat-${idx}`}>
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
              {/* Logo brand au centre du disque — fill mode pour simple-icons
                  (paths solides 24×24), stroke mode pour les glyphes
                  fallback (paths filaires). Tous positionnés via translate
                  pour centrer le viewBox 24×24 sur (pos.x, pos.y). */}
              {logo.mode === "fill" ? (
                <g transform={`translate(${pos.x - 12} ${pos.y - 12})`}>
                  <path d={logo.path} fill={accent} />
                </g>
              ) : (
                <g
                  transform={`translate(${pos.x - 12} ${pos.y - 12})`}
                  stroke={accent}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                >
                  <path d={logo.path} />
                </g>
              )}
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

        {/* Centre — votre équipe (sujet du schéma), multi-couches */}
        <g filter="url(#ho-center-shadow)">
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
          {/* Disque de base (gradient paper → sand) */}
          <circle cx={cx} cy={cy} r={78} fill="url(#ho-satellite-bg)" />
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
        <circle cx={cx} cy={cy} r={78} fill="url(#ho-center-sheen)" />
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
          y={cy - 8}
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
    </div>
  );
}
