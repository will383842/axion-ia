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
      <nav
        aria-label={label}
        className={
          sticky
            ? "not-prose hidden lg:sticky lg:top-24 lg:block lg:w-56 lg:shrink-0 lg:self-start"
            : "not-prose"
        }
      >
        <p className="text-fg mb-2 text-sm font-semibold">{label}</p>
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
