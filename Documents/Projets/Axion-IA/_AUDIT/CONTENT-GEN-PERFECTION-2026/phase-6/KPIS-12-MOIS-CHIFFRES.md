# KPIs 12 MOIS CHIFFRES — Content-Gen Perfection 2026
## Baseline 2026-05-22 | HEAD e573da64 | Score 3638/5000
## Cibles Q3 2026 → Q2 2027

> Source detaillee : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/agents/A6-08-kpis-12mois.md`
> Mise a jour : 2026-05-22 (+40 pts vs baseline 3598 du 2026-05-21, commits Sprint P5 follow-up)

---

## TABLEAU COMPLET 19 KPIs

| KPI | Mesure via | Baseline 2026-05-22 | Cible Q3 (sept 26) | Cible Q4 (dec 26) | Cible Q1 27 | Cible Q2 27 | Frequence mesure |
|-----|-----------|---------------------|-------------------|-------------------|-------------|-------------|-----------------|
| **K1** Articles publies cumules | DB count articles WHERE status='published' | ~100 (pipeline off) | 4 000 | 22 000 | 45 000 | 58 000 | Quotidien |
| **K2** Articles publies / jour (moy. 7j) | DB GROUP BY DATE(published_at) | 0/j (pipeline off) | 30→100/j | 100→200/j | 200/j | 200→300/j | Quotidien |
| **K3** Taux indexation articles Google (%) | GSC Coverage Valid / K1 | ~30% | ≥60% | ≥75% | ≥85% | ≥90% | Hebdomadaire |
| **K4** Articles non-dupliques SimHash (%) | content_gen_jobs WHERE simhash_ok=true / total | N/A (post P1.5) | ≥98% | ≥99% | ≥99.5% | ≥99.5% | Hebdomadaire |
| **K5** Types contenu actifs (count) | SELECT COUNT(DISTINCT type) FROM content_gen_jobs | 7 (sur 9 definis) | 7 | 8 | 9 | 9 | Mensuel |
| **K6** Impressions GSC / mois | Google Search Console Performance | ~5 000 | 50 000 | 200 000 | 500 000 | 1 000 000+ | Mensuel |
| **K7** Clics organiques GSC / mois | Google Search Console Performance | ~200 | 2 500 | 10 000 | 25 000 | 50 000 | Mensuel |
| **K8** CTR moyen (clics/impressions) | GSC Performance (K7/K6) | ~4% | ~5% | ~5% | ~5% | ~5% | Mensuel |
| **K9** Position moy. keywords non-brand | GSC → filter query non-"axion" | >30 (0% visibilite) | ≤25 | ≤20 | ≤15 | ≤10 | Mensuel |
| **K10** Citations AI Overviews / mois | GSC feature:ai_overview + spot-check | ~0 | 5 | 20 | 50 | 100 | Mensuel |
| **K11** Score LLM-judge moyen (/100) | AVG(quality_score) content_gen_jobs completed | N/A (pipeline off) | ≥70 | ≥72 | ≥75 | ≥78 | Hebdomadaire |
| **K12** Taux rejet LLM-judge (score < 60) | content_gen_jobs WHERE quality_score<60 / total | N/A (pipeline off) | ≤18% | ≤15% | ≤12% | ≤10% | Hebdomadaire |
| **K13** Score factcheck moyen (/100) | AVG(factcheck_score) content_gen_jobs completed | N/A (pipeline off) | ≥68 | ≥70 | ≥72 | ≥75 | Hebdomadaire |
| **K14** Taux articles avec image hero (%) | articles WHERE hero_image_id IS NOT NULL / total | ~0% (bug resolu P1.5) | ≥80% | ≥95% | 100% | 100% | Hebdomadaire |
| **K15** MAX_PUBLISH_PER_DAY effectif | Config content-publish-worker.ts (rampe auto) | 30/j (palier demarrage) | 100/j | 200/j | 300/j | 500/j | Mensuel |
| **K16** Cout LLM moyen / article ($) | AVG(cost_usd) content_gen_jobs completed | ~$0.12 (estimé) | ≤$0.13 | ≤$0.14 | ≤$0.14 | ≤$0.15 | Hebdomadaire |
| **K17** Uptime pipeline BullMQ (%) | Sentry error rate + content_gen_jobs failed% | ~95% (estimé) | ≥97% | ≥99% | ≥99.5% | ≥99.5% | Mensuel |
| **K18** Delai moyen publication job (min) | completed_at - created_at AVG content_gen_jobs | N/A (pipeline off) | ≤15 min | ≤12 min | ≤10 min | ≤8 min | Hebdomadaire |
| **K19** Pages villes indexees Google (count) | GSC + COUNT(DISTINCT anchor_ville_slug) articles | ~10 (sur 39 generees) | 50 | 80 | 100 | 120 | Mensuel |

---

## KPIs BUSINESS SUPPLEMENTAIRES

| KPI | Mesure via | Baseline 2026-05-22 | Cible Q3 | Cible Q4 | Cible Q1 27 | Cible Q2 27 | Frequence |
|-----|-----------|---------------------|----------|----------|-------------|-------------|-----------|
| **KB** Leads B2B attribuables contenu / mois | CRM UTM source=blog | 0 | 2 | 4 | 8 | 15 | Mensuel |
| **KC** Compliance AI Act — promptHash reel (%) | generation_provenance WHERE LENGTH(prompt_hash)=64 | ~85% (post Sprint P2-P5) | ≥95% | ≥98% | 100% | 100% | Trimestriel |
| **KD** Score pipeline content-gen (/5000) | Audit Claude autopilot | 3 638 | ~3 942 | ~4 180 | ~4 345 | ≥4 500 | Trimestriel |

---

## VOLUMES ET COUTS PAR TRIMESTRE

| Trimestre | Art/j moy. | Articles | Cout Anthropic | Cout total |
|-----------|-----------|---------|---------------|-----------|
| Q3 2026 (J0–J90) | ~45 | ~4 050 | ~$486 | ~$728 |
| Q4 2026 (J91–J180) | ~150 | ~13 500 | ~$1 620 | ~$1 857 |
| Q1 2027 (J181–J270) | ~200 | ~18 000 | ~$2 160 | ~$2 429 |
| Q2 2027 (J271–J365) | ~250 | ~22 500 | ~$2 700 | ~$2 941 |
| **TOTAL 12 mois** | | **~58 050** | **~$6 966** | **~$7 955** |

> Source : A6-09 § 1. Cout $0.12/article median (inclut ~15% rejects). Infra Hetzner CPX42 + adresse FR inclus.

---

## TOP 5 KPIs PRIORITAIRES (business Will)

### K6 — Impressions GSC
**Pourquoi prioritaire** : Signal direct de visibilite organique — vérifiable GSC sans attendre conversion.
**Alerte** : Stagnation > 2 semaines apres scale 100/j → HCU possible → pause immediate.
**Source** : GSC Console → Performance → Search results → Date range 28j glissant.

### K1 — Articles publies cumules
**Pourquoi prioritaire** : Volume = carburant du pipeline. Indicateur sante operations pipelines.
**Alerte** : K1 < 500 articles a J+30 → verifier workers BullMQ (K17) + MAX_PUBLISH_PER_DAY.

### K3 — Taux indexation articles (%)
**Pourquoi prioritaire** : Publier sans indexer = investissement nul. Baseline ~30% = 70% des articles jamais vus par Google.
**Alerte** : Taux < 40% malgre scale → audit crawl budget + robots.txt + IndexNow key actif.

### K12 — Taux rejet LLM-judge (%)
**Pourquoi prioritaire** : Sante qualite pipeline. Trop eleve (>25%) → probleme prompts. Trop bas (<5%) → seuil trop permissif.
**Alerte** : K12 > 25% → reviewer les prompts Sprint D. K12 < 5% → verifier seuil QUALITY_THRESHOLD=60.

### KC — Compliance AI Act (%)
**Pourquoi prioritaire** : Obligation legale deadline **2026-08-02** (AI Act art. 50). Non-compliance = risque amende CNIL.
**Alerte** : KC < 90% apres J30 → STOP scale > 30/j immédiat → sprint emergency correctif.

---

## SIGNAUX D'ALERTE CRITIQUES

| Signal | KPI | Seuil | Action |
|--------|-----|-------|--------|
| Pipeline arrete | K2 | 0 art/j > 48h | Telegram alerte auto + verif workers content-orchestrator |
| Volume insuffisant | K1 | < 500 art a J+30 | Verifier BullMQ stall + config MAX_PUBLISH_PER_DAY |
| Indexation faible | K3 | < 40% pendant 2 semaines | Audit crawl budget + robots.txt + IndexNow |
| Qualite LLM chute | K11 | AVG < 60/100 sur 7j | Rollback prompt + investigation provider |
| Trop de rejects | K12 | > 25% sur 7j | Audit prompt + QUALITY_THRESHOLD revue |
| GSC en baisse | K6 | Baisse > 30% sur 4 semaines | Audit deindexation + soft-404-gate.ts + sitemap |
| Cout unitaire derive | K16 | > $0.20/article | Activer prompt caching Anthropic + audit retry storm |
| Cout mensuel derive | K16×K1 | > $1 500/mois | Plafond 200/j temporaire |
| AI Act non-conforme | KC | < 90% compliance | STOP scale > 30/j → sprint emergency promptHash |
| Workers degradés | K17 | Uptime < 95% pendant 48h | Sentry alert + investigation lockDuration BullMQ |
| Image hero absente | K14 | < 50% apres Q3 | Verifier image-bank slug workflow + hero_image_id wiring |

---

## TABLEAU DE BORD REPORTING HEBDO (D-P5-3 — lundi 8h)
Contenu recommande email lundi 8h → williamsjullin@gmail.com :

```
Rapport hebdomadaire AxionIA Content-Gen — Semaine WW

Volume
- Articles publies cette semaine : X (cap journalier : X/j)
- Total cumule : X articles (K1)
- REJECT LLM-judge : X% (seuil Q3 : 18%)

Couts
- Semaine : $X (total mensuel = $X / cap $1500 = Z%)
- Cout moyen/article : $X.XX (K16)

Qualite
- Score qualite moyen : X/100 (K11) [seuil : ≥70]
- Score factcheck moyen : X/100 (K13)
- Articles avec image hero : X% (K14)
- Alertes anomalies : [AUCUNE / X alertes]

SEO (pull GSC API hebdo)
- Impressions semaine : X (K6)
- Taux indexation : X% (K3) [seuil : ≥60%]

Progression villes
- Villes avec landing pages : X/120 (K19)
- Nouvelles villes cette semaine : X

Alertes actives
- [AUCUNE / LISTE]
```
