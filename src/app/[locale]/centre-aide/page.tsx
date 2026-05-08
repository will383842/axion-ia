import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Illustration } from "@/components/visual/Illustration";
import { HelpHeroSchema } from "@/components/sections/HelpHeroSchema";
import { HELP_ARTICLES, slugify } from "@/content/transversal";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/centre-aide",
    title: locale === "fr" ? "Centre d'aide · Axion-IA" : "Help center · Axion-IA",
    description:
      locale === "fr"
        ? "Centre d'aide Axion-IA : guides pratiques, tutoriels, support utilisateur."
        : "Axion-IA help center: practical guides, tutorials, user support.",
    alternates: { fr: "/centre-aide", en: "/help" },
  });
}

export default async function HelpCenter({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" }];

  // Group articles by category — each category becomes a clickable card
  // pointing to /centre-aide/categorie/{slug} (which already exists).
  const categoriesMap = new Map<
    string,
    { label: string; slug: string; articles: typeof HELP_ARTICLES }
  >();
  for (const article of HELP_ARTICLES) {
    const catSlug = slugify(article.category);
    const existing = categoriesMap.get(catSlug);
    if (existing) {
      categoriesMap.set(catSlug, {
        ...existing,
        articles: [...existing.articles, article],
      });
    } else {
      categoriesMap.set(catSlug, {
        label: article.category,
        slug: catSlug,
        articles: [article],
      });
    }
  }
  const categories = [...categoriesMap.values()];
  const categoryBase = isFr ? "/centre-aide/categorie" : "/help/category";
  const articleBase = isFr ? "/centre-aide" : "/help";

  // ItemList JSON-LD — exposes every article URL to crawlers from the index
  // (was orphan before; only the sitemap pointed at them).
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr ? "Articles d'aide Axion-IA" : "Axion-IA help articles",
    itemListElement: HELP_ARTICLES.map((article, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/${locale}${articleBase}/${article.slug}`,
      name: article[loc].title,
    })),
  } as const;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO 2-col — texte Ã  gauche, HelpHeroSchema (constellation 6 thématiques) Ã  droite */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Centre d'aide" : "Help center"}
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Trouver une réponse " : "Find a quick "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "rapide" : "answer"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Articles groupés par thématique. Chaque question ouvre sur sa propre page indexable. 6 grandes familles couvrent l'essentiel."
                  : "Articles grouped by topic. Each question opens on its own indexable page. 6 main families cover the essentials."}
              </p>
            </div>
            <HelpHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "Schéma : centre d'aide Axion-IA organisé en 6 thématiques principales (démarrer, souveraineté, coûts & ROI, cas d'usage, formation, intégration)."
                  : "Diagram: Axion-IA help center organised into 6 main topics (get started, sovereignty, costs & ROI, use cases, training, integration)."
              }
            />
          </div>
        </Container>
      </section>

      {/* MID-SECTION — placeholder illustration bibliothèque conseils */}
      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <Illustration
              slot="AIDE-01-hero"
              aspectRatio="16:9"
              filenameTarget="public/illustrations/centre-aide-hero.avif"
              caption={
                isFr
                  ? "Bibliothèque éditoriale — réponses rangées comme dans un manuel"
                  : "Editorial library — answers organised like in a manual"
              }
              alt={
                isFr
                  ? "Illustration éditoriale d'une bibliothèque de conseils ouverte, symbole du centre d'aide Axion-IA."
                  : "Editorial illustration of an open advice library, symbol of the Axion-IA help center."
              }
            />
          </div>
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Thématiques" : "Topics"}>
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <li key={category.slug}>
                <a
                  href={`/${locale}${categoryBase}/${category.slug}`}
                  className="group block h-full"
                >
                  <Card className="cta-lift h-full">
                    <CardHeader>
                      <CardTitle className="flex items-start justify-between gap-3">
                        <span>{category.label}</span>
                        <ArrowUpRight
                          className="text-fg-muted group-hover:text-primary mt-1 h-4 w-4 shrink-0 transition"
                          aria-hidden="true"
                        />
                      </CardTitle>
                      <CardDescription>
                        {isFr
                          ? `${category.articles.length} article${category.articles.length > 1 ? "s" : ""}`
                          : `${category.articles.length} article${category.articles.length > 1 ? "s" : ""}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-fg-soft space-y-1.5 text-sm">
                        {category.articles.slice(0, 3).map((a) => (
                          <li key={a.slug} className="line-clamp-1">
                            · {a[loc].title}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Tous les articles" : "All articles"} tone="paper">
        <Container>
          <ul className="border-border divide-border divide-y border-y">
            {HELP_ARTICLES.map((article) => (
              <li key={article.slug}>
                <a
                  href={`/${locale}${articleBase}/${article.slug}`}
                  className="group flex items-center justify-between gap-4 py-5"
                >
                  <div className="min-w-0">
                    <p className="text-fg-muted mb-1 text-xs font-medium tracking-[0.12em] uppercase">
                      {article.category}
                    </p>
                    <p className="text-fg group-hover:text-primary text-base font-medium transition">
                      {article[loc].title}
                    </p>
                    <p className="text-fg-soft mt-1 line-clamp-1 text-sm">{article[loc].excerpt}</p>
                  </div>
                  <ArrowUpRight
                    className="text-fg-muted group-hover:text-primary h-4 w-4 shrink-0 transition"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Question non couverte ?" : "Question not covered?"}
        description={
          isFr
            ? "Contactez-nous — réponse sous 48 h ouvrées."
            : "Contact us — reply within 48 business hours."
        }
        cta={
          <Cta href="/contact" size="lg">
            Contact â†’
          </Cta>
        }
      />

      <JsonLd data={itemListJsonLd} />
    </>
  );
}
