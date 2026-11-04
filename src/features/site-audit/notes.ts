/**
 * Notes du site d'audit enregistrées sur le serveur : un document INTERNE par
 * version (jamais d'écrasement), l'ancienne est archivée (retour arrière).
 * Module NEUTRE : reçoit son client Prisma. Aucune lecture d'octets ici.
 */
import type { VerdictAntivirus } from "@/server/careers/clamav";
import {
  ajouterFichier,
  ErreurDocument,
  MESSAGES_DOCUMENT,
} from "@/features/dossier-client/documents/ajouter";
import { archiver } from "@/features/dossier-client/documents/archiver";

export const TITRE_NOTES = "Site d'audit · notes (enregistrement automatique)";
export const TITRE_PIECE = "Site d'audit · pièce jointe";
export const MAX_NOTES_OCTETS = 2 * 1024 * 1024;

const CLE = /^audit-oury-q3-[a-z]{1,20}-[A-Za-z0-9_-]{1,60}$/;

export function validerNotes(
  brut: unknown,
): { ok: true; notes: Record<string, object> } | { ok: false } {
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) return { ok: false };
  const notes = (brut as { notes?: unknown }).notes;
  if (notes === null || typeof notes !== "object" || Array.isArray(notes)) return { ok: false };
  const cles = Object.keys(notes);
  if (cles.length < 1 || cles.length > 3000) return { ok: false };
  for (const c of cles) {
    const v = (notes as Record<string, unknown>)[c];
    if (!CLE.test(c) || v === null || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false };
    }
  }
  return { ok: true, notes: notes as Record<string, object> };
}

export function compteDepuisNom(nom: string | null | undefined): number | null {
  const m = /^site-audit-notes-(\d+)\.txt$/.exec(nom ?? "");
  return m ? Number(m[1]) : null;
}

// Client Prisma ou base en mémoire des tests : même forme que `ajouter.ts`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function derniereVersion(
  db: Db,
  p: { clientId: string; projetId: string },
): Promise<{ id: string; fichierNom: string | null } | null> {
  return db.documentProjet.findFirst({
    where: {
      clientId: p.clientId,
      projetId: p.projetId,
      titre: TITRE_NOTES,
      fichierFormat: "txt",
      archiveLe: null,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, fichierNom: true },
  });
}

export type IssueEnregistrement =
  | { issue: "ok"; version: string }
  | { issue: "conflit"; version: string | null }
  | { issue: "moins"; version: string | null }
  | { issue: "antivirus" };

export async function enregistrerNotes(
  db: Db,
  p: {
    clientId: string;
    projetId: string;
    base: string | null;
    notes: Record<string, object>;
    parAdminId: string;
    maintenant?: Date;
  },
  analyser: (octets: Uint8Array) => Promise<VerdictAntivirus>,
): Promise<IssueEnregistrement> {
  const prec = await derniereVersion(db, p);
  if ((prec?.id ?? null) !== (p.base ?? null)) {
    return { issue: "conflit", version: prec?.id ?? null };
  }
  const n = Object.keys(p.notes).length;
  const avant = compteDepuisNom(prec?.fichierNom);
  if (avant !== null && n < avant) return { issue: "moins", version: prec?.id ?? null };

  const date = (p.maintenant ?? new Date()).toISOString();
  const octets = new TextEncoder().encode(JSON.stringify({ format: 1, date, notes: p.notes }));
  if (octets.length > MAX_NOTES_OCTETS) throw new ErreurDocument("Notes trop volumineuses.");
  let cree: { id: string };
  try {
    cree = await ajouterFichier(
      db,
      {
        clientId: p.clientId,
        projetId: p.projetId,
        cote: "interne",
        nature: "note",
        titre: TITRE_NOTES,
        envoyeLe: null,
        parAdminId: p.parAdminId,
        nom: `site-audit-notes-${n}.txt`,
        octets,
      },
      analyser,
    );
  } catch (e) {
    if (e instanceof ErreurDocument && e.message === MESSAGES_DOCUMENT.antivirusIndisponible) {
      return { issue: "antivirus" };
    }
    throw e;
  }
  if (prec) {
    try {
      await archiver(db, {
        id: prec.id,
        projetId: p.projetId,
        clientId: p.clientId,
        parAdminId: p.parAdminId,
      });
    } catch (e) {
      console.error("[site-audit] archivage de la version précédente en échec :", e);
    }
  }
  return { issue: "ok", version: cree.id };
}
