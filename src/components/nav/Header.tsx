import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";
import { INTERVENTION_TIERS, formatPrice, getEntryTier } from "@/content/pricing";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";

// Server Component. 4 items desktop + ZERO dropdown (CLAUDE.md v6 §9.2 —
// révision §9.2-bis acceptée en bloc 2026-05-07 mais Sprint 15 différé).
// Editorial doctrine v3 — fond `bg-terracotta` constant (figé, pas de
// transition au scroll). Layout balanced :
// [Logo badge] [Nav 1, 2]    [CTA centré + badge prix]    [Nav 3, 4] [Locale]
//
// Mobile drawer (§9.4 partiel) : items principaux (4) + extras (6) +
// CTA réserver. CTA bar permanente niveau 2 reportée Sprint 15.
export async function Header() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";

  // Nav items split — 2 gauche du CTA, 3 droite du CTA (desktop).
  // 5e item « Implantations » ajouté Sprint 14.9 (pSEO villes/régions, ADR 0006)
  // — point d'entrée vers les 12 régions et 2 157 communes éligibles.
  const navLeft = [
    { href: "/interventions", label: t("nav.interventions") },
    { href: "/audit", label: t("nav.audit") },
  ] as const;
  const navRight = [
    { href: "/implementation", label: t("nav.implementation") },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
    { href: "/implantations", label: t("nav.implantations") },
  ] as const;
  const navAll = [...navLeft, ...navRight];

  // Items supplémentaires affichés UNIQUEMENT dans le drawer mobile (§9.4
  // partiel — la doctrine demande ces pages stratégiques accessibles depuis
  // le menu mobile, pas seulement le footer).
  const navMobileExtras = [
    { href: "/stack-ia", label: isFr ? "Stack IA" : "AI Stack" },
    { href: "/blog", label: t("nav.blog") },
    { href: "/faq", label: "FAQ" },
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
    { href: "/a-propos", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
  ] as const;

  // Badge prix CTA central (§9.3) — dérivé de pricing.ts (source unique).
  // Sprint 14.10.3 : un changement de tarif Essentielle dans pricing.ts se
  // propage automatiquement ici sans modification du Header.
  const entryFormatted = formatPrice(getEntryTier(INTERVENTION_TIERS), isFr ? "fr" : "en");
  // Sprint 14.10.7 (Will 2026-05-11) : « À partir de » / « Starting at »
  // au lieu de « dès » / « from » pour cohérence end-to-end sur tout le site.
  const ctaPriceBadge = isFr
    ? `À partir de ${entryFormatted.replace(" HT", "")}`
    : `Starting at ${entryFormatted.replace(" (excl. VAT)", "")}`;
  const ctaAriaLabel = `${t("cta.bookInterventionLong")} — ${ctaPriceBadge}`;

  return (
    <header
      data-tone="terracotta"
      className="bg-terracotta border-terracotta-deep text-mocha-fg supports-[backdrop-filter]:bg-terracotta/95 sticky top-0 z-40 border-b backdrop-blur-md"
    >
      {/* Hairline mocha sous le header pour signature subtile */}
      <span
        aria-hidden="true"
        className="bg-mocha/30 pointer-events-none absolute inset-x-0 bottom-0 block h-px"
      />
      {/* Layout pleine largeur : Logo + Nav split + CTA centré + Locale */}
      <div className="relative flex h-20 w-full items-center gap-4 px-6 sm:px-8 lg:h-24 lg:gap-3 lg:px-12 xl:gap-4 xl:px-16">
        {/* GAUCHE : Logo (avec bulle ivoire pour ressortir) + Nav 1+2 */}
        <div className="flex flex-1 items-center justify-between gap-6 lg:gap-8">
          {/* Logo dans badge ivoire — fait ressortir "Axion-IA" sur fond terracotta. */}
          <Link
            href={ROUTES.home}
            aria-label={BRAND.name}
            className="bg-paper text-fg shadow-subtle focus-visible:ring-mocha focus-visible:ring-offset-terracotta hover:shadow-card inline-flex shrink-0 items-center gap-1 rounded-xl px-4 py-2 transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span
              className="text-2xl leading-none font-medium tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Axion
              <span aria-hidden="true" className="text-fg/70 mx-0.5">
                -
              </span>
              <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
                IA
              </span>
            </span>
          </Link>

          {/* Desktop nav — 2 premiers items, poussés à droite (près du CTA) */}
          <nav
            aria-label={t("nav.home")}
            className="hidden items-center gap-6 lg:flex lg:justify-end xl:gap-8"
          >
            {navLeft.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </div>

        {/* CENTRE : CTA pill bleu primary saillant + badge prix Essentielle */}
        <Link
          href="/reserver"
          aria-label={ctaAriaLabel}
          data-cta="header-central"
          data-cta-tracking="cta_central_click"
          className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta ring-mocha-fg/30 hover:ring-mocha-fg/60 hidden h-12 shrink-0 items-center gap-2 rounded-full pr-5 pl-6 text-sm font-bold shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] ring-2 ring-offset-0 transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:inline-flex"
        >
          <span>{t("cta.bookInterventionLong")}</span>
          <span
            aria-hidden="true"
            className="bg-paper text-primary inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-bold tracking-tight tabular-nums"
          >
            {ctaPriceBadge}
          </span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        {/* DROITE : Nav 3+4+5 + Locale */}
        <div className="hidden flex-1 items-center justify-between gap-6 lg:flex lg:gap-8">
          <nav
            aria-label={`${t("nav.home")} 2`}
            className="hidden items-center gap-6 lg:flex lg:justify-start xl:gap-8"
          >
            {navRight.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
          <LocaleSwitcher />
        </div>

        {/* Mobile drawer trigger (mobile only) */}
        <div className="ml-auto lg:hidden">
          <MobileNav>
            <nav aria-label={t("nav.home")} className="flex flex-col gap-1 text-base">
              {/* Items principaux (4) — strict miroir du desktop */}
              {navAll.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              {/* Séparateur fin avant les pages secondaires */}
              <div className="border-border mt-3 mb-1 border-t pt-3" aria-hidden="true" />
              {/* Items secondaires (6) — pages stratégiques accessibles depuis mobile */}
              {navMobileExtras.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              {/* CTA réserver + badge prix (parité desktop) */}
              <Link
                href="/reserver"
                aria-label={ctaAriaLabel}
                data-cta="header-mobile-central"
                data-cta-tracking="cta_central_click"
                className="bg-terracotta text-mocha-fg mt-4 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold"
              >
                <span>{t("cta.bookInterventionLong")}</span>
                <span
                  aria-hidden="true"
                  className="bg-paper text-terracotta-deep inline-flex h-6 items-center rounded-full px-2 text-[11px] font-bold tracking-tight tabular-nums"
                >
                  {ctaPriceBadge}
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
                <span className="text-fg-muted text-xs tracking-[0.16em] uppercase">
                  {t("common.switchLanguage")}
                </span>
                <LocaleSwitcher />
              </div>
            </nav>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
