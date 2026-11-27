// Réseau d'apporteurs — règle « validation d'une entreprise présentée au premier rendez-vous
// tenu », lot 1 (2026-11-25) : les DONNÉES seules. La présentation est RÉSERVÉE à l'apporteur
// jusqu'à une date ; un rendez-vous tenu la valide. Rien ne lit ni n'écrit encore ces tables :
// ce module pose seulement les accès que les lots suivants appelleront.
//
// Table séparée, sans clé étrangère, tolérante à son absence EN LECTURE (fenêtre app/worker),
// comme `presentation_etablissement`. Une présentation SANS ligne est d'avant cette règle.
// L'ÉCRITURE, elle, ne rattrape rien : une réservation non enregistrée ne passe pas en silence.
//
// ⚠️ Atteint par le WORKER : aucun `server-only`.

import { prisma } from "@/lib/prisma";

import { JOURS_SANS_DECLARATION_APRES_FIN } from "./regle-attribution";
import { ajouterJours } from "./regles";

/** La seule règle posée par ce lot : validation au premier rendez-vous tenu. */
const REGLE_RENDEZ_VOUS = "rendez_vous";

export interface Reservation {
  presentationId: string;
  /** La règle figée à la présentation (« rendez_vous »). */
  regle: string;
  reserveeJusquAt: Date;
  echueAt: Date | null;
  rendezVousPrisAt: Date | null;
  rendezVousAt: Date | null;
  /** « calendly:<id> » ou « rencontre:<id> » (`cleRendezVous`). */
  rendezVousCle: string | null;
  /** calendly | rencontre | saisie | commande. */
  validationSource: string | null;
  valideeAt: Date | null;
}

/** L'erreur Prisma « la table n'existe pas » (P2021) : migration pas encore passée. */
export function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/**
 * Les réservations des présentations. Une présentation sans ligne est ABSENTE de la carte
 * (elle est d'avant la règle). Liste vide ou table absente : carte vide. Toute autre erreur
 * remonte.
 */
export async function lireReservations(ids: readonly string[]): Promise<Map<string, Reservation>> {
  const m = new Map<string, Reservation>();
  if (ids.length === 0) return m;
  try {
    const ls = await prisma.presentationReservation.findMany({
      where: { presentationId: { in: [...ids] } },
      select: {
        presentationId: true,
        regle: true,
        reserveeJusquAt: true,
        echueAt: true,
        rendezVousPrisAt: true,
        rendezVousAt: true,
        rendezVousCle: true,
        validationSource: true,
        valideeAt: true,
      },
    });
    for (const l of ls) m.set(l.presentationId, l);
  } catch (err) {
    if (!tableAbsente(err)) throw err;
  }
  return m;
}

/**
 * E1 (contrat 2.8) : les présentations dont la réservation a pris fin SANS validation depuis moins de
 * 30 jours. Elles sont `terminee` mais occupent encore leur entreprise : les lecteurs d'occupation
 * (`statut in [reservee, confirmee]`) y ajoutent `id in <ces ids>`. Table absente : aucune.
 */
export async function lireIdsEnGrace(
  maintenant: Date,
  db: Pick<typeof prisma, "presentationReservation"> = prisma,
): Promise<string[]> {
  try {
    const ls = await db.presentationReservation.findMany({
      where: {
        regle: "rendez_vous",
        valideeAt: null,
        echueAt: { gt: ajouterJours(maintenant, -(JOURS_SANS_DECLARATION_APRES_FIN + 1)) },
      },
      select: { presentationId: true },
      take: 2000,
    });
    return ls.map((l) => l.presentationId);
  } catch (err) {
    if (!tableAbsente(err)) throw err;
    return [];
  }
}

/**
 * Enregistre la réservation d'une présentation (règle « rendez_vous »). NE rattrape AUCUNE
 * erreur, pas même la table absente : l'appelant décide (et sa transaction s'annule).
 */
export async function enregistrerReservation(
  presentationId: string,
  reserveeJusquAt: Date,
  db: Pick<typeof prisma, "presentationReservation"> = prisma,
): Promise<void> {
  await db.presentationReservation.create({
    data: { presentationId, regle: REGLE_RENDEZ_VOUS, reserveeJusquAt },
  });
}

/**
 * La clé d'un rendez-vous : « calendly:<id> » s'il vient de Calendly, sinon « rencontre:<id> »,
 * sinon `null`. La clé Calendly prime TOUJOURS (une rencontre née d'un événement Calendly garde
 * la clé de l'événement : un seul rendez-vous, une seule clé).
 */
export function cleRendezVous(e: {
  calendlyEventId?: string | null;
  rencontreId?: string | null;
}): string | null {
  if (e.calendlyEventId) return `calendly:${e.calendlyEventId}`;
  if (e.rencontreId) return `rencontre:${e.rencontreId}`;
  return null;
}
