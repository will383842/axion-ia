/**
 * Sprint v7 Phase 2 commit 2 — Tests CoverageMapV2.
 *
 * 5 cases :
 *   1. Render 4 KPI nationaux + cells dept + table villes
 *   2. Filtre tier réduit table villes
 *   3. Filtre pipeline=editorial exclut villes editorial=0
 *   4. Click DeptCell toggle filter (et displays % correctement)
 *   5. Filtre statut=complete ne montre que status='complete'
 *
 * Mocks : react-virtual stub (rend tout sans virtualization).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 48,
        size: 48,
        end: (index + 1) * 48,
        lane: 0,
      })),
    getTotalSize: () => count * 48,
  }),
}));

import { CoverageMapV2 } from "@/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage-map/_v2/CoverageMapV2";
import type { CoverageMapData } from "@/server/actions/content-gen/coverage-map";

const INITIAL_DATA: CoverageMapData = {
  nationalStats: {
    totalCities: 5,
    coveredCities: 3,
    coveragePct: 60,
    citiesAbove50: 2,
    complete: 1,
  },
  byDept: [
    {
      deptCode: "75",
      regionSlug: "ile-de-france",
      totalCities: 1,
      coveredCities: 1,
      coveragePct: 85,
      etaDays: null,
    },
    {
      deptCode: "13",
      regionSlug: "provence-alpes-cote-d-azur",
      totalCities: 1,
      coveredCities: 1,
      coveragePct: 55,
      etaDays: null,
    },
    {
      deptCode: "47",
      regionSlug: "nouvelle-aquitaine",
      totalCities: 3,
      coveredCities: 0,
      coveragePct: 8,
      etaDays: null,
    },
  ],
  byCity: [
    {
      rank: 1,
      villeSlug: "paris",
      pop: 2_165_000,
      regionSlug: "ile-de-france",
      deptCode: "75",
      tier: "T1",
      pinned: false,
      editorialCount: 47,
      landingCount: 5,
      rssCount: 14,
      coveragePct: 85,
      status: "complete",
    },
    {
      rank: 2,
      villeSlug: "marseille",
      pop: 870_000,
      regionSlug: "provence-alpes-cote-d-azur",
      deptCode: "13",
      tier: "T1",
      pinned: false,
      editorialCount: 30,
      landingCount: 3,
      rssCount: 8,
      coveragePct: 55,
      status: "in_progress",
    },
    {
      rank: 3,
      villeSlug: "agen",
      pop: 32_000,
      regionSlug: "nouvelle-aquitaine",
      deptCode: "47",
      tier: "T3",
      pinned: false,
      editorialCount: 2,
      landingCount: 0,
      rssCount: 0,
      coveragePct: 12,
      status: "in_progress",
    },
    {
      rank: 4,
      villeSlug: "villeneuve-sur-lot",
      pop: 23_000,
      regionSlug: "nouvelle-aquitaine",
      deptCode: "47",
      tier: "T3",
      pinned: false,
      editorialCount: 0,
      landingCount: 0,
      rssCount: 0,
      coveragePct: 0,
      status: "idle",
    },
    {
      rank: 5,
      villeSlug: "marmande",
      pop: 17_000,
      regionSlug: "nouvelle-aquitaine",
      deptCode: "47",
      tier: "T4",
      pinned: false,
      editorialCount: 0,
      landingCount: 0,
      rssCount: 0,
      coveragePct: 0,
      status: "idle",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CoverageMapV2 — Sprint v7 Phase 2 commit 2", () => {
  it("1 — rend 4 KPI nationaux + cells dept + villes", () => {
    render(<CoverageMapV2 adminPrefix="admin" initialData={INITIAL_DATA} />);

    // 4 KPI labels (uniques)
    expect(screen.getByText("Villes")).toBeTruthy();
    expect(screen.getByText("% couverture")).toBeTruthy();
    expect(screen.getByText("Villes ≥ 50%")).toBeTruthy();
    expect(screen.getByText("Complètes")).toBeTruthy();
    // KPI value coverage % unique
    expect(screen.getByText("60%")).toBeTruthy();

    // Cells dept (3 depts dans byDept)
    expect(screen.getByLabelText("Département 75 couverture 85%")).toBeTruthy();
    expect(screen.getByLabelText("Département 13 couverture 55%")).toBeTruthy();
    expect(screen.getByLabelText("Département 47 couverture 8%")).toBeTruthy();

    // Villes (5)
    expect(screen.getByText("paris")).toBeTruthy();
    expect(screen.getByText("marseille")).toBeTruthy();
    expect(screen.getByText("agen")).toBeTruthy();
  });

  it("2 — filtre tier=T3 ne montre que villes T3", async () => {
    const user = userEvent.setup();
    render(<CoverageMapV2 adminPrefix="admin" initialData={INITIAL_DATA} />);

    await user.selectOptions(screen.getByLabelText("Filtre tier"), "T3");

    // Reste : agen (T3) + villeneuve-sur-lot (T3)
    expect(screen.getByText("agen")).toBeTruthy();
    expect(screen.getByText("villeneuve-sur-lot")).toBeTruthy();
    // Disparaissent T1, T4
    expect(screen.queryByText("paris")).toBeNull();
    expect(screen.queryByText("marseille")).toBeNull();
    expect(screen.queryByText("marmande")).toBeNull();
  });

  it("3 — filtre pipeline=editorial exclut villes editorial=0", async () => {
    const user = userEvent.setup();
    render(<CoverageMapV2 adminPrefix="admin" initialData={INITIAL_DATA} />);

    await user.selectOptions(screen.getByLabelText("Filtre pipeline"), "editorial");

    // Reste : paris (47) + marseille (30) + agen (2)
    expect(screen.getByText("paris")).toBeTruthy();
    expect(screen.getByText("marseille")).toBeTruthy();
    expect(screen.getByText("agen")).toBeTruthy();
    // Disparaissent : villeneuve-sur-lot + marmande (editorial=0)
    expect(screen.queryByText("villeneuve-sur-lot")).toBeNull();
    expect(screen.queryByText("marmande")).toBeNull();
  });

  it("4 — click DeptCell active filter département (aria-pressed)", async () => {
    const user = userEvent.setup();
    render(<CoverageMapV2 adminPrefix="admin" initialData={INITIAL_DATA} />);

    const deptCell75 = screen.getByLabelText("Département 75 couverture 85%");
    expect(deptCell75.getAttribute("aria-pressed")).toBe("false");

    await user.click(deptCell75);

    expect(deptCell75.getAttribute("aria-pressed")).toBe("true");
    // Avec filtre dept=75, seul paris reste
    expect(screen.getByText("paris")).toBeTruthy();
    expect(screen.queryByText("marseille")).toBeNull();
    expect(screen.queryByText("agen")).toBeNull();
  });

  it("5 — filtre statut=complete ne montre que villes status='complete'", async () => {
    const user = userEvent.setup();
    render(<CoverageMapV2 adminPrefix="admin" initialData={INITIAL_DATA} />);

    await user.selectOptions(screen.getByLabelText("Filtre statut"), "complete");

    // Seule paris est complete
    expect(screen.getByText("paris")).toBeTruthy();
    expect(screen.queryByText("marseille")).toBeNull();
    expect(screen.queryByText("agen")).toBeNull();
  });
});
