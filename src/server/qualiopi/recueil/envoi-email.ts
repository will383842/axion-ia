/**
 * Chantier QNC, L03 — le PORT d'envoi de l'e-mail du recueil : branche
 * `lancement.ts` sur `enqueueEmail`. Isolé pour que la logique du lot reste
 * testable sans la file BullMQ.
 *
 * `jobId` = questionnaire + rang : un même envoi ne part jamais deux fois, même
 * si le passage quotidien et un clic de la console se croisent.
 */

import * as Sentry from "@sentry/nextjs";

import { enqueueEmail } from "@/server/queue/queues";

import type { PortEnvoi } from "./lancement";

export const envoyerEmailRecueil: PortEnvoi = async (d) => {
  try {
    const r = await enqueueEmail(
      "recueil-besoin",
      d.destinataire,
      "fr",
      {
        ...(d.nomDestinataire !== null ? { destinataireNom: d.nomDestinataire } : {}),
        clientNom: d.raisonSociale,
        titreFormation: d.titreSession,
        lienQuestionnaire: d.url,
        rang: d.rang,
      },
      {
        sujet:
          d.rang > 0
            ? `Rappel — recueil du besoin : ${d.titreSession}`
            : `Recueil du besoin : ${d.titreSession}`,
        entityType: "QuestionnaireCadrage",
        entityId: d.questionnaireId,
        jobId: `recueil-besoin-${d.questionnaireId}-${d.rang}`,
        ...(d.clientId !== null ? { clientId: d.clientId } : {}),
      },
    );
    return { parti: r.enqueued === true, garePourValidation: r.garePourValidation === true };
  } catch (err) {
    Sentry.captureException(err, { tags: { module: "qualiopi-recueil", rang: String(d.rang) } });
    return { parti: false, garePourValidation: false };
  }
};
