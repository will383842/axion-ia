/**
 * SitesWebContactBand — bandeau terracotta d'orientation/contact (Server Component).
 *
 * Fusion 2026-06-01 (Will) — adapté du `AuditContactBand` (template /audit) pour
 * la page Sites web & SaaS IA : même traitement visuel (fond terracotta, titre
 * serif, CTA primary bleu + CTA paper), copie orientée projet web.
 *
 * Zéro JS. FR canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export interface SitesWebContactBandProps {
  readonly isFr: boolean;
}

export function SitesWebContactBand({ isFr }: SitesWebContactBandProps): ReactNode {
  return (
    <section className="bg-terracotta py-16 sm:py-20">
      <Container>
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="max-w-2xl">
            <p className="text-mocha-fg/75 mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Pas sûr·e par où commencer ?" : "Not sure where to start?"}
            </p>
            <h2
              className="text-mocha-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "On cadre votre projet web IA," : "We scope your AI web project,"}{" "}
              <span className="text-paper italic" style={{ fontFamily: "var(--font-serif)" }}>
                {isFr ? "au bon niveau" : "at the right level"}
              </span>
            </h2>
            <p className="text-mocha-fg/90 mt-3 text-base leading-relaxed sm:text-lg">
              {isFr
                ? "Un échange pour comprendre votre site, votre stack et vos objectifs — et vous dire ce qui a le plus d'impact : un chatbot RAG greffé, du search sémantique, ou une plateforme IA-native. Devis ferme 48 h, sans engagement."
                : "A chat to understand your site, stack and goals — and tell you what has the most impact: a grafted RAG chatbot, semantic search, or an AI-native platform. Firm quote 48 h, no commitment."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Cta
              href="/contact"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track="sites-web-terracotta-band-contact"
            >
              {isFr ? "Décrire mon projet · devis 48 h" : "Describe my project · quote 48 h"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/appel"
              size="lg"
              className="bg-paper text-terracotta hover:bg-paper/95 shadow-subtle"
              track="sites-web-terracotta-band-call"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
            </Cta>
          </div>
        </div>
      </Container>
    </section>
  );
}
