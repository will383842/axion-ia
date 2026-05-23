# 📋 PROMPT AUDIT A5 — Operational Runbooks completeness (Content Generator)

> Audit dédié : vérifier la présence + qualité des runbooks ops pour TOUS
> les incidents prévisibles content-gen (V1 + V2 livrés).
>
> Mode AUDIT-ONLY strict. Production : 1 rapport `.md` unique.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT A5 — Runbooks ops)

Tu es l'auditeur ops-readiness. V1+V2 content-gen sont livrés (tag
v1.0.1-content-gen + Sprints 7-12 mergés). Will doit pouvoir gérer
TOUT incident prod en autonomie ou avec une aide minimale.

Ton job : vérifier que CHAQUE scenario incident prévisible a un
runbook clair, accessible, actionnable, à jour.

CONTEXTE :
- Stack prod : Hetzner CPX42 + Coolify + Postgres + Redis + Cloudflare
  Free (cf. mémoires axionia_hosting_hetzner + axionia_session_2026-05-09_*)
- Workers BullMQ V1 (~10) + V2 (~5-7 additional)
- 5 providers IA (OpenAI/Anthropic/Perplexity/Unsplash/Voyage)
- 16+ alertes Telegram (§ 12.3bis master prompt)
- KB V4 alimentée par content-gen (factory 100/jour si KB_AUTO_PUBLISH=true)

⛔ MODE AUDIT-ONLY STRICT :
- Aucune édition / création runbook (juste audit existant)
- Tu LIS : docs/runbooks/, docs/content-gen/, _AUDIT/, README, ADRs
- Si runbook manquant → noter dans rapport, NE PAS le créer
- Seul livrable : `_AUDIT/CONTENT-GEN-AUDIT-A5-RUNBOOKS-2026-XX-XX.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

1. axionia/docs/runbooks/* (si dossier existe)
2. axionia/docs/content-gen/* (README + EXIT V1 checklist + ADR 0021)
3. axionia/_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md
4. axionia/README.md + axionia/CLAUDE.md
5. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 13.3 alertes Telegram
6. axionia/docs/adr/* (tous ADR 0001-0021+)

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 0 — Setup                                      ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git status
git log --oneline -5
ls axionia/docs/runbooks/ 2>/dev/null || echo "❌ Pas de dossier docs/runbooks/"
ls axionia/docs/content-gen/
find axionia/docs -name "*.md" -newer /tmp/dummy 2>/dev/null
```

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 1 — Inventaire runbooks ATTENDUS                          ║
╚═══════════════════════════════════════════════════════════════════════╝

Liste exhaustive des runbooks ops indispensables content-gen V1+V2 :

### 🔴 P0 — Incidents critiques (RUN absolument)

| # | Runbook | Quand | Contenu attendu |
|---|---------|-------|-----------------|
| **R1** | Kill switch d'urgence | Provider IA hack / coût explosif / bug doctrine massif | Étapes activer + verify workers arrêtent + désactiver propre |
| **R2** | Cost cap atteint provider | Notif Telegram 100 % | Vérifier cap, augmenter ou attendre reset 1er mois, switch provider |
| **R3** | Postgres down (DB indisponible) | Sentry + admin 500 | Restart Coolify Postgres, restore backup si nécessaire, RTO target |
| **R4** | Redis down (queue indisponible) | Workers crashent | Restart Coolify Redis, BullMQ recovery, jobs perdus ? |
| **R5** | Workers Coolify down | Aucun job ne se traite | Restart `pnpm worker` service Coolify, vérifier logs |
| **R6** | Migration SQL ratée prod | Schema drift entre code et DB | Rollback migration, restore DB, re-test |
| **R7** | KB not ready (< 50 entries) | Workers refusent jobs | Ingest depuis skill axionia-connaissances, vérifier > 50 + canonical |
| **R8** | XSS détecté dans Article publié | Alerte Sentry / report user | Identifier source, sanitize, dépublier, scan tous Articles |
| **R9** | Doctrine violation détectée post-publi (SIREN, AxionIA, formation) | Audit manuel | Dépublier, blacklist phrase, re-générer |
| **R10** | Coolify deploy fail | GitHub Actions rouge | Investigation logs, fix, rollback container précédent |

### 🟡 P1 — Incidents importants

| # | Runbook | Quand | Contenu attendu |
|---|---------|-------|-----------------|
| **R11** | Provider IA circuit breaker open | 5 fails / 30s | Vérifier panne provider, attendre 60s half-open, fallback Anthropic |
| **R12** | Quality loop runaway (boucle infinie) | maxAttempts dépassé | Pause boucle, identifier cause, ajuster seuils |
| **R13** | RSS source down | Aucun item nouveau 24h+ | Vérifier URL, fallback source alternative |
| **R14** | IndexNow ping rejected (key invalide) | api.indexnow.org 403 | Régénérer key, mettre à jour env + public/{key}.txt |
| **R15** | Google Indexing API quota dépassé | 200/jour limite gratuite | Réduire usage, alerte, considérer paid tier |
| **R16** | Telegram alerts ne partent plus | Bot token révoqué | Régénérer token Telegram, update env Coolify |
| **R17** | Sentry capture failed | DSN invalide / quota | Régénérer DSN, vérifier scrub rules |
| **R18** | Plausible events ne remontent pas | site_id invalide | Vérifier config, re-test event manuel |
| **R19** | Stripe webhook fail content-gen | (V2 si payment trigger gen) | Re-process webhook, vérifier signature |
| **R20** | Cloudflare cache stale (article modifié pas visible) | Purge cache manuel CF dashboard | URL ou full purge |

### 🟢 P2 — Maintenance routine

| # | Runbook | Quand | Contenu attendu |
|---|---------|-------|-----------------|
| **R21** | Reset cost cap mensuel | 1er du mois 00:01 UTC | Vérifier cron exécuté, sinon manual reset |
| **R22** | Backup Postgres restore drill | Trimestriel | Tester restore complet depuis backup, mesurer RTO |
| **R23** | Rotation INDEXNOW_KEY | Annuel ou si leak | Générer nouvelle key, update env + public file |
| **R24** | Rotation Telegram bot token | Si leak suspect | Régénérer, update env |
| **R25** | Migration upgrade Next 16 → 17 | Quand stable | Tester sur branche dev, ADR, deploy |
| **R26** | Cleanup retention tier-3 | Mensuel auto via cron | Vérifier cron exécuté, purge OK |
| **R27** | Vacuum analyze Postgres | Mensuel | Maintenance perf DB |
| **R28** | Renouvellement DPA providers IA | Annuel | Vérifier dates, signer nouveaux |
| **R29** | Audit RGPD sous-processeurs | Annuel | Comparer providers actifs vs déclarés |
| **R30** | Lighthouse CI prod | Hebdo | Suivre métriques Web Vitals, alerter si dégradation |

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 2 — Critères qualité d'un runbook                         ║
╚═══════════════════════════════════════════════════════════════════════╝

Pour CHAQUE runbook trouvé, vérifier qu'il contient :

- [ ] **Titre + version + date dernière maj**
- [ ] **Trigger** : quand activer ce runbook (alerte, métrique, observation)
- [ ] **Sévérité** : P0/P1/P2 + impact business si non traité
- [ ] **Prérequis** : accès (Coolify admin, SSH Hetzner, GitHub, DB shell)
- [ ] **Étapes numérotées** : commandes exactes copy-paste-ready
- [ ] **Vérifications post-fix** : comment confirmer que résolu ?
- [ ] **Rollback procedure** : si fix introduit nouveau problème
- [ ] **Escalation** : qui contacter si bloqué (Will, support Coolify, etc.)
- [ ] **Lien ADR ou doc connexe** : contexte décisionnel

Un runbook qui manque > 3 de ces 9 critères = INCOMPLET (P1).
Un runbook absent = MANQUANT (P0).

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 3 — Cross-check alertes Telegram ↔ runbooks               ║
╚═══════════════════════════════════════════════════════════════════════╝

Master prompt § 12.3bis liste 16 alertes Telegram :

| Alerte Telegram | Runbook correspondant ? |
|-----------------|-------------------------|
| [⚠️ COÛT 80 %] | R2 cost cap |
| [🔴 COÛT 100 %] | R2 cost cap |
| [⚠️ PROVIDER DOWN 5min] | R11 circuit breaker |
| [🔴 PROVIDER LONG DOWN 30min] | R11 |
| [🔴 KB NOT READY] | R7 |
| [🔴 BATCH FAIL] | (à créer ?) |
| [ℹ️ REVIEW] | (process review SOP) |
| [✓ DONE] | (info, pas runbook) |
| [⚠️ PERF LCP] | (Web Vitals SOP) |
| [⚠️ WEB_VITALS_DEGRADED LCP] | (Web Vitals SOP) |
| [⚠️ WEB_VITALS_DEGRADED INP] | idem |
| [🔴 WEB_VITALS_DEGRADED CLS] | idem |

→ Chaque alerte qui peut être déclenchée DOIT pointer vers un runbook
   précis (lien direct dans le message Telegram).

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 4 — Cross-check Coolify API tokens + procédures           ║
╚═══════════════════════════════════════════════════════════════════════╝

Mémoire `axionia_coolify_api_authorization` : Will a autorisé usage API
Coolify (logs, deploys, env vars, restart). Token Sanctum dans
`.secrets/api-tokens.env`.

Vérifier runbook documente :
- [ ] Comment accéder à Coolify dashboard (URL + login)
- [ ] Comment utiliser Coolify API token (cURL examples)
- [ ] Comment voir logs worker (`coolify logs <service>`)
- [ ] Comment restart service (`coolify restart <service>`)
- [ ] Comment update env var en prod
- [ ] Comment trigger deploy manuel
- [ ] Comment voir resources (RAM, CPU, disk)
- [ ] Comment snapshot Hetzner pré-modif risquée
- [ ] App UUID + service UUIDs documentés

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 5 — Synthèse + verdict                                    ║
╚═══════════════════════════════════════════════════════════════════════╝

Rapport `_AUDIT/CONTENT-GEN-AUDIT-A5-RUNBOOKS-2026-XX-XX.md` :

```markdown
# Audit A5 — Operational Runbooks (YYYY-MM-DD)

## 1. Contexte
- V1+V2 livrés (tag v1.0.1 + Sprints 7-12)
- Stack prod : Hetzner CPX42 + Coolify + Postgres + Redis + CF Free
- Dossier runbooks : `docs/runbooks/` (X fichiers OU ❌ absent)

## 2. Inventaire 30 runbooks attendus

### P0 — Incidents critiques (10)
| # | Runbook | Présent ? | Qualité (9 critères) | Verdict |
|---|---------|-----------|----------------------|---------|
| R1 | Kill switch | ❌/✅ | X/9 | manquant/OK/incomplet |
...

### P1 — Incidents importants (10)
[matrice]

### P2 — Maintenance routine (10)
[matrice]

## 3. Qualité runbooks existants
Pour CHAQUE runbook présent :
| Runbook | Titre | Trigger | Étapes | Verify | Rollback | Escalation |
|---------|-------|---------|--------|--------|----------|------------|

## 4. Alertes Telegram sans runbook
Liste des alertes § 12.3bis qui pointent vers un runbook MANQUANT.

## 5. Procédures Coolify documentation
Checklist 9 items procédures Coolify (login, logs, restart, etc.)

## 6. Score /50
- 10 P0 présents = 25 pt
- 10 P1 présents = 15 pt
- 10 P2 présents = 5 pt
- Qualité moyenne (sur 9 critères) = 5 pt

🟢 OPS READY : ≥ 40/50 (tous P0 + 80 % P1)
🟡 OPS PARTIEL : 25-39/50
❌ OPS NOT READY : < 25/50

## 7. Top runbooks manquants P0
- [ ] R1 ...
- [ ] R3 ...

## 8. Recommandations
- P0 : créer X runbooks AVANT prod
- P1 : améliorer Y runbooks existants
- P2 : process formel review trimestriel

## 9. Métadonnées
- Durée : X h
- Runbooks audités : Y
```

╔═══════════════════════════════════════════════════════════════════════╗
║                          DÉMARRER                                     ║
╚═══════════════════════════════════════════════════════════════════════╝

Mode : 🔒 AUDIT-ONLY STRICT. Production rapport unique. Aucun fix.
```
