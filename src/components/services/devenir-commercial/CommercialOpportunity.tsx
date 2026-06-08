// Server Component — « L'opportunité ». Layout 2 colonnes calqué sur
// AuditWhyAudit (/audit) : titre + texte à GAUCHE, encart sombre à DROITE
// (Will 2026-06-08). Reframe « faire connaître » (pas de pression de closing) +
// modèle de paiement tracé. Contenu FIXE.

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { COMMERCIAL_OPPORTUNITY } from "@/content/recrutement/commercial-offer";

export interface CommercialOpportunityProps {
  readonly isFr: boolean;
}

export function CommercialOpportunity({ isFr }: CommercialOpportunityProps): ReactNode {
  const o = COMMERCIAL_OPPORTUNITY;
  const paragraphs = isFr ? o.paragraphs.fr : o.paragraphs.en;
  return (
    <Section tone="canvas" className="py-16 sm:py-20 lg:py-24">
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Colonne gauche — eyebrow + titre + paragraphes */}
        <div>
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? o.eyebrow.fr : o.eyebrow.en}
          </p>
          <h2 className="text-fg mt-5 text-[clamp(2rem,4vw,3.25rem)] leading-[1.06] font-semibold tracking-tight">
            {isFr ? o.title.fr : o.title.en}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? o.titleEm.fr : o.titleEm.en}
            </span>
          </h2>
          <div className="mt-5 space-y-4">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-fg-soft max-w-xl text-lg leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </div>

        {/* Colonne droite — encart sombre (modèle de paiement) */}
        <div className="bg-mocha-rich text-mocha-fg shadow-card rounded-3xl px-7 py-8 sm:px-9 sm:py-10">
          <p className="text-terracotta-soft text-[12px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? o.darkCard.label.fr : o.darkCard.label.en}
          </p>
          <p
            className="mt-4 text-[clamp(1.5rem,2.6vw,2.1rem)] leading-snug font-semibold"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? o.darkCard.headline.fr : o.darkCard.headline.en}
          </p>
          <p className="text-mocha-fg/85 mt-5 text-base leading-relaxed">
            {isFr ? o.darkCard.sub.fr : o.darkCard.sub.en}
          </p>
        </div>
      </div>
    </Section>
  );
}
