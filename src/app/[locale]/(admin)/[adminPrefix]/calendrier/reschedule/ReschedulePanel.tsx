"use client";
// use-client: @dnd-kit drag-drop + useActionState (Sprint E — D60).
//
// 2 colonnes :
//   - Gauche : DraggableBookingCard pour chaque booking reschedulable
//   - Droite : DroppableSlotCell pour chaque slot disponible
// Au drop : ouvre modal confirmation reason → submit rescheduleBookingFormAction.

import { useActionState, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import {
  rescheduleBookingFormAction,
  RESCHEDULE_FORM_INITIAL,
} from "@/features/booking/reschedule-form-actions";

interface BookingItem {
  id: string;
  bookingDate: string;
  status: string;
  interventionType: string;
  slotId: string | null;
  companyName: string;
}

interface SlotItem {
  id: string;
  slotDate: string;
  status: string;
  interventionType: string | null;
  blockedReason: string | null;
}

interface Props {
  bookings: BookingItem[];
  slots: SlotItem[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function ReschedulePanel({ bookings, slots }: Props) {
  const [pendingDrop, setPendingDrop] = useState<{
    bookingId: string;
    newSlotId: string;
    newDate: string;
  } | null>(null);
  const [state, action, pending] = useActionState(
    rescheduleBookingFormAction,
    RESCHEDULE_FORM_INITIAL,
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    const bookingId = String(event.active.id);
    const newSlotId = String(event.over.id);
    const slot = slots.find((s) => s.id === newSlotId);
    if (!slot || slot.status !== "available") return;
    setPendingDrop({ bookingId, newSlotId, newDate: slot.slotDate });
  }

  return (
    <>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="admin-reschedule-grid">
          {/* ── Colonne gauche : bookings ── */}
          <div className="admin-card">
            <h2 className="admin-h2">Bookings reschedulables</h2>
            {bookings.length === 0 ? (
              <p className="admin-meta-block">Aucun booking à reprogrammer sur la période.</p>
            ) : (
              <ul className="admin-reschedule-bookings">
                {bookings.map((b) => (
                  <DraggableBookingCard key={b.id} booking={b} />
                ))}
              </ul>
            )}
          </div>

          {/* ── Colonne droite : slots ── */}
          <div className="admin-card">
            <h2 className="admin-h2">Slots du mois</h2>
            {slots.length === 0 ? (
              <p className="admin-meta-block">Aucun slot calendrier sur le mois.</p>
            ) : (
              <div className="admin-reschedule-slots">
                {slots.map((s) => (
                  <DroppableSlotCell key={s.id} slot={s} />
                ))}
              </div>
            )}
          </div>
        </div>
      </DndContext>

      {/* Modal confirmation reason */}
      {pendingDrop && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmer la reprogrammation"
        >
          <button
            type="button"
            aria-label="Fermer"
            className="admin-modal-close-area"
            onClick={() => setPendingDrop(null)}
          />
          <div className="admin-modal">
            <h3 className="admin-h3">Confirmer la reprogrammation</h3>
            <p className="admin-meta-block">
              Nouvelle date : <strong>{formatDate(pendingDrop.newDate)}</strong>
            </p>
            <form action={action} className="admin-form">
              <input type="hidden" name="bookingId" value={pendingDrop.bookingId} />
              <input type="hidden" name="newSlotId" value={pendingDrop.newSlotId} />
              <div className="admin-field">
                <label htmlFor="rs-reason" className="admin-label">
                  Motif (10-500 caractères, archivé immuable + visible client)
                </label>
                <textarea
                  id="rs-reason"
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
                <label className="admin-label">
                  <input type="checkbox" name="notifyClient" defaultChecked disabled={pending} />{" "}
                  Notifier le client par email
                </label>
              </div>
              {state.error && (
                <p role="alert" className="admin-alert admin-alert-error">
                  {state.error}
                </p>
              )}
              {state.ok && (
                <p role="status" className="admin-alert admin-alert-success">
                  ✓ {state.message}
                </p>
              )}
              <div className="admin-filters-actions">
                <button
                  type="submit"
                  disabled={pending}
                  className="admin-button admin-button-validate"
                >
                  {pending ? "Reprogrammation…" : "📅 Confirmer le reschedule"}
                </button>
                <button
                  type="button"
                  className="admin-button-ghost"
                  onClick={() => setPendingDrop(null)}
                  disabled={pending}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function DraggableBookingCard({ booking }: { booking: BookingItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: booking.id,
  });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`admin-reschedule-booking ${isDragging ? "admin-reschedule-booking-dragging" : ""}`}
    >
      <strong>{booking.companyName}</strong>
      <div className="admin-meta-small">{booking.interventionType}</div>
      <div className="admin-meta-small">
        Actuelle : {formatDate(booking.bookingDate)} · {booking.status}
      </div>
    </li>
  );
}

function DroppableSlotCell({ slot }: { slot: SlotItem }) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id });
  const isAvailable = slot.status === "available";
  const classes = [
    "admin-reschedule-slot",
    `admin-reschedule-slot-${slot.status}`,
    isOver && isAvailable ? "admin-reschedule-slot-over" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div ref={setNodeRef} className={classes} aria-label={`Slot ${slot.slotDate}`}>
      <div className="admin-reschedule-slot-date">{new Date(slot.slotDate).getUTCDate()}</div>
      <div className="admin-meta-small">
        {slot.status === "available" ? "Libre" : slot.status === "reserved" ? "Réservé" : "Bloqué"}
      </div>
    </div>
  );
}
