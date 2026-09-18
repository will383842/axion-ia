/**
 * QUEL ACCUSÉ DE RÉCEPTION un message déposé doit-il recevoir ?
 *
 * La console (`features/admin-submissions/accuse-reception.ts`) y cherche les
 * accusés ; les formulaires, eux, choisissent le gabarit qu'ils envoient à
 * côté de leur appel d'envoi (le catalogue des e-mails vérifie que le fichier
 * déclaré est bien celui qui envoie). Un test lit ces formulaires et exige que
 * chaque gabarit qu'ils envoient figure ici : sans lui, la console chercherait
 * un jour un gabarit qu'on n'envoie plus, et dirait « aucun accusé » sur un
 * message bel et bien accusé.
 *
 * Module pur, sans dépendance serveur.
 */

/**
 * TOUS les gabarits qui accusent réception d'un message (`Submission`), tous
 * formulaires confondus. La console les cherche tous : un message dont le
 * type n'est pas reconnu garde ainsi une chance d'être rattaché à son accusé.
 */
export const GABARITS_ACCUSE_MESSAGE = [
  "contact-confirmed",
  "audit-confirmed",
  "implementation-confirmed",
  "quote-request-received",
  // Dossier apporteur complet (`commercial-application/actions.ts`).
  "candidature-commercial-confirmee",
  // Premier contact apporteur, formulaire court (`lead-actions.ts`).
  "lead-apporteur-recu",
  // Simulateur de gains : le rapport lui-même tient lieu d'accusé.
  "roi-report",
] as const;

/** `EmailLog.entityType` posé à l'enfilage d'un accusé de message. */
export const ENTITE_MESSAGE = "Submission";

/** `details.origine` d'un contact apporteur capturé à l'écran 1 du dossier. */
export const ORIGINE_ECRAN_1_DOSSIER = "ecran-1-du-dossier";
/** `details.origine` d'un contact apporteur saisi à la main dans la console. */
export const ORIGINE_SAISIE_MANUELLE = "saisie-manuelle";

/**
 * Les dépôts qui, VOLONTAIREMENT, ne reçoivent aucun accusé — et pourquoi.
 * La console l'écrit tel quel au lieu d'un « aucun accusé » qui aurait l'air
 * d'une panne.
 */
export function absenceVoulue(details: { origine?: string | null }): string | null {
  switch (details.origine) {
    // `capture-actions.ts` : écrire « c'est noté » au milieu du dossier dirait à
    // la personne qu'elle peut s'arrêter. L'accusé part à la soumission
    // complète ; seuls les rappels J+2 / J+7 partent avant.
    case ORIGINE_ECRAN_1_DOSSIER:
      return "Aucun accusé, et c’est voulu : contact enregistré à l’écran 1 du dossier, l’accusé part quand le dossier complet arrive.";
    // `saisie-manuelle-actions.ts` : la ligne est saisie dans la console, pas
    // déposée par la personne.
    case ORIGINE_SAISIE_MANUELLE:
      return "Aucun accusé, et c’est voulu : contact saisi à la main dans la console.";
    default:
      return null;
  }
}
