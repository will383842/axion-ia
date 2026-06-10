"use server";
// Form Action wrappers admin pour useActionState (Sprint X.8 — Admin Réservations).
//
// Pourquoi ce module ?
//   Les Server Actions de `admin-actions.ts` retournent `AdminActionResult`
//   (signature `(input) => Promise<{ok, error?}>`). useActionState attend une
//   signature `(prevState, formData) => Promise<State>`. Ces wrappers font le
//   pont — récupèrent les FormData, déléguent aux actions sous-jacentes, et
//   renvoient le state attendu par le hook React.
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.8
//        Périmètre — Drawer admin

import { revalidatePath } from "next/cache";
import {
  pauseBookingAction,
  resumeBookingAction,
  markCompletedAction,
  markNoShowAction,
  markForceMajeureAction,
  validateBookingOnCalendarAction,
  type AdminActionResult,
} from "./admin-actions";

export interface BookingFormState {
  ok: boolean;
  error?: string;
  message?: string;
}

function pathsToRevalidate(adminPrefix: string, bookingId: string): string[] {
  return [
    `/fr/${adminPrefix}`,
    `/fr/${adminPrefix}/reservations`,
    `/fr/${adminPrefix}/reservations/${bookingId}`,
    `/fr/${adminPrefix}/calendrier`,
    // Modèle multi-demandes (2026-06-10) : valider/déplacer/annuler une demande
    // change les compteurs « déjà X demandes » côté public → on rafraîchit aussi
    // la page de réservation publique (cohérent avec admin-calendar/actions.ts).
    "/fr/reserver",
    "/en/book",
  ];
}

function revalidateAll(adminPrefix: string, bookingId: string): void {
  for (const path of pathsToRevalidate(adminPrefix, bookingId)) {
    revalidatePath(path);
  }
}

function toFormState(result: AdminActionResult, successMessage: string): BookingFormState {
  if (result.ok) return { ok: true, message: successMessage };
  return { ok: false, error: result.error ?? "internal_error" };
}

// ────────────────────────────────────────────────────────────────────
// validateBookingOnCalendarAction (D49 clic Will 2)
// ────────────────────────────────────────────────────────────────────
export async function validateOnCalendarFormAction(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const adminPrefix = String(formData.get("adminPrefix") ?? "");
  const notes = formData.get("notes")?.toString().trim() || undefined;
  const result = await validateBookingOnCalendarAction({
    bookingId,
    ...(notes ? { notes } : {}),
  });
  if (result.ok) revalidateAll(adminPrefix, bookingId);
  return toFormState(result, "Booking verrouillé sur le calendrier. Email envoyé au client.");
}

// ────────────────────────────────────────────────────────────────────
// pauseBookingAction (D61)
// ────────────────────────────────────────────────────────────────────
export async function pauseBookingFormAction(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const adminPrefix = String(formData.get("adminPrefix") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const pausedUntilRaw = formData.get("pausedUntil")?.toString().trim() || "";
  const pausedUntil = pausedUntilRaw
    ? new Date(`${pausedUntilRaw}T12:00:00Z`).toISOString()
    : undefined;

  const result = await pauseBookingAction({
    bookingId,
    reason,
    ...(pausedUntil ? { pausedUntil } : {}),
  });
  if (result.ok) revalidateAll(adminPrefix, bookingId);
  return toFormState(result, "Booking mis en pause. Email envoyé au client.");
}

// ────────────────────────────────────────────────────────────────────
// resumeBookingAction (D61)
// ────────────────────────────────────────────────────────────────────
export async function resumeBookingFormAction(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const adminPrefix = String(formData.get("adminPrefix") ?? "");
  const newSlotId = formData.get("newSlotId")?.toString().trim() || undefined;

  const result = await resumeBookingAction({
    bookingId,
    ...(newSlotId ? { newSlotId } : {}),
  });
  if (result.ok) revalidateAll(adminPrefix, bookingId);
  return toFormState(result, "Booking repris. Email envoyé au client.");
}

// ────────────────────────────────────────────────────────────────────
// markCompletedAction
// ────────────────────────────────────────────────────────────────────
export async function markCompletedFormAction(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const adminPrefix = String(formData.get("adminPrefix") ?? "");
  const notes = formData.get("notes")?.toString().trim() || undefined;
  const result = await markCompletedAction({
    bookingId,
    ...(notes ? { notes } : {}),
  });
  if (result.ok) revalidateAll(adminPrefix, bookingId);
  return toFormState(result, "Booking marqué comme terminé.");
}

// ────────────────────────────────────────────────────────────────────
// markNoShowAction (super_admin only)
// ────────────────────────────────────────────────────────────────────
export async function markNoShowFormAction(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const adminPrefix = String(formData.get("adminPrefix") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const result = await markNoShowAction({ bookingId, reason });
  if (result.ok) revalidateAll(adminPrefix, bookingId);
  return toFormState(result, "Booking marqué no-show. Acompte conservé.");
}

// ────────────────────────────────────────────────────────────────────
// markForceMajeureAction (super_admin only)
// ────────────────────────────────────────────────────────────────────
export async function markForceMajeureFormAction(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const adminPrefix = String(formData.get("adminPrefix") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const result = await markForceMajeureAction({ bookingId, notes });
  if (result.ok) revalidateAll(adminPrefix, bookingId);
  return toFormState(result, "Force majeure enregistrée. Email envoyé au client.");
}
