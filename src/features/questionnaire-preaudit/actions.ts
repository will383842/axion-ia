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
import { enregistrerGabaritBase } from "./gabarit-invitation";
import { preauditActif } from "./config";
import { modeRelances } from "./drapeaux-suivi";
import {
  arreterRelances,
  demanderEssai,
  ESSAIS_POSSIBLES,
  LIEU_MAX,
  noterEnvoi,
  type EssaiPossible,
} from "./suivi-console";
import {
  clore,
  deposerQuestionnaire,
  deposerQuestionnaireClient,
  lireDeLaRencontre,
  lireDuClientSansRendezVous,
  marquerLu,
} from "./serveur";

const uuid = z.string().uuid();

function champ(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

function pageRencontre(rencontreId: string): string {
  return adminPath("fr", `/rendez-vous/rencontres/${rencontreId}`);
}

/**
 * Le questionnaire visé par un formulaire : celui d'un RENDEZ-VOUS (`rencontreId`), ou, envoyé
 * sans rendez-vous, celui d'une FICHE (`clientId`). Le rendez-vous l'emporte s'il est fourni.
 */
type Cible =
  | { readonly genre: "rencontre"; readonly id: string }
  | { readonly genre: "client"; readonly id: string };

function cibleDe(fd: FormData): Cible {
  const rencontreId = champ(fd, "rencontreId");
  if (uuid.safeParse(rencontreId).success) return { genre: "rencontre", id: rencontreId };
  const clientId = champ(fd, "clientId");
  if (uuid.safeParse(clientId).success) return { genre: "client", id: clientId };
  redirect(adminPath("fr", "/rendez-vous"));
}

/** La page où revenir : le rendez-vous, ou la page « Questionnaire » de la fiche. */
function pageDe(c: Cible): string {
  return c.genre === "rencontre"
    ? pageRencontre(c.id)
    : adminPath("fr", `/qualiopi/clients/${c.id}/questionnaire`);
}

function lireDeLaCible(c: Cible) {
  return c.genre === "rencontre" ? lireDeLaRencontre(c.id) : lireDuClientSansRendezVous(c.id);
}

function retour(c: Cible, cle: "message" | "erreur", texte: string): never {
  redirect(avecMessageDeRetour(pageDe(c), cle, texte));
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
  const cible = cibleDe(fd);
  let ancienLienMort = false;
  let emailsRejetes = 0;
  try {
    // Le HTML déposé porte du JavaScript servi aux prospects : réservé à Williams.
    const { role } = await exigerAccesEchanges();
    if (role !== "super_admin") {
      throw new MessagePourWill(
        "Seule la personne qui administre la console peut ajouter un questionnaire.",
      );
    }
    const f = fd.get("fichier");
    if (!(f instanceof File) || f.size === 0) {
      throw new MessagePourWill("Choisissez d'abord le questionnaire.");
    }
    if (f.size > 900_000) throw new MessagePourWill("Ce fichier est trop lourd (max. 900 Ko).");
    if (cible.genre === "client") {
      await deposerQuestionnaireClient(cible.id, await f.text());
    } else {
      const depot = await deposerQuestionnaire(cible.id, await f.text());
      ancienLienMort = depot.ancienLienMort;
      emailsRejetes = depot.emailsRejetes;
    }
  } catch (e) {
    retour(cible, "erreur", messageAffichable(e));
  }
  revalidatePath(pageDe(cible));
  retour(
    cible,
    "message",
    ancienLienMort
      ? "Questionnaire remplacé (brouillon) : l'ancien lien ne marche plus." +
          (emailsRejetes > 0
            ? ` ${emailsRejetes} e-mail(s) en attente avec l'ancien lien ont été rejetés.`
            : "") +
          " Testez le questionnaire avant de l'envoyer."
      : "Questionnaire ajouté (brouillon). Testez-le avant de l'envoyer.",
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
  const cible = cibleDe(fd);
  let issue: "envoye" | "retenu_corbeille" = "envoye";
  let suiviNote = true;
  const relances = champ(fd, "relances") === "1";
  try {
    await exigerAccesEchanges();
    const q = await lireDeLaCible(cible);
    if (q === null) throw new MessagePourWill("Ajoutez d'abord le questionnaire.");
    const maintenant = new Date();
    const audit = auditDuFormulaire(fd, maintenant);
    issue = await envoyerQuestionnaire({
      questionnaireId: q.id,
      destinataire: champ(fd, "destinataire"),
      prenom: champ(fd, "prenom"),
      ...audit,
      // Le texte vu à l'aperçu et modifié par Will (assaini côté serveur, jamais du HTML).
      texte: {
        objet: fd.get("texte_objet"),
        message: fd.get("texte_message"),
        corps: fd.get("texte_corps"),
      },
    });
    // L'e-mail est en file : le suivi (relances, date, lieu) ne doit pas faire croire à un échec.
    try {
      await noterEnvoi(q.id, { relances, ...audit }, issue, maintenant);
    } catch {
      suiviNote = false;
    }
  } catch (e) {
    retour(cible, "erreur", messageAffichable(e));
  }
  revalidatePath(pageDe(cible));
  const base =
    issue === "retenu_corbeille"
      ? "E-mail prêt. Il partira quand vous l'aurez validé dans « E-mails à valider »."
      : "Questionnaire envoyé.";
  retour(
    cible,
    "message",
    !suiviNote
      ? `${base} ⚠️ Le suivi n'a pas pu être noté : aucun rappel ne partira.`
      : !relances
        ? `${base} Aucun rappel programmé.`
        : modeRelances() === "actif"
          ? `${base} Les 3 rappels sont programmés depuis le départ réel de l'e-mail.`
          : modeRelances() === "essai"
            ? `${base} Rappels en test : ils sont comptés, mais aucun ne part.`
            : `${base} Rappels demandés, mais suspendus pour le moment : aucun ne partira tant qu'ils ne sont pas réactivés.`,
  );
}

/**
 * Le texte de BASE de l'e-mail d'invitation (valable pour tous les clients) : Williams seul.
 * `reinitialiser=1` revient au texte d'origine (valeurs vides ; rien n'est supprimé).
 */
export async function enregistrerGabaritInvitationAction(fd: FormData): Promise<void> {
  const cible = cibleDe(fd);
  let message = "Texte de base enregistré : il sert pour les prochains envois.";
  try {
    const { role, userId } = await exigerAccesEchanges();
    if (role !== "super_admin") {
      throw new MessagePourWill(
        "Seul Williams (super-administrateur) peut modifier le texte de base.",
      );
    }
    if (champ(fd, "reinitialiser") === "1") {
      await enregistrerGabaritBase({ objet: "", corps: "" }, userId);
      message = "Texte de base remis au texte d'origine.";
    } else {
      await enregistrerGabaritBase(
        { objet: fd.get("base_objet"), corps: fd.get("base_corps") },
        userId,
      );
    }
  } catch (e) {
    retour(cible, "erreur", messageAffichable(e));
  }
  revalidatePath(pageDe(cible));
  retour(cible, "message", message);
}

/** « M'envoyer un test » : le worker l'envoie à l'adresse de test d'Axion IA, jamais au prospect. */
export async function demanderEssaiAction(fd: FormData): Promise<void> {
  const cible = cibleDe(fd);
  try {
    await exigerAccesEchanges();
    if (!preauditActif()) {
      throw new MessagePourWill(
        "L'envoi des questionnaires est suspendu : aucun test ne peut partir.",
      );
    }
    const essaiDe = champ(fd, "essai_de");
    if (!(ESSAIS_POSSIBLES as readonly string[]).includes(essaiDe)) {
      throw new MessagePourWill("Test inconnu.");
    }
    const q = await lireDeLaCible(cible);
    if (q === null) throw new MessagePourWill("Ajoutez d'abord le questionnaire.");
    await demanderEssai(q.id, essaiDe as EssaiPossible);
  } catch (e) {
    retour(cible, "erreur", messageAffichable(e));
  }
  revalidatePath(pageDe(cible));
  retour(
    cible,
    "message",
    "Test demandé. Vous le recevrez dans 5 minutes à votre adresse, objet « [TEST] ». Le client ne reçoit rien.",
  );
}

export async function arreterRelancesAction(fd: FormData): Promise<void> {
  const cible = cibleDe(fd);
  let arrete = false;
  try {
    await exigerAccesEchanges();
    const q = await lireDeLaCible(cible);
    if (q === null) throw new MessagePourWill("Questionnaire introuvable.");
    arrete = await arreterRelances(q.id, "will");
  } catch (e) {
    retour(cible, "erreur", messageAffichable(e));
  }
  revalidatePath(pageDe(cible));
  retour(
    cible,
    "message",
    arrete
      ? "Rappels arrêtés : plus aucun rappel ne partira."
      : "Les rappels étaient déjà arrêtés.",
  );
}

export async function marquerQuestionnaireLuAction(fd: FormData): Promise<void> {
  const cible = cibleDe(fd);
  try {
    const { userId } = await exigerAccesEchanges();
    const q = await lireDeLaCible(cible);
    if (q !== null) await marquerLu(q.id, userId);
  } catch (e) {
    retour(cible, "erreur", messageAffichable(e));
  }
  revalidatePath(pageDe(cible));
  retour(cible, "message", "Réponses marquées comme lues.");
}

export async function cloreQuestionnaireAction(fd: FormData): Promise<void> {
  const cible = cibleDe(fd);
  try {
    await exigerAccesEchanges();
    const q = await lireDeLaCible(cible);
    if (q !== null) await clore(q.id);
  } catch (e) {
    retour(cible, "erreur", messageAffichable(e));
  }
  revalidatePath(pageDe(cible));
  retour(cible, "message", "Questionnaire fermé : il ne reçoit plus de réponses.");
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
