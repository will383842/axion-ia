# A6-08 — KPIs 12 mois chiffrés — Content-Gen Perfection 2026
**Agent** : A6-08 | **Mission** : KPIs 12 mois baselines + cibles trimestrielles
**Date mise à jour** : 2026-05-22 | **HEAD** : e573da64 | **Score pipeline** : 3638/5000
**Baseline précédente** : 2026-05-21 (score 3598/5000) — mise à jour +40 pts (commits Sprint P5 follow-up)
**Mode** : AUDIT-ONLY — 0 commit, 0 modification code

---

## 1. Tableau complet 19 KPIs

> **Légende** :
> - Baseline = état réel mesuré au 2026-05-22 (HEAD e573da64)
> - Q3 = J0→J90 (mai→août 2026) | Q4 = J91→J180 (août→nov 2026)
> - Q1-27 = J181→J270 (nov 2026→fév 2027) | Q2-27 = J271→J365 (fév→mai 2027)
> - Rampe MAX_PUBLISH_PER_DAY codée dans `content-publish-worker.ts` lignes 80-96 : <60 art publiés → 30/j | <300 → 100/j | <600 → 200/j | ≥600 → 500/j

| KPI | Mesure via | Baseline 2026-05-22 | Cible Q3 (sept 26) | Cible Q4 (déc 26) | Cible Q1 27 | Cible Q2 27 | Fréquence mesure |
|-----|-----------|---------------------|-------------------|-------------------|-------------|-------------|-----------------|
| **K1** Articles publiés cumulés | `SELECT COUNT(*) FROM articles WHERE status='published'` | ~100 (pipeline off au 22/05) | 4 000 | 22 000 | 45 000 | 58 000 | Quotidien |
| **K2** Articles publiés / jour (moy. 7j) | `articles GROUP BY DATE(published_at)` | 0 (pipeline off) | 30→100/j | 100→200/j | 200/j | 200→300/j | Quotidien |
| **K3** Taux indexation articles Google (%) | GSC Coverage Valid / K1 publiés | ~30% (estimé) | ≥60% | ≥75% | ≥85% | ≥90% | Hebdomadaire |
| **K4** Articles non-dupliqués SimHash (%) | `content_gen_jobs WHERE simhash_ok=true / total` | N/A (SimHash en prod post-P1.5) | ≥98% | ≥99% | ≥99.5% | ≥99.5% | Hebdomadaire |
| **K5** Types de contenu actifs (count) | `SELECT COUNT(DISTINCT type) FROM content_gen_jobs WHERE status='completed'` | 7 (sur 9 définis) | 7 | 8 | 9 | 9 | Mensuel |
| **K6** Impressions GSC / mois | Google Search Console → Performance | ~5 000 | 50 000 | 200 000 | 500 000 | 1 000 000+ | Mensuel |
| **K7** Clics organiques GSC / mois | Google Search Console → Performance | ~200 | 2 500 | 10 000 | 25 000 | 50 000 | Mensuel |
| **K8** CTR moyen (clics/impressions) | GSC Performance (K7/K6) | ~4% | ~5% | ~5% | ~5% | ~5% | Mensuel |
| **K9** Position moy. keywords cibles non-brand | GSC → Performance → filter non-brand | >30 (0% visibilité déclarée) | ≤25 | ≤20 | ≤15 | ≤10 | Mensuel |
| **K10** Citations AI Overviews / mois (estimé) | GSC feature:ai_overview + spot-check Google | ~0 | 5 | 20 | 50 | 100 | Mensuel |
| **K11** Score LLM-judge moyen (/100) | `SELECT AVG(quality_score) FROM content_gen_jobs WHERE status='completed'` | N/A (pipeline off) | ≥70 | ≥72 | ≥75 | ≥78 | Hebdomadaire |
| **K12** Taux rejet LLM-judge (quality_score < 60) | `content_gen_jobs WHERE quality_score<60 / total` | N/A (pipeline off) | ≤18% | ≤15% | ≤12% | ≤10% | Hebdomadaire |
| **K13** Score factcheck moyen (/100) | `SELECT AVG(factcheck_score) FROM content_gen_jobs WHERE status='completed'` | N/A (pipeline off) | ≥68 | ≥70 | ≥72 | ≥75 | Hebdomadaire |
| **K14** Taux articles avec image hero (%) | `articles WHERE hero_image_id IS NOT NULL / total publiés` | ~0% (bug slug résolu P1.5) | ≥80% | ≥95% | 100% | 100% | Hebdomadaire |
| **K15** MAX_PUBLISH_PER_DAY effectif | Config `content-publish-worker.ts` + rampe auto | 30/j (palier démarrage) | 100/j | 200/j | 300/j | 500/j | Mensuel |
| **K16** Coût LLM moyen / article ($) | `SELECT AVG(cost_usd) FROM content_gen_jobs WHERE status='completed'` | ~$0.12 (estimé, inclut rejects) | ≤$0.13 | ≤$0.14 | ≤$0.14 | ≤$0.15 | Hebdomadaire |
| **K17** Uptime pipeline BullMQ (%) | Sentry error rate workers + `content_gen_jobs WHERE status='failed'` | ~95% (estimé) | ≥97% | ≥99% | ≥99.5% | ≥99.5% | Mensuel |
| **K18** Délai moyen publication job (minutes) | `content_gen_jobs: completed_at - created_at AVG` | N/A (pipeline off) | ≤15 min | ≤12 min | ≤10 min | ≤8 min | Hebdomadaire |
| **K19** Pages villes indexées Google (count) | GSC + `SELECT COUNT(DISTINCT anchor_ville_slug) FROM articles WHERE status='published'` | ~10 (sur 39 générées) | 50 | 80 | 100 | 120 | Mensuel |

---

## 2. KPIs business additionnels (surveillance Will)

| KPI | Mesure via | Baseline 2026-05-22 | Cible Q3 | Cible Q4 | Cible Q1 27 | Cible Q2 27 | Fréquence |
|-----|-----------|---------------------|----------|----------|-------------|-------------|-----------|
| **KB** Leads B2B attribuables contenu / mois | CRM (UTM source=blog) | 0 | 2 | 4 | 8 | 15 | Mensuel |
| **KC** Compliance AI Act — promptHash réel (%) | `generation_provenance WHERE LENGTH(prompt_hash)=64 AND prompt_hash NOT LIKE '%stub%'` | ~85% (post Sprint P2-P5) | ≥95% | ≥98% | 100% | 100% | Trimestriel |
| **KD** Score pipeline content-gen (/5000) | Audit Claude autopilot | 3 638 | ~3 942 | ~4 180 | ~4 345 | ≥4 500 | Trimestriel |
| **KE** Workers uptime (%) | Sentry + BullMQ failed jobs | ~95% | ≥97% | ≥99% | ≥99.5% | ≥99.5% | Mensuel |

---

## 3. Tableau détaillé des volumes et coûts liés aux KPIs

Cohérence avec A6-09 (coûts 12 mois) :

| Trimestre | Art/j moy. | Articles publiés | Coût LLM Anthropic | Coût total ($) |
|-----------|-----------|-----------------|-------------------|---------------|
| Q3 2026 (J0–J90) | ~45 | ~4 050 | ~$486 | ~$728 |
| Q4 2026 (J91–J180) | ~150 | ~13 500 | ~$1 620 | ~$1 857 |
| Q1 2027 (J181–J270) | ~200 | ~18 000 | ~$2 160 | ~$2 429 |
| Q2 2027 (J271–J365) | ~250 | ~22 500 | ~$2 700 | ~$2 941 |
| **TOTAL 12 mois** | | **~58 050** | **~$6 966** | **~$7 955** |

> Source : A6-09 § 1, tableau coûts détaillés par trimestre. Coût Anthropic/article = $0.12 médiane (inclut ~15% rejects).

---

## 4. TOP 5 KPIs prioritaires Will

### Priorité 1 — K6 : Impressions GSC mensuelles
**Pourquoi** : KPI business #1 — signal direct de visibilité sans attendre conversion. La machine content-gen n'a de valeur que si Google indexe et affiche. Passage 5K → 50K impressions/mois (Q3) = signal de sortie de l'ombre.
**Alerte** : Stagnation > 2 semaines après scale 100/j → HCU possible → pause immédiate + audit.

### Priorité 2 — K1 : Articles publiés cumulés
**Pourquoi** : Volume = surface d'attaque SEO. Impossible de capturer la longue traîne des 747 keywords × 5 verticales × 120 villes sans masse critique (>10K articles). Franchir 4 000 articles fin Q3 valide la rampe 30→100/j.
**Alerte** : K1 < 500 articles à J+30 → vérifier queue BullMQ stall + MAX_PUBLISH_PER_DAY.

### Priorité 3 — K3 : Taux indexation Google (%)
**Pourquoi** : Publier sans indexer = investissement nul. Baseline ~30% = 70% des articles jamais vus par Google. IndexNow (Bing 48h) + sitemap XML doivent porter ce taux à 75%+ avant Q4.
**Alerte** : Taux < 40% malgré scale → audit crawl budget + robots.txt + soft-404-gate.ts.

### Priorité 4 — K16 : Coût LLM mensuel total ($) [via K16 × K1]
**Pourquoi** : Viabilité économique. À 200/j × $0.12 = $24/j = $720/mois. Dépasser $1 500/mois sans ROI GSC visible → plafond 200/j temporaire. Ce KPI gate la décision de monter à 500/j (phase croisière).
**Alerte** : Coût/article > $0.20 sans amélioration qualité → audit providers + prompt caching.

### Priorité 5 — KC : Compliance AI Act (%)
**Pourquoi** : Deadline légale août 2026 (AI Act art. 50). Non-compliance = risque déréférencement ou amende CNIL. Non-négociable.
**Alerte** : KC < 90% après J30 → STOP scale > 30/j immédiat → sprint emergency promptHash.

---

## 5. Signaux d'alerte — seuils déclencheurs d'action

| Signal | KPI | Seuil | Action déclenchée | Urgence |
|--------|-----|-------|------------------|---------|
| Pipeline arrêté | K2 | 0 art/j pendant > 48h | Telegram alerte + vérif workers content-orchestrator | CRITIQUE |
| Volume insuffisant J+30 | K1 | < 500 articles | Vérifier BullMQ stall + MAX_PUBLISH_PER_DAY réglé à 0 | CRITIQUE |
| Indexation faible | K3 | < 40% pendant 2 semaines | Audit crawl budget + robots.txt + IndexNow key | HAUT |
| Score qualité trop bas | K11 | AVG < 60/100 sur 7j | Rollback prompt dernier commit + investigation provider | HAUT |
| Taux rejet élevé | K12 | > 25% sur 7j | Audit prompt + QUALITY_THRESHOLD mal réglé | HAUT |
| Stagnation GSC | K6 | Baisse > 30% sur 4 semaines | Audit déindexation + vérif soft-404-gate.ts + sitemap | HAUT |
| Coût unitaire dérive | K16 | > $0.20/article | Activer prompt caching Anthropic + audit retry storm | MOYEN |
| Coût mensuel dérive | K16×K1 | > $1 500/mois | Plafond 200/j temporaire jusqu'à ROI GSC visible | MOYEN |
| AI Act non-conforme | KC | < 90% compliance | Sprint emergency promptHash — deadline août 2026 | BLOQUANT |
| Workers dégradés | K17 | Uptime < 95% pendant 48h | Sentry alert + investigation lockDuration BullMQ | HAUT |
| Image hero manquante | K14 | < 50% après Q3 | Vérifier image-bank slug workflow + hero_image_id wiring | MOYEN |

---

## 6. Dashboard métriques reporting hebdomadaire (D-P5-3)

Format email lundi 8h → williamsjullin@gmail.com :

```
Rapport hebdomadaire AxionIA Content-Gen — Semaine WW

Volume
- Articles publiés cette semaine : X (cap journalier : X/j)
- Total cumulé : X articles (K1)
- REJECT LLM-judge : X% (seuil : 18% → cible 15%)

Couts
- Semaine : $X (total mensuel = $X / cap $1500 = Z%)
- Cout moyen/article : $X.XX (K16)

Qualite
- Score qualite moyen : X/100 (K11)
- Score factcheck moyen : X/100 (K13)
- Articles avec image hero : X% (K14)
- SimHash dupliques bloques : X (K4)
- Alertes anomalies : [AUCUNE / X alertes]

SEO (pull GSC API hebdo)
- Impressions semaine : X (K6 mensuel aggr.)
- Taux indexation : X% (K3)

Progression villes
- Villes avec landing pages : X/120 (K19)
- Nouvelles villes cette semaine : X

Alertes actives
- [AUCUNE / LISTE]
```

---

## 7. Requêtes SQL Postgres — sources de vérité par KPI

```sql
-- K1 : Articles publiés cumulés
SELECT COUNT(*) as total_published
FROM articles WHERE status = 'published';

-- K2 : Articles publiés / jour (7j glissant)
SELECT DATE(published_at) as date, COUNT(*) as count
FROM articles
WHERE status = 'published' AND published_at >= NOW() - INTERVAL '7 days'
GROUP BY 1 ORDER BY 1 DESC;

-- K3 : Taux indexation (nécessite champ indexation_tier ou pull GSC API)
SELECT
  COUNT(*) FILTER (WHERE indexation_tier = 'tier_1_indexable') * 100.0 / NULLIF(COUNT(*), 0) as indexation_pct
FROM articles WHERE status = 'published';

-- K4 : Taux SimHash OK
SELECT
  COUNT(*) FILTER (WHERE simhash_ok = true) * 100.0 / NULLIF(COUNT(*), 0) as simhash_ok_pct
FROM content_gen_jobs WHERE status = 'completed';

-- K11 : Score qualite moyen LLM-judge
SELECT
  ROUND(AVG(quality_score), 1) as avg_quality,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY quality_score) as p25,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY quality_score) as p75
FROM content_gen_jobs
WHERE status = 'completed' AND quality_score IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days';

-- K12 : Taux rejet LLM-judge (QUALITY_THRESHOLD = 60)
SELECT
  COUNT(*) FILTER (WHERE quality_score < 60) * 100.0 / NULLIF(COUNT(*), 0) as reject_pct,
  COUNT(*) as total_completed
FROM content_gen_jobs
WHERE status = 'completed' AND created_at >= date_trunc('month', NOW());

-- K13 : Score factcheck moyen
SELECT ROUND(AVG(factcheck_score), 1) as avg_factcheck
FROM content_gen_jobs
WHERE status = 'completed' AND factcheck_score IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days';

-- K14 : Taux image hero
SELECT
  COUNT(*) FILTER (WHERE hero_image_id IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0) as hero_pct
FROM articles WHERE status = 'published';

-- K16 : Cout LLM moyen / article
SELECT
  ROUND(AVG(cost_usd::numeric), 4) as avg_cost_usd,
  ROUND(SUM(cost_usd::numeric), 2) as total_cost_usd_month
FROM content_gen_jobs
WHERE status = 'completed' AND cost_usd IS NOT NULL
  AND created_at >= date_trunc('month', NOW());

-- K17 : Uptime workers (% jobs non-failed)
SELECT
  COUNT(*) FILTER (WHERE status != 'failed') * 100.0 / NULLIF(COUNT(*), 0) as uptime_pct,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count
FROM content_gen_jobs WHERE created_at >= NOW() - INTERVAL '7 days';

-- K18 : Delai moyen job publication (minutes)
SELECT
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60)::numeric, 1) as avg_minutes,
  PERCENTILE_CONT(0.95) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)) / 60
  ) as p95_minutes
FROM content_gen_jobs
WHERE status = 'completed' AND completed_at IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days';

-- K19 : Villes avec landing pages indexees
SELECT COUNT(DISTINCT anchor_ville_slug) as villes_published
FROM articles
WHERE status = 'published' AND anchor_ville_slug IS NOT NULL;

-- KC : Compliance AI Act promptHash reel
SELECT
  COUNT(*) FILTER (
    WHERE prompt_hash IS NOT NULL
      AND prompt_hash NOT LIKE '%stub%'
      AND LENGTH(prompt_hash) = 64
  ) * 100.0 / NULLIF(COUNT(*), 0) as ai_act_compliance_pct
FROM generation_provenance
WHERE timestamp >= NOW() - INTERVAL '30 days';
```

---

## 8. Sources externes — KPIs non-DB

| KPI | Source | Frequence | Methode |
|-----|--------|-----------|---------|
| K3 taux indexation | Google Search Console API v3 | Hebdomadaire | Coverage → Valid pages / total sitemap URLs |
| K6 impressions | GSC → Performance → Search results | Mensuel | `searchanalytics.query` endpoint, dimensions=date |
| K7 clics | GSC → Performance | Mensuel | Idem K6 |
| K8 CTR | GSC → Performance | Mensuel | Calcul K7/K6 |
| K9 position moy. | GSC → Performance → filter non-brand | Mensuel | Exclure queries contenant "axion" |
| K10 citations AI Overviews | GSC (feature:ai_overview) + Semrush | Mensuel | GSC → Appearance → AI Overviews ; spot-check Google Search |
| K19 villes indexees | GSC + DB | Mensuel | GSC filter page: contient slug ville + Coverage Valid |
| KB leads B2B | CRM Axion CRM Pro (UTM tracking) | Mensuel | UTM source=blog OR content-gen |

---

## 9. Methodologie par groupe de KPIs

### Groupe 1 — Volume et indexation (K1, K2, K3, K4, K5)
Mesure principalement en DB Postgres + GSC API. K1/K2 = quotidiens (pipeline auto). K3 = hebdo pull GSC Coverage API. K4 (SimHash) = hebdo DB. K5 (types actifs) = mensuel DB.

**Hypotheses baselines** : pipeline off au 2026-05-22 → K1 baseline ~100 articles existants pre-pipeline. La rampe codee dans `content-publish-worker.ts` sera effective des le premier jour de mise en route : avec K1=~100, on entre immediatement en palier 100/j (seuil < 300 articles).

### Groupe 2 — Trafic et visibilite (K6, K7, K8, K9, K10)
Mesure principalement GSC API + monitoring tiers. Latence naturelle : Google indexe en 2-8 semaines, authority domain prend 6-12 mois. Les cibles Q3 sont volontairement conservatrices pour ce groupe. K10 (AI Overviews) est le KPI le plus difficile a mesurer — estimation qualitative mensuelle suffisante a ce stade.

**Hypothese baseline K9** : position moy. >30 confirmee par declaration 0% visibilite dans audit keyword (MEMORY). Les cibles Q3 (<=25) sont atteignables des que les premiers 4 000 articles touchent les SERP longue traine.

### Groupe 3 — Qualite (K11, K12, K13, K14)
Tous DB. K11/K12/K13 disponibles des que le pipeline tourne (premier article complete avec LLM-judge). K14 (image hero) depend du wiring image-bank → articles (post-Sprint A). Le seuil QUALITY_THRESHOLD = 60/100 est canonique (D1 decisions).

**QUALITY_THRESHOLD = 60** : defini dans `generators/blog-article.ts` ligne 23. K12 (taux rejet) = % articles < 60/100.

### Groupe 4 — Operationnel (K15, K16, K17, K18)
K15 (MAX_PUBLISH_PER_DAY) = config visible dans `content-publish-worker.ts`. K16 (cout) = table `generation_provenance.cost` source de verite granulaire. K17 (uptime) = croise Sentry error rate + BullMQ failed jobs. K18 (delai) = `completed_at - created_at` en minutes.

### Groupe 5 — Business (KB, K19, KD)
KB (leads B2B) = mesure CRM avec UTM tracking a mettre en place. K19 (villes indexees) = combine DB + GSC Coverage Valid. KD (score audit /5000) = audit Claude autopilot trimestriel.

---

## 10. Notes d'implementation

### Rampe MAX_PUBLISH_PER_DAY (K15)
La rampe codee dans `content-publish-worker.ts` demarre automatiquement en mode **100/j** (K1 baseline ~100 < seuil < 300). K15 passera a 200/j quand K1 franchit 300 articles, puis a 500/j quand K1 franchit 600 articles. Aucune modification config manuelle necessaire si les seuils restent tels que codes.

### Cout reel vs estime (K16)
La table `generation_provenance.cost` (Decimal 10,6) est la source de verite granulaire par appel LLM. La table `content_gen_jobs.cost_usd` (Decimal 10,4) est le rollup par job. Pour K16 mensuel, utiliser `generation_provenance` pour eviter les doublons retry. Baseline $0.12/article = mediane estimee incluant ~15% de rejects (cout improver + retry $0.10 supplementaire).

### SimHash (K4)
SimHash est code dans `src/server/content-gen/dedup/simhash.ts` (Sprint P1.5). La table `content_gen_jobs` doit avoir un champ `simhash_ok` booleen pour le KPI. Si ce champ n'existe pas encore en schema, K4 sera mesurable via `generation_provenance` (champ `simhash_digest`) avec une requete de deduplication.

### Score factcheck (K13)
Le champ `factcheck_score` doit etre present dans `content_gen_jobs`. Si absent, K13 = N/A jusqu'a migration schema. A verifier avant mise en prod.

### Timing des cibles
Les cibles Q3/Q4 sont conservatrices sur K6/K7/K9 (SEO est long terme : indexation 2-8 semaines, authority domain 6-12 mois). Les cibles K1/K2 suivent strictement la rampe codee. Les cibles K11/K12 (qualite LLM-judge) sont atteignables des le J+30 si le pipeline tourne correctement.

---

## 11. Resume executif

**19 KPIs definis** (5 groupes : Volume/Indexation, Trafic/Visibilite, Qualite, Operationnel, Business) + 4 KPIs business supplementaires (KB/KC/KD/KE).

**Baselines critiques au 2026-05-22** :
- Pipeline off → K1=~100 articles, K2=0/j, K11/K12/K13=N/A, K16=N/A
- Visibilite quasi-nulle → K6=~5K impressions/mois, K9=>30 position moy.
- Indexation faible → K3=~30%, K19=~10 villes
- Score audit → KD=3638/5000 (71.96%)

**Cibles GO Q4 2026 (J+180)** :
- K1=22 000 articles | K6=200K impressions/mois | K3=75% indexation
- K11≥72/100 qualite | K12≤15% rejet | K16≤$0.14/article
- KC=98% AI Act compliance | K19=80 villes

**Seuil BLOQUANT** : KC < 90% AI Act compliance = sprint emergency (deadline art.50 **2026-08-02**).

**Signal ROI Q3 (J+90)** : K6 > 50K impressions + K1 > 4 000 articles = validation que le pipeline genere de la valeur business reelle.

**GO definitif** : KD ≥ 4500/5000 prevu a J+150-J+180 selon A6-05 (~fin Q4 2026).
