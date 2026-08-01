// Liste paginée des routes — Sprint Site Explorer Admin 2026-05-22.
// Server Component pur.

import { RoutesReviewList } from "./RoutesReviewList";
import { adminPath } from "@/lib/admin-path";
import type { SiteRouteListItem } from "@/server/actions/site-explorer/site-routes";

interface Props {
  routes: SiteRouteListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function SiteExplorerList({ routes, total, page, pageSize }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  const baseUrl = adminPath("fr", "site-explorer");

  if (routes.length === 0) {
    return (
      <div className="rounded-lg border border-[color:var(--color-admin-border)] py-12 text-center text-[color:var(--color-admin-fg-muted)]">
        <p>Aucune route trouvée.</p>
        <p className="mt-1 text-xs">Lancez un scan pour cataloguer les URLs publiques.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-[color:var(--color-admin-fg-muted)]">
        <span>
          {total.toLocaleString("fr-FR")} URL{total > 1 ? "s" : ""} publique{total > 1 ? "s" : ""}
        </span>
        {totalPages > 1 && (
          <span>
            Page {page} / {totalPages}
          </span>
        )}
      </div>

      <RoutesReviewList routes={routes} />

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-4" aria-label="Pagination">
          {page > 1 && (
            <a
              href={`${baseUrl}?page=${page - 1}`}
              className="rounded border border-[color:var(--color-admin-border-strong)] px-3 py-1.5 text-sm hover:bg-[color:var(--color-admin-surface-sunken)]"
            >
              ← Précédente
            </a>
          )}
          <span className="text-sm text-[color:var(--color-admin-fg-muted)]">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`${baseUrl}?page=${page + 1}`}
              className="rounded border border-[color:var(--color-admin-border-strong)] px-3 py-1.5 text-sm hover:bg-[color:var(--color-admin-surface-sunken)]"
            >
              Suivante →
            </a>
          )}
        </nav>
      )}
    </div>
  );
}
