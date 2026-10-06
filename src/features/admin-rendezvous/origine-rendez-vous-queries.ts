// « Rendez-vous par origine » — la lecture BORNÉE (2026-10-05).
//
// Une requête : les réservations de la période (index `captured_at`), avec
// uniquement la liste questions/réponses du payload et les UTM. Bornée par la
// période (30/90 jours) ET par `LIGNES_ORIGINE_MAX`. Aucune colonne ajoutée.
// L'ancienne ligne d'un rendez-vous déplacé est ignorée (même règle que le bilan).
// L'appelant a déjà passé `gardeLectureAppels`. Au build, le stub rend [].

import { prisma } from "@/lib/prisma";
import { agregerOrigines, type BilanOrigine, type LigneOrigineBrute } from "./origine-rendez-vous";

export const LIGNES_ORIGINE_MAX = 5000;

export async function lireOrigineRendezVous(
  jours: number,
  maintenant: Date = new Date(),
): Promise<BilanOrigine> {
  const depuis = new Date(maintenant.getTime() - jours * 86_400_000);
  const lignes = await prisma.$queryRaw<LigneOrigineBrute[]>`
    SELECT
      e.type_rendez_vous::text AS "typeRendezVous",
      e.event_type_name AS "eventTypeName",
      e.captured_at AS "capturedAt",
      e.status::text AS "status",
      e.utm_source AS "utmSource",
      e.utm_medium AS "utmMedium",
      e.utm_campaign AS "utmCampaign",
      COALESCE(
        e.raw_payload -> 'invitee' -> 'questions_and_answers',
        e.raw_payload -> 'questions_and_answers',
        e.raw_payload -> 'payload' -> 'questions_and_answers'
      ) AS "qa"
    FROM calendly_events e
    WHERE e.captured_at >= ${depuis} AND e.captured_at <= ${maintenant}
      AND COALESCE(e.raw_payload -> 'invitee' ->> 'rescheduled', '') <> 'true'
      AND NOT EXISTS (SELECT 1 FROM calendly_reports cr WHERE cr.ancien_event_uri = e.event_uri)
    ORDER BY e.captured_at DESC
    LIMIT ${LIGNES_ORIGINE_MAX}
  `;
  return agregerOrigines(Array.isArray(lignes) ? lignes : [], jours, maintenant);
}
