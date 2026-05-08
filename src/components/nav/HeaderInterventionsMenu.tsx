"use client";
// use-client: mega-menu interactif (hover-intent, focus management, ARIA dynamique) — délégué à HeaderMegaMenu.
// Mega-menu Header « Interventions ». Délègue le shell à `HeaderMegaMenu`
// pour rester strictement cohérent visuellement avec `HeaderImplantationsMenu`
// (même trigger, même panel, même transitions, même a11y).
//
// Layout 3-col aligné sur Implantations :
// • Col 1 — Tarifs fixes (Essentielle 1j + Approfondie 2j + Gagner du temps + CODIR)
// • Col 2 — Sur devis (Formation Claude / Conférence / Sur demande)
// • Col 3 — Hub bg-halo-warm avec icône + tagline serif + CTA hub
//
// Le contenu reste strictement synchrone avec
// `src/app/[locale]/interventions/page.tsx::buildCards()`. Pour les formats
// multi-tarifs (Essentielle, Approfondie), les paliers sont agrégés en 1
// ligne « dès N € HT » (le listing les détaille via subTierGrid).
//
// Sprint 14.10.5 — prix dérivés de `pricing.ts INTERVENTION_TIERS` (SSOT).
// Plus aucun hardcoding « 490 € » / « 990 € » dans ce fichier.

import * as React from "react";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ClaudeLogo } from "@/components/visual/ClaudeLogo";
import { HeaderMegaMenu } from "./HeaderMegaMenu";
import { INTERVENTION_TIERS } from "@/content/pricing";

// Helpers internes — récupèrent un tier par id depuis pricing.ts (SSOT) et
// formatent son prix d'entrée en « dès N € HT » / « from €N ». Si la clé
// disparaissait de pricing.ts, le `!` non-null casserait le typecheck →
// signal clair pour le dev.
function entryPriceFr(tierId: string): string {
  const t = INTERVENTION_TIERS.find((x) => x.id === tierId)!;
  return `dès ${t.priceFlat ?? t.priceMin} € HT`;
}
function entryPriceEn(tierId: string): string {
  const t = INTERVENTION_TIERS.find((x) => x.id === tierId)!;
  return `from €${t.priceFlat ?? t.priceMin}`;
}
function flatPriceFr(tierId: string): string {
  const t = INTERVENTION_TIERS.find((x) => x.id === tierId)!;
  return `${t.priceFlat} € HT`;
}
function flatPriceEn(tierId: string): string {
  const t = INTERVENTION_TIERS.find((x) => x.id === tierId)!;
  return `€${t.priceFlat}`;
}

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
    metaFr: "1 jour · 2 à 8 personnes",
    metaEn: "1 day · 2 to 8 people",
    priceFr: entryPriceFr("intervention-essentielle"),
    priceEn: entryPriceEn("intervention-essentielle"),
  },
  {
    key: "approfondie",
    href: "/contact",
    labelFr: "Approfondie",
    labelEn: "Deep dive",
    metaFr: "2 jours · 2 à 30 personnes (équipes)",
    metaEn: "2 days · 2 to 30 people (teams)",
    priceFr: entryPriceFr("intervention-approfondie"),
    priceEn: entryPriceEn("intervention-approfondie"),
  },
  {
    key: "gagner-du-temps",
    href: "/reserver",
    labelFr: "Gagner du temps",
    labelEn: "Save Time",
    metaFr: "1 jour · 2 à 20 personnes",
    metaEn: "1 day · 2 to 20 people",
    priceFr: flatPriceFr("intervention-temps"),
    priceEn: flatPriceEn("intervention-temps"),
  },
  {
    key: "dirigeants",
    href: "/interventions/dirigeants",
    labelFr: "Direction · CODIR",
    labelEn: "Direction · Leadership",
    metaFr: "1 jour 1-to-1 · vous + équipe rapprochée",
    metaEn: "1 day 1-on-1 · you + inner circle",
    priceFr: flatPriceFr("intervention-dirigeants"),
    priceEn: flatPriceEn("intervention-dirigeants"),
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
