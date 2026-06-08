// Server Component — FAQ recrutement. Items = FAQ fixe + Q locales (variables)
// assemblés par la page. Rendu en <details> natif (zéro JS, bon pour l'INP).
// Attributs data-faq-q / data-faq-a → captés par le Speakable AEO global.
// Le JSON-LD FAQPage est émis par la PAGE (à partir des mêmes items).

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Section } from "@/components/layout/Section";
import type { FaqItem } from "@/content/recrutement/commercial-offer";

export interface CommercialFaqProps {
  readonly isFr: boolean;
  readonly items: ReadonlyArray<FaqItem>;
}

export function CommercialFaq({ isFr, items }: CommercialFaqProps): ReactNode {
  return (
    <Section
      tone="canvas"
      eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
      title={isFr ? "Tout ce qu'il faut savoir" : "Everything you need to know"}
    >
      <div className="divide-border border-border divide-y border-t">
        {items.map((item, i) => (
          <details key={i} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <span data-faq-q className="text-fg text-lg font-medium">
                {isFr ? item.q.fr : item.q.en}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="text-fg-muted h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <p data-faq-a className="text-fg-soft mt-3 leading-relaxed">
              {isFr ? item.a.fr : item.a.en}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
