import { getLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

// 5-zone footer per CLAUDE.md v6 §10. Pure Server Component.
// Editorial doctrine v3 — bg-mocha-rich (alternative au noir), texte ivoire,
// logo serif italique, columns sobres, dividers terracotta.
export async function Footer() {
  const t = await getTranslations();
  const locale = await getLocale();
  const year = new Date().getFullYear();

  const services = [
    {
      href: "/interventions/essentielle",
      label: locale === "fr" ? "Essentielle · 490 €" : "Essential · €490",
    },
    { href: "/interventions", label: t("nav.interventions") },
    { href: "/audit", label: t("nav.audit") },
    { href: "/implementation", label: t("nav.implementation") },
  ];
  const resources = [
    { href: "/blog", label: t("nav.blog") },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
    { href: "/faq", label: "FAQ" },
    { href: "/centre-aide", label: locale === "fr" ? "Centre d'aide" : "Help center" },
  ];
  const company = [
    { href: "/a-propos", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
  ];
  const legal = [
    { href: "/mentions-legales", label: locale === "fr" ? "Mentions légales" : "Legal notice" },
    { href: "/conditions-generales", label: locale === "fr" ? "Conditions générales" : "Terms" },
    {
      href: "/politique-confidentialite",
      label: locale === "fr" ? "Politique de confidentialité" : "Privacy policy",
    },
    { href: "/cookies", label: "Cookies" },
    { href: "/rgpd", label: "RGPD / GDPR" },
  ];

  return (
    <footer className="bg-mocha-rich text-mocha-fg relative overflow-hidden">
      <Container className="relative py-20 lg:py-24">
        {/* Top : tagline éditorial géant */}
        <div className="border-border-on-mocha mb-16 max-w-3xl border-b pb-12">
          <Link
            href="/"
            aria-label="AxionIA"
            className="text-mocha-fg focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
            className="text-mocha-fg/85 mt-6 max-w-xl text-2xl leading-snug font-medium"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {locale === "fr" ? (
              <>
                Cabinet IA <span className="text-terracotta-soft italic">opérationnel</span>.
                <br />
                OÜ estonienne · Tallinn.
              </>
            ) : (
              <>
                <span className="text-terracotta-soft italic">Operational</span> AI consultancy.
                <br />
                Estonian OÜ · Tallinn.
              </>
            )}
          </p>
        </div>

        {/* Columns + Newsletter */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-5">
          {/* Newsletter zone */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <NewsletterFooterForm />
            <SocialLinks />
          </div>

          <FooterColumn title={t("footer.services")} items={services} />
          <FooterColumn title={t("footer.resources")} items={resources} />
          <div className="space-y-10">
            <FooterColumn title={t("footer.company")} items={company} />
            <FooterColumn title={t("footer.legal")} items={legal} />
          </div>
        </div>

        {/* Bottom strip */}
        <div className="border-border-on-mocha text-mocha-fg/70 mt-16 flex flex-col gap-4 border-t pt-8 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} AxionIA OÜ · {t("footer.rights")}
          </p>
          <div className="flex items-center gap-5">
            {/* Native <a> — sitemap.xml is global, not locale-prefixed. */}
            <a href="/sitemap.xml" className="hover:text-mocha-fg transition">
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
      <h3 className="text-mocha-fg/60 text-[11px] font-semibold tracking-[0.16em] uppercase">
        {title}
      </h3>
      <ul className="mt-5 space-y-3 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href as never}
              className="text-mocha-fg/85 hover:text-terracotta-soft focus-visible:ring-terracotta inline-flex min-h-9 items-center transition focus-visible:rounded-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {item.label}
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
    <div className="mt-8 flex flex-wrap items-center gap-2">
      {socials.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer external"
          aria-label={label}
          className="text-mocha-fg/80 border-border-on-mocha hover:border-terracotta-soft hover:text-terracotta-soft focus-visible:ring-terracotta inline-flex h-11 w-11 items-center justify-center rounded-full border transition focus-visible:ring-2 focus-visible:outline-none"
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
    <div className="max-w-sm">
      <h3 className="text-mocha-fg/60 mb-4 text-[11px] font-semibold tracking-[0.16em] uppercase">
        {t("footer.newsletter")}
      </h3>
      <NewsletterForm labels={labels} variant="inline" />
    </div>
  );
}
