import { getLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

// 5-zone footer per CLAUDE.md v6 §10. Pure Server Component.
// Editorial doctrine v3 — bg mocha rich premium, tagline serif géant,
// columns avec underline animée terracotta, newsletter dark-aware via
// `[data-tone='dark']` wrapper (cf. globals.css).
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
    { href: "/blog", label: t("nav.blog") },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
    { href: "/faq", label: "FAQ" },
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
  ];
  const company = [
    { href: "/a-propos", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
  ];
  const legal = [
    { href: "/mentions-legales", label: isFr ? "Mentions légales" : "Legal notice" },
    { href: "/conditions-generales", label: isFr ? "Conditions générales" : "Terms" },
    {
      href: "/politique-confidentialite",
      label: isFr ? "Politique de confidentialité" : "Privacy policy",
    },
    { href: "/cookies", label: "Cookies" },
    { href: "/rgpd", label: "RGPD / GDPR" },
  ];

  return (
    <footer
      data-tone="dark"
      className="bg-mocha-rich text-mocha-fg relative isolate overflow-hidden"
    >
      {/* Pre-footer transition — gradient sand → mocha pour transition douce */}
      <div
        aria-hidden="true"
        className="from-bg pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent opacity-10"
      />
      {/* Hairline terracotta en haut pour cohérence avec header */}
      <span
        aria-hidden="true"
        className="bg-terracotta/40 pointer-events-none absolute inset-x-0 top-0 block h-px"
      />

      <Container className="relative py-24 lg:py-28">
        {/* Top : tagline éditorial géant signature */}
        <div className="border-border-on-mocha mb-20 max-w-4xl border-b pb-16">
          <Link
            href="/"
            aria-label="AxionIA"
            className="text-mocha-fg focus-visible:ring-terracotta focus-visible:ring-offset-mocha mb-8 inline-flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span
              className="text-3xl leading-none font-medium tracking-tight"
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
          <p
            className="text-mocha-fg max-w-3xl text-[clamp(2rem,4vw,3.5rem)] leading-[1.1] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? (
              <>
                Le cabinet IA{" "}
                <span className="text-terracotta-soft italic">qui vous fait gagner</span>.
                <br />
                Interventions, audits, implémentations — UE, Tallinn.
              </>
            ) : (
              <>
                The AI consultancy{" "}
                <span className="text-terracotta-soft italic">that makes you win</span>.
                <br />
                Sessions, audits, implementations — EU, Tallinn.
              </>
            )}
          </p>
        </div>

        {/* Newsletter + Columns */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-14 sm:grid-cols-3 lg:grid-cols-5">
          {/* Newsletter zone */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <NewsletterFooterForm />
            <SocialLinks />
          </div>

          <FooterColumn title={t("footer.services")} items={services} />
          <FooterColumn title={t("footer.resources")} items={resources} />
          <div className="space-y-12">
            <FooterColumn title={t("footer.company")} items={company} />
            <FooterColumn title={t("footer.legal")} items={legal} />
          </div>
        </div>

        {/* Bottom strip — proof points + copyright + locale switcher */}
        <div className="border-border-on-mocha text-mocha-fg/60 mt-20 grid gap-6 border-t pt-10 text-xs lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-mocha-fg/85">© {year} AxionIA OÜ</span>
            <span aria-hidden="true" className="bg-mocha-fg/30 inline-block h-1 w-1 rounded-full" />
            <span>{isFr ? "Tallinn, Estonie" : "Tallinn, Estonia"}</span>
            <span aria-hidden="true" className="bg-mocha-fg/30 inline-block h-1 w-1 rounded-full" />
            <span>
              {isFr ? "Hébergé en UE · Hetzner Frankfurt" : "Hosted in EU · Hetzner Frankfurt"}
            </span>
            <span aria-hidden="true" className="bg-mocha-fg/30 inline-block h-1 w-1 rounded-full" />
            <span>RGPD</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="/sitemap.xml"
              className="hover:text-mocha-fg focus-visible:ring-terracotta focus-visible:ring-offset-mocha rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t("footer.siteMap")}
            </a>
            <LocaleSwitcher />
          </div>
        </div>
      </Container>
    </footer>
  );
}

interface FooterColumnProps {
  title: string;
  items: ReadonlyArray<{ href: string; label: string }>;
}
function FooterColumn({ title, items }: FooterColumnProps) {
  return (
    <div>
      <h3 className="text-mocha-fg/55 text-[11px] font-semibold tracking-[0.18em] uppercase">
        {title}
      </h3>
      <ul className="mt-6 space-y-3.5 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href as never}
              className="text-mocha-fg/80 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha group relative inline-flex min-h-9 items-center transition focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span className="relative">
                {item.label}
                <span
                  aria-hidden="true"
                  className="bg-terracotta-soft absolute -bottom-0.5 left-0 h-px w-0 transition-all duration-300 group-hover:w-full"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Brand SVGs inline.
function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14ZM8.34 18.34V10.5H5.67v7.84h2.67ZM7 9.34a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1Zm11.34 9V13.7c0-2.49-1.33-3.65-3.1-3.65a2.68 2.68 0 0 0-2.43 1.34h-.04V10.5h-2.55v7.84h2.66v-3.88c0-1.04.2-2.04 1.48-2.04 1.27 0 1.29 1.18 1.29 2.1v3.82h2.69Z" />
    </svg>
  );
}
function YouTubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M23.5 6.51a3 3 0 0 0-2.11-2.13C19.55 4 12 4 12 4s-7.55 0-9.39.38A3 3 0 0 0 .5 6.51 31 31 0 0 0 .12 12a31 31 0 0 0 .38 5.49 3 3 0 0 0 2.11 2.13C4.45 20 12 20 12 20s7.55 0 9.39-.38a3 3 0 0 0 2.11-2.13 31 31 0 0 0 .38-5.49 31 31 0 0 0-.38-5.49ZM9.75 15.5v-7l6.5 3.5-6.5 3.5Z" />
    </svg>
  );
}

function SocialLinks() {
  const socials = [
    { href: "https://www.linkedin.com/company/axion-ia", label: "LinkedIn", Icon: LinkedInIcon },
    { href: "https://www.youtube.com/@axion-ia", label: "YouTube", Icon: YouTubeIcon },
  ];
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3">
      {socials.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer external"
          aria-label={label}
          className="text-mocha-fg/80 border-border-on-mocha hover:border-terracotta-soft hover:text-terracotta-soft hover:bg-mocha-fg/5 focus-visible:ring-terracotta focus-visible:ring-offset-mocha cta-lift inline-flex h-12 w-12 items-center justify-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}

async function NewsletterFooterForm() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";
  const labels = isFr
    ? {
        email: "Email professionnel",
        consent: "J'accepte de recevoir la newsletter mensuelle. Désinscription en un clic.",
        submit: "S'abonner",
        sending: "Envoi…",
        success: "Inscription confirmée. Premier email sous 7 jours.",
        failure: "Erreur. Réessayez ou écrivez à contact@axion-ia.com.",
      }
    : {
        email: "Professional email",
        consent: "I agree to receive the monthly newsletter. One-click unsubscribe.",
        submit: "Subscribe",
        sending: "Sending…",
        success: "Subscribed. First email within 7 days.",
        failure: "Error. Try again or email contact@axion-ia.com.",
      };
  return (
    <div className="max-w-md">
      <h3 className="text-mocha-fg/55 mb-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
        {t("footer.newsletter")}
      </h3>
      <p
        className="text-mocha-fg mb-5 max-w-sm text-lg leading-snug font-medium"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {isFr ? (
          <>
            Une <span className="text-terracotta-soft italic">analyse IA</span> par mois. Aucun
            spam, désinscription en 1 clic.
          </>
        ) : (
          <>
            One <span className="text-terracotta-soft italic">AI analysis</span> per month. No spam,
            one-click unsubscribe.
          </>
        )}
      </p>
      <NewsletterForm labels={labels} variant="inline" />
    </div>
  );
}
