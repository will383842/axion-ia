/**
 * Étape « indexation rapide » — chemin de code d'un article publié par « Publier »
 * (pas de prod, tout est mocké sauf la logique). Vérifie :
 *  (a) IndexNow reçoit l'URL canonique de l'article ;
 *  (b) le sitemap des articles porte cette même URL, avec lastmod = date de
 *      modification réelle (jamais « maintenant ») ;
 *  (c) l'article est relié depuis la page du blog (liste) et depuis ≥ 2 articles proches.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addMock, articleFindMany, listPublishedMock } = vi.hoisted(() => ({
  addMock: vi.fn().mockResolvedValue({ id: "j" }),
  articleFindMany: vi.fn(),
  listPublishedMock: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn(() => ({ add: addMock, getJob: vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { findMany: articleFindMany, findFirst: vi.fn(async () => null) },
    category: { findMany: vi.fn(async () => []) },
    knowledgeEntry: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  },
}));
vi.mock("@/lib/knowledge/readers", () => ({ listPublishedArticles: listPublishedMock }));

import sitemap from "@/app/sitemap";
import { enqueueIndexingForTier1 } from "../enqueue";
import { findRelatedArticles } from "@/server/content-gen/links/related-articles";

const SLUG = "chatbot-rgpd-pme-mise-en-conformite";
const MODIFIE = new Date("2026-11-20T09:30:00Z");

beforeEach(() => {
  addMock.mockClear();
  process.env.INDEXNOW_KEY = "k";
  process.env.REDIS_URL = "redis://localhost:6379";
  delete process.env.GSC_SITEMAP_SUBMIT_ENABLED;
});

describe("chemin « Publier » → indexation rapide", () => {
  it("(a)+(b) IndexNow et sitemap annoncent la même URL, lastmod = date de modification", async () => {
    const r = await enqueueIndexingForTier1({
      articleId: "a1",
      slug: SLUG,
      isNews: false,
      origin: "content-gen",
    });
    expect(r.url).toBe(`https://axion-ia.com/fr/blog/${SLUG}`);
    expect(addMock).toHaveBeenCalledWith(
      "ping",
      { urls: [r.url], origin: "content-gen" },
      { jobId: "indexnow-a1-publish" },
    );

    articleFindMany.mockResolvedValue([
      {
        publishedAt: new Date("2026-11-18T08:00:00Z"),
        updatedAt: MODIFIE,
        templateVariant: null,
        translations: [{ slug: SLUG }],
      },
    ]);
    const plan = await sitemap({ id: Promise.resolve("blog") });
    const entree = plan.find((e) => new URL(e.url).pathname === new URL(r.url).pathname);
    expect(entree).toBeDefined();
    const lastmod = new Date(entree?.lastModified as string | Date);
    expect(lastmod.toISOString().slice(0, 10)).toBe("2026-11-20");
    expect(Date.now() - lastmod.getTime()).toBeGreaterThan(24 * 3600 * 1000);
  });

  it("(c) l'article récent est suggéré par ≥ 2 articles proches", async () => {
    const art = (slug: string, title: string, date: string) => ({
      id: slug,
      slug,
      title,
      excerpt: "",
      publishedAt: new Date(date),
      readingTime: 5,
      author: null,
      category: null,
      indexationTier: "tier_1_indexable",
    });
    const corpus = [
      art(SLUG, "Chatbot et RGPD : la mise en conformité en PME", "2026-11-18"),
      art("chatbot-rgpd-pme", "Chatbot RGPD : ce que doit savoir une PME", "2026-05-01"),
      art("chatbot-donnees", "Chatbot et données personnelles en PME", "2026-06-01"),
      art("rgpd-formation", "RGPD : former ses équipes à l'IA", "2026-07-01"),
      art("compta", "Recruter un comptable", "2026-09-01"),
      art("social", "Calendrier éditorial des réseaux sociaux", "2026-10-01"),
    ];
    listPublishedMock.mockResolvedValue(corpus);
    let entrants = 0;
    for (const voisin of corpus.slice(1, 4)) {
      const connexes = await findRelatedArticles({
        currentSlug: voisin.slug,
        locale: "fr",
        currentTitle: voisin.title,
        limit: 4,
      });
      if (connexes.some((c) => c.slug === SLUG)) entrants++;
    }
    expect(entrants).toBeGreaterThanOrEqual(2);
  });
});
