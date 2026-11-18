/**
 * Étiquettes d'une fiche client (lot B6) : des libellés de classement propres à la console, non
 * synchronisés. `retirerEtiquette` est le SEUL `delete` du chantier : il retire un libellé de
 * classement, jamais une donnée du client.
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import { MessagePourWill } from "@/features/dossier-client/message-affichable";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import type { RoleAdmin } from "@/server/auth/habilitations";

export const ETIQUETTE_MAX = 60;

/** Refus lisible par Will (jamais une erreur technique). */
export class ErreurEtiquette extends MessagePourWill {
  constructor(message: string) {
    super(message);
    this.name = "ErreurEtiquette";
  }
}

type Base = Pick<PrismaClient, "clientEtiquette">;
type Acteur = { userId: string; role: RoleAdmin };

export interface EtiquetteLue {
  readonly id: string;
  readonly libelle: string;
}

export async function lireEtiquettes(db: Base, clientId: string): Promise<EtiquetteLue[]> {
  return db.clientEtiquette.findMany({
    where: { clientId },
    select: { id: true, libelle: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Ajoute un libellé ; un doublon exact est refusé avec un message, sans erreur technique. */
export async function ajouterEtiquette(
  db: Base,
  p: { clientId: string; libelle: string; acteur: Acteur },
): Promise<void> {
  const libelle = p.libelle.trim().replace(/\s+/g, " ");
  if (libelle === "") throw new ErreurEtiquette("Écrivez le libellé de l'étiquette.");
  if ([...libelle].length > ETIQUETTE_MAX) {
    throw new ErreurEtiquette(`Une étiquette tient en ${ETIQUETTE_MAX} caractères au plus.`);
  }
  const existe = await db.clientEtiquette.findFirst({
    where: { clientId: p.clientId, libelle },
    select: { id: true },
  });
  if (existe !== null) throw new ErreurEtiquette("Cette étiquette est déjà sur la fiche.");
  try {
    await db.clientEtiquette.create({ data: { clientId: p.clientId, libelle } });
  } catch (e) {
    // Course entre deux clics : la contrainte unique (fiche, libellé) a tranché.
    if ((e as { code?: string }).code === "P2002") {
      throw new ErreurEtiquette("Cette étiquette est déjà sur la fiche.");
    }
    throw e;
  }
  await logQualiopiActivity({
    action: "dossier_client.etiquette_ajoutee",
    targetType: "ClientEtiquette",
    targetId: p.clientId,
    changes: { clientId: p.clientId },
    session: p.acteur,
  });
}

/** Retire un libellé de classement de CETTE fiche. Rend `false` s'il n'y était plus. */
export async function retirerEtiquette(
  db: Base,
  p: { clientId: string; etiquetteId: string; acteur: Acteur },
): Promise<boolean> {
  const ligne = await db.clientEtiquette.findFirst({
    where: { id: p.etiquetteId, clientId: p.clientId },
    select: { id: true },
  });
  if (ligne === null) return false;
  await db.clientEtiquette.delete({ where: { id: ligne.id } });
  await logQualiopiActivity({
    action: "dossier_client.etiquette_retiree",
    targetType: "ClientEtiquette",
    targetId: p.clientId,
    changes: { clientId: p.clientId },
    session: p.acteur,
  });
  return true;
}
