// Tests de rendu (jsdom/RTL) — onglet « Toutes les URLs » (2026-06-08).
// Prouve que le corps JSX du dashboard rend sans erreur et expose les contrôles
// clés : indexable/noindex, feu tricolore, GSC, copie d'URL.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const actionMock = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/server/actions/site-explorer/site-routes", () => ({
  setRouteQualityStatus: (...a: unknown[]) => actionMock(...a),
  toggleGscIndexationRequested: (...a: unknown[]) => actionMock(...a),
  bulkSetQualityStatus: (...a: unknown[]) => actionMock(...a),
  bulkToggleGsc: (...a: unknown[]) => actionMock(...a),
}));

import { RoutesReviewList } from "../RoutesReviewList";
import { SiteExplorerStats } from "../SiteExplorerStats";
import type { SiteRouteListItem } from "@/server/actions/site-explorer/site-routes";

function makeRoute(over: Partial<SiteRouteListItem> = {}): SiteRouteListItem {
  return {
    id: "ckroute0000000000000000",
    pathPattern: "/fr/audit/par-ville/[ville]",
    pathRendered: "/fr/audit/par-ville/lyon",
    pathSlug: "lyon",
    type: "dynamic_filesystem",
    status: "live",
    section: "audit",
    category: "villes",
    editable: false,
    editorRoute: null,
    httpStatus: 200,
    metaTitle: "Audit IA Lyon",
    wordCount: 1800,
    jsonLdCount: 2,
    hasAiDisclaimer: false,
    lastInspectedAt: null,
    depth: 3,
    isIndexable: true,
    noindexReason: null,
    qualityStatus: "unset",
    gscIndexationRequested: false,
    gscIndexationRequestedAt: null,
    gscClicks: 12,
    gscImpressions: 340,
    gscCtr: 0.035,
    gscPosition: 8.2,
    removedAt: null,
    _count: { anomalies: 0 },
    ...over,
  };
}

describe("RoutesReviewList — rendu", () => {
  it("rend le chemin et le badge Indexable", () => {
    render(<RoutesReviewList routes={[makeRoute()]} />);
    expect(screen.getByText("/fr/audit/par-ville/lyon")).toBeInTheDocument();
    expect(screen.getByText("Indexable")).toBeInTheDocument();
  });

  it("rend le badge Noindex avec la raison en title", () => {
    render(
      <RoutesReviewList
        routes={[makeRoute({ isIndexable: false, noindexReason: "Ville hors cohorte drip" })]}
      />,
    );
    const badge = screen.getByText("Noindex");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "Ville hors cohorte drip");
  });

  it("expose le bouton copier l'URL", () => {
    render(<RoutesReviewList routes={[makeRoute()]} />);
    expect(screen.getByLabelText(/Copier l'URL/)).toBeInTheDocument();
  });

  it("clique sur le feu vert déclenche l'action qualité", () => {
    render(<RoutesReviewList routes={[makeRoute()]} />);
    fireEvent.click(screen.getByLabelText(/Parfaite/));
    expect(actionMock).toHaveBeenCalled();
  });

  it("affiche la barre de sélection groupée", () => {
    render(<RoutesReviewList routes={[makeRoute()]} />);
    expect(screen.getByText(/Tout sélectionner/)).toBeInTheDocument();
  });
});

describe("SiteExplorerStats — rendu", () => {
  it("affiche les compteurs indexable/noindex et catégories", () => {
    render(
      <SiteExplorerStats
        stats={{
          total: 3129,
          byType: { static: 60, dynamic_db: 200, dynamic_template: 50, dynamic_filesystem: 2800 },
          byStatus: { live: 3000, unknown: 129 },
          byCategory: { villes: 2780, contenu: 119, commercial: 62 },
          byQuality: { unset: 3000, green: 100, orange: 20, red: 9 },
          indexableCount: 1885,
          noindexCount: 1244,
          gscRequestedCount: 42,
          gscClicksTotal: 1234,
          gscImpressionsTotal: 56789,
          removedCount: 3,
          anomaliesHigh: 0,
          anomaliesTotal: 0,
          lastScanAt: null,
        }}
      />,
    );
    expect(screen.getByText("URLs publiques")).toBeInTheDocument();
    expect(screen.getByText("Indexables")).toBeInTheDocument();
    expect(screen.getByText("Noindex")).toBeInTheDocument();
    expect(screen.getByText("1 885")).toBeInTheDocument();
    // Chip catégorie villes
    expect(screen.getByText("Villes")).toBeInTheDocument();
  });
});
