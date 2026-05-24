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
  /** Label central du schéma SVG (ex "Votre entreprise", "Votre équipe"). */
  schemaCenterLabel: string;
  /** 8 satellites du schéma — un par fonction/objectif du service. */
  schemaNodes: ReadonlyArray<ServiceHeroNode>;
  /** aria-label complet pour le schéma SVG (a11y). */
  schemaAriaLabel: string;
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
  schemaCenterLabel,
  schemaNodes,
  schemaAriaLabel,
}: ServiceHeroProps): ReactNode {
  return (
    <section className="bg-paper relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32">
      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
          {/* Colonne gauche — eyebrow + h1 + description + CTAs */}
          <div className="max-w-xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {eyebrow}
            </p>

            <h1 className="display-editorial text-fg mt-5">
              {title}{" "}
              <span
                className="text-terracotta mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {titleEm}
              </span>
            </h1>

            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {description}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">{ctas}</div>
          </div>

          {/* Colonne droite — schéma SVG (desktop) + grid satellites (mobile/tablet) */}
          <div className="relative mx-auto w-full max-w-2xl lg:mx-0 lg:max-w-none">
            {/* Mobile / tablette < lg : grid compact 2×4. Même contenu que SVG,
                meilleure densité lisible sur petit écran. */}
            <ul aria-label={schemaAriaLabel} className="grid grid-cols-2 gap-3 sm:gap-4 lg:hidden">
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

            {/* Desktop ≥ lg : schéma SVG circulaire. Réutilise le composant
                /implementation existant (decoration + 8 satellites orbitaux). */}
            <ImplementationHeroSchema
              className="hero-schema pointer-events-none hidden lg:block"
              centerLabel={schemaCenterLabel}
              ariaLabel={schemaAriaLabel}
              nodes={schemaNodes}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
