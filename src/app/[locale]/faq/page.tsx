import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FAQ_GLOBAL } from "@/content/transversal";
import { buildProductMetadata, buildFaqJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/faq",
    title: locale === "fr" ? "FAQ · cabinet IA AxionIA" : "FAQ · AxionIA AI consultancy",
    description:
      locale === "fr"
        ? "Questions fréquentes sur les interventions IA, l'audit, l'implémentation, la souveraineté des données, la facturation."
        : "Frequently asked questions on AI sessions, audit, implementation, data sovereignty, billing.",
  });
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

  const faqJsonLd = buildFaqJsonLd({ items });
  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: "FAQ", href: "/faq" },
    ],
  });

  return (
    <>
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

      <FaqBlock items={items} emitJsonLd={false} />

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
      <JsonLd data={breadcrumb} />
    </>
  );
}
