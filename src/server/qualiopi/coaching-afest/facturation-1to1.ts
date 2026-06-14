/**
 * Qualiopi 1-to-1 / AFEST — facturation d'un parcours coaching (parité financement).
 *
 * Facture un `CoachingContract` (TVA exonérée 261-4-4° CGI) selon son dispositif :
 *   - OPCO : ventilation horaire (barème prise en charge) ou forfait, subrogation
 *            → destinataire OPCO + n° dossier ;
 *   - France Travail : destinataire France Travail + montant aide ;
 *   - CPF : reste à charge bénéficiaire ;
 *   - direct : forfait, destinataire entreprise.
 * Valide les pré-requis bloquants (validateCoachingFinancement). Heures réelles =
 * Σ CompteRenduSeance.dureeMinutes / 60. Réutilise FacturePdf. Stub-aware.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData } from "@/server/qualiopi/documents/templates/facture";
import { validateCoachingFinancement, computeCoachingFacturation } from "./financement-1to1";

export interface GenererFactureCoachingResult {
  factureId: string;
  numero: string;
  documentId: string | null;
}

const MAX_ATTEMPTS = 5;
const PREFIX_FACT = "AXI-FACT";

/** Heures réelles d'un contrat = Σ CompteRenduSeance.dureeMinutes des séances liées. */
async function heuresReellesContrat(coachingContractId: string): Promise<number> {
  const crs = await prisma.compteRenduSeance.findMany({
    where: { coachingSession: { coachingContractId } },
    select: { dureeMinutes: true },
  });
  const minutes = crs.reduce((acc, c) => acc + (c.dureeMinutes ?? 0), 0);
  return Math.round((minutes / 60) * 100) / 100;
}

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

  // Pré-requis bloquants du dispositif (OPCO/CPF/France Travail).
  const blocked = validateCoachingFinancement(contrat);
  if (blocked) throw new Error(blocked);
  if (contrat.subrogation && !contrat.client) {
    throw new Error(
      "Subrogation OPCO : un client (entreprise/OPCO) doit être rattaché au contrat avant facturation.",
    );
  }

  const heures = await heuresReellesContrat(coachingContractId);
  const calc = computeCoachingFacturation(contrat, heures);

  // Nom/SIRET/adresse du destinataire selon le dispositif.
  let destinataireNom = "À compléter";
  let destinataireSiret: string | undefined;
  let destinataireAdresse: string | undefined;
  if (calc.destinataire === "opco") {
    destinataireNom = contrat.client?.opcoIdentifie ?? "OPCO";
  } else if (calc.destinataire === "france_travail") {
    destinataireNom = "France Travail";
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
      lignes: calc.lignes,
      ...(calc.destinataire === "opco" && calc.numeroDossier
        ? { subrogationOpco: { nomOpco: destinataireNom, numeroDossier: calc.numeroDossier } }
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
          destinataire: calc.destinataire,
          destinataireNom,
          ...(destinataireSiret !== undefined ? { destinataireSiret } : {}),
          ...(destinataireAdresse !== undefined ? { destinataireAdresse } : {}),
          montantHtCents: calc.totalHtCents,
          tvaExoneree: true,
          lignes: calc.lignes as never,
          subrogation: calc.subrogation,
          ...(calc.numeroDossier != null ? { numeroDossierOpco: calc.numeroDossier } : {}),
          ...(calc.montantAideFranceTravailCents != null
            ? { montantAideFranceTravailCents: calc.montantAideFranceTravailCents }
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
