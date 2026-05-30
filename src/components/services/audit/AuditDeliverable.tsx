/**
 * AuditDeliverable — « Ce que vous repartez avec » : le livrable de l'audit.
 *
 * Brief Audit 2026 §8 (Will) — à l'issue de l'audit, un rapport détaillé +
 * plan d'action chiffré. Lever de conversion : le prospect voit qu'il repart
 * avec un document concret et actionnable, pas une simple discussion.
 *
 * Contenu : cartographie de l'entreprise · tous les points où l'IA peut être
 * implantée et comment · plan d'action mois par mois (1 / 2 / 3 / 6 / 12 / 24
 * mois selon budget) · chiffrage estimatif de chaque action.
 *
 * Server Component pur, zéro JS. FR canonique — EN = miroir (locale 301→FR).
 */

import type { ReactNode } from "react";
import { Map, Sparkles, CalendarRange, Coins } from "lucide-react";
import { Section } from "@/components/layout/Section";

const TIGHT_X = "lg:px-6 xl:px-10";

const HORIZONS = ["1 mois", "2 mois", "3 mois", "6 mois", "12 mois", "24 mois"] as const;

export interface AuditDeliverableProps {
  readonly isFr: boolean;
}

export function AuditDeliverable({ isFr }: AuditDeliverableProps): ReactNode {
  const blocks = [
    {
      icon: Map,
      title: isFr ? "La cartographie de votre entreprise" : "Your company map",
      text: isFr
        ? "Vos process et vos données, secteur par secteur."
        : "Your processes and data, department by department.",
    },
    {
      icon: Sparkles,
      title: isFr ? "Où l'IA peut être implantée, et comment" : "Where AI fits, and how",
      text: isFr
        ? "Chaque point où l'IA peut s'implanter, priorisé par impact."
        : "Every place AI can be deployed, prioritised by impact.",
    },
    {
      icon: CalendarRange,
      title: isFr ? "Un plan d'action mois par mois" : "A month-by-month action plan",
      text: isFr
        ? "Quoi faire, dans quel ordre — calibré sur votre budget."
        : "What to do, in which order — calibrated to your budget.",
    },
    {
      icon: Coins,
      title: isFr ? "Le chiffrage de chaque action" : "A cost for each action",
      text: isFr
        ? "Chaque action chiffrée : coût et gain attendu."
        : "Each action costed: cost and expected gain.",
    },
  ] as const;

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Le livrable" : "The deliverable"}
      title={isFr ? "Vous repartez avec" : "You leave with"}
      titleEm={isFr ? "un plan, pas une discussion" : "a plan, not a chat"}
      description={
        isFr
          ? "Un rapport concret, chiffré, priorisé. Que vous déployiez avec nous ou seul."
          : "A concrete, costed, prioritised report. Whether you deploy with us or on your own."
      }
      contentClassName={TIGHT_X}
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:gap-6">
        {blocks.map((b) => {
          const Icon = b.icon;
          return (
            <article
              key={b.title}
              className="bg-paper border-border shadow-subtle flex h-full gap-4 rounded-2xl border p-6"
            >
              <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <h3 className="text-fg text-base leading-tight font-semibold tracking-tight">
                  {b.title}
                </h3>
                <p className="text-fg-soft mt-1.5 text-[14px] leading-relaxed">{b.text}</p>
              </div>
            </article>
          );
        })}
      </div>

      {/* Frise des horizons de la roadmap */}
      <div className="mt-8">
        <p className="text-fg-muted mb-3 text-center text-[12px] font-semibold tracking-[0.18em] uppercase">
          {isFr ? "Roadmap calibrée sur votre budget" : "Roadmap calibrated to your budget"}
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-2.5">
          {HORIZONS.map((h) => (
            <li
              key={h}
              className="border-terracotta/30 text-terracotta-deep bg-terracotta-soft/50 rounded-full border px-4 py-1.5 text-[13px] font-semibold tabular-nums"
            >
              {h}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
