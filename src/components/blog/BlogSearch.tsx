"use client";
// use-client: useState + useEffect + useRef requis pour la palette Cmd+K interactive
// (binding clavier global, état ouvert/fermé, focus management). Aucun store
// global ni context — composant 100% local. Cf. doctrine V-02 P3 sprint UX 2026-05-22.

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";

export interface BlogSearchItem {
  readonly slug: string;
  readonly title: string;
  readonly category: string;
  readonly tags: ReadonlyArray<string>;
}

export interface BlogSearchProps {
  readonly items: ReadonlyArray<BlogSearchItem>;
  readonly placeholder?: string;
  readonly emptyLabel?: string;
  readonly triggerLabel?: string;
  readonly hrefBase?: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchScore(item: BlogSearchItem, query: string): number {
  if (query.length === 0) return 0;
  const q = normalize(query);
  const title = normalize(item.title);
  const cat = normalize(item.category);
  const tags = item.tags.map(normalize);
  // Score multi-source : title >> tags > category. Multiplie par position de match.
  let score = 0;
  if (title.includes(q)) {
    score += 100;
    if (title.startsWith(q)) score += 50;
  }
  for (const tag of tags) {
    if (tag.includes(q)) score += 30;
  }
  if (cat.includes(q)) score += 10;
  return score;
}

export function BlogSearch({
  items,
  placeholder = "Rechercher un article…",
  emptyLabel = "Aucun résultat",
  triggerLabel = "Rechercher",
  hrefBase = "/blog",
}: BlogSearchProps) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = (() => {
    if (query.trim().length === 0) return items.slice(0, 5);
    return [...items]
      .map((item) => ({ item, score: matchScore(item, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.item);
  })();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Focus input after dialog mount + reset state.
      requestAnimationFrame(() => inputRef.current?.focus());
      setActiveIdx(0);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const selected = results[activeIdx];
      if (selected) {
        window.location.href = `${hrefBase}/${selected.slug}`;
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border hover:border-terracotta focus-visible:ring-terracotta inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={triggerLabel}
      >
        <Search aria-hidden="true" className="h-4 w-4" />
        <span className="text-fg-muted">{triggerLabel}</span>
        <kbd className="border-border text-fg-muted bg-sand ml-2 rounded border px-1.5 py-0.5 text-[10px] tabular-nums">
          ⌘K
        </kbd>
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={triggerLabel}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-24"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="border-border w-full max-w-xl overflow-hidden rounded-xl border bg-white shadow-xl">
            <div className="border-border flex items-center gap-2 border-b px-4 py-3">
              <Search aria-hidden="true" className="text-fg-muted h-4 w-4" />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded={true}
                aria-controls={listId}
                aria-activedescendant={
                  results[activeIdx] ? `${listId}-${results[activeIdx].slug}` : undefined
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-fg-muted"
              />
              <kbd className="border-border text-fg-muted bg-sand rounded border px-1.5 py-0.5 text-[10px]">
                Esc
              </kbd>
            </div>
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto py-2">
              {results.length === 0 ? (
                <li className="text-fg-muted px-4 py-3 text-sm">{emptyLabel}</li>
              ) : (
                results.map((item, idx) => (
                  <li key={item.slug} role="option" aria-selected={idx === activeIdx}>
                    <Link
                      href={`${hrefBase}/${item.slug}` as Route}
                      id={`${listId}-${item.slug}`}
                      className={`block px-4 py-2.5 text-sm transition ${
                        idx === activeIdx ? "bg-sand text-fg" : "text-fg hover:bg-sand/50"
                      }`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => setOpen(false)}
                    >
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-fg-muted mt-0.5 text-xs">
                        {item.category}
                        {item.tags.length > 0 ? ` · ${item.tags.slice(0, 3).join(", ")}` : ""}
                      </p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
