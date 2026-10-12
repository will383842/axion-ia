// L'issue de l'échange formateur — les deux actions de la console (lot F-CAL-2).
//
//   · `apercuIssueFormateurAction` rend l'e-mail EXACT sans rien envoyer ni écrire ;
//   · `enregistrerIssueFormateurAction` écrit le point (`rendez_vous_suivis`), crée la
//     fiche formateur INACTIVE pour « Retenu », puis envoie l'e-mail confirmé.
//
// 🔴 Interrupteur `formateurs.suivi_echange` coupé : les deux actions refusent, rien
// n'est écrit. 🔴 Aucun statut de recrutement (`JobApplication.status`) n'est écrit : la
// décision vit dans `rendez_vous_suivis` (consigne 8 bis). 🔴 Rien ne part sur un seul
// clic : un e-mail exige `confirmer=oui`, posé par le bouton « Envoyer » de l'aperçu.
//
// Gardes : la lecture des appels (`peutVoirLesAppels`) pour tout geste ; « Non retenu »
// et « Absent » demandent en plus `habiliter_formateur` ; « Retenu » est réservé à
// l'administrateur (`contresigner`), comme la création de fiche qu'il déclenche.

"use server";

import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { creerFicheFormateurDepuisCandidatureAction } from "@/features/admin-job-applications/fiche-formateur-actions";
import { peutEngager } from "@/server/auth/habilitations";
import { apercu, envoyer } from "@/server/qualiopi/formateurs-independants/envois";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";
import { ouvrirDossierRetenu } from "@/server/qualiopi/formateurs-independants/ouverture-dossier";

import {
  ISSUES_ECHANGE,
  LIBELLE_ISSUE_ECHANGE,
  issueEchangeSchema,
  lireFormulaireIssueEchange,
  normaliserIssueEchange,
  type IssueEchange,
} from "./issue-echange";
import { preparerIssueFormateur } from "./issue-formateur-envoi";

export type EtatIssueFormateur =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

export type ApercuIssueFormateur =
  | { etat: "erreur"; message: string }
  | {
      etat: "apercu";
      issue: IssueEchange;
      email: { sujet: string; html: string; destinataire: string } | null;
      sansEmail: string | null;
    };

const COUPE = "Le suivi de l'échange formateur est coupé (écran « Interrupteurs »).";
const REFUS_RETENIR = "« Retenu » est réservé à l'administrateur : il ouvre la fiche formateur.";
const REFUS_DECIDER = "Votre rôle ne permet pas de décider de la suite d'un échange formateur.";

async function session(): Promise<
  { id: string; email: string | null; role: string | undefined } | string
> {
  const s = await auth();
  if (!s?.user?.id) return "Session expirée : reconnectez-vous.";
  const role = (s.user as { role?: string }).role;
  if (!peutVoirLesAppels(role))
    return "Votre rôle ne permet pas d'enregistrer l'issue d'un échange.";
  return { id: s.user.id, email: s.user.email ?? null, role };
}

/** Le droit de noter CETTE issue. Fonction non exportée (fichier « use server »). */
function refusPourIssue(issue: IssueEchange, role: string | undefined): string | null {
  if (issue === "retenu") return peutEngager(role, "contresigner") ? null : REFUS_RETENIR;
  if (issue === "non_retenu" || issue === "absent") {
    return peutEngager(role, "habiliter_formateur") ? null : REFUS_DECIDER;
  }
  return null;
}

async function suiviAllume(): Promise<boolean> {
  return (await lireEtatsEntree()).suivi_echange === true;
}

export async function apercuIssueFormateurAction(input: {
  calendlyEventId: string;
  issue: string;
}): Promise<ApercuIssueFormateur> {
  const qui = await session();
  if (typeof qui === "string") return { etat: "erreur", message: qui };
  if (!(await suiviAllume())) return { etat: "erreur", message: COUPE };
  if (!ISSUES_ECHANGE.includes(input.issue as IssueEchange)) {
    return { etat: "erreur", message: "Issue inconnue." };
  }
  const issue = input.issue as IssueEchange;
  const refus = refusPourIssue(issue, qui.role);
  if (refus) return { etat: "erreur", message: refus };
  try {
    const prep = await preparerIssueFormateur({ calendlyEventId: input.calendlyEventId, issue });
    if (!prep.ok) return { etat: "erreur", message: prep.message };
    if (!prep.envoi) return { etat: "apercu", issue, email: null, sansEmail: prep.sansEmail };
    const rendu = await apercu(prep.envoi);
    return {
      etat: "apercu",
      issue,
      email: { sujet: rendu.sujet, html: rendu.html, destinataire: rendu.destinataire },
      sansEmail: null,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-formateur", step: "apercu" } });
    return { etat: "erreur", message: "L'aperçu a échoué. Réessayez dans un instant." };
  }
}

export async function enregistrerIssueFormateurAction(
  _precedent: EtatIssueFormateur,
  fd: FormData,
): Promise<EtatIssueFormateur> {
  const qui = await session();
  if (typeof qui === "string") return { etat: "erreur", message: qui };
  if (!(await suiviAllume())) return { etat: "erreur", message: COUPE };

  const parsed = issueEchangeSchema.safeParse(lireFormulaireIssueEchange(fd));
  if (!parsed.success) {
    return { etat: "erreur", message: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }
  const saisie = parsed.data;
  const refus = refusPourIssue(saisie.issue, qui.role);
  if (refus) return { etat: "erreur", message: refus };

  let prep: Awaited<ReturnType<typeof preparerIssueFormateur>>;
  try {
    prep = await preparerIssueFormateur({
      calendlyEventId: saisie.calendlyEventId,
      issue: saisie.issue,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-formateur", step: "preparation" } });
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessayez dans un instant." };
  }
  if (!prep.ok) return { etat: "erreur", message: prep.message };
  if (prep.envoi && fd.get("confirmer") !== "oui") {
    return {
      etat: "erreur",
      message:
        "Ouvrez l'aperçu de l'e-mail et confirmez l'envoi : rien ne part sans votre relecture.",
    };
  }

  const donnees = normaliserIssueEchange(saisie);
  try {
    await prisma.rendezVousSuivi.upsert({
      where: { calendlyEventId: saisie.calendlyEventId },
      create: {
        calendlyEventId: saisie.calendlyEventId,
        ...donnees,
        suite: null,
        renseignePar: qui.email,
      },
      update: { ...donnees, suite: null, renseignePar: qui.email },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-formateur", step: "suivi" } });
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessayez dans un instant." };
  }

  // « Retenu » : la fiche formateur INACTIVE, `sous_traitant` (passerelle de la fiche
  // candidat, qui revérifie elle-même le rôle), reliée à sa candidature d'origine.
  let fiche = "";
  let envoi: string | null = null;
  let ouverture = "";
  if (saisie.issue === "retenu") {
    const r = await creerFicheFormateurDepuisCandidatureAction({
      applicationId: prep.candidatureId,
      statut: "sous_traitant",
      actif: false,
    });
    if (r.ok) {
      try {
        await prisma.trainer.updateMany({
          where: { id: r.trainerId, candidatureId: null },
          data: { candidatureId: prep.candidatureId },
        });
      } catch (err) {
        // Une autre fiche porte déjà cette candidature (index unique partiel) : on n'écrase rien.
        Sentry.captureException(err, { tags: { action: "issue-formateur", step: "candidature" } });
      }
      fiche = r.deja ? " La fiche formateur existait déjà." : " Fiche formateur créée (inactive).";
      // F5 relu à l'aperçu : le dossier s'ouvre, puis l'e-mail part avec son vrai lien.
      if (prep.envoi?.ouvreDossier) {
        try {
          const o = await ouvrirDossierRetenu({
            trainerId: r.trainerId,
            parId: qui.id,
            maintenant: new Date(),
          });
          if (o.ok) {
            ouverture = " Dossier en ligne ouvert.";
            envoi = o.envoi;
          } else {
            ouverture = ` ${o.message}`;
          }
        } catch (err) {
          Sentry.captureException(err, { tags: { action: "issue-formateur", step: "dossier" } });
          ouverture = " ⚠️ Le dossier en ligne n'a pas pu être ouvert : réessayez depuis la fiche.";
        }
      }
    } else {
      fiche = ` ⚠️ La fiche formateur n'a pas été créée : ${r.message}`;
    }
  }

  if (prep.envoi && !prep.envoi.ouvreDossier) {
    envoi = await envoyer({
      gabarit: prep.envoi.gabarit,
      destinataire: prep.envoi.destinataire,
      payload: prep.envoi.payload,
      entityType: "JobApplication",
      entityId: prep.candidatureId,
      jobId: prep.envoi.jobId,
    });
  }

  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: qui.id,
        action: "rendez_vous.issue_formateur",
        targetType: "JobApplication",
        targetId: prep.candidatureId,
        // Aucune donnée personnelle : des identifiants et des états.
        changes: {
          calendlyEventId: saisie.calendlyEventId,
          issue: saisie.issue,
          ...(donnees.noteSur20 !== null ? { noteSur20: donnees.noteSur20 } : {}),
          ...(prep.envoi ? { gabarit: prep.envoi.gabarit, envoi } : {}),
        },
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-formateur", step: "journal" } });
  }

  revalidatePath(adminPath("fr", "rendez-vous"));
  revalidatePath(adminPath("fr", `contacts/appels/${saisie.calendlyEventId}`));
  revalidatePath(adminPath("fr", `contacts/candidatures/${prep.candidatureId}`));
  updateTag("admin:rendez-vous-a-faire");

  const phraseEnvoi =
    envoi === null
      ? ""
      : envoi === "envoye"
        ? " E-mail envoyé."
        : envoi === "en-validation"
          ? " E-mail placé en validation."
          : envoi === "texte-non-valide"
            ? " E-mail non envoyé : son texte n'est pas encore validé."
            : ` E-mail non envoyé (${envoi}).`;
  const message = `Issue enregistrée : ${LIBELLE_ISSUE_ECHANGE[saisie.issue]}.${fiche}${ouverture}${phraseEnvoi}${prep.sansEmail ? ` ${prep.sansEmail}` : ""}`;
  return { etat: "ok", message };
}
