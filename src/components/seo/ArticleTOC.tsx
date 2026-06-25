// ArticleTOC — Table of Contents pour articles / guides.
// Featured Snippets P0-4 : Google privilégie les pages avec TOC structuré
// pour positionner en Featured Snippet « sommaire » (rich result liste).
//
// Usage :
//   <ArticleTOC items={tocItems} pageUrl={url} locale={locale} />
//
// Rendu : sticky rail gauche sur desktop (lg+), section repliable sur mobile.
// JSON-LD ItemList : émis en inline <script> pour parser Google / Perplexity.

import { JsonLd } from "@/components/marketing/JsonLd";

export interface TocItem {
  readonly anchor: string;
  readonly title: string;
  readonly level: 2 | 3;
}

interface ArticleTOCProps {
  readonly items: ReadonlyArray<TocItem>;
  /** Canonical URL of the page (without anchor), used in JSON-LD. */
  readonly pageUrl: string;
  readonly locale: "fr" | "en";
  /** If true, renders in sticky left-rail mode (default). */
  readonly sticky?: boolean;
}

/** Extrait les headings h2/h3 depuis un body HTML ou markdown brut. */
export function extractTocItems(bodyHtml: string): TocItem[] {
  const items: TocItem[] = [];
  // HTML headings
  const htmlPattern = /<h([23])[^>]*>(.*?)<\/h[23]>/gi;
  let match: RegExpExecArray | null;
  while ((match = htmlPattern.exec(bodyHtml)) !== null) {
    const level = parseInt(match[1]!, 10) as 2 | 3;
    const rawTitle = match[2]!.replace(/<[^>]+>/g, "").trim();
    if (!rawTitle) continue;
    const anchor = rawTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    items.push({ anchor, title: rawTitle, level });
  }
  if (items.length > 0) return items;

  // Markdown headings fallback (## / ###)
  const mdPattern = /^(#{2,3})\s+(.+)$/gm;
  while ((match = mdPattern.exec(bodyHtml)) !== null) {
    const level = match[1]!.length as 2 | 3;
    const rawTitle = match[2]!.trim();
    const anchor = rawTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    items.push({ anchor, title: rawTitle, level });
  }
  return items;
}

export function ArticleTOC({ items, pageUrl, locale, sticky = true }: ArticleTOCProps) {
  if (items.length < 2) return null;

  const isFr = locale === "fr";
  const label = isFr ? "Sommaire" : "Table of contents";

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: label,
    url: pageUrl,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.title,
      url: `${pageUrl}#${item.anchor}`,
    })),
  };

  return (
    <>
      <JsonLd data={itemListJsonLd} />
      {/* Mobile (< lg) : sommaire repliable natif (<details>, 0 JS) — mobile-first,
          absent auparavant. Rendu seulement en mode sticky (le mode inline gère
          déjà son propre affichage). */}
      {sticky ? (
        <details className="not-prose group border-border bg-paper mb-6 rounded-xl border p-4 lg:hidden">
          <summary className="text-fg flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="bg-terracotta h-3.5 w-1 rounded-full" />
              {label}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="text-fg-muted h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </summary>
          <ol className="border-border mt-3 space-y-1.5 border-t pt-3">
            {items.map((item) => (
              <li key={item.anchor} className={item.level === 3 ? "pl-3" : ""}>
                <a
                  href={`#${item.anchor}`}
                  className="text-fg-muted hover:text-terracotta-deep text-sm leading-tight transition-colors"
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      <nav
        aria-label={label}
        className={
          sticky
            ? "not-prose border-border bg-paper shadow-subtle hidden rounded-xl border p-4 lg:sticky lg:top-24 lg:block lg:w-60 lg:shrink-0 lg:self-start"
            : "not-prose"
        }
      >
        <p className="text-fg mb-2 inline-flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="bg-terracotta h-3.5 w-1 rounded-full" />
          {label}
        </p>
        <ol className="space-y-1">
          {items.map((item) => (
            <li key={item.anchor} className={item.level === 3 ? "pl-3" : ""}>
              <a
                href={`#${item.anchor}`}
                className="text-fg-muted hover:text-terracotta-deep text-sm leading-tight transition-colors"
              >
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
