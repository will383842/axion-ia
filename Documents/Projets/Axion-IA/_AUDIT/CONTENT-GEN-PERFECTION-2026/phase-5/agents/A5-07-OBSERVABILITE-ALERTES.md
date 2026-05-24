# A5-07 — Observabilité & Alertes — Score 38/100

> Audit AUDIT-ONLY — lecture seule, zéro modification source.
> Date : 2026-05-21. Agent : A5-07.

---

## Fichiers inspectés

| Fichier | Statut |
|---|---|
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/costs/_v2/CostsV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/queue/_v2/QueueV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/orchestrator/_v2/OrchestratorV2.tsx` | Lu |
| `src/server/queue/workers/content-monitoring-worker.ts` | Lu |
| `src/server/queue/workers/content-orchestrator-worker.ts` | Lu |
| `src/server/content-gen/shared/content-gen-alerts.ts` | Lu |
| `src/server/content-gen/lib/cost-tracker.ts` | Lu |
| `src/server/content-gen/keyword-selector.ts` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/jobs/_v2/JobsListV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/jobs/[id]/_v2/JobDetailV2.tsx` | Lu |
| `src/server/queue/queues.ts` | Lu |

---

## État actuel

### C1 — Anomaly detection qualité batch

Le `content-monitoring-worker.ts` (cron `15 * * * *`) implémente 3 checks :

1. **Queue stuck** : snapshot Redis `axion:monitoring:queue-snapshot:<queue>`, comparaison count stable > 30 min → `alertQueueStuck()` Telegram. Seuil : `QUEUE_STUCK_MINUTES = 30`. Couvre 4 queues critiques.
2. **Soft-404** : HEAD requests sur 10 URLs tier-1 aléatoires, détection body < 2000 bytes → `alertSoft404Detected()` Telegram.
3. **Indexation stagnante** : Articles tier-1 publiés ≥ 30 j sans `KeywordTracking` → `alertIndexationStagnant()` Telegram.

**Absent :** aucune détection de chute qualité batch (score moyen -15%), aucun spike rejets (> 50% failed par type), aucune détection "0 articles générés sur 4h". Ces 3 patterns critiques pour la supervision content-gen manquent. Il n'y a pas non plus d'alerte UI dans la console — uniquement Telegram (canal externe). L'`alertBatchFail` dans `content-gen-alerts.ts` existe mais n'est pas câblé dans le worker monitoring ; il exige que le trigger soit posé dans le worker primaire ou quality-improver.

### C2 — Logs structurés exposés UI

La page `/content-gen/jobs/[id]` (JobDetailV2) affiche :
- Un **live stream SSE** via `JobLogStream` (composant client, flux temps réel via `/api/content-gen/jobs/[id]/stream`).
- Une table **"Logs persistés"** : timestamp, niveau, étape, message (tronqué 120 chars).

La page `/content-gen/jobs` (JobsListV2) offre des **filtres SQL** sur : statut, contentType, template, secteur, ville, texte libre (search).

**Limites :**
- Les logs persistés (table `ContentGenJobLog`) sont visibles **uniquement au niveau d'un job individuel** — aucun viewer cross-jobs agrégé.
- Pas de filtre par level (warn/error/info) dans la vue de détail.
- Pas de pagination dans la vue logs d'un job (tous les logs du job sont affichés d'un coup).
- Aucun lien vers Sentry depuis l'UI, pas de bouton "Voir dans Sentry".
- Pas de route `/content-gen/logs/` dédiée au log-browsing transversal.

Le viewer par job est fonctionnel mais insuffisant pour debugger en cross-campagne.

### C3 — Alerting dépassement coût

`cost-tracker.ts` (`assertCostCapAvailable`) implémente :
- **80% cap** : alerte Telegram `alertCostCap80` (throttlé au passage de seuil, fire-and-forget).
- **100% cap** : `handleCostCapHit` → désactive provider (`enabled=false`) + Telegram MONITORING + kill-switch global si 0 provider restant + audit trail `cost_cap_events` dans `ContentGenConfig`.

`CostsV2.tsx` affiche le **% utilisé en rouge** si ≥ 80% (`warn = pct >= 80`). La colonne "% utilisé" est colorée via `--color-admin-destructive`.

**Lacunes UI :**
- Aucune bannière/alerte visuelle dédiée dans le dashboard principal au-dessus des tables.
- Pas de blocage UI auto (le kill-switch est activé côté worker, mais l'UI Costs ne reflète pas l'état "bloqué" explicitement).
- Pas d'alerte email — tout passe par Telegram.
- La projection fin de mois est un placeholder ("nécessite ≥ 7 jours d'historique").

### C4 — Reporting email hebdo (lundi 8h)

Aucun worker ou cron envoyant un rapport KPI email à `williamsjullin@gmail.com` n'existe dans le codebase. Les crons hebdo présents sont :
- `content-keyword-sync-cron` (lundi 04:00 UTC) — sync GSC.
- `content-psi-monitor-cron` (lundi 03:00 UTC) — Web Vitals PSI.

Aucun de ces workers n'envoie un digest KPI content-gen (articles publiés, coûts, scores moyens, campagnes). Il existe `enqueueEmail()` dans queues.ts mais aucun template "weekly-content-gen-report". Seul export manuel via `/api/content-gen/export` (CSV).

### C5 — keyword_select_exhausted warning

Dans `keyword-selector.ts` (ligne 127-134), quand DB + seeds sont tous vides, un `console.warn` JSON structuré est émis avec `event: "keyword_select_exhausted"`, `campaignId`, `vertical`, `timestamp`. Ce log est exploitable par Sentry si configuré.

**Absent :** aucune remontée UI dans la console admin. La page `/content-gen/orchestrator`, `/content-gen/jobs` ou tout autre écran n'affiche pas de warning "pool keywords épuisé". L'administrateur ne peut pas voir cet état sans lire les logs applicatifs externes.

---

## Gaps identifiés

### P0 (bloquant)

**P0-A — Absence de détection anomalie qualité batch**
Aucune détection automatique de chute score (-15%), spike rejets (+50%), ou 0 articles sur 4h. Le `content-monitoring-worker` surveille les queues et l'indexation mais pas les métriques qualité batch. Un runaway qualité (provider dégradé sans cost cap) passerait inaperçu jusqu'au lendemain matin.

**P0-B — Absence de reporting email hebdo KPI**
Will n'a aucun digest automatique lundi 8h. La seule notification proactive est Telegram (alertes ponctuelles). Sans ce rapport, Will doit ouvrir l'admin manuellement pour évaluer la semaine.

### P1 (important)

**P1-A — Logs UI limités au scope d'un job individuel**
Pas de viewer cross-jobs (ex : tous les jobs `failed` d'une campagne avec leurs derniers logs). Nécessite une navigation job par job.

**P1-B — keyword_select_exhausted invisible en UI**
Le log est émis mais non surfacé. Un banner ou stat card dans l'orchestrateur ou la page keywords indiquerait l'épuisement du pool.

**P1-C — Alerte coût 80% sans bannière UI persistante**
L'alerte Telegram est envoyée mais la page Costs ne montre pas de bannière sticky "ATTENTION : provider X à 85% du cap mensuel". La couleur rouge dans le tableau peut passer inaperçue.

**P1-D — Aucun lien Sentry depuis l'UI**
Pas de bouton "Voir dans Sentry" sur la page job detail ni dans la queue. Les erreurs worker capturées par `captureWorkerError` (Sentry) ne sont pas accessibles depuis la console.

### P2 (nice-to-have)

- **P2-A** : Pagination dans la vue logs d'un job (actuellement tous affichés, peut peser sur gros jobs).
- **P2-B** : Filtrage par level (error/warn/info) dans la vue logs persistés d'un job.
- **P2-C** : Projection fin de mois réelle dans CostsV2 (actuellement placeholder).
- **P2-D** : Graphe historique des coûts (30 jours) dans CostsV2 (actuellement tableau statique).
- **P2-E** : Stat card "Keywords épuisés" dans OrchestratorV2 (via lecture `ContentGenConfig`).

---

## Scoring détaillé

| Critère | Max | Score | Justification |
|---|---|---|---|
| C1 Anomaly detection | 25 | 8 | Queue-stuck (30 min) + soft-404 + indexation stagnante câblés. Mais zéro détection chute score qualité, spike rejets, 0-articles-4h. Alertes Telegram uniquement (pas UI). Seuil `alertBatchFail` non câblé dans monitoring. |
| C2 Logs structurés exposés UI | 25 | 15 | Viewer par job avec live stream SSE + table logs persistés (timestamp/level/step/message). Filtres jobs cross-status/type/ville. Manque : viewer cross-jobs agrégé, filtre level dans logs, lien Sentry. |
| C3 Alerting coût | 20 | 12 | Alerte Telegram 80% (throttlée au seuil) + disable provider auto + kill-switch 100% + audit trail. CostsV2 colore rouge ≥ 80%. Manque : bannière UI sticky, email, projection réelle. |
| C4 Reporting email hebdo | 20 | 0 | Aucun worker ni template email de digest KPI hebdo. Export manuel CSV uniquement. |
| C5 keyword_select_exhausted | 10 | 3 | Log JSON structuré émis (`console.warn`) — captur able Sentry. Aucune UI warning dans la console admin. |
| **TOTAL** | **100** | **38** | |

---

## Recommandations P0 urgentes

### P0-A — Anomaly detection qualité batch (~3h)

Ajouter dans `content-monitoring-worker.ts` une 4e fonction `checkBatchQualityAnomaly()` :

```typescript
// Pseudo-code
const last4h = new Date(Date.now() - 4 * 3600_000);
const completedLast4h = await prisma.contentGenJob.count({
  where: { status: 'published', completedAt: { gte: last4h } }
});
if (completedLast4h === 0) await alertZeroArticles4h();

const avgScoreLast24h = await prisma.contentGenJob.aggregate({
  where: { status: 'published', completedAt: { gte: new Date(Date.now() - 86400000) } },
  _avg: { qualityScore: true }
});
// Si avg < avg_7j * 0.85 → alertQualityDrop
```

Câbler `alertBatchFail` dans `content-gen-worker.ts` (compteur Redis d'échecs consécutifs par contentType).

### P0-B — Reporting email hebdo (~4h)

Créer un worker `content-weekly-report-worker.ts` (cron `0 8 * * 1` — lundi 08:00 UTC) qui :
1. Agrège les KPIs 7j : articles publiés, coûts total/$provider, score moyen, taux failed, campagnes actives/terminées, keywords épuisés.
2. Appelle `enqueueEmail('weekly-content-gen-report', 'williamsjullin@gmail.com', 'fr', kpis)`.
3. Crée le template email correspondant.

### P1-B — keyword_select_exhausted UI (~1h)

Dans `OrchestratorV2.tsx`, lire `ContentGenConfig.keyword_exhausted_alerts` (ou compter `keywords` table par vertical) et afficher un `AdminStatCard` orange "Keywords épuisés : N verticales".

---

*Rapport généré en lecture seule. Zéro modification apportée au code source.*
