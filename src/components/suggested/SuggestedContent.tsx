/**
 * SuggestedContent — composant générique articles / villes / cas concrets connexes.
 *
 * V-14 sprint UX 2026-05-22 — consolide la logique dupliquée 4 routes
 * (/blog/[slug] related, /implantations/[region]/[ville] nearbyCases +
 * nearbyVilles + relatedPosts). Émet optionnellement un JSON-LD ItemList AEO.
 *
 * Doctrine :
 * - RSC pure (zero client JS) — toute interaction passe par <Link> Next.
 * - Pas de dep externe. Markup tailwind aligné design system Axion-IA.
 * - Variants visuels distincts (articles / cities / cases) mais API unifiée.
 * - Silence si items vide (anti-doorway HCU 2024).
 */

import Link from "next/link";
import type { Route } from "next";
import { Section, type SectionTone } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { SITE_URL } from "@/lib/seo";

export interface SuggestedItem {
  readonly href: string;
  readonly title: string;
  readonly excerpt?: string | undefined;
  /** Affiché en eyebrow uppercase (catégorie/secteur/région). */
  readonly meta?: string | undefined;
  /** Affiché en tabular nums (distance km, reading time, population). */
  readonly subMeta?: string | undefined;
  /** Métadonnées Article uniquement. */
  readonly publishedAt?: string | undefined;
  readonly readingTime?: string | undefined;
  readonly imageUrl?: string | undefined;
}

export type SuggestedVariant = "articles" | "cities" | "cases";

export interface SuggestedContentProps {
  readonly items: ReadonlyArray<SuggestedItem>;
  readonly variant: SuggestedVariant;
  readonly title: string;
  readonly eyebrow?: string;
  readonly titleEm?: string;
  readonly description?: string;
  readonly tone?: SectionTone;
  /** Émet JSON-LD ItemList AEO (V-14 gap audit 2026-05-22). */
  readonly emitJsonLd?: boolean;
  /** Tracking analytics data-cta-tracking. */
  readonly tracking?: string;
  /** dataset-* additionnels pour analytics tracking. */
  readonly trackingData?: Record<string, string>;
}

function buildItemListJsonLd(
  items: ReadonlyArray<SuggestedItem>,
  title: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    numberOfItems: items.length,
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: item.href.startsWith("http") ? item.href : `${SITE_URL}${item.href}`,
      name: item.title,
    })),
  };
}

export function SuggestedContent({
  items,
  variant,
  title,
  eyebrow,
  titleEm,
  description,
  tone = "sand",
  emitJsonLd = false,
  tracking,
  trackingData,
}: SuggestedContentProps) {
  if (items.length === 0) return null;

  const trackingAttrs = tracking
    ? {
        "data-cta-tracking": tracking,
        ...Object.fromEntries(Object.entries(trackingData ?? {}).map(([k, v]) => [`data-${k}`, v])),
      }
    : {};

  return (
    <>
      {emitJsonLd ? <JsonLd data={buildItemListJsonLd(items, title)} /> : null}
      <Section
        {...(eyebrow !== undefined ? { eyebrow } : {})}
        title={title}
        {...(titleEm !== undefined ? { titleEm } : {})}
        {...(description !== undefined ? { description } : {})}
        tone={tone}
      >
        <Container>
          {variant === "articles" ? (
            <ul className="xs:grid-cols-2 grid grid-cols-1 gap-5 md:grid-cols-3">
              {items.map((item) => (
                <li key={item.href}>
                  <ArticleCard
                    href={item.href as Route}
                    title={item.title}
                    excerpt={item.excerpt ?? ""}
                    publishedAt={item.publishedAt ?? ""}
                    readingTime={item.readingTime ?? ""}
                    compact
                    {...(item.imageUrl ? { imageUrl: item.imageUrl } : {})}
                  />
                </li>
              ))}
            </ul>
          ) : variant === "cities" ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href as Route}
                    {...trackingAttrs}
                    className="group hover:bg-sand focus-visible:ring-terracotta block rounded-lg px-3 py-2.5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <span
                      className="text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {item.title}
                    </span>
                    {item.subMeta ? (
                      <span className="text-fg-muted mt-0.5 block text-[11px] tabular-nums">
                        {item.subMeta}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href as Route}
                    {...trackingAttrs}
                    className="group bg-bg hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block h-full rounded-2xl border-2 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {item.meta || item.subMeta ? (
                      <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                        {[item.meta, item.subMeta].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    <p
                      className="text-fg mt-2 text-lg leading-tight font-semibold"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {item.title}
                    </p>
                    {item.excerpt ? (
                      <p className="text-fg-soft mt-3 line-clamp-3 text-sm leading-relaxed">
                        {item.excerpt}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </Section>
    </>
  );
}
