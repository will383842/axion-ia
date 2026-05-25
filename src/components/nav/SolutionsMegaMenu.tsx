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

import { GraduationCap, UserRound, Stethoscope, Cpu, Globe2 } from "lucide-react";
import { HeaderMegaMenu } from "./HeaderMegaMenu";
import { Link } from "@/i18n/navigation";

interface SolutionsMegaMenuProps {
  /** Label du trigger (passé par Header.tsx via getTranslations). */
  triggerLabel: string;
  /** Tagline panel (catalogue solutions IA). */
  panelLabel: string;
  /** Phrase d'accroche en tête du panel. */
  tagline: string;
  /** Labels des 5 solutions (i18n résolus côté server). */
  items: {
    formations: { label: string };
    oneToOne: { label: string };
    audit: { label: string };
    implementation: { label: string };
    platform: { label: string };
  };
}

interface SolutionItem {
  href: string;
  Icon: typeof GraduationCap;
  label: string;
}

export function SolutionsMegaMenu({
  triggerLabel,
  panelLabel,
  tagline,
  items,
}: SolutionsMegaMenuProps) {
  // Ordre business : Formations (volume) → Audits (entrée diag) → Implémentations
  // (cœur de métier) → 1-to-1 (premium) → Plateforme (tech long-tail). Ajustable
  // sans casse — l'ordre alimente aussi le PageRank interne du header.
  const solutions: ReadonlyArray<SolutionItem> = [
    { href: "/interventions/collectives", Icon: GraduationCap, label: items.formations.label },
    { href: "/audit", Icon: Stethoscope, label: items.audit.label },
    { href: "/implementation", Icon: Cpu, label: items.implementation.label },
    { href: "/un-a-un", Icon: UserRound, label: items.oneToOne.label },
    { href: "/codage-developpement", Icon: Globe2, label: items.platform.label },
  ];

  return (
    <HeaderMegaMenu
      triggerLabel={triggerLabel}
      triggerHref="/implementation"
      triggerTrackingId="header_megamenu_solutions"
      panelLabel={panelLabel}
      panelAlign="left"
      panelWidth="w-[min(420px,92vw)]"
    >
      {({ close }) => (
        <div className="p-6">
          <p className="text-fg-muted mb-4 text-[11px] font-semibold tracking-[0.16em] uppercase">
            {tagline}
          </p>
          <ul className="space-y-1">
            {solutions.map(({ href, Icon, label }) => (
              <li key={href}>
                <Link
                  href={href as never}
                  onClick={close}
                  data-cta-tracking="header_solutions_item"
                  data-cta-href={href}
                  className="group focus-visible:bg-sand hover:bg-sand/60 flex items-center gap-3 rounded-lg px-3 py-2.5 transition focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className="bg-paper text-terracotta border-border-strong/30 group-hover:border-terracotta/40 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition"
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="text-fg group-hover:text-terracotta text-[15px] leading-tight font-semibold transition-colors">
                    {label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </HeaderMegaMenu>
  );
}
