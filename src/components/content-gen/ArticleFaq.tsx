import { Fragment, type ReactNode } from "react";
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
  /** `v1` (défaut) : rendu historique, inchangé. `v2` : gabarits d'articles. */
  readonly variante?: "v1" | "v2";
  /** Ouvre la première question (V2 : FAQ qui est le corps de l'article). */
  readonly premiereOuverte?: boolean;
  /** Niveau du titre de la section (2 par défaut ; jamais de titre dans un `<summary>`). */
  readonly niveauTitre?: 2 | 3;
  /** Titre déjà traduit (défaut : texte historique FR/EN). */
  readonly titre?: string;
  /** V2 : pose `id="q-N"` sur chaque question (N = rang parmi les questions rendues). */
  readonly ancres?: boolean;
  /** V2 : insère un encart après la question de rang `apres` (1 = après la première). */
  readonly inserer?: { readonly apres: number; readonly contenu: ReactNode };
}

interface QuestionPreparee {
  readonly question: string;
  readonly answerHtml: string;
  readonly answerText: string;
}

/** Questions réellement rendues (réponses vides ou placeholder écartées), dans l'ordre. */
function preparer(items: ReadonlyArray<ArticleFaqItem> | null | undefined): QuestionPreparee[] {
  return (items ?? [])
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
    .filter((x): x is QuestionPreparee => x !== null);
}

/** Intitulés des questions que `ArticleFaq` rendra (même filtre) : pour une grille ou un sommaire. */
export function questionsRendues(
  items: ReadonlyArray<ArticleFaqItem> | null | undefined,
): string[] {
  return preparer(items).map((p) => p.question);
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
export function ArticleFaq({
  items,
  locale,
  dateModified,
  variante = "v1",
  premiereOuverte = false,
  niveauTitre = 2,
  titre,
  ancres = false,
  inserer,
}: ArticleFaqProps) {
  if (!items || items.length === 0) return null;
  const isFr = locale === "fr";

  // Sanitize chaque réponse (défense en profondeur — même si déjà sanitizé à
  // l'insert) + dérive le texte plain pour le JSON-LD. On skippe les réponses
  // vides / placeholder (sanitizeFaqAnswer.skip).
  const prepared = preparer(items);

  if (prepared.length === 0) return null;

  const faqJsonLd = buildFaqJsonLd({
    items: prepared.map((p) => ({ question: p.question, answer: p.answerText })),
    ...(dateModified ? { dateModified } : {}),
  });

  if (variante === "v2") {
    // Gabarits d'articles : un seul niveau de conteneur, `<details>` natifs,
    // padding porté par le `<summary>` (≥ 44 px), pas de titre dans le `<summary>`.
    const Titre = niveauTitre === 3 ? "h3" : "h2";
    return (
      <section className="faq" aria-labelledby="art-faq-titre" data-aeo="people-also-ask">
        <Titre id="art-faq-titre" className="bloc-titre">
          {titre ?? (isFr ? "Questions fréquentes" : "Frequently asked questions")}
        </Titre>
        {prepared.map((p, i) => (
          <Fragment key={i}>
            <details {...(ancres ? { id: `q-${i + 1}` } : {})} open={premiereOuverte && i === 0}>
              <summary data-faq-q>{p.question}</summary>
              <div
                data-faq-a
                className="faq-answer"
                dangerouslySetInnerHTML={{ __html: p.answerHtml }}
              />
            </details>
            {inserer && inserer.apres === i + 1 ? inserer.contenu : null}
          </Fragment>
        ))}
        <JsonLd data={faqJsonLd} />
      </section>
    );
  }

  return (
    <Section spacing="compact">
      <Container className="max-w-[52rem]">
        <h2 className="text-fg inline-flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          <span aria-hidden="true" className="bg-terracotta h-5 w-1 rounded-full" />
          {isFr ? "Questions fréquentes" : "Frequently asked questions"}
        </h2>
        <div className="mt-6 space-y-3">
          {prepared.map((p, i) => (
            <details
              key={i}
              className="group border-border bg-paper hover:border-border-strong open:shadow-subtle rounded-xl border px-4 py-3.5 transition-colors open:pb-4"
            >
              <summary
                data-faq-q
                className="text-fg flex cursor-pointer list-none items-center justify-between gap-3 font-medium marker:content-none [&::-webkit-details-marker]:hidden"
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
