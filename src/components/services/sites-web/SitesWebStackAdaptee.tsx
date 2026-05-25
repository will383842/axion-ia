/**
 * SitesWebStackAdaptee — 3 cartes modules IA (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/sites-web-augmentes/page.tsx` (l.396-450). 3 cartes :
 * Chatbot RAG / Search sémantique / Génération & personnalisation. Aucun
 * tarif public (spécificité sites-web). Wording "stack adaptée à vos
 * objectifs". Quand `villeContext` est fourni, la description du module
 * accent contextualise discrètement la ville.
 */

import type { ReactNode } from "react";
import { Globe, Sparkles, Zap } from "lucide-react";
import { Section } from "@/components/layout/Section";
import type { VilleContext } from "@/components/services/types";

export interface SitesWebStackAdapteeProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function SitesWebStackAdaptee({
  isFr,
  villeContext,
}: SitesWebStackAdapteeProps): ReactNode {
  const offers = isFr
    ? [
        {
          icon: Sparkles,
          tag: "IA conversationnelle",
          title: "Chatbot RAG intégré",
          description: villeContext
            ? `Déploiement d'un assistant conversationnel ancré sur vos contenus et documents internes — équipes ${villeContext.name} ou à distance. Réponses précises sur votre base de connaissance, hallucinations éliminées. Connexion à votre CMS ou base documentaire.`
            : "Déploiement d'un assistant conversationnel ancré sur vos contenus et documents internes. Réponses précises sur votre base de connaissance, hallucinations éliminées. Connexion à votre CMS ou base documentaire.",
          accent: true,
        },
        {
          icon: Globe,
          tag: "Découvrabilité",
          title: "Search sémantique",
          description:
            "Remplacez la recherche plein-texte par une recherche vectorielle qui comprend l'intention de vos visiteurs. Résultats pertinents même avec des formulations floues ou des synonymes.",
          accent: false,
        },
        {
          icon: Zap,
          tag: "Contenu & personnalisation",
          title: "Génération & personnalisation",
          description:
            "Pipeline de génération éditoriale (blog, fiches, FAQ) conforme HCU 2024 et AI Act 2026. Adaptation temps réel du contenu et des CTA selon le profil et le comportement de chaque visiteur.",
          accent: false,
        },
      ]
    : [
        {
          icon: Sparkles,
          tag: "Conversational AI",
          title: "Integrated RAG chatbot",
          description: villeContext
            ? `Deploy a conversational assistant grounded in your content and internal documents — teams in ${villeContext.name} or remote. Accurate answers from your knowledge base, hallucinations eliminated. Connect to your CMS or document repository.`
            : "Deploy a conversational assistant grounded in your content and internal documents. Accurate answers from your knowledge base, hallucinations eliminated. Connect to your CMS or document repository.",
          accent: true,
        },
        {
          icon: Globe,
          tag: "Discoverability",
          title: "Semantic search",
          description:
            "Replace full-text search with vector search that understands your visitors' intent. Relevant results even with vague formulations or synonyms.",
          accent: false,
        },
        {
          icon: Zap,
          tag: "Content & personalisation",
          title: "Generation & personalisation",
          description:
            "Editorial generation pipeline (blog, product pages, FAQ) compliant with HCU 2024 and AI Act 2026. Real-time content and CTA adaptation based on each visitor's profile and behaviour.",
          accent: false,
        },
      ];

  return (
    <Section
      eyebrow={isFr ? "3 modules IA" : "3 AI modules"}
      title={isFr ? "Ce qu'on intègre" : "What we integrate"}
      titleEm={isFr ? "dans votre site" : "into your site"}
      description={
        isFr
          ? "Chaque module est déployable seul ou combiné. Stack adaptée à vos objectifs — on choisit ensemble selon votre priorité."
          : "Each module can be deployed standalone or combined. Stack adapted to your goals — we choose together based on your priority."
      }
    >
      <ul className="grid gap-6 md:grid-cols-3">
        {offers.map((offer) => {
          const Icon = offer.icon;
          return (
            <li
              key={offer.title}
              className={
                offer.accent
                  ? "border-terracotta bg-paper ring-terracotta/20 flex flex-col gap-4 rounded-2xl border-2 p-8 ring-4"
                  : "border-border bg-paper flex flex-col gap-4 rounded-2xl border p-8"
              }
            >
              <div className="flex items-start gap-4">
                <span
                  className={
                    offer.accent
                      ? "bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      : "bg-fg/5 text-fg-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  }
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                    {offer.tag}
                  </p>
                  <h2
                    className={
                      offer.accent
                        ? "text-terracotta-deep mt-1 text-2xl leading-tight font-medium"
                        : "text-fg mt-1 text-2xl leading-tight font-medium"
                    }
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {offer.title}
                  </h2>
                </div>
              </div>
              <p className="text-fg-soft text-base leading-relaxed">{offer.description}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
