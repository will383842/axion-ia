"use client";
// use-client: state edit/saving + keyboard handlers (Enter/Escape, browser-only).
//
// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A8 #7).
//
// Edit in-place : clic icone pen → input → Enter sauve / ESC annule.
// Optimistic update via useOptimistic possible côté consumer.

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface AdminInlineEditProps {
  label?: string;
  value: string;
  /** Action serveur appelée au save. Doit gérer optimistic côté consumer. */
  onSave: (next: string) => void | Promise<void>;
  /** Placeholder quand vide. */
  placeholder?: string;
  /** Désactive l'édition (mode lecture seule). */
  disabled?: boolean;
  className?: string;
}

export function AdminInlineEdit({
  label,
  value,
  onSave,
  placeholder = "—",
  disabled = false,
  className,
}: AdminInlineEditProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Lint react-hooks/set-state-in-effect : on diffère le sync external→local
  // hors du corps synchrone (microtask) pour ne pas remonter setState
  // pendant le commit. Comportement inchangé : `draft` reflète `value` au
  // prochain tick (suffisant — l'utilisateur est en mode lecture entre les
  // syncs externes).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setDraft(value);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const commit = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setPending(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setPending(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className={cn(
          "admin-inline-edit-view inline-flex items-center gap-[var(--space-admin-2)]",
          "min-h-[var(--target-admin-min-desktop)]",
          "text-[color:var(--color-admin-fg)] hover:bg-[color:var(--color-admin-surface-hover)]",
          "rounded-[var(--radius-admin-sm)] px-[var(--space-admin-2)]",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
        aria-label={label ? `Modifier ${label}` : "Modifier"}
      >
        {value || <span className="text-[color:var(--color-admin-fg-muted)]">{placeholder}</span>}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "admin-inline-edit-edit flex items-center gap-[var(--space-admin-2)]",
        className,
      )}
    >
      {/* Le libellé n'existait que comme TEXTE voisin en `sr-only` : lu par un
          lecteur d'écran comme une phrase isolée, il ne nommait pas le champ
          pour autant. Porté par `aria-label`, il devient le nom du contrôle. */}
      <input
        {...(label ? { "aria-label": label } : {})}
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={() => void commit()}
        disabled={pending}
        className="admin-input"
        aria-busy={pending}
      />
    </div>
  );
}
