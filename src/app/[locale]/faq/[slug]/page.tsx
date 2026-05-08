import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { HelpCircle, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getFaqEntry, getAllFaqIds, FAQ_GLOBAL } from "@/content/transversal";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { splitTitleEm } from "@/lib/title";

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

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/faq", label: "FAQ" },
    { href: `/faq/${slug}`, label: copy.question },
  ];

  // Suggested companion FAQs (4 others).
  const others = FAQ_GLOBAL.filter((f) => f.id !== entry.id).slice(0, 4);

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {(() => {
        const t = splitTitleEm(copy.question);
        const wordCount = copy.answer.trim().split(/\s+/).length;
        const readMin = Math.max(1, Math.ceil(wordCount / 200));
        return (
          <Section
            titleAs="h1"
            eyebrow="FAQ"
            title={t.lead}
            titleEm={t.em}
            description={
              isFr
                ? "Réponse directe AxionIA — courte, sourcée, mise à jour régulièrement."
                : "Direct AxionIA answer — short, sourced, regularly updated."
            }
          >
            <Container className="mt-8 max-w-2xl">
              <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  { icon: HelpCircle, label: isFr ? "Question fréquente" : "Frequent question" },
                  { icon: Clock, label: isFr ? `Lecture ${readMin} min` : `${readMin} min read` },
                  { icon: RefreshCw, label: isFr ? "MAJ trimestrielle" : "Quarterly updates" },
                  { icon: ShieldCheck, label: isFr ? "Source : doctrine" : "Source: doctrine" },
                ].map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>
            </Container>
          </Section>
        );
      })()}

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
    </>
  );
}
