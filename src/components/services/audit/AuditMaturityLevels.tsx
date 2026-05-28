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
          body: "Le diagnostic Flash identifie 3 à 5 endroits où l'IA peut s'insérer immédiatement, sans bouleverser votre quotidien. Vous gardez la main.",
          recommendation: "Flash · Ciblé",
        },
        {
          level: "Niveau 2",
          title: "Premiers usages IA déjà testés",
          body: "L'audit Ciblé sur un département structure ce qui marche, élimine ce qui n'en vaut pas la peine, et chiffre la suite avec un plan 6-12 mois.",
          recommendation: "Ciblé · Stratégique PME",
        },
        {
          level: "Niveau 3",
          title: "Usages IA matures, recherche d'optimisation",
          body: "L'audit Stratégique pose un benchmark concurrentiel et identifie les leviers de scalabilité multi-sites encore inexploités.",
          recommendation: "Stratégique PME · ETI",
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
      ? "Aucune entreprise n'est trop petite ni trop grande, aucun secteur n'est trop spécifique. Vous repartez avec une roadmap claire, chiffrée — peu importe d'où vous partez."
      : "No company is too small or too large, no sector is too niche. You leave with a clear, costed roadmap — whatever your starting point.";

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
