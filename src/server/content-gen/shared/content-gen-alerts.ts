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
        `*[🔴 FOURNISSEUR IA HORS SERVICE]* ${provider} hors service depuis 30 min.\n` +
        `${fallbackSaturated ? "Secours saturé (limite de débit atteinte). " : ""}Pause de la génération recommandée.\n` +
        `→ ${adminUrl("/coverage")}\n` +
        `Runbook : \`R11\` (fournisseur hors service — escalade Will si > 30 min)`,
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
      // 2026-07-19 : rétrogradé INCIDENT → MONITORING (opérationnel, pas un
      // incident serveur). Réserve « 🔴 Incident » aux vraies pannes.
      tag: "MONITORING",
      body:
        `*[⚠️ ÉCHECS EN SÉRIE]* ${failedCount} générations échouées sur le type « ${contentType} ».\n` +
        `Pause automatique recommandée.\n` +
        `→ ${adminUrl(campaignId ? `/coverage/${campaignId}` : "/jobs?status=failed")}\n` +
        `Runbooks : \`R05\` (workers arrêtés) · \`R11\` (fournisseur) · \`R12\` (qualité)`,
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
        // 2026-07-20 : wording corrigé. « à valider » laissait croire à une action
        // de Will ; en réalité la file `needs_review` est traitée automatiquement
        // (dédup sémantique + benefit-gate), aucune validation manuelle attendue.
        `*[ℹ️ REVUE AUTO]* ${pendingCount} contenu(s) « ${contentType} » en revue (traités automatiquement : dédup + qualité).\n` +
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
 * Helpers Web Vitals 9-11 — invariants (audit 2026-05-15 P0 monitoring fix).
 *
 * Signature objet pour transporter URL exacte (utile pour le runbook R30 :
 * lien direct PageSpeed Insights de la route fautive) + budget AGENTS.md de
 * référence (LCP 1800 / INP 100 / CLS 0,1 cible interne ; Google "good" est
 * 2500 / 200 / 0,1) + count d'échantillons p75 (fiabilité < 5 = N/A).
 *
 * Le worker `content-web-vitals-monitor-worker` appelle ces helpers une fois
 * par breach (avec bulk message ailleurs si > 5 breaches d'un coup).
 */

/** Param transporté par les 3 helpers Web Vitals. */
export interface WebVitalBreachInput {
  /** Pathname canonique de la route (ex. `/fr/interventions`). */
  readonly url: string;
  /** Valeur p75 mesurée (ms pour LCP/INP, unitless pour CLS). */
  readonly p75: number;
  /** Budget AGENTS.md cible interne. */
  readonly budget: number;
  /** Nombre d'échantillons RUM dans la fenêtre 24h (≥ MIN_SAMPLES). */
  readonly count: number;
}

/** Format value selon metric (CLS = 3 décimales, ms entiers sinon). */
function fmtVitalMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}
function fmtCls(v: number): string {
  return v.toFixed(3);
}

/** Lien PageSpeed Insights direct route fautive (signal utile runbook R30). */
function psiUrl(routePath: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const full = site ? `${site}${routePath}` : routePath;
  return `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(full)}`;
}

/**
 * 9. LCP dégradé p75 (cible interne 1 800 ms, Google good 2 500). Runbook : R30.
 */
export async function alertLcpDegraded(input: WebVitalBreachInput): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      silent: true,
      body:
        `*[⚠️ WEB_VITALS_DEGRADED]* LCP p75 = ${fmtVitalMs(input.p75)} ` +
        `(budget ${fmtVitalMs(input.budget)}, n=${input.count}) sur \`${input.url}\`.\n` +
        `→ ${adminUrl("/web-vitals")}\n` +
        `→ PSI : ${psiUrl(input.url)}\n` +
        `Runbook : \`R30\` (docs/runbooks/R30-lighthouse-weekly.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 10. INP dégradé p75 (cible interne 100 ms, Google good 200). Runbook : R30.
 */
export async function alertInpDegraded(input: WebVitalBreachInput): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      silent: true,
      body:
        `*[⚠️ WEB_VITALS_DEGRADED]* INP p75 = ${fmtVitalMs(input.p75)} ` +
        `(budget ${fmtVitalMs(input.budget)}, n=${input.count}) sur \`${input.url}\`.\n` +
        `→ ${adminUrl("/web-vitals")}\n` +
        `→ PSI : ${psiUrl(input.url)}\n` +
        `Runbook : \`R30\` (docs/runbooks/R30-lighthouse-weekly.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 11. CLS dégradé p75 (cible interne 0 strict, Google good 0,1 — critical). Runbook : R30.
 */
export async function alertClsDegraded(input: WebVitalBreachInput): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      body:
        `*[🔴 WEB_VITALS_DEGRADED]* CLS p75 = ${fmtCls(input.p75)} ` +
        `(budget ${fmtCls(input.budget)}, n=${input.count}) sur \`${input.url}\`.\n` +
        `→ ${adminUrl("/web-vitals")}\n` +
        `→ PSI : ${psiUrl(input.url)}\n` +
        `Runbook : \`R30\` (docs/runbooks/R30-lighthouse-weekly.md)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 11bis. Bulk Web Vitals alert — agrège top 5 breaches quand > 5 d'un coup
 * (évite spam Telegram). Format conservant la doctrine R30. Runbook : R30.
 */
export async function alertWebVitalsBulk(
  topBreaches: readonly (WebVitalBreachInput & { readonly metric: string })[],
  totalBreaches: number,
  windowHours: number,
): Promise<void> {
  if (topBreaches.length === 0) return;
  try {
    const lines = topBreaches.map((b) => {
      const fmt = b.metric === "CLS" ? fmtCls : fmtVitalMs;
      return `• ${b.metric} \`${b.url}\` p75=${fmt(b.p75)} (budget ${fmt(b.budget)}, n=${b.count})`;
    });
    await sendTelegram({
      tag: "MONITORING",
      body:
        `*[⚠️ WEB_VITALS_DEGRADED bulk]* ${totalBreaches} breaches sur ${windowHours}h.\n` +
        `Top ${topBreaches.length} :\n` +
        lines.join("\n") +
        `\n→ ${adminUrl("/web-vitals")}\n` +
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
        `*[🔴 FILE BLOQUÉE]* ${queueName} : ${waitingCount} tâches en attente depuis ${minutesStuck} min ` +
        `sans progression.\n` +
        `Vérifier les workers sur Coolify.\n` +
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
 * 16. IndexNow fail ≥3 consécutifs (audit indexation 2026-05-15 P0-10).
 *
 * Trigger : compteur Redis incrémenté à chaque fail upstream IndexNow + alerte
 * Telegram si ≥3 fails consécutifs dans une fenêtre 1h. Sans cette alerte, un
 * IndexNow down 24-72h reste invisible — toute la chaîne d'indexation Bing/
 * Yandex passe alors par la découverte naturelle (~7-14j vs 24-48h ping).
 */
export async function alertIndexNowFailStreak(
  consecutiveFails: number,
  lastError: string,
): Promise<void> {
  try {
    await sendTelegram({
      // 2026-07-19 : rétrogradé INCIDENT → MONITORING (opérationnel, pas un
      // incident serveur). Réserve « 🔴 Incident » aux vraies pannes.
      tag: "MONITORING",
      body:
        `*[⚠️ INDEXNOW EN ÉCHEC]* ${consecutiveFails} échecs consécutifs sur api.indexnow.org.\n` +
        `Dernier message : ${lastError}.\n` +
        `Impact : Bing/Yandex/Naver/Seznam ne reçoivent plus les pings — découverte naturelle ~7-14 j.\n` +
        `Vérifier la connectivité et le statut de api.indexnow.org.\n` +
        `→ ${adminUrl("/jobs?queue=content-indexnow&status=failed")}\n` +
        `Runbook : \`R14\` (docs/runbooks/R14-indexnow-down.md si présent)`,
    });
  } catch {
    // best-effort
  }
}

/**
 * 17. Déséquilibre villes campagne (>30% villes sans contenu après 7j running).
 */
export async function alertCityEquityImbalance(
  campaignId: string,
  campaignName: string,
  zeroCitiesCount: number,
  totalCities: number,
): Promise<void> {
  const pct = Math.round((zeroCitiesCount / totalCities) * 100);
  try {
    await sendTelegram({
      tag: "MONITORING",
      silent: true,
      body:
        `*[⚠️ DÉSÉQUILIBRE VILLES]* Campagne « ${campaignName} »\n` +
        `${zeroCitiesCount}/${totalCities} villes sans contenu (${pct}%) après 7j.\n` +
        `→ ${adminUrl("/city-equity")}\n` +
        `Action : vérifier cityProcessingMode + distribution par tier de population.`,
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

/**
 * Auto-arrêt de la production sur panne permanente d'un provider (quota épuisé,
 * authentification refusée). Ajouté 2026-08-15 : jusque-là, un compte sans
 * crédit laissait l'orchestrateur enfiler des jobs voués à l'échec jusqu'à
 * intervention manuelle (~1 500 jobs perdus entre le 09/07 et le 24/07).
 */
export async function alertGenerationHalted(
  provider: string,
  reason: string,
  providerMessage: string,
): Promise<void> {
  try {
    await sendTelegram({
      tag: "MONITORING",
      body:
        `*[🛑 GÉNÉRATION ARRÊTÉE]* provider ${provider}.\n` +
        `${reason}\n` +
        `Message du provider : ${providerMessage.slice(0, 200)}\n` +
        `Les jobs en échec seront relancés automatiquement à la reprise.\n` +
        `→ ${adminUrl("/settings/kill-switch")}\n` +
        `Runbook : \`R01\` (kill-switch release) + \`R02\` (cost cap)`,
    });
  } catch {
    // best-effort
  }
}

/** Une chute de position keyword détectée par le détecteur weekly. */
export interface KeywordRankDropInput {
  readonly keyword: string;
  /** Position actuelle (après la chute). */
  readonly position: number;
  /** Places perdues sur 7 j (positionDelta > 0 = descente). */
  readonly delta: number;
  readonly targetUrl: string | null;
}

/**
 * 18. Chutes de positions keywords (> 5 places en 7 j) — agrégée.
 *
 * Fix 2026-08-15 (audit e2e, F9) — `keyword-opportunity-detector.ts` loggait un
 * `console.warn` avec un commentaire affirmant que l'alerte Telegram était
 * « câblée dans content-monitoring-worker » : c'était FAUX, aucune alerte
 * rank-drop n'existait nulle part. Helper agrégé (1 message par run weekly,
 * top N listé) pour éviter le spam — même doctrine que `alertWebVitalsBulk`.
 */
export async function alertKeywordRankDrops(
  topDrops: ReadonlyArray<KeywordRankDropInput>,
  totalDrops: number,
): Promise<void> {
  if (topDrops.length === 0) return;
  try {
    const lines = topDrops.map(
      (d) =>
        `• \`${d.keyword}\` : -${d.delta} places (position ${d.position})` +
        `${d.targetUrl ? ` — ${d.targetUrl}` : ""}`,
    );
    await sendTelegram({
      tag: "MONITORING",
      silent: true,
      body:
        `*[⚠️ CHUTES DE POSITIONS]* ${totalDrops} keyword(s) en chute > 5 places sur 7 j.\n` +
        `Top ${topDrops.length} :\n` +
        lines.join("\n") +
        `\n→ ${adminUrl("/keywords")}\n` +
        `Action : vérifier contenu + concurrence sur ces requêtes.`,
    });
  } catch {
    // best-effort
  }
}
