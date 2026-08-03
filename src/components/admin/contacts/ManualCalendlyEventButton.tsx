"use client";
// use-client: modal interactif + Server Action (Sprint Notif Infra 2026-05-26
// fix P1-6 audit 2026-05-27).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualCalendlyEventAction } from "@/features/admin-calendly/actions";

export function ManualCalendlyEventButton(): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    eventTypeName: "Appel découverte 30 min",
    eventTypeSlug: "appel-decouverte",
    inviteeName: "",
    inviteeEmail: "",
    inviteePhone: "",
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createManualCalendlyEventAction({
        eventTypeName: state.eventTypeName,
        eventTypeSlug: state.eventTypeSlug,
        ...(state.inviteeName ? { inviteeName: state.inviteeName } : {}),
        ...(state.inviteeEmail ? { inviteeEmail: state.inviteeEmail } : {}),
        ...(state.inviteePhone ? { inviteePhone: state.inviteePhone } : {}),
        ...(state.startTime ? { startTime: new Date(state.startTime).toISOString() } : {}),
        ...(state.endTime ? { endTime: new Date(state.endTime).toISOString() } : {}),
        ...(state.location ? { location: state.location } : {}),
        ...(state.notes ? { notes: state.notes } : {}),
      });
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="admin-button">
        + Ajouter manuellement
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-calendly-title"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12"
    >
      <div className="bg-paper relative w-full max-w-xl rounded-lg border border-[color:var(--color-admin-border-default)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fermer"
          className="absolute top-3 right-3 text-2xl leading-none text-[color:var(--color-admin-fg-muted)]"
        >
          ×
        </button>
        <h2 id="manual-calendly-title" className="admin-h2">
          Ajouter manuellement un RDV
        </h2>
        <p className="mt-1 text-sm text-[color:var(--color-admin-fg-muted)]">
          Rattraper un RDV reçu uniquement via mail Calendly natif.
        </p>
        <form onSubmit={onSubmit} className="admin-form mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="admin-field">
              <label
                htmlFor="manualcalendlyeventbutton-type-devenement-nom"
                className="admin-label"
              >
                Type d&apos;événement (nom)
              </label>
              <input
                id="manualcalendlyeventbutton-type-devenement-nom"
                className="admin-input"
                value={state.eventTypeName}
                onChange={(e) => setState({ ...state, eventTypeName: e.target.value })}
                required
                maxLength={255}
                disabled={isPending}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="manualcalendlyeventbutton-slug-du-type" className="admin-label">
                Slug du type
              </label>
              <input
                id="manualcalendlyeventbutton-slug-du-type"
                className="admin-input"
                value={state.eventTypeSlug}
                onChange={(e) => setState({ ...state, eventTypeSlug: e.target.value })}
                required
                maxLength={100}
                disabled={isPending}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="manualcalendlyeventbutton-nom-invite" className="admin-label">
                Nom invité
              </label>
              <input
                id="manualcalendlyeventbutton-nom-invite"
                className="admin-input"
                value={state.inviteeName}
                onChange={(e) => setState({ ...state, inviteeName: e.target.value })}
                maxLength={255}
                disabled={isPending}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="manualcalendlyeventbutton-email-invite" className="admin-label">
                Email invité
              </label>
              <input
                id="manualcalendlyeventbutton-email-invite"
                type="email"
                className="admin-input"
                value={state.inviteeEmail}
                onChange={(e) => setState({ ...state, inviteeEmail: e.target.value })}
                maxLength={255}
                disabled={isPending}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="manualcalendlyeventbutton-telephone" className="admin-label">
                Téléphone
              </label>
              <input
                id="manualcalendlyeventbutton-telephone"
                className="admin-input"
                value={state.inviteePhone}
                onChange={(e) => setState({ ...state, inviteePhone: e.target.value })}
                maxLength={40}
                disabled={isPending}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="manualcalendlyeventbutton-lieu-url" className="admin-label">
                Lieu / URL
              </label>
              <input
                id="manualcalendlyeventbutton-lieu-url"
                className="admin-input"
                value={state.location}
                onChange={(e) => setState({ ...state, location: e.target.value })}
                maxLength={500}
                disabled={isPending}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="manualcalendlyeventbutton-debut" className="admin-label">
                Début
              </label>
              <input
                id="manualcalendlyeventbutton-debut"
                type="datetime-local"
                className="admin-input"
                value={state.startTime}
                onChange={(e) => setState({ ...state, startTime: e.target.value })}
                disabled={isPending}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="manualcalendlyeventbutton-fin" className="admin-label">
                Fin
              </label>
              <input
                id="manualcalendlyeventbutton-fin"
                type="datetime-local"
                className="admin-input"
                value={state.endTime}
                onChange={(e) => setState({ ...state, endTime: e.target.value })}
                disabled={isPending}
              />
            </div>
            <div className="admin-field sm:col-span-2">
              <label htmlFor="manualcalendlyeventbutton-notes" className="admin-label">
                Notes
              </label>
              <textarea
                id="manualcalendlyeventbutton-notes"
                className="admin-input admin-textarea"
                rows={3}
                value={state.notes}
                onChange={(e) => setState({ ...state, notes: e.target.value })}
                maxLength={5000}
                disabled={isPending}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="admin-alert admin-alert-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="admin-button-ghost"
              disabled={isPending}
            >
              Annuler
            </button>
            <button type="submit" className="admin-button" disabled={isPending}>
              {isPending ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
