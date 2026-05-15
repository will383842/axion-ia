# R15 — Google Indexing API quota dépassé (anticipation V1.5)

- **Code** : R15
- **Version** : 1.0 (anticipation V1.5)
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟡 **P1 — important**
- **Statut V1** : worker `content-google-indexing-worker` = skeleton (ADR 0021 G2). Pas de quota consommé V1. **Activation V1.5+** quand JWT service account câblé.

## Trigger (V1.5+)

- Worker logs `content-google-indexing-worker` : `429 Too Many Requests` ou `quota exceeded`.
- Limite gratuite Google Indexing API : **200 URLs/jour** par service account.
- Dashboard Google Cloud Console quota alerts.

## Prérequis (V1.5+)

- Service account JSON dans Coolify env `GOOGLE_INDEXING_SA_KEY`.
- Project ID Google Cloud `axion-ia-indexing`.
- Indexing API enabled sur le projet.

## Étapes V1.5+

### 1. Diagnostiquer consommation

Google Cloud Console → API & Services → Quotas → "Indexing API" :

- Daily limit : 200
- Current usage : XXX

### 2. Réduire usage immédiat

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/policies
→ "Google Indexing ping enabled" → OFF
→ ou "Daily URL limit" : 200 → 100 (économie pour seconde moitié journée)
```

### 3. Prioriser URLs critiques

Worker doit prioriser tier-1 only (master prompt § 7.x). Si V1.5 a bypassé cette logique :

```sql
-- Désactiver pings pour tier-2/3
UPDATE "ContentGenConfig"
SET "valueJson" = jsonb_set("valueJson", '{google_indexing_tier_filter}', '"tier_1_only"')
WHERE key = 'indexing_config';
```

### 4. Solution long-terme — paid tier

Google Indexing API en paid tier permet > 200/jour mais nécessite contrat enterprise. ADR à créer si volume justifie.

### 5. Fallback IndexNow only

IndexNow protocole (Bing/Yandex/Google partial) reste actif. Pas de quota strict. Voir R14.

### 6. Demande quota increase (Google)

Google Cloud Console → IAM & Admin → Quotas → "Edit Quotas" → request increase. Justifier business case. Délai : 1-7 jours.

## Vérifications post-fix

- [ ] Quota consumption < limite dans les heures suivantes.
- [ ] Worker `content-google-indexing-worker` skip URLs avec log explicit (pas crash).
- [ ] IndexNow fallback continue de ping (vérif R14).

## Rollback

- Re-enable Google Indexing si quota refreshed (00:00 UTC reset Google).
- Restaurer threshold tier original.

## Escalation

| Niveau | Contact              | Quand                                                    |
| ------ | -------------------- | -------------------------------------------------------- |
| L1     | Will                 | si volume tier-1 > 200/jour soutenu (justifie paid tier) |
| L2     | Google Cloud support | request quota increase                                   |

## Liens

- ADR 0021 — Google Indexing skeleton V1.5+
- Code : `src/server/queue/workers/content-google-indexing-worker.ts`
- R14 — IndexNow (fallback prioritaire)
- Master prompt § 9.8 (indexation perfection 2026)
