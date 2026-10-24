/**
 * Actions serveur du questionnaire de pré-audit (console, 2026-10-24).
 *
 * Chacune vérifie ELLE-MÊME la session et le rôle (`exigerAccesEchanges`). Ce sont des clics
 * de Will : déposer son HTML, envoyer (après l'aperçu), marquer les réponses comme lues.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { MessagePourWill, messageAffichable } from "@/features/dossier-client/message-affichable";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";

import { prisma } from "@/lib/prisma";
import {
  ecarterQuestionnairePreauditMembre,
  eraseQuestionnairePreauditMembre,
} from "@/lib/rgpd-erase";

import { envoyerQuestionnaire } from "./envoyer";
import { clore, deposerQuestionnaire, lireDeLaRencontre, marquerLu } from "./serveur";

const uuid = z.string().uuid();

function champ(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

function pageRencontre(rencontreId: string): string {
  return adminPath("fr", `/rendez-vous/rencontres/${rencontreId}`);
}

function retour(rencontreId: string, cle: "message" | "erreur", texte: string): never {
  redirect(avecMessageDeRetour(pageRencontre(rencontreId), cle, texte));
}

export async function deposerQuestionnaireAction(fd: FormData): Promise<void> {
  const rencontreId = champ(fd, "rencontreId");
  if (!uuid.safeParse(rencontreId).success) redirect(adminPath("fr", "/rendez-vous"));
  let ancienLienMort = false;
  let emailsRejetes = 0;
  try {
    // Le HTML déposé porte du JavaScript servi aux prospects : réservé à Williams.
    const { role } = await exigerAccesEchanges();
    if (role !== "super_admin") {
      throw new MessagePourWill(
        "Seul Williams (super-administrateur) peut déposer un questionnaire.",
      );
    }
    const f = fd.get("fichier");
    if (!(f instanceof File) || f.size === 0) {
      throw new MessagePourWill("Choisissez le fichier HTML du questionnaire.");
    }
    if (f.size > 900_000) throw new MessagePourWill("Le fichier est trop gros.");
    const depot = await deposerQuestionnaire(rencontreId, await f.text());
    ancienLienMort = depot.ancienLienMort;
    emailsRejetes = depot.emailsRejetes;
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  retour(
    rencontreId,
    "message",
    ancienLienMort
      ? "Questionnaire déposé de nouveau (brouillon) : l'ancien lien ne marche plus." +
          (emailsRejetes > 0
            ? ` ${emailsRejetes} e-mail(s) en attente avec l'ancien lien ont été rejetés.`
            : "") +
          " Essayez le questionnaire avant de l'envoyer."
      : "Questionnaire déposé (brouillon). Essayez-le avant de l'envoyer.",
  );
}

export async function envoyerQuestionnaireAction(fd: FormData): Promise<void> {
  const rencontreId = champ(fd, "rencontreId");
  if (!uuid.safeParse(rencontreId).success) redirect(adminPath("fr", "/rendez-vous"));
  let issue: "envoye" | "retenu_corbeille" = "envoye";
  try {
    await exigerAccesEchanges();
    const q = await lireDeLaRencontre(rencontreId);
    if (q === null) throw new MessagePourWill("Déposez d'abord le questionnaire.");
    issue = await envoyerQuestionnaire({
      questionnaireId: q.id,
      destinataire: champ(fd, "destinataire"),
      prenom: champ(fd, "prenom"),
    });
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  retour(
    rencontreId,
    "message",
    issue === "retenu_corbeille"
      ? "E-mail retenu dans la corbeille « E-mails à valider » : il partira quand vous l'aurez validé."
      : "Questionnaire envoyé.",
  );
}

export async function marquerQuestionnaireLuAction(fd: FormData): Promise<void> {
  const rencontreId = champ(fd, "rencontreId");
  if (!uuid.safeParse(rencontreId).success) redirect(adminPath("fr", "/rendez-vous"));
  try {
    const { userId } = await exigerAccesEchanges();
    const q = await lireDeLaRencontre(rencontreId);
    if (q !== null) await marquerLu(q.id, userId);
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  retour(rencontreId, "message", "Réponses marquées comme lues.");
}

export async function cloreQuestionnaireAction(fd: FormData): Promise<void> {
  const rencontreId = champ(fd, "rencontreId");
  if (!uuid.safeParse(rencontreId).success) redirect(adminPath("fr", "/rendez-vous"));
  try {
    await exigerAccesEchanges();
    const q = await lireDeLaRencontre(rencontreId);
    if (q !== null) await clore(q.id);
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  retour(rencontreId, "message", "Questionnaire clos : le lien ne reçoit plus de réponses.");
}

/** La référence et le code d'un salarié, lus du formulaire de la console (bornés). */
function refEtMembre(fd: FormData): { ref: string; membre: string } {
  const ref = champ(fd, "ref").slice(0, 40);
  const membre = champ(fd, "membre").slice(0, 60);
  if (ref === "" || membre === "") {
    throw new MessagePourWill("Référence du questionnaire ou code du collaborateur manquant.");
  }
  return { ref, membre };
}

/** Trace best-effort (sans le contenu des réponses) : qui a fait quel geste RGPD. */
async function tracer(userId: string, action: string, ref: string, nombre: number): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: userId,
        action,
        targetType: "QuestionnaireAvantAuditEnvoi",
        changes: { ref, nombre },
      },
    });
  } catch {
    // un journal indisponible n'empêche pas le geste
  }
}

/**
 * Demande d'effacement d'un salarié (audit des données du 24/10/2026, point 12) : ses réponses
 * sont MISES À L'ÉCART et la fiche affiche une alerte à Will. Rien n'est supprimé.
 */
export async function ecarterReponsesMembreAction(fd: FormData): Promise<void> {
  const rencontreId = champ(fd, "rencontreId");
  if (!uuid.safeParse(rencontreId).success) redirect(adminPath("fr", "/rendez-vous"));
  let n = 0;
  try {
    const { userId } = await exigerAccesEchanges();
    const { ref, membre } = refEtMembre(fd);
    n = await ecarterQuestionnairePreauditMembre(ref, membre);
    await tracer(userId, "questionnaire-preaudit.membre.ecarte", ref, n);
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  retour(
    rencontreId,
    "message",
    `${n} réponse(s) mise(s) à l'écart. L'effacement définitif reste à faire par Williams ` +
      "(bouton rouge sur la fiche).",
  );
}

/**
 * Effacement DÉFINITIF des réponses d'un salarié : clic de Williams (super-administrateur)
 * SEULEMENT, sur des réponses déjà mises à l'écart, avec la confirmation écrite « EFFACER ».
 */
export async function effacerReponsesMembreAction(fd: FormData): Promise<void> {
  const rencontreId = champ(fd, "rencontreId");
  if (!uuid.safeParse(rencontreId).success) redirect(adminPath("fr", "/rendez-vous"));
  let n = 0;
  try {
    const { userId, role } = await exigerAccesEchanges();
    if (role !== "super_admin") {
      throw new MessagePourWill(
        "Seul Williams (super-administrateur) peut effacer définitivement.",
      );
    }
    if (champ(fd, "confirmation") !== "EFFACER") {
      throw new MessagePourWill("Écrivez EFFACER pour confirmer l'effacement définitif.");
    }
    const { ref, membre } = refEtMembre(fd);
    const ecartees = await prisma.questionnaireAvantAuditEnvoi.count({
      where: {
        mode: { in: ["emp", "it"] },
        membre,
        questionnaire: { ref },
        ecarteLe: { not: null },
      },
    });
    if (ecartees === 0) {
      throw new MessagePourWill("Mettez d'abord ces réponses à l'écart (demande d'effacement).");
    }
    n = await eraseQuestionnairePreauditMembre(ref, membre);
    await tracer(userId, "questionnaire-preaudit.membre.efface", ref, n);
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  retour(rencontreId, "message", `${n} réponse(s) effacée(s) définitivement.`);
}
