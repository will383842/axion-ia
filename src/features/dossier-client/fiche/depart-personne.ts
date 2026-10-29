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

/** Les dates de départ des personnes d'une fiche (lecture seule). */
export async function lireDatesDeDepart(
  db: Base,
  clientId: string,
): Promise<ReadonlyMap<string, Date>> {
  const lignes = await db.clientContact.findMany({
    where: { clientId, statut: "parti" },
    select: { id: true, partiLe: true },
  });
  const m = new Map<string, Date>();
  for (const l of lignes) if (l.partiLe) m.set(l.id, l.partiLe);
  return m;
}

/** Pose `statut = parti` et `parti_le`. La personne doit être DE ce client. */
export async function noterDepart(
  db: Base,
  p: { contactId: string; clientId: string; partiLe: string; maintenant: Date; acteur: Acteur },
): Promise<void> {
  if (!dateDeDepartValide(p.partiLe, p.maintenant)) {
    throw new ErreurDepart("La date de départ n'est pas valable (elle ne peut pas être à venir).");
  }
  const r = await db.clientContact.updateMany({
    where: { id: p.contactId, clientId: p.clientId },
    data: { statut: "parti", partiLe: new Date(`${p.partiLe}T00:00:00.000Z`) },
  });
  if (r.count === 0) throw new ErreurDepart("Cette personne n'est pas sur cette fiche.");
  await logQualiopiActivity({
    action: "dossier_client.depart_note",
    targetType: "ClientContact",
    targetId: p.contactId,
    session: p.acteur,
  });
}

/** Remet la personne « actif » et efface la seule date de départ (rien d'autre n'est touché). */
export async function annulerDepart(
  db: Base,
  p: { contactId: string; clientId: string; acteur: Acteur },
): Promise<void> {
  const r = await db.clientContact.updateMany({
    where: { id: p.contactId, clientId: p.clientId },
    data: { statut: "actif", partiLe: null },
  });
  if (r.count === 0) throw new ErreurDepart("Cette personne n'est pas sur cette fiche.");
  await logQualiopiActivity({
    action: "dossier_client.depart_annule",
    targetType: "ClientContact",
    targetId: p.contactId,
    session: p.acteur,
  });
}
