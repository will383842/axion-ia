import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";

// Server Component. 5 items, ZERO dropdown (CLAUDE.md v6 §9.2).
// Mobile drawer is the only client island.
export async function Header() {
  const t = await getTranslations();

  const navItems = [
    { href: "/interventions", label: t("nav.interventions") },
    { href: "/audit", label: t("nav.audit") },
    { href: "/implementation", label: t("nav.implementation") },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
  ];

  return (
    <header className="bg-bg/95 border-border supports-[backdrop-filter]:bg-bg/85 sticky top-0 z-40 border-b backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4 lg:h-20">
        {/* Logo */}
        <Link
          href="/"
          aria-label="AxionIA"
          className="bg-primary text-primary-fg inline-flex h-8 w-8 items-center justify-center rounded-sm text-sm font-bold tracking-tight"
        >
          A
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label={t("nav.home")}
          className="hidden flex-1 items-center justify-center gap-7 lg:flex"
        >
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* Right: CTA + locale (desktop) */}
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/interventions/essentielle"
            className="bg-primary text-primary-fg cta-translate inline-flex items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold"
          >
            {t("cta.bookIntervention")} · 490&nbsp;€
            <span aria-hidden="true">→</span>
          </Link>
          <LocaleSwitcher />
        </div>

        {/* Mobile drawer */}
        <MobileNav>
          <nav aria-label={t("nav.home")} className="flex flex-col gap-1 text-base">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
            ))}
            <Link
              href="/interventions/essentielle"
              className="bg-primary text-primary-fg mt-4 flex items-center justify-center gap-2 rounded-sm px-4 py-3 text-base font-semibold"
            >
              {t("cta.bookIntervention")} · 490&nbsp;€ →
            </Link>
            <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
              <span className="text-xs tracking-wide text-gray-700 uppercase">
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
