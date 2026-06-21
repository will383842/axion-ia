import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";

export interface ExpertQuoteData {
  readonly name: string;
  readonly title: string | null;
  readonly text: string;
}

interface ArticleExpertQuoteProps {
  readonly quote: ExpertQuoteData | null | undefined;
  readonly locale: Locale;
}

/**
 * Brique partagée — citation d'expert nommé (chantier templates 2026-06-21).
 *
 * Le levier AEO le plus fort (+41 % de visibilité IA selon l'audit). Alimenté
 * par les champs DB réels `Article.expertQuoteName/Title/Text` → rendu
 * UNIQUEMENT si une VRAIE citation est renseignée (nom + texte). Jamais d'expert
 * inventé : si la donnée est vide, le bloc ne se rend pas.
 *
 * HTML sémantique `<figure><blockquote><figcaption>` (nom + titre). Server
 * component, 0 JS, CLS = 0. `data-aeo` = extraction par bloc autonome.
 */
export function ArticleExpertQuote({ quote, locale }: ArticleExpertQuoteProps) {
  if (!quote) return null;
  const name = quote.name?.trim() ?? "";
  const text = quote.text?.trim() ?? "";
  if (name.length === 0 || text.length === 0) return null;
  const title = quote.title?.trim() ?? "";
  const isFr = locale === "fr";

  return (
    <Section>
      <Container className="max-w-3xl">
        <figure
          data-aeo="expert-quote"
          className="border-terracotta border-l-4 pl-5"
          aria-label={isFr ? "Avis d'expert" : "Expert opinion"}
        >
          <blockquote className="text-fg text-xl leading-relaxed italic">
            «&nbsp;{text}&nbsp;»
          </blockquote>
          <figcaption className="text-fg-muted mt-3 text-sm not-italic">
            —{" "}
            <span className="text-fg font-semibold">{name}</span>
            {title.length > 0 ? `, ${title}` : ""}
          </figcaption>
        </figure>
      </Container>
    </Section>
  );
}
