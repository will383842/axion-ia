import * as React from "react";
import { GraduationCap, UserRound, Search, Cog, Globe, ArrowUpRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { SERVICES, serviceOfficial, type ServiceId } from "@/content/services";

// Strip compact « 5 activités Axion-IA » pour l'espace presse.
//
// Source des noms = SSOT `src/content/services.ts` (officialFr/officialEn) —
// JAMAIS de libellé de service en dur (cf. doctrine services.ts). Les hrefs sont
// les routes hub canoniques. Les blurbs (1 ligne descriptive) sont passés en
// props depuis l'i18n (`press` namespace) → éditables sans toucher au composant.
//
// Server component, zéro JS client (budget Web Vitals). Hauteur de carte stable
// (contenu statique) → 0 CLS. Cibles tactiles ≥ 44px, grille mobile-first.

type HrefProp = React.ComponentProps<typeof Link>["href"];

/** Icône lucide par activité (cohérence visuelle home/footer). */
const ACTIVITY_ICON: Record<ServiceId, React.ComponentType<{ className?: string }>> = {
  formations: GraduationCap,
  unAUn: UserRound,
  audit: Search,
  implementation: Cog,
  sitesWeb: Globe,
};

interface PressActivitiesStripProps {
  isFr: boolean;
  /** Phrase descriptive courte (1 ligne) par activité — i18n, sourcée. */
  blurbs: Record<ServiceId, string>;
  /** Libellé accessible du lien (ex. « Découvrir »). */
  discoverLabel: string;
}

export function PressActivitiesStrip({ isFr, blurbs, discoverLabel }: PressActivitiesStripProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {SERVICES.map((service) => {
        const Icon = ACTIVITY_ICON[service.id];
        const name = serviceOfficial(service, isFr);
        return (
          <li key={service.id} className="flex">
            <Link
              href={service.href as HrefProp}
              aria-label={`${discoverLabel} : ${name}`}
              className="group border-border bg-paper hover:border-terracotta focus-visible:ring-terracotta flex min-h-[44px] w-full flex-col rounded-xl border p-5 transition hover:shadow-[var(--shadow-subtle)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span className="bg-terracotta-soft text-terracotta-deep mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-fg flex items-start justify-between gap-2 text-sm leading-tight font-semibold">
                {name}
                <ArrowUpRight
                  className="text-fg-muted group-hover:text-terracotta h-4 w-4 shrink-0 transition"
                  aria-hidden="true"
                />
              </span>
              <span className="text-fg-soft mt-2 text-xs leading-relaxed">
                {blurbs[service.id]}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
