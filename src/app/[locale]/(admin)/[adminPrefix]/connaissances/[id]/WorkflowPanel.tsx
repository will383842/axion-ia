"use client";
// use-client: form interactif (useActionState pour chaque transition workflow).
//
// KB-4.1 — Panneau workflow embedded dans ConnaissancesEditForm.
// Boutons contextuels selon `KbStatus` actuel + user role.
//
// Spec : `_AUDIT/KNOWLEDGE-BASE-2026/08-WORKFLOW-VERSIONING.md` §1.1.

import { useActionState } from "react";
import { submitForReviewAction } from "@/server/actions/knowledge/submit-for-review";
import { approveAction, rejectReviewAction } from "@/server/actions/knowledge/approve";
import { publishAction } from "@/server/actions/knowledge/publish";
import { schedulePublishAction } from "@/server/actions/knowledge/schedule-publish";
import { unpublishAction } from "@/server/actions/knowledge/unpublish";
import { archiveAction } from "@/server/actions/knowledge/archive";
import { restoreAction } from "@/server/actions/knowledge/restore";
import { getStatusLabel, getPipelineStageLabel } from "@/content/knowledge/statuses";
import type { KbStatus, KbPipelineStage } from "../../../../../../../prisma/generated/client";
import { messageErreurKb } from "@/server/knowledge/erreurs-labels";

interface Props {
  readonly entryId: string;
  readonly status: KbStatus;
  readonly pipelineStage: KbPipelineStage;
  readonly userRole: string;
}

// Helpers de submit form (capturent l'entryId via hidden input).
async function submitReviewSubmit(_p: unknown, fd: FormData) {
  return submitForReviewAction({ id: String(fd.get("entryId") ?? "") });
}
async function approveSubmit(_p: unknown, fd: FormData) {
  return approveAction({
    id: String(fd.get("entryId") ?? ""),
    reviewerNote: String(fd.get("reviewerNote") ?? "") || null,
  });
}
async function rejectSubmit(_p: unknown, fd: FormData) {
  return rejectReviewAction({
    id: String(fd.get("entryId") ?? ""),
    rejectionReason: String(fd.get("rejectionReason") ?? "") || null,
  });
}
async function publishSubmit(_p: unknown, fd: FormData) {
  return publishAction({ id: String(fd.get("entryId") ?? "") });
}
async function scheduleSubmit(_p: unknown, fd: FormData) {
  return schedulePublishAction({
    id: String(fd.get("entryId") ?? ""),
    scheduledFor: String(fd.get("scheduledFor") ?? ""),
  });
}
async function unpublishSubmit(_p: unknown, fd: FormData) {
  return unpublishAction({ id: String(fd.get("entryId") ?? "") });
}
async function archiveSubmit(_p: unknown, fd: FormData) {
  return archiveAction({ id: String(fd.get("entryId") ?? "") });
}
async function restoreSubmit(_p: unknown, fd: FormData) {
  return restoreAction({ id: String(fd.get("entryId") ?? "") });
}

function isOwner(role: string): boolean {
  return role === "super_admin";
}
function isEditor(role: string): boolean {
  return role === "super_admin" || role === "admin" || role === "editor";
}

export function WorkflowPanel({ entryId, status, pipelineStage, userRole }: Props) {
  const [submitState, submitAction, submitPending] = useActionState(submitReviewSubmit, null);
  const [approveState, approveActionForm, approvePending] = useActionState(approveSubmit, null);
  const [rejectState, rejectActionForm, rejectPending] = useActionState(rejectSubmit, null);
  const [pubState, pubAction, pubPending] = useActionState(publishSubmit, null);
  const [schedState, schedAction, schedPending] = useActionState(scheduleSubmit, null);
  const [unpubState, unpubAction, unpubPending] = useActionState(unpublishSubmit, null);
  const [archState, archAction, archPending] = useActionState(archiveSubmit, null);
  const [restState, restAction, restPending] = useActionState(restoreSubmit, null);

  const canEdit = isEditor(userRole);
  const canOwn = isOwner(userRole);

  return (
    <aside className="admin-card admin-workflow-panel">
      <h2 className="admin-h2">Workflow</h2>
      <p className="admin-meta">
        Statut : <strong>{getStatusLabel(status, "fr")}</strong> · Pipeline :{" "}
        <strong>{getPipelineStageLabel(pipelineStage, "fr")}</strong>
      </p>

      {/* draft → review : EDITOR+ */}
      {status === "draft" && canEdit ? (
        <form action={submitAction} className="admin-workflow-action">
          <input type="hidden" name="entryId" value={entryId} />
          <button type="submit" disabled={submitPending} className="admin-button">
            {submitPending ? "Envoi…" : "Soumettre en revue"}
          </button>
          {submitState?.ok ? <p className="admin-success">Soumise en revue</p> : null}
          {submitState?.error && submitState.error !== "validation" ? (
            <p className="admin-error">{messageErreurKb(submitState.error, submitState.reason)}</p>
          ) : null}
        </form>
      ) : null}

      {/* review → approved : REVIEWER (≠ author) */}
      {status === "review" && canEdit ? (
        <>
          <form action={approveActionForm} className="admin-workflow-action">
            <input type="hidden" name="entryId" value={entryId} />
            <label className="admin-label" htmlFor="reviewerNote-input">
              Note reviewer (optionnel)
            </label>
            <textarea
              id="reviewerNote-input"
              name="reviewerNote"
              className="admin-input"
              maxLength={2000}
              rows={2}
            />
            <button type="submit" disabled={approvePending} className="admin-button">
              {approvePending ? "Validation…" : "Approuver"}
            </button>
            {approveState?.ok ? <p className="admin-success">Approuvée</p> : null}
            {approveState?.error === "transition_refused" &&
            approveState.reason === "must_differ_from_author" ? (
              <p className="admin-error">Vous ne pouvez pas approuver votre propre contenu</p>
            ) : null}
            {approveState?.error &&
            approveState.error !== "validation" &&
            approveState.error !== "transition_refused" ? (
              <p className="admin-error">{messageErreurKb(approveState.error)}</p>
            ) : null}
          </form>
          <form action={rejectActionForm} className="admin-workflow-action">
            <input type="hidden" name="entryId" value={entryId} />
            <label className="admin-label" htmlFor="rejectReason-input">
              Motif de rejet (optionnel)
            </label>
            <textarea
              id="rejectReason-input"
              name="rejectionReason"
              className="admin-input"
              maxLength={2000}
              rows={2}
            />
            <button type="submit" disabled={rejectPending} className="admin-button-ghost">
              {rejectPending ? "Rejet…" : "Rejeter vers brouillon"}
            </button>
            {rejectState?.ok ? <p className="admin-success">Rejetée, retour brouillon</p> : null}
          </form>
        </>
      ) : null}

      {/* approved → published OR scheduled : EDITOR+ */}
      {status === "approved" && canEdit ? (
        <>
          <form action={pubAction} className="admin-workflow-action">
            <input type="hidden" name="entryId" value={entryId} />
            <button type="submit" disabled={pubPending} className="admin-button">
              {pubPending ? "Publication…" : "Publier maintenant"}
            </button>
            {pubState?.ok ? <p className="admin-success">Publiée</p> : null}
          </form>
          <form action={schedAction} className="admin-workflow-action">
            <input type="hidden" name="entryId" value={entryId} />
            <label className="admin-label" htmlFor="scheduledFor-input">
              Programmer pour
            </label>
            <input
              id="scheduledFor-input"
              name="scheduledFor"
              type="datetime-local"
              className="admin-input"
              required
            />
            <button type="submit" disabled={schedPending} className="admin-button-ghost">
              {schedPending ? "Planification…" : "Programmer"}
            </button>
            {schedState?.ok ? <p className="admin-success">Programmée</p> : null}
            {schedState?.error === "validation" ? (
              <p className="admin-error">Date invalide (doit être dans le futur)</p>
            ) : null}
          </form>
        </>
      ) : null}

      {/* published → archived : OWNER */}
      {status === "published" && canOwn ? (
        <form action={unpubAction} className="admin-workflow-action">
          <input type="hidden" name="entryId" value={entryId} />
          <button type="submit" disabled={unpubPending} className="admin-button-ghost">
            {unpubPending ? "Dépublication…" : "Dépublier (archive)"}
          </button>
          {unpubState?.ok ? <p className="admin-success">Dépubliée</p> : null}
        </form>
      ) : null}

      {/* archived → draft : OWNER (restore) */}
      {(status === "archived" || status === "deprecated") && canOwn ? (
        <form action={restAction} className="admin-workflow-action">
          <input type="hidden" name="entryId" value={entryId} />
          <button type="submit" disabled={restPending} className="admin-button">
            {restPending
              ? "Restauration…"
              : status === "deprecated"
                ? "Republier"
                : "Restaurer en brouillon"}
          </button>
          {restState?.ok ? <p className="admin-success">Restaurée</p> : null}
        </form>
      ) : null}

      {/* Archive global (toujours possible pour OWNER sauf si déjà archivée) */}
      {status !== "archived" && canOwn ? (
        <form action={archAction} className="admin-workflow-action admin-workflow-danger">
          <input type="hidden" name="entryId" value={entryId} />
          <button type="submit" disabled={archPending} className="admin-button-danger">
            {archPending ? "Archivage…" : "Archiver de force"}
          </button>
          <p className="admin-meta-small">Réservé au propriétaire du contenu.</p>
          {archState?.ok ? <p className="admin-success">Archivée</p> : null}
          {archState?.error === "transition_refused" ? (
            <p className="admin-error">Transition refusée : {archState.reason}</p>
          ) : null}
        </form>
      ) : null}

      {!canEdit && !canOwn ? (
        <p className="admin-meta">
          Lecture seule — votre rôle ne permet pas de modifier le workflow.
        </p>
      ) : null}
    </aside>
  );
}
