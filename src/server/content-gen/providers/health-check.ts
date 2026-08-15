/**
 * Content Generator — Health check helper (squelette Sprint 1 Day 1 AGT-B).
 *
 * Fix 2026-08-15 (audit e2e, F7) — le « cache Redis 60 s » promis ici (et dans
 * le commentaire de `provider-router.ts:healthCheckAll`) n'avait JAMAIS été
 * implémenté : chaque affichage du dashboard admin déclenchait un VRAI appel
 * Anthropic + Perplexity (le healthCheck Perplexity est un mini-call payant
 * ~$0.005 + tokens, faute d'endpoint santé), HORS `trackCost` → dépense
 * invisible du ledger, facturée à chaque rafraîchissement de page.
 *
 * Choix d'implémentation : cache MÉMOIRE process (TTL 60 s), pas Redis.
 *  - Le snapshot n'est consommé que par la surface admin, servie par l'unique
 *    process web (Coolify, 1 conteneur) : aucun besoin de partage inter-process.
 *  - Évite d'introduire ici une dépendance Redis (et sa gymnastique
 *    stub.invalid au build, cf. ADR 0026) pour un simple memoïze court.
 *  - On met en cache la PROMESSE (pas le résultat) : deux rendus concurrents
 *    partagent le même check en vol (anti-stampede). Un check qui rejette est
 *    évincé du cache pour ne pas figer 60 s d'erreur.
 */

import { healthCheckAll } from "./provider-router";

export interface ProvidersHealthSnapshot {
  providers: Record<string, boolean>;
  allHealthy: boolean;
  checkedAt: string;
}

/** TTL du cache santé providers — 60 s, conforme à la promesse d'origine. */
const HEALTH_CACHE_TTL_MS = 60_000;

let cachedSnapshot: { promise: Promise<ProvidersHealthSnapshot>; expiresAt: number } | null = null;

async function computeSnapshot(): Promise<ProvidersHealthSnapshot> {
  const providers = await healthCheckAll();
  const allHealthy = Object.values(providers).every((v) => v === true);
  return {
    providers,
    allHealthy,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Snapshot santé providers utilisé par /admin/content-gen/dashboard.
 * Servi depuis le cache 60 s : rafraîchir la page admin ne facture plus un
 * appel provider à chaque fois.
 */
export async function getProvidersHealthSnapshot(): Promise<ProvidersHealthSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
    return cachedSnapshot.promise;
  }
  const promise = computeSnapshot().catch((err: unknown) => {
    // Ne pas figer un échec pendant 60 s : le prochain appel re-tente.
    cachedSnapshot = null;
    throw err;
  });
  cachedSnapshot = { promise, expiresAt: now + HEALTH_CACHE_TTL_MS };
  return promise;
}

/** Reset utilitaire (tests uniquement). */
export function _resetProvidersHealthCache(): void {
  cachedSnapshot = null;
}
