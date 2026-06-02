/**
 * ImplementationHero — Hero 2 colonnes du module Implémentation IA.
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.739-851). Réutilisé par la
 * page hub `/fr/implementation` ET les ~430 pages ville
 * `/fr/implantations/{region}/{ville}/implementations` (Phase 5). Quand
 * `villeContext` est fourni, le H1 interpole le nom de ville. Émet une
 * SpeakableSpecification ciblée hero + sous-titre (AEO 2026).
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ImplementationHeroSchema } from "@/components/sections/ImplementationHeroSchema";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import type { VilleContext } from "@/components/services/types";

export interface ImplementationHeroProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function ImplementationHero({ isFr, villeContext }: ImplementationHeroProps): ReactNode {
  const loc: "fr" | "en" = isFr ? "fr" : "en";
  const startupAmount = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
    loc,
    { compact: true },
  );

  // 8 nœuds satellites — 1 par fonction métier (ordre = disposition horaire SVG).
  const heroNodes = isFr
    ? [
        { label: "Ventes", benefit: "+ CA, − coût", accent: "primary" as const },
        { label: "Service client", benefit: "Réponse 24/7", accent: "terracotta" as const },
        { label: "Marketing", benefit: "Visibilité 10×", accent: "terracotta" as const },
        { label: "Données", benefit: "Décisions claires", accent: "primary" as const },
        { label: "Métier", benefit: "Chiffrer en 30 s", accent: "terracotta" as const },
        { label: "Admin", benefit: "Zéro saisie", accent: "sage" as const },
        { label: "RH", benefit: "Recruter 5× +", accent: "mocha" as const },
        { label: "Com' interne", benefit: "Équipes alignées", accent: "sage" as const },
      ]
    : [
        { label: "Sales", benefit: "+ revenue, − cost", accent: "primary" as const },
        { label: "Customer service", benefit: "24/7 answers", accent: "terracotta" as const },
        { label: "Marketing", benefit: "10× visibility", accent: "terracotta" as const },
        { label: "Data", benefit: "Clear decisions", accent: "primary" as const },
        { label: "Operations", benefit: "Quote in 30 s", accent: "terracotta" as const },
        { label: "Back-office", benefit: "Zero data entry", accent: "sage" as const },
        { label: "HR", benefit: "5× faster hiring", accent: "mocha" as const },
        { label: "Internal comms", benefit: "Aligned teams", accent: "sage" as const },
      ];

  // H1 ville-aware vs canonique.
  const titleMain = villeContext
    ? isFr
      ? `Implémentation IA à ${villeContext.name}`
      : `AI implementation in ${villeContext.name}`
    : isFr
      ? "On implémente l'IA dans votre entreprise,"
      : "We implement AI across your company,";

  const titleEm = villeContext
    ? isFr
      ? `& région ${villeContext.region}`
      : `& ${villeContext.region} region`
    : isFr
      ? "quel que soit votre besoin."
      : "whatever you need.";

  const description = villeContext
    ? isFr
      ? `Cabinet IA & automatisation au service des entreprises de ${villeContext.name} et sa région. Forfait fixe à partir de ${startupAmount}, livraison en 2 à 6 semaines. Vous payez une fois, c'est à vous — pas d'abonnement mensuel.`
      : `AI & automation consultancy serving ${villeContext.name}-area companies. Fixed fee from ${startupAmount}, delivery in 2 to 6 weeks. You pay once, it's yours — no monthly subscription.`
    : isFr
      ? `Chatbots, agents IA, automatisations, intégrations à vos outils… on conçoit et on livre la solution adaptée à votre métier. Le code est à vous, sans abonnement.`
      : `Chatbots, AI agents, automations, integrations with your tools… we design and ship the solution that fits your business. The code is yours, no subscription.`;

  // Speakable AEO 2026 — h1 + sous-titre.
  const speakableSelectors = ["h1", "h1 + p", "[data-hero-description]"] as const;
  const speakableJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPageElement",
    speakable: buildSpeakableSpecification({ selectors: [...speakableSelectors] }),
  } as const;

  return (
    <>
      <section className="bg-halo-warm text-fg relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            opacity: 0.18,
          }}
        />

        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-2xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Module 3 · Implémentation IA" : "Module 3 · AI implementation"}
              </p>

              <h1 className="display-editorial text-fg mt-5">
                {titleMain}{" "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {titleEm}
                </span>
              </h1>

              <p
                data-hero-description
                className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
              >
                {description}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="/contact" size="lg" track="impl-hero-primary">
                  {isFr ? "Décrire mon besoin · réponse 48 h" : "Describe my need · 48 h reply"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/audit" variant="outline" size="lg" track="impl-hero-audit">
                  {isFr ? "Commencer par un audit" : "Start with an audit"}
                </Cta>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:mx-0 lg:max-w-none">
              {/* Mobile / tablette < lg : grid compact 2×4 — le SVG 8 satellites
                  serait illisible sous 1024 px. Même contenu, autre densité. */}
              <ul
                aria-label={
                  isFr
                    ? "Les 8 fonctions automatisables et leur gain"
                    : "The 8 automatable functions and their gain"
                }
                className="grid grid-cols-2 gap-3 sm:gap-4 lg:hidden"
              >
                {heroNodes.map((node) => {
                  const accentBg: Record<typeof node.accent, string> = {
                    terracotta: "bg-terracotta-soft border-terracotta/30",
                    primary: "bg-primary-soft border-primary/30",
                    sage: "bg-sage-soft border-sage/30",
                    mocha: "bg-sand border-mocha-fg/15",
                  };
                  const accentDot: Record<typeof node.accent, string> = {
                    terracotta: "bg-terracotta",
                    primary: "bg-primary",
                    sage: "bg-sage",
                    mocha: "bg-mocha",
                  };
                  return (
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
                  );
                })}
              </ul>

              {/* Desktop ≥ lg : schéma SVG riche (entreprise + 8 satellites). */}
              <ImplementationHeroSchema
                className="hero-schema pointer-events-none hidden lg:block"
                centerLabel={isFr ? "Votre entreprise" : "Your company"}
                ariaLabel={
                  isFr
                    ? "Schéma : votre entreprise au centre, entourée des 8 fonctions automatisables (ventes, service client, marketing, données, métier, admin, RH, communication interne) avec leur gain concret."
                    : "Diagram: your company at the center, surrounded by 8 automatable functions (sales, customer service, marketing, data, operations, back-office, HR, internal comms) with their concrete gain."
                }
                nodes={heroNodes}
              />
            </div>
          </div>
        </Container>
      </section>
      <JsonLd
        data={speakableJsonLd}
        strategy="afterInteractive"
        scriptId={
          villeContext
            ? `jsonld-impl-hero-speakable-${villeContext.villeSlug}`
            : "jsonld-impl-hero-speakable"
        }
      />
    </>
  );
}
