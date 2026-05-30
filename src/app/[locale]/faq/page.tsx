import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, HelpCircle, Mic, RefreshCw, Rss } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqHeroSchema } from "@/components/sections/FaqHeroSchema";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildFaqSpeakableJsonLd } from "@/lib/seo";
import { listFaqs } from "@/lib/knowledge/readers";

interface Props {
  params: Promise<{ locale: string }>;
}

// ISR 1h (P1 audit KB 2026-05-29) — aligné /connaissances et /ressources.
// Évite un rendu DB synchrone à chaque requête (500 si DB down) et repeuple
// la page sous 1h après deploy (build SSG = stub.invalid → vide au build).
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = buildProductMetadata({
    locale,
    path: "/faq",
    title:
      locale === "fr"
        ? "FAQ IA entreprise · Questions fréquentes · Axion-IA"
        : "AI FAQ · Frequently asked questions · Axion-IA",
    description:
      locale === "fr"
        ? "Questions fréquentes sur les interventions IA, l'audit, l'implémentation, la souveraineté des données, la facturation."
        : "Frequently asked questions on AI sessions, audit, implementation, data sovereignty, billing.",
  });
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      // URL absolue pour éviter résolution contre metadataBase qui inclut déjà
      // le locale → double prefix `/fr/fr/faq/feed.xml` (audit 2026-05-15 AGENT 6).
      types: {
        "application/rss+xml": `https://axion-ia.com/${locale}/faq/feed.xml`,
      },
    },
  };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // KB-6.3 : lecture via reader unifié (FAQ_GLOBAL en mode legacy, knowledge_entries
  // si KB_BACKEND_UNIFIED_FAQ=1).
  const faqs = await listFaqs();
  const items = faqs.map((entry) => ({
    id: entry.slug,
    question: isFr ? entry.questionFr : entry.questionEn,
    answer: isFr ? entry.answerFr : entry.answerEn,
  }));

  const faqJsonLd = buildFaqSpeakableJsonLd({ items, speakableSelector: "[data-aeo='faq-intro']" });
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/faq", label: "FAQ" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2-col custom — texte à gauche, FaqHeroSchema 3 thématiques à droite */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                FAQ
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Questions " : "Frequently asked "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "fréquentes" : "questions"}
                </span>
              </h1>
              <p
                data-aeo="faq-intro"
                className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
              >
                {isFr
                  ? "Tout savoir sur les interventions, l'audit, l'implémentation, la souveraineté des données et la facturation. Réponses courtes, sourcées, citables par les LLMs."
                  : "Everything about sessions, audit, implementation, data sovereignty and billing. Short, sourced, LLM-citable answers."}
              </p>
              {/* Pills réassurance */}
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  {
                    icon: HelpCircle,
                    label: isFr ? `${items.length} questions` : `${items.length} questions`,
                  },
                  { icon: Mic, label: isFr ? "AEO speakable" : "AEO speakable" },
                  { icon: Rss, label: "RSS feed" },
                  { icon: RefreshCw, label: isFr ? "MAJ trimestrielle" : "Quarterly updates" },
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
              {/* CTAs hero */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="#index" size="lg">
                  {isFr ? "Toutes les questions" : "All questions"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href={`/${locale}/faq/feed.xml`} variant="outline" size="lg">
                  {isFr ? "S'abonner RSS" : "Subscribe RSS"}
                </Cta>
              </div>
            </div>
            <FaqHeroSchema
              isFr={isFr}
              totalCount={items.length}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? `Schéma : ${items.length} questions Axion-IA réparties en 3 thématiques — interventions/implémentation, audit IA, souveraineté/facturation.`
                  : `Diagram: ${items.length} Axion-IA questions across 3 topics — sessions/implementation, AI audit, sovereignty/billing.`
              }
            />
          </div>
        </Container>
      </section>

      {/* Most viewed — top 5 questions populaires */}
      <Section eyebrow={isFr ? "Plus consultées" : "Most viewed"} tone="paper">
        <Container className="max-w-3xl">
          <ul className="grid gap-3">
            {items.slice(0, 5).map((item, idx) => (
              <li key={`pop-${item.id}`}>
                <a
                  href={`/${locale}/faq/${item.id}`}
                  className="border-border bg-paper hover:border-terracotta/60 group flex items-start gap-4 rounded-xl border p-4 transition"
                >
                  <span
                    className="text-terracotta text-2xl leading-none font-medium tabular-nums"
                    style={{ fontFamily: "var(--font-serif)" }}
                    aria-hidden="true"
                  >
                    0{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-fg group-hover:text-terracotta-deep text-base leading-snug font-medium transition">
                      {item.question}
                    </p>
                    <p className="text-fg-soft mt-1 line-clamp-2 text-sm leading-snug">
                      {item.answer.slice(0, 140)}…
                    </p>
                  </div>
                  <ArrowUpRight
                    className="text-fg-muted group-hover:text-terracotta mt-1 h-4 w-4 shrink-0 transition"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <FaqBlock
        items={items}
        emitJsonLd={false}
        permalinkBase={`/${locale}/faq`}
        permalinkLabel={isFr ? "Page dédiée" : "Dedicated page"}
      />

      <Section
        id="index"
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
            Contact â†’
          </Cta>
        }
      />

      <JsonLd data={faqJsonLd} />
    </>
  );
}
