// Refonte admin mai 2026 — PR 3 (ADR 0028, audit A6 finding #4 — CLS).
//
// Skeleton avec dimensions exactes pour éliminer le CLS sur tables, cards,
// stat-grid et detail headers. Server Component pur (animation CSS-only).
//
// 5 variants couvrant 95 % des usages admin.

import { cn } from "@/lib/utils";

interface AdminLoadingStateProps {
  variant?: "table" | "card" | "stat-grid" | "detail-header" | "form";
  /** Nb de rangées/cartes (default 5 table, 3 card, 4 stat-grid). */
  count?: number;
  /** Nb de colonnes (table uniquement). */
  cols?: number;
  /** Override aria-label pour le bloc d'attente. */
  ariaLabel?: string;
  className?: string;
  /**
   * Lot 4 — ce bloc d'attente doit-il être ANNONCÉ au lecteur d'écran ?
   *
   * `true` (défaut) : région live (`role=status`, qui implique
   * `aria-live=polite`). C'est le bon réglage pour une frontière de ROUTE
   * (`loading.tsx`) : en App Router, une navigation n'affiche qu'une seule
   * frontière — la plus proche du segment qui change — donc une seule voix.
   *
   * `false` : `aria-busy` seul, aucune région live. Pour les SECTIONS
   * multiples d'une même page, où plusieurs attentes coexistent à l'écran.
   *
   * 🔴 Pourquoi ce drapeau existe. Le plan (Lot 4) pose comme critère de sortie
   * « *au lecteur d'écran, le chargement du hub est annoncé UNE fois, pas
   * cinq* ». Or ce composant posait `aria-live` sans condition : le jour où
   * l'on découpe le hub en cinq sections suspendues — l'objet même du lot —
   * le lecteur les énonce toutes les cinq. Le défaut n'existait pas encore ;
   * il serait NÉ du lot. Le remède n'est pas de renoncer au découpage, c'est
   * de ne laisser qu'une voix.
   */
  announce?: boolean;
}

export function AdminLoadingState({
  variant = "card",
  count,
  cols,
  ariaLabel = "Chargement en cours",
  className,
  announce = true,
}: AdminLoadingStateProps): React.ReactElement {
  return (
    <div
      // `role=status` implique déjà `aria-live=polite` : les deux ne partent
      // qu'ensemble, sinon un lecteur d'écran annoncerait quand même.
      {...(announce ? ({ role: "status", "aria-live": "polite" } as const) : {})}
      // Muet ou non, l'état d'occupation reste exposé : c'est lui qui dit à la
      // technologie d'assistance que la zone n'est pas vide par erreur. Ce
      // qu'on retire, c'est l'ANNONCE, pas l'information.
      aria-busy="true"
      aria-label={ariaLabel}
      className={cn("admin-loading-state", className)}
    >
      {announce ? <span className="sr-only">{ariaLabel}</span> : null}
      {variant === "table" ? <TableSkeleton rows={count ?? 5} cols={cols ?? 6} /> : null}
      {variant === "card" ? <CardListSkeleton count={count ?? 3} /> : null}
      {variant === "stat-grid" ? <StatGridSkeleton count={count ?? 4} /> : null}
      {variant === "detail-header" ? <DetailHeaderSkeleton /> : null}
      {variant === "form" ? <FormSkeleton count={count ?? 4} /> : null}
    </div>
  );
}

// Bloc shimmer — pulse animation (reduced-motion respecté via admin.css media query).
const SHIMMER =
  "animate-pulse bg-[color:var(--color-admin-border)] rounded-[var(--radius-admin-sm)]";

function TableSkeleton({ rows, cols }: { rows: number; cols: number }): React.ReactElement {
  return (
    <div className="w-full overflow-hidden rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
      {/* Header */}
      <div className="flex gap-[var(--space-admin-4)] border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper-alt)] px-[var(--space-admin-5)] py-[var(--space-admin-4)]">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={cn(SHIMMER, "h-3 flex-1")} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex gap-[var(--space-admin-4)] border-b border-[color:var(--color-admin-border)] px-[var(--space-admin-5)] py-[var(--space-admin-5)] last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={cn(SHIMMER, "h-4 flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardListSkeleton({ count }: { count: number }): React.ReactElement {
  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-6)]"
        >
          <div className={cn(SHIMMER, "mb-[var(--space-admin-3)] h-4 w-1/3")} />
          <div className={cn(SHIMMER, "mb-[var(--space-admin-2)] h-3 w-2/3")} />
          <div className={cn(SHIMMER, "h-3 w-1/2")} />
        </div>
      ))}
    </div>
  );
}

function StatGridSkeleton({ count }: { count: number }): React.ReactElement {
  return (
    <div
      className="grid gap-[var(--space-admin-5)]"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
          style={{ minHeight: 88 }}
        >
          <div className={cn(SHIMMER, "mb-[var(--space-admin-3)] h-3 w-1/2")} />
          <div className={cn(SHIMMER, "h-6 w-3/4")} />
        </div>
      ))}
    </div>
  );
}

function DetailHeaderSkeleton(): React.ReactElement {
  return (
    <div className="mb-[var(--space-admin-7)] border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-6)]">
      <div className={cn(SHIMMER, "mb-[var(--space-admin-3)] h-3 w-40")} />
      <div className={cn(SHIMMER, "mb-[var(--space-admin-3)] h-5 w-1/2")} />
      <div className={cn(SHIMMER, "h-3 w-1/3")} />
    </div>
  );
}

function FormSkeleton({ count }: { count: number }): React.ReactElement {
  return (
    <div className="flex flex-col gap-[var(--space-admin-6)]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className={cn(SHIMMER, "mb-[var(--space-admin-3)] h-3 w-32")} />
          <div className={cn(SHIMMER, "h-10 w-full")} />
        </div>
      ))}
    </div>
  );
}
