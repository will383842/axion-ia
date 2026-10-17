/**
 * SitesWebCtaBlock — CTA final dark mocha orienté contact (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/sites-web-augmentes/page.tsx`. Bloc final sur fond mocha
 * riche. 2026-06-04 (Will) : dé-audit-isé — un prospect web ne doit pas être
 * renvoyé vers /audit (prix 1190 € = TPE only). CTA = règle contact globale :
 * « Réserver un appel » (/appel) + « Nous écrire » (/contact).
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
      ? `On identifie les 3 points d'augmentation IA à plus fort ROI sur votre site web ou plateforme SaaS — pour les entreprises de ${villeContext.name} et sa région. Devis ferme sous 24-48 h selon la complexité, sans engagement.`
      : `We identify the 3 highest-ROI AI augmentation points on your website or SaaS platform — for ${villeContext.name}-area companies. Firm quote in 24-48 h depending on complexity, no commitment.`
    : isFr
      ? "On identifie les 3 points d'augmentation IA à plus fort ROI sur votre site web ou plateforme SaaS. Devis ferme sous 24-48 h selon la complexité, sans engagement."
      : "We identify the 3 highest-ROI AI augmentation points on your website or SaaS platform. Firm quote in 24-48 h depending on complexity, no commitment.";

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
              Parlons de <span className="italic">votre projet.</span>
            </>
          ) : (
            <>
              Let&apos;s talk <span className="italic">about your project.</span>
            </>
          )}
        </h2>
        <p className="text-mocha-fg/70 mt-4 text-base leading-relaxed">{description}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={"/appel" as never}
            data-cta="sites-web-augmentes-cta-appel"
            {...villeAttr}
            className="bg-paper text-fg hover:bg-paper/90 focus-visible:ring-paper focus-visible:ring-offset-mocha-rich inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Réserver un appel" : "Book a call"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link
            href={"/contact" as never}
            data-cta="sites-web-augmentes-cta-contact"
            {...villeAttr}
            className="text-mocha-fg border-mocha-fg/30 hover:bg-mocha-fg/10 focus-visible:ring-mocha-fg focus-visible:ring-offset-mocha-rich inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 px-7 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Nous écrire" : "Email us"}
          </Link>
        </div>
      </Container>
    </section>
  );
}
