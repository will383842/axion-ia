// Badge statut route — Sprint Site Explorer Admin 2026-05-22.

import type { SiteRouteStatus } from "../../../../prisma/generated/client";

interface Props {
  status: SiteRouteStatus;
  httpStatus?: number | null;
}

export function SiteRouteStatusBadge({ status, httpStatus }: Props) {
  const config: Record<SiteRouteStatus, { label: string; className: string }> = {
    live: {
      label: "En ligne",
      className:
        "bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]",
    },
    draft: {
      label: "Brouillon",
      className:
        "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]",
    },
    preview: {
      label: "Aperçu",
      className: "bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-info)]",
    },
    not_found: {
      label: "404",
      className:
        "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]",
    },
    redirect: {
      label: "301",
      className:
        "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]",
    },
    error: {
      label: "Erreur",
      className:
        "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]",
    },
    unknown: {
      label: "?",
      className:
        "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-fg-muted)]",
    },
  };

  const entry = config[status] ?? {
    label: "?",
    className:
      "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-fg-muted)]",
  };
  const { label, className } = entry;
  // 🔴 DÈS QU'UN CODE HTTP EXISTAIT, IL REMPLAÇAIT LE LIBELLÉ : la pastille
  // n'affichait plus que « 200 » ou « 301 », et le sens (« En ligne »,
  // « Redirigée ») ne tenait plus qu'à la couleur. Un statut inconnu se
  // réduisait à « ? ». On garde les deux.
  const display = httpStatus && status !== "unknown" ? `${label} · ${httpStatus}` : label;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`}
    >
      {display}
    </span>
  );
}
