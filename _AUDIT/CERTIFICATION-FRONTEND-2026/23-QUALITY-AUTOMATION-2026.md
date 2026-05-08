# 23 — QUALITY AUTOMATION 2026

> **Audit qualité automatisée** : à 100K+ pages, impossible de tester manuellement. Quality scoring auto pré-publish + sampling Lighthouse + anomaly detection + rollback auto.
> Lancer fenêtre fraîche.

## 0. Contexte

À 100-300 nouvelles URLs/jour, le risque qualité est massif :

- 1 mauvaise série de pages = pénalité HCU
- 1 régression Lighthouse non détectée = chute Core Web Vitals
- 1 contenu dupliqué non gated = signal négatif Google
- Zéro humain dans la boucle = automatisation obligatoire

## 1. Audit en 6 chapitres × 10 critères = 60 points

### Chapitre 1 — Quality gate pré-publish

1.1 Schema Zod validation contenu (champs requis, formats, longueurs min/max)
1.2 Word count check (≥ 800 mots gold standard, sinon noindex)
1.3 Uniqueness score vs corpus (Jaccard 5-grams ≥ 0.7 distinct)
1.4 Duplicate paragraphs detection (anti copy-paste multi-villes)
1.5 Lecture grade FR Flesch-Kincaid ≥ 60
1.6 Présence données locales (population, code postal, dépt, géo)
1.7 Présence FAQ géolocalisée (≥ 3 Q&A locaux)
1.8 Présence E-E-A-T signals (auteur, date, citations)
1.9 Anti-keyword stuffing (densité < 3 % par mot-clé)
1.10 Score global ≥ seuil → publish OK ; sinon → queue review

### Chapitre 2 — Lighthouse sampling automatique

2.1 1 % des nouvelles pages auditées chaque jour (ex. 2 sur 200)
2.2 Sample stratifié (par région, par template)
2.3 Lighthouse CI lance desktop + mobile
2.4 Score moyen historisé par template + region
2.5 Anomaly detection : score < 90 = alerte
2.6 Régression detection : delta > -10 pts vs run précédent
2.7 LCP/INP/CLS distribution monitorée
2.8 Bundle size delta per route trackée
2.9 Rapport quotidien Slack/Telegram (sample N pages, scores moyens)
2.10 Dashboard `/admin/pseo-stats` (Sprint 20) expose ces metrics

### Chapitre 3 — RUM aggregation per route

3.1 `/api/vitals` capture route + locale + template
3.2 Agrégation per route p75/p95 (CrUX-style interne)
3.3 Top 10 worst LCP/INP/CLS quotidien
3.4 Trend per route (LCP en hausse = signal régression)
3.5 Sample size minimum (≥ 100 visites pour stat significative)
3.6 Stockage léger (Postgres TimescaleDB extension OU rollup quotidien)
3.7 Retention 90 jours minimum (assez pour détecter trends)
3.8 Filtre bot (User-Agent + Headers vs vraie session)
3.9 Filtre dev/preview (`NODE_ENV` ou domain)
3.10 Export CSV mensuel pour analyse Will

### Chapitre 4 — Indexation monitoring

4.1 Search Console API daily fetch : indexation rate per category
4.2 Bing Webmaster Tools API : idem
4.3 Per-region indexation rate
4.4 Per-template indexation rate (hub vs region vs ville)
4.5 Time-to-index per page (publish → indexed)
4.6 Lost URLs (indexée puis désindexée) tracking
4.7 Impressions trend per page (Search Console API)
4.8 Click-through rate per page
4.9 Average position per query (top 100 queries cibles)
4.10 Alert si indexation rate drop > 10 %

### Chapitre 5 — Anomaly detection & rollback

5.1 Quality score drop > 15 % (sur sample) = alerte
5.2 Lighthouse drop > 10 pts = alerte
5.3 Indexation drop > 10 % = alerte
5.4 RUM LCP p75 hausse > 20 % = alerte
5.5 Bundle delta > +20 KB sur PR = block CI
5.6 Rollback auto procédure : revert dernier publish + Cloudflare purge
5.7 Rollback log : qui, quand, pourquoi
5.8 Reason for rollback documenté (post-mortem template)
5.9 Pause publish auto si > 3 anomalies consécutives
5.10 Notification Telegram/Slack temps réel

### Chapitre 6 — Test automation à scale

6.1 Vitest unit tests sur factories + lib + utils (cible coverage ≥ 80 %)
6.2 Playwright e2e sur 5 parcours critiques (ne scale pas par page, mais par flow)
6.3 Axe-core a11y sur 15 pages stratégiques + sample 5 random pSEO
6.4 Visual regression Playwright screenshot (Top 10)
6.5 Schema.org validation (Google Rich Results API ou local validator)
6.6 hreflang validation
6.7 Internal links checker (`broken-link-checker` ou custom script)
6.8 Sitemap validator
6.9 robots.txt validator
6.10 CI gate : tous tests passent OU PR bloqué

## 2. Méthode

### Phase A — Mesure

1. Quality gate actuel : existe ou pas ?
2. Lighthouse CI actuel : couvre quoi ?
3. RUM aggregation actuelle : `/api/vitals` payload analysé ?
4. Indexation monitoring actuel : Search Console connecté ?
5. Test coverage actuel

### Phase B — Diagnostic /60

### Phase C — Plan

1. Implémenter quality gate Zod + uniqueness check
2. Lighthouse CI sampling automatisé (cron daily)
3. RUM aggregation worker (BullMQ Sprint 18)
4. Search Console API integration (worker)
5. Anomaly detection + rollback procedure
6. Dashboard `/admin/pseo-stats` (Sprint 20 prep)

### Phase D — STOP & ASK

- `audit-23-quality-auto-SYNTHESE.md`
- `audit-23-quality-auto-DIAGNOSTIC.md`
- `audit-23-quality-auto-PLAN.md`
- `audit-23-quality-auto-RUNBOOK.md` (procédure ops)

### Phase E — Application après GO

## 3. STOP & ASK

1. Avant intégration Search Console API (OAuth)
2. Avant ajout Postgres TimescaleDB extension
3. Avant cron daily Lighthouse (CPU sur Hetzner)
4. Avant ajout dépendance npm
5. Avant tout commit
6. Avant rollback auto activé (impact prod)
7. Si quality gate rejette > 30 % (signal qualité source)

## 3bis. Anti-patterns à éviter (Pitfalls)

- ❌ Quality gate sans seuil chiffré (« généralement OK » = subjectif)
- ❌ Lighthouse sample non stratifié (toutes sur Paris = biais)
- ❌ RUM sans filtre bot (métriques polluées)
- ❌ Anomaly detection trop sensible (alertes ignorées au bout d'1 semaine)
- ❌ Rollback auto sans preuve cause (risque rollback abusif)
- ❌ Indexation drop ignoré > 30 jours (perte SEO compounding)
- ❌ Dashboard data sans owner (qui regarde ?)
- ❌ Pause publish auto sans notification Will (silent failure)

## 4. Cible

> _« 100 % des nouvelles URLs passent quality gate Zod + uniqueness avant publish. 1 % audité Lighthouse quotidien. RUM agrégé per route p75. Indexation rate monitoré quotidien. Rollback auto si anomalie. 0 page anti-HCU shippée. »_

## 5. Livrables

```
audit-23-quality-auto-SYNTHESE.md
audit-23-quality-auto-DIAGNOSTIC.md
audit-23-quality-auto-PLAN.md
audit-23-quality-auto-RUNBOOK.md
```

---

**FIN DU PROMPT 23.**
