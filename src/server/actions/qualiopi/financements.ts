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

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAdminWrite,
  requireHabilitation,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  countLockingSessions,
  appendVersionEntry,
  bumpProgrammeVersion,
  LOCKED_BY_SESSION_ERROR,
  type FormationVersionEntry,
} from "@/server/qualiopi/formations/edit-guard";
import {
  emettreFactureFormationSession,
  genererPdfFactureFormation,
} from "@/server/qualiopi/financements/facture-formation-emission";
import { creerDossierDepuisSession } from "@/server/qualiopi/financements/dossier-financement";
import { changementOuvreUnDossier } from "@/server/qualiopi/financements/dossier-auto";
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

  // 🔴 COHÉRENCE type de client × dispositif de financement — garde SERVEUR.
  //
  // Aucune validation croisée n'existait : rien n'interdisait un CPF sur une
  // entreprise ni un OPCO sur un particulier. Les formulaires masquent, la
  // Server Action acceptait — et un dispositif incohérent ne se voit qu'au
  // refus du financeur, des semaines plus tard, quand la formation a eu lieu.
  //
  // Deux contradictions seulement, celles qui ne souffrent aucune exception :
  //   · le CPF est le compte d'une PERSONNE. Une personne morale n'en a pas.
  //   · un OPCO finance l'obligation de formation d'un EMPLOYEUR. Un particulier
  //     qui se forme à titre individuel n'en relève d'aucun.
  //
  // ⚠️ `france_travail` n'est PAS restreint : un demandeur d'emploi est un
  // particulier, mais un employeur peut aussi monter une POEI. `mixte` et
  // `direct` non plus. Une garde qui refuserait un cas légitime serait pire que
  // l'absence de garde — on la contournerait, et elle finirait désarmée.
  if (fields.financementType === "cpf" || fields.financementType === "opco") {
    const avecClient = await prisma.trainingSession
      .findUnique({ where: { id: sessionId }, select: { client: { select: { type: true } } } })
      .catch(() => null);
    const typeClient = avecClient?.client?.type ?? null;

    if (fields.financementType === "cpf" && typeClient === "entreprise") {
      return {
        error:
          "Financement refusé : le CPF est le compte personnel d'un stagiaire, une personne morale n'en dispose pas. " +
          "Pour une entreprise, choisissez OPCO ou financement direct.",
      };
    }
    if (fields.financementType === "opco" && typeClient === "particulier") {
      return {
        error:
          "Financement refusé : un OPCO finance l'obligation de formation d'un employeur — un particulier n'en relève pas. " +
          "Pour un particulier, choisissez CPF, France Travail ou financement direct.",
      };
    }
  }

  // Le financement AVANT écriture : c'est lui qui dit si ce changement fait
  // ENTRER la session dans le périmètre suivi (cf. `changementOuvreUnDossier`).
  // Lu ici, pas après : après, il est déjà écrasé.
  const avant = await prisma.trainingSession
    .findUnique({ where: { id: sessionId }, select: { financementType: true } })
    .catch(() => null);

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

  // ── 🔴 SOUS-LOT 8C — le dossier de financement s'ouvre TOUT SEUL ──────────
  //
  // Il n'avait qu'un appelant : un bouton. Vérifié en production, **zéro
  // dossier n'existait** — donc aucune alerte de suivi financeur, aucune ligne
  // au cockpit, pour aucune affaire. Le suivi OPCO était éteint sans que rien
  // ne le dise.
  //
  // 🔑 Pourquoi il est légitime d'automatiser ICI alors que le bouton manuel
  // est gardé par `deposer_demande_financeur` : ce n'est pas le même acte.
  // Ouvrir le dossier (`a_monter`) est un classeur vide qui ne parle à
  // personne ; DÉPOSER la demande (`a_monter → envoye`) engage l'organisme au
  // nom du client et reste le clic habilité qu'il a toujours été.
  // Produire ≠ remettre.
  //
  // Fail-soft, et c'est délibéré : le financement de la session vient d'être
  // enregistré. Faire échouer l'action parce que la vue de PILOTAGE n'a pas pu
  // s'ouvrir perdrait la donnée métier au profit de son tableau de bord.
  // L'échec est journalisé, et le bouton manuel reste le rattrapage.
  if (changementOuvreUnDossier(avant?.financementType, fields.financementType)) {
    try {
      const dossier = await creerDossierDepuisSession(sessionId);
      await logQualiopiActivity({
        action: "qualiopi.dossier_financement.ouvert_auto",
        targetType: "DossierFinancement",
        targetId: dossier.id,
        changes: { sessionId, financementType: fields.financementType, statut: "a_monter" },
        session,
      });
    } catch (err) {
      console.error("[financements] ouverture auto du dossier impossible", {
        sessionId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { data: { id: sessionId } };
}

/**
 * Valide manuellement l'accord OPCO (opcoStatut → accord_recu).
 * Exige que financementType=opco.
 */
export async function validerAccordOpcoAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ id: string }>> {
  // Acte ENGAGEANT : acter l'accord OPCO conditionne la facturation subrogee.
  const adminSession = await requireHabilitation("deposer_demande_financeur");
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
 * TVA : régime dérivé de la config (`regime_tva`, défaut assujetti — cf.
 * legal/tva.ts) ; `tvaExoneree` est calculé (`totalTvaCents === 0`), jamais posé
 * d'office.
 */
export async function genererFactureFormationAction(input: {
  sessionId: string;
  destinataire: FactureFormationDestinataire;
  ventilation: "forfait" | "horaire";
}): Promise<ActionResult<{ factureId: string; numero: string; documentId: string | null }>> {
  // Acte ENGAGEANT : facture de formation : numerotation legale, TVA.
  const adminSession = await requireHabilitation("facturer");

  // Stub-aware : build-time, aucune facture ne doit être créée
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return { error: "Génération désactivée en mode build (stub)" };
  }

  const parsed = genererFactureFormationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, destinataire, ventilation } = parsed.data;

  // 🔑 Le corps vit dans un service PUR, partagé avec la génération automatique
  // du lendemain de session (cron du worker, hors Next). Cf. l'en-tête de
  // `facture-formation-emission.ts`.
  const resultat = await emettreFactureFormationSession({ sessionId, destinataire, ventilation });
  if ("error" in resultat) return resultat;
  const facture = resultat.data;

  await logQualiopiActivity({
    action: "qualiopi.facture.generer",
    targetType: "FactureFormation",
    targetId: facture.factureId,
    changes: {
      sessionId,
      numero: facture.numero,
      destinataire: facture.destinataire,
      ventilation: facture.ventilation,
      totalHtCents: facture.totalHtCents,
    },
    session: adminSession,
  });

  return {
    data: {
      factureId: facture.factureId,
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

  // Gardes de conformité (WS4) : moyens/ressources sont du contenu pédagogique
  // rendu dans les conventions/programmes → mêmes gardes que updateFormationAction.
  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    select: {
      id: true,
      statutGeneration: true,
      validatedBy: true,
      versionProgramme: true,
      versionHistorique: true,
    },
  });
  if (!formation) return { error: "Formation introuvable" };

  if ((await countLockingSessions(prisma, formationId)) > 0) {
    return { error: LOCKED_BY_SESSION_ERROR };
  }

  const wasValidated = formation.validatedBy !== null;
  const wasPublished = formation.statutGeneration === "publie";
  const requiresRevalidation = wasValidated || wasPublished;
  const nextVersion = bumpProgrammeVersion(formation.versionProgramme);
  const entry: FormationVersionEntry = {
    version: nextVersion,
    at: new Date().toISOString(),
    by: adminSession.userId,
    action: "update",
    fields: Object.keys(updateData),
    ...(requiresRevalidation ? { revalidationRequired: true } : {}),
  };

  await prisma.formation.update({
    where: { id: formationId },
    data: {
      ...updateData,
      versionProgramme: nextVersion,
      versionHistorique: appendVersionEntry(formation.versionHistorique, entry) as never,
      ...(wasValidated ? { validatedBy: null, validatedAt: null } : {}),
      ...(wasPublished ? { statutGeneration: "assemble" } : {}),
    } as Parameters<typeof prisma.formation.update>[0]["data"],
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
  // Acte ENGAGEANT : lever la reserve d'un sous-traitant l'autorise a animer.
  const adminSession = await requireHabilitation("habiliter_formateur");
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

  const resultat = await genererPdfFactureFormation(factureId);
  if ("error" in resultat) return resultat;
  const { documentId } = resultat.data;

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
      regimeTva: true,
      montantTvaCents: true,
      montantTtcCents: true,
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

  const REGIME_TVA_CSV: Record<string, string> = {
    assujetti: "Assujetti (20 %)",
    exoneration_261: "Exonération formation (261-4-4° CGI)",
    franchise_293b: "Franchise en base (293 B CGI)",
  };

  const header = [
    "Numéro facture",
    "Date émission",
    "Session",
    "Titre session",
    "Destinataire type",
    "Destinataire nom",
    "Montant HT (€)",
    "Régime TVA",
    "Montant TVA (€)",
    "Montant TTC (€)",
    "Statut",
  ].join(";");

  const eurosFmt = (cents: number): string => (cents / 100).toFixed(2).replace(".", ",");

  const rows = factures.map((f) => {
    const dateEmission = f.emiseAt ? f.emiseAt.toLocaleDateString("fr-FR") : "";
    const tvaCents = f.montantTvaCents ?? 0;
    const ttcCents = f.montantTtcCents ?? f.montantHtCents + tvaCents;
    const regimeLabel = REGIME_TVA_CSV[f.regimeTva] ?? (f.tvaExoneree ? "Exonérée" : "Assujetti");
    return [
      f.numero,
      dateEmission,
      f.session?.numero ?? "",
      `"${(f.session?.titreSession ?? "Coaching 1-to-1").replace(/"/g, '""')}"`,
      DEST_LABELS[f.destinataire] ?? f.destinataire,
      `"${f.destinataireNom.replace(/"/g, '""')}"`,
      eurosFmt(f.montantHtCents),
      regimeLabel,
      eurosFmt(tvaCents),
      eurosFmt(ttcCents),
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
