import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";

// Server Component. 5 items, ZERO dropdown (CLAUDE.md v6 §9.2).
// Editorial doctrine v3 — fond `bg-terracotta` constant (figé, pas de
// transition au scroll). Layout balanced :
// [Logo badge] [Nav 1, 2]    [CTA centré]    [Nav 3, 4] [Locale]
export async function Header() {
  const t = await getTranslations();

  // Nav items split — 2 gauche du CTA, 2 droite du CTA.
  const navLeft = [
    { href: "/interventions", label: t("nav.interventions") },
    { href: "/audit", label: t("nav.audit") },
  ];
  const navRight = [
    { href: "/implementation", label: t("nav.implementation") },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
  ];
  const navAll = [...navLeft, ...navRight];

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
            href="/"
            aria-label="AxionIA"
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

        {/* CENTRE : CTA pill bleu primary saillant */}
        <Link
          href="/reserver"
          className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta ring-mocha-fg/30 hover:ring-mocha-fg/60 hidden h-12 shrink-0 items-center gap-2 rounded-full px-6 text-sm font-bold shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] ring-2 ring-offset-0 transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:inline-flex"
        >
          {t("cta.bookInterventionLong")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        {/* DROITE : Nav 3+4 + Locale */}
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
              {navAll.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              <Link
                href="/reserver"
                className="bg-terracotta text-mocha-fg mt-4 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold"
              >
                {t("cta.bookInterventionLong")}
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
