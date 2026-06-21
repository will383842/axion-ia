import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";

export interface ArticleSourceItem {
  readonly name: string;
  readonly url: string;
}

interface ArticleSourcesProps {
  readonly items: ReadonlyArray<ArticleSourceItem>;
  readonly locale: Locale;
  /** Date de dernière vérification éditoriale (fraîcheur E-E-A-T). */
  readonly lastVerified?: string | null;
}

/**
 * Brique partagée — Sources & méthodologie (chantier templates 2026-06-21).
 *
 * Rend la liste des sources citées (déjà chargées via ContentCitation /
 * `view.citations`, mais émises uniquement dans le JSON-LD jusqu'ici → invisibles
 * pour l'utilisateur et pour l'extraction LLM par bloc). Liens en `nofollow`
 * (E-E-A-T : on cite sans transmettre d'autorité) + date « dernière vérification ».
 *
 * Composant serveur, 0 JS, hauteur réservée (CLS = 0).
 */
export function ArticleSources({ items, locale, lastVerified }: ArticleSourcesProps) {
  if (!items || items.length === 0) return null;
  const isFr = locale === "fr";

  return (
    <Section>
      <Container className="max-w-3xl">
        <h2 className="text-fg text-2xl font-semibold tracking-tight">
          {isFr ? "Sources & méthodologie" : "Sources & methodology"}
        </h2>
        <ol className="text-fg-muted marker:text-terracotta mt-6 list-decimal space-y-2 pl-6 text-base marker:font-semibold">
          {items.map((source, i) => (
            <li key={i} className="pl-1">
              <a
                href={source.url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="hover:text-terracotta-deep break-words underline underline-offset-2 transition"
              >
                {source.name.trim().length > 0 ? source.name : source.url}
              </a>
            </li>
          ))}
        </ol>
        {lastVerified ? (
          <p className="text-fg-muted mt-4 text-sm">
            {isFr ? "Dernière vérification : " : "Last verified: "}
            <time dateTime={lastVerified} className="tabular-nums">
              {lastVerified}
            </time>
          </p>
        ) : null}
      </Container>
    </Section>
  );
}
