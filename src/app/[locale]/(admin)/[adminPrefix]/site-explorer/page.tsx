// Site Explorer Admin — page principale — Sprint Site Explorer Admin 2026-05-22.
//
// RÈGLE STRICTE : affiche UNIQUEMENT les URLs publiques visibility='public'.
// Les routes admin/(admin)/[adminPrefix] sont exclues par design du catalogue SiteRoute.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import {
  listSiteRoutes,
  getSiteRouteStats,
  triggerScanAll,
  triggerDiscovery,
} from "@/server/actions/site-explorer/site-routes";
import { SiteExplorerStats } from "@/components/admin/site-explorer/SiteExplorerStats";
import { SiteExplorerFilters } from "@/components/admin/site-explorer/SiteExplorerFilters";
import { SiteExplorerList } from "@/components/admin/site-explorer/SiteExplorerList";
import { adminPath } from "@/lib/admin-path";
import type {
  SiteRouteType,
  SiteRouteStatus,
  SiteRouteQuality,
} from "../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Toutes les URLs — Admin Axion-IA",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string>>;
}

export default async function SiteExplorerPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const sp = await searchParams;
  const filters: import("@/server/actions/site-explorer/site-routes").SiteRouteFilters = {
    anomaliesOnly: sp.anomaliesOnly === "true",
    page: sp.page ? parseInt(sp.page, 10) : 1,
    pageSize: 50,
    ...(sp.type ? { type: sp.type as SiteRouteType } : {}),
    ...(sp.status ? { status: sp.status as SiteRouteStatus } : {}),
    ...(sp.section ? { section: sp.section } : {}),
    ...(sp.category ? { category: sp.category } : {}),
    ...(sp.quality ? { qualityStatus: sp.quality as SiteRouteQuality } : {}),
    ...(sp.indexable === "true"
      ? { isIndexable: true }
      : sp.indexable === "false"
        ? { isIndexable: false }
        : {}),
    ...(sp.gscRequested === "true" ? { gscRequested: true } : {}),
    ...(sp.includeRemoved === "true" ? { includeRemoved: true } : {}),
    ...(sp.sort === "indexable_first" || sp.sort === "noindex_first" ? { sort: sp.sort } : {}),
    ...(sp.search ? { search: sp.search } : {}),
    ...(sp.editable === "true" ? { editable: true } : {}),
  };

  const [stats, { routes, total, page, pageSize }] = await Promise.all([
    getSiteRouteStats(),
    listSiteRoutes(filters),
  ]);

  const anomaliesUrl = adminPath("fr", "site-explorer/anomalies");

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Toutes les URLs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Catalogue vivant des URLs publiques — indexabilité live, feu de revue &amp; GSC (admin
            &amp; API exclus)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats.anomaliesHigh > 0 && (
            <a
              href={anomaliesUrl}
              className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              ⚠️ {stats.anomaliesHigh} anomalie{stats.anomaliesHigh > 1 ? "s" : ""} high
            </a>
          )}
          <DiscoverButton />
          <ScanAllButton adminPrefix={adminPrefix} />
          <a
            href={anomaliesUrl}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Voir anomalies ({stats.anomaliesTotal})
          </a>
        </div>
      </div>

      {/* Stats */}
      <SiteExplorerStats stats={stats} />

      {/* Note exclusions */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
        ❌ Routes admin <code>/[adminPrefix]/*</code> : non cataloguées — ❌ Routes API{" "}
        <code>/api/*</code> : non cataloguées — ❌ Server Actions : non cataloguées
      </div>

      {/* Filtres */}
      <Suspense>
        <SiteExplorerFilters />
      </Suspense>

      {/* Liste */}
      <SiteExplorerList routes={routes} total={total} page={page} pageSize={pageSize} />
    </div>
  );
}

// Bouton trigger inspection HTTP — Server Action directement dans la page
function ScanAllButton({ adminPrefix: _adminPrefix }: { adminPrefix: string }) {
  async function handleScanAll() {
    "use server";
    await triggerScanAll();
  }

  return (
    <form action={handleScanAll}>
      <button
        type="submit"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        title="Relance l'inspection HTTP (statut, méta, mots) des URLs cataloguées"
      >
        🔄 Inspecter (HTTP)
      </button>
    </form>
  );
}

// Bouton trigger découverte « vivante » — ré-énumère + recalcule l'indexabilité.
function DiscoverButton() {
  async function handleDiscover() {
    "use server";
    await triggerDiscovery();
  }

  return (
    <form action={handleDiscover}>
      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        title="Ré-énumère toutes les URLs et recalcule l'indexabilité live (auto chaque nuit)"
      >
        🔎 Découvrir les URLs
      </button>
    </form>
  );
}
