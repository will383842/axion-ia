"use server";

/**
 * Qualiopi — Envoi MANUEL d'un questionnaire à un stagiaire.
 *
 * ── Pourquoi cette action existe (2026-08-03) ───────────────────────────────
 *
 * Les questionnaires partent normalement par cron :
 *   - `formation-crons.satisfaction-j1`  → satisfaction à chaud
 *   - `formation-crons.suivi-j30`        → satisfaction à froid
 *
 * Mais ces crons sélectionnent sur une **fenêtre glissante de 24 h**
 * (`dateFin` entre `now-36h` et `now-12h`, cf. `handleSatisfactionJ1`) ET
 * exigent que la session soit DÉJÀ en statut `realisee` au moment du passage.
 *
 * Les deux conditions doivent être vraies le même matin. Sur le premier
 * dossier réel (INVEST SUN, session du 31/07) :
 *   - 01/08 08:00 → dans la fenêtre, mais session pas encore `realisee` → sauté
 *   - 02/08 08:00 → session `realisee`, mais fenêtre dépassée          → sauté
 *
 * Résultat : le questionnaire n'est **jamais** parti, aucun rattrapage n'était
 * prévu, aucune alerte ne s'est levée, et l'interface n'offrait **aucun moyen
 * de l'envoyer à la main**. `QuestionnairesSection` ne permettait que de saisir
 * les réponses À LA PLACE du stagiaire — ce qui n'est pas un recueil
 * d'appréciation, et ne vaut rien devant un auditeur.
 *
 * Conséquence Qualiopi : indicateur 8 (positionnement) et indicateur 30
 * (recueil des appréciations, DEUX sources exigées) restés vides sur la seule
 * action réalisée de l'organisme.
 *
 * **Une session clôturée avec un jour de retard perdait définitivement ses
 * questionnaires.** Cette action rend la fenêtre rattrapable.
 *
 * ── `envoyeAt` ──────────────────────────────────────────────────────────────
 * La colonne existait et n'était écrite par personne — ni par les crons, ni
 * ailleurs. On la renseigne ici : sans elle, impossible de distinguer
 * « jamais envoyé » de « envoyé, sans réponse », et c'est exactement la
 * question que pose un auditeur devant un questionnaire vide.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  envoyerSatisfactionJ1,
  envoyerSuiviJ30,
  envoyerRelanceQuestionnaire,
} from "@/server/qualiopi/notifications/notifications-service";
import { demanderAccesParEmail } from "@/server/qualiopi/portail/portail-service";

type ActionResult<T> = { data: T } | { error: string };

const envoyerQuestionnaireSchema = z.object({
  questionnaireId: z.string().uuid(),
});

/**
 * Envoie (ou renvoie) le questionnaire au stagiaire, quel que soit le retard.
 *
 * Le positionnement n'a pas de cron dédié — il est annoncé dans la convocation
 * et accessible depuis le portail. On envoie donc l'accès au portail, où le
 * questionnaire est listé.
 */
export async function envoyerQuestionnaireAction(input: {
  questionnaireId: string;
}): Promise<ActionResult<{ questionnaireId: string; envoyeAt: string }>> {
  const session = await requireAdminWrite();

  const parsed = envoyerQuestionnaireSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { questionnaireId } = parsed.data;

  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      id: true,
      type: true,
      reponduAt: true,
      enrollment: {
        select: {
          id: true,
          trainee: { select: { id: true, email: true } },
          session: { select: { id: true } },
        },
      },
    },
  });

  if (!questionnaire) return { error: "Questionnaire introuvable" };

  // Déjà répondu : renvoyer le lien écraserait une réponse existante côté
  // stagiaire, ou lui ferait croire qu'on n'a pas reçu la sienne.
  if (questionnaire.reponduAt !== null) {
    return { error: "Ce questionnaire a déjà été rempli — inutile de le renvoyer." };
  }

  const email = questionnaire.enrollment.trainee.email;
  if (!email || email.trim() === "") {
    return { error: "Le stagiaire n'a pas d'adresse email : envoi impossible." };
  }

  const enrollmentId = questionnaire.enrollment.id;

  try {
    switch (questionnaire.type) {
      case "satisfaction_chaud":
        await envoyerSatisfactionJ1(enrollmentId);
        break;
      case "satisfaction_froid":
        await envoyerSuiviJ30(enrollmentId);
        break;
      default:
        // `positionnement` — pas de cron dédié : le portail liste le
        // questionnaire, on envoie donc l'accès (jeton 90 j + email).
        await demanderAccesParEmail(email);
        break;
    }
  } catch {
    return { error: "L'envoi a échoué. Réessayez dans quelques instants." };
  }

  const envoyeAt = new Date();
  await prisma.questionnaire.update({
    where: { id: questionnaireId },
    data: { envoyeAt },
  });

  await logQualiopiActivity({
    action: "qualiopi.questionnaire.envoyer",
    targetType: "Questionnaire",
    targetId: questionnaireId,
    changes: { type: questionnaire.type, destinataire: email, manuel: true },
    session,
  });

  revalidatePath(`/fr/[adminPrefix]/qualiopi/sessions/${questionnaire.enrollment.session.id}`);

  return { data: { questionnaireId, envoyeAt: envoyeAt.toISOString() } };
}

// ─────────────────────────────────────────────────────────────────────────────
// relancerQuestionnaireAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Relance MANUELLE d'un questionnaire envoyé resté sans réponse — le bouton du
 * bloc « Retours en attente » de la page À traiter.
 *
 * Délègue tout à `envoyerRelanceQuestionnaire` : même email, même trace
 * (`relanceCount`, `derniereRelanceAt`) que la relance automatique du cron.
 * Deux chemins qui écriraient la trace différemment finiraient par dire deux
 * choses différentes à l'auditeur.
 *
 * ⚠️ Contrairement au cron (plafonné à 2), la relance manuelle N'EST PAS
 * plafonnée : c'est un humain qui décide, en connaissance du compteur affiché.
 */
export async function relancerQuestionnaireAction(input: {
  questionnaireId: string;
}): Promise<ActionResult<{ questionnaireId: string }>> {
  const session = await requireAdminWrite();

  const parsed = envoyerQuestionnaireSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { questionnaireId } = parsed.data;

  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { id: true, type: true, envoyeAt: true, reponduAt: true },
  });
  if (!questionnaire) return { error: "Questionnaire introuvable" };
  if (questionnaire.envoyeAt === null) {
    return { error: "Ce questionnaire n'a jamais été envoyé — utilisez « Envoyer »." };
  }
  if (questionnaire.reponduAt !== null) {
    return { error: "Ce questionnaire a déjà été rempli — inutile de relancer." };
  }

  try {
    await envoyerRelanceQuestionnaire(questionnaireId);
  } catch {
    return { error: "La relance a échoué. Réessayez dans quelques instants." };
  }

  await logQualiopiActivity({
    action: "qualiopi.questionnaire.relancer",
    targetType: "Questionnaire",
    targetId: questionnaireId,
    changes: { type: questionnaire.type, manuel: true },
    session,
  });

  revalidatePath(`/fr/[adminPrefix]/qualiopi/a-traiter`);

  return { data: { questionnaireId } };
}
