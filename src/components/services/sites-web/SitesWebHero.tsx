/**
 * SitesWebHero — Hero du module Sites web augmentés IA (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/sites-web-augmentes/page.tsx` (l.326-375). Réutilisé par
 * la page hub `/fr/sites-web-augmentes` ET les 430 pages ville
 * `/fr/implantations/{region}/{ville}/sites-web-ia` (Phase 5). Quand
 * `villeContext` est fourni, le H1 interpole le nom de ville. Émet une
 * SpeakableSpecification inline ciblée sur le H1 + sous-titre du hero.
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import type { VilleContext } from "@/components/services/types";

export interface SitesWebHeroProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function SitesWebHero({ isFr, villeContext }: SitesWebHeroProps): ReactNode {
  // H1 ville-aware vs canonique — wording "site web qui comprend et répond".
  const titleStart = villeContext
    ? isFr
      ? `Votre site web à ${villeContext.name} qui`
      : `Your website in ${villeContext.name} that`
    : isFr
      ? "Votre site web qui"
      : "Your website that";

  const titleEm = isFr ? "comprend et répond." : "understands and responds.";

  const description = villeContext
    ? isFr
      ? `On intègre l'intelligence artificielle dans votre site web ou plateforme SaaS — équipes basées à ${villeContext.name} (${villeContext.region}) ou à distance. Chatbot RAG, search sémantique, génération éditoriale, personnalisation. Stack toujours la meilleure possible selon vos objectifs, hébergement UE, vos données.`
      : `We integrate AI into your website or SaaS platform — teams in ${villeContext.name} (${villeContext.region}) or remote. RAG chatbot, semantic search, editorial generation, personalisation. Stack always the best possible for your goals, EU hosting, your data.`
    : isFr
      ? "On intègre l'intelligence artificielle dans votre site web ou plateforme SaaS existant — ou on conçoit une expérience IA-native. Chatbot RAG, search sémantique, génération éditoriale, personnalisation. Stack toujours la meilleure possible selon vos objectifs, hébergement UE, vos données."
      : "We integrate AI into your existing website or SaaS platform — or design an AI-native experience. RAG chatbot, semantic search, editorial generation, personalisation. Stack always the best possible for your goals, EU hosting, your data.";

  const primaryCtaLabel = villeContext
    ? isFr
      ? `Décrire mon projet à ${villeContext.name} · devis 48 h`
      : `Describe my project in ${villeContext.name} · quote 48 h`
    : isFr
      ? "Décrire mon projet · devis 48 h"
      : "Describe my project · quote 48 h";

  // Speakable AEO 2026 — ciblage h1 + premier paragraphe.
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
        <Container className="relative max-w-3xl">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Sites web & plateformes SaaS · augmentés par l'IA" : "Websites & SaaS platforms · AI-augmented"}
          </p>

          <h1 className="display-editorial text-fg mt-5">
            {titleStart}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {titleEm}
            </span>
          </h1>

          <p
            data-hero-description
            className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl"
          >
            {description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Cta href="/contact" size="lg" track="sites-web-augmentes-hero-primary">
              {primaryCtaLabel}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg" track="sites-web-augmentes-hero-audit">
              {isFr ? "Commencer par un audit" : "Start with an audit"}
            </Cta>
          </div>
        </Container>
      </section>
      <JsonLd
        data={speakableJsonLd}
        strategy="afterInteractive"
        scriptId={
          villeContext
            ? `jsonld-sites-web-hero-speakable-${villeContext.villeSlug}`
            : "jsonld-sites-web-hero-speakable"
        }
      />
    </>
  );
}
