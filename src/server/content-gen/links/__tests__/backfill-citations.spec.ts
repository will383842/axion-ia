import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoistés (avant import du module testé) ──────────────────────────────
const { findManyMock, citationFindManyMock, detectMock, persistMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  citationFindManyMock: vi.fn(),
  detectMock: vi.fn(),
  persistMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    articleTranslation: { findMany: findManyMock, count: vi.fn() },
    contentCitation: { findMany: citationFindManyMock },
  },
}));
vi.mock("@/data/external-links/helpers", () => ({
  detectHallucinations: (html: string) => detectMock(html),
}));
vi.mock("@/server/content-gen/links/persist-citations", () => ({
  persistArticleCitations: (args: unknown) => persistMock(args),
}));

import { backfillCitations } from "../backfill-citations";

function row(id: string, articleId: string, slug: string) {
  return { id, articleId, slug, body: `<p>${slug}</p>`, article: { generatedByJobId: null } };
}

describe("backfillCitations", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    citationFindManyMock.mockReset();
    detectMock.mockReset();
    persistMock.mockReset();
    citationFindManyMock.mockResolvedValue([]); // aucun article déjà cité par défaut
    detectMock.mockReturnValue({ valid: ["l1"], hallucinated: [] });
    persistMock.mockResolvedValue({ persisted: 1 });
  });

  it("persiste et termine (nextCursor null) quand la page est plus petite que limit", async () => {
    findManyMock.mockResolvedValue([row("a", "art-a", "alpha"), row("b", "art-b", "beta")]);

    const res = await backfillCitations({ limit: 50 });

    expect(res.total).toBe(2);
    expect(res.updated).toBe(2);
    expect(res.totalCitations).toBe(2);
    expect(res.nextCursor).toBeNull();
    expect(persistMock).toHaveBeenCalledTimes(2);
  });

  it("renvoie le dernier id comme nextCursor quand la page est pleine", async () => {
    findManyMock.mockResolvedValue([row("a", "art-a", "alpha"), row("b", "art-b", "beta")]);

    const res = await backfillCitations({ limit: 2 });

    expect(res.nextCursor).toBe("b");
  });

  it("onlyMissing : saute les articles déjà cités (pas de persist pour eux)", async () => {
    findManyMock.mockResolvedValue([row("a", "art-a", "alpha"), row("b", "art-b", "beta")]);
    citationFindManyMock.mockResolvedValue([{ articleId: "art-a" }]); // art-a déjà cité

    const res = await backfillCitations({ limit: 50, onlyMissing: true });

    expect(res.skipped).toBe(1);
    expect(res.updated).toBe(1);
    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(res.items.find((i) => i.slug === "alpha")?.action).toBe("already");
  });

  it("dry-run : ne persiste rien et remonte les hallucinations", async () => {
    findManyMock.mockResolvedValue([row("a", "art-a", "alpha")]);
    detectMock.mockReturnValue({
      valid: ["l1", "l2"],
      hallucinated: ["https://hors-catalogue.test"],
    });

    const res = await backfillCitations({ limit: 50, dryRun: true });

    expect(persistMock).not.toHaveBeenCalled();
    expect(res.updated).toBe(1);
    expect(res.totalCitations).toBe(2);
    expect(res.hallucinatedUrls).toEqual(["https://hors-catalogue.test"]);
  });

  it("saute les articles sans lien éligible (valid vide)", async () => {
    findManyMock.mockResolvedValue([row("a", "art-a", "alpha")]);
    detectMock.mockReturnValue({ valid: [], hallucinated: [] });

    const res = await backfillCitations({ limit: 50 });

    expect(res.updated).toBe(0);
    expect(res.skipped).toBe(1);
    expect(persistMock).not.toHaveBeenCalled();
    expect(res.items[0]?.action).toBe("skip");
  });
});
