import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";
import {
  computeTrustTier,
  extractDomain,
  relAttrForExternalLink,
} from "@/server/content-gen/links/trust-tier";

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
  // Refonte AEO 2026-06-22 — ne garder que les sources avec une URL http(s)
  // valide ET un libellé non vide. Évite un bloc « Sources » contenant des
  // entrées cassées (lien mort / titre absent). 0 item valide → pas de bloc.
  const validItems = items.filter(
    (s) => /^https?:\/\//.test(s.url?.trim() ?? "") && (s.name?.trim().length ?? 0) > 0,
  );
  if (validItems.length === 0) return null;
  const isFr = locale === "fr";

  return (
    <Section>
      <Container className="max-w-[52rem]">
        <h2 className="text-fg inline-flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          <span aria-hidden="true" className="bg-terracotta h-5 w-1 rounded-full" />
          {isFr ? "Sources & méthodologie" : "Sources & methodology"}
        </h2>
        {/* Liens externes en blocs : nom + domaine + icône (hover). Numéro en
            pastille terracotta. rel dérivé du trust-tier (dofollow autorités). */}
        <ol className="mt-6 grid gap-3 md:grid-cols-2">
          {validItems.map((source, i) => {
            const domain = extractDomain(source.url);
            const rel = relAttrForExternalLink(domain ? computeTrustTier(domain) : "standard");
            return (
              <li key={i}>
                <a
                  href={source.url}
                  target="_blank"
                  rel={rel}
                  className="group border-border bg-paper hover:border-border-strong hover:shadow-subtle flex h-full items-start gap-3 rounded-xl border p-3.5 transition"
                >
                  <span
                    aria-hidden="true"
                    className="bg-terracotta-soft text-terracotta-deep inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-fg group-hover:text-terracotta-deep block text-sm leading-snug font-medium break-words transition-colors">
                      {source.name.trim().length > 0 ? source.name : source.url}
                    </span>
                    {domain ? (
                      <span className="text-fg-muted mt-0.5 block truncate text-xs">{domain}</span>
                    ) : null}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-fg-muted group-hover:text-terracotta-deep mt-0.5 h-4 w-4 shrink-0 transition-colors"
                  >
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </a>
              </li>
            );
          })}
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
