// use-client: filtre instantané (recherche texte + tri) de la liste d'articles d'une catégorie.
"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ArticleCard } from "@/components/marketing/ArticleCard";

export interface CategoryArticleItem {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly publishedAt: string;
  readonly readingTime: string;
  readonly route: "blog" | "actualites" | "guides";
  readonly featuredImage: string | null;
  readonly featuredImageAlt: string | null;
}

interface Props {
  readonly items: ReadonlyArray<CategoryArticleItem>;
  readonly isFr: boolean;
}

type SortKey = "recent" | "alpha";

// Normalise pour une recherche insensible casse/accents (parité BlogSearch).
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function CategoryArticlesFilter({ items, isFr }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const filtered = useMemo(() => {
    const nq = normalize(query.trim());
    const base = nq
      ? items.filter((it) => normalize(`${it.title} ${it.excerpt}`).includes(nq))
      : items;
    if (sort === "alpha") {
      return [...base].sort((a, b) => a.title.localeCompare(b.title, isFr ? "fr" : "en"));
    }
    // "recent" = ordre fourni (DB content-gen le plus récent d'abord, puis FS).
    return base;
  }, [items, query, sort, isFr]);

  const total = items.length;
  const shown = filtered.length;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="text-fg-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            strokeWidth={2}
          />
          <span className="sr-only">{isFr ? "Rechercher un article" : "Search an article"}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isFr ? "Rechercher dans cette catégorie…" : "Search this category…"}
            className="border-border bg-paper text-fg placeholder:text-fg-muted focus-visible:border-primary focus-visible:ring-primary/30 w-full rounded-lg border py-2.5 pr-3 pl-9 text-sm transition focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>

        <div className="flex items-center gap-3">
          <span className="text-fg-muted text-sm tabular-nums" aria-live="polite">
            {query
              ? `${shown} / ${total} ${isFr ? "articles" : "articles"}`
              : `${total} ${isFr ? "articles" : "articles"}`}
          </span>
          <label className="text-fg-muted inline-flex items-center gap-2 text-sm">
            <span className="sr-only sm:not-sr-only">{isFr ? "Trier" : "Sort"}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="border-border bg-paper text-fg focus-visible:border-primary focus-visible:ring-primary/30 rounded-lg border px-3 py-2 text-sm transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="recent">{isFr ? "Plus récents" : "Most recent"}</option>
              <option value="alpha">{isFr ? "A → Z" : "A → Z"}</option>
            </select>
          </label>
        </div>
      </div>

      {shown > 0 ? (
        // 3 colonnes max (cartes plus larges) — md/lg (on évite `sm:`, buggé ici).
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <li key={p.slug}>
              <ArticleCard
                href={`/${p.route}/${p.slug}`}
                title={p.title}
                excerpt={p.excerpt}
                publishedAt={p.publishedAt}
                readingTime={p.readingTime}
                imageUrl={p.featuredImage}
                imageAlt={p.featuredImageAlt}
                compact
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-soft border-border rounded-xl border border-dashed py-12 text-center text-sm">
          {isFr ? `Aucun article ne correspond à « ${query} ».` : `No article matches “${query}”.`}
        </p>
      )}
    </div>
  );
}
