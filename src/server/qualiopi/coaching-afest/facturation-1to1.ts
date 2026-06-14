/**
 * Qualiopi 1-to-1 / AFEST — facturation d'un parcours coaching (C1, P5).
 *
 * Facture un `CoachingContract` (forfait, TVA exonérée 261-4-4° CGI), avec
 * subrogation OPCO optionnelle (destinataire = OPCO + n° dossier bloquant).
 * Réutilise computeForfait, generateDocument et le template FacturePdf — AUCUNE
 * duplication de la machinerie. La facture est rattachée via coachingContractId.
 *
 * Stub-aware. Numérotation AXI-FACT-YYYY-NNN (retry P2002).
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { computeForfait } from "@/server/qualiopi/financements/opco-calcul";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData } from "@/server/qualiopi/documents/templates/facture";

export interface GenererFactureCoachingResult {
  factureId: string;
  numero: string;
  documentId: string | null;
}

const MAX_ATTEMPTS = 5;
const PREFIX_FACT = "AXI-FACT";

export async function genererFactureCoaching(
  coachingContractId: string,
): Promise<GenererFactureCoachingResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { factureId: "stub", numero: "AXI-FACT-0000-000", documentId: null };
  }

  const contrat = await prisma.coachingContract.findUniqueOrThrow({
    where: { id: coachingContractId },
    include: { client: true },
  });

  // Subrogation OPCO : n° de dossier ET client identifié bloquants (sinon la
  // facture serait libellée à un destinataire « À compléter »).
  if (contrat.subrogation && !contrat.numeroDossierOpco) {
    throw new Error(
      "Subrogation OPCO : le numéro de dossier OPCO est obligatoire pour émettre la facture.",
    );
  }
  if (contrat.subrogation && !contrat.client) {
    throw new Error(
      "Subrogation OPCO : un client (entreprise/OPCO) doit être rattaché au contrat avant facturation.",
    );
  }

  const { lignes, totalHtCents } = computeForfait(contrat.montantHtCents);

  // Destinataire : OPCO si subrogation, sinon le client.
  const estOpco = contrat.subrogation;
  let destinataireNom = "À compléter";
  let destinataireSiret: string | undefined;
  let destinataireAdresse: string | undefined;
  if (estOpco && contrat.client) {
    destinataireNom = contrat.client.opcoIdentifie ?? "OPCO";
  } else if (contrat.client) {
    destinataireNom = contrat.client.raisonSociale ?? "Client";
    destinataireSiret = contrat.client.siret ?? undefined;
    destinataireAdresse = contrat.client.adresse ?? undefined;
  }

  const identite = await getOrganismeIdentite();
  const annee = new Date().getFullYear();
  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(echeance.getDate() + 30);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR");

  let factureCreee: { id: string; numero: string } | null = null;
  let documentId: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const count = await prisma.factureFormation.count({
      where: { numero: { startsWith: `${PREFIX_FACT}-${annee}-` } },
    });
    const numero = formatDocumentNumber("facture", annee, count + 1);

    const factureData: FactureData = {
      numero,
      dateEmission: fmt(now),
      dateEcheance: fmt(echeance),
      identite,
      client: {
        raisonSociale: destinataireNom,
        ...(destinataireSiret !== undefined ? { siret: destinataireSiret } : {}),
        ...(destinataireAdresse !== undefined ? { adresse: destinataireAdresse } : {}),
      },
      lignes,
      ...(contrat.subrogation && contrat.numeroDossierOpco
        ? {
            subrogationOpco: { nomOpco: destinataireNom, numeroDossier: contrat.numeroDossierOpco },
          }
        : {}),
    };

    let docResult: { id: string } | null = null;
    try {
      docResult = await generateDocument({
        type: "facture",
        buildElement: (docNumero) =>
          React.createElement(FacturePdf, { data: { ...factureData, numero: docNumero } }),
      });
    } catch {
      // fail-soft : facture créée sans PDF si le renderer échoue
    }
    documentId = docResult?.id ?? null;

    try {
      const facture = await prisma.factureFormation.create({
        data: {
          numero,
          coachingContractId,
          destinataire: estOpco ? "opco" : "entreprise",
          destinataireNom,
          ...(destinataireSiret !== undefined ? { destinataireSiret } : {}),
          ...(destinataireAdresse !== undefined ? { destinataireAdresse } : {}),
          montantHtCents: totalHtCents,
          tvaExoneree: true,
          lignes: lignes as never,
          subrogation: contrat.subrogation,
          ...(contrat.numeroDossierOpco != null
            ? { numeroDossierOpco: contrat.numeroDossierOpco }
            : {}),
          statut: "emise",
          emiseAt: now,
          echeanceAt: echeance,
          ...(documentId !== null ? { documentId } : {}),
        },
        select: { id: true, numero: true },
      });
      factureCreee = facture;
      break;
    } catch (err: unknown) {
      const isP2002 =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      if (isP2002 && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }

  if (!factureCreee) {
    throw new Error(
      `[genererFactureCoaching] Impossible d'allouer un numéro unique après ${MAX_ATTEMPTS} tentatives.`,
    );
  }

  return { factureId: factureCreee.id, numero: factureCreee.numero, documentId };
}
