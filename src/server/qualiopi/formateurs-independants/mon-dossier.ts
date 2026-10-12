/**
 * Formateurs indépendants — « MON DOSSIER » dans l'espace formateur (lot E, M13 ;
 * plan 08 §12.4, écrans F-13/F-14).
 *
 * Le formateur indépendant, connecté à son espace, voit l'état de ses pièces suivies
 * (attestation URSSAF, assurance RC pro, CV) et dépose celle qui est à renouveler.
 *
 * 🔑 Rien n'est recréé :
 *  - l'état d'une pièce vient de `pieces-a-renouveler.ts` (lot L13) ;
 *  - le dépôt est `deposerPieceFormateur` (lot L5b) : contrôle commun, antivirus,
 *    chiffrement au repos, pièce EN ATTENTE, trace « dépôt du formateur » (quatre yeux) ;
 *  - F42 est l'alerte interne minimisée, sur le modèle de F11 (identifiant court, type,
 *    lien console) : ni nom, ni adresse, ni fichier.
 *
 * 🔴 ÉTEINT : tant que `formateurs.dossier_en_ligne` est coupé, rien n'est lu ni écrit.
 * Un salarié ou un dirigeant n'a pas de « Mon dossier » : rien ne change pour eux.
 *
 * Sans `server-only` : aucun import Next.
 */

import { prisma } from "@/lib/prisma";

import { deposerPieceFormateur, type ResultatDepot } from "./depot";
import { envoiAllume } from "./interrupteurs-envoi";
import {
  PIECES_SUIVIES,
  demandeUnGeste,
  dossierBloque,
  etatPiece,
  libelleEtatPiece,
  type PieceLue,
} from "./pieces-a-renouveler";

/** Les pièces que « Mon dossier » montre et reçoit : celles qu'on relance. */
export const TYPES_MON_DOSSIER = PIECES_SUIVIES.map((p) => p.type);

export const LIBELLES_PIECE_MON_DOSSIER: Readonly<Record<string, string>> = {
  attestation_vigilance_urssaf: "Attestation de vigilance URSSAF",
  assurance_rc_pro: "Attestation d'assurance RC pro",
  cv: "CV",
};

export const MESSAGES_MON_DOSSIER = {
  indisponible: "Le dépôt de pièces n'est pas ouvert pour le moment.",
  type: "Cette pièce ne se dépose pas ici.",
} as const;

export interface PieceMonDossier {
  readonly type: string;
  readonly libelleType: string;
  readonly libelle: string;
  /** Un geste est attendu du formateur (à renouveler, échue, à renvoyer, à fournir). */
  readonly geste: boolean;
  readonly bloquante: boolean;
}

export interface VueMonDossier {
  /** Plus aucune mission ne peut être proposée tant qu'une pièce bloquante manque. */
  readonly bloque: boolean;
  readonly pieces: ReadonlyArray<PieceMonDossier>;
}

const SELECT_PIECE = {
  id: true,
  type: true,
  statutValidation: true,
  fichierUrl: true,
  dateEmission: true,
  dateExpiration: true,
  createdAt: true,
  archiveAt: true,
  rejetMotif: true,
  valideAt: true,
} as const;

/** Les pièces suivies d'une fiche, telles que les règles L13 les lisent. */
export async function lirePiecesSuivies(trainerId: string): Promise<PieceLue[]> {
  const docs = await prisma.trainerDocument.findMany({
    where: { trainerId, type: { in: [...TYPES_MON_DOSSIER] }, archiveAt: null },
    select: SELECT_PIECE,
    take: 500,
  });
  return docs as PieceLue[];
}

async function estIndependant(trainerId: string): Promise<boolean> {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { statut: true },
  });
  return t?.statut === "sous_traitant";
}

/** La vue de « Mon dossier », ou `null` (coupé, pas un indépendant, base injoignable). */
export async function lireMonDossier(
  trainerId: string,
  maintenant: Date,
): Promise<VueMonDossier | null> {
  if (!(await envoiAllume("dossier_en_ligne"))) return null;
  try {
    if (!(await estIndependant(trainerId))) return null;
    const docs = await lirePiecesSuivies(trainerId);
    return {
      bloque: dossierBloque(docs, maintenant),
      pieces: PIECES_SUIVIES.map((p) => {
        const e = etatPiece(docs, p.type, maintenant);
        return {
          type: p.type,
          libelleType: LIBELLES_PIECE_MON_DOSSIER[p.type] ?? p.type,
          libelle: libelleEtatPiece(e),
          geste: demandeUnGeste(e),
          bloquante: p.bloquante,
        };
      }),
    };
  } catch {
    return null;
  }
}

export interface EntreeMonDossier {
  readonly type: string;
  readonly nomFichier: string;
  readonly octets: Uint8Array;
  readonly dateEmission: Date | null;
}

/**
 * Dépôt depuis l'espace. L'appelant a vérifié la SESSION de l'espace : ce module ne
 * reçoit que l'identifiant de la fiche connectée, jamais un identifiant du navigateur.
 */
export async function deposerDepuisMonDossier(
  trainerId: string,
  entree: EntreeMonDossier,
): Promise<ResultatDepot> {
  if (!(await envoiAllume("dossier_en_ligne"))) {
    return { ok: false, message: MESSAGES_MON_DOSSIER.indisponible };
  }
  if (!(TYPES_MON_DOSSIER as readonly string[]).includes(entree.type)) {
    return { ok: false, message: MESSAGES_MON_DOSSIER.type };
  }
  try {
    if (!(await estIndependant(trainerId))) {
      return { ok: false, message: MESSAGES_MON_DOSSIER.indisponible };
    }
  } catch {
    return { ok: false, message: MESSAGES_MON_DOSSIER.indisponible };
  }
  const r = await deposerPieceFormateur({
    trainerId,
    type: entree.type,
    nomFichier: entree.nomFichier,
    octets: entree.octets,
    dateEmission: entree.dateEmission,
  });
  if (r.ok) {
    // F42 — alerte interne minimisée. Une panne ne défait pas le dépôt.
    try {
      const { notify } = await import("@/server/notifications");
      await notify({
        category: "TRAINER_PIECE_DEPOSEE",
        payload: { trainerId, type: entree.type },
      });
    } catch {
      // Observabilité : jamais bloquante.
    }
  }
  return r;
}
