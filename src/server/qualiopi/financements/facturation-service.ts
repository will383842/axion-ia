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
import { opcoLabel } from "./opco-referentiel";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { assertOrganismeComplet } from "@/server/qualiopi/documents/conformite";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import {
  computeTotauxFacture,
  isRegimeTva,
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData } from "@/server/qualiopi/documents/templates/facture";
import { resolveRibFacture } from "@/lib/legal-identity";

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
  // Durée depuis le snapshot légal (WS5) ; repli LIVE pour les sessions legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const dureeHeures =
    session.dureeReelleHeures ?? formationDoc.dureeHeures ?? session.formation.dureeHeures;
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

  // [P1] Facturer le BON tiers selon le destinataire réel — ne plus retomber sur
  //   la raison sociale de l'entreprise cliente pour l'OPCO / France Travail / le
  //   stagiaire. SIRET/adresse de l'OPCO = donnée d'un référentiel OPCO (à saisir),
  //   jamais inventés ici.
  if (destinataireReel === "opco") {
    const opcoId = session.client?.opcoIdentifie ?? null;
    // Nom LISIBLE de l'OPCO (« Atlas » plutôt que le slug « atlas »).
    destinataireNom = opcoId ? opcoLabel(opcoId) : "OPCO (à préciser)";
  } else if (destinataireReel === "france_travail") {
    destinataireNom = "France Travail";
  } else if (destinataireReel === "stagiaire") {
    // Reste à charge facturé au bénéficiaire individuel — l'identité précise dépend
    //   de l'inscription ; placeholder explicite plutôt que l'entreprise cliente.
    destinataireNom = "Bénéficiaire (reste à charge)";
  } else if (session.client) {
    // entreprise
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

  // Échéance : délai configurable (SiteSetting) — financeur (subrogation OPCO)
  // vs client direct. RIB depuis legal_overrides (null → bloc omis du PDF).
  const [delaiClient, delaiFinanceur, rib] = await Promise.all([
    getQualiopiConfig("delai_paiement_jours"),
    getQualiopiConfig("delai_paiement_financeur_jours"),
    resolveRibFacture(),
  ]);
  const delaiJours = session.opcoSubrogation ? delaiFinanceur : delaiClient;
  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(
    echeance.getDate() + (Number.isFinite(delaiJours) && delaiJours > 0 ? delaiJours : 30),
  );

  const formatDate = (d: Date) => d.toLocaleDateString("fr-FR");

  // Régime de TVA (config, évolutif) + ventilation HT/TVA/TTC. Snapshot facture.
  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = isRegimeTva(regimeTvaConfig) ? regimeTvaConfig : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const totaux = computeTotauxFacture(lignes, regimeTva, tauxStandard);

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
      regimeTva,
      tauxTvaStandardPercent: tauxStandard,
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
      ...(rib !== null ? { rib } : {}),
    };

    // 🔴 #7 — Le PDF affiche le NUMÉRO DE FACTURE (`factureData.numero`, celui
    // enregistré dans `factureFormation` et exporté au FEC/compta), et NON le
    // numéro DocumentGenere alloué indépendamment par `generateDocument`. Avant,
    // le PDF remis au client portait un numéro (compteur documentGenere) absent
    // du registre comptable (compteur factureFormation) : facture introuvable
    // dans les livres, refus au contrôle. On IGNORE donc `docNumero`.
    // (Le DocumentGenere garde son propre numéro pour le classement interne R2 —
    // artefact de stockage, sans valeur comptable ; unification complète = chantier
    // à part, l'historique des deux séquences se chevauche.)
    let docResult: { id: string } | null = null;
    try {
      docResult = await generateDocument({
        type: "facture",
        identite,
        buildElement: () => React.createElement(FacturePdf, { data: factureData }),
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
          activite: "formation",
          sessionId: input.sessionId,
          ...(session.clientId != null ? { clientId: session.clientId } : {}),
          destinataire: destinataireReel,
          destinataireNom,
          ...(destinataireSiret !== undefined ? { destinataireSiret } : {}),
          ...(session.client?.tvaIntracom != null
            ? { destinataireTvaIntracom: session.client.tvaIntracom }
            : {}),
          ...(destinataireAdresse !== undefined ? { destinataireAdresse } : {}),
          montantHtCents: totalHtCents,
          tvaExoneree: totaux.totalTvaCents === 0,
          regimeTva,
          montantTvaCents: totaux.totalTvaCents,
          montantTtcCents: totaux.totalTtcCents,
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
