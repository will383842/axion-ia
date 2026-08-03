// Row d'une route dans le Site Explorer — Sprint Site Explorer Admin 2026-05-22.

import Link from "next/link";
import { Globe, Pencil, TriangleAlert } from "lucide-react";
import { SiteRouteStatusBadge } from "./SiteRouteStatusBadge";
import type { SiteRouteListItem } from "@/server/actions/site-explorer/site-routes";
import { adminPath } from "@/lib/admin-path";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Props {
  route: SiteRouteListItem;
}

export function SiteRouteRow({ route }: Props) {
  const displayPath = route.pathRendered ?? route.pathPattern;
  const isResolvable = !displayPath.includes("[");
  const anomalyCount = route._count?.anomalies ?? 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-4 py-3 text-sm hover:bg-[color:var(--color-admin-surface-sunken)]">
      {/* Indentation profondeur */}
      {route.depth > 1 && (
        <span
          className="shrink-0 text-[color:var(--color-admin-fg-disabled)]"
          style={{ paddingLeft: (route.depth - 1) * 16 }}
        >
          └
        </span>
      )}

      {/* Path */}
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
        {route.section && (
          <span className="hidden rounded bg-[color:var(--color-admin-neutral-soft)] px-1.5 py-0.5 text-xs text-[color:var(--color-admin-fg-muted)] md:inline">
            {route.section}
          </span>
        )}

        <SiteRouteStatusBadge status={route.status} httpStatus={route.httpStatus} />

        {route.wordCount !== null && (
          <span className="hidden text-xs text-[color:var(--color-admin-fg-disabled)] lg:inline">
            {route.wordCount.toLocaleString("fr-FR")} mots
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

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
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
}
