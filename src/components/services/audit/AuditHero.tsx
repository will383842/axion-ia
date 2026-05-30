/**
 * AuditHero — Hero 2 colonnes du module Audit IA (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis `src/app/[locale]/audit/page.tsx`
 * (l.141-216). Réutilisé par la page hub `/fr/audit` ET les 430 pages ville
 * `/fr/implantations/{region}/{ville}/audits` (Phase 5). Quand `villeContext`
 * est fourni, le H1 interpole le nom de ville. Émet une SpeakableSpecification
 * inline ciblée sur le H1 + sous-titre du hero.
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import type { VilleContext } from "@/components/services/types";

export interface AuditHeroProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function AuditHero({ isFr, villeContext }: AuditHeroProps): ReactNode {
  // H1 ville-aware vs canonique.
  const title = villeContext
    ? isFr
      ? `Audit IA à ${villeContext.name}`
      : `AI Audit in ${villeContext.name}`
    : isFr
      ? "Audit IA"
      : "AI Audit";

  const titleEm = villeContext
    ? isFr
      ? `& région ${villeContext.region}`
      : `& ${villeContext.region} region`
    : isFr
      ? "en entreprise"
      : "for your company";

  const description = villeContext
    ? isFr
      ? `Le diagnostic qui fait passer votre entreprise à l'IA, à ${villeContext.name} et sa région. On cartographie votre activité de fond en comble, on repère partout où l'IA peut vous faire gagner du temps et de l'argent — et vous repartez avec un plan d'action chiffré et priorisé. Des premières automatisations rentables dès les premières semaines.`
      : `The diagnosis that moves your ${villeContext.name}-area company to AI. We map your whole activity, spot everywhere AI can save you time and money — and you leave with a costed, prioritised action plan. First profitable automations within the first weeks.`
    : isFr
      ? `Le diagnostic qui fait passer votre entreprise à l'IA : on repère où elle vous fait gagner du temps et de l'argent. Vous repartez avec un plan d'action chiffré — et des gains dès les premières semaines.`
      : `The diagnosis that moves your company to AI: we spot where it saves you time and money. You leave with a costed action plan — and gains within the first weeks.`;

  // Speakable AEO 2026 — ciblage h1 + premier paragraphe du hero.
  // Émis en standalone WebPageElement pour Google Assistant / Alexa / ChatGPT voice.
  const speakableSelectors = ["h1", "h1 + p", "[data-hero-description]"] as const;
  const speakableJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPageElement",
    speakable: buildSpeakableSpecification({ selectors: [...speakableSelectors] }),
  } as const;

  return (
    <>
      <ServiceHero
        eyebrow={isFr ? "Module 2 · Audit IA · 4 niveaux" : "Module 2 · AI Audit · 4 levels"}
        title={title}
        titleEm={titleEm}
        description={description}
        ctas={
          // Règle CTA brief §1 : Primary « Réserver un appel » (/appel) +
          // Secondary « Nous écrire » (/contact). Aligné formations / 1-to-1.
          <>
            <Cta
              href="/appel"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track="audit-hero-book-call"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              className="bg-paper text-terracotta hover:bg-paper border-terracotta-deep shadow-subtle border-2"
              track="audit-hero-contact"
            >
              {isFr ? "Nous écrire" : "Email us"}
            </Cta>
          </>
        }
        schemaCenterLabel={isFr ? "Votre entreprise" : "Your company"}
        schemaAriaLabel={
          isFr
            ? "Schéma : votre entreprise au centre, entourée des 8 fonctions à auditer pour identifier les opportunités IA (commercial, marketing, RH, finance, opérations, IT, service client, direction)."
            : "Diagram: your company at the center, surrounded by 8 functions to audit for AI opportunities (sales, marketing, HR, finance, operations, IT, customer service, leadership)."
        }
        schemaNodes={[
          {
            label: isFr ? "Commercial" : "Sales",
            benefit: isFr ? "Leads, propositions" : "Leads, proposals",
            accent: "terracotta",
          },
          {
            label: "Marketing",
            benefit: isFr ? "Contenu, SEO, social" : "Content, SEO, social",
            accent: "primary",
          },
          {
            label: "RH",
            benefit: isFr ? "Recrutement, onboarding" : "Recruitment, onboarding",
            accent: "sage",
          },
          {
            label: "Finance",
            benefit: isFr ? "Factures, reporting" : "Invoices, reporting",
            accent: "mocha",
          },
          {
            label: isFr ? "Opérations" : "Operations",
            benefit: isFr ? "Process, qualité" : "Process, quality",
            accent: "terracotta",
          },
          {
            label: "IT",
            benefit: isFr ? "Support, déploiement" : "Support, deployment",
            accent: "primary",
          },
          {
            label: isFr ? "Service client" : "Customer service",
            benefit: isFr ? "Tickets, chatbot" : "Tickets, chatbot",
            accent: "sage",
          },
          {
            label: isFr ? "Direction" : "Leadership",
            benefit: isFr ? "Décision, vision" : "Decision, vision",
            accent: "mocha",
          },
        ]}
      />
      <JsonLd
        data={speakableJsonLd}
        strategy="afterInteractive"
        scriptId={
          villeContext
            ? `jsonld-audit-hero-speakable-${villeContext.villeSlug}`
            : "jsonld-audit-hero-speakable"
        }
      />
    </>
  );
}
