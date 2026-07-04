import { getLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildFaqSpeakableJsonLd } from "@/lib/seo";
import { getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";
import { formatMentionMarqueQualiopi } from "@/server/qualiopi/legal/legal-mentions";

/**
 * FAQ « Financement & certification » — gated Phase B. Server Component, zéro JS
 * (accordéon natif `<details>`). Émet un **FAQPage JSON-LD + Speakable** (les
 * réponses portent `data-faq-a`, ciblées par les sélecteurs speakable) → double
 * gain AEO : citation LLM (Perplexity/Claude/SGE) + voice.
 *
 * Rend `null` hors Phase B : revendiquer « certifié Qualiopi / finançable » avant
 * l'agrément est ILLÉGAL. Les réponses tirent la mention obligatoire de la config
 * (DB-sourcée). Décision Will : le n° de certificat n'est JAMAIS exposé au public.
 *
 * Placé sur `/formations/tarifs` (le hub `/formations` a déjà sa propre FAQPage —
 * ne PAS dupliquer un 2e FAQPage sur la même page).
 */
export async function QualiopiFinancingFaq() {
  const id = await getQualiopiPublicIdentity();
  if (!id) return null;

  const locale = await getLocale();
  const isFr = locale === "fr";

  const certPhrase = isFr
    ? `Oui. Axion-IA est un organisme de formation certifié Qualiopi. ${formatMentionMarqueQualiopi(id.categoriesCertifiees)}`
    : `Yes. Axion-IA is a Qualiopi-certified training provider. ${formatMentionMarqueQualiopi(id.categoriesCertifiees)}`;

  const items = isFr
    ? [
        {
          question: "Les formations Axion-IA sont-elles certifiées Qualiopi ?",
          answer: certPhrase,
        },
        {
          question: "Les formations sont-elles finançables (OPCO, France Travail) ?",
          answer:
            "La certification Qualiopi rend les formations Axion-IA éligibles à un financement par les OPCO ; selon votre situation, une prise en charge par France Travail (AIF, POEI) est également possible. La prise en charge est étudiée au cas par cas selon votre branche et votre dispositif — nous fournissons les pièces nécessaires : devis, convention, programme détaillé, certificat de réalisation.",
        },
        {
          question: "Comment monter le dossier de prise en charge ?",
          answer:
            "Contactez-nous avant la session : nous établissons un devis et une convention conformes, et nous accompagnons la demande de financement auprès de votre OPCO (subrogation de paiement possible, sous réserve d'accord de l'OPCO).",
        },
      ]
    : [
        { question: "Are Axion-IA trainings Qualiopi-certified?", answer: certPhrase },
        {
          question: "Are the trainings fundable (OPCO, France Travail)?",
          answer:
            "Qualiopi certification makes Axion-IA trainings eligible for OPCO funding; depending on your situation, coverage by France Travail (AIF, POEI) may also be possible. Coverage is assessed case by case according to your sector and scheme — we provide the required documents: quote, agreement, detailed programme, completion certificate.",
        },
        {
          question: "How do we set up the funding request?",
          answer:
            "Contact us before the session: we issue a compliant quote and agreement, and we support the funding request with your OPCO (payment subrogation possible, subject to OPCO approval).",
        },
      ];

  const faqJsonLd = buildFaqSpeakableJsonLd({ items });

  return (
    <section
      className="bg-canvas border-border border-t py-14 sm:py-16"
      aria-labelledby="qualiopi-faq-title"
    >
      <Container className="max-w-3xl">
        <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
          {isFr ? "Financement & certification" : "Funding & certification"}
        </p>
        <h2
          id="qualiopi-faq-title"
          className="text-fg mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl"
        >
          {isFr ? "Vos questions sur le financement" : "Your funding questions"}
        </h2>
        <div className="mt-8 space-y-3">
          {items.map((item) => (
            <details
              key={item.question}
              className="bg-paper border-border group open:shadow-card rounded-lg border px-5 py-4"
            >
              <summary
                data-faq-q
                className="text-fg flex cursor-pointer list-none items-center justify-between gap-4 font-semibold"
              >
                {item.question}
                <span
                  aria-hidden="true"
                  className="text-terracotta shrink-0 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p data-faq-a className="text-fg-soft mt-3 text-base leading-relaxed">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </Container>
      <JsonLd data={faqJsonLd} />
    </section>
  );
}
