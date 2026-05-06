import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { JsonLd } from "@/components/marketing/JsonLd";
import { COMPARISONS } from "@/content/comparaisons";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/comparaisons",
    title:
      locale === "fr"
        ? "Comparaisons IA · cabinet vs alternatives · AxionIA"
        : "AI comparisons · consultancy vs alternatives · AxionIA",
    description:
      locale === "fr"
        ? "Comparaisons honnêtes : cabinet IA vs SaaS générique, fine-tuning vs RAG, internalisation vs externalisation."
        : "Honest comparisons: AI consultancy vs generic SaaS, fine-tuning vs RAG, in-house vs outsourcing.",
    alternates: { fr: "/comparaisons", en: "/comparisons" },
  });
}

export default async function ComparisonsListPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: isFr ? "Comparaisons AxionIA" : "AxionIA comparisons",
    url: `${SITE_URL}/${locale}/comparaisons`,
    inLanguage: locale,
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Comparaisons" : "Comparisons", href: "/comparaisons" },
    ],
  });

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Décision" : "Decision"}
        title={isFr ? "Comparaisons IA" : "Honest AI"}
        titleEm={isFr ? "honnêtes" : "comparisons"}
        description={
          isFr
            ? "Tableaux de décision factuels — pas de FUD, pas de complaisance vendeur."
            : "Factual decision tables — no FUD, no vendor complacency."
        }
      />
      <Section>
        <Container>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {COMPARISONS.map((c) => (
              <li key={c.slug}>
                <ArticleCard
                  href={`/comparaisons/${c.slug}`}
                  title={c[loc].title}
                  excerpt={c[loc].excerpt}
                />
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
