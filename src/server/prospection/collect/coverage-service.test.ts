import { describe, it, expect } from "vitest";
import {
  aggregatePerDepartement,
  detectDrift,
  rebuildGeoCoverage,
  type CoverageDb,
} from "./coverage-service";

describe("aggregatePerDepartement", () => {
  it("somme les contactabilités en compteurs par département", () => {
    const map = aggregatePerDepartement({
      contactabilite: [
        { departement: "38", contactabilite: "exploitable", count: 20 },
        { departement: "38", contactabilite: "partiel", count: 10 },
        { departement: "38", contactabilite: "non_contactable", count: 50 },
        { departement: "69", contactabilite: "exploitable", count: 5 },
      ],
      enriched: [{ departement: "38", count: 40 }],
      stock: [
        { departement: "38", stockAttendu: 100 },
        { departement: "69", stockAttendu: 30 },
      ],
    });
    expect(map.get("38")).toMatchObject({
      collectees: 80,
      exploitables: 20,
      partiels: 10,
      nonContactables: 50,
      enrichies: 40,
      stockAttendu: 100,
    });
    expect(map.get("69")).toMatchObject({ collectees: 5, exploitables: 5, stockAttendu: 30 });
  });
});

describe("detectDrift", () => {
  it("détecte un écart dénormalisé vs COUNT", () => {
    expect(detectDrift(100, 100)).toEqual({ drift: 0, hasDrift: false });
    expect(detectDrift(100, 95)).toEqual({ drift: 5, hasDrift: true });
  });
});

describe("rebuildGeoCoverage (fake db) — recalcul depuis COUNT (anti-dérive)", () => {
  it("écrit les GeoCoverageStat dép/région/France cohérents", async () => {
    const upserts: Array<{
      scope: string;
      scopeId: string;
      collectees: number;
      stockAttendu: number;
    }> = [];
    const db = {
      prospectionCompany: {
        async groupBy(args: { by: string[] }) {
          if (args.by.includes("contactabilite")) {
            return [
              { departement: "38", contactabilite: "exploitable", _count: { _all: 20 } },
              { departement: "38", contactabilite: "partiel", _count: { _all: 60 } },
              { departement: "75", contactabilite: "exploitable", _count: { _all: 100 } },
            ];
          }
          // groupBy enrichmentStatus=enriched par département
          return [
            { departement: "38", _count: { _all: 30 } },
            { departement: "75", _count: { _all: 40 } },
          ];
        },
        async count() {
          return 0;
        },
      },
      prospectionStockReference: {
        async groupBy() {
          return [
            { departement: "38", _sum: { stockAttendu: 100 } },
            { departement: "75", _sum: { stockAttendu: 120 } },
          ];
        },
      },
      prospectionGeoCoverageStat: {
        async upsert(a: {
          create: { scope: string; scopeId: string; collectees: number; stockAttendu: number };
        }) {
          upserts.push(a.create);
          return {};
        },
      },
      prospectionStatsSnapshot: {
        async upsert() {
          return {};
        },
      },
    } as unknown as CoverageDb;

    const stats = await rebuildGeoCoverage(db);
    const fr = stats.find((s) => s.scope === "france");
    expect(fr?.collectees).toBe(180); // 80 (38) + 100 (75)
    expect(fr?.stockAttendu).toBe(220);
    expect(fr?.enrichies).toBe(70); // 30 (38) + 40 (75) — enrichies bien câblé (D1)
    // dép 38 + dép 75 + région 84 + région 11 + France = 5 upserts
    expect(upserts).toHaveLength(5);
    expect(upserts.find((u) => u.scope === "france")?.collectees).toBe(180);
  });
});
