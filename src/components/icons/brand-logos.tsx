// Brand logos — 8 marques IA enseignées dans les formations Axion-IA.
//
// Sprint Matrice hero 2026-05-28 (Will). Composants React SVG inline pour
// éliminer toute requête réseau (0 network call, rendu Server Component).
// Tous monochrome `currentColor` pour héritage de la palette terracotta/sand
// d'Axion-IA. Les marques sont représentées par des glyphes minimalistes
// **inspirés** des logos officiels (pas de copie 1:1) — usage éditorial en
// contexte formation, démarche pédagogique.
//
// viewBox uniforme 24×24, line stroke 1.6, hauteur 100% du parent.

import type { SVGProps } from "react";

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ChatGPTIcon(props: SVGProps<SVGSVGElement>) {
  // 4-pointed knot — référence au logo OpenAI (spirale interlinkée).
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 4 L18 8 L18 16 L12 20 L6 16 L6 8 Z" />
      <path d="M12 4 L12 12 L18 16" />
      <path d="M6 8 L12 12 L18 8" />
      <path d="M6 16 L12 12 L12 20" />
    </svg>
  );
}

export function ClaudeIcon(props: SVGProps<SVGSVGElement>) {
  // 4-branche sparkle asymétrique — signature Anthropic.
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 L13.2 10.5 L20 12 L13.2 13.5 L12 21 L10.8 13.5 L4 12 L10.8 10.5 Z" />
    </svg>
  );
}

export function MistralIcon(props: SVGProps<SVGSVGElement>) {
  // « M » avec lignes de vent — référence à mistral (vent + lettre).
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 18 L4 7 L8 13 L12 7 L12 18" />
      <path d="M15 9 L20 9" />
      <path d="M15 13 L18 13" />
      <path d="M15 17 L20 17" />
    </svg>
  );
}

export function CopilotIcon(props: SVGProps<SVGSVGElement>) {
  // 4 arcs entrelacés en forme de fleur — référence Microsoft Copilot.
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 4 C8 4 4 8 4 12" />
      <path d="M12 4 C16 4 20 8 20 12" />
      <path d="M12 20 C8 20 4 16 4 12" />
      <path d="M12 20 C16 20 20 16 20 12" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function PerplexityIcon(props: SVGProps<SVGSVGElement>) {
  // 8 rayons radiaux — réf au glyph cosmique Perplexity.
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4 L12 7" />
      <path d="M12 17 L12 20" />
      <path d="M4 12 L7 12" />
      <path d="M17 12 L20 12" />
      <path d="M6.3 6.3 L8.5 8.5" />
      <path d="M15.5 15.5 L17.7 17.7" />
      <path d="M17.7 6.3 L15.5 8.5" />
      <path d="M8.5 15.5 L6.3 17.7" />
    </svg>
  );
}

export function MidjourneyIcon(props: SVGProps<SVGSVGElement>) {
  // Voilier minimaliste — réf au logo Midjourney (3 voiles).
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 4 L12 16" />
      <path d="M12 6 L18 14 L12 14 Z" />
      <path d="M12 6 L6 14 L12 14 Z" />
      <path d="M4 18 L20 18" />
      <path d="M6 18 L8 20 L16 20 L18 18" />
    </svg>
  );
}

export function SoraIcon(props: SVGProps<SVGSVGElement>) {
  // Étoile à 4 branches avec ligne de mouvement — réf Sora (vidéo IA).
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 4 L13 11 L20 12 L13 13 L12 20 L11 13 L4 12 L11 11 Z" />
    </svg>
  );
}

export function HeyGenIcon(props: SVGProps<SVGSVGElement>) {
  // « H » stylisé avec barre courbe — réf HeyGen (avatars).
  return (
    <svg {...baseProps} {...props}>
      <path d="M6 4 L6 20" />
      <path d="M18 4 L18 20" />
      <path d="M6 12 Q12 9 18 12" />
      <circle cx="12" cy="6" r="1.5" />
    </svg>
  );
}

// Registre indexé par slug pour usage dans HeroMatrix (boucle map).
export const BRAND_LOGO_BY_SLUG = {
  chatgpt: ChatGPTIcon,
  claude: ClaudeIcon,
  mistral: MistralIcon,
  copilot: CopilotIcon,
  perplexity: PerplexityIcon,
  midjourney: MidjourneyIcon,
  sora: SoraIcon,
  heygen: HeyGenIcon,
} as const;

export type BrandLogoSlug = keyof typeof BRAND_LOGO_BY_SLUG;
