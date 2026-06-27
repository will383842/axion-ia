/**
 * Qualiopi — Server Actions Génération Documentaire (T19 Cluster D).
 *
 * 14 actions — une par type de document réglementaire :
 *   convention, convention_tripartite, convocation, emargement,
 *   positionnement, grille_evaluation, satisfaction, certificat_realisation,
 *   kit_opco, kit_cpf, kit_france_travail, lettre_mission,
 *   reglement_interieur, livret_accueil.
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
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";

// Templates
import { ConventionPdf } from "@/server/qualiopi/documents/templates/convention";
import { ConventionTripartitePdf } from "@/server/qualiopi/documents/templates/convention-tripartite";
import { ContratFormationPdf } from "@/server/qualiopi/documents/templates/contrat-formation";
import { ConvocationPdf } from "@/server/qualiopi/documents/templates/convocation";
import { EmargementPdf } from "@/server/qualiopi/documents/templates/emargement";
import { PositionnementPdf } from "@/server/qualiopi/documents/templates/positionnement";
import { GrilleEvaluationPdf } from "@/server/qualiopi/documents/templates/grille-evaluation";
import { SatisfactionPdf } from "@/server/qualiopi/documents/templates/satisfaction";
import { CertificatRealisationPdf } from "@/server/qualiopi/documents/templates/certificat-realisation";
import { KitOpcoPdf } from "@/server/qualiopi/documents/templates/kit-opco";
import { KitCpfPdf } from "@/server/qualiopi/documents/templates/kit-cpf";
import { KitFranceTravailPdf } from "@/server/qualiopi/documents/templates/kit-france-travail";
import { LettreMissionPdf } from "@/server/qualiopi/documents/templates/lettre-mission";
import { ReglementInterieurPdf } from "@/server/qualiopi/documents/templates/reglement-interieur";
import { LivretAccueilPdf } from "@/server/qualiopi/documents/templates/livret-accueil";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STUB = "stub.invalid";

function isStub(): boolean {
  return process.env.DATABASE_URL?.includes(STUB) ?? false;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR");
}

function modaliteLabel(
  m: "presentiel" | "distanciel" | "hybride",
): "Présentiel" | "Distanciel" | "Mixte" {
  if (m === "presentiel") return "Présentiel";
  if (m === "distanciel") return "Distanciel";
  return "Mixte";
}

function modaliteLabelLower(
  m: "presentiel" | "distanciel" | "hybride",
): "présentiel" | "distanciel" | "mixte" {
  if (m === "presentiel") return "présentiel";
  if (m === "distanciel") return "distanciel";
  return "mixte";
}

/** Extrait le 1er co-formateur d'un champ Json coFormateurs. */
async function resolveFormateurNom(coFormateurs: unknown, fallback: string): Promise<string> {
  const arr = Array.isArray(coFormateurs) ? coFormateurs : [];
  const premier = arr[0] as { id?: string; nom?: string; prenom?: string } | undefined;
  if (premier?.id) {
    try {
      const t = await prisma.trainer.findUnique({
        where: { id: premier.id },
        select: { nom: true, prenom: true },
      });
      if (t) return `${t.prenom} ${t.nom}`.trim();
    } catch {
      // fall through
    }
  }
  if (premier?.nom) {
    return [premier.prenom, premier.nom].filter(Boolean).join(" ");
  }
  return fallback;
}

/** Extrait les objectifs pédagogiques depuis un champ Json. */
function parseObjectifs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o: unknown) => {
    if (typeof o === "string") return o;
    if (typeof o === "object" && o !== null && "description" in o) {
      return String((o as { description: unknown }).description);
    }
    return String(o);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const sessionIdSchema = z.object({ sessionId: z.string().uuid() });
const enrollmentIdSchema = z.object({ enrollmentId: z.string().uuid() });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Convention de formation (L.6353-1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la convention de formation professionnelle bipartite (L.6353-1).
 * Basée sur les données de la session + formation + client.
 */
export async function genererConventionAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      nbParticipantsPrevus: true,
      montantHtCents: true,
      formationSnapshot: true,
      formation: {
        select: {
          objectifsPedagogiques: true,
          dureeHeures: true,
          offreSite: { select: { publicViseFr: true } },
        },
      },
      client: {
        select: {
          raisonSociale: true,
          siret: true,
          adresse: true,
          contactNom: true,
          contactEmail: true,
        },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };
  if (!session.client)
    return { error: "Session sans client — impossible de générer la convention" };

  const identite = await getOrganismeIdentite();
  // Données formation depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);

  const doc = await generateDocument({
    type: "convention",
    buildElement: (numero) =>
      React.createElement(ConventionPdf, {
        data: {
          numero,
          client: {
            raisonSociale: session.client!.raisonSociale,
            siret: session.client!.siret ?? "—",
            adresse: session.client!.adresse ?? "—",
            contact: session.client!.contactNom ?? session.client!.contactEmail ?? "—",
          },
          intitule: session.titreSession,
          objectifs: objectifs.length > 0 ? objectifs : [session.titreSession],
          publicVise: session.formation.offreSite.publicViseFr,
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          modalite: modaliteLabel(session.modalite),
          lieu: identite.adresseExercice || identite.adresseSiege || "—",
          effectif: session.nbParticipantsPrevus,
          prixHt: session.montantHtCents / 100,
          dateConvention: formatDateFr(new Date()),
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.convention.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      nbParticipantsPrevus: true,
      montantHtCents: true,
      opcoSubrogation: true,
      numeroDossierOpco: true,
      priseEnChargeMontantCents: true,
      formationSnapshot: true,
      formation: {
        select: {
          objectifsPedagogiques: true,
          dureeHeures: true,
          offreSite: { select: { publicViseFr: true } },
        },
      },
      client: {
        select: {
          raisonSociale: true,
          siret: true,
          adresse: true,
          contactNom: true,
          contactEmail: true,
          opcoIdentifie: true,
          opcoNumeroAdherent: true,
        },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };
  if (!session.client) return { error: "Session sans client" };

  const identite = await getOrganismeIdentite();
  // Données formation depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  const nomOpco = session.client.opcoIdentifie ?? "OPCO (à préciser)";
  const numeroPriseEnCharge = session.numeroDossierOpco ?? session.client.opcoNumeroAdherent ?? "—";
  const montantPrisEnCharge = (session.priseEnChargeMontantCents ?? 0) / 100;
  const prixHt = session.montantHtCents / 100;

  const doc = await generateDocument({
    type: "convention_tripartite",
    buildElement: (numero) =>
      React.createElement(ConventionTripartitePdf, {
        data: {
          numero,
          client: {
            raisonSociale: session.client!.raisonSociale,
            siret: session.client!.siret ?? "—",
            adresse: session.client!.adresse ?? "—",
            contact: session.client!.contactNom ?? session.client!.contactEmail ?? "—",
          },
          opco: {
            nom: nomOpco,
            numeroPriseEnCharge,
          },
          intitule: session.titreSession,
          objectifs: objectifs.length > 0 ? objectifs : [session.titreSession],
          publicVise: session.formation.offreSite.publicViseFr,
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          modalite: modaliteLabel(session.modalite),
          lieu: identite.adresseExercice || identite.adresseSiege || "—",
          effectif: session.nbParticipantsPrevus,
          prixHt,
          montantPrisEnCharge,
          resteAChargeClient: Math.max(0, prixHt - montantPrisEnCharge),
          dateConvention: formatDateFr(new Date()),
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.convention_tripartite.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true, email: true, telephone: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          modalite: true,
          montantHtCents: true,
          formationSnapshot: true,
          formation: {
            select: {
              objectifsPedagogiques: true,
              dureeHeures: true,
            },
          },
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  // Données formation depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  const nomPrenom = `${trainee.prenom} ${trainee.nom}`.trim();

  const doc = await generateDocument({
    type: "contrat",
    buildElement: (numero) =>
      React.createElement(ContratFormationPdf, {
        data: {
          numero,
          stagiaire: {
            nomPrenom,
            ...(trainee.email ? { email: trainee.email } : {}),
            ...(trainee.telephone !== null && trainee.telephone !== undefined
              ? { telephone: trainee.telephone }
              : {}),
          },
          intitule: session.titreSession,
          objectifs: objectifs.length > 0 ? objectifs : [session.titreSession],
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          modalite: modaliteLabel(session.modalite),
          lieu: identite.adresseExercice || identite.adresseSiege || "—",
          prixNet: session.montantHtCents / 100,
          dateContrat: formatDateFr(new Date()),
        },
        identite,
      }),
    refs: { sessionId: session.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.contrat.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero, sessionId: session.id },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true, entreprise: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          modalite: true,
          formationSnapshot: true,
          formation: { select: { dureeHeures: true } },
          coFormateurs: true,
          numeroDossierOpco: true,
          financementType: true,
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  // Durée depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const formateurNom = await resolveFormateurNom(session.coFormateurs, identite.raisonSociale);

  const nomStagiaire = `${trainee.prenom} ${trainee.nom}`.trim();
  const financement = session.financementType ?? undefined;

  const doc = await generateDocument({
    type: "convocation",
    buildElement: (numero) =>
      React.createElement(ConvocationPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          horaires: "09h00–17h00",
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          modalite: modaliteLabelLower(session.modalite),
          nomFormateur: formateurNom,
          contactEmail: identite.email,
          nomStagiaire,
          ...(trainee.entreprise !== null && trainee.entreprise !== undefined
            ? { entreprise: trainee.entreprise }
            : {}),
          ...(financement !== null && financement !== undefined ? { financement } : {}),
          ...(session.numeroDossierOpco !== null && session.numeroDossierOpco !== undefined
            ? { numeroOrdrePriseEnCharge: session.numeroDossierOpco }
            : {}),
        },
        identite,
      }),
    refs: { sessionId: session.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.convocation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero, sessionId: session.id },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      modalite: true,
      coFormateurs: true,
      enrollments: {
        where: { statut: { notIn: ["exclu", "abandon"] } },
        select: {
          trainee: { select: { nom: true, prenom: true, entreprise: true } },
        },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  const formateurNom = await resolveFormateurNom(session.coFormateurs, identite.raisonSociale);

  const participants = session.enrollments.map((e) => ({
    nom: `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
    ...(e.trainee.entreprise !== null && e.trainee.entreprise !== undefined
      ? { entreprise: e.trainee.entreprise }
      : {}),
  }));

  const dateStr = formatDate(new Date(session.dateDebut));
  const jourSemaine = new Date(session.dateDebut).toLocaleDateString("fr-FR", {
    weekday: "long",
  });

  const doc = await generateDocument({
    type: "emargement",
    buildElement: (numero) =>
      React.createElement(EmargementPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          date: `${dateStr} (${jourSemaine})`,
          horaires: "09h00–17h00",
          lieu: identite.adresseExercice || identite.adresseSiege || "—",
          nomFormateur: formateurNom,
          nda: identite.nda,
          participants,
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.emargement.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero, nbParticipants: participants.length },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, titreSession: true, dateDebut: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "positionnement",
    buildElement: (numero) =>
      React.createElement(PositionnementPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          dateSession: formatDate(new Date(session.dateDebut)),
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.positionnement.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          coFormateurs: true,
          formation: { select: { objectifsPedagogiques: true } },
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  const formateurNom = await resolveFormateurNom(session.coFormateurs, identite.raisonSociale);
  const rawObjectifs = parseObjectifs(session.formation.objectifsPedagogiques);
  const competences =
    rawObjectifs.length > 0
      ? rawObjectifs.map((libelle) => ({ libelle }))
      : [{ libelle: session.titreSession }];

  const doc = await generateDocument({
    type: "grille_evaluation",
    buildElement: (numero) =>
      React.createElement(GrilleEvaluationPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          dateEvaluation: formatDate(new Date(session.dateDebut)),
          typeEvaluation: "finale",
          nomFormateur: formateurNom,
          nomStagiaire: `${trainee.prenom} ${trainee.nom}`.trim(),
          competences,
        },
        identite,
      }),
    refs: { sessionId: session.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.grille_evaluation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Questionnaire de satisfaction (indicateur Qualiopi n°31)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le questionnaire de satisfaction à chaud pour une session.
 */
export async function genererSatisfactionAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, titreSession: true, dateFin: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "satisfaction",
    buildElement: (numero) =>
      React.createElement(SatisfactionPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          dateSession: formatDate(new Date(session.dateFin)),
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.satisfaction.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      statut: true,
      tauxPresencePct: true,
      trainee: {
        select: {
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
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  // Conformité R.6313-3 : un certificat de réalisation atteste d'heures réellement
  // suivies. Un stagiaire en abandon ou exclu ne peut PAS recevoir de certificat
  // (cohérent avec l'attestation, cf. attestation-service.ts). Garde bloquante.
  if (enrollment.statut === "abandon" || enrollment.statut === "exclu") {
    return {
      error:
        "Certificat refusé : le stagiaire est en abandon/exclu. Aucun certificat de réalisation ne peut être émis (R.6313-3).",
    };
  }

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;

  // Durée réelle (R.6313-3) : préférer dureeReelleHeures, sinon durée prévue
  // pondérée par le taux de présence si disponible, sinon durée prévue.
  let dureeHeures = session.dureeReelleHeures ?? session.formation.dureeHeures;
  if (session.dureeReelleHeures === null && enrollment.tauxPresencePct !== null) {
    dureeHeures = Math.round((enrollment.tauxPresencePct * session.formation.dureeHeures) / 100);
  }

  const dirigeant = await getQualiopiConfig("dirigeant_nom");

  const doc = await generateDocument({
    type: "certificat_realisation",
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
          intituleAction: session.formation.titre,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          // ⚠️ dureeHeures en décimal — formatHeuresCentiemes appelé dans le template
          dureeHeures,
        },
      }),
    refs: { sessionId: session.id },
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      montantHtCents: true,
      priseEnChargeMontantCents: true,
      priseEnChargeUnite: true,
      numeroDossierOpco: true,
      enrollments: {
        where: { statut: { notIn: ["exclu", "abandon"] } },
        select: {
          trainee: { select: { nom: true, prenom: true } },
          session: {
            select: {
              dureeReelleHeures: true,
              formation: { select: { dureeHeures: true } },
            },
          },
        },
      },
      client: {
        select: { opcoIdentifie: true },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  const nomOpco = session.client?.opcoIdentifie ?? "OPCO (à préciser)";
  const numeroDossier = session.numeroDossierOpco ?? "—";
  const baremeCents = session.priseEnChargeMontantCents ?? 0;

  // Ventilation par participant
  const ventilation = session.enrollments.map((e) => {
    const dureeH = e.session.dureeReelleHeures ?? e.session.formation.dureeHeures;
    const prise = Math.round((baremeCents * dureeH) / 100) * 100;
    const prixTotal = session.montantHtCents;
    const parPart =
      session.enrollments.length > 0
        ? Math.round(prixTotal / session.enrollments.length)
        : prixTotal;
    const rac = Math.max(0, parPart - prise);
    return {
      nomParticipant: `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
      heuresRealisees: dureeH,
      baremePrisEnChargeHeureCents: baremeCents,
      montantPrisEnChargeCents: prise,
      resteAChargeCents: rac,
    };
  });

  const totalPrisEnCharge = ventilation.reduce((s, v) => s + v.montantPrisEnChargeCents, 0);
  const totalRac = ventilation.reduce((s, v) => s + v.resteAChargeCents, 0);

  const doc = await generateDocument({
    type: "kit_opco",
    buildElement: (numero) =>
      React.createElement(KitOpcoPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          nomOpco,
          numeroDossier,
          intituleFormation: session.titreSession,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          ventilation,
          totalPrisEnChargeCents: totalPrisEnCharge,
          totalResteAChargeCents: totalRac,
        },
      }),
    refs: { sessionId },
  });

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
// 10. Kit CPF / EDOF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le kit dossier CPF/EDOF pour un stagiaire inscrit.
 */
export async function genererKitCpfAction(input: {
  enrollmentId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
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
    refs: { sessionId: session.id },
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
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
    refs: { sessionId: session.id },
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      coFormateurs: true,
      formation: { select: { dureeHeures: true } },
    },
  });
  if (!session) return { error: "Session introuvable" };

  // Résolution du formateur principal
  const arr = Array.isArray(session.coFormateurs) ? session.coFormateurs : [];
  const premierRaw = arr[0] as { id?: string; nom?: string; prenom?: string } | undefined;
  let trainer: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    tarifJourneeHtCents: number | null;
    sousTraitantNda: string | null;
  } | null = null;

  if (premierRaw?.id) {
    trainer = await prisma.trainer.findUnique({
      where: { id: premierRaw.id },
      select: {
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        tarifJourneeHtCents: true,
        sousTraitantNda: true,
      },
    });
  }

  const identite = await getOrganismeIdentite();

  const nomPrenom = trainer
    ? `${trainer.prenom} ${trainer.nom}`.trim()
    : premierRaw?.prenom && premierRaw?.nom
      ? `${premierRaw.prenom} ${premierRaw.nom}`.trim()
      : identite.raisonSociale;

  const tarifJourHt = trainer?.tarifJourneeHtCents ? trainer.tarifJourneeHtCents / 100 : 0;

  const doc = await generateDocument({
    type: "lettre_mission",
    buildElement: (numero) =>
      React.createElement(LettreMissionPdf, {
        data: {
          numero,
          formateur: {
            nomPrenom,
            adresse: "—",
            email: trainer?.email ?? identite.email,
            ...(trainer?.telephone !== null && trainer?.telephone !== undefined
              ? { telephone: trainer.telephone }
              : {}),
            specialite: "Formation Intelligence Artificielle",
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
              lieuOuModalite: modaliteLabel(session.modalite),
              dureeHeures: session.formation.dureeHeures,
            },
          ],
          tarifJourHt,
          dateMission: formatDateFr(new Date()),
        },
        identite,
      }),
    refs: { sessionId },
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

// ─────────────────────────────────────────────────────────────────────────────
// 13. Règlement intérieur (L.6352-3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le règlement intérieur des stagiaires.
 * Document de session (joint à la convocation).
 */
export async function genererReglementInterieurAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  const dateVersion = formatDateFr(new Date());

  const doc = await generateDocument({
    type: "reglement_interieur",
    buildElement: (numero) =>
      React.createElement(ReglementInterieurPdf, {
        data: {
          numero,
          dateVersion,
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.reglement_interieur.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, coFormateurs: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  // Contact pédagogique — formateur principal ou identité OF
  const formateurNom = await resolveFormateurNom(session.coFormateurs, identite.raisonSociale);
  const dateVersion = formatDateFr(new Date());

  const doc = await generateDocument({
    type: "livret_accueil",
    buildElement: (numero) =>
      React.createElement(LivretAccueilPdf, {
        data: {
          numero,
          contactPedagogique: {
            nomPrenom: formateurNom,
            email: identite.email,
            ...(identite.telephone ? { telephone: identite.telephone } : {}),
          },
          dateVersion,
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.livret_accueil.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}
