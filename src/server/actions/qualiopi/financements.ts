/**
 * Qualiopi — Server Actions Financements + Facturation (T11 + T16).
 *
 * setFinancementSessionAction  : mise à jour des champs financement d'une session.
 * validerAccordOpcoAction      : validation manuelle de l'accord OPCO (opcoStatut→accord_recu).
 * genererFactureFormationAction: génération d'une facture de formation (forfait|horaire).
 * genererFacturePdfAction      : génère (ou régénère) le PDF d'une facture existante et pose
 *                                documentId. Action séparée pour ne pas casser les 50 tests
 *                                existants de genererFactureFormationAction (choix T16 AGENT B :
 *                                action séparée plutôt que câblage direct du service dans l'action
 *                                existante, car les tests mockent prisma.factureFormation.create
 *                                et ne mockent pas facturation-service / generateDocument).
 * setMoyensFormationAction     : mise à jour moyens techniques + ressources pédagogiques.
 * verifierSousTraitantAction   : horodatage de la vérification data.gouv.fr d'un sous-traitant.
 * exportComptaCsvAction        : export CSV comptable des factures d'une année.
 *
 * Pattern : enrollments.ts (requireAdminWrite + logQualiopiActivity + Zod).
 * Toutes les actions imputent refus si validations bloquantes non satisfaites.
 */

"use server";

import React from "react";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { computeVentilationDossier } from "@/server/qualiopi/financements/opco-calcul";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData } from "@/server/qualiopi/documents/templates/facture";
import type {
  FinancementType,
  OpcoStatut,
  FranceTravailDispositif,
  FactureFormationDestinataire,
  PriseEnChargeUnite,
} from "../../../../prisma/generated/client";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const FINANCEMENT_TYPES: readonly FinancementType[] = [
  "direct",
  "opco",
  "cpf",
  "france_travail",
  "mixte",
] as const;

const OPCO_STATUTS: readonly OpcoStatut[] = [
  "non_demande",
  "demande_en_cours",
  "accord_recu",
  "refuse",
  "paiement_recu",
] as const;

const FT_DISPOSITIFS: readonly FranceTravailDispositif[] = ["aif", "poei", "csp"] as const;

const DESTINATAIRES: readonly FactureFormationDestinataire[] = [
  "entreprise",
  "opco",
  "stagiaire",
  "france_travail",
] as const;

const CPF_PAYEUR_VALEURS = ["stagiaire", "employeur", "opco", "france_travail", "exonere"] as const;

const PRISE_EN_CHARGE_UNITES: readonly PriseEnChargeUnite[] = [
  "euro_heure",
  "euro_jour",
  "euro_formation",
  "euro_an_salarie",
] as const;

const setFinancementSessionSchema = z.object({
  sessionId: z.string().uuid(),
  financementType: z.enum(FINANCEMENT_TYPES as [FinancementType, ...FinancementType[]]).optional(),
  opcoStatut: z.enum(OPCO_STATUTS as [OpcoStatut, ...OpcoStatut[]]).optional(),
  opcoSubrogation: z.boolean().optional(),
  numeroDossierOpco: z.string().max(60).optional(),
  ftDispositif: z
    .enum(FT_DISPOSITIFS as [FranceTravailDispositif, ...FranceTravailDispositif[]])
    .optional(),
  cpfPayeurResteCharge: z.enum(CPF_PAYEUR_VALEURS).optional(),
  conventionTripartiteSigneeAt: z.coerce.date().optional(),
  // France Travail POEI — 3 preuves bloquantes avant démarrage (R3 audit 2026-06-06)
  ftPoeiOffreEmploiNumero: z.string().max(60).optional(),
  ftPoeiAccordFinancementAt: z.coerce.date().optional(),
  ftPoeiEngagementSigneAt: z.coerce.date().optional(),
});

const validerAccordOpcoSchema = z.object({
  sessionId: z.string().uuid(),
});

const genererFactureFormationSchema = z.object({
  sessionId: z.string().uuid(),
  destinataire: z.enum(
    DESTINATAIRES as [FactureFormationDestinataire, ...FactureFormationDestinataire[]],
  ),
  ventilation: z.enum(["forfait", "horaire"]),
});

const setMoyensFormationSchema = z.object({
  formationId: z.string().uuid(),
  moyensTechniques: z.string().optional(),
  ressourcesPedagogiques: z.unknown().optional(),
});

const verifierSousTraitantSchema = z.object({
  trainerId: z.string().uuid(),
  sousTraitantNda: z.string().max(20),
});

const exportComptaCsvSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
});

const setPriseEnChargeSchema = z.object({
  sessionId: z.string().uuid(),
  montantCents: z.number().int().min(0),
  unite: z.enum(PRISE_EN_CHARGE_UNITES as [PriseEnChargeUnite, ...PriseEnChargeUnite[]]),
  plafondFormationCents: z.number().int().min(0).optional(),
  plafondAnnuelCents: z.number().int().min(0).optional(),
  sourceUrl: z.string().url().max(2048).optional(),
  releveLe: z.coerce.date().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un numéro séquentiel de facture : AXI-FACT-YYYY-NNN.
 * Lit le nombre de factures existantes pour l'année courante.
 */
async function genererNumeroFacture(annee: number): Promise<string> {
  const debut = new Date(`${annee}-01-01T00:00:00.000Z`);
  const fin = new Date(`${annee + 1}-01-01T00:00:00.000Z`);
  const count = await prisma.factureFormation.count({
    where: {
      createdAt: { gte: debut, lt: fin },
    },
  });
  const seq = String(count + 1).padStart(3, "0");
  return `AXI-FACT-${annee}-${seq}`;
}

/**
 * Calcule les lignes de ventilation forfait (1 ligne globale).
 */
function computeForfait(montantHtCents: number): {
  lignes: Array<{ designation: string; quantite: number; prixUnitaireHtCents: number }>;
  totalHtCents: number;
} {
  return {
    lignes: [
      {
        designation: "Formation professionnelle — forfait",
        quantite: 1,
        prixUnitaireHtCents: montantHtCents,
      },
    ],
    totalHtCents: montantHtCents,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Met à jour les champs financement d'une session (type, OPCO, CPF, FT).
 */
export async function setFinancementSessionAction(input: {
  sessionId: string;
  financementType?: FinancementType;
  opcoStatut?: OpcoStatut;
  opcoSubrogation?: boolean;
  numeroDossierOpco?: string;
  ftDispositif?: FranceTravailDispositif;
  cpfPayeurResteCharge?: string;
  conventionTripartiteSigneeAt?: Date;
  ftPoeiOffreEmploiNumero?: string;
  ftPoeiAccordFinancementAt?: Date;
  ftPoeiEngagementSigneAt?: Date;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setFinancementSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, ...fields } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (fields.financementType !== undefined) updateData.financementType = fields.financementType;
  if (fields.opcoStatut !== undefined) updateData.opcoStatut = fields.opcoStatut;
  if (fields.opcoSubrogation !== undefined) updateData.opcoSubrogation = fields.opcoSubrogation;
  if (fields.numeroDossierOpco !== undefined)
    updateData.numeroDossierOpco = fields.numeroDossierOpco;
  if (fields.ftDispositif !== undefined) updateData.ftDispositif = fields.ftDispositif;
  if (fields.cpfPayeurResteCharge !== undefined)
    updateData.cpfPayeurResteCharge = fields.cpfPayeurResteCharge;
  if (fields.conventionTripartiteSigneeAt !== undefined)
    updateData.conventionTripartiteSigneeAt = fields.conventionTripartiteSigneeAt;
  if (fields.ftPoeiOffreEmploiNumero !== undefined)
    updateData.ftPoeiOffreEmploiNumero = fields.ftPoeiOffreEmploiNumero;
  if (fields.ftPoeiAccordFinancementAt !== undefined)
    updateData.ftPoeiAccordFinancementAt = fields.ftPoeiAccordFinancementAt;
  if (fields.ftPoeiEngagementSigneAt !== undefined)
    updateData.ftPoeiEngagementSigneAt = fields.ftPoeiEngagementSigneAt;

  if (Object.keys(updateData).length === 0) return { error: "Aucun champ à mettre à jour" };

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: updateData as Parameters<typeof prisma.trainingSession.update>[0]["data"],
  });

  await logQualiopiActivity({
    action: "qualiopi.financement.set",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: updateData,
    session,
  });

  return { data: { id: sessionId } };
}

/**
 * Valide manuellement l'accord OPCO (opcoStatut → accord_recu).
 * Exige que financementType=opco.
 */
export async function validerAccordOpcoAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ id: string }>> {
  const adminSession = await requireAdminWrite();
  const parsed = validerAccordOpcoSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const existing = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { financementType: true, opcoStatut: true },
  });
  if (!existing) return { error: "Session introuvable" };
  if (existing.financementType !== "opco" && existing.financementType !== "mixte") {
    return { error: "La session n'est pas financée par OPCO" };
  }

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { opcoStatut: "accord_recu" },
  });

  await logQualiopiActivity({
    action: "qualiopi.financement.opco.accord_recu",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { opcoStatut: "accord_recu" },
    session: adminSession,
  });

  return { data: { id: sessionId } };
}

/**
 * Génère une facture de formation (forfait | horaire).
 *
 * Valide les bloquants avant création :
 * - OPCO+subrogation → numeroDossierOpco obligatoire.
 * - CPF → edofVerifieAt non-null.
 * - OPCO → opcoStatut=accord_recu.
 *
 * TVA exonérée art. 261-4-4° CGI.
 */
export async function genererFactureFormationAction(input: {
  sessionId: string;
  destinataire: FactureFormationDestinataire;
  ventilation: "forfait" | "horaire";
}): Promise<ActionResult<{ factureId: string; numero: string; documentId: string | null }>> {
  const adminSession = await requireAdminWrite();

  // Stub-aware : build-time, aucune facture ne doit être créée
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return { error: "Génération désactivée en mode build (stub)" };
  }

  const parsed = genererFactureFormationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, destinataire, ventilation } = parsed.data;

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      financementType: true,
      opcoStatut: true,
      opcoSubrogation: true,
      numeroDossierOpco: true,
      edofVerifieAt: true,
      montantHtCents: true,
      dureeReelleHeures: true,
      nbParticipantsReels: true,
      nbParticipantsPrevus: true,
      modalite: true,
      titreSession: true,
      numero: true,
      // Barème prise en charge (T18)
      priseEnChargeMontantCents: true,
      priseEnChargeUnite: true,
      priseEnChargePlafondFormationCents: true,
      priseEnChargePlafondAnnuelCents: true,
      client: { select: { raisonSociale: true } },
    },
  });
  if (!trainingSession) return { error: "Session introuvable" };

  // ── Validations bloquantes ────────────────────────────────────────────────

  // OPCO accord BLOQUANT
  if (
    (trainingSession.financementType === "opco" || trainingSession.financementType === "mixte") &&
    trainingSession.opcoStatut !== "accord_recu" &&
    trainingSession.opcoStatut !== "paiement_recu"
  ) {
    return {
      error:
        "Accord OPCO non reçu — impossible de générer la facture. Validez l'accord OPCO d'abord.",
    };
  }

  // Subrogation : numeroDossierOpco obligatoire
  if (trainingSession.opcoSubrogation && !trainingSession.numeroDossierOpco) {
    return {
      error:
        "Subrogation OPCO activée mais le numéro de dossier OPCO est absent. Renseignez-le avant de facturer.",
    };
  }

  // CPF : vérification EDOF obligatoire
  if (trainingSession.financementType === "cpf" && !trainingSession.edofVerifieAt) {
    return {
      error: "Financement CPF sans vérification EDOF. Vérifiez le dossier EDOF avant de facturer.",
    };
  }

  // ── Calcul des lignes ─────────────────────────────────────────────────────

  let lignes: Array<{ designation: string; quantite: number; prixUnitaireHtCents: number }>;
  let totalHtCents: number;

  if (ventilation === "forfait") {
    const result = computeForfait(trainingSession.montantHtCents);
    lignes = result.lignes;
    totalHtCents = result.totalHtCents;
  } else {
    // Ventilation horaire — barème saisi sur le dossier (T18)
    const dureeHeures = trainingSession.dureeReelleHeures ?? 0;
    const nbParticipants =
      trainingSession.nbParticipantsReels ?? trainingSession.nbParticipantsPrevus;
    // Durée réelle obligatoire
    if (dureeHeures === 0) {
      return {
        error:
          "Durée réelle non renseignée — impossible de calculer la ventilation horaire. Renseignez la durée réelle de la session.",
      };
    }
    // Barème de prise en charge obligatoire
    if (
      trainingSession.priseEnChargeMontantCents == null ||
      trainingSession.priseEnChargeUnite == null
    ) {
      return {
        error:
          "Barème de prise en charge non renseigné sur le dossier — à relever sur le portail OPCO de la branche du client.",
      };
    }
    const result = computeVentilationDossier({
      unite: trainingSession.priseEnChargeUnite,
      montantCents: trainingSession.priseEnChargeMontantCents,
      dureeHeures,
      nbParticipants,
      ...(trainingSession.priseEnChargePlafondFormationCents != null
        ? { plafondFormationCents: trainingSession.priseEnChargePlafondFormationCents }
        : {}),
      ...(trainingSession.priseEnChargePlafondAnnuelCents != null
        ? { plafondAnnuelCents: trainingSession.priseEnChargePlafondAnnuelCents }
        : {}),
    });
    lignes = result.lignes;
    totalHtCents = result.totalHtCents;
  }

  // ── Destinataire : subrogation → OPCO ────────────────────────────────────
  const destinataireEffectif: FactureFormationDestinataire = trainingSession.opcoSubrogation
    ? "opco"
    : destinataire;

  // ── Numéro séquentiel + création atomique ─────────────────────────────────
  // R7 : `genererNumeroFacture` est un `count+1` ; sous création concurrente deux
  // factures peuvent lire le même count → même numéro. La contrainte @unique sur
  // `numero` rejette le doublon (P2002) ; `withNumberRetry` ré-alloue et réessaie.
  // L'allocation DOIT être DANS la closure pour être recalculée à chaque tentative.
  const annee = new Date().getFullYear();
  const facture = await withNumberRetry(async () => {
    const numero = await genererNumeroFacture(annee);
    return prisma.factureFormation.create({
      data: {
        numero,
        sessionId,
        destinataire: destinataireEffectif,
        destinataireNom: trainingSession.titreSession,
        montantHtCents: totalHtCents,
        tvaExoneree: true,
        lignes: lignes as never,
        subrogation: trainingSession.opcoSubrogation,
        numeroDossierOpco: trainingSession.opcoSubrogation
          ? (trainingSession.numeroDossierOpco ?? null)
          : null,
        statut: "emise",
        emiseAt: new Date(),
      },
      select: { id: true, numero: true, documentId: true },
    });
  });

  await logQualiopiActivity({
    action: "qualiopi.facture.generer",
    targetType: "FactureFormation",
    targetId: facture.id,
    changes: {
      sessionId,
      numero: facture.numero,
      destinataire: destinataireEffectif,
      ventilation,
      totalHtCents,
    },
    session: adminSession,
  });

  return {
    data: {
      factureId: facture.id,
      numero: facture.numero,
      documentId: facture.documentId,
    },
  };
}

/**
 * Met à jour les moyens techniques + ressources pédagogiques d'une formation.
 */
export async function setMoyensFormationAction(input: {
  formationId: string;
  moyensTechniques?: string;
  ressourcesPedagogiques?: unknown;
}): Promise<ActionResult<{ id: string }>> {
  const adminSession = await requireAdminWrite();
  const parsed = setMoyensFormationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { formationId, ...fields } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (fields.moyensTechniques !== undefined) updateData.moyensTechniques = fields.moyensTechniques;
  if (fields.ressourcesPedagogiques !== undefined)
    updateData.ressourcesPedagogiques = fields.ressourcesPedagogiques as never;

  if (Object.keys(updateData).length === 0) return { error: "Aucun champ à mettre à jour" };

  await prisma.formation.update({
    where: { id: formationId },
    data: updateData as Parameters<typeof prisma.formation.update>[0]["data"],
  });

  await logQualiopiActivity({
    action: "qualiopi.formation.moyens.set",
    targetType: "Formation",
    targetId: formationId,
    changes: Object.keys(updateData),
    session: adminSession,
  });

  return { data: { id: formationId } };
}

/**
 * Horodate la vérification data.gouv.fr d'un formateur sous-traitant.
 * Pose sousTraitantVerifieAt=now + enregistre le NDA.
 */
export async function verifierSousTraitantAction(input: {
  trainerId: string;
  sousTraitantNda: string;
}): Promise<ActionResult<{ id: string }>> {
  const adminSession = await requireAdminWrite();
  const parsed = verifierSousTraitantSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { trainerId, sousTraitantNda } = parsed.data;

  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      sousTraitantNda,
      sousTraitantVerifieAt: new Date(),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.trainer.sous_traitant.verifie",
    targetType: "Trainer",
    targetId: trainerId,
    changes: { sousTraitantNda, verifiedAt: new Date().toISOString() },
    session: adminSession,
  });

  return { data: { id: trainerId } };
}

// ─────────────────────────────────────────────────────────────────────────────
// genererFacturePdfAction (T16 — réconcile dette PDF)
// ─────────────────────────────────────────────────────────────────────────────

const genererFacturePdfSchema = z.object({
  factureId: z.string().uuid(),
});

/**
 * Génère (ou régénère) le PDF d'une FactureFormation existante, puis stocke
 * documentId sur la facture.
 *
 * Choix T16 : action séparée (ne modifie pas genererFactureFormationAction) pour
 * préserver les 50 tests existants qui mockent prisma.factureFormation.create
 * et s'attendent à documentId=null.
 *
 * Stub-aware : retourne un résultat minimal sans appel DB si build stub.invalid.
 * Fail-soft : si le renderer PDF échoue, retourne { error } sans crasher.
 */
export async function genererFacturePdfAction(input: {
  factureId: string;
}): Promise<ActionResult<{ factureId: string; documentId: string }>> {
  const adminSession = await requireAdminWrite();

  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return { error: "Génération PDF désactivée en mode build (stub)" };
  }

  const parsed = genererFacturePdfSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { factureId } = parsed.data;

  // Chargement de la facture avec les données nécessaires pour reconstruire le PDF
  const facture = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: {
      id: true,
      numero: true,
      destinataireNom: true,
      destinataireSiret: true,
      destinataireAdresse: true,
      montantHtCents: true,
      lignes: true,
      subrogation: true,
      numeroDossierOpco: true,
      emiseAt: true,
      echeanceAt: true,
      sessionId: true,
    },
  });
  if (!facture) return { error: "Facture introuvable" };

  // Reconstruction de FactureData pour le renderer
  const identite = await getOrganismeIdentite();

  const formatDate = (d: Date | null | undefined): string =>
    d ? d.toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR");

  const echeance =
    facture.echeanceAt ??
    (() => {
      const d = new Date(facture.emiseAt ?? new Date());
      d.setDate(d.getDate() + 30);
      return d;
    })();

  const lignes = (Array.isArray(facture.lignes) ? facture.lignes : []) as Array<{
    designation: string;
    quantite: number;
    prixUnitaireHtCents: number;
  }>;

  const factureData: FactureData = {
    numero: facture.numero,
    dateEmission: formatDate(facture.emiseAt),
    dateEcheance: formatDate(echeance),
    identite,
    client: {
      raisonSociale: facture.destinataireNom,
      ...(facture.destinataireSiret !== null && facture.destinataireSiret !== undefined
        ? { siret: facture.destinataireSiret }
        : {}),
      ...(facture.destinataireAdresse !== null && facture.destinataireAdresse !== undefined
        ? { adresse: facture.destinataireAdresse }
        : {}),
    },
    lignes,
    ...(facture.subrogation &&
    facture.numeroDossierOpco !== null &&
    facture.numeroDossierOpco !== undefined
      ? {
          subrogationOpco: {
            nomOpco: facture.destinataireNom,
            numeroDossier: facture.numeroDossierOpco,
          },
        }
      : {}),
  };

  // Génération PDF via le service central.
  // buildElement injecte le numéro DocumentGenere alloué dans l'en-tête.
  // Note : facture.numero (FactureFormation) et DocumentGenere.numero sont
  // deux séquences distinctes ; l'en-tête affiche le numéro du document
  // officiel (DocumentGenere) pour la traçabilité registre.
  let documentId: string;
  try {
    const docResult = await generateDocument({
      type: "facture",
      buildElement: (numero) =>
        React.createElement(FacturePdf, { data: { ...factureData, numero } }),
      refs: facture.sessionId != null ? { sessionId: facture.sessionId } : {},
    });
    documentId = docResult.id;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de génération PDF";
    return { error: `PDF non généré : ${msg}` };
  }

  // Mise à jour de la facture avec documentId
  await prisma.factureFormation.update({
    where: { id: factureId },
    data: { documentId },
  });

  await logQualiopiActivity({
    action: "qualiopi.facture.pdf.generer",
    targetType: "FactureFormation",
    targetId: factureId,
    changes: { documentId },
    session: adminSession,
  });

  return { data: { factureId, documentId } };
}

// ─────────────────────────────────────────────────────────────────────────────
// setPriseEnChargeAction (T18 — barème OPCO par dossier)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre le barème de prise en charge OPCO relevé sur le portail de la
 * branche du client, pour ce dossier/session précis.
 *
 * Tous les montants sont en centimes (conversion euros → centimes dans le form).
 */
export async function setPriseEnChargeAction(input: {
  sessionId: string;
  montantCents: number;
  unite: PriseEnChargeUnite;
  plafondFormationCents?: number;
  plafondAnnuelCents?: number;
  sourceUrl?: string;
  releveLe?: Date;
}): Promise<ActionResult<{ id: string }>> {
  const adminSession = await requireAdminWrite();
  const parsed = setPriseEnChargeSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const {
    sessionId,
    montantCents,
    unite,
    plafondFormationCents,
    plafondAnnuelCents,
    sourceUrl,
    releveLe,
  } = parsed.data;

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      priseEnChargeMontantCents: montantCents,
      priseEnChargeUnite: unite,
      ...(plafondFormationCents !== undefined
        ? { priseEnChargePlafondFormationCents: plafondFormationCents }
        : {}),
      ...(plafondAnnuelCents !== undefined
        ? { priseEnChargePlafondAnnuelCents: plafondAnnuelCents }
        : {}),
      ...(sourceUrl !== undefined ? { priseEnChargeSourceUrl: sourceUrl } : {}),
      ...(releveLe !== undefined ? { priseEnChargeReleveLe: releveLe } : {}),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.financement.prise_en_charge.set",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { montantCents, unite, plafondFormationCents, plafondAnnuelCents, sourceUrl },
    session: adminSession,
  });

  return { data: { id: sessionId } };
}

// ─────────────────────────────────────────────────────────────────────────────
// exportComptaCsvAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exporte les factures de formation d'une année au format CSV comptable.
 * CSV séparateur `;` (convention FR).
 */
export async function exportComptaCsvAction(input: {
  annee: number;
}): Promise<ActionResult<{ csv: string; filename: string }>> {
  const adminSession = await requireAdminWrite();
  const parsed = exportComptaCsvSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { annee } = parsed.data;

  const debut = new Date(`${annee}-01-01T00:00:00.000Z`);
  const fin = new Date(`${annee + 1}-01-01T00:00:00.000Z`);

  const factures = await prisma.factureFormation.findMany({
    where: { createdAt: { gte: debut, lt: fin } },
    select: {
      numero: true,
      emiseAt: true,
      destinataire: true,
      destinataireNom: true,
      montantHtCents: true,
      tvaExoneree: true,
      statut: true,
      session: { select: { numero: true, titreSession: true } },
    },
    orderBy: { emiseAt: "asc" },
  });

  const DEST_LABELS: Record<string, string> = {
    entreprise: "Entreprise",
    opco: "OPCO",
    stagiaire: "Stagiaire",
    france_travail: "France Travail",
  };

  const STATUT_LABELS: Record<string, string> = {
    brouillon: "Brouillon",
    emise: "Émise",
    payee: "Payée",
    annulee: "Annulée",
  };

  const header = [
    "Numéro facture",
    "Date émission",
    "Session",
    "Titre session",
    "Destinataire type",
    "Destinataire nom",
    "Montant HT (€)",
    "TVA",
    "Statut",
  ].join(";");

  const rows = factures.map((f) => {
    const dateEmission = f.emiseAt ? f.emiseAt.toLocaleDateString("fr-FR") : "";
    const montantHt = (f.montantHtCents / 100).toFixed(2).replace(".", ",");
    const tva = f.tvaExoneree ? "Exonérée (261-4-4° CGI)" : "20%";
    return [
      f.numero,
      dateEmission,
      f.session?.numero ?? "",
      `"${(f.session?.titreSession ?? "Coaching 1-to-1").replace(/"/g, '""')}"`,
      DEST_LABELS[f.destinataire] ?? f.destinataire,
      `"${f.destinataireNom.replace(/"/g, '""')}"`,
      montantHt,
      tva,
      STATUT_LABELS[f.statut] ?? f.statut,
    ].join(";");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `axion-ia-factures-formation-${annee}.csv`;

  await logQualiopiActivity({
    action: "qualiopi.compta.csv.export",
    targetType: "FactureFormation",
    changes: { annee, nbFactures: factures.length },
    session: adminSession,
  });

  return { data: { csv, filename } };
}
