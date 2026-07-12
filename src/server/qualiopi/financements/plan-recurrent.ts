/**
 * Hub facturation — plans récurrents (Phase 5).
 *
 * RÈGLE PRODUIT : le cron génère des factures en BROUILLON — l'émission
 * (numérotation figée + PDF + échéance) et l'envoi restent des clics admin.
 * Aucune facture ne part seule, jamais.
 *
 * Cibles : maintenance site web 290 €/mois, 1-to-1 récurrent (contrats
 * 6/12/24 mois), futur SaaS/hébergement. Prix : gabarit de lignes posé à la
 * création du plan (issu du devis/catalogue) — jamais en dur ici.
 */

import { prisma } from "@/lib/prisma";
import React from "react";
import { randomUUID } from "node:crypto";
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
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData, LigneFacture } from "@/server/qualiopi/documents/templates/facture";
import { resolveRibFacture } from "@/lib/legal-identity";
import {
  normaliserLignesPourActivite,
  calculerProchaineGeneration,
} from "@/server/qualiopi/financements/facture-libre-pur";

// Ré-export (SSOT : facture-libre-pur.ts, testé isolément).
export { calculerProchaineGeneration } from "@/server/qualiopi/financements/facture-libre-pur";

const MAX_ATTEMPTS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Génération des brouillons (cron — AUCUNE émission, AUCUN envoi)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un brouillon de facture pour chaque plan actif échu, puis avance
 * `prochaineGenerationAt` depuis la date PLANIFIÉE (pas depuis now — zéro
 * dérive) et clôt le plan si ses bornes sont atteintes. Idempotent : la mise
 * à jour du plan est conditionnée à la date d'origine (verrou optimiste).
 * Rattrapage : un plan en retard de plusieurs périodes génère un brouillon
 * par exécution quotidienne jusqu'à rattrapage.
 */
export async function genererBrouillonsPlansEchus(
  now: Date,
): Promise<{ generes: number; clos: number }> {
  const plans = await prisma.planRecurrent.findMany({
    where: { statut: "actif", prochaineGenerationAt: { lte: now } },
    include: {
      client: { select: { raisonSociale: true, siret: true, tvaIntracom: true } },
      _count: { select: { factures: { where: { statut: { not: "annulee" } } } } },
    },
  });

  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = isRegimeTva(regimeTvaConfig) ? regimeTvaConfig : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;

  let generes = 0;
  let clos = 0;

  for (const plan of plans) {
    try {
      // Bornes : date de fin dépassée ou quota atteint → clôture (sans générer).
      const quotaAtteint =
        plan.nbMaxFactures !== null && plan._count.factures >= plan.nbMaxFactures;
      const finDepassee = plan.finAt !== null && plan.finAt < now;
      if (quotaAtteint || finDepassee) {
        await prisma.planRecurrent.updateMany({
          where: { id: plan.id, statut: "actif" },
          data: { statut: "clos" },
        });
        clos++;
        continue;
      }

      // Lignes stockées BRUTES (revue M1) : la normalisation TVA par activité
      // se rejoue à l'ÉMISSION avec le régime alors en vigueur — les montants
      // du brouillon sont indicatifs (recalculés à l'émission).
      const lignesBrutes = (plan.lignes ?? []) as unknown as LigneFacture[];
      if (lignesBrutes.length === 0) continue;
      const lignesIndicatives = normaliserLignesPourActivite(
        lignesBrutes,
        plan.activite,
        regimeTva,
        tauxStandard,
      );
      const totaux = computeTotauxFacture(lignesIndicatives, regimeTva, tauxStandard);

      // Numéro PROVISOIRE (revue C3) : un brouillon ne consomme JAMAIS de
      // numéro légal AXI-FACT — la séquence chronologique est allouée au clic
      // d'émission (emettreFactureBrouillon).
      const numero = `BROUILLON-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
      await prisma.$transaction(async (tx) => {
        await tx.factureFormation.create({
          data: {
            numero,
            activite: plan.activite,
            clientId: plan.clientId,
            planRecurrentId: plan.id,
            ...(plan.refClient !== null ? { refClient: plan.refClient } : {}),
            destinataire: "entreprise",
            destinataireNom: plan.client.raisonSociale,
            ...(plan.client.siret !== null ? { destinataireSiret: plan.client.siret } : {}),
            ...(plan.client.tvaIntracom !== null
              ? { destinataireTvaIntracom: plan.client.tvaIntracom }
              : {}),
            montantHtCents: totaux.totalHtCents,
            tvaExoneree: totaux.totalTvaCents === 0,
            regimeTva,
            montantTvaCents: totaux.totalTvaCents,
            montantTtcCents: totaux.totalTtcCents,
            lignes: lignesBrutes as never,
            statut: "brouillon",
          },
        });
        // Avance depuis la date PLANIFIÉE (verrou optimiste anti-double-génération).
        const { count: updated } = await tx.planRecurrent.updateMany({
          where: { id: plan.id, prochaineGenerationAt: plan.prochaineGenerationAt },
          data: {
            prochaineGenerationAt: calculerProchaineGeneration(
              plan.prochaineGenerationAt,
              plan.periodiciteMois,
            ),
          },
        });
        if (updated === 0) {
          throw new Error("plan déjà avancé par une exécution concurrente");
        }
      });
      generes++;
    } catch (err) {
      // Fail-soft par plan : un plan cassé ne bloque pas les autres.
      console.error(
        `[plan-recurrent] génération échouée pour le plan ${plan.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return { generes, clos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Émission d'un brouillon (clic admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Émet une facture en brouillon (récurrente ou libre) : re-calcule le régime
 * de TVA COURANT (snapshot à l'émission — pas celui de la génération du
 * brouillon), pose émission + échéance (délai configurable) et génère le PDF.
 */
export async function emettreFactureBrouillon(
  factureId: string,
): Promise<{ numero: string; documentId: string | null }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { numero: "AXI-FACT-0000-000", documentId: null };
  }

  const facture = await prisma.factureFormation.findUniqueOrThrow({
    where: { id: factureId },
    include: { client: { select: { contactEmail: true, adresse: true } } },
  });
  if (facture.statut !== "brouillon") {
    throw new Error("Seule une facture en brouillon s'émet.");
  }

  const identite = await getOrganismeIdentite();
  assertOrganismeComplet(identite, "facture");

  // Régime de TVA COURANT + RE-normalisation des lignes par activité (revue
  // M1) : les lignes du brouillon sont stockées BRUTES ; c'est ICI, à
  // l'émission, que la règle « exonération 261 = formation/1-to-1 seulement »
  // s'applique avec le régime en vigueur au moment de l'émission.
  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = isRegimeTva(regimeTvaConfig) ? regimeTvaConfig : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const lignesBrutes = (facture.lignes ?? []) as unknown as LigneFacture[];
  if (facture.activite === null && regimeTva === "exoneration_261") {
    throw new Error(
      "Activité manquante sur cette facture : impossible d'appliquer le régime d'exonération (l'activité pilote la TVA).",
    );
  }
  const lignes =
    facture.activite !== null
      ? normaliserLignesPourActivite(lignesBrutes, facture.activite, regimeTva, tauxStandard)
      : lignesBrutes;
  const totaux = computeTotauxFacture(lignes, regimeTva, tauxStandard);

  const [delaiClient, rib] = await Promise.all([
    getQualiopiConfig("delai_paiement_jours"),
    resolveRibFacture(),
  ]);
  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(
    echeance.getDate() + (Number.isFinite(delaiClient) && delaiClient > 0 ? delaiClient : 30),
  );
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR");

  // Allocation du numéro légal AXI-FACT à l'ÉMISSION (revue C3) — le brouillon
  // portait un numéro provisoire BROUILLON-*. Le updateMany conditionné au
  // statut `brouillon` sert de verrou anti-double-émission concurrente.
  const annee = now.getFullYear();
  let numeroFinal: string | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const count = await prisma.factureFormation.count({
      where: { numero: { startsWith: `AXI-FACT-${annee}-` } },
    });
    const numero = formatDocumentNumber("facture", annee, count + 1);
    try {
      const { count: updated } = await prisma.factureFormation.updateMany({
        where: { id: facture.id, statut: "brouillon" },
        data: {
          numero,
          statut: "emise",
          emiseAt: now,
          echeanceAt: echeance,
          regimeTva,
          montantHtCents: totaux.totalHtCents,
          montantTvaCents: totaux.totalTvaCents,
          montantTtcCents: totaux.totalTtcCents,
          tvaExoneree: totaux.totalTvaCents === 0,
          lignes: lignes as never,
        },
      });
      if (updated === 0) {
        throw new Error("Cette facture a déjà été émise (émission concurrente).");
      }
      numeroFinal = numero;
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
  if (numeroFinal === null) {
    throw new Error(
      `[emettreFactureBrouillon] Impossible d'allouer un numéro unique après ${MAX_ATTEMPTS} tentatives.`,
    );
  }

  // PDF APRÈS l'émission (revue C2) : élément pré-construit au numéro DB final.
  const factureData: FactureData = {
    numero: numeroFinal,
    dateEmission: fmt(now),
    dateEcheance: fmt(echeance),
    ...(facture.refClient !== null ? { refClient: facture.refClient } : {}),
    identite,
    regimeTva,
    tauxTvaStandardPercent: tauxStandard,
    client: {
      raisonSociale: facture.destinataireNom,
      ...(facture.destinataireSiret !== null ? { siret: facture.destinataireSiret } : {}),
      ...(facture.destinataireTvaIntracom !== null
        ? { numeroTvaIntracom: facture.destinataireTvaIntracom }
        : {}),
      ...(facture.destinataireAdresse !== null
        ? { adresse: facture.destinataireAdresse }
        : facture.client?.adresse != null
          ? { adresse: facture.client.adresse }
          : {}),
    },
    lignes,
    ...(rib !== null ? { rib } : {}),
  };

  let documentId: string | null = null;
  try {
    const doc = await generateDocument({
      type: "facture",
      identite,
      element: React.createElement(FacturePdf, { data: factureData }),
      ...(facture.clientId !== null ? { refs: { clientId: facture.clientId } } : {}),
    });
    documentId = doc.id;
    await prisma.factureFormation.update({
      where: { id: facture.id },
      data: { documentId },
    });
  } catch {
    // Fail-soft : émission valide même si le renderer échoue.
  }

  return { numero: numeroFinal, documentId };
}
