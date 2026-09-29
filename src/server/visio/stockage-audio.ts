/**
 * Où va le son : R2, préfixe PRIVÉ `visio-audio/` (ADR 0054). La clé est
 * CALCULÉE PAR LE SERVEUR, jamais fournie par l'extension ; le son est chiffré
 * avant d'arriver ici (`morceaux.ts`).
 *
 * Interface injectable : les tests passent un stockage en mémoire et vérifient
 * ce qui l'atteint réellement.
 */

import { deleteFromR2, isR2Configured, uploadToR2 } from "@/lib/r2-storage";

export const PREFIXE_AUDIO = "visio-audio/";

export interface StockageAudio {
  readonly disponible: () => boolean;
  readonly deposer: (cle: string, octets: Buffer) => Promise<void>;
  readonly supprimer: (cle: string) => Promise<void>;
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
    if (!cle.startsWith(PREFIXE_AUDIO)) throw new Error("stockage audio : préfixe inattendu.");
    await uploadToR2(cle, octets, "application/octet-stream");
  },
  supprimer: async (cle) => {
    if (!cle.startsWith(PREFIXE_AUDIO)) throw new Error("stockage audio : préfixe inattendu.");
    await deleteFromR2(cle);
  },
};
