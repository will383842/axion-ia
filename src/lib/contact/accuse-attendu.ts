/**
 * QUEL ACCUSÉ DE RÉCEPTION un message déposé doit-il recevoir ?
 *
 * Une seule table pour deux lecteurs :
 *   - le formulaire `/contact` (`features/unified-contact/actions.ts`), qui
 *     choisit le gabarit qu'il ENVOIE ;
 *   - la console (`features/admin-submissions/accuse-reception.ts`), qui dit si
 *     cet accusé est PARTI.
 * Si les deux avaient chacun leur liste, la console chercherait un jour un
 * gabarit que le formulaire n'envoie plus, et afficherait « aucun accusé » sur
 * un message bel et bien accusé.
 *
 * Module pur, sans dépendance serveur.
 */

import type { UnifiedContactType } from "@/lib/schemas/unified-contact-schema";

/** Le gabarit d'accusé envoyé par le formulaire `/contact`, par type. */
export function gabaritAccuseContact(
  type: UnifiedContactType,
): "audit-confirmed" | "implementation-confirmed" | "quote-request-received" | "contact-confirmed" {
  switch (type) {
    case "audit":
      return "audit-confirmed";
    case "implementation":
      return "implementation-confirmed";
    // `quote-request-received` était écrit et déclaré depuis le sprint Booking,
    // mais appelé NULLE PART : les demandes de devis retombaient sur l'accusé
    // générique. Branché le 2026-08-13.
    case "devis":
      return "quote-request-received";
    // Les autres types gardent l'accusé générique. Le routage interne fin se
    // fait côté Telegram (catégories distinctes).
    case "formation":
    case "un_a_un":
    case "partenariat":
    case "presse":
    case "recrutement":
    case "speaker":
    case "investisseur":
    case "support_client":
    case "autre":
      return "contact-confirmed";
  }
}

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
    case "ecran-1-du-dossier":
      return "Aucun accusé, et c’est voulu : contact enregistré à l’écran 1 du dossier, l’accusé part quand le dossier complet arrive.";
    // `saisie-manuelle-actions.ts` : la ligne est saisie dans la console, pas
    // déposée par la personne.
    case "saisie-manuelle":
      return "Aucun accusé, et c’est voulu : contact saisi à la main dans la console.";
    default:
      return null;
  }
}
