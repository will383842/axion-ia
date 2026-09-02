import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";

export interface PeopleAlsoAskItem {
  readonly question: string;
  readonly href: string;
}

interface ArticlePeopleAlsoAskProps {
  readonly items: ReadonlyArray<PeopleAlsoAskItem>;
  readonly locale: Locale;
}

/**
 * Brique partagée — bloc « Questions liées » / People-Also-Ask (chantier
 * templates 2026-06-21).
 *
 * DISTINCT de la FAQ accordéon : ici chaque entrée est un LIEN vers une autre
 * réponse/article (3 à 6 questions connexes). Double levier : maillage interne
 * (le crawler suit les liens vers les pages-sœurs) + AEO (les moteurs IA
 * extraient les questions connexes du bloc `data-aeo="people-also-ask"`).
 *
 * Alimenté par de VRAIS liens internes (related questions calculées en amont) →
 * rendu UNIQUEMENT si la liste contient au moins une entrée. Liste vide → bloc
 * non rendu (jamais de conteneur vide → CLS = 0).
 *
 * HTML sémantique `<nav><ul><li><a>`, navigation clavier native, focus visible
 * hérité. Server component, 0 JS.
 */
export function ArticlePeopleAlsoAsk({ items, locale }: ArticlePeopleAlsoAskProps) {
  if (!items || items.length === 0) return null;
  const isFr = locale === "fr";
  const heading = isFr ? "Questions liées" : "People also ask";

  return (
    <Section spacing="compact">
      <Container className="max-w-3xl">
        <nav
          data-aeo="people-also-ask"
          aria-label={heading}
          className="border-border bg-paper shadow-subtle rounded-lg border px-5 py-5"
        >
          <h2 className="text-terracotta-deep text-sm font-semibold tracking-wide uppercase">
            {heading}
          </h2>
          <ul className="border-border mt-3 divide-y">
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-fg hover:text-terracotta group flex items-start gap-3 py-3 leading-relaxed transition-colors"
                >
                  <span
                    aria-hidden="true"
                    className="text-terracotta group-hover:text-terracotta-deep mt-0.5 font-serif text-lg leading-none transition-transform group-hover:translate-x-0.5"
                  >
                    ＋
                  </span>
                  <span className="font-medium">{item.question}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </Section>
  );
}
