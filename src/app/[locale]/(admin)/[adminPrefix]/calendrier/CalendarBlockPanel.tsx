"use client";
// use-client: useActionState pour 2 forms (block + unblock) avec UI distincte.

import { useActionState, useState } from "react";
import {
  blockDateAction,
  unblockDateAction,
  type BlockDateState,
  type UnblockDateState,
} from "@/features/admin-calendar/actions";

const initBlock: BlockDateState = { ok: false, error: "" };
const initUnblock: UnblockDateState = { ok: false, error: "" };

export function CalendarBlockPanel() {
  const [bState, bAction, bPending] = useActionState(blockDateAction, initBlock);
  const [uState, uAction, uPending] = useActionState(unblockDateAction, initUnblock);
  const [tab, setTab] = useState<"block" | "unblock">("block");

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
      </div>

      {tab === "block" ? (
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
