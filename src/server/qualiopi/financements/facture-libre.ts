/**
 * Hub facturation — factures LIBRES multi-activités, avoirs et encaissements.
 *
 * Une facture « libre » est une FactureFormation rattachée à un Client CRM
 * (et optionnellement à un Devis ou une AuditMission), SANS TrainingSession ni
 * CoachingContract : c'est le chemin de facturation des audits, implémentations
 * et sites web augmentés — et de toute prestation hors session.
 *
 * Règle TVA centrale (cf. legal/tva.ts) : l'exonération 261-4-4° CGI ne couvre
 * QUE la formation professionnelle continue. En régime `exoneration_261`, les
 * lignes d'une activité hors champ (audit/implementation/site_web) sont donc
 * taxées au taux standard, sauf taux explicite par ligne. `franchise_293b` et
 * `assujetti` s'appliquent au niveau de l'entité (aucun forçage par activité).
 *
 * Avoirs : facture rectificative à montants NÉGATIFS (numéro AXI-AVO-YYYY-NNN),
 * liée à l'origine via `avoirDeId` — on ne modifie JAMAIS une facture émise.
 * Encaissements : `Payment` (provider manual_*) rattaché à la facture — SSOT
 * partagé avec le booking. Statut recalculé : payee / partiellement_payee.
 *
 * Stub-aware : early-return si DATABASE_URL contient "stub.invalid".
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import type {
  ActiviteFacturation,
  FactureFormationDestinataire,
} from "../../../../prisma/generated/client";
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
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData, LigneFacture } from "@/server/qualiopi/documents/templates/facture";
import { resolveRibFacture } from "@/lib/legal-identity";
import { resoudreConditions } from "./conditions-client";
import { marquerPaiementRecuSiSoldee } from "@/server/qualiopi/financements/dossier-financement";
import {
  normaliserLignesPourActivite,
  construireLignesAvoir,
  calculerStatutEncaissement,
} from "@/server/qualiopi/financements/facture-libre-pur";

// Ré-export de la logique pure (SSOT : facture-libre-pur.ts, testée isolément).
export {
  ACTIVITES_EXONERABLES,
  ACTIVITE_LABELS,
  normaliserLignesPourActivite,
  construireLignesAvoir,
  calculerStatutEncaissement,
} from "@/server/qualiopi/financements/facture-libre-pur";

const MAX_ATTEMPTS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Facture libre
// ─────────────────────────────────────────────────────────────────────────────

export interface GenererFactureLibreInput {
  clientId: string;
  activite: ActiviteFacturation;
  /** Lignes libres (designation, quantite, PU HT centimes, taux TVA/ligne optionnel). */
  lignes: LigneFacture[];
  refClient?: string;
  devisId?: string;
  auditMissionId?: string;
  destinataire?: FactureFormationDestinataire;
  /** Période/date de réalisation affichée sur le PDF (art. 242 nonies A CGI). */
  periodePrestation?: string;
}

export interface GenererFactureLibreResult {
  factureId: string;
  numero: string;
  documentId: string | null;
  /** Client secteur public → dépôt Chorus Pro OBLIGATOIRE (alerte UI). */
  chorusProRequis: boolean;
}

/** Assemble l'adresse d'affichage : structurée si présente, sinon champ libre. */
function adresseClient(client: {
  adresse: string | null;
  adresseRue: string | null;
  adresseCodePostal: string | null;
  adresseVille: string | null;
}): string | undefined {
  if (client.adresseRue && client.adresseVille) {
    return [
      client.adresseRue,
      [client.adresseCodePostal, client.adresseVille].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");
  }
  return client.adresse ?? undefined;
}

/**
 * Émet une facture libre (statut `emise`) + PDF. Miroir de
 * `genererFactureFormation` (facturation-service.ts) pour une prestation sans
 * session : mêmes garanties (identité OF complète bloquante, numéro séquentiel
 * AXI-FACT avec retry P2002, snapshot du régime de TVA, RIB depuis
 * legal_overrides, échéance configurable).
 */
export async function genererFactureLibre(
  input: GenererFactureLibreInput,
): Promise<GenererFactureLibreResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      factureId: "stub",
      numero: "AXI-FACT-0000-000",
      documentId: null,
      chorusProRequis: false,
    };
  }
  if (input.lignes.length === 0) {
    throw new Error("Une facture doit comporter au moins une ligne.");
  }

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: input.clientId },
    select: {
      id: true,
      raisonSociale: true,
      siret: true,
      tvaIntracom: true,
      adresse: true,
      adresseRue: true,
      adresseCodePostal: true,
      adresseVille: true,
      contactEmail: true,
      estPublic: true,
      delaiPaiementJours: true,
    },
  });

  const identite = await getOrganismeIdentite();
  assertOrganismeComplet(identite, "facture");

  // Régime + taux (snapshot) et normalisation TVA par activité.
  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = regimeTvaDepuisConfig(regimeTvaConfig);
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const lignes = normaliserLignesPourActivite(
    input.lignes,
    input.activite,
    regimeTva,
    tauxStandard,
  );
  const totaux = computeTotauxFacture(lignes, regimeTva, tauxStandard);

  // Échéance (délai client — une facture libre n'est pas subrogée) + RIB.
  //
  // 🔴 Vérification E2E 2026-07-26 — le délai propre au client n'était pas lu :
  // F61 posait la colonne et le résolveur, mais aucun émetteur ne les branchait.
  const [delaiGlobal, rib] = await Promise.all([
    getQualiopiConfig("delai_paiement_jours"),
    resolveRibFacture(),
  ]);
  const delaiClient = resoudreConditions(
    {
      delaiPaiementJours: client.delaiPaiementJours ?? null,
      tauxAcomptePct: null,
      modeFacturation: null,
    },
    { delaiPaiementJours: delaiGlobal, tauxAcomptePct: 0, modeFacturation: "acompte_solde" },
  ).delaiPaiementJours;
  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(
    echeance.getDate() + (Number.isFinite(delaiClient) && delaiClient > 0 ? delaiClient : 30),
  );
  const formatDate = (d: Date) => d.toLocaleDateString("fr-FR");

  const destinataireAdresse = adresseClient(client);
  const annee = now.getFullYear();

  let factureCreee: { id: string; numero: string } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 🔴 V20 — borne haute. Boucle de reprise conservée, désormais convergente.
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
          activite: input.activite,
          clientId: client.id,
          ...(input.devisId !== undefined ? { devisId: input.devisId } : {}),
          ...(input.auditMissionId !== undefined ? { auditMissionId: input.auditMissionId } : {}),
          ...(input.refClient !== undefined ? { refClient: input.refClient } : {}),
          destinataire: input.destinataire ?? "entreprise",
          destinataireNom: client.raisonSociale,
          ...(client.siret !== null ? { destinataireSiret: client.siret } : {}),
          ...(client.tvaIntracom !== null ? { destinataireTvaIntracom: client.tvaIntracom } : {}),
          ...(destinataireAdresse !== undefined ? { destinataireAdresse } : {}),
          montantHtCents: totaux.totalHtCents,
          tvaExoneree: totaux.totalTvaCents === 0,
          regimeTva,
          montantTvaCents: totaux.totalTvaCents,
          montantTtcCents: totaux.totalTtcCents,
          lignes: lignes as never,
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
      `[genererFactureLibre] Impossible d'allouer un numéro unique après ${MAX_ATTEMPTS} tentatives.`,
    );
  }

  // PDF APRÈS le create réussi (revue adversariale C2) : élément PRÉ-CONSTRUIT
  // portant le numéro DB de la facture — le numéro du registre DocumentGenere
  // reste interne (jamais affiché). Fail-soft : facture émise sans PDF si le
  // renderer échoue, et aucun DocumentGenere orphelin en cas de retry P2002.
  const factureData: FactureData = {
    numero: factureCreee.numero,
    dateEmission: formatDate(now),
    dateEcheance: formatDate(echeance),
    ...(input.periodePrestation !== undefined
      ? { periodePrestation: input.periodePrestation }
      : {}),
    ...(input.refClient !== undefined ? { refClient: input.refClient } : {}),
    identite,
    regimeTva,
    tauxTvaStandardPercent: tauxStandard,
    client: {
      raisonSociale: client.raisonSociale,
      ...(client.siret !== null ? { siret: client.siret } : {}),
      ...(client.tvaIntracom !== null ? { numeroTvaIntracom: client.tvaIntracom } : {}),
      ...(destinataireAdresse !== undefined ? { adresse: destinataireAdresse } : {}),
      ...(client.contactEmail !== null ? { email: client.contactEmail } : {}),
    },
    lignes,
    ...(rib !== null ? { rib } : {}),
  };
  let documentId: string | null = null;
  try {
    const docResult = await generateDocument({
      type: "facture",
      identite,
      element: React.createElement(FacturePdf, { data: factureData }),
      refs: { clientId: client.id },
    });
    documentId = docResult.id;
    await prisma.factureFormation.update({
      where: { id: factureCreee.id },
      data: { documentId },
    });
  } catch {
    // Fail-soft : la facture reste émise sans PDF si le renderer échoue.
  }

  return {
    factureId: factureCreee.id,
    numero: factureCreee.numero,
    documentId,
    chorusProRequis: client.estPublic,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Avoir
// ─────────────────────────────────────────────────────────────────────────────

export interface GenererAvoirInput {
  factureId: string;
  /** Absent = avoir TOTAL (négation de toutes les lignes). Sinon montant HT partiel. */
  montantPartielHtCents?: number;
  motif: string;
}

export interface GenererAvoirResult {
  avoirId: string;
  numero: string;
  documentId: string | null;
}

/**
 * Émet un avoir (facture rectificative à montants négatifs) lié à la facture
 * d'origine. Une facture émise ne se modifie jamais : l'avoir est LE mécanisme
 * légal de correction. Le régime de TVA de l'ORIGINE est conservé (on rectifie
 * la TVA facturée à l'époque, pas celle d'aujourd'hui).
 */
export async function genererAvoirFacture(input: GenererAvoirInput): Promise<GenererAvoirResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { avoirId: "stub", numero: "AXI-AVO-0000-000", documentId: null };
  }

  const origine = await prisma.factureFormation.findUniqueOrThrow({
    where: { id: input.factureId },
  });

  if (origine.avoirDeId !== null) {
    throw new Error("Impossible d'émettre un avoir sur un avoir.");
  }
  if (origine.statut === "brouillon" || origine.statut === "annulee") {
    throw new Error(
      "Un avoir ne s'émet que sur une facture émise (brouillon → modifier ; annulée → rien à rectifier).",
    );
  }

  // Plafond : Σ avoirs (valeur absolue) ≤ montant HT d'origine.
  const avoirsExistants = await prisma.factureFormation.aggregate({
    where: { avoirDeId: origine.id, statut: { not: "annulee" } },
    _sum: { montantHtCents: true },
  });
  const dejaAvoirHtCents = Math.abs(avoirsExistants._sum.montantHtCents ?? 0);
  const restantHtCents = origine.montantHtCents - dejaAvoirHtCents;
  const demandeHtCents = input.montantPartielHtCents ?? restantHtCents;
  if (demandeHtCents <= 0 || demandeHtCents > restantHtCents) {
    throw new Error(
      `Montant d'avoir invalide : ${demandeHtCents} centimes HT (restant rectifiable : ${restantHtCents}).`,
    );
  }

  // ⛔ PAS `regimeTvaDepuisConfig` ICI, et c'est délibéré (ADR 0050 §7).
  //
  // Un avoir ANNULE une facture : il doit porter le régime de CETTE facture,
  // pas le régime courant. Verrouiller ici émettrait un avoir à 20 % contre une
  // facture exonérée — l'avoir ne l'annulerait plus, et les deux pièces
  // resteraient au registre en se contredisant.
  //
  // « Une facture émise fige son régime » : c'est ce qui la rend opposable, et
  // le verrou de la TVA ne s'applique qu'aux pièces à VENIR.
  const regimeTva: RegimeTva = isRegimeTva(origine.regimeTva)
    ? origine.regimeTva
    : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const lignesOrigine = (origine.lignes ?? []) as unknown as LigneFacture[];

  // Négation intégrale seulement si aucun avoir antérieur (sinon on
  // dépasserait le restant) ; partiel ↔ ligne unique AU TAUX DE LA FACTURE.
  // Garde M6 (revue adversariale) : un partiel sur facture MULTI-taux est
  // refusé — le taux de la rectification serait ambigu (TVA due au Trésor
  // sans contrepartie). L'admin passe par un avoir total, ou par des lignes
  // explicites après avis comptable.
  const negationIntegrale = input.montantPartielHtCents === undefined && dejaAvoirHtCents === 0;
  const tauxEffectifs = new Set(
    lignesOrigine.map((l) => l.tauxTvaPercent ?? (regimeTva === "assujetti" ? tauxStandard : 0)),
  );
  if (!negationIntegrale && tauxEffectifs.size > 1) {
    throw new Error(
      "Avoir partiel impossible sur une facture multi-taux — émettre un avoir total (le taux de la rectification serait ambigu).",
    );
  }
  const tauxUniforme = [...tauxEffectifs][0] ?? 0;
  const lignesAvoir = construireLignesAvoir(
    lignesOrigine,
    negationIntegrale ? undefined : demandeHtCents,
    input.motif,
    tauxUniforme,
  );
  const totaux = computeTotauxFacture(lignesAvoir, regimeTva, tauxStandard);

  const identite = await getOrganismeIdentite();
  assertOrganismeComplet(identite, "facture");
  const rib = await resolveRibFacture();
  const now = new Date();
  const annee = now.getFullYear();
  const formatDate = (d: Date) => d.toLocaleDateString("fr-FR");

  let avoirCree: { id: string; numero: string } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 🔴 V20. `facture` et `avoir` partagent la TABLE `factures_formation` mais
    // ce sont DEUX séries distinctes, discriminées par le préfixe. Partager la
    // table ne partage pas le compteur — c'est précisément l'amalgame qui
    // rendait faux le dénominateur de `actions/qualiopi/financements.ts`.
    const numero = await nextNumero("avoir", annee, (prefixe) =>
      prisma.factureFormation.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    );

    try {
      const avoir = await prisma.factureFormation.create({
        data: {
          numero,
          ...(origine.activite !== null ? { activite: origine.activite } : {}),
          ...(origine.clientId !== null ? { clientId: origine.clientId } : {}),
          ...(origine.refClient !== null ? { refClient: origine.refClient } : {}),
          avoirDeId: origine.id,
          destinataire: origine.destinataire,
          destinataireNom: origine.destinataireNom,
          ...(origine.destinataireSiret !== null
            ? { destinataireSiret: origine.destinataireSiret }
            : {}),
          ...(origine.destinataireTvaIntracom !== null
            ? { destinataireTvaIntracom: origine.destinataireTvaIntracom }
            : {}),
          ...(origine.destinataireAdresse !== null
            ? { destinataireAdresse: origine.destinataireAdresse }
            : {}),
          montantHtCents: totaux.totalHtCents,
          tvaExoneree: totaux.totalTvaCents === 0,
          regimeTva,
          montantTvaCents: totaux.totalTvaCents,
          montantTtcCents: totaux.totalTtcCents,
          lignes: lignesAvoir as never,
          statut: "emise",
          emiseAt: now,
        },
        select: { id: true, numero: true },
      });
      avoirCree = avoir;
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

  if (!avoirCree) {
    throw new Error(
      `[genererAvoirFacture] Impossible d'allouer un numéro unique après ${MAX_ATTEMPTS} tentatives.`,
    );
  }

  // PDF APRÈS le create réussi (revue C2) : numéro DB, jamais celui du registre.
  const factureData: FactureData = {
    numero: avoirCree.numero,
    dateEmission: formatDate(now),
    dateEcheance: formatDate(now),
    identite,
    regimeTva,
    tauxTvaStandardPercent: tauxStandard,
    client: {
      raisonSociale: origine.destinataireNom,
      ...(origine.destinataireSiret !== null ? { siret: origine.destinataireSiret } : {}),
      ...(origine.destinataireTvaIntracom !== null
        ? { numeroTvaIntracom: origine.destinataireTvaIntracom }
        : {}),
      ...(origine.destinataireAdresse !== null ? { adresse: origine.destinataireAdresse } : {}),
    },
    lignes: lignesAvoir,
    ...(origine.refClient !== null ? { refClient: origine.refClient } : {}),
    ...(rib !== null ? { rib } : {}),
    estAvoir: true,
    avoirSurNumero: origine.numero,
    motifAvoir: input.motif,
  };
  let documentId: string | null = null;
  try {
    const docResult = await generateDocument({
      type: "avoir",
      identite,
      element: React.createElement(FacturePdf, { data: factureData }),
      ...(origine.clientId !== null ? { refs: { clientId: origine.clientId } } : {}),
    });
    documentId = docResult.id;
    await prisma.factureFormation.update({
      where: { id: avoirCree.id },
      data: { documentId },
    });
  } catch {
    // Fail-soft : l'avoir reste émis sans PDF si le renderer échoue.
  }

  return { avoirId: avoirCree.id, numero: avoirCree.numero, documentId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Encaissement
// ─────────────────────────────────────────────────────────────────────────────

export type ModePaiementManuel = "manual_wire" | "manual_check" | "manual_cash";

export interface EnregistrerPaiementInput {
  factureId: string;
  montantCents: number;
  paidAt: Date;
  mode: ModePaiementManuel;
  reference?: string;
  notes?: string;
  recordedByAdminId: string;
}

export interface EnregistrerPaiementResult {
  paymentId: string;
  statut: "partiellement_payee" | "payee";
  resteACents: number;
}

const MODE_TO_LOW_LEVEL: Record<ModePaiementManuel, string> = {
  manual_wire: "sepa_credit_transfer",
  manual_check: "cheque",
  manual_cash: "cash",
};

/**
 * Enregistre un encaissement MANUEL (virement/chèque/espèces) sur une facture
 * CRM et recalcule son statut. Paiement partiel accepté. Miroir de
 * `markInvoicePaidManuallyAction` (booking) — même modèle `Payment`, SSOT
 * commun des encaissements.
 */
export async function enregistrerPaiementFacture(
  input: EnregistrerPaiementInput,
): Promise<EnregistrerPaiementResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { paymentId: "stub", statut: "payee", resteACents: 0 };
  }
  if (input.montantCents <= 0) {
    throw new Error("Le montant encaissé doit être strictement positif.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const facture = await tx.factureFormation.findUniqueOrThrow({
      where: { id: input.factureId },
      select: {
        id: true,
        statut: true,
        montantTtcCents: true,
        montantHtCents: true,
        dossierFinancementId: true,
        avoirDeId: true,
      },
    });
    if (facture.statut === "brouillon" || facture.statut === "annulee") {
      throw new Error("Un encaissement ne se saisit que sur une facture émise.");
    }
    if (facture.avoirDeId !== null) {
      throw new Error(
        "Un encaissement ne se saisit pas sur un avoir (le remboursement se gère à part).",
      );
    }

    // Montant dû NET : TTC de la facture MOINS les avoirs émis dessus (revue
    // M3/M4 — une créance éteinte par avoir ne doit plus rien attendre).
    const avoirs = await tx.factureFormation.aggregate({
      where: { avoirDeId: facture.id, statut: { not: "annulee" } },
      _sum: { montantTtcCents: true },
    });
    const avoirsTtcCents = avoirs._sum.montantTtcCents ?? 0; // négatif ou 0

    const payment = await tx.payment.create({
      data: {
        factureFormationId: facture.id,
        provider: input.mode,
        amountCents: input.montantCents,
        currency: "EUR",
        type: "balance",
        status: "succeeded",
        paidAt: input.paidAt,
        ...(input.reference !== undefined ? { receivedReference: input.reference } : {}),
        mode: MODE_TO_LOW_LEVEL[input.mode],
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        recordedByAdminId: input.recordedByAdminId,
      },
      select: { id: true },
    });

    const agg = await tx.payment.aggregate({
      where: { factureFormationId: facture.id, status: "succeeded" },
      _sum: { amountCents: true },
    });
    const totalEncaisse = agg._sum.amountCents ?? 0;
    // Montant dû = TTC net des avoirs (repli HT pour les anciennes factures).
    const montantDu = (facture.montantTtcCents ?? facture.montantHtCents) + avoirsTtcCents;
    const statut = calculerStatutEncaissement(montantDu, totalEncaisse);
    if (statut === "emise") {
      // Défensif : impossible ici (montant > 0 vient d'être encaissé).
      throw new Error("Encaissement non pris en compte.");
    }

    await tx.factureFormation.update({
      where: { id: facture.id },
      data: {
        statut,
        ...(statut === "payee" ? { paidAt: input.paidAt } : {}),
      },
    });

    return {
      paymentId: payment.id,
      statut,
      resteACents: Math.max(0, montantDu - totalEncaisse),
      dossierFinancementId: facture.dossierFinancementId,
    };
  });

  // Pont dossier de financement (best-effort, hors transaction) : quand la
  // facture est soldée et rattachée à un dossier `facture`, celui-ci passe à
  // `paiement_recu` si toutes ses factures sont payées.
  if (result.statut === "payee" && result.dossierFinancementId !== null) {
    await marquerPaiementRecuSiSoldee(result.dossierFinancementId);
  }

  return { paymentId: result.paymentId, statut: result.statut, resteACents: result.resteACents };
}
