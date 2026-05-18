// Sprint S+3 EXECUTION 2026-05-18 P0-5 — Tests reader unifié Centre d'aide.
//
// Couvre l'audit `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/23-TYPE-12-CENTRE-AIDE.md` §3
// (gap silencieux admin DB ≠ public hardcode) :
//   - flag OFF → hardcode (comportement actuel prod, no surprise)
//   - flag ON + DB rows → DB (bascule activée)
//   - flag ON + DB vide → fallback hardcode (premier déploiement avant migration)
//   - flag ON + DB error → fallback hardcode (anti-écran-blanc, fail-soft)
//   - getHelpArticleBySlug (FR + EN + miss)
//   - listHelpArticlesByCategory (slug calculé via slugify)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { findManyMock, findFirstMock } = vi.hoisted(() => {
  return {
    findManyMock:
      vi.fn<(args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>>(),
    findFirstMock:
      vi.fn<(args: Record<string, unknown>) => Promise<Record<string, unknown> | null>>(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpArticle: {
      findMany: findManyMock,
    },
    helpArticleTranslation: {
      findFirst: findFirstMock,
    },
  },
}));

import {
  listHelpArticles,
  getHelpArticleBySlug,
  listHelpArticlesByCategory,
  listHelpCategorySlugs,
  getHelpCategoryLabel,
  listHelpArticleSlugs,
} from "../reader";
import { HELP_ARTICLES, slugify } from "@/content/transversal";

// Helper : fabrique une ligne Prisma réaliste
function makeDbRow(opts: {
  status?: string;
  frSlug: string;
  frTitle: string;
  categoryNameFr?: string;
  enSlug?: string;
  enTitle?: string;
}): Record<string, unknown> {
  return {
    status: opts.status ?? "published",
    category: opts.categoryNameFr
      ? { slug: slugify(opts.categoryNameFr), nameFr: opts.categoryNameFr, nameEn: "Help" }
      : null,
    translations: [
      {
        locale: "fr",
        title: opts.frTitle,
        slug: opts.frSlug,
        excerpt: "Excerpt FR",
        body: "Body FR détaillé.",
        bodyText: "Body FR détaillé.",
      },
      {
        locale: "en",
        title: opts.enTitle ?? opts.frTitle,
        slug: opts.enSlug ?? opts.frSlug,
        excerpt: "Excerpt EN",
        body: "Body EN detailed.",
        bodyText: "Body EN detailed.",
      },
    ],
  };
}

describe("help-articles reader — P0-5 unification admin DB / public hardcode", () => {
  const originalEnv = process.env.HELP_BACKEND_UNIFIED;

  beforeEach(() => {
    findManyMock.mockReset();
    findFirstMock.mockReset();
    delete process.env.HELP_BACKEND_UNIFIED;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.HELP_BACKEND_UNIFIED;
    } else {
      process.env.HELP_BACKEND_UNIFIED = originalEnv;
    }
  });

  // ============================================================
  // listHelpArticles
  // ============================================================

  describe("listHelpArticles", () => {
    it("flag OFF (default) → retourne hardcode HELP_ARTICLES sans toucher DB", async () => {
      const result = await listHelpArticles();
      expect(result).toBe(HELP_ARTICLES);
      expect(findManyMock).not.toHaveBeenCalled();
    });

    it("flag ON + DB rows → mappe vers façade HelpArticleView", async () => {
      process.env.HELP_BACKEND_UNIFIED = "true";
      findManyMock.mockResolvedValue([
        makeDbRow({
          frSlug: "article-db-1",
          frTitle: "Article DB 1",
          categoryNameFr: "Catégorie DB",
        }),
        makeDbRow({
          frSlug: "article-db-2",
          frTitle: "Article DB 2",
          categoryNameFr: "Catégorie DB",
        }),
      ]);

      const result = await listHelpArticles();
      expect(findManyMock).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]!.slug).toBe("article-db-1");
      expect(result[0]!.fr.title).toBe("Article DB 1");
      expect(result[0]!.category).toBe("Catégorie DB");
      expect(result[1]!.slug).toBe("article-db-2");
    });

    it("flag ON + DB vide → fallback hardcode (premier déploiement avant migration)", async () => {
      process.env.HELP_BACKEND_UNIFIED = "1";
      findManyMock.mockResolvedValue([]);

      const result = await listHelpArticles();
      expect(findManyMock).toHaveBeenCalledTimes(1);
      expect(result).toBe(HELP_ARTICLES);
    });

    it("flag ON + DB error → fallback hardcode (fail-soft, anti-écran-blanc)", async () => {
      process.env.HELP_BACKEND_UNIFIED = "true";
      findManyMock.mockRejectedValue(new Error("DB connection lost"));

      const result = await listHelpArticles();
      expect(findManyMock).toHaveBeenCalledTimes(1);
      expect(result).toBe(HELP_ARTICLES);
    });

    it("flag ON + ligne sans aucune translation → ignore + fallback hardcode si tout est rejeté", async () => {
      process.env.HELP_BACKEND_UNIFIED = "true";
      findManyMock.mockResolvedValue([
        {
          status: "published",
          category: null,
          translations: [], // aucune translation
        },
      ]);

      const result = await listHelpArticles();
      // 0 ligne mappable → fallback hardcode
      expect(result).toBe(HELP_ARTICLES);
    });

    it("flag accepte uniquement '1' ou 'true' (insensible aux autres valeurs)", async () => {
      process.env.HELP_BACKEND_UNIFIED = "yes"; // non reconnu
      const result = await listHelpArticles();
      expect(result).toBe(HELP_ARTICLES);
      expect(findManyMock).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // getHelpArticleBySlug
  // ============================================================

  describe("getHelpArticleBySlug", () => {
    it("flag OFF → lookup dans HELP_ARTICLES hardcode (FR)", async () => {
      const first = HELP_ARTICLES[0]!;
      const result = await getHelpArticleBySlug(first.slug, "fr");
      expect(result).toEqual(first);
      expect(findFirstMock).not.toHaveBeenCalled();
    });

    it("flag OFF + slug inconnu → null", async () => {
      const result = await getHelpArticleBySlug("slug-inexistant-xyz", "fr");
      expect(result).toBeNull();
    });

    it("flag ON + DB hit publié → renvoie la ligne DB mappée", async () => {
      process.env.HELP_BACKEND_UNIFIED = "true";
      findFirstMock.mockResolvedValue({
        slug: "article-db-fr",
        locale: "fr",
        helpArticle: makeDbRow({
          frSlug: "article-db-fr",
          frTitle: "Article DB FR",
          categoryNameFr: "Cat DB",
        }),
      });

      const result = await getHelpArticleBySlug("article-db-fr", "fr");
      expect(findFirstMock).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result!.slug).toBe("article-db-fr");
      expect(result!.fr.title).toBe("Article DB FR");
      expect(result!.category).toBe("Cat DB");
    });

    it("flag ON + DB miss → fallback hardcode lookup", async () => {
      process.env.HELP_BACKEND_UNIFIED = "true";
      findFirstMock.mockResolvedValue(null);

      const hardcoded = HELP_ARTICLES[0]!;
      const result = await getHelpArticleBySlug(hardcoded.slug, "fr");
      expect(result).toEqual(hardcoded);
    });

    it("flag ON + ligne DB en status draft → fallback hardcode (pas de leak draft)", async () => {
      process.env.HELP_BACKEND_UNIFIED = "true";
      findFirstMock.mockResolvedValue({
        slug: "draft-slug",
        locale: "fr",
        helpArticle: makeDbRow({
          status: "draft",
          frSlug: "draft-slug",
          frTitle: "Brouillon",
        }),
      });

      const hardcoded = HELP_ARTICLES[0]!;
      const result = await getHelpArticleBySlug(hardcoded.slug, "fr");
      // Draft refusé → fallback sur hardcode (qui contient ce slug)
      expect(result).toEqual(hardcoded);
    });

    it("flag ON + DB error → fallback hardcode (fail-soft)", async () => {
      process.env.HELP_BACKEND_UNIFIED = "true";
      findFirstMock.mockRejectedValue(new Error("DB down"));

      const hardcoded = HELP_ARTICLES[0]!;
      const result = await getHelpArticleBySlug(hardcoded.slug, "fr");
      expect(result).toEqual(hardcoded);
    });
  });

  // ============================================================
  // listHelpArticlesByCategory
  // ============================================================

  describe("listHelpArticlesByCategory", () => {
    it("flag OFF → filtre HELP_ARTICLES par slug(category) hardcode", async () => {
      const first = HELP_ARTICLES[0]!;
      const catSlug = slugify(first.category);
      const result = await listHelpArticlesByCategory(catSlug);
      expect(result.length).toBeGreaterThan(0);
      for (const a of result) {
        expect(slugify(a.category)).toBe(catSlug);
      }
    });

    it("flag OFF + catégorie inconnue → tableau vide", async () => {
      const result = await listHelpArticlesByCategory("categorie-inexistante");
      expect(result).toEqual([]);
    });

    it("flag ON + DB rows → filtre via slug(nameFr) cohérent avec hardcode", async () => {
      process.env.HELP_BACKEND_UNIFIED = "true";
      findManyMock.mockResolvedValue([
        makeDbRow({
          frSlug: "art-a",
          frTitle: "Article A",
          categoryNameFr: "Démarrer rapidement",
        }),
        makeDbRow({
          frSlug: "art-b",
          frTitle: "Article B",
          categoryNameFr: "Souveraineté",
        }),
      ]);

      const result = await listHelpArticlesByCategory(slugify("Démarrer rapidement"));
      expect(result).toHaveLength(1);
      expect(result[0]!.slug).toBe("art-a");
    });
  });

  // ============================================================
  // listHelpCategorySlugs + getHelpCategoryLabel + listHelpArticleSlugs
  // ============================================================

  describe("listHelpCategorySlugs", () => {
    it("flag OFF → dédoublonne les catégories hardcode", async () => {
      const slugs = await listHelpCategorySlugs();
      const expected = new Set(HELP_ARTICLES.map((a) => slugify(a.category)));
      expect(new Set(slugs)).toEqual(expected);
    });
  });

  describe("getHelpCategoryLabel", () => {
    it("flag OFF → retourne le label brut depuis hardcode", async () => {
      const first = HELP_ARTICLES[0]!;
      const label = await getHelpCategoryLabel(slugify(first.category));
      expect(label).toBe(first.category);
    });

    it("flag OFF + slug inconnu → null", async () => {
      const label = await getHelpCategoryLabel("categorie-fake");
      expect(label).toBeNull();
    });
  });

  describe("listHelpArticleSlugs", () => {
    it("flag OFF → renvoie tous les slugs hardcode", async () => {
      const slugs = await listHelpArticleSlugs();
      expect(slugs).toEqual(HELP_ARTICLES.map((a) => a.slug));
    });
  });
});
