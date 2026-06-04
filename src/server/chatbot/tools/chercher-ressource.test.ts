// T-13 — Tool chercher_ressource (article / cas client publié → titre+URL+extrait).

import { describe, it, expect, vi, beforeEach } from "vitest";

const articleFindFirst = vi.fn();
const caseFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    articleTranslation: { findFirst: (...a: unknown[]) => articleFindFirst(...a) },
    caseStudyTranslation: { findFirst: (...a: unknown[]) => caseFindFirst(...a) },
  },
}));

import {
  chercherRessource,
  ChercherRessourceInputSchema,
} from "@/server/chatbot/tools/chercher-ressource";

const ctx = { tenantId: "t1" };

beforeEach(() => {
  articleFindFirst.mockReset();
  caseFindFirst.mockReset();
});

describe("T-13 chercher_ressource", () => {
  it("refuse un type hors enum", () => {
    expect(() => ChercherRessourceInputSchema.parse({ sujet: "x", type: "video" })).toThrow();
  });

  it("article publié → titre + URL /fr/blog + extrait", async () => {
    articleFindFirst.mockResolvedValue({
      title: "Réussir son audit IA",
      slug: "reussir-audit-ia",
      excerpt: "Les étapes clés.",
    });
    const r = await chercherRessource({ sujet: "audit", type: "article" }, ctx);
    expect(r).toEqual({
      titre: "Réussir son audit IA",
      url: "/fr/blog/reussir-audit-ia",
      extrait: "Les étapes clés.",
      type: "article",
    });
    // Ne filtre que le FR publié.
    const where = articleFindFirst.mock.calls[0]![0].where;
    expect(where.locale).toBe("fr");
    expect(where.article.status).toBe("published");
  });

  it("cas client publié → titre + URL /fr/cas-concrets, extrait null", async () => {
    caseFindFirst.mockResolvedValue({ title: "PME industrielle", slug: "pme-industrielle" });
    const r = await chercherRessource({ sujet: "industrie", type: "cas_client" }, ctx);
    expect(r).toEqual({
      titre: "PME industrielle",
      url: "/fr/cas-concrets/pme-industrielle",
      extrait: null,
      type: "cas_client",
    });
  });

  it("aucune ressource pertinente → null (jamais de lien inventé)", async () => {
    articleFindFirst.mockResolvedValue(null);
    const r = await chercherRessource({ sujet: "introuvable", type: "article" }, ctx);
    expect(r).toBeNull();
  });
});
