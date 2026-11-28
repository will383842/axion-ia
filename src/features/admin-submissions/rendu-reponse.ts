// Rendu d'une réponse écrite à une demande (fiche I2-1) : UNE SEULE fonction de rendu, appelée à
// l'identique par l'envoi (`replyToSubmissionAction`) et par l'aperçu (`apercuReponseDemandeAction`).
//
// Le rendu se fait avec le VRAI destinataire (adresse déchiffrée côté serveur) : le pied de page
// porte son lien d'opposition personnel, et c'est ce HTML, figé en base, que le worker enverra.
//
// 🔴 Ce HTML porte donc un jeton personnel. Il ne quitte JAMAIS le serveur tel quel : l'aperçu
// passe par `apercuDepuisRendu` (masqué, liens inertes). Jamais journalisé, jamais mis en cache.

import "server-only";

import {
  extrairePreEntete,
  rendreLiensInertes,
  type ApercuLecteur,
} from "@/lib/email/apercu-lecteur";
import { enveloppeExpedition } from "@/lib/email/enveloppe";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { renderEmailTemplate } from "@/lib/email/templates";

export interface SaisieReponseDemande {
  subject: string;
  bodyMarkdown: string;
}

export interface CibleReponseDemande {
  locale: Parameters<typeof renderEmailTemplate>[1];
  /** Adresse déchiffrée du destinataire, vérifiée utilisable par l'appelant. */
  destinataire: string;
}

export interface RenduReponseDemande {
  subject: string;
  html: string;
  text: string;
}

export function rendreReponseDemande(
  cible: CibleReponseDemande,
  saisie: SaisieReponseDemande,
): Promise<RenduReponseDemande> {
  return renderEmailTemplate(
    "submission-reply",
    cible.locale,
    { subject: saisie.subject, bodyMarkdown: saisie.bodyMarkdown },
    { destinataire: cible.destinataire },
  );
}

/** Ce que le navigateur de la console reçoit : jamais un jeton, jamais un lien cliquable. */
export function apercuDepuisRendu(rendu: RenduReponseDemande, destinataire: string): ApercuLecteur {
  const masque = masquerSecretsEmail({
    subject: rendu.subject,
    html: rendu.html,
    text: rendu.text,
  });
  const html = rendreLiensInertes(masque.html);
  const enveloppe = enveloppeExpedition();
  return {
    html,
    texte: masque.text,
    objet: masque.subject,
    de: enveloppe.from,
    a: destinataire,
    repondreA: enveloppe.replyTo,
    preEntete: extrairePreEntete(html),
  };
}
