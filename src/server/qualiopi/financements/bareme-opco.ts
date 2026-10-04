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
import { choisirBaremeBranche, idccValide, tranchesCandidates } from "./bareme-opco-branche";
import { isOpcoId } from "./opco-referentiel";

/** Modalité normalisée pour la sélection du plafond horaire. */
export type ModaliteBareme = "intra" | "inter_presentiel" | "inter_distanciel";

/**
 * Barème OPCO en vigueur pour un OPCO à une date donnée, ou `null`.
 *
 * Lot A4 — les plafonds varient par BRANCHE (IDCC) et par TAILLE : `critere`
 * oriente le choix (cf. `choisirBaremeBranche`). Sans critère, seules les lignes
 * hors branche et `tous` sont candidates (comportement historique).
 *
 * Stub-safe. Renvoie `null` si l'OPCO est inconnu, si aucun barème n'est en
 * vigueur, ou au build (stub.invalid).
 */
export async function resolveBaremeOpco(
  opco: string | null | undefined,
  asOf: Date = new Date(),
  critere: { idcc?: string | null; effectif?: number | null } = {},
): Promise<BaremeOpco | null> {
  if (!isOpcoId(opco)) return null;
  const idcc = idccValide(critere.idcc);
  try {
    const lignes = await prisma.baremeOpco.findMany({
      where: {
        opco: opco as Opco,
        dateEffet: { lte: asOf },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] },
          { OR: idcc ? [{ idcc: null }, { idcc }] : [{ idcc: null }] },
        ],
        trancheEffectif: { in: tranchesCandidates(critere.effectif) },
      },
      orderBy: { dateEffet: "desc" },
    });
    return choisirBaremeBranche(lignes, { idcc, effectif: critere.effectif ?? null });
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
 * Tous les barèmes actuellement EN VIGUEUR (un par OPCO × IDCC × tranche, le plus
 * récent — lot A4 : un barème de branche ne masque pas celui de l'OPCO).
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
    // Ne conserver que le plus récent par périmètre (findMany déjà trié desc/dateEffet).
    const parPerimetre = new Map<string, BaremeOpco>();
    for (const row of rows) {
      const cle = `${row.opco}|${row.idcc ?? ""}|${row.trancheEffectif ?? "tous"}`;
      if (!parPerimetre.has(cle)) parPerimetre.set(cle, row);
    }
    return [...parPerimetre.values()];
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
