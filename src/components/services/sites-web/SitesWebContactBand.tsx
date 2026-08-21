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
  /**
   * Deux placements, deux messages (évite la répétition) :
   * `scope` (par défaut) = orienter vers la bonne brique ; `quote` = passer au
   * devis après la preuve sociale.
   */
  readonly variant?: "scope" | "quote";
}

export function SitesWebContactBand({
  isFr,
  variant = "scope",
}: SitesWebContactBandProps): ReactNode {
  const copy =
    variant === "quote"
      ? {
          eyebrow: isFr ? "Prêt·e à augmenter votre site ?" : "Ready to augment your site?",
          titleA: isFr ? "Un devis ferme," : "A firm quote,",
          titleB: isFr ? "sous 24-48 h" : "in 24-48 h",
          desc: isFr
            ? "Décrivez votre site ou votre projet : on revient sous 24-48 h (selon la complexité) avec un périmètre précis, un forfait fixe et un délai garanti. Forfait fixe, pas de régie, code et données à vous."
            : "Describe your site or project: we come back in 24-48 h (depending on complexity) with a precise scope, a fixed fee and a guaranteed timeline. Fixed fee, no time-and-materials, code and data yours.",
        }
      : {
          eyebrow: isFr ? "Pas sûr·e par où commencer ?" : "Not sure where to start?",
          titleA: isFr ? "On cadre votre projet web IA," : "We scope your AI web project,",
          titleB: isFr ? "au bon niveau" : "at the right level",
          desc: isFr
            ? "Un échange pour comprendre votre site, votre stack et vos objectifs — et vous dire ce qui a le plus d'impact : un chatbot RAG greffé, du search sémantique, ou une plateforme IA-native. Sans engagement."
            : "A chat to understand your site, stack and goals — and tell you what has the most impact: a grafted RAG chatbot, semantic search, or an AI-native platform. No commitment.",
        };

  return (
    <section className="bg-terracotta py-16 sm:py-20">
      <Container>
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="max-w-2xl">
            <p className="text-mocha-fg mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
              {copy.eyebrow}
            </p>
            <h2
              className="text-mocha-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {copy.titleA}{" "}
              <span className="text-paper italic" style={{ fontFamily: "var(--font-serif)" }}>
                {copy.titleB}
              </span>
            </h2>
            <p className="text-mocha-fg/90 mt-3 text-base leading-relaxed sm:text-lg">
              {copy.desc}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <Cta
              href="/contact"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track="sites-web-terracotta-band-contact"
            >
              {isFr
                ? "Décrire mon projet · devis sous 24-48 h"
                : "Describe my project · quote in 24-48 h"}
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
