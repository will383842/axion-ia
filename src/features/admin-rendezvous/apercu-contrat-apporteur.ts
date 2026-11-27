// Aperçu de l'e-mail « lien du dossier » (le contrat à signer) que
// `ouvrirDossierEtEnvoyerLienAction` enverra — LECTURE SEULE.
//
// Rien n'est écrit, rien n'est envoyé, aucun dossier n'est ouvert : le lien du
// rendu est un lien d'exemple, masqué et inerte (`apercuMasque`). Ce fichier
// existe parce que l'aperçu de l'issue « Retenu » montre l'e-mail de
// BIENVENUE, qui n'est pas celui que ce geste envoie.
//
// Mêmes refus que l'action d'envoi, dans le même ordre : réservé à
// l'administrateur, dossier déjà ouvert, dossier fermé ou refusé.

"use server";

import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { peutEngager } from "@/server/auth/habilitations";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { apercuMasque } from "@/features/apporteurs-reseau/apercu-masque";
import { ouvrirDossierDepuisCandidature } from "@/features/apporteurs-reseau/donnees";
import { urlDossierExemple } from "@/features/apporteurs-reseau/jeton";
import type { ApercuLecteur } from "@/lib/email/apercu-lecteur";

export type ApercuContratApporteur =
  | { etat: "erreur"; message: string }
  | { etat: "apercu"; sujet: string; destinataire: string; apercu: ApercuLecteur };

export async function apercuContratApporteurAction(input: {
  calendlyEventId: string;
}): Promise<ApercuContratApporteur> {
  const session = await auth();
  if (!session?.user?.id) return { etat: "erreur", message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role;
  if (!peutVoirLesAppels(role) || !peutEngager(role, "contresigner")) {
    return {
      etat: "erreur",
      message: "L'ouverture du dossier est réservée à l'administrateur : elle ouvre un contrat.",
    };
  }
  try {
    const evt = await prisma.calendlyEvent.findUnique({
      where: { id: input.calendlyEventId },
      select: { linkedSubmissionId: true },
    });
    if (!evt?.linkedSubmissionId) {
      return { etat: "erreur", message: "Ce rendez-vous n'est rattaché à aucune fiche candidat." };
    }
    const avant = await ouvrirDossierDepuisCandidature(evt.linkedSubmissionId, { creer: false });
    if (avant.ok) {
      return {
        etat: "erreur",
        message:
          "Un dossier en ligne existe déjà pour cette personne : renvoyez le lien depuis sa fiche apporteur.",
      };
    }
    if (avant.ferme) return { etat: "erreur", message: avant.message };
    if ("refuseLe" in avant) {
      return {
        etat: "erreur",
        message: "Ce dossier a été refusé : il n'est pas rouvert depuis ce bouton.",
      };
    }
    const fiche = await prisma.submission.findUnique({
      where: { id: evt.linkedSubmissionId },
      select: { contactName: true, contactEmail: true, locale: true },
    });
    const email = fiche ? decryptPii(fiche.contactEmail)?.trim() : null;
    if (!fiche || !email) {
      return {
        etat: "erreur",
        message: "L'adresse de cette fiche est illisible : rien ne peut partir.",
      };
    }
    const nom = decryptPii(fiche.contactName) ?? "";
    const rendu = await apercuMasque(
      "apporteur-dossier-lien",
      fiche.locale === "en" ? "en" : "fr",
      { contactName: nom.split(" ")[0] ?? nom, dossierUrl: urlDossierExemple() },
      email,
    );
    return {
      etat: "apercu",
      sujet: rendu.sujet,
      destinataire: rendu.destinataire,
      apercu: rendu.apercu,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "apercu-contrat" } });
    return {
      etat: "erreur",
      message: "L'aperçu n'a pas pu être préparé. Réessayez dans un instant.",
    };
  }
}
