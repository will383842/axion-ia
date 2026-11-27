// Aperçu avant envoi d'un e-mail apporteur (fiche I2-4a) : rendu EXACT, puis masqué et inerte.
//
// 1. Le rendu appelle `renderEmailTemplate` avec les arguments que le worker lui donnera à
//    l'envoi (gabarit, langue, charge mise en file, vrai destinataire) : la même fonction,
//    les mêmes arguments. Le jeton d'opposition du pied de page est donc le vrai.
// 2. Avant de quitter le serveur, objet, HTML et texte passent par `masquerSecretsEmail`,
//    puis les liens du HTML par `rendreLiensOuvrables` : le navigateur de la console ne reçoit
//    jamais un jeton ; un lien public s'ouvre dans un nouvel onglet, un lien personnel du
//    destinataire n'est pas cliquable.
//
// Jamais journalisé, jamais mis en cache : le HTML rendu porte des liens personnels.

import "server-only";

import {
  extrairePreEntete,
  rendreLiensOuvrables,
  type ApercuLecteur,
} from "@/lib/email/apercu-lecteur";
import { enveloppeExpedition } from "@/lib/email/enveloppe";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { renderEmailTemplate } from "@/lib/email/templates";
import { piecesJointesPourApercu } from "@/server/email/pieces-jointes-apercu";
import { prefixeAdminAttendu } from "@/server/auth/garde-route-console";
import type { EmailJobData } from "@/server/queue/types";

export type ArgumentsRendu = Parameters<typeof renderEmailTemplate>;

export interface ApercuMasque {
  sujet: string;
  html: string;
  texte: string;
  destinataire: string;
  apercu: ApercuLecteur;
}

export async function apercuMasque(
  gabarit: ArgumentsRendu[0],
  locale: ArgumentsRendu[1],
  payload: ArgumentsRendu[2],
  destinataire: string,
  attachments?: EmailJobData["attachments"],
): Promise<ApercuMasque> {
  const rendu = await renderEmailTemplate(gabarit, locale, payload, { destinataire });
  const masque = masquerSecretsEmail({
    subject: rendu.subject,
    html: rendu.html,
    text: rendu.text,
  });
  const html = rendreLiensOuvrables(masque.html);
  const enveloppe = enveloppeExpedition();
  return {
    sujet: masque.subject,
    html,
    texte: masque.text,
    destinataire,
    apercu: {
      html,
      texte: masque.text,
      objet: masque.subject,
      de: enveloppe.from,
      a: destinataire,
      repondreA: enveloppe.replyTo,
      preEntete: extrairePreEntete(html),
      // Les pièces que l'envoi joindra (même fonction que le worker) ; `[]` = « Aucune pièce jointe ».
      piecesJointes: await piecesJointesPourApercu(attachments, prefixeAdminAttendu() ?? ""),
    },
  };
}
