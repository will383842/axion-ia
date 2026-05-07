// Server Component — marques visuelles des 11 outils de la stack /stack-ia.
//
// Doctrine v2 (2026-05-07) : 11 marks dessinés à la main, harmonisés en fill
// solide `currentColor`. Pas de SVG officiels ni de press kits — choix
// éditorial AxionIA. Chaque mark suggère le caractère du brand sans copier
// son logo : on évite tout problème de propriété intellectuelle ET on garde
// une cohérence visuelle premium (toutes les marques ont le même grain).
//
// Référence visuelle : pages partenaires Linear / Anthropic / Stripe — qui
// utilisent souvent des marks éditoriaux unifiés plutôt que des logos
// hétérogènes pour les sections "stack technique recommandée".
//
// Construction commune : viewBox 24×24, fill="currentColor", stroke="none"
// par défaut. Padding interne ~3px. Stroke seulement pour les liaisons (n8n).
//
// Will, 2026-05-07 (v2 : harmonisation totale en fill solide).

import type { ReactNode, SVGProps } from "react";

export interface ToolLogoProps extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
  /** Identifiant outil — doit matcher un `id` de @/content/stack-ia STACK_TOOLS. */
  id: string;
  /** Si fourni, le SVG est exposé comme image accessible aux lecteurs d'écran. */
  label?: string;
}

// Base commune à tous les marks : viewBox normalisé, fill solide, no stroke.
const BASE: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "currentColor",
  stroke: "none",
};

type LogoRenderer = (svgProps: SVGProps<SVGSVGElement>) => ReactNode;

const LOGOS: Record<string, LogoRenderer> = {
  // 01 · Claude — asterisk 4-pointes filé (signature Anthropic).
  // 4 pétales radiales depuis le centre, doux aux extrémités.
  claude: (p) => (
    <svg {...BASE} {...p}>
      <path d="M12 1.5c.5 4.3 1.7 7 4.2 8.6s5.4 1.7 6.3 1.9c-.9.2-3.8.3-6.3 1.9s-3.7 4.3-4.2 8.6c-.5-4.3-1.7-7-4.2-8.6S2.4 12.2 1.5 12c.9-.2 3.8-.3 6.3-1.9s3.7-4.3 4.2-8.6Z" />
    </svg>
  ),

  // 02 · ChatGPT — fleur hexagonale 6-fold (signature OpenAI). 6 lobes
  // arrondis autour d'un noyau central.
  chatgpt: (p) => (
    <svg {...BASE} {...p}>
      <path
        d="M12 2c1.4 0 2.5 1.1 2.5 2.5 0 .3-.1.6-.2.9 1.2.2 2.2 1 2.7 2.1.3-.1.6-.2.9-.2 1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5c-.3 0-.6-.1-.9-.2-.5 1.1-1.5 1.9-2.7 2.1.1.3.2.6.2.9 0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5c0-.3.1-.6.2-.9-1.2-.2-2.2-1-2.7-2.1-.3.1-.6.2-.9.2C2.6 14.5 1.5 13.4 1.5 12s1.1-2.5 2.5-2.5c.3 0 .6.1.9.2.5-1.1 1.5-1.9 2.7-2.1-.1-.3-.2-.6-.2-.9C7.4 5.3 8.6 4.2 10 4.2c.7 0 1.4.3 1.9.7.4-.6 1.1-.9 1.9-.9 1.4 0 2.5 1.1 2.5 2.5 0 .3-.1.6-.2.9 1.2.2 2.2 1 2.7 2.1"
        opacity="0"
      />
      <circle cx="12" cy="12" r="3.2" />
      <ellipse cx="12" cy="4" rx="2.4" ry="1.7" />
      <ellipse cx="12" cy="20" rx="2.4" ry="1.7" />
      <ellipse cx="5.07" cy="8" rx="1.7" ry="2.4" transform="rotate(60 5.07 8)" />
      <ellipse cx="18.93" cy="8" rx="1.7" ry="2.4" transform="rotate(-60 18.93 8)" />
      <ellipse cx="5.07" cy="16" rx="1.7" ry="2.4" transform="rotate(-60 5.07 16)" />
      <ellipse cx="18.93" cy="16" rx="1.7" ry="2.4" transform="rotate(60 18.93 16)" />
    </svg>
  ),

  // 03 · Microsoft Copilot 365 — ruban infini (signature Copilot post-2024).
  // Deux gouttes entrelacées qui forment une boucle continue.
  "copilot-365": (p) => (
    <svg {...BASE} {...p}>
      <path
        d="M3.5 12c0-3 2-5.5 5-5.5 2.2 0 3.6 1.3 4.5 3l1.5 3c.7 1.4 1.6 2.5 3.5 2.5 1.4 0 2.5-1.1 2.5-2.5S19.4 10 18 10c-.5 0-.9.1-1.3.3l-1-2A5.5 5.5 0 0 1 18 8c2.5 0 4.5 2 4.5 4.5S20.5 17 18 17c-3.4 0-5.2-2.1-6.4-4.5L10 9.5C9.4 8.4 8.6 7.5 7 7.5 5.6 7.5 4.5 8.6 4.5 10S5.6 12.5 7 12.5c.5 0 1-.1 1.4-.4l1 2c-.7.4-1.5.6-2.4.6C4 14.7 1.5 12 1.5 9c0 0 0 0 0 0"
        opacity="0"
      />
      <path d="M6.5 6.5c2.4 0 4 1.4 5 3.2l1.6 3c.8 1.4 1.7 2.3 3.4 2.3 1.4 0 2.5-1.1 2.5-2.5S17.9 10 16.5 10c-.4 0-.8.1-1.1.2l-1-2c.6-.3 1.4-.5 2.1-.5 2.8 0 5 2.2 5 5s-2.2 5-5 5c-3.4 0-5.2-2-6.4-4.4l-1.6-3C7.9 9.2 7.2 8.5 6 8.5c-1.1 0-2 .9-2 2s.9 2 2 2c.4 0 .8-.1 1.1-.3l1 2c-.6.3-1.4.5-2.1.5-2.8 0-5-2.2-5-5s2.2-5 5-5Z" />
    </svg>
  ),

  // 04 · Granola — "G" stylisé en disque, ouverture latérale.
  // Lecture immédiate : G pour Granola.
  granola: (p) => (
    <svg {...BASE} {...p}>
      <path d="M12 2.5c5.2 0 9.5 4.3 9.5 9.5S17.2 21.5 12 21.5 2.5 17.2 2.5 12 6.8 2.5 12 2.5Zm0 3a6.5 6.5 0 1 0 5.6 9.8 6.5 6.5 0 0 0 .9-3.3v-1H12v2h4.4a4.5 4.5 0 1 1-1.2-4.7l1.4-1.4A6.5 6.5 0 0 0 12 5.5Z" />
    </svg>
  ),

  // 05 · Perplexity — losange-prisme (radial signature). Approche éditoriale
  // du mark Perplexity : 4 chevrons depuis le centre.
  perplexity: (p) => (
    <svg {...BASE} {...p}>
      <path d="M12 2 22 12l-10 10L2 12Zm0 3.4L5.4 12 12 18.6 18.6 12Zm0 3.5L8.9 12 12 15.1 15.1 12Z" />
    </svg>
  ),

  // 06 · Cursor — flèche de curseur Mac classique, géométrie épurée.
  cursor: (p) => (
    <svg {...BASE} {...p}>
      <path d="M5.5 2.8c-.4-.2-.9.1-.9.6v17.5c0 .5.6.7.9.4l4.5-4.4 2.6 5.7c.2.4.6.5.9.3l1.7-.8c.4-.2.5-.6.3-.9l-2.6-5.7 6.4-.8c.5-.1.6-.7.2-1Z" />
    </svg>
  ),

  // 07 · Claude Code — asterisk Claude entre chevrons CLI.
  // Variante "code" du mark Claude : noyau identique + symboles `<` `>`.
  "claude-code": (p) => (
    <svg {...BASE} {...p}>
      {/* Chevron gauche */}
      <path d="M5.4 6.5 1.7 11.4a1 1 0 0 0 0 1.2L5.4 17.5l1.5-1.1L3.7 12l3.2-4.4Z" />
      {/* Chevron droite */}
      <path d="M18.6 6.5l3.7 4.9a1 1 0 0 1 0 1.2L18.6 17.5l-1.5-1.1 3.2-4.4-3.2-4.4Z" />
      {/* Asterisk Claude au centre (réduit) */}
      <path d="M12 7c.3 2.6 1 4.2 2.5 5.2 1.5.9 3.2 1 3.7 1.1-.5.1-2.2.2-3.7 1.1-1.5.9-2.2 2.6-2.5 5.2-.3-2.6-1-4.2-2.5-5.2-1.5-.9-3.2-1-3.7-1.1.5-.1 2.2-.2 3.7-1.1S11.7 9.6 12 7Z" />
    </svg>
  ),

  // 08 · v0 — triangle plein (signature Vercel).
  v0: (p) => (
    <svg {...BASE} {...p}>
      <path d="M12 2.5 22.5 21H1.5Z" />
    </svg>
  ),

  // 09 · n8n — 3 nœuds connectés (workflow graph). Liaisons en stroke
  // épais pour visibilité, dots pleins.
  n8n: (p) => (
    <svg {...BASE} {...p}>
      {/* Liaisons (stroke en currentColor pour cohérence avec les nœuds) */}
      <path
        d="M5.5 12L11 8M5.5 12L11 16M13 8L18.5 12M13 16L18.5 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Nœuds */}
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="12" cy="7.5" r="2.5" />
      <circle cx="12" cy="16.5" r="2.5" />
      <circle cx="19" cy="12" r="2.5" />
    </svg>
  ),

  // 10 · Vercel AI SDK — triangle Vercel + sparkle au centre.
  // Différenciation visuelle vs `v0` : ajout de l'étincelle IA.
  "vercel-ai-sdk": (p) => (
    <svg {...BASE} {...p}>
      <path d="M12 2.5 22.5 21H1.5Z" opacity="0.22" />
      <path d="M12 8l1.1 3.1 3.1 1.1-3.1 1.1L12 16.4l-1.1-3.1-3.1-1.1 3.1-1.1Z" />
    </svg>
  ),

  // 11 · Midjourney — voilier signature : mât, voile, ligne de flottaison + vagues.
  midjourney: (p) => (
    <svg {...BASE} {...p}>
      {/* Voile principale (triangle plein) */}
      <path d="M12.5 3v12L19 15Z" />
      {/* Mât */}
      <rect x="11.7" y="3" width="0.8" height="14" rx="0.3" />
      {/* Ligne de flottaison (eau) */}
      <rect x="2" y="17.5" width="20" height="1.2" rx="0.6" />
      {/* Vagues sous la ligne */}
      <path
        d="M2 21c1.5-.8 3-.8 4.5 0M9 21c1.5-.8 3-.8 4.5 0M16 21c1.5-.8 3-.8 4.5 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
};

/**
 * Marque visuelle d'un outil de la stack. Tinte avec `currentColor`,
 * donc utilise les classes Tailwind `text-terracotta`, `text-primary`, etc.
 *
 * @example
 * <ToolLogo id="claude" className="h-6 w-6 text-terracotta" />
 */
export function ToolLogo({ id, label, className, ...rest }: ToolLogoProps): ReactNode {
  const renderer = LOGOS[id];
  if (!renderer) return null;
  const aria = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": "true" as const };
  return renderer({ className, ...aria, ...rest });
}
