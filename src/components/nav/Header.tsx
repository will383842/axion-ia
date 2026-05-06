import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";

// Server Component. 5 items, ZERO dropdown (CLAUDE.md v6 §9.2).
// Editorial doctrine v3 — fond `bg-terracotta` au top (couleur signature),
// transition vers `bg-mocha` quand scrolled. Layout :
// [Logo + Nav]                  [CTA pill centré]                  [Locale]
// Le CTA central est l'élément le plus saillant — call-to-action prioritaire.
export async function Header() {
  const t = await getTranslations();

  const navItems = [
    { href: "/interventions", label: t("nav.interventions") },
    { href: "/audit", label: t("nav.audit") },
    { href: "/implementation", label: t("nav.implementation") },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
  ];

  return (
    <header
      data-tone="terracotta"
      className="bg-terracotta border-terracotta-deep text-mocha-fg data-[scrolled=true]:bg-mocha data-[scrolled=true]:border-mocha supports-[backdrop-filter]:bg-terracotta/95 supports-[backdrop-filter]:data-[scrolled=true]:bg-mocha/85 sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,height,backdrop-filter,box-shadow] duration-300 ease-out data-[scrolled=true]:shadow-[0_8px_24px_-12px_rgba(42,37,32,0.5)] data-[scrolled=true]:backdrop-blur-xl"
    >
      {/* Hairline mocha sous le header pour signature subtile */}
      <span
        aria-hidden="true"
        className="bg-mocha/30 data-[scrolled=true]:bg-terracotta/60 pointer-events-none absolute inset-x-0 bottom-0 block h-px"
      />
      {/* Layout : Logo+Nav (gauche, flex-1) — CTA centré — Locale (droite) */}
      <div className="relative flex h-20 w-full items-center gap-6 px-6 transition-[height] duration-300 ease-out sm:px-8 lg:h-24 lg:px-12 xl:px-16 [[data-scrolled=true]_&]:h-16 [[data-scrolled=true]_&]:lg:h-20">
        {/* GAUCHE : Logo + Nav */}
        <div className="flex flex-1 items-center gap-8 xl:gap-12">
          {/* Logo — wordmark serif italique editorial original :
              "Axion" anthracite + "IA" italique terracotta (ton-sur-ton subtil
              avec le fond du header — signature visuelle). */}
          <Link
            href="/"
            aria-label="AxionIA"
            className="text-fg focus-visible:ring-mocha focus-visible:ring-offset-terracotta inline-flex shrink-0 items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span
              className="text-3xl leading-none font-medium tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Axion
              <span
                className="text-terracotta [[data-scrolled=true]_&]:text-terracotta-soft italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                IA
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label={t("nav.home")} className="hidden items-center gap-7 lg:flex xl:gap-10">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </div>

        {/* CENTRE : CTA pill ivoire saillant — call-to-action prioritaire */}
        <Link
          href="/interventions/essentielle"
          className="bg-mocha-fg text-mocha cta-lift hover:bg-paper focus-visible:ring-mocha focus-visible:ring-offset-terracotta hidden h-12 shrink-0 items-center gap-2 rounded-full px-6 text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:inline-flex"
        >
          {t("cta.bookInterventionLong")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        {/* DROITE : Locale switcher */}
        <div className="hidden flex-1 items-center justify-end gap-4 lg:flex">
          <LocaleSwitcher />
        </div>

        {/* Mobile drawer trigger (mobile only) */}
        <div className="ml-auto lg:hidden">
          <MobileNav>
            <nav aria-label={t("nav.home")} className="flex flex-col gap-1 text-base">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              <Link
                href="/interventions/essentielle"
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
