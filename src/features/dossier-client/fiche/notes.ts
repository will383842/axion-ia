/**
 * Notes datées de la fiche client (lot B4) : premier écrivain de `client_notes`.
 *
 * Le texte est chiffré par `chiffrerParole` (seul module permis) AVANT d'arriver en base ; si la
 * clé manque, la fonction lève et rien n'est écrit. Le texte n'entre jamais dans la trace
 * d'audit, un message d'erreur, une URL ou le CRM. Aucune note n'est modifiée ni supprimée :
 * une correction est une nouvelle note, seul le drapeau « épinglée » change.
 */

import { chiffrerParole, dechiffrerParoleOuNull } from "@/lib/chiffrer-parole";

export const NOTE_LONGUEUR_MAX = 2000;
export const NOTES_RECENTES_AFFICHEES = 3;
export const AUTEUR_PAR_DEFAUT = "Will";

/** Erreur dont le message est écrit pour Will (jamais le texte d'une note). */
export class ErreurNoteFiche extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurNoteFiche";
  }
}

interface Transaction {
  clientNote: {
    create(args: { data: Record<string, unknown>; select: { id: true } }): Promise<{ id: string }>;
    updateMany(args: {
      where: { id: string; clientId: string };
      data: { epinglee: boolean };
    }): Promise<{ count: number }>;
  };
  activityLog: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
}

export interface BaseNotes {
  projet: {
    findUnique(args: {
      where: { id: string };
      select: { clientId: true; fusionneDansId: true };
    }): Promise<{ clientId: string; fusionneDansId: string | null } | null>;
  };
  clientNote: {
    findFirst(args: {
      where: { id: string; clientId: string };
      select: { epinglee: true };
    }): Promise<{ epinglee: boolean } | null>;
    findMany(args: {
      where: { clientId: string };
      orderBy: { createdAt: "desc" };
      select: {
        id: true;
        auteurLabel: true;
        contenuChiffre: true;
        epinglee: true;
        createdAt: true;
        projetId: true;
      };
    }): Promise<
      Array<{
        id: string;
        auteurLabel: string;
        contenuChiffre: string;
        epinglee: boolean;
        createdAt: Date;
        projetId: string | null;
      }>
    >;
  };
  $transaction<T>(travail: (tx: Transaction) => Promise<T>): Promise<T>;
}

export interface ActeurNote {
  readonly userId: string;
  readonly auteurLabel: string;
}

export async function ajouterNote(
  db: BaseNotes,
  args: {
    clientId: string;
    texte: string;
    projetId: string | null;
    acteur: ActeurNote;
  },
): Promise<{ id: string }> {
  // Le navigateur envoie les sauts de ligne en \r\n (2 caractères) : on compte comme `maxLength`.
  const texte = args.texte.replace(/\r\n?/g, "\n").trim();
  if (texte === "") throw new ErreurNoteFiche("Écrivez le texte de la note.");
  if (texte.length > NOTE_LONGUEUR_MAX) {
    throw new ErreurNoteFiche(`La note est trop longue (${NOTE_LONGUEUR_MAX} caractères au plus).`);
  }
  if (texte.startsWith("enc:v1:")) {
    throw new ErreurNoteFiche('Ce texte ne peut pas commencer par "enc:v1:".');
  }
  if (args.projetId !== null) {
    const projet = await db.projet.findUnique({
      where: { id: args.projetId },
      select: { clientId: true, fusionneDansId: true },
    });
    if (projet === null || projet.clientId !== args.clientId || projet.fusionneDansId !== null) {
      throw new ErreurNoteFiche("Cette prestation n'appartient pas à cette fiche.");
    }
  }
  let contenuChiffre: string;
  try {
    contenuChiffre = chiffrerParole(texte);
  } catch {
    throw new ErreurNoteFiche(
      "Le chiffrement n'est pas disponible : la note n'a pas été enregistrée. Prévenez l'équipe technique.",
    );
  }
  return db.$transaction(async (tx) => {
    const note = await tx.clientNote.create({
      data: {
        clientId: args.clientId,
        projetId: args.projetId,
        contenuChiffre,
        auteurLabel: args.acteur.auteurLabel,
      },
      select: { id: true },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: args.acteur.userId,
        action: "client.note_ajoutee",
        targetType: "client_note",
        targetId: note.id,
        // Jamais le texte : seulement des faits sans donnée personnelle.
        changes: { clientId: args.clientId, projetId: args.projetId, longueur: texte.length },
      },
    });
    return note;
  });
}

export async function basculerEpingle(
  db: BaseNotes,
  args: { clientId: string; noteId: string; acteur: ActeurNote },
): Promise<{ epinglee: boolean }> {
  const note = await db.clientNote.findFirst({
    where: { id: args.noteId, clientId: args.clientId },
    select: { epinglee: true },
  });
  if (note === null) throw new ErreurNoteFiche("Note introuvable sur cette fiche.");
  const epinglee = !note.epinglee;
  await db.$transaction(async (tx) => {
    const { count } = await tx.clientNote.updateMany({
      where: { id: args.noteId, clientId: args.clientId },
      data: { epinglee },
    });
    if (count === 0) throw new ErreurNoteFiche("Note introuvable sur cette fiche.");
    await tx.activityLog.create({
      data: {
        adminUserId: args.acteur.userId,
        action: epinglee ? "client.note_epinglee" : "client.note_detachee",
        targetType: "client_note",
        targetId: args.noteId,
        changes: { clientId: args.clientId },
      },
    });
  });
  return { epinglee };
}

export interface NoteAffichee {
  readonly id: string;
  readonly auteurLabel: string;
  /** `null` : texte illisible (clé absente ou valeur altérée), jamais un faux texte. */
  readonly texte: string | null;
  readonly epinglee: boolean;
  readonly createdAt: Date;
  readonly projetId: string | null;
}

export type LectureNotes =
  | { readonly ok: true; readonly notes: readonly NoteAffichee[]; readonly total: number }
  | { readonly ok: false };

/** Épinglées d'abord (récentes en tête), puis les 3 plus récentes non épinglées. */
export function choisirNotes<T extends { epinglee: boolean; createdAt: Date }>(
  notes: readonly T[],
): T[] {
  const parRecence = [...notes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return [
    ...parRecence.filter((n) => n.epinglee),
    ...parRecence.filter((n) => !n.epinglee).slice(0, NOTES_RECENTES_AFFICHEES),
  ];
}

export async function lireNotes(db: BaseNotes, clientId: string): Promise<LectureNotes> {
  try {
    const lignes = await db.clientNote.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        auteurLabel: true,
        contenuChiffre: true,
        epinglee: true,
        createdAt: true,
        projetId: true,
      },
    });
    const notes = choisirNotes(lignes).map((n): NoteAffichee => {
      let texte: string | null;
      try {
        texte = dechiffrerParoleOuNull(n.contenuChiffre);
      } catch {
        texte = null;
      }
      return {
        id: n.id,
        auteurLabel: n.auteurLabel,
        texte,
        epinglee: n.epinglee,
        createdAt: n.createdAt,
        projetId: n.projetId,
      };
    });
    return { ok: true, notes, total: lignes.length };
  } catch (e) {
    console.error("[notes] lecture en échec", (e as Error)?.name);
    return { ok: false };
  }
}
