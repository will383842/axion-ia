// Refonte admin mai 2026 — PR 2 (ADR 0028, audit A2 critère 10).
//
// Card admin (vs <Card> public éditorial p-7) : padding dense, radius
// admin, shadow elevation subtle. 3 variants : compact / informational /
// interactive.

import { cn } from "@/lib/utils";

interface AdminCardProps {
  children: React.ReactNode;
  /**
   * - "compact" : padding 12px (tables, listes inline).
   * - "informational" (default) : padding 16px (KPIs, contenu général).
   * - "interactive" : padding 16px + hover lift (action card cliquable).
   */
  variant?: "compact" | "informational" | "interactive";
  /** Niveau d'élévation visuelle. Default 1 (subtle). */
  elevation?: 1 | 2 | 3;
  /** Si fournie, la carte devient cliquable (link wrapper côté consumer). */
  as?: "div" | "article" | "section";
  className?: string;
}

// P2 respiration juin 2026 — informational/interactive 16→20px (token
// --space-admin-card) ; compact reste à 12px (listes/tables inline denses).
const PADDING_CLASS: Record<NonNullable<AdminCardProps["variant"]>, string> = {
  compact: "p-[var(--space-admin-5,12px)]",
  informational: "p-[var(--space-admin-card,20px)]",
  interactive:
    "p-[var(--space-admin-card,20px)] transition-shadow hover:shadow-[var(--shadow-admin-3)]",
};

const ELEVATION_CLASS: Record<NonNullable<AdminCardProps["elevation"]>, string> = {
  1: "shadow-[var(--shadow-admin-1)]",
  2: "shadow-[var(--shadow-admin-2)]",
  3: "shadow-[var(--shadow-admin-3)]",
};

export function AdminCard({
  children,
  variant = "informational",
  elevation = 1,
  as: Tag = "div",
  className,
}: AdminCardProps): React.ReactElement {
  return (
    <Tag
      className={cn(
        "admin-card-v2",
        "rounded-[var(--radius-admin-md,6px)]",
        "border border-[color:var(--color-admin-border)]",
        "bg-[color:var(--color-admin-paper)]",
        PADDING_CLASS[variant],
        ELEVATION_CLASS[elevation],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
