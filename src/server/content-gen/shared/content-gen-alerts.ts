/**
 * Content Generator — Telegram alerts (Fix P1-17 audit opérationnel 2026-05-14).
 *
 * § 12.3bis master prompt v1.9 — 16 alertes content-gen avec lien admin
 * direct. Tous les helpers sont fire-and-forget (try/catch swallow) — une
 * alerte Telegram ne doit JAMAIS faire échouer un worker ou Server Action.
 *
 * Les URLs admin utilisent `ADMIN_URL_PREFIX` + `NEXT_PUBLIC_SITE_URL`.
 * Si l'une est absente, on émet quand même le message sans lien (best-effort).
 */

import { sendTelegram } from "@/lib/telegram";

function adminUrl(path: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const prefix = process.env.ADMIN_URL_PREFIX ?? "admin";
  if (!site) return `(admin /${prefix}/content-gen${path})`;
  return `${site}/fr/${prefix}/content-gen${path}`;
}

/**
 * 1. Cost cap 80 % (warning par provider). Runbook : R02.
 */
export async function alertCostCap80(
  provider: string,
  spent: number,
  cap: number,
  queuedJobs: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      silent: true,
      body:
        `*[⚠️ COÛT 80 %]* ${provider} mois : $${spent.toFixed(2)}/$${cap.toFixed(2)}.\n` +
        `${queuedJobs} jobs queued. Continue auto.\n` +
        `→ ${adminUrl("/settings/providers")}\n` +
        `Runbook : \`R02\` (docs/runbooks/R02-cost-cap-provider.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 2. Cost cap 100 % (critical + kill-switch auto déclenché ailleurs). Runbook : R02 (+ R01 release).
 */
export async function alertCostCap100(
  provider: string,
  spent: number,
  cap: number,
  pendingJobs: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      body:
        `*[🔴 COÛT 100 %]* ${provider} mois : $${spent.toFixed(2)}/$${cap.toFixed(2)}.\n` +
        `Kill switch auto activé. ${pendingJobs} jobs en attente.\n` +
        `→ ${adminUrl("/settings/providers")}\n` +
        `Runbook : \`R02\` (cost-cap) + \`R01\` (kill-switch release)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 3. Provider down 5 min (circuit ouvert). Runbook : R11.
 */
export async function alertProviderDown5min(
  provider: string,
  failsCount: number,
  fallback?: string,
  reroutedJobs?: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      silent: true,
      body:
        `*[⚠️ PROVIDER DOWN]* ${provider} down ` +
        `(${failsCount} erreurs/30s — circuit ouvert).\n` +
        `${fallback ? `Fallback ${fallback} actif. ` : ""}${
          reroutedJobs ? `${reroutedJobs} jobs basculés. ` : ""
        }ETA 60 s.\n` +
        `Runbook : \`R11\` (docs/runbooks/R11-provider-circuit-breaker.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 4. Provider down 30 min (critical escalade). Runbook : R11.
 */
export async function alertProviderDown30min(
  provider: string,
  fallbackSaturated?: boolean,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "INCIDENT",
      body:
        `*[🔴 PROVIDER LONG DOWN]* ${provider} down 30 min.\n` +
        `${fallbackSaturated ? "Fallback saturé (rate-limit). " : ""}Pause batch recommandée.\n` +
        `→ ${adminUrl("/coverage")}\n` +
        `Runbook : \`R11\` (provider down — escalade L1 Will si > 30 min)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 5. KB not ready (< seuil chunks ou ratio canonical insuffisant). Runbook : R07.
 */
export async function alertKbNotReady(
  currentChunks: number,
  minChunks: number,
  canonicalRatio: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      body:
        `*[🔴 KB NOT READY]* ${currentChunks}/${minChunks} chunks min. ` +
        `Canonical ${(canonicalRatio * 100).toFixed(0)} %.\n` +
        `Gen bloquée. → outil axionia-connaissances.\n` +
        `Runbook : \`R07\` (docs/runbooks/R07-kb-not-ready.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 6. 5 jobs failed consécutifs sur même type de contenu (critical). Runbook : R05/R11/R12 selon cause.
 */
export async function alertBatchFail(
  contentType: string,
  campaignId: string | null,
  failedCount: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "INCIDENT",
      body:
        `*[🔴 BATCH FAIL]* ${failedCount} jobs failed sur ${contentType}.\n` +
        `Pause auto recommandée.\n` +
        `→ ${adminUrl(campaignId ? `/coverage/${campaignId}` : "/jobs?status=failed")}\n` +
        `Runbooks : \`R05\` (workers down) · \`R11\` (provider circuit) · \`R12\` (quality runaway)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 7. Nouveau contenu en review (info).
 */
export async function alertNewReview(contentType: string, pendingCount: number): Promise<void> {
  try {
    await sendTelegram({
      tag: "AUTO",
      silent: true,
      body:
        `*[ℹ️ REVIEW]* ${pendingCount} contenu(s) ${contentType} à valider.\n` +
        `→ ${adminUrl("/publications-status")}`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 8. Batch / campagne terminée (info).
 */
export async function alertCampaignDone(
  campaignName: string,
  campaignId: string,
  totalCount: number,
  costUsd: number,
  avgScore: number,
  publishedCount: number,
  failedCount: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "AUTO",
      silent: true,
      body:
        `*[✓ DONE]* Campagne ${campaignName} (${totalCount} contenus).\n` +
        `Coût $${costUsd.toFixed(2)}. Score moyen ${avgScore.toFixed(0)}. ` +
        `${publishedCount} publiés, ${failedCount} failed.\n` +
        `→ ${adminUrl(`/coverage/${campaignId}`)}`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 9. LCP dégradé p75 (legacy v1.9 + Web Vitals Sprint S0bis). Runbook : R30.
 */
export async function alertLcpDegraded(p75ms: number, pageType: string): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      silent: true,
      body:
        `*[⚠️ WEB_VITALS_DEGRADED]* LCP p75 = ${p75ms} ms (> 2000ms cible) sur ${pageType} (24h).\n` +
        `→ ${adminUrl("/web-vitals")}\n` +
        `Runbook : \`R30\` (docs/runbooks/R30-lighthouse-weekly.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 10. INP dégradé p75. Runbook : R30.
 */
export async function alertInpDegraded(p75ms: number, pageType: string): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      silent: true,
      body:
        `*[⚠️ WEB_VITALS_DEGRADED]* INP p75 = ${p75ms} ms (> 200ms cible) sur ${pageType} (24h).\n` +
        `→ ${adminUrl("/web-vitals")}\n` +
        `Runbook : \`R30\` (docs/runbooks/R30-lighthouse-weekly.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 11. CLS dégradé p75 (critical). Runbook : R30.
 */
export async function alertClsDegraded(p75: number, pageType: string): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      body:
        `*[🔴 WEB_VITALS_DEGRADED]* CLS p75 = ${p75.toFixed(2)} (> 0.1 cible) sur ${pageType} (24h).\n` +
        `→ ${adminUrl("/web-vitals")}\n` +
        `Runbook : \`R30\` (docs/runbooks/R30-lighthouse-weekly.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 12. Queue stuck (waiting > 30 min sans progression). Runbook : R05.
 *
 * Trigger : cron health-check (à câbler V1.5 dans content-similarity-monitor-worker
 * ou nouveau queue-health-worker) qui inspecte `bull:content-gen:waiting` count
 * stable sur 30 min sans nouveau `active`. Helper prêt à recevoir.
 */
export async function alertQueueStuck(
  queueName: string,
  waitingCount: number,
  minutesStuck: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "INCIDENT",
      body:
        `*[⚠️ QUEUE STUCK]* ${queueName} : ${waitingCount} jobs waiting depuis ${minutesStuck} min ` +
        `sans progression.\n` +
        `Vérifier workers Coolify.\n` +
        `→ ${adminUrl("/jobs?status=waiting")}\n` +
        `Runbook : \`R05\` (docs/runbooks/R05-workers-down.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 13. Soft-404 détecté sur tier-1 (link-checker quotidien). Runbook : R09 + R20.
 *
 * Trigger : cron quotidien link-checker (à câbler V1.5 — pas de worker dédié V1).
 * Inspecte les URLs tier-1 publiées et détecte 200 OK avec body court / template vide.
 * Helper prêt à recevoir — appeler avec slug + raison (empty body / canonical redirect / etc).
 */
export async function alertSoft404Detected(
  slug: string,
  reason: string,
  affectedCount?: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      body:
        `*[⚠️ SOFT-404]* tier-1 \`${slug}\` détecté soft-404 — raison : ${reason}.\n` +
        `${affectedCount ? `${affectedCount} URLs affectées au total. ` : ""}` +
        `Vérifier contenu + canonical + cache.\n` +
        `→ ${adminUrl("/publications-status")}\n` +
        `Runbooks : \`R09\` (doctrine/dépublication) · \`R20\` (CF cache stale)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 14. Indexation tier-1 stagnante (CTR < 1 % après 90 j). Info, pas d'action immédiate.
 *
 * Trigger : cron Search Console stats (à câbler V1.5 — `content-keyword-sync-worker`
 * existe mais ne fait pas encore l'analyse stagnation). Notification info pour Will
 * pour décider promo/depublish manuel.
 */
export async function alertIndexationStagnant(
  slug: string,
  ctrPct: number,
  ageDays: number,
  impressions: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "AUTO",
      silent: true,
      body:
        `*[ℹ️ INDEXATION STAGNANTE]* tier-1 \`${slug}\` : ` +
        `CTR ${ctrPct.toFixed(2)} % sur ${impressions} impressions (${ageDays} j).\n` +
        `Considérer rewrite ou rétrograder tier-2.\n` +
        `→ ${adminUrl(`/jobs?slug=${encodeURIComponent(slug)}`)}\n` +
        `Runbook : \`R30\` (Lighthouse weekly) + analyse Search Console`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 15. Tier-3 stagnant 90 j (info, auto-purge prévue). Runbook : R26.
 *
 * Trigger : cron quotidien retention (peut être appelé depuis content-tier-lifecycle-worker
 * ou retention-purge-worker au moment du scan tier-3). Info Will avant purge effective.
 */
export async function alertTier3Stagnant(
  affectedCount: number,
  oldestAgeDays: number,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "AUTO",
      silent: true,
      body:
        `*[ℹ️ TIER-3 STAGNANT]* ${affectedCount} articles tier-3 > 90 j ` +
        `(le plus ancien : ${oldestAgeDays} j).\n` +
        `Purge auto programmée (R26).\n` +
        `→ ${adminUrl("/publications-status?tier=tier_3_noindex_nofollow")}\n` +
        `Runbook : \`R26\` (docs/runbooks/R26-retention-tier3-cleanup.md)`,
    });
  } catch {
    // best-effort
  }
}
