import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildItemListJsonLd } from "@/lib/seo";
import { listFaqsByCategory } from "@/lib/knowledge/readers";
import { getFaqCategory, getAllFaqCategorySlugs } from "@/content/faq-categories";

interface Props {
  params: Promise<{ locale: string; categorie: string }>;
}

// ISR 1h — aligné /faq (build SSG = stub.invalid → vide, repeuplé sous 1h).
export const revalidate = 3600;

// Seuil anti-thin (HCU 2024) : une catégorie avec moins de N Q/A indexables
// sort en `noindex,follow` (présente, maillée, mais pas exposée à l'index).
const MIN_INDEXABLE_ITEMS = 3;

export async function generateStaticParams() {
  return getAllFaqCategorySlugs().flatMap((categorie) =>
    routing.locales.map((locale) => ({ locale, categorie })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, categorie } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const cat = getFaqCategory(categorie);
  if (!cat) return {};
  const isFr = locale === "fr";
  const meta = buildProductMetadata({
    locale,
    path: `/faq/par-thematique/${categorie}`,
    title: isFr
      ? `FAQ ${cat.labelFr} · Questions fréquentes · Axion-IA`
      : `${cat.labelEn} FAQ · Frequently asked questions · Axion-IA`,
    description: isFr ? cat.descFr : cat.descEn,
  });
  const items = await listFaqsByCategory(categorie);
  if (items.length < MIN_INDEXABLE_ITEMS) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function FaqCategoryPage({ params }: Props) {
  const { locale, categorie } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const cat = getFaqCategory(categorie);
  if (!cat) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const faqs = await listFaqsByCategory(categorie);
  const items = faqs.map((entry) => ({
    id: entry.slug,
    question: isFr ? entry.questionFr : entry.questionEn,
    answer: isFr ? entry.answerFr : entry.answerEn,
  }));

  const breadcrumbItems = [
    { href: "/faq", label: "FAQ" },
    { href: "/faq/par-thematique", label: isFr ? "Thématiques" : "Topics" },
    { href: `/faq/par-thematique/${categorie}`, label: isFr ? cat.labelFr : cat.labelEn },
  ];

  // ItemList JSON-LD — énumère les Q/A de la thématique (citabilité LLM).
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: `/faq/par-thematique/${categorie}`,
    name: isFr ? `FAQ ${cat.labelFr} — Axion-IA` : `${cat.labelEn} FAQ — Axion-IA`,
    items: items.map((it, i) => ({
      url: `https://axion-ia.com/${locale}/faq/${it.id}`,
      name: it.question,
      position: i + 1,
    })),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={isFr ? "FAQ · Thématique" : "FAQ · Topic"}
        title={isFr ? cat.labelFr : cat.labelEn}
        description={isFr ? cat.descFr : cat.descEn}
      >
        <Container className="max-w-3xl">
          <p className="text-fg-soft text-sm">
            {isFr
              ? `${items.length} question${items.length > 1 ? "s" : ""} dans cette thématique.`
              : `${items.length} question${items.length > 1 ? "s" : ""} in this topic.`}
          </p>
          <div className="mt-4">
            <Cta href={`/${locale}/faq`} variant="outline" size="sm">
              {isFr ? "← Toutes les thématiques" : "← All topics"}
            </Cta>
          </div>
        </Container>
      </Section>

      {items.length > 0 ? (
        <FaqBlock
          items={items}
          emitJsonLd={false}
          permalinkBase={`/${locale}/faq`}
          permalinkLabel={isFr ? "Page dédiée" : "Dedicated page"}
        />
      ) : (
        <Section tone="paper">
          <Container className="max-w-3xl">
            <p className="text-fg-soft">
              {isFr
                ? "Aucune question publiée pour cette thématique pour le moment."
                : "No published question for this topic yet."}
            </p>
          </Container>
        </Section>
      )}

      <Section
        eyebrow={isFr ? "Index" : "Index"}
        title={isFr ? "Questions de la thématique" : "Topic questions"}
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

      <JsonLd data={itemListJsonLd} />
    </>
  );
}
