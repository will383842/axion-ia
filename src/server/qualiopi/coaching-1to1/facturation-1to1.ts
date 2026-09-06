/**
 * Coaching 1-to-1 (conseil) — facturation d'un contrat.
 *
 * 2026-08-10 (décision Will) : déplacé depuis `coaching-afest/facturation-1to1.ts`
 * et RÉDUIT. Le 1-to-1 est une prestation de CONSEIL hors Qualiopi :
 *  - 🔴 la TVA N'EST PAS exonérée. L'exonération 261-4-4° CGI ne couvre que la
 *    formation professionnelle continue ; les lignes `un_a_un` passent par
 *    `normaliserLignesPourActivite` et sont taxées au taux standard même en
 *    régime `exoneration_261` (l'ancien en-tête « TVA exonérée 261-4-4° CGI »
 *    était FAUX pour du conseil).
 *  - le financement tiers (OPCO / CPF / France Travail, subrogation) a disparu
 *    avec le module AFEST : le destinataire est TOUJOURS le client.
 * Facture au forfait (`CoachingContract.montantHtCents`). Réutilise FacturePdf.
 * Stub-aware.
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
  regimeTvaDepuisConfig,
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import { normaliserLignesPourActivite } from "@/server/qualiopi/financements/facture-libre-pur";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData } from "@/server/qualiopi/documents/templates/facture";
import { resolveRibFacture } from "@/lib/legal-identity";
import { resoudreConditions } from "@/server/qualiopi/financements/conditions-client";
import { lignesFacture1to1 } from "./facturation-1to1-pur";

export interface GenererFactureCoachingResult {
  factureId: string;
  numero: string;
  documentId: string | null;
}

const MAX_ATTEMPTS = 5;

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

  // Destinataire : TOUJOURS le client (le financement tiers a été supprimé).
  const destinataireNom = contrat.client?.raisonSociale ?? "Client";
  const destinataireSiret = contrat.client?.siret ?? undefined;
  const destinataireAdresse = contrat.client?.adresse ?? undefined;

  const identite = await getOrganismeIdentite();
  // Garde-fou conformité : facture illégale si identité OF incomplète.
  // Validé hors du try/catch fail-soft de génération PDF (blocage dur).
  assertOrganismeComplet(identite, "facture");
  const annee = new Date().getFullYear();
  // Échéance : délai du client (spécifique) sinon délai global. RIB depuis
  // legal_overrides (null → bloc omis du PDF).
  const [delaiGlobal, rib] = await Promise.all([
    getQualiopiConfig("delai_paiement_jours"),
    resolveRibFacture(),
  ]);
  const delaiJours = resoudreConditions(
    {
      delaiPaiementJours: contrat.client?.delaiPaiementJours ?? null,
      tauxAcomptePct: null,
      modeFacturation: null,
    },
    { delaiPaiementJours: delaiGlobal, tauxAcomptePct: 0, modeFacturation: "acompte_solde" },
  ).delaiPaiementJours;
  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(
    echeance.getDate() + (Number.isFinite(delaiJours) && delaiJours > 0 ? delaiJours : 30),
  );
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR");

  // Régime de TVA (config, évolutif) + ventilation HT/TVA/TTC. Snapshot facture.
  // 🔴 `normaliserLignesPourActivite` AVANT tout calcul : en régime
  // `exoneration_261`, l'activité `un_a_un` est HORS champ de l'exonération —
  // ses lignes sont taxées au taux standard. Le conseil est taxable.
  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = regimeTvaDepuisConfig(regimeTvaConfig);
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const lignes = normaliserLignesPourActivite(
    lignesFacture1to1(contrat.montantHtCents),
    "un_a_un",
    regimeTva,
    tauxStandard,
  );
  const totaux = computeTotauxFacture(lignes, regimeTva, tauxStandard);

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

    try {
      const facture = await prisma.factureFormation.create({
        data: {
          numero,
          activite: "un_a_un",
          coachingContractId,
          ...(contrat.clientId != null ? { clientId: contrat.clientId } : {}),
          destinataire: "entreprise",
          destinataireNom,
          ...(destinataireSiret !== undefined ? { destinataireSiret } : {}),
          ...(contrat.client?.tvaIntracom != null
            ? { destinataireTvaIntracom: contrat.client.tvaIntracom }
            : {}),
          ...(destinataireAdresse !== undefined ? { destinataireAdresse } : {}),
          montantHtCents: totaux.totalHtCents,
          tvaExoneree: totaux.totalTvaCents === 0,
          regimeTva,
          montantTvaCents: totaux.totalTvaCents,
          montantTtcCents: totaux.totalTtcCents,
          lignes: lignes as never,
          subrogation: false,
          statut: "emise",
          emiseAt: now,
          echeanceAt: echeance,
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

  const factureData: FactureData = {
    // Le numéro que la base a ACCEPTÉ, jamais celui d'un tour de reprise perdu.
    numero: factureCreee.numero,
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
    lignes,
    ...(rib !== null ? { rib } : {}),
  };

  // 🔴 2026-08-24, cahier D9-2 — PDF APRÈS le create réussi (revue C2).
  //
  // Il était généré AVANT, dans la boucle de reprise. Sur collision de numéro,
  // le tour suivant en générait un SECOND, laissant le premier ORPHELIN au
  // registre des pièces — avec un numéro de facture attribué à une AUTRE
  // facture. Le patron correct existait déjà dans `plan-recurrent.ts` et
  // `facture-libre.ts` ; il avait été oublié ici et dans `facturation-service.ts`.
  try {
    const docResult = await generateDocument({
      type: "facture",
      identite,
      // 🔴 Le numéro affiché est celui de la séquence FactureFormation, jamais
      // celui du DocumentGenere : sinon le PDF remis au client porte un numéro
      // absent du registre comptable (facture ↔ PDF désynchronisés).
      buildElement: () => React.createElement(FacturePdf, { data: factureData }),
    });
    documentId = docResult.id;
    await prisma.factureFormation.update({
      where: { id: factureCreee.id },
      data: { documentId },
    });
  } catch {
    // Fail-soft assumé : la facture reste ÉMISE sans PDF si le renderer échoue.
  }

  return { factureId: factureCreee.id, numero: factureCreee.numero, documentId };
}
