/**
 * Qualiopi — Service RGPD stagiaire (T14 — AGENT A).
 *
 * exporterDonneesStagiaire : retourne un JSON complet de toutes les données du
 *                            stagiaire (droit d'accès RGPD art. 15).
 * supprimerStagiaire       : anonymise les PII + pose deletedAt (soft-delete).
 *                            PAS de DELETE physique (intégrité comptable/légale).
 * creerDemandeRgpd         : trace la demande en DB.
 *
 * Stub-aware : mutations lèvent si stub.invalid ; lectures retournent fallback.
 *
 * Règles non négociables :
 * - Suppression = anonymisation PII + deletedAt=now() (jamais DELETE physique).
 * - Export inclut le handicap déchiffré via decryptPii.
 * - exactOptionalPropertyTypes respecté.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import type { RgpdDemandeType } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export type { RgpdDemandeType };

export interface CreerDemandeRgpdResult {
  id: string;
  type: RgpdDemandeType;
  demandeAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// exporterDonneesStagiaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exporte toutes les données d'un stagiaire au format JSON (droit d'accès RGPD).
 *
 * Inclut : identité, inscriptions, évaluations, questionnaires, documents,
 * appréciations liées, situation handicap déchiffrée, parcours coaching 1-to-1 /
 * AFEST (séances + comptes-rendus, évaluations, cartographie, plan, journaux,
 * transitions, contrat de coaching).
 *
 * Stub-aware : retourne un objet vide si DATABASE_URL contient "stub.invalid".
 */
export async function exporterDonneesStagiaire(traineeId: string): Promise<object> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {};
  }

  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    include: {
      enrollments: {
        include: {
          session: {
            select: {
              numero: true,
              titreSession: true,
              dateDebut: true,
              dateFin: true,
              modalite: true,
            },
          },
          evaluations: true,
          questionnaires: true,
          presences: true,
        },
      },
      documents: true,
      appreciations: true,
      rgpdDemandes: true,
      // RGPD art. 15 — portabilité des parcours coaching 1-to-1 / AFEST.
      coachingSessions: {
        include: {
          comptesRendus: true,
          evaluations: true,
          cartographie: true,
          plan: true,
          journaux: true,
          transitions: true,
          coachingContract: true,
        },
      },
    },
  });

  if (trainee === null) return {};

  // Déchiffrer le détail handicap pour l'export (droit d'accès = données en clair)
  const handicapDetails =
    trainee.handicapDetailsChiffre !== null ? decryptPii(trainee.handicapDetailsChiffre) : null;

  return {
    exporteAt: new Date().toISOString(),
    stagiaire: {
      id: trainee.id,
      nom: trainee.nom,
      prenom: trainee.prenom,
      email: trainee.email,
      telephone: trainee.telephone ?? null,
      entreprise: trainee.entreprise ?? null,
      fonction: trainee.fonction ?? null,
      situationHandicap: trainee.situationHandicap,
      handicapDetails,
      consentementFormation: trainee.consentementFormation,
      consentementEmail: trainee.consentementEmail,
      consentementVersion: trainee.consentementVersion ?? null,
      consentementAt: trainee.consentementAt ?? null,
      createdAt: trainee.createdAt,
    },
    inscriptions: trainee.enrollments,
    documents: trainee.documents.map((d) => ({
      id: d.id,
      type: d.type,
      numero: d.numero,
      pdfUrl: d.pdfUrl ?? null,
      createdAt: d.createdAt,
    })),
    appreciations: trainee.appreciations,
    demandesRgpd: trainee.rgpdDemandes,
    // RGPD art.15 — parcours coaching 1-to-1 / AFEST du bénéficiaire.
    coachingSessions: trainee.coachingSessions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// supprimerStagiaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Anonymise les données PII du stagiaire et pose `deletedAt = now()`.
 *
 * Champs anonymisés : nom, prenom, email, telephone, handicapDetailsChiffre.
 * Côté coaching 1-to-1 / AFEST : PII bénéficiaire/tuteur des CoachingSession +
 * notes confidentielles des CompteRenduSeance (mêmes transaction).
 * L'enregistrement est conservé pour l'intégrité comptable et légale (documents,
 * inscriptions, émargements, heures réalisées, attestations).
 *
 * PAS de DELETE physique — conformément au droit à l'effacement RGPD art. 17
 * appliqué sous contrainte de conservation légale (art. 17§3b).
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function supprimerStagiaire(traineeId: string): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("supprimerStagiaire: stub DB — non disponible au build");
  }

  const anonymNom = "[supprime]";
  const anonymPrenom = "[supprime]";
  // Email anonymisé unique pour éviter la violation de contrainte UNIQUE.
  const anonymEmail = `supprime-${traineeId}@anonymise.invalid`;
  const now = new Date();

  await prisma.$transaction([
    prisma.trainee.update({
      where: { id: traineeId },
      data: {
        nom: anonymNom,
        prenom: anonymPrenom,
        email: anonymEmail,
        telephone: null,
        entreprise: null,
        fonction: null,
        situationHandicap: false,
        handicapDetailsChiffre: null,
        consentementFormation: false,
        consentementEmail: false,
        deletedAt: now,
      },
    }),
    // RGPD : révoquer TOUS les accès portail du stagiaire anonymisé. Sans cela un
    // lien portail encore valide (token 90 j) resterait exploitable et donnerait
    // accès à l'espace d'un stagiaire pourtant « supprimé ». (Audit E2E 2026-06.)
    prisma.portailAcces.updateMany({
      where: { traineeId, revoked: false },
      data: { revoked: true },
    }),
    // RGPD : anonymiser les parcours coaching 1-to-1 / AFEST du stagiaire. Les
    // séances sont conservées (agrégats légaux : heures réalisées, attestations,
    // émargements, financement OPCO) mais purgées des PII bénéficiaire/tuteur.
    prisma.coachingSession.updateMany({
      where: { traineeId },
      data: {
        beneficiaireNom: null,
        beneficiaireEmail: null,
        beneficiaireEntreprise: null,
        tuteurEntrepriseNom: null,
        tuteurEntrepriseEmail: null,
      },
    }),
    // RGPD : purger les notes confidentielles des comptes-rendus de séance
    // (champ libre potentiellement nominatif). Le reste du compte-rendu (durée,
    // objectifs, présence signée) est conservé pour l'intégrité légale AFEST.
    prisma.compteRenduSeance.updateMany({
      where: { coachingSession: { traineeId } },
      data: { notesConfidentielles: null },
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// creerDemandeRgpd
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trace une demande RGPD (export ou suppression) en base de données.
 *
 * La demande est créée avec le statut "demandee". Le traitement effectif
 * (export ou suppression) est déclenché par l'admin via les actions T14.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function creerDemandeRgpd(
  traineeId: string,
  type: RgpdDemandeType,
): Promise<CreerDemandeRgpdResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("creerDemandeRgpd: stub DB — non disponible au build");
  }

  const demande = await prisma.rgpdDemande.create({
    data: {
      traineeId,
      type,
      statut: "demandee",
      demandeAt: new Date(),
    },
    select: { id: true, type: true, demandeAt: true },
  });

  return { id: demande.id, type: demande.type, demandeAt: demande.demandeAt };
}
