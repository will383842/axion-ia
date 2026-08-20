/**
 * Rebonds ZeptoMail — lecture du payload et rattachement à l'envoi.
 *
 * ## Le défaut que ce module ferme (`D5-3-02`)
 *
 * Un rebond dur était **indiscernable d'une remise réussie**. Le relais
 * acceptait le message — `EmailLog.status = "sent"` — le serveur destinataire
 * le refusait ensuite, et rien ne revenait dans le système.
 *
 * Une convocation « envoyée » pouvait n'être jamais arrivée. Et la console
 * offrait un filtre « Rejeté » (`SubmissionReplyStatus.bounced`) qu'**aucun code
 * n'écrivait jamais** : l'état avait été prévu à la conception — son commentaire
 * dit « confirmation delivery via webhook bounce/delivery » — et le webhook
 * n'avait jamais été construit.
 *
 * 🔑 C'est la forme inverse du défaut que cet audit rencontre partout : d'habitude
 * un lecteur sans écrivain ; ici un ÉTAT sans sa source.
 *
 * ## Le rattachement, et sa limite
 *
 * Le payload porte un `client_reference` — « référence unique côté client ».
 * ⚠️ **Le dépôt ne la pose PAS à l'envoi** : `sendEmail` ne transmet aucun
 * en-tête de corrélation à ZeptoMail. On rattache donc sur le **destinataire**
 * et une **fenêtre de temps**, ce qui est robuste mais pas exact : deux envois
 * au même destinataire dans la fenêtre sont départagés par le plus récent.
 *
 * Un rebond non rattaché n'est **jamais perdu** : il est signalé quand même.
 * Perdre le lien vaut mieux que perdre le fait.
 */

/** Événement de rebond, tel que ZeptoMail le poste. */
export interface RebondZeptomail {
  /** `hard` = adresse morte. `soft` = échec temporaire. */
  readonly type: "hard" | "soft";
  /** Destinataire en minuscules, ou `null` si le payload ne le porte pas. */
  readonly destinataire: string | null;
  readonly sujet: string | null;
  readonly motif: string | null;
  readonly diagnostic: string | null;
  /** Instant du rebond, ou `null` si illisible. */
  readonly survenuLe: Date | null;
  /** Identifiant unique de l'e-mail rebondi, côté fournisseur. */
  readonly requestId: string | null;
  /** Référence côté client, si un jour on la pose à l'envoi. */
  readonly clientReference: string | null;
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Extrait le destinataire de la structure imbriquée du payload.
 *
 * ⚠️ `to` est un TABLEAU d'objets dont chacun porte un tableau `email_address`.
 * Cette double imbrication n'est pas une coquette : un e-mail peut avoir
 * plusieurs destinataires. On retient le PREMIER — le seul que nos envois
 * transactionnels utilisent — plutôt que de supposer qu'il n'y en a qu'un.
 */
function extraireDestinataire(emailInfo: Record<string, unknown>): string | null {
  const to = emailInfo["to"];
  if (!Array.isArray(to)) return null;
  for (const entree of to) {
    const e = objet(entree);
    const adresses = e?.["email_address"];
    if (!Array.isArray(adresses)) continue;
    for (const a of adresses) {
      const adresse = texte(objet(a)?.["address"]);
      if (adresse !== null) return adresse.toLowerCase();
    }
  }
  return null;
}

/**
 * Lit un payload de webhook ZeptoMail.
 *
 * Rend `null` si l'événement n'est PAS un rebond — l'agent peut être configuré
 * pour d'autres événements, et traiter un « ouvert » comme un rebond marquerait
 * un envoi réussi comme échoué.
 *
 * Ne lève jamais : un payload inattendu doit produire un refus lisible, pas une
 * erreur 500 sur un endpoint public.
 */
export function lireRebond(payload: unknown): RebondZeptomail | null {
  const racine = objet(payload);
  if (racine === null) return null;

  const nom = texte(racine["event_name"])?.toLowerCase();
  if (nom !== "hardbounce" && nom !== "softbounce") return null;

  const message = objet(racine["event_message"]) ?? {};
  const emailInfo = objet(message["email_info"]) ?? {};
  const eventData = objet(message["event_data"]) ?? {};
  const details = objet(eventData["details"]) ?? {};

  const brutTemps = texte(details["time"]);
  const survenuLe = brutTemps !== null ? new Date(brutTemps) : null;

  return {
    type: nom === "hardbounce" ? "hard" : "soft",
    destinataire: extraireDestinataire(emailInfo),
    sujet: texte(emailInfo["subject"]),
    motif: texte(details["reason"]),
    diagnostic: texte(details["diagnostic_message"]),
    // Un horodatage illisible ne doit pas produire une `Invalid Date` qui
    // partirait en base : Prisma la refuserait, et l'échec masquerait le rebond.
    survenuLe: survenuLe !== null && !Number.isNaN(survenuLe.getTime()) ? survenuLe : null,
    requestId: texte(message["request_id"]),
    clientReference: texte(emailInfo["client_reference"]),
  };
}

/**
 * Fenêtre de rattachement, en heures.
 *
 * Un rebond dur arrive en général en quelques secondes ; un rebond doux peut
 * suivre plusieurs heures de tentatives. 72 h couvre les deux sans risquer de
 * rattacher un rebond à un envoi d'une autre campagne — nos envois
 * transactionnels au même destinataire sont espacés de bien plus.
 */
export const FENETRE_RATTACHEMENT_HEURES = 72;
