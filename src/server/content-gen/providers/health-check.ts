/**
 * Content Generator — Health check helper (squelette Sprint 1 Day 1 AGT-B).
 *
 * Sprint 1 Day 2 : implémentation complète :
 * - cache Redis `provider:health:{key}` TTL 60s
 * - Sentry breadcrumb sur chaque check
 * - Alerte Telegram si 5+ checks failed consécutifs (cf. § 12.3bis)
 *
 * Délégué à `provider-router.ts:healthCheckAll()` pour le moment.
 */

import { healthCheckAll } from "./provider-router";

/**
 * Snapshot santé providers utilisé par /admin/content-gen/dashboard.
 * Day 2 : cache Redis + breadcrumb Sentry.
 */
export async function getProvidersHealthSnapshot(): Promise<{
  providers: Record<string, boolean>;
  allHealthy: boolean;
  checkedAt: string;
}> {
  const providers = await healthCheckAll();
  const allHealthy = Object.values(providers).every((v) => v === true);
  return {
    providers,
    allHealthy,
    checkedAt: new Date().toISOString(),
  };
}
