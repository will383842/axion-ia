import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
import { ArticleTOC, extractTocItems, type TocItem } from "@/components/seo/ArticleTOC";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { getAllBlogSlugs } from "@/content/transversal";
import { buildProductMetadata, buildArticleJsonLd, SITE_URL } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import { loadBlogArticleForView } from "@/server/content-gen/blog/loader";
import { findArticleTombstone } from "@/server/content-gen/tombstone";
import { Tombstone } from "@/components/content-gen/Tombstone";
import { findArticleSlugRedirect } from "@/server/content-gen/slug-history";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { SuggestedContent } from "@/components/suggested/SuggestedContent";
import { findRelatedArticles } from "@/server/content-gen/links/related-articles";

// Sprint 8 V2 : ISR Next 16 — la route est pré-rendue au build pour les slugs
// FS connus (generateStaticParams) puis re-validée toutes les heures. Les
// nouveaux articles publiés en DB (Article table via content-gen factory)
// sont rendus à la demande au premier hit puis cachés 1h.
export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  // V1 : seulement les slugs FS connus. Les slugs DB sont rendus on-demand
  // (Next 16 ISR fallback="blocking" implicite quand dynamicParams=true).
  const slugs = getAllBlogSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const view = await loadBlogArticleForView(slug, locale);
  if (!view) {
    // Audit indexation 2026-05-15 P0-7 — soft-410 tombstone metadata.
    if (locale === "fr") {
      const tombstone = await findArticleTombstone(slug);
      if (tombstone) {
        return {
          title: `${tombstone.title} · Ressource retirée · Axion-IA`,
          robots: { index: false, follow: false },
        };
      }
    }
    return {};
  }
  // V-07 sprint UX 2026-05-22 — préfère DB metaTitle/metaDescription si fournis
  // (champs SEO-tunés au moment de la rédaction Manon ou via factory content-gen).
  // Fallback : title + excerpt rétrocompatible articles FS.
  const meta = buildProductMetadata({
    locale,
    path: `/blog/${slug}`,
    title: view.metaTitle ?? view.title,
    description: view.metaDescription ?? view.excerpt,
  });
  // Anti-doorway HCU 2024 — meta robots dérivé du tier (Sprint 14.10).
  // tier-1-indexable = index follow (sitemap inclus) · tier-2 = noindex follow
  // (crawlable mais non indexé) · tier-3 = noindex nofollow.
  if (view.tier === "tier-2-noindex-follow") {
    return { ...meta, robots: { index: false, follow: true } };
  }
  if (view.tier === "tier-3-noindex-nofollow") {
    return { ...meta, robots: { index: false, follow: false } };
  }
  return meta;
}

// Découpe heuristique du titre en `lead` + `em` (em = portion serif italique
// terracotta). Règle :
// 1. Si le titre contient « : » (FR) ou « : » (EN), on coupe au séparateur :
//    la partie après le « : » devient l'em (gold case « IA Custom : quand est-ce
//    vraiment nécessaire ? »).
// 2. Sinon on italicise les 2 derniers mots si le titre fait 4+ mots,
//    sinon le dernier mot. Cela donne une accroche sobre cohérente avec
//    le pattern /blog index `display-editorial` + serif italique.
/**
 * Dérive le texte TL;DR (Canonical Answer pattern AEO/GEO 2026 § 3.5).
 * Priorité : `excerpt` (champ Prisma curé éditorialement) → fallback 2
 * premières phrases du body. Retourne `null` si rien d'exploitable.
 */
function deriveTldr(excerpt: string | null | undefined, body: string): string | null {
  const trimmed = (excerpt ?? "").trim();
  if (trimmed.length > 0) return trimmed;
  const sentences = body
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÀÉÈÔÎÊ])/)
    .filter((s) => s.length > 0)
    .slice(0, 2)
    .join(" ");
  return sentences.length > 0 ? sentences : null;
}

function splitTitleEm(title: string): { lead: string; em: string } {
  const colonFr = title.indexOf(" : ");
  if (colonFr > 0) {
    return { lead: title.slice(0, colonFr + 1), em: title.slice(colonFr + 3) };
  }
  const colonEn = title.indexOf(": ");
  if (colonEn > 0) {
    return { lead: title.slice(0, colonEn + 1), em: title.slice(colonEn + 2) };
  }
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return { lead: "", em: title };
  const emCount = words.length >= 4 ? 2 : 1;
  return {
    lead: words.slice(0, words.length - emCount).join(" "),
    em: words.slice(words.length - emCount).join(" "),
  };
}

type Block = { kind: "p"; text: string } | { kind: "ol"; items: ReadonlyArray<string> };

// Découpe un body BlogPost (string monolithique) en blocs lisibles.
// Heuristique :
// - Si le body contient une énumération « 1) … 2) … 3) … » : split en
//   intro paragraphe + <ol> d'items + outro paragraphe optionnel.
// - Sinon split par phrase (lookbehind `.` + espace + capital) : 1 phrase
//   = 1 paragraphe. Donne un rythme de lecture éditorial.
//
// Cible : passer du single `<p>` d'origine (audit V14 D4 densité 1/3) à un
// rendu multi-paragraphe avec respiration verticale (D4 → 3/3).
function parseBody(body: string): Block[] {
  const trimmed = body.trim();
  const enumPattern = /\s\d+\)\s+/g;
  const matches = [...trimmed.matchAll(enumPattern)];

  if (matches.length >= 2) {
    const blocks: Block[] = [];
    const firstIdx = matches[0]!.index ?? 0;
    const intro = trimmed
      .slice(0, firstIdx)
      .trim()
      .replace(/\s*:\s*$/, "")
      .trim();
    if (intro) blocks.push({ kind: "p", text: intro + (intro.endsWith(".") ? "" : ".") });

    const items: string[] = [];
    let outro = "";
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const start = (m.index ?? 0) + m[0].length;
      const end =
        i + 1 < matches.length ? (matches[i + 1]!.index ?? trimmed.length) : trimmed.length;
      let itemText = trimmed.slice(start, end).trim();
      itemText = itemText.replace(/[,]$/, "");

      if (i === matches.length - 1) {
        // Dernier item : tenter d'extraire l'outro (« X. ¶Capital… »)
        const outroMatch = itemText.match(/^(.*?[.)])\s+([A-ZÀÉÈÔÎ].*)$/s);
        if (outroMatch) {
          itemText = outroMatch[1]!;
          outro = outroMatch[2]!.trim();
        }
      }
      items.push(itemText.replace(/\.$/, "").trim());
    }
    blocks.push({ kind: "ol", items });
    if (outro) blocks.push({ kind: "p", text: outro });
    return blocks;
  }

  // Pas d'énumération — split phrase par phrase.
  const sentences = trimmed.split(/(?<=\.)\s+(?=[A-ZÀÉÈÔÎ])/);
  if (sentences.length <= 1) return [{ kind: "p", text: trimmed }];
  return sentences.map((s) => ({ kind: "p", text: s.trim() }));
}

export default async function BlogArticle({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const view = await loadBlogArticleForView(slug, loc);
  if (!view) {
    // Audit indexation 2026-05-15 P0-5 — redirect 301 via ArticleSlugHistory si
    // rename slug. Préserve SEO accumulé (avant patch : 404 immédiat = perte
    // totale du link juice). FR + EN supportés.
    const redirectInfo = await findArticleSlugRedirect(slug, loc as "fr" | "en");
    if (redirectInfo && !redirectInfo.isNews) {
      redirect(`/${loc}/blog/${redirectInfo.newSlug}`);
    }

    // Audit indexation 2026-05-15 P0-7 — soft-410 si Article archived/draft.
    // Tombstone signal `<meta robots noindex,nofollow>` permet à Google de
    // déréférencer en ~24h (vs ~6 mois en 404 silent). IndexNow URL_DELETED
    // ping déjà envoyé par archiveArticle()/deleteArticle() côté server action.
    if (isFr) {
      const tombstone = await findArticleTombstone(slug);
      if (tombstone) {
        return (
          <Tombstone
            title={tombstone.title}
            reason={tombstone.reason}
            backHref="/blog"
            backLabel="Voir tous les articles"
          />
        );
      }
    }
    notFound();
  }

  const wordCount = view.body.trim().split(/\s+/).length;
  // P3 QW — TOC Featured Snippets : extrait headings du bodyHtml pour articles DB longs.
  const tocItems: TocItem[] = wordCount > 1500 ? extractTocItems(view.body) : [];
  const pageUrl = `${SITE_URL}/${loc}/blog/${slug}`;
  // P1.5 QW-1 — AI Act art. 50 (deadline 2026-08-02) : flag machine-readable
  // obligatoire sur tout contenu IA-assisté. `buildArticleJsonLd` (seo.ts générique)
  // n'émet pas `aiGenerated` — spread explicite ici pour les articles DB (Manon)
  // et FS (auteur humain : flag reste vrai car pipeline IA-assisté).
  const articleJsonLd = {
    ...buildArticleJsonLd({
      locale: loc,
      path: `/blog/${slug}`,
      headline: view.title,
      description: view.excerpt,
      datePublished: view.publishedAt,
      dateModified: view.updatedAt ?? view.publishedAt,
      articleBody: view.body,
      authorName: view.author,
      authorSlug: view.author.toLowerCase(),
      keywords: view.tags,
      articleSection: view.category,
      wordCount,
      ...(view.citations.length > 0 ? { isBasedOn: view.citations } : {}),
    }),
    aiGenerated: true,
    additionalType: "https://schema.org/AIGeneratedContent",
    speakable: buildSpeakableSpecification({
      selectors: [".tldr-answer", '[data-aeo="tldr"]', ".faq-answer", '[data-aeo="answer"]'],
    }),
  };

  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: `/blog/${slug}`, label: view.title },
  ];

  const titleParts = splitTitleEm(view.title);
  const blocks = parseBody(view.body);

  // TL;DR Canonical Answer (audit AEO/GEO 2026-05-15 § 3.5).
  const tldrText = deriveTldr(view.excerpt, view.body);

  // V-14 sprint UX 2026-05-22 — Articles connexes : DB+FS merge via helper.
  // Auparavant FS uniquement (3 articles hardcodés) → maintenant inclut articles
  // DB publiés. Toujours tier-1 only (anti-doorway HCU). 4 max suggestion.
  const related = await findRelatedArticles({
    currentSlug: slug,
    currentCategory: view.category,
    locale: loc,
    limit: 4,
  });

  return (
    <>
      {/* P1-17 — alternate format markdown brut pour LLM ingestion. */}
      <link
        rel="alternate"
        type="text/markdown"
        href={`/api/markdown/blog/${slug}`}
        title={`${view.title} (markdown)`}
      />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={view.category}
        title={titleParts.lead}
        titleEm={titleParts.em}
        description={view.excerpt}
      >
        <Container className="text-fg-muted mt-8 flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="neutral">{view.category}</Badge>
          <Link
            href={`/blog/auteur/${view.author.toLowerCase()}` as never}
            className="hover:text-terracotta-deep focus-visible:ring-terracotta rounded-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Par" : "By"} {view.author}
          </Link>
          <span aria-hidden="true">·</span>
          <time dateTime={view.publishedAt} className="tabular-nums">
            {isFr ? "Publié le" : "Published"} {view.publishedAt}
          </time>
          <span aria-hidden="true">·</span>
          <span>{view.readingTime}</span>
        </Container>
        {/* City Domination 2026-05-18 P1-22 (audit cross-cut 14 EEAT) —
            "Dernière révision" banner visible. Toujours affiché (publishedAt
            par défaut si pas d'updatedAt). Signal freshness EEAT pour Google +
            LLMs (Article.dateModified JSON-LD déjà émis côté schema). Cohérent
            avec doctrine cite-friendly 2026. */}
        <Container className="mt-4 max-w-3xl">
          <div className="border-border bg-sand-50 text-fg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <svg
              aria-hidden="true"
              className="text-terracotta-deep h-4 w-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.477-9.817a.75.75 0 0 1 1.053-.143Z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              {isFr ? "Dernière révision : " : "Last reviewed: "}
              <time dateTime={view.updatedAt ?? view.publishedAt} className="tabular-nums">
                {view.updatedAt ?? view.publishedAt}
              </time>
              {view.updatedAt && view.updatedAt !== view.publishedAt ? (
                <span className="text-fg-muted ml-1">{isFr ? "(mis à jour)" : "(updated)"}</span>
              ) : null}
            </span>
          </div>
        </Container>
        {/* P3 QW-5 — AuthorByline E-E-A-T (KB-10). */}
        <Container className="mt-2 max-w-3xl">
          <AuthorByline
            authorName={view.author}
            authorSlug={view.author.toLowerCase()}
            publishedAt={view.publishedAt ? new Date(view.publishedAt) : null}
            lastReviewedAt={view.updatedAt ? new Date(view.updatedAt) : null}
            locale={loc}
          />
        </Container>
      </Section>

      {/* P2-3 — Image hero article (LCP critique : priority obligatoire).
          Rendu uniquement si Article.featuredImage est renseigné en DB.
          Les articles FS (hardcodés) retournent null → bloc non rendu.
          Ratio 16/9 standard, object-cover pour éviter CLS. */}
      {view.featuredImage ? (
        <Container className="max-w-4xl">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg">
            <Image
              src={view.featuredImage}
              alt={view.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              className="object-cover"
            />
          </div>
          <UnsplashCredit
            photographerName={view.photographerName}
            photographerUrl={view.photographerUrl}
          />
        </Container>
      ) : null}

      {tldrText ? (
        <Section>
          <Container className="max-w-3xl">
            <AnswerCard locale={loc}>{tldrText}</AnswerCard>
          </Container>
        </Section>
      ) : null}

      {/* P3 TOC Featured Snippets — rendu si article > 1500 mots et headings détectés. */}
      {tocItems.length >= 2 && (
        <Container className="max-w-3xl">
          <ArticleTOC items={tocItems} pageUrl={pageUrl} locale={loc} />
        </Container>
      )}

      <Section>
        <Container className="text-fg max-w-3xl space-y-6 text-lg leading-relaxed">
          {blocks.map((block, idx) => {
            if (block.kind === "ol") {
              return (
                <ol
                  key={`b-${idx}`}
                  className="text-fg marker:text-terracotta list-decimal space-y-3 pl-6 marker:font-semibold"
                >
                  {block.items.map((it, j) => (
                    <li key={`i-${j}`} className="pl-1">
                      {it}
                    </li>
                  ))}
                </ol>
              );
            }
            return <p key={`b-${idx}`}>{block.text}</p>;
          })}
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          <AiContentDisclaimer locale={loc} />
        </Container>
      </Section>

      <SuggestedContent
        variant="articles"
        items={related.map((r) => ({
          href: `/blog/${r.slug}`,
          title: r.title,
          excerpt: r.excerpt,
          publishedAt: r.publishedAt,
          readingTime: r.readingTime,
        }))}
        eyebrow={isFr ? "Articles connexes" : "Related articles"}
        title={isFr ? "À lire aussi" : "Read next"}
        tone="sand"
        emitJsonLd
      />

      <CtaBlock
        title={isFr ? "Mettre en pratique" : "Put it to work"}
        description={
          isFr
            ? `Démarrez par une intervention Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}.`
            : `Start with an Essential session ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}.`
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle" : "See the Essential"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={articleJsonLd} />
    </>
  );
}
