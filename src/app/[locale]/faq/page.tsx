import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  HelpCircle,
  MessageSquare,
  Mic,
  RefreshCw,
  Rss,
  ShieldCheck,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqHeroImage } from "@/components/sections/FaqHeroImage";
import { FaqHubExplorer } from "@/components/sections/FaqHubExplorer";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  buildProductMetadata,
  buildFaqSpeakableJsonLd,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
import { listFaqs } from "@/lib/knowledge/readers";
import { resolvePriceTokensDeep } from "@/content/pricing-tokens";
import { FAQ_CATEGORIES } from "@/content/faq-categories";
import { FAQ_CATEGORY_ICONS, FAQ_CATEGORY_ICON_FALLBACK } from "@/content/faq-category-icons";

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
  // 🔴 Audit 2026-07-25 : la page servait en clair `{{price:audit-flash|flat}}` et
  // `{{price:audit-strategique-pme|range}}` en production. Le contenu FAQ provient de la
  // base (knowledge_entries / FAQ_GLOBAL) et porte des tokens de prix ; cette page ne les
  // résolvait pas. Le résolveur SSOT existait déjà — il manquait l'appel.
  // Règle du dépôt : on résout depuis la SSOT, on n'invente JAMAIS un prix.
  const faqs = resolvePriceTokensDeep(await listFaqs(), loc);
  const items = faqs.map((entry) => ({
    id: entry.slug,
    question: isFr ? entry.questionFr : entry.questionEn,
    answer: isFr ? entry.answerFr : entry.answerEn,
  }));

  // Données légères pour l'explorateur (recherche + filtres thèmes) : on ne passe
  // au client que question + extrait court + catégorie (pas la réponse complète).
  const explorerItems = faqs.map((entry) => {
    const answer = isFr ? entry.answerFr : entry.answerEn;
    return {
      id: entry.slug,
      question: isFr ? entry.questionFr : entry.questionEn,
      snippet: answer.length > 110 ? `${answer.slice(0, 108).trimEnd()}…` : answer,
      category: entry.category,
    };
  });
  const explorerCats = FAQ_CATEGORIES.map((c) => ({
    slug: c.slug,
    label: isFr ? c.labelFr : c.labelEn,
  }));

  // Cartes « Parcourir par thématique » (silo hub → catégorie → Q/A + maillage
  // GEO). Chaque catégorie non vide, avec description SSOT + nombre de questions,
  // pointe vers /faq/par-thematique/<cat>. Icônes server-only (budget JS client).
  const categoryCards = FAQ_CATEGORIES.map((c) => {
    const count = faqs.filter((f) => f.category === c.slug).length;
    return {
      slug: c.slug,
      label: isFr ? c.labelFr : c.labelEn,
      desc: isFr ? c.descFr : c.descEn,
      count,
      Icon: FAQ_CATEGORY_ICONS[c.slug] ?? FAQ_CATEGORY_ICON_FALLBACK,
    };
  }).filter((c) => c.count > 0);

  // AEO (2026-06-21) — `additionalSelectors` ÉTEND le défaut Speakable (qui couvre
  // déjà question `[data-faq-q]` + réponse `[data-faq-a]`/`itemprop=text`) avec
  // l'intro. Avant : `speakableSelector` ÉCRASAIT ce défaut → seule l'intro était
  // « speakable » (voix/LLM ne lisaient pas les réponses). Désormais : intro + Q + R.
  //
  // Cap payload (2026-07-06) : le corpus prod (Track B content-gen) peut dépasser
  // 1000 Q/R → un FAQPage géant est inutile (rich results FAQ dépréciés Google
  // mai 2026) et alourdit le HTML. On limite le FAQPage aux Q/R ÉDITORIALES
  // (Track A, `isAutoGenerated=false`), plafonnées à 50 — les plus qualitatives,
  // toutes visibles dans l'explorateur. Repli sur les 50 premières si aucune
  // éditoriale. L'AEO reste couvert par les pages Q/R dédiées (QAPage speakable).
  const SCHEMA_MAX = 50;
  const editorial = faqs
    .filter((f) => !f.isAutoGenerated)
    .map((entry) => ({
      question: isFr ? entry.questionFr : entry.questionEn,
      answer: isFr ? entry.answerFr : entry.answerEn,
    }));
  const schemaItems = (editorial.length > 0 ? editorial : items).slice(0, SCHEMA_MAX);
  const faqJsonLd = buildFaqSpeakableJsonLd({
    items: schemaItems,
    additionalSelectors: ["[data-aeo='faq-intro']"],
  });

  // Image héro (GEO / Google Images) — ImageObject @graph + primaryImageOfPage
  // via le manifeste SSOT `page-images.ts` (URL crawlable + sitemap images).
  const primaryImage = buildPrimaryImageOfPage("/faq");
  const imageGraphJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: "/faq" });

  // CollectionPage — rattache le hub FAQ à l'organisation (entité #organization)
  // et le déclare speakable (intro AEO/GEO).
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/faq",
    name: isFr
      ? "FAQ Axion-IA — questions fréquentes sur l'IA en entreprise"
      : "Axion-IA FAQ — frequently asked questions about AI for business",
    description: isFr
      ? "Toutes les réponses Axion-IA : interventions et formations IA, audit, implémentation, tarifs, RGPD, coaching. Réponses courtes, sourcées, citables par les IA."
      : "All Axion-IA answers: AI sessions and training, audit, implementation, pricing, GDPR, coaching. Short, sourced, AI-citable answers.",
    speakable: true,
    extra: {
      about: { "@id": `${SITE_URL}/#organization` },
      ...(primaryImage ? { primaryImageOfPage: primaryImage } : {}),
    },
  });

  // ItemList — permet aux LLMs d'énumérer les thématiques FAQ couvertes (AEO/GEO).
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/faq",
    name: isFr ? "Thématiques de la FAQ Axion-IA" : "Axion-IA FAQ topics",
    items: categoryCards.map((c, i) => ({
      position: i + 1,
      name: c.label,
      url: `${SITE_URL}/${loc}/faq/par-thematique/${c.slug}`,
      description: c.desc,
    })),
  });

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/faq", label: "FAQ" }];

  // Piliers AEO/GEO — pourquoi ces réponses sont conçues pour l'IA (truthful,
  // aligné sur le balisage QAPage/Speakable réellement émis).
  const aeoPillars: ReadonlyArray<{ icon: typeof MessageSquare; title: string; body: string }> =
    isFr
      ? [
          {
            icon: MessageSquare,
            title: "Réponses courtes & directes",
            body: "Chaque question reçoit une réponse en quelques phrases, sans détour — la bonne info, tout de suite.",
          },
          {
            icon: ShieldCheck,
            title: "Sourcées depuis notre doctrine",
            body: "Pas d'invention : nos réponses sont alignées sur nos offres, nos méthodes et nos tarifs publics.",
          },
          {
            icon: Mic,
            title: "Pensées pour l'IA (AEO)",
            body: "Balisage Speakable & QAPage : Google AI Overviews, Perplexity et ChatGPT peuvent citer nos réponses.",
          },
          {
            icon: RefreshCw,
            title: "Mises à jour & flux RSS",
            body: "Nos réponses sont revues régulièrement. Suivez les nouveautés via notre flux RSS dédié.",
          },
        ]
      : [
          {
            icon: MessageSquare,
            title: "Short, direct answers",
            body: "Every question gets a few-sentence answer, no fluff — the right info, right away.",
          },
          {
            icon: ShieldCheck,
            title: "Sourced from our doctrine",
            body: "No made-up claims: our answers align with our offers, methods and public pricing.",
          },
          {
            icon: Mic,
            title: "Built for AI (AEO)",
            body: "Speakable & QAPage markup: Google AI Overviews, Perplexity and ChatGPT can cite our answers.",
          },
          {
            icon: RefreshCw,
            title: "Updates & RSS feed",
            body: "Our answers are reviewed regularly. Follow updates via our dedicated RSS feed.",
          },
        ];

  return (
    <>
      <div className="bg-halo-warm">
        <Container className="pt-6">
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </div>

      {/* HERO 2-col custom — texte à gauche, FaqHeroSchema 3 thématiques à droite */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <Container className="relative">
          {/* Eyebrow → pastille centrée sur la page, au-dessus de la grille. */}
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            FAQ
          </HeroBadge>
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <h1 className="display-editorial text-fg">
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
                  ? "Tout savoir sur les interventions et formations IA, l'audit, l'implémentation, la souveraineté des données et la facturation. Réponses courtes, sourcées, citables par les moteurs de recherche et les IA."
                  : "Everything about AI sessions and training, audit, implementation, data sovereignty and billing. Short, sourced answers, citable by search engines and AI assistants."}
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
                <Cta href="#questions" size="lg">
                  {isFr ? "Rechercher une question" : "Search a question"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href={`/${locale}/faq/par-thematique`} variant="outline" size="lg">
                  {isFr ? "Par thématique" : "By topic"}
                </Cta>
                <Cta href={`/${locale}/faq/feed.xml`} variant="outline" size="lg">
                  {isFr ? "S'abonner RSS" : "Subscribe RSS"}
                </Cta>
              </div>
            </div>
            <FaqHeroImage
              slot="hub"
              isFr={isFr}
              priority
              className="lg:max-w-[560px] lg:justify-self-end"
            />
          </div>
        </Container>
      </section>

      {/* ── PARCOURIR PAR THÉMATIQUE — cartes silo hub → catégorie ────────── */}
      {categoryCards.length > 0 ? (
        <Section
          id="thematiques"
          tone="canvas"
          eyebrow={isFr ? "Parcourir" : "Browse"}
          title={isFr ? "Trouvez votre réponse par" : "Find your answer by"}
          titleEm={isFr ? "thématique" : "topic"}
          description={
            isFr
              ? "Nos questions sont organisées par famille : interventions et formations, audit, implémentation, tarifs, process & RGPD, sites web, coaching 1-to-1."
              : "Our questions are organised by family: sessions and training, audit, implementation, pricing, process & GDPR, websites, 1-to-1 coaching."
          }
        >
          <ul role="list" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categoryCards.map((c) => (
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
      ) : null}

      {/* Explorateur : recherche temps réel + filtres par thème + résultats
          groupés. SSR rend la liste complète (SEO/AEO), JS ajoute le filtrage. */}
      <div id="questions" className="scroll-mt-24">
        <FaqHubExplorer
          items={explorerItems}
          categories={explorerCats}
          locale={locale}
          isFr={isFr}
        />
      </div>

      {/* ── POURQUOI CETTE FAQ (AEO/GEO) — réassurance + différenciation ──── */}
      <Section
        id="aeo"
        tone="sand"
        eyebrow={isFr ? "Conçu pour être cité" : "Built to be cited"}
        title={isFr ? "Des réponses pensées pour" : "Answers designed for"}
        titleEm={isFr ? "l'humain et l'IA" : "humans and AI"}
        description={
          isFr
            ? "Nos réponses ne sont pas là pour meubler : elles sont courtes, exactes et structurées pour être reprises par Google, Perplexity, ChatGPT — et utiles à vous d'abord."
            : "Our answers aren't filler: they're short, accurate and structured to be picked up by Google, Perplexity, ChatGPT — and useful to you first."
        }
      >
        <ul role="list" className="xs:grid-cols-2 grid grid-cols-1 gap-5 lg:grid-cols-4">
          {aeoPillars.map((p) => (
            <li
              key={p.title}
              className="border-border bg-canvas shadow-subtle flex h-full flex-col gap-3 rounded-2xl border p-6"
            >
              <span className="bg-terracotta/10 text-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <p.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="text-fg text-base font-semibold tracking-tight">{p.title}</h3>
              <p className="text-fg-soft text-sm leading-relaxed">{p.body}</p>
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
            <Cta href="/appel" variant="primary" size="xl" track="faq-hub-final-appel">
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/contact" variant="outline" size="xl" track="faq-hub-final-contact">
              {isFr ? "Écrire un message" : "Send a message"}
            </Cta>
          </>
        }
      />

      <JsonLd data={faqJsonLd} />
      <JsonLd data={collectionPageJsonLd} />
      <JsonLd data={itemListJsonLd} />
      {imageGraphJsonLd ? <JsonLd data={imageGraphJsonLd} /> : null}
    </>
  );
}
