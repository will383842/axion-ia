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
  Sparkles,
  Mail,
  Rss,
  LayoutGrid,
  MessagesSquare,
} from "lucide-react";
import { routing, STATIC_LOCALES, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqRelatedResources } from "@/components/sections/FaqRelatedResources";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { buildQAPageJsonLd } from "@/lib/seo-content-gen-factories";
import { getManonPersonJsonLd } from "@/lib/seo/manon-person";
import { splitTitleEm } from "@/lib/title";
import { listFaqs, isFaqItemIndexable, type FaqItem } from "@/lib/knowledge/readers";
import { WasHelpful } from "@/components/marketing/WasHelpful";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { getFaqCategory, FAQ_CATEGORIES } from "@/content/faq-categories";
import { FAQ_CATEGORY_ICONS, FAQ_CATEGORY_ICON_FALLBACK } from "@/content/faq-category-icons";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// ISR 1h (P1 audit KB 2026-05-29) — aligné /connaissances et /ressources.
export const revalidate = 3600;

// Audit fraîcheur 2026-06-08 : date de relecture éditoriale FIGÉE (= refonte FAQ
// premium 2026-06-01). Avant : `BUILD_DATE` → publishedAt/dateModified ET la pill
// « Mis à jour » visible avançaient à CHAQUE deploy sans changement de contenu
// (date-gaming + mensonge affiché à l'utilisateur). Bumper à la main lors d'une
// vraie révision de la doctrine FAQ.
// TODO Vague 2 : plomber une vraie date par-entrée via FaqItem (DB updatedAt /
// date éditoriale par Q-R) pour différencier les dates au lieu d'une seule figée.
const FAQ_LAST_REVIEWED = "2026-06-01";

export async function generateStaticParams() {
  // KB-6.3 : utilise le reader unifié (FAQ_GLOBAL en mode legacy).
  const faqs = await listFaqs();
  return faqs.flatMap((f) => STATIC_LOCALES.map((locale) => ({ locale, slug: f.slug })));
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
  // datePublished + dateModified : date de relecture éditoriale FIGÉE
  // (`FAQ_LAST_REVIEWED`) au lieu de `BUILD_DATE` qui glissait à chaque deploy
  // (audit fraîcheur 2026-06-08). Track B (content-gen auto) → flag AI Act
  // art. 50 machine-readable sur le QAPage + disclaimer humain visible (fix
  // audit FAQ 2026-05-31, axe E4/§4.B).
  const isAutoGen = entry.isAutoGenerated;
  const qaJsonLd = buildQAPageJsonLd({
    question: copy.question,
    answerHtml: copy.answer,
    slug,
    locale: loc,
    publishedAt: FAQ_LAST_REVIEWED,
    dateModified: FAQ_LAST_REVIEWED,
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
  // FAQ 2026-05-31), complété par d'autres questions si < 6. Enrichies d'un
  // extrait + label catégorie pour l'affichage en cards (refonte 2026-07-06).
  const pool = faqs.filter((f) => f.slug !== entry.slug);
  const sameCategory = pool.filter((f) => f.category === entry.category);
  const relatedRaw = [...sameCategory, ...pool.filter((f) => f.category !== entry.category)].slice(
    0,
    6,
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

  // Explorateur de thématiques (maillage GEO hub → catégorie) : chaque catégorie
  // non vide, avec son nombre de questions, pointe vers /faq/par-thematique/<cat>.
  const categoryNav = FAQ_CATEGORIES.map((c) => {
    const count = faqs.filter((f) => f.category === c.slug).length;
    return {
      slug: c.slug,
      label: isFr ? c.labelFr : c.labelEn,
      count,
      Icon: FAQ_CATEGORY_ICONS[c.slug] ?? FAQ_CATEGORY_ICON_FALLBACK,
    };
  }).filter((c) => c.count > 0);

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

  // La réponse complète est découpée en paragraphes (double saut de ligne) pour
  // un rendu aéré. La plupart des entrées legacy sont mono-paragraphe → 1 <p>.
  const answerParagraphs = copy.answer
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const wordCount = answerWords.length;
  const readMin = Math.max(1, Math.ceil(wordCount / 200));
  const t = splitTitleEm(copy.question);

  const heroPills: ReadonlyArray<{ icon: typeof HelpCircle; label: string }> = [
    { icon: HelpCircle, label: isFr ? "Question fréquente" : "Frequent question" },
    { icon: Clock, label: isFr ? `Lecture ${readMin} min` : `${readMin} min read` },
    {
      icon: RefreshCw,
      label: isFr
        ? `Mis à jour : ${new Date(FAQ_LAST_REVIEWED).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}`
        : `Updated: ${new Date(FAQ_LAST_REVIEWED).toLocaleDateString("en-US", { year: "numeric", month: "long" })}`,
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
  ];

  const exploreLinks: ReadonlyArray<{ href: string; label: string; Icon: typeof HelpCircle }> = [
    {
      href: `/${locale}/faq`,
      label: isFr ? "Toutes les questions" : "All questions",
      Icon: LayoutGrid,
    },
    {
      href: `/${locale}/faq/par-thematique`,
      label: isFr ? "Par thématique" : "By topic",
      Icon: Sparkles,
    },
    { href: `/${locale}/faq/feed.xml`, label: isFr ? "Flux RSS" : "RSS feed", Icon: Rss },
  ];

  return (
    <>
      {/* P1-17 — alternate format markdown brut pour LLM ingestion. */}
      <link rel="alternate" type="text/markdown" href={`/api/markdown/faq/${slug}`} />

      <div className="bg-halo-warm">
        <Container className="pt-6">
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </div>

      {/* ── HÉRO — la question EST le H1 (intention de recherche) ─────────── */}
      <Section
        titleAs="h1"
        eyebrow={catLabel ? `FAQ · ${catLabel}` : "FAQ"}
        title={t.lead}
        titleEm={t.em}
        description={
          isFr
            ? "Réponse directe Axion-IA — courte, sourcée, pensée pour être citée par les moteurs de recherche et les IA."
            : "Direct Axion-IA answer — short, sourced, built to be cited by search engines and AI assistants."
        }
      >
        <div className="flex flex-col gap-6">
          {catLabel ? (
            <div>
              <a
                href={`/${locale}/faq/par-thematique/${entry.category}`}
                className="border-border bg-paper/70 text-fg hover:border-terracotta/60 hover:text-terracotta-deep inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
              >
                <CatIcon className="text-terracotta h-4 w-4" aria-hidden="true" strokeWidth={2} />
                {catLabel}
              </a>
            </div>
          ) : null}
          <ul role="list" className="flex flex-wrap gap-x-5 gap-y-2.5">
            {heroPills.map((pill) => {
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
        </div>
      </Section>

      {/* ── LA RÉPONSE — pleine largeur, 2 colonnes (réponse | aide) ─────── */}
      <section className="bg-bg text-fg border-border relative border-t py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_clamp(300px,26%,360px)] lg:gap-16">
            {/* Colonne principale — la réponse citable */}
            <div className="min-w-0">
              <p className="text-fg-muted mb-6 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "La réponse" : "The answer"}
              </p>

              {/* Réponse directe citable (AEO) — .tldr-answer + data-aeo="tldr" =
                  cssSelector Speakable, isolée par les moteurs IA. Affichée seulement
                  pour les réponses longues (sinon doublon avec la réponse complète). */}
              {directAnswer ? (
                <p
                  className="text-fg tldr-answer border-terracotta bg-halo-warm mb-8 rounded-2xl border-l-4 px-6 py-5 text-xl leading-relaxed font-medium"
                  data-aeo="tldr"
                >
                  {directAnswer}
                </p>
              ) : null}

              {/* data-aeo="answer" + .faq-answer = cssSelector Speakable JSON-LD.
                  Le wrapper porte les sélecteurs → tous les paragraphes couverts. */}
              <div
                className="faq-answer text-fg-soft space-y-5 text-lg leading-relaxed sm:text-[19px]"
                data-aeo="answer"
              >
                {answerParagraphs.map((para, i) => (
                  <p key={i} className="max-w-[72ch]">
                    {para}
                  </p>
                ))}
              </div>

              {/* Navigation séquentielle dans la thématique (lecture continue). */}
              {prev || next ? (
                <nav
                  aria-label={isFr ? "Navigation dans la thématique" : "Topic navigation"}
                  className="border-border mt-12 grid gap-3 border-t pt-8 sm:grid-cols-2"
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
                      <span className="text-fg-muted inline-flex items-center gap-1 text-xs font-medium tracking-[0.12em] uppercase sm:justify-end">
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
            </div>

            {/* Rail contextuel (aide + navigation + retour) — sticky au scroll */}
            <aside className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
              <div className="border-border bg-paper shadow-subtle rounded-2xl border p-6">
                <span className="bg-terracotta/10 text-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl">
                  <MessagesSquare aria-hidden="true" className="h-5 w-5" />
                </span>
                <h2 className="text-fg mt-4 text-lg font-semibold tracking-tight">
                  {isFr ? "Besoin d'aller plus loin ?" : "Need to go further?"}
                </h2>
                <p className="text-fg-soft mt-2 text-sm leading-relaxed">
                  {isFr
                    ? "Parlons de votre contexte : nous répondons précisément à votre cas en 20 minutes."
                    : "Let's talk about your context: we'll answer your exact case in 20 minutes."}
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  <Cta href="/appel" size="md" track="faq-detail-appel">
                    {isFr ? "Réserver un appel" : "Book a call"}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Cta>
                  <Cta href="/contact" variant="outline" size="md" track="faq-detail-contact">
                    <Mail aria-hidden="true" className="h-4 w-4" />
                    {isFr ? "Écrire un message" : "Send a message"}
                  </Cta>
                </div>
              </div>

              <nav
                aria-label={isFr ? "Naviguer dans la FAQ" : "Navigate the FAQ"}
                className="border-border bg-canvas rounded-2xl border p-5"
              >
                <p className="text-fg-muted mb-3 text-xs font-semibold tracking-[0.14em] uppercase">
                  {isFr ? "Explorer la FAQ" : "Explore the FAQ"}
                </p>
                <ul className="flex flex-col gap-1">
                  {exploreLinks.map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        className="text-fg-soft hover:bg-paper hover:text-terracotta-deep group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition"
                      >
                        <l.Icon aria-hidden="true" className="text-terracotta h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1">{l.label}</span>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="text-fg-muted group-hover:text-terracotta h-3.5 w-3.5 shrink-0 transition"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="border-border rounded-2xl border border-dashed p-5">
                <WasHelpful isFr={isFr} />
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* Maillage interne contextuel curé par catégorie (server, 0 JS). */}
      <FaqRelatedResources category={entry.category} locale={locale} isFr={isFr} />

      {/* ── QUESTIONS LIÉES — grille large 3 colonnes ────────────────────── */}
      {related.length > 0 ? (
        <Section
          tone="paper"
          eyebrow={isFr ? "Continuer la lecture" : "Keep reading"}
          title={isFr ? "Questions" : "Related"}
          titleEm={isFr ? "liées" : "questions"}
          description={
            isFr
              ? "D'autres réponses courtes et sourcées, dans la même thématique et au-delà."
              : "More short, sourced answers, within the same topic and beyond."
          }
        >
          <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <a
                  href={`/${locale}/faq/${r.slug}`}
                  className="border-border bg-canvas hover:border-terracotta/60 hover:shadow-elevated group flex h-full flex-col rounded-2xl border p-5 transition hover:-translate-y-0.5"
                >
                  {r.catLabel ? (
                    <span className="text-terracotta-deep bg-terracotta-soft mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                      {r.catLabel}
                    </span>
                  ) : null}
                  <span className="text-fg group-hover:text-terracotta-deep flex items-start justify-between gap-3 text-base font-semibold tracking-tight transition">
                    <span className="min-w-0">{r.question}</span>
                    <ArrowUpRight
                      className="text-fg-muted group-hover:text-terracotta mt-0.5 h-4 w-4 shrink-0 transition"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-fg-soft mt-2 line-clamp-3 block text-sm leading-snug">
                    {r.snippet}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── EXPLORER PAR THÉMATIQUE — maillage GEO hub → catégories ───────── */}
      {categoryNav.length > 0 ? (
        <Section
          tone="sand"
          eyebrow={isFr ? "Toutes les thématiques" : "Every topic"}
          title={isFr ? "Explorer la FAQ par" : "Explore the FAQ by"}
          titleEm={isFr ? "thématique" : "topic"}
          description={
            isFr
              ? "Interventions, audit, implémentation, tarifs, RGPD, coaching… trouvez la famille de questions qui vous concerne."
              : "Sessions, audit, implementation, pricing, GDPR, coaching… find the family of questions that matters to you."
          }
        >
          <ul
            role="list"
            className="xs:grid-cols-2 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4"
          >
            {categoryNav.map((c) => (
              <li key={c.slug}>
                <a
                  href={`/${locale}/faq/par-thematique/${c.slug}`}
                  className="border-border bg-canvas hover:border-terracotta/60 hover:shadow-subtle group flex h-full items-center gap-3 rounded-xl border p-4 transition"
                >
                  <span className="bg-terracotta/10 text-terracotta inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <c.Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-fg group-hover:text-terracotta-deep block text-sm font-semibold tracking-tight transition">
                      {c.label}
                    </span>
                    <span className="text-fg-muted text-xs tabular-nums">
                      {c.count} {isFr ? (c.count > 1 ? "questions" : "question") : "questions"}
                    </span>
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-fg-muted group-hover:text-terracotta h-4 w-4 shrink-0 transition"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* AI Act art. 50 — disclosure visible sur les Q/R générées (Track B). */}
      {isAutoGen && (
        <Container className="max-w-3xl py-8">
          <AiContentDisclaimer locale={isFr ? "fr" : "en"} />
        </Container>
      )}

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        tone="mocha"
        eyebrow={isFr ? "Votre question n'est pas là ?" : "Question not listed?"}
        title={isFr ? "Posez-la," : "Ask it,"}
        titleEm={isFr ? "on vous répond" : "we'll answer"}
        description={
          isFr
            ? "Écrivez-nous à contact@axion-ia.com ou réservez un appel : nous répondons précisément à votre cas, sans engagement."
            : "Email us at contact@axion-ia.com or book a call: we answer your exact case, no strings attached."
        }
        cta={
          <>
            <Cta href="/appel" variant="primary" size="xl" track="faq-detail-final-appel">
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/contact" variant="outline" size="xl" track="faq-detail-final-contact">
              {isFr ? "Écrire un message" : "Send a message"}
            </Cta>
          </>
        }
      />

      <JsonLd data={qaJsonLd} />
      {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
    </>
  );
}
