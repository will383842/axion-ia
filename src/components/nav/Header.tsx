import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";
import { SolutionsMegaMenu } from "./SolutionsMegaMenu";

// Server Component. Sprint Header v2 2026-05-24 (Will, 5 onglets).
//
// Structure nav desktop — 5 onglets top-level + 1 CTA central :
//   [Logo]  [Nos solutions ▾]  [Nos formations]  [Audit entreprise]
//                                [Contact CTA]
//                                [Tarifs]  [Cas concrets]
//
// 2 raccourcis directs (Nos formations + Audit entreprise) sont aussi dans
// le mega-menu Solutions — doublon volontaire Will pour mettre en avant les
// 2 entrées commerciales primaires (la pyramide CA 2026 est 65 % formations
// + 22 % audits = 87 % du revenue → ils méritent leur onglet direct).
//
// Conservé du Sprint Header v1 (PR #22) :
//   - Mega-menu unique « Nos solutions » avec 5 items
//   - CTA central « Contact » (pas de badge prix, pas de liaison pricing.ts)
//   - LocaleSwitcher retiré (Will — réintégration ultérieure)
//   - Server Component, fond bg-terracotta, hairline mocha, sticky z-40
//   - Drawer mobile Radix Sheet, WCAG 2.2 AA
export async function Header() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";

  // 2 raccourcis DIRECTS à gauche du CTA (à côté du mega-menu Solutions).
  // Ces 2 liens dupliquent volontairement 2 items du mega-menu (Will 2026-05-24).
  const navLeftOfCta = [
    { href: "/interventions/collectives", label: t("nav.ourFormations") },
    { href: "/audit", label: t("nav.companyAudit") },
  ] as const;

  // 3 onglets secondaires À DROITE du CTA (desktop).
  // /implementation : label affiché sur 2 lignes pour compacter la largeur
  // (« Implémentations » + « & automatisations »). Le `\n` est honoré via
  // le prop `multiline` qui applique `whitespace-pre-line` côté NavLink.
  const navAfterCtaDesktop = [
    {
      href: "/implementation",
      label: t("nav.implementationShort").replace(" & ", "\n& "),
      multiline: true,
    },
    { href: "/tarifs", label: t("nav.pricing"), multiline: false },
    { href: "/cas-concrets", label: t("nav.caseStudies"), multiline: false },
  ] as const;

  // Mobile drawer : on évite le doublon /implementation (déjà dans solutionsMobileItems)
  const navAfterCtaMobile = [
    { href: "/tarifs", label: t("nav.pricing") },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
  ] as const;

  // Items supplémentaires uniquement dans le drawer mobile (pages stratégiques
  // accessibles depuis mobile, pas seulement depuis le footer).
  const navMobileExtras = [
    { href: "/implantations", label: t("nav.implantations") },
    { href: "/stack-ia", label: isFr ? "Stack IA" : "AI Stack" },
    { href: "/blog", label: t("nav.blog") },
    { href: "/faq", label: "FAQ" },
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
    { href: "/a-propos", label: t("nav.about") },
  ] as const;

  // Solutions mega-menu — i18n résolu côté server, passé client en props.
  const solutionsItems = {
    formations: { label: t("nav.formations") },
    oneToOne: { label: t("nav.oneToOne") },
    audit: { label: t("nav.auditShort") },
    implementation: { label: t("nav.implementationShort") },
    platform: { label: t("nav.platform") },
  } as const;

  // Items mobile mega-menu Solutions (plat, sans featured card pour limiter
  // la profondeur du drawer)
  const solutionsMobileItems = [
    { href: "/interventions/collectives", label: t("nav.formations") },
    { href: "/audit", label: t("nav.auditShort") },
    { href: "/implementation", label: t("nav.implementationShort") },
    { href: "/un-a-un", label: t("nav.oneToOne") },
    { href: "/codage-developpement", label: t("nav.platform") },
  ] as const;

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
      {/* Layout pleine largeur : Logo + Nav split + CTA central Contact */}
      <div className="relative flex h-20 w-full items-center gap-4 px-6 sm:px-8 lg:h-24 lg:gap-4 lg:px-12 xl:gap-6 xl:px-16">
        {/* GAUCHE : Logo (sans encadrement) + Nav mega-menu Solutions */}
        <div className="flex flex-1 items-center justify-between gap-6 lg:gap-10">
          <Link
            href={ROUTES.home}
            aria-label={BRAND.name}
            className="focus-visible:ring-mocha focus-visible:ring-offset-terracotta inline-flex shrink-0 items-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Image
              src="/images/logo.webp"
              alt={BRAND.name}
              width={400}
              height={225}
              className="h-14 w-auto lg:h-16"
              priority
            />
          </Link>

          <nav
            aria-label={t("nav.primaryLabel")}
            className="hidden items-center gap-8 lg:flex lg:justify-end xl:gap-10"
          >
            <SolutionsMegaMenu
              triggerLabel={t("nav.solutions")}
              panelLabel={t("nav.solutionsLabel")}
              tagline={t("nav.solutionsTagline")}
              items={solutionsItems}
            />
            {navLeftOfCta.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </div>

        {/* CENTRE : CTA Contact (pill primary, AUCUN badge prix — pure UX 2027) */}
        <Link
          href={ROUTES.contact}
          aria-label={t("cta.contactAria")}
          data-cta="header-central"
          data-cta-tracking="cta_central_contact_click"
          className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta ring-mocha-fg/30 hover:ring-mocha-fg/60 hidden h-12 shrink-0 items-center gap-2 rounded-full px-6 text-sm font-bold shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] ring-2 ring-offset-0 transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:inline-flex"
        >
          <span>{t("cta.contactLong")}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        {/* DROITE : Implémentations + Tarifs + Cas concrets */}
        <div className="hidden flex-1 items-center justify-between gap-6 lg:flex lg:gap-10">
          <nav
            aria-label={t("nav.primaryLabel")}
            className="hidden items-center gap-8 lg:flex lg:justify-start xl:gap-10"
            data-nav-section="secondary"
          >
            {navAfterCtaDesktop.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                multiline={item.multiline}
              />
            ))}
          </nav>
        </div>

        {/* Mobile drawer trigger (mobile only) */}
        <div className="ml-auto lg:hidden">
          <MobileNav>
            <nav aria-label={t("nav.primaryLabel")} className="flex flex-col gap-1 text-base">
              {/* Raccourcis directs (Nos formations + Audit entreprise) en
                  tête du drawer — parité avec les onglets top-level desktop */}
              {navLeftOfCta.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              <div className="border-border mt-3 mb-1 border-t pt-3" aria-hidden="true" />
              {/* Section Solutions (5 items développés à plat — pas de nested
                  accordion pour limiter la profondeur de navigation mobile) */}
              <p className="text-fg-muted mt-1 mb-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase">
                {t("nav.solutions")}
              </p>
              {solutionsMobileItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              {/* Séparateur fin avant Tarifs + Cas concrets */}
              <div className="border-border mt-3 mb-1 border-t pt-3" aria-hidden="true" />
              {navAfterCtaMobile.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              {/* Items secondaires (6) — pages stratégiques accessibles depuis mobile */}
              <div className="border-border mt-3 mb-1 border-t pt-3" aria-hidden="true" />
              {navMobileExtras.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              {/* CTA Contact mobile (parité desktop, sans badge prix) */}
              <Link
                href={ROUTES.contact}
                aria-label={t("cta.contactAria")}
                data-cta="header-mobile-central"
                data-cta-tracking="cta_central_contact_click"
                className="bg-terracotta text-mocha-fg mt-4 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold"
              >
                <span>{t("cta.contactLong")}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </nav>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
