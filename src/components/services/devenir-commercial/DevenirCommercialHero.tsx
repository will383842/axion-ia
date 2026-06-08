// Server Component — Hero de la page recrutement commerciaux. Réutilise le
// wrapper `ServiceHero` (hero 2 colonnes + schéma orbital SVG) comme /audit et
// /implementation. Le titre intègre la ville (partie VARIABLE anti-doorway) ;
// le reste du contenu vient de `commercial-offer.ts` (FIXE).
//
// 1 seul CTA (décision Will 2026-06-08) → page candidature indexable.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { Cta } from "@/components/marketing/Cta";
import { COMMERCIAL_HERO, COMMERCIAL_HERO_NODES } from "@/content/recrutement/commercial-offer";

export interface DevenirCommercialHeroProps {
  readonly isFr: boolean;
  /** Nom affichable de la ville (ex « Grenoble »). Absent → page France générique. */
  readonly villeName?: string | undefined;
}

export function DevenirCommercialHero({ isFr, villeName }: DevenirCommercialHeroProps): ReactNode {
  // Titre VARIABLE : « Devenez commercial IA à Grenoble » / « … partout en France ».
  const title = villeName
    ? isFr
      ? `${COMMERCIAL_HERO.titleFr} ${villeName} et alentours`
      : `${COMMERCIAL_HERO.titleEnPrefix} ${villeName} and nearby`
    : isFr
      ? "Devenez commercial IA partout en France"
      : "Become an AI sales rep across France";

  const nodes = COMMERCIAL_HERO_NODES.map((n) => ({
    label: n.label,
    benefit: isFr ? n.benefit : n.benefitEn,
    accent: n.accent,
  }));

  return (
    <ServiceHero
      eyebrow={isFr ? COMMERCIAL_HERO.eyebrow.fr : COMMERCIAL_HERO.eyebrow.en}
      title={title}
      titleEm={isFr ? COMMERCIAL_HERO.titleEm.fr : COMMERCIAL_HERO.titleEm.en}
      description={isFr ? COMMERCIAL_HERO.description.fr : COMMERCIAL_HERO.description.en}
      schemaCenterLabel={isFr ? "Vous, commercial" : "You, the rep"}
      schemaNodes={nodes}
      schemaAriaLabel={isFr ? COMMERCIAL_HERO.ariaLabel.fr : COMMERCIAL_HERO.ariaLabel.en}
      ctas={
        <Cta
          href="/devenir-commercial-ia/candidature"
          size="lg"
          className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
          track="commercial-hero-apply"
        >
          {isFr ? COMMERCIAL_HERO.ctaLabel.fr : COMMERCIAL_HERO.ctaLabel.en}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Cta>
      }
    />
  );
}
