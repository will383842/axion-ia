# R07 — KB not ready (chunks insuffisants / canonical < 60 %)

- **Code** : R07
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique**
- **Impact si non traité** : `content-gen-worker` rejette tous les jobs (`assertKbReady` hard gate § 11.2 master prompt). Aucun contenu généré.

## Trigger

- Telegram `[🔴 KB NOT READY] 215/300 chunks min. Canonical 51 %. Gen bloquée.`
- Worker logs : `[content-gen-worker] KB not ready: <reason>, skipping job <id>`
- Dashboard `/fr/{ADMIN_URL_PREFIX}/content-gen` montre KPI "KB health" en rouge.
- Cron hebdo dim 03:00 (`kb-health-check`) rapporte dégradation.

## Prérequis

- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen` (KPI KB) + `/fr/{ADMIN_URL_PREFIX}/connaissances` (KB management — skill `axionia-connaissances`).
- Accès Postgres pour requêtes diagnostiques.
- Skill Claude Code `axionia-connaissances` actif (cf. `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/`).
- Optionnel : `KB_BYPASS=true` env var pour bypass temporaire (cf. master prompt § 11.5).

## Étapes

### 1. Diagnostiquer cause exacte

```sql
-- Compter chunks publiés
SELECT COUNT(*) AS published_chunks
FROM "KnowledgeEntry" k
JOIN "KnowledgeEmbedding" e ON e."entryId" = k.id
WHERE k.status = 'published';
-- Cible : ≥ 300

-- Ratio canonical
SELECT
  COUNT(*) FILTER (WHERE "isCanonical" = true) AS canonical,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "isCanonical" = true) / NULLIF(COUNT(*), 0), 1) AS pct_canonical
FROM "KnowledgeEntry"
WHERE status = 'published';
-- Cible : pct_canonical ≥ 60

-- Fraîcheur (last ingest)
SELECT MAX("publishedAt") AS last_publish
FROM "KnowledgeEntry"
WHERE status = 'published';
-- Cible : < 90 jours
```

### 2. Identifier le bucket défaillant

| Cause              | Action                                                       |
| ------------------ | ------------------------------------------------------------ |
| < 300 chunks total | Ingérer plus d'entrées via skill `axionia-connaissances`     |
| Canonical < 60 %   | Promouvoir entrées tier-2 → canonical (`isCanonical = true`) |
| Last publish > 90j | Re-générer / re-publier entrées fraîches                     |

### 3. Ingest depuis skill axionia-connaissances

Ouvrir session séparée Claude Code avec skill `axionia-connaissances` :

```
Skill : axionia-connaissances

Lance Sprint d'ingestion d'urgence : <N> entrées tier-1 canonical
pour combler KB shortage (R07 runbook content-gen).
Type cible : automation_recipe + industry_use_case + comparison.
```

Le skill produira des entrées en BUILD mode puis appelera `POST /api/internal/kb/ingest` (HMAC + UUID idempotency).

### 4. Promouvoir entrées tier-2 → canonical (si shortage canonical)

```sql
-- Identifier candidats tier-2 de qualité
SELECT id, slug, "qualityScore", "publishedAt"
FROM "KnowledgeEntry"
WHERE status = 'published'
  AND "isCanonical" = false
  AND "qualityScore" >= 70
ORDER BY "qualityScore" DESC
LIMIT 50;

-- Promouvoir (action admin recommandée plutôt que SQL direct, mais en urgence)
UPDATE "KnowledgeEntry"
SET "isCanonical" = true, "updatedAt" = NOW()
WHERE id IN (...) AND "qualityScore" >= 70;
```

Préférer UI `/fr/{ADMIN_URL_PREFIX}/connaissances` pour audit trail propre.

### 5. Bypass temporaire (si shortage long)

⚠️ Solution dégradée. À éviter si possible — la doctrine AxionIA-centric ≥ 95 % dépend de la KB.

```bash
# Update env var Coolify
curl -X PATCH "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -d '{"key":"KB_BYPASS","value":"true"}'
# Coolify auto-redeploy
```

Documenter raison + ETA fin bypass dans `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md`.

### 6. Vérifier `kb-health.ts` re-évaluation

```bash
docker exec axion-ia-worker-prod node -e "
  const { checkKbHealth } = require('./dist/server/content-gen/lib/kb-health');
  checkKbHealth().then(r => console.log(JSON.stringify(r, null, 2)));
"
```

Output attendu après fix :

```json
{ "ready": true, "chunks": 312, "canonicalRatio": 0.67, "lastPublishDays": 4 }
```

## Vérifications post-fix

- [ ] Alerte Telegram suivante → `[ℹ️ INFO] KB ready: 312 chunks, canonical 67 %`.
- [ ] Worker logs : `[content-gen-worker] processing job <id>` (plus de skip).
- [ ] Dashboard `/content-gen` KPI "KB health" passe au vert.
- [ ] 1 job test traverse complet (smoke test).

## Rollback

- Si `KB_BYPASS=true` activé temporairement → re-mettre `false` dès que vrai fix appliqué.
- Si entrées promues canonical à tort → revert via admin (`isCanonical = false`).
- Pas de DELETE sur KnowledgeEntry — toujours soft-delete (`status = 'archived'`).

## Escalation

| Niveau | Contact                                                   | Quand                                                   |
| ------ | --------------------------------------------------------- | ------------------------------------------------------- |
| L1     | Will                                                      | toujours (décision bypass = sa responsabilité doctrine) |
| L2     | Skill `axionia-connaissances` (autre conversation Claude) | pour ingestion massive                                  |

## Liens

- Master prompt § 11.2 — KB hard gate (≥ 300 chunks + canonical ≥ 60 %)
- Master prompt § 11.5 — KB_BYPASS mode dégradé
- Code : `src/server/content-gen/lib/kb-health.ts`
- Code : `src/server/content-gen/lib/kb-client.ts` (consumer read-only)
- Skill KB : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/.claude/skills/axionia-connaissances/SKILL.md`
- Prompt KB : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` V3
- Mémoire `axionia_session_2026-05-13_kb_creation` — pivot V4 Knowledge Factory
