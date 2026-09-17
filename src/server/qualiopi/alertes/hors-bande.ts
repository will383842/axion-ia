/**
 * Les alertes qui ne doivent JAMAIS partir par e-mail (module PUR).
 *
 * ## Le défaut, mesuré en production le 2026-09-17
 *
 * `server/email/health.ts` porte en en-tête, depuis le 2026-08-16 :
 *
 * > « Une alerte sur l'e-mail ne doit pas dépendre de l'e-mail.
 * >   `notifierAlerteInterne()` n'est volontairement PAS appelé ici. »
 *
 * La phrase est vraie **du site d'appel** et fausse **du système**. La sonde
 * crée une `AlerteSysteme` de niveau `critique` ; le cron
 * `notifierAlertesGroupees` ramasse ensuite TOUTE alerte
 * `{ resolue: false, notifiedAt: null, niveau: "critique" }` et l'envoie… par
 * `enqueueEmail("qualiopi-alerte-interne", …)`. L'alerte « plus aucun e-mail ne
 * part » repartait donc par e-mail.
 *
 * Et le piège se referme : `enqueueEmail` **réussit** (Redis va bien, seul le
 * relais SMTP est mort), donc `auMoinsUnParti = true`, donc le claim n'est pas
 * relâché. `notifiedAt` reste posé — et la sélection du tour suivant exige
 * `notifiedAt: null`. **L'alerte n'est plus jamais notifiée, même après
 * réparation.**
 *
 * Trace relevée en base : une ligne `emails_en_echec` créée le 16/09 à 08:20
 * (vingt minutes après la première panne, titre « 3 e-mails en échec sur 6 h »),
 * `resolue = false`, `notified_at = 17/09 07:00` — et, au même horodatage, un
 * `email_logs` `qualiopi-alerte-interne` en **`failed`**. La détection avait
 * fonctionné et nommait déjà la cause ; c'est la NOTIFICATION qui a échoué.
 *
 * ## Ce que ce module décide
 *
 * Ces codes sortent du fan-out e-mail. Ils gardent leurs DEUX autres canaux, qui
 * ne dépendent pas de la chaîne en panne :
 *   - l'écran (`AlerteSysteme`, visible sur /qualiopi/a-traiter) ;
 *   - Telegram, poussé par la sonde elle-même via `notify` en catégorie
 *     `MONITORING_ALERT` (routée `channels: ["telegram"]`, cf.
 *     `notifications/routing.ts`).
 *
 * ⚠️ Cette liste n'est PAS tenue à la main : `hors-bande.spec.ts` la DÉRIVE des
 * appels à `leverAlerte` de la sonde et refuse tout code qui y manquerait. Un
 * sixième code ajouté demain rougira le jour où il sera écrit — c'est la même
 * mécanique que `la-sonde-et-le-catalogue-ne-divergent-pas.spec.ts`, et elle
 * existe parce que la liste écrite à la main de `catalogue.spec.ts` est restée
 * fausse quinze jours sans que rien ne rougisse.
 */

/**
 * Codes d'alerte dont l'objet EST la panne du canal e-mail.
 *
 * Les leur envoyer par e-mail, c'est écrire au destinataire qu'on ne peut pas
 * le joindre — et, pire que l'inutilité, consommer son accusé de notification.
 */
export const CODES_HORS_BANDE: readonly string[] = [
  "emails_en_echec",
  "emails_echecs_consecutifs",
  "emails_bloques_en_file",
  "emails_sante_non_mesurable",
  "emails_approuves_abandonnes",
  "emails_rebonds",
  "emails_rebonds_non_detectes",
] as const;

/** Vrai si ce code ne doit pas emprunter la chaîne d'e-mails pour se signaler. */
export function estHorsBande(code: string): boolean {
  return CODES_HORS_BANDE.includes(code);
}
