import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";

interface ArticleKeyTakeawayProps {
  readonly text: string | null | undefined;
  readonly locale: Locale;
}

/**
 * Brique partagée — encadré « 💡 Point clé » (chantier templates 2026-06-21).
 *
 * Distinct de la « réponse directe » (AnswerCard / TL;DR) : c'est le bloc cité
 * tel quel par ChatGPT/Perplexity (ai_summary). Alimenté par `Article.keyTakeaway`
 * (champ DB réel) → rendu UNIQUEMENT s'il est rempli avec du vrai contenu, jamais
 * inventé. Server component, 0 JS, hauteur réservée (CLS = 0). `data-aeo` =
 * sélecteur d'extraction par bloc autonome.
 */
export function ArticleKeyTakeaway({ text, locale }: ArticleKeyTakeawayProps) {
  if (!text || text.trim().length === 0) return null;
  const isFr = locale === "fr";

  return (
    <Section spacing="compact">
      <Container className="max-w-3xl">
        <aside
          data-aeo="key-point"
          className="border-terracotta/40 bg-sand rounded-lg border-l-4 px-5 py-4"
        >
          <p className="text-terracotta-deep text-sm font-semibold tracking-wide uppercase">
            💡 {isFr ? "Point clé" : "Key takeaway"}
          </p>
          <p data-answer className="text-fg mt-2 leading-relaxed">
            {text.trim()}
          </p>
        </aside>
      </Container>
    </Section>
  );
}
