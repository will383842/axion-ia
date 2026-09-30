"use client";
// use-client: actions par ligne interactives (menu, confirmation, useTransition).
// Actions par ligne du listing messages (Contacts › Messages).
//
// Surface dans le tableau les Server Actions déjà existantes
// (`reply-actions.ts` + `actions.ts`) pour permettre à Will de traiter un
// message sans ouvrir la fiche détail.
//
// Vue normale / archivés :
//   - Archiver / Désarchiver   → archive/unarchiveSubmissionAction
//   - Marquer lu / non-lu      → markNeedsAttentionAction (needsAttention)
//   - Marquer traité           → marquerTraiteAction (table des transitions)
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
  classerSansSuiteAction,
  marquerPretASignerAction,
  remettreATraiterAction,
  marquerTraiteAction,
  markNeedsAttentionAction,
  softDeleteSubmissionAction,
  restoreSubmissionAction,
} from "@/features/admin-submissions/reply-actions";
import { eraseSubmissionAction } from "@/features/admin-submissions/actions";
import type { ErreurPretASigner } from "@/features/admin-submissions/transitions";
import { MoreHorizontal, Undo2 } from "lucide-react";

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
  /** details.sansSuiteAt != null → la fiche a été écartée, pas seulement rangée. */
  sansSuite: boolean;
  /**
   * La ligne est un dossier APPORTEUR (`estApporteur`) : seul lui peut être dit
   * « prêt à signer ». Le serveur le revérifie — ce booléen ne décide de rien.
   */
  apporteur: boolean;
  /** details.pretASignerAt != null → le candidat a déjà été transmis à Axion Partners. */
  pretASigner: boolean;
  /** Le canal Partners est ouvert : sans lui, « Prêt à signer » n'est pas proposé. */
  transmissionOuverte: boolean;
}

/** Ce que l'écran dit d'un refus de « prêt à signer » — en clair, jamais un code. */
const MOTIF_PRET_A_SIGNER: Readonly<Record<ErreurPretASigner, string>> = {
  non_apporteur: "Seul un dossier apporteur peut être transmis pour signature.",
  sans_suite: "Fiche classée sans suite : la remettre à traiter avant de la transmettre.",
  effacee: "Fiche à la corbeille : elle ne peut plus être transmise.",
  introuvable: "Fiche introuvable.",
  charge_illisible:
    "Le dossier est incomplet (score ou réponses illisibles) : rien n'a été transmis.",
  interdit: "Votre rôle ne permet pas ce geste.",
  db: "La transmission a échoué, rien n'a été enregistré. Réessayer.",
  canal_ferme:
    "La transmission vers Axion Partners n'est pas encore ouverte : rien n'a été enregistré.",
};

const MENU_ITEM_CLASS =
  "block w-full rounded-[var(--radius-admin-sm)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] hover:bg-[color:var(--color-admin-surface-hover)] disabled:opacity-50";

export function SubmissionRowActions({
  id,
  archived,
  needsAttention,
  status,
  deleted,
  sansSuite,
  apporteur,
  pretASigner,
  transmissionOuverte,
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

  // Passe par la table des transitions, comme les cinq autres gestes : le
  // formulaire général écrivait d'autres colonnes au passage.
  function markProcessed() {
    return marquerTraiteAction(id);
  }

  // « Prêt à signer » : le seul geste de la ligne qui peut être REFUSÉ par le
  // serveur pour une raison que l'admin doit lire (dossier incomplet…).
  function transmettrePourSignature() {
    setError(null);
    startTransition(async () => {
      const res = await marquerPretASignerAction(id);
      if (!res.ok) {
        setError(MOTIF_PRET_A_SIGNER[res.erreur ?? "db"]);
        return;
      }
      router.refresh();
    });
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
            className="admin-button-ghost admin-button-sm"
            title="Restaurer le message (le sort de la corbeille)"
          >
            <Undo2 size={14} aria-hidden="true" className="inline-block align-[-0.125em]" />{" "}
            Restaurer
          </button>
          {confirmErase ? (
            <button
              type="button"
              disabled={isPending}
              onClick={eraseForever}
              className="admin-button-refuse admin-button-sm"
              title="Suppression RGPD irréversible"
            >
              Confirmer ?
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmErase(true)}
              className="admin-button-ghost admin-button-ghost-danger"
              title="Supprimer définitivement (RGPD, irréversible)"
            >
              Supprimer définitivement
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
        className="admin-button-ghost admin-button-sm"
        title={archived ? "Sortir de l'archive" : "Archiver (réduit le bruit de l'inbox)"}
      >
        {archived ? (
          <>
            <Undo2 size={14} aria-hidden="true" className="inline-block align-[-0.125em]" />{" "}
            Désarchiver
          </>
        ) : (
          "Archiver"
        )}
      </button>

      <details className="relative">
        <summary
          className="admin-button-ghost admin-button-sm cursor-pointer list-none"
          aria-label="Plus d'actions"
          title="Plus d'actions"
        >
          <MoreHorizontal size={16} aria-hidden="true" />
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
            {needsAttention ? "Marquer comme lu" : "Marquer non lu"}
          </button>
          {status !== "processed" ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(markProcessed)}
              className={MENU_ITEM_CLASS}
              role="menuitem"
            >
              Marquer traité
            </button>
          ) : null}
          {/* « Prêt à signer » : l'autre issue de la décision, à côté de « Sans
              suite ». Le clic transmet le candidat à Axion Partners (ADR 0051
              §c) ; il n'est offert ni hors d'un dossier apporteur, ni sur une
              fiche écartée, ni deux fois. */}
          {apporteur && transmissionOuverte && !sansSuite && !pretASigner ? (
            <button
              type="button"
              disabled={isPending}
              onClick={transmettrePourSignature}
              className={MENU_ITEM_CLASS}
              role="menuitem"
              title="Transmet le candidat à Axion Partners, pour la signature du contrat"
            >
              Prêt à signer
            </button>
          ) : null}
          {/* « Sans suite » et « Remettre à traiter » sont le MEME axe, dans les
              deux sens : on n'offre jamais les deux à la fois. Le premier clot
              (et retire les relances en attente), le second rouvre. */}
          {sansSuite ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => remettreATraiterAction(id))}
              className={MENU_ITEM_CLASS}
              role="menuitem"
              title="La fiche redevient visible dans « à traiter »"
            >
              Remettre à traiter
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => classerSansSuiteAction(id))}
              className={MENU_ITEM_CLASS}
              role="menuitem"
              title="On ne donne pas suite : les relances en attente sont retirées"
            >
              Classer sans suite
            </button>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => softDeleteSubmissionAction(id))}
            className={`${MENU_ITEM_CLASS} text-[color:var(--color-admin-danger)]`}
            role="menuitem"
            title="Déplacer vers la corbeille (récupérable)"
          >
            Supprimer
          </button>
        </div>
      </details>
      {error ? (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-danger)]"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
