/**
 * Qualiopi — Service central de génération des documents officiels.
 *
 * `generateDocument` : workflow complet :
 *   1. renderPdfToBuffer (React element → Buffer + hash)
 *   2. Allocation numéro séquentiel (AXI-<TYPE>-YYYY-NNN, retry P2002)
 *   3. Upload R2 + URL signée 900s (fail-soft si R2 absent)
 *   4. Création `DocumentGenere` en DB (suppressionPrevueAt = +5 ans)
 *   5. Audit logQualiopiActivity (best-effort)
 *
 * Stub-aware (build stub.invalid) : si DATABASE_URL contient "stub.invalid",
 * skip toutes les opérations DB et retourne un objet minimal.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import type { DocumentType } from "../../../../prisma/generated/client";
import { renderPdfToBuffer, storeAndSignPdf } from "@/server/qualiopi/documents/render";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import type { NumberingType } from "@/server/qualiopi/numbering/formats";
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";

/** Mappage DocumentType → NumberingType (NUMBERING_PREFIX). */
const DOC_TYPE_TO_NUMBERING: Record<DocumentType, NumberingType> = {
  convention: "formation",
  convention_tripartite: "formation",
  convocation: "session",
  emargement: "session",
  releve_connexion: "session",
  positionnement: "session",
  grille_evaluation: "session",
  satisfaction: "session",
  attestation: "attestation",
  attestation_partielle: "attestation",
  certificat_realisation: "certificat",
  facture: "facture",
  kit_opco: "formation",
  kit_cpf: "formation",
  kit_france_travail: "formation",
  lettre_mission: "formation",
  reglement_interieur: "formation",
  livret_accueil: "formation",
};

export interface GenerateDocumentInput {
  type: DocumentType;
  element: React.ReactElement;
  refs?: {
    formationId?: string;
    sessionId?: string;
    traineeId?: string;
    clientId?: string;
  };
  estCopie?: boolean;
  qrToken?: string | null;
}

export interface GenerateDocumentResult {
  id: string;
  numero: string;
  pdfUrl: string | null;
  hashSha256: string;
}

/**
 * Génère un document officiel Qualiopi (PDF + DB + R2).
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne un objet
 * minimal sans toucher la DB ni R2 (le build SSG ne doit pas muter).
 */
export async function generateDocument(
  input: GenerateDocumentInput,
): Promise<GenerateDocumentResult> {
  // Stub-aware early-exit (build GitHub Actions).
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      id: "stub-id",
      numero: "AXI-STUB-0000-000",
      pdfUrl: null,
      hashSha256: "0".repeat(64),
    };
  }

  // 1. Rendu PDF.
  const { buffer, hashSha256, sizeBytes } = await renderPdfToBuffer(input.element);

  // 2. Allocation numéro séquentiel (retry sur P2002 contrainte unique).
  const year = new Date().getFullYear();
  const numberingType = DOC_TYPE_TO_NUMBERING[input.type] ?? "formation";

  let numero = "";
  let created: { id: string; numero: string; pdfUrl: string | null; hashSha256: string } | null =
    null;
  let attempt = 0;
  const MAX_ATTEMPTS = 5;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;

    // Compte les documents existants avec le même préfixe/année pour le séq.
    const prefixPattern = `AXI-${getNumberingPrefixSegment(numberingType)}-${year}-`;
    const count = await prisma.documentGenere.count({
      where: {
        numero: { startsWith: prefixPattern },
      },
    });

    const seq = count + 1;
    numero = formatDocumentNumber(numberingType, year, seq);

    // 3. Upload R2 (fail-soft).
    const key = `documents/${year}/${input.type}/${numero}.pdf`;
    const pdfUrl = await storeAndSignPdf(buffer, key);

    // 4. Création DB.
    const now = new Date();
    const suppressionPrevueAt = new Date(now);
    suppressionPrevueAt.setFullYear(suppressionPrevueAt.getFullYear() + DOCUMENT_RETENTION_YEARS);

    try {
      const doc = await prisma.documentGenere.create({
        data: {
          type: input.type,
          numero,
          pdfUrl,
          hashSha256,
          sizeBytes,
          estCopie: input.estCopie ?? false,
          suppressionPrevueAt,
          ...(input.qrToken != null ? { qrToken: input.qrToken, qrTokenCreatedAt: now } : {}),
          ...(input.refs?.formationId != null ? { formationId: input.refs.formationId } : {}),
          ...(input.refs?.sessionId != null ? { sessionId: input.refs.sessionId } : {}),
          ...(input.refs?.traineeId != null ? { traineeId: input.refs.traineeId } : {}),
          ...(input.refs?.clientId != null ? { clientId: input.refs.clientId } : {}),
        },
        select: { id: true, numero: true, pdfUrl: true, hashSha256: true },
      });

      created = doc;
      break;
    } catch (err: unknown) {
      // P2002 = contrainte unique violée (course condition sur le numéro).
      const isPrismaUniqueError =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002";

      if (isPrismaUniqueError && attempt < MAX_ATTEMPTS) {
        // Retry avec le prochain séquence.
        continue;
      }
      throw err;
    }
  }

  if (!created) {
    throw new Error(
      `[generateDocument] Impossible d'allouer un numéro unique après ${MAX_ATTEMPTS} tentatives (type=${input.type}, year=${year})`,
    );
  }

  // 5. Audit (best-effort — logQualiopiActivity est fail-silent).
  // Note : logQualiopiActivity requiert un AdminSession. Ici on appelle
  // la version best-effort directement via prisma pour éviter la dépendance
  // sur next/headers dans ce module pur. On log via un pseudo-système.
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: `qualiopi.document.generate`,
        targetType: "DocumentGenere",
        targetId: created.id,
        changes: {
          type: input.type,
          numero: created.numero,
          hashSha256: created.hashSha256,
        } as never,
        ipAddress: null,
        userAgent: null,
      },
    });
  } catch {
    // Best-effort : un log raté n'invalide pas la génération.
  }

  return {
    id: created.id,
    numero: created.numero,
    pdfUrl: created.pdfUrl,
    hashSha256: created.hashSha256,
  };
}

/** Extrait le segment TYPE du préfixe (ex. "AXI-FORM" → "FORM"). */
function getNumberingPrefixSegment(type: NumberingType): string {
  const map: Record<NumberingType, string> = {
    formation: "FORM",
    session: "SESS",
    attestation: "ATT",
    certificat: "CERT",
    facture: "FACT",
    reclamation: "REC",
    client: "CLI",
    devis: "DEV",
    offre: "OFF",
  };
  return map[type] ?? "FORM";
}
