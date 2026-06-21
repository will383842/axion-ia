/**
 * Qualiopi — Service central de génération des documents officiels.
 *
 * `generateDocument` : workflow complet :
 *   1. Allocation numéro séquentiel (AXI-<TYPE>-YYYY-NNN, retry P2002)
 *   2. renderPdfToBuffer — si `buildElement` fourni, le numéro alloué est
 *      injecté dans le template avant le rendu (correction bug en-tête) ;
 *      sinon `element` legacy est utilisé (backward-compat).
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
import { assertOrganismeComplet } from "@/server/qualiopi/documents/conformite";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

/** Mappage DocumentType → NumberingType (NUMBERING_PREFIX). */
const DOC_TYPE_TO_NUMBERING: Record<DocumentType, NumberingType> = {
  convention: "formation",
  convention_tripartite: "formation",
  contrat: "formation",
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
  protocole_afest: "formation",
};

export interface GenerateDocumentInput {
  type: DocumentType;
  /**
   * Élément React pré-construit (legacy — le numéro séquentiel NE sera PAS
   * injecté dans le rendu, utiliser `buildElement` pour corriger l'en-tête).
   * Obligatoire si `buildElement` est absent.
   */
  element?: React.ReactElement;
  /**
   * Factory qui reçoit le numéro séquentiel alloué juste avant le rendu.
   * Utiliser cette forme pour que l'en-tête du PDF affiche le vrai numéro.
   * Prioritaire sur `element` quand les deux sont fournis.
   */
  buildElement?: (numero: string) => React.ReactElement;
  /**
   * Identité de l'organisme. Si fournie ET que le type de document a une valeur
   * juridique/fiscale (facture, convention, tripartite, contrat), un garde-fou
   * de conformité (`assertOrganismeComplet`) refuse la génération si un champ
   * obligatoire (SIRET, NDA, adresse siège, Qualiopi) est vide — plutôt que de
   * masquer la ligne en silence. Optionnel pour rétro-compatibilité.
   */
  identite?: OrganismeIdentite;
  refs?: {
    formationId?: string;
    sessionId?: string;
    traineeId?: string;
    clientId?: string;
    /** Coaching 1-to-1 AFEST (C1) : rattache le document à son parcours. */
    coachingSessionId?: string;
  };
  estCopie?: boolean;
  qrToken?: string | null;
  /**
   * Clé R2 du fichier source original (ex. CSV relevé de connexion archivé).
   * Stockée dans `DocumentGenere.fichierOriginalPath` pour traçabilité CDC.
   * Optionnel — absent pour les documents PDF sans source d'import.
   */
  fichierOriginalPath?: string;
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
 *
 * Ordre des opérations (correction bug numéro en-tête) :
 *   1. Allocation du numéro séquentiel.
 *   2. Rendu PDF — si `buildElement` fourni, le numéro alloué est passé au
 *      template ; sinon `element` legacy est utilisé (backward-compat).
 *   3. Upload R2 + création DB.
 *   Sur collision P2002 : ré-alloue un nouveau numéro ET re-rend le PDF.
 */
export async function generateDocument(
  input: GenerateDocumentInput,
): Promise<GenerateDocumentResult> {
  // Stub-aware early-exit (build GitHub Actions) — AVANT toute validation pour
  // ne jamais casser le build SSG (le contrat stub.invalid prime).
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      id: "stub-id",
      numero: "AXI-STUB-0000-000",
      pdfUrl: null,
      hashSha256: "0".repeat(64),
    };
  }

  // Garde-fou conformité (runtime only) : refuse un document à valeur
  // juridique/fiscale si l'identité de l'OF est incomplète (SIRET/NDA/adresse/
  // Qualiopi vides) plutôt que de masquer la ligne en silence.
  if (input.identite) {
    assertOrganismeComplet(input.identite, input.type);
  }

  // 1. Allocation numéro séquentiel + rendu PDF (retry sur P2002 contrainte unique).
  const year = new Date().getFullYear();
  const numberingType = DOC_TYPE_TO_NUMBERING[input.type] ?? "formation";

  let created: { id: string; numero: string; pdfUrl: string | null; hashSha256: string } | null =
    null;
  let attempt = 0;
  const MAX_ATTEMPTS = 5;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;

    // 1a. Compte les documents existants avec le même préfixe/année pour le séq.
    const prefixPattern = `AXI-${getNumberingPrefixSegment(numberingType)}-${year}-`;
    const count = await prisma.documentGenere.count({
      where: {
        numero: { startsWith: prefixPattern },
      },
    });

    const seq = count + 1;
    const numero = formatDocumentNumber(numberingType, year, seq);

    // 1b. Rendu PDF — le numéro alloué est injecté via buildElement si fourni.
    let elementToRender: React.ReactElement;
    if (input.buildElement !== undefined) {
      elementToRender = input.buildElement(numero);
    } else if (input.element !== undefined) {
      elementToRender = input.element;
    } else {
      throw new Error(
        "[generateDocument] L'un des champs `element` ou `buildElement` est obligatoire.",
      );
    }
    const { buffer, hashSha256, sizeBytes } = await renderPdfToBuffer(elementToRender);

    // 2. Upload R2 (fail-soft).
    const key = `documents/${year}/${input.type}/${numero}.pdf`;
    const pdfUrl = await storeAndSignPdf(buffer, key);

    // 3. Création DB.
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
          ...(input.refs?.coachingSessionId != null
            ? { coachingSessionId: input.refs.coachingSessionId }
            : {}),
          ...(input.fichierOriginalPath != null
            ? { fichierOriginalPath: input.fichierOriginalPath }
            : {}),
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
        // Retry : ré-alloue un nouveau numéro + re-rend le PDF au prochain tour.
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
