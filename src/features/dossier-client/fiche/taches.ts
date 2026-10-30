/**
 * Les tâches d'une fiche client (lot B3) : première écriture dans `client_taches`.
 * Une tâche se MARQUE FAITE (on pose `faite_le`) ou se ROUVRE (on le remet à vide) : elle n'est
 * jamais supprimée. La personne et la prestation visées doivent être DE ce client, vérifié ici
 * avant d'écrire (la base le garantit aussi par une clé étrangère composée). Aucun message n'est
 * envoyé. Les jours sont ceux de Paris.
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import { MessagePourWill } from "@/features/dossier-client/message-affichable";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import type { RoleAdmin } from "@/server/auth/habilitations";

/** Refus lisible par Will (jamais une erreur technique). */
export class ErreurTache extends MessagePourWill {
  constructor(message: string) {
    super(message);
    this.name = "ErreurTache";
  }
}

type Base = Pick<PrismaClient, "clientTache" | "clientContact" | "projet">;
type Acteur = { userId: string; role: RoleAdmin };

export const INTITULE_MAX = 300;
export const RESPONSABLE_MAX = 80;
export const RESPONSABLE_PAR_DEFAUT = "Will";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** « AAAA-MM-JJ » de ce jour en heure de Paris. */
export function jourDeParis(maintenant: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(maintenant);
}

function dateValide(brut: string): boolean {
  if (!DATE.test(brut)) return false;
  const d = new Date(`${brut}T00:00:00.000Z`);
  return (
    !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === brut && brut >= "2000-01-01"
  );
}

export type EtatTache = "en_retard" | "aujourdhui" | "a_venir";

/** Une date « AAAA-MM-JJ » comparée au jour de Paris. */
export function etatDeLaTache(avantLe: string, jour: string): EtatTache {
  if (avantLe < jour) return "en_retard";
  return avantLe === jour ? "aujourdhui" : "a_venir";
}

export interface TacheDeLaFiche {
  readonly id: string;
  readonly intitule: string;
  /** « AAAA-MM-JJ » */
  readonly avantLe: string;
  readonly responsable: string;
  readonly faiteLe: Date | null;
  readonly personne: string | null;
  readonly prestation: string | null;
}

/** Les tâches ouvertes (la plus proche d'abord) puis les 3 dernières faites. Lecture seule. */
export async function lireTachesDeLaFiche(
  db: Pick<PrismaClient, "clientTache">,
  clientId: string,
): Promise<{ ouvertes: TacheDeLaFiche[]; faites: TacheDeLaFiche[] }> {
  const select = {
    id: true,
    intitule: true,
    echeanceLe: true,
    responsableLabel: true,
    faiteLe: true,
    contact: { select: { nom: true } },
    projet: { select: { numero: true, titre: true } },
  } as const;
  const [ouvertes, faites] = await Promise.all([
    db.clientTache.findMany({
      where: { clientId, faiteLe: null },
      orderBy: [{ echeanceLe: "asc" }, { createdAt: "asc" }],
      select,
    }),
    db.clientTache.findMany({
      where: { clientId, faiteLe: { not: null } },
      orderBy: { faiteLe: "desc" },
      take: 3,
      select,
    }),
  ]);
  const mettre = (t: (typeof ouvertes)[number]): TacheDeLaFiche => ({
    id: t.id,
    intitule: t.intitule,
    avantLe: t.echeanceLe.toISOString().slice(0, 10),
    responsable: t.responsableLabel,
    faiteLe: t.faiteLe,
    personne: t.contact?.nom ?? null,
    prestation: t.projet ? `${t.projet.numero} · ${t.projet.titre}` : null,
  });
  return { ouvertes: ouvertes.map(mettre), faites: faites.map(mettre) };
}

/** Les prestations d'une fiche, pour la liste du formulaire. */
export async function lirePrestationsCourtes(
  db: Pick<PrismaClient, "projet">,
  clientId: string,
): Promise<ReadonlyArray<{ id: string; libelle: string }>> {
  const l = await db.projet.findMany({
    where: { clientId },
    select: { id: true, numero: true, titre: true },
    orderBy: { createdAt: "desc" },
  });
  return l.map((p) => ({ id: p.id, libelle: `${p.numero} · ${p.titre}` }));
}

export async function creerTache(
  db: Base,
  p: {
    clientId: string;
    intitule: string;
    avantLe: string;
    responsable: string;
    contactId: string | null;
    projetId: string | null;
    acteur: Acteur;
  },
): Promise<{ id: string }> {
  const intitule = p.intitule.trim();
  if (intitule.length === 0) throw new ErreurTache("Écrivez ce qu'il y a à faire.");
  if (intitule.length > INTITULE_MAX) {
    throw new ErreurTache(`La tâche est trop longue (${INTITULE_MAX} caractères au plus).`);
  }
  if (!dateValide(p.avantLe)) throw new ErreurTache("La date n'est pas valable.");
  const responsable = p.responsable.trim() || RESPONSABLE_PAR_DEFAUT;
  if (responsable.length > RESPONSABLE_MAX) {
    throw new ErreurTache(
      `Le nom du responsable est trop long (${RESPONSABLE_MAX} caractères au plus).`,
    );
  }
  if (p.contactId !== null) {
    const c = await db.clientContact.findFirst({
      where: { id: p.contactId, clientId: p.clientId },
      select: { id: true },
    });
    if (c === null) throw new ErreurTache("Cette personne n'est pas sur cette fiche.");
  }
  if (p.projetId !== null) {
    const pr = await db.projet.findFirst({
      where: { id: p.projetId, clientId: p.clientId },
      select: { id: true },
    });
    if (pr === null) throw new ErreurTache("Cette prestation n'est pas sur cette fiche.");
  }
  const cree = await db.clientTache.create({
    data: {
      clientId: p.clientId,
      intitule,
      echeanceLe: new Date(`${p.avantLe}T00:00:00.000Z`),
      responsableLabel: responsable,
      contactId: p.contactId,
      projetId: p.projetId,
      origine: "manuelle",
    },
    select: { id: true },
  });
  await logQualiopiActivity({
    action: "dossier_client.tache_creee",
    targetType: "ClientTache",
    targetId: cree.id,
    // Ni l'intitulé (il peut citer une personne) ni de nom : la fiche, la date et les liens.
    changes: {
      clientId: p.clientId,
      avantLe: p.avantLe,
      avecPersonne: p.contactId !== null,
      avecPrestation: p.projetId !== null,
    },
    session: p.acteur,
  });
  return cree;
}

/** `fait` : l'écriture a eu lieu ; `deja` : la tâche était déjà dans cet état (rien écrit). */
export type IssueTache = "fait" | "deja";

export async function marquerFaite(
  db: Pick<PrismaClient, "clientTache">,
  p: { tacheId: string; clientId: string; maintenant: Date; acteur: Acteur },
): Promise<IssueTache> {
  const r = await db.clientTache.updateMany({
    where: { id: p.tacheId, clientId: p.clientId, faiteLe: null },
    data: { faiteLe: p.maintenant },
  });
  if (r.count === 0) return await absenteOuDeja(db, p.tacheId, p.clientId);
  await logQualiopiActivity({
    action: "dossier_client.tache_faite",
    targetType: "ClientTache",
    targetId: p.tacheId,
    changes: { clientId: p.clientId },
    session: p.acteur,
  });
  return "fait";
}

export async function rouvrir(
  db: Pick<PrismaClient, "clientTache">,
  p: { tacheId: string; clientId: string; acteur: Acteur },
): Promise<IssueTache> {
  const r = await db.clientTache.updateMany({
    where: { id: p.tacheId, clientId: p.clientId, faiteLe: { not: null } },
    data: { faiteLe: null },
  });
  if (r.count === 0) return await absenteOuDeja(db, p.tacheId, p.clientId);
  await logQualiopiActivity({
    action: "dossier_client.tache_rouverte",
    targetType: "ClientTache",
    targetId: p.tacheId,
    changes: { clientId: p.clientId },
    session: p.acteur,
  });
  return "fait";
}

async function absenteOuDeja(
  db: Pick<PrismaClient, "clientTache">,
  tacheId: string,
  clientId: string,
): Promise<IssueTache> {
  const l = await db.clientTache.findFirst({
    where: { id: tacheId, clientId },
    select: { id: true },
  });
  if (l === null) throw new ErreurTache("Cette tâche n'est pas sur cette fiche.");
  return "deja";
}
