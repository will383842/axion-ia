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
import {
  requireAdminWrite,
  requireHabilitation,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import { computeVentilationDossier } from "@/server/qualiopi/financements/opco-calcul";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { champsIdentiteManquants } from "@/server/qualiopi/documents/conformite";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  countLockingSessions,
  appendVersionEntry,
  bumpProgrammeVersion,
  LOCKED_BY_SESSION_ERROR,
  type FormationVersionEntry,
} from "@/server/qualiopi/formations/edit-guard";
import {
  computeTotauxFacture,
  isRegimeTva,
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import {
  resoudreDestinataireFacture,
  destinataireEstPersonnePhysique,
  CLIENT_FACTURABLE_SELECT,
} from "@/server/qualiopi/financements/destinataire-facture";
import { DELAI_PAIEMENT_DEFAUT_JOURS } from "@/server/qualiopi/financements/conditions-client";
import { choisirCreancePourFacture } from "@/server/qualiopi/financements/facture-par-creance";
import { creerDossierDepuisSession } from "@/server/qualiopi/financements/dossier-financement";
import { changementOuvreUnDossier } from "@/server/qualiopi/financements/dossier-auto";
import { resolveRibFacture } from "@/lib/legal-identity";
import { periodePrestationSession } from "@/server/qualiopi/financements/periode-prestation";
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
 * Alloue le prochain numéro de la série légale des factures (`AXI-FACT-YYYY-NNN`).
 *
 * 🔴 Audit certification 2026-07-26 (V20, étape 0). Ce compteur portait sur
 * `createdAt` — « toutes les lignes de `factures_formation` créées dans l'année ».
 * Or cette table n'héberge pas UNE série mais QUATRE :
 *   - la série légale des factures (préfixe `NUMBERING_PREFIX.facture`), celle-ci ;
 *   - les AVOIRS (`facture-libre.ts`, `avoirDeId` non nul) : série légale
 *     DISTINCTE, avec son propre compteur préfixé `AXI-AVO-` ;
 *   - les brouillons de plan récurrent (`BROUILLON-<uuid>`, `plan-recurrent.ts`) :
 *     numéro provisoire jusqu'au clic d'émission ;
 *   - les reprises d'historique (`estImportee`), que le schéma qualifie lui-même
 *     de « hors séquence AXI-FACT », et dont le `createdAt` est la date d'IMPORT
 *     et non la date d'émission.
 *
 * Compter par `createdAt` additionne les quatre. Deux clics suffisent : une
 * facture émise, puis un avoir, et l'appel suivant compte 2 lignes et saute au
 * n° 003. Le 002 n'existera jamais — rupture de la séquence chronologique
 * continue exigée par l'art. 242 nonies A ann. II du CGI. Et comme les cinq
 * autres allocateurs de la MÊME série (facturation-service, facture-libre,
 * plan-recurrent, factures-inter, facturation-1to1) comptent, eux, par PRÉFIXE,
 * les deux dénominateurs dérivent l'un de l'autre et finissent par réémettre un
 * numéro déjà porté par une pièce comptable (P2002 sur un registre légal).
 *
 * Second piège, celui qu'aucun retry ne rattrape : un brouillon de plan récurrent
 * créé en décembre et émis en janvier porte un `createdAt` en N-1 et un numéro en
 * N. Le compteur `createdAt` de l'année N ne le voit JAMAIS → il réalloue
 * indéfiniment le même numéro, `withNumberRetry` recalcule la même valeur à chaque
 * tentative, cinq P2002 d'affilée, échec dur, aucune facture émise.
 *
 * On aligne donc sur le prédicat préfixé des cinq autres allocateurs. Le préfixe
 * de comptage et le préfixe d'écriture sont dérivés de la MÊME constante : c'est
 * la divergence entre deux littéraux recopiés à la main qui a produit F63, puis
 * V12. Ne pas réintroduire de littéral ici.
 *
 * ⚠️ Ceci n'est PAS le compteur définitif, et V20 n'est PAS refermé. `count + 1`
 * reste faux en cas de SUPPRESSION d'une pièce : le compteur recule et réattribue
 * un numéro déjà utilisé sans violer l'unicité, puisque la ligne a disparu — or
 * l'art. 242 nonies A interdit le réemploi. C'est l'objet de L7 (`allocateNumero`
 * sous verrou transactionnel, `MAX(seq) + 1`). L'étape 0 ne corrige QUE le
 * DÉNOMINATEUR, et elle se fait maintenant parce que la table est vide (vérifié en
 * production : `SELECT count(*) FROM factures_formation` = 0) : la fenêtre de
 * correction sans reprise de données se referme à la première facture émise.
 */
async function genererNumeroFacture(annee: number): Promise<string> {
  return nextNumero("facture", annee, (prefixe) =>
    prisma.factureFormation.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    }),
  );
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
      dateDebut: true,
      dateFin: true,
      clientId: true,
      // 🔴 Les créances du dossier — c'est elles qui disent QUI doit et COMBIEN.
      // Sans ce `select`, le destinataire était écrasé à « opco » en subrogation
      // et le reste à charge n'était facturable à personne.
      dossiersFinancement: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          id: true,
          payeurs: {
            select: {
              id: true,
              payeurType: true,
              payeurNom: true,
              montantAttenduCents: true,
              factureFormationId: true,
            },
          },
        },
      },
      client: {
        select: {
          ...CLIENT_FACTURABLE_SELECT,
          // Conditions de règlement propres au client (F61) — priment sur la config.
          delaiPaiementJours: true,
        },
      },
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

  // Identité de l'organisme complète (mentions vendeur obligatoires sur facture :
  // SIRET, NDA, adresse du siège). Bloque AVANT la création du dossier facture
  // avec un message actionnable plutôt que de produire un document non conforme.
  const identiteFacture = await getOrganismeIdentite();
  const manquants = champsIdentiteManquants(identiteFacture, "facture");
  if (manquants.length > 0) {
    return {
      error: `Identité de l'organisme incomplète (${manquants.join(", ")}). Renseignez ces valeurs dans les paramètres Qualiopi avant de facturer.`,
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

  // ── 🔴 DESTINATAIRE ET MONTANT VIENNENT DE LA CRÉANCE ────────────────────
  //
  // Cette ligne valait `opcoSubrogation ? "opco" : destinataire` : le choix de
  // l'humain était ÉCRASÉ dès que la subrogation était cochée. Conséquence,
  // **le reste à charge n'était facturable à personne** — impossible d'émettre
  // depuis la session la seconde facture, celle de l'entreprise. Le seul
  // contournement était une facture libre ressaisie à la main, sans lien avec
  // le dossier.
  //
  // La règle métier n'a pourtant jamais été douteuse (plan, Lot 8 étape 6) :
  // **l'OPCO paie sa part, le client le reste à charge**. Deux factures. Ce qui
  // manquait n'était pas la décision, c'était le chemin.
  //
  // `DossierPayeur` était conçu pour ça depuis l'origine. On facture donc PAR
  // CRÉANCE : le destinataire vient de la ligne, le montant aussi (plus de
  // double comptage : facturer le total de la session à l'OPCO puis le reste à
  // l'entreprise réclamerait deux fois la même somme), et le rattachement
  // s'écrit à l'émission.
  //
  // ⚠️ Sans dossier ni créance, on retombe sur le comportement historique. Un
  // dossier peut légitimement ne pas exister (financement direct, affaire
  // antérieure au mécanisme) : refuser là serait bloquer une émission licite.
  // `?? []` sur le TABLEAU lui-même : une session lue par un chemin qui ne
  // sélectionne pas la relation rendrait `undefined`, et l'indexation lèverait.
  const dossier = (trainingSession.dossiersFinancement ?? [])[0];
  const creances = dossier?.payeurs ?? [];
  const dossierId = dossier?.id ?? null;
  const choix = choisirCreancePourFacture(creances, destinataire);

  if (!choix.ok && choix.raison !== "aucune_creance") {
    return { error: choix.message };
  }

  const destinataireEffectif: FactureFormationDestinataire = destinataire;
  if (choix.ok) {
    // Le montant de la créance PRIME sur la ventilation calculée : c'est lui
    // qui porte la part réellement due par ce débiteur après application du
    // plafond du financeur.
    totalHtCents = choix.montantHtCents;
    lignes = [
      {
        designation: `${lignes[0]?.designation ?? "Prestation de formation"} — part ${choix.creance.payeurNom}`,
        quantite: 1,
        prixUnitaireHtCents: choix.montantHtCents,
      },
    ];
  }

  // 🔴 Identité de l'ACHETEUR — nom + SIRET + adresse (art. L.441-9 C. com.,
  // 242 nonies A CGI). Ce chemin enregistrait `trainingSession.titreSession`
  // comme destinataire : la première facture réelle est partie au nom de
  // « IA pour l'immobilier — INVEST SUN (Saint-Étienne) », sans SIRET ni adresse.
  // Le client était pourtant déjà chargé, et jamais lu. Cf. destinataire-facture.ts.
  const acheteur = resoudreDestinataireFacture(destinataireEffectif, trainingSession.client);

  // ── Échéance de paiement ─────────────────────────────────────────────────
  // Jamais posée jusqu'ici : la colonne `echeanceAt` restait nulle, le hub
  // affichait « — » et le PDF retombait sur émission + 30 j. Or l'échéance est
  // une mention obligatoire, et le délai est réglable par client (F61) —
  // sauf subrogation, où c'est le financeur qui paie, avec son délai propre.
  const [delaiClientGlobal, delaiFinanceur] = await Promise.all([
    getQualiopiConfig("delai_paiement_jours"),
    getQualiopiConfig("delai_paiement_financeur_jours"),
  ]);
  const delaiRetenu = trainingSession.opcoSubrogation
    ? delaiFinanceur
    : (trainingSession.client?.delaiPaiementJours ?? delaiClientGlobal);
  const delaiJours =
    typeof delaiRetenu === "number" && Number.isFinite(delaiRetenu) && delaiRetenu > 0
      ? delaiRetenu
      : DELAI_PAIEMENT_DEFAUT_JOURS;
  const emiseAt = new Date();
  const echeanceAt = new Date(emiseAt);
  echeanceAt.setDate(echeanceAt.getDate() + delaiJours);

  // ── Régime de TVA (config, évolutif) + ventilation HT/TVA/TTC ─────────────
  // Qualiopi n'a aucun effet sur la TVA : le régime est lu depuis la config et
  // figé sur la facture (snapshot). Défaut « assujetti » (20 %).
  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = isRegimeTva(regimeTvaConfig) ? regimeTvaConfig : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const totaux = computeTotauxFacture(lignes, regimeTva, tauxStandard);

  // ── Numéro séquentiel + création atomique ─────────────────────────────────
  // R7 : `genererNumeroFacture` lit la BORNE HAUTE de la série ; sous création
  // concurrente deux factures peuvent lire le même maximum → même numéro. La
  // contrainte @unique sur `numero` rejette le doublon (P2002) ; `withNumberRetry`
  // ré-alloue et réessaie — et la reprise CONVERGE désormais, le maximum
  // progressant dès qu'une insertion concurrente a abouti (avec `count+1` elle
  // rejouait le même numéro cinq fois).
  // L'allocation DOIT rester DANS la closure pour être recalculée à chaque tentative.
  //
  // V20 étape 0 — ce que le nouveau dénominateur garantit, et ce qu'il ne garantit
  // PAS. Le compteur porte désormais sur `numero startsWith "AXI-FACT-<annee>-"` :
  // la ligne gagnante entre immédiatement dans le dénominateur de la tentative
  // suivante, donc le retry PROGRESSE sous CONCURRENCE. (Avec l'ancien filtre
  // `createdAt`, une facture dont la LIGNE datait d'une année antérieure — un
  // brouillon de plan récurrent émis en janvier — restait invisible au compteur :
  // les 5 tentatives recalculaient le même numéro et l'action échouait en boucle.)
  // En revanche il ne progresse TOUJOURS PAS sur un TROU de séquence : si 001 et
  // 003 existent sans 002, count = 2 → réalloue 003 → P2002 → recount = 2 → même
  // numéro → échec dur, car `withNumberRetry` relance une closure déterministe
  // sans lui passer le n° de tentative (cf. numbering/retry.ts). Ne PAS « corriger »
  // en passant `count + tentative` comme reclamations.ts : cela creuserait un trou
  // de plus dans la série (collision sur 001 → la tentative 2 émettrait 003), soit
  // exactement la rupture CGI 242 nonies A que ce lot referme. Non atteignable
  // aujourd'hui (aucun chemin applicatif ne supprime de `factureFormation`, et
  // `importerFacturesHistoriqueAction` refuse les préfixes AXI-FACT/AXI-AVO) ;
  // fermé pour de bon par L7 (`allocateNumero`, MAX(seq)+1 sous verrou).
  const annee = new Date().getFullYear();
  const facture = await withNumberRetry(async () => {
    const numero = await genererNumeroFacture(annee);
    return prisma.factureFormation.create({
      data: {
        numero,
        sessionId,
        // Classe la facture dans le hub (filtre « Formation ») — laissée nulle,
        // la ligne échappait à toute ventilation par activité.
        activite: "formation",
        // Rattache la facture au client CRM : sans ce lien, le hub et les
        // relances retombent sur le libellé figé au lieu de la fiche client.
        ...(trainingSession.clientId != null ? { clientId: trainingSession.clientId } : {}),
        // 🔴 LE RATTACHEMENT AU DOSSIER, jamais écrit jusqu'ici par aucun
        // émetteur. Son absence rendait `marquerPaiementRecuSiSoldee` du CODE
        // MORT — sa condition n'était jamais vraie — donc un dossier
        // n'atteignait jamais `paiement_recu` autrement qu'à la main, et le
        // pilotage ne voyait jamais un euro encaissé.
        ...(dossierId !== null ? { dossierFinancementId: dossierId } : {}),
        destinataire: destinataireEffectif,
        destinataireNom: acheteur.nom,
        destinataireSiret: acheteur.siret,
        destinataireAdresse: acheteur.adresse,
        destinataireTvaIntracom: acheteur.tvaIntracom,
        montantHtCents: totalHtCents,
        tvaExoneree: totaux.totalTvaCents === 0,
        regimeTva,
        montantTvaCents: totaux.totalTvaCents,
        montantTtcCents: totaux.totalTtcCents,
        lignes: lignes as never,
        subrogation: trainingSession.opcoSubrogation,
        numeroDossierOpco: trainingSession.opcoSubrogation
          ? (trainingSession.numeroDossierOpco ?? null)
          : null,
        statut: "emise",
        emiseAt,
        echeanceAt,
      },
      select: { id: true, numero: true, documentId: true },
    });
  });

  // 🔴 Le second lien : la CRÉANCE pointe vers sa facture.
  //
  // Sans lui, on saurait qu'un dossier a des factures sans savoir QUELLE
  // créance chacune solde — donc impossible de dire ce qu'il reste à encaisser
  // de chaque payeur, ce que le plan exige explicitement (Lot 8, étape 6).
  //
  // C'est aussi lui qui rend l'anti-double-émission opérant : sans marquage, la
  // même créance se refacturerait indéfiniment.
  //
  // Best-effort : la facture est émise et porte un numéro légal. Faire échouer
  // l'action ici laisserait une facture réelle non rattachée, ce qui est PIRE
  // que le rattachement manquant — on journalise et on continue.
  if (choix.ok) {
    try {
      await prisma.dossierPayeur.update({
        where: { id: choix.creance.id },
        data: { factureFormationId: facture.id },
      });
    } catch (err) {
      console.error("[financements] rattachement créance → facture impossible", {
        creanceId: choix.creance.id,
        factureId: facture.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

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

  // Chargement de la facture avec les données nécessaires pour reconstruire le PDF
  const facture = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: {
      id: true,
      numero: true,
      destinataireNom: true,
      destinataireSiret: true,
      destinataireAdresse: true,
      destinataireTvaIntracom: true,
      refClient: true,
      montantHtCents: true,
      lignes: true,
      regimeTva: true,
      subrogation: true,
      numeroDossierOpco: true,
      emiseAt: true,
      echeanceAt: true,
      sessionId: true,
      // 🔴 2026-08-25, cahier D4-3 — la REGENERATION doit rendre la meme piece
      // que l'emission. Sans ces deux champs, un PDF regenere reimprimerait les
      // trois mentions du Code de commerce ENTRE PROFESSIONNELS sur la facture
      // d'un particulier, alors que l'emission ne les met plus. Deux rendus
      // differents pour la meme facture, c'est pire que le defaut d'origine.
      destinataire: true,
      session: { select: { client: { select: { type: true } } } },
    },
  });
  if (!facture) return { error: "Facture introuvable" };

  // Reconstruction de FactureData pour le renderer
  const identite = await getOrganismeIdentite();
  // Régime de TVA figé sur la facture (snapshot) + taux standard courant.
  const regimeTva: RegimeTva = isRegimeTva(facture.regimeTva)
    ? facture.regimeTva
    : REGIME_TVA_DEFAUT;
  const tauxTvaStandardPercent =
    (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;

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
    tauxTvaPercent?: number;
  }>;

  // 🔴 Le RIB, sans lequel le client n'a AUCUNE coordonnée pour virer.
  //
  // Ce chemin — la RÉGÉNÉRATION d'un PDF de facture — était le seul des quatre
  // producteurs à ne pas l'injecter : `facture-libre.ts`,
  // `facturation-service.ts` et `facturation-1to1.ts` appellent tous
  // `resolveRibFacture()`. Conséquence silencieuse : régénérer une facture en
  // retirait les coordonnées bancaires, et le client recevait une pièce moins
  // complète que l'originale — sans que rien ne le signale.
  //
  // ⚠️ `null` quand l'IBAN n'est pas configuré (`legal_overrides`) : le gabarit
  // omet alors le bloc, ce qui est correct. On n'invente aucun IBAN.
  const rib = await resolveRibFacture();

  // Date de RÉALISATION de la prestation (art. 242 nonies A ann. II CGI) —
  // `sessionId` était DÉJÀ sélectionné ici sans jamais être lu, cf.
  // `periode-prestation.ts` pour ce que ce silence produisait sur la pièce.
  const sessionFacture =
    facture.sessionId !== null && facture.sessionId !== undefined
      ? await prisma.trainingSession.findUnique({
          where: { id: facture.sessionId },
          select: { dateDebut: true, dateFin: true },
        })
      : null;
  const periodePrestation = periodePrestationSession(sessionFacture);

  const factureData: FactureData = {
    numero: facture.numero,
    dateEmission: formatDate(facture.emiseAt),
    dateEcheance: formatDate(echeance),
    ...(periodePrestation !== undefined ? { periodePrestation } : {}),
    identite,
    regimeTva,
    tauxTvaStandardPercent,
    ...(facture.refClient !== null && facture.refClient !== ""
      ? { refClient: facture.refClient }
      : {}),
    client: {
      // 🔴 2026-08-25, cahier D4-3 — SANS ce champ, les trois mentions du Code
      // de commerce ENTRE PROFESSIONNELS partaient a un particulier. Le type
      // etait deja selectionne cote serveur : il manquait le branchement.
      // Derive au SSOT, jamais recopie ici.
      estPersonnePhysique: destinataireEstPersonnePhysique(
        facture.destinataire,
        facture.session?.client ?? null,
      ),
      raisonSociale: facture.destinataireNom,
      ...(facture.destinataireSiret !== null && facture.destinataireSiret !== undefined
        ? { siret: facture.destinataireSiret }
        : {}),
      ...(facture.destinataireAdresse !== null && facture.destinataireAdresse !== undefined
        ? { adresse: facture.destinataireAdresse }
        : {}),
      ...(facture.destinataireTvaIntracom !== null && facture.destinataireTvaIntracom !== undefined
        ? { numeroTvaIntracom: facture.destinataireTvaIntracom }
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
    ...(rib !== null ? { rib } : {}),
  };

  // 🔴 Audit certification 2026-07-26 (F64). Ce chemin injectait le numéro
  // DocumentGenere dans l'en-tête du PDF, alors que la facture est enregistrée —
  // et exportée au FEC — sous le numéro `factureFormation`. Deux compteurs
  // `count+1` indépendants sur deux tables distinctes : ils partent ensemble et
  // divergent dès la première régénération de PDF, le premier échec de rendu, ou
  // la première facture de plan récurrent.
  //
  // Conséquence : le PDF remis au client porte un numéro ABSENT du registre
  // comptable. Facture introuvable dans les livres, refus au contrôle.
  //
  // Le défaut était DÉJÀ corrigé dans l'autre chemin de facturation
  // (`facturation-service.ts:228`), avec ce raisonnement écrit noir sur blanc.
  // Quelqu'un l'a vu une fois et n'a corrigé qu'un des deux appels. On ignore
  // donc `docNumero` ici aussi : le DocumentGenere garde son propre numéro pour
  // le classement interne R2 — artefact de stockage, sans valeur comptable.
  let documentId: string;
  try {
    const docResult = await generateDocument({
      type: "facture",
      buildElement: () => React.createElement(FacturePdf, { data: factureData }),
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
