// FICHE APPORTEUR NÉE D'UNE CANDIDATURE À UNE OFFRE D'EMPLOI — la création,
// partagée par deux portes (2026-09-28) :
//   · le bouton « Proposer le réseau d'apporteurs » de la fiche candidature
//     (`proposer-reseau-actions.ts`) ;
//   · le passage automatique du worker (`features/commercial-application/
//     invitation-auto.ts`) : toute candidature à une offre COMMERCIALE entre
//     dans le tunnel 15 minutes après sa réception (décision Will, 28/09).
//
// ⚠️ PAS de `import "server-only"` ni de `"use server"` : ce module est atteint
// par le worker (tsx, hors Next). La garde de rôle vit chez l'appelant.
//
// Sur le modèle EXACT de la saisie manuelle : données chiffrées, empreinte
// d'adresse, doublon détecté AVANT d'écrire, consentement NON simulé (la
// personne a consenti à l'étude d'une candidature à un poste, pas au réseau).
// 🔴 Aucune donnée personnelle en clair dans les journaux.

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { SubmissionSource, SubmissionType } from "../../../prisma/generated/client";
import { encryptPii, decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { ORIGINE_CANDIDATURE_OFFRE } from "@/lib/contact/accuse-attendu";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";
import { LEAD_APPORTEUR_ETAPE } from "@/lib/commercial-application/lead-apporteur";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";

/**
 * La fiche apporteur NÉE de cette candidature, si elle existe — par
 * `details.jobApplicationId`, posé à la création. Une fiche effacée ne compte
 * pas : elle ne se rouvre pas.
 *
 * Le filtre porte AUSSI l'origine : un `jobApplicationId` égaré dans une autre
 * sorte de fiche ne doit pas passer pour « réseau déjà proposé ».
 */
export async function ficheApporteurDeLaCandidature(
  applicationId: string,
): Promise<{ id: string; creeeLe: Date } | null> {
  const ligne = await prisma.submission.findFirst({
    where: {
      AND: [
        { details: { path: ["jobApplicationId"], equals: applicationId } },
        { details: { path: ["origine"], equals: ORIGINE_CANDIDATURE_OFFRE } },
      ],
      deletedAt: null,
    },
    select: { id: true, submittedAt: true },
    orderBy: { submittedAt: "asc" },
  });
  return ligne ? { id: ligne.id, creeeLe: ligne.submittedAt } : null;
}

export type IssueCreationFiche =
  | { ok: true; submissionId: string; deja?: true }
  | {
      ok: false;
      erreur: "introuvable" | "doublon" | "illisible" | "echec";
      /** Doublon : la fiche apporteur qui existe déjà pour cette adresse. */
      submissionId?: string;
    };

export async function creerFicheApporteurDepuisCandidature(input: {
  applicationId: string;
  /** Administrateur qui a cliqué ; `null` pour le passage automatique. */
  acteurId: string | null;
  /** Texte d'état posé dans `details.message`. */
  message: string;
  /** Passage automatique : la fiche est datée de la candidature, et marquée. */
  automatique?: boolean;
  /**
   * Proposition AUTOMATIQUE du réseau (2026-09-29, `server/careers/reponse-poste-pourvu.ts`) :
   * la fiche est datée d'aujourd'hui (l'invitation part tout de suite, par l'appelant),
   * sans `creationAutomatique` (le balayage `invitation-auto` ne la reprend donc pas),
   * et son origine est dite telle quelle — personne n'a cliqué.
   */
  proposition?: "poste-pourvu" | "spontanee-commerciale";
}): Promise<IssueCreationFiche> {
  const candidature = await prisma.jobApplication.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      offerTitleSnap: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      city: true,
      locale: true,
      submittedAt: true,
    },
  });
  if (!candidature) return { ok: false, erreur: "introuvable" };

  // ── IDEMPOTENCE : la fiche née de CETTE candidature, avant tout le reste.
  const existante = await ficheApporteurDeLaCandidature(candidature.id);
  if (existante) return { ok: true, deja: true, submissionId: existante.id };

  let prenom: string;
  let nom: string;
  let email: string;
  let telephone: string;
  try {
    prenom = decryptPii(candidature.firstName).trim();
    nom = decryptPii(candidature.lastName).trim();
    email = decryptPii(candidature.email).trim();
    telephone = candidature.phone ? decryptPii(candidature.phone).trim() : "";
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "creerFicheApporteurDepuisCandidature", step: "pii" },
    });
    return { ok: false, erreur: "illisible" };
  }

  const empreinte = hashEmailForLookup(email);
  if (!empreinte) return { ok: false, erreur: "echec" };

  // ── LE DOUBLON SE TRAITE AVANT L'ÉCRITURE — par empreinte, jamais par
  // adresse en clair (colonne chiffrée à IV aléatoire). Seule une fiche
  // APPORTEUR compte : un message du formulaire de contact n'empêche rien.
  const lignes = await prisma.submission.findMany({
    where: { contactEmailHash: empreinte, deletedAt: null },
    select: { id: true, details: true },
    orderBy: { submittedAt: "desc" },
    take: 20,
  });
  const dejaApporteur = lignes.find((l) => estApporteur(l.details));
  if (dejaApporteur) return { ok: false, erreur: "doublon", submissionId: dejaApporteur.id };

  const offreTitre = candidature.offerTitleSnap.trim();
  const ville = candidature.city?.trim() ?? "";

  try {
    const submission = await prisma.submission.create({
      data: {
        type: SubmissionType.contact,
        locale: candidature.locale,
        companyName: "—",
        contactName: encryptPii(`${prenom}${nom ? ` ${nom}` : ""}`.trim()),
        contactEmail: encryptPii(email),
        contactEmailHash: empreinte,
        contactPhone: telephone ? encryptPii(telephone) : null,
        source: SubmissionSource.import,
        // Passage automatique : « reçue le » = le jour de la candidature, pas
        // l'heure du passage — c'est la date que la personne a vécue.
        ...(input.automatique ? { submittedAt: candidature.submittedAt } : {}),
        details: {
          unifiedType: "recrutement",
          subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
          etape: LEAD_APPORTEUR_ETAPE,
          origine: ORIGINE_CANDIDATURE_OFFRE,
          jobApplicationId: candidature.id,
          offreTitre,
          ...(ville ? { ville } : {}),
          // 🔴 Le FAIT : la personne a consenti à l'étude de sa candidature à
          // un poste, pas au réseau. Aucun `optin` fabriqué.
          consentement:
            input.proposition === "poste-pourvu"
              ? "aucun pour le réseau — réseau proposé automatiquement avec la réponse « poste pourvu » à une candidature à un poste salarié"
              : input.proposition === "spontanee-commerciale"
                ? "aucun pour le réseau — fiche créée automatiquement depuis une candidature spontanée à un poste commercial"
                : input.automatique
                  ? "aucun pour le réseau — fiche créée automatiquement depuis une candidature à une offre d'emploi commerciale"
                  : "aucun pour le réseau — fiche créée par un administrateur depuis une candidature à une offre d'emploi",
          saisiPar: input.acteurId ?? "automatique",
          ...(input.proposition ? { propositionAuto: input.proposition } : {}),
          ...(input.automatique ? { creationAutomatique: true } : {}),
          message: input.message,
        } as object,
      },
      select: { id: true },
    });

    await prisma.activityLog.create({
      data: {
        adminUserId: input.acteurId,
        action: "submission.depuis_candidature_offre",
        targetType: "submission",
        targetId: submission.id,
        changes: {
          jobApplicationId: candidature.id,
          contactEmailHash: empreinte,
          ...(input.automatique ? { automatique: true } : {}),
        },
      },
    });
    return { ok: true, submissionId: submission.id };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "creerFicheApporteurDepuisCandidature" } });
    return { ok: false, erreur: "echec" };
  }
}
