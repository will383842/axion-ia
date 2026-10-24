/**
 * L'UNIQUE chemin qui envoie le questionnaire de pré-audit (2026-10-24).
 *
 * Ordre de Will : AUCUN envoi automatique, jamais. Ce module n'est appelé que par l'action
 * « Envoyer » de la console (clic de Will, après l'aperçu exact de l'e-mail). Le cliquet
 * `aucun-envoi-automatique.spec.ts` rougit si un autre fichier met ce gabarit en file.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { renderEmailTemplate, type RenderedEmail } from "@/lib/email/templates";
import { MessagePourWill } from "@/features/dossier-client/message-affichable";

import { MESSAGE_REFUS, refusEnvoiReel } from "./config";
import { annulerEnvoi, reserverEnvoi, urlPreaudit } from "./serveur";

const adresse = z.string().trim().toLowerCase().email().max(200);

function lienOuRefus(id: string): string {
  const lien = urlPreaudit(id);
  if (lien === null) throw new MessagePourWill("Aucun lien sécurisé ne peut être fabriqué ici.");
  return lien;
}

/** L'e-mail EXACT qui partira (même rendu que l'envoi), pour l'aperçu de Will. */
export async function apercuEnvoi(
  questionnaireId: string,
  destinataire: string,
  prenom: string,
): Promise<RenderedEmail> {
  return renderEmailTemplate(
    "questionnaire-avant-audit",
    "fr",
    { prenom, lien: lienOuRefus(questionnaireId) },
    { destinataire },
  );
}

/** Mise en file de l'e-mail au prospect. Refusée si éteint ou si la notice RGPD est vide. */
export async function envoyerQuestionnaire(args: {
  readonly questionnaireId: string;
  readonly destinataire: string;
  readonly prenom: string;
}): Promise<void> {
  const refus = refusEnvoiReel();
  if (refus !== null) throw new MessagePourWill(MESSAGE_REFUS[refus]);
  const a = adresse.safeParse(args.destinataire);
  if (!a.success) throw new MessagePourWill("Cette adresse e-mail n'est pas valide.");
  const q = await prisma.questionnaireAvantAudit.findUnique({
    where: { id: args.questionnaireId },
    select: { id: true, rencontre: { select: { clientId: true } } },
  });
  if (q === null) throw new MessagePourWill("Questionnaire introuvable.");
  const lien = lienOuRefus(q.id);
  // Réservation AVANT la mise en file : un double clic (ou deux onglets) ne fait partir qu'un e-mail.
  const maintenant = new Date();
  const avant = await reserverEnvoi(q.id, a.data, maintenant);
  if (avant === null) {
    throw new MessagePourWill(
      "Un envoi vient d'avoir lieu : patientez une minute avant de renvoyer.",
    );
  }
  let enfile = false;
  try {
    const r = await enqueueEmail(
      "questionnaire-avant-audit",
      a.data,
      "fr",
      { prenom: args.prenom.trim().slice(0, 60), lien },
      {
        // Idempotent : le même envoi réservé ne produit jamais deux tâches.
        jobId: `preaudit-${q.id}-${maintenant.getTime()}`,
        entityType: "QuestionnaireAvantAudit",
        entityId: q.id,
        clientId: q.rencontre.clientId ?? null,
      },
    );
    enfile = r.enqueued;
  } finally {
    if (!enfile) await annulerEnvoi(q.id, avant);
  }
  if (!enfile) throw new MessagePourWill("L'e-mail n'a pas pu être mis en file. Réessayez.");
}
