/**
 * Qualiopi — Délai laissé pour saisir l'évaluation finale des acquis.
 *
 * Module PUR (aucun I/O, aucun `server-only`) : il est lu par l'évaluateur
 * d'alertes ET par le cron `attestations-auto` du worker.
 *
 * ⚠️ Ce n'est PAS un nouveau délai. C'est le littéral `daysAgo(2, now)` que la
 * règle R05 (« Évaluation finale des acquis manquante », `evaluateur.ts`) portait
 * seule, nommé pour être partagé.
 *
 * 🔴 Décision Will D1 (2026-09-14, audit initial, X-documents-pdf-04) :
 * l'attestation de fin de formation part même sans évaluation finale, mais pas
 * avant ce délai — émettre plus tôt préempterait une évaluation saisie en
 * retard. L'alerte qui réclame l'évaluation et le cron qui cesse de l'attendre
 * doivent lire la MÊME borne : deux littéraux « 2 » finiraient par diverger.
 */
export const DELAI_EVALUATION_FINALE_JOURS = 2;
