// Badge statut route — Sprint Site Explorer Admin 2026-05-22.

import { CircleCheck, CircleDashed, Info, Redo2, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { SiteRouteStatus } from "../../../../prisma/generated/client";

interface Props {
  status: SiteRouteStatus;
  httpStatus?: number | null;
}

export function SiteRouteStatusBadge({ status, httpStatus }: Props) {
  const config: Record<SiteRouteStatus, { label: string; className: string; Icone: LucideIcon; filet?: "erreur" | "attention" }> = {
    live: {
      label: "En ligne",
      Icone: CircleCheck,
      className:
        "bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]",
    },
    draft: {
      label: "Brouillon",
      Icone: TriangleAlert,
      filet: "attention",
      className:
        "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]",
    },
    preview: {
      label: "Aperçu",
      Icone: Info,
      className: "bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-info)]",
    },
    not_found: {
      label: "404",
      Icone: X,
      filet: "erreur",
      className:
        "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]",
    },
    redirect: {
      label: "301",
      Icone: Redo2,
      filet: "attention",
      className:
        "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]",
    },
    error: {
      label: "Erreur",
      Icone: X,
      filet: "erreur",
      className:
        "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]",
    },
    unknown: {
      label: "?",
      Icone: CircleDashed,
      className:
        "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-fg-muted)]",
    },
  };

  const entry = config[status] ?? {
    label: "?",
    Icone: CircleDashed,
    className:
      "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-fg-muted)]",
  };
  const { label, className, Icone, filet } = entry;
  const filetClasse =
    filet === "erreur"
      ? "border-l-[3px] border-[color:var(--color-admin-destructive-line,var(--color-admin-destructive))]"
      : filet === "attention"
        ? "border-l-[3px] border-[color:var(--color-admin-warning)]"
        : "";
  // 🔴 DÈS QU'UN CODE HTTP EXISTAIT, IL REMPLAÇAIT LE LIBELLÉ : la pastille
  // n'affichait plus que « 200 » ou « 301 », et le sens (« En ligne »,
  // « Redirigée ») ne tenait plus qu'à la couleur. Un statut inconnu se
  // réduisait à « ? ». On garde les deux.
  const display = httpStatus && status !== "unknown" ? `${label} · ${httpStatus}` : label;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${className} ${filetClasse}`}
    >
      <Icone aria-hidden="true" size={12} strokeWidth={2.5} className="shrink-0" />
      {display}
    </span>
  );
}
