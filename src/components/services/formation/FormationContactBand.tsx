/**
 * FormationContactBand — bandeau terracotta d'orientation/contact (Server
 * Component). Calqué sur ImplementationContactBand, copie alignée sur le
 * bandeau inline déjà validé du hub `/interventions/collectives` (« Pas sûr·e
 * du bon format ? · On vous oriente, à votre rythme ») pour cohérence visuelle
 * et de ton sur toute la verticale formation.
 *
 * Zéro JS. AUCUN prix (les tarifs viennent de la SSOT pricing.ts, jamais ici).
 * FR canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export interface FormationContactBandProps {
  readonly isFr: boolean;
  /** Suffixe de tracking pour distinguer les multiples instances sur la page. */
  readonly trackSuffix?: string;
}

export function FormationContactBand({
  isFr,
  trackSuffix = "",
}: FormationContactBandProps): ReactNode {
  return (
    <section className="bg-terracotta py-16 sm:py-20">
      <Container>
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="max-w-2xl min-w-0">
            <p className="text-mocha-fg mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Pas sûr·e du bon format ?" : "Not sure which format?"}
            </p>
            <h2
              className="text-mocha-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "On vous oriente," : "We guide you,"}{" "}
              <span className="text-paper italic" style={{ fontFamily: "var(--font-serif)" }}>
                {isFr ? "à votre rythme" : "at your pace"}
              </span>
            </h2>
            <p className="text-mocha-fg/90 mt-3 text-base leading-relaxed sm:text-lg">
              {isFr
                ? "Un appel pour comprendre votre contexte, vous conseiller le format le plus adapté à vos équipes, et vous expliquer comment se déroule la formation. Sans engagement."
                : "A call to understand your context, advise the format that best fits your teams, and explain how the training unfolds. No commitment."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Cta
              href="/appel"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track={`formation-terracotta-band-call${trackSuffix}`}
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              size="lg"
              className="bg-paper text-terracotta hover:bg-paper/95 shadow-subtle"
              track={`formation-terracotta-band-contact${trackSuffix}`}
            >
              {isFr ? "Nous écrire" : "Email us"}
            </Cta>
          </div>
        </div>
      </Container>
    </section>
  );
}
