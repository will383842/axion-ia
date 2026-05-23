// Row d'une route dans le Site Explorer — Sprint Site Explorer Admin 2026-05-22.

import Link from "next/link";
import { SiteRouteStatusBadge } from "./SiteRouteStatusBadge";
import type { SiteRouteListItem } from "@/server/actions/site-explorer/site-routes";
import { adminPath } from "@/lib/admin-path";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Props {
  route: SiteRouteListItem;
  adminPrefix: string;
}

export function SiteRouteRow({ route, adminPrefix }: Props) {
  const displayPath = route.pathRendered ?? route.pathPattern;
  const isResolvable = !displayPath.includes("[");
  const anomalyCount = route._count?.anomalies ?? 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm hover:bg-gray-50">
      {/* Indentation profondeur */}
      {route.depth > 1 && (
        <span className="shrink-0 text-gray-300" style={{ paddingLeft: (route.depth - 1) * 16 }}>
          └
        </span>
      )}

      {/* Path */}
      <div className="min-w-0 flex-1">
        <Link
          href={adminPath("fr", `site-explorer/${route.id}`)}
          className="font-mono text-xs text-blue-600 hover:underline truncate block"
        >
          {displayPath}
        </Link>
        {route.metaTitle && (
          <p className="mt-0.5 text-xs text-gray-500 truncate">{route.metaTitle}</p>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        {route.section && (
          <span className="hidden rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 md:inline">
            {route.section}
          </span>
        )}

        <SiteRouteStatusBadge status={route.status} httpStatus={route.httpStatus} />

        {route.wordCount !== null && (
          <span className="hidden text-xs text-gray-400 lg:inline">
            {route.wordCount.toLocaleString("fr-FR")} mots
          </span>
        )}

        {anomalyCount > 0 && (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
            ⚠️ {anomalyCount}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
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
}
