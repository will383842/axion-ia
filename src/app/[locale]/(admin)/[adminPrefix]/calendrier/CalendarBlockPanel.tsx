"use client";
// use-client: useActionState pour 3 forms (block + unblock + cancel) avec UI distincte.

import { useActionState, useState } from "react";
import {
  blockDateAction,
  unblockDateAction,
  cancelBookingAction,
  type BlockDateState,
  type UnblockDateState,
  type CancelBookingState,
} from "@/features/admin-calendar/actions";

const initBlock: BlockDateState = { ok: false, error: "" };
const initUnblock: UnblockDateState = { ok: false, error: "" };
const initCancel: CancelBookingState = { ok: false, error: "" };

export function CalendarBlockPanel() {
  const [bState, bAction, bPending] = useActionState(blockDateAction, initBlock);
  const [uState, uAction, uPending] = useActionState(unblockDateAction, initUnblock);
  const [cState, cAction, cPending] = useActionState(cancelBookingAction, initCancel);
  const [tab, setTab] = useState<"block" | "unblock" | "cancel">("block");
  const [cancelConfirm, setCancelConfirm] = useState("");

  return (
    <div className="admin-calendar-panel">
      <div className="admin-filters-actions">
        <button
          type="button"
          onClick={() => setTab("block")}
          className={`admin-button-ghost ${tab === "block" ? "admin-button-active" : ""}`}
        >
          Bloquer une date
        </button>
        <button
          type="button"
          onClick={() => setTab("unblock")}
          className={`admin-button-ghost ${tab === "unblock" ? "admin-button-active" : ""}`}
        >
          Débloquer une date
        </button>
        <button
          type="button"
          onClick={() => setTab("cancel")}
          className={`admin-button-ghost ${tab === "cancel" ? "admin-button-active" : ""}`}
        >
          Annuler une réservation
        </button>
      </div>

      {tab === "cancel" ? (
        <form action={cAction} className="admin-form">
          <p className="admin-meta">
            Annule une réservation ferme. Le créneau est libéré et un email d&apos;annulation est
            envoyé au contact (si disponible). Action <strong>irréversible</strong>.
          </p>
          <div className="admin-field">
            <label htmlFor="cancel-booking-id" className="admin-label">
              ID de la réservation (UUID)
            </label>
            <input
              id="cancel-booking-id"
              name="bookingId"
              type="text"
              required
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              className="admin-input"
              placeholder="00000000-0000-0000-0000-000000000000"
              disabled={cPending}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="cancel-reason" className="admin-label">
              Motif (envoyé au contact dans l&apos;email)
            </label>
            <textarea
              id="cancel-reason"
              name="reason"
              required
              maxLength={500}
              rows={3}
              className="admin-input admin-textarea"
              placeholder="Ex: imprévu côté Axion-IA, réorganisation planning…"
              disabled={cPending}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="cancel-confirm" className="admin-label">
              Tapez <code>annuler</code> pour confirmer
            </label>
            <input
              id="cancel-confirm"
              type="text"
              value={cancelConfirm}
              onChange={(e) => setCancelConfirm(e.target.value)}
              className="admin-input"
              autoComplete="off"
              disabled={cPending}
            />
          </div>
          {cState.ok ? (
            <p role="status" className="admin-alert admin-alert-success">
              ✓ Réservation annulée. Créneau libéré, email envoyé si contact disponible.
            </p>
          ) : cState.error ? (
            <p role="alert" className="admin-alert admin-alert-error">
              {cState.error === "booking_not_found"
                ? "Réservation introuvable."
                : cState.error === "booking_already_cancelled"
                  ? "Cette réservation est déjà annulée."
                  : cState.error}
            </p>
          ) : null}
          <button
            type="submit"
            className="admin-button admin-button-refuse"
            disabled={cPending || cancelConfirm !== "annuler"}
          >
            {cPending ? "Annulation..." : "Annuler la réservation"}
          </button>
        </form>
      ) : tab === "block" ? (
        <form action={bAction} className="admin-form">
          <div className="admin-field">
            <label htmlFor="block-date" className="admin-label">
              Date à bloquer
            </label>
            <input
              id="block-date"
              name="date"
              type="date"
              required
              className="admin-input"
              disabled={bPending}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="block-reason" className="admin-label">
              Motif (interne, ne sera pas envoyé au public)
            </label>
            <input
              id="block-reason"
              name="reason"
              type="text"
              required
              maxLength={500}
              className="admin-input"
              placeholder="Ex: vacances, jour férié, salon professionnel…"
              disabled={bPending}
            />
          </div>
          {bState.ok ? (
            <p role="status" className="admin-alert admin-alert-success">
              ✓ Date bloquée avec succès.
            </p>
          ) : bState.error ? (
            <p role="alert" className="admin-alert admin-alert-error">
              {bState.error === "booking_active"
                ? "Impossible : une réservation ferme existe sur cette date."
                : bState.error === "options_pending"
                  ? "Impossible : des options pending existent. Refuser ou attendre l'expiration."
                  : bState.error}
            </p>
          ) : null}
          <button type="submit" className="admin-button" disabled={bPending}>
            {bPending ? "Blocage..." : "Bloquer"}
          </button>
        </form>
      ) : (
        <form action={uAction} className="admin-form">
          <div className="admin-field">
            <label htmlFor="unblock-date" className="admin-label">
              Date à débloquer
            </label>
            <input
              id="unblock-date"
              name="date"
              type="date"
              required
              className="admin-input"
              disabled={uPending}
            />
          </div>
          {uState.ok ? (
            <p role="status" className="admin-alert admin-alert-success">
              ✓ Date débloquée. Le créneau est de nouveau disponible.
            </p>
          ) : uState.error ? (
            <p role="alert" className="admin-alert admin-alert-error">
              {uState.error}
            </p>
          ) : null}
          <button type="submit" className="admin-button" disabled={uPending}>
            {uPending ? "Déblocage..." : "Débloquer"}
          </button>
        </form>
      )}
    </div>
  );
}
