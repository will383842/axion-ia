/**
 * Qualiopi — Service de facturation formation (T11 AGENT A).
 *
 * Génère une FactureFormation (numéro séquentiel AXI-FACT-YYYY-NNN),
 * construit la FactureData, produit le document PDF via generateDocument,
 * et stocke documentId + emiseAt.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne un résultat
 * minimal sans toucher la DB ni R2.
 *
 * TVA exonérée 261-4-4° CGI par défaut (tvaExoneree=true).
 * Subrogation OPCO : destinataire forcé = "opco", mention exacte,
 * numeroDossierOpco BLOQUANT si absent.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import type { FactureFormationDestinataire } from "../../../../prisma/generated/client";
import { computeVentilationDossier, computeForfait } from "./opco-calcul";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { assertOrganismeComplet } from "@/server/qualiopi/documents/conformite";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData } from "@/server/qualiopi/documents/templates/facture";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface GenererFactureInput {
  sessionId: string;
  destinataire: FactureFormationDestinataire;
  ventilation: "forfait" | "horaire";
}

export interface GenererFactureResult {
  factureId: string;
  numero: string;
  documentId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// genererFactureFormation
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const PREFIX_FACT = "AXI-FACT";

/**
 * Crée une FactureFormation, calcule les lignes (forfait ou horaire OPCO),
 * construit la FactureData, génère le PDF via generateDocument, et stocke
 * documentId + emiseAt sur la facture.
 *
 * Retry P2002 sur le numéro séquentiel (pattern identique à documents-service.ts).
 */
export async function genererFactureFormation(
  input: GenererFactureInput,
): Promise<GenererFactureResult> {
  // ── Stub build-time ──────────────────────────────────────────────────────
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { factureId: "stub", numero: "AXI-FACT-0000-000", documentId: null };
  }

  // ── Chargement session + formation + client ──────────────────────────────
  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: input.sessionId },
    include: {
      formation: true,
      client: true,
    },
  });

  // ── Vérification subrogation (bloquante) ─────────────────────────────────
  if (session.opcoSubrogation && !session.numeroDossierOpco) {
    throw new Error(
      "Subrogation OPCO : le numéro de dossier OPCO est obligatoire pour émettre la facture.",
    );
  }

  // ── Calcul des lignes (forfait ou horaire) ───────────────────────────────
  const dureeHeures = session.dureeReelleHeures ?? session.formation.dureeHeures;
  const nbParticipants = session.nbParticipantsReels ?? session.nbParticipantsPrevus;

  let lignes: Array<{ designation: string; quantite: number; prixUnitaireHtCents: number }>;
  let totalHtCents: number;

  if (input.ventilation === "horaire") {
    // Barème de prise en charge saisi sur le dossier (T18).
    // priseEnChargeMontantCents et priseEnChargeUnite sont obligatoires en ventilation horaire.
    if (session.priseEnChargeMontantCents == null || session.priseEnChargeUnite == null) {
      throw new Error(
        "Barème de prise en charge non renseigné sur le dossier — à relever sur le portail OPCO de la branche du client.",
      );
    }
    const result = computeVentilationDossier({
      unite: session.priseEnChargeUnite,
      montantCents: session.priseEnChargeMontantCents,
      dureeHeures,
      nbParticipants,
      ...(session.priseEnChargePlafondFormationCents != null
        ? { plafondFormationCents: session.priseEnChargePlafondFormationCents }
        : {}),
      ...(session.priseEnChargePlafondAnnuelCents != null
        ? { plafondAnnuelCents: session.priseEnChargePlafondAnnuelCents }
        : {}),
    });
    lignes = result.lignes;
    totalHtCents = result.totalHtCents;
  } else {
    const result = computeForfait(session.montantHtCents);
    lignes = result.lignes;
    totalHtCents = result.totalHtCents;
  }

  // ── Destinataire réel (subrogation → opco) ───────────────────────────────
  const destinataireReel: FactureFormationDestinataire = session.opcoSubrogation
    ? "opco"
    : input.destinataire;

  // Nom / SIRET / adresse du destinataire
  let destinataireNom = "À compléter";
  let destinataireSiret: string | undefined;
  let destinataireAdresse: string | undefined;

  if (destinataireReel === "opco" && session.client) {
    const opcoId = session.client.opcoIdentifie ?? "OPCO";
    destinataireNom = opcoId;
  } else if (session.client) {
    destinataireNom = session.client.raisonSociale ?? "Client";
    destinataireSiret = session.client.siret ?? undefined;
    destinataireAdresse = session.client.adresse ?? undefined;
  }

  // ── Numéro séquentiel + retry P2002 ─────────────────────────────────────
  const annee = new Date().getFullYear();
  const identite = await getOrganismeIdentite();

  // Garde-fou conformité : une facture sans identité OF complète (SIRET, NDA,
  // adresse siège) est illégale. On valide AVANT toute création de
  // FactureFormation, et hors du try/catch fail-soft de génération PDF, pour
  // bloquer DUR (sinon l'erreur serait avalée et un enregistrement non conforme
  // serait créé sans PDF).
  assertOrganismeComplet(identite, "facture");

  // Calcul échéance : 30 jours
  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(echeance.getDate() + 30);

  const formatDate = (d: Date) => d.toLocaleDateString("fr-FR");

  let factureCreee: { id: string; numero: string } | null = null;
  let documentId: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const count = await prisma.factureFormation.count({
      where: { numero: { startsWith: `${PREFIX_FACT}-${annee}-` } },
    });
    const numero = formatDocumentNumber("facture", annee, count + 1);

    // Construction FactureData (React.createElement, pas de JSX en .ts)
    const factureData: FactureData = {
      numero,
      dateEmission: formatDate(now),
      dateEcheance: formatDate(echeance),
      identite,
      client: {
        raisonSociale: destinataireNom,
        ...(destinataireSiret !== undefined ? { siret: destinataireSiret } : {}),
        ...(destinataireAdresse !== undefined ? { adresse: destinataireAdresse } : {}),
      },
      lignes,
      ...(session.opcoSubrogation && session.numeroDossierOpco !== null
        ? {
            subrogationOpco: {
              nomOpco: destinataireNom,
              numeroDossier: session.numeroDossierOpco,
            },
          }
        : {}),
    };

    // Génération PDF (stub-aware internellement).
    // buildElement injecte le numéro DocumentGenere alloué dans l'en-tête.
    // La FacturePdf affiche le numéro passé par buildElement (registre doc).
    let docResult: { id: string } | null = null;
    try {
      docResult = await generateDocument({
        type: "facture",
        identite,
        buildElement: (docNumero) =>
          React.createElement(FacturePdf, { data: { ...factureData, numero: docNumero } }),
        refs: { sessionId: input.sessionId },
      });
    } catch {
      // Fail-soft : la facture est créée sans PDF si le renderer échoue
    }
    documentId = docResult?.id ?? null;

    try {
      const facture = await prisma.factureFormation.create({
        data: {
          numero,
          sessionId: input.sessionId,
          destinataire: destinataireReel,
          destinataireNom,
          ...(destinataireSiret !== undefined ? { destinataireSiret } : {}),
          ...(destinataireAdresse !== undefined ? { destinataireAdresse } : {}),
          montantHtCents: totalHtCents,
          tvaExoneree: true,
          lignes: lignes as never,
          subrogation: session.opcoSubrogation,
          ...(session.numeroDossierOpco !== null && session.numeroDossierOpco !== undefined
            ? { numeroDossierOpco: session.numeroDossierOpco }
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
      const isPrismaUniqueError =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      if (isPrismaUniqueError && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }

  if (!factureCreee) {
    throw new Error(
      `[genererFactureFormation] Impossible d'allouer un numéro unique après ${MAX_ATTEMPTS} tentatives.`,
    );
  }

  return {
    factureId: factureCreee.id,
    numero: factureCreee.numero,
    documentId,
  };
}
