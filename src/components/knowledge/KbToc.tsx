/**
 * KbToc — sommaire (table des matières) des longs guides `/connaissances/[slug]`.
 *
 * Rendu uniquement quand `buildToc` détecte ≥ 3 `<h2>` (sinon `items` vide →
 * composant masqué : anti-doorway, une entrée courte n'affiche pas de TOC).
 * Les ancres pointent vers les `id` injectés sur les h2 par `buildToc`.
 *
 * Server Component pur — ancres `#` natives, 0 JS client. Tokens uniquement.
 */

import type { TocItem } from "@/lib/knowledge/article-enrich";

interface KbTocProps {
  readonly items: ReadonlyArray<TocItem>;
}

export function KbToc({ items }: KbTocProps) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Sommaire"
      className="bg-sand/60 border-terracotta mb-9 rounded-2xl border-l-4 px-6 py-5"
    >
      <p className="text-terracotta-deep mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
        Sommaire
      </p>
      <ol className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={item.id} className="flex gap-3 text-[15px] leading-snug">
            <span aria-hidden="true" className="text-terracotta tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <a
              href={`#${item.id}`}
              className="text-fg-soft hover:text-terracotta-deep underline-offset-2 hover:underline"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
