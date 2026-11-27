/**
 * Réseau d'apporteurs — les ANNEXES JOINTES SONT VERSIONNÉES (point 11, #2464 PR C).
 *
 * Avant : la fiche, le livret et le guide vivaient à UNE clé fixe ; déposer un nouveau fichier remplaçait l'ancien,
 * et rien ne prouvait quelle version un apporteur avait reçue. Maintenant chaque fichier est déposé UNE fois à une
 * clé dérivée de son empreinte (`documents-apporteurs/<document>/<sha256>.pdf`), jamais réécrite, et chaque envoi
 * note ce qui a été remis (`apporteur_documents_remis`, ajout seul).
 *
 * 🔑 Fenêtre app/worker : l'ancienne clé fixe continue d'être écrite à chaque dépôt (voir `deposerVersionAnnexe`),
 * et tout lecteur tolère la table absente ou vide en retombant sur elle.
 *
 * ⚠️ Aucun `server-only` : le script de dépôt (tsx, hors Next) et le passage quotidien importent ce module.
 * ⚠️ Journaux sans donnée personnelle : identifiants de document et empreintes seulement.
 */

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { enteteObjetR2, uploadToR2 } from "@/lib/r2-storage";

import { signalerErreurReseau } from "./signaler";

/**
 * Même valeur que `PREFIXE_DOCUMENTS_APPORTEURS` (documents-prives.ts), redéclarée ici : `documents-prives` importe
 * ce module, un import dans l'autre sens ferait un cycle. Verrouillé par `annexes-versionnees.spec.ts`.
 */
const PREFIXE_DOCUMENTS_APPORTEURS = "documents-apporteurs/";

export type ContexteRemise = "contrat_signe" | "renvoi_contrat" | "lien_dossier";

/** Forme d'une clé versionnée : `documents-apporteurs/<document>/<sha256>.pdf`. */
const MOTIF_CLE_VERSIONNEE = new RegExp(
  `^${PREFIXE_DOCUMENTS_APPORTEURS.replace("/", "\\/")}([a-z-]+)\\/([0-9a-f]{64})\\.pdf$`,
);

/** La clé IMMUABLE d'une version : dérivée de l'empreinte, jamais d'une date ni d'un nom libre. */
export function cleVersionnee(documentId: string, sha256: string): string {
  return `${PREFIXE_DOCUMENTS_APPORTEURS}${documentId}/${sha256}.pdf`;
}

/** Document et empreinte portés par une clé versionnée, ou `null` (ancienne clé fixe, contrat…). */
export function lireCleVersionnee(cle: string): { documentId: string; sha256: string } | null {
  const m = MOTIF_CLE_VERSIONNEE.exec(cle);
  return m ? { documentId: m[1] as string, sha256: m[2] as string } : null;
}

const tableAbsente = (err: unknown): boolean =>
  !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";

/**
 * La plus récente des versions non retirées d'un document, ou `null` (aucune version, table absente, base en
 * panne) : l'appelant retombe alors sur la clé fixe. Ne lève jamais : un e-mail ne dépend pas de ce registre.
 */
export async function versionCourante(
  documentId: string,
): Promise<{ cleR2: string; sha256: string } | null> {
  try {
    const v = await prisma.documentAnnexeVersion.findFirst({
      where: { documentId, retireeAt: null },
      orderBy: { deposeAt: "desc" },
      select: { cleR2: true, sha256: true },
    });
    return v ? { cleR2: v.cleR2, sha256: v.sha256 } : null;
  } catch {
    // Repli SILENCIEUX sur la clé fixe (table absente, base en panne) : un e-mail ne dépend pas de ce registre,
    // et une alerte par e-mail finirait en boucle.
    return null;
  }
}

/**
 * Note ce qui vient d'être REMIS : une ligne par annexe RÉELLEMENT jointe (pièce à clé versionnée), avec son
 * empreinte. À appeler seulement quand l'e-mail est en file. `skipDuplicates` : un double clic ou un rejeu du même
 * job n'écrit rien de plus. Une pièce à l'ancienne clé fixe n'a pas d'empreinte connue : rien à tracer. Table
 * absente : silence. Ne lève jamais.
 */
export async function noterDocumentsRemis<P extends { r2Key: string }>(
  apporteurId: string,
  pieces: readonly P[],
  contexte: ContexteRemise,
  emailJobId: string,
): Promise<void> {
  const data = pieces.flatMap((p) => {
    const v = lireCleVersionnee(p.r2Key);
    return v
      ? [
          {
            apporteurId,
            documentId: v.documentId,
            versionSha256: v.sha256,
            cleR2: p.r2Key,
            contexte,
            emailJobId,
          },
        ]
      : [];
  });
  if (data.length === 0) return;
  try {
    await prisma.apporteurDocumentRemis.createMany({ data, skipDuplicates: true });
  } catch (err) {
    if (!tableAbsente(err)) signalerErreurReseau("annexes versionnées : trace de la remise", err);
  }
}

export interface ResultatDepot {
  sha256: string;
  cleR2: string;
  taille: number;
  /** La version existait déjà : rien n'a été écrit. */
  dejaDeposee: boolean;
}

/**
 * Dépose une version d'un document annexe (utilisé par `scripts/apporteurs/deposer-document-joint.ts`).
 *  1. calcule le SHA-256 ; la clé est dérivée de lui ;
 *  2. version déjà connue : rien à faire (jamais un second dépôt) ;
 *  3. `HEAD` avant de déposer : un objet déjà là n'est pas redéposé ;
 *  4. insère la version, puis écrit AUSSI l'ancienne clé fixe.
 *
 * ⚠️ À retirer après une version : l'écriture de l'ancienne clé fixe (`doc.cleR2`) ne sert qu'à la fenêtre
 * app/worker, tant qu'un lecteur plus ancien lit encore cette clé.
 */
export async function deposerVersionAnnexe(
  doc: { id: string; cleR2: string },
  pdf: Buffer,
  options: { deposePar: string | null },
): Promise<ResultatDepot> {
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("Ce fichier n'est pas un PDF (il ne commence pas par « %PDF- ») : refusé.");
  }
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const cleR2 = cleVersionnee(doc.id, sha256);
  const taille = pdf.byteLength;

  const connue = await prisma.documentAnnexeVersion.findUnique({
    where: { documentId_sha256: { documentId: doc.id, sha256 } },
    select: { retireeAt: true },
  });
  if (connue) {
    if (connue.retireeAt) {
      throw new Error(
        "Cette version a été retirée : elle ne peut pas être redéposée telle quelle.",
      );
    }
    return { sha256, cleR2, taille, dejaDeposee: true };
  }

  if (!(await enteteObjetR2(cleR2))) {
    await uploadToR2(cleR2, pdf, "application/pdf", { sha256 });
    const relu = await enteteObjetR2(cleR2);
    if (!relu || relu.taille !== taille) {
      throw new Error("Dépôt non confirmé : l'objet relu n'a pas la taille attendue.");
    }
  }
  await prisma.documentAnnexeVersion.upsert({
    where: { documentId_sha256: { documentId: doc.id, sha256 } },
    create: { documentId: doc.id, sha256, cleR2, taille, deposePar: options.deposePar },
    update: {},
  });
  // À retirer après une version (fenêtre app/worker) : l'ancienne clé fixe reste écrite.
  await uploadToR2(doc.cleR2, pdf, "application/pdf", { sha256 });
  return { sha256, cleR2, taille, dejaDeposee: false };
}
