// Server Component — grille « pages suggérées » des pages détail un-à-un
// (coaching individuel + dirigeant/Claude). Calqué sur FormationSubPageExtras,
// MAIS ne rend QUE le maillage « Voir aussi » : les templates un-à-un
// (IndividualCoachingPage / InterventionDetailPage) émettent déjà
// LocalCoverageSection + RelatedKnowledge inline → on ne les redouble pas.
// AUCUN prix.

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { UN_A_UN_PAGES, UN_A_UN_RELATED, type UnAUnDetailSlug } from "@/content/un-a-un-subpages";

export function UnAUnSubPageExtras({
  isFr,
  slug,
}: {
  isFr: boolean;
  slug: UnAUnDetailSlug;
}): ReactNode {
  // 3 accompagnements sœurs (distincts par page) + 1 cross-link audit (funnel amont).
  const siblings = UN_A_UN_RELATED[slug].map((rs) => {
    const p = UN_A_UN_PAGES[rs];
    return {
      href: p.href,
      label: isFr ? p.labelFr : p.labelEn,
      description: isFr ? p.descFr : p.descEn,
    };
  });
  const cards = [
    ...siblings,
    {
      href: "/audit",
      label: isFr ? "Commencer par un audit IA" : "Start with an AI audit",
      description: isFr
        ? "Cadrer les bons usages et le ROI avant de vous lancer, sans engagement sur la suite."
        : "Frame the right uses and ROI before getting started, with no commitment on what follows.",
    },
  ];

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Autres accompagnements 1-to-1" : "Other 1-to-1 support"}
      title={isFr ? "Pour aller" : "Go"}
      titleEm={isFr ? "plus loin" : "further"}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href as never}
            className="border-border bg-bg hover:border-terracotta hover:shadow-card focus-visible:ring-terracotta flex h-full flex-col rounded-2xl border p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <p className="text-fg text-[15px] leading-snug font-semibold">{c.label}</p>
            <p className="text-fg-soft mt-2 line-clamp-2 flex-1 text-sm leading-relaxed">
              {c.description}
            </p>
            <span className="text-terracotta-deep mt-4 inline-flex items-center gap-1 text-[13px] font-medium">
              {isFr ? "Découvrir" : "Discover"}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
