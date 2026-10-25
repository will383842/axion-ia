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

import { fromParisLocalInput } from "@/lib/calendar-grid";

import { envoyerQuestionnaire } from "./envoyer";
import { preauditActif } from "./config";
import {
  arreterRelances,
  demanderEssai,
  ESSAIS_POSSIBLES,
  LIEU_MAX,
  noterEnvoi,
  type EssaiPossible,
} from "./suivi-console";
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

/** La vue « Questionnaires sans rencontre » (rencontre supprimée, réponses gardées). */
const PAGE_SANS_RENCONTRE = adminPath("fr", "/rendez-vous?vue=questionnaires");

/**
 * Où revenir après un geste RGPD : la fiche de la rencontre, ou la liste des questionnaires
 * sans rencontre (`retour=questionnaires`).
 */
function pageDeRetour(fd: FormData): string {
  const rencontreId = champ(fd, "rencontreId");
  if (uuid.safeParse(rencontreId).success) return pageRencontre(rencontreId);
  if (champ(fd, "retour") === "questionnaires") return PAGE_SANS_RENCONTRE;
  redirect(adminPath("fr", "/rendez-vous"));
}

function retourVers(page: string, cle: "message" | "erreur", texte: string): never {
  redirect(avecMessageDeRetour(page, cle, texte));
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

/** Date et lieu de l'audit saisis par Will (date passée refusée, lieu borné). */
function auditDuFormulaire(
  fd: FormData,
  maintenant: Date,
): {
  dateAudit: Date | null;
  lieuAudit: string | null;
} {
  const brut = champ(fd, "date_audit");
  let dateAudit: Date | null = null;
  if (brut !== "") {
    dateAudit = fromParisLocalInput(brut);
    if (dateAudit === null) throw new MessagePourWill("La date de l'audit n'est pas valide.");
    if (dateAudit.getTime() <= maintenant.getTime()) {
      throw new MessagePourWill("La date de l'audit est déjà passée.");
    }
  }
  const lieu = champ(fd, "lieu_audit");
  if (lieu.length > LIEU_MAX) {
    throw new MessagePourWill(`Le lieu de l'audit tient en ${LIEU_MAX} caractères au plus.`);
  }
  return { dateAudit, lieuAudit: lieu === "" ? null : lieu };
}

export async function envoyerQuestionnaireAction(fd: FormData): Promise<void> {
  const rencontreId = champ(fd, "rencontreId");
  if (!uuid.safeParse(rencontreId).success) redirect(adminPath("fr", "/rendez-vous"));
  let issue: "envoye" | "retenu_corbeille" = "envoye";
  let suiviNote = true;
  const relances = champ(fd, "relances") === "1";
  try {
    await exigerAccesEchanges();
    const q = await lireDeLaRencontre(rencontreId);
    if (q === null) throw new MessagePourWill("Déposez d'abord le questionnaire.");
    const maintenant = new Date();
    const audit = auditDuFormulaire(fd, maintenant);
    issue = await envoyerQuestionnaire({
      questionnaireId: q.id,
      destinataire: champ(fd, "destinataire"),
      prenom: champ(fd, "prenom"),
      ...audit,
    });
    // L'e-mail est en file : le suivi (relances, date, lieu) ne doit pas faire croire à un échec.
    try {
      await noterEnvoi(q.id, { relances, ...audit }, issue, maintenant);
    } catch {
      suiviNote = false;
    }
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  const base =
    issue === "retenu_corbeille"
      ? "E-mail retenu dans la corbeille « E-mails à valider » : il partira quand vous l'aurez validé."
      : "Questionnaire envoyé.";
  retour(
    rencontreId,
    "message",
    !suiviNote
      ? `${base} ⚠️ Le suivi n'a pas pu être noté : aucune relance ne partira.`
      : relances
        ? `${base} Les 3 relances sont programmées depuis le départ réel de l'e-mail.`
        : `${base} Aucune relance programmée.`,
  );
}

/** « M'envoyer un essai » : le worker l'envoie à l'adresse d'essai d'Axion IA, jamais au prospect. */
export async function demanderEssaiAction(fd: FormData): Promise<void> {
  const rencontreId = champ(fd, "rencontreId");
  if (!uuid.safeParse(rencontreId).success) redirect(adminPath("fr", "/rendez-vous"));
  try {
    await exigerAccesEchanges();
    if (!preauditActif()) {
      throw new MessagePourWill("Le questionnaire est éteint : aucun essai ne peut partir.");
    }
    const essaiDe = champ(fd, "essai_de");
    if (!(ESSAIS_POSSIBLES as readonly string[]).includes(essaiDe)) {
      throw new MessagePourWill("Essai inconnu.");
    }
    const q = await lireDeLaRencontre(rencontreId);
    if (q === null) throw new MessagePourWill("Déposez d'abord le questionnaire.");
    await demanderEssai(q.id, essaiDe as EssaiPossible);
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  retour(
    rencontreId,
    "message",
    "Essai demandé : il partira dans les 5 minutes à l'adresse d'essai, objet « [ESSAI] ».",
  );
}

export async function arreterRelancesAction(fd: FormData): Promise<void> {
  const rencontreId = champ(fd, "rencontreId");
  if (!uuid.safeParse(rencontreId).success) redirect(adminPath("fr", "/rendez-vous"));
  let arrete = false;
  try {
    await exigerAccesEchanges();
    const q = await lireDeLaRencontre(rencontreId);
    if (q === null) throw new MessagePourWill("Questionnaire introuvable.");
    arrete = await arreterRelances(q.id, "will");
  } catch (e) {
    retour(rencontreId, "erreur", messageAffichable(e));
  }
  revalidatePath(pageRencontre(rencontreId));
  retour(
    rencontreId,
    "message",
    arrete
      ? "Relances arrêtées : plus aucun rappel ne partira."
      : "Les relances étaient déjà arrêtées.",
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
  const page = pageDeRetour(fd);
  let n = 0;
  try {
    const { userId } = await exigerAccesEchanges();
    const { ref, membre } = refEtMembre(fd);
    n = await ecarterQuestionnairePreauditMembre(ref, membre);
    await tracer(userId, "questionnaire-preaudit.membre.ecarte", ref, n);
  } catch (e) {
    retourVers(page, "erreur", messageAffichable(e));
  }
  revalidatePath(page.split("?")[0] ?? page);
  retourVers(
    page,
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
  const page = pageDeRetour(fd);
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
    retourVers(page, "erreur", messageAffichable(e));
  }
  revalidatePath(page.split("?")[0] ?? page);
  retourVers(page, "message", `${n} réponse(s) effacée(s) définitivement.`);
}
