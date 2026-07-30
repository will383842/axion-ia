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
import { assertOrganismeComplet } from "@/server/qualiopi/documents/conformite";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  computeTotauxFacture,
  isRegimeTva,
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData } from "@/server/qualiopi/documents/templates/facture";
import { resolveRibFacture } from "@/lib/legal-identity";
import { resoudreConditions } from "@/server/qualiopi/financements/conditions-client";
import { validateCoachingFinancement, computeCoachingFacturation } from "./financement-1to1";
import { getHeuresReellesContrat } from "./heures";
import { opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";

export interface GenererFactureCoachingResult {
  factureId: string;
  numero: string;
  documentId: string | null;
}

const MAX_ATTEMPTS = 5;

/**
 * Heures réelles d'un contrat.
 *
 * 🔴 Passe par `getHeuresReellesContrat`, c'est-à-dire par la MÊME fonction et
 * les MÊMES critères que l'attestation, le BPF et le certificat — et sous le
 * régime de preuve de CHAQUE parcours. Une facture qui ne dit pas la même chose
 * que le certificat du même parcours est un motif de redressement à elle seule,
 * et c'était déjà le cas : le BPF filtrait `estAfest` + `statut: realisee`, la
 * facture ne filtrait rien.
 */
async function heuresReellesContrat(coachingContractId: string): Promise<number> {
  return getHeuresReellesContrat(coachingContractId);
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
    // Nom LISIBLE de l'OPCO (« Atlas » plutôt que le slug « atlas ») — parité collectif.
    destinataireNom = contrat.client?.opcoIdentifie
      ? opcoLabel(contrat.client.opcoIdentifie)
      : "OPCO (à préciser)";
  } else if (calc.destinataire === "france_travail") {
    destinataireNom = "France Travail";
  } else if (contrat.client) {
    destinataireNom = contrat.client.raisonSociale ?? "Client";
    destinataireSiret = contrat.client.siret ?? undefined;
    destinataireAdresse = contrat.client.adresse ?? undefined;
  }

  const identite = await getOrganismeIdentite();
  // Garde-fou conformité : facture illégale si identité OF incomplète.
  // Validé hors du try/catch fail-soft de génération PDF (blocage dur).
  assertOrganismeComplet(identite, "facture");
  const annee = new Date().getFullYear();
  // Échéance : délai configurable — financeur (OPCO subrogé / France Travail)
  // vs client direct. RIB depuis legal_overrides (null → bloc omis du PDF).
  // 🔴 Vérification E2E 2026-07-26 — délai propre au client, non lu jusqu'ici.
  const [delaiGlobal, delaiFinanceur, rib] = await Promise.all([
    getQualiopiConfig("delai_paiement_jours"),
    getQualiopiConfig("delai_paiement_financeur_jours"),
    resolveRibFacture(),
  ]);
  const delaiClient = resoudreConditions(
    {
      delaiPaiementJours: contrat.client?.delaiPaiementJours ?? null,
      tauxAcomptePct: null,
      modeFacturation: null,
    },
    { delaiPaiementJours: delaiGlobal, tauxAcomptePct: 0, modeFacturation: "acompte_solde" },
  ).delaiPaiementJours;
  const delaiJours =
    calc.destinataire === "opco" || calc.destinataire === "france_travail"
      ? delaiFinanceur
      : delaiClient;
  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(
    echeance.getDate() + (Number.isFinite(delaiJours) && delaiJours > 0 ? delaiJours : 30),
  );
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR");

  // Régime de TVA (config, évolutif) + ventilation HT/TVA/TTC. Snapshot facture.
  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = isRegimeTva(regimeTvaConfig) ? regimeTvaConfig : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const totaux = computeTotauxFacture(calc.lignes, regimeTva, tauxStandard);

  let factureCreee: { id: string; numero: string } | null = null;
  let documentId: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 🔴 V20 — borne haute. Boucle de reprise conservée (rendu PDF à
    // l'intérieur), désormais convergente. Même série AXI-FACT que la
    // facturation de session : elles DOIVENT lire le compteur de la même façon.
    const numero = await nextNumero("facture", annee, (prefixe) =>
      prisma.factureFormation.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    );

    const factureData: FactureData = {
      numero,
      dateEmission: fmt(now),
      dateEcheance: fmt(echeance),
      identite,
      regimeTva,
      tauxTvaStandardPercent: tauxStandard,
      client: {
        raisonSociale: destinataireNom,
        ...(destinataireSiret !== undefined ? { siret: destinataireSiret } : {}),
        ...(destinataireAdresse !== undefined ? { adresse: destinataireAdresse } : {}),
      },
      lignes: calc.lignes,
      ...(calc.destinataire === "opco" && calc.numeroDossier
        ? { subrogationOpco: { nomOpco: destinataireNom, numeroDossier: calc.numeroDossier } }
        : {}),
      ...(rib !== null ? { rib } : {}),
    };

    let docResult: { id: string } | null = null;
    try {
      docResult = await generateDocument({
        type: "facture",
        identite,
        // 🔴 Le numéro de facture est déjà alloué sur la séquence FactureFormation
        // (ligne `numero` ci-dessus). NE PAS le remplacer par le numéro de Document
        // générique renvoyé par generateDocument — sinon le PDF affiche un numéro
        // différent de celui enregistré en base (facture ↔ PDF désynchronisés).
        buildElement: () => React.createElement(FacturePdf, { data: factureData }),
      });
    } catch {
      // fail-soft : facture créée sans PDF si le renderer échoue
    }
    documentId = docResult?.id ?? null;

    try {
      const facture = await prisma.factureFormation.create({
        data: {
          numero,
          activite: "un_a_un",
          coachingContractId,
          ...(contrat.clientId != null ? { clientId: contrat.clientId } : {}),
          destinataire: calc.destinataire,
          destinataireNom,
          ...(destinataireSiret !== undefined ? { destinataireSiret } : {}),
          ...(contrat.client?.tvaIntracom != null
            ? { destinataireTvaIntracom: contrat.client.tvaIntracom }
            : {}),
          ...(destinataireAdresse !== undefined ? { destinataireAdresse } : {}),
          montantHtCents: calc.totalHtCents,
          tvaExoneree: totaux.totalTvaCents === 0,
          regimeTva,
          montantTvaCents: totaux.totalTvaCents,
          montantTtcCents: totaux.totalTtcCents,
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
