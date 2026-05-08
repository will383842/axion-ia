"use client";
// use-client: hover-intent state + keyboard handlers (Esc, Tab) pour le mega-menu Interventions.
// Hover-intent mega-menu pour le déclencheur « Interventions ». Liste 5
// grandes familles de formats — strictement synchrones avec le listing
// /interventions (4 paliers Essentielle agrégés en 1 ligne « dès 490 € »
// + Gagner du temps + CODIR + Conférence + Sur demande).
//
// Doctrine garde-fous (alignée HeaderImplantationsMenu / ADR 0005) :
// hover-intent 100/200 ms, fermeture Esc + clic extérieur, focusable
// clavier, pas de mega-menu mobile (drawer plat dans MobileNav).

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface HeaderInterventionsMenuProps {
  triggerLabel: string;
  isFr: boolean;
}

const HOVER_OPEN_DELAY_MS = 100;
const HOVER_CLOSE_DELAY_MS = 200;

interface MenuItem {
  key: string;
  href: string;
  labelFr: string;
  labelEn: string;
  durationFr: string;
  durationEn: string;
  groupFr: string;
  groupEn: string;
  priceFr: string;
  priceEn: string;
}

// Source de vérité : doit rester strictement synchrone avec
// `src/app/[locale]/interventions/page.tsx::buildCards()`. Les 4 paliers
// Essentielle sont agrégés en 1 ligne avec « dès 490 € » côté menu pour
// éviter la verbosité (le listing les détaille sur 4 cards séparées).
const MENU_ITEMS: ReadonlyArray<MenuItem> = [
  {
    key: "essentielle",
    href: "/interventions/essentielle",
    labelFr: "Essentielle",
    labelEn: "Essential",
    durationFr: "1 journée",
    durationEn: "1 day",
    groupFr: "2 à 30 personnes et +",
    groupEn: "2 to 30+ people",
    priceFr: "dès 490 € HT",
    priceEn: "from €490",
  },
  {
    key: "gagner-du-temps",
    href: "/reserver",
    labelFr: "Gagner du temps",
    labelEn: "Save Time",
    durationFr: "1 journée",
    durationEn: "1 day",
    groupFr: "2 à 20 personnes",
    groupEn: "2 to 20 people",
    priceFr: "990 € HT",
    priceEn: "€990",
  },
  {
    key: "dirigeants",
    href: "/interventions/dirigeants",
    labelFr: "Dirigeants · CODIR",
    labelEn: "Executives",
    durationFr: "1 journée",
    durationEn: "1 day",
    groupFr: "CODIR · dès 2",
    groupEn: "Leadership · 2+",
    priceFr: "Sur devis",
    priceEn: "On request",
  },
  {
    key: "conference",
    href: "/interventions/conference",
    labelFr: "Conférence",
    labelEn: "Talk",
    durationFr: "½ journée",
    durationEn: "Half day",
    groupFr: "Effectif libre",
    groupEn: "Open headcount",
    priceFr: "Sur devis",
    priceEn: "On request",
  },
  {
    key: "sur-demande",
    href: "/contact",
    labelFr: "Sur demande particulière",
    labelEn: "Bespoke",
    durationFr: "Selon besoin",
    durationEn: "As needed",
    groupFr: "Selon besoin",
    groupEn: "As needed",
    priceFr: "Sur devis",
    priceEn: "On request",
  },
];

export function HeaderInterventionsMenu({
  triggerLabel,
  isFr,
}: HeaderInterventionsMenuProps): React.ReactNode {
  const [open, setOpen] = React.useState(false);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const cancelTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = undefined;
    closeTimer.current = undefined;
  };

  const handleEnter = () => {
    cancelTimers();
    openTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
  };

  const handleLeave = () => {
    cancelTimers();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  React.useEffect(() => () => cancelTimers(), []);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={wrapperRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={() => {
        cancelTimers();
        setOpen(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          cancelTimers();
          setOpen(false);
        }
      }}
      className="relative"
    >
      <Link
        href="/interventions"
        aria-haspopup="true"
        aria-expanded={open}
        className="text-mocha-fg hover:text-mocha focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta inline-flex items-center gap-1.5 rounded-sm px-1 text-[17px] font-semibold tracking-tight transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        data-cta-tracking="header_interventions_megamenu_trigger"
      >
        {triggerLabel}
        <span
          aria-hidden="true"
          className={`text-mocha-fg/70 inline-block text-[10px] transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </Link>

      <div
        role="region"
        aria-label={triggerLabel}
        className={`bg-paper text-fg shadow-card pointer-events-${open ? "auto" : "none"} border-border-strong/40 absolute top-full left-0 z-50 mt-3 w-[min(560px,90vw)] origin-top-left rounded-2xl border transition duration-150 ${
          open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
        }`}
      >
        <div className="p-5">
          <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? "5 familles de formats" : "5 format families"}
          </p>
          <ul className="space-y-1">
            {MENU_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href as never}
                  onClick={() => setOpen(false)}
                  data-cta-tracking="header_interventions_format"
                  data-source-slug={item.key}
                  className="group hover:bg-sand focus-visible:ring-terracotta -mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-2 transition focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className="text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {isFr ? item.labelFr : item.labelEn}
                    </span>
                    <span className="text-fg-muted text-[11px]">
                      {isFr ? item.durationFr : item.durationEn} ·{" "}
                      {isFr ? item.groupFr : item.groupEn}
                    </span>
                  </span>
                  <span className="text-terracotta-deep shrink-0 text-[12px] font-semibold tabular-nums">
                    {isFr ? item.priceFr : item.priceEn}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-border/60 mt-4 border-t pt-4">
            <Link
              href="/interventions"
              onClick={() => setOpen(false)}
              data-cta-tracking="header_interventions_hub"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {isFr ? "Voir tous les formats" : "See all formats"}
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
