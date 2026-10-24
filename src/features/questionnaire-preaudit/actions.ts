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
    await deposerQuestionnaire(rencontreId, await f.text());
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  retour(
    rencontreId,
    "message",
    "Questionnaire déposé (brouillon). Essayez-le avant de l'envoyer.",
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
