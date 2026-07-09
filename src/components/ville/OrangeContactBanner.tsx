/**
 * OrangeContactBanner — Bandeau orange milieu de page (style home).
 *
 * Sprint Quality 2026 — Will 2026-05-25. À insérer au milieu des pages hub
 * et verticales pour relancer l'attention sur la prise de contact.
 *
 * 2 CTAs : Réserver un appel (/appel — futur Calendly) + Nous contacter (/contact — UnifiedContactForm).
 * Server Component pur, zéro JS.
 */

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { ArrowRight } from "lucide-react";

interface OrangeContactBannerProps {
  readonly isFr: boolean;
  /** Contexte ville pour tracking analytics. */
  readonly villeSlug?: string;
}

export function OrangeContactBanner({ isFr, villeSlug }: OrangeContactBannerProps) {
  const villeAttr = villeSlug ? { "data-source-ville": villeSlug } : {};
  return (
    <section
      aria-label={isFr ? "Démarrer un projet IA" : "Start an AI project"}
      className="bg-terracotta text-paper relative overflow-hidden py-14 sm:py-16 lg:py-20"
    >
      <Container>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center sm:gap-8">
          <p className="text-paper text-[13px] font-semibold tracking-[0.18em] uppercase">
            <span className="bg-paper/40 mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
            {isFr ? "Démarrer maintenant" : "Start now"}
          </p>
          <h2
            className="text-paper text-[clamp(1.875rem,4vw,3rem)] leading-[1.1] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Prêt à transformer votre " : "Ready to transform your "}
            <span className="italic">{isFr ? "entreprise avec l'IA ?" : "business with AI?"}</span>
          </h2>
          <p className="text-paper max-w-2xl text-base leading-relaxed sm:text-lg">
            {isFr
              ? "Chaque demande est lue personnellement par un consultant senior Axion-IA et reçoit une réponse cadrée sous 48 h ouvrées. Nous vous recontactons par téléphone ou par mail selon votre préférence — votre projet a notre entière attention."
              : "Chaque demande est lue personnellement par un consultant senior Axion-IA et reçoit une réponse cadrée sous 48 h ouvrées. Nous vous recontactons par téléphone ou par mail selon votre préférence — votre projet a notre entière attention."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={"/appel" as never}
              data-cta="orange_banner_book"
              {...villeAttr}
              className="bg-paper text-terracotta hover:bg-paper/90 focus-visible:ring-paper focus-visible:ring-offset-terracotta inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={"/contact" as never}
              data-cta="orange_banner_contact"
              {...villeAttr}
              className="text-paper border-paper/40 hover:bg-paper/10 focus-visible:ring-paper focus-visible:ring-offset-terracotta inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 px-7 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {isFr ? "Nous contacter" : "Contact us"}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
