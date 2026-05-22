# Campaign Controls — Documentation Technique

**Sprint** : Campaign Controls — 2026-05-22
**Scope** : `CoverageCampaign` + orchestrator + workers + UI wizard

---

## 1. Capabilities

| Capability             | Champ DB               | Type                 | Défaut     | Description                                                                                             |
| ---------------------- | ---------------------- | -------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| Mode traitement villes | `city_processing_mode` | `CityProcessingMode` | `parallel` | `parallel` : toutes les villes simultanément. `sequential` : une ville à la fois via `currentCityIndex` |
| Index ville courante   | `current_city_index`   | `Int?`               | `null`     | Progression séquentielle (auto-incrémenté par l'orchestrator)                                           |
| Date de démarrage      | `start_date`           | `DateTime?`          | `null`     | Si futur → status `scheduled`, sinon `draft`                                                            |
| Date de fin            | `end_date`             | `DateTime?`          | `null`     | Auto-stop via deadline-checker worker (null = illimité)                                                 |
| Schedule récurrent     | `recurring_schedule`   | `String?`            | `null`     | Expression cron (Europe/Paris) — BullMQ Repeatable Job                                                  |
| Raison arrêt           | `completed_reason`     | `String?`            | `null`     | Audit trail : `deadline_reached`, `manual`, etc.                                                        |

---

## 2. CoverageStatus.scheduled

Nouveau statut ajouté : `scheduled`.

Cycle de vie complet :

```
draft → [launchCampaign()] → running → [orchestrator] → completed
draft → [scheduleCampaign(startDate)] → scheduled → [scheduler-worker 5min] → running → ...
running → [pauseCampaign()] → paused → [resumeCampaign()] → running
running → [endDate passé] → [deadline-checker 00:05] → completed (reason=deadline_reached)
```

---

## 3. Exemples cron recurringSchedule

| Preset        | Expression    | Description                         |
| ------------- | ------------- | ----------------------------------- |
| Quotidien 7h  | `0 7 * * *`   | RSS daily — 7h UTC (≈ 8h CET)       |
| Lundi 9h      | `0 9 * * 1`   | Interventions weekly — lundi 9h UTC |
| Mensuel 1er   | `0 9 1 * *`   | Mensuel le 1er du mois 9h           |
| Toutes les 6h | `0 */6 * * *` | High-frequency (avancé)             |

---

## 4. Comportements limites

| Situation                                                             | Comportement                                                                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `startDate` dans le passé au create                                   | Log warning + `startDate=null` + `status=draft` (pas de throw)                                                               |
| `endDate` dans le passé au create                                     | Throw `end_date_in_past`                                                                                                     |
| `recurringSchedule` invalide                                          | Throw `invalid_cron_expression` (via `CronExpressionParser.parse()`)                                                         |
| `startDate` futur au create                                           | `status=scheduled`, scheduler-worker activera à J+startDate                                                                  |
| `endDate` passé en prod                                               | deadline-checker daily 00:05 UTC : `status=completed` + `completedReason=deadline_reached` + purge BullMQ + removeRepeatable |
| `cityProcessingMode=sequential` + `currentCityIndex >= villes.length` | Orchestrator skip (toutes villes traitées)                                                                                   |
| `cityProcessingMode=sequential` + ville courante pending              | Orchestrator skip (attendre le prochain tick)                                                                                |
| Campaign `paused` avec `recurringSchedule`                            | `pauseCampaign()` appelle `removeRepeatable` — le job est retiré BullMQ                                                      |
| Campaign `launched` avec `recurringSchedule`                          | `launchCampaign()` appelle `queue.add(..., { repeat: { pattern } })`                                                         |

---

## 5. Workers Campaign Controls

| Worker                            | Queue                          | Cron          | Rôle                                                           |
| --------------------------------- | ------------------------------ | ------------- | -------------------------------------------------------------- |
| `content-gen-scheduler-worker.ts` | `content-gen-scheduler`        | `*/5 * * * *` | Passe `scheduled → running` quand `startDate <= NOW()`         |
| `content-gen-deadline-checker.ts` | `content-gen-deadline-checker` | `5 0 * * *`   | Passe `running/scheduled → completed` quand `endDate <= NOW()` |

---

## 6. Isolation check

Tous les nouveaux fichiers workers respectent le cloisonnement :

- `src/server/queue/workers/content-gen-*-worker.ts`
- `src/server/queue/workers/content-gen-*-checker.ts`

---

## 7. Presets CampaignTemplate enrichis

| Slug                   | cityProcessingMode | recurringSchedule | endDateOffsetDays |
| ---------------------- | ------------------ | ----------------- | ----------------- |
| `pme-audits`           | `sequential`       | —                 | —                 |
| `interventions-weekly` | —                  | `0 9 * * 1`       | —                 |
| `tpe-burst`            | —                  | —                 | 30                |
| `eti-pilier`           | `parallel`         | —                 | —                 |
| `cities-paris`         | `sequential`       | —                 | —                 |
| `rss-daily`            | —                  | `0 7 * * *`       | —                 |
