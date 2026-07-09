// Normalisation source → view-model `UnifiedRdv` (mappers purs, testables).
// V1 : Calendly. Ajouter Booking = un mapper `fromBooking` de plus ici.

import { adminPath } from "@/lib/admin-path";
import { dayKeyInParis } from "@/lib/calendar-grid";
import type { RdvStatus, UnifiedRdv } from "./types";

/** Sous-ensemble des colonnes `CalendlyEvent` consommées (découplé de Prisma). */
export interface CalendlyEventRow {
  id: string;
  eventTypeName: string;
  status: string;
  startTime: Date | null;
  endTime: Date | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  location: string | null;
  notes: string | null;
  capturedAt: Date;
}

export function mapCalendlyStatus(raw: string): RdvStatus {
  switch (raw) {
    case "canceled":
      return "canceled";
    case "completed":
      return "completed";
    case "no_show":
      return "no_show";
    case "scheduled":
    default:
      return "scheduled";
  }
}

export function fromCalendly(e: CalendlyEventRow): UnifiedRdv {
  // Placement calendrier : startTime si connu, sinon jour de capture (l'Embed JS
  // ne fournit pas toujours l'heure) → sinon la plupart des RDV n'apparaîtraient
  // nulle part. `timeConfirmed=false` pilote le badge « heure à confirmer ».
  const anchor = e.startTime ?? e.capturedAt;
  return {
    key: `cal_${e.id}`,
    source: "calendly",
    sourceRecordId: e.id,
    detailHref: adminPath("fr", `contacts/calendly/${e.id}`),
    title: e.eventTypeName,
    startTime: e.startTime,
    endTime: e.endTime,
    timeConfirmed: e.startTime != null,
    dayKey: dayKeyInParis(anchor),
    status: mapCalendlyStatus(e.status),
    contactName: e.inviteeName,
    contactEmail: e.inviteeEmail,
    contactPhone: e.inviteePhone,
    location: e.location,
    notes: e.notes,
    createdAt: e.capturedAt,
  };
}
