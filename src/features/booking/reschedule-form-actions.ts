"use server";
// Form Action wrapper — reschedule (Sprint E).

import { rescheduleBookingByAdminAction } from "./reschedule-actions";

export interface RescheduleFormState {
  ok: boolean;
  error?: string;
  message?: string;
  newBookingDate?: string;
}

export const RESCHEDULE_FORM_INITIAL: RescheduleFormState = { ok: false };

export async function rescheduleBookingFormAction(
  _prev: RescheduleFormState,
  formData: FormData,
): Promise<RescheduleFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const newSlotId = String(formData.get("newSlotId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const notifyClient = formData.get("notifyClient") !== "off"; // default ON

  const result = await rescheduleBookingByAdminAction({
    bookingId,
    newSlotId,
    reason,
    notifyClient,
  });

  if (result.ok) {
    return {
      ok: true,
      message: `Booking reprogrammé au ${result.newBookingDate.slice(0, 10)}. ${notifyClient ? "Email envoyé au client." : "Aucun email envoyé."}`,
      newBookingDate: result.newBookingDate,
    };
  }
  return { ok: false, error: result.error };
}
