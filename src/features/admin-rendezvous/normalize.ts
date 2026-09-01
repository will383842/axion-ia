// Normalisation source → view-model `UnifiedRdv` (mappers purs, testables).
// V1 : Calendly. Ajouter Booking = un mapper `fromBooking` de plus ici.

import { adminPath } from "@/lib/admin-path";
import { dayKeyInParis } from "@/lib/calendar-grid";
import type { RdvStatus, UnifiedRdv } from "./types";
import { canalDuRendezVous } from "@/server/calendly/canal";

/** Sous-ensemble des colonnes `CalendlyEvent` consommées (découplé de Prisma). */
export interface CalendlyEventRow {
  /** Charge brute Calendly — sert à dériver le canal depuis le `type` du lieu. */
  rawPayload?: unknown;
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

/**
 * Marge appliquée quand l'heure de FIN est inconnue.
 *
 * Deux heures : un premier contact dure 45 minutes, et il vaut mieux annoncer
 * « planifié » un peu trop longtemps que « passé » alors qu'il est en cours.
 * Mesuré le 2026-09-01 : une seule ligne sur 21 n'a pas d'heure de fin — et
 * elle n'a pas non plus d'heure de début, donc ce repli ne la concerne même
 * pas. Il existe pour ne pas dépendre de cette chance.
 */
export const MARGE_SANS_FIN_MINUTES = 120;

/**
 * Le rendez-vous est-il derrière nous ?
 *
 * ## Pourquoi cette dérivation existe
 *
 * Calendly ne fournit AUCUN état « a eu lieu » : chez lui un rendez-vous est
 * `active` ou `canceled`. Le `no_show` n'existe que si l'hôte le coche. Aucune
 * ligne de code de ce dépôt n'a jamais écrit `completed`.
 *
 * Résultat mesuré le 2026-09-01 : **10 rendez-vous terminés étaient encore
 * affichés « Planifié »**, dont certains depuis juillet. La console montrait un
 * agenda qui ne se vidait jamais.
 *
 * ## Pourquoi « passé » et non « terminé »
 *
 * On sait que l'heure est écoulée. On ne sait PAS que l'échange a eu lieu : un
 * rendez-vous manqué dont personne n'a coché l'absence est indistinguable d'un
 * rendez-vous honoré. Écrire « Terminé » serait affirmer ce qu'on n'a pas
 * mesuré — exactement ce que ce dépôt reproche ailleurs à ses propres notices.
 *
 * ## Pourquoi dérivé et non écrit en base
 *
 * Même raison que le format téléphone/visio : deux champs qui doivent dire la
 * même chose finissent par diverger. Ici la dérivation est en outre gratuite —
 * elle ne dépend que de l'horloge — et elle laisse la place à une décision
 * humaine : un statut posé à la main (`canceled`, `no_show`) l'emporte
 * toujours, puisqu'on ne dérive que depuis `scheduled`.
 */
export function estTermine(
  startTime: Date | null,
  endTime: Date | null,
  maintenant: Date = new Date(),
): boolean {
  if (endTime) return endTime.getTime() < maintenant.getTime();
  if (!startTime) return false;
  return startTime.getTime() + MARGE_SANS_FIN_MINUTES * 60_000 < maintenant.getTime();
}

/** Applique la dérivation temporelle sans jamais recouvrir une décision humaine. */
export function statutAffiche(
  stocke: RdvStatus,
  startTime: Date | null,
  endTime: Date | null,
  maintenant: Date = new Date(),
): RdvStatus {
  if (stocke !== "scheduled") return stocke;
  return estTermine(startTime, endTime, maintenant) ? "past" : "scheduled";
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
    detailHref: adminPath("fr", `contacts/appels/${e.id}`),
    title: e.eventTypeName,
    startTime: e.startTime,
    endTime: e.endTime,
    timeConfirmed: e.startTime != null,
    dayKey: dayKeyInParis(anchor),
    // 🔑 Un rendez-vous tenu cesse d'être « planifié ». La dérivation ne part
    // QUE de `scheduled` : une annulation ou une absence cochée à la main
    // l'emporte, et n'est jamais recouverte par le temps qui passe.
    status: statutAffiche(mapCalendlyStatus(e.status), e.startTime, e.endTime),
    contactName: e.inviteeName,
    contactEmail: e.inviteeEmail,
    contactPhone: e.inviteePhone,
    location: e.location,
    // Dérivé ici, au seul endroit où une ligne Calendly devient un rendez-vous
    // affichable : tous les écrans en héritent sans le recalculer chacun.
    format: canalDuRendezVous(e.location, e.rawPayload),
    notes: e.notes,
    createdAt: e.capturedAt,
  };
}
