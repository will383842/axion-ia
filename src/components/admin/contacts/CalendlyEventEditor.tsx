"use client";
// use-client: form interactif (états locaux + Server Action via useTransition).
//
// Sprint Notif Infra 2026-05-26 / fix P1-6 audit 2026-05-27.

import { useState, useTransition } from "react";
import { updateCalendlyEventAction } from "@/features/admin-calendly/actions";

interface Initial {
  readonly inviteeName: string | null;
  readonly inviteeEmail: string | null;
  readonly inviteePhone: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly location: string | null;
  readonly status: string;
  readonly notes: string | null;
  readonly linkedSubmissionId: string | null;
}

interface Props {
  readonly id: string;
  readonly initial: Initial;
}

export function CalendlyEventEditor({ id, initial }: Props): React.ReactElement {
  const [state, setState] = useState({
    inviteeName: initial.inviteeName ?? "",
    inviteeEmail: initial.inviteeEmail ?? "",
    inviteePhone: initial.inviteePhone ?? "",
    startTime: initial.startTime ? initial.startTime.slice(0, 16) : "",
    endTime: initial.endTime ? initial.endTime.slice(0, 16) : "",
    location: initial.location ?? "",
    status: initial.status,
    notes: initial.notes ?? "",
    linkedSubmissionId: initial.linkedSubmissionId ?? "",
  });
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    startTransition(async () => {
      const r = await updateCalendlyEventAction({
        id,
        inviteeName: state.inviteeName || null,
        inviteeEmail: state.inviteeEmail || null,
        inviteePhone: state.inviteePhone || null,
        startTime: state.startTime ? new Date(state.startTime).toISOString() : null,
        endTime: state.endTime ? new Date(state.endTime).toISOString() : null,
        location: state.location || null,
        status: state.status as "scheduled" | "canceled" | "completed" | "no_show",
        notes: state.notes || null,
        linkedSubmissionId: state.linkedSubmissionId || null,
      });
      if (r.ok) {
        setDone(true);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="admin-form space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="admin-field">
          <label htmlFor="inviteeName" className="admin-label">
            Nom invitee
          </label>
          <input
            id="inviteeName"
            className="admin-input"
            value={state.inviteeName}
            onChange={(e) => setState({ ...state, inviteeName: e.target.value })}
            maxLength={255}
            disabled={isPending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="inviteeEmail" className="admin-label">
            Email invitee
          </label>
          <input
            id="inviteeEmail"
            type="email"
            className="admin-input"
            value={state.inviteeEmail}
            onChange={(e) => setState({ ...state, inviteeEmail: e.target.value })}
            maxLength={255}
            disabled={isPending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="inviteePhone" className="admin-label">
            Téléphone
          </label>
          <input
            id="inviteePhone"
            className="admin-input"
            value={state.inviteePhone}
            onChange={(e) => setState({ ...state, inviteePhone: e.target.value })}
            maxLength={40}
            disabled={isPending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="status" className="admin-label">
            Statut
          </label>
          <select
            id="status"
            className="admin-input"
            value={state.status}
            onChange={(e) => setState({ ...state, status: e.target.value })}
            disabled={isPending}
          >
            <option value="scheduled">Programmé</option>
            <option value="completed">Terminé</option>
            <option value="canceled">Annulé</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="startTime" className="admin-label">
            Début
          </label>
          <input
            id="startTime"
            type="datetime-local"
            className="admin-input"
            value={state.startTime}
            onChange={(e) => setState({ ...state, startTime: e.target.value })}
            disabled={isPending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="endTime" className="admin-label">
            Fin
          </label>
          <input
            id="endTime"
            type="datetime-local"
            className="admin-input"
            value={state.endTime}
            onChange={(e) => setState({ ...state, endTime: e.target.value })}
            disabled={isPending}
          />
        </div>
        <div className="admin-field sm:col-span-2">
          <label htmlFor="location" className="admin-label">
            Lieu / URL Meet
          </label>
          <input
            id="location"
            className="admin-input"
            value={state.location}
            onChange={(e) => setState({ ...state, location: e.target.value })}
            maxLength={500}
            disabled={isPending}
          />
        </div>
        <div className="admin-field sm:col-span-2">
          <label htmlFor="linkedSubmissionId" className="admin-label">
            ID Submission liée (UUID, optionnel)
          </label>
          <input
            id="linkedSubmissionId"
            className="admin-input font-mono text-xs"
            value={state.linkedSubmissionId}
            onChange={(e) => setState({ ...state, linkedSubmissionId: e.target.value.trim() })}
            maxLength={64}
            disabled={isPending}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </div>
        <div className="admin-field sm:col-span-2">
          <label htmlFor="notes" className="admin-label">
            Notes admin
          </label>
          <textarea
            id="notes"
            className="admin-input admin-textarea"
            value={state.notes}
            onChange={(e) => setState({ ...state, notes: e.target.value })}
            maxLength={5000}
            rows={4}
            disabled={isPending}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="admin-alert admin-alert-error">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="admin-alert admin-alert-success">
          ✓ Modifications enregistrées.
        </p>
      )}

      <button type="submit" className="admin-button" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
