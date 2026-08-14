/**
 * Synchro site → Axion CRM Pro (lot L2) — configuration et DRAPEAUX.
 *
 * ⚠️ INERTIE, règle n°1 du lot : tant que `CRM_SYNC_ENABLED` n'est pas
 * exactement `"true"`, RIEN ne se passe — aucune ligne d'outbox écrite, aucun
 * appel réseau, aucun job de queue. Le comportement observable du site est
 * strictement identique à celui d'avant ce lot, et le rollback consiste à
 * remettre la variable à `false` (pas de revert, pas de restauration).
 *
 * Les drapeaux sont lus à CHAQUE appel (pas au chargement du module) : une
 * bascule Coolify redémarre le conteneur, mais les tests ont besoin de pouvoir
 * changer d'avis entre deux cas.
 */

/** Le drapeau MAÎTRE. Tout passe par lui. */
export function isCrmSyncEnabled(): boolean {
  return process.env.CRM_SYNC_ENABLED === "true";
}

/**
 * Second verrou, propre aux flux CANDIDATS. Il ne passe à `true` qu'APRÈS que
 * les textes de consentement v2 sont servis en production (séquencement croisé
 * imposé : le CRM REJETTE de toute façon une fiche candidat sans consentement
 * v2, cette garde évite simplement d'envoyer des messages voués au refus).
 */
export function isCrmSyncCandidatesEnabled(): boolean {
  return isCrmSyncEnabled() && process.env.CRM_SYNC_CANDIDATES_ENABLED === "true";
}

/** URL de l'endpoint d'ingestion du CRM (`…/api/internal/site-sync`). */
export function crmSyncUrl(): string | null {
  const url = process.env.CRM_SYNC_URL?.trim();
  return url && url.length > 0 ? url : null;
}

/** Secret partagé du canal (64 hex). Absent ⇒ aucune émission possible. */
export function crmSyncSecret(): string | null {
  const secret = process.env.SITE_SYNC_HMAC_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

/**
 * Nombre de tentatives avant abandon (`gave_up`). Un refus DÉFINITIF du CRM
 * (422) abandonne immédiatement, sans consommer les tentatives : rejouer un
 * message que le contrat refuse ne le rendra jamais valide.
 */
export const CRM_SYNC_MAX_ATTEMPTS = 8;

/** Délai d'attente d'une émission. Le CRM tourne sur un CPX22 : on est patient, pas infini. */
export const CRM_SYNC_TIMEOUT_MS = 10_000;

/**
 * Backoff exponentiel plafonné à 6 h : 1 min, 2, 4, 8, 16, 32, 64 min, puis 6 h.
 * Un CRM indisponible une nuit entière ne fait donc perdre aucun événement — il
 * fait juste grossir la file, ce que l'observabilité rendra visible.
 */
export function nextAttemptDelayMs(attempts: number): number {
  const base = 60_000 * 2 ** Math.max(0, attempts - 1);
  return Math.min(base, 6 * 60 * 60 * 1000);
}
