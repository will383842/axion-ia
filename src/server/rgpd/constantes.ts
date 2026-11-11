/**
 * Constantes de la mise à l'écart pour demande d'effacement (décision de Williams du 11/11/2026).
 * Fichier SANS import : relu par la liste de suppression exportée et par la console Conformité
 * RGPD, qui n'ont pas à charger le module d'écart (opposition, CRM, effaceurs).
 */

/** Trace de la demande. Préfixe `gdpr.` : conservée comme les autres preuves RGPD (5 ans). */
export const ACTION_DEMANDE_EFFACEMENT = "gdpr.erase.requested";

/** Code de l'alerte de la cloche (catalogue : `server/qualiopi/alertes/catalogue.ts`). */
export const CODE_ALERTE_EFFACEMENT = "rgpd_effacement_a_traiter";
