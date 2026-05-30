/**
 * AuditWhyNow — bande compacte « Pourquoi maintenant » (Server Component).
 *
 * Brief Audit 2026 §10 (Will) — leviers de conversion condensés en 3 points
 * courts et visuels (vs murs de texte) : coût de l'inaction (urgence) +
 * quick wins (gains rapides) + plan chiffré (réassurance ROI).
 *
 * FR canonique — EN = miroir (locale 301→FR).
 */

import type { ReactNode } from "react";
import { TimerReset, Zap, LineChart, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";

interface Point {
  readonly icon: LucideIcon;
  readonly headline: string;
  readonly sub: string;
}

export interface AuditWhyNowProps {
  readonly isFr: boolean;
}

export function AuditWhyNow({ isFr }: AuditWhyNowProps): ReactNode {
  const points: ReadonlyArray<Point> = [
    {
      icon: TimerReset,
      headline: isFr ? "Vos concurrents automatisent" : "Your competitors automate",
      sub: isFr ? "Le retard se creuse chaque mois." : "The gap widens every month.",
    },
    {
      icon: Zap,
      headline: isFr ? "Des gains en quelques semaines" : "Gains within weeks",
      sub: isFr ? "Les premières automatisations sont rapides." : "First automations are quick.",
    },
    {
      icon: LineChart,
      headline: isFr ? "Un plan chiffré, pas un pari" : "A costed plan, not a bet",
      sub: isFr ? "Vous savez ce que ça rapporte." : "You know what it returns.",
    },
  ];

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Pourquoi maintenant" : "Why now"}
      title={isFr ? "Le bon moment," : "The right time,"}
      titleEm={isFr ? "c'est maintenant" : "is now"}
    >
      <ul className="grid list-none gap-5 p-0 sm:grid-cols-3 lg:gap-6">
        {points.map((p) => {
          const Icon = p.icon;
          return (
            <li
              key={p.headline}
              className="bg-paper border-border shadow-subtle flex flex-col items-center gap-2 rounded-2xl border p-6 text-center"
            >
              <span className="bg-terracotta-soft text-terracotta-deep mb-1 flex h-12 w-12 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <p className="text-fg text-[15px] leading-tight font-semibold">{p.headline}</p>
              <p className="text-fg-soft text-[13.5px] leading-snug">{p.sub}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
