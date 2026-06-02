/**
 * KbSources — section « Sources / références » des pages `/connaissances/[slug]`.
 *
 * Liste explicite des sources citées (extraites du body par `extractSources`) :
 * signal E-E-A-T + citabilité GEO/AEO (les moteurs génératifs reprennent les
 * sources structurées). Les sources liées pointent vers l'externe en
 * `rel="nofollow noopener"` (pas de fuite de jus SEO vers des tiers).
 *
 * Server Component pur — 0 JS client. Tokens couleur uniquement.
 * Masqué côté page si la liste est vide (anti-doorway).
 */

import type { SourceRef } from "@/lib/knowledge/article-enrich";

interface KbSourcesProps {
  readonly sources: ReadonlyArray<SourceRef>;
}

export function KbSources({ sources }: KbSourcesProps) {
  if (sources.length === 0) return null;
  return (
    <section
      aria-labelledby="kb-sources-title"
      data-aeo="sources"
      className="border-border mt-12 border-t pt-8"
    >
      <h2
        id="kb-sources-title"
        className="text-fg mb-5 text-lg font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Sources <span className="text-terracotta italic">&amp; références</span>
      </h2>
      <ol className="text-fg-soft flex flex-col gap-2.5 text-[15px] leading-relaxed">
        {sources.map((s, i) => (
          <li key={s.href ?? `${i}-${s.label}`} className="flex gap-3">
            <span aria-hidden="true" className="text-terracotta-deep font-medium tabular-nums">
              {i + 1}.
            </span>
            {s.href ? (
              <a
                href={s.href}
                rel="nofollow noopener"
                target="_blank"
                className="text-terracotta-deep hover:text-terracotta underline-offset-2 hover:underline"
              >
                {s.label}
              </a>
            ) : (
              <span>{s.label}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
