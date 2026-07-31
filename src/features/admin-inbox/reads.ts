// Boîte de réception — accusés de lecture (ADR 0036, 2026-07-29).
//
// « Non lu » façon boîte mail : une entrée est non lue tant que l'admin courant
// n'a pas ouvert sa fiche. Le marquage se fait à l'ouverture, sans geste.
//
// Deux principes qui évitent les pièges classiques :
//
//   • ABSENCE DE LIGNE = NON LU. Aucun backfill n'est nécessaire, et
//     l'historique démarre logiquement à « tout non lu » — ce qui est vrai.
//   • ÉTAT PAR ADMIN. Dans une boîte partagée, ce que l'un a lu ne l'est pas
//     pour l'autre. Une colonne unique sur la table source ne saurait pas
//     l'exprimer, d'où la table dédiée.
//
// Jamais bloquant : marquer comme lu est un confort. Si l'écriture échoue, la
// fiche s'affiche quand même — on ne refuse pas de montrer une demande client
// parce qu'un accusé de lecture n'a pas pu être enregistré.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import type { InboxChannel } from "./types";

/** Valeurs de l'enum Prisma `AdminInboxEntity`. */
export type InboxEntityType =
  "submission" | "calendly_event" | "job_application" | "podcast_request";

/** Canal d'affichage → table source. */
export const ENTITY_BY_CHANNEL: Record<InboxChannel, InboxEntityType> = {
  message: "submission",
  appel: "calendly_event",
  candidature: "job_application",
  podcast: "podcast_request",
};

/**
 * Marque une entrée comme lue par un admin. Idempotent (upsert sur la clé
 * unique) : rejouable à chaque affichage de la fiche sans créer de doublon ni
 * écraser la date de première lecture.
 *
 * @returns `true` si l'accusé est enregistré, `false` en cas d'échec — jamais
 *          d'exception, l'appelant est une page qui doit s'afficher malgré tout.
 */
export async function markInboxRead(
  adminUserId: string | null | undefined,
  entityType: InboxEntityType,
  entityId: string,
): Promise<boolean> {
  // Sessions sans id (jeton legacy, mode auditeur) : on ne marque rien plutôt
  // que d'inventer un propriétaire.
  if (!adminUserId || !entityId) return false;
  try {
    await prisma.adminInboxRead.upsert({
      where: {
        adminUserId_entityType_entityId: { adminUserId, entityType, entityId },
      },
      // `update: {}` volontaire : on conserve la date de PREMIÈRE lecture.
      // La rafraîchir ferait dire à la donnée « lu à l'instant » alors qu'elle
      // l'a été il y a trois jours.
      update: {},
      create: { adminUserId, entityType, entityId },
    });
    return true;
  } catch (e) {
    Sentry.captureException(e);
    return false;
  }
}

/**
 * Ids déjà lus par cet admin, par type d'entité.
 *
 * Une seule requête pour toute la boîte : lire canal par canal multiplierait
 * les allers-retours sur une page qui en fait déjà quatre.
 */
export async function fetchReadIds(
  adminUserId: string | null | undefined,
): Promise<Record<InboxEntityType, Set<string>>> {
  const empty: Record<InboxEntityType, Set<string>> = {
    submission: new Set(),
    calendly_event: new Set(),
    job_application: new Set(),
    podcast_request: new Set(),
  };
  if (!adminUserId) return empty;
  try {
    const rows = await prisma.adminInboxRead.findMany({
      where: { adminUserId },
      select: { entityType: true, entityId: true },
    });
    for (const r of rows) empty[r.entityType as InboxEntityType].add(r.entityId);
    return empty;
  } catch (e) {
    // En cas d'échec on renvoie « rien de lu » : tout apparaît non lu, ce qui
    // attire l'œil au lieu de masquer silencieusement des demandes en attente.
    Sentry.captureException(e);
    return empty;
  }
}
