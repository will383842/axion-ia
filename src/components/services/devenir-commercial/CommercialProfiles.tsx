// Server Component — « Les profils qu'on recherche » (PARCOURS). Porte la
// réassurance « vous gardez votre portefeuille ». Icônes + cartes accentuées.

import type { ReactNode } from "react";
import { Briefcase, RefreshCw, Network, Sparkles, CheckCircle2 } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { COMMERCIAL_PROFILES } from "@/content/recrutement/commercial-offer";

export interface CommercialProfilesProps {
  readonly isFr: boolean;
}

const PROFILE_ICONS = [Briefcase, RefreshCw, Network, Sparkles] as const;

export function CommercialProfiles({ isFr }: CommercialProfilesProps): ReactNode {
  return (
    <Section
      tone="canvas"
      eyebrow={isFr ? "Profils recherchés" : "Who we're looking for"}
      title={isFr ? COMMERCIAL_PROFILES.title.fr : COMMERCIAL_PROFILES.title.en}
      description={isFr ? COMMERCIAL_PROFILES.intro.fr : COMMERCIAL_PROFILES.intro.en}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {COMMERCIAL_PROFILES.items.map((p, i) => {
          const Icon = PROFILE_ICONS[i % PROFILE_ICONS.length]!;
          return (
            <div
              key={i}
              className="border-border bg-bg hover:border-terracotta/30 hover:shadow-card flex gap-4 rounded-2xl border p-6 transition-all"
            >
              <span className="bg-terracotta-soft text-terracotta-deep flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-fg text-lg font-semibold tracking-tight">
                  {isFr ? p.titleFr : p.titleEn}
                </h3>
                <p className="text-fg-soft mt-2 leading-relaxed">{isFr ? p.descFr : p.descEn}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Réassurance « vous gardez votre portefeuille » */}
      <div className="border-terracotta/25 bg-halo-warm mt-8 flex items-start gap-4 rounded-2xl border-2 p-6 sm:p-7">
        <CheckCircle2 aria-hidden="true" className="text-terracotta-deep mt-0.5 h-6 w-6 shrink-0" />
        <p className="text-terracotta-deep text-lg leading-relaxed font-medium">
          {isFr ? COMMERCIAL_PROFILES.reassurance.fr : COMMERCIAL_PROFILES.reassurance.en}
        </p>
      </div>
    </Section>
  );
}
