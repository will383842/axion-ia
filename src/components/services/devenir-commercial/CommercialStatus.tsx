// Server Component — « Statut indépendant ». Cadre volontairement vague (Will
// 2026-06-08 : pas de cadre juridique précis affiché, à affiner avec un juriste).
// Contenu FIXE.

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { COMMERCIAL_STATUS } from "@/content/recrutement/commercial-offer";

export interface CommercialStatusProps {
  readonly isFr: boolean;
}

export function CommercialStatus({ isFr }: CommercialStatusProps): ReactNode {
  return (
    <Section tone="canvas">
      <div className="border-terracotta/15 bg-halo-warm rounded-3xl border-2 p-8 sm:p-12">
        <h2
          className="text-fg text-[clamp(1.6rem,3vw,2.4rem)] leading-tight font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {isFr ? COMMERCIAL_STATUS.title.fr : COMMERCIAL_STATUS.title.en}
        </h2>
        <p className="text-fg-soft mt-5 max-w-3xl text-lg leading-relaxed">
          {isFr ? COMMERCIAL_STATUS.text.fr : COMMERCIAL_STATUS.text.en}
        </p>
      </div>
    </Section>
  );
}
