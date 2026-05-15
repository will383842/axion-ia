/**
 * Blog FS → DB bootstrap (Audit A7 follow-up P1-3, 2026-05-15).
 *
 * Scanne `src/content/blog/posts/*.ts` via `BLOG_POSTS` barrel et insère chaque
 * post dans la table `articles` + `article_translations` (FR + EN) + `article_tags`.
 *
 * **Idempotent** : la table `article_translations` a `@@unique([locale, slug])`
 * → un re-run ne crée pas de doublons. Si la traduction FR existe déjà, le
 * script skip l'article entier.
 *
 * Mapping BlogPost FS → Article DB :
 *   - `slug`            → ArticleTranslation.slug (FR + EN identiques pour
 *                         les 3 posts actuels, mais le script accepte les
 *                         divergences via `BlogPost.fr.title` / `en.title`
 *                         comme source canonique).
 *   - `publishedAt`     → Article.publishedAt
 *   - `readingTime`     → Article.readingTime (parsed depuis "X min")
 *   - `author`          → Author.slug = "manon" (créé via seed Content Generator)
 *                         Fallback : crée un Author "manon" minimal si absent
 *                         (sans dépendance à AuthorProfile content-gen).
 *   - `category`        → Category.slug = `slugify(blogCategory)` préfixé
 *                         "blog-" pour éviter collision modules.
 *   - `tags`            → ArticleTag.slug créé via upsert idempotent.
 *   - `indexationTier`  → Article.indexationTier (mappé via map literal,
 *                         pas BlogPost.indexationTier "tier-1-indexable" qui
 *                         diffère du enum DB `tier_1_indexable`).
 *   - `qualityScore`    → Article.qualityScore (Int)
 *   - `promotedAt`      → Article.promotedAt
 *   - `fr.title/excerpt/body` → ArticleTranslation FR + meta dérivés
 *   - `en.title/excerpt/body` → ArticleTranslation EN + meta dérivés
 *   - `fr.faq`          → Article.faqJson (FAQ FR uniquement, schema FAQPage
 *                         JSON-LD géré côté rendering)
 *   - `fr.directAnswer` → Article.directAnswer
 *
 * Usage :
 *   pnpm tsx prisma/seeds/blog-fs-bootstrap.ts
 *
 * Note : ce script complète `prisma/seed.ts` existant qui contient 3 articles
 * hardcodés. Quand le fallback FS sera retiré (Sprint 15+ DB-only), ce script
 * peut être retiré aussi — `prisma seed` standard suffira. Voir
 * `src/app/sitemap.ts:334` pour le fallback runtime FS+DB pendant la transition.
 */

import { PrismaClient } from "../generated/client";
import { BLOG_POSTS, resolveTier, slugify } from "../../src/content/blog";
import type {
  BlogPost,
  BlogCategory,
  IndexationTier as FsIndexationTier,
} from "../../src/content/blog/types";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────
// Mapping IndexationTier FS (kebab "tier-1-indexable") → enum DB (snake "tier_1_indexable")
// ─────────────────────────────────────────────────────────────────────
const TIER_MAP: Record<
  FsIndexationTier,
  "tier_1_indexable" | "tier_2_noindex_follow" | "tier_3_noindex_nofollow"
> = {
  "tier-1-indexable": "tier_1_indexable",
  "tier-2-noindex-follow": "tier_2_noindex_follow",
  "tier-3-noindex-nofollow": "tier_3_noindex_nofollow",
};

function blogCategoryToSlug(cat: BlogCategory): string {
  return `blog-${slugify(cat)}`;
}

function parseReadingTimeMinutes(readingTime: string): number {
  const match = readingTime.match(/(\d+)/);
  if (!match || !match[1]) return 5;
  return parseInt(match[1], 10);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd();
}

// ─────────────────────────────────────────────────────────────────────
// Author "manon" — créé ici en fallback minimal (sans AuthorProfile content-gen)
// pour permettre au script de tourner indépendamment du seed content-gen.
// ─────────────────────────────────────────────────────────────────────
async function ensureManonAuthor(): Promise<string> {
  const existing = await prisma.author.findUnique({ where: { slug: "manon" } });
  if (existing) return existing.id;
  const created = await prisma.author.create({
    data: {
      slug: "manon",
      name: "Manon",
      bioFr: "Plume éditoriale fictive d'Axion-IA (persona IA disclosed).",
      bioEn: "AI-generated editorial persona for Axion-IA (disclosed).",
    },
  });
  return created.id;
}

async function ensureCategory(blogCat: BlogCategory): Promise<string> {
  const slug = blogCategoryToSlug(blogCat);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: {
      slug,
      nameFr: blogCat,
      nameEn: blogCat,
      // Pas de `module` : aligné avec `prisma/seed.ts:127-131` (catégories blog
      // n'ont pas de `ModuleKind`, ce champ ne sert qu'aux modules audit /
      // interventions / implementation).
    },
  });
  return created.id;
}

async function ensureTags(tagLabels: ReadonlyArray<string>): Promise<string[]> {
  const ids: string[] = [];
  for (const label of tagLabels) {
    const tagSlug = slugify(label);
    const row = await prisma.articleTag.upsert({
      where: { slug: tagSlug },
      update: {},
      create: {
        slug: tagSlug,
        nameFr: label,
        nameEn: label,
      },
    });
    ids.push(row.id);
  }
  return ids;
}

// ─────────────────────────────────────────────────────────────────────
// Importe un BlogPost FS vers DB (idempotent via @@unique(locale, slug)).
// Retourne true si l'article a été créé, false si déjà présent.
// ─────────────────────────────────────────────────────────────────────
async function importPost(post: BlogPost, authorId: string): Promise<boolean> {
  const existingFr = await prisma.articleTranslation.findUnique({
    where: { locale_slug: { locale: "fr", slug: post.slug } },
  });
  if (existingFr) return false;

  const categoryId = await ensureCategory(post.category);
  const tagIds = await ensureTags(post.tags);

  const tier = TIER_MAP[resolveTier(post)];
  const faqJsonValue = post.fr.faq && post.fr.faq.length > 0 ? post.fr.faq : null;

  await prisma.article.create({
    data: {
      authorId,
      categoryId,
      status: tier === "tier_1_indexable" ? "published" : "draft",
      publishedAt: new Date(post.publishedAt),
      readingTime: parseReadingTimeMinutes(post.readingTime),
      indexationTier: tier,
      qualityScore: post.qualityScore ?? null,
      promotedAt: post.promotedAt ? new Date(post.promotedAt) : null,
      directAnswer: post.fr.directAnswer ?? null,
      faqJson: faqJsonValue ? JSON.parse(JSON.stringify(faqJsonValue)) : undefined,
      isNews: false,
      translations: {
        create: [
          {
            locale: "fr",
            title: post.fr.title,
            slug: post.slug,
            excerpt: post.fr.excerpt,
            body: post.fr.body,
            metaTitle: truncate(post.fr.title, 70),
            metaDescription: truncate(post.fr.excerpt, 160),
          },
          {
            locale: "en",
            title: post.en.title,
            slug: post.slug,
            excerpt: post.en.excerpt,
            body: post.en.body,
            metaTitle: truncate(post.en.title, 70),
            metaDescription: truncate(post.en.excerpt, 160),
          },
        ],
      },
      tags: {
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
  });
  return true;
}

async function main(): Promise<void> {
  console.log(`[blog-fs-bootstrap] starting (${BLOG_POSTS.length} posts FS détectés)…`);
  const authorId = await ensureManonAuthor();
  let created = 0;
  let skipped = 0;
  for (const post of BLOG_POSTS) {
    const wasCreated = await importPost(post, authorId);
    if (wasCreated) {
      created++;
      console.log(`  ✓ inséré : ${post.slug}`);
    } else {
      skipped++;
      console.log(`  · skippé (déjà en DB) : ${post.slug}`);
    }
  }
  console.log(`[blog-fs-bootstrap] terminé : ${created} insérés, ${skipped} déjà présents.`);
}

main()
  .catch((err) => {
    console.error("[blog-fs-bootstrap] erreur :", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
