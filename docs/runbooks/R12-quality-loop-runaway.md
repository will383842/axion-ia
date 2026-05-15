# R12 — Quality loop runaway (boucle infinie)

- **Code** : R12
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟡 **P1 — important**
- **Impact si non traité** : `content-quality-improver-worker` boucle sans converger → consommation tokens excessive → cost cap atteint (R02) en heures.

## Trigger

- Worker logs : `[content-quality-improver-worker] job <id> attempt N > maxAttempts`
- Sentry alert taux d'erreur `quality_improving` step.
- Dashboard `/content-gen` montre jobs bloqués > 30 min en step `quality_improving`.
- Cost spike sur provider Anthropic (re-prompt).

## Prérequis

- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen/settings/quality-loop`.
- Setting `content_gen_quality_loop_max_attempts` (defaut V1 : 3).

## Étapes

### 1. Pause boucle immédiate

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/quality-loop
→ toggle "Quality loop enabled" → OFF
→ Save
```

Effet : `Setting.content_gen_quality_loop_enabled = false`. Tous nouveaux jobs skip la boucle.

### 2. Identifier jobs bloqués

```sql
SELECT id, "contentType", status, attempts, "updatedAt"
FROM "ContentGenJob"
WHERE status = 'quality_improving'
  AND "updatedAt" < NOW() - INTERVAL '30 minutes'
ORDER BY "updatedAt";
```

### 3. Annuler jobs bloqués

```
/fr/{ADMIN_URL_PREFIX}/content-gen/jobs/<id>
→ bouton "Annuler"
```

Ou par batch SQL :

```sql
UPDATE "ContentGenJob"
SET status = 'failed', "errorMessage" = 'R12-quality-loop-runaway-manual-cancel', "updatedAt" = NOW()
WHERE status = 'quality_improving' AND "updatedAt" < NOW() - INTERVAL '30 minutes';
```

### 4. Diagnostiquer cause

Causes typiques :

| Cause                                  | Vérif                                      | Fix                                                |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| Seuils qualité trop stricts            | `/settings/quality-loop` `min_score`       | Baisser min_score (ex 70 → 65)                     |
| KB shortage → context insuffisant      | R07 KB health                              | Ingest plus de KB                                  |
| Prompt re-prompt mal calibré           | logs `/jobs/<id>` step `quality_improving` | Ajuster prompt skill `prompts/quality-improver.md` |
| Bug worker (skeleton V1 sans LLM réel) | ADR 0021                                   | Attendre V1.5+ implémentation profonde             |

### 5. Ajuster seuils si pertinent

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/quality-loop
→ "Max attempts" : 3 (V1 défaut)
→ "Min score target" : 70
→ "Pause if no progress after N attempts" : 2
```

Server Action : `updateSettingAction`.

### 6. Re-enable loop progressivement

```
/settings/quality-loop → toggle ON
```

Surveiller 1 h les nouveaux jobs : pas de spike `quality_improving` > 5 min/job.

## Vérifications post-fix

- [ ] `Setting.content_gen_quality_loop_enabled` cohérent avec état attendu.
- [ ] Aucun job en `quality_improving` depuis > 30 min :
  ```sql
  SELECT COUNT(*) FROM "ContentGenJob"
  WHERE status = 'quality_improving' AND "updatedAt" < NOW() - INTERVAL '30 minutes';
  -- Attendu : 0
  ```
- [ ] Coût quotidien stable (pas de spike).

## Rollback

- Re-toggle enabled OFF si problème ré-apparaît.
- Restaurer seuils via DB :
  ```sql
  UPDATE "Setting"
  SET value = '<old-value>'
  WHERE key IN ('content_gen_quality_loop_max_attempts', 'content_gen_quality_loop_min_score');
  ```

## Escalation

| Niveau | Contact | Quand                     |
| ------ | ------- | ------------------------- |
| L1     | Will    | si récidive ou coût spike |

## Liens

- ADR 0021 — quality-improver V1 skeleton, body V1.5+
- Code : `src/server/queue/workers/content-quality-improver-worker.ts`
- Master prompt § 13.2 (cron + workers)
- Skill prompts : `.claude/skills/axionia-content-generator/prompts/quality-improver.md` (V1.5+)
