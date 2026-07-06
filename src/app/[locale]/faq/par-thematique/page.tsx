import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, HelpCircle, Layers, LayoutGrid, Mic, Rss } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqHeroImage } from "@/components/sections/FaqHeroImage";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildCollectionPageJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
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
      ? "Parcourez les questions fréquentes Axion-IA par thématique : interventions et formations IA, implémentation, audit IA, tarifs, process, RGPD, coaching."
      : "Browse Axion-IA FAQs by topic: AI sessions and training, implementation, AI audit, pricing, process, GDPR, coaching.",
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

  // Cartes thématiques (silo hub → catégorie), enrichies count + icône. On garde
  // toutes les catégories SSOT (même à 0) pour un maillage complet et stable.
  const cards = FAQ_CATEGORIES.map((cat) => ({
    slug: cat.slug,
    label: isFr ? cat.labelFr : cat.labelEn,
    desc: isFr ? cat.descFr : cat.descEn,
    count: countByCat.get(cat.slug) ?? 0,
    Icon: FAQ_CATEGORY_ICONS[cat.slug] ?? FAQ_CATEGORY_ICON_FALLBACK,
  }));

  const breadcrumbItems = [
    { href: "/faq", label: "FAQ" },
    { href: "/faq/par-thematique", label: isFr ? "Thématiques" : "Topics" },
  ];

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/faq/par-thematique",
    name: isFr ? "FAQ Axion-IA par thématique" : "Axion-IA FAQ by topic",
    items: FAQ_CATEGORIES.map((cat, i) => ({
      url: `${SITE_URL}/${locale}/faq/par-thematique/${cat.slug}`,
      name: isFr ? cat.labelFr : cat.labelEn,
      position: i + 1,
      description: isFr ? cat.descFr : cat.descEn,
    })),
  });

  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/faq/par-thematique",
    name: isFr
      ? "FAQ Axion-IA par thématique — toutes les familles de questions"
      : "Axion-IA FAQ by topic — every family of questions",
    description: isFr
      ? "Les thématiques de la FAQ Axion-IA : interventions et formations IA, implémentation, audit, tarifs, process, RGPD, sites web, coaching 1-to-1."
      : "Axion-IA FAQ topics: AI sessions and training, implementation, audit, pricing, process, GDPR, websites, 1-to-1 coaching.",
    speakable: true,
    extra: {
      about: { "@id": `${SITE_URL}/#organization` },
      ...(buildPrimaryImageOfPage("/faq/par-thematique")
        ? { primaryImageOfPage: buildPrimaryImageOfPage("/faq/par-thematique") }
        : {}),
    },
  });

  // Image héro (GEO / Google Images) — ImageObject @graph via manifeste SSOT.
  const imageGraphJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: "/faq/par-thematique" });

  // Cartes « Aller plus loin » — navigation transverse (maillage + RSS).
  const furtherLinks: ReadonlyArray<{
    href: string;
    label: string;
    desc: string;
    Icon: typeof LayoutGrid;
  }> = [
    {
      href: `/${locale}/faq`,
      label: isFr ? "Toutes les questions" : "All questions",
      desc: isFr
        ? "La liste complète, avec recherche et filtres par thème."
        : "The full list, with search and topic filters.",
      Icon: LayoutGrid,
    },
    {
      href: `/${locale}/contact`,
      label: isFr ? "Poser une question" : "Ask a question",
      desc: isFr
        ? "Votre question n'est pas là ? Écrivez-nous, on vous répond."
        : "Question not listed? Write to us, we'll answer.",
      Icon: HelpCircle,
    },
    {
      href: `/${locale}/faq/feed.xml`,
      label: isFr ? "Flux RSS" : "RSS feed",
      desc: isFr
        ? "Suivez les nouvelles réponses via notre flux dédié."
        : "Follow new answers via our dedicated feed.",
      Icon: Rss,
    },
  ];

  return (
    <>
      <div className="bg-halo-warm">
        <Container className="pt-6">
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </div>

      {/* ── HÉRO ─────────────────────────────────────────────────────────── */}
      <Section
        titleAs="h1"
        eyebrow="FAQ"
        title={isFr ? "La FAQ, organisée" : "The FAQ, organised"}
        titleEm={isFr ? "par thématique" : "by topic"}
        description={
          isFr
            ? "Choisissez une famille de questions pour aller droit au but : interventions et formations IA, implémentation, audit, tarifs, process & RGPD, sites web, coaching 1-to-1. Réponses courtes, sourcées, citables par les IA."
            : "Pick a family of questions to get straight to the point: AI sessions and training, implementation, audit, pricing, process & GDPR, websites, 1-to-1 coaching. Short, sourced, AI-citable answers."
        }
        media={<FaqHeroImage slot="topics" isFr={isFr} priority />}
      >
        <div className="flex flex-col gap-6">
          <ul role="list" className="flex flex-wrap gap-x-5 gap-y-2.5">
            {[
              {
                icon: Layers,
                label: isFr ? `${cards.length} thématiques` : `${cards.length} topics`,
              },
              {
                icon: HelpCircle,
                label: isFr ? `${faqs.length} questions` : `${faqs.length} questions`,
              },
              { icon: Mic, label: "AEO speakable" },
            ].map((pill) => {
              const Icon = pill.icon;
              return (
                <li
                  key={pill.label}
                  className="text-fg-soft inline-flex items-center gap-2 text-sm"
                >
                  <Icon aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                  <span>{pill.label}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-4">
            <Cta href={`/${locale}/faq`} size="lg">
              {isFr ? "Toutes les questions" : "All questions"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href={`/${locale}/faq/feed.xml`} variant="outline" size="lg">
              {isFr ? "S'abonner RSS" : "Subscribe RSS"}
            </Cta>
          </div>
        </div>
      </Section>

      {/* ── LES THÉMATIQUES — cartes premium pleine largeur ──────────────── */}
      <Section
        id="thematiques"
        tone="canvas"
        eyebrow={isFr ? "Parcourir" : "Browse"}
        title={isFr ? "Les" : "The"}
        titleEm={isFr ? "familles de questions" : "families of questions"}
        description={
          isFr
            ? "Chaque thématique regroupe les questions d'un même sujet, avec des réponses directes et une page dédiée par question."
            : "Each topic gathers questions on a single subject, with direct answers and a dedicated page per question."
        }
      >
        <ul role="list" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <li key={c.slug}>
              <a
                href={`/${locale}/faq/par-thematique/${c.slug}`}
                className="border-border bg-paper shadow-subtle hover:border-terracotta/60 hover:shadow-elevated group flex h-full flex-col gap-3 rounded-2xl border p-6 transition hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="bg-terracotta/10 text-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl">
                    <c.Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="text-fg-muted text-xs font-medium tabular-nums">
                    {c.count} {isFr ? (c.count > 1 ? "questions" : "question") : "questions"}
                  </span>
                </div>
                <h3 className="text-fg group-hover:text-terracotta-deep flex items-start justify-between gap-2 text-lg font-semibold tracking-tight transition">
                  <span className="min-w-0">{c.label}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-fg-muted group-hover:text-terracotta mt-1 h-4 w-4 shrink-0 transition"
                  />
                </h3>
                <p className="text-fg-soft text-sm leading-relaxed">{c.desc}</p>
              </a>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── ALLER PLUS LOIN — navigation transverse ──────────────────────── */}
      <Section
        id="aller-plus-loin"
        tone="sand"
        eyebrow={isFr ? "Aller plus loin" : "Go further"}
        title={isFr ? "Vous ne trouvez pas votre" : "Can't find your"}
        titleEm={isFr ? "réponse ?" : "answer?"}
        description={
          isFr
            ? "Parcourez l'intégralité de la FAQ, posez votre question ou suivez nos nouvelles réponses."
            : "Browse the whole FAQ, ask your question, or follow our new answers."
        }
      >
        <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {furtherLinks.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="border-border bg-canvas shadow-subtle hover:border-terracotta/60 hover:shadow-elevated group flex h-full flex-col gap-3 rounded-2xl border p-6 transition hover:-translate-y-0.5"
              >
                <span className="bg-terracotta/10 text-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl">
                  <l.Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="text-fg group-hover:text-terracotta-deep flex items-start justify-between gap-2 text-base font-semibold tracking-tight transition">
                  <span className="min-w-0">{l.label}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-fg-muted group-hover:text-terracotta mt-0.5 h-4 w-4 shrink-0 transition"
                  />
                </h3>
                <p className="text-fg-soft text-sm leading-relaxed">{l.desc}</p>
              </a>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        tone="mocha"
        eyebrow={isFr ? "Une question non listée ?" : "Question not listed?"}
        title={isFr ? "Parlons de" : "Let's talk about"}
        titleEm={isFr ? "votre cas" : "your case"}
        description={
          isFr
            ? "Écrivez-nous à contact@axion-ia.com ou réservez un appel de 20 minutes : nous répondons précisément à votre contexte, sans engagement."
            : "Email us at contact@axion-ia.com or book a 20-minute call: we answer your exact context, no strings attached."
        }
        cta={
          <>
            <Cta href="/appel" variant="primary" size="xl" track="faq-topics-appel">
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/contact" variant="outline" size="xl" track="faq-topics-contact">
              {isFr ? "Écrire un message" : "Send a message"}
            </Cta>
          </>
        }
      />

      <JsonLd data={itemListJsonLd} />
      <JsonLd data={collectionPageJsonLd} />
      {imageGraphJsonLd ? <JsonLd data={imageGraphJsonLd} /> : null}
    </>
  );
}
