// Server Component — « L'opportunité » : marché IA énorme + financement (cadré
// honnêtement). L'encart sombre (« argument du commercial ») est désormais une
// bande pleine largeur SOUS le texte (placement intentionnel, façon /audit &
// /implementation), au lieu d'un aside flottant à droite. Contenu FIXE.

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
    <Section
      tone="canvas"
      eyebrow={isFr ? o.eyebrow.fr : o.eyebrow.en}
      title={isFr ? o.title.fr : o.title.en}
      titleEm={isFr ? o.titleEm.fr : o.titleEm.en}
    >
      <div className="max-w-3xl space-y-5">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-fg-soft text-lg leading-relaxed">
            {p}
          </p>
        ))}
      </div>

      {/* Encart sombre pleine largeur — l'argument que LE COMMERCIAL utilisera */}
      <div className="bg-mocha-rich text-mocha-fg mt-10 grid gap-6 rounded-3xl p-8 sm:p-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-terracotta-soft text-[12px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? o.darkCard.label.fr : o.darkCard.label.en}
          </p>
          <p
            className="mt-4 text-[clamp(1.5rem,2.6vw,2.1rem)] leading-snug font-semibold"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? o.darkCard.headline.fr : o.darkCard.headline.en}
          </p>
        </div>
        <p className="text-mocha-fg/85 text-base leading-relaxed lg:text-lg">
          {isFr ? o.darkCard.sub.fr : o.darkCard.sub.en}
        </p>
      </div>
    </Section>
  );
}
