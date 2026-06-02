/**
 * ImplementationFaq — FAQ 8+ questions levée d'objections.
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.1276-1287). Levée d'objections
 * principales : prix, propriété, abonnement, délai, données, garantie, prérequis,
 * taille. `FaqAccordion` auto-émet le FAQPage JSON-LD ; on injecte en plus une
 * SpeakableSpecification ciblée sur questions/réponses (AEO 2026). Si
 * `villeContext` est fourni, intercale 1-2 FAQs ville-spécifiques en tête.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import type { VilleContext } from "@/components/services/types";

interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface ImplementationFaqProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
  /** FAQs ville-spécifiques intercalées en tête (optionnel). */
  readonly villeSpecificFaqs?: ReadonlyArray<{ readonly q: string; readonly a: string }>;
}

export function ImplementationFaq({
  isFr,
  villeContext,
  villeSpecificFaqs,
}: ImplementationFaqProps): ReactNode {
  const baseFaqs: ReadonlyArray<FaqItem> = isFr
    ? [
        {
          id: "q-prix",
          question: "Comment ça marche, côté budget ?",
          answer:
            "Toujours en forfait fixe : un devis ferme avant tout démarrage, sans dépassement. Le montant dépend du périmètre — d'une automatisation simple à plusieurs automatisations connectées ou à de l'IA sur-mesure pour ETI et grands comptes. On le cadre ensemble lors d'un premier échange, sans engagement.",
        },
        {
          id: "q-proprio",
          question: "Qui est propriétaire de ce que vous installez ?",
          answer:
            "Vous. Le code, les workflows, les configurations, la documentation — tout est livré dans vos comptes, vos outils, votre infrastructure. Si vous nous quittez demain, tout continue de fonctionner.",
        },
        {
          id: "q-abonnement",
          question: "Y a-t-il une maintenance mensuelle obligatoire ?",
          answer:
            "Non. Vous payez une fois, c'est à vous. Si plus tard vous voulez faire évoluer (nouvelles automatisations, ajustements), vous nous rappelez et on chiffre une mission complémentaire. Aucune redevance ne tourne en arrière-plan.",
        },
        {
          id: "q-delai",
          question: "Combien de temps avant que ça tourne chez moi ?",
          answer:
            "Entre 2 et 6 semaines selon la complexité, à compter de la signature du devis. Une automatisation simple (lecture de factures, chatbot site web) : 2 semaines. Un projet plus structurant (assistant commercial connecté à votre CRM) : 4 à 6 semaines.",
        },
        {
          id: "q-donnees",
          question: "Mes données sortent-elles de chez moi ?",
          answer:
            "Hébergement UE par défaut, modèles compatibles RGPD. Pour les sujets sensibles, on déploie en infra dédiée ou on utilise des modèles open-source (Llama, Mistral) hébergés chez vous. Les choix techniques sont justifiés dans le devis avant signature.",
        },
        {
          id: "q-garantie",
          question: "Et si je ne suis pas satisfait à la livraison ?",
          answer:
            "Sprints courts avec démos hebdomadaires : vous validez à chaque étape, pas de mauvaise surprise à la fin. À la livraison, 30 jours de support inclus pour ajustements. Si une fonctionnalité livrée ne correspond pas au cahier des charges signé, on la corrige sans surcoût.",
        },
        {
          id: "q-prerequis",
          question: "Faut-il déjà avoir une culture IA ou une équipe data en interne ?",
          answer:
            "Non. On part de votre niveau réel — vos outils actuels, vos vraies tâches répétitives, votre quotidien. Aucune compétence technique n'est requise pour démarrer. On choisit ensemble des cas d'usage simples et tangibles, on construit la trajectoire à votre rythme, et la formation incluse à la livraison rend vos équipes autonomes. Si vous n'avez jamais touché à l'IA, c'est même souvent plus simple — pas d'habitudes à défaire.",
        },
        {
          id: "q-taille",
          question: "C'est adapté à une entreprise comme la mienne ?",
          answer:
            "Oui, du moment qu'il y a une tâche répétitive ou un agacement quotidien. On couvre l'artisan (devis, suivi clients) jusqu'au grand groupe (assistant juridique, agents internes). Si vous hésitez, un audit cadre le projet et priorise ce qui rapporte le plus vite.",
        },
      ]
    : [
        {
          id: "q-prix",
          question: "How does it work, budget-wise?",
          answer:
            "Always fixed-fee: a firm quote before any kick-off, with no overrun. The amount depends on scope — from a simple automation to several connected automations or custom AI for mid-caps and enterprise. We scope it together in a first chat, no commitment.",
        },
        {
          id: "q-proprio",
          question: "Who owns what you install?",
          answer:
            "You do. Code, workflows, configurations, documentation — everything is delivered into your accounts, your tools, your infrastructure. If you leave us tomorrow, everything keeps running.",
        },
        {
          id: "q-abonnement",
          question: "Is there a mandatory monthly maintenance?",
          answer:
            "No. You pay once, it's yours. If later you want to evolve (new automations, adjustments), you call us back and we quote a follow-up mission. Nothing runs in the background.",
        },
        {
          id: "q-delai",
          question: "How long before it runs at my place?",
          answer:
            "Between 2 and 6 weeks depending on complexity, from quote signature. Simple automation (invoice reading, web chatbot): 2 weeks. Larger project (sales assistant connected to your CRM): 4 to 6 weeks.",
        },
        {
          id: "q-donnees",
          question: "Does my data leave my premises?",
          answer:
            "EU hosting by default, GDPR-compatible models. For sensitive topics, we deploy on dedicated infra or use open-source models (Llama, Mistral) hosted with you. Technical choices are justified in the quote before signing.",
        },
        {
          id: "q-garantie",
          question: "What if I'm not satisfied at delivery?",
          answer:
            "Short sprints with weekly demos: you validate at every step, no bad surprise at the end. At delivery, 30 days of included support for adjustments. If a delivered feature doesn't match the signed scope, we fix it at no extra cost.",
        },
        {
          id: "q-prerequis",
          question: "Do I need an existing AI culture or in-house data team to start?",
          answer:
            "No. We start from your actual level — your current tools, your real repetitive tasks, your daily reality. No technical skill is required to begin. We pick simple, tangible use cases together, we build the trajectory at your pace, and the included training at delivery makes your teams autonomous. If you've never touched AI, it's often even simpler — no habits to undo.",
        },
        {
          id: "q-taille",
          question: "Is this fit for a company like mine?",
          answer:
            "Yes, as long as there is a repetitive task or daily annoyance. We cover trades (quoting, follow-up) through to enterprise (legal assistant, internal agents). If unsure, an audit frames the project and prioritises what pays off fastest.",
        },
      ];

  // Intercale les FAQ ville-spécifiques en tête si fournies.
  const cityFaqs: ReadonlyArray<FaqItem> = (villeSpecificFaqs ?? []).map((item, i) => ({
    id: `q-ville-${i + 1}`,
    question: item.q,
    answer: item.a,
  }));

  const allFaqs: ReadonlyArray<FaqItem> = [...cityFaqs, ...baseFaqs];

  // Speakable AEO — ciblage data-faq-q + data-faq-a émis par FaqAccordion.
  const speakableSelectors = ["[data-faq-q]", "[data-faq-a]"] as const;
  const speakableJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPageElement",
    speakable: buildSpeakableSpecification({ selectors: [...speakableSelectors] }),
  } as const;

  return (
    <Section
      eyebrow={isFr ? "Vos questions" : "Your questions"}
      title={isFr ? "On" : "We"}
      titleEm={isFr ? "lève toutes vos objections" : "lift every objection"}
      description={
        isFr
          ? "Les vraies questions des dirigeants avant de signer. Si la vôtre n'est pas listée, posez-la directement."
          : "The real questions executives ask before signing. If yours is not listed, ask it directly."
      }
    >
      <FaqAccordion items={allFaqs} className="mx-auto max-w-3xl" />
      <JsonLd
        data={speakableJsonLd}
        strategy="afterInteractive"
        scriptId={
          villeContext
            ? `jsonld-impl-faq-speakable-${villeContext.villeSlug}`
            : "jsonld-impl-faq-speakable"
        }
      />
    </Section>
  );
}
