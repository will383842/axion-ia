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
// Règle d'écriture : on N'ÉCRASE JAMAIS une valeur saisie par un humain.
// L'admin qui a recopié un nom depuis Gmail a raison contre l'API — sinon un
// enrichissement tardif effacerait un travail manuel. Chaque champ n'est donc
// écrit que s'il est vide en base (`?? undefined` + garde explicite).

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
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
  setIfEmpty("startTime", row.startTime, d.startTime);
  setIfEmpty("endTime", row.endTime, d.endTime);
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

  // Le statut est le SEUL champ qu'on autorise à écraser : une annulation
  // faite côté Calendly doit remonter, c'est tout l'intérêt d'interroger
  // l'API. On ne rétrograde jamais un statut posé manuellement en fin de
  // parcours (`completed` / `no_show`), qui décrit ce qui s'est réellement
  // passé et que l'API ne connaît pas.
  const mapped = mapCalendlyStatus(d.calendlyStatus);
  if (mapped && mapped !== row.status && row.status !== "completed" && row.status !== "no_show") {
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

  return { ok: true, updatedFields };
}
