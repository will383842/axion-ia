// Server Component — bandeau terracotta de conversion recrutement. Calqué sur
// AuditContactBand mais avec UN SEUL CTA (décision Will 2026-06-08) pointant
// vers la page candidature indexable. Zéro JS.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export interface CommercialContactBandProps {
  readonly isFr: boolean;
  /** Suffixe de tracking pour distinguer les 2 instances (mid / final). */
  readonly trackSuffix?: string;
}

export function CommercialContactBand({
  isFr,
  trackSuffix = "",
}: CommercialContactBandProps): ReactNode {
  return (
    <section className="bg-terracotta py-16 sm:py-20">
      <Container>
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="max-w-2xl">
            <p className="text-mocha-fg mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Prêt·e à vous lancer ?" : "Ready to get started?"}
            </p>
            <h2
              className="text-mocha-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Devenez commercial Axion-IA," : "Become an Axion-IA sales rep,"}{" "}
              <span className="text-paper italic" style={{ fontFamily: "var(--font-serif)" }}>
                {isFr ? "à votre rythme" : "at your own pace"}
              </span>
            </h2>
            <p className="text-mocha-fg/90 mt-3 text-base leading-relaxed sm:text-lg">
              {isFr
                ? "Quelques informations suffisent pour postuler. Statut indépendant, produits financés faciles à vendre, revenus déplafonnés — et démarrer ne vous coûte rien."
                : "A few details are enough to apply. Self-employed status, easy-to-sell funded products, uncapped income — and getting started costs you nothing."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Cta
              href="/devenir-commercial-ia/candidature"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track={`commercial-band-apply${trackSuffix}`}
            >
              {isFr
                ? "Je veux des renseignements pour devenir commercial Axion-IA"
                : "I want details on becoming an Axion-IA sales rep"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
          </div>
        </div>
      </Container>
    </section>
  );
}
