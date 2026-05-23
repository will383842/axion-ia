# A13-ADDENDUM — Programmation campagnes avancée

> **Mode** : AUDIT-ONLY strict (zéro commit, zéro modification)
> **Date** : 2026-05-21
> **HEAD audité** : `37ca0147` (origin/main)
> **Baseline P1.5** : score ~770-820/1000
> **Périmètre parent** : addendum P1 — complète A13 du PHASE-1-VERDICT.md
> **Exigence Will** : « simple programmation depuis admin »

---

## Score final : **14/30 (47 %)** — 🟠 SPRINT CORRECTIF

| Catégorie | Score | Notes |
|---|---|---|
| Cron scheduling + validation + DST | 4/8 | BullMQ repeatable jobs OK (queues.ts) ; cronExpression DB absent sur CoverageCampaign |
| Recurring vs one-shot vs triggered | 2/6 | Status enum draft/queued/running/paused/completed ; pas de `type` enum oneShot/recurring/triggered |
| Auto-start / auto-stop conditions | 2/4 | Auto-stop cost-cap OK ; auto-start scheduledStart absent |
| Triggers événementiels (5 types min) | 0/4 | **AUCUN trigger événementiel implémenté** |
| Templates presets (CRITIQUE Will) | 3/5 | 9 ContentTemplates fondamentaux existent ; **0 CampaignTemplate marketplace** |
| Bulk operations | 1/2 | Anti-burst scheduler pure function existe ; bulk create/pause/delete UI absent |
| UI calendrier + timeline | 0/1 | Absent |

---

## 1. Tableau capabilities scheduling actuelles vs cible

| Capability | État actuel | Cible | Gap |
|---|---|---|---|
| Cron daily/weekly | ✅ BullMQ repeatable (`queues.ts:500-650`) | OK | — |
| Campaign.cronExpression DB | ❌ absent | Required | P0 |
| Campaign.scheduledStart | ❌ absent | Required | P0 |
| Campaign.priority Int 1-10 | ❌ absent | Required (multi-camp parallèles) | P1 |
| Campaign.type oneShot/recurring/triggered | ❌ absent (status enum seulement) | Required | P0 |
| Auto-start `scheduledStart: DateTime` | ❌ absent | Required | P0 |
| Auto-stop cost-cap | ✅ implémenté | OK | — |
| Auto-stop endDate | ❌ absent | Required | P1 |
| Auto-stop totalTarget atteint | ⚠️ partiel (status `completed`) | Améliorer | P1 |
| Resume after pause | ⚠️ partiel (status flip seulement) | Lock job_id last processed | P1 |
| Trigger `on_rss_new_item` | ❌ absent | Optionnel | P2 |
| Trigger `on_keyword_trend_spike` | ❌ absent | Optionnel | P2 |
| Trigger `on_gsc_query_uncovered` | ❌ absent | Optionnel | P2 |
| Trigger `on_competitor_publish` | ❌ absent | Optionnel | P2 |
| Trigger `on_manual_event` (webhook) | ❌ absent | Optionnel | P2 |
| Trigger rate limit max N/jour | ❌ absent | Required si triggers ON | P1 |
| CampaignTemplate marketplace | ❌ absent | **CRITIQUE Will** | P0 |
| Wizard 4 clicks via template | ❌ form 1 page complexe | 4 clicks total | P0 |
| Will save own template | ❌ absent | P1 | P1 |
| Bulk create 5 campagnes | ❌ absent | P1 | P1 |
| Bulk pause/resume table N rows | ❌ absent | P1 | P1 |
| Bulk delete archived >90j | ❌ absent | P2 | P2 |
| Lock keywords SELECT FOR UPDATE | ✅ implémenté P1.5 (B.5) | OK | — |
| UI calendrier campagnes drag-drop | ❌ absent | P2 | P2 |
| Timeline next 7d/30d viz | ❌ absent | P1 | P1 |
| Notif "campagne X démarre dans 2h" | ❌ absent | P2 | P2 |
| Timezone Europe/Paris | ⚠️ getCetHour() utilisé content-publish-worker | Étendre tous schedulers | P2 |
| DST handling cron 9h locale | ⚠️ via `Intl.DateTimeFormat("fr-FR")` | OK pour publish, pas pour Campaign cron | P2 |

---

## 2. Top 10 P0 (bloquants)

| # | Item | Fichier | Action |
|---|---|---|---|
| 1 | `CoverageCampaign.cronExpression String?` absent | `prisma/schema.prisma` (~ligne 2860) | Migration additive `ALTER TABLE coverage_campaigns ADD COLUMN cron_expression VARCHAR(50)` |
| 2 | `CoverageCampaign.scheduledStart DateTime?` absent | `prisma/schema.prisma` | Migration additive — auto-start trigger orchestrator |
| 3 | `CoverageCampaign.scheduledEnd DateTime?` absent | `prisma/schema.prisma` | Migration additive — auto-stop |
| 4 | `CoverageCampaign.type` enum (oneShot/recurring/triggered) absent | `prisma/schema.prisma` | Migration enum `CampaignType` |
| 5 | `CoverageCampaign.priority Int @default(5)` absent | `prisma/schema.prisma` | Migration additive 1-10 |
| 6 | Orchestrator-worker n'évalue PAS scheduledStart/cron — lance instantanément à la création | `content-orchestrator-worker.ts` | Refactor : poll campagnes status=queued + scheduledStart ≤ NOW → start ; cron repeatable BullMQ |
| 7 | **`CampaignTemplate` table absente** — marketplace presets impossibles | `prisma/schema.prisma` | Migration table `CampaignTemplate` (slug unique, name, description, distribution JSON, cron, audience, defaultTarget) |
| 8 | Server Action `launchCampaignScheduled(id, start, cron)` absente | `src/server/actions/content-gen/coverage.ts` | Créer action wrapper de `launchCampaign` + DB update |
| 9 | Validation cron côté UI absente (cron-parser preview prochaines exécutions) | UI form | Lib `cron-parser` npm + composant `<CronPreview value="0 9 * * *" />` |
| 10 | Wizard 4 étapes templates → scope → distribution → estimate → launch absent (form monolithique) | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/new` | Découper wizard step-by-step |

---

## 3. Top 15 P1 (delivery rapide)

1. 4-step wizard `template → scope → distribution → estimate → launch` (P0 critique simplicité Will)
2. Seed 6 CampaignTemplate initial (cf. STOP & ASK D-Add-3 ci-dessous)
3. Bulk CSV importer (1 batch crée N campagnes)
4. Server Action `bulkLaunchCampaigns(ids[])` (transaction)
5. Trigger base model `Trigger { id, type, params, enabled, rateLimit, campaignTemplateId }`
6. UI toggles 5 trigger types (rss/keyword/gsc/competitor/manual)
7. Webhook endpoint `/api/admin/campaign-triggers/manual` (token-protected)
8. Cost-per-campaign cap enforcement (`Campaign.costCapUsd` + auto-pause)
9. Auto-resume after pause via lock job_id last processed
10. Notification badge admin "campagne X démarre dans 2h"
11. Vue timeline next 7d/30d (lib `vis-timeline` ou simple flex day-cells)
12. Cron timezone Europe/Paris extension à tous schedulers (DST safe via Intl)
13. Multi-campaign quota dispatcher (round-robin pondéré priority)
14. Burst protection : `MAX_PUBLISH_PER_DAY` dispatché entre N campagnes proportionnel priority
15. Sentry capture orchestrator errors + Telegram alert "campaign stuck"

---

## 4. Wireframes ASCII — UI programmation

### 4.1 — Vue calendrier campagnes (cible P2)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Campagnes — Mai 2026                          [+ Nouvelle campagne]  │
├─────┬─────┬─────┬─────┬─────┬─────┬─────┬────────────────────────────┤
│ Lun │ Mar │ Mer │ Jeu │ Ven │ Sam │ Dim │ Légende                    │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤  🟢 active                 │
│ 19  │ 20  │ 21  │ 22  │ 23  │ 24  │ 25  │  🟡 scheduled              │
│     │     │ 🟢  │ 🟢  │ 🟢  │     │     │  ⏸️  paused                 │
│     │     │ PME │ PME │ PME │     │     │  ✅ completed              │
│     │     │ aud │ aud │ aud │     │     │                            │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                            │
│ 26  │ 27  │ 28  │ 29  │ 30  │ 31  │ 01  │                            │
│ 🟡  │     │ 🟢  │ 🟡  │     │     │ ✅  │                            │
│ TPE │     │ Imp │ Pil │     │     │ RSS │                            │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴────────────────────────────┘
```

### 4.2 — Wizard 4-step création campagne (cible P0)

```
[Step 1/4] Choisir template ──────────────────────────────────────
  ┌──────────────────────────────────────────────────────────┐
  │ 🏗️  PME audits standard 100/jour 30j                     │
  │ 🏛️  PME interventions_formations weekly 5/sem            │
  │ 🏪 TPE audits one-shot 50 articles 14j                   │
  │ 🏢 ETI implementations pilier monthly 2/mois             │
  │ 🌍 Cities domination Paris top 20 keywords burst         │
  │ 📰 RSS curation daily 10/jour                            │
  │                                          [Vide] [Suivant]│
  └──────────────────────────────────────────────────────────┘

[Step 2/4] Scope ──────────────────────────────────────────────
  Verticale : [audits ▼]   Audiences : [☑ PME ☐ TPE ☐ ETI]
  Villes : [Paris ▼] [+ ajouter ville]
  Période : 30j  Du [01/06] au [30/06]
                                            [← Retour] [Suivant]

[Step 3/4] Distribution + cron ────────────────────────────────
  Mix éditorial : Article 60% · Pilier 20% · Q/R 10% · Comp 10%
  Cron : Tous les jours à 09h00 CET  [0 9 * * *] ✅ valide
  Preview : 22/05 09:00, 23/05 09:00, 24/05 09:00
                                            [← Retour] [Suivant]

[Step 4/4] Estimate + launch ──────────────────────────────────
  Articles totaux estimés : 100  ×  $0.05 = ~$5.00
  Cost cap (sécurité)   : $10.00
  Durée estimée          : 30 jours
                                            [← Retour] [🚀 Lancer]
```

---

## 5. Templates presets recommandés (D-Add-3)

| # | Slug | Distribution | Cron | Audience | Default target |
|---|---|---|---|---|---|
| 1 | `pme-audits-standard-30j` | 100% blog_keywords | `0 9 * * *` daily 9h CET | PME | 100 articles |
| 2 | `pme-interventions-weekly` | 80% blog_keywords + 20% comparatif | `0 9 * * 1` lundi 9h | PME | 5/sem |
| 3 | `tpe-audits-burst-14j` | 70% blog_keywords + 30% longue_traine | — (one-shot, dailyTarget=4) | TPE | 50 articles |
| 4 | `eti-impl-pilier-monthly` | 100% pilier | `0 9 1 * *` 1er du mois | ETI | 2/mois |
| 5 | `cities-domination-paris-burst` | 80% landing_ville + 20% blog_keywords | — (one-shot, dailyTarget=2) | mixed | 20 villes |
| 6 | `rss-curation-daily-10` | 100% article_rss | `0 7,12,17 * * *` 3×/jour | mixed | 10/jour |

---

## 6. Fichiers clés audités

```
✅ prisma/schema.prisma:2860-2894 — CoverageCampaign model (manque cron/scheduled/type/priority)
✅ src/server/queue/queues.ts:500-650 — BullMQ repeatable jobs (15min/hourly/daily/weekly cron natifs)
✅ src/server/queue/workers/content-orchestrator-worker.ts — ne consulte pas scheduledStart
✅ src/server/actions/content-gen/coverage.ts — launchCampaign() manuel uniquement, pas de scheduled variant
✅ src/server/content-gen/scheduler/anti-burst.ts — pure function étalement 24h jobs (testée)
📋 NOT INSPECTED : UI calendrier (absent), trigger handlers (absent), CampaignTemplate (absent)
```

---

## 7. Délégations downstream

### → P2 (Architecture data pipeline)
- Extension `CoverageCampaign` : `cronExpression`, `scheduledStart`, `scheduledEnd`, `type`, `priority`, `costCapUsd`
- Nouvelle table `CampaignTemplate` : slug unique + distribution JSON + cron + defaults
- Nouvelle table `Trigger` : type enum + params JSON + rateLimit
- Orchestrator-worker refactor : poll-based scheduledStart + cron BullMQ repeatable
- Lock dispatcher multi-campagnes : round-robin pondéré priority

### → P5 (Console Admin Ops)
- Wizard 4-step création campagne
- UI calendrier campagnes drag-drop reschedule
- Timeline next 7d/30d viz
- Bulk operations table (select N + action group)
- Notifications "campagne X démarre dans 2h"
- Templates marketplace UI (browse + clone + Will save own)

---

## 8. STOP & ASK Will

- **D-Add-3 confirmation** : valider la liste des 6 templates presets initiaux à seeder (cf. §5 ci-dessus)
- **D-Add-2** : wizard 4 étapes (recommandé) ou page monolithique 1 scroll ?

---

*Fin A13-Addendum. Verdict 14/30 — Foundation BullMQ solide MAIS Campaign DB model et UI scheduling à compléter avant scale 500/jour.*
