/**
 * SitesWebFaq — FAQ AEO 2026 du module Sites web & SaaS augmentés (Server
 * Component).
 *
 * Fusion 2026-06-01 (Will) — set canonique fusionné et dédupliqué à partir des
 * 3 anciennes pages (sites-web-augmentes + codage-developpement + web-digital) :
 * 8 questions couvrant refonte/augmentation, choix build-vs-augment, stack, RAG,
 * IA-native, données RGPD, délai/coût (prix dynamique `CODAGE_TIERS`), propriété.
 * + JSON-LD FAQPage avec Speakable (via FaqAccordion). Quand `villeContext` est
 * fourni et `villeSpecificFaqs` non vide, les questions ville-specific viennent
 * S'ADDITIONNER en tête (pas remplacer) pour booster l'AEO local.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { CODAGE_TIERS, getTierById, formatAmount } from "@/content/pricing";

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
  const priceMin = formatAmount(
    getTierById(CODAGE_TIERS, "codage-web").priceMin!,
    isFr ? "fr" : "en",
    {
      compact: true,
    },
  );

  const canonicalFaqs = isFr
    ? [
        {
          id: "q-site-existant",
          question: "Peut-on augmenter un site existant sans le refondre ?",
          answer:
            "Oui, dans la grande majorité des cas. On greffe les briques IA sur votre site via une API, un widget JavaScript ou un plugin : chatbot RAG, search sémantique, génération de contenu — sans toucher au design ni à la structure. Aucune refonte ni downtime si votre CMS expose une API ou un flux de données.",
        },
        {
          id: "q-build-ou-augment",
          question: "Nouvelle plateforme ou augmentation de l'existant : comment choisir ?",
          answer:
            "Si votre plateforme a plus de 5 ans, est difficile à faire évoluer ou n'expose pas d'API, repartir sur une base IA-native est souvent plus rentable à 18 mois. Si elle fonctionne bien et expose une API, l'augmentation est plus rapide et moins coûteuse. On vous aide à trancher dès le premier appel.",
        },
        {
          id: "q-stack",
          question: "Avec quels CMS et stacks travaillez-vous ?",
          answer:
            "WordPress, Webflow, Shopify, Next.js, Nuxt, Gatsby, Laravel, Django, Rails, Symfony, Vue, React, Angular — toute stack exposant une API REST, GraphQL ou un flux de contenu. On choisit toujours la meilleure stack possible selon vos objectifs et on s'adapte à votre environnement existant, jamais l'inverse.",
        },
        {
          id: "q-rag",
          question: "Comment fonctionne le chatbot RAG sur mon site ?",
          answer:
            "On indexe vos pages, documents et données dans une base vectorielle hébergée en UE. Le chatbot interroge cette base pour répondre précisément à chaque question, en citant ses sources. Résultat : zéro hallucination sur votre périmètre, réponses fidèles à votre contenu, 24h/7j.",
        },
        {
          id: "q-ia-native",
          question: "Qu'est-ce que ça veut dire concrètement, une plateforme IA-native ?",
          answer:
            "L'IA n'est pas un module ajouté en fin de projet : elle est intégrée dès la conception. Agents autonomes capables d'agir, automatisations des processus métier répétitifs, search sémantique, chatbot RAG formé sur vos données. Résultat : une plateforme qui fait des choses sans qu'un humain ait à les déclencher.",
        },
        {
          id: "q-donnees",
          question: "Mes données restent-elles confidentielles ?",
          answer:
            "Oui. Toute la chaîne IA est hébergée en UE (Hetzner Frankfurt), conforme RGPD. Vos données ne transitent jamais par des serveurs américains sans DPA signé. Vous gardez la propriété complète de vos contenus et modèles.",
        },
        {
          id: "q-delai-cout",
          question: "Combien de temps et quel budget prévoir ?",
          answer: `Un chatbot RAG greffé sur un site existant : 2 à 3 semaines, à partir de ${priceMin}. Search sémantique : 1 à 2 semaines si le contenu est structuré. Une plateforme sur mesure complète avec IA intégrée : 6 à 12 semaines, devis sur mesure selon le périmètre. Toujours en forfait fixe — pas de régie, pas de dépassement.`,
        },
        {
          id: "q-proprio",
          question: "Qui est propriétaire du code et des données ?",
          answer:
            "Vous. Intégralement. Code source, bases de données, modèles IA, configurations — tout est livré dans votre infrastructure. Aucun abonnement mensuel imposé. Si vous nous quittez, la plateforme continue de fonctionner.",
        },
      ]
    : [
        {
          id: "q-existing-site",
          question: "Can you augment an existing site without rebuilding it?",
          answer:
            "Yes, in the vast majority of cases. We graft AI bricks onto your site via an API, a JavaScript widget or a plugin: RAG chatbot, semantic search, content generation — without touching the design or structure. No rebuild or downtime if your CMS exposes an API or data feed.",
        },
        {
          id: "q-build-or-augment",
          question: "New platform or augmenting the existing one: how do I choose?",
          answer:
            "If your platform is over 5 years old, hard to evolve or doesn't expose an API, an AI-native rebuild is often more cost-effective at 18 months. If it works well and exposes an API, augmentation is faster and cheaper. We help you decide on the first call.",
        },
        {
          id: "q-stack",
          question: "Which CMS and stacks do you work with?",
          answer:
            "WordPress, Webflow, Shopify, Next.js, Nuxt, Gatsby, Laravel, Django, Rails, Symfony, Vue, React, Angular — any stack exposing a REST API, GraphQL or content feed. We always pick the best possible stack for your goals and adapt to your existing environment, never the other way around.",
        },
        {
          id: "q-rag",
          question: "How does the RAG chatbot work on my site?",
          answer:
            "We index your pages, documents and data into an EU-hosted vector database. The chatbot queries this base to answer each question precisely, citing its sources. Result: zero hallucinations within your scope, answers faithful to your content, 24/7.",
        },
        {
          id: "q-ai-native",
          question: "What does AI-native platform actually mean?",
          answer:
            "AI is not a module added at the end of the project: it is integrated from day one. Autonomous agents capable of acting, automation of repetitive business processes, semantic search, RAG chatbot trained on your data. Result: a platform that does things without a human having to trigger them.",
        },
        {
          id: "q-data",
          question: "Does my data remain confidential?",
          answer:
            "Yes. The entire AI chain is hosted in the EU (Hetzner Frankfurt), GDPR compliant. Your data never transits through US servers without a signed DPA. You retain full ownership of your content and models.",
        },
        {
          id: "q-time-cost",
          question: "How long and what budget should I plan for?",
          answer: `A RAG chatbot grafted onto an existing site: 2 to 3 weeks, from ${priceMin}. Semantic search: 1 to 2 weeks if content is structured. A complete custom platform with integrated AI: 6 to 12 weeks, custom quote based on scope. Always fixed fee — no time-and-materials, no overruns.`,
        },
        {
          id: "q-owner",
          question: "Who owns the code and data?",
          answer:
            "You do. Entirely. Source code, databases, AI models, configurations — everything delivered into your infrastructure. No imposed monthly subscription. If you leave us, the platform keeps running.",
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
