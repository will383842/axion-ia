// « Ce que rapporte chaque rendez-vous » — la lecture GROUPÉE (2026-10-04, lot L5b).
//
// Une seule requête, agrégée par la base : les rendez-vous RÉSERVÉS sur la
// période (date de capture), groupés par type, nom (repli de classement),
// emplacement, statut, point fait après l'appel et rattachement au dossier
// client. Le résultat tient en quelques dizaines de lignes ; `LIMIT` borne le
// pire cas. L'appelant a déjà passé `gardeLectureAppels`.
//
// Rattachement : la rencontre du dossier client née du rendez-vous
// (`rencontres.calendly_event_id`), rangée et VALIDÉE sur une fiche (`valide`),
// hors client fictif du pilote. C'est le seul lien constaté entre une
// réservation et une fiche ; on n'en déduit aucun autre.
//
// Pas de RLS sur ces tables (axionia) : rien à mesurer sous un autre rôle.
// Build-safety (ADR 0026) : au build, `$queryRaw` du stub rend [] → bilan vide.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  agregerBilan,
  type BilanRendezVous,
  type LigneBilanBrute,
  type PeriodeBilan,
} from "./bilan-rendez-vous";

/** Borne du nombre de lignes groupées : bien au-delà du réel (quelques dizaines). */
export const LIGNES_BILAN_MAX = 5000;

export async function lireBilanRendezVous(
  jours: PeriodeBilan,
  maintenant: Date = new Date(),
): Promise<BilanRendezVous> {
  const depuis = new Date(maintenant.getTime() - jours * 86_400_000);
  const lignes = await prisma.$queryRaw<LigneBilanBrute[]>(Prisma.sql`
    SELECT
      e.type_rendez_vous::text AS "typeRendezVous",
      e.event_type_name AS "eventTypeName",
      e.utm_content AS "utmContent",
      e.status::text AS "status",
      s.issue::text AS "issue",
      (c.id IS NOT NULL) AS "fiche",
      COALESCE(c.statut::text IN ('client_actif', 'client_inactif'), false) AS "client",
      COUNT(*)::int AS "n"
    FROM calendly_events e
    LEFT JOIN rendez_vous_suivis s ON s.calendly_event_id = e.id
    LEFT JOIN rencontres r
      ON r.calendly_event_id = e.id
     AND r.rattachement_statut::text = 'valide'
     AND r.est_test_interne = false
    LEFT JOIN clients c ON c.id = r.client_id
    WHERE e.captured_at >= ${depuis} AND e.captured_at <= ${maintenant}
    GROUP BY 1, 2, 3, 4, 5, 6, 7
    LIMIT ${LIGNES_BILAN_MAX}
  `);
  return agregerBilan(Array.isArray(lignes) ? lignes : []);
}
