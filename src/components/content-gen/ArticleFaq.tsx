import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildFaqJsonLd } from "@/lib/seo";
import { sanitizeFaqAnswer } from "@/server/content-gen/shared/faq-sanitizer";
import type { Locale } from "@/i18n/routing";

export interface ArticleFaqItem {
  readonly question: string;
  readonly answer: string;
}

interface ArticleFaqProps {
  readonly items: ReadonlyArray<ArticleFaqItem>;
  readonly locale: Locale;
  /** Date de dernière révision → dateModified du FAQPage (fraîcheur AEO). */
  readonly dateModified?: string | null;
}

/**
 * Brique partagée — FAQ d'article (Étape 1/3 chantier templates 2026-06-21).
 *
 * Rend l'accordéon FAQ + émet le schéma `FAQPage` (format roi de l'AEO, absent
 * de tous les templates d'article avant ce chantier alors que `Article.faqJson`
 * était déjà écrit en base par les generators — donnée présente, jamais rendue).
 *
 * Contraintes Web Vitals 2026 :
 *   - `<details>` natif → 0 JS client (INP-safe), pas de hydration.
 *   - Hauteur réservée, pas d'image → CLS = 0.
 *   - Composant SERVEUR (sanitize via jsdom au render ISR, mis en cache 1h).
 *
 * Sélecteurs `data-faq-q` / `data-faq-a` = cibles Speakable de `buildFaqJsonLd`.
 */
export function ArticleFaq({ items, locale, dateModified }: ArticleFaqProps) {
  if (!items || items.length === 0) return null;
  const isFr = locale === "fr";

  // Sanitize chaque réponse (défense en profondeur — même si déjà sanitizé à
  // l'insert) + dérive le texte plain pour le JSON-LD. On skippe les réponses
  // vides / placeholder (sanitizeFaqAnswer.skip).
  const prepared = items
    .map((it) => {
      const sanitized = sanitizeFaqAnswer(it.answer);
      const question = it.question.trim();
      if (sanitized.skip || question.length === 0) return null;
      const answerText = it.answer
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return { question, answerHtml: sanitized.html, answerText };
    })
    .filter((x): x is { question: string; answerHtml: string; answerText: string } => x !== null);

  if (prepared.length === 0) return null;

  const faqJsonLd = buildFaqJsonLd({
    items: prepared.map((p) => ({ question: p.question, answer: p.answerText })),
    ...(dateModified ? { dateModified } : {}),
  });

  return (
    <Section>
      <Container className="max-w-3xl">
        <h2 className="text-fg text-2xl font-semibold tracking-tight">
          {isFr ? "Questions fréquentes" : "Frequently asked questions"}
        </h2>
        <div className="mt-6 space-y-3">
          {prepared.map((p, i) => (
            <details
              key={i}
              className="group border-border bg-sand-50 rounded-lg border px-4 py-3 open:pb-4"
            >
              <summary
                data-faq-q
                className="text-fg marker:content-none flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden"
              >
                <span>{p.question}</span>
                <svg
                  aria-hidden="true"
                  className="text-terracotta-deep h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </summary>
              <div
                data-faq-a
                className="faq-answer text-fg-muted mt-3 leading-relaxed [&_a]:underline [&_li]:ml-4 [&_li]:list-disc"
                dangerouslySetInnerHTML={{ __html: p.answerHtml }}
              />
            </details>
          ))}
        </div>
      </Container>
      <JsonLd data={faqJsonLd} />
    </Section>
  );
}
