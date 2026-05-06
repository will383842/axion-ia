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
import { getFaqEntry, getAllFaqIds, FAQ_GLOBAL } from "@/content/transversal";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllFaqIds().flatMap((slug) => routing.locales.map((locale) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const entry = getFaqEntry(slug);
  if (!entry) return {};
  const isFr = locale === "fr";
  const copy = entry[locale as Locale];
  return buildProductMetadata({
    locale,
    path: `/faq/${slug}`,
    title: `${copy.question} · ${isFr ? "FAQ AxionIA" : "AxionIA FAQ"}`,
    description: copy.answer,
  });
}

export default async function FaqEntryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const entry = getFaqEntry(slug);
  if (!entry) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const copy = entry[loc];

  // QAPage Schema — direct citability for Perplexity / ChatGPT / Bing Copilot.
  const qaJsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: copy.question,
      text: copy.question,
      answerCount: 1,
      acceptedAnswer: {
        "@type": "Answer",
        text: copy.answer,
        url: `${SITE_URL}/${locale}/faq/${slug}`,
        author: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
      },
    },
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: "FAQ", href: "/faq" },
      { name: copy.question, href: `/faq/${slug}` },
    ],
  });

  // Suggested companion FAQs (4 others).
  const others = FAQ_GLOBAL.filter((f) => f.id !== entry.id).slice(0, 4);

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow="FAQ"
        title={copy.question}
        description={isFr ? "Réponse directe AxionIA." : "Direct AxionIA answer."}
      />

      <Section>
        <Container className="max-w-3xl">
          <p className="text-fg text-lg leading-relaxed">{copy.answer}</p>
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Autres questions" : "Other questions"}>
        <Container className="max-w-3xl">
          <ul className="border-border divide-border divide-y border-y">
            {others.map((o) => (
              <li key={o.id}>
                <a
                  href={`/${locale}/faq/${o.id}`}
                  className="text-fg hover:text-primary block py-4 text-base font-medium"
                >
                  {o[loc].question} →
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

      <JsonLd data={qaJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
