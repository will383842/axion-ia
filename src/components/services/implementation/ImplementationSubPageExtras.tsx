// Server Component — bloc « extras » commun aux 9 sous-pages /implementation/*.
// Mutualise, sans toucher au ProductPageTemplate partagé (Modules 1/2/3) :
//   1. HowTo JSON-LD dérivé du process (signal AEO « comment déployer X »)
//   2. Pages suggérées (3 sous-services frères distincts + cross-link audit)
//   3. Couverture nationale (LocalCoverageSection) → visibilité villes / pSEO
//   4. Connaissances liées (RelatedKnowledge, masqué si vide)
//
// Placé en pied de chaque sous-page, après ProductPageTemplate.

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Link } from "@/i18n/navigation";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { getImplementation, type ImplementationSlug } from "@/content/implementation";
import {
  IMPLEMENTATION_RELATED,
  IMPLEMENTATION_GEO_LABEL,
} from "@/content/implementation-subpages";
import { buildImplementationHowToJsonLd } from "@/lib/seo-implementation";

export function ImplementationSubPageExtras({
  isFr,
  slug,
}: {
  isFr: boolean;
  slug: ImplementationSlug;
}): ReactNode {
  const locale = isFr ? "fr" : "en";
  const self = getImplementation(slug);
  const copy = isFr ? self.fr : self.en;
  const path = isFr ? self.pathFr : self.pathEn;
  const geo = IMPLEMENTATION_GEO_LABEL[slug];

  const howToJsonLd = buildImplementationHowToJsonLd({ locale, path, copy });

  // 3 sous-services frères (distincts par page) + 1 cross-link audit (funnel).
  const siblings = IMPLEMENTATION_RELATED[slug].map((rs) => {
    const r = getImplementation(rs);
    const rc = isFr ? r.fr : r.en;
    return {
      href: isFr ? r.pathFr : r.pathEn,
      label: rc.title,
      description: rc.answer,
    };
  });
  const cards = [
    ...siblings,
    {
      href: "/audit",
      label: isFr ? "Commencer par un audit IA" : "Start with an AI audit",
      description: isFr
        ? "Cadrer le bon cas d'usage et le ROI avant d'implémenter, sans engagement sur la suite."
        : "Frame the right use case and ROI before implementing, with no commitment on what follows.",
    },
  ];

  return (
    <>
      <JsonLd data={howToJsonLd} />

      {/* Pages suggérées — maillage interne « Voir aussi » (4 cartes distinctes) */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Pages suggérées" : "Suggested pages"}
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

      {/* Couverture nationale — visibilité villes / pSEO (sujet exact de la page) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr={geo.fr}
        serviceLabelEn={geo.en}
        serviceSlug="implementation"
        tone="sand"
      />

      {/* Connaissances liées — KB V4.1 Service Binding (masqué si vide) */}
      <RelatedKnowledge service="implementation" />
    </>
  );
}
