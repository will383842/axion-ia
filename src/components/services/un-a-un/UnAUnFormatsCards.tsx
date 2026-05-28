/**
 * UnAUnFormatsCards — 2 cards (Dirigeant / Individuel) sous le hero `/un-a-un`.
 *
 * Refonte 2026-05-28 (Will) — fusion des anciennes familles `/interventions/individuel`
 * et `/interventions/dirigeants` sous le hub canonique `/un-a-un`. Les 2 pages
 * détail sont conservées (URL inchangées) : ces cards en sont les portes
 * d'entrée depuis le hub 1-to-1.
 *
 * EN-locale OFF (règle Will 2026-05-16) : EN = mirror strict FR.
 *
 * Server Component pur, zéro JS. Pricing injecté via SSOT pricing.ts pour
 * éviter le drift.
 */

import { ArrowRight, Crown, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Section } from "@/components/layout/Section";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";

interface UnAUnFormatsCardsProps {
  readonly isFr: boolean;
}

export function UnAUnFormatsCards({ isFr: _isFr }: UnAUnFormatsCardsProps) {
  void _isFr; // EN = mirror FR (toggle conservé pour parité d'API avec autres UnAUn*).
  const dirigeantsTier = getTierById(INTERVENTION_TIERS, "intervention-dirigeants");
  const dirigeantsPrice = formatAmount(dirigeantsTier.priceFlat!, "fr", { compact: true });

  const cards = [
    {
      href: "/interventions/dirigeants",
      icon: Crown,
      eyebrow: "Pour le dirigeant",
      title: "Journée 1-to-1 dirigeant",
      tagline:
        "Productivité personnelle, vision IA stratégique ou maîtrise de Claude. 3 formats dédiés à un seul dirigeant — pas un comité.",
      meta: `3 formats · à partir de ${dirigeantsPrice}`,
      cta: "Voir les journées dirigeant",
    },
    {
      href: "/interventions/individuel",
      icon: UserRound,
      eyebrow: "Pour un collaborateur",
      title: "Coaching individuel IA",
      tagline:
        "Coaching 1-to-1 calibré sur le poste, les outils et les objectifs d'une personne — manager, commercial, RH, indépendant, métier créatif. Amorti en quelques jours.",
      meta: "3 formats · sur devis",
      cta: "Voir les coachings individuels",
    },
  ] as const;

  return (
    <Section
      eyebrow="2 portes d'entrée"
      title="Choisissez votre"
      titleEm="format 1-to-1"
      description="Le 1-to-1 prend deux formes selon qui est accompagné. Cliquez sur le format qui correspond à votre besoin pour voir le détail des programmes, prix et formats."
    >
      <div className="grid gap-6 md:grid-cols-2 lg:gap-7">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.href}
              className={cn(
                "group/format shadow-subtle relative flex h-full flex-col overflow-hidden rounded-3xl border-2 transition-all duration-200",
                "bg-paper border-terracotta/30 hover:border-terracotta hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(205,107,72,0.30)]",
              )}
            >
              <Link
                href={card.href as never}
                aria-label={`${card.title} — ${card.cta}`}
                className="focus-visible:ring-terracotta absolute inset-0 z-[1] rounded-3xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="sr-only">{card.cta}</span>
              </Link>

              <span aria-hidden="true" className="bg-terracotta block h-2 w-full" />

              <div className="bg-terracotta-soft/45 relative flex flex-col items-center justify-center gap-3 py-8 sm:py-10">
                <span className="bg-terracotta-soft text-terracotta-deep relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl transition-transform duration-200 group-hover/format:scale-110">
                  <Icon aria-hidden="true" className="h-10 w-10" strokeWidth={1.75} />
                </span>
                <span className="bg-terracotta-soft text-terracotta-deep border-terracotta/20 inline-flex items-center rounded-full border px-3.5 py-1 text-[11px] font-semibold tracking-wide uppercase">
                  {card.eyebrow}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <h3 className="text-fg text-[clamp(1.4rem,2.2vw,1.8rem)] leading-tight font-semibold tracking-tight">
                  {card.title}
                </h3>

                <p className="text-fg-soft mt-3 text-[14.5px] leading-relaxed">{card.tagline}</p>

                <p className="text-terracotta-deep mt-4 text-[13px] font-semibold tabular-nums">
                  {card.meta}
                </p>

                <div className="relative z-[2] mt-auto pt-6">
                  <Link
                    href={card.href as never}
                    className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep inline-flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-semibold transition-colors"
                  >
                    <span>{card.cta}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform duration-200 group-hover/format:translate-x-1"
                    />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
