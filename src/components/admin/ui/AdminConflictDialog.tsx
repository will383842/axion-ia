"use client";
// use-client: dialog interactif (modal, state, browser-only HTMLDialogElement).
//
// Refonte admin mai 2026 — mitigation §3.7 master prompt (PR 1).
//
// Pourquoi ce composant :
//   Will ouvre la même Publication / Reservation / Devis / Facture dans
//   2 onglets et édite dans les 2. Sans protection : dernier write gagne
//   silencieusement, modifs externes écrasées.
//
// Pattern d'usage (PR 6+ par ressource) :
//   1. La page d'édition reçoit la ressource avec son `updatedAt` Prisma.
//   2. Le form envoie `updatedAt` original dans le payload Server Action.
//   3. L'action compare avant write :
//      - Si `db.updatedAt > payload.updatedAt` → retourne
//        `{ conflict: true, serverVersion: db }`.
//      - Sinon write normal.
//   4. Le form, à réception du conflict, ouvre `<AdminConflictDialog>`.
//   5. L'utilisateur choisit : Écraser / Voir le diff / Annuler.

import { useEffect, useRef } from "react";

interface AdminConflictDialogProps {
  open: boolean;
  /** Date de modification serveur (plus récente que la version éditée). */
  serverUpdatedAt: Date | string;
  /** Date de modification locale (envoyée par le form). */
  localUpdatedAt: Date | string;
  /** Confirme l'écrasement → reprend write avec nouveau updatedAt = serveur. */
  onOverride: () => void;
  /** Ouvre une vue diff (preview/compare, à fournir par le consumer). */
  onShowDiff?: () => void;
  /** Annule la sauvegarde et garde l'état local éditable. */
  onCancel: () => void;
  /** Nom lisible de la ressource ("la publication", "la réservation"). */
  resourceLabel?: string;
}

export function AdminConflictDialog({
  open,
  serverUpdatedAt,
  localUpdatedAt,
  onOverride,
  onShowDiff,
  onCancel,
  resourceLabel = "cette ressource",
}: AdminConflictDialogProps): React.ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (open && !dialogRef.current.open) {
      dialogRef.current.showModal();
      // Return focus à un bouton sûr (Cancel) à l'ouverture
      cancelBtnRef.current?.focus();
    } else if (!open && dialogRef.current.open) {
      dialogRef.current.close();
    }
  }, [open]);

  if (!open) return null;

  const fmt = (d: Date | string) =>
    new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

  return (
    <dialog
      ref={dialogRef}
      className="admin-conflict-modal"
      aria-labelledby="admin-conflict-title"
      aria-describedby="admin-conflict-desc"
      onClose={onCancel}
    >
      <h2 id="admin-conflict-title" style={{ marginTop: 0 }}>
        Modifications externes détectées
      </h2>
      <p id="admin-conflict-desc">
        Quelqu&apos;un (ou un autre onglet) a modifié {resourceLabel} entre votre dernière ouverture
        et maintenant.
      </p>
      <ul style={{ fontSize: 13, color: "var(--color-admin-fg-soft)", lineHeight: 1.5 }}>
        <li>
          Version serveur : <strong>{fmt(serverUpdatedAt)}</strong>
        </li>
        <li>
          Votre version : <strong>{fmt(localUpdatedAt)}</strong>
        </li>
      </ul>
      <p>Que voulez-vous faire ?</p>
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button ref={cancelBtnRef} type="button" onClick={onCancel} className="admin-button-ghost">
          Annuler
        </button>
        {onShowDiff ? (
          <button type="button" onClick={onShowDiff} className="admin-button-ghost">
            Voir le diff
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOverride}
          className="admin-button"
          aria-label="Écraser la version serveur avec mes modifications"
        >
          Écraser
        </button>
      </div>
    </dialog>
  );
}
