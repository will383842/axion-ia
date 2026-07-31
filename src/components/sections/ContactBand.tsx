// Bandeau de contact terracotta GÉNÉRIQUE (Server Component, zéro JS).
//
// Calqué sur les *ContactBand de service (audit/implémentation), mais sans
// vocabulaire métier : utilisable sur les pages transverses (connaissances,
// blog, etc.). CTA canoniques : « Réserver un appel » (/appel) + « Nous
// écrire » (/contact). Tokens uniquement, aucun prix.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export interface ContactBandProps {
  readonly isFr?: boolean;
  /** Petit sur-titre (au-dessus du h2). */
  readonly eyebrow?: string;
  /** Début du titre (noir/paper). */
  readonly title: string;
  /** Fin du titre, en italique paper (accent). */
  readonly titleEm?: string;
  /** Phrase de soutien sous le titre. */
  readonly description?: string;
  /** Suffixe de tracking. */
  readonly track?: string;
}

export function ContactBand({
  isFr = true,
  eyebrow,
  title,
  titleEm,
  description,
  track = "",
}: ContactBandProps): ReactNode {
  return (
    <section className="bg-terracotta py-16 sm:py-20">
      <Container>
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="max-w-2xl">
            {/* ⚠️ PAS D'OPACITÉ sur le surtitre ci-dessous. `text-mocha-fg/75`
                sur le fond terracotta plein ne donnait que 3,63:1, sous le seuil
                AA de 4,5 — relevé par axe-core en production le 2026-07-31. À
                pleine opacité : 5,24:1. (`/90` passerait à 4,55, mais si près du
                seuil qu'un futur ajustement de palette le referait tomber.)
                La hiérarchie visuelle ne repose pas sur l'opacité : ce surtitre
                reste distingué du titre par sa taille (12 px), ses capitales et
                son interlettrage. */}
            {eyebrow ? (
              <p className="text-mocha-fg mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h2
              className="text-mocha-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {title}
              {titleEm ? (
                <>
                  {" "}
                  <span className="text-paper italic" style={{ fontFamily: "var(--font-serif)" }}>
                    {titleEm}
                  </span>
                </>
              ) : null}
            </h2>
            {description ? (
              <p className="text-mocha-fg/90 mt-3 text-base leading-relaxed sm:text-lg">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Cta
              href="/appel"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
              track={`contact-band-call${track}`}
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/contact"
              size="lg"
              className="bg-paper text-terracotta hover:bg-paper/95 shadow-subtle"
              track={`contact-band-contact${track}`}
            >
              {isFr ? "Nous écrire" : "Email us"}
            </Cta>
          </div>
        </div>
      </Container>
    </section>
  );
}
