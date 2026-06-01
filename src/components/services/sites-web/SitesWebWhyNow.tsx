/**
 * SitesWebWhyNow — bande compacte « Pourquoi maintenant » (Server Component).
 *
 * Fusion 2026-06-01 (Will) — calqué sur `AuditWhyNow` (template /audit) : 3
 * leviers de conversion courts et visuels, adaptés au web augmenté (concurrents
 * qui adoptent les agents, déploiement en semaines, forfait fixe).
 *
 * FR canonique — EN = miroir (locale 301→FR).
 */

import type { ReactNode } from "react";
import { TimerReset, Zap, BadgeCheck, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";

interface Point {
  readonly icon: LucideIcon;
  readonly headline: string;
  readonly sub: string;
}

export interface SitesWebWhyNowProps {
  readonly isFr: boolean;
}

export function SitesWebWhyNow({ isFr }: SitesWebWhyNowProps): ReactNode {
  const points: ReadonlyArray<Point> = [
    {
      icon: TimerReset,
      headline: isFr ? "Vos visiteurs attendent des réponses" : "Your visitors expect answers",
      sub: isFr
        ? "Les sites qui répondent en temps réel convertissent davantage."
        : "Sites that answer in real time convert more.",
    },
    {
      icon: Zap,
      headline: isFr ? "Le RAG se déploie en semaines" : "RAG ships in weeks",
      sub: isFr ? "Pas besoin de tout refaire pour démarrer." : "No full rebuild needed to start.",
    },
    {
      icon: BadgeCheck,
      headline: isFr ? "Forfait fixe, pas un pari" : "Fixed fee, not a bet",
      sub: isFr ? "Devis ferme 48 h, vous possédez le code." : "Firm quote 48 h, you own the code.",
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
