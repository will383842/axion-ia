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
    // 5 activités sur UNE seule ligne dès `md` (≥768px) puis maintenues à 5 sur
    // desktop (demande Will 2026-06-23). 2 colonnes en deçà pour rester lisible.
    // Server component, zéro JS client, hauteurs de carte égales (items-stretch).
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {SERVICES.map((service, idx) => {
        const Icon = ACTIVITY_ICON[service.id];
        const name = serviceOfficial(service, isFr);
        return (
          <li key={service.id} className="flex">
            <Link
              href={service.href as HrefProp}
              aria-label={`${discoverLabel} : ${name}`}
              className="group border-border bg-paper hover:border-terracotta focus-visible:ring-terracotta relative flex w-full flex-col overflow-hidden rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {/* Liseré d'accent supérieur révélé au survol */}
              <span
                aria-hidden="true"
                className="bg-terracotta absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100"
              />
              <span className="mb-4 flex items-center justify-between">
                <span className="bg-terracotta-soft text-terracotta-deep group-hover:bg-terracotta group-hover:text-paper inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-fg-muted font-serif text-2xl leading-none font-semibold tabular-nums opacity-30 select-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </span>
              <span className="text-fg flex items-start justify-between gap-2 text-[15px] leading-tight font-semibold">
                {name}
                <ArrowUpRight
                  className="text-fg-muted group-hover:text-terracotta mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
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
