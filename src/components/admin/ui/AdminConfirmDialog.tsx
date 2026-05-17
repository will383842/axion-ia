"use client";
// use-client: HTMLDialogElement showModal + state + keydown ESC (browser).
//
// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A7 #5).
//
// Modal de confirmation, 2 modes : standard (1 clic) ou destructive
// (require-type pour confirmation 2-step). ESC ferme, return focus
// au trigger.

import { useEffect, useRef, useState } from "react";

interface AdminConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Si destructive ET fourni, l'utilisateur doit taper exactement cette
   * chaîne pour activer le bouton confirm (ex. "SUPPRIMER").
   */
  requireTypeToConfirm?: string;
  onConfirm: () => void | Promise<void>;
}

export function AdminConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  destructive = false,
  confirmLabel,
  cancelLabel = "Annuler",
  requireTypeToConfirm,
  onConfirm,
}: AdminConfirmDialogProps): React.ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const [typedValue, setTypedValue] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (open && !dialogRef.current.open) {
      dialogRef.current.showModal();
      cancelBtnRef.current?.focus();
    } else if (!open && dialogRef.current.open) {
      dialogRef.current.close();
    }
  }, [open]);

  useEffect(() => {
    // Lint react-hooks/set-state-in-effect : defer microtask.
    if (open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setTypedValue("");
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const canConfirm = !pending && (!requireTypeToConfirm || typedValue === requireTypeToConfirm);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="admin-confirm-modal"
      aria-labelledby="admin-confirm-title"
      aria-describedby="admin-confirm-desc"
      onClose={() => onOpenChange(false)}
    >
      <h2 id="admin-confirm-title" style={{ marginTop: 0 }}>
        {title}
      </h2>
      <p id="admin-confirm-desc">{description}</p>
      {destructive && requireTypeToConfirm ? (
        <div style={{ marginTop: 16 }}>
          <label
            htmlFor="admin-confirm-type-input"
            style={{
              display: "block",
              fontSize: 12,
              marginBottom: 4,
              color: "var(--color-admin-fg-soft)",
            }}
          >
            Tapez <strong>{requireTypeToConfirm}</strong> pour confirmer
          </label>
          <input
            id="admin-confirm-type-input"
            type="text"
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            className="admin-input"
            aria-required="true"
            autoFocus
          />
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button
          ref={cancelBtnRef}
          type="button"
          onClick={() => onOpenChange(false)}
          className="admin-button-ghost"
          disabled={pending}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={!canConfirm}
          className={destructive ? "admin-button-refuse" : "admin-button"}
          aria-busy={pending}
        >
          {pending ? "Patientez…" : (confirmLabel ?? (destructive ? "Supprimer" : "Confirmer"))}
        </button>
      </div>
    </dialog>
  );
}
