// Composant Heading SSOT — audit perfection SEO 2026-05-12.
//
// Centralise les classes typographiques + le tag sémantique H1-H6 pour TOUTE
// l'app. Avant ce composant, ~124 occurrences raw `<h1 class="...">` étaient
// éparpillées dans 35+ fichiers, dupliquant la classe `display-editorial` ou
// des clamps ad-hoc.
//
// 3 variants couvrent 95 % des usages éditoriaux :
//   - "display" : H1 hero éditorial (Fraunces serif, clamp 2.5-4 rem)
//   - "section" : H2/H3 de section (sans-serif, semibold, tracking-tight)
//   - "sub"     : H3/H4 de card / accordion / sub-section (16-18px semibold)
//
// Le `level` (sémantique) et `variant` (visuel) sont DÉCOUPLÉS — un H2 peut
// avoir un visuel "display" (rare), un H1 peut avoir un visuel "section"
// (jamais en pratique, mais possible). C'est volontaire : la hiérarchie
// sémantique HTML pour le SEO ne dépend PAS de l'apparence.

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingVariant = "display" | "section" | "sub";

interface HeadingProps extends Omit<ComponentPropsWithoutRef<"h1">, "color"> {
  /** Tag HTML rendu — détermine la hiérarchie SEO (1 seul H1 par page). */
  level: HeadingLevel;
  /** Visuel : display (hero éditorial Fraunces), section (sans-serif tight),
   *  sub (sous-titre semibold compact). Par défaut, "section". */
  variant?: HeadingVariant;
  children: React.ReactNode;
}

const variantClasses: Record<HeadingVariant, string> = {
  // display-editorial classe globale définie dans globals.css — sert
  // d'unique SSOT pour le hero (Fraunces + clamp 2.5-4rem + tracking-tight).
  display: "display-editorial text-fg",
  // section : H2/H3 de page — texte du bloc Section.tsx (déjà 38 import sites).
  section: "text-fg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl",
  // sub : titre de card / accordion / sub-section — match grilles bénéfices.
  sub: "text-fg text-lg font-semibold leading-snug",
};

export function Heading({
  level,
  variant = "section",
  className,
  children,
  ...rest
}: HeadingProps) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return (
    <Tag className={cn(variantClasses[variant], className)} {...rest}>
      {children}
    </Tag>
  );
}
