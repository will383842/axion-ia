"use client";
// use-client: enfant direct de HeaderMegaMenu (client) — le render-prop
// `children` impose un caller client. Le contenu du panel est server-safe
// (Link statique de next-intl) mais doit être encapsulé dans ce wrapper.
//
// P0-4 audit E2E NAV+CTA 2026-05-15 — instanciation explicite du shell
// `HeaderMegaMenu` (146 LOC restées orphelines depuis Sprint 14.x). Override
// de la doctrine §9.2 Header.tsx « Sprint 15 différé » sur demande Will
// 2026-05-15 : récupère 7 pages stratégiques desktop (4 familles + 3 pages
// money) qui étaient absentes du header desktop (déjà présentes dans le
// drawer mobile via `navMobileExtras`).
//
// Doctrine garde-fous (héritée du shell) :
// - hover-intent 100/200 ms
// - fermeture ESC + clic extérieur
// - WCAG 2.2 AA + ARIA correct (haspopup, expanded, role=region)

import { HeaderMegaMenu } from "./HeaderMegaMenu";
import { Link } from "@/i18n/navigation";

interface InterventionsMegaMenuProps {
  /** Locale courante — détermine les labels FR/EN. */
  isFr: boolean;
  /** Label du trigger (passé par Header.tsx via getTranslations). */
  triggerLabel: string;
}

interface MenuItem {
  href: string;
  labelFr: string;
  labelEn: string;
  hintFr?: string;
  hintEn?: string;
}

const FAMILIES: ReadonlyArray<MenuItem> = [
  {
    href: "/interventions/collectives",
    labelFr: "Formations équipe",
    labelEn: "Team trainings",
    hintFr: "4 paliers durée (4 h → 3 j+)",
    hintEn: "4 duration tiers (4 h → 3 d+)",
  },
  {
    href: "/interventions/individuel",
    labelFr: "Coaching individuel",
    labelEn: "Individual coaching",
    hintFr: "Découverte ou avancé",
    hintEn: "Discovery or advanced",
  },
  {
    href: "/interventions/dirigeants",
    labelFr: "Dirigeants",
    labelEn: "Executives",
    hintFr: "Productivité ou vision",
    hintEn: "Productivity or vision",
  },
  {
    href: "/interventions/conference",
    labelFr: "Conférence",
    labelEn: "Conference",
    hintFr: "Plénière ou keynote",
    hintEn: "Plenary or keynote",
  },
];

const MONEY_PAGES: ReadonlyArray<MenuItem> = [
  {
    href: "/interventions/essentielle",
    labelFr: "Essentielle · 1 jour",
    labelEn: "Essential · 1 day",
  },
  {
    href: "/interventions/approfondie",
    labelFr: "Approfondie · 2 jours",
    labelEn: "Deep dive · 2 days",
  },
  {
    href: "/interventions/gagner-du-temps",
    labelFr: "Gagner du temps",
    labelEn: "Save time",
  },
];

export function InterventionsMegaMenu({ isFr, triggerLabel }: InterventionsMegaMenuProps) {
  return (
    <HeaderMegaMenu
      triggerLabel={triggerLabel}
      triggerHref="/interventions"
      triggerTrackingId="header_megamenu_interventions"
      panelLabel={isFr ? "Interventions entreprise" : "Corporate AI sessions"}
      panelAlign="left"
      panelWidth="w-[min(620px,90vw)]"
    >
      {({ close }) => (
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div>
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Par format" : "By format"}
            </p>
            <ul className="space-y-2">
              {FAMILIES.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href as never}
                    onClick={close}
                    className="text-fg hover:text-terracotta focus-visible:bg-sand block rounded-md px-2 py-1.5 transition focus-visible:outline-none"
                  >
                    <span className="text-[15px] leading-tight font-medium">
                      {isFr ? item.labelFr : item.labelEn}
                    </span>
                    {(isFr ? item.hintFr : item.hintEn) ? (
                      <span className="text-fg-muted block text-xs leading-tight">
                        {isFr ? item.hintFr : item.hintEn}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Best-sellers" : "Best-sellers"}
            </p>
            <ul className="space-y-2">
              {MONEY_PAGES.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href as never}
                    onClick={close}
                    className="text-fg hover:text-terracotta focus-visible:bg-sand block rounded-md px-2 py-1.5 text-[15px] leading-tight font-medium transition focus-visible:outline-none"
                  >
                    {isFr ? item.labelFr : item.labelEn}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-border mt-4 border-t pt-4">
              <Link
                href="/interventions"
                onClick={close}
                className="text-primary hover:text-primary-hover inline-flex items-center gap-1 text-sm font-semibold"
              >
                {isFr ? "Voir tout le catalogue" : "See full catalogue"} →
              </Link>
            </div>
          </div>
        </div>
      )}
    </HeaderMegaMenu>
  );
}
