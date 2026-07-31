/**
 * AuditContactBand — bandeau terracotta d'orientation/contact (Server Component).
 *
 * Adapté du bandeau terracotta de `/un-a-un` (Will 2026-05-31) pour la page
 * audit : placé juste après la section « Nous, on la rend rentable ». Même
 * traitement visuel (fond terracotta, titre serif, CTA primary « Réserver un
 * appel » + CTA paper « Nous écrire »), copie calibrée audit (orienter vers
 * le bon niveau d'audit IA selon la taille).
 *
 * Zéro JS. FR canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export interface AuditContactBandProps {
  readonly isFr: boolean;
}

export function AuditContactBand({ isFr }: AuditContactBandProps): ReactNode {
  return (
    <section className="bg-terracotta py-16 sm:py-20">
      <Container>
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="max-w-2xl">
            <p className="text-mocha-fg mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Pas sûr·e du bon niveau d'audit IA ?" : "Not sure which AI audit level?"}
            </p>
            <h2
              className="text-mocha-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "On cadre votre audit IA," : "We scope your AI audit,"}{" "}
              <span className="text-paper italic" style={{ fontFamily: "var(--font-serif)" }}>
                {isFr ? "au bon niveau" : "at the right level"}
              </span>
            </h2>
            <p className="text-mocha-fg/90 mt-3 text-base leading-relaxed sm:text-lg">
              {isFr
                ? "Un appel pour comprendre votre contexte, vous dire quel audit IA vous correspond — du diagnostic ciblé à l'analyse globale de l'entreprise — et comment se déroule la mission. Sans engagement."
                : "A call to understand your context, tell you which AI audit fits — from a focused diagnosis to a company-wide deep dive — and how the engagement unfolds. No commitment."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Cta
              href="/appel"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track="audit-terracotta-band-call"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              size="lg"
              className="bg-paper text-terracotta hover:bg-paper/95 shadow-subtle"
              track="audit-terracotta-band-contact"
            >
              {isFr ? "Nous écrire" : "Email us"}
            </Cta>
          </div>
        </div>
      </Container>
    </section>
  );
}
