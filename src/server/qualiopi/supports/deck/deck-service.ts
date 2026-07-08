/**
 * Qualiopi — Supports : SERVICE du diaporama de projection (PDF 16:9 + PPTX).
 *
 * `genererDeck(formationId)` :
 *  1. lit la Formation (contenu détaillé + fil rouge/livrables) ;
 *  2. construit le modèle de slides (2026 best practices) ;
 *  3. rend le PDF 16:9 (toujours) + le PPTX éditable (si pptxgenjs dispo) ;
 *  4. stocke les deux sur R2 (fail-soft) ;
 *  5. upsert un SupportFormation type `slides_formateur` version incrémentée,
 *     avec metadata pointant vers les deux fichiers.
 *
 * Stub-aware. Exige un `contenuDetaille` (sinon rien à projeter → erreur claire).
 */

import { prisma } from "@/lib/prisma";
import { readContenuDetaille } from "@/server/qualiopi/engine/content-schema";
import { renderPdfToBuffer, storeAndSignPdf } from "@/server/qualiopi/documents/render";
import { isR2Configured, uploadToR2, getSignedUrlR2 } from "@/lib/r2-storage";
import { construireDeck } from "./deck-builder";
import { loadDeckImages } from "./deck-image";
import { DeckPdf } from "./deck-pdf";
import { renderDeckPptx } from "./deck-pptx";
import React from "react";

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** Convertit une valeur JSON Prisma en string[] (défensif). */
function jsonToStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

export interface GenererDeckResult {
  supportId: string;
  pdfUrl: string | null;
  pptxUrl: string | null;
  nbSlides: number;
  pptxDisponible: boolean;
}

/** Extrait fil rouge + livrables depuis un programmeDetaille objet (structure). */
function extraireExtras(programme: unknown): {
  filRouge?: string;
  livrables?: { j0: string[]; j1: string[]; j30: string[] };
} {
  if (programme === null || typeof programme !== "object" || Array.isArray(programme)) return {};
  const o = programme as Record<string, unknown>;
  const filRouge = typeof o["fil_rouge"] === "string" ? (o["fil_rouge"] as string) : "";
  const livrables = {
    j0: jsonToStringArray(o["livrables_j0"]),
    j1: jsonToStringArray(o["livrables_j1"]),
    j30: jsonToStringArray(o["livrables_j30"]),
  };
  const hasLivr = livrables.j0.length + livrables.j1.length + livrables.j30.length > 0;
  return { ...(filRouge ? { filRouge } : {}), ...(hasLivr ? { livrables } : {}) };
}

export async function genererDeck(input: { formationId: string }): Promise<GenererDeckResult> {
  if (isStub()) throw new Error("Génération de diaporama impossible en mode stub (build).");

  const formation = await prisma.formation.findUnique({
    where: { id: input.formationId },
    select: { id: true, titre: true, programmeDetaille: true },
  });
  if (!formation) throw new Error(`Formation introuvable : ${input.formationId}`);

  const contenuDetaille = readContenuDetaille(formation.programmeDetaille);
  if (!contenuDetaille) {
    throw new Error(
      "Cette formation n'a pas encore de contenu détaillé généré — lancez d'abord la génération IA.",
    );
  }

  const extras = extraireExtras(formation.programmeDetaille);
  const deck = construireDeck({
    titreFormation: formation.titre,
    contenuDetaille,
    ...extras,
  });

  const images = await loadDeckImages();

  // 1. PDF 16:9 (toujours)
  const {
    buffer: pdfBuffer,
    hashSha256,
    sizeBytes,
  } = await renderPdfToBuffer(React.createElement(DeckPdf, { deck, images }));
  const year = new Date().getFullYear();
  const pdfKey = `supports/${year}/deck/${hashSha256}.pdf`;
  const pdfUrl = await storeAndSignPdf(pdfBuffer, pdfKey);

  // 2. PPTX éditable (si pptxgenjs dispo — prod)
  let pptxUrl: string | null = null;
  let pptxKey: string | null = null;
  try {
    const pptxBuffer = await renderDeckPptx(deck, images);
    if (pptxBuffer && isR2Configured()) {
      pptxKey = `supports/${year}/deck/${hashSha256}.pptx`;
      await uploadToR2(
        pptxKey,
        pptxBuffer,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      );
      pptxUrl = await getSignedUrlR2(pptxKey, 900);
    }
  } catch {
    // fail-soft : PDF seul si le PPTX échoue
  }

  // 3. Upsert SupportFormation (type slides_formateur = le diaporama)
  const existing = await prisma.supportFormation.findFirst({
    where: { formationId: formation.id, type: "slides_formateur" },
    select: { id: true, version: true },
    orderBy: { version: "desc" },
  });
  const version = existing ? existing.version + 1 : 1;
  const data = {
    titre: `Diaporama de projection — ${formation.titre}`,
    // `contenu` (Json) porte l'info du deck + le pointeur PPTX (pas de champ
    // metadata sur SupportFormation).
    contenu: {
      kind: "projection_deck",
      nbSlides: deck.slides.length,
      pdfKey,
      pptxKey,
    } as never,
    version,
    hashSha256,
    sizeBytes,
    aiGenerated: true,
    statut: "genere" as const,
    generatedAt: new Date(),
    ...(pdfKey ? { pdfKey } : {}),
    ...(pdfUrl ? { pdfUrl } : {}),
  };

  const support = existing
    ? await prisma.supportFormation.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      })
    : await prisma.supportFormation.create({
        data: { formationId: formation.id, type: "slides_formateur", ...data },
        select: { id: true },
      });

  return {
    supportId: support.id,
    pdfUrl,
    pptxUrl,
    nbSlides: deck.slides.length,
    pptxDisponible: pptxKey !== null,
  };
}
