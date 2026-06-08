// Server Component — « L'état d'esprit qu'on recherche » (l'ATTITUDE ; les
// parcours sont dans CommercialProfiles). Contenu FIXE.

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { COMMERCIAL_MINDSET } from "@/content/recrutement/commercial-offer";

export interface CommercialMindsetProps {
  readonly isFr: boolean;
}

export function CommercialMindset({ isFr }: CommercialMindsetProps): ReactNode {
  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "L'état d'esprit" : "The mindset"}
      title={isFr ? COMMERCIAL_MINDSET.title.fr : COMMERCIAL_MINDSET.title.en}
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COMMERCIAL_MINDSET.items.map((item, i) => (
          <li
            key={i}
            className="border-border bg-bg flex items-center gap-3 rounded-xl border px-4 py-3.5"
          >
            <span className="bg-sage-soft text-sage flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
              <Check aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="text-fg font-medium">{isFr ? item.fr : item.en}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
