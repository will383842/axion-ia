// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A7 duplication #7 / #14).
//
// Tile KPI : label + value + delta optionnel + lien optionnel.
// Server Component. 19 KPIs dashboard/content-gen/analytics à migrer.

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatTone = "default" | "success" | "warning" | "destructive" | "info";

interface AdminStatCardProps {
  label: string;
  value: string | number;
  /** Delta optionnel (ex. "+12", "-3.5 %"). Auto-coloré selon le signe. */
  delta?: string;
  /** Meta texte (ex. "vs 7 jours"). */
  meta?: string;
  tone?: StatTone;
  /** Icône lucide affichée en pastille teintée (haut-droite) — style KPI produit. */
  icon?: LucideIcon;
  /** Si fournie, la card devient cliquable (lien vers détail). */
  href?: string;
  className?: string;
}

// Pastille d'icône teintée par tonalité (fond doux + icône colorée).
const TONE_PASTILLE: Record<StatTone, string> = {
  default: "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-fg-muted)]",
  success: "bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]",
  warning: "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]",
  destructive:
    "bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]",
  info: "bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-info)]",
};

// Refonte juin 2026 (P1 audit design console) — l'accent de tonalité passait
// par une grosse bordure-gauche 4px (pattern « alerte Bootstrap » daté). On
// remplace par une pastille de couleur 6px devant le label : bordure de carte
// uniforme + signal de tonalité discret et moderne (réf. dots de statut
// Linear/Vercel). `default` = aucune pastille.
const TONE_DOT: Record<StatTone, string | null> = {
  default: null,
  success: "bg-[color:var(--color-admin-success)]",
  warning: "bg-[color:var(--color-admin-warning)]",
  destructive: "bg-[color:var(--color-admin-destructive)]",
  info: "bg-[color:var(--color-admin-info)]",
};

function deltaTone(delta: string): "up" | "down" | "neutral" {
  if (delta.startsWith("+")) return "up";
  if (delta.startsWith("-") || delta.startsWith("−")) return "down";
  return "neutral";
}

const DELTA_COLOR: Record<"up" | "down" | "neutral", string> = {
  up: "text-[color:var(--color-admin-success)]",
  down: "text-[color:var(--color-admin-destructive)]",
  neutral: "text-[color:var(--color-admin-fg-muted)]",
};

export function AdminStatCard({
  label,
  value,
  delta,
  meta,
  tone = "default",
  icon: Icon,
  href,
  className,
}: AdminStatCardProps): React.ReactElement {
  const content = (
    <div
      className={cn(
        "admin-stat-card flex flex-col gap-[var(--space-admin-2)]",
        "rounded-[var(--radius-admin-xl)] border border-[color:var(--color-admin-border)]",
        "bg-[color:var(--color-admin-paper)]",
        "p-[var(--space-admin-6)] shadow-[var(--shadow-admin-1)]",
        href && "transition-shadow hover:shadow-[var(--shadow-admin-2)]",
        className,
      )}
    >
      {/* Refonte UI 2026-08-01 (couche 2) — le libellé était en capitales
          espacées de 12 px, la valeur reléguée en dessous avec une grande
          pastille ronde en vis-à-vis : beaucoup de place occupée pour un seul
          nombre, et le regard partait sur l'icône plutôt que sur le chiffre.
          Désormais le libellé est en casse normale et discret, la valeur porte
          un interlettrage resserré (les grands nombres respirent mal sinon),
          et l'icône devient un carré arrondi plus petit — un repère, pas le
          sujet de la carte. */}
      <div className="flex items-start justify-between gap-[var(--space-admin-3)]">
        <span
          className={cn(
            "flex items-center gap-[var(--space-admin-3)]",
            "text-[length:var(--text-admin-sm)] font-medium",
            "text-[color:var(--color-admin-fg-soft)]",
          )}
        >
          {TONE_DOT[tone] ? (
            <span
              aria-hidden="true"
              className={cn("h-[6px] w-[6px] shrink-0 rounded-full", TONE_DOT[tone])}
            />
          ) : null}
          {label}
        </span>
        {Icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-admin-md)]",
              TONE_PASTILLE[tone],
            )}
          >
            <Icon size={15} />
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-[var(--space-admin-3)]">
        <span
          className={cn(
            "text-[length:var(--text-admin-2xl)] font-semibold tracking-[-0.02em] tabular-nums",
            "text-[color:var(--color-admin-fg)]",
          )}
        >
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              "text-[length:var(--text-admin-sm)] font-medium tabular-nums",
              DELTA_COLOR[deltaTone(delta)],
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      {meta ? (
        <span
          className={cn(
            "text-[length:var(--text-admin-xs)]",
            "text-[color:var(--color-admin-fg-muted)]",
          )}
        >
          {meta}
        </span>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block min-h-[var(--target-admin-min-desktop)] rounded-[var(--radius-admin-md)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-info)] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {content}
      </Link>
    );
  }
  return content;
}
