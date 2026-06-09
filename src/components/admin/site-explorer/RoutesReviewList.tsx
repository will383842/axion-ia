"use client";
// use-client: useState/useTransition + useRouter (sélection, feu tricolore, GSC, clipboard)
// Liste interactive des URLs — onglet « Toutes les URLs » (2026-06-08).
// Gère : multi-sélection + actions groupées, feu tricolore manuel (vert/orange/
// rouge), case « indexation GSC demandée », badge indexable/noindex live, trafic
// GSC. Appelle les server actions et rafraîchit via router.refresh().

import Link from "next/link";
import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SiteRouteStatusBadge } from "./SiteRouteStatusBadge";
import { adminPath } from "@/lib/admin-path";
import {
  setRouteQualityStatus,
  toggleGscIndexationRequested,
  bulkSetQualityStatus,
  bulkToggleGsc,
} from "@/server/actions/site-explorer/site-routes";
import type { SiteRouteListItem } from "@/server/actions/site-explorer/site-routes";
import type { SiteRouteQuality } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

const QUALITY_DOTS: Array<{
  value: Exclude<SiteRouteQuality, "unset">;
  label: string;
  cls: string;
}> = [
  { value: "green", label: "Parfaite", cls: "bg-green-500" },
  { value: "orange", label: "À retoucher", cls: "bg-orange-500" },
  { value: "red", label: "Cassée / problème", cls: "bg-red-500" },
];

export function RoutesReviewList({ routes }: { routes: SiteRouteListItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = routes.length > 0 && routes.every((r) => selected.has(r.id));
  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === routes.length ? new Set() : new Set(routes.map((r) => r.id)),
    );
  }, [routes]);

  const setQuality = useCallback(
    (id: string, value: SiteRouteQuality) => {
      startTransition(async () => {
        await setRouteQualityStatus(id, value);
        router.refresh();
      });
    },
    [router],
  );

  const toggleGsc = useCallback(
    (id: string, value: boolean) => {
      startTransition(async () => {
        await toggleGscIndexationRequested(id, value);
        router.refresh();
      });
    },
    [router],
  );

  const bulkQuality = useCallback(
    (value: SiteRouteQuality) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      startTransition(async () => {
        await bulkSetQualityStatus(ids, value);
        setSelected(new Set());
        router.refresh();
      });
    },
    [selected, router],
  );

  const bulkGsc = useCallback(
    (value: boolean) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      startTransition(async () => {
        await bulkToggleGsc(ids, value);
        setSelected(new Set());
        router.refresh();
      });
    },
    [selected, router],
  );

  const [bulkCopied, setBulkCopied] = useState(false);
  const bulkCopy = useCallback(async () => {
    const urls = routes
      .filter((r) => selected.has(r.id))
      .map((r) => `${SITE_URL}${r.pathRendered ?? r.pathPattern}`)
      .join("\n");
    if (!urls) return;
    try {
      await navigator.clipboard.writeText(urls);
      setBulkCopied(true);
      setTimeout(() => setBulkCopied(false), 1500);
    } catch {
      /* no-op */
    }
  }, [routes, selected]);

  return (
    <div className="space-y-1">
      {/* Barre d'actions groupées */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
          <span className="text-gray-600">
            {selected.size > 0 ? `${selected.size} sélectionnée(s)` : "Tout sélectionner"}
          </span>
        </label>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-400">Feu :</span>
            {QUALITY_DOTS.map((d) => (
              <button
                key={d.value}
                type="button"
                disabled={isPending}
                onClick={() => bulkQuality(d.value)}
                className={`h-4 w-4 rounded-full ${d.cls} ring-offset-1 hover:ring-2 hover:ring-gray-400`}
                title={`Marquer « ${d.label} »`}
                aria-label={`Marquer la sélection ${d.label}`}
              />
            ))}
            <button
              type="button"
              disabled={isPending}
              onClick={() => bulkQuality("unset")}
              className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-white"
            >
              Réinitialiser
            </button>
            <span className="ml-2 text-gray-400">GSC :</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => bulkGsc(true)}
              className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-white"
            >
              Marquer demandé
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => bulkGsc(false)}
              className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-white"
            >
              Décocher
            </button>
            <button
              type="button"
              onClick={bulkCopy}
              className={`rounded border px-1.5 py-0.5 text-xs hover:bg-white ${
                bulkCopied ? "border-green-400 text-green-600" : "border-gray-300 text-gray-600"
              }`}
            >
              {bulkCopied ? "✓ Copiées" : "📋 Copier les URLs"}
            </button>
          </div>
        )}
      </div>

      {routes.map((route) => {
        const displayPath = route.pathRendered ?? route.pathPattern;
        const isResolvable = !displayPath.includes("[");
        const anomalyCount = route._count?.anomalies ?? 0;
        const checked = selected.has(route.id);
        return (
          <div
            key={route.id}
            className={`flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5 text-sm hover:bg-gray-50 ${
              checked ? "border-blue-300 bg-blue-50/40" : "border-gray-200"
            } ${route.removedAt ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleSelect(route.id)}
              className="shrink-0 rounded"
              aria-label={`Sélectionner ${displayPath}`}
            />

            {/* Feu tricolore */}
            <div
              className="flex shrink-0 items-center gap-1"
              role="group"
              aria-label="Feu de revue"
            >
              {QUALITY_DOTS.map((d) => {
                const active = route.qualityStatus === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    disabled={isPending}
                    onClick={() => setQuality(route.id, active ? "unset" : d.value)}
                    title={d.label}
                    aria-label={`${displayPath} : ${d.label}`}
                    className={`h-3.5 w-3.5 rounded-full ${d.cls} transition-opacity ${
                      active
                        ? "opacity-100 ring-2 ring-gray-700 ring-offset-1"
                        : "opacity-25 hover:opacity-70"
                    }`}
                  />
                );
              })}
            </div>

            {/* Path + meta */}
            <div className="min-w-0 flex-1">
              <Link
                href={adminPath("fr", `site-explorer/${route.id}`)}
                className="block truncate font-mono text-xs text-blue-600 hover:underline"
              >
                {displayPath}
              </Link>
              {route.metaTitle && (
                <p className="mt-0.5 truncate text-xs text-gray-500">{route.metaTitle}</p>
              )}
            </div>

            {/* Badges */}
            <div className="flex shrink-0 items-center gap-2">
              {/* Indexable / noindex (live) */}
              {route.isIndexable === null ? (
                <span
                  className="hidden rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 sm:inline"
                  title="Pas encore calculé (lancez la découverte)"
                >
                  —
                </span>
              ) : route.isIndexable ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                  Indexable
                </span>
              ) : (
                <span
                  className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700"
                  title={route.noindexReason ?? "noindex"}
                >
                  Noindex
                </span>
              )}

              {route.category && (
                <span className="hidden rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 lg:inline">
                  {route.category}
                </span>
              )}

              <SiteRouteStatusBadge status={route.status} httpStatus={route.httpStatus} />

              {/* Trafic GSC */}
              {route.gscImpressions !== null && (
                <span
                  className="hidden text-xs text-gray-400 xl:inline"
                  title="Clics / impressions / position moyenne (GSC 28j)"
                >
                  {route.gscClicks ?? 0}c · {route.gscImpressions}i
                  {route.gscPosition != null ? ` · p${route.gscPosition.toFixed(1)}` : ""}
                </span>
              )}

              {anomalyCount > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                  ⚠️ {anomalyCount}
                </span>
              )}
            </div>

            {/* GSC demandé */}
            <label
              className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-gray-500"
              title="J'ai demandé l'indexation dans Google Search Console"
            >
              <input
                type="checkbox"
                checked={route.gscIndexationRequested}
                disabled={isPending}
                onChange={(e) => toggleGsc(route.id, e.target.checked)}
                className="rounded"
              />
              <span className="hidden md:inline">GSC</span>
            </label>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1">
              <CopyUrlButton url={`${SITE_URL}${displayPath}`} disabled={!isResolvable} />
              {isResolvable && (
                <a
                  href={`${SITE_URL}${displayPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Voir la page en live"
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label={`Voir ${displayPath}`}
                >
                  🌐
                </a>
              )}
              {route.editable && route.editorRoute && (
                <a
                  href={route.editorRoute}
                  title="Éditer"
                  className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                  aria-label={`Éditer ${displayPath}`}
                >
                  ✏️
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Bouton « copier l'URL » avec feedback visuel ✓ (clipboard API + fallback).
function CopyUrlButton({ url, disabled }: { url: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard indisponible — no-op */
    }
  }, [url]);

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      title={disabled ? "URL template (non copiable)" : `Copier ${url}`}
      aria-label={`Copier l'URL ${url}`}
      className={`rounded p-1 ${
        copied ? "text-green-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      } disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {copied ? "✓" : "📋"}
    </button>
  );
}
