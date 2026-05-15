"use server";
// Form Action wrapper — reschedule (Sprint E).

import { rescheduleBookingByAdminAction } from "./reschedule-actions";
import type { RescheduleFormState } from "./reschedule-form-state";

// `RescheduleFormState` + `RESCHEDULE_FORM_INITIAL` exportés depuis
// `reschedule-form-state.ts` (Next 16 "use server" interdit les exports
// non-async function).

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
