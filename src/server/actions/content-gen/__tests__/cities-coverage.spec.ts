/**
 * Phase B Sprint Perfection 2026-05-22 — Tests cities-coverage server actions
 *
 * Tests :
 * 1. listCities : retourne villes paginées (page 1, 50 par page)
 * 2. listCities : filtre par dept code
 * 3. listCities : filtre par isCovered=true
 * 4. listCities : filtre par recherche (search)
 * 5. listCities : retourne totalPages correct
 * 6. getCitiesStats : calcule coveragePercent correct
 * 7. getCitiesStats : retourne stats par tier
 * 8. markCitiesPriority : appelle updateMany avec les bons slugs
 * 9. exportCitiesCSV : retourne un CSV avec header correct
 * 10. exportCitiesCSV : gère liste vide (header seulement)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
const countMock = vi.fn();
const groupByMock = vi.fn();
const updateManyMock = vi.fn();

// P0-7 — requireAdmin() ajouté aux 4 fonctions → mock @/auth pour les tests
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "user-admin-1", email: "admin@axion-ia.com", role: "admin" },
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    city: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
      groupBy: (...args: unknown[]) => groupByMock(...args),
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
  },
}));

import {
  listCities,
  getCitiesStats,
  markCitiesPriority,
  exportCitiesCSV,
} from "../cities-coverage";

const SAMPLE_CITY = {
  id: "c1",
  slug: "paris",
  name: "Paris",
  population: 2_161_000,
  departmentCode: "75",
  departmentName: "Paris",
  regionSlug: "ile-de-france",
  regionName: "Île-de-France",
  populationTier: 1,
  priority: 1,
  isCovered: true,
  articlesCount: 50,
  lastArticleAt: null,
  hasEconomicData: true,
};

beforeEach(() => {
  findManyMock.mockReset();
  countMock.mockReset();
  groupByMock.mockReset();
  updateManyMock.mockReset();
});

describe("listCities", () => {
  it("returns paginated cities (page 1, 50 per page)", async () => {
    findManyMock.mockResolvedValueOnce([SAMPLE_CITY]);
    countMock.mockResolvedValueOnce(100);

    const result = await listCities({ page: 1, pageSize: 50 });
    expect(result.cities).toHaveLength(1);
    expect(result.total).toBe(100);
    expect(result.totalPages).toBe(2);
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50 }));
  });

  it("filters by department code", async () => {
    findManyMock.mockResolvedValueOnce([SAMPLE_CITY]);
    countMock.mockResolvedValueOnce(20);

    await listCities({ deptCode: "75" });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ departmentCode: "75" }),
      }),
    );
  });

  it("filters by isCovered=true", async () => {
    findManyMock.mockResolvedValueOnce([SAMPLE_CITY]);
    countMock.mockResolvedValueOnce(39);

    await listCities({ isCovered: true });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isCovered: true }),
      }),
    );
  });

  it("filters by search term", async () => {
    findManyMock.mockResolvedValueOnce([SAMPLE_CITY]);
    countMock.mockResolvedValueOnce(1);

    await listCities({ search: "Paris" });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "Paris", mode: "insensitive" },
        }),
      }),
    );
  });

  it("calculates totalPages correctly", async () => {
    findManyMock.mockResolvedValueOnce([]);
    countMock.mockResolvedValueOnce(2100);

    const result = await listCities({ pageSize: 50 });
    expect(result.totalPages).toBe(42);
  });
});

describe("getCitiesStats", () => {
  it("calculates coveragePercent correctly", async () => {
    countMock
      .mockResolvedValueOnce(2100) // total
      .mockResolvedValueOnce(210); // covered

    groupByMock
      .mockResolvedValueOnce([
        { populationTier: 1, _count: { _all: 40 } },
        { populationTier: 2, _count: { _all: 460 } },
      ])
      .mockResolvedValueOnce([{ populationTier: 1, _count: { _all: 12 } }]);

    const stats = await getCitiesStats();
    expect(stats.total).toBe(2100);
    expect(stats.covered).toBe(210);
    expect(stats.coveragePercent).toBe(10);
    expect(stats.tier1Total).toBe(40);
    expect(stats.tier1Covered).toBe(12);
    expect(stats.tier2Total).toBe(460);
    expect(stats.tier2Covered).toBe(0);
  });

  it("returns zero coveragePercent when total is 0", async () => {
    countMock.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    groupByMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const stats = await getCitiesStats();
    expect(stats.coveragePercent).toBe(0);
  });
});

describe("markCitiesPriority", () => {
  it("calls updateMany with correct slugs", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 3 });

    const result = await markCitiesPriority(["paris", "lyon", "marseille"]);
    expect(result.updated).toBe(3);
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: { in: ["paris", "lyon", "marseille"] } }),
      }),
    );
  });
});

describe("exportCitiesCSV", () => {
  it("returns CSV with header row", async () => {
    findManyMock.mockResolvedValueOnce([SAMPLE_CITY]);

    const csv = await exportCitiesCSV({});
    expect(csv).toContain("slug,name,population");
    expect(csv).toContain("paris");
  });

  it("handles empty cities list (header only)", async () => {
    findManyMock.mockResolvedValueOnce([]);

    const csv = await exportCitiesCSV({});
    expect(csv.trim()).toBe(
      "slug,name,population,dept_code,dept_name,region,tier,priority,covered,articles",
    );
  });
});
