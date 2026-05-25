/**
 * SitesWebCtaBlock — CTA final dark mocha audit-centric (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/sites-web-augmentes/page.tsx` (l.475-520). Bloc final
 * sur fond mocha riche, orienté audit (« Démarrez par un audit de 2 h »).
 * 2 CTAs : Décrire mon projet (/contact) + Voir les niveaux d'audit (/audit).
 * Quand `villeContext` est fourni, le wording mentionne la ville.
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import type { VilleContext } from "@/components/services/types";

export interface SitesWebCtaBlockProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function SitesWebCtaBlock({ isFr, villeContext }: SitesWebCtaBlockProps): ReactNode {
  const eyebrow = villeContext
    ? isFr
      ? `Prêt à augmenter votre site à ${villeContext.name}`
      : `Ready to augment your site in ${villeContext.name}`
    : isFr
      ? "Prêt à augmenter votre site"
      : "Ready to augment your site";

  const description = villeContext
    ? isFr
      ? `On identifie les 3 points d'augmentation IA à plus fort ROI sur votre site web ou plateforme SaaS — pour les entreprises de ${villeContext.name} et sa région. Devis ferme 48 h, sans engagement.`
      : `We identify the 3 highest-ROI AI augmentation points on your website or SaaS platform — for ${villeContext.name}-area companies. Firm quote 48 h, no commitment.`
    : isFr
      ? "On identifie les 3 points d'augmentation IA à plus fort ROI sur votre site web ou plateforme SaaS. Devis ferme 48 h, sans engagement."
      : "We identify the 3 highest-ROI AI augmentation points on your website or SaaS platform. Firm quote 48 h, no commitment.";

  const villeAttr = villeContext ? { "data-source-ville": villeContext.villeSlug } : {};

  return (
    <section className="bg-mocha-rich py-16 sm:py-20">
      <Container className="max-w-2xl text-center">
        <p className="text-mocha-fg/60 mb-4 text-[12px] font-semibold tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <h2
          className="text-mocha-fg text-3xl leading-tight font-medium sm:text-4xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {isFr ? (
            <>
              Démarrez par <span className="italic">un audit de 2 h.</span>
            </>
          ) : (
            <>
              Start with <span className="italic">a 2-hour audit.</span>
            </>
          )}
        </h2>
        <p className="text-mocha-fg/70 mt-4 text-base leading-relaxed">{description}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={"/contact" as never}
            data-cta="sites-web-augmentes-cta-contact"
            {...villeAttr}
            className="bg-paper text-fg hover:bg-paper/90 focus-visible:ring-paper focus-visible:ring-offset-mocha-rich inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Décrire mon projet" : "Describe my project"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link
            href={"/audit" as never}
            data-cta="sites-web-augmentes-cta-audit"
            {...villeAttr}
            className="text-mocha-fg border-mocha-fg/30 hover:bg-mocha-fg/10 focus-visible:ring-mocha-fg focus-visible:ring-offset-mocha-rich inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 px-7 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Voir les niveaux d'audit" : "See audit levels"}
          </Link>
        </div>
      </Container>
    </section>
  );
}
