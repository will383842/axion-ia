import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";

// Server Component. 5 items, ZERO dropdown (CLAUDE.md v6 §9.2).
// Editorial doctrine v3 — fond mocha rich (sandwich avec footer mocha),
// backdrop-blur glass, logo "Axion" + "IA" italique terracotta-soft, nav
// adaptée pour fond sombre, CTA pill ivoire inversé pour pop maximum.
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
      data-tone="dark"
      className="bg-mocha/95 supports-[backdrop-filter]:bg-mocha/85 text-mocha-fg border-border-on-mocha sticky top-0 z-40 border-b backdrop-blur-md"
    >
      {/* Hairline terracotta sous le header pour signature subtile */}
      <span
        aria-hidden="true"
        className="bg-terracotta/40 pointer-events-none absolute inset-x-0 bottom-0 block h-px"
      />
      <Container className="relative flex h-16 items-center justify-between gap-4 lg:h-20">
        {/* Logo — wordmark serif italique editorial */}
        <Link
          href="/"
          aria-label="AxionIA"
          className="text-mocha-fg focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span
            className="text-2xl leading-none font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Axion
            <span
              className="text-terracotta-soft italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              IA
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label={t("nav.home")}
          className="hidden flex-1 items-center justify-center gap-8 lg:flex"
        >
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* Right: CTA + locale (desktop) */}
        <div className="hidden items-center gap-4 lg:flex">
          <LocaleSwitcher />
          <Link
            href="/interventions/essentielle"
            className="bg-mocha-fg text-mocha cta-lift hover:bg-paper focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {t("cta.bookIntervention")} · 490&nbsp;€
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Mobile drawer */}
        <MobileNav>
          <nav aria-label={t("nav.home")} className="flex flex-col gap-1 text-base">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
            ))}
            <Link
              href="/interventions/essentielle"
              className="bg-primary text-primary-fg mt-4 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold"
            >
              {t("cta.bookIntervention")} · 490&nbsp;€
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
      </Container>
    </header>
  );
}
