/**
 * AuditFormatsCards — 2 cartes formats d'audit sous le hero `/audit`.
 *
 * Refonte 2026-05-30 (Will) — remplace l'ancienne grille 4-tiers dense + le
 * toggle « par taille / par situation » (trop textuels, prix qui contredisent
 * le modèle sur-devis). Calqué sur le pattern 2 cartes de `/un-a-un` et
 * `/interventions/collectives` :
 *
 *   1. Audit sur place    → 1 journée complète, prix fixe (TPE/artisans/commerçants)
 *   2. Audit complet      → PME / ETI / grande entreprise, SUR DEVIS
 *
 * Prix dérivé de la SSOT pricing.ts (audit-flash : 1190 € HT présentiel, 1
 * journée — Will 2026-05-31, suppression du 490 € distanciel). L'audit complet
 * est volontairement « sur devis » — un vrai audit dépend de la taille.
 *
 * Server Component pur, zéro JS. FR canonique — EN = miroir (locale 301→FR).
 */

import { ArrowRight, Zap, Building2, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Section } from "@/components/layout/Section";
import { AUDIT_TIERS, formatAmount, getTierById } from "@/content/pricing";

interface AuditFormatsCardsProps {
  readonly isFr: boolean;
}

interface FormatCard {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly eyebrow: string;
  readonly title: string;
  readonly tagline: string;
  readonly meta: string;
  readonly cta: string;
}

export function AuditFormatsCards({ isFr: _isFr }: AuditFormatsCardsProps) {
  void _isFr; // EN = miroir FR (toggle conservé pour parité d'API avec autres composants).

  const flashTier = getTierById(AUDIT_TIERS, "audit-flash");
  const onsitePrice = formatAmount(flashTier.priceFlat!, "fr", { compact: true });

  const cards: ReadonlyArray<FormatCard> = [
    {
      href: "/audit/tpe-1-jour",
      icon: Zap,
      eyebrow: "TPE, artisans & commerçants",
      title: "Audit sur place",
      tagline:
        "On audite toute votre entreprise en une journée complète sur site, pour révéler tout ce que l'IA peut y changer. Recommandations chiffrées à la clé.",
      meta: `1 journée complète · sur place · ${onsitePrice}`,
      cta: "Découvrir l'audit sur place",
    },
    {
      href: "/appel",
      icon: Building2,
      eyebrow: "PME · ETI · Grande entreprise",
      title: "Audit complet",
      tagline:
        "Calibré sur votre taille et vos enjeux : cartographie complète, plan d'action chiffré, gouvernance IA. De quelques jours à plusieurs semaines.",
      meta: "Sur devis · selon l'ampleur",
      cta: "En parler avec nous",
    },
  ];

  return (
    <Section
      eyebrow="Deux formats"
      title="Choisissez votre"
      titleEm="audit IA"
      description="Un diagnostic rapide à prix fixe, ou un audit complet sur mesure. Dans les deux cas : un plan d'action concret."
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
