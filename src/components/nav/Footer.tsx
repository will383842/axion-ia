import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getTopRegionsByPib } from "@/content/regions";
import { SERVICES, serviceOfficial } from "@/content/services";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function Footer() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";
  const year = new Date().getFullYear();

  // Les 5 verticales (= les 5 services réels d'Axion-IA), via le SSOT
  // `src/content/services.ts` (nom officiel unique), dans l'ordre canonique +
  // Tarifs en clôture. ❌ NE PAS réintroduire de libellé de service en dur ici
  // ni « Essentielle » (un FORMAT de formation, pas un service).
  const services = [
    ...SERVICES.map((s) => ({ href: s.href, label: serviceOfficial(s, isFr) })),
    { href: "/tarifs", label: isFr ? "Tarifs" : "Pricing" },
  ];

  // Contenus à lire / outils pour décider. « Simulateur ROI » rapatrié ici depuis
  // « Entreprise » (2026-06-10) : c'est un outil interactif d'aide à la décision,
  // pas une info corporate.
  const resources = [
    { href: "/stack-ia", label: isFr ? "Stack IA 2026" : "AI Stack 2026" },
    { href: "/guide-ia", label: isFr ? "Guide IA opérationnelle" : "Operational AI guide" },
    { href: "/blog", label: t("nav.blog") },
    { href: "/glossaire", label: isFr ? "Glossaire" : "Glossary" },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
    { href: "/guides", label: isFr ? "Guides piliers" : "Pillar guides" },
    { href: "/comparaisons", label: isFr ? "Comparatifs" : "Comparisons" },
    { href: "/roi", label: isFr ? "Simulateur ROI" : "ROI simulator" },
    { href: "/galerie", label: isFr ? "Banque d'images" : "Image bank" },
    { href: "/faq", label: "FAQ" },
  ];

  // Ordonné par sens : identité (qui/comment) → presse → nous rejoindre → joindre.
  const company = [
    { href: "/a-propos", label: t("nav.about") },
    { href: "/methodologie", label: isFr ? "Méthodologie" : "Methodology" },
    { href: "/presse", label: isFr ? "Presse" : "Press" },
    { href: "/carrieres" as const, label: isFr ? "Carrières" : "Careers" },
    {
      href: "/devenir-commercial-ia" as const,
      label: isFr ? "Recrutement commerciaux" : "Sales rep recruitment",
    },
    { href: "/contact", label: t("nav.contact") },
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
    { href: "/reserver", label: isFr ? "Réserver un appel" : "Book a call" },
  ];

  const legal = [
    { href: "/mentions-legales", label: isFr ? "Mentions légales" : "Legal notice" },
    { href: "/conditions-generales", label: isFr ? "CGV" : "Terms" },
    { href: "/politique-confidentialite", label: isFr ? "Confidentialité" : "Privacy" },
    { href: "/accessibilite", label: isFr ? "Accessibilité" : "Accessibility" },
    { href: "/cookies", label: "Cookies" },
    { href: "/sous-processeurs", label: isFr ? "Sous-traitants" : "Subprocessors" },
  ];

  // Top 6 régions par PIB + hub — maillage crawl sans surcharger le footer.
  const topRegions = getTopRegionsByPib(6);
  const implantationsLinks: Array<{ href: string; label: string }> = [
    { href: "/implantations", label: isFr ? "Toutes les régions" : "All regions" },
    ...topRegions.map((r) => ({
      href: `/implantations/${r.slug}`,
      label: r.nameFr,
    })),
  ];

  // A11y Sprint Phase 2 2026-05-29 : `/85` → `/100` pour passer WCAG 2.1 SC 1.4.3
  // (4.5:1) sur le mocha-rich background. Ajout `min-h-[44px]` pour SC 2.5.5
  // target size (44×44 mini cible mobile).
  const linkCn =
    "text-mocha-fg hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex min-h-[44px] items-center rounded-sm py-2 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

  return (
    <footer
      data-tone="dark"
      className="bg-mocha-rich text-mocha-fg relative isolate overflow-hidden"
      style={{
        // V-04 P0h (Sprint Correctif 2026-05-22) — CSS containment.
        // Isole les shifts internes du footer (font-swap Fraunces/Manrope sur
        // bg mocha-rich, hydration LocaleSwitcher) de la contribution CLS de
        // la page → CLS footer maintenu ≤ 0.05 sur toutes les routes.
        contain: "layout style",
      }}
    >
      <span
        aria-hidden="true"
        className="bg-terracotta/40 pointer-events-none absolute inset-x-0 top-0 block h-px"
      />

      {/* Largeur — 2026-06-08 (Will, révise l'Option A du 2026-06-03) : footer
          EN PLEINE PAGE. Le contenu interne s'étend jusqu'aux gouttières (rampe
          `px-4 sm:px-6 lg:px-10 xl:px-16`) avec un cap large `max-w-[1920px]
          mx-auto` qui ne sert qu'en ultra-large (≥1920 px) pour ne pas étirer
          les colonnes sur un moniteur 2560 px+. Le fond mocha-rich reste
          bord-à-bord. ⚠️ Volontairement plus large que `Container` (corps
          plafonné à 1366) : sur grand écran, les colonnes du footer dépassent les
          bords du contenu — rendu « footer pleine page » voulu (cohérent avec
          `Header.tsx`). Padding vertical py-10/lg:py-14 conservé. */}
      <div className="mx-auto w-full max-w-[1920px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14 xl:px-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16 xl:gap-20">
          {/* Brand */}
          <div className="lg:w-60 lg:shrink-0">
            <Link
              href={ROUTES.home}
              aria-label={BRAND.name}
              className="text-mocha-fg focus-visible:ring-terracotta focus-visible:ring-offset-mocha mb-4 inline-flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span
                className="text-xl leading-none font-medium tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Axion
                <span aria-hidden="true" className="text-mocha-fg/60 mx-0.5">
                  -
                </span>
                <span
                  className="text-terracotta-soft italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  IA
                </span>
              </span>
            </Link>
            <p
              className="text-mocha-fg/90 max-w-[14rem] text-sm leading-relaxed"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? (
                <>
                  Le {BRAND.taglineFr}{" "}
                  <span className="text-terracotta-soft italic">des dirigeants qui avancent</span>.
                </>
              ) : (
                <>
                  The {BRAND.taglineEn}{" "}
                  <span className="text-terracotta-soft italic">that moves leaders forward</span>.
                </>
              )}
            </p>
            <div className="mt-6">
              <SocialLinks />
            </div>
          </div>

          {/* Link columns */}
          <nav
            aria-label={t("nav.footerLabel")}
            className="grid flex-1 grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-8 lg:gap-y-0"
          >
            <FooterColumn title={t("footer.services")} items={services} />
            <FooterColumn title={t("footer.resources")} items={resources} />
            <FooterColumn title={t("footer.company")} items={company} />
            <FooterColumn title={t("nav.implantations")} items={implantationsLinks} />
            <FooterColumn title={t("footer.legal")} items={legal} />
          </nav>
        </div>

        {/* Bottom strip */}
        <div className="border-border-on-mocha text-mocha-fg/55 mt-12 flex flex-col gap-3 border-t pt-5 text-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-mocha-fg/80 font-medium">{`© ${year} ${BRAND.legalName}`}</span>
            <Dot />
            <span>{isFr ? "Hébergé en UE" : "Hosted in EU"}</span>
            <Dot />
            <span>France</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Link href="/charte-editoriale" className={linkCn}>
              {isFr ? "Charte éditoriale" : "Editorial policy"}
            </Link>
            <Dot />
            <Link href="/transparence" className={linkCn}>
              {isFr ? "Transparence IA" : "AI transparency"}
            </Link>
            <Dot />
            <Link href="/corrections" className={linkCn}>
              {isFr ? "Corrections" : "Corrections"}
            </Link>
            <Dot />
            <a href="/sitemap.xml" className={linkCn}>
              {t("footer.siteMap")}
            </a>
            <Dot />
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}

function Dot() {
  return <span aria-hidden="true" className="bg-mocha-fg/30 inline-block h-1 w-1 rounded-full" />;
}

interface FooterColumnProps {
  title: string;
  items: ReadonlyArray<{ href: string; label: string }>;
}
function FooterColumn({ title, items }: FooterColumnProps) {
  return (
    <div>
      <h3 className="text-mocha-fg/50 mb-3.5 text-[11px] font-semibold tracking-[0.16em] uppercase">
        {title}
      </h3>
      <ul className="space-y-2.5 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href as never}
              className="text-mocha-fg/80 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex min-h-[44px] items-center rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="3.5" />
      <path d="M7 10v7" />
      <circle cx="7" cy="7" r="0.5" fill="currentColor" stroke="none" strokeWidth="2" />
      <path d="M11 17v-4.5a2.5 2.5 0 0 1 5 0V17" />
      <path d="M11 10v7" />
    </svg>
  );
}

function SocialLinks() {
  return (
    <ul className="flex items-center gap-2">
      <li>
        <a
          href="https://www.linkedin.com/company/axion-ia"
          target="_blank"
          rel="noopener noreferrer external"
          aria-label="LinkedIn"
          className="text-mocha-fg/80 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex h-11 w-11 items-center justify-center rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <LinkedinIcon className="h-[17px] w-[17px]" />
        </a>
      </li>
    </ul>
  );
}
