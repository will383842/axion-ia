/**
 * SitesWebHero — Hero 2 colonnes du module Sites web & SaaS augmentés IA
 * (Server Component).
 *
 * Fusion 2026-06-01 (Will) — réécrit sur le socle `ServiceHero` (template
 * /audit, hero 2-col + schéma orbital 8 nœuds IA), en absorbant le hero schema
 * de l'ancien `/codage-developpement`. Réutilisable hub + pages ville : quand
 * `villeContext` est fourni, le H1 interpole le nom de ville. Émet une
 * SpeakableSpecification inline ciblée sur le H1 + sous-titre du hero.
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ServiceHero } from "@/components/sections/ServiceHero";
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
  const title = villeContext
    ? isFr
      ? `Votre site web à ${villeContext.name} qui`
      : `Your website in ${villeContext.name} that`
    : isFr
      ? "Votre site web qui"
      : "Your website that";

  const titleEm = isFr ? "comprend et répond." : "understands and responds.";

  const description = villeContext
    ? isFr
      ? `On intègre l'intelligence artificielle dans votre site web ou plateforme SaaS — équipes à ${villeContext.name} (${villeContext.region}) ou à distance. Chatbot RAG, search sémantique, agents, personnalisation. On greffe sur votre existant ou on construit IA-native. Toute stack, hébergement UE, vos données.`
      : `We integrate AI into your website or SaaS platform — teams in ${villeContext.name} (${villeContext.region}) or remote. RAG chatbot, semantic search, agents, personalisation. We graft onto your existing stack or build AI-native. Any stack, EU hosting, your data.`
    : isFr
      ? "On intègre l'intelligence artificielle dans votre site web ou plateforme SaaS existant — ou on conçoit une expérience IA-native. Chatbot RAG, search sémantique, agents, personnalisation. Toute stack, on s'adapte. Hébergement UE, vos données."
      : "We integrate AI into your existing website or SaaS platform — or design an AI-native experience. RAG chatbot, semantic search, agents, personalisation. Any stack, we adapt. EU hosting, your data.";

  const primaryCtaLabel = villeContext
    ? isFr
      ? `Décrire mon projet à ${villeContext.name} · devis sous 24-48 h`
      : `Describe my project in ${villeContext.name} · quote in 24-48 h`
    : isFr
      ? "Décrire mon projet · devis sous 24-48 h"
      : "Describe my project · quote in 24-48 h";

  // Speakable AEO 2026 — ciblage h1 + premier paragraphe.
  const speakableSelectors = ["h1", "h1 + p", "[data-hero-description]"] as const;
  const speakableJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPageElement",
    speakable: buildSpeakableSpecification({ selectors: [...speakableSelectors] }),
  } as const;

  return (
    <>
      <ServiceHero
        eyebrow={
          isFr
            ? "Sites web & plateformes SaaS · augmentés par l'IA"
            : "Websites & SaaS platforms · AI-augmented"
        }
        title={title}
        titleEm={titleEm}
        description={description}
        ctas={
          <>
            <Cta href="/contact" size="lg" track="sites-web-augmentes-hero-primary">
              {primaryCtaLabel}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg" track="sites-web-augmentes-hero-audit">
              {isFr ? "Commencer par un audit" : "Start with an audit"}
            </Cta>
          </>
        }
        schemaCenterLabel={isFr ? "Votre site" : "Your site"}
        schemaAriaLabel={
          isFr
            ? "Schéma : votre site au centre, entouré des 8 couches IA modulaires (chatbot RAG, search sémantique, agents autonomes, automatisations, génération de contenu, vision IA, recommandation, analytics)."
            : "Diagram: your site at the center, surrounded by 8 modular AI layers (RAG chatbot, semantic search, autonomous agents, automations, content generation, AI vision, recommendation, analytics)."
        }
        schemaNodes={[
          {
            label: isFr ? "Chatbot RAG" : "RAG chatbot",
            benefit: isFr ? "Vos docs en assistant" : "Your docs as assistant",
            accent: "terracotta",
          },
          {
            label: isFr ? "Search sémantique" : "Semantic search",
            benefit: isFr ? "Trouver par le sens" : "Find by meaning",
            accent: "primary",
          },
          {
            label: isFr ? "Agents IA" : "AI agents",
            benefit: isFr ? "Workflows autonomes" : "Autonomous workflows",
            accent: "sage",
          },
          {
            label: "Automatisations",
            benefit: isFr ? "Make, n8n, Zapier" : "Make, n8n, Zapier",
            accent: "mocha",
          },
          {
            label: isFr ? "Génération" : "Generation",
            benefit: isFr ? "Texte, image, code" : "Text, image, code",
            accent: "terracotta",
          },
          {
            label: "Vision IA",
            benefit: isFr ? "OCR, classification" : "OCR, classification",
            accent: "primary",
          },
          {
            label: "Recommandation",
            benefit: isFr ? "Cross-sell, perso" : "Cross-sell, perso",
            accent: "sage",
          },
          {
            label: "Analytics",
            benefit: isFr ? "Insights live" : "Live insights",
            accent: "mocha",
          },
        ]}
      />
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
