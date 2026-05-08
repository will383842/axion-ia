import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getTopRegionsByPib } from "@/content/regions";
import { getIndexableVilles } from "@/content/villes";
import { LocaleSwitcher } from "./LocaleSwitcher";

// 2026 reference: Linear / Anthropic / Stripe / Vercel — single dense row,
// no separate newsletter band, slim one-line bottom strip. Flex+grid combo
// (brand fixed-width left, 4 link cols flex-1 grid right) — avoids the
// `grid-cols-12` JIT pitfall when `--breakpoint-sm` isn't defined.
export async function Footer() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";
  const year = new Date().getFullYear();

  const services = [
    {
      href: "/interventions/essentielle",
      label: isFr ? "Essentielle · 490 €" : "Essential · €490",
    },
    { href: "/interventions", label: t("nav.interventions") },
    { href: "/audit", label: t("nav.audit") },
    { href: "/implementation", label: t("nav.implementation") },
  ];
  const resources = [
    { href: "/stack-ia", label: isFr ? "Stack IA 2026" : "AI Stack 2026" },
    { href: "/comparaisons", label: isFr ? "Comparaisons" : "Comparisons" },
    { href: "/guide-ia", label: isFr ? "Guide IA opérationnelle" : "Operational AI guide" },
    { href: "/glossaire", label: isFr ? "Glossaire" : "Glossary" },
    { href: "/blog", label: t("nav.blog") },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
    { href: "/faq", label: "FAQ" },
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
  ];
  const company = [
    { href: "/a-propos", label: t("nav.about") },
    { href: "/methodologie", label: isFr ? "Méthodologie" : "Methodology" },
    { href: "/contact", label: t("nav.contact") },
    { href: "/roi", label: isFr ? "Simulateur ROI" : "ROI simulator" },
    { href: "/presse", label: isFr ? "Presse" : "Press" },
  ];
  const legal = [
    { href: "/mentions-legales", label: isFr ? "Mentions légales" : "Legal notice" },
    { href: "/conditions-generales", label: isFr ? "CGV" : "Terms" },
    { href: "/politique-confidentialite", label: isFr ? "Confidentialité" : "Privacy" },
    { href: "/accessibilite", label: isFr ? "Accessibilité" : "Accessibility" },
    { href: "/cookies", label: "Cookies" },
  ];
  // 5e zone Implantations — ajoutée Sprint 14.9 (pSEO villes/régions, ADR 0006).
  // Top 6 régions par PIB + lien hub + villes pilotes (V1 = Paris seul).
  // Le footer expose les pages atterissables même quand l'utilisateur n'a pas
  // ouvert le mega-menu (filet de maillage interne pour le crawl Google).
  const topRegions = getTopRegionsByPib(6);
  const pilotVilles = getIndexableVilles();
  const implantationsLinks: Array<{ href: string; label: string }> = [
    { href: "/implantations", label: isFr ? "Toutes les régions" : "All regions" },
    ...topRegions.map((r) => ({
      href: `/implantations/${r.slug}`,
      label: r.nameFr,
    })),
    ...pilotVilles.flatMap((v) => {
      const links: Array<{ href: string; label: string }> = [
        {
          href: `/implantations/${v.region}/${v.slug}`,
          label: `${v.nameFr} ★`,
        },
      ];
      // Sprint 14.10.1 Commit C — sous-liens services × ville pilote.
      // Maillage interne dense vers /<service>/par-ville/<slug>.
      if (v.copy?.services?.audit) {
        links.push({
          href: `/audit/par-ville/${v.slug}`,
          label: isFr ? `Audit IA ${v.nameFr}` : `AI audit ${v.nameFr}`,
        });
      }
      if (v.copy?.services?.interventions) {
        links.push({
          href: `/interventions/par-ville/${v.slug}`,
          label: isFr ? `Interventions IA ${v.nameFr}` : `AI sessions ${v.nameFr}`,
        });
      }
      if (v.copy?.services?.implementation) {
        links.push({
          href: `/implementation/par-ville/${v.slug}`,
          label: isFr ? `Implémentation IA ${v.nameFr}` : `AI implementation ${v.nameFr}`,
        });
      }
      return links;
    }),
  ];

  return (
    <footer
      data-tone="dark"
      className="bg-mocha-rich text-mocha-fg relative isolate overflow-hidden"
    >
      <span
        aria-hidden="true"
        className="bg-terracotta/40 pointer-events-none absolute inset-x-0 top-0 block h-px"
      />

      <div className="px-6 py-10 md:px-8 lg:px-12 lg:py-12 xl:px-16">
        {/* Single dense row : brand fixed-width left + 4 link columns flex-1 right */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16 xl:gap-20">
          {/* Brand column — fixed narrow width */}
          <div className="lg:w-64 lg:shrink-0">
            <Link
              href="/"
              aria-label="AxionIA"
              className="text-mocha-fg focus-visible:ring-terracotta focus-visible:ring-offset-mocha mb-3 inline-flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
              className="text-mocha-fg/85 max-w-xs text-sm leading-snug"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? (
                <>
                  Le cabinet IA{" "}
                  <span className="text-terracotta-soft italic">qui vous fait gagner</span>.
                </>
              ) : (
                <>
                  The AI consultancy{" "}
                  <span className="text-terracotta-soft italic">that makes you win</span>.
                </>
              )}
            </p>
            <div className="mt-5">
              <SocialLinks />
            </div>
          </div>

          {/* 5 link columns — flex-1 to fill remaining space, equal-width grid */}
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-8 lg:gap-y-0">
            <FooterColumn title={t("footer.services")} items={services} />
            <FooterColumn title={t("footer.resources")} items={resources} />
            <FooterColumn title={t("footer.company")} items={company} />
            <FooterColumn title={t("nav.implantations")} items={implantationsLinks} />
            <FooterColumn title={t("footer.legal")} items={legal} />
          </div>
        </div>

        {/* Slim bottom strip — single line on desktop */}
        <div className="border-border-on-mocha text-mocha-fg/65 mt-10 flex flex-col gap-3 border-t pt-5 text-xs lg:mt-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-mocha-fg/85 font-medium">© {year} AxionIA OÜ</span>
            <Dot />
            <span>{isFr ? "Hébergé en UE" : "Hosted in EU"}</span>
            <Dot />
            <span>RGPD</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/sitemap.xml"
              className="hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t("footer.siteMap")}
            </a>
            <Link
              href="/rgpd"
              className="hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              RGPD
            </Link>
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
      <h3 className="text-mocha-fg/55 mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
        {title}
      </h3>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href as never}
              className="text-mocha-fg/85 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Minimal 2026 social: plain icons inline, no bordered circles. LinkedIn
// first (B2B priority), Facebook second.
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
function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function SocialLinks() {
  const socials = [
    {
      href: "https://www.linkedin.com/company/axion-ia",
      label: "LinkedIn",
      Icon: LinkedinIcon,
    },
    {
      href: "https://www.facebook.com/axionia",
      label: "Facebook",
      Icon: FacebookIcon,
    },
  ];
  return (
    <ul className="flex items-center gap-3">
      {socials.map(({ href, label, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer external"
            aria-label={label}
            className="text-mocha-fg/70 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex h-8 w-8 items-center justify-center rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Icon className="h-[18px] w-[18px]" />
          </a>
        </li>
      ))}
    </ul>
  );
}
