/**
 * @vitest-environment node
 *
 * Les valeurs ajoutées par le Score (sector = autre, region = outre-mer / non-precisee,
 * barriers = none) entrent dans `barometer_responses` : snapshot « latest », exports CSV
 * et JSON de l'Observatoire ne doivent ni casser ni les perdre.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { queryRawMock, latestMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn<(q: unknown) => Promise<unknown[]>>(),
  latestMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRawMock, barometerSnapshot: { upsert: vi.fn() } },
}));
vi.mock("../score-snapshot", () => ({ calculerSnapshotScore: vi.fn() }));

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
        new Sql(strings.reduce((a, s, i) => a + s + (i < vals.length ? texte(vals[i]) : ""), "")),
    },
  };
});

import { aggregateBarometer } from "../snapshot";
import { SECTOR_SLUGS, REGION_SLUGS } from "@/content/observatoire/questions";

function simuler() {
  queryRawMock.mockImplementation(async (q) => {
    const sql = (q as { sql: string }).sql;
    if (/COUNT\(\*\)::int AS count FROM barometer_responses/.test(sql)) return [{ count: 40 }];
    if (/GROUP BY sector/.test(sql))
      return [
        { value: "autre", count: 10 },
        { value: SECTOR_SLUGS[0]!, count: 30 },
      ];
    if (/GROUP BY region/.test(sql))
      return [
        { value: "non-precisee", count: 5 },
        { value: "outre-mer", count: 5 },
        { value: REGION_SLUGS[0]!, count: 30 },
      ];
    if (/jsonb_array_elements_text/.test(sql) && /barriers/.test(sql))
      return [
        { value: "none", count: 8 },
        { value: "budget", count: 20 },
      ];
    return [];
  });
}

describe("snapshot « latest » avec les nouveaux slugs", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    simuler();
  });

  it("ne casse pas et garde les valeurs inconnues de l'ordre canonique, en dernier", async () => {
    const p = await aggregateBarometer();
    const sect = p.distributions.sector!.map((d) => d.value);
    expect(sect).toEqual([SECTOR_SLUGS[0], "autre"]);
    const reg = p.distributions.region!.map((d) => d.value);
    expect(reg.slice(-2).sort()).toEqual(["non-precisee", "outre-mer"]);
    expect(p.distributions.barriers!.map((d) => d.value)).toEqual(["budget", "none"]);
  });
});

vi.mock("@/server/observatoire/snapshot", async (orig) => ({
  ...(await orig<typeof import("../snapshot")>()),
  readLatestSnapshot: latestMock,
  readSnapshotHistory: vi.fn(async () => []),
}));

describe("exports CSV et JSON avec les nouveaux slugs", () => {
  const payload = {
    totalResponses: 40,
    generatedAt: "2026-11-20T00:00:00.000Z",
    filter: { companySize: null, sector: null, region: null },
    distributions: {
      sector: [
        { value: SECTOR_SLUGS[0]!, count: 30, pct: 75 },
        { value: "autre", count: 10, pct: 25 },
      ],
      region: [
        { value: "outre-mer", count: 5, pct: 12 },
        { value: "non-precisee", count: 5, pct: 12 },
      ],
      barriers: [{ value: "none", count: 8, pct: 20 }],
    },
    insights: {},
  };

  beforeEach(() => latestMock.mockResolvedValue(payload));

  it("CSV : une ligne par slug, libellé de repli = le slug, sans exception", async () => {
    const { GET } = await import("@/app/api/observatoire/export-csv/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const csv = await res.text();
    for (const slug of ["autre", "outre-mer", "non-precisee", "none"]) {
      expect(csv).toContain(`,${slug},`);
    }
  });

  it("JSON : distributions restituées telles quelles", async () => {
    const { GET } = await import("@/app/api/observatoire/export-json/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.distributions.sector.map((d: { value: string }) => d.value)).toContain("autre");
    expect(body.distributions.region.map((d: { value: string }) => d.value)).toContain("outre-mer");
    expect(body.distributions.barriers[0].value).toBe("none");
  });
});
