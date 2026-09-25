/**
 * Version de consentement de REPLI pour la lettre — module PUR, sans import.
 *
 * Première version NOMMÉE (décision actée 2026-08-13). Depuis le lot L2, chaque
 * inscription porte SA référence et SA version (`consentFormRef` /
 * `consentVersion`) ; cette constante n'est plus que le repli des inscriptions
 * antérieures, qui n'en portent pas.
 *
 * Isolée ici pour que `crm-sync/inbound.ts` puisse la lire sans tirer
 * `desabonner.ts`, qui émet vers le CRM (anti-boucle du sens entrant).
 */
export const VERSION_LETTRE_HISTORIQUE = "newsletter-v1-2026-08-13";
