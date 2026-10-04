/**
 * Lecture partagée des sessions À VENIR financées par un OPCO (lot OPCO A7c).
 *
 * Trois règles en ont besoin (`fonds_opco_suspendus_session`,
 * `donnees_opco_incompletes`, le volet « aucun relevé » d'`etat_fonds_perime`) :
 * elles lisent la MÊME définition, pour qu'une session ne soit pas « financée par
 * un OPCO » pour l'une et pas pour l'autre.
 *
 * « Financée par un OPCO » : type de financement OPCO ou mixte, OU subrogation
 * posée, OU dossier de financement OPCO/mixte ouvert — la même largeur que
 * `aucun_bareme_opco`, qui accepte la subrogation ou un dossier.
 *
 * La requête LÈVE en cas d'erreur, et c'est voulu : une règle qui lève est
 * mise de côté par l'évaluateur, qui suspend alors la résolution automatique.
 * Une lecture qui rendrait `[]` sur panne refermerait toutes les alertes.
 *
 * L'OPCO se lit par `opcoDuClient` : on sélectionne `opco` ET `opcoIdentifie`
 * (garde `un-seul-opco-par-client`).
 */

import { prisma } from "@/lib/prisma";

const JOUR_MS = 24 * 60 * 60 * 1000;
const PLAFOND_SESSIONS = 500;

export type ClientOpcoLu = {
  id: string;
  type: "entreprise" | "particulier";
  opco: string | null;
  opcoIdentifie: string | null;
  idcc: string | null;
  effectif: number | null;
};

export type SessionOpcoAVenir = {
  id: string;
  numero: string;
  dateDebut: Date;
  client: ClientOpcoLu | null;
  dossiersFinancement: { depotFaitLe: Date | null }[];
};

export async function sessionsOpcoAVenir(
  now: Date,
  horizonJours: number,
): Promise<SessionOpcoAVenir[]> {
  return prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      dateDebut: { gt: now, lte: new Date(now.getTime() + horizonJours * JOUR_MS) },
      OR: [
        { financementType: { in: ["opco", "mixte"] } },
        { opcoSubrogation: true },
        { dossiersFinancement: { some: { type: { in: ["opco", "mixte"] } } } },
      ],
    },
    orderBy: { dateDebut: "asc" },
    take: PLAFOND_SESSIONS,
    select: {
      id: true,
      numero: true,
      dateDebut: true,
      client: {
        select: {
          id: true,
          type: true,
          opco: true,
          opcoIdentifie: true,
          idcc: true,
          effectif: true,
        },
      },
      dossiersFinancement: {
        where: { type: { in: ["opco", "mixte"] } },
        select: { depotFaitLe: true },
      },
    },
  });
}
