/**
 * ImplementationContactBand — bandeau terracotta d'orientation/contact (Server
 * Component). Calqué sur AuditContactBand, copie adaptée implémentation : on
 * cadre le bon projet (du chatbot à l'agent connecté à vos outils).
 *
 * Zéro JS. Aucun prix. FR canonique — EN = miroir (locale 301→FR, règle Will
 * 2026-05-16).
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export interface ImplementationContactBandProps {
  readonly isFr: boolean;
  /** Suffixe de tracking pour distinguer les multiples instances sur la page. */
  readonly trackSuffix?: string;
}

export function ImplementationContactBand({
  isFr,
  trackSuffix = "",
}: ImplementationContactBandProps): ReactNode {
  return (
    <section className="bg-terracotta py-16 sm:py-20">
      <Container>
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="max-w-2xl">
            <p className="text-mocha-fg mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Une idée d'automatisation en tête ?" : "An automation idea in mind?"}
            </p>
            <h2
              className="text-mocha-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "On cadre votre projet IA," : "We scope your AI project,"}{" "}
              <span className="text-paper italic" style={{ fontFamily: "var(--font-serif)" }}>
                {isFr ? "au bon niveau" : "at the right level"}
              </span>
            </h2>
            <p className="text-mocha-fg/90 mt-3 text-base leading-relaxed sm:text-lg">
              {isFr
                ? "Un appel pour comprendre votre besoin, vous dire ce qui est réalisable — du chatbot à l'agent IA connecté à vos outils — et comment on s'y prend. Sans engagement."
                : "A call to understand your need, tell you what's feasible — from a chatbot to an AI agent wired into your tools — and how we go about it. No commitment."}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <Cta
              href="/appel"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track={`impl-terracotta-band-call${trackSuffix}`}
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              size="lg"
              className="bg-paper text-terracotta hover:bg-paper/95 shadow-subtle"
              track={`impl-terracotta-band-contact${trackSuffix}`}
            >
              {isFr ? "Nous écrire" : "Email us"}
            </Cta>
          </div>
        </div>
      </Container>
    </section>
  );
}
