/**
 * Pièces jointes du formulaire de contact — lecture, contrôle, stockage R2.
 *
 * Modèle repris de l'émargement Qualiopi (`qualiopi/emargement/storage.ts`) :
 * l'objet R2 est écrit D'ABORD, la ligne ENSUITE. Un objet orphelin est un
 * déchet ; une ligne sans objet serait un mensonge (« pièce jointe » affichée,
 * rien à télécharger).
 *
 * Deux temps, et l'ordre n'est pas négociable :
 *   1. `lirePiecesJointes` — AVANT d'écrire la demande : nombre, taille, total,
 *      premiers octets, macros, antivirus. Un refus revient au formulaire, qui
 *      garde la saisie : la personne retire le fichier et renvoie.
 *   2. `enregistrerPiecesJointes` — APRÈS l'écriture de la demande. 🔑 Un
 *      échec ici (R2 absent, réseau, table pas encore migrée) ne fait JAMAIS
 *      échouer la demande : le lead est en base, la personne voit « reçu » et
 *      apprend que ses fichiers, eux, ne sont pas arrivés.
 *
 * Aucun fichier n'est public : compartiment R2 privé (`R2_BUCKET_NAME`), clé
 * tirée au hasard, lecture par la seule route admin authentifiée.
 */

import { createHash, randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { deleteFromR2, isR2Configured, uploadToR2 } from "@/lib/r2-storage";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  CHAMP_PIECES_JOINTES,
  MESSAGES_PIECES_JOINTES,
  analyserOctetsPieceJointe,
  assainirNomPieceJointe,
  controlerListePiecesJointes,
  type FormatPieceJointe,
} from "@/lib/contact/pieces-jointes";
import { analyserOctets, type VerdictAntivirus } from "@/server/careers/clamav";

export interface PieceJointeLue {
  readonly nom: string;
  readonly format: FormatPieceJointe;
  readonly mime: string;
  readonly octets: Uint8Array;
  readonly sha256: string;
  readonly antivirus: "sain" | "non_verifie";
}

export type LecturePiecesJointes =
  | { readonly ok: true; readonly pieces: ReadonlyArray<PieceJointeLue> }
  | { readonly ok: false; readonly message: string };

/** Délai de l'antivirus par fichier. Au-delà, la pièce passe « non vérifiée ». */
const DELAI_ANTIVIRUS_MS = 20_000;

type Antivirus = (octets: Uint8Array, delaiMs: number) => Promise<VerdictAntivirus>;

/**
 * Les fichiers du `FormData`, contrôlés. Un champ `<input type=file>` laissé
 * vide envoie un `File` de 0 octet sans nom : il est ignoré, pas refusé.
 *
 * Antivirus : « infecté » refuse ; « muet » (clamd injoignable) laisse passer
 * en traçant `non_verifie`. C'est l'inverse du dépôt de pièces des apporteurs,
 * et c'est voulu : ici une personne inconnue nous écrit, et la doctrine du
 * formulaire est de ne jamais perdre une demande (Will, 2026-07-01). La pièce
 * n'est de toute façon servie qu'en téléchargement neutre, jamais ouverte par
 * le serveur.
 */
export async function lirePiecesJointes(
  formData: FormData,
  antivirus: Antivirus = analyserOctets,
): Promise<LecturePiecesJointes> {
  const fichiers = formData
    .getAll(CHAMP_PIECES_JOINTES)
    .filter((v): v is File => typeof v === "object" && v !== null && "arrayBuffer" in v)
    .filter((f) => !(f.size === 0 && f.name === ""));
  if (fichiers.length === 0) return { ok: true, pieces: [] };

  const refusListe = controlerListePiecesJointes(fichiers);
  if (refusListe) return { ok: false, message: refusListe };

  const lues: Array<Omit<PieceJointeLue, "antivirus">> = [];
  for (const f of fichiers) {
    const nom = assainirNomPieceJointe(f.name);
    const octets = new Uint8Array(await f.arrayBuffer());
    // La taille ANNONCÉE a été contrôlée ; on contrôle aussi la taille LUE.
    const refusTaille = controlerListePiecesJointes([{ name: nom, size: octets.byteLength }]);
    if (refusTaille) return { ok: false, message: refusTaille };
    const analyse = analyserOctetsPieceJointe(nom, octets);
    if (!analyse.ok) return { ok: false, message: analyse.message };
    lues.push({
      nom,
      format: analyse.format,
      mime: analyse.mime,
      octets,
      sha256: createHash("sha256").update(octets).digest("hex"),
    });
  }

  const verdicts = await Promise.all(
    lues.map((p) =>
      antivirus(p.octets, DELAI_ANTIVIRUS_MS).catch((): VerdictAntivirus => ({
        issue: "indisponible",
        raison: "erreur",
      })),
    ),
  );
  const pieces: PieceJointeLue[] = [];
  for (const [i, p] of lues.entries()) {
    const v = verdicts[i]!;
    if (v.issue === "infecte")
      return { ok: false, message: MESSAGES_PIECES_JOINTES.infecte(p.nom) };
    pieces.push({ ...p, antivirus: v.issue === "sain" ? "sain" : "non_verifie" });
  }
  return { ok: true, pieces };
}

/** Clé R2 : année, demande, identifiant aléatoire. Le nom fourni n'y entre pas. */
export function clePieceJointe(
  submissionId: string,
  format: FormatPieceJointe,
  date: Date,
): string {
  return `contact/pieces-jointes/${date.getUTCFullYear()}/${submissionId}/${randomUUID()}.${format}`;
}

export interface PieceEnregistree {
  readonly nom: string;
  readonly tailleOctets: number;
}

export interface BilanEnregistrement {
  readonly recues: ReadonlyArray<PieceEnregistree>;
  /** Nombre de pièces contrôlées mais NON enregistrées (stockage indisponible). */
  readonly nonEnregistrees: number;
}

/**
 * Écrit chaque pièce dans R2 puis sa ligne. Ne lève jamais : une pièce perdue
 * se compte (`nonEnregistrees`) et part à Sentry, la demande reste.
 */
export async function enregistrerPiecesJointes(
  submissionId: string,
  pieces: ReadonlyArray<PieceJointeLue>,
  maintenant: Date = new Date(),
): Promise<BilanEnregistrement> {
  if (pieces.length === 0) return { recues: [], nonEnregistrees: 0 };
  if (!isR2Configured()) {
    Sentry.captureMessage("[contact] pièces jointes reçues mais R2 non configuré", {
      level: "error",
      tags: { step: "pieces-jointes", motif: "r2_absent" },
      extra: { submissionId, nombre: pieces.length },
    });
    return { recues: [], nonEnregistrees: pieces.length };
  }

  const recues: PieceEnregistree[] = [];
  for (const p of pieces) {
    const cle = clePieceJointe(submissionId, p.format, maintenant);
    try {
      await uploadToR2(cle, p.octets, p.mime, { sha256: p.sha256, submissionId });
    } catch (err) {
      Sentry.captureException(err, { tags: { step: "pieces-jointes", motif: "upload" } });
      continue;
    }
    try {
      await prisma.submissionAttachment.create({
        data: {
          submissionId,
          nomFichier: p.nom,
          format: p.format,
          tailleOctets: p.octets.byteLength,
          cleStockage: cle,
          sha256: p.sha256,
          antivirus: p.antivirus,
        },
      });
      recues.push({ nom: p.nom, tailleOctets: p.octets.byteLength });
    } catch (err) {
      Sentry.captureException(err, { tags: { step: "pieces-jointes", motif: "ligne" } });
      // L'objet sans ligne serait introuvable : on le retire (best-effort).
      try {
        await deleteFromR2(cle);
      } catch {
        // silence volontaire : un objet orphelin est un déchet, pas une perte
      }
    }
  }
  return { recues, nonEnregistrees: pieces.length - recues.length };
}

/**
 * Les pièces d'une demande, pour la fiche admin. Rend `[]` si la table n'est
 * pas lisible (migration pas encore jouée) : la fiche s'affiche quand même.
 */
export async function listerPiecesJointes(submissionId: string): Promise<
  ReadonlyArray<{
    id: string;
    nomFichier: string;
    tailleOctets: number;
    antivirus: string;
    createdAt: Date;
  }>
> {
  try {
    return await prisma.submissionAttachment.findMany({
      where: { submissionId },
      orderBy: { createdAt: "asc" },
      select: { id: true, nomFichier: true, tailleOctets: true, antivirus: true, createdAt: true },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { step: "pieces-jointes", motif: "lecture" } });
    return [];
  }
}

/** Les clés R2 des pièces d'une demande — lues AVANT de la supprimer. */
export async function clesPiecesJointes(submissionId: string): Promise<string[]> {
  try {
    const lignes = await prisma.submissionAttachment.findMany({
      where: { submissionId },
      select: { cleStockage: true },
    });
    return lignes.map((l) => l.cleStockage);
  } catch {
    return [];
  }
}

/** Retire des objets R2 (après la suppression de leurs lignes). Best-effort. */
export async function supprimerObjetsPiecesJointes(cles: ReadonlyArray<string>): Promise<void> {
  for (const cle of cles) {
    try {
      await deleteFromR2(cle);
    } catch (err) {
      Sentry.captureException(err, { tags: { step: "pieces-jointes", motif: "suppression" } });
    }
  }
}

/**
 * Effacement art. 17 : les pièces jointes des demandes de cette adresse —
 * objets R2 ET lignes. À appeler AVANT `eraseSubmissionsForEmail`, qui remet
 * `contactEmailHash` à NULL et rendrait les demandes introuvables.
 */
export async function effacerPiecesJointesContactPour(
  email: string,
): Promise<{ readonly supprimees: number }> {
  const empreinte = hashEmailForLookup(email);
  const lignes = await prisma.submissionAttachment.findMany({
    where: {
      submission: {
        OR: [...(empreinte ? [{ contactEmailHash: empreinte }] : []), { contactEmail: email }],
      },
    },
    select: { id: true, cleStockage: true },
  });
  if (lignes.length === 0) return { supprimees: 0 };
  await prisma.submissionAttachment.deleteMany({ where: { id: { in: lignes.map((l) => l.id) } } });
  await supprimerObjetsPiecesJointes(lignes.map((l) => l.cleStockage));
  return { supprimees: lignes.length };
}
