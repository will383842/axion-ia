/**
 * Espace ressources — documents visibles par un destinataire (2026-06-13).
 *
 * Filtrage = rôle (via visibilité) × périmètre (famille / prestation) × statut
 * publié. Inverse exact du résolveur de notifications (intervention-documents).
 */

import { prisma } from "@/lib/prisma";
import { getInterventionBySlug } from "@/content/intervention-documents-catalog";

/** Visibilités qu'un rôle a le droit de voir (inverse de `targetRoles`). */
function visibilitesForRole(role: string): string[] {
  // commercial → docs « commercial » ; formateur → « formateur » + « commercial ».
  return role === "commercial" ? ["commercial"] : ["formateur", "commercial"];
}

export interface RecipientDocument {
  documentId: string;
  versionId: string;
  interventionSlug: string;
  interventionLabel: string;
  famille: string;
  titre: string;
  version: number;
  sourceFormat: string | null;
  hasSource: boolean;
  hasPdf: boolean;
  changeNote: string | null;
  publishedAt: string | null;
}

/**
 * Documents accessibles à une personne (par e-mail) — UNION de tous ses
 * périmètres : un e-mail peut figurer dans plusieurs lignes DocumentRecipient
 * (rôles / familles / prestations différents). On voit la réunion de tout.
 */
export async function listDocumentsForRecipientEmail(email: string): Promise<RecipientDocument[]> {
  const rows = await prisma.documentRecipient.findMany({
    where: { email, actif: true },
    select: { role: true, famille: true, interventionSlug: true },
  });
  if (rows.length === 0) return [];

  // OR de critères : (visibilité du rôle) × (périmètre famille) × (périmètre slug).
  const orClauses = rows.map((r) => ({
    visibilite: { in: visibilitesForRole(r.role) as never },
    ...(r.famille ? { famille: r.famille as never } : {}),
    ...(r.interventionSlug ? { interventionSlug: r.interventionSlug } : {}),
  }));

  const docs = await prisma.interventionDocument.findMany({
    where: {
      currentVersionId: { not: null },
      OR: orClauses,
    },
    orderBy: [{ famille: "asc" }, { interventionSlug: "asc" }, { titre: "asc" }],
    select: {
      id: true,
      interventionSlug: true,
      famille: true,
      titre: true,
      currentVersion: {
        select: {
          id: true,
          version: true,
          sourceKey: true,
          sourceFormat: true,
          pdfKey: true,
          changeNote: true,
          publishedAt: true,
          statut: true,
        },
      },
    },
  });

  return docs
    .filter((d) => d.currentVersion && d.currentVersion.statut === "publie")
    .map((d) => {
      const v = d.currentVersion!;
      return {
        documentId: d.id,
        versionId: v.id,
        interventionSlug: d.interventionSlug,
        interventionLabel: getInterventionBySlug(d.interventionSlug)?.labelFr ?? d.interventionSlug,
        famille: d.famille as string,
        titre: d.titre,
        version: v.version,
        sourceFormat: v.sourceFormat,
        hasSource: !!v.sourceKey,
        hasPdf: !!v.pdfKey,
        changeNote: v.changeNote,
        publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
      };
    });
}
