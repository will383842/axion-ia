"use client";
// use-client: mega-menu interactif (hover-intent, focus management, ARIA dynamique) — délégué à HeaderMegaMenu.
// Mega-menu Header « Interventions ». Délègue le shell à `HeaderMegaMenu`
// pour rester strictement cohérent visuellement avec `HeaderImplantationsMenu`
// (même trigger, même panel, même transitions, même a11y).
//
// Layout 3-col aligné sur Implantations :
// • Col 1 — Tarifs fixes (Essentielle dès 490 € + Gagner du temps 990 €)
// • Col 2 — Sur devis (CODIR / Conférence / Sur demande)
// • Col 3 — Hub bg-halo-warm avec icône + tagline serif + CTA hub
//
// Le contenu reste strictement synchrone avec
// `src/app/[locale]/interventions/page.tsx::buildCards()`. Les 4 paliers
// Essentielle sont agrégés en 1 ligne « dès 490 € HT · 2 à 30+ pers. »
// pour éviter la verbosité du dropdown (le listing les détaille en 4 cards).

import * as React from "react";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ClaudeLogo } from "@/components/visual/ClaudeLogo";
import { HeaderMegaMenu } from "./HeaderMegaMenu";

interface HeaderInterventionsMenuProps {
  triggerLabel: string;
  isFr: boolean;
}

interface MenuItem {
  key: string;
  href: string;
  labelFr: string;
  labelEn: string;
  metaFr: string;
  metaEn: string;
  priceFr: string;
  priceEn: string;
  /** Flag visuel : applique l'accent Anthropic Claude (logo + peach branded)
   *  pour différencier la formation outil-spécifique. */
  isClaude?: boolean;
}

const FIXED_PRICE_ITEMS: ReadonlyArray<MenuItem> = [
  {
    key: "essentielle",
    href: "/interventions/essentielle",
    labelFr: "Essentielle",
    labelEn: "Essential",
    metaFr: "1 jour · 2 à 30 personnes",
    metaEn: "1 day · 2 to 30 people",
    priceFr: "dès 490 € HT",
    priceEn: "from €490",
  },
  {
    key: "gagner-du-temps",
    href: "/reserver",
    labelFr: "Gagner du temps",
    labelEn: "Save Time",
    metaFr: "1 jour · 2 à 20 personnes",
    metaEn: "1 day · 2 to 20 people",
    priceFr: "990 € HT",
    priceEn: "€990",
  },
];

const ON_REQUEST_ITEMS: ReadonlyArray<MenuItem> = [
  {
    key: "formation-claude",
    href: "/contact",
    labelFr: "Formation Claude",
    labelEn: "Claude training",
    metaFr: "1 jour · Chat · Cowork · Code",
    metaEn: "1 day · Chat · Cowork · Code",
    priceFr: "Sur devis",
    priceEn: "On request",
    isClaude: true,
  },
  {
    key: "dirigeants",
    href: "/interventions/dirigeants",
    labelFr: "Dirigeants · CODIR",
    labelEn: "Executives & Leadership",
    metaFr: "1 jour · CODIR · dès 2",
    metaEn: "1 day · Leadership · 2+",
    priceFr: "Sur devis",
    priceEn: "On request",
  },
  {
    key: "conference",
    href: "/interventions/conference",
    labelFr: "Conférence",
    labelEn: "Talk",
    metaFr: "1 journée · effectif libre",
    metaEn: "1 day · open headcount",
    priceFr: "Sur devis",
    priceEn: "On request",
  },
  {
    key: "sur-demande",
    href: "/contact",
    labelFr: "Sur demande particulière",
    labelEn: "Bespoke",
    metaFr: "Selon besoin · sur mesure",
    metaEn: "As needed · custom",
    priceFr: "Sur devis",
    priceEn: "On request",
  },
];

function MenuItemLink({
  item,
  isFr,
  onClose,
}: {
  item: MenuItem;
  isFr: boolean;
  onClose: () => void;
}) {
  // Anthropic Claude brand colors — exception anti-hex documentée pour
  // identifier la formation outil-spécifique. Couleurs imposées par la marque
  // Anthropic (peach + deep + cream bg).
  const isClaude = item.isClaude === true;
  return (
    <Link
      href={item.href as never}
      onClick={onClose}
      data-cta-tracking="header_interventions_format"
      data-source-slug={item.key}
      className={
        isClaude
          ? "group -mx-2 flex items-center justify-between gap-3 rounded-md border border-[#D97757]/30 px-2 py-1.5 transition hover:bg-[#FFF5EC] focus-visible:ring-2 focus-visible:ring-[#D97757] focus-visible:ring-offset-1 focus-visible:outline-none" // hex-ok: brand-anthropic-claude
          : "group hover:bg-sand focus-visible:ring-terracotta -mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 transition focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
      }
    >
      {isClaude ? (
        <ClaudeLogo
          ariaLabel="Claude (Anthropic)"
          className={"h-4 w-4 shrink-0 text-[#D97757]" /* */} // hex-ok: brand-anthropic-claude
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={
            isClaude
              ? "block text-sm font-semibold tracking-tight text-[#9C3E1E] transition" // hex-ok: brand-anthropic-claude
              : "text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
          }
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {isFr ? item.labelFr : item.labelEn}
        </span>
        <span
          className={
            isClaude ? "text-[11px] text-[#9C3E1E]/70" : "text-fg-muted text-[11px]" // hex-ok: brand-anthropic-claude
          }
        >
          {isFr ? item.metaFr : item.metaEn}
        </span>
      </span>
      <span
        className={
          isClaude
            ? "shrink-0 text-[12px] font-semibold text-[#D97757] tabular-nums" // hex-ok: brand-anthropic-claude
            : "text-terracotta-deep shrink-0 text-[12px] font-semibold tabular-nums"
        }
      >
        {isFr ? item.priceFr : item.priceEn}
      </span>
    </Link>
  );
}

export function HeaderInterventionsMenu({
  triggerLabel,
  isFr,
}: HeaderInterventionsMenuProps): React.ReactNode {
  return (
    <HeaderMegaMenu
      triggerLabel={triggerLabel}
      triggerHref="/interventions"
      triggerTrackingId="header_interventions_megamenu_trigger"
      panelLabel={triggerLabel}
      panelAlign="left"
    >
      {({ close }) => (
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-3">
          {/* Col 1 — Tarifs fixes (Essentielle + Gagner du temps) */}
          <div className="border-border/60 border-b p-5 sm:border-r sm:border-b-0">
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Tarifs fixes" : "Fixed price"}
            </p>
            <ul className="space-y-1">
              {FIXED_PRICE_ITEMS.map((item) => (
                <li key={item.key}>
                  <MenuItemLink item={item} isFr={isFr} onClose={close} />
                </li>
              ))}
            </ul>
            <p className="text-fg-muted mt-4 text-[11px] leading-snug">
              {isFr
                ? "Réservation directe sur le calendrier · confirmation immédiate."
                : "Book directly on the calendar · instant confirmation."}
            </p>
          </div>

          {/* Col 2 — Sur devis (CODIR / Conférence / Sur demande) */}
          <div className="border-border/60 border-b p-5 sm:border-r sm:border-b-0">
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Sur devis" : "On request"}
            </p>
            <ul className="space-y-1">
              {ON_REQUEST_ITEMS.map((item) => (
                <li key={item.key}>
                  <MenuItemLink item={item} isFr={isFr} onClose={close} />
                </li>
              ))}
            </ul>
            <p className="text-fg-muted mt-4 text-[11px] leading-snug">
              {isFr
                ? "Réponse devis sous 48 h ouvrées après cadrage par appel."
                : "Quote reply within 48 business hours after framing call."}
            </p>
          </div>

          {/* Col 3 — Hub */}
          <div className="bg-halo-warm rounded-r-2xl p-5">
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {isFr ? "Tous les formats" : "All formats"}
            </p>
            <div
              aria-hidden="true"
              className="text-terracotta/70 mb-4 flex items-center justify-center"
            >
              <GraduationCap className="h-12 w-12" strokeWidth={1.5} />
            </div>
            <p
              className="text-fg mb-4 text-base leading-tight font-semibold"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? (
                <>
                  Formez vos équipes à l&apos;IA{" "}
                  <span className="text-terracotta italic">en 1 jour, sur site</span>.
                </>
              ) : (
                <>
                  Train your teams on AI{" "}
                  <span className="text-terracotta italic">in 1 day, on site</span>.
                </>
              )}
            </p>
            <Link
              href="/interventions"
              onClick={close}
              data-cta-tracking="header_interventions_hub"
              data-source-target="/interventions"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {isFr ? "Voir tous les formats" : "See all formats"}
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </HeaderMegaMenu>
  );
}
