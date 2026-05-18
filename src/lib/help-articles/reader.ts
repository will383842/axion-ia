/**
 * P0-5 Sprint S+3 EXECUTION (2026-05-18) — Reader unifié Centre d'aide.
 *
 * Problème originel (audit `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/23-TYPE-12-CENTRE-AIDE.md` §3) :
 * - Admin (`/admin/help/{list,new,edit}`) écrit en DB Prisma `HelpArticle` + `HelpArticleTranslation`.
 * - Public (`/centre-aide`, `/centre-aide/[slug]`, `/centre-aide/categorie/[slug]`) lit le SSOT
 *   hardcode `HELP_ARTICLES` de `src/content/transversal.ts`.
 * - Bug silencieux : Will peut créer 100 articles admin, AUCUN n'apparaît en prod.
 *
 * Pattern miroir de `src/lib/knowledge/readers.ts` (glossaire) :
 * - Flag env `HELP_BACKEND_UNIFIED` (default OFF — pas de surprise déploiement).
 * - Si flag ON et DB renvoie ≥ 1 ligne publiée → DB. Sinon → fallback hardcode.
 * - DB error fail-soft → fallback hardcode (jamais d'écran blanc).
 *
 * Pour activer côté prod : Coolify → Env vars → `HELP_BACKEND_UNIFIED=true` puis restart.
 * Pour rollback : unset l'env var + restart. Aucun risque SEO/perte de contenu.
 *
 * Cohérence i18n (AGENTS.md 2026-05-16) : EN désactivé temporairement (redirige FR),
 * mais le reader supporte les deux locales — la page publique passe `loc` dynamique.
 */

import { prisma } from "@/lib/prisma";
import { HELP_ARTICLES, slugify, type HelpArticle } from "@/content/transversal";
import type { Locale } from "../../../prisma/generated/client";

function readHelpUnifiedFlag(): boolean {
  const v = process.env.HELP_BACKEND_UNIFIED;
  return v === "1" || v === "true";
}

/**
 * Façade unifiée pour rendu public — shape identique à `HelpArticle` hardcode.
 * Permet aux pages publiques d'être indépendantes de la source (DB vs hardcode).
 *
 * Les pages consomment `[loc].title / [loc].excerpt / [loc].body` + `category` + `slug`.
 */
export type HelpArticleView = HelpArticle;

/**
 * Lit tous les articles d'aide publiés.
 * - flag OFF → hardcode `HELP_ARTICLES`.
 * - flag ON + DB rows → mappés vers shape `HelpArticleView`.
 * - flag ON + DB vide ou erreur → fallback hardcode (fail-soft).
 */
export async function listHelpArticles(): Promise<readonly HelpArticleView[]> {
  if (!readHelpUnifiedFlag()) return HELP_ARTICLES;

  try {
    const rows = await prisma.helpArticle.findMany({
      where: { status: "published" },
      include: {
        translations: true,
        category: { select: { slug: true, nameFr: true, nameEn: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    });

    const mapped = rows.map(mapPrismaRowToView).filter((a): a is HelpArticleView => a !== null);

    // DB vide → fallback hardcode pour conserver le centre d'aide actuel.
    if (mapped.length === 0) return HELP_ARTICLES;
    return mapped;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[help-articles.reader.listHelpArticles] DB read failed, fallback hardcode:",
        err,
      );
    }
    return HELP_ARTICLES;
  }
}

/**
 * Récupère un article par slug + locale.
 * - flag OFF → recherche dans `HELP_ARTICLES`.
 * - flag ON + DB → lookup via `HelpArticleTranslation.unique(locale, slug)`.
 * - flag ON + DB miss ou error → fallback hardcode lookup.
 */
export async function getHelpArticleBySlug(
  slug: string,
  locale: Locale,
): Promise<HelpArticleView | null> {
  if (!readHelpUnifiedFlag()) {
    return HELP_ARTICLES.find((a) => a.slug === slug) ?? null;
  }

  try {
    const translation = await prisma.helpArticleTranslation.findFirst({
      where: { slug, locale },
      include: {
        helpArticle: {
          include: {
            translations: true,
            category: { select: { slug: true, nameFr: true, nameEn: true } },
          },
        },
      },
    });

    if (!translation || translation.helpArticle.status !== "published") {
      // DB miss → fallback hardcode (cas DB vide ou article non encore migré).
      return HELP_ARTICLES.find((a) => a.slug === slug) ?? null;
    }

    const view = mapPrismaRowToView(translation.helpArticle);
    if (view) return view;
    return HELP_ARTICLES.find((a) => a.slug === slug) ?? null;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[help-articles.reader.getHelpArticleBySlug] DB read failed, fallback hardcode:",
        err,
      );
    }
    return HELP_ARTICLES.find((a) => a.slug === slug) ?? null;
  }
}

/**
 * Liste les articles d'une catégorie (slug calculé via `slugify(category)`).
 * Cohérent avec `getAllHelpCategorySlugs()` / `getHelpArticlesByCategory()` legacy.
 */
export async function listHelpArticlesByCategory(
  categorySlug: string,
): Promise<readonly HelpArticleView[]> {
  const all = await listHelpArticles();
  return all.filter((a) => slugify(a.category) === categorySlug);
}

/**
 * Liste les slugs de catégories distincts (utilisé par `generateStaticParams`
 * de `/centre-aide/categorie/[slug]/page.tsx`).
 */
export async function listHelpCategorySlugs(): Promise<readonly string[]> {
  const all = await listHelpArticles();
  return Array.from(new Set(all.map((a) => slugify(a.category))));
}

/**
 * Renvoie le label affichable d'une catégorie depuis son slug.
 * Sert au breadcrumb et au titre de page catégorie.
 */
export async function getHelpCategoryLabel(categorySlug: string): Promise<string | null> {
  const all = await listHelpArticles();
  const found = all.find((a) => slugify(a.category) === categorySlug);
  return found?.category ?? null;
}

/**
 * Liste les slugs d'articles publiés (utilisé par `generateStaticParams`
 * de `/centre-aide/[slug]/page.tsx`).
 */
export async function listHelpArticleSlugs(): Promise<readonly string[]> {
  const all = await listHelpArticles();
  return all.map((a) => a.slug);
}

// ============================================================
// Helpers internes
// ============================================================

/**
 * Mappe une ligne Prisma `HelpArticle` (avec `translations` + `category`) vers
 * la façade `HelpArticleView` consommée par les pages publiques.
 *
 * Politique :
 * - Slug canonique = slug de la traduction FR (priorité), fallback EN si FR absent.
 * - Category label = `nameFr` si dispo, sinon dérivé de la translation FR `title`
 *   (mais c'est non standard — la table `Category` existe et porte le label).
 * - Si une translation est manquante (ni FR ni EN), on rejette la ligne (null).
 *
 * IMPORTANT : la shape hardcode `HelpArticle` n'a pas d'`id`. On préserve
 * la signature publique pour éviter de casser les consumers (3 pages publiques).
 */
type PrismaHelpArticleRow = {
  status: string;
  category: { slug: string; nameFr: string; nameEn: string } | null;
  translations: Array<{
    locale: string;
    title: string;
    slug: string;
    excerpt: string | null;
    body: string;
    bodyText: string | null;
  }>;
};

function mapPrismaRowToView(row: PrismaHelpArticleRow): HelpArticleView | null {
  const fr = row.translations.find((t) => t.locale === "fr");
  const en = row.translations.find((t) => t.locale === "en");

  // Au moins une traduction est requise (FR prioritaire).
  const primary = fr ?? en;
  if (!primary) return null;

  // Slug canonique = slug FR si dispo (la prod est FR-only depuis 2026-05-16).
  const slug = (fr?.slug ?? en?.slug ?? "").trim();
  if (!slug) return null;

  // Category label : Prisma Category.nameFr si renseigné, sinon "Aide" (default
  // doux — l'admin doit assigner une catégorie pour un rendu propre).
  const categoryLabel = row.category?.nameFr ?? "Aide";

  // FR/EN content. Si EN absent en DB, on duplique le FR (politique 2026-05-16 :
  // EN redirige vers FR au runtime, donc le contenu EN n'est pas servi de toute
  // façon — mais on garde la shape complète pour quand EN sera ré-activé).
  const frBlock = {
    title: fr?.title ?? en?.title ?? "",
    excerpt: fr?.excerpt ?? en?.excerpt ?? "",
    body: fr?.body ?? en?.body ?? "",
  };
  const enBlock = {
    title: en?.title ?? fr?.title ?? "",
    excerpt: en?.excerpt ?? fr?.excerpt ?? "",
    body: en?.body ?? fr?.body ?? "",
  };

  return {
    slug,
    category: categoryLabel,
    fr: frBlock,
    en: enBlock,
  };
}
