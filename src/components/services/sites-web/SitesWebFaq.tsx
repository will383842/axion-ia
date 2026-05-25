/**
 * SitesWebFaq — FAQ AEO 2026 du module Sites web augmentés (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/sites-web-augmentes/page.tsx` (l.139-203 + l.465-472).
 * 5 questions canoniques (site existant / stack / RAG / données RGPD / délai)
 * + JSON-LD FAQPage avec Speakable. Quand `villeContext` est fourni et que
 * `villeSpecificFaqs` est non vide, les questions ville-specific viennent
 * S'ADDITIONNER en tête (pas remplacer) pour booster l'AEO local.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";

export interface SitesWebFaqProps {
  readonly isFr: boolean;
  readonly villeContext?: import("@/components/services/types").VilleContext;
  /** Questions additionnelles ville-specific, préfixées en tête (optionnel). */
  readonly villeSpecificFaqs?: ReadonlyArray<{ readonly q: string; readonly a: string }>;
}

export function SitesWebFaq({
  isFr,
  villeContext,
  villeSpecificFaqs,
}: SitesWebFaqProps): ReactNode {
  const canonicalFaqs = isFr
    ? [
        {
          id: "q-site-existant",
          question: "Peut-on augmenter un site existant sans le refondre ?",
          answer:
            "Oui, dans la grande majorité des cas. On greffe les briques IA sur votre site via une API ou un widget : chatbot RAG, search sémantique, génération de contenu. Aucune refonte technique nécessaire si votre CMS expose une API ou un flux de données.",
        },
        {
          id: "q-stack",
          question: "Avec quels CMS et stacks travaillez-vous ?",
          answer:
            "WordPress, Webflow, Shopify, Next.js, Nuxt, Gatsby, Laravel, Django, Symfony, Vue, React — toute stack exposant une API REST, GraphQL ou un flux de contenu. On choisit toujours la meilleure stack possible selon vos objectifs et on s'adapte à votre environnement existant.",
        },
        {
          id: "q-rag",
          question: "Comment fonctionne le chatbot RAG sur mon site ?",
          answer:
            "On indexe vos pages, documents et données dans une base vectorielle hébergée en UE. Le chatbot interroge cette base pour répondre précisément à chaque question, en citant ses sources. Résultat : zéro hallucination sur votre périmètre, réponses fidèles à votre contenu.",
        },
        {
          id: "q-donnees",
          question: "Mes données restent-elles confidentielles ?",
          answer:
            "Oui. Toute la chaîne IA est hébergée en UE (Hetzner Frankfurt), conforme RGPD. Vos données ne transitent jamais par des serveurs américains sans DPA signé. Vous gardez la propriété complète de vos contenus et modèles.",
        },
        {
          id: "q-delai",
          question: "Combien de temps pour augmenter mon site ?",
          answer:
            "Un chatbot RAG opérationnel sur votre site : 2 à 3 semaines. Search sémantique : 1 semaine si votre contenu est déjà structuré. Génération éditoriale complète : 3 à 5 semaines. Devis ferme 48 h, forfait fixe sans dépassement.",
        },
      ]
    : [
        {
          id: "q-existing-site",
          question: "Can you augment an existing site without rebuilding it?",
          answer:
            "Yes, in the vast majority of cases. We graft AI bricks onto your site via an API or widget: RAG chatbot, semantic search, content generation. No technical rebuild needed if your CMS exposes an API or data feed.",
        },
        {
          id: "q-stack",
          question: "Which CMS and stacks do you work with?",
          answer:
            "WordPress, Webflow, Shopify, Next.js, Nuxt, Gatsby, Laravel, Django, Symfony, Vue, React — any stack exposing a REST API, GraphQL or content feed. We always pick the best possible stack for your goals and adapt to your existing environment.",
        },
        {
          id: "q-rag",
          question: "How does the RAG chatbot work on my site?",
          answer:
            "We index your pages, documents and data into an EU-hosted vector database. The chatbot queries this base to answer each question precisely, citing its sources. Result: zero hallucinations within your scope, answers faithful to your content.",
        },
        {
          id: "q-data",
          question: "Does my data remain confidential?",
          answer:
            "Yes. The entire AI chain is hosted in the EU (Hetzner Frankfurt), GDPR compliant. Your data never transits through US servers without a signed DPA. You retain full ownership of your content and models.",
        },
        {
          id: "q-timeline",
          question: "How long to augment my site?",
          answer:
            "A RAG chatbot live on your site: 2 to 3 weeks. Semantic search: 1 week if your content is already structured. Full editorial generation: 3 to 5 weeks. Firm quote 48 h, fixed fee with no overruns.",
        },
      ];

  // Préfixage ville-specific (FAQ locale en tête pour AEO local).
  const villeFaqs =
    villeContext && villeSpecificFaqs && villeSpecificFaqs.length > 0
      ? villeSpecificFaqs.map((entry, idx) => ({
          id: `q-ville-${villeContext.villeSlug}-${idx}`,
          question: entry.q,
          answer: entry.a,
        }))
      : [];

  const faqs = [...villeFaqs, ...canonicalFaqs];

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Vos questions" : "Your questions"}
      title={isFr ? "Réponses" : "Straight"}
      titleEm={isFr ? "directes" : "answers"}
    >
      <FaqAccordion items={faqs} className="mx-auto max-w-3xl" />
    </Section>
  );
}
