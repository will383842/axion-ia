/**
 * Qualiopi — Server Actions Génération Documentaire (T19 Cluster D).
 *
 * 15 actions — une par type de document réglementaire :
 *   convention, convention_tripartite, convocation, emargement,
 *   positionnement, grille_evaluation, satisfaction, certificat_realisation,
 *   kit_opco, kit_cpf, kit_france_travail, lettre_mission,
 *   reglement_interieur, livret_accueil, inventaire_moyens (A14).
 *
 * Pattern : genererFactureFormationAction (financements.ts).
 * Chacune :
 *   1. requireAdminWrite + stub-aware early-exit.
 *   2. Charge les données réelles via Prisma.
 *   3. Appelle generateDocument({ type, buildElement:(numero)=>React.createElement(XxxPdf,{data:{...,numero}}), refs }).
 *   4. Log activity qualiopi.document.<type>.genere.
 *   5. Retourne ActionResult<{documentId, numero}>.
 *
 * certificat_realisation (R.6313-3) : durée affichée en centièmes via
 * formatHeuresCentiemes (jamais "7h00") — obligatoire OPCO Atlas.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne une erreur
 * sans toucher la base (contrat ADR 0026).
 *
 * TS strict (exactOptionalPropertyTypes) : spread conditionnel pour tout
 * champ optionnel.
 */

"use server";

import React from "react";
import {
  estInscriptionActive,
  inscriptionsActives,
} from "@/server/qualiopi/inscriptions/inscriptions-actives";
import {
  dureeReferenceHeures,
  minutesSuiviesPresence,
} from "@/server/qualiopi/evaluations/heures-suivies";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// 🔴 S5 (2026-08-26) — la CONSTRUCTION des pièces a déménagé dans la couche
// service `documents/production/producteurs.ts`, partagée avec le worker
// `qualiopi-documents-worker` (production automatique au jalon). Ici ne
// restent que la garde admin, la validation d'entrée et le journal : une seule
// construction par type de pièce, deux appelants — jamais de jumeau.
import {
  formatDate,
  formatDateFr,
  modaliteLabel,
  produireConvention,
  produireConventionTripartite,
  produireContratFormation,
  produireConvocation,
  produireEmargement,
  produirePositionnement,
  produireGrilleEvaluation,
  produireSatisfaction,
  produireReglementInterieur,
  produireProgramme,
  produireOrganisationAction,
  produireLivretAccueil,
  produireKitOpco,
} from "@/server/qualiopi/documents/production/producteurs";

import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
import {
  SELECT_PIECE_COMPETENCE,
  estPieceCompetenceProbante,
  prefiltrePieceCompetenceProbante,
} from "@/server/qualiopi/trainers/piece-competence";
import {
  requireAdminWrite,
  requireAdminPublish,
  requireHabilitation,
  logQualiopiActivity,
  donneesJournalQualiopi,
} from "@/server/actions/qualiopi/_guards";
import {
  estJourIso,
  jourDeParis,
  debutDuJourDeParis,
  SEUIL_BPS_MAX,
  SEUIL_BPS_MIN,
  SEUIL_CENTS_MIN,
  type SeuilConditionSuspensive,
} from "@/server/qualiopi/financements/condition-suspensive";
import {
  appliquerTransition,
  changementsTransition,
  evaluerLecture,
  lireConditionSuspensive,
  leverBlocage,
  ACTION_LEVEE_BLOCAGE,
  MOTIFS_LEVEE_BLOCAGE,
} from "@/server/qualiopi/financements/condition-suspensive-service";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { transmettreExemplaireSigne } from "@/server/qualiopi/documents/signature/transmission-exemplaire";
import { ACOMPTE_DEFAUT_PERCENT } from "@/server/qualiopi/documents/acompte-defaut";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import {
  LIEU_DOCUMENT_SELECT,
  refusEmissionLieu,
  resolveLieuDocument,
} from "@/server/qualiopi/lieu/resolve-lieu-document";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { CvFormateurPdf } from "@/server/qualiopi/documents/templates/cv-formateur";
import { buildCvFormateurData } from "@/server/qualiopi/documents/cv-formateur-data";

// Templates — seuls restent ceux des actions dont la construction vit encore
// ici ; les gabarits des 12 pièces extraites sont importés par
// `production/producteurs.ts`.
import { CertificatRealisationPdf } from "@/server/qualiopi/documents/templates/certificat-realisation";
import { chargerDossierPretADeposer } from "@/server/qualiopi/financements/dossier-pret-a-deposer-lecture";
import { construireZipPretADeposer } from "@/server/qualiopi/financements/dossier-pret-a-deposer-zip";
import { KitCpfPdf } from "@/server/qualiopi/documents/templates/kit-cpf";
import { KitFranceTravailPdf } from "@/server/qualiopi/documents/templates/kit-france-travail";
import {
  LettreMissionPdf,
  type FormationConfiee,
  type LigneRemuneration,
} from "@/server/qualiopi/documents/templates/lettre-mission";
import { resolveRegle, type RegleRemuneration } from "@/server/qualiopi/remuneration/calcul";
import { libelleRemuneration } from "@/server/qualiopi/remuneration/libelle";
import { InventaireMoyensPdf } from "@/server/qualiopi/documents/templates/inventaire-moyens";
import { ListeFormateursPdf } from "@/server/qualiopi/documents/templates/liste-formateurs";
import { AutorisationCaptationPdf } from "@/server/qualiopi/documents/templates/autorisation-captation";
import { ContratSousTraitancePdf } from "@/server/qualiopi/documents/templates/contrat-sous-traitance";
import { ProcedureSousTraitancePdf } from "@/server/qualiopi/documents/templates/procedure-sous-traitance";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import { coachingInterventionLabel } from "@/server/formateur/coaching-options";
import { listMoyens } from "@/server/qualiopi/moyens/moyens-service";
import {
  listTrainers,
  FORMATION_AU_CATALOGUE_WHERE,
  whereHabilitationsDeclarables,
} from "@/server/qualiopi/trainers/trainers";
import { getSousTraitant } from "@/server/qualiopi/registres/sous-traitants-service";
// Annulation d'une pièce : les liens de signature en circulation meurent avec
// la valeur de la pièce (§ 24).
import {
  creerTokenDocument,
  revoquerTokensDocument,
  TokenDocumentError,
} from "@/server/qualiopi/documents/signature/token-document";
import { peutEngager, MOTIF_REFUS } from "@/server/auth/habilitations";
import {
  MandatOpcoPdf,
  type MandatOpcoData,
} from "@/server/qualiopi/documents/templates/mandat-opco";
import { nomOpcoDuClient } from "@/server/qualiopi/financements/opco-referentiel";
import { publicUrl } from "@/lib/public-url";
import {
  assertDossierOuvert,
  assertDossierOuvertSiRegeneration,
} from "@/server/qualiopi/sessions/verrou-dossier-garde";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STUB = "stub.invalid";

function isStub(): boolean {
  return process.env.DATABASE_URL?.includes(STUB) ?? false;
}

// Les helpers de mise en forme (formatDate, modaliteLabel, resolveFormateurNom,
// parseObjectifs…) vivent désormais dans `production/producteurs.ts` — voir
// l'import en tête : une seule implémentation, partagée avec le worker.

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Motif d'une RECTIFICATION, commun à toutes les actions de génération.
 *
 * 🔴 Audit pré-visite 2026-08-04. Régénérer une pièce depuis la console la
 * marquait « COPIE » — y compris quand on la refaisait justement parce que
 * l'original était FAUX. Le kit OPCO en est le cas d'école : `AXI-DOC-2026-018`
 * imprimait cinq lignes l'une par-dessus l'autre, `AXI-DOC-2026-024` corrigeait
 * le rendu et sortait filigranée. Restait à choisir, devant l'auditeur, entre
 * un original illisible et une copie exacte.
 *
 * Le motif est ce qui distingue les deux gestes, et il n'y a que l'humain
 * devant l'écran pour le connaître. Il est donc SAISI, jamais deviné : une
 * régénération sans raison écrite reste un duplicata et garde son filigrane.
 *
 * ⚠️ Longueur minimale alignée sur la contrainte `CHECK` en base (10) : les deux
 * couches disent la même chose, faute de quoi un motif accepté ici ferait
 * échouer l'écriture.
 */
const rectificationMotifSchema = z.string().trim().min(10).max(500).optional();

const sessionIdSchema = z.object({
  sessionId: z.string().uuid(),
  rectificationMotif: rectificationMotifSchema,
});

/**
 * Entrée de la convention bipartite — seul document de session paramétrable.
 *
 * `acomptePercent` : 0–100, entier. PAS de plafond à 30 % et c'est voulu — le
 * gabarit le documente : le plafond de l'art. L.6353-6 protège une personne
 * physique (contrat B2C), une convention lie des professionnels et l'acompte y
 * est purement contractuel. `0` est une valeur légitime (convention établie
 * après la tenue de l'action : « payable en totalité à réception de facture »).
 * Absent → `ACOMPTE_DEFAUT_PERCENT` (0 depuis le 2026-09-05 : on ne réclame pas
 * par défaut de l'argent que personne n'a promis — cf. `acompte-defaut.ts`).
 */
/**
 * INT-T65-A — la condition suspensive OPCO, telle que l'écran l'envoie quand
 * la case est cochée (forme d'A02). Absente = case non cochée.
 *
 * 🔴 AUCUN FLOTTANT ne passe : points de base OU centimes, ENTIERS, exactement
 * un des deux (les mêmes bornes que les CHECK SQL, dites ici pour rendre un
 * message plutôt qu'une erreur Postgres). La date limite est un JOUR civil de
 * Paris (« YYYY-MM-DD »), jamais passé : une condition dont le délai est déjà
 * écoulé serait caduque à la signature.
 */
const conditionSuspensiveOpcoSchema = z
  .object({
    seuilConditionBps: z.number().int().min(SEUIL_BPS_MIN).max(SEUIL_BPS_MAX).nullable(),
    seuilConditionCents: z
      .number()
      .int()
      .min(SEUIL_CENTS_MIN)
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    dateLimite: z.string().refine(estJourIso, "Date limite invalide"),
  })
  .strict()
  .refine((c) => (c.seuilConditionBps === null) !== (c.seuilConditionCents === null), {
    message: "Un seul seuil : en pourcentage OU en euros",
  });

type ConditionSuspensiveOpcoEntree = z.infer<typeof conditionSuspensiveOpcoSchema>;

/** Option des producteurs ; `{ erreur }` si la date limite est déjà passée. */
function optionCondition(
  c: ConditionSuspensiveOpcoEntree | undefined,
): { seuil: SeuilConditionSuspensive; jourLimite: string } | undefined | { erreur: string } {
  if (c === undefined) return undefined;
  if (c.dateLimite < jourDeParis(new Date())) {
    return { erreur: "La date limite de la condition suspensive est déjà passée." };
  }
  const seuil: SeuilConditionSuspensive =
    c.seuilConditionBps !== null
      ? { type: "pourcentage", bps: c.seuilConditionBps }
      : { type: "montant", cents: c.seuilConditionCents as number };
  return { seuil, jourLimite: c.dateLimite };
}

const genererConventionSchema = z.object({
  sessionId: z.string().uuid(),
  acomptePercent: z.number().int().min(0).max(100).optional(),
  rectificationMotif: rectificationMotifSchema,
  conditionSuspensiveOpco: conditionSuspensiveOpcoSchema.optional(),
});
const genererConventionTripartiteSchema = z.object({
  sessionId: z.string().uuid(),
  rectificationMotif: rectificationMotifSchema,
  conditionSuspensiveOpco: conditionSuspensiveOpcoSchema.optional(),
});
const enrollmentIdSchema = z.object({
  enrollmentId: z.string().uuid(),
  rectificationMotif: rectificationMotifSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Convention de formation (L.6353-1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la convention de formation professionnelle bipartite (L.6353-1).
 * Basée sur les données de la session + formation + client.
 */
export async function genererConventionAction(input: {
  sessionId: string;
  acomptePercent?: number;
  rectificationMotif?: string;
  conditionSuspensiveOpco?: ConditionSuspensiveOpcoEntree;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = genererConventionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, acomptePercent, rectificationMotif } = parsed.data;
  const condition = optionCondition(parsed.data.conditionSuspensiveOpco);
  if (condition !== undefined && "erreur" in condition) return { error: condition.erreur };
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  // La construction vit dans `production/producteurs.ts` (partagée avec le
  // worker S5) — ici : garde, validation, journal.
  const resultat = await produireConvention(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    ...(acomptePercent !== undefined ? { acomptePercent } : {}),
    ...(condition !== undefined ? { conditionSuspensiveOpco: condition } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };
  const doc = { id: resultat.documentId, numero: resultat.numero };

  await logQualiopiActivity({
    action: "qualiopi.document.convention.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    // L'acompte est une CLAUSE de la pièce : sa valeur (et le fait qu'elle ait
    // été choisie ou laissée au défaut) appartient au journal.
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      acomptePercent: acomptePercent ?? ACOMPTE_DEFAUT_PERCENT,
      // INT-T65-A — la condition est une CLAUSE : seuil, date limite et base
      // figée appartiennent au journal, comme l'acompte.
      conditionSuspensiveOpco: resultat.details?.["conditionSuspensiveOpco"] ?? null,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Convention tripartite (L.6353-1/2 + subrogation OPCO)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la convention tripartite OF + Client + OPCO (subrogation de paiement).
 */
export async function genererConventionTripartiteAction(input: {
  sessionId: string;
  rectificationMotif?: string;
  conditionSuspensiveOpco?: ConditionSuspensiveOpcoEntree;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = genererConventionTripartiteSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  const condition = optionCondition(parsed.data.conditionSuspensiveOpco);
  if (condition !== undefined && "erreur" in condition) return { error: condition.erreur };
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  // La construction vit dans `production/producteurs.ts` (partagée avec le
  // worker S5) — ici : garde, validation, journal.
  const resultat = await produireConventionTripartite(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    ...(condition !== undefined ? { conditionSuspensiveOpco: condition } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };
  const doc = { id: resultat.documentId, numero: resultat.numero };

  await logQualiopiActivity({
    action: "qualiopi.document.convention_tripartite.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      conditionSuspensiveOpco: resultat.details?.["conditionSuspensiveOpco"] ?? null,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2ter. INT-T65-A — condition suspensive OPCO : constat et renonciation
// ─────────────────────────────────────────────────────────────────────────────

const documentIdSchema = z.object({ documentId: z.string().uuid() }).strict();

const LIBELLE_ETAT: Record<string, string> = {
  en_attente: "en attente de l'accord de l'OPCO",
  active: "active",
  caduque: "caduque",
};

/**
 * Constate l'état de la condition suspensive d'une convention, d'après les
 * dossiers de financement (accord écrit et montant accordé, refus) et la date
 * limite (fin du jour civil de Paris), et APPLIQUE la transition si elle est
 * due : `en_attente → active` (accord ≥ seuil dans le délai) ou
 * `en_attente → caduque` (refus, accord inférieur, délai dépassé).
 *
 * Journalisée dans la même transaction que l'écriture. Rien ne sort jamais
 * d'`active` ni de `caduque` : un accord obtenu après la défaillance appelle
 * une NOUVELLE convention, qui prend effet à sa propre date de signature.
 */
export async function constaterConditionSuspensiveAction(input: {
  documentId: string;
}): Promise<ActionResult<{ etat: string; message: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Action désactivée en mode build (stub)" };
  const parsed = documentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const lecture = await lireConditionSuspensive(parsed.data.documentId);
  if (lecture === null) return { error: "Cette pièce ne porte pas de condition suspensive." };
  if (lecture.document.annulee) return { error: "Cette convention est annulée au registre." };
  if (lecture.document.etat !== "en_attente") {
    return {
      data: {
        etat: lecture.document.etat,
        message: `La condition est déjà ${LIBELLE_ETAT[lecture.document.etat]} : son état ne change plus.`,
      },
    };
  }

  const evaluation = evaluerLecture(lecture, new Date());
  if (evaluation.etat === "en_attente") {
    return {
      data: {
        etat: "en_attente",
        message:
          "Aucun accord écrit ni refus n'est saisi sur le dossier de financement, et la date limite n'est pas passée : la condition reste en attente.",
      },
    };
  }

  const journal = await donneesJournalQualiopi({
    action: `qualiopi.convention.condition_suspensive.${evaluation.etat}`,
    targetType: "DocumentGenere",
    targetId: lecture.document.id,
    changes: changementsTransition(lecture, evaluation),
    session: adminSession,
  });
  const ecrit = await appliquerTransition({
    documentId: lecture.document.id,
    vers: evaluation.etat,
    journal,
  });
  if (!ecrit) return { error: "L'état de la condition vient de changer : rechargez la page." };
  return {
    data: {
      etat: evaluation.etat,
      message:
        evaluation.etat === "active"
          ? "Condition accomplie : la convention produit ses effets à sa date de signature."
          : "Condition défaillie : la convention est caduque. Un accord ultérieur appelle une nouvelle convention.",
    },
  };
}

const renonciationSchema = z
  .object({
    documentId: z.string().uuid(),
    /** Jour (Paris) de la renonciation écrite du client, « YYYY-MM-DD ». */
    recueLe: z.string().refine(estJourIso, "Date invalide"),
  })
  .strict();

/**
 * Enregistre la RENONCIATION écrite du client à la condition (C. civ. 1304-4),
 * qu'il peut faire tant qu'elle n'est ni accomplie ni défaillie : la convention
 * devient `active` et produit ses effets à sa DATE DE SIGNATURE.
 *
 * Refusée si un accord, un refus ou la date limite a déjà décidé avant la
 * renonciation : on ne renonce pas à une condition défaillie.
 */
export async function renoncerConditionSuspensiveAction(input: {
  documentId: string;
  recueLe: string;
}): Promise<ActionResult<{ etat: string; message: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Action désactivée en mode build (stub)" };
  const parsed = renonciationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const maintenant = new Date();
  if (parsed.data.recueLe > jourDeParis(maintenant)) {
    return { error: "La renonciation ne peut pas être datée dans le futur." };
  }
  const lecture = await lireConditionSuspensive(parsed.data.documentId);
  if (lecture === null) return { error: "Cette pièce ne porte pas de condition suspensive." };
  if (lecture.document.annulee) return { error: "Cette convention est annulée au registre." };
  if (lecture.document.etat !== "en_attente") {
    return { error: `La condition est déjà ${LIBELLE_ETAT[lecture.document.etat]}.` };
  }

  // La renonciation du jour J compte à 00:00 heure de Paris ; aujourd'hui, à
  // l'instant présent (un événement « futur » ne serait pas lu).
  const le =
    parsed.data.recueLe === jourDeParis(maintenant)
      ? maintenant
      : debutDuJourDeParis(parsed.data.recueLe);
  const evaluation = evaluerLecture(lecture, maintenant, [{ type: "renonciation", le }]);
  if (evaluation.cause !== "renonciation") {
    return {
      error:
        "La condition était déjà accomplie ou défaillie à cette date : la renonciation est sans objet. Utilisez « Constater ».",
    };
  }

  const journal = await donneesJournalQualiopi({
    action: "qualiopi.convention.condition_suspensive.renonciation",
    targetType: "DocumentGenere",
    targetId: lecture.document.id,
    changes: changementsTransition(lecture, evaluation, {
      renonciationRecueLe: parsed.data.recueLe,
    }),
    session: adminSession,
  });
  const ecrit = await appliquerTransition({
    documentId: lecture.document.id,
    vers: "active",
    journal,
  });
  if (!ecrit) return { error: "L'état de la condition vient de changer : rechargez la page." };
  return {
    data: {
      etat: "active",
      message:
        "Renonciation enregistrée : la convention produit ses effets à sa date de signature.",
    },
  };
}

const leveeBlocageSchema = z
  .object({
    documentId: z.string().uuid(),
    /** Motif FERMÉ : jamais un texte libre. */
    motif: z.enum(MOTIFS_LEVEE_BLOCAGE),
    /** Référence du document de renonciation écrite : un repère, pas un récit. */
    referenceRenonciation: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 ._\-/]*$/, "Référence invalide"),
  })
  .strict();

const LIBELLE_REFUS_LEVEE: Record<string, string> = {
  introuvable: "Cette pièce ne porte pas de condition suspensive.",
  pas_en_attente:
    "La condition n'est plus en attente (ou la convention est annulée) : il n'y a rien à lever.",
  deja_levee: "Le blocage de cette convention a déjà été levé : une levée ne se réécrit pas.",
  journal_incoherent: "Levée refusée : journal incohérent.",
};

/**
 * INT-T81-A — LÈVE, une seule fois, le blocage de la convocation et de
 * l'émargement d'une session dont la convention est encore `en_attente`, parce
 * que le client a renoncé PAR ÉCRIT au même moment.
 *
 * Réservée à l'ADMINISTRATEUR (`admin` / `super_admin`), rôle rejugé ICI : plus
 * strict que `requireAdminWrite`, qui admet `editor`. Motif fermé, référence du
 * document de renonciation, journal (qui, quand, quelle convention, quelle
 * référence — aucune donnée de stagiaire). La condition elle-même ne change pas
 * d'état : pour la renonciation de fond, `renoncerConditionSuspensiveAction`.
 */
export async function leverBlocageConditionSuspensiveAction(input: {
  documentId: string;
  motif: (typeof MOTIFS_LEVEE_BLOCAGE)[number];
  referenceRenonciation: string;
}): Promise<ActionResult<{ message: string }>> {
  const adminSession = await requireAdminPublish();
  if (isStub()) return { error: "Action désactivée en mode build (stub)" };
  const parsed = leveeBlocageSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const lecture = await lireConditionSuspensive(parsed.data.documentId);
  if (lecture === null) return { error: LIBELLE_REFUS_LEVEE.introuvable! };

  const journal = await donneesJournalQualiopi({
    action: ACTION_LEVEE_BLOCAGE,
    targetType: "DocumentGenere",
    targetId: lecture.document.id,
    changes: {
      numero: lecture.document.numero,
      motif: parsed.data.motif,
      referenceRenonciation: parsed.data.referenceRenonciation,
      leveeLe: new Date().toISOString(),
    },
    session: adminSession,
  });
  const res = await leverBlocage({ documentId: lecture.document.id, journal });
  if (!res.ok) return { error: LIBELLE_REFUS_LEVEE[res.raison] ?? "Levée refusée." };
  return {
    data: {
      message:
        "Blocage levé : la convocation et l'émargement de la session sont ouverts. La condition, elle, reste en attente.",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2bis. Contrat de formation professionnelle (particulier / B2C, L.6353-3 à 7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le contrat de formation professionnelle pour un PARTICULIER qui finance
 * lui-même sa formation (L.6353-3 à L.6353-7). Par inscription (enrollment) =
 * un stagiaire personne physique. Distinct de la convention (personnes morales).
 *
 * Le prix porté au contrat est le montant net de la session (formation exonérée
 * de TVA). Pour une session inter à plusieurs particuliers, renseigner le
 * montant par stagiaire au niveau de la session.
 */
export async function genererContratFormationAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<
  ActionResult<{ documentId: string; numero: string; avertissement?: string | undefined }>
> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  // ⚠️ MÉDIATION DE LA CONSOMMATION — AVERTISSEMENT, PLUS BLOCAGE (2026-07-30).
  //
  // Le contrat de formation de l'article L.6353-3 s'adresse à une personne
  // physique agissant pour son propre compte, donc à un CONSOMMATEUR. L'article
  // L.612-1 du Code de la consommation impose alors d'avoir adhéré à un
  // médiateur agréé et d'en publier les coordonnées — amende administrative
  // jusqu'à 15 000 € pour une personne morale.
  //
  // L'audit de certification (2026-07-26, F50) avait posé ici un REFUS pur et
  // simple. Décision de Will du 2026-07-30 : ne plus bloquer. L'obligation
  // légale, elle, ne disparaît pas — mais elle ne se règle pas dans le code, et
  // un outil qui refuse de produire le document laisse l'admin sans issue le
  // jour où il en a besoin. Le rôle du logiciel s'arrête à dire ce qui manque.
  //
  // Donc : le contrat est émis, et l'absence de médiateur est
  //   • rendue VISIBLE à l'admin (avertissement retourné avec le document) ;
  //   • TRACÉE dans le journal d'audit, avec le numéro du contrat concerné.
  //
  // Ce second point est le plus important. Le jour d'un contrôle, la question
  // ne sera pas « le logiciel bloquait-il ? » mais « quels contrats ont été
  // émis sans la mention ? ». Sans trace, la réponse est introuvable ; avec
  // elle, la liste s'extrait du journal en une requête.
  //
  // Pour faire disparaître l'avertissement : renseigner
  // « mediateur_consommation_nom » et « mediateur_consommation_url » dans la
  // configuration Qualiopi, après adhésion effective à un médiateur agréé.
  //
  // 🔴 PIÈGE À CONNAÎTRE le jour où ce sera fait : `contrat-formation.tsx`
  // n'imprime AUCUNE clause de médiation, ni aujourd'hui ni avec les clés
  // renseignées. Le refus posé en 2026-07-26 protégeait donc l'émission d'un
  // document qui, même conforme côté configuration, n'aurait pas porté la
  // mention — une conformité de façade.
  //
  // ✅ 2026-08-25 — LE GABARIT L'IMPRIME DÉSORMAIS. Le commentaire précédent
  // demandait de ne pas le retirer avant que ce soit fait ; c'est fait.
  // `contrat-formation.tsx` rend une section « Médiation de la consommation »
  // dès que les deux clés sont renseignées, et RIEN tant qu'elles ne le sont
  // pas — nommer un médiateur inexistant donnerait au consommateur un recours
  // qui échoue, donc un grief de plus, pas une conformité.
  //
  // ⚠️ Il reste UN acte qui n'est pas du code : ADHÉRER à un médiateur agréé
  // CECMC et renseigner les deux clés. Le logiciel est prêt ; l'adhésion ne
  // s'écrit pas.
  //
  // ⚠️ N'affecte QUE le contrat individuel. La convention B2B ne relève pas du
  // droit de la consommation et n'a jamais été concernée.
  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert({ enrollmentId });
  if (!verrou.ok) return verrou;

  // La construction (acompte calculé sur le reste à charge, échéancier daté,
  // clause de médiation conditionnelle) vit dans `production/producteurs.ts`,
  // partagée avec le worker S5 — ici : garde, validation, journal.
  const resultat = await produireContratFormation(enrollmentId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.contrat.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: {
      documentId: resultat.documentId,
      numero: resultat.numero,
      // Trace de conformité. Le jour d'un contrôle, la question sera « quels
      // contrats ont été émis sans la mention de médiation ? » — cette clé rend
      // la liste extractible du journal, contrat par contrat, au lieu de la
      // laisser introuvable.
      ...(resultat.details ?? {}),
    },
    session: adminSession,
  });

  return {
    data: {
      documentId: resultat.documentId,
      numero: resultat.numero,
      ...(resultat.avertissement ? { avertissement: resultat.avertissement } : {}),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Convocation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère une convocation pour un stagiaire inscrit à une session.
 * enrollmentId identifie le couple stagiaire × session.
 */
export async function genererConvocationAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert({ enrollmentId });
  if (!verrou.ok) return verrou;

  // La construction (horaires réels des journées, lieu, financement) vit dans
  // `production/producteurs.ts`, partagée avec le worker S5.
  const resultat = await produireConvocation(enrollmentId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.convocation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: {
      documentId: resultat.documentId,
      numero: resultat.numero,
      ...(resultat.details ?? {}),
    },
    session: adminSession,
  });

  return { data: { documentId: resultat.documentId, numero: resultat.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Feuille d'émargement présentiel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la feuille d'émargement présentiel pour une session.
 * Inclut tous les stagiaires inscrits (statut ≠ exclu/abandon).
 */
export async function genererEmargementAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  // ⚠️ Pas de `resolveFormateurNom` ici : le formateur est porté JOURNÉE PAR
  // JOURNÉE par la feuille (désistement, co-animation). La construction —
  // `construireTirageEmargement`, partagée avec le tirage à la demande — vit
  // dans `production/producteurs.ts`, partagée avec le worker S5.
  const resultat = await produireEmargement(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.emargement.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: {
      documentId: resultat.documentId,
      numero: resultat.numero,
      ...(resultat.details ?? {}),
    },
    session: adminSession,
  });

  return { data: { documentId: resultat.documentId, numero: resultat.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Questionnaire de positionnement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le questionnaire de positionnement pour une session.
 * Le questionnaire est pré-rempli avec le titre de la session.
 */
export async function genererPositionnementAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  const resultat = await produirePositionnement(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.positionnement.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: resultat.documentId, numero: resultat.numero },
    session: adminSession,
  });

  return { data: { documentId: resultat.documentId, numero: resultat.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Grille d'évaluation des compétences (indicateur Qualiopi n°11)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la grille d'évaluation pour un stagiaire d'une session.
 * Les compétences sont extraites des objectifs pédagogiques de la formation.
 */
export async function genererGrilleEvaluationAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert({ enrollmentId });
  if (!verrou.ok) return verrou;

  // La construction (grille vierge OU évaluation enregistrée — audit
  // 2026-08-03) vit dans `production/producteurs.ts`, partagée avec le worker S5.
  const resultat = await produireGrilleEvaluation(enrollmentId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.grille_evaluation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: resultat.documentId, numero: resultat.numero },
    session: adminSession,
  });

  return { data: { documentId: resultat.documentId, numero: resultat.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Questionnaire de satisfaction (indicateur Qualiopi n°31)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le questionnaire de satisfaction à chaud pour une session.
 */
export async function genererSatisfactionAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  const resultat = await produireSatisfaction(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.satisfaction.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: resultat.documentId, numero: resultat.numero },
    session: adminSession,
  });

  return { data: { documentId: resultat.documentId, numero: resultat.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Certificat de réalisation (R.6313-3 — durée en centièmes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le certificat de réalisation pour un stagiaire (R.6313-3).
 *
 * ⚠️ DURÉE EN CENTIÈMES OBLIGATOIRE : formatHeuresCentiemes(dureeHeures).
 *    Utilisé par OPCO Atlas. La durée réelle est lue depuis dureeReelleHeures
 *    si disponible, sinon fallback sur la durée de formation prévue.
 */
export async function genererCertificatRealisationAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : certificat de realisation R.6313-3 : piece opposable au financeur.
  const adminSession = await requireHabilitation("attester");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;
  // ADR 0060 — la PREMIÈRE émission reste ouverte ; la régénération d'une pièce
  // vivante est une écriture VERROU.
  const verrou = await assertDossierOuvertSiRegeneration(
    { enrollmentId },
    "certificat_realisation",
  );
  if (!verrou.ok) return verrou;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      statut: true,
      tauxPresencePct: true,
      trainee: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          fonction: true,
        },
      },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          dureeReelleHeures: true,
          // F30 — portée sur le certificat de réalisation (arrêté 21/12/2018).
          modalite: true,
          formationSnapshot: true,
          formation: {
            select: {
              dureeHeures: true,
              titre: true,
            },
          },
          client: {
            select: {
              raisonSociale: true,
              siret: true,
              adresse: true,
            },
          },
        },
      },
      // 🔴 3e relecture A09 — créneaux de présence (minutes réalisées / prévues), lus comme l'attestation.
      presences: {
        select: {
          dureePrevueMinutes: true,
          dureeRealiseeMinutes: true,
          date: true,
          demiJournee: true,
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  // Conformité R.6313-3 : un certificat de réalisation atteste d'heures réellement
  // suivies. Un stagiaire sorti du dispositif ne peut PAS recevoir de certificat.
  //
  // 🔴 2026-08-21 — ce commentaire disait « cohérent avec l'attestation, cf.
  // attestation-service.ts ». Une prière en commentaire pour que deux gardes
  // restent identiques est l'aveu qu'on sait qu'elles vont diverger : les deux
  // écrivaient bien la même règle, mais dans un ORDRE différent, chacune de son
  // côté. Elles appellent maintenant le même prédicat, et la cohérence n'est
  // plus une intention mais un fait.
  if (!estInscriptionActive(enrollment.statut)) {
    return {
      error:
        "Certificat refusé : le stagiaire est en abandon/exclu. Aucun certificat de réalisation ne peut être émis (R.6313-3).",
    };
  }

  // 🔴 Constaté EN PRODUCTION le 2026-07-26 — et déjà matérialisé.
  //
  // Le statut d'abandon était la SEULE garde. Plus bas, la durée n'est pondérée
  // par le taux de présence que `if (tauxPresencePct !== null)` : quand le taux
  // est inconnu, le certificat atteste donc la durée PRÉVUE comme si elle avait
  // été réalisée. Rien n'exigeait qu'une seule heure ait été constatée.
  //
  // Ce n'est pas théorique : un `certificat_realisation` a été émis le 22/07 en
  // production alors que `emargement_signatures` comptait ZÉRO ligne. La pièce
  // que l'auditrice contrôle en premier attestait d'heures que rien ne prouvait.
  //
  // R.6313-3 : un certificat de réalisation atteste d'heures RÉELLEMENT suivies.
  // Deux conditions, donc, et elles sont distinctes :
  //   1. le taux de présence doit avoir été MESURÉ — un taux inconnu n'est pas un
  //      taux de 100 % ;
  //   2. il doit reposer sur une TRACE — au moins une signature d'émargement
  //      rattachée à cette inscription. Un taux saisi à la main sans émargement
  //      est une déclaration, pas une preuve, et c'est précisément ce qu'un
  //      contrôle de service fait sanctionne.
  //
  // On refuse plutôt que d'émettre une pièce fausse : un certificat manquant se
  // rattrape en émargeant, un certificat surdéclaré engage l'organisme devant le
  // financeur.
  if (enrollment.tauxPresencePct === null) {
    return {
      error:
        "Certificat refusé : le taux de présence n'a pas été calculé. Un certificat de réalisation atteste d'heures réellement suivies (R.6313-3) — il ne peut pas reposer sur la durée prévue.",
    };
  }

  // 🔴 `D2-3-C1` (2026-08-20) — le certificat était STRUCTURELLEMENT impossible
  // pour une session 100 % distancielle.
  //
  // La garde n'acceptait qu'une `EmargementSignature`, écrite par le seul
  // service de signature manuscrite/canvas. L'import d'un relevé de connexion
  // n'en écrit aucune — et le PDF du relevé affirme pourtant, en toutes lettres :
  // « Ce document remplace la feuille d'émargement pour les formations
  // dispensées à distance. »
  //
  // Une session à distance parfaitement menée — CSV de la plateforme importé,
  // taux calculé, relevé archivé avec son empreinte — n'obtenait donc JAMAIS la
  // pièce que l'OPCO exige pour financer. Et le trou n'apparaissait qu'au moment
  // de justifier.
  //
  // ## Ce que la garde exige VRAIMENT, et qui ne change pas
  //
  // 🔑 Une trace VÉRIFIABLE, pas une saisie. C'est le sens de R.6313-3 et des
  // indicateurs 9 et 11 : le taux ne doit pas reposer sur ce qu'un humain a tapé
  // dans une grille.
  //
  // Le relevé de connexion satisfait cette exigence : ses créneaux portent
  // `importId`, c'est-à-dire le rattachement au fichier d'origine, archivé avec
  // son empreinte SHA-256. On peut le rejouer, le recompter, le confronter.
  //
  // ⚠️ `source: "manuel"` reste EXCLU, et c'est tout le propos : une présence
  // saisie à la main n'est pas une trace, quelle que soit la modalité. Accepter
  // n'importe quel `PresenceCreneau` aurait vidé la garde de sa substance —
  // elle aurait continué d'exister en refusant seulement les dossiers vides.
  const signatures = await prisma.emargementSignature.count({
    where: {
      enrollmentId: enrollment.id,
      // 🔴 2026-08-24, cahier D3-4 — `revokedAt: null` MANQUAIT ici.
      //
      // Une signature révoquée est une signature retirée du registre : c'est
      // le geste par lequel on constate qu'une preuve ne vaut pas. Sans ce
      // filtre, révoquer TOUTES les signatures d'une inscription n'empêchait
      // pas d'émettre le certificat de réalisation qu'elles fondaient — la
      // pièce continuait d'affirmer une assiduité que le registre niait.
      //
      // 🔑 Le jumeau le faisait déjà : `emargement/revocation-service.ts`
      // compte les « restantes » avec ce même filtre et remet
      // `emargementSigneAt` à `null` quand il n'en reste aucune. La révocation
      // nettoyait donc partout SAUF dans la garde qui délivre la pièce.
      revokedAt: null,
    },
  });
  const creneauxImportes =
    signatures > 0
      ? 0
      : await prisma.presenceCreneau.count({
          where: {
            enrollmentId: enrollment.id,
            source: { in: ["import_zoom", "import_teams", "import_meet"] },
            // Le rattachement au fichier archivé : c'est LUI qui rend la trace
            // vérifiable. Un créneau `import_*` orphelin ne prouverait rien.
            importId: { not: null },
          },
        });

  if (signatures === 0 && creneauxImportes === 0) {
    return {
      error:
        "Certificat refusé : aucune trace vérifiable n'est rattachée à cette inscription — ni signature d'émargement, ni relevé de connexion importé. Le taux de présence doit reposer sur une preuve, pas sur une saisie (R.6313-3, indicateurs 9 et 11).",
    };
  }

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  // Durée + intitulé depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);

  // Durée RÉALISÉE PAR CE STAGIAIRE (R.6313-3) : base = durée réelle de la session
  // si déclarée, sinon durée prévue ; puis TOUJOURS pondérée par le taux de présence
  // individuel quand il est connu.
  //
  // 🔴 #2 — avant, la pondération par le taux ne s'appliquait QUE si `dureeReelleHeures`
  // était null : un stagiaire à 50 % d'une session de 16 h réelles obtenait un
  // certificat « 16 h réalisées » (durée SESSION) alors que son attestation portait
  // « 8 h suivies » (durée INDIVIDUELLE). Deux pièces du même dossier divergeaient, et
  // le certificat SUR-DÉCLARAIT les heures à l'OPCO. Les deux mesurent désormais les
  // heures réellement suivies par le bénéficiaire = taux × (durée réelle ?? prévue).
  // 🔴 4e relecture A09 — même repli que l'attestation (`dureeReferenceHeures`).
  const baseDuree = dureeReferenceHeures({
    dureeReelleHeures: session.dureeReelleHeures,
    dureeSnapshotHeures: formationDoc.dureeHeures,
    dureeCatalogueHeures: session.formation.dureeHeures,
  });
  let dureeHeures = baseDuree;
  if (enrollment.tauxPresencePct !== null) {
    // 🔴 3e relecture A09 — MÊME calcul que l'attestation du même stagiaire
    // (`heures-suivies.ts`) : proportion des minutes réalisées sur les minutes
    // prévues des créneaux, sinon taux, sans
    // arrondi à l'heure. 93 % de 7 h donnait « 7,00 » ici et « 6 h 31 » sur
    // l'attestation : la divergence que le commentaire #2 ci-dessus refuse.
    dureeHeures =
      minutesSuiviesPresence(
        { tauxPresencePct: enrollment.tauxPresencePct, creneaux: enrollment.presences },
        baseDuree,
      ) / 60;
  }

  const dirigeant = await getQualiopiConfig("dirigeant_nom");

  const doc = await generateDocument({
    type: "certificat_realisation",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(CertificatRealisationPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          ...(dirigeant ? { dirigeant } : {}),
          entreprise: {
            raisonSociale: session.client?.raisonSociale ?? identite.raisonSociale,
            ...(session.client?.siret !== null && session.client?.siret !== undefined
              ? { siret: session.client.siret }
              : {}),
            ...(session.client?.adresse !== null && session.client?.adresse !== undefined
              ? { adresse: session.client.adresse }
              : {}),
          },
          stagiaire: {
            nom: trainee.nom,
            prenom: trainee.prenom,
            ...(trainee.fonction !== null && trainee.fonction !== undefined
              ? { fonction: trainee.fonction }
              : {}),
          },
          // #9 — intitulé de la SESSION (comme convention/convocation/émargement/
          // attestation), pas le titre catalogue : sinon un certificat de
          // réalisation portait un intitulé divergent des autres pièces du dossier.
          intituleAction: session.titreSession ?? formationDoc.titre ?? session.formation.titre,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          // ⚠️ dureeHeures en décimal — formatHeuresCentiemes appelé dans le template
          dureeHeures,
          // F30 — modalité réelle de la session. Le modèle annexé à l'arrêté du
          // 21 décembre 2018 distingue présentiel et distanciel, et un contrôle
          // de service fait porte précisément là-dessus. La nature de l'action
          // prend son défaut « action de formation » dans le template.
          modalite: session.modalite,
        },
      }),
    // ⚠️ `traineeId` fait partie de l'IDENTITÉ de la pièce : ces documents sont
    // établis PAR STAGIAIRE. Sans lui, la détection de régénération marquait
    // « copie » toutes les pièces des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.certificat_realisation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      dureeHeures,
      sessionId: session.id,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Kit OPCO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le kit dossier OPCO (pièces + ventilation horaire + financement).
 */
export async function genererKitOpcoAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : kit OPCO depose au nom du client (mandat).
  const adminSession = await requireHabilitation("deposer_demande_financeur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  // ADR 0060 — la PREMIÈRE émission reste ouverte ; la régénération d'une pièce
  // vivante est une écriture VERROU.
  const verrou = await assertDossierOuvertSiRegeneration({ sessionId }, "kit_opco");
  if (!verrou.ok) return verrou;

  // La construction (ventilation, état réel des pièces, encart de dépôt) vit
  // dans `production/producteurs.ts`, partagée avec l'envoi du dossier à
  // l'entreprise (lot OPCO A8, passage quotidien du worker).
  const resultat = await produireKitOpco(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };
  const doc = { id: resultat.documentId, numero: resultat.numero };

  await logQualiopiActivity({
    action: "qualiopi.document.kit_opco.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9bis. Mandat OPCO (INT-T66-A)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entrée du mandat OPCO.
 *
 * `.strict()` : une clé inconnue est REFUSÉE, pas ignorée. Le mandat engage
 * l'entreprise ; rien de ce qu'il imprime ne vient du navigateur — seulement
 * les deux références qui disent QUELLE action et QUEL mandant. Une clé en
 * trop (un nom d'OPCO, une liste de stagiaires) est le signe d'un appelant qui
 * croit pouvoir dicter le contenu : on le lui dit plutôt que de l'ignorer.
 */
const genererMandatOpcoSchema = z
  .object({
    sessionId: z.string().uuid(),
    clientId: z.string().uuid(),
    rectificationMotif: rectificationMotifSchema,
  })
  .strict();

/**
 * Ce qu'il est advenu du lien de signature du mandat.
 *
 * - `avec_convention` : une convention du même client et de la même session
 *   est en circuit de signature ; le mandat rejoint CET envoi — même
 *   signataire, même échéance, et la convention est nommée.
 * - `seul` : aucune convention n'est en circuit ; le mandat part seul, et
 *   l'écran le dit.
 * - `non_emis` : la pièce est générée, mais le lien n'a pas pu être émis
 *   (habilitation, adresse manquante…). Le motif est actionnable.
 */
export type EnvoiMandatOpco =
  | {
      mode: "avec_convention";
      conventionNumero: string;
      destinataire: string;
      url: string;
      expiresAt: Date;
    }
  | { mode: "seul"; destinataire: string; url: string; expiresAt: Date }
  | { mode: "non_emis"; motif: string };

/**
 * Génère le mandat spécial de l'entreprise pour agir auprès de son OPCO, et
 * émet son lien de signature « client ».
 *
 * Le texte du mandat est figé dans `templates/mandat-opco.tsx` (relu par la
 * juriste) : ici on ne fait que le NOURRIR, depuis la base — la session, ses
 * stagiaires rattachés à CE client, et le dossier de financement OPCO ou mixte.
 *
 * 🔴 Garde en tête, AVANT toute lecture : un appel non habilité n'apprend ni
 * la raison sociale, ni l'OPCO, ni les noms des stagiaires.
 *
 * ## « Envoyé avec la convention »
 *
 * Si une convention (bipartite ou tripartite) du même client et de la même
 * session attend la signature du client — lien vivant, pas encore signée —,
 * le jeton du mandat est émis AU MÊME SIGNATAIRE, figé dans le jeton de la
 * convention, avec la MÊME échéance : les deux pièces forment un seul envoi,
 * que le client signe dans la même fenêtre. Sinon le mandat part seul, au
 * contact de la fiche client, et l'action le dit.
 *
 * ⚠️ Aucun e-mail n'est mis en file ici : l'envoi passe par le panneau de
 * signature de la pièce (« Envoyer par e-mail »), comme pour la convention.
 */
export async function genererMandatOpcoAction(input: {
  sessionId: string;
  clientId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string; envoi: EnvoiMandatOpco }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = genererMandatOpcoSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, clientId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      clientId: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      formationSnapshot: true,
      formation: { select: { dureeHeures: true } },
      enrollments: {
        where: { ...inscriptionsActives() },
        select: {
          clientId: true,
          trainee: { select: { nom: true, prenom: true } },
        },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };

  // Un stagiaire relève du client que porte son inscription (inter-entreprises),
  // à défaut du client de la session.
  const stagiairesDuClient = session.enrollments.filter(
    (e) => (e.clientId ?? session.clientId) === clientId,
  );
  if (session.clientId !== clientId && stagiairesDuClient.length === 0) {
    return { error: "Ce client n'est pas partie à cette session : aucun mandat à établir." };
  }

  // Le mandat désigne UN OPCO : sans dossier OPCO ou mixte ouvert, il n'a pas
  // d'objet. Le dossier le plus récent est celui en instruction (jamais
  // un dossier `clos`).
  const dossier = await prisma.dossierFinancement.findFirst({
    where: {
      trainingSessionId: sessionId,
      type: { in: ["opco", "mixte"] },
      statut: { not: "clos" },
      OR: [{ clientId }, { clientId: null }],
    },
    orderBy: { createdAt: "desc" },
    select: { financeurNom: true },
  });
  if (dossier === null) {
    return {
      error:
        "Aucun dossier de financement OPCO ou mixte n'est ouvert pour cette session : créez-le avant d'établir le mandat, qui doit nommer l'OPCO.",
    };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      raisonSociale: true,
      siret: true,
      adresse: true,
      contactNom: true,
      contactEmail: true,
      contactFonction: true,
      opco: true,
      opcoIdentifie: true,
    },
  });
  if (!client) return { error: "Client introuvable" };

  // Une convention du même client et de la même session en ATTENTE de la
  // signature du client : lien vivant, et aucune signature client posée.
  const maintenant = new Date();
  const typesConvention: Array<"convention" | "convention_tripartite"> = [
    "convention",
    "convention_tripartite",
  ];
  const jetonConvention = await prisma.documentSignatureToken.findFirst({
    where: {
      partie: "client",
      revokedAt: null,
      usedAt: null,
      expiresAt: { gt: maintenant },
      documentGenere: {
        sessionId,
        clientId,
        type: { in: typesConvention },
        annuleeAt: null,
        signatures: { none: { partie: "client", revokedAt: null } },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      signataireNom: true,
      signataireEmail: true,
      signataireQualite: true,
      expiresAt: true,
      documentGenere: { select: { numero: true } },
    },
  });
  // Faute de convention en circuit, le mandat cite la dernière convention
  // vivante de ce client sur cette session, s'il en existe une.
  const derniereConvention =
    jetonConvention === null
      ? await prisma.documentGenere.findFirst({
          where: { sessionId, clientId, type: { in: typesConvention }, annuleeAt: null },
          orderBy: { createdAt: "desc" },
          select: { numero: true },
        })
      : null;
  const numeroConvention =
    jetonConvention?.documentGenere.numero ?? derniereConvention?.numero ?? null;

  const identite = await getOrganismeIdentite();
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const nomOpco = dossier.financeurNom?.trim() || nomOpcoDuClient(client);

  const construire = (numero: string): MandatOpcoData => ({
    numero,
    entreprise: {
      raisonSociale: client.raisonSociale,
      siret: client.siret ?? "—",
      adresse: client.adresse ?? "—",
      // « — » : le gabarit imprime alors « Non renseigné », jamais un blanc.
      representant: client.contactNom ?? "—",
      qualiteRepresentant: client.contactFonction ?? "—",
    },
    opco: { nom: nomOpco },
    action: {
      intitule: session.titreSession,
      dateDebut: formatDate(new Date(session.dateDebut)),
      dateFin: formatDate(new Date(session.dateFin)),
      dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
      stagiaires: stagiairesDuClient.map((e) => `${e.trainee.prenom} ${e.trainee.nom}`.trim()),
      ...(numeroConvention !== null ? { numeroConvention } : {}),
    },
    dateMandat: formatDateFr(maintenant),
  });

  const doc = await generateDocument({
    type: "mandat_opco",
    identite,
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(MandatOpcoPdf, { data: construire(numero), identite }),
    refs: { sessionId, clientId },
  });

  const envoi = await emettreLienMandat({
    documentGenereId: doc.id,
    role: adminSession.role,
    jetonConvention,
    client,
  });

  await logQualiopiActivity({
    action: "qualiopi.document.mandat_opco.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    // ⚠️ Le LIEN n'est jamais journalisé : il vaut signature.
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      clientId,
      opco: nomOpco,
      envoi: envoi.mode,
      ...(envoi.mode === "avec_convention" ? { convention: envoi.conventionNumero } : {}),
      ...(envoi.mode !== "non_emis" ? { destinataire: envoi.destinataire } : {}),
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero, envoi } };
}

const listerClientsMandatOpcoSchema = z.object({ sessionId: z.string().uuid() }).strict();

/**
 * Les mandants possibles d'une session : le client de la session et, en
 * inter-entreprises, les clients portés par les inscriptions actives.
 *
 * Sert au bouton « Générer le mandat OPCO » : l'écran de documents ne connaît
 * que la session, et le mandat se rattache à UN client. La liste est relue
 * côté serveur à la génération — elle n'est jamais crue.
 */
export async function listerClientsMandatOpcoAction(input: {
  sessionId: string;
}): Promise<ActionResult<Array<{ clientId: string; raisonSociale: string }>>> {
  await requireAdminWrite();
  if (isStub()) return { error: "Indisponible pendant le build" };

  const parsed = listerClientsMandatOpcoSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const session = await prisma.trainingSession.findUnique({
    where: { id: parsed.data.sessionId },
    select: {
      client: { select: { id: true, raisonSociale: true } },
      enrollments: {
        where: { ...inscriptionsActives(), clientId: { not: null } },
        select: { client: { select: { id: true, raisonSociale: true } } },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };

  const parId = new Map<string, string>();
  if (session.client) parId.set(session.client.id, session.client.raisonSociale);
  for (const e of session.enrollments) {
    if (e.client) parId.set(e.client.id, e.client.raisonSociale);
  }
  return {
    data: [...parId].map(([clientId, raisonSociale]) => ({ clientId, raisonSociale })),
  };
}

/**
 * Émet le jeton « client » du mandat — dans l'envoi de la convention quand il
 * y en a une en circuit, seul sinon.
 *
 * L'identité vient TOUJOURS de la base : du jeton de la convention (déjà figé
 * par une émission authentifiée), ou de la fiche client. Jamais d'un argument.
 */
async function emettreLienMandat(args: {
  documentGenereId: string;
  role: string;
  jetonConvention: {
    signataireNom: string;
    signataireEmail: string | null;
    signataireQualite: string | null;
    expiresAt: Date;
    documentGenere: { numero: string };
  } | null;
  client: {
    raisonSociale: string;
    contactNom: string | null;
    contactEmail: string | null;
    contactFonction: string | null;
  };
}): Promise<EnvoiMandatOpco> {
  // Même habilitation que l'envoi d'un lien par e-mail : adresser une pièce à
  // signer engage l'organisme.
  if (!peutEngager(args.role, "contresigner")) {
    return {
      mode: "non_emis",
      motif: `Mandat généré, lien non émis. ${MOTIF_REFUS.contresigner}`,
    };
  }

  const piece = await prisma.documentGenere.findUnique({
    where: { id: args.documentGenereId },
    select: { metadata: true, suppressionPrevueAt: true },
  });
  const meta = piece?.metadata;
  const estSpecimen =
    typeof meta === "object" && meta !== null && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)["specimen"] === true
      : false;
  if (piece === null || estSpecimen) {
    return {
      mode: "non_emis",
      motif:
        "Mandat généré en SPÉCIMEN, sans valeur juridique : l'identité de l'organisme est incomplète. Renseignez-la dans Qualiopi › Configuration, puis régénérez le mandat.",
    };
  }

  const jc = args.jetonConvention;
  const avecConvention = jc !== null && (jc.signataireEmail ?? "").trim() !== "";
  const signataire = avecConvention
    ? { nom: jc.signataireNom, email: jc.signataireEmail ?? "", qualite: jc.signataireQualite }
    : {
        nom: args.client.contactNom?.trim() || args.client.raisonSociale,
        email: args.client.contactEmail ?? "",
        qualite: args.client.contactFonction,
      };

  try {
    const { token, expiresAt } = await creerTokenDocument({
      documentGenereId: args.documentGenereId,
      partie: "client",
      signataireNom: signataire.nom,
      signataireEmail: signataire.email,
      signataireQualite: signataire.qualite,
      // Dans l'envoi de la convention : même échéance que son lien, pour que
      // les deux pièces se signent dans la même fenêtre.
      borneMetier: avecConvention ? jc.expiresAt : piece.suppressionPrevueAt,
    });
    const url = publicUrl(`/fr/portail/signer/${token}`).toString();
    const destinataire = signataire.email.trim().toLowerCase();
    return avecConvention
      ? {
          mode: "avec_convention",
          conventionNumero: jc.documentGenere.numero,
          destinataire,
          url,
          expiresAt,
        }
      : { mode: "seul", destinataire, url, expiresAt };
  } catch (err) {
    if (err instanceof TokenDocumentError) {
      return { mode: "non_emis", motif: `Mandat généré, lien non émis. ${err.message}` };
    }
    Sentry.captureException(err, { tags: { action: "genererMandatOpcoAction" } });
    return {
      mode: "non_emis",
      motif:
        "Mandat généré, mais le lien de signature n'a pas pu être émis : émettez-le depuis le panneau de signature de la pièce.",
    };
  }
}

/**
 * Chantier OPCO A6 — « Dossier prêt à déposer » : émet un kit OPCO VÉRIFIÉ
 * (même chemin, même verrou que `genererKitOpcoAction`) et le remet dans un
 * ZIP avec les pièces PRÉSENTES au registre. C'est l'entreprise qui dépose sur
 * son espace OPCO ; l'organisme lui remet ce dossier.
 */
export async function genererDossierPretADeposerAction(input: {
  sessionId: string;
}): Promise<
  ActionResult<{ base64: string; filename: string; joints: string[]; manquantes: string[] }>
> {
  // Même droit que le kit OPCO : c'est le kit, accompagné de ses pièces.
  const adminSession = await requireHabilitation("deposer_demande_financeur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };
  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  // Le kit passe par SON action : garde du verrou (ADR 0060) et journal inclus.
  const kit = await genererKitOpcoAction({ sessionId });
  if ("error" in kit) return kit;

  const [kitDoc, pret] = await Promise.all([
    prisma.documentGenere.findUnique({
      where: { id: kit.data.documentId },
      select: { type: true, numero: true, createdAt: true },
    }),
    chargerDossierPretADeposer(sessionId),
  ]);
  if (!kitDoc || !pret) return { error: "Session introuvable" };

  try {
    const zip = await construireZipPretADeposer({ kit: kitDoc, dossier: pret });
    await logQualiopiActivity({
      action: "qualiopi.document.dossier_pret_a_deposer.genere",
      targetType: "TrainingSession",
      targetId: sessionId,
      changes: { kitNumero: kitDoc.numero, joints: zip.joints, manquantes: zip.manquantes },
      session: adminSession,
    });
    return { data: zip };
  } catch (err) {
    // Le détail (clé de stockage, message R2…) reste au journal serveur : l'écran
    // reçoit un libellé fixe.
    console.error("[genererDossierPretADeposerAction] ZIP impossible", err);
    return { error: "Impossible de préparer le dossier prêt à déposer." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Kit CPF / EDOF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le kit dossier CPF/EDOF pour un stagiaire inscrit.
 */
export async function genererKitCpfAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : kit CPF/EDOF depose au nom du stagiaire.
  const adminSession = await requireHabilitation("deposer_demande_financeur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;
  // ADR 0060 — la PREMIÈRE émission reste ouverte ; la régénération d'une pièce
  // vivante est une écriture VERROU.
  const verrou = await assertDossierOuvertSiRegeneration({ enrollmentId }, "kit_cpf");
  if (!verrou.ok) return verrou;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, nom: true, prenom: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          montantHtCents: true,
          priseEnChargeMontantCents: true,
          formation: { select: { codeCpf: true } },
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  const codeCpf = session.formation.codeCpf ?? "—";
  const coutTotal = session.montantHtCents;
  const montantCpf = session.priseEnChargeMontantCents ?? 0;
  // R4 (audit) : participation forfaitaire CPF (réforme 2024) câblée au SiteSetting
  // `cpf_reste_a_charge` (€). Reste à charge = le résiduel s'il existe, sinon la
  // participation obligatoire minimale (sauf exemptions demandeur d'emploi /
  // co-financement employeur — à arbitrer par Will). Évite un RAC à 0 illégal.
  const racFloorEuros = await getQualiopiConfig("cpf_reste_a_charge");
  const racFloorCents = Math.round((typeof racFloorEuros === "number" ? racFloorEuros : 0) * 100);
  const residuel = Math.max(0, coutTotal - montantCpf);
  const resteACharge = residuel > 0 ? residuel : racFloorCents;

  const doc = await generateDocument({
    type: "kit_cpf",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(KitCpfPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          beneficiaire: {
            nom: trainee.nom,
            prenom: trainee.prenom,
          },
          codeCpf,
          intituleFormation: session.titreSession,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          montantCpfCents: montantCpf,
          resteAChargeCents: resteACharge,
          coutTotalCents: coutTotal,
        },
      }),
    // ⚠️ `traineeId` fait partie de l'IDENTITÉ de la pièce : ces documents sont
    // établis PAR STAGIAIRE. Sans lui, la détection de régénération marquait
    // « copie » toutes les pièces des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.kit_cpf.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Kit France Travail (AIF / POEI / CSP)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le kit dossier France Travail pour un stagiaire.
 * Le dispositif (AIF/POEI/CSP) est lu depuis la session.
 */
export async function genererKitFranceTravailAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : kit France Travail (AIF/POEI/CSP).
  const adminSession = await requireHabilitation("deposer_demande_financeur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;
  // ADR 0060 — la PREMIÈRE émission reste ouverte ; la régénération d'une pièce
  // vivante est une écriture VERROU.
  const verrou = await assertDossierOuvertSiRegeneration({ enrollmentId }, "kit_france_travail");
  if (!verrou.ok) return verrou;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, nom: true, prenom: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          montantHtCents: true,
          priseEnChargeMontantCents: true,
          ftDispositif: true,
          numeroDossierOpco: true,
          ftPoeiOffreEmploiNumero: true,
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;

  type Dispositif = "AIF" | "POEI" | "CSP";
  const FT_MAP: Record<string, Dispositif> = {
    aif: "AIF",
    poei: "POEI",
    csp: "CSP",
  };
  const dispositif: Dispositif = session.ftDispositif
    ? (FT_MAP[session.ftDispositif] ?? "AIF")
    : "AIF";

  const coutTotal = session.montantHtCents;
  const montantAide = session.priseEnChargeMontantCents ?? 0;
  const resteACharge = Math.max(0, coutTotal - montantAide);

  const doc = await generateDocument({
    type: "kit_france_travail",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(KitFranceTravailPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          dispositif,
          beneficiaire: {
            nom: trainee.nom,
            prenom: trainee.prenom,
          },
          intituleFormation: session.titreSession,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          ...(session.numeroDossierOpco !== null && session.numeroDossierOpco !== undefined
            ? { numeroDossierFranceTravail: session.numeroDossierOpco }
            : {}),
          montants: {
            montantAideFranceTravailCents: montantAide,
            resteAChargeCents: resteACharge,
            coutTotalCents: coutTotal,
          },
        },
      }),
    // ⚠️ `traineeId` fait partie de l'IDENTITÉ de la pièce : ces documents sont
    // établis PAR STAGIAIRE. Sans lui, la détection de régénération marquait
    // « copie » toutes les pièces des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.kit_france_travail.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero, dispositif },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Lettre de mission formateur
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la lettre de mission pour le formateur principal d'une session.
 * Lit les données du formateur via le premier co-formateur.
 */
export async function genererLettreMissionAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      ...LIEU_DOCUMENT_SELECT,
      coFormateurs: true,
      formateurPrincipalId: true,
      formationSnapshot: true,
      // `slug` : la clé de résolution du barème (`TrainerCompensationRule.
      // interventionSlug`) — la lettre imprime désormais la rémunération que la
      // paie appliquera, pas le tarif générique de la fiche.
      formation: { select: { slug: true, dureeHeures: true } },
    },
  });
  if (!session) return { error: "Session introuvable" };

  // Durée depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);

  // Résolution du formateur principal — FK prioritaire, repli Json legacy.
  const principalTrainerId = resolvePrincipalTrainerId({
    formateurPrincipalId: session.formateurPrincipalId,
    coFormateurs: session.coFormateurs,
  });
  const arr = Array.isArray(session.coFormateurs) ? session.coFormateurs : [];
  const premierRaw = arr[0] as { id?: string; nom?: string; prenom?: string } | undefined;
  let trainer: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    statut: string;
    tarifJourneeHtCents: number | null;
    sousTraitantNda: string | null;
    adresseProfessionnelle: string | null;
  } | null = null;

  if (principalTrainerId) {
    trainer = await prisma.trainer.findUnique({
      where: { id: principalTrainerId },
      select: {
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        statut: true,
        tarifJourneeHtCents: true,
        sousTraitantNda: true,
        adresseProfessionnelle: true,
      },
    });
  }

  const identite = await getOrganismeIdentite();

  // 🔴 REFUS plutôt que fabrication d'un nom.
  //
  // Le repli historique était en cascade : formateur résolu → sinon un nom lu
  // dans le Json brut → sinon LA RAISON SOCIALE DE L'ORGANISME. La dernière
  // branche produisait une lettre de mission désignant « Axion-IA » comme
  // formateur — une pièce d'indicateur 21 qui nomme une personne morale là où
  // elle doit nommer une personne physique.
  //
  // ⚠️ Et la branche du milieu était morte pour toute donnée bien formée :
  // `parseCoFormateurs` n'accepte que `trainerId`, tandis que le repli lisait
  // `id`, `nom` et `prenom` — des champs que les entrées courantes ne portent
  // pas. On tombait donc directement sur la raison sociale.
  //
  // Depuis que la lettre est SIGNABLE, l'incohérence devient visible : le
  // service de signature refuse un signataire non résolvable (il ne scelle
  // jamais une identité fabriquée), si bien que le générateur produisait une
  // pièce que personne ne pouvait signer. Mieux vaut refuser de l'émettre.
  //
  // Impact MESURÉ avant ce changement, pas supposé : une seule session sans
  // formateur principal en production, son `co_formateurs` est vide, et AUCUNE
  // lettre de mission n'a jamais été émise. On retire donc le défaut avant son
  // premier cas réel.
  const nomPrenom = trainer
    ? `${trainer.prenom} ${trainer.nom}`.trim()
    : premierRaw?.prenom && premierRaw?.nom
      ? `${premierRaw.prenom} ${premierRaw.nom}`.trim()
      : "";
  if (nomPrenom === "") {
    return {
      error:
        "Aucun formateur n'est rattaché à cette session : une lettre de mission doit nommer la personne qui reçoit la mission. Désignez le formateur principal, puis régénérez la lettre.",
    };
  }

  // 🔴 Réservée aux SOUS-TRAITANTS (2026-08-01). Le document s'intitule
  // « Lettre de mission formateur sous-traitant » et le générateur ne regardait
  // pas le statut : un salarié recevait la même lettre — sans fondement, son
  // contrat de travail couvre déjà l'animation — et le dirigeant se serait
  // confié une mission à lui-même. (Statut inconnu = formateur legacy résolu
  // depuis le Json seul : on n'invente pas un refus sur une donnée absente.)
  if (trainer !== null) {
    const refus = refusLettreSelonStatut(trainer.statut, nomPrenom);
    if (refus !== null) return { error: refus };
  }

  const tarifJourHt = trainer?.tarifJourneeHtCents ? trainer.tarifJourneeHtCents / 100 : 0;

  // 🔴 La rémunération vient du barème RÉSOLU — le même `resolveRegle` que la
  // paie mensuelle (`statements.ts`). Avant ce branchement, la lettre imprimait
  // le tarif générique de la fiche pendant que la paie appliquait la règle :
  // deux chiffres contradictoires possibles sur une pièce SIGNÉE.
  const regles = principalTrainerId ? await chargerReglesRemuneration(principalTrainerId) : [];
  const remunerations = compresserRemunerations([
    {
      intitule: session.titreSession,
      libelle: libelleRemuneration(
        principalTrainerId
          ? resolveRegle(regles, {
              trainerId: principalTrainerId,
              prestationType: "formation_collective",
              interventionSlug: session.formation.slug,
              date: new Date(session.dateDebut),
            })
          : null,
        trainer?.tarifJourneeHtCents ?? null,
      ),
    },
  ]);

  const doc = await generateDocument({
    type: "lettre_mission",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(LettreMissionPdf, {
        data: {
          numero,
          formateur: {
            nomPrenom,
            email: trainer?.email ?? identite.email,
            ...(trainer?.telephone !== null && trainer?.telephone !== undefined
              ? { telephone: trainer.telephone }
              : {}),
            // Adresse PROFESSIONNELLE — la ligne était systématiquement absente
            // faute de champ en base, sur une pièce qui doit identifier les
            // deux parties.
            ...(trainer?.adresseProfessionnelle ? { adresse: trainer.adresseProfessionnelle } : {}),
            specialite: "Formation Intelligence Artificielle",
            // Sans lui, le gabarit qualifie TOUT intervenant de « mandataire
            // sous-traitant » — faux pour le dirigeant qui anime lui-même.
            ...(trainer?.statut ? { statut: trainer.statut } : {}),
            ...(trainer?.sousTraitantNda !== null && trainer?.sousTraitantNda !== undefined
              ? { siretOuSirenOuNaf: trainer.sousTraitantNda }
              : {}),
          },
          objetMission:
            "Animation de la formation professionnelle continue dans le cadre du programme pédagogique défini par l'organisme de formation.",
          formations: [
            {
              intitule: session.titreSession,
              dateDebut: formatDate(new Date(session.dateDebut)),
              dateFin: formatDate(new Date(session.dateFin)),
              // Le lieu RÉEL prime sur la modalité : c'est là que le formateur
              // doit se rendre. Repli sur la modalité seule quand aucun lieu
              // n'est saisi — comportement historique, jamais un « — » nu.
              lieuOuModalite: formatLieu(session) ?? modaliteLabel(session.modalite),
              dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
            },
          ],
          tarifJourHt,
          remunerations,
          dateMission: formatDateFr(new Date()),
        },
        identite,
      }),
    // `trainerId` en plus de la session : c'est lui qui rend la pièce
    // retrouvable et signable sans détour par la session (cf. lettre-cadre).
    refs: { sessionId, ...(principalTrainerId !== null ? { trainerId: principalTrainerId } : {}) },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.lettre_mission.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

/**
 * Refus de la lettre selon le statut du formateur — `null` si elle est due.
 *
 * Le message explique le POURQUOI : un bouton qui refuse sans dire pour qui la
 * pièce existe pousserait l'admin à contourner, pas à comprendre.
 */
function refusLettreSelonStatut(statut: string, nomPrenom: string): string | null {
  if (statut === "salarie") {
    return `${nomPrenom} est enregistré comme salarié : son contrat de travail couvre déjà l'animation, une lettre de mission de sous-traitance n'a pas de fondement pour lui. Elle est réservée aux formateurs sous-traitants.`;
  }
  if (statut === "dirigeant") {
    return `${nomPrenom} est le dirigeant-formateur de l'organisme : il ne peut pas se confier une mission à lui-même par lettre de sous-traitance. Ses compétences se justifient par CV et diplômes (indicateur 21).`;
  }
  return null;
}

/**
 * Règles de rémunération du formateur, converties pour `resolveRegle`.
 * (Conversion Decimal→number : jamais de `Decimal` hors de Prisma.)
 */
async function chargerReglesRemuneration(trainerId: string): Promise<RegleRemuneration[]> {
  const rules = await prisma.trainerCompensationRule.findMany({ where: { trainerId } });
  return rules.map((r) => {
    const base: RegleRemuneration = {
      trainerId: r.trainerId,
      prestationType: r.prestationType,
      interventionSlug: r.interventionSlug,
      model: r.model,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
    };
    if (r.tauxJourneeHtCents !== null) base.tauxJourneeHtCents = r.tauxJourneeHtCents;
    if (r.tauxHoraireHtCents !== null) base.tauxHoraireHtCents = r.tauxHoraireHtCents;
    if (r.forfaitHtCents !== null) base.forfaitHtCents = r.forfaitHtCents;
    if (r.commissionPct !== null) base.commissionPct = r.commissionPct.toNumber();
    return base;
  });
}

/**
 * Une seule ligne quand toutes les formations partagent le même barème —
 * répéter dix fois la même phrase ferait chercher une différence qui n'existe
 * pas. Dès qu'un libellé diffère, chaque formation garde sa ligne nominative.
 */
function compresserRemunerations(lignes: LigneRemuneration[]): LigneRemuneration[] {
  if (lignes.length > 1 && lignes.every((l) => l.libelle === lignes[0]!.libelle)) {
    return [{ intitule: null, libelle: lignes[0]!.libelle }];
  }
  return lignes;
}

/** `yyyy-mm-dd` (input date) → Date UTC minuit. Le schéma zod garantit la forme. */
function dateDepuisIso(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const lettreCadreListeSchema = z.object({
  sessionId: z.string().uuid(),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const lettreCadreSchema = lettreCadreListeSchema
  .extend({
    sessionIds: z.array(z.string().uuid()).max(100).default([]),
    // Coachings 1-to-1 (conseil) et audits (Will 2026-08-01 : « on peut avoir
    // des sous-traitants aussi » sur ces prestations). Optionnels — une
    // lettre-cadre peut ne couvrir que des formations, que des coachings, ou un
    // mélange.
    coachingIds: z.array(z.string().uuid()).max(100).default([]),
    auditIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .refine((v) => v.sessionIds.length + v.coachingIds.length + v.auditIds.length > 0, {
    message: "Aucune prestation sélectionnée",
  });

/** Ligne candidate renvoyée à l'écran de composition de la lettre-cadre. */
interface PrestationCandidate {
  id: string;
  numero: string;
  titre: string;
  du: string;
  au: string;
}

/**
 * Prestations candidates à une lettre-CADRE : formations collectives, coachings
 * 1-to-1 (conseil) et audits de la période dont l'intervenant est le formateur
 * principal de la session d'origine.
 *
 * ⚠️ Sessions : pré-filtre SQL large (FK OU affectation), recoupé en mémoire
 * par `resolvePrincipalTrainerId` — le même motif que
 * `lireLettresMissionDuFormateur`, seul le résolveur sait retomber sur le Json
 * legacy. Coachings et audits portent une FK directe, pas de résolveur.
 */
export async function listerSessionsLettreCadreAction(input: {
  sessionId: string;
  dateDebut: string;
  dateFin: string;
}): Promise<
  ActionResult<{
    formateur: string;
    sessions: PrestationCandidate[];
    coachings: PrestationCandidate[];
    audits: PrestationCandidate[];
  }>
> {
  await requireAdminWrite();
  if (isStub()) return { error: "Indisponible en mode build (stub)" };

  const parsed = lettreCadreListeSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, dateDebut, dateFin } = parsed.data;
  if (dateDebut > dateFin) return { error: "La date de début est postérieure à la date de fin." };

  const origine = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { formateurPrincipalId: true, coFormateurs: true },
  });
  if (!origine) return { error: "Session introuvable" };
  const trainerId = resolvePrincipalTrainerId(origine);
  if (trainerId === null) {
    return {
      error:
        "Aucun formateur principal n'est désigné sur cette session : désignez-le d'abord, la lettre-cadre est établie à son nom.",
    };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { nom: true, prenom: true, statut: true },
  });
  if (!trainer) return { error: "Formateur introuvable" };
  const nomPrenom = `${trainer.prenom} ${trainer.nom}`.trim();
  const refus = refusLettreSelonStatut(trainer.statut, nomPrenom);
  if (refus !== null) return { error: refus };

  const debut = dateDepuisIso(dateDebut);
  const finExclue = dateDepuisIso(dateFin);
  finExclue.setUTCDate(finExclue.getUTCDate() + 1);

  const [candidates, coachings, audits] = await Promise.all([
    prisma.trainingSession.findMany({
      where: {
        dateDebut: { gte: debut, lt: finExclue },
        OR: [{ formateurPrincipalId: trainerId }, { sessionFormateurs: { some: { trainerId } } }],
      },
      orderBy: { dateDebut: "asc" },
      select: {
        id: true,
        numero: true,
        titreSession: true,
        dateDebut: true,
        dateFin: true,
        formateurPrincipalId: true,
        coFormateurs: true,
      },
    }),
    prisma.coachingSession.findMany({
      where: { trainerId, dateSeance: { gte: debut, lt: finExclue } },
      orderBy: { dateSeance: "asc" },
      select: {
        id: true,
        interventionSlug: true,
        dateSeance: true,
        dateSeanceFin: true,
        beneficiaireEntreprise: true,
      },
    }),
    prisma.auditMission.findMany({
      where: { formateurId: trainerId, dateDebut: { gte: debut, lt: finExclue } },
      orderBy: { dateDebut: "asc" },
      select: { id: true, numero: true, titre: true, dateDebut: true, dateFin: true },
    }),
  ]);

  return {
    data: {
      formateur: nomPrenom,
      sessions: candidates
        .filter((s) => resolvePrincipalTrainerId(s) === trainerId)
        .map((s) => ({
          id: s.id,
          numero: s.numero,
          titre: s.titreSession,
          du: formatDate(new Date(s.dateDebut)),
          au: formatDate(new Date(s.dateFin)),
        })),
      coachings: coachings.map((c) => ({
        id: c.id,
        numero: "",
        // L'entreprise, jamais le NOM du bénéficiaire : l'écran de composition
        // n'a pas besoin d'exposer une personne physique.
        titre: `${coachingInterventionLabel(c.interventionSlug)}${
          c.beneficiaireEntreprise ? ` (${c.beneficiaireEntreprise})` : ""
        }`,
        du: formatDate(new Date(c.dateSeance)),
        au: formatDate(new Date(c.dateSeanceFin ?? c.dateSeance)),
      })),
      audits: audits.map((a) => ({
        id: a.id,
        numero: a.numero,
        titre: a.titre,
        du: formatDate(new Date(a.dateDebut)),
        au: formatDate(new Date(a.dateFin)),
      })),
    },
  };
}

/**
 * Génère une lettre de mission-CADRE : UNE lettre, UNE signature du
 * sous-traitant, couvrant toutes les formations cochées de la période.
 *
 * Décision Will 2026-08-01 (« les deux, au choix au moment de générer ») : la
 * lettre par session reste `genererLettreMissionAction`, inchangée ; celle-ci
 * s'y ajoute pour le formateur récurrent — à 200 formateurs, une signature par
 * session ne tient pas.
 *
 * 🔴 La pièce est ancrée par `refs.trainerId`, PAS par une session : c'est ce
 * rattachement que l'espace formateur et l'action de signature lisent. Les
 * sessions couvertes vivent dans `metadata.lettreCadre` — affichage et
 * rapprochement console, jamais l'autorisation.
 *
 * ⚠️ La liste reçue du client est REVALIDÉE session par session : chacune doit
 * avoir pour formateur principal celui de la lettre. Sans ce recoupement, un
 * identifiant étranger glissé dans la requête ferait signer au sous-traitant
 * une formation qui ne lui est pas confiée.
 */
export async function genererLettreMissionCadreAction(input: {
  sessionId: string;
  dateDebut: string;
  dateFin: string;
  sessionIds?: string[];
  coachingIds?: string[];
  auditIds?: string[];
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = lettreCadreSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, dateDebut, dateFin, sessionIds, coachingIds, auditIds } = parsed.data;
  if (dateDebut > dateFin) return { error: "La date de début est postérieure à la date de fin." };

  const origine = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { formateurPrincipalId: true, coFormateurs: true },
  });
  if (!origine) return { error: "Session introuvable" };
  const trainerId = resolvePrincipalTrainerId(origine);
  if (trainerId === null) {
    return {
      error:
        "Aucun formateur principal n'est désigné sur cette session : désignez-le d'abord, la lettre-cadre est établie à son nom.",
    };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      statut: true,
      tarifJourneeHtCents: true,
      sousTraitantNda: true,
      adresseProfessionnelle: true,
    },
  });
  if (!trainer) return { error: "Formateur introuvable" };
  const nomPrenom = `${trainer.prenom} ${trainer.nom}`.trim();
  const refus = refusLettreSelonStatut(trainer.statut, nomPrenom);
  if (refus !== null) return { error: refus };

  // Liste vide = pas de requête : `in: []` rendrait [] de toute façon, et les
  // trois familles sont indépendantes.
  const [sessions, coachings, audits] = await Promise.all([
    sessionIds.length === 0
      ? []
      : prisma.trainingSession.findMany({
          where: { id: { in: sessionIds } },
          orderBy: { dateDebut: "asc" },
          select: {
            id: true,
            numero: true,
            titreSession: true,
            dateDebut: true,
            dateFin: true,
            modalite: true,
            ...LIEU_DOCUMENT_SELECT,
            formateurPrincipalId: true,
            coFormateurs: true,
            formationSnapshot: true,
            formation: { select: { slug: true, dureeHeures: true } },
          },
        }),
    coachingIds.length === 0
      ? []
      : prisma.coachingSession.findMany({
          where: { id: { in: coachingIds } },
          orderBy: { dateSeance: "asc" },
          select: {
            id: true,
            trainerId: true,
            interventionSlug: true,
            dateSeance: true,
            dateSeanceFin: true,
            beneficiaireEntreprise: true,
            ...LIEU_DOCUMENT_SELECT,
          },
        }),
    auditIds.length === 0
      ? []
      : prisma.auditMission.findMany({
          where: { id: { in: auditIds } },
          orderBy: { dateDebut: "asc" },
          select: {
            id: true,
            numero: true,
            titre: true,
            formateurId: true,
            dateDebut: true,
            dateFin: true,
            dureeHeures: true,
            ...LIEU_DOCUMENT_SELECT,
          },
        }),
  ]);
  if (
    sessions.length !== sessionIds.length ||
    coachings.length !== coachingIds.length ||
    audits.length !== auditIds.length
  ) {
    return { error: "Une des prestations sélectionnées est introuvable. Rechargez la liste." };
  }
  // 🔴 Chaque prestation doit appartenir au formateur de la lettre — les
  // sessions via le résolveur (Json legacy), coachings et audits via leur FK.
  const etrangere = sessions.find((s) => resolvePrincipalTrainerId(s) !== trainerId);
  if (etrangere !== undefined) {
    return {
      error: `La session ${etrangere.numero} n'a pas ${nomPrenom} pour formateur principal : elle ne peut pas figurer sur sa lettre de mission.`,
    };
  }
  if (coachings.some((c) => c.trainerId !== trainerId)) {
    return {
      error: `Un des coachings sélectionnés n'est pas animé par ${nomPrenom} : il ne peut pas figurer sur sa lettre de mission.`,
    };
  }
  const auditEtranger = audits.find((a) => a.formateurId !== trainerId);
  if (auditEtranger !== undefined) {
    return {
      error: `L'audit ${auditEtranger.numero} n'est pas confié à ${nomPrenom} : il ne peut pas figurer sur sa lettre de mission.`,
    };
  }

  const identite = await getOrganismeIdentite();
  const regles = await chargerReglesRemuneration(trainerId);

  /** Heures d'un créneau, 0 si la fin manque (le gabarit affichera « — »). */
  const heuresCreneau = (debut: Date, fin: Date | null): number => {
    if (fin === null) return 0;
    const h = (fin.getTime() - debut.getTime()) / 3_600_000;
    return h > 0 ? Math.round(h * 10) / 10 : 0;
  };

  const formations: FormationConfiee[] = [
    ...sessions.map((s) => {
      const formationDoc = readFormationForDocs(s.formationSnapshot, s.formation);
      return {
        intitule: s.titreSession,
        dateDebut: formatDate(new Date(s.dateDebut)),
        dateFin: formatDate(new Date(s.dateFin)),
        lieuOuModalite: formatLieu(s) ?? modaliteLabel(s.modalite),
        dureeHeures: formationDoc.dureeHeures ?? s.formation.dureeHeures,
      };
    }),
    // L'ENTREPRISE bénéficiaire, jamais le nom de la personne accompagnée : la
    // lettre part chez le sous-traitant, elle n'a pas à porter l'identité d'un
    // tiers physique que le protocole AFEST couvre déjà.
    ...coachings.map((c) => ({
      intitule: `Coaching 1-to-1 — ${coachingInterventionLabel(c.interventionSlug)}${
        c.beneficiaireEntreprise ? ` (${c.beneficiaireEntreprise})` : ""
      }`,
      dateDebut: formatDate(new Date(c.dateSeance)),
      dateFin: formatDate(new Date(c.dateSeanceFin ?? c.dateSeance)),
      lieuOuModalite: formatLieu(c) ?? "—",
      dureeHeures: heuresCreneau(new Date(c.dateSeance), c.dateSeanceFin),
    })),
    ...audits.map((a) => ({
      intitule: `Audit — ${a.titre}`,
      dateDebut: formatDate(new Date(a.dateDebut)),
      dateFin: formatDate(new Date(a.dateFin)),
      lieuOuModalite: formatLieu(a) ?? "—",
      dureeHeures: a.dureeHeures ?? 0,
    })),
  ];
  const remunerations = compresserRemunerations([
    ...sessions.map((s) => ({
      intitule: s.titreSession,
      libelle: libelleRemuneration(
        resolveRegle(regles, {
          trainerId,
          prestationType: "formation_collective",
          interventionSlug: s.formation.slug,
          date: new Date(s.dateDebut),
        }),
        trainer.tarifJourneeHtCents,
      ),
    })),
    ...coachings.map((c) => ({
      intitule: `Coaching 1-to-1 — ${coachingInterventionLabel(c.interventionSlug)}`,
      libelle: libelleRemuneration(
        resolveRegle(regles, {
          trainerId,
          prestationType: "coaching_1to1",
          interventionSlug: c.interventionSlug,
          date: new Date(c.dateSeance),
        }),
        trainer.tarifJourneeHtCents,
      ),
    })),
    ...audits.map((a) => ({
      intitule: `Audit — ${a.titre}`,
      libelle: libelleRemuneration(
        resolveRegle(regles, {
          trainerId,
          prestationType: "audit",
          interventionSlug: null,
          date: new Date(a.dateDebut),
        }),
        trainer.tarifJourneeHtCents,
      ),
    })),
  ]);

  const doc = await generateDocument({
    type: "lettre_mission",
    buildElement: (numero) =>
      React.createElement(LettreMissionPdf, {
        data: {
          numero,
          formateur: {
            nomPrenom,
            email: trainer.email,
            ...(trainer.telephone !== null ? { telephone: trainer.telephone } : {}),
            ...(trainer.adresseProfessionnelle ? { adresse: trainer.adresseProfessionnelle } : {}),
            specialite: "Formation Intelligence Artificielle",
            // Sans lui, le gabarit qualifie TOUT intervenant de « mandataire
            // sous-traitant » — faux pour le dirigeant qui anime lui-même.
            ...(trainer?.statut ? { statut: trainer.statut } : {}),
            ...(trainer.sousTraitantNda !== null
              ? { siretOuSirenOuNaf: trainer.sousTraitantNda }
              : {}),
          },
          objetMission:
            "Animation et réalisation des prestations listées ci-dessous (formations professionnelles continues, accompagnements individuels, audits le cas échéant), dans le cadre des programmes et référentiels définis par l'organisme de formation.",
          periode: {
            du: formatDateFr(dateDepuisIso(dateDebut)),
            au: formatDateFr(dateDepuisIso(dateFin)),
          },
          formations,
          tarifJourHt: trainer.tarifJourneeHtCents ? trainer.tarifJourneeHtCents / 100 : 0,
          remunerations,
          dateMission: formatDateFr(new Date()),
        },
        identite,
      }),
    refs: { trainerId },
    metadata: {
      lettreCadre: {
        du: dateDebut,
        au: dateFin,
        sessionIds: sessions.map((s) => s.id),
        coachingIds: coachings.map((c) => c.id),
        auditIds: audits.map((a) => a.id),
      },
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.lettre_mission_cadre.genere",
    targetType: "Trainer",
    targetId: trainerId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      du: dateDebut,
      au: dateFin,
      sessions: sessions.length,
      coachings: coachings.length,
      audits: audits.length,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Règlement intérieur (L.6352-3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le règlement intérieur des stagiaires.
 * Document de session (joint à la convocation).
 */
export async function genererReglementInterieurAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  const resultat = await produireReglementInterieur(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.reglement_interieur.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: resultat.documentId, numero: resultat.numero },
    session: adminSession,
  });

  return { data: { documentId: resultat.documentId, numero: resultat.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 13 bis. Programme de l'action de formation (annexe de la convention)
// ─────────────────────────────────────────────────────────────────────────────

// `NIVEAU_LABELS` et `sanctionLabel` vivent dans `production/producteurs.ts`
// (cf. import en tête) — partagés avec le worker S5.

/**
 * Génère le programme de l'action de formation d'une session.
 *
 * 🔴 C'est l'annexe que la convention annonce en section « Documents annexés »
 * depuis l'origine, et que rien ne produisait — pour aucune des formations du
 * catalogue. C'est aussi l'une des trois pièces exigées à l'appui de la
 * déclaration d'activité (art. R.6351-5), avec la première convention signée et
 * la liste des intervenants.
 *
 * Les données pédagogiques viennent du SNAPSHOT via `readFormationForDocs`,
 * exactement comme la convention : les deux pièces d'un même dossier décrivent
 * ainsi la même action, même si la formation est refondue plus tard.
 */
export async function genererProgrammeAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  // La construction (snapshot légal WS5, modules, sanction) vit dans
  // `production/producteurs.ts`, partagée avec le worker S5.
  const resultat = await produireProgramme(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.programme.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: {
      documentId: resultat.documentId,
      numero: resultat.numero,
      // Traçabilité utile en cas de contestation : d'où vient ce qui est imprimé,
      // et le découpage était-il structuré au moment de l'édition.
      ...(resultat.details ?? {}),
    },
    session: adminSession,
  });

  return { data: { documentId: resultat.documentId, numero: resultat.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 13 bis. Organisation de l'action (art. R.6351-5, indicateurs 9 et 12)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le PROGRAMME dit ce qui est enseigné ; cette pièce dit QUAND, OÙ et COMMENT.
 * Le calendrier vient de `session_jours` — les mêmes horaires que l'émargement,
 * pour que deux pièces d'un même dossier ne se contredisent jamais.
 */
export async function genererOrganisationActionAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  // La construction (calendrier `session_jours`, rythme calculé) vit dans
  // `production/producteurs.ts`, partagée avec le worker S5.
  const resultat = await produireOrganisationAction(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.organisation_action.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: {
      documentId: resultat.documentId,
      numero: resultat.numero,
      ...(resultat.details ?? {}),
    },
    session: adminSession,
  });

  return { data: { documentId: resultat.documentId, numero: resultat.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Livret d'accueil stagiaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le livret d'accueil stagiaire pour une session.
 * Les contacts pédagogiques sont lus depuis la SiteSetting ou depuis le
 * formateur principal de la session.
 */
export async function genererLivretAccueilAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  const resultat = await produireLivretAccueil(sessionId, {
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
  });
  if (!resultat.ok) return { error: resultat.motif };

  await logQualiopiActivity({
    action: "qualiopi.document.livret_accueil.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: resultat.documentId, numero: resultat.numero },
    session: adminSession,
  });

  return { data: { documentId: resultat.documentId, numero: resultat.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. Inventaire des moyens pédagogiques (A14 — off.17/18/19)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère l'inventaire des moyens pédagogiques et techniques (doc A14).
 * Document officiel numéroté (AXI-FORM) — snapshot de la table
 * `moyens_pedagogiques` à date (actifs ET retirés, statut affiché : la
 * traçabilité des moyens retirés est une valeur d'audit).
 */
export async function genererInventaireMoyensAction(): Promise<
  ActionResult<{ documentId: string; numero: string }>
> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const moyens = await listMoyens({ take: 1000 });
  if (moyens.length === 0) {
    return { error: "Aucun moyen pédagogique enregistré — inventaire vide non générable" };
  }

  const identite = await getOrganismeIdentite();
  const dateEdition = formatDateFr(new Date());

  const doc = await generateDocument({
    type: "inventaire_moyens",
    buildElement: (numero) =>
      React.createElement(InventaireMoyensPdf, {
        data: {
          numero,
          dateEdition,
          moyens: moyens.map((m) => ({
            categorie: m.categorie,
            libelle: m.libelle,
            description: m.description,
            localisation: m.localisation,
            actif: m.actif,
            dateVerification: m.dateVerification
              ? m.dateVerification.toLocaleDateString("fr-FR")
              : "",
          })),
        },
        identite,
      }),
  });

  await logQualiopiActivity({
    action: "qualiopi.document.inventaire_moyens.genere",
    targetType: "DocumentGenere",
    targetId: doc.id,
    changes: { documentId: doc.id, numero: doc.numero, nbMoyens: moyens.length },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 15 bis. Autorisation de captation (art. 9 C. civ. + RGPD)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Autorisation d'image et de voix d'UN stagiaire, pour UNE action.
 *
 * 🔴 Pièce SÉPARÉE des contrats à dessein. Un consentement doit être LIBRE :
 * enfoui dans la convention, le refus serait indissociable du refus de la
 * formation, et la CNIL écarte les consentements qui conditionnent l'accès à un
 * service. La pièce dit d'ailleurs noir sur blanc que refuser n'a aucune
 * conséquence — c'est cette phrase qui la rend valable.
 *
 * ⚠️ Les finalités sont ÉNUMÉRÉES, jamais génériques : « toute utilisation par
 * l'organisme » n'est pas un consentement spécifique, c'est un blanc-seing, et
 * il est nul. Les valeurs par défaut couvrent les usages réels de l'organisme ;
 * l'appelant peut les restreindre, jamais les remplacer par un mot creux.
 */
export async function genererAutorisationCaptationAction(input: {
  enrollmentId: string;
  finalites?: string[];
  supports?: string[];
  dureeAnnees?: number;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = z
    .object({
      enrollmentId: z.string().uuid(),
      finalites: z.array(z.string().min(3).max(200)).max(10).optional(),
      supports: z.array(z.string().min(3).max(200)).max(10).optional(),
      dureeAnnees: z.number().int().min(1).max(10).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, finalites, supports, dureeAnnees } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert({ enrollmentId });
  if (!verrou.ok) return verrou;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, nom: true, prenom: true, entreprise: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          modalite: true,
          ...LIEU_DOCUMENT_SELECT,
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const { trainee, session } = enrollment;
  // 🔴 I17-01 — l'autorisation imprime le lieu de l'action : pas de lieu qui
  // dise où, pas de pièce.
  const refusLieu = refusEmissionLieu(session);
  if (refusLieu !== null) return { error: refusLieu };
  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "autorisation_captation",
    identite,
    buildElement: (numero) =>
      React.createElement(AutorisationCaptationPdf, {
        data: {
          numero,
          personne: {
            nomPrenom: `${trainee.prenom} ${trainee.nom}`,
            qualite: "Stagiaire",
            ...(trainee.entreprise ? { entreprise: trainee.entreprise } : {}),
          },
          intitule: session.titreSession,
          dateAction: formatDate(session.dateDebut),
          lieu: resolveLieuDocument(session, identite),
          dateEdition: formatDateFr(new Date()),
          finalites: finalites ?? [
            "Illustrer les supports de formation et les comptes rendus pédagogiques de l'organisme",
            "Améliorer la qualité des prestations par l'analyse interne des séances",
            "Présenter l'activité de l'organisme sur son site internet et ses supports de communication",
          ],
          supports: supports ?? [
            "Supports pédagogiques et documents internes de l'organisme",
            "Site internet de l'organisme",
            "Comptes de l'organisme sur les réseaux sociaux professionnels",
          ],
          dureeAnnees: dureeAnnees ?? 3,
        },
        identite,
      }),
    // `traineeId` fait partie de l'IDENTITÉ de la pièce : un consentement est
    // individuel. Sans lui, la détection de régénération marquerait « copie »
    // les autorisations des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.autorisation_captation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero, traineeId: trainee.id },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 15 ter. Liste des formateurs et qualifications (R.6351-5, indicateur 21)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La LISTE des intervenants — à ne pas confondre avec `cv_formateur`, qui est
 * une FICHE par personne. Le formulaire de déclaration d'activité et
 * l'indicateur 21 réclament une liste : qui intervient, à quel titre, en lien
 * avec quelles prestations, sous quel lien contractuel.
 *
 * 🔴 Seuls les intervenants ACTIFS sont listés. Un formateur désactivé
 * n'intervient plus ; le faire figurer sur une pièce qui décrit l'effectif
 * courant serait une déclaration inexacte, dans le sens le plus embarrassant —
 * annoncer des moyens humains dont on ne dispose pas.
 */
export async function genererListeFormateursAction(): Promise<
  ActionResult<{ documentId: string; numero: string }>
> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  // 🔴 `pedagogiquesSeulement` AJOUTÉ LE 2026-09-13. Cette liste est une PIÈCE
  // D'AUDIT : elle prouve les moyens humains de l'organisme. Une secrétaire, un
  // responsable marketing ou un développeur web y figurant serait présenté au
  // certificateur comme un intervenant — et le document NOMME les gens.
  const trainers = await listTrainers({ actifOnly: true, pedagogiquesSeulement: true });
  if (trainers.length === 0) {
    return {
      error:
        "Aucun intervenant actif enregistré — une liste vide ne prouverait aucun moyen humain. Renseignez au moins un formateur avant de générer la liste.",
    };
  }

  // Intitulés des formations habilitées, résolus en UNE requête pour tous les
  // intervenants : un `findMany` par formateur ferait N+1 sur une page admin.
  //
  // 🔴 Vérification du plan 2026-08-19 : cette résolution ne filtrait PAS les
  // formations archivées, alors que `listTrainers` filtre déjà les habilitations
  // retirées. La liste annonçait donc un `nbHabilitations` établi sur un critère
  // et citait des intitulés établis sur un autre — un formateur pouvait y être
  // crédité de 2 habilitations dont une retirée de l'offre. La fiche formateur,
  // elle, filtre les deux : confrontées, les deux pièces du même dossier ne
  // disaient pas la même chose (c'est le défaut F11).
  //
  // Le filtre est celui, unique, de `trainers.ts` — pas une troisième recopie.
  const tousIds = [...new Set(trainers.flatMap((t) => t.formationIdsHabilites))];
  const formations =
    tousIds.length > 0
      ? await prisma.formation.findMany({
          where: { id: { in: tousIds }, ...FORMATION_AU_CATALOGUE_WHERE },
          select: { id: true, titre: true },
        })
      : [];
  const titreParId = new Map(formations.map((f) => [f.id, f.titre]));

  // Un CV SOURCE validé, jamais `Trainer.cvUrl` : ce dernier pointe vers la
  // FICHE produite par l'organisme, qui ne prouve rien sur les compétences —
  // c'est le raisonnement déjà tenu par `genererCvFormateurAction`.
  //
  // 🔴 Audit initial 2026-09-14 (constat I21-02, relecture PR #1085) : le
  // `groupBy` comptait tout CV VALIDÉ, avec ou sans fichier, expiré ou non — et
  // la liste remise à l'auditrice imprimait « CV au dossier ». Le prédicat
  // partagé tranche : un CV sans fichier n'est pas au dossier.
  const maintenantListe = new Date();
  const cvParTrainer = new Map<string, number>();
  const cvs = await prisma.trainerDocument.findMany({
    where: { ...prefiltrePieceCompetenceProbante(maintenantListe), type: "cv" },
    select: { trainerId: true, ...SELECT_PIECE_COMPETENCE },
  });
  for (const c of cvs) {
    if (!estPieceCompetenceProbante(c, maintenantListe)) continue;
    cvParTrainer.set(c.trainerId, (cvParTrainer.get(c.trainerId) ?? 0) + 1);
  }

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "liste_formateurs",
    identite,
    buildElement: (numero) =>
      React.createElement(ListeFormateursPdf, {
        data: {
          numero,
          dateEdition: formatDateFr(new Date()),
          formateurs: trainers.map((t) => {
            const domaines = Array.isArray(t.domainesCompetences)
              ? (t.domainesCompetences as unknown[]).filter(
                  (d): d is string => typeof d === "string",
                )
              : [];
            // Les intitulés DÉCLARABLES, résolus une seule fois : le nombre
            // imprimé et les exemples imprimés doivent sortir du MÊME ensemble.
            // Compter d'un côté (`t.nbHabilitations`, filtré `retireAt` seul) et
            // citer de l'autre (filtré `archive`) était exactement l'incohérence
            // que l'auditrice relève en confrontant les deux colonnes.
            const titresDeclarables = t.formationIdsHabilites
              .map((id) => titreParId.get(id))
              .filter((titre): titre is string => typeof titre === "string");
            return {
              nomPrenom: `${t.prenom} ${t.nom}`,
              statut: t.statut,
              domaines,
              nbHabilitations: titresDeclarables.length,
              // Trois suffisent à montrer le LIEN avec les prestations : la
              // liste exhaustive de 57 intitulés noierait la pièce.
              exemplesHabilitations: titresDeclarables.slice(0, 3),
              cvAuDossier: (cvParTrainer.get(t.id) ?? 0) > 0,
              ...(t.sousTraitantNda ? { sousTraitantNda: t.sousTraitantNda } : {}),
              depuis: t.dateEmbauche ? formatDate(t.dateEmbauche) : "",
            };
          }),
        },
        identite,
      }),
  });

  await logQualiopiActivity({
    action: "qualiopi.document.liste_formateurs.genere",
    targetType: "DocumentGenere",
    targetId: doc.id,
    changes: { documentId: doc.id, numero: doc.numero, nbFormateurs: trainers.length },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. Contrat de sous-traitance (indicateur 27 — L.6316-3)
// ─────────────────────────────────────────────────────────────────────────────

const sousTraitantIdSchema = z.object({ sousTraitantId: z.string().uuid() });

/**
 * Génère le contrat de sous-traitance écrit d'un sous-traitant du registre
 * (indicateur 27). Précise les missions confiées (depuis `objetPrestation`) et
 * porte la clause de vérification de la conformité RNQ (la date de vérification
 * data.gouv.fr est reportée depuis le registre). Document officiel numéroté
 * (AXI-FORM).
 *
 * La rémunération en honoraires n'est pas stockée au registre : une modalité par
 * défaut (facturation par mission) est portée au contrat, à affiner par l'OF.
 */
export async function genererContratSousTraitanceAction(input: {
  sousTraitantId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sousTraitantIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sousTraitantId } = parsed.data;

  const sousTraitant = await getSousTraitant(sousTraitantId);
  if (!sousTraitant) return { error: "Sous-traitant introuvable" };

  const identite = await getOrganismeIdentite();

  // Missions : `objetPrestation` peut contenir plusieurs lignes (une par mission).
  const missions = sousTraitant.objetPrestation
    .split("\n")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  const doc = await generateDocument({
    type: "contrat_sous_traitance",
    identite,
    // 🔴 Sans ce rattachement, la pièce n'était reliée au sous-traitant par RIEN :
    // impossible, depuis un `documents_generes.id`, de savoir à qui adresser le
    // lien de signature. Le contact ajouté sur la fiche serait resté
    // inatteignable.
    refs: { sousTraitantId },
    buildElement: (numero) =>
      React.createElement(ContratSousTraitancePdf, {
        data: {
          numero,
          sousTraitant: {
            nom: sousTraitant.nom,
            ...(sousTraitant.siret !== null ? { siret: sousTraitant.siret } : {}),
            ...(sousTraitant.nda !== null ? { nda: sousTraitant.nda } : {}),
          },
          missions,
          dateDebut: formatDateFr(sousTraitant.contratSigneAt ?? new Date()),
          remuneration:
            "Honoraires précisés par mission (devis / bon de commande), facturés après réalisation.",
          conformiteVerifieeAt: sousTraitant.verifieDataGouvAt
            ? formatDateFr(new Date(sousTraitant.verifieDataGouvAt))
            : "",
          dateContrat: formatDateFr(new Date()),
          // 🔑 AUCUNE clause de médiation ici, et ce n'est pas un oubli : la
          // médiation de la consommation vise le professionnel face à un
          // CONSOMMATEUR. Un contrat de sous-traitance lie deux professionnels.
          // Le motif de recherche qui a servi à câbler le contrat individuel
          // touchait aussi ce fichier-ci — « une règle juste appliquée au
          // pluriel dispense d'examiner le voisin » est le défaut le plus
          // fréquent de ce dépôt, et il s'est présenté ici même.
        },
        identite,
      }),
  });

  await logQualiopiActivity({
    action: "qualiopi.document.contrat_sous_traitance.genere",
    targetType: "SousTraitant",
    targetId: sousTraitantId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fiche formateur versée au dossier de preuves (ind. 21)
// ─────────────────────────────────────────────────────────────────────────────

const trainerIdSchema = z.object({ trainerId: z.string().uuid() });

/** Libellés des actions de développement des compétences (ind. 22). */
const DEV_ACTION_LABELS: Record<string, string> = {
  entretien_professionnel: "Entretien professionnel",
  formation_suivie: "Formation suivie",
  veille: "Veille",
  autre: "Autre",
};

/**
 * Verse la fiche formateur au dossier de preuves et ferme la boucle ind. 21.
 *
 * À distinguer de `genererCvFormateurAction` (`exports-pdf.ts`), qui produit un
 * PDF ÉPHÉMÈRE téléchargé par le navigateur, sans numéro ni rétention. Ici le
 * document est officiel : numéro séquentiel immuable, hash SHA-256, stockage R2,
 * conservation — et surtout `Trainer.cvUrl` pointe ensuite vers sa route de
 * téléchargement stable, ce qui rend l'indicateur 21 couvert.
 *
 * L'indicateur 21 est à non-conformité MAJEURE même en cas de manquement partiel :
 * sa couverture (`conformite-service.ts`) exige un formateur actif dont `cvUrl`
 * est non nul et `cvUploadedAt` de moins de 24 mois. Les deux sont posés ici.
 *
 * ⚠️ Le référentiel exige que la MAÎTRISE des compétences soit « vérifiée par le
 * prestataire », pas seulement qu'un CV existe. Ce document matérialise cette
 * vérification en rattachant explicitement les compétences aux formations
 * habilitées ; il ne dispense pas de tenir cette vérification à jour.
 */
export async function verserFicheFormateurAction(input: {
  trainerId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : la fiche formateur materialise la verification des competences (ind. 21/22).
  const adminSession = await requireHabilitation("habiliter_formateur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = trainerIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { trainerId } = parsed.data;

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      actif: true,
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      statut: true,
      cvUrl: true,
      domainesCompetences: true,
      formationsHabilitees: true,
      dateEmbauche: true,
      // 2026-08-10 : `afestHabiliteAt` n'est plus lu — le bloc « Habilitation
      // AFEST » a été retiré de la fiche formateur (1-to-1 = conseil, décision Will).
      sousTraitantNda: true,
      adresseProfessionnelle: true,
      sousTraitantVerifieAt: true,
    },
  });
  if (!trainer) return { error: "Formateur introuvable" };

  // Un formateur désactivé ne compte pas pour l'indicateur 21 (`conformite-service`
  // filtre sur `actif: true`) : verser sa fiche ne couvrirait rien et laisserait
  // une pièce orpheline au dossier.
  if (!trainer.actif) {
    return { error: "Formateur désactivé : réactivez-le avant de verser sa fiche." };
  }

  // Titres des formations habilitées, lus depuis `TrainerHabilitation` — la source
  // qui fait foi pour la garde d'assignation.
  //
  // 🔴 Audit certification 2026-07-25 (F11) : cette résolution interrogeait
  // `formation.id IN trainer.formationsHabilitees`, or la colonne legacy contient
  // des SLUGS en production. Elle ne résolvait donc RIEN, et le CV formateur —
  // pièce de preuve de l'indicateur 21 — sortait sans aucune habilitation, pendant
  // que la liste des formateurs en annonçait 33. Deux pièces du même dossier se
  // contredisaient.
  //
  // 🔴 Audit blanc 2026-08-15 : cette requête ne portait AUCUN filtre de statut.
  // La fiche versée au dossier énumérait 57 formations habilitées quand le
  // catalogue en comptait 22 — une trentaine d'intitulés retirés de l'offre y
  // figuraient encore. La pièce remise à l'auditrice habilitait donc
  // l'intervenant sur des prestations qui n'existent plus, et sur-déclarait son
  // périmètre de 159 %, alors que la liste se compare directement au catalogue.
  //
  // 🔴 Vérification du plan 2026-08-19 : ce filtre était écrit ICI à la main, et
  // il lui MANQUAIT `retireAt: null`. Depuis le 2026-08-17 la dé-habilitation
  // horodate la ligne au lieu de la supprimer : la pièce VERSÉE AU REGISTRE —
  // preuve de l'indicateur 21 — déclarait donc l'intervenant habilité sur des
  // prestations dont l'habilitation avait été RETIRÉE. Le filtre vient
  // désormais de `whereHabilitationsDeclarables`, l'unique définition partagée
  // avec l'export direct et la liste des intervenants (cf. `trainers.ts`).
  //
  // ⚠️ Le filtre ne supprime RIEN en base : la ligne `TrainerHabilitation`
  // subsiste (retirée ou sur formation archivée) et reste lisible par
  // l'auditeur. Il n'écarte du DOCUMENT que ce qui n'est plus déclarable.
  const habilitations = await prisma.trainerHabilitation.findMany({
    where: whereHabilitationsDeclarables(trainer.id),
    select: { formation: { select: { titre: true } } },
    orderBy: { formation: { titre: "asc" } },
  });
  const titresHabilitations: string[] = habilitations.map((h) => h.formation.titre);

  // Actions d'entretien / développement des compétences (ind. 22).
  //
  // 🔴 Audit blanc 2026-08-15 : la mention légale au pied de la fiche affirmait
  // « synthétise […] l'entretien de ces compétences (indicateur 22) » sans en
  // restituer UNE SEULE ligne. Une pièce qui annonce une preuve qu'elle ne porte
  // pas est pire qu'une pièce muette : elle oriente l'auditeur vers un constat.
  // Les actions sont donc listées, et leur absence est écrite noir sur blanc
  // plutôt que passée sous silence (`[]` → section rendue avec le constat).
  const actionsDeveloppementRaw = await prisma.trainerDevelopmentAction.findMany({
    where: { trainerId: trainer.id },
    orderBy: { dateAction: "desc" },
    // Borne haute défensive : la fiche est une synthèse, pas un journal. 50
    // lignes couvrent très largement les 3 ans de cycle de certification.
    take: 50,
    select: { type: true, dateAction: true, description: true },
  });
  const actionsDeveloppement = actionsDeveloppementRaw.map((a) => ({
    date: formatDateFr(a.dateAction),
    type: DEV_ACTION_LABELS[a.type] ?? a.type,
    description: a.description,
  }));

  const identite = await getOrganismeIdentite();
  const maintenant = new Date();

  // `cvJoint` = un CV SOURCE est-il versé au dossier du formateur ?
  // Surtout PAS `trainer.cvUrl != null` : au premier versement ce champ est encore
  // nul, la fiche imprimerait donc « CV non joint »… alors qu'elle EST la pièce,
  // et `cvUrl` pointera vers elle une seconde plus tard. Le même document
  // affirmerait deux choses opposées selon l'ordre des clics.
  // 🔴 Audit initial 2026-09-14 (constat I21-02) : un CV validé SANS fichier, ou
  // EXPIRÉ, faisait imprimer « CV joint » — une affirmation que la pièce ne tient
  // pas. Le prédicat partagé tranche, comme pour la couverture de l'indicateur.
  const cvSources = await prisma.trainerDocument.findMany({
    where: { ...prefiltrePieceCompetenceProbante(maintenant), trainerId, type: "cv" },
    select: SELECT_PIECE_COMPETENCE,
  });
  const nbCvSource = cvSources.filter((c) => estPieceCompetenceProbante(c, maintenant)).length;

  // 🔴 #1 — off.21 est une NON-CONFORMITÉ MAJEURE : « la maîtrise des compétences
  // des intervenants est VÉRIFIÉE ». Verser une fiche VIDE (aucune compétence, aucune
  // habilitation, aucun CV source) posait quand même `cvUrl` → l'indicateur passait
  // VERT sur un clic, sans rien prouver. On refuse : une fiche qui ne documente rien
  // ne peut pas attester d'une maîtrise. ⚠️ NOTE JURISTE : que des compétences
  // SAISIES constituent une maîtrise « vérifiée » reste un arbitrage (le contrôle
  // peut exiger des pièces sources) — cette garde n'écarte que le cas totalement vide.
  const aDesCompetences =
    Array.isArray(trainer.domainesCompetences) && trainer.domainesCompetences.length > 0;
  // 🔴 Lit `titresHabilitations` — ce que la fiche IMPRIME — et non le tableau
  // legacy `trainer.formationsHabilitees`, qui compte aussi les formations
  // archivées (et, historiquement, des ids orphelins). Sur cet écart la garde ne
  // gardait plus rien : un formateur habilité sur 30 formations toutes retirées
  // du catalogue la franchissait, et la fiche sortait sans une seule
  // habilitation tout en posant `cvUrl` — indicateur 21 vert sur une pièce vide.
  const aDesHabilitations = titresHabilitations.length > 0;
  if (!aDesCompetences && !aDesHabilitations && nbCvSource === 0) {
    return {
      error:
        "Fiche non versée : ce formateur n'a ni domaine de compétence, ni habilitation sur une formation du catalogue en vigueur, ni CV source. Renseignez sa maîtrise (indicateur 21) avant de verser sa fiche au dossier.",
    };
  }

  const data = {
    ...buildCvFormateurData(trainer, titresHabilitations, maintenant),
    // Écrase la déduction faite depuis `cvUrl` : ici on COMPTE les CV sources
    // validés, la seule lecture qui ne confonde pas un CV téléversé avec la
    // fiche que cette action s'apprête à produire.
    cvJoint: nbCvSource > 0,
    pieceCompetences: nbCvSource > 0 ? ("cv_televerse" as const) : ("fiche_organisme" as const),
    actionsDeveloppement,
  };

  let doc: { id: string; numero: string };
  try {
    doc = await generateDocument({
      type: "cv_formateur",
      buildElement: () => React.createElement(CvFormateurPdf, { data, identite }),
      identite,
    });
  } catch (err) {
    // `generateDocument` peut lever : identité d'organisme incomplète, échec de
    // rendu react-pdf, R2 indisponible. Sans ce filet, l'exception remontait
    // brute au client React et l'admin voyait une erreur générique au lieu de
    // la cause — alors que toutes les autres actions du fichier retournent
    // `{ error }`.
    return {
      error:
        err instanceof Error
          ? `Génération de la fiche impossible : ${err.message}`
          : "Génération de la fiche impossible.",
    };
  }

  // Fermeture de la boucle ind. 21 : `cvUrl` pointe vers la route stable de
  // téléchargement du document (signature R2 à la demande), et non vers une URL
  // signée qui expirerait, ni vers une clé R2 brute illisible au manifeste d'audit.
  //
  // URL ABSOLUE : `updateTrainerSchema` valide `cvUrl` en `z.string().url()`, et
  // le manifeste d'audit imprime cette valeur telle quelle pour l'auditeur — un
  // chemin relatif y serait non résolvable.
  const baseUrl = (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(
    /\/+$/,
    "",
  );
  try {
    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        cvUrl: `${baseUrl}/api/qualiopi/documents/${doc.id}`,
        cvUploadedAt: maintenant,
      },
    });
  } catch {
    // Le document EXISTE désormais au dossier (numéro consommé, PDF conservé)
    // mais la boucle n'est pas fermée : l'indicateur 21 restera non couvert.
    // On le dit explicitement plutôt que de laisser croire à un succès.
    return {
      error: `Fiche générée (${doc.numero}) mais le formateur n'a pas pu être mis à jour. Relancez le versement.`,
    };
  }

  await logQualiopiActivity({
    action: "qualiopi.formateur.fiche.versee",
    targetType: "Trainer",
    targetId: trainerId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      nbCompetences: data.domainesCompetences.length,
      // Habilitations RETENUES (catalogue en vigueur) — c'est ce chiffre qui doit
      // se retrouver sur la pièce, et donc dans la trace.
      nbHabilitations: titresHabilitations.length,
      nbActionsDeveloppement: actionsDeveloppement.length,
      pieceCompetences: data.pieceCompetences,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Procédure de sous-traitance (indicateur 27)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Version de la procédure. À INCRÉMENTER dès qu'un article du gabarit change,
 * sans quoi deux tirages portant le même numéro de version diraient des choses
 * différentes — et c'est exactement ce qu'un auditeur relève.
 */
const PROCEDURE_SOUS_TRAITANCE_VERSION = "1.0";

/**
 * Génère la procédure écrite des dispositions en matière de sous-traitance et de
 * co-traitance (indicateur 27).
 *
 * 🔴 Cette pièce vivait HORS application, dans un fichier Markdown relu à la
 * main : la première chose que l'auditeur demande sur l'indicateur 27 n'était ni
 * numérotée, ni horodatée, ni versée au registre des documents. Toutes les
 * autres pièces Qualiopi se génèrent d'un bouton ; celle-ci exigeait d'ouvrir un
 * fichier, de l'imprimer et de le signer.
 *
 * Le texte est figé dans le gabarit : une procédure qualité n'est pas un
 * formulaire, ses articles engagent l'organisme et doivent être identiques d'une
 * édition à l'autre. Seuls varient l'identité, la version, la date et le
 * signataire.
 *
 * Aucun `refs` : la procédure ne se rattache à AUCUN sous-traitant — elle vaut
 * avant le premier recours, c'est tout son intérêt au regard de l'indicateur.
 */
export async function genererProcedureSousTraitanceAction(): Promise<
  ActionResult<{ documentId: string; numero: string }>
> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const identite = await getOrganismeIdentite();

  // Le signataire vient de la configuration, jamais d'une saisie libre : une
  // procédure approuvée par « l'organisme » sans personne physique identifiée
  // n'engage personne, et c'est un défaut déjà relevé sur les attestations.
  const [dirigeantNom, dirigeantFonction] = await Promise.all([
    getQualiopiConfig("dirigeant_nom").catch(() => ""),
    getQualiopiConfig("dirigeant_fonction").catch(() => ""),
  ]);

  const signataireNom =
    typeof dirigeantNom === "string" && dirigeantNom.trim() !== ""
      ? dirigeantNom.trim()
      : identite.raisonSociale;
  const signataireQualite =
    typeof dirigeantFonction === "string" && dirigeantFonction.trim() !== ""
      ? dirigeantFonction.trim()
      : "Nom, qualité, signature et cachet";

  const doc = await generateDocument({
    type: "procedure_sous_traitance",
    identite,
    buildElement: (numero) =>
      React.createElement(ProcedureSousTraitancePdf, {
        data: {
          numero,
          version: PROCEDURE_SOUS_TRAITANCE_VERSION,
          applicableLe: formatDateFr(new Date()),
          signataireNom,
          signataireQualite,
        },
        identite,
      }),
  });

  await logQualiopiActivity({
    action: "qualiopi.document.procedure_sous_traitance.genere",
    targetType: "DocumentGenere",
    targetId: doc.id,
    changes: { numero: doc.numero, version: PROCEDURE_SOUS_TRAITANCE_VERSION },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 24. Annulation d'une pièce au registre
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Longueur minimale du motif — alignée sur la contrainte `CHECK` de la
 * migration. Une seule règle, écrite deux fois parce qu'aucune des deux couches
 * ne peut faire confiance à l'autre ; qu'elles disent la MÊME chose est ce qui
 * évite qu'un motif accepté par le formulaire fasse planter l'écriture.
 */
const MOTIF_ANNULATION_MIN = 10;

const annulerDocumentSchema = z.object({
  documentId: z.string().uuid(),
  motif: z.string().trim().min(MOTIF_ANNULATION_MIN).max(500),
});

/**
 * Annule une pièce au registre : elle reste, elle cesse de faire foi.
 *
 * ## Pourquoi une annulation et pas une suppression
 *
 * Trois raisons, et aucune n'est théorique.
 *
 * **Le numéro est alloué dans une série continue** (CGI, art. 242 nonies A
 * ann. II). Supprimer la ligne laisse un trou, et un trou dans une série
 * documentaire est précisément ce qu'un contrôle relève — la purge de test du
 * 02/08 en a déjà laissé deux (`AXI-DOC` commence à 002, `AXI-ATT` à 003).
 *
 * **La pièce peut porter une signature réelle.** `AXI-DOC-2026-007`, celle qui
 * motive cette action, est `statut_signature = signee`. Supprimer la pièce
 * effacerait la preuve d'un acte qui a bel et bien eu lieu.
 *
 * **Une annulation motivée est une démonstration de maîtrise.** Une
 * contradiction interne laissée en place est un constat ; la même contradiction
 * annulée, datée et motivée montre au contraire un processus qui se corrige.
 * C'est pour ça que le motif est OBLIGATOIRE, ici comme en base.
 *
 * ⚠️ N'annule PAS les signatures portées par la pièce. Elles restent au registre
 * des signatures : la personne a signé, ce fait ne se réécrit pas. C'est la
 * VALEUR de la pièce qui tombe, pas l'historique.
 *
 * ⚠️ En revanche elle RÉVOQUE les liens de signature encore en circulation. Ils
 * survivaient à l'annulation : le tiers qui avait reçu le sien par e-mail
 * pouvait encore signer, des jours après. Rien d'une faille — le lien et son
 * porteur étaient légitimes — mais la signature déclenche des CONSÉQUENCES
 * AUTOMATIQUES (envoi des questionnaires de positionnement à des stagiaires
 * réels, bascule d'un devis en `accepte`), sans qu'aucun écran humain
 * s'interpose. `signerDocument` refuse désormais de fond ; couper le lien évite
 * en plus au signataire un geste inutile.
 */
export async function annulerDocumentAction(input: {
  documentId: string;
  motif: string;
}): Promise<ActionResult<{ numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Annulation désactivée en mode build (stub)" };

  const parsed = annulerDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: `Motif obligatoire (${MOTIF_ANNULATION_MIN} caractères minimum) — il est lu par l'auditeur.`,
    };
  }
  const { documentId, motif } = parsed.data;
  // ADR 0060 — écriture VERROU : refusée sur un dossier clos.
  const verrou = await assertDossierOuvert({ documentId });
  if (!verrou.ok) return verrou;

  // 🔴 ADR 0060 (D7) — annuler une pièce qui porte une signature retire sa
  // valeur à un engagement SIGNÉ : même exigence que la révocation d'une
  // signature (direction seule), même hors verrou.
  const signaturesVivantes = await prisma.documentSignature.count({
    where: { documentGenereId: documentId, revokedAt: null },
  });
  if (signaturesVivantes > 0 && !peutEngager(adminSession.role, "revoquer_signature")) {
    return {
      error:
        `Cette pièce porte ${signaturesVivantes} signature${signaturesVivantes > 1 ? "s" : ""} : ` +
        MOTIF_REFUS.revoquer_signature,
    };
  }

  const doc = await prisma.documentGenere.findUnique({
    where: { id: documentId },
    select: { id: true, numero: true, annuleeAt: true },
  });
  if (doc === null) return { error: "Pièce introuvable" };
  // Refus explicite plutôt que ré-écriture silencieuse : réannuler écraserait
  // la date et le motif d'origine, c'est-à-dire la trace même qu'on cherche à
  // produire.
  if (doc.annuleeAt !== null) return { error: `La pièce ${doc.numero} est déjà annulée.` };

  // L'auteur est nommé, jamais réduit à un identifiant : « annulée par
  // 4f3a-… » ne dit rien à un auditeur. Repli sur le rôle si le compte n'a pas
  // de nom — mieux vaut « Administrateur » qu'un UUID.
  const auteur = await prisma.adminUser.findUnique({
    where: { id: adminSession.userId },
    select: { name: true },
  });
  const annuleePar =
    typeof auteur?.name === "string" && auteur.name.trim() !== ""
      ? auteur.name.trim()
      : adminSession.role;

  await prisma.documentGenere.update({
    where: { id: documentId },
    data: { annuleeAt: new Date(), annuleeMotif: motif, annuleePar },
  });

  // Les liens de signature encore vivants meurent avec la valeur de la pièce.
  //
  // ⚠️ APRÈS l'écriture, et FAIL-SOFT : l'annulation est l'acte que l'auditeur
  // lira, la révocation en découle. La perdre parce que la seconde a échoué
  // inverserait l'ordre d'importance — et `signerDocument` refuse de toute façon
  // une pièce annulée, quel que soit l'état du jeton.
  try {
    await revoquerTokensDocument({
      documentGenereId: documentId,
      motif: `Pièce annulée au registre : ${motif}`,
      parAdminId: adminSession.userId,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "annulerDocumentAction:revocation_liens" },
      extra: { documentId, numero: doc.numero },
    });
  }

  await logQualiopiActivity({
    action: "qualiopi.document.annulee",
    targetType: "DocumentGenere",
    targetId: documentId,
    changes: { numero: doc.numero, motif, annuleePar },
    session: adminSession,
  });

  return { data: { numero: doc.numero } };
}

/**
 * Relance la remise de l'exemplaire intégralement signé à ses signataires.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CE GESTE DOIT EXISTER — L'ALERTE LE PRESCRIVAIT DÉJÀ
 * ══════════════════════════════════════════════════════════════════════════
 *
 * La remise automatique a été livrée le 2026-09-06 (PR #997). Elle a UN seul
 * déclencheur : `consequenceSignatureComplete`, appelée AU MOMENT où la
 * dernière signature tombe (`piece-signature.ts:337`). Et
 * `exemplaireSigneEnvoyeAt` n'est posé qu'à l'intérieur de
 * `transmettreExemplaireSigne` elle-même.
 *
 * Conséquence, vérifiée appelant par appelant : **une pièce déjà
 * intégralement signée AVANT la livraison du correctif ne peut plus jamais
 * être remise.** Son moment de signature est passé, il ne reviendra pas.
 *
 * Le correctif fermait le chemin nominal — « les prochaines partiront-elles ? »
 * oui — et laissait le stock existant hors d'atteinte — « celles qui auraient
 * dû partir partiront-elles ? » non. Deux questions distinctes ; une seule
 * avait été posée.
 *
 * 🔑 Et l'alerte qui devait rattraper ce cas prescrivait un geste qui
 * n'existait pas. `regleExemplaireSigneNonTransmis` est `critique`, sans borne
 * basse, `resolutionAuto: true` — donc elle ne s'éteint QUE si
 * `exemplaireSigneEnvoyeAt` se pose. Son message se termine par :
 *
 *     « Rouvrez la pièce et relancez la remise. »
 *
 * Une alerte critique, inextinguible, qui ordonne l'impossible : c'est
 * exactement le mécanisme que son propre commentaire redoute — « le bruit
 * apprend à ignorer les critiques, c'est-à-dire l'unique fonction du
 * dispositif ». Cette action est la moitié manquante de cette phrase.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ UN GESTE D'ADMINISTRATION, PAS UN BALAYAGE AUTOMATIQUE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * L'autre sortie envisagée était un rattrapage au démarrage, ou un cron, qui
 * aurait vidé le stock d'un coup. Écartée délibérément : **il enverrait des
 * courriels contractuels à de vrais clients sans que personne ne l'ait
 * décidé**, et un doublon chez un client réel ne se rattrape pas. Ici
 * l'administrateur voit la pièce, voit à qui elle part, et clique.
 *
 * C'est aussi, mot pour mot, ce que la copie de l'alerte promet déjà.
 *
 * ⚠️ Sûre à rejouer. `transmettreExemplaireSigne` revendique la pièce
 * atomiquement (`updateMany where exemplaireSigneEnvoyeAt: null`, puis
 * `count === 0` → abandon) et relâche la revendication si le rendu ou
 * l'archivage échoue. Deux clics concurrents n'envoient qu'une fois.
 *
 * ⚠️ Cette action ne rejoue PAS `consequenceSignatureComplete`. Le hook fait
 * trois choses — la remise, l'envoi des questionnaires de positionnement, et
 * la bascule d'un devis en `accepte`. Un bouton nommé « relancer la remise »
 * qui enverrait aussi des questionnaires mentirait sur ce qu'il fait, et son
 * innocuité ne tiendrait qu'à l'idempotence des deux autres. On appelle la
 * fonction de remise, et elle seule.
 */
export async function relancerRemiseExemplaireAction(input: {
  documentId: string;
}): Promise<ActionResult<{ numero: string; destinataires: string[] }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Remise désactivée en mode build (stub)" };

  const documentId = typeof input?.documentId === "string" ? input.documentId.trim() : "";
  if (documentId === "") return { error: "Pièce non désignée." };

  const doc = await prisma.documentGenere.findUnique({
    where: { id: documentId },
    select: { id: true, numero: true },
  });
  if (doc === null) return { error: "Pièce introuvable" };

  const remise = await transmettreExemplaireSigne(documentId);

  if (!remise.ok) {
    // Chaque motif dit ce qui bloque ET ce qu'on peut y faire. « Échec de la
    // remise » renverrait l'administrateur au même point qu'avant le bouton.
    const messages: Record<typeof remise.motif, string> = {
      deja_transmis: `L'exemplaire de ${doc.numero} est déjà parti — rien n'a été renvoyé.`,
      pas_complete: `${doc.numero} n'est pas intégralement signée : il reste une partie à signer.`,
      annulee: `${doc.numero} est annulée au registre : elle ne fait plus foi, on ne la diffuse pas.`,
      aucun_destinataire: `Aucune partie signataire de ${doc.numero} ne porte d'adresse e-mail : il n'y a personne à qui remettre l'exemplaire.`,
      rendu_impossible: `Le PDF signé de ${doc.numero} n'a pas pu être reconstitué. La pièce reste transmissible : réessayez, et si l'échec persiste l'instantané de rendu est en cause.`,
      archivage_impossible: `L'archive R2 n'est pas joignable : un e-mail annonçant l'exemplaire sans le porter serait pire que pas d'e-mail. Rien n'a été envoyé, la pièce reste transmissible.`,
      file_indisponible: `La file d'e-mails n'a rien accepté. Rien n'est parti, la pièce reste transmissible — réessayez.`,
    };
    // Le journal porte AUSSI les échecs : une remise tentée et refusée est un
    // fait que l'auditeur peut avoir à lire, au même titre qu'une remise faite.
    await logQualiopiActivity({
      action: "qualiopi.document.exemplaire_remise_refusee",
      targetType: "DocumentGenere",
      targetId: documentId,
      changes: {
        numero: doc.numero,
        motif: remise.motif,
        ...(remise.detail ? { detail: remise.detail } : {}),
      },
      session: adminSession,
    });
    return { error: messages[remise.motif] };
  }

  await logQualiopiActivity({
    action: "qualiopi.document.exemplaire_remis",
    targetType: "DocumentGenere",
    targetId: documentId,
    changes: {
      numero: doc.numero,
      destinataires: [...remise.destinataires],
      relanceManuelle: true,
    },
    session: adminSession,
  });

  return { data: { numero: doc.numero, destinataires: [...remise.destinataires] } };
}
