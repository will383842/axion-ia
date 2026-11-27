import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  brut: null as unknown,
  sql: [] as string[],
  update: vi.fn(async (_a: unknown) => ({})),
  oppo: vi.fn(async (_a: unknown) => null as unknown),
  supp: vi.fn(async (_a: unknown) => null as unknown),
  contact: vi.fn(async (_a: unknown) => null as unknown),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    $queryRaw: async (...a: unknown[]) => {
      m.sql.push((a[0] as string[]).join("?"));
      return [{ raw: m.brut }];
    },
    contentGenJob: { update: (a: unknown) => m.update(a) },
  };
  return {
    prisma: {
      $transaction: async (f: (t: typeof tx) => Promise<unknown>) => f(tx),
      emailOpposition: { findUnique: (a: unknown) => m.oppo(a) },
      prospectionSuppressionEntry: { findFirst: (a: unknown) => m.supp(a) },
      prospectionContact: { findFirst: (a: unknown) => m.contact(a) },
    },
  };
});

import { estOppose, modifierOccasions } from "./charge-de-liens-donnees";

describe("données du chargé de liens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.brut = null;
  });

  it("l'écriture fusionne et garde les autres clés du JSON", async () => {
    m.brut = { title: "T", judgeIssues: [1] };
    const entree = { version: 1 as const, occasions: [], coutUsd: 0.1 };
    await modifierOccasions("j", () => entree);
    const data = (m.update.mock.calls[0]![0] as { data: { outputJsonRaw: unknown } }).data;
    expect(data.outputJsonRaw).toEqual({ title: "T", judgeIssues: [1], chargeLiens: entree });
  });

  it.each([null, [1, 2], "texte", 3])("JSON de départ %j : repart d'un objet vide", async (b) => {
    m.brut = b;
    await modifierOccasions("j", () => ({ version: 1, occasions: [], coutUsd: 0 }));
    const data = (m.update.mock.calls[0]![0] as { data: { outputJsonRaw: object } }).data;
    expect(Object.keys(data.outputJsonRaw)).toEqual(["chargeLiens"]);
  });

  it("le SQL brut lit la vraie colonne et verrouille la ligne", async () => {
    await modifierOccasions("j", () => ({ version: 1, occasions: [], coutUsd: 0 }));
    expect(m.sql[0]).toContain('"outputJsonRaw"');
    expect(m.sql[0]).toContain("FOR UPDATE");
  });

  it("si la modification lève, rien n'est écrit", async () => {
    await expect(
      modifierOccasions("j", () => {
        throw new Error("refus");
      }),
    ).rejects.toThrow("refus");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("opposition : les trois sources sont lues", async () => {
    expect(await estOppose("a@example.fr")).toBe(false);
    m.supp.mockResolvedValueOnce({ id: 1 });
    expect(await estOppose("a@example.fr")).toBe(true);
    m.contact.mockResolvedValueOnce({ id: 1 });
    expect(await estOppose("b@example.fr")).toBe(true);
    m.oppo.mockResolvedValueOnce({ id: 1 });
    expect(await estOppose("c@example.fr")).toBe(true);
  });
});
