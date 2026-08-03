"use client";
// use-client: useState/useTransition + useRouter (sélection, feu tricolore, GSC, clipboard)
// Liste interactive des URLs — onglet « Toutes les URLs » (2026-06-08).
// Gère : multi-sélection + actions groupées, feu tricolore manuel (vert/orange/
// rouge), case « indexation GSC demandée », badge indexable/noindex live, trafic
// GSC. Appelle les server actions et rafraîchit via router.refresh().

import Link from "next/link";
import { Check, Copy, Globe, Pencil, TriangleAlert } from "lucide-react";
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
  { value: "green", label: "Parfaite", cls: "bg-[color:var(--color-admin-success)]" },
  { value: "orange", label: "À retoucher", cls: "bg-[color:var(--color-admin-warning)]" },
  { value: "red", label: "Cassée / problème", cls: "bg-[color:var(--color-admin-destructive)]" },
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

  // Exécute une action serveur en capturant toute erreur (ex. rôle `reader` →
  // « forbidden ») pour ne pas laisser de rejet de promesse non géré.
  const run = useCallback(
    (fn: () => Promise<unknown>, after?: () => void) => {
      startTransition(async () => {
        try {
          await fn();
          after?.();
          router.refresh();
        } catch (e) {
          console.error("[toutes-les-urls] action échouée:", e);
        }
      });
    },
    [router],
  );

  const setQuality = useCallback(
    (id: string, value: SiteRouteQuality) => run(() => setRouteQualityStatus(id, value)),
    [run],
  );

  const toggleGsc = useCallback(
    (id: string, value: boolean) => run(() => toggleGscIndexationRequested(id, value)),
    [run],
  );

  const bulkQuality = useCallback(
    (value: SiteRouteQuality) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      run(
        () => bulkSetQualityStatus(ids, value),
        () => setSelected(new Set()),
      );
    },
    [selected, run],
  );

  const bulkGsc = useCallback(
    (value: boolean) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      run(
        () => bulkToggleGsc(ids, value),
        () => setSelected(new Set()),
      );
    },
    [selected, run],
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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)] px-3 py-2 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
          <span className="text-[color:var(--color-admin-fg-muted)]">
            {selected.size > 0 ? `${selected.size} sélectionnée(s)` : "Tout sélectionner"}
          </span>
        </label>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[color:var(--color-admin-fg-disabled)]">Feu :</span>
            {QUALITY_DOTS.map((d) => (
              <button
                key={d.value}
                type="button"
                disabled={isPending}
                onClick={() => bulkQuality(d.value)}
                className={`h-4 w-4 rounded-full ${d.cls} ring-offset-1 hover:ring-2 hover:ring-[color:var(--color-admin-border-strong)]`}
                title={`Marquer « ${d.label} »`}
                aria-label={`Marquer la sélection ${d.label}`}
              />
            ))}
            <button
              type="button"
              disabled={isPending}
              onClick={() => bulkQuality("unset")}
              className="rounded border border-[color:var(--color-admin-border-strong)] px-1.5 py-0.5 text-xs text-[color:var(--color-admin-fg-muted)] hover:bg-[color:var(--color-admin-paper)]"
            >
              Réinitialiser
            </button>
            <span className="ml-2 text-[color:var(--color-admin-fg-disabled)]">GSC :</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => bulkGsc(true)}
              className="rounded border border-[color:var(--color-admin-border-strong)] px-1.5 py-0.5 text-xs text-[color:var(--color-admin-fg-muted)] hover:bg-[color:var(--color-admin-paper)]"
            >
              Marquer demandé
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => bulkGsc(false)}
              className="rounded border border-[color:var(--color-admin-border-strong)] px-1.5 py-0.5 text-xs text-[color:var(--color-admin-fg-muted)] hover:bg-[color:var(--color-admin-paper)]"
            >
              Décocher
            </button>
            <button
              type="button"
              onClick={bulkCopy}
              className={`rounded border px-1.5 py-0.5 text-xs hover:bg-[color:var(--color-admin-paper)] ${
                bulkCopied
                  ? "border-[color:var(--color-admin-success)] text-[color:var(--color-admin-success)]"
                  : "border-[color:var(--color-admin-border-strong)] text-[color:var(--color-admin-fg-muted)]"
              }`}
            >
              {bulkCopied ? "Copiées" : "Copier les URLs"}
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
            className={`flex items-center gap-3 rounded-lg border bg-[color:var(--color-admin-paper)] px-3 py-2.5 text-sm hover:bg-[color:var(--color-admin-surface-sunken)] ${
              checked
                ? "border-[color:var(--color-admin-info)] bg-[color:var(--color-admin-info-soft)]/40"
                : "border-[color:var(--color-admin-border)]"
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
                        ? "opacity-100 ring-2 ring-[color:var(--color-admin-accent)] ring-offset-1"
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
                className="admin-link block truncate font-mono text-xs"
              >
                {displayPath}
              </Link>
              {route.metaTitle && (
                <p className="mt-0.5 truncate text-xs text-[color:var(--color-admin-fg-muted)]">
                  {route.metaTitle}
                </p>
              )}
            </div>

            {/* Badges */}
            <div className="flex shrink-0 items-center gap-2">
              {/* Indexable / noindex (live) */}
              {route.isIndexable === null ? (
                <span
                  className="hidden rounded bg-[color:var(--color-admin-neutral-soft)] px-1.5 py-0.5 text-xs text-[color:var(--color-admin-fg-muted)] sm:inline"
                  title="Pas encore calculé (lancez la découverte)"
                >
                  —
                </span>
              ) : route.isIndexable ? (
                <span className="rounded bg-[color:var(--color-admin-success-soft)] px-1.5 py-0.5 text-xs font-medium text-[color:var(--color-admin-success-fg)]">
                  Indexable
                </span>
              ) : (
                <span
                  className="rounded bg-[color:var(--color-admin-warning-soft)] px-1.5 py-0.5 text-xs font-medium text-[color:var(--color-admin-warning-fg)]"
                  title={route.noindexReason ?? "noindex"}
                >
                  Noindex
                </span>
              )}

              {route.category && (
                <span className="hidden rounded bg-[color:var(--color-admin-neutral-soft)] px-1.5 py-0.5 text-xs text-[color:var(--color-admin-fg-muted)] lg:inline">
                  {route.category}
                </span>
              )}

              <SiteRouteStatusBadge status={route.status} httpStatus={route.httpStatus} />

              {/* Trafic GSC */}
              {route.gscImpressions !== null && (
                <span
                  className="hidden text-xs text-[color:var(--color-admin-fg-disabled)] xl:inline"
                  title="Clics / impressions / position moyenne (GSC 28j)"
                >
                  {route.gscClicks ?? 0}c · {route.gscImpressions}i
                  {route.gscPosition != null ? ` · p${route.gscPosition.toFixed(1)}` : ""}
                </span>
              )}

              {anomalyCount > 0 && (
                <span className="rounded-full bg-[color:var(--color-admin-destructive-soft)] px-1.5 py-0.5 text-xs font-medium text-[color:var(--color-admin-destructive-fg)]">
                  <TriangleAlert
                    size={14}
                    aria-hidden="true"
                    className="inline-block shrink-0 align-[-0.125em]"
                  />{" "}
                  {anomalyCount}
                </span>
              )}
            </div>

            {/* GSC demandé */}
            <label
              className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-[color:var(--color-admin-fg-muted)]"
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
                  className="rounded p-1 text-[color:var(--color-admin-fg-disabled)] hover:bg-[color:var(--color-admin-neutral-soft)] hover:text-[color:var(--color-admin-fg-muted)]"
                  aria-label={`Voir ${displayPath}`}
                >
                  <Globe size={14} aria-hidden="true" />
                </a>
              )}
              {route.editable && route.editorRoute && (
                <a
                  href={route.editorRoute}
                  title="Éditer"
                  className="rounded p-1 text-[color:var(--color-admin-fg-disabled)] hover:bg-[color:var(--color-admin-info-soft)] hover:text-[color:var(--color-admin-info)]"
                  aria-label={`Éditer ${displayPath}`}
                >
                  <Pencil size={14} aria-hidden="true" />
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
        copied
          ? "text-[color:var(--color-admin-success)]"
          : "text-[color:var(--color-admin-fg-disabled)] hover:bg-[color:var(--color-admin-neutral-soft)] hover:text-[color:var(--color-admin-fg-muted)]"
      } disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}
