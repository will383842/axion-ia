/**
 * États et clés partagés des réponses écrites à la main (`submission-reply`,
 * `candidature-reponse`). Module PUR : aucun import, pour qu'une action serveur ou le worker
 * puissent le lire sans tirer l'autre dans leur graphe.
 */

export type GabaritReponse = "submission-reply" | "candidature-reponse";

export const TTL_MARQUEUR_ENVOYE_SEC = 2_592_000;

export const PREFIXE_ISSUE_INCONNUE = "[issue-inconnue] ";
export const CONSIGNE_VERIFIER_ZEPTOMAIL =
  "Avant de réessayer, cherchez le destinataire dans ZeptoMail (page E-mails envoyés, bouton ZeptoMail, onglet Processed emails), pas dans la boîte Zoho. S'il y figure, ne réessayez pas.";
export const MOTIF_ISSUE_INCONNUE =
  PREFIXE_ISSUE_INCONNUE +
  "Envoi interrompu, on ne sait pas si l'e-mail est parti. " +
  CONSIGNE_VERIFIER_ZEPTOMAIL;
export const MOTIF_REDIS_INDISPONIBLE =
  PREFIXE_ISSUE_INCONNUE +
  "Envoi non tenté : Redis indisponible, et un essai précédent a pu partir. " +
  CONSIGNE_VERIFIER_ZEPTOMAIL;
export const MOTIF_ECHEC_SANS_ENVOI =
  "Envoi non abouti après plusieurs essais, rien n'est parti (erreur technique avant l'envoi). Vous pouvez réessayer.";

/** Clé du verrou d'envoi d'une réponse. */
export const cleVerrouEnvoiReponse = (g: GabaritReponse, id: string): string =>
  `verrou:envoi-reponse:${g}:${id}`;

/** Clé du marqueur « le relais a accepté » d'une réponse. */
export const cleMarqueurEnvoiReponse = (g: GabaritReponse, id: string): string =>
  `envoye:envoi-reponse:${g}:${id}`;

/** Vrai si le message d'erreur de la ligne est une « issue inconnue ». */
export function estIssueInconnue(errorMsg: string | null | undefined): boolean {
  return (errorMsg ?? "").startsWith(PREFIXE_ISSUE_INCONNUE);
}
