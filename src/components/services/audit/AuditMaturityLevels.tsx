/**
 * AuditMaturityLevels — 3 cartes anti-fear maturité IA (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis `src/app/[locale]/audit/page.tsx`
 * (l.355-426). Rassure les 3 publics (zéro IA, premiers usages, usages
 * matures) avec un niveau d'audit conseillé. Quand `villeContext` est fourni,
 * un sous-titre ville-aware est ajouté à la description.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import type { VilleContext } from "@/components/services/types";

const TIGHT_X = "lg:px-6 xl:px-10";

export interface AuditMaturityLevelsProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function AuditMaturityLevels({ isFr, villeContext }: AuditMaturityLevelsProps): ReactNode {
  const cards = isFr
    ? [
        {
          level: "Niveau 1",
          title: "Aucun usage IA en place",
          body: "On repère 3 à 5 usages IA à activer tout de suite, sans tout bouleverser.",
          recommendation: "Audit Flash",
        },
        {
          level: "Niveau 2",
          title: "Premiers usages IA déjà testés",
          body: "On structure ce qui marche, on élimine le reste, et on chiffre la suite.",
          recommendation: "Flash ou Audit complet",
        },
        {
          level: "Niveau 3",
          title: "Usages IA matures, à optimiser",
          body: "Benchmark concurrentiel et leviers de scalabilité multi-sites inexploités.",
          recommendation: "Audit complet",
        },
      ]
    : [
        {
          level: "Stage 1",
          title: "No AI use in place",
          body: "The Flash diagnosis identifies 3 to 5 places where AI can fit in immediately, without disrupting your day-to-day. You keep control.",
          recommendation: "Flash · Targeted",
        },
        {
          level: "Stage 2",
          title: "Early AI uses already tried",
          body: "The Targeted audit on a department structures what works, drops what doesn't, and costs the next step with a 6-12 month plan.",
          recommendation: "Targeted · Strategic SMB",
        },
        {
          level: "Stage 3",
          title: "Mature AI uses, looking to optimize",
          body: "The Strategic audit benchmarks competitors and identifies unexploited multi-site scaling levers.",
          recommendation: "Strategic SMB · mid-cap",
        },
      ];

  const description = villeContext
    ? isFr
      ? `Aucune entreprise n'est trop petite ni trop grande, aucun secteur n'est trop spécifique — y compris pour les structures basées à ${villeContext.name}. Vous repartez avec une roadmap claire, chiffrée — peu importe d'où vous partez.`
      : `No company is too small or too large, no sector is too niche — including for ${villeContext.name}-based structures. You leave with a clear, costed roadmap — whatever your starting point.`
    : isFr
      ? "Aucune entreprise trop petite ou trop grande, aucun secteur trop spécifique. Une roadmap claire, peu importe d'où vous partez."
      : "No company too small or too large, no sector too niche. A clear roadmap, whatever your starting point.";

  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Concerné·e quel que soit votre niveau" : "A fit for every AI maturity"}
      title={isFr ? "De zéro IA à équipes IA-fluentes," : "From zero AI to fluent teams,"}
      titleEm={isFr ? "un audit pour chaque entreprise" : "an audit for every company"}
      description={description}
      contentClassName={TIGHT_X}
    >
      <div className="grid gap-6 sm:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.level}
            className="bg-paper border-border relative rounded-2xl border p-6"
          >
            <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
              {card.level}
            </p>
            <h3 className="text-fg mt-2 text-xl leading-snug font-semibold">{card.title}</h3>
            <p className="text-fg-soft mt-3 text-base leading-relaxed">{card.body}</p>
            <p className="text-fg-muted mt-4 text-[12px] tracking-wide">
              <span className="text-fg font-medium">
                {isFr ? "Niveau conseillé : " : "Recommended level: "}
              </span>
              {card.recommendation}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
