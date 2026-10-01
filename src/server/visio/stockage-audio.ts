/**
 * Où va le son : R2, préfixe PRIVÉ `visio-audio/` (ADR 0054). La clé est
 * CALCULÉE PAR LE SERVEUR, jamais fournie par l'extension ; le son est chiffré
 * avant d'arriver ici (`morceaux.ts`).
 *
 * Interface injectable : les tests passent un stockage en mémoire et vérifient
 * ce qui l'atteint réellement.
 */

import {
  deleteFromR2,
  existsInR2,
  getObjectBufferR2,
  isR2Configured,
  uploadToR2,
} from "@/lib/r2-storage";
import type { PrismaClient } from "../../../prisma/generated/client";

export const PREFIXE_AUDIO = "visio-audio/";

/**
 * LE port du son (un seul) : l'enregistreur y DÉPOSE (PR 5), le circuit y LIT
 * et y PURGE (PR 6). Chaque accès exige le préfixe `visio-audio/` : aucune
 * purge du circuit ne peut supprimer une clé hors du dépôt audio.
 */
export interface StockageAudio {
  readonly disponible: () => boolean;
  readonly deposer: (cle: string, octets: Buffer) => Promise<void>;
  readonly supprimer: (cle: string) => Promise<void>;
  /** Octets (chiffrés) d'un objet ; `null` = PANNE, jamais un fichier vide. */
  readonly lire: (cle: string) => Promise<Buffer | null>;
  readonly existe: (cle: string) => Promise<boolean>;
}

/** Ce que le circuit du compte rendu utilise du port (lecture, purge, preuve). */
export type LectureAudio = Pick<StockageAudio, "lire" | "supprimer" | "existe">;

/**
 * V2, N5 et N3 — supprime de R2 le son d'UNE tranche (hors accord), vérifie
 * qu'il n'existe plus, puis date sa suppression. Rend faux si un objet
 * résiste : la purge de l'enregistrement (validation, 30 jours) le reprendra.
 * Seule implémentation : l'étape `transcrire` et la fin tardive l'appellent.
 */
export async function purgerSonDUneTranche(
  db: Pick<PrismaClient, "enregistrementMorceau" | "enregistrementTranche">,
  stockage: Pick<StockageAudio, "supprimer" | "existe">,
  trancheId: string,
): Promise<boolean> {
  const morceaux = await db.enregistrementMorceau.findMany({
    where: { trancheId },
    select: { cleR2: true },
  });
  try {
    for (const m of morceaux) await stockage.supprimer(m.cleR2);
    for (const m of morceaux) if (await stockage.existe(m.cleR2)) return false;
  } catch (err) {
    console.error("[visio] son d'une tranche hors accord non supprimé :", err);
    return false;
  }
  await db.enregistrementTranche.update({
    where: { id: trancheId },
    data: { audioSupprimeLe: new Date(), tailleOctets: 0 },
  });
  return true;
}

function exigerPrefixe(cle: string): void {
  if (!cle.startsWith(PREFIXE_AUDIO)) throw new Error("stockage audio : préfixe inattendu.");
}

/** `visio-audio/<enregistrementId>/<piste>/<tranche 4 chiffres>/<seq 5 chiffres>.bin` */
export function cleR2Morceau(
  enregistrementId: string,
  piste: "client" | "axion",
  tranche: number,
  seq: number,
): string {
  if (!/^[0-9a-f-]{36}$/.test(enregistrementId)) {
    throw new Error("cleR2Morceau : identifiant d'enregistrement invalide.");
  }
  if (!Number.isInteger(tranche) || tranche < 0 || tranche > 9999) {
    throw new Error("cleR2Morceau : numéro de tranche hors bornes.");
  }
  if (!Number.isInteger(seq) || seq < 0 || seq > 99_999) {
    throw new Error("cleR2Morceau : numéro de morceau hors bornes.");
  }
  return `${PREFIXE_AUDIO}${enregistrementId}/${piste}/${String(tranche).padStart(4, "0")}/${String(seq).padStart(5, "0")}.bin`;
}

/** Le stockage réel : R2 existant (`R2_BUCKET_NAME`). */
export const stockageR2: StockageAudio = {
  disponible: () => isR2Configured(),
  deposer: async (cle, octets) => {
    exigerPrefixe(cle);
    await uploadToR2(cle, octets, "application/octet-stream");
  },
  supprimer: async (cle) => {
    exigerPrefixe(cle);
    await deleteFromR2(cle);
  },
  lire: async (cle) => {
    exigerPrefixe(cle);
    return getObjectBufferR2(cle);
  },
  existe: async (cle) => {
    exigerPrefixe(cle);
    return existsInR2(cle);
  },
};
