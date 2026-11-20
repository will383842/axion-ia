/**
 * Stockage du scan PDF d'un devis signé à la main (lot I3, étape 1).
 *
 * Le client a signé un devis imprimé ; l'organisme en verse la copie numérisée.
 * Même doctrine que `storeSignatureImage` (emargement/storage.ts) : ce module
 * LÈVE quand le stockage échoue — une signature dont le scan n'a pas été écrit
 * est une preuve qui n'existe pas — et il n'écrase jamais un objet existant.
 *
 * ⚠️ Différence voulue avec l'image de tracé : le PDF n'est PAS ré-encodé. Les
 * octets versés sont les octets conservés, et l'empreinte porte sur eux, bruts.
 * On contrôle la FORME (`controlerPdf`), on ne parse pas le contenu.
 *
 * ⚠️ Les clés vivent sous `documents/…`, pas sous `emargement/…` : la purge RGPD
 * (`CLE_SIGNATURE_RE`) ne les reconnaît pas. Un effacement de ce scan passe par
 * `supprimerScanPapier`, qui n'accepte que la forme exacte produite ici.
 *
 * Node runtime (R2).
 */

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { deleteFromR2, existsInR2, isR2Configured, uploadToR2 } from "@/lib/r2-storage";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import { parisDateISO } from "@/server/qualiopi/presence/time";

/** Plafond d'un scan versé : 10 Mio. */
export const TAILLE_MAX_SCAN_OCTETS = 10 * 1024 * 1024;

export const MIME_SCAN_PAPIER = "application/pdf";

/** Fenêtre de recherche du marqueur de fin dans le PDF. */
const FENETRE_EOF_OCTETS = 1024;

export type ControlePdf = { ok: true } | { ok: false; message: string };

/**
 * Contrôle de forme, sans parser : non vide, ≤ 10 Mio, commence par `%PDF-`,
 * porte `%%EOF` dans ses 1 024 derniers octets. Écarte une image renommée, un
 * fichier tronqué ou vide ; ne prétend pas garantir un PDF lisible.
 */
export function controlerPdf(octets: Uint8Array): ControlePdf {
  if (octets.byteLength === 0) return { ok: false, message: "Le fichier est vide." };
  if (octets.byteLength > TAILLE_MAX_SCAN_OCTETS) {
    return { ok: false, message: "Le fichier dépasse 10 Mo." };
  }
  const tampon = Buffer.from(octets.buffer, octets.byteOffset, octets.byteLength);
  if (tampon.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { ok: false, message: "Ce fichier n'est pas un PDF." };
  }
  const fin = tampon.subarray(Math.max(0, tampon.byteLength - FENETRE_EOF_OCTETS));
  if (!fin.toString("latin1").includes("%%EOF")) {
    return { ok: false, message: "Ce PDF semble tronqué ou incomplet." };
  }
  return { ok: true };
}

/** Un identifiant de clé R2 doit être un UUID : rien d'autre ne doit composer un chemin. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Forme EXACTE d'une clé produite par `cleScanPapier` — la seule suppressible. */
const CLE_SCAN_PAPIER_RE =
  /^documents\/\d{4}\/devis-signes-papier\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

/** Clé R2 d'un scan : partitionnée par année (calendrier de PARIS, jamais UTC). */
export function cleScanPapier(annee: number, id: string): string {
  return `documents/${annee}/devis-signes-papier/${id}.pdf`;
}

/** Vrai si la clé est de la forme d'un scan papier. */
export function estCleScanPapier(key: string): boolean {
  return CLE_SCAN_PAPIER_RE.test(key);
}

export interface ScanPapierStocke {
  key: string;
  /** SHA-256 hex des octets BRUTS versés. */
  sha256: string;
  mimeType: "application/pdf";
  sizeBytes: number;
}

/**
 * Écrit le scan sur R2 et retourne son empreinte. LÈVE en cas d'échec.
 *
 * @param id  UUID de la future ligne de signature, réutilisé comme clé primaire.
 */
export async function stockerScanPapier(input: {
  octets: Buffer;
  signeAt: Date;
  id: string;
}): Promise<ScanPapierStocke> {
  const controle = controlerPdf(input.octets);
  if (!controle.ok) {
    throw new SignatureStockageError("charge_utile_invalide", controle.message);
  }
  if (!UUID_RE.test(input.id)) {
    throw new SignatureStockageError(
      "charge_utile_invalide",
      "L'identifiant d'un scan papier doit être un UUID.",
    );
  }
  if (!isR2Configured()) {
    const err = new SignatureStockageError(
      "r2_absent",
      "Stockage R2 non configuré : impossible d'enregistrer une signature sans conserver son scan.",
    );
    Sentry.captureException(err, { tags: { action: "stockerScanPapier:r2_absent" } });
    throw err;
  }

  const annee = Number(parisDateISO(input.signeAt).slice(0, 4));
  const key = cleScanPapier(annee, input.id);
  const sha256 = createHash("sha256").update(input.octets).digest("hex");

  // 🔴 `PutObject` ÉCRASE : remplacer le scan d'une signature déjà enregistrée
  // ferait mentir `signatureSha256`, scellé dans l'empreinte de la ligne.
  if (await existsInR2(key)) {
    const err = new SignatureStockageError(
      "collision_de_cle",
      "Un scan existe déjà sous cette clé : l'écraser détruirait une preuve.",
    );
    Sentry.captureException(err, {
      tags: { action: "stockerScanPapier:collision" },
      extra: { key },
    });
    throw err;
  }

  try {
    const resultat = await uploadToR2(key, input.octets, MIME_SCAN_PAPIER, {
      sha256,
      signeAt: input.signeAt.toISOString(),
    });
    // L'ETag d'un PUT simple est le MD5 hexadécimal : on ne contrôle que s'il en a la forme.
    const etag = (resultat.etag ?? "").replaceAll('"', "");
    if (/^[0-9a-f]{32}$/i.test(etag)) {
      const md5 = createHash("md5").update(input.octets).digest("hex");
      if (etag.toLowerCase() !== md5) {
        // L'objet est écrit mais ne sera jamais référencé : on le retire (best-effort).
        try {
          await supprimerScanPapier(key);
        } catch {
          // avalé : le refus ci-dessous est l'information utile.
        }
        const err = new SignatureStockageError(
          "upload_echoue",
          "L'objet écrit sur le stockage ne correspond pas à ce qui a été envoyé.",
        );
        Sentry.captureException(err, {
          tags: { action: "stockerScanPapier:etag" },
          extra: { key, etag, md5 },
        });
        throw err;
      }
    }
  } catch (err) {
    if (err instanceof SignatureStockageError) throw err;
    Sentry.captureException(err, {
      tags: { action: "stockerScanPapier:upload" },
      extra: { key, sizeBytes: input.octets.byteLength },
    });
    throw new SignatureStockageError(
      "upload_echoue",
      "Échec de l'écriture du scan sur le stockage.",
      { cause: err },
    );
  }

  return { key, sha256, mimeType: MIME_SCAN_PAPIER, sizeBytes: input.octets.byteLength };
}

/**
 * Supprime un scan. Refuse toute clé qui n'a pas la forme exacte d'un scan
 * papier : le bucket est partagé avec les factures et les signatures.
 */
export async function supprimerScanPapier(key: string): Promise<void> {
  if (!CLE_SCAN_PAPIER_RE.test(key)) {
    throw new SignatureStockageError(
      "charge_utile_invalide",
      `Refus de supprimer un objet qui n'est pas un scan papier : ${key}`,
    );
  }
  if (!isR2Configured()) {
    throw new SignatureStockageError(
      "r2_absent",
      "Stockage R2 non configuré : suppression du scan impossible.",
    );
  }
  try {
    await deleteFromR2(key);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "supprimerScanPapier" }, extra: { key } });
    throw new SignatureStockageError(
      "suppression_echouee",
      "Échec de la suppression du scan sur le stockage.",
      { cause: err },
    );
  }
}
