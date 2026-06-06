/**
 * Qualiopi — Rendu PDF + archivage R2.
 *
 * `renderPdfToBuffer`  : React element → Buffer + hash SHA-256 + sizeBytes.
 * `storeAndSignPdf`    : Buffer → upload R2 + URL signée 900s (fail-soft si R2 absent).
 *
 * Pattern identique à `src/lib/invoice-pdf.tsx`.
 * Utilise les signatures EXACTES de `src/lib/r2-storage.ts`.
 */

import { createHash } from "node:crypto";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { isR2Configured, uploadToR2, getSignedUrlR2 } from "@/lib/r2-storage";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";

/** Résultat brut du rendu PDF. */
export interface PdfRenderResult {
  buffer: Buffer;
  hashSha256: string;
  sizeBytes: number;
}

/**
 * Rend un React element @react-pdf/renderer en Buffer binaire.
 * Enregistre les polices avant le rendu (idempotent).
 *
 * Utilise `pdf().toBuffer()` (stream Node.js) pour éviter la dépendance
 * sur `Blob.arrayBuffer()` absente dans jsdom (environnement Vitest).
 *
 * @returns buffer, hash SHA-256 (hex 64 chars), sizeBytes.
 */
export async function renderPdfToBuffer(element: React.ReactElement): Promise<PdfRenderResult> {
  // S'assurer que les polices sont enregistrées (idempotent).
  registerQualiopiPdfFonts();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await pdf(element as React.ReactElement<any>).toBuffer();

  // Collecte les chunks du stream Node.js readable → Buffer.
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | Uint8Array) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

  const hashSha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    buffer,
    hashSha256,
    sizeBytes: buffer.byteLength,
  };
}

/**
 * Upload le buffer dans R2 sous la clé donnée, puis retourne une URL signée
 * valide 900 secondes. Fail-soft : si R2 n'est pas configuré, retourne `null`
 * (le service appelant peut continuer sans URL — le PDF est toujours en DB).
 *
 * Utilise les signatures exactes de `src/lib/r2-storage.ts` :
 *   - `isR2Configured(): boolean`
 *   - `uploadToR2(key, buffer, contentType?, metadata?): Promise<UploadResult>`
 *   - `getSignedUrlR2(key, expiresInSeconds?): Promise<string>`
 */
export async function storeAndSignPdf(buffer: Buffer, key: string): Promise<string | null> {
  if (!isR2Configured()) {
    return null;
  }
  await uploadToR2(key, buffer, "application/pdf");
  const signedUrl = await getSignedUrlR2(key, 900);
  return signedUrl;
}
