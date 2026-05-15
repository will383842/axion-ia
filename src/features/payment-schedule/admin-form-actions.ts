"use server";
// Form Action wrappers échéanciers (Sprint C — UI admin).

import {
  upsertPaymentScheduleProfileAction,
  archivePaymentScheduleProfileAction,
  overrideBookingPaymentScheduleAction,
} from "./admin-actions";
import type { ScheduleFormState } from "./admin-form-state";

// `ScheduleFormState` + `SCHEDULE_FORM_INITIAL` exportés depuis
// `admin-form-state.ts` (Next 16 "use server" interdit les exports
// non-async function).

export async function upsertProfileFormAction(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const id = formData.get("id")?.toString().trim() || undefined;
  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const installmentsJson = String(formData.get("installmentsJson") ?? "");
  const thresholdMinEurRaw = formData.get("thresholdMinEur")?.toString().trim();
  const thresholdMaxEurRaw = formData.get("thresholdMaxEur")?.toString().trim();
  const isDefault = formData.get("isDefault") === "on";

  const result = await upsertPaymentScheduleProfileAction({
    ...(id ? { id } : {}),
    name,
    slug,
    installmentsJson,
    ...(thresholdMinEurRaw
      ? { thresholdMinCents: Math.round(parseFloat(thresholdMinEurRaw) * 100) }
      : {}),
    ...(thresholdMaxEurRaw
      ? { thresholdMaxCents: Math.round(parseFloat(thresholdMaxEurRaw) * 100) }
      : {}),
    isDefault,
  });

  if (result.ok) {
    return {
      ok: true,
      message: `Profil échéancier ${id ? "mis à jour" : "créé"}.`,
      profileId: result.profileId,
      slug: result.slug,
    };
  }
  return { ok: false, error: result.error };
}

export async function archiveProfileFormAction(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const profileId = String(formData.get("profileId") ?? "");
  const result = await archivePaymentScheduleProfileAction({ profileId });
  if (result.ok) return { ok: true, message: "Profil archivé." };
  return { ok: false, error: result.error ?? "internal_error" };
}

export async function overrideBookingScheduleFormAction(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const customInstallmentsJson = String(formData.get("customInstallmentsJson") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const result = await overrideBookingPaymentScheduleAction({
    bookingId,
    customInstallmentsJson,
    reason,
  });
  if (result.ok) return { ok: true, message: "Échéancier custom appliqué au booking." };
  return { ok: false, error: result.error };
}
