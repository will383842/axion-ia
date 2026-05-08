// Server Component — schéma visuel du hero /contact.
// Stack de 3 mini-cards illustrant les 3 canaux d'entrée AxionIA :
// (1) message direct sous 48 h ouvrées (lead), (2) intervention via
// l'Essentielle, (3) audit cadré. Pattern hérité de BlogHeroSchema —
// stack vertical, terracotta accent, première card en avant.
//
// Doctrine : zéro fond (transparent), accent terracotta cohérent avec
// le hero halo-warm. Pas d'animation, SSR-friendly. Cap .hero-schema
// 36rem (Design.md §hero-schema v3.2).

import type { ReactNode } from "react";
import { Mail, CalendarClock, ClipboardCheck } from "lucide-react";

export interface ContactHeroSchemaProps {
  isFr: boolean;
  ariaLabel: string;
  className?: string;
}

export function ContactHeroSchema({
  isFr,
  ariaLabel,
  className,
}: ContactHeroSchemaProps): ReactNode {
  const channels = isFr
    ? [
        {
          icon: Mail,
          eyebrow: "Message direct",
          title: "Réponse sous 48 h ouvrées",
          detail: "Devis détaillé, pas de relance commerciale.",
          lead: true,
        },
        {
          icon: CalendarClock,
          eyebrow: "Intervention",
          title: "L'Essentielle · 490 €",
          detail: "Diagnostic 90 min + plan d'action.",
          lead: false,
        },
        {
          icon: ClipboardCheck,
          eyebrow: "Audit cadré",
          title: "4 tailles × 2 modalités",
          detail: "Formulaire 5 étapes, livrable structuré.",
          lead: false,
        },
      ]
    : [
        {
          icon: Mail,
          eyebrow: "Direct message",
          title: "Reply within 48 business hours",
          detail: "Detailed quote, no commercial chasing.",
          lead: true,
        },
        {
          icon: CalendarClock,
          eyebrow: "Session",
          title: "The Essential · €490",
          detail: "90-min diagnostic + action plan.",
          lead: false,
        },
        {
          icon: ClipboardCheck,
          eyebrow: "Scoped audit",
          title: "4 sizes × 2 modalities",
          detail: "5-step form, structured deliverable.",
          lead: false,
        },
      ];

  return (
    <div role="img" aria-label={ariaLabel} className={className ?? "hero-schema"}>
      <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
        <span
          aria-hidden="true"
          className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
        />
        {isFr ? "Trois portes d'entrée" : "Three ways in"}
      </p>

      <div className="space-y-3.5">
        {channels.map((c) => {
          const Icon = c.icon;
          return (
            <article
              key={c.eyebrow}
              className={
                c.lead
                  ? "border-terracotta/40 bg-paper shadow-card relative rounded-2xl border-2 p-5 sm:p-6"
                  : "border-border-strong bg-paper shadow-subtle relative rounded-2xl border p-4 sm:p-5"
              }
            >
              <div className="flex items-start gap-4">
                <span
                  className={
                    c.lead
                      ? "bg-terracotta-soft text-terracotta flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14"
                      : "bg-terracotta-soft text-terracotta flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11"
                  }
                >
                  <Icon
                    aria-hidden="true"
                    className={c.lead ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5"}
                    strokeWidth={2.25}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-fg-muted mb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                    {c.eyebrow}
                  </p>
                  <p
                    className={
                      c.lead
                        ? "text-fg text-base leading-snug font-bold sm:text-lg"
                        : "text-fg text-[14.5px] leading-snug font-bold sm:text-base"
                    }
                  >
                    {c.title}
                  </p>
                  <p className="text-fg-soft mt-1 text-[12.5px] leading-snug">{c.detail}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-fg-muted mt-4 text-center text-[12px]">
        {isFr ? "Vous choisissez la porte la plus utile ↓" : "Pick the door that fits ↓"}
      </p>
    </div>
  );
}
