/**
 * @vitest-environment node
 *
 * Baromètre : protection des petits segments. Un périmètre filtré de moins de
 * 5 réponses ne publie aucun pourcentage. `$queryRaw` est simulé.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn<(q: unknown) => Promise<unknown[]>>(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRawMock },
}));

// Mini `Prisma.sql` : assemble le texte SQL (les valeurs deviennent `?`).
vi.mock("../../../../prisma/generated/client", () => {
  class Sql {
    constructor(readonly sql: string) {}
  }
  const texte = (v: unknown): string => (v instanceof Sql ? v.sql : "?");
  return {
    Prisma: {
      Sql,
      empty: new Sql(""),
      raw: (t: string) => new Sql(t),
      join: (parts: Sql[], sep = ",") => new Sql(parts.map(texte).join(sep)),
      sql: (strings: TemplateStringsArray, ...vals: unknown[]) =>
        new Sql(
          strings.reduce((acc, s, i) => acc + s + (i < vals.length ? texte(vals[i]) : ""), ""),
        ),
    },
  };
});

import { aggregateBarometer } from "../snapshot";

function simulerEffectif(effectif: number): void {
  queryRawMock.mockImplementation(async (q) =>
    /COUNT\(\*\)::int AS count FROM barometer_responses/.test((q as { sql: string }).sql)
      ? [{ count: effectif }]
      : [],
  );
}

describe("aggregateBarometer — petits segments", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it.each([
    [4, 0],
    [5, 5],
  ])("vue filtrée de %i réponses : publiée avec %i (minimum 5)", async (effectif, attendu) => {
    simulerEffectif(effectif);
    const p = await aggregateBarometer({ companySize: "PME" });
    expect(p.totalResponses).toBe(attendu);
    expect(p.filter.companySize).toBe("PME");
    if (attendu === 0) expect(p.insights).toEqual({});
  });

  it("vue globale : l'affichage n'est pas modifié par la protection des segments", async () => {
    simulerEffectif(3);
    const p = await aggregateBarometer();
    expect(p.totalResponses).toBe(3);
  });
});
