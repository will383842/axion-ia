import * as React from "react";
import { ArrowUpRight } from "lucide-react";

interface MediaCoverageItem {
  id: string;
  outlet: string;
  url: string;
  publishedAt: string;
  title: string;
}

interface MediaCoverageProps {
  items: ReadonlyArray<MediaCoverageItem>;
  locale: "fr" | "en";
  /** Localized labels. */
  labels: {
    /** "Aucune retombée presse pour le moment — contactez-nous pour interviews exclusives." */
    empty: string;
    /** "Lire l'article" / "Read article" */
    readArticle: string;
  };
}

import { fmtDate } from "@/lib/intl";

function formatDate(iso: string, locale: "fr" | "en"): string {
  return fmtDate(iso, locale);
}

// Media coverage list — éditorial v3, gracefully handles empty state.
// E-E-A-T anti-pattern : NEVER fabricate non-existent press mentions —
// when empty, render a transparent invitation message instead of fake logos.
export function MediaCoverage({ items, locale, labels }: MediaCoverageProps) {
  if (items.length === 0) {
    return (
      <div className="border-border bg-paper rounded-xl border p-10 text-center">
        <p className="text-fg-soft mx-auto max-w-xl text-base leading-relaxed">{labels.empty}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="border-border bg-paper hover:border-terracotta-soft flex flex-col rounded-xl border p-6 transition hover:shadow-[var(--shadow-subtle)]"
        >
          <p className="text-terracotta mb-4 text-[11px] font-semibold tracking-[0.18em] uppercase">
            {item.outlet}
          </p>
          <h3 className="text-fg flex-1 text-base leading-snug font-medium">{item.title}</h3>
          <div className="mt-6 flex items-center justify-between gap-3">
            <time dateTime={item.publishedAt} className="text-fg-muted text-xs">
              {formatDate(item.publishedAt, locale)}
            </time>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer external"
              className="text-fg hover:text-terracotta focus-visible:ring-terracotta inline-flex items-center gap-1 rounded-sm text-xs font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {labels.readArticle}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
