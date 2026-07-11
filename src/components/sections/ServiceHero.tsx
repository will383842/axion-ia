// Server Component — Hero 2 colonnes uniforme pour les pages services
// (interventions/collectives, audit, un-a-un, codage-developpement).
//
// Sprint Uniformisation héros 2026-05-24 (Will). Calqué sur le pattern de
// /implementation/page.tsx (commit 6dab6155) qui était l'unique page services
// avec un hero 2-col + schéma SVG circulaire. Ce composant industrialise le
// pattern pour qu'il soit réutilisable sur les 4 autres pages services.
//
// Structure visuelle :
//   Desktop (≥ lg) : grille 1fr/1fr, texte à gauche, ImplementationHeroSchema à droite
//   Mobile (< lg)  : empilé, texte + grid 2×4 satellites compact (pas de SVG car illisible)
//
// Le schéma SVG est décoratif (ariaLabel descriptif) — pas d'impact a11y si
// caché sur mobile.

import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { ImplementationHeroSchema } from "./ImplementationHeroSchema";

type Accent = "terracotta" | "primary" | "sage" | "mocha";

export interface ServiceHeroNode {
  label: string;
  benefit: string;
  accent: Accent;
}

export interface ServiceHeroProps {
  /** Eyebrow (ex "Module 2 · Audit IA"). Affiché en haut, petite caps. */
  eyebrow: string;
  /** Titre H1 — partie en serif normale (avant l'italique). */
  title: string;
  /** Partie italique du H1 (rendue en serif terracotta italique). */
  titleEm: string;
  /** Description sous le H1 — 1-3 phrases. */
  description: string;
  /** CTAs (1-2 boutons) — passés en ReactNode pour flexibilité. */
  ctas: ReactNode;
  /**
   * Visuel custom à afficher dans la colonne droite (image, illustration,
   * autre SVG, etc.). Si fourni, OVERRIDE le schéma orbital par défaut.
   *
   * Exemple — image custom par page :
   *   customVisual={
   *     <Image
   *       src="/illustrations/tarifs-hero.avif"
   *       alt="Catalogue tarifaire Axion-IA"
   *       width={560} height={560}
   *       priority
   *       className="rounded-2xl"
   *     />
   *   }
   *
   * Quand omis, le schéma orbital `ImplementationHeroSchema` est utilisé
   * (nécessite alors les 3 props `schema*` ci-dessous).
   */
  customVisual?: ReactNode;
  /**
   * Label central du schéma SVG (ex "Votre entreprise", "Votre équipe").
   * Requis SI `customVisual` est omis.
   */
  schemaCenterLabel?: string;
  /**
   * 8 satellites du schéma orbital — un par fonction/objectif du service.
   * Requis SI `customVisual` est omis.
   */
  schemaNodes?: ReadonlyArray<ServiceHeroNode>;
  /**
   * aria-label complet pour le schéma SVG (a11y).
   * Requis SI `customVisual` est omis.
   */
  schemaAriaLabel?: string;
}

const accentBg: Record<Accent, string> = {
  terracotta: "bg-terracotta-soft border-terracotta/30",
  primary: "bg-primary-soft border-primary/30",
  sage: "bg-sage-soft border-sage/30",
  mocha: "bg-sand border-mocha-fg/15",
};

const accentDot: Record<Accent, string> = {
  terracotta: "bg-terracotta",
  primary: "bg-primary",
  sage: "bg-sage",
  mocha: "bg-mocha",
};

export function ServiceHero({
  eyebrow,
  title,
  titleEm,
  description,
  ctas,
  customVisual,
  schemaCenterLabel,
  schemaNodes,
  schemaAriaLabel,
}: ServiceHeroProps): ReactNode {
  // Garde-fou : il faut soit un customVisual, soit les 3 props schema*.
  // En dev, on warn pour aider à diagnostiquer. En prod, on rend rien (pas
  // de crash, juste pas de visuel à droite — graceful degradation).
  const hasSchema = schemaCenterLabel != null && schemaNodes != null && schemaAriaLabel != null;

  return (
    <section className="bg-paper relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32">
      <Container className="relative">
        {/* Eyebrow → pastille centrée sur la page, au-dessus de la grille 2 col. */}
        {eyebrow ? (
          <HeroBadge className="mb-10 sm:mb-12">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            {eyebrow}
          </HeroBadge>
        ) : null}
        {/* Layout centré (Will 2026-07-11) : texte centré, visuel EN DESSOUS. */}
        <div className="flex flex-col items-center gap-12 lg:gap-14 xl:gap-16">
          {/* Bloc texte centré — h1 + description + CTAs */}
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="display-editorial text-fg">
              {title}{" "}
              <span
                className="text-terracotta mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {titleEm}
              </span>
            </h1>

            <p className="text-fg-soft mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {description}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{ctas}</div>
          </div>

          {/* Visuel sous le texte — customVisual prioritaire, sinon schéma orbital */}
          <div className="relative mx-auto w-full max-w-[36rem]">
            {customVisual ? (
              customVisual
            ) : hasSchema ? (
              <>
                {/* Mobile / tablette < lg : grid compact 2×4. Même contenu que SVG. */}
                <ul
                  aria-label={schemaAriaLabel}
                  className="grid grid-cols-2 gap-3 sm:gap-4 lg:hidden"
                >
                  {schemaNodes.map((node) => (
                    <li
                      key={node.label}
                      className={`flex flex-col gap-1.5 rounded-xl border p-4 ${accentBg[node.accent]}`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`inline-block h-2 w-2 rounded-full ${accentDot[node.accent]}`}
                        />
                        <span className="text-fg text-sm leading-tight font-semibold">
                          {node.label}
                        </span>
                      </span>
                      <span className="text-fg-soft text-[13px] leading-snug">{node.benefit}</span>
                    </li>
                  ))}
                </ul>

                {/* Desktop ≥ lg : schéma SVG circulaire. */}
                <ImplementationHeroSchema
                  className="hero-schema pointer-events-none hidden lg:block"
                  centerLabel={schemaCenterLabel}
                  ariaLabel={schemaAriaLabel}
                  nodes={schemaNodes}
                />
              </>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
