import { getLocale, getTranslations } from "next-intl/server";
import { Mail, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";

// Server Component. Header v5 2026-05-28 (Will) — layout 2026 dual-CTA :
//   [Logo · Cabinet IA pour entreprises]   nav 6 items     [Nous écrire ghost] [Réserver un appel primary]
//
// Améliorations vs v4 :
//   - Tagline B2B « Cabinet IA pour entreprises » à côté du logo → signal
//     d'audience immédiat (le visiteur sait que c'est pour son entreprise).
//   - 2e CTA secondaire ghost outlined « Nous écrire » → laisse le choix entre
//     appel direct (engagement fort) et message (engagement plus doux).
//     Pattern dual-CTA Linear/Stripe/Cal.com : ghost contre primary, hiérarchie
//     visuelle préservée par les couleurs (transparent vs bleu glow).
export async function Header() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";

  // 6 items nav — labels 1-2 mots, single-row, cluster gauche.
  // `multiline: true` + `\n` injecté force le label sur 2 lignes (visuel
  // compact pour les intitulés qui ont une qualification distinctive :
  // « 1 to 1 » et « Native IA »).
  const navItems = [
    {
      href: "/interventions/collectives",
      label: t("nav.formationsEntreprise"),
      multiline: false,
    },
    {
      href: "/un-a-un",
      label: t("nav.coachingOneToOne").replace(" 1 to 1", "\n1 to 1"),
      multiline: true,
    },
    { href: "/audit", label: t("nav.companyAudit"), multiline: false },
    {
      href: "/implementation",
      label: t("nav.implementationShort").replace(" sur-mesure", "\nsur-mesure"),
      multiline: true,
    },
    {
      href: "/sites-web-augmentes",
      label: t("nav.sitesWebSaas").replace(" Native", "\nNative"),
      multiline: true,
    },
    { href: "/tarifs", label: t("nav.pricing"), multiline: false },
  ] as const;

  // Items supplémentaires uniquement dans le drawer mobile (pages stratégiques
  // accessibles depuis mobile, pas seulement depuis le footer).
  const navMobileExtras = [
    { href: "/cas-concrets", label: t("nav.caseStudies") },
    { href: "/implantations", label: t("nav.implantations") },
    { href: "/stack-ia", label: isFr ? "Stack IA" : "AI Stack" },
    { href: "/blog", label: t("nav.blog") },
    { href: "/faq", label: "FAQ" },
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
    { href: "/a-propos", label: t("nav.about") },
  ] as const;

  const taglineB2B = isFr ? "Cabinet IA pour entreprises" : "AI consultancy for companies";

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
      {/* Layout 2026 : Logo + tagline + Nav clusterisés à GAUCHE | dual-CTA à
          DROITE (Contact ghost + Appel primary), pattern Linear/Stripe. */}
      <div className="relative flex h-20 w-full items-center gap-4 px-6 sm:px-8 lg:gap-8 lg:px-10 xl:gap-10 xl:px-14">
        {/* Bloc identité : logo serif badge ivoire + tagline B2B EN DESSOUS.
            Layout colonne → libère l'espace horizontal pour la nav (vs ancien
            layout row qui occupait ~200px de plus). Tagline visible à tous les
            breakpoints desktop (plus de compromis xl-only). */}
        <div className="flex shrink-0 flex-col items-start gap-1">
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
          {/* Tagline B2B sous le logo — signal d'audience cible (TPE/PME/ETI).
              Serif italique pour cohérence éditoriale avec le « IA » du logo. */}
          <span
            aria-hidden="true"
            className="text-mocha-fg hidden pl-1 text-[12px] leading-none font-medium tracking-tight italic lg:block"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {taglineB2B}
          </span>
        </div>

        {/* Nav principale clusterisée à GAUCHE (collée au logo) — pattern 2026.
            Gaps généreux gap-10/xl:gap-14 (40/56 px) pour aérer la barre. */}
        <nav
          aria-label={t("nav.primaryLabel")}
          className="hidden items-center gap-12 lg:flex xl:gap-16"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              multiline={item.multiline}
            />
          ))}
        </nav>

        {/* Bloc dual-CTA à DROITE — ml-auto pour pousser à l'extrême droite,
            gap-3 entre les 2 CTAs pour les lire comme un groupe distinct. */}
        <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
          {/* CTA secondaire → /contact (formulaire).
              Fond ivoire bg-paper + texte terracotta : cohérent avec le badge
              logo, lisible sur fond terracotta du header. Engagement plus doux
              que l'appel (asynchrone) — hiérarchie préservée car le CTA primary
              porte le bleu + glow shadow (signal d'action fort). */}
          <Link
            href={ROUTES.contact}
            aria-label={t("cta.contactAria")}
            data-cta="header-secondary"
            data-cta-tracking="cta_header_contact_click"
            className="bg-paper text-terracotta shadow-subtle hover:shadow-card focus-visible:ring-mocha focus-visible:ring-offset-terracotta inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>{isFr ? "Nous écrire" : "Email us"}</span>
          </Link>

          {/* CTA primaire → /appel (réservation Calendly).
              Fond bleu primary + glow shadow : signal d'action fort, conforme
              aux standards 2026 (Linear, Stripe, Cal.com, Anthropic, Resend). */}
          <Link
            href={ROUTES.appel}
            aria-label={t("cta.bookCallAria")}
            data-cta="header-primary"
            data-cta-tracking="cta_header_book_call_click"
            className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta ring-mocha-fg/30 hover:ring-mocha-fg/60 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] ring-2 ring-offset-0 transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span>{t("cta.bookCall")}</span>
          </Link>
        </div>

        {/* Mobile drawer trigger (mobile only) */}
        <div className="ml-auto lg:hidden">
          <MobileNav>
            <nav aria-label={t("nav.primaryLabel")} className="flex flex-col gap-1 text-base">
              {/* Tagline B2B affichée en tête du drawer mobile pour le signal
                  d'audience (le tagline desktop est xl-only). */}
              <p className="text-fg-muted mb-2 text-[12px] font-medium tracking-tight">
                {taglineB2B}
              </p>
              {/* 6 items principaux */}
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              {/* Items secondaires (pages stratégiques accessibles depuis mobile) */}
              <div className="border-border mt-3 mb-1 border-t pt-3" aria-hidden="true" />
              {navMobileExtras.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              {/* Dual-CTA mobile — parité desktop : Appel primary + Contact ghost */}
              <Link
                href={ROUTES.appel}
                aria-label={t("cta.bookCallAria")}
                data-cta="header-mobile-primary"
                data-cta-tracking="cta_header_book_call_click"
                className="bg-primary text-primary-fg mt-4 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span>{t("cta.bookCall")}</span>
              </Link>
              <Link
                href={ROUTES.contact}
                aria-label={t("cta.contactAria")}
                data-cta="header-mobile-secondary"
                data-cta-tracking="cta_header_contact_click"
                className="bg-paper text-terracotta shadow-subtle mt-2 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>{isFr ? "Nous écrire" : "Email us"}</span>
              </Link>
            </nav>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
