"use client";
// Actions par ligne du listing messages (Contacts › Messages).
//
// Surface dans le tableau les Server Actions déjà existantes
// (`reply-actions.ts` + `actions.ts`) pour permettre à Will de traiter un
// message sans ouvrir la fiche détail.
//
// Vue normale / archivés :
//   - Archiver / Désarchiver   → archive/unarchiveSubmissionAction
//   - Marquer lu / non-lu      → markNeedsAttentionAction (needsAttention)
//   - Marquer traité           → updateSubmissionAction (status=processed)
//   - Supprimer                → softDeleteSubmissionAction (corbeille, récup.)
//
// Vue Corbeille (deleted) :
//   - Restaurer                → restoreSubmissionAction
//   - Supprimer définitivement → eraseSubmissionAction (RGPD, super_admin,
//     confirmation 2 clics inline)
//
// Client Component minimal : le bouton primaire est toujours visible ; les
// actions secondaires vivent dans un menu <details> natif (zéro dépendance JS,
// budget bundle admin). Après chaque mutation on rafraîchit via router.refresh().

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveSubmissionAction,
  unarchiveSubmissionAction,
  markNeedsAttentionAction,
  softDeleteSubmissionAction,
  restoreSubmissionAction,
} from "@/features/admin-submissions/reply-actions";
import {
  updateSubmissionAction,
  eraseSubmissionAction,
} from "@/features/admin-submissions/actions";

interface Props {
  id: string;
  /** archivedAt != null. */
  archived: boolean;
  /** needsAttention : true = à traiter (non lu). */
  needsAttention: boolean;
  /** status enum courant (new/in_progress/processed/archived). */
  status: string;
  /** deletedAt != null → la ligne est affichée dans l'onglet Corbeille. */
  deleted: boolean;
}

const MENU_ITEM_CLASS =
  "block w-full rounded-[var(--radius-admin-sm)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] hover:bg-[color:var(--color-admin-surface-hover)] disabled:opacity-50";

export function SubmissionRowActions({
  id,
  archived,
  needsAttention,
  status,
  deleted,
}: Props): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmErase, setConfirmErase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  function markProcessed() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", "processed");
    return updateSubmissionAction({ ok: true }, fd);
  }

  function eraseForever() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("reason", "Suppression définitive depuis la corbeille (console admin).");
      const res = await eraseSubmissionAction({ ok: true }, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  // ---- Vue Corbeille ---------------------------------------------------
  if (deleted) {
    return (
      // relative z-[2] : passe AU-DESSUS du lien étiré (z-[1]) de la ligne
      // cliquable (AdminTable rowHref) pour que les boutons captent le clic.
      <div className="relative z-[2] flex flex-col items-end gap-[var(--space-admin-1)]">
        <div className="flex items-center justify-end gap-[var(--space-admin-2)]">
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => restoreSubmissionAction(id))}
            className="admin-button-ghost text-[length:var(--text-admin-sm)]"
            title="Restaurer le message (le sort de la corbeille)"
          >
            ↩︎ Restaurer
          </button>
          {confirmErase ? (
            <button
              type="button"
              disabled={isPending}
              onClick={eraseForever}
              className="admin-button-refuse text-[length:var(--text-admin-sm)]"
              title="Suppression RGPD irréversible"
            >
              Confirmer ?
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmErase(true)}
              className="admin-button-ghost text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]"
              title="Supprimer définitivement (RGPD, irréversible)"
            >
              🗑️ Supprimer définitivement
            </button>
          )}
        </div>
        {error ? (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-danger)]">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  // ---- Vue normale / archivés ------------------------------------------
  return (
    // relative z-[2] : passe AU-DESSUS du lien étiré (z-[1]) de la ligne
    // cliquable (AdminTable rowHref) pour que les boutons captent le clic.
    <div className="relative z-[2] flex items-center justify-end gap-[var(--space-admin-2)]">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          run(() => (archived ? unarchiveSubmissionAction(id) : archiveSubmissionAction(id)))
        }
        className="admin-button-ghost text-[length:var(--text-admin-sm)]"
        title={archived ? "Sortir de l'archive" : "Archiver (réduit le bruit de l'inbox)"}
      >
        {archived ? "↩︎ Désarchiver" : "🗄️ Archiver"}
      </button>

      <details className="relative">
        <summary
          className="admin-button-ghost cursor-pointer list-none text-[length:var(--text-admin-sm)]"
          aria-label="Plus d'actions"
          title="Plus d'actions"
        >
          ⋯
        </summary>
        <div
          className="absolute right-0 z-10 mt-[var(--space-admin-2)] min-w-[12rem] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-2)] shadow-lg"
          role="menu"
        >
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => markNeedsAttentionAction(id, !needsAttention))}
            className={MENU_ITEM_CLASS}
            role="menuitem"
          >
            {needsAttention ? "✅ Marquer comme lu" : "📩 Marquer non lu"}
          </button>
          {status !== "processed" ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(markProcessed)}
              className={MENU_ITEM_CLASS}
              role="menuitem"
            >
              ✔︎ Marquer traité
            </button>
          ) : null}
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => softDeleteSubmissionAction(id))}
            className={`${MENU_ITEM_CLASS} text-[color:var(--color-admin-danger)]`}
            role="menuitem"
            title="Déplacer vers la corbeille (récupérable)"
          >
            🗑️ Supprimer
          </button>
        </div>
      </details>
    </div>
  );
}
