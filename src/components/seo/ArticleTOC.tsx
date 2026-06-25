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

  // En-tête moderne : icône « liste » dans une pastille terracotta + label.
  const tocHeader = (
    <span className="text-fg inline-flex items-center gap-2.5 text-sm font-semibold">
      <span
        aria-hidden="true"
        className="bg-terracotta-soft text-terracotta-deep inline-flex h-6 w-6 items-center justify-center rounded-lg"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M3 4.75A.75.75 0 0 1 3.75 4h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 4.75Zm3.25 0A.75.75 0 0 1 7 4h9.25a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75ZM3 10a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 10Zm3.25 0A.75.75 0 0 1 7 9.25h9.25a.75.75 0 0 1 0 1.5H7A.75.75 0 0 1 6.25 10ZM3 15.25a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75Zm3.25 0a.75.75 0 0 1 .75-.75h9.25a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75Z" />
        </svg>
      </span>
      {label}
    </span>
  );

  // Items numérotés (01, 02…) avec rail vertical (stepper) + hover sable.
  const tocList = (
    <ol className="border-border/70 mt-3 space-y-0.5 border-l pl-3">
      {items.map((item, i) => (
        <li key={item.anchor}>
          <a
            href={`#${item.anchor}`}
            className={`group/toc hover:bg-paper flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
              item.level === 3 ? "pl-5" : ""
            }`}
          >
            <span className="bg-terracotta-soft text-terracotta-deep inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-fg-muted group-hover/toc:text-fg text-sm leading-snug transition-colors">
              {item.title}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <JsonLd data={itemListJsonLd} />
      {/* Mobile (< lg) : sommaire repliable natif (<details>, 0 JS). */}
      {sticky ? (
        <details className="not-prose group border-border bg-sand shadow-card border-border-strong mb-6 rounded-2xl border p-5 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            {tocHeader}
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
          {tocList}
        </details>
      ) : null}
      <nav
        aria-label={label}
        className={
          sticky
            ? "not-prose border-border bg-sand shadow-card border-border-strong hidden rounded-2xl border p-5 lg:sticky lg:top-24 lg:block lg:w-64 lg:shrink-0 lg:self-start"
            : "not-prose"
        }
      >
        {tocHeader}
        {tocList}
      </nav>
    </>
  );
}
