/**
 * Chantier QNC, lot L05 — les pièces de la convocation, PRODUITES AVANT l'envoi
 * et jointes en PDF.
 *
 * La convocation actuelle n'attache rien : elle renvoie vers l'espace stagiaire.
 * La v2 joint la convocation, le programme, le règlement intérieur et le livret
 * d'accueil — produits par les MÊMES producteurs que le reste de la chaîne
 * documentaire (`production/producteurs.ts`), jamais par un second gabarit.
 *
 * Règles :
 *   - une pièce vivante (non annulée, non copie) est RÉUTILISÉE, jamais doublée ;
 *   - la convocation et le livret ont un texte v2 : une pièce v1 déjà produite
 *     n'est pas réécrite, elle est RECTIFIÉE (l'ancienne est annulée, la neuve
 *     ajoutée — rien ne se supprime) ;
 *   - une pièce sans PDF stocké n'est pas jointe : l'envoi est retenu, jamais
 *     parti sans la pièce qu'il annonce ;
 *   - `envoye_at` est posé APRÈS l'envoi accepté par la file, sur chaque pièce
 *     réellement jointe. Une pièce commune à la session (programme, règlement,
 *     livret) garde la date de son PREMIER envoi ; le journal
 *     `qualiopi.convocation.envoyee_v2` dit, destinataire par destinataire, ce
 *     qui est parti.
 *
 * ⚠️ Atteint par le WORKER : aucun import `server-only`, Next ni Server Action.
 */

import { prisma } from "@/lib/prisma";
import { documentPdfKey } from "@/lib/r2-storage";
import type {
  OptionsProduction,
  ResultatProduction,
} from "@/server/qualiopi/documents/production/producteurs";

export const TYPES_PIECES_CONVOCATION = [
  "convocation",
  "programme",
  "reglement_interieur",
  "livret_accueil",
] as const;
export type TypePieceConvocation = (typeof TYPES_PIECES_CONVOCATION)[number];

/** Les pièces dont le texte change en v2 (les deux autres sont inchangées). */
const TYPES_AVEC_TEXTE_V2: readonly TypePieceConvocation[] = ["convocation", "livret_accueil"];

/** Ce que la pièce porte pour dire qu'elle est de la v2. */
export const MARQUE_TEXTE_V2 = "convocationV2" as const;

export const MOTIF_RECTIFICATION_V2 =
  "Convocation v2 : textes mis à jour (émargement pendant chaque demi-journée, réclamations, effectif).";

const NOM_FICHIER: Record<TypePieceConvocation, string> = {
  convocation: "Convocation",
  programme: "Programme de formation",
  reglement_interieur: "Reglement interieur",
  livret_accueil: "Livret d'accueil",
};

export interface PieceAJoindre {
  readonly documentId: string;
  readonly type: TypePieceConvocation;
  readonly numero: string;
  readonly nomFichier: string;
  readonly r2Key: string;
}

export type ResultatPieces =
  | { readonly ok: true; readonly pieces: readonly PieceAJoindre[] }
  | { readonly ok: false; readonly motif: string };

/** Pure : la pièce porte-t-elle la marque du texte v2 ? */
export function estTexteV2(metadata: unknown): boolean {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>)[MARQUE_TEXTE_V2] === true
  );
}

/** Pure : le nom de fichier joint — numéro d'abord, pour se retrouver au dossier. */
export function nomFichierPiece(type: TypePieceConvocation, numero: string): string {
  return `${numero} - ${NOM_FICHIER[type]}.pdf`;
}

async function produire(
  type: TypePieceConvocation,
  enrollmentId: string,
  sessionId: string,
  opts: OptionsProduction,
): Promise<ResultatProduction> {
  // Import PARESSEUX : les producteurs tirent tout le rendu PDF. Éteint, ou pour
  // une convocation retenue, ce poids n'a pas à être chargé — et
  // `notifications-service` (atteint par le worker) reste léger à l'import.
  const {
    produireConvocation,
    produireLivretAccueil,
    produireProgramme,
    produireReglementInterieur,
  } = await import("@/server/qualiopi/documents/production/producteurs");
  switch (type) {
    case "convocation":
      return produireConvocation(enrollmentId, opts);
    case "programme":
      return produireProgramme(sessionId, opts);
    case "reglement_interieur":
      return produireReglementInterieur(sessionId, opts);
    case "livret_accueil":
      return produireLivretAccueil(sessionId, opts);
  }
}

/**
 * Les quatre pièces de CETTE inscription, produites si elles manquent. Rend
 * `ok: false` (jamais une liste partielle) dès qu'une seule ne peut pas être
 * jointe.
 */
export async function assurerPiecesConvocation(input: {
  readonly enrollmentId: string;
  readonly sessionId: string;
  readonly traineeId: string;
}): Promise<ResultatPieces> {
  const pieces: PieceAJoindre[] = [];
  for (const type of TYPES_PIECES_CONVOCATION) {
    const vivantes = await prisma.documentGenere.findMany({
      where: {
        type,
        sessionId: input.sessionId,
        annuleeAt: null,
        estCopie: false,
        // La convocation est établie PAR stagiaire ; les trois autres sont de session.
        ...(type === "convocation" ? { traineeId: input.traineeId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, numero: true, type: true, createdAt: true, pdfUrl: true, metadata: true },
    });

    const exigeV2 = TYPES_AVEC_TEXTE_V2.includes(type);
    let retenue = exigeV2 ? vivantes.find((d) => estTexteV2(d.metadata)) : vivantes[0];

    if (retenue === undefined) {
      const resultat = await produire(type, input.enrollmentId, input.sessionId, {
        ...(exigeV2
          ? {
              versionTexte: 2,
              metadata: { [MARQUE_TEXTE_V2]: true },
              // Une pièce v1 existe : on la rectifie (annulée, jamais supprimée).
              ...(vivantes.length > 0 ? { rectificationMotif: MOTIF_RECTIFICATION_V2 } : {}),
            }
          : {}),
      });
      if (!resultat.ok) {
        return { ok: false, motif: `${NOM_FICHIER[type]} non produite : ${resultat.motif}` };
      }
      const neuve = await prisma.documentGenere.findUnique({
        where: { id: resultat.documentId },
        select: {
          id: true,
          numero: true,
          type: true,
          createdAt: true,
          pdfUrl: true,
          metadata: true,
        },
      });
      if (neuve === null) {
        return { ok: false, motif: `${NOM_FICHIER[type]} produite mais introuvable au registre` };
      }
      retenue = neuve;
    }

    // Sans PDF stocké (R2 indisponible à la génération), il n'y a rien à joindre.
    if (retenue.pdfUrl === null) {
      return { ok: false, motif: `${NOM_FICHIER[type]} (${retenue.numero}) : PDF non stocké` };
    }
    pieces.push({
      documentId: retenue.id,
      type,
      numero: retenue.numero,
      nomFichier: nomFichierPiece(type, retenue.numero),
      r2Key: documentPdfKey({ type, numero: retenue.numero, createdAt: retenue.createdAt }),
    });
  }
  return { ok: true, pieces };
}

/**
 * Pose `envoye_at` sur chaque pièce jointe — la date du SERVEUR, jamais celle
 * d'un formulaire. Une pièce déjà envoyée garde sa première date.
 */
export async function marquerPiecesEnvoyees(
  documentIds: readonly string[],
  instant: Date,
): Promise<void> {
  if (documentIds.length === 0) return;
  await prisma.documentGenere.updateMany({
    where: { id: { in: [...documentIds] }, envoyeAt: null },
    data: { envoyeAt: instant },
  });
}
