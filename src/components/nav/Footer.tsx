import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

// Editorial doctrine v3 — footer compact best-practices 2026.
// Pleine largeur (pas de Container max-w), padding lateral comme header,
// hauteur drastiquement reduite, texte tous >= mocha-fg/75 pour visibilite,
// social icons Lucide modernes minimalistes, layout 5 columns aligned.
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
    { href: "/roi", label: isFr ? "Simulateur ROI" : "ROI simulator" },
  ];
  const legal = [
    { href: "/mentions-legales", label: isFr ? "Mentions légales" : "Legal notice" },
    { href: "/conditions-generales", label: isFr ? "CGV" : "Terms" },
    {
      href: "/politique-confidentialite",
      label: isFr ? "Confidentialité" : "Privacy",
    },
    { href: "/cookies", label: "Cookies" },
    { href: "/rgpd", label: "RGPD" },
  ];

  return (
    <footer
      data-tone="dark"
      className="bg-mocha-rich text-mocha-fg relative isolate overflow-hidden"
    >
      {/* Hairline terracotta en haut (cohérence avec header) */}
      <span
        aria-hidden="true"
        className="bg-terracotta/40 pointer-events-none absolute inset-x-0 top-0 block h-px"
      />

      {/* Pleine largeur avec padding lateral progressif (comme header) */}
      <div className="px-6 py-14 sm:px-8 lg:px-12 lg:py-16 xl:px-16">
        {/* Top : tagline compact + newsletter en ligne */}
        <div className="border-border-on-mocha grid gap-10 border-b pb-12 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div>
            <Link
              href="/"
              aria-label="AxionIA"
              className="text-mocha-fg focus-visible:ring-terracotta focus-visible:ring-offset-mocha mb-5 inline-flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
              className="text-mocha-fg max-w-xl text-2xl leading-snug font-medium lg:text-[28px]"
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
          </div>

          {/* Newsletter compacte côté droit */}
          <div className="lg:max-w-md lg:min-w-[420px]">
            <p className="text-mocha-fg/75 mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
              {t("footer.newsletter")}
            </p>
            <p className="text-mocha-fg mb-4 text-sm leading-snug">
              {isFr
                ? "Une analyse IA par mois, dans votre inbox. Désinscription en 1 clic."
                : "One AI analysis per month, in your inbox. One-click unsubscribe."}
            </p>
            <NewsletterFooterForm />
          </div>
        </div>

        {/* Columns + social */}
        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:gap-12">
          {/* Brand minimal + social */}
          <div>
            <p className="text-mocha-fg/75 mb-4 text-[11px] font-semibold tracking-[0.18em] uppercase">
              {isFr ? "Suivre" : "Follow"}
            </p>
            <SocialLinks />
            <p className="text-mocha-fg/85 mt-6 max-w-xs text-sm leading-relaxed">
              {isFr
                ? "AxionIA OÜ — Tallinn, Estonie. Cabinet IA opérationnel pour entreprises de toutes tailles."
                : "AxionIA OÜ — Tallinn, Estonia. Operational AI consultancy for companies of all sizes."}
            </p>
          </div>

          <FooterColumn title={t("footer.services")} items={services} />
          <FooterColumn title={t("footer.resources")} items={resources} />
          <FooterColumn title={t("footer.company")} items={company} />
          <FooterColumn title={t("footer.legal")} items={legal} />
        </div>

        {/* Bottom strip — single line dense */}
        <div className="border-border-on-mocha text-mocha-fg/75 flex flex-col gap-4 border-t pt-6 text-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-mocha-fg font-medium">© {year} AxionIA OÜ</span>
            <Dot />
            <span>{isFr ? "Tallinn, Estonie" : "Tallinn, Estonia"}</span>
            <Dot />
            <span>{isFr ? "Hébergé en UE" : "Hosted in EU"}</span>
            <Dot />
            <span>RGPD</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="/sitemap.xml"
              className="text-mocha-fg/85 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t("footer.siteMap")}
            </a>
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}

function Dot() {
  return <span aria-hidden="true" className="bg-mocha-fg/40 inline-block h-1 w-1 rounded-full" />;
}

interface FooterColumnProps {
  title: string;
  items: ReadonlyArray<{ href: string; label: string }>;
}
function FooterColumn({ title, items }: FooterColumnProps) {
  return (
    <div>
      <h3 className="text-mocha-fg/75 mb-5 text-[11px] font-semibold tracking-[0.18em] uppercase">
        {title}
      </h3>
      <ul className="space-y-3 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href as never}
              className="text-mocha-fg/90 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha group inline-flex items-center transition focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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

// Outline minimaliste 2026 — strokeWidth 1.6, viewBox 24, rounded paths.
// Plus moderne que les SVG filled hérités v1 (qui faisaient datés).
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
function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="2.5" y="6" width="19" height="12" rx="3" />
      <path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SocialLinks() {
  // 2026 best practice: minimal outlined circles, hover gradient fill +
  // ArrowUpRight reveal. 44px touch target. Outline icons (vs filled v1).
  const socials = [
    {
      href: "https://www.linkedin.com/company/axion-ia",
      label: "LinkedIn",
      Icon: LinkedinIcon,
    },
    {
      href: "https://www.youtube.com/@axion-ia",
      label: "YouTube",
      Icon: YoutubeIcon,
    },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-3">
      {socials.map(({ href, label, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer external"
            aria-label={label}
            className="text-mocha-fg/85 border-mocha-fg/25 hover:border-terracotta-soft hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Icon className="relative z-10 h-[18px] w-[18px]" />
            {/* Subtle gradient fill on hover */}
            <span
              aria-hidden="true"
              className="bg-terracotta-soft/10 absolute inset-0 -translate-y-full transition-transform duration-300 group-hover:translate-y-0"
            />
            <ArrowUpRight
              className="absolute top-2 right-2 z-10 h-2.5 w-2.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              aria-hidden="true"
              strokeWidth={2}
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

async function NewsletterFooterForm() {
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
  return <NewsletterForm labels={labels} variant="inline" />;
}
