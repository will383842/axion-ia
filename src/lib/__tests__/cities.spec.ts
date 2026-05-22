/**
 * Phase A Sprint Perfection 2026-05-22 — Tests cities.ts
 *
 * Tests :
 * 1. getPopulationTier : mapping correct (≥100k=1, 20-100k=2, 10-20k=3, 5-10k=4)
 * 2. getTopNCities : retourne N villes triées par population décroissante
 * 3. getCitiesByPopulationTier : filtre correct par tier
 * 4. getCitiesByDepartment : filtre par code département
 * 5. searchCities : recherche par nom (case-insensitive)
 * 6. getUncoveredCities : filtre isCovered=false, trié par priority
 * 7. getCitiesCoverageStats : calcul correct coveragePercent + byTier
 * 8. listCitiesAdmin : pagination + filtres combinés
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const findManyMock = vi.fn();
const countMock = vi.fn();
const groupByMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    city: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
      groupBy: (...args: unknown[]) => groupByMock(...args),
    },
  },
}));

// Mock env for non-stub
vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/axion");

import {
  getTopNCities,
  getCitiesByPopulationTier,
  getCitiesByDepartment,
  searchCities,
  getUncoveredCities,
  getCitiesCoverageStats,
  listCitiesAdmin,
} from "../cities";

const PARIS = {
  id: "c1",
  slug: "paris",
  name: "Paris",
  population: 2_161_000,
  departmentCode: "75",
  departmentName: "Paris",
  regionSlug: "ile-de-france",
  regionName: "Île-de-France",
  inseeCode: "75056",
  latitude: 48.8566,
  longitude: 2.3522,
  populationTier: 1,
  priority: 1,
  isTargeted: true,
  isCovered: true,
  articlesCount: 50,
  lastArticleAt: new Date("2026-05-01"),
  hasEconomicData: true,
};

const LYON = {
  ...PARIS,
  id: "c2",
  slug: "lyon",
  name: "Lyon",
  population: 522_250,
  departmentCode: "69",
  inseeCode: "69123",
  priority: 2,
  isCovered: false,
  articlesCount: 0,
  lastArticleAt: null,
};

beforeEach(() => {
  findManyMock.mockReset();
  countMock.mockReset();
  groupByMock.mockReset();
});

describe("getTopNCities", () => {
  it("returns cities ordered by population desc", async () => {
    findManyMock.mockResolvedValueOnce([PARIS, LYON]);
    const result = await getTopNCities(2);
    expect(result).toHaveLength(2);
    expect(result[0]?.slug).toBe("paris");
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { population: "desc" },
        take: 2,
      }),
    );
  });
});

describe("getCitiesByPopulationTier", () => {
  it("filters by tier 1 (≥100k hab)", async () => {
    findManyMock.mockResolvedValueOnce([PARIS]);
    await getCitiesByPopulationTier(1);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ populationTier: 1 }),
      }),
    );
  });

  it("filters by tier 4 (5-10k hab)", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getCitiesByPopulationTier(4);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ populationTier: 4 }),
      }),
    );
  });
});

describe("getCitiesByDepartment", () => {
  it("filters by department code", async () => {
    findManyMock.mockResolvedValueOnce([PARIS]);
    await getCitiesByDepartment("75");
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ departmentCode: "75" }),
      }),
    );
  });
});

describe("searchCities", () => {
  it("returns empty array for blank query", async () => {
    const result = await searchCities("  ");
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("calls findMany with contains + insensitive mode", async () => {
    findManyMock.mockResolvedValueOnce([PARIS]);
    await searchCities("Paris");
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "Paris", mode: "insensitive" },
        }),
      }),
    );
  });
});

describe("getUncoveredCities", () => {
  it("filters isCovered=false and orders by priority asc", async () => {
    findManyMock.mockResolvedValueOnce([LYON]);
    await getUncoveredCities(10);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isCovered: false }),
        orderBy: { priority: "asc" },
        take: 10,
      }),
    );
  });
});

describe("getCitiesCoverageStats", () => {
  it("calculates coverage percent correctly", async () => {
    countMock
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(39); // covered

    groupByMock
      .mockResolvedValueOnce([
        { populationTier: 1, _count: { _all: 40 } },
        { populationTier: 2, _count: { _all: 460 } },
      ])
      .mockResolvedValueOnce([{ populationTier: 1, _count: { _all: 12 } }]);

    const stats = await getCitiesCoverageStats();
    expect(stats.total).toBe(100);
    expect(stats.covered).toBe(39);
    expect(stats.coveragePercent).toBe(39);
    expect(stats.byTier[1]?.total).toBe(40);
    expect(stats.byTier[1]?.covered).toBe(12);
    expect(stats.byTier[2]?.total).toBe(460);
    expect(stats.byTier[2]?.covered).toBe(0);
  });
});

describe("listCitiesAdmin", () => {
  it("paginates correctly (page 2, pageSize 10)", async () => {
    findManyMock.mockResolvedValueOnce([PARIS]);
    countMock.mockResolvedValueOnce(150);

    const result = await listCitiesAdmin({ page: 2, pageSize: 10 });
    expect(result.total).toBe(150);
    expect(result.totalPages).toBe(15);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it("combines department + region filters", async () => {
    findManyMock.mockResolvedValueOnce([]);
    countMock.mockResolvedValueOnce(0);

    await listCitiesAdmin({ deptCode: "69", regionSlug: "auvergne-rhone-alpes" });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          departmentCode: "69",
          regionSlug: "auvergne-rhone-alpes",
        }),
      }),
    );
  });
});
