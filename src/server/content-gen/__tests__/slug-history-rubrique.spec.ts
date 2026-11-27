// S1 (404) — un ancien slug redirige vers la rubrique ACTUELLE de l'article.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { articleSlugHistory: { findFirst } } }));

import { findArticleSlugRedirect } from "../slug-history";

const historique = (
  slug: string,
  isNews: boolean,
  status = "published",
  templateVariant: string | null = null,
) => ({
  article: { status, isNews, templateVariant, translations: [{ slug }] },
});

describe("findArticleSlugRedirect — rubrique actuelle", () => {
  beforeEach(() => findFirst.mockReset());

  it("article resté dans le blog", async () => {
    findFirst.mockResolvedValue(historique("nouveau", false));
    expect((await findArticleSlugRedirect("ancien", "fr"))?.section).toBe("blog");
  });
  it("article devenu actualité", async () => {
    findFirst.mockResolvedValue(historique("nouveau", true));
    expect((await findArticleSlugRedirect("ancien", "fr"))?.section).toBe("actualites");
  });
  it("article devenu guide (slug guide-)", async () => {
    findFirst.mockResolvedValue(historique("guide-x", false));
    expect((await findArticleSlugRedirect("ancien", "fr"))?.section).toBe("guides");
  });
  it("guide reconnu par son modèle, sans préfixe guide-", async () => {
    findFirst.mockResolvedValue(historique("nouveau", false, "published", "guide-pilier"));
    expect((await findArticleSlugRedirect("ancien", "fr"))?.section).toBe("guides");
  });
  it("actualité dont le slug commence par guide- : reste une actualité", async () => {
    findFirst.mockResolvedValue(historique("guide-x", true));
    expect((await findArticleSlugRedirect("ancien", "fr"))?.section).toBe("actualites");
  });
  it("article non publié ou inconnu : pas de redirection", async () => {
    findFirst.mockResolvedValue(historique("nouveau", false, "archived"));
    expect(await findArticleSlugRedirect("ancien", "fr")).toBeNull();
    findFirst.mockResolvedValue(null);
    expect(await findArticleSlugRedirect("ancien", "fr")).toBeNull();
  });
});
