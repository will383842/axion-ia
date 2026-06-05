import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  HelpCircle,
  Clock,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqRelatedResources } from "@/components/sections/FaqRelatedResources";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, BUILD_DATE } from "@/lib/seo";
import { buildQAPageJsonLd } from "@/lib/seo-content-gen-factories";
import { getManonPersonJsonLd } from "@/lib/seo/manon-person";
import { splitTitleEm } from "@/lib/title";
import { listFaqs, isFaqItemIndexable, type FaqItem } from "@/lib/knowledge/readers";
import { WasHelpful } from "@/components/marketing/WasHelpful";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { getFaqCategory } from "@/content/faq-categories";
import { FAQ_CATEGORY_ICONS, FAQ_CATEGORY_ICON_FALLBACK } from "@/content/faq-category-icons";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// ISR 1h (P1 audit KB 2026-05-29) — aligné /connaissances et /ressources.
export const revalidate = 3600;

export async function generateStaticParams() {
  // KB-6.3 : utilise le reader unifié (FAQ_GLOBAL en mode legacy).
  const faqs = await listFaqs();
  return faqs.flatMap((f) => routing.locales.map((locale) => ({ locale, slug: f.slug })));
}

function getCopy(item: FaqItem, locale: Locale): { question: string; answer: string } {
  return {
    question: locale === "fr" ? item.questionFr : item.questionEn,
    answer: locale === "fr" ? item.answerFr : item.answerEn,
  };
}

// Soft-404 SEO (fix 2026-05-31) : Next 16 ne propage PAS le statut 404 sur les
// réponses streamées (limitation documentée, cf. `[locale]/not-found.tsx`). Pour
// un slug FAQ inexistant, `return {}` héritait `index,follow` + canonical=home du
// layout → Google classait l'URL « alias non-canonique de la home ». On émet donc
// un noindex explicite + on neutralise le canonical/alternates hérité. N'affecte
// PAS Track B (dynamicParams reste true : les vraies FAQ DB rendent normalement).
const SOFT_404_META: Metadata = {
  robots: { index: false, follow: false },
  alternates: {},
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return SOFT_404_META;
  const faqs = await listFaqs();
  const entry = faqs.find((f) => f.slug === slug);
  if (!entry) return SOFT_404_META;
  const isFr = locale === "fr";
  const copy = getCopy(entry, locale as Locale);
  // Intention de recherche / CTR (perfection FAQ 2026-05-31) : la question EST la
  // requête (H1 = title). On évite la troncature SERP (~60 car.) : on n'ajoute le
  // suffixe marque que si la question est courte, sinon on la laisse intacte.
  const brand = isFr ? "FAQ Axion-IA" : "Axion-IA FAQ";
  const title = copy.question.length > 50 ? copy.question : `${copy.question} · ${brand}`;
  const meta = buildProductMetadata({
    locale,
    path: `/faq/${slug}`,
    title,
    description: copy.answer.length > 155 ? `${copy.answer.slice(0, 152).trimEnd()}…` : copy.answer,
  });
  // Fix audit FAQ 2026-05-31 (axe A2) : Track B (auto) non promu tier-1 →
  // `noindex,follow`. Le contrat « tier-2 = noindex » n'était jamais honoré au
  // rendu. Track A éditorial reste indexable (cf. isFaqItemIndexable).
  if (!isFaqItemIndexable(entry)) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function FaqEntryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const faqs = await listFaqs();
  const entry = faqs.find((f) => f.slug === slug);
  if (!entry) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const copy = getCopy(entry, loc);

  // QAPage Schema — direct citability for Perplexity / ChatGPT / Bing Copilot.
  // Audit final P1-8 fix : `buildQAPageJsonLd` factory inclut Speakable
  // `cssSelector: [".faq-answer", '[data-aeo="answer"]']` qui permet aux LLMs
  // d'isoler la réponse pour lecture vocale (Google Assistant, Bing AI).
  // Voir master prompt § 9bis.11B.
  // datePublished + dateModified : on utilise `BUILD_DATE` (timestamp ISO
  // stable injecté par CI/CD à chaque build prod) plutôt que `new Date()`
  // qui change à chaque cold start worker → mensonge fraîcheur. Audit
  // AEO/GEO 2026-05-15 §3.4.
  // Track B (content-gen auto) → flag AI Act art. 50 machine-readable sur le
  // QAPage + disclaimer humain visible (fix audit FAQ 2026-05-31, axe E4/§4.B).
  const isAutoGen = entry.isAutoGenerated;
  const qaJsonLd = buildQAPageJsonLd({
    question: copy.question,
    answerHtml: copy.answer,
    slug,
    locale: loc,
    publishedAt: BUILD_DATE,
    dateModified: BUILD_DATE,
    aiGenerated: isAutoGen,
  });
  // VIS-05 — co-émet le nœud Person Manon pour résoudre l'author @id du QAPage.
  const personJsonLd = await getManonPersonJsonLd();

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/faq", label: "FAQ" },
    { href: `/faq/${slug}`, label: copy.question },
  ];

  // Catégorie — label + icône pour le badge hero (renforce le silo
  // hub → catégorie → Q/A, refonte premium 2026-06-01).
  const catDef = getFaqCategory(entry.category);
  const catLabel = catDef ? (isFr ? catDef.labelFr : catDef.labelEn) : null;
  const CatIcon = FAQ_CATEGORY_ICONS[entry.category] ?? FAQ_CATEGORY_ICON_FALLBACK;

  // Navigation séquentielle dans la thématique (lecture continue prev/next).
  const inCategory = faqs.filter((f) => f.category === entry.category);
  const curIdx = inCategory.findIndex((f) => f.slug === entry.slug);
  const prev = curIdx > 0 ? (inCategory[curIdx - 1] ?? null) : null;
  const next =
    curIdx >= 0 && curIdx < inCategory.length - 1 ? (inCategory[curIdx + 1] ?? null) : null;

  // FAQ liées — priorité à la même catégorie (maillage sémantique, perfection
  // FAQ 2026-05-31), complété par d'autres questions si < 4. Enrichies d'un
  // extrait + label catégorie pour l'affichage en cards (refonte 2026-06-01).
  const pool = faqs.filter((f) => f.slug !== entry.slug);
  const sameCategory = pool.filter((f) => f.category === entry.category);
  const relatedRaw = [...sameCategory, ...pool.filter((f) => f.category !== entry.category)].slice(
    0,
    4,
  );
  const snippetOf = (a: string) => (a.length > 120 ? `${a.slice(0, 118).trimEnd()}…` : a);
  const related = relatedRaw.map((f) => {
    const c = getCopy(f, loc);
    const def = getFaqCategory(f.category);
    return {
      slug: f.slug,
      question: c.question,
      snippet: snippetOf(c.answer),
      catLabel: def ? (isFr ? def.labelFr : def.labelEn) : null,
    };
  });

  // Réponse directe AEO (40-80 mots) : pour les réponses longues, on extrait un
  // résumé en tête (1-2 phrases, ≤ ~75 mots) que les moteurs IA (AI Overviews,
  // Perplexity, ChatGPT, Gemini) peuvent citer directement. Speakable cible déjà
  // `.tldr-answer` / `[data-aeo="tldr"]` (cf. buildQAPageJsonLd). Réponses courtes :
  // pas de doublon, la réponse elle-même fait office de réponse directe.
  const answerWords = copy.answer.trim().split(/\s+/);
  const directAnswer =
    answerWords.length > 80
      ? (copy.answer.match(/[^.!?]+[.!?]+/g) ?? [copy.answer])
          .reduce<{ text: string; words: number }>(
            (acc, sentence) => {
              if (acc.words >= 40) return acc;
              const w = sentence.trim().split(/\s+/).length;
              return { text: acc.text + sentence, words: acc.words + w };
            },
            { text: "", words: 0 },
          )
          .text.trim()
      : null;

  return (
    <>
      {/* P1-17 — alternate format markdown brut pour LLM ingestion. */}
      <link rel="alternate" type="text/markdown" href={`/api/markdown/faq/${slug}`} />
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
                ? "Réponse directe Axion-IA — courte, sourcée, mise à jour régulièrement."
                : "Direct Axion-IA answer — short, sourced, regularly updated."
            }
          >
            <Container className="mt-8 max-w-2xl">
              {catLabel ? (
                <a
                  href={`/${locale}/faq/par-thematique/${entry.category}`}
                  className="border-border bg-paper text-fg-soft hover:border-terracotta/60 hover:text-terracotta-deep mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
                >
                  <CatIcon className="text-terracotta h-4 w-4" aria-hidden="true" strokeWidth={2} />
                  {catLabel}
                </a>
              ) : null}
              <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  { icon: HelpCircle, label: isFr ? "Question fréquente" : "Frequent question" },
                  { icon: Clock, label: isFr ? `Lecture ${readMin} min` : `${readMin} min read` },
                  {
                    icon: RefreshCw,
                    label: isFr
                      ? `Mis à jour : ${new Date(BUILD_DATE).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}`
                      : `Updated: ${new Date(BUILD_DATE).toLocaleDateString("en-US", { year: "numeric", month: "long" })}`,
                  },
                  {
                    icon: ShieldCheck,
                    label: isAutoGen
                      ? isFr
                        ? "IA-assisté · relu"
                        : "AI-assisted · reviewed"
                      : isFr
                        ? "Source : doctrine"
                        : "Source: doctrine",
                  },
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
          {/* Réponse directe citable (AEO) — .tldr-answer + data-aeo="tldr" =
              cssSelector Speakable, isolée par les moteurs IA. Affichée seulement
              pour les réponses longues (sinon doublon avec la réponse complète). */}
          {directAnswer ? (
            <p
              className="text-fg tldr-answer border-terracotta bg-halo-warm mb-6 rounded-xl border-l-4 px-5 py-4 text-lg leading-relaxed font-medium"
              data-aeo="tldr"
            >
              {directAnswer}
            </p>
          ) : null}
          {/* data-aeo="answer" + .faq-answer = cssSelector Speakable JSON-LD */}
          <p className="text-fg faq-answer text-lg leading-relaxed" data-aeo="answer">
            {copy.answer}
          </p>

          {/* Navigation séquentielle dans la thématique (lecture continue). */}
          {prev || next ? (
            <nav
              aria-label={isFr ? "Navigation dans la thématique" : "Topic navigation"}
              className="border-border mt-10 grid gap-3 border-t pt-8 sm:grid-cols-2"
            >
              {prev ? (
                <a
                  href={`/${locale}/faq/${prev.slug}`}
                  className="border-border bg-paper hover:border-terracotta/60 hover:shadow-subtle group rounded-xl border p-4 transition"
                >
                  <span className="text-fg-muted inline-flex items-center gap-1 text-xs font-medium tracking-[0.12em] uppercase">
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    {isFr ? "Précédent" : "Previous"}
                  </span>
                  <span className="text-fg group-hover:text-terracotta-deep mt-1 block text-sm font-medium transition">
                    {getCopy(prev, loc).question}
                  </span>
                </a>
              ) : (
                <span aria-hidden="true" className="hidden sm:block" />
              )}
              {next ? (
                <a
                  href={`/${locale}/faq/${next.slug}`}
                  className="border-border bg-paper hover:border-terracotta/60 hover:shadow-subtle group rounded-xl border p-4 transition sm:text-right"
                >
                  <span className="text-fg-muted inline-flex items-center gap-1 text-xs font-medium tracking-[0.12em] uppercase">
                    {isFr ? "Suivant" : "Next"}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-fg group-hover:text-terracotta-deep mt-1 block text-sm font-medium transition">
                    {getCopy(next, loc).question}
                  </span>
                </a>
              ) : null}
            </nav>
          ) : null}
        </Container>
      </Section>

      {/* Maillage interne contextuel curé par catégorie (server, 0 JS). */}
      <FaqRelatedResources category={entry.category} locale={locale} isFr={isFr} />

      {related.length > 0 ? (
        <Section eyebrow={isFr ? "Autres questions" : "Other questions"} tone="paper">
          <Container className="max-w-3xl">
            <ul className="grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <a
                    href={`/${locale}/faq/${r.slug}`}
                    className="border-border bg-bg hover:border-terracotta/60 hover:shadow-subtle group flex h-full flex-col rounded-xl border p-4 transition"
                  >
                    {r.catLabel ? (
                      <span className="text-terracotta-deep bg-terracotta-soft mb-2 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                        {r.catLabel}
                      </span>
                    ) : null}
                    <span className="text-fg group-hover:text-terracotta-deep flex items-start justify-between gap-3 text-base font-medium transition">
                      <span className="min-w-0">{r.question}</span>
                      <ArrowUpRight
                        className="text-fg-muted group-hover:text-terracotta mt-0.5 h-4 w-4 shrink-0 transition"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="text-fg-soft mt-1.5 line-clamp-2 block text-sm leading-snug">
                      {r.snippet}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      <div className="border-border border-t py-6">
        <Container>
          <WasHelpful isFr={isFr} />
        </Container>
      </div>

      {/* AI Act art. 50 — disclosure visible sur les Q/R générées (Track B). */}
      {isAutoGen && (
        <Container className="max-w-3xl">
          <AiContentDisclaimer locale={isFr ? "fr" : "en"} />
        </Container>
      )}

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
      {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
    </>
  );
}
