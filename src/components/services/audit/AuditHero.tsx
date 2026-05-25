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
import { Calendar, Mail } from "lucide-react";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import { AUDIT_TIERS, formatAmount, getTierById } from "@/content/pricing";
import type { VilleContext } from "@/components/services/types";

export interface AuditHeroProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function AuditHero({ isFr, villeContext }: AuditHeroProps): ReactNode {
  const loc: "fr" | "en" = isFr ? "fr" : "en";
  const flashTier = getTierById(AUDIT_TIERS, "audit-flash");
  const strategicEtiTier = getTierById(AUDIT_TIERS, "audit-strategique-eti");
  const onsitePrice = formatAmount(flashTier.priceFlatOnsite ?? 890, loc, { compact: true });
  const remotePrice = formatAmount(flashTier.priceFlat ?? 490, loc, { compact: true });
  const strategicMinPrice = formatAmount(strategicEtiTier.priceMin ?? 12000, loc, {
    compact: true,
  });

  // H1 ville-aware vs canonique.
  const title = villeContext
    ? isFr
      ? `Audit IA à ${villeContext.name}`
      : `AI Audit in ${villeContext.name}`
    : isFr
      ? "Audit IA pour PME & ETI"
      : "AI Audit for SMEs & mid-caps";

  const titleEm = villeContext
    ? isFr
      ? `& région ${villeContext.region}`
      : `& ${villeContext.region} region`
    : isFr
      ? `dès ${remotePrice}`
      : `from ${remotePrice}`;

  const description = villeContext
    ? isFr
      ? `4 niveaux d'audit IA pour les entreprises de ${villeContext.name} et sa région — du diagnostic Flash ${remotePrice} (à distance) ou ${onsitePrice} (terrain) à l'audit Stratégique ETI ${strategicMinPrice}+. Couverture TPE, PME, ETI et grandes entreprises.`
      : `4 AI audit levels for ${villeContext.name}-area companies — from ${remotePrice} Flash diagnosis (remote) or ${onsitePrice} (on site) to ${strategicMinPrice}+ Strategic mid-cap audit. Small business, SME, mid-cap and enterprise coverage.`
    : isFr
      ? `4 niveaux d'audit IA pour entreprise — du diagnostic Flash ${remotePrice} à l'audit Stratégique ETI ${strategicMinPrice}+. Choisissez l'angle qui vous parle : la taille de votre entreprise OU votre situation.`
      : `4 AI audit levels for companies — from ${remotePrice} Flash diagnosis to ${strategicMinPrice}+ Strategic mid-cap audit. Choose the angle that speaks to you: your company size OR your situation.`;

  const flashCtaLabel = villeContext
    ? isFr
      ? `Flash terrain à ${villeContext.name} · ${onsitePrice}`
      : `On-site Flash in ${villeContext.name} · ${onsitePrice}`
    : isFr
      ? `Réserver un Flash terrain · ${onsitePrice}`
      : `Book on-site Flash · ${onsitePrice}`;

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
          <>
            <Cta
              href="/reserver?intervention=audit-flash-onsite"
              size="lg"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
              track="audit-hero-flash"
            >
              <Calendar aria-hidden="true" className="h-4 w-4" />
              {flashCtaLabel}
            </Cta>
            <Cta href="/audit/demande" variant="outline" size="lg" track="audit-hero-cadrage">
              <Mail aria-hidden="true" className="h-4 w-4" />
              {isFr ? "Demander un cadrage" : "Request framing"}
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
