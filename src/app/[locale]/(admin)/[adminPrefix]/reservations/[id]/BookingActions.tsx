"use client";
// use-client: useActionState pour 9 actions admin booking (Sprint X.8 + Sprint A).
//
// Actions exposées dynamiquement selon le status :
//   - sendContractAndDepositRequestFormAction (D49 clic 1 — Sprint A)
//   - validateOnCalendarFormAction (D49 clic 2 — si awaiting_admin_validation)
//   - cancelBookingFormAction (Sprint A — annulation admin + refund)
//   - pauseBookingFormAction (D61 — si confirmed)
//   - resumeBookingFormAction (D61 — si paused)
//   - markCompletedFormAction (si in_progress)
//   - markNoShowFormAction (super_admin only — si confirmed)
//   - markForceMajeureFormAction (super_admin only — quasi tous status actifs)
//
// Conventions :
//   - Chaque sous-formulaire = 1 useActionState dédié
//   - Le bloc se "compresse" après succès (rendu remplacé par un message)
//   - Reasons / notes obligatoires affichées en textarea, validées côté action

import { useActionState, useState } from "react";
import {
  validateOnCalendarFormAction,
  pauseBookingFormAction,
  resumeBookingFormAction,
  markCompletedFormAction,
  markNoShowFormAction,
  markForceMajeureFormAction,
  type BookingFormState,
} from "@/features/booking/admin-form-actions";
import {
  sendContractAndDepositRequestFormAction,
  cancelAndReissueContractFormAction,
  createContractAddendumFormAction,
} from "@/features/contract/admin-form-actions";
import {
  CONTRACT_FORM_INITIAL,
  type ContractFormState,
} from "@/features/contract/admin-form-state";
import { cancelBookingFormAction } from "@/features/booking/refund-form-actions";
import { CANCEL_BOOKING_FORM_INITIAL } from "@/features/booking/refund-form-state";
import { overrideBookingScheduleFormAction } from "@/features/payment-schedule/admin-form-actions";
import {
  SCHEDULE_FORM_INITIAL,
  type ScheduleFormState,
} from "@/features/payment-schedule/admin-form-state";
import type { BookingStatus, ContractStatus } from "../../../../../../../prisma/generated/client";

interface ActiveContract {
  id: string;
  status: ContractStatus;
  version: number;
  isAddendum: boolean;
}

interface Props {
  bookingId: string;
  status: BookingStatus;
  adminPrefix: string;
  role: string;
  /** ContractDocument actif (si présent) — utilisé pour exposer cancel-and-reissue
   *  ou create-addendum selon ContractStatus. */
  activeContract?: ActiveContract | null;
  /** True si un contrat principal (non-avenant) a été signé sur ce booking. */
  hasSignedMainContract?: boolean;
}

const initial: BookingFormState = { ok: false };

const ACTIVE_STATUSES: BookingStatus[] = [
  "contract_pending",
  "contract_payment_sent",
  "awaiting_admin_validation",
  "confirmed",
  "paused",
  "in_progress",
  "reminded_j7",
];

const PRE_CONTRACT_STATUSES: BookingStatus[] = [
  "option_pending",
  "cadrage_held",
  "quote_signed",
  "contract_pending",
];

const CANCELLABLE_STATUSES: BookingStatus[] = [
  "option_pending",
  "cadrage_scheduled",
  "cadrage_held",
  "quote_required",
  "quote_sent",
  "quote_signed",
  "contract_pending",
  "contract_payment_sent",
  "awaiting_admin_validation",
  "confirmed",
  "paused",
];

export function BookingActions({
  bookingId,
  status,
  adminPrefix,
  role,
  activeContract,
  hasSignedMainContract,
}: Props) {
  const isSuperAdmin = role === "super_admin";
  const canWrite = role === "super_admin" || role === "admin";

  if (!canWrite) {
    return (
      <p className="admin-meta-block">
        Lecture seule — votre rôle ne permet pas d&apos;agir sur les réservations.
      </p>
    );
  }

  const canSendContract = PRE_CONTRACT_STATUSES.includes(status);
  const canValidate = status === "awaiting_admin_validation";
  const canCancel = CANCELLABLE_STATUSES.includes(status);
  const canPause = status === "confirmed";
  const canResume = status === "paused";
  const canComplete = status === "in_progress";
  const canMarkNoShow = isSuperAdmin && status === "confirmed";
  const canForceMajeure = isSuperAdmin && ACTIVE_STATUSES.includes(status);

  const canCancelReissueContract =
    activeContract != null &&
    activeContract.status !== "signed" &&
    activeContract.status !== "cancelled_admin";
  const canCreateAddendum = hasSignedMainContract === true;

  const anyActionAvailable =
    canSendContract ||
    canValidate ||
    canCancel ||
    canPause ||
    canResume ||
    canComplete ||
    canMarkNoShow ||
    canForceMajeure ||
    canCancelReissueContract ||
    canCreateAddendum;

  return (
    <div className="admin-form">
      {canSendContract && (
        <SendContractAndDepositForm bookingId={bookingId} adminPrefix={adminPrefix} />
      )}
      {canValidate && <ValidateOnCalendarForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canCancel && <CancelBookingForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canPause && <PauseForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canResume && <ResumeForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canComplete && <MarkCompletedForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canMarkNoShow && <MarkNoShowForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canForceMajeure && <MarkForceMajeureForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canCancelReissueContract && activeContract && (
        <CancelAndReissueContractForm
          contractDocumentId={activeContract.id}
          contractVersion={activeContract.version}
        />
      )}
      {canCreateAddendum && <CreateContractAddendumForm bookingId={bookingId} />}
      <CreateQuoteLink bookingId={bookingId} adminPrefix={adminPrefix} />
      <OverrideScheduleForm bookingId={bookingId} />
      {!anyActionAvailable && (
        <p className="admin-meta-block">
          Aucune action admin disponible pour le statut actuel ({status}).
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// SendContractAndDepositForm (D49 clic 1 — Sprint A)
// ────────────────────────────────────────────────────────────────────

function SendContractAndDepositForm({
  bookingId,
  adminPrefix,
}: {
  bookingId: string;
  adminPrefix: string;
}) {
  const [state, action, pending] = useActionState(
    sendContractAndDepositRequestFormAction,
    CONTRACT_FORM_INITIAL,
  );
  const [open, setOpen] = useState(false);

  if (state.ok) {
    return (
      <p role="status" className="admin-alert admin-alert-success">
        ✓ {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="admin-button admin-button-validate"
        onClick={() => setOpen(true)}
      >
        📤 Envoyer contrat + demander acompte (clic 1 — D49)…
      </button>
    );
  }

  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Envoi contrat + acompte (clic Will 1 D49)</h3>
      <p className="admin-meta-block">
        Crée la facture acompte, le ContractDocument, envoie le contrat via DocuSeal (signature
        séquentielle client → Axion-IA), génère la session Stripe Checkout et envoie l&apos;email
        lien de paiement au client. La transition de la réservation passe à{" "}
        <code>contract_payment_sent</code>.
      </p>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="adminPrefix" value={adminPrefix} />

      <div className="admin-field">
        <label htmlFor={`sc-deposit-${bookingId}`} className="admin-label">
          Acompte € HT (surcharge — laisser vide pour utiliser booking.depositAmountCents)
        </label>
        <input
          id={`sc-deposit-${bookingId}`}
          name="depositAmountEur"
          type="number"
          step="0.01"
          min="0"
          className="admin-input"
          disabled={pending}
        />
      </div>

      <details>
        <summary className="admin-meta" style={{ cursor: "pointer", padding: "8px 0" }}>
          Frais accessoires (D55 — saisie obligatoire admin)
        </summary>
        <div className="admin-field">
          <label htmlFor={`sc-travel-${bookingId}`} className="admin-label">
            Frais déplacement € HT
          </label>
          <input
            id={`sc-travel-${bookingId}`}
            name="travelFeeEur"
            type="number"
            step="0.01"
            min="0"
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`sc-accom-${bookingId}`} className="admin-label">
            Hébergement € HT
          </label>
          <input
            id={`sc-accom-${bookingId}`}
            name="accommodationFeeEur"
            type="number"
            step="0.01"
            min="0"
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`sc-meal-${bookingId}`} className="admin-label">
            Repas € HT
          </label>
          <input
            id={`sc-meal-${bookingId}`}
            name="mealFeeEur"
            type="number"
            step="0.01"
            min="0"
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`sc-additional-${bookingId}`} className="admin-label">
            Frais additionnels € HT
          </label>
          <input
            id={`sc-additional-${bookingId}`}
            name="additionalFeesEur"
            type="number"
            step="0.01"
            min="0"
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`sc-additional-notes-${bookingId}`} className="admin-label">
            Notes frais additionnels (visible facture)
          </label>
          <input
            id={`sc-additional-notes-${bookingId}`}
            name="additionalFeesNotes"
            type="text"
            maxLength={500}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </details>

      <details>
        <summary className="admin-meta" style={{ cursor: "pointer", padding: "8px 0" }}>
          Variables interpolées modèle DocuSeal (clé=valeur, une par ligne)
        </summary>
        <div className="admin-field">
          <textarea
            name="contractVariables"
            rows={4}
            className="admin-input admin-textarea"
            placeholder="clientCompanyName=Acme SARL&#10;amountHt=1500.00&#10;validityDate=2026-06-15"
            disabled={pending}
          />
        </div>
      </details>

      <details>
        <summary className="admin-meta" style={{ cursor: "pointer", padding: "8px 0" }}>
          Notes internes (D55)
        </summary>
        <div className="admin-field">
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
      </details>

      {state.error && (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      )}

      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-validate">
          {pending ? "Envoi en cours…" : "📤 Envoyer le contrat + demander acompte"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────
// CancelBookingForm (Sprint A — annulation admin avec refund)
// ────────────────────────────────────────────────────────────────────

function CancelBookingForm({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  const [state, action, pending] = useActionState(
    cancelBookingFormAction,
    CANCEL_BOOKING_FORM_INITIAL,
  );
  const [open, setOpen] = useState(false);

  if (state.ok) {
    return (
      <p role="status" className="admin-alert admin-alert-success">
        ✓ {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        ✕ Annuler la réservation…
      </button>
    );
  }

  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Annulation de la réservation</h3>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="adminPrefix" value={adminPrefix} />

      <div className="admin-field">
        <label htmlFor={`cb-reason-${bookingId}`} className="admin-label">
          Motif d&apos;annulation (10-500 caractères, audit immuable)
        </label>
        <textarea
          id={`cb-reason-${bookingId}`}
          name="reason"
          rows={3}
          minLength={10}
          maxLength={500}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor={`cb-mode-${bookingId}`} className="admin-label">
          Décision remboursement
        </label>
        <select
          id={`cb-mode-${bookingId}`}
          name="refundDecision"
          defaultValue="auto_cgv"
          className="admin-input"
          disabled={pending}
        >
          <option value="auto_cgv">
            Auto grille CGV (J-15+ = 50 % / 15-2j = 0 % / &lt;2j = 0 %)
          </option>
          <option value="force_majeure">Force majeure (remboursement 100 %)</option>
          <option value="keep_deposit">Conserver l&apos;acompte (0 %)</option>
          <option value="custom">Montant personnalisé (saisir ci-dessous)</option>
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor={`cb-custom-${bookingId}`} className="admin-label">
          Montant remboursement € TTC (uniquement si mode «&nbsp;personnalisé&nbsp;»)
        </label>
        <input
          id={`cb-custom-${bookingId}`}
          name="customRefundEur"
          type="number"
          step="0.01"
          min="0"
          className="admin-input"
          disabled={pending}
        />
      </div>

      {state.error && (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      )}

      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-refuse">
          {pending ? "Annulation…" : "✕ Annuler la réservation"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

// ─── individual forms ───────────────────────────────────────────────────────

function FormResult({ state }: { state: BookingFormState }) {
  if (state.ok) {
    return (
      <p role="status" className="admin-alert admin-alert-success">
        ✓ {state.message}
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="admin-alert admin-alert-error">
        {state.error}
      </p>
    );
  }
  return null;
}

function HiddenInputs({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  return (
    <>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="adminPrefix" value={adminPrefix} />
    </>
  );
}

function ValidateOnCalendarForm({
  bookingId,
  adminPrefix,
}: {
  bookingId: string;
  adminPrefix: string;
}) {
  const [state, action, pending] = useActionState(validateOnCalendarFormAction, initial);
  if (state.ok) return <FormResult state={state} />;
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Valider sur le calendrier (clic Will 2 — D49)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`v-notes-${bookingId}`} className="admin-label">
          Notes internes (optionnel)
        </label>
        <textarea
          id={`v-notes-${bookingId}`}
          name="notes"
          rows={3}
          maxLength={2000}
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <button type="submit" disabled={pending} className="admin-button admin-button-validate">
        {pending ? "Validation…" : "✓ Verrouiller sur le calendrier"}
      </button>
    </form>
  );
}

function PauseForm({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  const [state, action, pending] = useActionState(pauseBookingFormAction, initial);
  const [open, setOpen] = useState(false);
  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        Mettre en pause (D61)…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Mise en pause (D61)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`p-reason-${bookingId}`} className="admin-label">
          Motif (10-500 caractères, visible client par email)
        </label>
        <textarea
          id={`p-reason-${bookingId}`}
          name="reason"
          rows={3}
          minLength={10}
          maxLength={500}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`p-until-${bookingId}`} className="admin-label">
          Reprise prévue (date indicative, optionnel)
        </label>
        <input
          type="date"
          id={`p-until-${bookingId}`}
          name="pausedUntil"
          className="admin-input"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-refuse">
          {pending ? "Mise en pause…" : "⏸ Mettre en pause"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function ResumeForm({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  const [state, action, pending] = useActionState(resumeBookingFormAction, initial);
  if (state.ok) return <FormResult state={state} />;
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Reprendre la réservation (D61)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`r-slot-${bookingId}`} className="admin-label">
          Nouvel identifiant de créneau (optionnel — laisser vide pour reprise sans changement de
          date)
        </label>
        <input
          type="text"
          id={`r-slot-${bookingId}`}
          name="newSlotId"
          className="admin-input"
          placeholder="uuid du créneau"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <button type="submit" disabled={pending} className="admin-button admin-button-validate">
        {pending ? "Reprise…" : "▶ Reprendre"}
      </button>
    </form>
  );
}

function MarkCompletedForm({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  const [state, action, pending] = useActionState(markCompletedFormAction, initial);
  if (state.ok) return <FormResult state={state} />;
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Marquer comme terminé</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`c-notes-${bookingId}`} className="admin-label">
          Notes (optionnel)
        </label>
        <textarea
          id={`c-notes-${bookingId}`}
          name="notes"
          rows={3}
          maxLength={2000}
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <button type="submit" disabled={pending} className="admin-button admin-button-validate">
        {pending ? "Clôture…" : "✓ Marquer terminé"}
      </button>
    </form>
  );
}

function MarkNoShowForm({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  const [state, action, pending] = useActionState(markNoShowFormAction, initial);
  const [open, setOpen] = useState(false);
  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        Marquer absence (super_admin)…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Absence (super_admin)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`ns-reason-${bookingId}`} className="admin-label">
          Motif (10-500 caractères, audit immuable)
        </label>
        <textarea
          id={`ns-reason-${bookingId}`}
          name="reason"
          rows={3}
          minLength={10}
          maxLength={500}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-refuse">
          {pending ? "Enregistrement…" : "✕ Marquer absence"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function MarkForceMajeureForm({
  bookingId,
  adminPrefix,
}: {
  bookingId: string;
  adminPrefix: string;
}) {
  const [state, action, pending] = useActionState(markForceMajeureFormAction, initial);
  const [open, setOpen] = useState(false);
  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        Force majeure (super_admin)…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Force majeure (super_admin)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`fm-notes-${bookingId}`} className="admin-label">
          Description circonstanciée (20-2000 caractères)
        </label>
        <textarea
          id={`fm-notes-${bookingId}`}
          name="notes"
          rows={5}
          minLength={20}
          maxLength={2000}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-refuse">
          {pending ? "Enregistrement…" : "⚠ Déclarer force majeure"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────
// CancelAndReissueContractForm (D62 — avant signature)
// ────────────────────────────────────────────────────────────────────

function ContractFormResult({ state }: { state: ContractFormState }) {
  if (state.ok) {
    return (
      <p role="status" className="admin-alert admin-alert-success">
        ✓ {state.message}
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="admin-alert admin-alert-error">
        {state.error}
      </p>
    );
  }
  return null;
}

function CancelAndReissueContractForm({
  contractDocumentId,
  contractVersion,
}: {
  contractDocumentId: string;
  contractVersion: number;
}) {
  const [state, action, pending] = useActionState(
    cancelAndReissueContractFormAction,
    CONTRACT_FORM_INITIAL,
  );
  const [open, setOpen] = useState(false);

  if (state.ok) return <ContractFormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        ↻ Annuler & réémettre le contrat v{contractVersion} (avant signature — D62)…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Annuler & réémettre contrat v{contractVersion} (D62)</h3>
      <p className="admin-meta-block">
        La soumission DocuSeal courante sera archivée + le contrat v{contractVersion} marqué{" "}
        <code>cancelled_admin</code>. Une nouvelle version v{contractVersion + 1} sera créée et
        envoyée au client. Possible uniquement <strong>avant signature</strong>.
      </p>
      <input type="hidden" name="contractDocumentId" value={contractDocumentId} />
      <div className="admin-field">
        <label htmlFor={`cr-reason-${contractDocumentId}`} className="admin-label">
          Motif (10-500 caractères, archivé immuable)
        </label>
        <textarea
          id={`cr-reason-${contractDocumentId}`}
          name="reason"
          rows={3}
          minLength={10}
          maxLength={500}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`cr-body-${contractDocumentId}`} className="admin-label">
          Nouveau corps Tiptap JSON (instantané immuable)
        </label>
        <textarea
          id={`cr-body-${contractDocumentId}`}
          name="newBodyTiptap"
          rows={6}
          required
          className="admin-input admin-textarea"
          placeholder='{"type":"doc","content":[…]}'
          disabled={pending}
        />
      </div>
      <ContractFormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-refuse">
          {pending ? "Réémission…" : "↻ Annuler & réémettre"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────
// CreateContractAddendumForm (D62 — après signature)
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// CreateQuoteLink — lien vers /devis/new?bookingId=… (Sprint A patch)
// ────────────────────────────────────────────────────────────────────

function CreateQuoteLink({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  return (
    <a href={`/fr/${adminPrefix}/devis/new?bookingId=${bookingId}`} className="admin-button-ghost">
      📄 Créer un devis pour cette réservation…
    </a>
  );
}

// ────────────────────────────────────────────────────────────────────
// OverrideScheduleForm — échéancier custom par booking (Sprint A patch / C3)
// ────────────────────────────────────────────────────────────────────

function ScheduleResult({ state }: { state: ScheduleFormState }) {
  if (state.ok) {
    return (
      <p role="status" className="admin-alert admin-alert-success">
        ✓ {state.message}
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="admin-alert admin-alert-error">
        {state.error}
      </p>
    );
  }
  return null;
}

function OverrideScheduleForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    overrideBookingScheduleFormAction,
    SCHEDULE_FORM_INITIAL,
  );
  const [open, setOpen] = useState(false);

  if (state.ok) return <ScheduleResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        📅 Échéancier sur-mesure pour cette réservation…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Échéancier sur-mesure (remplace le profil par défaut)</h3>
      <p className="admin-meta-block">
        Définit un échéancier sur-mesure pour cette réservation uniquement. Contourne le profil
        auto-sélectionné selon le seuil HT. Instantané immuable côté BookingPaymentSchedule.
      </p>
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="admin-field">
        <label htmlFor={`os-reason-${bookingId}`} className="admin-label">
          Motif (10-500 caractères, archivé immuable)
        </label>
        <textarea
          id={`os-reason-${bookingId}`}
          name="reason"
          rows={3}
          minLength={10}
          maxLength={500}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`os-installments-${bookingId}`} className="admin-label">
          Échéances JSON (somme des pourcentages = 100)
        </label>
        <textarea
          id={`os-installments-${bookingId}`}
          name="customInstallmentsJson"
          rows={8}
          required
          className="admin-input admin-textarea"
          placeholder='[{"percentage":40,"dueOffsetDays":7,"dueRelativeTo":"validation","description":"Acompte 40 %"},{"percentage":60,"dueOffsetDays":-7,"dueRelativeTo":"booking_date","description":"Solde J-7"}]'
          disabled={pending}
        />
      </div>
      <ScheduleResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-validate">
          {pending ? "Application…" : "💾 Appliquer l'échéancier sur-mesure"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function CreateContractAddendumForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    createContractAddendumFormAction,
    CONTRACT_FORM_INITIAL,
  );
  const [open, setOpen] = useState(false);

  if (state.ok) return <ContractFormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        ➕ Créer un avenant au contrat signé (D62)…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Avenant au contrat principal signé (D62)</h3>
      <p className="admin-meta-block">
        Le contrat principal signé <strong>reste immuable</strong> (légal). L&apos;avenant est un{" "}
        <code>ContractDocument</code> séparé (<code>isAddendum=true</code>) envoyé pour signature
        séquentielle client → Axion-IA.
      </p>
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="admin-field">
        <label htmlFor={`ad-reason-${bookingId}`} className="admin-label">
          Motif (10-500 caractères, archivé immuable)
        </label>
        <textarea
          id={`ad-reason-${bookingId}`}
          name="reason"
          rows={3}
          minLength={10}
          maxLength={500}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`ad-body-${bookingId}`} className="admin-label">
          Corps Tiptap JSON de l&apos;avenant
        </label>
        <textarea
          id={`ad-body-${bookingId}`}
          name="addendumBodyTiptap"
          rows={6}
          required
          className="admin-input admin-textarea"
          placeholder='{"type":"doc","content":[…]}'
          disabled={pending}
        />
      </div>
      <ContractFormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button">
          {pending ? "Création…" : "➕ Créer & envoyer l'avenant"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
