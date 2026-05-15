# R13 — RSS source down (aucun item nouveau 24h+)

- **Code** : R13
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟡 **P1 — important** (impact éditorial différé)
- **Impact si non traité** : aucun nouvel article `blog_from_rss` généré → ralentissement publication factory 100/jour.

## Trigger

- Worker logs `content-rss-fetch-worker` : `RSS source <url> timeout` ou `404`.
- Dashboard `/fr/{ADMIN_URL_PREFIX}/content-gen/rss` montre `lastFetchedAt` > 24h sur une source.
- Aucun job `blog_from_rss` enqueued depuis > 24h.

## Prérequis

- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen/rss`.
- Liste de sources alternatives par thématique.

## Étapes

### 1. Identifier source down

```sql
SELECT id, slug, url, "lastFetchedAt", "errorCount", "lastError"
FROM "RssSource"
WHERE enabled = true
ORDER BY "lastFetchedAt" ASC NULLS FIRST
LIMIT 10;
```

Ou via admin `/rss` (Sprint 3 F11).

### 2. Tester URL manuellement

```bash
curl -fsS -L --max-time 10 "<URL_RSS>" | head -50
```

| Code              | Cause                   | Action                              |
| ----------------- | ----------------------- | ----------------------------------- |
| 404               | Feed déplacé / supprimé | §3 fallback                         |
| 403               | Blocage user-agent      | Ajouter UA Axion-IA + retry         |
| 5xx               | Server down             | Attendre 24h, sinon §3              |
| Timeout           | Latence                 | Augmenter `pollIntervalMin` + retry |
| Empty `<channel>` | Feed cassé              | §3 fallback                         |

### 3. Switch vers fallback source

```
/fr/{ADMIN_URL_PREFIX}/content-gen/rss
→ source incriminée → toggle "Enabled" → OFF
→ "+ Add source" → coller URL alternative (recommandé : ≥ 2 sources par thème)
→ Save
```

Server Action : `updateRssSourceAction`.

### 4. Si rate-limit côté worker

```
/fr/{ADMIN_URL_PREFIX}/content-gen/rss/<id>
→ "Poll interval (min)" : 60 → 180 (réduire fréquence)
→ "Max items per fetch" : 20 → 10
```

### 5. Vérifier worker reprend

```bash
docker logs --tail 30 axion-ia-worker-prod | grep -i "rss-fetch"
# Attendu : "[content-rss-fetch-worker] fetched N items from <slug>"
```

## Vérifications post-fix

- [ ] `RssSource.lastFetchedAt` se met à jour dans les 60 min suivantes.
- [ ] Au moins 1 nouveau `RssItem` (ou entrée `ContentGenConfig` key=`rss_items_seen`) dans les 24h.
- [ ] 1 job `blog_from_rss` enqueued depuis le worker.

## Rollback

- Re-toggle source désactivée si fallback regretté.
- Restaurer `pollIntervalMin` original.

## Escalation

| Niveau | Contact | Quand                             |
| ------ | ------- | --------------------------------- |
| L1     | Will    | si > 5 sources down simultanément |

## Liens

- Code : `src/server/queue/workers/content-rss-fetch-worker.ts`
- ADR 0021 — V1 storage `ContentGenConfig` JSON vs RssItem table dédiée
- Master prompt § 28 (actualités RSS)
- Skill prompt : `.claude/skills/axionia-content-generator/prompts/blog-article.md` (mode RSS)
