/**
 * @vitest-environment node
 *
 * Baromètre (lot L3, audit du 24/10/2026) : aucune réponse de test (`seed:%`)
 * dans un pourcentage, et aucun pourcentage sous SEUIL_REPONSES_REELLES vraies
 * réponses. On ne lance pas de base : `$queryRaw` est simulé et on lit le SQL.
 * Environnement node : sous jsdom, le client Prisma chargé est la version
 * navigateur, dont `Prisma.sql` ne fonctionne pas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn<(q: unknown) => Promise<unknown[]>>(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRawMock },
}));

import { SEUIL_REPONSES_REELLES } from "@/content/observatoire/study";
import { aggregateAllSegments, aggregateBarometer } from "../snapshot";

function sqlDe(q: unknown): string {
  return (q as { sql: string }).sql;
}

function estUnCompte(q: unknown): boolean {
  return /COUNT\(\*\)::int AS count FROM barometer_responses/.test(sqlDe(q));
}

/** Simule la base : `reelles` = effectif de vraies réponses, le reste vide. */
function simulerBase(reelles: number): void {
  queryRawMock.mockImplementation(async (q) => (estUnCompte(q) ? [{ count: reelles }] : []));
}

describe("aggregateBarometer — seuil et exclusion du seed", () => {
  beforeEach(() => queryRawMock.mockReset());

  it("le seuil est de 100 vraies réponses", () => {
    expect(SEUIL_REPONSES_REELLES).toBe(100);
  });

  it("sous le seuil : payload vide, aucun pourcentage, une seule requête", async () => {
    simulerBase(SEUIL_REPONSES_REELLES - 1);
    const p = await aggregateBarometer();
    expect(p.totalResponses).toBe(0);
    expect(p.insights).toEqual({});
    expect(p.distributions).toEqual({});
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("au seuil : agrège, et CHAQUE requête exclut les lignes seed", async () => {
    simulerBase(SEUIL_REPONSES_REELLES);
    const p = await aggregateBarometer();
    expect(p.totalResponses).toBe(SEUIL_REPONSES_REELLES);
    expect(Object.keys(p.insights)).toContain("competitors_use_ai");
    expect(queryRawMock.mock.calls.length).toBeGreaterThan(10);
    for (const [q] of queryRawMock.mock.calls) {
      expect(sqlDe(q)).toContain("NOT LIKE 'seed:%'");
      // un visitor_id nul est une vraie réponse (même sémantique que countRealResponses)
      expect(sqlDe(q)).toContain("visitor_id IS NULL");
    }
  });

  it("vue filtrée : le seuil porte sur l'effectif réel GLOBAL, pas sur le filtre", async () => {
    // Le filtre ne compte que 8 lignes, mais 500 réponses réelles existent au global.
    queryRawMock.mockImplementation(async (q) => {
      if (!estUnCompte(q)) return [];
      return sqlDe(q).includes("company_size") ? [{ count: 8 }] : [{ count: 500 }];
    });
    const p = await aggregateBarometer({ companySize: "PME" });
    expect(p.totalResponses).toBe(8);
    expect(p.filter.companySize).toBe("PME");
  });

  it("vue filtrée sous le seuil global : payload vide, filtre conservé", async () => {
    queryRawMock.mockImplementation(async (q) => {
      if (!estUnCompte(q)) return [];
      return sqlDe(q).includes("company_size") ? [{ count: 40 }] : [{ count: 60 }];
    });
    const p = await aggregateBarometer({ companySize: "PME" });
    expect(p.totalResponses).toBe(0);
    expect(p.insights).toEqual({});
    expect(p.filter.companySize).toBe("PME");
  });
});

describe("aggregateAllSegments — seuil et exclusion du seed", () => {
  beforeEach(() => queryRawMock.mockReset());

  it("sous le seuil : aucun segment, aucune requête de segment", async () => {
    simulerBase(SEUIL_REPONSES_REELLES - 1);
    expect(await aggregateAllSegments()).toEqual({});
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("au seuil : chaque requête de segment exclut les lignes seed", async () => {
    simulerBase(SEUIL_REPONSES_REELLES);
    const segments = await aggregateAllSegments();
    expect(Object.keys(segments).sort()).toEqual(["companySize", "region", "sector"]);
    const requetesSegment = queryRawMock.mock.calls.filter(([q]) => !estUnCompte(q));
    expect(requetesSegment).toHaveLength(3);
    for (const [q] of requetesSegment) {
      expect(sqlDe(q)).toContain("NOT LIKE 'seed:%'");
    }
  });
});
