"use client";
// use-client: hover-intent state + keyboard handlers (Esc, Tab) pour le
// mega-menu Header « Implantations » (Sprint 14.9, ADR 0005).
//
// Doctrine ADR 0005 garde-fous : WCAG 2.2 AA, hover-intent 150-250 ms,
// fermeture sur Esc, Tab navigable, fermeture en cliquant ailleurs.
// Pas de mega-menu mobile (drawer accordéon plat dans MobileNav).
//
// 3 colonnes : régions top 6 PIB · villes pilotes · hub.

import * as React from "react";
import { ArrowUpRight, MapPin, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Region } from "@/content/regions";
import type { Ville } from "@/content/villes";

interface RegionItem {
  slug: Region["slug"];
  nameFr: string;
  prefecture: string;
  pibBillionsEur?: number;
}

interface VilleItem {
  slug: Ville["slug"];
  nameFr: string;
  region: string;
  departementLabel?: string;
  /**
   * Services × ville pilote disponibles (Sprint 14.10.1 Commit C). Si la
   * ville a un copy.services.<svc>, le service apparaît en sous-lien sous
   * la card ville. Ex Paris : audit + interventions + implementation actifs.
   */
  hasServicesAudit?: boolean;
  hasServicesInterventions?: boolean;
  hasServicesImplementation?: boolean;
}

export interface HeaderImplantationsMenuProps {
  /** Top régions par PIB (6 entrées attendues). */
  topRegions: ReadonlyArray<RegionItem>;
  /** Villes pilotes — V1 = Paris seul. */
  pilotVilles: ReadonlyArray<VilleItem>;
  /** Label localisé du déclencheur (ex « Implantations » / « Locations »). */
  triggerLabel: string;
  /** Locale courante. */
  isFr: boolean;
}

const HOVER_OPEN_DELAY_MS = 100;
const HOVER_CLOSE_DELAY_MS = 200;

export function HeaderImplantationsMenu({
  topRegions,
  pilotVilles,
  triggerLabel,
  isFr,
}: HeaderImplantationsMenuProps): React.ReactNode {
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

  // Fermeture Esc + clic extérieur (WCAG 2.2 AA + ADR 0005).
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

  // Cleanup timers à l'unmount.
  React.useEffect(() => () => cancelTimers(), []);

  return (
    // wrapper passif : l'élément interactif est le `<Link>` enfant (lui-même
    // focusable + keyboard). Les listeners mouse/focus du wrapper ne servent
    // qu'à piloter le state hover-intent du mega-menu, pas à activer une
    // action utilisateur — pas de role="button" donc.
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
        // Si le focus quitte le wrapper (Tab vers l'extérieur), fermeture immédiate.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          cancelTimers();
          setOpen(false);
        }
      }}
      className="relative"
    >
      <Link
        href="/implantations"
        aria-haspopup="true"
        aria-expanded={open}
        className="text-mocha-fg/85 hover:text-mocha-fg focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta inline-flex items-center gap-1.5 rounded-sm px-1 text-sm font-medium tracking-tight transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        data-cta-tracking="header_megamenu_trigger"
      >
        {triggerLabel}
        <span
          aria-hidden="true"
          className={`text-mocha-fg/60 inline-block text-[10px] transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </Link>

      {/* Panel mega-menu — 3 colonnes, doctrine v3 ivoire chaud */}
      <div
        role="region"
        aria-label={triggerLabel}
        className={`bg-paper text-fg shadow-card pointer-events-${open ? "auto" : "none"} border-border-strong/40 absolute top-full right-0 z-50 mt-3 w-[min(720px,90vw)] origin-top-right rounded-2xl border transition duration-150 ${
          open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
        }`}
        // ARIA hidden via aria-expanded sur le trigger ; on garde le panel
        // dans le DOM pour transition fluide mais on le désactive pointer-events
        // quand fermé.
      >
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-3">
          {/* Col 1 — Régions top 6 PIB */}
          <div className="border-border/60 border-b p-5 sm:border-r sm:border-b-0">
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Top régions" : "Top regions"}
            </p>
            <ul className="space-y-1">
              {topRegions.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/implantations/${r.slug}` as never}
                    onClick={() => setOpen(false)}
                    data-cta-tracking="header_megamenu_region"
                    data-source-region={r.slug}
                    className="group hover:bg-sand focus-visible:ring-terracotta -mx-2 block rounded-md px-2 py-1.5 transition focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                  >
                    <span
                      className="text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {r.nameFr}
                    </span>
                    <span className="text-fg-muted text-[11px]">
                      {r.prefecture}
                      {typeof r.pibBillionsEur === "number" ? ` · ${r.pibBillionsEur} Md€` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 2 — Villes pilotes */}
          <div className="border-border/60 border-b p-5 sm:border-r sm:border-b-0">
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Villes pilotes" : "Pilot cities"}
            </p>
            {pilotVilles.length > 0 ? (
              <ul className="space-y-3">
                {pilotVilles.map((v) => (
                  <li key={v.slug}>
                    <Link
                      href={`/implantations/${v.region}/${v.slug}` as never}
                      onClick={() => setOpen(false)}
                      data-cta-tracking="header_megamenu_ville"
                      data-source-ville={v.slug}
                      data-source-region={v.region}
                      className="group hover:bg-sand focus-visible:ring-terracotta -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                    >
                      <Sparkles aria-hidden="true" className="text-terracotta h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span
                          className="text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {v.nameFr}
                        </span>
                        <span className="text-fg-muted text-[11px]">
                          {isFr ? "Page locale + 3 services" : "Local page + 3 services"}
                          {v.departementLabel ? ` · ${v.departementLabel}` : ""}
                        </span>
                      </span>
                    </Link>
                    {/* Sous-liens services × ville pilote (Sprint 14.10.1 Commit C) */}
                    {v.hasServicesAudit ||
                    v.hasServicesInterventions ||
                    v.hasServicesImplementation ? (
                      <ul className="border-border/40 mt-1 ml-6 flex flex-wrap gap-x-3 gap-y-1 border-l pl-3">
                        {v.hasServicesAudit ? (
                          <li>
                            <Link
                              href={`/audit/par-ville/${v.slug}` as never}
                              onClick={() => setOpen(false)}
                              data-cta-tracking="header_megamenu_service_audit"
                              data-source-ville={v.slug}
                              className="text-primary hover:text-primary-hover text-[11px] font-semibold tracking-tight underline-offset-2 hover:underline"
                            >
                              {isFr ? "Audit IA" : "AI audit"}
                            </Link>
                          </li>
                        ) : null}
                        {v.hasServicesInterventions ? (
                          <li>
                            <Link
                              href={`/interventions/par-ville/${v.slug}` as never}
                              onClick={() => setOpen(false)}
                              data-cta-tracking="header_megamenu_service_interventions"
                              data-source-ville={v.slug}
                              className="text-terracotta-deep hover:text-terracotta text-[11px] font-semibold tracking-tight underline-offset-2 hover:underline"
                            >
                              {isFr ? "Interventions IA" : "AI sessions"}
                            </Link>
                          </li>
                        ) : null}
                        {v.hasServicesImplementation ? (
                          <li>
                            <Link
                              href={`/implementation/par-ville/${v.slug}` as never}
                              onClick={() => setOpen(false)}
                              data-cta-tracking="header_megamenu_service_implementation"
                              data-source-ville={v.slug}
                              className="text-sage hover:text-fg text-[11px] font-semibold tracking-tight underline-offset-2 hover:underline"
                            >
                              {isFr ? "Implémentation IA" : "AI implementation"}
                            </Link>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-fg-soft text-sm leading-relaxed">
                {isFr ? "Bientôt disponible." : "Coming soon."}
              </p>
            )}
            <p className="text-fg-muted mt-4 text-[11px] leading-snug">
              {isFr
                ? "Les autres villes (~2 150 communes) sont éligibles aux interventions, pages détaillées en cours de production."
                : "Other cities (~2,150 communes) are eligible for engagements, detailed pages in production."}
            </p>
          </div>

          {/* Col 3 — Hub + carte */}
          <div className="bg-halo-warm rounded-r-2xl p-5">
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Carte des implantations" : "Locations map"}
            </p>
            <div
              aria-hidden="true"
              className="text-terracotta/70 mb-4 flex items-center justify-center"
            >
              <MapPin className="h-12 w-12" strokeWidth={1.5} />
            </div>
            <p
              className="text-fg mb-4 text-base leading-tight font-semibold"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? (
                <>
                  Cabinet IA opérationnel{" "}
                  <span className="text-terracotta italic">partout en France</span>.
                </>
              ) : (
                <>
                  Operational AI consultancy{" "}
                  <span className="text-terracotta italic">across France</span>.
                </>
              )}
            </p>
            <Link
              href="/implantations"
              onClick={() => setOpen(false)}
              data-cta-tracking="header_megamenu_hub"
              data-source-target="/implantations"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {isFr ? "Voir toutes les régions" : "See all regions"}
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
