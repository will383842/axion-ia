/**
 * Sprint v7 Phase 2 commit 1 — Tests CitiesOrderV3.
 *
 * 5 cases (brief Session 2) :
 *   1. Render initial rows visibles
 *   2. Filtre région applique correctement
 *   3. Search input filtre par slug (useDeferredValue debounce naturel)
 *   4. Pin click déclenche pinCity avec args attendus
 *   5. Stats + désépingler ville pinned
 *
 * Mocks : dnd-kit / react-virtual / sonner / server actions
 * (rendering jsdom n'a pas Pointer events ni ResizeObserver — on stub).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

// ─── Mocks externes ─────────────────────────────────────────────────────────

const reorderCitiesMock = vi.fn();
const pinCityMock = vi.fn();
vi.mock("@/server/actions/content-gen/cities-order", () => ({
  reorderCities: (input: unknown) => reorderCitiesMock(input),
  pinCity: (input: unknown) => pinCityMock(input),
}));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => toastSuccessMock(msg),
    error: (msg: string) => toastErrorMock(msg),
  },
}));

// Mock @tanstack/react-virtual : retourner tous les items sans virtualization
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 56,
        size: 56,
        end: (index + 1) * 56,
        lane: 0,
      })),
    getTotalSize: () => count * 56,
  }),
}));

// Mock @dnd-kit/sortable useSortable — retourner stub minimal sortable item
vi.mock("@dnd-kit/sortable", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/sortable")>("@dnd-kit/sortable");
  return {
    ...actual,
    useSortable: () => ({
      attributes: { "data-sortable": true },
      listeners: {},
      setNodeRef: () => undefined,
      transform: null,
      transition: null,
      isDragging: false,
    }),
  };
});

// ─── Import sous test (après mocks) ─────────────────────────────────────────

// Re-export du composant pour pouvoir le tester depuis __tests__ sans
// dépendre du path Next.js [adminPrefix] que vitest ne resolve pas bien.
import {
  CitiesOrderV3,
  type CitiesOrderRow,
} from "@/app/[locale]/(admin)/[adminPrefix]/content-gen/cities-order/_v3/CitiesOrderV3";

function makeRow(overrides: Partial<CitiesOrderRow>): CitiesOrderRow {
  return {
    villeSlug: "paris",
    rank: 1,
    pinned: false,
    pinnedAt: null,
    regionSlug: "ile-de-france",
    deptCode: "75",
    tier: "T1",
    pop: 2_165_000,
    createdAt: new Date("2026-05-23T00:00:00Z"),
    updatedAt: new Date("2026-05-23T00:00:00Z"),
    ...overrides,
  };
}

const INITIAL_ROWS: CitiesOrderRow[] = [
  makeRow({ villeSlug: "paris", rank: 1, tier: "T1", pop: 2_165_000, regionSlug: "ile-de-france" }),
  makeRow({
    villeSlug: "marseille",
    rank: 2,
    tier: "T1",
    pop: 870_000,
    regionSlug: "provence-alpes-cote-d-azur",
    deptCode: "13",
  }),
  makeRow({
    villeSlug: "lyon",
    rank: 3,
    tier: "T1",
    pop: 522_000,
    regionSlug: "auvergne-rhone-alpes",
    deptCode: "69",
  }),
  makeRow({
    villeSlug: "nice",
    rank: 4,
    tier: "T2",
    pop: 341_000,
    regionSlug: "provence-alpes-cote-d-azur",
    deptCode: "06",
  }),
  makeRow({
    villeSlug: "nantes",
    rank: 5,
    tier: "T2",
    pop: 320_000,
    regionSlug: "pays-de-la-loire",
    deptCode: "44",
    pinned: true,
    pinnedAt: new Date(),
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  reorderCitiesMock.mockResolvedValue(undefined);
  pinCityMock.mockResolvedValue(undefined);
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("CitiesOrderV3 — Sprint v7 Phase 2 commit 1", () => {
  it("1 — rend les villes initiales (rank + tier + pop format)", () => {
    render(
      <CitiesOrderV3
        adminPrefix="admin"
        initialRows={INITIAL_ROWS}
        initialTotal={INITIAL_ROWS.length}
      />,
    );

    expect(screen.getByText("paris")).toBeTruthy();
    expect(screen.getByText("marseille")).toBeTruthy();
    expect(screen.getByText("lyon")).toBeTruthy();
    expect(screen.getByText("nice")).toBeTruthy();
    expect(screen.getByText("nantes")).toBeTruthy();

    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("#5")).toBeTruthy();

    // Pop format
    expect(screen.getByText("2.2 M")).toBeTruthy();
    expect(screen.getByText("870 k")).toBeTruthy();
  });

  it("2 — filtre région ne montre que les villes de la région choisie", async () => {
    const user = userEvent.setup();
    render(
      <CitiesOrderV3
        adminPrefix="admin"
        initialRows={INITIAL_ROWS}
        initialTotal={INITIAL_ROWS.length}
      />,
    );

    const regionSelect = screen.getByLabelText("Filtre région");
    await user.selectOptions(regionSelect, "provence-alpes-cote-d-azur");

    expect(screen.getByText("marseille")).toBeTruthy();
    expect(screen.getByText("nice")).toBeTruthy();
    expect(screen.queryByText("paris")).toBeNull();
    expect(screen.queryByText("lyon")).toBeNull();
    expect(screen.queryByText("nantes")).toBeNull();
  });

  it("3 — search input filtre par sous-chaîne du slug", async () => {
    const user = userEvent.setup();
    render(
      <CitiesOrderV3
        adminPrefix="admin"
        initialRows={INITIAL_ROWS}
        initialTotal={INITIAL_ROWS.length}
      />,
    );

    const searchInput = screen.getByLabelText("Recherche slug ville");
    await user.type(searchInput, "ar");

    // 'par' contient 'ar' → paris ✓ ; 'marseille' contient 'ar' ✓
    expect(screen.getByText("paris")).toBeTruthy();
    expect(screen.getByText("marseille")).toBeTruthy();
    expect(screen.queryByText("lyon")).toBeNull();
    expect(screen.queryByText("nice")).toBeNull();
  });

  it("4 — click épingler déclenche pinCity({slug, pinned: true}) + toast", async () => {
    const user = userEvent.setup();
    render(
      <CitiesOrderV3
        adminPrefix="admin"
        initialRows={INITIAL_ROWS}
        initialTotal={INITIAL_ROWS.length}
      />,
    );

    const pinButton = screen.getByLabelText("Épingler paris");
    await user.click(pinButton);

    expect(pinCityMock).toHaveBeenCalledWith({ slug: "paris", pinned: true });
    await vi.waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalled();
    });
  });

  it("5 — désépingler ville pinned (nantes) déclenche pinCity({pinned: false})", async () => {
    const user = userEvent.setup();
    render(
      <CitiesOrderV3
        adminPrefix="admin"
        initialRows={INITIAL_ROWS}
        initialTotal={INITIAL_ROWS.length}
      />,
    );

    const unpinButton = screen.getByLabelText("Désépingler nantes");
    expect(unpinButton).toBeTruthy();

    await user.click(unpinButton);
    expect(pinCityMock).toHaveBeenCalledWith({ slug: "nantes", pinned: false });
  });
});
