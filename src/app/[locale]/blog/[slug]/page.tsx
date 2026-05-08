import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { BLOG_POSTS, getBlogPost, getAllBlogSlugs } from "@/content/transversal";
import { resolveTier } from "@/content/blog";
import { buildProductMetadata, buildArticleJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllBlogSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const post = getBlogPost(slug);
  if (!post) return {};
  const c = post[locale];
  const meta = buildProductMetadata({
    locale,
    path: `/blog/${slug}`,
    title: `${c.title} · AxionIA`,
    description: c.excerpt,
  });
  // Anti-doorway HCU 2024 — meta robots dérivé du tier (Sprint 14.10).
  // tier-1 = index follow (sitemap inclus) · tier-2 = noindex follow
  // (crawlable mais non indexé) · tier-3 = noindex nofollow.
  const tier = resolveTier(post);
  if (tier === "tier-2-noindex-follow") {
    return { ...meta, robots: { index: false, follow: true } };
  }
  if (tier === "tier-3-noindex-nofollow") {
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

  const post = getBlogPost(slug);
  if (!post) notFound();
  const copy = post[loc];

  const wordCount = copy.body.trim().split(/\s+/).length;
  const articleJsonLd = buildArticleJsonLd({
    locale: loc,
    path: `/blog/${slug}`,
    headline: copy.title,
    description: copy.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    articleBody: copy.body,
    authorName: post.author,
    authorSlug: post.author.toLowerCase(),
    keywords: post.tags,
    articleSection: post.category,
    wordCount,
  });

  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: `/blog/${slug}`, label: copy.title },
  ];

  const titleParts = splitTitleEm(copy.title);
  const blocks = parseBody(copy.body);

  // Articles connexes : priorité même catégorie, puis plus récents.
  // Toujours 2 cards (max 2 pour ne pas surcharger la page article).
  const related = [...BLOG_POSTS]
    .filter((p) => p.slug !== slug)
    .sort((a, b) => {
      const aSame = a.category === post.category ? 0 : 1;
      const bSame = b.category === post.category ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      return b.publishedAt.localeCompare(a.publishedAt);
    })
    .slice(0, 2);

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={post.category}
        title={titleParts.lead}
        titleEm={titleParts.em}
        description={copy.excerpt}
      >
        <Container className="text-fg-muted mt-8 flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="neutral">{post.category}</Badge>
          <Link
            href={`/blog/auteur/${post.author.toLowerCase()}` as never}
            className="hover:text-terracotta-deep focus-visible:ring-terracotta rounded-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Par" : "By"} {post.author}
          </Link>
          <span aria-hidden="true">·</span>
          <time dateTime={post.publishedAt} className="tabular-nums">
            {isFr ? "Publié le" : "Published"} {post.publishedAt}
          </time>
          {post.updatedAt && post.updatedAt !== post.publishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={post.updatedAt} className="tabular-nums">
                {isFr ? "Mis à jour le" : "Updated"} {post.updatedAt}
              </time>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{post.readingTime}</span>
        </Container>
      </Section>

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

      {related.length > 0 ? (
        <Section
          eyebrow={isFr ? "Articles connexes" : "Related articles"}
          title={isFr ? "À lire aussi" : "Read next"}
          tone="sand"
        >
          <Container>
            <ul className="grid gap-4 sm:grid-cols-2">
              {related.map((p) => {
                const c = p[loc];
                return (
                  <li key={p.slug}>
                    <ArticleCard
                      href={`/blog/${p.slug}`}
                      title={c.title}
                      excerpt={c.excerpt}
                      publishedAt={p.publishedAt}
                      readingTime={p.readingTime}
                    />
                  </li>
                );
              })}
            </ul>
          </Container>
        </Section>
      ) : null}

      <CtaBlock
        title={isFr ? "Mettre en pratique" : "Put it to work"}
        description={
          isFr
            ? "Démarrez par une intervention Essentielle 490 €."
            : "Start with an Essential session €490."
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
