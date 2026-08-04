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
import { TriangleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explorateur du site — toutes les adresses | Axion-IA Admin",
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
          <h1 className="text-2xl font-bold text-[color:var(--color-admin-fg)]">Toutes les URLs</h1>
          <p className="mt-1 text-sm text-[color:var(--color-admin-fg-muted)]">
            Catalogue vivant des URLs publiques — indexabilité live, feu de revue &amp; GSC (admin
            &amp; API exclus)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats.anomaliesHigh > 0 && (
            <a
              href={anomaliesUrl}
              className="flex items-center gap-1.5 rounded-lg bg-[color:var(--color-admin-destructive-soft)] px-3 py-2 text-sm font-medium text-[color:var(--color-admin-destructive-fg)] hover:bg-[color:var(--color-admin-destructive-soft)]"
            >
              <TriangleAlert
                size={14}
                aria-hidden="true"
                className="inline-block shrink-0 align-[-0.125em]"
              />{" "}
              {stats.anomaliesHigh} anomalie{stats.anomaliesHigh > 1 ? "s" : ""} high
            </a>
          )}
          <DiscoverButton />
          <ScanAllButton adminPrefix={adminPrefix} />
          <a
            href={anomaliesUrl}
            className="rounded-lg border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-3 py-2 text-sm text-[color:var(--color-admin-fg-muted)] hover:bg-[color:var(--color-admin-surface-sunken)]"
          >
            Voir anomalies ({stats.anomaliesTotal})
          </a>
        </div>
      </div>

      {sp.erreur ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {sp.erreur}
        </p>
      ) : sp.lance ? (
        <p role="status" className="admin-alert admin-alert-success">
          {sp.lance === "inspection"
            ? "Inspection lancée — les résultats arriveront dans quelques minutes."
            : "Découverte lancée — le catalogue sera à jour dans quelques minutes."}
        </p>
      ) : null}

      {/* Stats */}
      <SiteExplorerStats stats={stats} />

      {/* Note exclusions */}
      <div className="rounded-lg border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)] px-4 py-2 text-xs text-[color:var(--color-admin-fg-muted)]">
        Routes admin <code>/[adminPrefix]/*</code> : non cataloguées · Routes API{" "}
        <code>/api/*</code> : non cataloguées · Server Actions : non cataloguées
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

/**
 * 🔴 CES DEUX BOUTONS NE DISAIENT RIEN. Les actions renvoient
 * `{ success, error }` — « Queue BullMQ non disponible », par exemple — et la
 * page jetait le résultat. Comme le travail est asynchrone, rien ne change à
 * l'écran non plus : un clic réussi et un clic échoué produisaient exactement
 * la même chose, c'est-à-dire rien. On repart donc avec le verdict dans l'URL,
 * lu en tête de page.
 */
function ScanAllButton({ adminPrefix: _adminPrefix }: { adminPrefix: string }) {
  async function handleScanAll() {
    "use server";
    const r = await triggerScanAll();
    redirect(
      r.success
        ? `${adminPath("fr", "site-explorer")}?lance=inspection`
        : `${adminPath("fr", "site-explorer")}?erreur=${encodeURIComponent(r.error ?? "L'inspection n'a pas pu être lancée.")}`,
    );
  }

  return (
    <form action={handleScanAll}>
      <button
        type="submit"
        className="rounded-lg border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] px-3 py-2 text-sm font-medium text-[color:var(--color-admin-fg-muted)] hover:bg-[color:var(--color-admin-surface-sunken)]"
        title="Relance l'inspection HTTP (statut, méta, mots) des URLs cataloguées"
      >
        Inspecter (HTTP)
      </button>
    </form>
  );
}

// Bouton trigger découverte « vivante » — ré-énumère + recalcule l'indexabilité.
function DiscoverButton() {
  async function handleDiscover() {
    "use server";
    const r = await triggerDiscovery();
    redirect(
      r.success
        ? `${adminPath("fr", "site-explorer")}?lance=decouverte`
        : `${adminPath("fr", "site-explorer")}?erreur=${encodeURIComponent(r.error ?? "La découverte n'a pas pu être lancée.")}`,
    );
  }

  return (
    <form action={handleDiscover}>
      <button
        type="submit"
        className="admin-button"
        title="Ré-énumère toutes les URLs et recalcule l'indexabilité live (auto chaque nuit)"
      >
        Découvrir les URLs
      </button>
    </form>
  );
}
