import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";

export interface PrevNextLink {
  readonly title: string;
  readonly href: string;
}

interface ArticlePrevNextProps {
  readonly prev: PrevNextLink | null;
  readonly next: PrevNextLink | null;
  readonly locale: Locale;
}

/**
 * Brique partagée — navigation « Article précédent / suivant » (chantier
 * templates 2026-06-21).
 *
 * Maillage interne séquentiel dans une même série/catégorie : renforce le
 * crawl budget et la profondeur de lecture. Alimenté par les articles voisins
 * réels (calculés côté serveur depuis la série) → rendu UNIQUEMENT si au moins
 * un voisin existe ; si `prev` ET `next` sont null, le bloc ne se rend pas
 * (jamais de bloc vide → CLS = 0). Si un seul côté existe, l'autre colonne
 * reste vide pour préserver l'alignement. Server component, 0 JS.
 * `data-aeo` = sélecteur d'extraction par bloc autonome.
 */
export function ArticlePrevNext({ prev, next, locale }: ArticlePrevNextProps) {
  if (!prev && !next) return null;
  const isFr = locale === "fr";

  return (
    <Section>
      <Container className="max-w-3xl">
        <nav
          data-aeo="prev-next"
          aria-label={isFr ? "Navigation entre articles" : "Article navigation"}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {prev ? (
            <a
              href={prev.href}
              rel="prev"
              className="border-border shadow-subtle hover:border-terracotta group flex flex-col rounded-lg border px-5 py-4 transition-colors"
            >
              <span className="text-fg-muted text-sm font-semibold tracking-wide uppercase">
                ← {isFr ? "Précédent" : "Previous"}
              </span>
              <span className="text-fg group-hover:text-terracotta-deep mt-2 leading-snug font-medium transition-colors">
                {prev.title}
              </span>
            </a>
          ) : (
            <span aria-hidden="true" />
          )}

          {next ? (
            <a
              href={next.href}
              rel="next"
              className="border-border shadow-subtle hover:border-terracotta group flex flex-col rounded-lg border px-5 py-4 text-right transition-colors"
            >
              <span className="text-fg-muted text-sm font-semibold tracking-wide uppercase">
                {isFr ? "Suivant" : "Next"} →
              </span>
              <span className="text-fg group-hover:text-terracotta-deep mt-2 leading-snug font-medium transition-colors">
                {next.title}
              </span>
            </a>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      </Container>
    </Section>
  );
}
