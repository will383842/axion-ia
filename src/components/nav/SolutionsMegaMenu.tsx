"use client";
// use-client: enfant direct de HeaderMegaMenu (client) — le render-prop
// `children` impose un caller client. Le contenu du panel est server-safe
// (Link statique de next-intl + icônes Lucide).
//
// Sprint Header refonte 2026-05-24 (Will). Mega-menu unique « Nos solutions »
// qui regroupe les 5 offres canoniques Axion-IA (pattern Stripe/Linear/Vercel
// 2026-2027) :
//   1. Formations équipe        → /interventions/collectives
//   2. Audits IA                → /audit
//   3. Implémentations IA       → /implementation
//   4. Accompagnement 1-to-1    → /un-a-un
//   5. Plateforme web / SaaS    → /codage-developpement
//
// Featured card à droite : devis 48 h vers /contact (point d'entrée
// commercial unique post-refonte CTA central).
//
// Doctrine garde-fous (hérités du shell HeaderMegaMenu) :
//   - hover-intent 100 ms open / 200 ms close
//   - fermeture Esc + clic extérieur + blur
//   - WCAG 2.2 AA + ARIA (haspopup, expanded, role=region)
//   - cibles touch ≥ 24×24 CSS px (WCAG 2.2 §2.5.8)
//   - reduced-motion respecté (transitions ≤ 150 ms du shell)

import {
  ArrowRight,
  GraduationCap,
  UserRound,
  Stethoscope,
  Cpu,
  Globe2,
  Sparkles,
} from "lucide-react";
import { HeaderMegaMenu } from "./HeaderMegaMenu";
import { Link } from "@/i18n/navigation";

interface SolutionsMegaMenuProps {
  /** Locale courante — détermine les labels FR/EN. */
  isFr: boolean;
  /** Label du trigger (passé par Header.tsx via getTranslations). */
  triggerLabel: string;
  /** Tagline panel (catalogue solutions IA). */
  panelLabel: string;
  /** Phrase d'accroche en tête du panel. */
  tagline: string;
  /** Featured card — titre. */
  featuredTitle: string;
  /** Featured card — description. */
  featuredDesc: string;
  /** Featured card — CTA. */
  featuredCta: string;
  /** Labels + hints des 5 solutions (i18n résolus côté server). */
  items: {
    formations: { label: string; hint: string };
    oneToOne: { label: string; hint: string };
    audit: { label: string; hint: string };
    implementation: { label: string; hint: string };
    platform: { label: string; hint: string };
  };
}

interface SolutionItem {
  href: string;
  Icon: typeof GraduationCap;
  label: string;
  hint: string;
}

export function SolutionsMegaMenu({
  isFr,
  triggerLabel,
  panelLabel,
  tagline,
  featuredTitle,
  featuredDesc,
  featuredCta,
  items,
}: SolutionsMegaMenuProps) {
  // Ordre business : Formations (volume) → Audits (entrée diag) → Implémentations
  // (cœur de métier) → 1-to-1 (premium) → Plateforme (tech long-tail). Ajustable
  // sans casse — l'ordre alimente aussi le PageRank interne du header.
  const solutions: ReadonlyArray<SolutionItem> = [
    {
      href: "/interventions/collectives",
      Icon: GraduationCap,
      label: items.formations.label,
      hint: items.formations.hint,
    },
    {
      href: "/audit",
      Icon: Stethoscope,
      label: items.audit.label,
      hint: items.audit.hint,
    },
    {
      href: "/implementation",
      Icon: Cpu,
      label: items.implementation.label,
      hint: items.implementation.hint,
    },
    {
      href: "/un-a-un",
      Icon: UserRound,
      label: items.oneToOne.label,
      hint: items.oneToOne.hint,
    },
    {
      href: "/codage-developpement",
      Icon: Globe2,
      label: items.platform.label,
      hint: items.platform.hint,
    },
  ];

  return (
    <HeaderMegaMenu
      triggerLabel={triggerLabel}
      triggerHref="/contact"
      triggerTrackingId="header_megamenu_solutions"
      panelLabel={panelLabel}
      panelAlign="left"
      panelWidth="w-[min(820px,92vw)]"
    >
      {({ close }) => (
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-[1.5fr_1fr]">
          {/* Colonne gauche — 5 solutions en grille 1 col (clarté lecture) */}
          <div className="p-6">
            <p className="text-fg-muted mb-4 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {tagline}
            </p>
            <ul className="space-y-1">
              {solutions.map(({ href, Icon, label, hint }) => (
                <li key={href}>
                  <Link
                    href={href as never}
                    onClick={close}
                    data-cta-tracking="header_solutions_item"
                    data-cta-href={href}
                    className="group focus-visible:bg-sand hover:bg-sand/60 flex min-h-[56px] items-start gap-3 rounded-lg px-3 py-2.5 transition focus-visible:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-paper text-terracotta border-border-strong/30 group-hover:border-terracotta/40 mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition"
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-fg group-hover:text-terracotta block text-[15px] leading-tight font-semibold transition-colors">
                        {label}
                      </span>
                      <span className="text-fg-muted mt-0.5 block text-[12.5px] leading-snug">
                        {hint}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Colonne droite — Featured card devis 48 h (pattern Linear/Vercel) */}
          <div className="bg-sand/40 border-border/60 flex flex-col justify-between gap-4 rounded-r-2xl border-l p-6">
            <div>
              <span
                aria-hidden="true"
                className="bg-terracotta/10 text-terracotta-deep mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md"
              >
                <Sparkles className="h-4 w-4" strokeWidth={2} />
              </span>
              <p className="text-fg text-[15px] leading-snug font-semibold">{featuredTitle}</p>
              <p className="text-fg-muted mt-1.5 text-[12.5px] leading-snug">{featuredDesc}</p>
            </div>
            <Link
              href="/contact"
              onClick={close}
              data-cta-tracking="header_solutions_featured_quote"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta-deep focus-visible:ring-offset-paper inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {featuredCta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              href="/tarifs"
              onClick={close}
              data-cta-tracking="header_solutions_featured_pricing"
              className="text-fg-muted hover:text-terracotta -mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium transition-colors"
            >
              {isFr ? "Voir tous les tarifs" : "See all pricing"} →
            </Link>
          </div>
        </div>
      )}
    </HeaderMegaMenu>
  );
}
