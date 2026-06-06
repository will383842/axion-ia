/**
 * Qualiopi — Rendu + stockage d'un support de formation pédagogique (T13).
 *
 * `renderSupportToStored` : rend le SupportPdf en buffer via renderPdfToBuffer,
 * stocke dans R2 sous `supports/{year}/{type}/{hash}.pdf` via storeAndSignPdf,
 * retourne pdfKey, pdfUrl (null si R2 absent), hashSha256, sizeBytes.
 *
 * Fail-soft R2 : si R2 n'est pas configuré, pdfKey et pdfUrl sont null.
 * Stub-aware : storeAndSignPdf est déjà fail-soft (check isR2Configured).
 *
 * NE PAS "use client" — rendu serveur exclusif.
 */

import React from "react";
import { renderPdfToBuffer, storeAndSignPdf } from "@/server/qualiopi/documents/render";
import { SupportPdf } from "./templates/support-pdf";
import type { SupportRenderInput } from "./types";

// ============================================================
// Types
// ============================================================

export interface SupportStoreResult {
  /** Clé R2 du PDF stocké, null si R2 non configuré. */
  pdfKey: string | null;
  /** URL signée (900 s) du PDF, null si R2 non configuré. */
  pdfUrl: string | null;
  /** Hash SHA-256 du buffer PDF (hex 64 chars). */
  hashSha256: string;
  /** Taille du buffer en octets. */
  sizeBytes: number;
}

// ============================================================
// Rendu + stockage
// ============================================================

/**
 * Rend un support de formation en PDF et le stocke dans R2 (fail-soft).
 *
 * Clé R2 : `supports/{année}/{type}/{hashSha256}.pdf`
 *
 * @param input - Type, titre, contenu, version et identité organisme.
 * @returns Clé R2, URL signée (ou null), hash et taille.
 */
export async function renderSupportToStored(
  input: SupportRenderInput,
): Promise<SupportStoreResult> {
  // 1. Construire l'élément React
  const element = React.createElement(SupportPdf, {
    data: {
      type: input.type,
      titre: input.titre,
      contenu: input.contenu,
      version: input.version,
    },
    identite: input.identite,
  });

  // 2. Rendre en buffer
  const { buffer, hashSha256, sizeBytes } = await renderPdfToBuffer(element);

  // 3. Construire la clé R2
  const year = new Date().getFullYear();
  const r2Key = `supports/${year}/${input.type}/${hashSha256}.pdf`;

  // 4. Stocker dans R2 (fail-soft si R2 absent)
  const pdfUrl = await storeAndSignPdf(buffer, r2Key);

  return {
    pdfKey: pdfUrl !== null ? r2Key : null,
    pdfUrl,
    hashSha256,
    sizeBytes,
  };
}
