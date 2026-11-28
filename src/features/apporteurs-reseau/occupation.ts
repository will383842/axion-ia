/**
 * Réseau d'apporteurs — qui OCCUPE un périmètre d'entreprise ? (contrat 2.6 / 2.8, art. 3.2 et 3.5)
 *
 * Extrait de `refusBienRecu` (PR F #2464), sans changer son comportement : les présentations du SIREN,
 * les établissements, `memePerimetre`, `presentationOccupe`, les réservations. La file d'attente
 * (`file-attente.ts`) s'en sert pour savoir si une entreprise est libre. G y ajoutera la prise en
 * charge Société.
 *
 * Atteint par le WORKER : aucun `server-only`.
 */

import { prisma } from "@/lib/prisma";
import type { StatutPresentation } from "../../../prisma/generated/client";

import {
  lireEtablissements,
  memePerimetre,
  type Etablissement,
} from "./etablissement-presentation";
import { presentationOccupe, versReservationProvisoire } from "./regle-attribution";
import { lireReservations, type Reservation } from "./reservation-presentation";

type Db = Pick<typeof prisma, "presentationEntreprise">;

export interface PresentationAutre {
  id: string;
  apporteurId: string;
  statut: StatutPresentation;
  contactEnvoyeAt: Date | null;
  recueAt: Date;
  protegeeJusquAt: Date | null;
}

const CHAMPS = {
  id: true,
  apporteurId: true,
  statut: true,
  contactEnvoyeAt: true,
  recueAt: true,
  protegeeJusquAt: true,
} as const;

/**
 * Les AUTRES présentations du SIREN qui visent le même périmètre que `moi`, et les réservations des
 * terminées (repos de 30 jours). Deux lectures : les ACTIVES (réservée, confirmée) ne sortent jamais de
 * la fenêtre à cause d'un SIREN qui accumule des présentations terminées (#2464, point 2) ; les terminées,
 * bornées, ne servent qu'au repos : les plus récemment protégées d'abord.
 *
 * `moi.perimetre` absent : lu à partir de `moi.presentationId`.
 */
export async function lireAutresOccupants(
  db: Db,
  moi: {
    siren: string;
    presentationId?: string;
    saufApporteurId?: string;
    perimetre?: Etablissement;
  },
): Promise<{ autres: PresentationAutre[]; reservations: Map<string, Reservation> }> {
  const commun = {
    siren: moi.siren,
    ...(moi.presentationId ? { id: { not: moi.presentationId } } : {}),
    ...(moi.saufApporteurId ? { apporteurId: { not: moi.saufApporteurId } } : {}),
  };
  const [actives, terminees20] = await Promise.all([
    db.presentationEntreprise.findMany({
      where: { ...commun, statut: { in: ["reservee", "confirmee"] } },
      select: CHAMPS,
      orderBy: { recueAt: "asc" },
      take: 100,
    }),
    db.presentationEntreprise.findMany({
      where: { ...commun, statut: "terminee" },
      select: CHAMPS,
      orderBy: { protegeeJusquAt: { sort: "desc", nulls: "first" } },
      take: 20,
    }),
  ]);
  const tous = [...actives, ...terminees20];
  // Contrat 2.6 : seuls comptent ceux qui visent le même périmètre (même établissement, ou
  // toute l'entreprise) ; un autre établissement de la même entreprise ne bloque rien.
  const etabs = await lireEtablissements([
    ...(moi.presentationId ? [moi.presentationId] : []),
    ...tous.map((a) => a.id),
  ]);
  const perimetre = moi.perimetre ?? etabs.get(moi.presentationId ?? "")!;
  const autres = tous.filter((a) => memePerimetre(perimetre, etabs.get(a.id)!));
  const terminees = autres.filter((a) => a.statut === "terminee");
  const reservations =
    terminees.length > 0
      ? await lireReservations(terminees.map((a) => a.id))
      : new Map<string, Reservation>();
  return { autres, reservations };
}

/**
 * Le périmètre est-il OCCUPÉ à cette date ? Oui si une présentation d'un autre apporteur (hors
 * `saufApporteurId`) le retient : réservée ou confirmée qui court, ou terminée dans ses 30 jours de
 * repos (`echueAt`). Une attribution échue (`protegeeJusquAt` passée) ou un repos fini libèrent.
 * Date illisible : occupé (jamais deux occupants).
 */
export async function perimetreOccupe(
  db: Db,
  perimetre: { siren: string; siret: string | null; entreprise: boolean },
  maintenant: Date,
  opts: { saufApporteurId?: string } = {},
): Promise<boolean> {
  const etab: Etablissement = {
    siret: perimetre.entreprise ? null : perimetre.siret,
    entreprise: perimetre.entreprise,
    exclus: [],
  };
  const { autres, reservations } = await lireAutresOccupants(db, {
    siren: perimetre.siren,
    ...(opts.saufApporteurId ? { saufApporteurId: opts.saufApporteurId } : {}),
    perimetre: etab,
  });
  const manquantes = autres.filter((a) => a.statut === "reservee" && !reservations.has(a.id));
  if (manquantes.length > 0) {
    for (const [k, v] of await lireReservations(manquantes.map((a) => a.id)))
      reservations.set(k, v);
  }
  return autres.some((a) =>
    presentationOccupe(
      { statut: a.statut, protegeeJusquAt: a.protegeeJusquAt },
      maintenant,
      versReservationProvisoire(a.recueAt, reservations.get(a.id)),
    ),
  );
}
