/**
 * Constantes de la mise à l'écart pour demande d'effacement (décision de Williams du 11/11/2026).
 * Fichier SANS import : relu par la liste de suppression exportée et par la console Conformité
 * RGPD, qui n'ont pas à charger le module d'écart (opposition, CRM, effaceurs).
 */

/** Trace de la demande. Préfixe `gdpr.` : conservée comme les autres preuves RGPD (5 ans). */
export const ACTION_DEMANDE_EFFACEMENT = "gdpr.erase.requested";

/** Code de l'alerte de la cloche (catalogue : `server/qualiopi/alertes/catalogue.ts`). */
export const CODE_ALERTE_EFFACEMENT = "rgpd_effacement_a_traiter";

/**
 * `alertes_systeme.cible_id` est une colonne UUID : l'empreinte HMAC de l'adresse (hex) ou
 * l'adresse elle-même y feraient échouer l'écriture (« invalid input syntax for type uuid »),
 * et l'alerte de la cloche ne serait jamais créée. On en tire un UUID DÉTERMINISTE (les 32
 * premiers caractères hexadécimaux de l'empreinte) : même personne = même cible, rien en clair.
 */
export function cibleIdAlerteDepuisEmpreinte(empreinte: string): string {
  const h = empreinte
    .replace(/[^0-9a-f]/gi, "")
    .toLowerCase()
    .padEnd(32, "0")
    .slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
