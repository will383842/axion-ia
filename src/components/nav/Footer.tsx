import { getLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";

// 5-zone footer per CLAUDE.md v6 §10. Pure Server Component.
export async function Footer() {
  const t = await getTranslations();
  const locale = await getLocale();
  const year = new Date().getFullYear();

  const services = [
    { href: "/interventions/essentielle", label: "★ Essentielle 490 €" },
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
    <footer className="border-border bg-bg text-fg border-t">
      <Container className="py-16 lg:py-20">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-5">
          {/* Zone 1 — Identity */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link
              href="/"
              aria-label="AxionIA"
              className="bg-primary text-primary-fg inline-flex h-9 w-9 items-center justify-center rounded-sm text-sm font-bold"
            >
              A
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-700">
              AxionIA — {t("footer.tagline")}. OÜ estonienne · Tallinn.
            </p>
          </div>

          <FooterColumn title={t("footer.services")} items={services} />
          <FooterColumn title={t("footer.resources")} items={resources} />
          <div>
            <FooterColumn title={t("footer.company")} items={company} />
            <div className="mt-8">
              <FooterColumn title={t("footer.legal")} items={legal} />
            </div>
          </div>
        </div>

        <div className="border-border mt-12 flex flex-col gap-4 border-t pt-6 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} AxionIA OÜ · {t("footer.rights")}
          </p>
          <div className="flex items-center gap-4">
            {/* Native <a> — sitemap.xml is global, not locale-prefixed. */}
            <a href="/sitemap.xml" className="hover:text-fg">
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
      <h3 className="text-fg text-xs font-semibold tracking-wide uppercase">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm text-gray-700">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href as never} className="hover:text-fg">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
