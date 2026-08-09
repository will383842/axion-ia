// Enrichissement d'un `CalendlyEvent` depuis l'API Calendly v2 (ADR 0036).
//
// Sépare volontairement l'accès réseau (`./api`) de l'écriture en base (ici),
// pour que la logique d'application soit testable sans stub HTTP.
//
// Deux appelants :
//   1. `POST /api/calendly/client-event` — juste après la capture postMessage.
//   2. `enrichCalendlyEventAction` — bouton admin (rattrapage d'une ligne
//      ancienne, ou re-synchro après annulation côté Calendly).
//
// Règle d'écriture, en deux moitiés :
//
//   • l'admin est propriétaire du QUI — nom, email, téléphone, lieu, notes. Un
//     enrichissement tardif ne doit jamais effacer ce qui a été recopié à la
//     main depuis Gmail : ces champs ne sont écrits que s'ils sont vides.
//   • Calendly est propriétaire du QUAND — horaire et statut. Garder une
//     ancienne heure après un déplacement d'invité produirait une fiche qui
//     ment, ce qui est pire que pas de fiche du tout pour un agenda.
//
// Seul le statut terminal posé après coup (`completed` / `no_show`) est protégé :
// il décrit ce qui s'est passé pendant l'appel, ce que l'API ne sait pas.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notifications";
import { fetchCalendlyInvitee, isCalendlyApiConfigured } from "./api";

export type EnrichOutcome = { ok: true; updatedFields: string[] } | { ok: false; reason: string };

/** `active`/`canceled` (API Calendly) → enum `CalendlyEventStatus`. */
function mapCalendlyStatus(raw: string | null): "scheduled" | "canceled" | null {
  if (raw === "canceled") return "canceled";
  if (raw === "active") return "scheduled";
  return null;
}

/**
 * Enrichit une ligne `calendly_events` à partir de ses URI stockées.
 *
 * Ne throw jamais : toute erreur remonte en `{ ok: false, reason }`. Le
 * contexte d'appel principal est un beacon navigateur — l'échec de
 * l'enrichissement ne doit jamais faire échouer la capture elle-même.
 */
export async function enrichCalendlyEvent(eventId: string): Promise<EnrichOutcome> {
  if (!isCalendlyApiConfigured()) return { ok: false, reason: "not_configured" };

  let row: {
    id: string;
    eventUri: string | null;
    inviteeUri: string | null;
    inviteeName: string | null;
    inviteeEmail: string | null;
    inviteePhone: string | null;
    startTime: Date | null;
    endTime: Date | null;
    location: string | null;
    status: string;
    eventTypeName: string;
    eventTypeSlug: string;
    cancelUrl: string | null;
    rescheduleUrl: string | null;
  } | null;
  try {
    row = await prisma.calendlyEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        eventUri: true,
        inviteeUri: true,
        inviteeName: true,
        inviteeEmail: true,
        inviteePhone: true,
        startTime: true,
        endTime: true,
        location: true,
        status: true,
        eventTypeName: true,
        eventTypeSlug: true,
        cancelUrl: true,
        rescheduleUrl: true,
      },
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, reason: "db_read_failed" };
  }
  // Distinct de `not_found` (qui signifie « Calendly ne connaît plus l'event ») :
  // ici c'est notre propre ligne qui manque.
  if (!row) return { ok: false, reason: "not_found_local" };
  if (!row.inviteeUri) return { ok: false, reason: "no_invitee_uri" };

  const res = await fetchCalendlyInvitee(row.inviteeUri, row.eventUri);
  if (!res.ok) return { ok: false, reason: res.reason };

  const d = res.data;
  const data: Record<string, unknown> = {};
  const updatedFields: string[] = [];
  const setIfEmpty = <T>(field: string, current: T | null, incoming: T | null): void => {
    if (current == null && incoming != null) {
      data[field] = incoming;
      updatedFields.push(field);
    }
  };

  setIfEmpty("inviteeName", row.inviteeName, d.inviteeName);
  setIfEmpty("inviteeEmail", row.inviteeEmail, d.inviteeEmail);
  setIfEmpty("inviteePhone", row.inviteePhone, d.inviteePhone);
  setIfEmpty("location", row.location, d.location);
  setIfEmpty("cancelUrl", row.cancelUrl, d.cancelUrl);
  setIfEmpty("rescheduleUrl", row.rescheduleUrl, d.rescheduleUrl);
  if (d.timezone) {
    data["timezone"] = d.timezone;
    updatedFields.push("timezone");
  }

  // Le nom lisible de l'event-type remplace le slug technique tant que
  // personne ne l'a renommé à la main (à la capture on n'a que le slug).
  if (d.eventTypeName && row.eventTypeName === row.eventTypeSlug) {
    data["eventTypeName"] = d.eventTypeName;
    updatedFields.push("eventTypeName");
  }

  // ── Champs dont Calendly est propriétaire ────────────────────────────────
  //
  // L'HORAIRE et le STATUT échappent à la règle « ne jamais écraser une saisie
  // humaine », et c'est délibéré : Calendly est le système de référence du
  // *quand*. Si un invité déplace son créneau depuis le mail Calendly, garder
  // l'ancienne heure sous prétexte qu'un humain l'avait recopiée produirait une
  // fiche qui ment — le pire résultat possible pour un agenda. L'admin reste
  // propriétaire du *qui* (nom, email, téléphone), que l'API ne fait que
  // compléter quand c'est vide.
  //
  // Ces deux transitions sont aussi les seules occasions de savoir qu'un RDV a
  // bougé : sans webhook (Calendly Free), rien d'autre ne le signale.
  const rescheduled =
    d.startTime != null &&
    row.startTime != null &&
    d.startTime.getTime() !== row.startTime.getTime();
  if (d.startTime != null && d.startTime.getTime() !== (row.startTime?.getTime() ?? NaN)) {
    data["startTime"] = d.startTime;
    updatedFields.push("startTime");
  }
  if (d.endTime != null && d.endTime.getTime() !== (row.endTime?.getTime() ?? NaN)) {
    data["endTime"] = d.endTime;
    updatedFields.push("endTime");
  }

  // On ne rétrograde jamais un statut posé manuellement en fin de parcours
  // (`completed` / `no_show`) : il décrit ce qui s'est réellement passé pendant
  // l'appel, ce que l'API ne peut pas savoir.
  const mapped = mapCalendlyStatus(d.calendlyStatus);
  const terminal = row.status === "completed" || row.status === "no_show";
  const canceled = mapped === "canceled" && row.status !== "canceled" && !terminal;
  if (mapped && mapped !== row.status && !terminal) {
    data["status"] = mapped;
    updatedFields.push("status");
  }

  try {
    await prisma.calendlyEvent.update({
      where: { id: eventId },
      data: { ...data, enrichedAt: new Date() },
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, reason: "db_write_failed" };
  }

  // Alerte Telegram sur les deux évènements qu'on vient tout juste de rendre
  // détectables. Les catégories existaient depuis l'ADR 0030 mais n'avaient
  // AUCUN émetteur : sans webhook, rien ne pouvait constater une annulation.
  // Best-effort strict — `notify()` ne throw pas, et un échec d'alerte ne doit
  // pas faire passer un enrichissement réussi pour un échec.
  if (canceled || rescheduled) {
    const inviteeEmail = (data["inviteeEmail"] as string | undefined) ?? row.inviteeEmail ?? "";
    // Le nom et le type de RDV viennent de la ligne, complétés par ce que
    // l'enrichissement vient d'écrire. Sans eux, l'alerte disait seulement
    // « annulation » + un identifiant technique : illisible depuis un téléphone,
    // et il fallait ouvrir la console pour savoir DE QUEL rendez-vous il s'agit.
    const inviteeName = (data["inviteeName"] as string | undefined) ?? row.inviteeName ?? undefined;
    const eventName =
      (data["eventTypeName"] as string | undefined) ?? row.eventTypeName ?? undefined;
    try {
      if (canceled) {
        await notify({
          category: "CALENDLY_INVITEE_CANCELED",
          payload: {
            eventUri: eventId,
            inviteeEmail,
            reason: "Annulation constatée côté Calendly",
            ...(inviteeName ? { inviteeName } : {}),
            ...(eventName ? { eventName } : {}),
            ...(row.startTime ? { eventStartTime: row.startTime.toISOString() } : {}),
          },
          // Une annulation ne doit être annoncée qu'une fois, même si
          // l'enrichissement est relancé à la main derrière.
          dedupKey: `cal-cancel-${eventId}`,
          dedupTtlSec: 86_400,
        });
      } else if (rescheduled && row.startTime && d.startTime) {
        await notify({
          category: "CALENDLY_INVITEE_RESCHEDULED",
          payload: {
            eventUri: eventId,
            inviteeEmail,
            oldStart: row.startTime.toISOString(),
            newStart: d.startTime.toISOString(),
            ...(inviteeName ? { inviteeName } : {}),
            ...(eventName ? { eventName } : {}),
          },
          dedupKey: `cal-resched-${eventId}-${d.startTime.toISOString()}`,
          dedupTtlSec: 86_400,
        });
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  return { ok: true, updatedFields };
}
