// L'issue de l'échange apporteur — les deux actions de la console (2026-09-28).
//
//   · `apercuIssueApporteurAction` rend l'e-mail EXACT (vrai gabarit, prénom
//     compris) sans rien envoyer ni écrire ;
//   · `enregistrerIssueApporteurAction` écrit le point (`rendez_vous_suivis`),
//     classe la fiche « Sans suite » pour un « Non retenu », puis envoie l'e-mail
//     confirmé — une fois par issue et par personne (`issue-apporteur-envoi.ts`).
//
// 🔑 RIEN NE PART SUR UN SEUL CLIC. Une issue qui prévoit un e-mail exige le
// champ `confirmer=oui`, que seul le bouton « Envoyer » de l'aperçu pose. Le
// serveur le revérifie : un formulaire qui l'oublie n'envoie rien.
//
// Garde : celle de l'écriture des appels (`peutVoirLesAppels` — super_admin,
// admin, editor : les mêmes rôles que les gestes de la fiche candidat).

"use server";

import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { renderEmailTemplate } from "@/lib/email/templates";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { appliquerTransition } from "@/features/admin-submissions/transitions";
import { estRendezVousApporteur } from "@/server/calendly/appel-apporteur";
import { annulerRelancesLeadApporteur } from "@/features/commercial-application/relances-lead-apporteur";
import {
  ISSUES_APPORTEUR,
  LIBELLE_ISSUE_APPORTEUR,
  MOT_PERSONNEL_MAX,
  classeSansSuite,
  issueApporteurSchema,
  lireFormulaireIssueApporteur,
  normaliserIssueApporteur,
  type IssueApporteur,
} from "./issue-apporteur";
import {
  envoyerIssue,
  preparerIssueApporteur,
  type ResultatEnvoiIssue,
} from "./issue-apporteur-envoi";

export type EtatIssueApporteur =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

export type ApercuIssueApporteur =
  | { etat: "erreur"; message: string }
  | {
      etat: "apercu";
      issue: IssueApporteur;
      /** Présents seulement si un e-mail partira. */
      email: { sujet: string; html: string; destinataire: string } | null;
      /** Pourquoi aucun e-mail ne partira (deuxième absence, déjà envoyé…). */
      sansEmail: string | null;
    };

async function sessionEcriture(): Promise<{ id: string; email: string | null } | string> {
  const session = await auth();
  if (!session?.user?.id) return "Session expirée : reconnecte-toi.";
  const role = (session.user as { role?: string }).role;
  if (!peutVoirLesAppels(role)) return "Ton rôle ne permet pas d'enregistrer l'issue d'un échange.";
  return { id: session.user.id, email: session.user.email ?? null };
}

/** L'aperçu de l'e-mail que partira — rien n'est écrit, rien n'est envoyé. */
export async function apercuIssueApporteurAction(input: {
  calendlyEventId: string;
  issue: string;
  motPersonnel?: string | null;
}): Promise<ApercuIssueApporteur> {
  const qui = await sessionEcriture();
  if (typeof qui === "string") return { etat: "erreur", message: qui };
  if (!ISSUES_APPORTEUR.includes(input.issue as IssueApporteur)) {
    return { etat: "erreur", message: "Issue inconnue." };
  }
  const issue = input.issue as IssueApporteur;
  const mot = (input.motPersonnel ?? "").trim().slice(0, MOT_PERSONNEL_MAX);
  try {
    const prep = await preparerIssueApporteur({
      calendlyEventId: input.calendlyEventId,
      issue,
      motPersonnel: mot || null,
    });
    if (!prep.ok) return { etat: "erreur", message: prep.message };
    if (!prep.envoi) return { etat: "apercu", issue, email: null, sansEmail: prep.sansEmail };
    const rendu = await renderEmailTemplate(
      prep.envoi.gabarit,
      prep.envoi.locale,
      prep.envoi.payload,
      { destinataire: prep.envoi.destinataire },
    );
    return {
      etat: "apercu",
      issue,
      email: { sujet: rendu.subject, html: rendu.html, destinataire: prep.envoi.destinataire },
      sansEmail: null,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "apercu" } });
    return {
      etat: "erreur",
      message: "L'aperçu n'a pas pu être préparé. Réessaie dans un instant.",
    };
  }
}

function phraseEnvoi(r: ResultatEnvoiIssue | null): string {
  if (!r) return "";
  switch (r.statut) {
    case "envoye":
      return " L'e-mail est parti.";
    case "en-validation":
      return " L'e-mail attend dans « Envois à valider ».";
    case "retenu":
      return " ⚠️ L'e-mail n'est PAS parti : l'adresse est retenue (opposition ou adresse invalide).";
    case "file-indisponible":
      return " ⚠️ L'e-mail n'est PAS parti : la file d'envoi ne répond pas. Réessaie dans un instant.";
  }
}

/**
 * « Enregistrer SANS envoyer d'e-mail » (2026-10-05, demande de Will : ne pas écrire
 * systématiquement à tout le monde). Même écriture du point que le chemin normal,
 * mais AUCUN e-mail, et rien de ce qui en dépend :
 *   · le dossier en ligne de l'apporteur n'est PAS ouvert (« Retenu ») ;
 *   · les rappels ne sont pas retouchés ;
 *   · la fiche n'est exigée nulle part : un rendez-vous non rattaché s'enregistre.
 * « Non retenu » classe tout de même la fiche « Sans suite » si elle est rattachée :
 * c'est ce qui arrête les relances automatiques, et cela n'écrit à personne.
 */
async function enregistrerSansEmail(
  saisie: Parameters<typeof normaliserIssueApporteur>[0],
  donnees: ReturnType<typeof normaliserIssueApporteur>,
  qui: { id: string; email: string | null },
): Promise<EtatIssueApporteur> {
  const evt = await prisma.calendlyEvent.findUnique({
    where: { id: saisie.calendlyEventId },
    select: { id: true, eventTypeName: true, typeRendezVous: true, linkedSubmissionId: true },
  });
  if (!evt) return { etat: "erreur", message: "Rendez-vous introuvable." };
  if (!estRendezVousApporteur(evt)) {
    return { etat: "erreur", message: "Ce rendez-vous n'est pas un échange apporteur." };
  }
  try {
    await prisma.rendezVousSuivi.upsert({
      where: { calendlyEventId: evt.id },
      create: { calendlyEventId: evt.id, ...donnees, suite: null, renseignePar: qui.email },
      update: { ...donnees, suite: null, renseignePar: qui.email },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "suivi-sans-email" } });
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessaie dans un instant." };
  }
  let classement = "";
  if (classeSansSuite(saisie.issue) && evt.linkedSubmissionId) {
    const t = await appliquerTransition(evt.linkedSubmissionId, "sans-suite", qui.id);
    classement = t.ok
      ? " Fiche classée « Sans suite »."
      : " ⚠️ La fiche n'a pas pu être classée « Sans suite » : fais-le depuis ses gestes.";
  }
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: qui.id,
        action: "rendez_vous.issue_apporteur",
        targetType: evt.linkedSubmissionId ? "submission" : "calendly_event",
        targetId: evt.linkedSubmissionId ?? evt.id,
        changes: { calendlyEventId: evt.id, issue: saisie.issue, sansEmail: true },
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "journal" } });
  }
  revalidatePath(adminPath("fr", "rendez-vous"));
  revalidatePath(adminPath("fr", `contacts/appels/${evt.id}`));
  revalidatePath(adminPath("fr", "contacts/commercial"));
  updateTag("admin:rendez-vous-a-faire");
  return {
    etat: "ok",
    message: `Issue enregistrée : ${LIBELLE_ISSUE_APPORTEUR[saisie.issue]}. Aucun e-mail n'est parti.${classement}`,
  };
}

export async function enregistrerIssueApporteurAction(
  _precedent: EtatIssueApporteur,
  fd: FormData,
): Promise<EtatIssueApporteur> {
  const qui = await sessionEcriture();
  if (typeof qui === "string") return { etat: "erreur", message: qui };

  // Le bouton « sans e-mail » porte l'issue sous un autre nom : le chemin normal ne la voit pas.
  const veutSansEmail =
    typeof fd.get("issueSansEmail") === "string" && fd.get("issueSansEmail") !== "";
  if (veutSansEmail) fd.set("issue", String(fd.get("issueSansEmail")));

  const parsed = issueApporteurSchema.safeParse(lireFormulaireIssueApporteur(fd));
  if (!parsed.success) {
    return { etat: "erreur", message: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }
  const saisie = parsed.data;
  const donnees = normaliserIssueApporteur(saisie);
  if (veutSansEmail) return enregistrerSansEmail(saisie, donnees, qui);

  let prep;
  try {
    prep = await preparerIssueApporteur({
      calendlyEventId: saisie.calendlyEventId,
      issue: saisie.issue,
      motPersonnel: saisie.motPersonnel,
      ouvrirDossier: true,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "preparation" } });
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessaie dans un instant." };
  }
  if (!prep.ok) return { etat: "erreur", message: prep.message };

  // Un e-mail prévu ne part que CONFIRMÉ depuis l'aperçu.
  if (prep.envoi && fd.get("confirmer") !== "oui") {
    return {
      etat: "erreur",
      message: "Ouvre l'aperçu de l'e-mail et confirme l'envoi : rien ne part sans ta relecture.",
    };
  }

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
    Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "suivi" } });
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessaie dans un instant." };
  }

  // « Non retenu » : la fiche est classée « Sans suite » — archivée, marquée,
  // et TOUTE relance future s'arrête (`estClose` dans la lecture des rappels
  // de l'invitation, retrait des rappels « ton dossier t'attend »).
  let classement = "";
  if (classeSansSuite(saisie.issue) && prep.fiche) {
    const t = await appliquerTransition(prep.fiche.id, "sans-suite", qui.id);
    classement = t.ok
      ? " Fiche classée « Sans suite »."
      : " ⚠️ La fiche n'a pas pu être classée « Sans suite » : fais-le depuis ses gestes.";
  }
  // « Retenu » : plus aucun « ton dossier t'attend ». Les rappels de
  // l'invitation, eux, sont déjà arrêtés par la réservation de l'échange.
  if (saisie.issue === "retenu" && prep.envoi) {
    try {
      await annulerRelancesLeadApporteur(
        prep.envoi.destinataire,
        "Envoi annulé : la personne a été retenue après son échange.",
      );
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "relances" } });
    }
  }

  const envoi = await envoyerIssue(prep);

  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: qui.id,
        action: "rendez_vous.issue_apporteur",
        targetType: prep.fiche ? "submission" : "calendly_event",
        targetId: prep.fiche?.id ?? saisie.calendlyEventId,
        // Aucune donnée personnelle : les identifiants suffisent.
        changes: {
          calendlyEventId: saisie.calendlyEventId,
          issue: saisie.issue,
          ...(donnees.noteSur20 !== null ? { noteSur20: donnees.noteSur20 } : {}),
          ...(prep.envoi ? { gabarit: prep.envoi.gabarit, envoi: envoi?.statut ?? null } : {}),
          ...(prep.sansEmail ? { sansEmail: true } : {}),
        },
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "journal" } });
  }

  revalidatePath(adminPath("fr", "rendez-vous"));
  revalidatePath(adminPath("fr", `contacts/appels/${saisie.calendlyEventId}`));
  revalidatePath(adminPath("fr", "contacts/commercial"));
  if (prep.fiche) revalidatePath(adminPath("fr", `contacts/commercial/${prep.fiche.id}`));
  updateTag("admin:rendez-vous-a-faire");

  const base = `Issue enregistrée : ${LIBELLE_ISSUE_APPORTEUR[saisie.issue]}.`;
  const sansEmail = prep.sansEmail ? ` ${prep.sansEmail}` : "";
  const message = `${base}${classement}${phraseEnvoi(envoi)}${sansEmail}`;
  const echecEnvoi = envoi?.statut === "retenu" || envoi?.statut === "file-indisponible";
  return echecEnvoi ? { etat: "erreur", message } : { etat: "ok", message };
}
