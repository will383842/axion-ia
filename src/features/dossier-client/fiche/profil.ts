/**
 * Profil d'une fiche client (lot B6) : responsable, archivage. Écrit `client_profils` par
 * `upsert` : jamais de `delete`, jamais d'effacement. Archiver pose une date et un motif facultatif,
 * « sortir des archives » les remet à vide ; ni le statut du client, ni ses devis, factures,
 * rendez-vous ou envois programmés ne sont touchés.
 *
 * L'archivage est réservé au super-administrateur : le rôle est revérifié ICI, avant toute lecture
 * ou écriture de la base (les actions le vérifient aussi, ceci est la dernière barrière).
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import { MessagePourWill } from "@/features/dossier-client/message-affichable";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { estSuperAdmin, type RoleAdmin } from "@/server/auth/habilitations";

export const RESPONSABLE_MAX = 80;
export const MOTIF_MAX = 200;

/** Refus lisible par Will (jamais une erreur technique). */
export class ErreurProfil extends MessagePourWill {
  constructor(message: string) {
    super(message);
    this.name = "ErreurProfil";
  }
}

type Base = Pick<PrismaClient, "clientProfil">;
type Acteur = { userId: string; role: RoleAdmin };

export interface ProfilLu {
  readonly responsable: string | null;
  readonly archiveLe: Date | null;
  readonly archiveMotif: string | null;
}

/** Le profil de la fiche (ligne absente = rien de renseigné). */
export async function lireProfil(db: Base, clientId: string): Promise<ProfilLu> {
  const l = await db.clientProfil.findUnique({
    where: { clientId },
    select: { responsableLabel: true, archiveLe: true, archiveMotif: true },
  });
  return {
    responsable: l?.responsableLabel ?? null,
    archiveLe: l?.archiveLe ?? null,
    archiveMotif: l?.archiveMotif ?? null,
  };
}

function exigerSuperAdmin(acteur: Acteur): void {
  if (!estSuperAdmin(acteur.role)) {
    throw new ErreurProfil("Seul le super-administrateur peut archiver ou sortir des archives.");
  }
}

/** Pose (ou vide, si le texte est vide) le responsable du client. */
export async function definirResponsable(
  db: Base,
  p: { clientId: string; libelle: string; acteur: Acteur },
): Promise<void> {
  const libelle = p.libelle.trim();
  if ([...libelle].length > RESPONSABLE_MAX) {
    throw new ErreurProfil(`Le responsable tient en ${RESPONSABLE_MAX} caractères au plus.`);
  }
  const valeur = libelle === "" ? null : libelle;
  await db.clientProfil.upsert({
    where: { clientId: p.clientId },
    create: { clientId: p.clientId, responsableLabel: valeur },
    update: { responsableLabel: valeur },
  });
  await logQualiopiActivity({
    action: "dossier_client.responsable_defini",
    targetType: "ClientProfil",
    targetId: p.clientId,
    changes: { clientId: p.clientId, renseigne: valeur !== null },
    session: p.acteur,
  });
}

/** `fait` : l'écriture a eu lieu ; `deja` : la fiche était déjà dans cet état (rien écrit). */
export type IssueArchivage = "fait" | "deja";

/** Met la fiche de côté : une date et un motif facultatif, rien d'autre ne change. */
export async function archiver(
  db: Base,
  p: { clientId: string; motif: string; maintenant: Date; acteur: Acteur },
): Promise<IssueArchivage> {
  exigerSuperAdmin(p.acteur);
  const motif = p.motif.trim();
  if ([...motif].length > MOTIF_MAX) {
    throw new ErreurProfil(`Le motif tient en ${MOTIF_MAX} caractères au plus.`);
  }
  const avant = await lireProfil(db, p.clientId);
  if (avant.archiveLe !== null) return "deja";
  await db.clientProfil.upsert({
    where: { clientId: p.clientId },
    create: {
      clientId: p.clientId,
      archiveLe: p.maintenant,
      archiveMotif: motif === "" ? null : motif,
    },
    update: { archiveLe: p.maintenant, archiveMotif: motif === "" ? null : motif },
  });
  await logQualiopiActivity({
    action: "dossier_client.archive",
    targetType: "ClientProfil",
    targetId: p.clientId,
    changes: { clientId: p.clientId },
    session: p.acteur,
  });
  return "fait";
}

/** Sort la fiche des archives : la date et le motif sont remis à vide. */
export async function desarchiver(
  db: Base,
  p: { clientId: string; acteur: Acteur },
): Promise<IssueArchivage> {
  exigerSuperAdmin(p.acteur);
  const avant = await lireProfil(db, p.clientId);
  if (avant.archiveLe === null) return "deja";
  await db.clientProfil.upsert({
    where: { clientId: p.clientId },
    create: { clientId: p.clientId },
    update: { archiveLe: null, archiveMotif: null },
  });
  await logQualiopiActivity({
    action: "dossier_client.desarchive",
    targetType: "ClientProfil",
    targetId: p.clientId,
    changes: { clientId: p.clientId },
    session: p.acteur,
  });
  return "fait";
}
