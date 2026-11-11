/**
 * Valeur de MISE À L'ÉCART de la colonne `merci_statut` des contacts de la page guide — définie UNE fois.
 *
 * Avant : la marque d'une adresse opposée écrivait `ecartee` (page-confirmation) et l'effacement
 * RGPD écrivait `ecarte` (rgpd-erase). On écrit désormais `ecarte` partout ; `ecartee`, déjà
 * posée en base par l'ancien code, reste LUE comme écartée (rien n'est réécrit ni supprimé).
 */
export const MERCI_STATUT_ECARTE = "ecarte";

/** Graphie antérieure, lue mais plus écrite. */
export const MERCI_STATUT_ECARTE_ANCIEN = "ecartee";

/** Toutes les valeurs à lire comme « écarté ». */
export const MERCI_STATUTS_ECARTES_LUS = [MERCI_STATUT_ECARTE, MERCI_STATUT_ECARTE_ANCIEN] as const;

export function merciEstEcarte(statut: string): boolean {
  return (MERCI_STATUTS_ECARTES_LUS as readonly string[]).includes(statut);
}

/** Validée par la personne, « merci » pas encore pris en charge (posé par `page-confirmation.ts`). */
export const MERCI_STATUT_A_ENVOYER = "a_envoyer";

/** Réservé par le Studio (lot S4a) : sorti une fois de la liste, en attente de l'accusé de réception. */
export const MERCI_STATUT_RESERVE = "reserve";

/** « Merci » envoyé (accusé de réception du Studio). */
export const MERCI_STATUT_ENVOYE = "envoye";

/** Fenêtre de messagerie du réseau refermée : pas d'envoi possible. */
export const MERCI_STATUT_HORS_FENETRE = "hors_fenetre";

/** Aucun « merci » à envoyer pour ce contact. */
export const MERCI_STATUT_AUCUN = "aucun";

/** Resté `a_envoyer` plus de `FENETRE_MERCI_H` heures : la ligne est conservée, plus jamais proposée. */
export const MERCI_STATUT_EXPIRE = "expire";
