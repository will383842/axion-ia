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
  envoyerPositionnement,
  envoyerRelanceQuestionnaire,
} from "@/server/qualiopi/notifications/notifications-service";

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

  // 🔴 2026-08-24 — LE RETOUR EST LE CONTRAT, ET IL ÉTAIT JETÉ.
  //
  // Ces trois fonctions rendent `Promise<boolean>` et NE LÈVENT PAS quand
  // l'envoi échoue : elles rendent `false`. Cinq chemins le font sans lever —
  // stub, questionnaire déjà répondu, stagiaire sans adresse, file de messages
  // indisponible, e-mail garé en corbeille de validation. Le `catch` ci-dessous
  // n'attrape donc AUCUN de ces cas.
  //
  // Résultat mesuré avant ce correctif : `envoyeAt` était écrit hors de tout
  // test, l'écran affichait « Lien envoyé au stagiaire », l'alerte J-2 disait
  // « envoyé mais sans réponse », et le rattrapage — qui ne reprend que les
  // `envoyeAt: null` — écartait le dossier DÉFINITIVEMENT. Le stagiaire n'avait
  // rien reçu, et la base attestait l'inverse.
  //
  // 🔑 Le worker porte cette garde depuis la PR #764 ; le correctif n'avait
  // jamais franchi la couche action. Cliquet :
  // `notifications/__tests__/appelant-ne-jette-pas-le-booleen-denvoi.spec.ts`.
  let parti = false;
  try {
    switch (questionnaire.type) {
      case "satisfaction_chaud":
        parti = await envoyerSatisfactionJ1(enrollmentId);
        break;
      case "satisfaction_froid":
        parti = await envoyerSuiviJ30(enrollmentId);
        break;
      default:
        // `positionnement` — email DÉDIÉ, qui nomme la formation, sa date, et
        // ce qu'on attend du stagiaire.
        //
        // 🔴 Envoyait auparavant `demanderAccesParEmail(email)`, c'est-à-dire
        // le template de RE-DEMANDE self-service d'un accès perdu. Le stagiaire
        // lisait « vous avez demandé un nouveau lien » (faux) et « si vous
        // n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet
        // email » — une invitation explicite à ignorer la seule pièce qui
        // fonde l'indicateur 8. Constaté sur le premier dossier réel.
        parti = await envoyerPositionnement(questionnaireId);
        break;
    }
  } catch {
    return { error: "L'envoi a échoué. Réessayez dans quelques instants." };
  }

  // ⚠️ Le message doit distinguer les deux causes : un e-mail garé en corbeille
  // de validation partira peut-être après approbation humaine, une file absente
  // non. Les deux comptent comme NON ENVOYÉ, et dans les deux cas la trace ne
  // doit pas être écrite — c'est elle qui ferme le rattrapage.
  if (!parti) {
    return {
      error:
        "Rien n'est parti : le message est soit garé en corbeille de validation, " +
        "soit resté en attente faute de file de messages. Aucune trace d'envoi " +
        "n'a été enregistrée, le rattrapage automatique reprendra ce " +
        "questionnaire.",
    };
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

  // Même contrat, même piège : `envoyerRelanceQuestionnaire` rend `false` sans
  // lever. Une relance non partie qui journalise un succès consomme le plafond
  // (`RELANCES_MAX = 2`) et referme le rattrapage sur un envoi fantôme.
  let relanceePartie = false;
  try {
    relanceePartie = await envoyerRelanceQuestionnaire(questionnaireId);
  } catch {
    return { error: "La relance a échoué. Réessayez dans quelques instants." };
  }
  if (!relanceePartie) {
    return {
      error:
        "La relance n'est pas partie : message garé en corbeille de validation, " +
        "ou file de messages indisponible. Aucun compteur de relance n'a été " +
        "consommé.",
    };
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
