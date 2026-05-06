import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { getHelpArticle, getAllHelpSlugs, HELP_ARTICLES, slugify } from "@/content/transversal";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllHelpSlugs().flatMap((slug) => routing.locales.map((locale) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const article = getHelpArticle(slug);
  if (!article) return {};
  const copy = article[locale as Locale];
  return buildProductMetadata({
    locale,
    path: `/centre-aide/${slug}`,
    title: `${copy.title} · ${locale === "fr" ? "Aide AxionIA" : "AxionIA help"}`,
    description: copy.excerpt,
    alternates: { fr: `/centre-aide/${slug}`, en: `/help/${slug}` },
  });
}

export default async function HelpArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const article = getHelpArticle(slug);
  if (!article) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const copy = article[loc];

  // Article Schema — generic help article (HowTo would be possible if step-based).
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.title,
    description: copy.excerpt,
    inLanguage: locale,
    url: `${SITE_URL}/${locale}/centre-aide/${slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "AxionIA",
      url: SITE_URL,
    },
    publisher: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
    articleSection: article.category,
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Centre d'aide" : "Help center", href: "/centre-aide" },
      { name: copy.title, href: `/centre-aide/${slug}` },
    ],
  });

  // Suggested neighbours — same category first.
  const others = HELP_ARTICLES.filter((a) => a.slug !== article.slug)
    .sort((a) => (slugify(a.category) === slugify(article.category) ? -1 : 1))
    .slice(0, 4);

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={article.category}
        title={copy.title}
        description={copy.excerpt}
      />

      <Section>
        <Container className="max-w-3xl">
          <div className="prose prose-slate max-w-none text-base leading-relaxed text-gray-700">
            <p>{copy.body}</p>
          </div>
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Voir aussi" : "See also"}>
        <Container className="max-w-3xl">
          <ul className="border-border divide-border divide-y border-y">
            {others.map((o) => (
              <li key={o.slug}>
                <a
                  href={`/${locale}/centre-aide/${o.slug}`}
                  className="text-fg hover:text-primary block py-4 text-base font-medium"
                >
                  {o[loc].title} →
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Question pas couverte ?" : "Question not covered?"}
        description={
          isFr
            ? "Contactez-nous — réponse sous 48 h ouvrées."
            : "Contact us — reply within 48 business hours."
        }
        cta={
          <Cta href="/contact" size="lg">
            Contact →
          </Cta>
        }
      />

      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
