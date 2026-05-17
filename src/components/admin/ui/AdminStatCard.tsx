// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A7 duplication #7 / #14).
//
// Tile KPI : label + value + delta optionnel + lien optionnel.
// Server Component. 19 KPIs dashboard/content-gen/analytics à migrer.

import Link from "next/link";
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
  /** Si fournie, la card devient cliquable (lien vers détail). */
  href?: string;
  className?: string;
}

const TONE_BORDER: Record<StatTone, string> = {
  default: "border-[color:var(--color-admin-border)]",
  success:
    "border-l-4 border-l-[color:var(--color-admin-success)] border-[color:var(--color-admin-border)]",
  warning:
    "border-l-4 border-l-[color:var(--color-admin-warning)] border-[color:var(--color-admin-border)]",
  destructive:
    "border-l-4 border-l-[color:var(--color-admin-destructive)] border-[color:var(--color-admin-border)]",
  info: "border-l-4 border-l-[color:var(--color-admin-info)] border-[color:var(--color-admin-border)]",
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
  href,
  className,
}: AdminStatCardProps): React.ReactElement {
  const content = (
    <div
      className={cn(
        "admin-stat-card flex flex-col gap-[var(--space-admin-2)]",
        "rounded-[var(--radius-admin-md)] border bg-[color:var(--color-admin-paper)]",
        "p-[var(--space-admin-5)] shadow-[var(--shadow-admin-1)]",
        TONE_BORDER[tone],
        href && "transition-shadow hover:shadow-[var(--shadow-admin-2)]",
        className,
      )}
    >
      <span
        className={cn(
          "text-[length:var(--text-admin-xs)] font-semibold tracking-wide uppercase",
          "text-[color:var(--color-admin-fg-muted)]",
        )}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-[var(--space-admin-3)]">
        <span
          className={cn(
            "text-[length:var(--text-admin-2xl)] font-semibold tabular-nums",
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
