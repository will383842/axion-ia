import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildItemListJsonLd } from "@/lib/seo";
import { listFaqs } from "@/lib/knowledge/readers";
import { FAQ_CATEGORIES } from "@/content/faq-categories";
import { FAQ_CATEGORY_ICONS, FAQ_CATEGORY_ICON_FALLBACK } from "@/content/faq-category-icons";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/faq/par-thematique",
    title: isFr ? "FAQ par thématique · Axion-IA" : "FAQ by topic · Axion-IA",
    description: isFr
      ? "Parcourez les questions fréquentes Axion-IA par thématique : interventions, implémentation, audit IA, tarifs, process."
      : "Browse Axion-IA FAQs by topic: sessions, implementation, AI audit, pricing, process.",
  });
}

export default async function FaqTopicsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Compte par catégorie (1 seul read, DB-safe via le reader).
  const faqs = await listFaqs();
  const countByCat = new Map<string, number>();
  for (const f of faqs) countByCat.set(f.category, (countByCat.get(f.category) ?? 0) + 1);

  const breadcrumbItems = [
    { href: "/faq", label: "FAQ" },
    { href: "/faq/par-thematique", label: isFr ? "Thématiques" : "Topics" },
  ];

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/faq/par-thematique",
    name: isFr ? "FAQ Axion-IA par thématique" : "Axion-IA FAQ by topic",
    items: FAQ_CATEGORIES.map((cat, i) => ({
      url: `https://axion-ia.com/${locale}/faq/par-thematique/${cat.slug}`,
      name: isFr ? cat.labelFr : cat.labelEn,
      position: i + 1,
      description: isFr ? cat.descFr : cat.descEn,
    })),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow="FAQ"
        title={isFr ? "Par thématique" : "By topic"}
        description={
          isFr
            ? "Parcourez les questions fréquentes par thématique. Réponses courtes, sourcées, citables par les LLMs."
            : "Browse frequent questions by topic. Short, sourced, LLM-citable answers."
        }
      >
        <Container className="max-w-3xl">
          <ul className="grid gap-3 sm:grid-cols-2">
            {FAQ_CATEGORIES.map((cat) => {
              const n = countByCat.get(cat.slug) ?? 0;
              const Icon = FAQ_CATEGORY_ICONS[cat.slug] ?? FAQ_CATEGORY_ICON_FALLBACK;
              return (
                <li key={cat.slug}>
                  <a
                    href={`/${locale}/faq/par-thematique/${cat.slug}`}
                    className="border-border bg-paper hover:border-terracotta/60 hover:shadow-subtle group flex h-full items-start gap-4 rounded-xl border p-5 transition"
                  >
                    <span className="bg-terracotta-soft text-terracotta flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-fg group-hover:text-terracotta-deep flex items-start justify-between gap-3 text-base font-medium transition">
                        <span className="min-w-0">{isFr ? cat.labelFr : cat.labelEn}</span>
                        <ArrowUpRight
                          className="text-fg-muted group-hover:text-terracotta mt-0.5 h-4 w-4 shrink-0 transition"
                          aria-hidden="true"
                        />
                      </p>
                      <p className="text-fg-soft mt-1 text-sm leading-snug">
                        {isFr ? cat.descFr : cat.descEn}
                      </p>
                      <p className="text-fg-muted mt-2 text-xs tabular-nums">
                        {n} {isFr ? "question" : "question"}
                        {n > 1 ? "s" : ""}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-6">
            <Cta href={`/${locale}/faq`} variant="outline" size="sm">
              {isFr ? "← Toutes les questions" : "← All questions"}
            </Cta>
          </div>
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

      <JsonLd data={itemListJsonLd} />
    </>
  );
}
