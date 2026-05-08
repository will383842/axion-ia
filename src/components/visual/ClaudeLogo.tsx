// Logo Claude (Anthropic) — astérisque à 8 branches stylisé. SVG inline
// pour éviter une requête réseau supplémentaire et permettre le coloring
// via `currentColor` côté CSS.
//
// Marque externe : utilisé uniquement pour identifier la « Formation Claude »
// (Chat · Cowork · Code) — module 1 listing /interventions + dropdown header.
// Les couleurs Claude (peach Anthropic) sont appliquées via Tailwind
// arbitrary classes au call-site, pas hardcodées ici.

import * as React from "react";

interface ClaudeLogoProps {
  className?: string;
  /** aria-label si l'icône a une valeur sémantique. Si décoratif, laisser
   *  undefined et l'élément sera marqué `aria-hidden`. */
  ariaLabel?: string;
}

export function ClaudeLogo({ className, ariaLabel }: ClaudeLogoProps): React.ReactNode {
  const accessibility = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true as const };

  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      {...accessibility}
    >
      {/* Astérisque 8 branches — barres orthogonales + diagonales, 4 px d'épaisseur,
          coins arrondis. Visuellement reconnaissable comme la marque Anthropic. */}
      <g>
        <rect x="14" y="2" width="4" height="28" rx="2" />
        <rect x="2" y="14" width="28" height="4" rx="2" />
        <rect x="14" y="2" width="4" height="28" rx="2" transform="rotate(45 16 16)" />
        <rect x="14" y="2" width="4" height="28" rx="2" transform="rotate(-45 16 16)" />
      </g>
    </svg>
  );
}
