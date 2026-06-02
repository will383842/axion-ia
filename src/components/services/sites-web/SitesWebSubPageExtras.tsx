// Server Component — bloc « extras » de pied de page des landings sites-web/SaaS
// (/sites-web-augmentes/{slug}). Calqué sur ImplementationSubPageExtras :
//   1. Pages suggérées (briques sœurs + hub + cross-link audit)
//   2. Couverture nationale (LocalCoverageSection) → villes / pSEO
//   3. Connaissances liées (RelatedKnowledge, masqué si vide)
// AUCUN prix. FAQ rendue par ProductPageTemplate (pas de hideFaq ici).

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { getSitesWeb, type SitesWebSlug } from "@/content/sites-web";
import { SITESWEB_RELATED, SITESWEB_GEO_LABEL } from "@/content/sites-web-subpages";

export function SitesWebSubPageExtras({
  isFr,
  slug,
}: {
  isFr: boolean;
  slug: SitesWebSlug;
}): ReactNode {
  const geo = SITESWEB_GEO_LABEL[slug];

  const siblings = SITESWEB_RELATED[slug].map((rs) => {
    const r = getSitesWeb(rs);
    const rc = isFr ? r.fr : r.en;
    const label = [rc.title, rc.titleEm, rc.titleTail].filter(Boolean).join(" ").trim();
    return { href: isFr ? r.pathFr : r.pathEn, label, description: rc.answer };
  });

  const cards = [
    ...siblings,
    {
      href: "/sites-web-augmentes",
      label: isFr ? "Toutes les briques IA web" : "All AI web bricks",
      description: isFr
        ? "Chatbot, recherche, agents, personnalisation, plateforme native : voir l'ensemble de l'offre."
        : "Chatbot, search, agents, personalisation, native platform: see the whole offering.",
    },
    {
      href: "/audit",
      label: isFr ? "Commencer par un audit IA" : "Start with an AI audit",
      description: isFr
        ? "Cadrer le bon cas d'usage et le ROI avant d'intégrer, sans engagement sur la suite."
        : "Frame the right use case and ROI before integrating, with no commitment on what follows.",
    },
  ];

  return (
    <>
      <Section
        tone="paper"
        eyebrow={isFr ? "Pour aller plus loin" : "Go further"}
        title={isFr ? "Autres briques" : "Other bricks"}
        titleEm={isFr ? "& parcours" : "& paths"}
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

      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr={geo.fr}
        serviceLabelEn={geo.en}
        serviceSlug="sites-web-augmentes"
        tone="sand"
      />

      <RelatedKnowledge service="sites-web-augmentes" />
    </>
  );
}
