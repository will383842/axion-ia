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
