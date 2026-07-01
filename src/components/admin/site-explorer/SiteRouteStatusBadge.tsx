// Badge statut route — Sprint Site Explorer Admin 2026-05-22.

import type { SiteRouteStatus } from "../../../../prisma/generated/client";

interface Props {
  status: SiteRouteStatus;
  httpStatus?: number | null;
}

export function SiteRouteStatusBadge({ status, httpStatus }: Props) {
  const config: Record<SiteRouteStatus, { label: string; className: string }> = {
    live: { label: "En ligne", className: "bg-green-100 text-green-700" },
    draft: { label: "Brouillon", className: "bg-yellow-100 text-yellow-700" },
    preview: { label: "Aperçu", className: "bg-blue-100 text-blue-700" },
    not_found: { label: "404", className: "bg-red-100 text-red-700" },
    redirect: { label: "301", className: "bg-orange-100 text-orange-700" },
    error: { label: "Erreur", className: "bg-red-100 text-red-700" },
    unknown: { label: "?", className: "bg-gray-100 text-gray-600" },
  };

  const entry = config[status] ?? { label: "?", className: "bg-gray-100 text-gray-600" };
  const { label, className } = entry;
  const display = httpStatus && status !== "unknown" ? `${httpStatus}` : label;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`}
    >
      {display}
    </span>
  );
}
