// Refonte admin mai 2026 — PR 4 (ADR 0028).
//
// Rendu visuel pour raccourcis clavier (⌘ K, ESC, etc.).
// Server Component pur.

import { cn } from "@/lib/utils";

interface AdminKeyboardHintProps {
  /** Touches séparées par + ou , (ex: "⌘+K", "Ctrl+Shift+S"). */
  keys: string;
  className?: string;
}

export function AdminKeyboardHint({ keys, className }: AdminKeyboardHintProps): React.ReactElement {
  const parts = keys
    .split(/(\+|,)/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <span
      className={cn(
        "admin-keyboard-hint inline-flex items-center gap-[var(--space-admin-1)]",
        className,
      )}
      aria-hidden="true"
    >
      {parts.map((part, i) => {
        if (part === "+" || part === ",") {
          return (
            <span
              key={i}
              className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
            >
              {part === "," ? "," : "+"}
            </span>
          );
        }
        return (
          <kbd
            key={i}
            className={cn(
              "inline-flex min-w-[20px] items-center justify-center",
              "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)]",
              "bg-[color:var(--color-admin-paper-alt)]",
              "px-[var(--space-admin-2)]",
              "text-[length:var(--text-admin-xs)] font-medium",
              "text-[color:var(--color-admin-fg-soft)]",
            )}
          >
            {part}
          </kbd>
        );
      })}
    </span>
  );
}
