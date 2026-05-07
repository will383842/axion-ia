// Server Component — schéma visuel du hero /blog.
// Stack de 3 mini-cards d'articles existants avec catégorie + reading time,
// effet "pile" en perspective légère pour suggérer "ligne éditoriale active".
//
// Doctrine : zéro fond (transparent). Accent terracotta (signature
// éditoriale ; le blog est neutre côté module-color cf. Design.md §2.6
// "Blog / transversales = Neutral", on utilise donc terracotta comme
// accent éditorial). Pas d'animation ; SSR-friendly. La data provient
// des 3 derniers BLOG_POSTS — reflète le vrai contenu publié (pas de
// fabrication, cohérent avec /presse anti-fabrication).

import type { ReactNode } from "react";
import { BookOpen, Lightbulb, Compass, Clock, type LucideIcon } from "lucide-react";

export interface BlogHeroSchemaProps {
  isFr: boolean;
  ariaLabel: string;
  className?: string;
  posts: ReadonlyArray<{
    slug: string;
    category: string;
    readingTime: string;
    title: string;
  }>;
}

// Mapping catégorie → icône lucide. Fallback BookOpen.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Méthodologie: Compass,
  Methodology: Compass,
  "Cas d'usage": Lightbulb,
  "Use cases": Lightbulb,
  Stratégie: BookOpen,
  Strategy: BookOpen,
};

export function BlogHeroSchema({
  isFr,
  ariaLabel,
  className,
  posts,
}: BlogHeroSchemaProps): ReactNode {
  const tiles = posts.slice(0, 3);
  return (
    <div role="img" aria-label={ariaLabel} className={className}>
      <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
        <span
          aria-hidden="true"
          className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
        />
        {isFr ? "Ligne éditoriale · 3 articles" : "Editorial line · 3 articles"}
      </p>

      {/* Stack de 3 cards — première en avant (lead), 2 autres secondaires */}
      <div className="space-y-3.5">
        {tiles.map((p, i) => {
          const Icon = CATEGORY_ICONS[p.category] ?? BookOpen;
          const isLead = i === 0;

          return (
            <article
              key={p.slug}
              className={
                isLead
                  ? "border-terracotta/40 bg-paper shadow-card relative rounded-2xl border-2 p-5 sm:p-6"
                  : "border-border-strong bg-paper shadow-subtle relative rounded-2xl border p-4 sm:p-5"
              }
            >
              <div className="flex items-start gap-4">
                <span
                  className={
                    isLead
                      ? "bg-terracotta-soft text-terracotta flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14"
                      : "bg-terracotta-soft text-terracotta flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11"
                  }
                >
                  <Icon
                    aria-hidden="true"
                    className={isLead ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5"}
                    strokeWidth={2.25}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-fg-muted mb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                    {p.category}
                  </p>
                  <p
                    className={
                      isLead
                        ? "text-fg line-clamp-2 text-base leading-snug font-bold sm:text-lg"
                        : "text-fg line-clamp-2 text-[14.5px] leading-snug font-bold sm:text-base"
                    }
                  >
                    {p.title}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-fg-soft flex items-center justify-end gap-1 text-[11px] leading-snug">
                    <Clock
                      aria-hidden="true"
                      className="text-terracotta h-3 w-3"
                      strokeWidth={2.5}
                    />
                    <span className="tabular-nums">{p.readingTime}</span>
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-fg-muted mt-4 text-center text-[12px]">
        {isFr ? "+ articles dans la ligne éditoriale ↓" : "+ articles in the editorial line ↓"}
      </p>
    </div>
  );
}
