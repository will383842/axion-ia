/**
 * Qualiopi — État des fonds OPCO (lot OPCO A5) : lecture et ajout en base.
 *
 * Stub-aware : au build (`stub.invalid`) ou en panne, les lectures rendent `[]`,
 * donc « aucun relevé » — jamais une suspension inventée. Les requêtes sont
 * BORNÉES (`take`). Aucune fonction de modification ni de suppression : un
 * relevé se corrige par un relevé plus récent.
 */

import { prisma } from "@/lib/prisma";
import type { Opco, StatutFondsOpco } from "../../../../prisma/generated/client";
import { opcoDuClient } from "./opco-referentiel";
import { etatFondsPour, type EtatFonds, type ReleveEtatFonds } from "./etat-fonds-opco";

const PLUS_RECENT_DABORD = [{ releveLe: "desc" as const }, { createdAt: "desc" as const }];

/** Tous les relevés, du plus récent au plus ancien (borné). */
export async function listerRelevesEtatFonds(take = 2000): Promise<ReleveEtatFonds[]> {
  try {
    return await prisma.etatFondsOpco.findMany({ orderBy: PLUS_RECENT_DABORD, take });
  } catch {
    return [];
  }
}

/**
 * L'état des fonds qui vaut pour un client, ou `null` (aucun OPCO, aucun relevé).
 * L'OPCO se lit par la règle unique (lot A7a) : l'appelant fournit les DEUX champs.
 */
export async function etatFondsDuClient(
  client: {
    opco: string | null;
    opcoIdentifie?: string | null;
    idcc: string | null;
    effectif: number | null;
  },
  aLaDate: Date = new Date(),
): Promise<EtatFonds | null> {
  const opco = opcoDuClient(client);
  if (opco === null) return null;
  let releves: ReleveEtatFonds[] = [];
  try {
    releves = await prisma.etatFondsOpco.findMany({
      where: { opco: opco as Opco },
      orderBy: PLUS_RECENT_DABORD,
      take: 500,
    });
  } catch {
    return null;
  }
  return etatFondsPour({
    opco,
    idcc: client.idcc,
    effectif: client.effectif,
    aLaDate,
    releves,
  });
}

/** Le relevé le plus récent, tous OPCO confondus (veille mensuelle). */
export async function dernierReleveEtatFonds(): Promise<{ id: string; releveLe: Date } | null> {
  try {
    return await prisma.etatFondsOpco.findFirst({
      orderBy: PLUS_RECENT_DABORD,
      select: { id: true, releveLe: true },
    });
  } catch {
    return null;
  }
}

/** Ajoute un relevé. Jamais d'écrasement : chaque relevé est une ligne. */
export async function ajouterReleveEtatFonds(input: {
  opco: Opco;
  idcc: string | null;
  statut: StatutFondsOpco;
  perimetre: string | null;
  effectifMaxExclu: number | null;
  dateLimiteDepot: Date | null;
  sourceUrl: string;
  releveLe: Date;
  note: string | null;
  createdById: string | null;
}): Promise<{ id: string }> {
  return prisma.etatFondsOpco.create({ data: input, select: { id: true } });
}
