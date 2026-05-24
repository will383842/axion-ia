# A4-10 : Amélioration Continue & Feedback Loop

## Score : 13/30 (bonus)

---

### Synthèse rapide

| Dimension | Existant | Score |
|---|---|---|
| Feedback Will (interface annotation + active learning) | Partiel — UI approve/reject/edits présente, mais 0 active learning | 5/10 |
| Anomaly detection (batch reject streak, qualité moyenne, brand drift) | Partiel — batch fail câblé, quality dashboard présent, brand drift absent | 4/10 |
| Reporting hebdomadaire Will | Absent — aucun worker cron weekly report, 0 email/Slack récapitulatif | 4/10 |

---

## Feedback Will

### Ce qui existe (5/10)

**Interface d'approbation manuelle — PRÉSENTE**

Une page admin `/[adminPrefix]/content-gen/review-queue` est opérationnelle :
- `ReviewQueueListV2.tsx` liste les contenus avec statut `pending | approved | rejected | needs_edits | promoted_t1`
- `ReviewDetailV2.tsx` expose 4 actions : ✅ Approuver (tier-2), 🚀 Promouvoir tier-1, ✏️ Demander des modifs, ❌ Rejeter
- L'action `requestEdits()` dans `review.ts` stocke le commentaire Will en `reviewNotes` (max 5000 chars) et bascule le job en `quality_improving`
- L'action `approveReview()` logge `content-gen.review.approve` dans `ActivityLog` avec `reviewedBy: session.userId`, `reviewedAt`, `reviewNotes`
- Bulk approve/reject disponible (`bulkApproveReviews`, `bulkRejectReviews`) avec seuil de score configurable

**Historique des décisions — PRÉSENT**

- Table `ActivityLog` (Prisma) : chaque action admin mutante laisse une trace avec `adminUserId`, `action`, `targetType`, `targetId`, `changes`, `ipAddress`, `userAgent`
- Table `ReviewQueue` : champs `reviewedBy`, `reviewNotes`, `reviewedAt`, `promotedToTier1At` → historique complet par article
- Table `GenerationLog` (append-only) : trace immuable RGPD art. 30 par step worker

**LLM-as-judge (B.8 P1.5) — PRÉSENT**

- `llm-judge.ts` : Claude Sonnet 4.6 reviewer 7 dimensions (factualAccuracy, depth, originality, readability, seoCompleteness, valueToReader, toneAxioniaAlignment)
- Verdict : `publish` (≥8.5, 0 P0), `improve` (7-8.5), `reject` (<7 ou P0)
- Score stocké en `ContentGenJob.editorialScore` + `Article.editorialScore`

### Ce qui manque (−5 pts)

**Active learning = ABSENT**

- Les notes de rejet Will (`reviewNotes`) sont stockées en DB mais **ne sont jamais re-injectées dans le system prompt LLM** lors du re-prompt (commentaire explicite dans le code : `V1 = la guidance Will est stockée en reviewNotes mais pas encore re-promptée vers le LLM (skeleton). V1.5+ = le quality-improver consomme reviewNotes comme system prompt enrichi`)
- Aucun mécanisme de pondération des préférences Will : pas d'extraction de patterns "Will rejette X pour raison Y", pas de knowledge base des rejets
- Aucune interface d'annotation fine-grained (ne permet pas de noter par dimension : "section H2 trop courte", "ton trop générique") — uniquement champ texte libre
- Aucun scoring de satisfaction Will par article (thumbs up/down simple rapide absent)

**Modèle de préférences = ABSENT**

- Aucune table `EditorPreference` ou équivalent pour apprendre les patterns de validation Will
- Les `reviewNotes` ne sont pas analysées pour extraire des règles métier (ex : "quand Will écrit 'trop générique' → réduire originality score threshold")

---

## Anomaly detection

### Ce qui existe (4/10)

**alertBatchFail — CÂBLÉ (partiel)**

Dans `content-gen-worker.ts` (ligne 617-633) :
```typescript
// Si 5 jobs failed consécutifs sur même type (5 dernières heures)
if (recentFails >= 5 && recentFails % 5 === 0) {
  void alertBatchFail(contentType, dbJob.campaignId, recentFails)
}
```
- Alerte Telegram INCIDENT déclenché si ≥5 fails sur même `contentType` dans les 5 dernières heures
- Seuil = 5 fails (pas 3 comme demandé dans l'audit), critère = même type (pas "consécutifs" strictement)
- **Pas de pause automatique du worker** — alerte uniquement, action manuelle Will requise

**Quality dashboard — PRÉSENT**

- `/[adminPrefix]/content-gen/quality` : `QualityV2.tsx` affiche 5 scores moyens (SEO, Quality, Readability, FactCheck, Editorial) par jour sur 30j glissants
- Barres CSS inline, pas de bibliothèque graphique
- Requête agrégée depuis `Article` (publiés uniquement, `publishedAt ≥ since`)
- **Limite** : lecture sur `Article` seulement (publiés), pas sur `ContentGenJob` (rejetés/failed inclus)

**KPI dashboard 7 jours — PRÉSENT**

- `getDashboardKpis()` (`dashboard.ts`) : `avgQualityScore7d` calculé via `prisma.contentGenJob._avg({ qualityScore: true })`
- KPIs : `jobsRun7d`, `published7d`, `failed7d`, `pendingReview`, `costSpent7dUsd`, `avgQualityScore7d`

### Ce qui manque (−6 pts)

**Détection de streak de rejets HUMAINS = ABSENTE**

- Le compteur `alertBatchFail` surveille les `status='failed'` WORKER (erreurs techniques), **pas les rejets Will** (`ReviewQueue.status='rejected'`)
- Scénario non couvert : Will rejette 5 articles d'affilée → aucune alerte, aucune pause de campagne
- Aucune requête sur `ReviewQueue.status='rejected'` dans les workers

**Score moyen par batch = ABSENT**

- Aucun calcul de score moyen par `CoverageCampaign` (batch)
- Le `alertCampaignDone()` helper existe dans `content-gen-alerts.ts` avec `avgScore: number` en signature, mais **son appel est absent** (fonction déclarée, jamais invoquée dans les workers)

**Dérive brand voice (embedding) = ABSENTE**

- `content-similarity-monitor-worker.ts` existe (cron daily 04:30 UTC) mais surveille la similarité ENTRE articles générés (anti-doublon Jaccard SimHash), pas la dérive vis-à-vis d'articles de référence validés Will
- Aucun corpus d'articles de référence "validés Will" stocké en DB avec embeddings
- Aucune comparaison cosine similarity entre articles générés et le corpus de référence
- La dimension `toneAxioniaAlignment` du LLM-judge est une évaluation LLM statique (prompt texte), pas une comparaison vectorielle de dérive temporelle

**Dashboard tendance qualité = PARTIEL**

- Le quality dashboard affiche les moyennes jour par jour mais sans alertes automatiques si la moyenne descend sous seuil
- Pas de notification Telegram si `avgQualityScore7d < threshold`

---

## Reporting hebdomadaire Will

### Ce qui existe (4/10)

**Crons existants liés à la qualité**

| Cron | Pattern | Contenu |
|---|---|---|
| `content-keyword-sync-cron` | lundi 04:00 UTC | Sync GSC/SerpAPI → KeywordTracking (skeleton, skip sans credentials) |
| `content-psi-monitor-cron` | lundi 03:00 UTC | PSI mobile 15 URLs stratégiques → alerte si Δ p75 > 50 % |
| `content-web-vitals-monitor-cron` | daily 02:30 UTC | p75 LCP/INP/CLS → alerte Telegram si breach budget |
| `content-monitoring-cron` | hourly xx:15 | Queue stuck + soft-404 + indexation stagnante |

**Données disponibles pour un rapport**

Toutes les données nécessaires sont en DB :
- `ContentGenJob` : volumes, statuts, coûts, scores qualité
- `ReviewQueue` : taux de validation, taux de rejet, notes Will
- `KeywordTracking` : positions GSC, impressions, CTR
- `GenerationLog` : étapes granulaires par job

### Ce qui manque (−6 pts)

**Rapport hebdomadaire lundi 8h = ABSENT**

Aucun des éléments suivants n'existe :
- Worker ou Server Action de type `weekly-report-worker` / `monday-report-worker`
- Cron BullMQ schedulé `0 8 * * 1` (lundi 8h UTC)
- Template email "rapport hebdomadaire content-gen" dans `src/lib/email/templates/`
- Alerte Telegram résumé hebdomadaire content-gen

**Contenu du rapport = ABSENT**

Aucune agrégation hebdomadaire calculée et transmise :
- Volume articles générés / publiés / rejetés la semaine précédente
- Score moyen reviewer (editorial/quality) avec delta vs semaine N-1
- Taux de validation Will (approved + promoted_t1 / total pending traité)
- Anomalies détectées (batch fails, soft-404, queue stuck)
- Top 3 keywords performants / Top 3 articles en indexation stagnante
- Coût LLM de la semaine avec projection mensuelle

**Format livraison = ABSENT**

- Email : template stub `_pending-templates.tsx` n'inclut pas de template rapport content-gen
- Telegram : `content-gen-alerts.ts` a 16 alertes ponctuelles mais zéro rapport récapitulatif
- Dashboard "rapport de semaine" : aucune page admin dédiée

---

## Plan d'implémentation minimal

### P1-1 — Active Learning : injecter `reviewNotes` dans re-prompt LLM (effort ~4h)

**Fichier** : `src/server/queue/workers/content-quality-improver-worker.ts`

Modification dans `processJob()` : si le job revient en `quality_improving` depuis `needs_edits`, lire `reviewNotes` depuis `ReviewQueue` et l'injecter comme instruction additionnelle dans `reviewArticle()`.

```typescript
// Récupérer le reviewNotes de la ReviewQueue associée au job
const reviewEntry = await prisma.reviewQueue.findFirst({
  where: { jobId: contentGenJobId, status: 'needs_edits' },
  select: { reviewNotes: true },
  orderBy: { reviewedAt: 'desc' },
});
// Passer comme editorGuidance au LLM judge (ajouter au system prompt)
judge = await reviewArticle({
  ...articleInput,
  editorGuidance: reviewEntry?.reviewNotes ?? undefined,
});
```

Modifier `llm-judge.ts` pour accepter `editorGuidance?: string` et l'insérer dans `JUDGE_SYSTEM_PROMPT` sous `<editor_guidance>`.

### P1-2 — Alerte streak rejets Will (effort ~2h)

**Fichier** : `src/server/actions/content-gen/review.ts` (dans `rejectReview()`)

Après le `logActivity()`, vérifier combien de rejets Will dans les 24 dernières heures. Si ≥3 → appeler `alertBatchFail()` adapté avec `contentType` agrégé.

```typescript
// Post-rejectReview : check streak rejets humains
const h24ago = new Date(Date.now() - 24 * 3600_000);
const recentHumanRejects = await prisma.reviewQueue.count({
  where: { status: 'rejected', reviewedAt: { gte: h24ago } },
});
if (recentHumanRejects >= 3 && recentHumanRejects % 3 === 0) {
  void alertBatchFail('human_review', null, recentHumanRejects).catch(() => undefined);
}
```

Nouveau helper `alertHumanRejectStreak(count: number)` dans `content-gen-alerts.ts` avec message distinct des fails techniques.

### P1-3 — Câbler `alertCampaignDone()` dans l'orchestrateur (effort ~2h)

**Fichier** : `src/server/queue/workers/content-orchestrator-worker.ts`

La fonction `alertCampaignDone()` est déclarée dans `content-gen-alerts.ts` avec tous les paramètres nécessaires mais n'est jamais appelée. À la fin d'une `CoverageCampaign` (status → `completed`) :

```typescript
const campaignStats = await prisma.contentGenJob.aggregate({
  where: { campaignId: campaign.id },
  _count: true,
  _avg: { qualityScore: true, costUsd: true },
  // + count published, failed
});
await alertCampaignDone(
  campaign.name,
  campaign.id,
  campaignStats._count,
  totalCostUsd,
  campaignStats._avg.qualityScore ?? 0,
  publishedCount,
  failedCount,
);
```

### P1-4 — Rapport hebdomadaire lundi 8h (effort ~6h)

**Nouveau fichier** : `src/server/queue/workers/content-weekly-report-worker.ts`

```typescript
// Cron lundi 08:00 UTC (pattern: "0 8 * * 1")
// Agrège les 7 derniers jours :
interface WeeklyReportData {
  weekStart: string;          // ISO date
  articlesGenerated: number;
  articlesPublished: number;
  articlesRejected: number;
  avgQualityScore: number;
  avgEditorialScore: number;
  validationRate: number;     // published / (published + rejected)
  totalCostUsd: number;
  deltaAvgQuality: number;    // vs semaine N-1
  anomalyCount: number;       // batch fails + soft404 + indexation stagnante
}
```

Livraison via Telegram (tag `AUTO`) + email optionnel Will via `enqueueEmail('weekly-report-content-gen', willEmail, 'fr', reportData)`.

Nouveau template email minimal à ajouter dans `_pending-templates.tsx` :

```typescript
makeStub(
  '[Axion-IA] Rapport hebdomadaire content-gen',
  '[Axion-IA] Weekly content generation report',
  'Voici le récap de la semaine content-gen :',
  'Here is your weekly content generation summary:',
  (p) => [/* détails volume + scores + coûts */]
)
```

**Enregistrement cron dans `queues.ts`** :

```typescript
// Lundi 08:00 UTC — rapport hebdomadaire Will
if (contentWeeklyReportQueue) {
  await contentWeeklyReportQueue.add(
    'tick',
    { trigger: 'cron-weekly-mon-0800', tick: new Date().toISOString() },
    { repeat: { pattern: '0 8 * * 1' }, jobId: 'content-weekly-report-cron' },
  );
}
```

### P2-5 — Brand voice drift detection par embeddings (effort ~12h)

Stocker les embeddings OpenAI des articles "promus tier-1 par Will" dans une nouvelle colonne `Article.referenceEmbedding vector(1536)` (ou table dédiée `ArticleEmbedding`). Le `content-similarity-monitor-worker` calculera périodiquement la cosine distance moyenne des nouveaux articles générés vs le corpus de référence. Si distance > seuil (ex : 0.15) → alerte Telegram `alertBrandVoiceDrift(avgDrift, threshold)` (nouveau helper à ajouter dans `content-gen-alerts.ts`).

---

## Tableau de bord des mécanismes

| Mécanisme | Statut | Fichier clé |
|---|---|---|
| Interface approve/reject/edits UI | ✅ PRÉSENT | `review-queue/[id]/page.tsx` + `ReviewDetailV2.tsx` |
| Historique décisions Will (DB) | ✅ PRÉSENT | `ActivityLog` + `ReviewQueue.reviewedBy` |
| LLM-as-judge 7 dimensions | ✅ PRÉSENT (P1.5) | `reviewer/llm-judge.ts` |
| `reviewNotes` → re-prompt LLM | ❌ ABSENT (skeleton) | `content-quality-improver-worker.ts` note V1 |
| Active learning / modèle préférences | ❌ ABSENT | — |
| alertBatchFail (fails techniques) | ✅ CÂBLÉ | `content-gen-worker.ts:629` |
| alertBatchFail (rejets humains Will) | ❌ ABSENT | — |
| alertCampaignDone (score moyen batch) | ⚠️ DÉCLARÉ, NON CÂBLÉ | `content-gen-alerts.ts:179` |
| Quality dashboard 30j | ✅ PRÉSENT | `quality/_v2/QualityV2.tsx` |
| Alerte qualité < seuil hebdo | ❌ ABSENT | — |
| Brand voice drift (embeddings) | ❌ ABSENT | — |
| Rapport hebdomadaire lundi 8h | ❌ ABSENT | — |
| Email récapitulatif hebdo | ❌ ABSENT | — |
| KPI delta semaine N vs N-1 | ❌ ABSENT | — |

---

*Audit AUDIT-ONLY STRICT — zéro modification fichiers source. Date : 2026-05-21.*
