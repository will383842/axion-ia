/**
 * InterventionsFaq — FAQ générique interventions (5-6 Q/R) + JSON-LD Speakable.
 *
 * Sprint A Phase 2 (2026-05-25). Server Component. NOUVEAU composant (la page
 * /interventions actuelle utilise `LocalGeoFaqSection` direct — ce wrapper
 * fournit une FAQ générique « interventions » pour les pages ville).
 *
 * Couvre : formats proposés, durée, sur site vs distanciel, devis 48 h, langues.
 * Si `villeSpecificFaqs` fourni, les Q/R locales sont concaténées après les
 * 5 Q/R génériques (utile pour pages ville avec parking, accès transports,
 * délais propres, etc.).
 *
 * Émet FAQPage JSON-LD avec SpeakableSpecification (AEO 2026 — Google
 * Assistant, Alexa, ChatGPT voice mode).
 */

import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildFaqSpeakableJsonLd } from "@/lib/seo";
import type { VilleContext } from "@/components/services/types";

interface InterventionsFaqProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
  readonly villeSpecificFaqs?: ReadonlyArray<{ q: string; a: string }>;
}

function buildGenericFaqs(
  isFr: boolean,
  villeContext?: VilleContext,
): ReadonlyArray<{ q: string; a: string }> {
  const villeName = villeContext?.name;
  return [
    {
      q: isFr
        ? "Quels formats d'intervention IA proposez-vous ?"
        : "Which AI session formats do you offer?",
      a: isFr
        ? "Quatre familles : formations équipe (4 h à 3 jours et plus, 2 à 30+ personnes), coaching individuel 1-to-1, journée stratégique 1-to-1 avec le dirigeant, et conférence plénière 1 journée pour les grands effectifs (30+)."
        : "Four families: team trainings (4 h to 3 days or more, 2 to 30+ people), 1-on-1 individual coaching, 1-on-1 strategic day with the executive, and 1-day plenary talk for large audiences (30+).",
    },
    {
      q: isFr
        ? "Combien de temps dure une intervention IA ?"
        : "How long does an AI session last?",
      a: isFr
        ? "De 4 heures (demi-journée d'initiation rapide) à plusieurs jours selon le format choisi. Les formats équipe vont de 4 h à 3 jours et plus. Le coaching individuel et la journée dirigeants durent typiquement 1 journée. La conférence est calibrée sur 1 journée pleine."
        : "From 4 hours (a quick half-day) to several days depending on the chosen format. Team formats range from 4 h to 3 days or more. Individual coaching and the executive day typically last 1 day. The talk is scoped on a full 1-day plenary.",
    },
    {
      q: villeName
        ? isFr
          ? `Intervenez-vous sur site à ${villeName} ou uniquement à distance ?`
          : `Do you train on site in ${villeName} or only remote?`
        : isFr
          ? "Intervenez-vous sur site ou uniquement à distance ?"
          : "Do you train on site or only remote?",
      a: villeName
        ? isFr
          ? `Nous intervenons sur site partout en France et à l'international, ${villeName} incluse. Le coaching individuel peut aussi se dérouler en visio si vous préférez. Le déplacement et le logement sont à la charge du client (forfait journalier transparent communiqué au devis).`
          : `We train on site across France and internationally, ${villeName} included. Individual coaching can also run remote if you prefer. Travel and lodging are covered by the client (transparent flat daily rate quoted upfront).`
        : isFr
          ? "Nous intervenons sur site partout en France et à l'international. Le coaching individuel peut aussi se dérouler en visio. Le déplacement et le logement sont à la charge du client (forfait journalier transparent communiqué au devis)."
          : "We train on site across France and internationally. Individual coaching can also run remote. Travel and lodging are covered by the client (transparent flat daily rate quoted upfront).",
    },
    {
      q: isFr ? "Sous combien de temps recevons-nous un devis ?" : "How fast do we get a quote?",
      a: isFr
        ? "Sous 48 heures ouvrées. Vous pré-réservez une date sur le calendrier maison, nous vous rappelons pour valider le format et l'effectif, puis envoyons un devis détaillé sous 48 h ouvrées. Pas de réponse au-delà = relance prioritaire."
        : "Within 48 working hours. You pre-book a date on the in-house calendar, we call you back to validate the format and headcount, then send a detailed quote within 48 working hours. No reply beyond = priority follow-up.",
    },
    {
      q: isFr
        ? "Dans quelles langues les interventions sont-elles disponibles ?"
        : "Which languages are sessions available in?",
      a: isFr
        ? "Français et anglais. Les supports écrits sont systématiquement en français pour les missions FR, en anglais pour les missions internationales. Le formateur s'adapte à la langue de travail dominante de votre équipe."
        : "French and English. Written materials are systematically in French for FR missions, in English for international missions. The trainer adapts to your team's dominant working language.",
    },
  ];
}

export function InterventionsFaq({ isFr, villeContext, villeSpecificFaqs }: InterventionsFaqProps) {
  const genericFaqs = buildGenericFaqs(isFr, villeContext);
  const villeSpecificQA: ReadonlyArray<{ question: string; answer: string }> = (
    villeSpecificFaqs ?? []
  ).map((f) => ({ question: f.q, answer: f.a }));
  const allFaqs: ReadonlyArray<{ question: string; answer: string }> = [
    ...genericFaqs.map((f) => ({ question: f.q, answer: f.a })),
    ...villeSpecificQA,
  ];

  const faqJsonLd = buildFaqSpeakableJsonLd({
    items: allFaqs,
  });

  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Questions fréquentes" : "Frequently asked questions"}
      title={
        villeContext
          ? isFr
            ? `Interventions IA à ${villeContext.name} `
            : `AI sessions in ${villeContext.name} `
          : isFr
            ? "Interventions IA "
            : "AI sessions "
      }
      titleEm={isFr ? "en pratique" : "in practice"}
      description={
        isFr
          ? "Les questions que les entreprises nous posent avant de pré-réserver une intervention IA."
          : "The questions companies ask us before pre-booking an AI session."
      }
    >
      <Container className="max-w-3xl">
        <dl className="divide-border divide-y">
          {allFaqs.map((item, i) => (
            <div key={i} className="py-6">
              <dt
                data-faq-q
                itemProp="name"
                className="text-fg text-lg leading-snug font-semibold"
              >
                {item.question}
              </dt>
              <dd
                data-faq-a
                itemProp="text"
                className="text-fg-soft mt-3 text-base leading-relaxed"
              >
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Container>

      <JsonLd data={faqJsonLd} />
    </Section>
  );
}
