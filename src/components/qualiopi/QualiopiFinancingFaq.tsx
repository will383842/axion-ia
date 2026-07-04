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
 * l'agrément est ILLÉGAL. Les réponses tirent le n° de certificat + la mention
 * obligatoire de la config (DB-sourcée).
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
    ? `Oui. Axion-IA est un organisme de formation certifié Qualiopi (certificat n° ${id.qualiopiNumero}). ${formatMentionMarqueQualiopi(id.categoriesCertifiees)}`
    : `Yes. Axion-IA is a Qualiopi-certified training provider (certificate no. ${id.qualiopiNumero}). ${formatMentionMarqueQualiopi(id.categoriesCertifiees)}`;

  const items = isFr
    ? [
        {
          question: "Les formations Axion-IA sont-elles certifiées Qualiopi ?",
          answer: certPhrase,
        },
        {
          question: "Les formations sont-elles finançables (OPCO, France Travail) ?",
          answer:
            "Oui. La certification Qualiopi rend les formations Axion-IA finançables par les OPCO ; selon le dispositif et l'éligibilité, elles peuvent aussi être mobilisées via France Travail (AIF — Aide Individuelle à la Formation) ou le plan de développement des compétences de l'entreprise. Nous fournissons les pièces nécessaires : devis, convention, programme détaillé, certificat de réalisation.",
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
            "Yes. Qualiopi certification makes Axion-IA trainings fundable by OPCOs; depending on the scheme and eligibility, they may also be mobilised via France Travail (AIF) or the employer's skills-development plan. We provide the required documents: quote, agreement, detailed programme, completion certificate.",
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
