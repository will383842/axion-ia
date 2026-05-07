import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ArrowUpRight } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FAQ_GLOBAL } from "@/content/transversal";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildFaqSpeakableJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = buildProductMetadata({
    locale,
    path: "/faq",
    title: locale === "fr" ? "FAQ · cabinet IA AxionIA" : "FAQ · AxionIA AI consultancy",
    description:
      locale === "fr"
        ? "Questions fréquentes sur les interventions IA, l'audit, l'implémentation, la souveraineté des données, la facturation."
        : "Frequently asked questions on AI sessions, audit, implementation, data sovereignty, billing.",
  });
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      types: { "application/rss+xml": `/${locale}/faq/feed.xml` },
    },
  };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const items = FAQ_GLOBAL.map((entry) => ({
    id: entry.id,
    question: entry[loc].question,
    answer: entry[loc].answer,
  }));

  const faqJsonLd = buildFaqSpeakableJsonLd({ items });
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/faq", label: "FAQ" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        tone="halo-warm"
        titleAs="h1"
        eyebrow="FAQ"
        title={isFr ? "Questions" : "Frequently asked"}
        titleEm={isFr ? "fréquentes" : "questions"}
        description={
          isFr
            ? "Tout savoir sur les interventions, l'audit, l'implémentation, la souveraineté des données et la facturation."
            : "Everything about sessions, audit, implementation, data sovereignty and billing."
        }
      />

      <FaqBlock
        items={items}
        emitJsonLd={false}
        permalinkBase={`/${locale}/faq`}
        permalinkLabel={isFr ? "Page dédiée" : "Dedicated page"}
      />

      <Section
        eyebrow={isFr ? "Index" : "Index"}
        title={isFr ? "Toutes les questions" : "All questions"}
        tone="paper"
      >
        <Container className="max-w-3xl">
          <ul className="border-border divide-border divide-y border-y">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`/${locale}/faq/${item.id}`}
                  className="group flex items-center justify-between gap-4 py-4"
                >
                  <span className="text-fg group-hover:text-primary text-base font-medium transition">
                    {item.question}
                  </span>
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
        title={isFr ? "Une question non listée ?" : "Question not listed?"}
        description={
          isFr ? "Écrivez-nous à contact@axion-ia.com." : "Email us at contact@axion-ia.com."
        }
        cta={
          <Cta href="/contact" size="lg">
            Contact →
          </Cta>
        }
      />

      <JsonLd data={faqJsonLd} />
    </>
  );
}
