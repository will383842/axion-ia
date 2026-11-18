/**
 * « Noter le départ » d'une personne de la fiche (lot B5). On POSE une date et un statut, on
 * n'efface rien : la personne, ses adresses, ses rôles et ses faits passés restent. L'effacement
 * RGPD est un autre circuit (`rgpd-erase.ts`), que ce module ne touche pas. Aucun message n'est
 * envoyé : une personne partie est seulement exclue des envois (voir `instantane-dossier.ts`).
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import { MessagePourWill } from "@/features/dossier-client/message-affichable";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import type { RoleAdmin } from "@/server/auth/habilitations";

/** Refus lisible par Will (jamais une erreur technique). */
export class ErreurDepart extends MessagePourWill {
  constructor(message: string) {
    super(message);
    this.name = "ErreurDepart";
  }
}

type Base = Pick<PrismaClient, "clientContact">;
type Acteur = { userId: string; role: RoleAdmin };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** « AAAA-MM-JJ » de ce jour en heure de Paris. */
export function aujourdhuiParis(maintenant: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(maintenant);
}

/** La date existe au calendrier, n'est pas future (heure de Paris) et n'est pas antérieure à 2000. */
export function dateDeDepartValide(brut: string, maintenant: Date): boolean {
  if (!DATE.test(brut)) return false;
  const d = new Date(`${brut}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== brut) return false;
  return brut >= "2000-01-01" && brut <= aujourdhuiParis(maintenant);
}

/** L'état de départ de chaque personne d'une fiche (lecture seule, une seule requête). */
export type EtatDeDepart = { readonly statut: "actif" | "parti"; readonly partiLe: Date | null };

export async function lireEtatsDeDepart(
  db: Base,
  clientId: string,
): Promise<ReadonlyMap<string, EtatDeDepart>> {
  const lignes = await db.clientContact.findMany({
    where: { clientId },
    select: { id: true, statut: true, partiLe: true },
  });
  const m = new Map<string, EtatDeDepart>();
  for (const l of lignes) m.set(l.id, { statut: l.statut, partiLe: l.partiLe });
  return m;
}

/** `fait` : l'écriture a eu lieu ; `deja` : la personne était déjà dans cet état (rien écrit, rien tracé). */
export type IssueDepart = "fait" | "deja";

/** Pose `statut = parti` et `parti_le`. La personne doit être DE ce client et encore active. */
export async function noterDepart(
  db: Base,
  p: { contactId: string; clientId: string; partiLe: string; maintenant: Date; acteur: Acteur },
): Promise<{ issue: IssueDepart; contactFacturation: boolean }> {
  if (!dateDeDepartValide(p.partiLe, p.maintenant)) {
    throw new ErreurDepart("La date de départ n'est pas valable (elle ne peut pas être à venir).");
  }
  const r = await db.clientContact.updateMany({
    where: { id: p.contactId, clientId: p.clientId, statut: "actif" },
    data: { statut: "parti", partiLe: new Date(`${p.partiLe}T00:00:00.000Z`) },
  });
  if (r.count === 0) {
    const l = await db.clientContact.findFirst({
      where: { id: p.contactId, clientId: p.clientId },
      select: { estContactFacturation: true },
    });
    if (l === null) throw new ErreurDepart("Cette personne n'est pas sur cette fiche.");
    return { issue: "deja", contactFacturation: l.estContactFacturation };
  }
  // Les factures et devis partent vers `Client.contactEmail` : le départ ne les arrête pas.
  const facturation = await db.clientContact.findFirst({
    where: { id: p.contactId, clientId: p.clientId },
    select: { estContactFacturation: true },
  });
  await logQualiopiActivity({
    action: "dossier_client.depart_note",
    targetType: "ClientContact",
    targetId: p.contactId,
    // Ni nom ni adresse : seulement la fiche et la date posée.
    changes: { clientId: p.clientId, partiLe: p.partiLe },
    session: p.acteur,
  });
  return { issue: "fait", contactFacturation: facturation?.estContactFacturation ?? false };
}

/** Remet la personne « actif » et efface la seule date de départ (rien d'autre n'est touché). */
export async function annulerDepart(
  db: Base,
  p: { contactId: string; clientId: string; acteur: Acteur },
): Promise<IssueDepart> {
  const avant = await db.clientContact.findFirst({
    where: { id: p.contactId, clientId: p.clientId },
    select: { statut: true, partiLe: true },
  });
  if (avant === null) throw new ErreurDepart("Cette personne n'est pas sur cette fiche.");
  if (avant.statut !== "parti") return "deja";
  const r = await db.clientContact.updateMany({
    where: { id: p.contactId, clientId: p.clientId, statut: "parti" },
    data: { statut: "actif", partiLe: null },
  });
  if (r.count === 0) return "deja";
  await logQualiopiActivity({
    action: "dossier_client.depart_annule",
    targetType: "ClientContact",
    targetId: p.contactId,
    changes: {
      clientId: p.clientId,
      partiLeAvant: avant.partiLe ? avant.partiLe.toISOString().slice(0, 10) : null,
    },
    session: p.acteur,
  });
  return "fait";
}
