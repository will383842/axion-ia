/**
 * La garde anti-doublon voit les news RSS — et ne se reconnaît pas elle-même.
 *
 * 2026-09-02 06:00 UTC : deux articles sur la même dépêche (« Claude Fable 5.1
 * … AWS ») publiés à la même minute par deux flux. La garde lisait
 * `inputPayload.title`, l'ingestion RSS écrit `rssTitle` : contrôle sauté
 * pour 100 % des news depuis toujours. Et un job en file ne comparait qu'aux
 * jobs déjà publiés : deux jobs créés ensemble ne se voyaient pas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenJob: {
      findMany: (args: unknown) => findManyMock(args),
    },
  },
}));

import { checkDedup, titleOfPayload } from "../dedup-guard";

beforeEach(() => {
  vi.clearAllMocks();
  findManyMock.mockResolvedValue([]);
});

describe("titleOfPayload — une seule lecture du titre, toutes provenances", () => {
  it("lit `title` quand il existe", () => {
    expect(titleOfPayload({ title: "Un titre" })).toBe("Un titre");
  });

  it("lit `rssTitle` — la charge utile écrite par l'ingestion RSS", () => {
    expect(titleOfPayload({ rssTitle: "Claude Fable 5.1 arrive sur AWS" })).toBe(
      "Claude Fable 5.1 arrive sur AWS",
    );
  });

  it("préfère `title` à `rssTitle`, ignore les vides et les non-objets", () => {
    expect(titleOfPayload({ title: "A", rssTitle: "B" })).toBe("A");
    expect(titleOfPayload({ title: "   ", rssTitle: "B" })).toBe("B");
    expect(titleOfPayload(null)).toBe("");
    expect(titleOfPayload("texte")).toBe("");
    expect(titleOfPayload({})).toBe("");
  });
});

describe("checkDedup — fenêtre de comparaison", () => {
  it("compare aussi aux jobs en file et en cours, et s'exclut lui-même", async () => {
    await checkDedup({ title: "Claude Fable 5.1 arrive sur AWS", excludeJobId: "moi" });
    const args = findManyMock.mock.calls[0]?.[0] as {
      where: { status: { in: string[] }; id?: { not: string } };
    };
    expect(args.where.status.in).toEqual(
      expect.arrayContaining(["queued", "running", "needs_review", "published"]),
    );
    expect(args.where.id).toEqual({ not: "moi" });
  });

  it("bloque un job RSS dont le voisin porte le même titre sous `rssTitle`", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "voisin",
        inputPayload: { rssTitle: "Claude Fable 5.1 : une nouvelle étape sur AWS" },
        anchorVilleSlug: null,
        targetAudienceSize: null,
        targetAudienceOrganisation: null,
      },
    ]);
    const result = await checkDedup({
      title: "Claude Fable 5.1 : une nouvelle étape sur AWS",
      excludeJobId: "moi",
    });
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("voisin");
  });

  it("sans excludeJobId, aucune clause `id` n'est ajoutée (compatibilité)", async () => {
    await checkDedup({ title: "x" });
    const args = findManyMock.mock.calls[0]?.[0] as { where: { id?: unknown } };
    expect(args.where.id).toBeUndefined();
  });
});
