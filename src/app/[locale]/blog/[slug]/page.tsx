import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import Image from "next/image";
import { routing, STATIC_LOCALES, type Locale } from "@/i18n/routing";
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
import {
  buildProductMetadata,
  buildArticleJsonLd,
  ensureArticleMetaDescription,
  SITE_URL,
} from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import {
  loadBlogArticleForView,
  loadAdjacentArticles,
  loadPeopleAlsoAsk,
} from "@/server/content-gen/blog/loader";
import { ArticlePrevNext } from "@/components/content-gen/ArticlePrevNext";
import { ArticlePeopleAlsoAsk } from "@/components/content-gen/ArticlePeopleAlsoAsk";
import { ArticleNewsletterInline } from "@/components/content-gen/ArticleNewsletterInline";
import { findArticleTombstone } from "@/server/content-gen/tombstone";
import { Tombstone } from "@/components/content-gen/Tombstone";
import { findArticleSlugRedirect } from "@/server/content-gen/slug-history";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { ArticleFaq } from "@/components/content-gen/ArticleFaq";
import { ArticleSources } from "@/components/content-gen/ArticleSources";
import { ArticleKeyTakeaway } from "@/components/content-gen/ArticleKeyTakeaway";
import { ArticleExpertQuote } from "@/components/content-gen/ArticleExpertQuote";
import { ArticleShareBar } from "@/components/content-gen/ArticleShareBar";
import { ArticleTransparencyBlock } from "@/components/content-gen/ArticleTransparencyBlock";
import { SuggestedContent } from "@/components/suggested/SuggestedContent";
import {
  findRelatedArticles,
  segmentForArticleType,
} from "@/server/content-gen/links/related-articles";
import { getVille } from "@/content/villes";
// VIS-01 (audit visibilité 2026-06-05) — rendu HTML sanitisé du body des
// articles DB (bodyHtml) + injection d'ancres h2. Aligne /blog sur le chemin
// correct déjà utilisé par /connaissances (avant : parseBody rendait le HTML
// en texte échappé → balises visibles, 0 titre/lien/mise en forme).
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
import { buildToc } from "@/lib/knowledge/article-enrich";
// H3 (audit grounding 2026-06-05) — résout les tokens prix {{price:...}} au
// rendu (no-op si aucun) : filet anti-fuite de token brut + cohérence SSOT.
import { resolvePriceTokens } from "@/content/pricing-tokens";
// VIS-09 — articles DB (content-gen, auteur Manon) émis via la factory
// BlogPosting (type correct + author @id résolu + AI Act + image hero).
import { buildBlogPostingJsonLd } from "@/lib/seo-content-gen-factories";
import { getManonPersonJsonLd, getManonByline } from "@/lib/seo/manon-person";

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
  return STATIC_LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
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
    // P0 soft-404 (2026-06-21) — slug inconnu SANS tombstone. Avant : `return {}`
    // → métadonnées vides → la page héritait du `robots: index, follow` du
    // `[locale]/layout.tsx` et était servie en 200 INDEXABLE (Google indexait des
    // URLs blog inexistantes à l'infini = gaspillage de crawl + soft-404). On
    // émet désormais un noindex/nofollow explicite (la page appelle aussi
    // `notFound()` → rendu `[locale]/not-found.tsx`). Aligné avec le catch-all.
    return { robots: { index: false, follow: false } };
  }
  // V-07 sprint UX 2026-05-22 — préfère DB metaTitle/metaDescription si fournis
  // (champs SEO-tunés au moment de la rédaction Manon ou via factory content-gen).
  // Fallback : title + excerpt rétrocompatible articles FS.
  // P0 qualité 2026-06-25 — plancher 140-160 car sur la meta description ARTICLE.
  // `ensureArticleMetaDescription` (seo.ts) garde la metaDescription DB si déjà
  // assez longue, sinon retombe sur excerpt/directAnswer puis tronque proprement.
  const articleDescription = ensureArticleMetaDescription(view.metaDescription ?? view.excerpt, {
    excerpt: view.excerpt,
    directAnswer: view.directAnswer,
  });
  const meta = buildProductMetadata({
    locale,
    path: `/blog/${slug}`,
    title: view.metaTitle ?? view.title,
    description: articleDescription,
    ogType: "article", // VIS-05/SEO-05
    // D2 (VIS-08) — utilise la hero réelle comme og:image quand dispo (au lieu
    // de la carte /api/og générique) pour les partages sociaux + previews LLM.
    ...(view.featuredImage
      ? {
          ogImage: view.featuredImage.startsWith("http")
            ? view.featuredImage
            : `${SITE_URL}${view.featuredImage}`,
        }
      : {}),
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

  // Route-aware canonical (2026-06-17) — un guide (slug `guide-`/`guide_`) est la
  // page canonique sous /guides/[slug] (cf. isGuideArticle). loadBlogArticleForView
  // sert pourtant N'IMPORTE quel Article par slug → sans ce redirect, le même guide
  // est indexable sous /blog/guide-x ET /guides/guide-x (URL dupliquée). 308 vers
  // la canonique /guides. Miroir de resolveArticleRoute (condition slug).
  if (slug.startsWith("guide-") || slug.startsWith("guide_")) {
    permanentRedirect(`/${loc}/guides/${slug}`);
  }

  // Séparation Actualités (2026-07-01) — une actualité (`isNews=true`) est
  // canonique sous /actualites/[slug]. loadBlogArticleForView sert pourtant
  // N'IMPORTE quel Article par slug → sans ce redirect, la même news est
  // indexable sous /blog/x ET /actualites/x (URL dupliquée). 308 vers la
  // canonique /actualites. Miroir du redirect guides ci-dessus.
  if (view.isNews) {
    permanentRedirect(`/${loc}/actualites/${slug}`);
  }

  const wordCount = view.body.trim().split(/\s+/).length;
  // VIS-01 — Les articles DB stockent du bodyHtml (sortie content-gen) ; les
  // articles FS legacy stockent de la prose brute. On rend le HTML sanitisé pour
  // les DB (avec ancres h2 via buildToc) et on garde parseBody pour les FS.
  const isDbHtml = view.source === "db";
  // P1-4 (audit content-gen 2026-06-15) — La byline des articles générés (source
  // "db", persona éditoriale IA "Manon") pointait vers /blog/auteur/<slug> qui
  // renvoie notFound() pour les personas (PERSONA_AUTHOR_SLUGS) → lien interne 404
  // sur ~tous les articles générés. La vraie page persona vit sous /equipe/<slug>
  // (DB-driven, buildPersonManonJsonLd), cohérent avec AuthorByline JSON-LD.
  // Les articles FS legacy (auteurs humains, ex. "will") gardent /blog/auteur/<slug>.
  const authorSlug = view.author.toLowerCase();
  const authorHref = isDbHtml ? `/equipe/${authorSlug}` : `/blog/auteur/${authorSlug}`;
  const dbBody = isDbHtml ? buildToc(sanitizeContentGenHtml(view.body)) : null;
  // H3 — body DB avec tokens prix résolus (no-op si aucun token).
  const dbBodyHtml = dbBody ? resolvePriceTokens(dbBody.html, loc) : null;
  // P3 QW — TOC Featured Snippets : ancres alignées sur les id réellement injectés
  // (VIS-04, fini les ancres mortes). DB → toc de buildToc ; FS → extractTocItems.
  const tocItems: TocItem[] = dbBody
    ? dbBody.toc.map((h) => ({ anchor: h.id, title: h.text, level: 2 as const }))
    : wordCount > 1500
      ? extractTocItems(view.body)
      : [];
  const pageUrl = `${SITE_URL}/${loc}/blog/${slug}`;
  // P1.5 QW-1 — AI Act art. 50 (deadline 2026-08-02) : flag machine-readable
  // obligatoire sur tout contenu IA-assisté. `buildArticleJsonLd` (seo.ts générique)
  // n'émet pas `aiGenerated` — spread explicite ici pour les articles DB (Manon)
  // et FS (auteur humain : flag reste vrai car pipeline IA-assisté).
  // VIS-08/09 — URL absolue de l'image hero pour le JSON-LD (image ImageObject).
  const heroImageAbs = view.featuredImage
    ? view.featuredImage.startsWith("http")
      ? view.featuredImage
      : `${SITE_URL}${view.featuredImage}`
    : undefined;

  // VIS-09 — Articles DB (content-gen, auteur Manon) → factory BlogPosting
  // (`@type` correct + author @id résolu par le nœud Person + AI Act riche +
  // image hero). Articles FS legacy (auteur humain réel) → helper générique
  // avec le vrai auteur (NE PAS attribuer à Manon).
  const articleJsonLd = isDbHtml
    ? buildBlogPostingJsonLd({
        title: view.title,
        description: view.excerpt,
        slug,
        locale: loc,
        publishedAt: view.publishedAt,
        updatedAt: view.updatedAt ?? view.publishedAt,
        urlSegment: "blog",
        wordCount,
        ...(heroImageAbs
          ? { imageUrl: heroImageAbs, imageAlt: view.featuredImageAlt ?? view.title }
          : {}),
        ...(view.tags.length > 0 ? { tags: [...view.tags] } : {}),
        ...(view.category ? { section: view.category } : {}),
        ...(view.citations.length > 0
          ? { citations: view.citations.map((c) => ({ url: c.url, title: c.name })) }
          : {}),
      })
    : {
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

  // VIS-05/09 — Person Manon co-émis pour les articles DB (résout l'author @id
  // de la factory). FS legacy = auteur humain → pas de nœud Manon.
  const personJsonLd = isDbHtml ? await getManonPersonJsonLd() : null;
  // Chantier templates 2026-06-21 — byline enrichie pour Manon (articles DB) :
  // photo + rôle + LinkedIn lus depuis AuthorProfile. emitJsonLd={false} côté
  // byline pour ne pas dupliquer le Person riche (personJsonLd ci-dessus).
  const manonByline = isDbHtml ? await getManonByline() : null;

  // Breadcrumb : inclut le niveau catégorie quand il est connu (maillage
  // article → hub catégorie, hiérarchie alignée — audit nav 2026-06-24).
  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    ...(view.categorySlug
      ? [{ href: `/blog/categorie/${view.categorySlug}`, label: view.category }]
      : []),
    { href: `/blog/${slug}`, label: view.title },
  ];

  const titleParts = splitTitleEm(view.title);
  // VIS-01 — parseBody UNIQUEMENT pour les articles FS legacy (prose brute).
  const blocks = isDbHtml ? null : parseBody(view.body);

  // TL;DR Canonical Answer (audit AEO/GEO 2026-05-15 § 3.5).
  // VIS-03 — Préfère le directAnswer généré (snippet 0) ; fallback excerpt/body.
  // H3 — tokens prix résolus (no-op si aucun).
  const rawTldr = view.directAnswer ?? deriveTldr(view.excerpt, view.body);
  const tldrText = rawTldr ? resolvePriceTokens(rawTldr, loc) : null;

  // V-14 sprint UX 2026-05-22 — Articles connexes : DB+FS merge via helper.
  // Auparavant FS uniquement (3 articles hardcodés) → maintenant inclut articles
  // DB publiés. Toujours tier-1 only (anti-doorway HCU). 4 max suggestion.
  const related = await findRelatedArticles({
    currentSlug: slug,
    currentCategory: view.category,
    // Audit maillage 2026-07-03 — titre courant → tri par pertinence (recouvrement
    // de mots-clés), plus fiable que la catégorie souvent « Cas d'usage ».
    currentTitle: view.title,
    locale: loc,
    limit: 4,
  });

  // Refonte templates 2026-06-22 — maillage séquentiel (précédent/suivant) +
  // People Also Ask (vraies questions issues des FAQ d'autres articles).
  const [adjacent, peopleAlsoAsk] = await Promise.all([
    loadAdjacentArticles(slug, loc, view.categorySlug),
    loadPeopleAlsoAsk(slug, loc),
  ]);

  // Maillage ville (2026-06-21) — lien RETOUR article → page locale, si l'article
  // est ancré sur une ville indexable. Complète le maillage bidirectionnel (la
  // page ville liste déjà ses articles). `getVille` donne region + nom.
  const anchorVille = view.villeSlug ? getVille(view.villeSlug) : undefined;
  const anchorVilleHref =
    anchorVille && anchorVille.copy
      ? `/implantations/${anchorVille.region}/${anchorVille.slug}`
      : null;

  return (
    <>
      {/* Refonte templates 2026-06-22 (Chantier 2b) — barre de progression de
          lecture (CSS scroll-driven, 0 JS, dégrade proprement via @supports). */}
      <div className="reading-progress" aria-hidden="true" />

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
        // P2-3 — Photo hero À DROITE du titre (Will 2026-06-24 : « pas sous le
        // héro »). LCP critique → priority. Ratio 4/3 réservé (CLS = 0). Rendue
        // uniquement si Article.featuredImage existe (articles FS → décoration SVG).
        media={
          view.featuredImage ? (
            <figure className="m-0">
              <div className="border-border/60 shadow-card relative aspect-[16/10] w-full overflow-hidden rounded-2xl border">
                <Image
                  src={view.featuredImage}
                  alt={view.featuredImageAlt ?? view.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>
              <UnsplashCredit
                photographerName={view.photographerName}
                photographerUrl={view.photographerUrl}
              />
            </figure>
          ) : undefined
        }
      >
        <Container className="text-fg-muted mt-8 flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="neutral">{view.category}</Badge>
          <Link
            href={authorHref as never}
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
        {/* AuthorByline E-E-A-T déplacée EN BAS de l'article (Will 2026-06-25 :
            « le portrait de Manon serait mieux en bas »). Voir après </article>. */}
      </Section>

      {/* Photo hero déplacée DANS le <Section> ci-dessus (colonne droite, prop
          `media`) — Will 2026-06-24 « image à droite, pas sous le héro ». */}

      {/* Layout 2 colonnes (Will 2026-06-25) : rail SOMMAIRE sticky à GAUCHE +
          colonne de lecture à droite. Mobile-first : sous lg, une seule colonne
          (le <details> Sommaire de ArticleTOC s'empile en haut, le rail desktop
          est masqué). align-items par défaut (stretch) → la cellule gauche fait
          la hauteur du contenu, ce qui permet au nav `lg:sticky` de coller. */}
      <Container
        className={
          tocItems.length >= 2 ? "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12" : ""
        }
      >
        <div className="lg:col-start-1 lg:row-start-1">
          {tocItems.length >= 2 ? (
            <ArticleTOC items={tocItems} pageUrl={pageUrl} locale={loc} />
          ) : null}
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          {tldrText ? (
            <Section>
              <Container className="max-w-3xl">
                <AnswerCard locale={loc}>{tldrText}</AnswerCard>
              </Container>
            </Section>
          ) : null}

          {/* Encadré « Point clé » (distinct de la Réponse rapide). */}
          <ArticleKeyTakeaway text={view.keyTakeaway} locale={loc} />

          {/* A11y — <article> sémantique (contenu éditorial). Le landmark main et la
          cible du skip-link sont portés par <main id="main"> du layout :
          NE PAS ajouter role="main"/id ici (doublerait le landmark). */}
          <article>
            <Section>
              <Container className="text-fg max-w-[52rem] space-y-6 text-lg leading-relaxed">
                {dbBodyHtml ? (
                  // VIS-01 — Article DB : bodyHtml sanitisé (whitelist content-gen,
                  // anti-XSS) rendu en vrai HTML (titres, liens, listes), + ancres h2.
                  // H3 — tokens prix résolus.
                  <div
                    className="prose prose-axionia max-w-none"
                    dangerouslySetInnerHTML={{ __html: dbBodyHtml }}
                  />
                ) : (
                  blocks!.map((block, idx) => {
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
                  })
                )}
              </Container>
            </Section>
          </article>

          {/* Carte auteur E-E-A-T déplacée EN BAS (Will 2026-06-25) — clôt l'article
          juste après le corps, pattern éditorial standard (bio auteur en fin). */}
          <Section>
            <Container className="max-w-[52rem]">
              <AuthorByline
                authorName={view.author}
                authorSlug={view.author.toLowerCase()}
                {...(manonByline
                  ? { authorAvatarUrl: manonByline.avatarUrl, authorBio: manonByline.bio }
                  : {})}
                publishedAt={view.publishedAt ? new Date(view.publishedAt) : null}
                lastReviewedAt={view.updatedAt ? new Date(view.updatedAt) : null}
                emitJsonLd={!isDbHtml}
                locale={loc}
              />
            </Container>
          </Section>

          {/* Refonte templates 2026-06-22 (Chantier 2b) — barre de partage + copier
          le lien. URL absolue (pageUrl) pour X/LinkedIn/mailto. Server, l'îlot
          clipboard est isolé dans CopyLinkButton ("use client"). */}
          <ArticleShareBar url={pageUrl} title={view.title} locale={loc} />

          {/* Chantier templates 2026-06-21 — citation d'expert nommé (levier AEO
          le plus fort), rendue seulement si une vraie citation est renseignée. */}
          <ArticleExpertQuote quote={view.expertQuote} locale={loc} />

          {/* Chantier templates 2026-06-21 — FAQ + FAQPage JSON-LD. La donnée
          (Article.faqJson) était déjà écrite par les generators mais jamais
          rendue. Accordéon natif (0 JS), Speakable via data-faq-q/data-faq-a. */}
          <ArticleFaq
            items={view.faqItems}
            locale={loc}
            dateModified={view.updatedAt ?? view.publishedAt}
          />

          {/* Chantier templates 2026-06-21 — Sources & méthodologie visibles
          (view.citations était émis JSON-LD only). Liens nofollow + date. */}
          <ArticleSources
            items={view.citations}
            locale={loc}
            lastVerified={view.updatedAt ?? view.publishedAt}
          />

          {/* Refonte templates 2026-06-22 (Chantier 2b) — bloc de transparence
          E-E-A-T : dernière vérification + cycle de mise à jour (signal de
          fraîcheur Google/IA). Cycle aligné sur la doctrine de re-publication. */}
          <ArticleTransparencyBlock
            lastVerified={view.updatedAt ?? view.publishedAt}
            updateCycleDays={90}
            locale={loc}
          />

          {/* Maillage ville (2026-06-21) — lien retour vers la page locale. */}
          {anchorVilleHref ? (
            <Section>
              <Container className="max-w-3xl">
                <p className="text-fg-muted text-sm">
                  {isFr ? "Cet article concerne " : "This article covers "}
                  <Link
                    href={anchorVilleHref as never}
                    className="text-primary font-medium hover:underline"
                  >
                    {isFr ? `l'IA à ${anchorVille?.nameFr}` : `AI in ${anchorVille?.nameFr}`}
                  </Link>
                  {isFr ? " — voir la page locale." : " — see the local page."}
                </p>
              </Container>
            </Section>
          ) : null}

          <Section>
            <Container className="max-w-3xl">
              <AiContentDisclaimer locale={loc} />
            </Container>
          </Section>

          {/* Refonte templates 2026-06-22 — People Also Ask (vraies questions
              d'autres articles, distinct de « articles connexes »). */}
          <ArticlePeopleAlsoAsk items={peopleAlsoAsk} locale={loc} />
        </div>
      </Container>

      <SuggestedContent
        variant="articles"
        items={related.map((r) => ({
          // Route par type (audit maillage 2026-07-03) : un guide connexe doit
          // pointer /guides/… et non /blog/guide-x (308). Défaut sûr = blog.
          href: `/${segmentForArticleType(r.type ?? "blog")}/${r.slug}`,
          title: r.title,
          excerpt: r.excerpt,
          publishedAt: r.publishedAt,
          readingTime: r.readingTime,
          ...(r.imageUrl ? { imageUrl: r.imageUrl } : {}),
        }))}
        eyebrow={isFr ? "Articles connexes" : "Related articles"}
        title={isFr ? "À lire aussi" : "Read next"}
        tone="sand"
        emitJsonLd
      />

      {/* Refonte templates 2026-06-22 — article précédent / suivant (série). */}
      <ArticlePrevNext prev={adjacent.prev} next={adjacent.next} locale={loc} />

      {/* Refonte templates 2026-06-22 — capture newsletter (réutilise l'inscription
          existante du site, double opt-in + Turnstile). */}
      <ArticleNewsletterInline locale={loc} />

      <CtaBlock
        title={isFr ? "Mettre en pratique" : "Put it to work"}
        description={
          isFr ? `Démarrez par notre formation en groupe.` : `Start with our group training.`
        }
        cta={
          <Cta href="/formations" size="lg">
            {isFr ? "Voir nos formations" : "See our trainings"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={articleJsonLd} />
      {/* NB : le BreadcrumbList JSON-LD (chaîne d'attribution Claude/Perplexity/SGE)
          est émis par <Breadcrumbs> (source unique, avec « Accueil » + niveau
          catégorie). Ne PAS le ré-émettre ici — deux BreadcrumbList au même @id =
          schéma ambigu (audit E2E 2026-06-24). */}
      {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
    </>
  );
}
