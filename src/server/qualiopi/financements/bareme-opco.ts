/**
 * Qualiopi — Résolution du référentiel OPCO versionné (Lot 5).
 *
 * Lecture DB stub-aware (try/catch → null / []). Le versionnement suit le même
 * principe que `TrainerCompensationRule` : la ligne en vigueur à une date est
 * celle dont `dateEffet <= asOf` et (`effectiveTo` null OU `effectiveTo > asOf`),
 * la plus récente par `dateEffet` gagnant en cas de chevauchement.
 *
 * Le barème dossier (TrainingSession.priseEnCharge*) reste PRIORITAIRE : ce
 * référentiel n'est qu'un fallback de pré-remplissage / d'estimation.
 */

import { prisma } from "@/lib/prisma";
import type { BaremeOpco, Opco } from "../../../../prisma/generated/client";
import { isOpcoId } from "./opco-referentiel";

/** Modalité normalisée pour la sélection du plafond horaire. */
export type ModaliteBareme = "intra" | "inter_presentiel" | "inter_distanciel";

/**
 * Barème OPCO en vigueur pour un OPCO à une date donnée, ou `null`.
 *
 * Stub-safe. Renvoie `null` si l'OPCO est inconnu, si aucun barème n'est en
 * vigueur, ou au build (stub.invalid).
 */
export async function resolveBaremeOpco(
  opco: string | null | undefined,
  asOf: Date = new Date(),
): Promise<BaremeOpco | null> {
  if (!isOpcoId(opco)) return null;
  try {
    return await prisma.baremeOpco.findFirst({
      where: {
        opco: opco as Opco,
        dateEffet: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      },
      orderBy: { dateEffet: "desc" },
    });
  } catch {
    return null;
  }
}

/**
 * Tarif horaire plafond (CENTIMES) issu d'un barème selon la modalité, ou `null`
 * si le plafond correspondant n'est pas renseigné (structure vide).
 */
export function tarifHoraireBaremeCents(
  bareme: Pick<BaremeOpco, "intraHoraireCents" | "interPresentielCents" | "interDistancielCents">,
  modalite: ModaliteBareme,
): number | null {
  if (modalite === "intra") return bareme.intraHoraireCents;
  if (modalite === "inter_distanciel") return bareme.interDistancielCents;
  return bareme.interPresentielCents;
}

/**
 * Tous les barèmes actuellement EN VIGUEUR (un par OPCO au plus, le plus récent).
 * Sert au tableau admin et à l'alerte de péremption. Stub-safe → [].
 */
export async function listBaremesEnVigueur(asOf: Date = new Date()): Promise<BaremeOpco[]> {
  try {
    const rows = await prisma.baremeOpco.findMany({
      where: {
        dateEffet: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      },
      orderBy: [{ opco: "asc" }, { dateEffet: "desc" }],
    });
    // Ne conserver que le plus récent par OPCO (findMany déjà trié desc/dateEffet).
    const parOpco = new Map<Opco, BaremeOpco>();
    for (const row of rows) {
      if (!parOpco.has(row.opco)) parOpco.set(row.opco, row);
    }
    return [...parOpco.values()];
  } catch {
    return [];
  }
}

/** Historique complet d'un OPCO (toutes versions), le plus récent d'abord. Stub-safe → []. */
export async function listHistoriqueOpco(opco: string): Promise<BaremeOpco[]> {
  if (!isOpcoId(opco)) return [];
  try {
    return await prisma.baremeOpco.findMany({
      where: { opco: opco as Opco },
      orderBy: { dateEffet: "desc" },
    });
  } catch {
    return [];
  }
}
