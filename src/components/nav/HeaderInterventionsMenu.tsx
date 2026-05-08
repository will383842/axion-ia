"use client";
// use-client: hover-intent state + keyboard handlers (Esc, Tab) pour le mega-menu Interventions.
// Hover-intent mega-menu pour le déclencheur « Interventions ». Liste les
// 5 formats du Module 1 avec durée + tarif + effectif — données dérivées
// directement de `INTERVENTIONS` (content/interventions.ts) pour rester
// strictement synchrones avec le listing /interventions.
//
// Doctrine garde-fous (alignée HeaderImplantationsMenu / ADR 0005) :
// hover-intent 100/200 ms, fermeture Esc + clic extérieur, focusable
// clavier, pas de mega-menu mobile (drawer plat dans MobileNav).

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { INTERVENTIONS, type InterventionSlug } from "@/content/interventions";

interface HeaderInterventionsMenuProps {
  triggerLabel: string;
  isFr: boolean;
}

const HOVER_OPEN_DELAY_MS = 100;
const HOVER_CLOSE_DELAY_MS = 200;

// Libellés courts dédiés au menu — la page utilise des titres émotionnels
// ("Vos équipes gagnent 1 h par jour"), trop longs pour une ligne du
// dropdown. On revient ici aux noms de format canoniques.
function shortLabel(slug: InterventionSlug, isFr: boolean): string {
  switch (slug) {
    case "essentielle":
      return isFr ? "Essentielle" : "Essential";
    case "equipes":
      return isFr ? "Équipes" : "Teams";
    case "managers":
      return "Managers";
    case "conference":
      return isFr ? "Conférence" : "Talk";
    case "dirigeants":
      return isFr ? "Dirigeants · CODIR" : "Executives";
  }
}

function shortDuration(slug: InterventionSlug, isFr: boolean): string {
  if (slug === "conference") return isFr ? "½ journée" : "Half day";
  return isFr ? "1 journée" : "1 day";
}

function shortGroup(slug: InterventionSlug, isFr: boolean): string {
  switch (slug) {
    case "essentielle":
      return isFr ? "2 à 8 personnes" : "2 to 8 people";
    case "equipes":
      return isFr ? "11 personnes et +" : "11+ people";
    case "managers":
      return isFr ? "2 à 12 managers" : "2 to 12 managers";
    case "conference":
      return isFr ? "Effectif libre" : "Open headcount";
    case "dirigeants":
      return isFr ? "CODIR · dès 2" : "Leadership · 2+";
  }
}

function shortPrice(slug: InterventionSlug, isFr: boolean): string {
  if (slug === "essentielle") return isFr ? "dès 490 € HT" : "from €490";
  return isFr ? "Sur devis" : "On request";
}

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

      {/* Panel — 1 colonne, 5 formats + footer hub */}
      <div
        role="region"
        aria-label={triggerLabel}
        className={`bg-paper text-fg shadow-card pointer-events-${open ? "auto" : "none"} border-border-strong/40 absolute top-full left-0 z-50 mt-3 w-[min(520px,90vw)] origin-top-left rounded-2xl border transition duration-150 ${
          open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
        }`}
      >
        <div className="p-5">
          <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
            {isFr ? "5 formats sur site" : "5 on-site formats"}
          </p>
          <ul className="space-y-1">
            {INTERVENTIONS.map((item) => {
              const href = isFr ? item.pathFr : item.pathEn;
              return (
                <li key={item.slug}>
                  <Link
                    href={href as never}
                    onClick={() => setOpen(false)}
                    data-cta-tracking="header_interventions_format"
                    data-source-slug={item.slug}
                    className="group hover:bg-sand focus-visible:ring-terracotta -mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-2 transition focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className="text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {shortLabel(item.slug, isFr)}
                      </span>
                      <span className="text-fg-muted text-[11px]">
                        {shortDuration(item.slug, isFr)} · {shortGroup(item.slug, isFr)}
                      </span>
                    </span>
                    <span className="text-terracotta-deep shrink-0 text-[12px] font-semibold tabular-nums">
                      {shortPrice(item.slug, isFr)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-border/60 mt-4 border-t pt-4">
            <Link
              href="/interventions"
              onClick={() => setOpen(false)}
              data-cta-tracking="header_interventions_hub"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {isFr ? "Voir les 5 formats" : "See the 5 formats"}
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
