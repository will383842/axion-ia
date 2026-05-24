import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";
import { SolutionsMegaMenu } from "./SolutionsMegaMenu";

// Server Component. Sprint Header refonte 2026-05-24 (Will).
//
// Doctrine 2026/2027 — loi de Hick : 3 onglets top-level desktop + 1 CTA pur :
//   [Logo]   [Nos solutions ▾]  [Tarifs]  [Cas concrets]   [Contact CTA]
//
// Changements clés vs v3 (Editorial doctrine héritée) :
//   - Mega-menu unique « Nos solutions » regroupe les 5 offres
//     (Formations / Audits / Implémentations / 1-to-1 / Plateforme web)
//     au lieu des 5 items éclatés + l'ancien InterventionsMegaMenu
//   - CTA central « Contact » remplace l'ancien « Réserver une intervention »
//     + badge prix dynamique. Plus de liaison à pricing.ts côté Header.
//   - LocaleSwitcher retiré (Will 2026-05-24 — réintégration ultérieure)
//
// Conservé :
//   - Fond `bg-terracotta` constant, hairline mocha, sticky z-40, backdrop-blur
//   - Logo en badge ivoire (shadow-subtle → shadow-card au hover)
//   - Drawer mobile Radix Sheet (focus trap, ESC, click-outside)
//   - Tous les attributs ARIA WCAG 2.2 AA
export async function Header() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";

  // 3 onglets top-level (hors CTA central) : 1 mega-menu + 2 simples.
  // SolutionsMegaMenu est rendu inline (besoin des props i18n), Tarifs + Cas
  // concrets sont des NavLink standards.
  const navAfterSolutions = [
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
    formations: { label: t("nav.formations"), hint: t("nav.formationsHint") },
    oneToOne: { label: t("nav.oneToOne"), hint: t("nav.oneToOneHint") },
    audit: { label: t("nav.auditShort"), hint: t("nav.auditHint") },
    implementation: {
      label: t("nav.implementationShort"),
      hint: t("nav.implementationHint"),
    },
    platform: { label: t("nav.platform"), hint: t("nav.platformHint") },
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
      <div className="relative flex h-20 w-full items-center gap-4 px-6 sm:px-8 lg:h-24 lg:gap-3 lg:px-12 xl:gap-4 xl:px-16">
        {/* GAUCHE : Logo (avec bulle ivoire) + Nav mega-menu Solutions */}
        <div className="flex flex-1 items-center justify-between gap-6 lg:gap-8">
          <Link
            href={ROUTES.home}
            aria-label={BRAND.name}
            className="bg-paper shadow-subtle focus-visible:ring-mocha focus-visible:ring-offset-terracotta hover:shadow-card inline-flex shrink-0 items-center rounded-xl px-3 py-1.5 transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Image
              src="/images/logo.webp"
              alt={BRAND.name}
              width={400}
              height={225}
              className="h-11 w-auto lg:h-12"
              priority
            />
          </Link>

          <nav
            aria-label={t("nav.primaryLabel")}
            className="hidden items-center gap-6 lg:flex lg:justify-end xl:gap-8"
          >
            <SolutionsMegaMenu
              isFr={isFr}
              triggerLabel={t("nav.solutions")}
              panelLabel={t("nav.solutionsLabel")}
              tagline={t("nav.solutionsTagline")}
              featuredTitle={t("nav.featuredTitle")}
              featuredDesc={t("nav.featuredDesc")}
              featuredCta={t("nav.featuredCta")}
              items={solutionsItems}
            />
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

        {/* DROITE : Tarifs + Cas concrets */}
        <div className="hidden flex-1 items-center justify-between gap-6 lg:flex lg:gap-8">
          <nav
            aria-label={t("nav.primaryLabel")}
            className="hidden items-center gap-6 lg:flex lg:justify-start xl:gap-8"
            data-nav-section="secondary"
          >
            {navAfterSolutions.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </div>

        {/* Mobile drawer trigger (mobile only) */}
        <div className="ml-auto lg:hidden">
          <MobileNav>
            <nav aria-label={t("nav.primaryLabel")} className="flex flex-col gap-1 text-base">
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
              {navAfterSolutions.map((item) => (
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
