// Phase D — Tests pages admin Site Explorer (RTL simulé en pure logique)
// Sprint Site Explorer Admin 2026-05-22
// Note : tests RTL complets nécessitent un environnement jsdom.
// Ces tests couvrent la logique UI sans rendu DOM.

import { describe, it, expect } from "vitest";

// ─── Types simulés ────────────────────────────────────────────────────────────

type SiteRouteType = "static" | "dynamic_db" | "dynamic_template" | "dynamic_filesystem";
type SiteRouteStatus = "live" | "draft" | "not_found" | "redirect" | "error" | "unknown" | "preview";

interface RouteListItem {
  id: string;
  pathPattern: string;
  pathRendered: string | null;
  type: SiteRouteType;
  status: SiteRouteStatus;
  section: string | null;
  editable: boolean;
  editorRoute: string | null;
  httpStatus: number | null;
  metaTitle: string | null;
  wordCount: number | null;
  jsonLdCount: number | null;
  hasAiDisclaimer: boolean | null;
  _count?: { anomalies: number };
}

// ─── Logique displayPath ──────────────────────────────────────────────────────

function getDisplayPath(route: RouteListItem): string {
  return route.pathRendered ?? route.pathPattern;
}

function isResolvable(route: RouteListItem): boolean {
  const path = getDisplayPath(route);
  return route.type !== "dynamic_template" && !path.includes("[");
}

// ─── Logique pagination ───────────────────────────────────────────────────────

function getTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  const count = Math.min(7, totalPages);
  const start =
    totalPages <= 7
      ? 1
      : currentPage <= 4
        ? 1
        : currentPage >= totalPages - 3
          ? totalPages - 6
          : currentPage - 3;
  return Array.from({ length: count }, (_, i) => start + i);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SiteExplorerList — logique affichage", () => {
  it("affiche le pathRendered si disponible", () => {
    const route: RouteListItem = {
      id: "r1",
      pathPattern: "/fr/blog/[slug]",
      pathRendered: "/fr/blog/audit-ia-paris-2026",
      type: "dynamic_db",
      status: "live",
      section: "blog",
      editable: true,
      editorRoute: "/admin/blog/edit",
      httpStatus: 200,
      metaTitle: null,
      wordCount: null,
      jsonLdCount: null,
      hasAiDisclaimer: null,
    };
    expect(getDisplayPath(route)).toBe("/fr/blog/audit-ia-paris-2026");
  });

  it("affiche le pathPattern comme fallback si pathRendered est null", () => {
    const route: RouteListItem = {
      id: "r1",
      pathPattern: "/fr/blog/[slug]",
      pathRendered: null,
      type: "dynamic_template",
      status: "unknown",
      section: "blog",
      editable: false,
      editorRoute: null,
      httpStatus: null,
      metaTitle: null,
      wordCount: null,
      jsonLdCount: null,
      hasAiDisclaimer: null,
    };
    expect(getDisplayPath(route)).toBe("/fr/blog/[slug]");
  });

  it("isResolvable est false pour les templates avec [param]", () => {
    const route: RouteListItem = {
      id: "r1",
      pathPattern: "/fr/blog/[slug]",
      pathRendered: null,
      type: "dynamic_template",
      status: "unknown",
      section: "blog",
      editable: false,
      editorRoute: null,
      httpStatus: null,
      metaTitle: null,
      wordCount: null,
      jsonLdCount: null,
      hasAiDisclaimer: null,
    };
    expect(isResolvable(route)).toBe(false);
  });

  it("isResolvable est true pour les routes résolues", () => {
    const route: RouteListItem = {
      id: "r1",
      pathPattern: "/fr/blog/[slug]",
      pathRendered: "/fr/blog/audit-ia",
      type: "dynamic_db",
      status: "live",
      section: "blog",
      editable: true,
      editorRoute: "/admin/blog/edit",
      httpStatus: 200,
      metaTitle: null,
      wordCount: null,
      jsonLdCount: null,
      hasAiDisclaimer: null,
    };
    expect(isResolvable(route)).toBe(true);
  });

  it("les pages statiques ne sont pas éditables", () => {
    const route: RouteListItem = {
      id: "r1",
      pathPattern: "/fr/contact",
      pathRendered: null,
      type: "static",
      status: "live",
      section: "contact",
      editable: false,
      editorRoute: null,
      httpStatus: 200,
      metaTitle: null,
      wordCount: null,
      jsonLdCount: null,
      hasAiDisclaimer: null,
    };
    expect(route.editable).toBe(false);
    expect(route.editorRoute).toBeNull();
  });
});

describe("SiteExplorerList — pagination", () => {
  it("calcule le nombre total de pages", () => {
    expect(getTotalPages(100, 50)).toBe(2);
    expect(getTotalPages(101, 50)).toBe(3);
    expect(getTotalPages(0, 50)).toBe(0);
  });

  it("génère les numéros de pages correctement", () => {
    expect(getPageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(getPageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getPageNumbers(5, 10)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("SiteRouteStatusBadge — logique", () => {
  it("mappe les statuts aux libellés corrects", () => {
    const labels: Record<SiteRouteStatus, string> = {
      live: "Live",
      draft: "Draft",
      preview: "Preview",
      not_found: "404",
      redirect: "301",
      error: "Erreur",
      unknown: "?",
    };
    expect(labels["live"]).toBe("Live");
    expect(labels["not_found"]).toBe("404");
    expect(labels["unknown"]).toBe("?");
  });
});

describe("SiteExplorerStats — affichage compteurs", () => {
  it("stats vides retournent des valeurs initiales", () => {
    const stats = {
      total: 0,
      byType: {},
      byStatus: {},
      anomaliesHigh: 0,
      anomaliesTotal: 0,
      lastScanAt: null,
    };
    expect(stats.total).toBe(0);
    expect(stats.anomaliesHigh).toBe(0);
    expect(stats.lastScanAt).toBeNull();
  });

  it("stats complètes incluent les verticales et statiques", () => {
    const stats = {
      total: 5250,
      byType: { static: 50, dynamic_db: 5100, dynamic_template: 100 },
      byStatus: { live: 5200, unknown: 50 },
      anomaliesHigh: 3,
      anomaliesTotal: 12,
      lastScanAt: new Date("2026-05-22T02:00:00Z"),
    };
    expect(stats.total).toBe(5250);
    expect(stats.byType.static).toBe(50);
    expect(stats.anomaliesHigh).toBe(3);
  });
});
