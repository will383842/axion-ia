/**
 * SitesWebCapabilitiesGrid — « Le champ des possibles » affiché on-page.
 *
 * 2026-06-04 (Will) — remplace le popup `SitesWebCapabilitiesDialog` : la grille
 * des 14 domaines d'expertise (UX/UI, mobile, e-commerce multi-CMS + 11 briques IA)
 * est désormais rendue directement sur la page hub. Objectif : densité perçue +
 * contenu indexable/citable par les LLM (vs grille cachée derrière un clic), aligné
 * sur les grilles d'expertises des agences concurrentes. Zéro JS client (vs Radix
 * Dialog) → budget Web Vitals 2026 amélioré.
 *
 * Server Component pur. FR canonique — EN = miroir (locale 301→FR).
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { SITES_WEB_CAPABILITIES } from "@/components/services/sites-web/sites-web-capabilities";

export interface SitesWebCapabilitiesGridProps {
  readonly isFr: boolean;
}

export function SitesWebCapabilitiesGrid({ isFr }: SitesWebCapabilitiesGridProps): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Le champ des possibles" : "The field of possibilities"}
      title={
        isFr ? "Du site vitrine à la plateforme SaaS," : "From showcase site to SaaS platform,"
      }
      titleEm={isFr ? "on couvre toute la chaîne" : "we cover the whole chain"}
      titleTail="."
      description={
        isFr
          ? "Design, développement, mobile, e-commerce et IA : une seule équipe, sur une nouvelle base ou votre existant. Vous n'avez pas besoin de tout — on cadre ensemble les briques à plus fort ROI selon votre priorité."
          : "Design, development, mobile, e-commerce and AI: one single team, on a new base or your existing one. You don't need all of it — together we scope the highest-ROI bricks for your priority."
      }
    >
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {SITES_WEB_CAPABILITIES.map((domain) => {
          const Icon = domain.icon;
          return (
            <li
              key={domain.titleFr}
              className="bg-paper border-border shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full flex-col rounded-2xl border p-5 transition"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="text-fg text-[15px] leading-tight font-semibold tracking-tight">
                  {isFr ? domain.titleFr : domain.titleEn}
                </h3>
              </div>
              <p className="text-terracotta-deep mb-3 text-[13px] leading-snug font-medium">
                {isFr ? domain.introFr : domain.introEn}
              </p>
              <ul className="text-fg-soft space-y-1.5 p-0 text-[13px] leading-snug">
                {(isFr ? domain.itemsFr : domain.itemsEn).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-terracotta mt-[3px] leading-none">
                      ·
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <p className="text-fg-muted mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed">
        {isFr
          ? "… et tout le reste. On cartographie précisément ce qui s'applique à votre projet, et on le chiffre sous 24-48 h selon la complexité."
          : "… and everything else. We map exactly what fits your project, and cost it in 24-48 h depending on complexity."}
      </p>
    </Section>
  );
}
