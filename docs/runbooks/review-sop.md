# SOP — Review trimestrielle des runbooks ops

> Standard Operating Procedure pour maintenir runbooks à jour. À exécuter
> **chaque trimestre** (T1 = 1er février, T2 = 1er mai, T3 = 1er août, T4 = 1er novembre).
>
> But : éviter que les runbooks pourrissent (chemins admin obsolètes, env vars
> renommées, providers ajoutés, doctrine évoluée).

## Périmètre

- Tous fichiers `axionia/docs/runbooks/R*.md` (28 runbooks à date — voir [README](./README.md)).
- Fichiers transverses `coolify-procedures.md` + `review-sop.md` (méta).
- Runbooks legacy `axionia/docs/ops/runbook-*.md` (3 fichiers).

## Calendrier annuel

| Trimestre | Date cible | Focus                                                            |
| --------- | ---------- | ---------------------------------------------------------------- |
| T1        | 2026-02-01 | Rotations secrets (R23 + R24) + DPA renouvellement annuel R28-29 |
| T2        | 2026-05-01 | Restore drill PG R22 (cycle 1/an) + audit RGPD sous-processeurs  |
| T3        | 2026-08-01 | Audit doctrine intouchable + BannedPhrase review                 |
| T4        | 2026-11-01 | Migration upgrades planifiés (Next, Prisma, BullMQ) + ADR R25    |

Plus : revue **mensuelle légère** (1er du mois) — vérifier crons (R21, R26, R27).

## Procédure trimestrielle

### 1. Vérifier index README

```bash
ls axionia/docs/runbooks/R*.md | wc -l
# Attendu : 28 (+ 2 transverses : coolify-procedures, review-sop)
```

Comparer avec README inventaire. Si écart → mise à jour.

### 2. Audit "date dernière maj" sur chaque runbook

```bash
grep -l "Date dernière maj" axionia/docs/runbooks/R*.md | while read f; do
  date_str=$(grep "Date dernière maj" "$f" | head -1)
  echo "$f → $date_str"
done
```

Tout runbook avec date > 6 mois → review obligatoire ce trimestre.

### 3. Vérifier chemins admin / env vars / paths

Pour chaque runbook touché par features récentes :

- [ ] Chemins `/fr/{ADMIN_URL_PREFIX}/content-gen/...` existent toujours ?
- [ ] Env vars mentionnées (`OPENAI_API_KEY`, `INDEXNOW_KEY`, etc.) toujours en usage ?
- [ ] App UUID Coolify inchangé ? (mémoire `axionia_coolify_api_authorization`)
- [ ] Server Action names corrects ? (Sprint master prompt § 16-17)

### 4. Cross-check alertes Telegram ↔ runbooks

```bash
# Lister liens runbook dans content-gen-alerts.ts
grep -E "R[0-9]+|runbook" axionia/src/server/content-gen/shared/content-gen-alerts.ts

# Toutes les alertes § 12.3bis doivent pointer vers un runbook valide
```

Si nouvelle alerte ajoutée master prompt → runbook correspondant doit exister.

### 5. Tester 1 runbook P0 (rotation par trimestre)

| Trimestre | Runbook testé (dry-run / smoke)                      |
| --------- | ---------------------------------------------------- |
| T1        | R01 Kill switch (activate + release sans gen réelle) |
| T2        | R22 Restore drill PG (drill complet)                 |
| T3        | R07 KB not ready (test bypass)                       |
| T4        | R10 Coolify deploy fail (test rollback API)          |

Documenter résultat dans `_AUDIT/RUNBOOKS-REVIEW-LOG.md`.

### 6. Mettre à jour mémoires si patterns évoluent

Si pattern récurrent observé (ex : 3 fois R02 cost cap en 3 mois) → mémoire dédiée `axionia_runbook_pattern_<topic>.md`.

### 7. Bumper versions des runbooks modifiés

```yaml
# Header de chaque runbook patché :
- **Version** : 1.0 → 1.1
- **Date dernière maj** : 2026-05-15 → 2026-08-01
```

### 8. Commit + push

```bash
git add axionia/docs/runbooks/
git commit -m "chore(runbooks): review trimestrielle T2 2026-05-01"
git push origin main
```

### 9. Notifier Telegram

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟢 [SOP] Runbooks review T2 OK. 28 runbooks audités, X modifiés."
```

## Procédure mensuelle légère

1er du mois — checklist 5 min :

- [ ] R21 Cost cap reset cron exécuté nuit du 1er.
- [ ] R26 Retention tier-3 cron quotidien actif (vérif log 7 derniers jours).
- [ ] R27 Vacuum mensuel exécuté ? (déclencher si non).
- [ ] R30 Lighthouse weekly continue (vérif log W-1 à W-4).
- [ ] Pas d'alerte récurrente Telegram sans runbook.

## Triggers révision ad-hoc (hors calendrier)

Réviser **immédiatement** si :

- Master prompt content-gen patché (v1.7 → v1.8) → re-check § 12.3bis alertes + § 13.2 crons.
- Nouvel ADR architecture (ex : ADR 0022 V2 backend) → identifier impacts runbooks.
- Incident P0 réel → post-mortem alimente le runbook correspondant.
- Coolify upgrade majeur (v4 → v5).
- Provider IA ajouté (V2 : OpenRouter ? Mistral ?) → R02 + R11 patch.

## Métriques de santé runbooks

| KPI                                  | Cible           | Mesure                                                                   |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------ |
| % runbooks < 6 mois                  | ≥ 80 %          | `grep "Date dernière maj" R*.md`                                         |
| % alertes Telegram avec lien runbook | 100 %           | grep regex dans `content-gen-alerts.ts`                                  |
| Drill P0 trimestriel exécuté         | ≥ 1 / trimestre | `_AUDIT/RUNBOOKS-REVIEW-LOG.md`                                          |
| Score audit A5                       | ≥ 40/50         | re-audit annuel via prompt `PROMPT-CONTENT-GEN-AUDIT-A5-RUNBOOKS-OPS.md` |

## Liens

- Audit A5 d'origine : `_AUDIT/CONTENT-GEN-AUDIT-A5-RUNBOOKS-2026-05-15.md`
- Prompt audit A5 : `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-A5-RUNBOOKS-OPS.md`
- ADR 0021 — V1 build + dette V1.5
- Master prompt § 12.3bis (alertes) + § 13.2 (crons) + § 13.3 (monitoring)
