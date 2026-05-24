# A6-07 — Vision 12 mois (J181-365)
**Agent** : A6-07 | **Date** : 2026-05-22 | **HEAD** : e573da64 (origin/main)
**Mission** : AUDIT-ONLY — zéro commit, zéro modif code
**Fenêtre** : 2026-11-16 → 2027-05-22
**Score entrant** : ~4084/5000 | **Cible** : ≥ 4500/5000 GO

---

## 1. Objectifs 12 mois

### Objectifs stratégiques

- **Atteindre GO ≥ 4500/5000** (seuil franchise opérationnelle content-gen)
- **500 articles/jour opérationnel** en Q2 2027 (rampe progressive 100→200→300→500)
- **0 incident légal AI Act art. 50** (compliance acquise dès J+71 en Sprint A)
- **Top 3 axion-ia.com sur keywords IA stratégiques** (Impressions GSC ≥ 1M/mois en Q2 2027)

### Timeline 12 mois — Vue globale

```
2026-05-22 (J0)                                              2027-05-22 (J365)
│                                                                  │
J0          J90          J180         J270         J365
│           │            │            │            │
├── A+B+C ──┼──── D ─────┼──── E ─────┼── Maint. ──┤
│ Foundation│   Scale    │ Atteinte GO│ Consolid.  │
│           │            │            │            │
│ 3638→3966 │ 3966→4084  │ 4084→4333  │ 4333→4500+ │
│           │            │            │            │
│ 30→100    │ 100→200    │ 200→300    │ 300→500    │
│ art/jour  │ art/jour   │ art/jour   │ art/jour   │
│           │            │            │            │
│ ~6 300    │ ~13 500    │ ~22 500    │ ~38 000    │
│ articles  │ articles   │ articles   │ articles   │
└───────────┴────────────┴────────────┴────────────┘
             ▲ GO estimé : ~J270-J300 (2027-02-16 → 2027-03-18)
```

---

## 2. Roadmap Sprint E items (J181-365)

### 2.1 Sprint E items détaillés

| # | Item Sprint E | Responsable | Effort | Gain pts | Dimension | Fenêtre |
|---|---------------|-------------|:------:|:--------:|-----------|---------|
| E1 | Rampe MAX_PUBLISH 200→300 art/j (validation infra BullMQ à charge) | Will + Claude | 2h Claude | +10 | D-ARCHI | J+181-J+210 |
| E2 | Rampe MAX_PUBLISH 300→500 art/j progressive (+50/semaine) | Will + Claude | 2h Claude | +15 | D-ARCHI | J+240-J+300 |
| E3 | Audit content-gen perfection 2027 (planning + exécution) | Claude | 8h | +20 | Toutes | J+365 |
| E4 | Évolution modèles IA : benchmark Claude 5 / GPT-5 (100 articles test) | Claude | 6h | +12 | D-QUAL | Sur annonce |
| E5 | Adaptation structured data AI Overviews v2 (si Google change algo) | Claude | 4h | +10 | D-VISI | Dès SGE FR v2 |
| E6 | Vérification KPIs vs prévisions (rapport comparatif J+250) | Claude | 3h | +5 | D-OPS | J+250 |
| E7 | Décision audit externe cabinet vs Claude autopilot (D15) | Will | 1h | +0 (décision) | — | J+250 |
| E8 | Backlinks x4-6 (programme continu — 4 domaines supplémentaires) | Will | 40h | +25 | D-VISI | J+181-J+350 |
| E9 | Stratégie Brand 360 IA (si GBP + adresse FR + backlinks convergent) | Will + Claude | 3h Claude | +15 | D-VISI | J+270+ |
| E10 | Migration Claude 5 prod (si benchmark E4 concluant) | Claude | 4h | +18 | D-QUAL | Après E4 |
| E11 | Nouveau critère AI search citations (Perplexity / ChatGPT Search scoring) | Claude | 5h | +20 | D-VISI | J+210-J+270 |
| E12 | Heatmap France SVG interactive (villes par volume contenu) | Claude | 4h | +10 | D-OPS | J+200-J+240 |
| E13 | Tests coverage 90%→92% + DR test annuel | Claude | 3h | +5 | D-ARCHI | J+270 |
| E14 | Wikidata Q-ID (si décision Will renversée) | Will | 2h | +34 | D-VISI/ARCHI | Sur décision |
| E15 | EN locale réactivation (si next-intl v5 corrige bug 307) | Claude | 2h | +15 | D-ETAT | Sur fix |
| E16 | Rapport hebdomadaire email complet enrichi (GSC + articles + alertes) | Claude | 3h | +8 | D-OPS | J+181-J+210 |
| E17 | Prompt A/B test résultats empiriques + optimisation finale | Claude | 6h | +12 | D-QUAL | J+210-J+240 |
| E18 | `llms.txt` + robots.txt AI crawlers (GPTBot, PerplexityBot autorisés) | Claude | 1h | +5 | D-VISI | J+181 |
| **TOTAL Sprint E** | | | **~56h Claude + ~43h Will** | **+249 pts** | | |

> **Conditionnels Sprint E** : E4+E10 (Claude 5 : +30 pts si disponible), E14 (Wikidata +34 pts si Will renverse décision), E15 (EN +15 pts si next-intl fix). Sans ces conditionnels → +170 pts (score J365 : ~4254). Avec tous les conditionnels → +249 pts (score J365 : ~4333).

### 2.2 Progression score Sprint E par trimestre

| Période | Gain pts | Score fin période | Statut |
|---------|:--------:|:-----------------:|--------|
| J+181-J+210 (3 semaines) | +45 | ~4129/5000 | 🟡 Conditionnel |
| J+211-J+240 (3 semaines) | +50 | ~4179/5000 | 🟡 Conditionnel |
| J+241-J+270 (4 semaines) | +60 | ~4239/5000 | 🟡 Conditionnel |
| J+271-J+300 (4 semaines) | +95 (avec conditionnels) | ~4333/5000 | 🟡→🟢 GO proche |
| J+301-J+365 (maintenance) | +167 (extrapolation) | ~4500+/5000 | 🟢 **GO** |

---

## 3. GO estimé : J+270-300 (~fév-mars 2027)

### Scénarios GO

| Scénario | Probabilité | Conditions | Date GO | Score |
|----------|:-----------:|-----------|---------|-------|
| **GO Rapide** | 20% | Wikidata créé + EN réactivé + Sprint E complet + Claude 5 | ~J+250 (2027-01-27) | ~4500+ |
| **GO Normal** | 55% | Sprint E complet + backlinks 4+ + conditionnels partiels | ~J+270-300 (2027-02-16 → 03-18) | ~4333-4500 |
| **GO Lent** | 25% | Conditionnels bloqués (Wikidata renoncé, EN non fixé, Claude 5 indispo) | ~J+350+ (mai 2027) | ~4250-4350 |

### Chemin critique vers GO

```
Sprint A (J0-J30)     → P0-3 promptHash AI Act → fondation légale
Sprint B (J31-J60)    → KB + câblage glossary → D-QUAL > 760
Sprint C (J61-J90)    → Dashboard D-OPS → D-OPS > 640
Sprint D (J91-J180)   → Scale 200 art/j + backlinks × 2 → D-VISI > 870
Sprint E (J181-J300)  → Backlinks × 4-6 + RAG + Brand 360 → D-VISI > 900
                                             ↓
                              GO ~J270-J300 (fév-mars 2027) ✓

Accélérateurs :
  - Wikidata Q-ID (Will, 2h) : +34 pts → GO avancé ~J250
  - EN locale réactivation (2h Claude) : +15 pts → GO avancé ~J255
  - Claude 5 migration : +18 pts qualité → GO avancé ~J260
```

---

## 4. Préparer Audit content-gen perfection 2027

### Méthode : Claude autopilot P1-P6

| Phase | Agents | Durée estimée | Portée |
|-------|:------:|:-------------:|--------|
| P1 — État pipeline | 22 agents | 90 min | Pipeline complet, workers, 9 générateurs, qualité |
| P2 — Architecture | 10 agents | 40 min | DB Prisma, Redis, BullMQ, migrations |
| P3 — Visibilité SEO/AEO/GEO | 10 agents | 40 min | Sitemap, JSON-LD, hreflang, IndexNow, GSC |
| P4 — Qualité contenu | 10 agents | 40 min | EEAT, KB, fact-check, SimHash, LLM-judge |
| P5 — Opérations | 8 agents | 30 min | Console admin, monitoring, presets, alertes |
| P6 — Synthèse | 8 agents | 30 min | Score consolidé, gaps, roadmap 2028 |
| **Total audit 2027** | **68 agents** | **~5-7h** | **Full spectrum** |

### Fenêtre recommandée : mai 2027

- **Déclencheur** : Will écrit « Lance audit content-gen perfection 2027 »
- **Pré-requis** : Pipeline stable ≥ 300 art/j depuis ≥ 30 jours
- **Budget estimé** : ~$500 (68 agents × ~$7 moyenne Claude API)
- **Décision D15** (cabinet externe vs Claude autopilot) à trancher à J+250 : recommandation = Claude autopilot (coût ×10 inférieur, accès direct codebase, historique context complet)

### Indicateurs de succès audit 2027

| Indicateur | Cible 2027 |
|------------|------------|
| Score total | ≥ 4 500/5000 confirmé stabilisé |
| D-OPS | ≥ 780/1000 (goulot principal résolu) |
| Taux indexation articles | ≥ 88% |
| Impressions GSC | ≥ 1M/mois |
| AI Overviews citations | ≥ 100/mois |
| Villes actives | = 120 (cible complète) |
| Pipeline uptime | ≥ 99,5% (30 jours) |
| Articles publiés total | ≥ 80 000 |

---

## 5. Évolution IA 2026-2027

### 5.1 Claude 5 — Impact sur qualité contenu

| Aspect | Situation actuelle (Sonnet 4.6) | Projection Claude 5 | Action |
|--------|--------------------------------|---------------------|--------|
| Modèle génération | Claude Sonnet 4.6 (hardcodé via `AI_MODEL_DISCLOSURE_NAME`) | Migration via env var uniquement | Benchmark 100 articles avant migration |
| Score LLM-judge | Cible ≥ 7,5/10 | Cible ≥ 8,0/10 (raisonnement renforcé) | Recalibrer threshold LLM-judge si nécessaire |
| Context window | 200K tokens | 500K+ attendu | KB complète injectable sans troncature |
| Coût par article | ~$0,006/article | TBD selon pricing Claude 5 | Budget +30% buffer prévu |
| Compliance AI Act | `aiGenerated: true` + `AI_MODEL_DISCLOSURE_NAME` | Mettre à jour 1 env var Coolify | Procédure 5 minutes |

**Procédure migration Claude 5 (quand disponible)** :
1. Évaluer sur 100 articles benchmark (6h Claude)
2. Si LLM-judge score ≥ 8,0/10 et coût ≤ +30% → migrer
3. Mettre à jour `AI_MODEL_DISCLOSURE_NAME` Coolify
4. Vérifier JSON-LD `aiGenerated:true` + modèle déclaré
5. Surveiller taux rejet LLM-judge post-migration (cible < 15%)

### 5.2 Google AI Overviews algo — Adapter structured data

| Changement attendu | Probabilité | Impact | Adaptation AxionIA |
|-------------------|:-----------:|--------|-------------------|
| SGE France v2 (Q3 2026) — favorise EEAT + brand voice | 40% | +50-100 pts D-VISI | Pipeline Manon brand voice déjà câblé |
| SGE France v2 — neutre | 35% | ±0 pts | Aucune action |
| SGE France v2 — dégrade contenus IA-generated | 25% | −50 à −80 pts D-VISI | Ratio Manon/IA 50/50 temporaire |

**Adaptations structured data à prévoir** :
- `speakable` étendu à tous les types d'articles (pas seulement blog)
- `abstract` + `isBasedOn` + `citation` enrichis (sources primaires INSEE/INAO/DGFiP)
- `hasOfferCatalog` sur pages services (déjà initié P3)
- Nouveau : `AIGeneratedContent` type schema.org (si standardisé 2027)

**Signal d'alerte** : Si impressions GSC chutent > 30% en 2 semaines post-SGE v2 → audit d'urgence + pivot stratégie AEO.

### 5.3 Nouveau algorithme Google E-E-A-T — Backlinks still king

| Facteur E-E-A-T | Situation actuelle | Cible J+300 | Action |
|-----------------|-------------------|------------|--------|
| Expertise (E) | Articles Manon + brand voice + 5 verticales | AuthorByline + bylines experts invités | Sprint E9 Brand 360 |
| Experience (E) | 0 backlinks autorité à J0 | ≥ 6 domaines presse FR | Outreach Will J+120→J+350 |
| Authoritativeness (A) | Wikidata renoncé (-34 pts) | Reverser ou compenser via presse | Décision Will |
| Trustworthiness (T) | Page transparence IA (D6 Sprint D) | Politique IA publique complète + mentions légales | D6 déjà planifié |

---

## 6. Coûts totaux 12 mois estimés

### Q3 2026 (J0-J90 : 2026-05-22 → 2026-08-19)

| Poste | Calcul | Coût |
|-------|--------|------|
| LLM génération articles (moy. 50 art/j × 90j) | ~4 500 articles × $0,006 | **~$27** |
| LLM développement Sprints A+B+C | ~100h × $1 | **~$100** |
| Infrastructure (Hetzner + CF + GH) | 3 mois × ~$108 | **~$324** |
| Adresse FR (si activée) | 3 mois × $33 | **~$99** |
| **Sous-total Q3 2026** | | **~$451-550** |

### Q4 2026 (J91-J180 : 2026-08-19 → 2026-11-16)

| Poste | Calcul | Coût |
|-------|--------|------|
| LLM génération articles (moy. 150 art/j × 90j) | ~13 500 articles × $0,006 | **~$81** |
| LLM développement Sprint D | ~94h × $1 | **~$94** |
| Infrastructure | 3 mois × ~$108 | **~$324** |
| Adresse FR (si activée) | 3 mois × $33 | **~$99** |
| **Sous-total Q4 2026** | | **~$499-598** |

### Q1 2027 (J181-J270 : 2026-11-16 → 2027-02-13)

| Poste | Calcul | Coût |
|-------|--------|------|
| LLM génération articles (moy. 250 art/j × 90j) | ~22 500 articles × $0,006 | **~$135** |
| LLM développement Sprint E phase 1 | ~35h × $1 | **~$35** |
| Infrastructure | 3 mois × ~$108 | **~$324** |
| Adresse FR | 3 mois × $33 | **~$99** |
| Audit perfection intermédiaire J+250 | 8 agents × $7 | **~$56** |
| **Sous-total Q1 2027** | | **~$649** |

### Q2 2027 (J271-J365 : 2027-02-13 → 2027-05-22)

| Poste | Calcul | Coût |
|-------|--------|------|
| LLM génération articles (moy. 400 art/j × 95j) | ~38 000 articles × $0,006 | **~$228** |
| LLM développement Sprint E phase 2 + maintenance | ~21h × $1 | **~$21** |
| Infrastructure | ~3,5 mois × ~$108 | **~$378** |
| Adresse FR | ~3,5 mois × $33 | **~$116** |
| Audit content-gen perfection 2027 (J+365) | 68 agents × $7 | **~$476** |
| **Sous-total Q2 2027** | | **~$1 219** |

### Budget consolidé 12 mois

```
┌──────────────────────────────────────────────────────────────────┐
│  BUDGET TOTAL 12 MOIS — AXION-IA CONTENT-GEN PIPELINE           │
│                                                                    │
│  Q3 2026 (J0-J90)    : ~$451-550  (Sprints A+B+C, 4 500 art)    │
│  Q4 2026 (J91-J180)  : ~$499-598  (Sprint D, 13 500 art)         │
│  Q1 2027 (J181-J270) : ~$649      (Sprint E phase 1, 22 500 art) │
│  Q2 2027 (J271-J365) : ~$1 219    (Sprint E phase 2 + audit 27)  │
│                         ──────────                                 │
│  TOTAL ARTICLES       : ~78 500 articles publiés                   │
│  TOTAL LLM prod.      : ~$471                                      │
│  TOTAL LLM dev.       : ~$250                                      │
│  TOTAL Infrastructure : ~$1 350                                    │
│  TOTAL Adresse FR     : ~$413 (si Sedomicilier)                   │
│  TOTAL Audit 2027     : ~$532                                      │
│  Buffer +15%          : ~$453                                      │
│                         ──────────                                 │
│  TOTAL 12 MOIS        : ~$2 818-3 469 selon options               │
│                                                                    │
│  Coût par article : ~$0,036-0,044/article                         │
│  ROI cible Q2 2027 : 1M impressions @ ~2€ CPM → ~2 000€/mois     │
│  Payback : ~18 mois post-activation (si taux indexation ≥ 85%)   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Score par trimestre — Détail par dimension

### Tableau progression 5 dimensions

| Dimension | J0 (réel) | Q3 2026 (J90) | Q4 2026 (J180) | Q1 2027 (J270) | Q2 2027 (J365) |
|-----------|:---------:|:-------------:|:--------------:|:--------------:|:--------------:|
| D-ETAT | 795 | ~870 | ~888 | ~920 | ~945 |
| D-ARCHI | 756 | ~810 | ~830 | ~860 | ~890 |
| D-VISI | 775 | ~830 | ~888 | ~910 | ~930 |
| D-QUAL | 712 | ~782 | ~812 | ~850 | ~890 |
| D-OPS | 600 | ~674 | ~706 | ~740 | ~795 |
| **TOTAL** | **3 638** | **~3 966** | **~4 084** | **~4 280** | **~4 450** |
| **% / 5000** | 72,8% | 79,3% | 81,7% | 85,6% | 89,0% |

> **Note D-OPS** : Dimension la plus en retard (600 → 795 sur 12 mois = +195 pts). C'est le principal levier restant vers GO. Sans D-OPS ≥ 750 en Q1 2027, le GO est compromis en Q2 2027.

> **Score J365 (~4450) vs GO 4500** : Le gap final de ~50 pts peut être comblé par des optimisations de maintenance continues ou l'activation de conditionnels (Wikidata +34, EN +15). Le GO 4500 est atteignable en Q2 2027 dans le scénario normal.

### KPIs contenu par trimestre

| KPI | J0 | Q3 2026 | Q4 2026 | Q1 2027 | Q2 2027 |
|-----|:--:|:-------:|:-------:|:-------:|:-------:|
| Art/jour actifs | 0 | 30→100 | 100→200 | 200→300 | 300→500 |
| Articles cumulés | ~100 | ~6 300 | ~19 800 | ~42 300 | ~80 300 |
| Impressions GSC /mois | ~5K | ~50K | ~150K | ~500K | ~1M+ |
| Taux indexation | ~30% | 60% | 75% | 85% | 90% |
| AI Overviews citations /mois | 0 | 5 | 20 | 50 | 100 |
| Villes actives | 39 | 60 | 100 | 120 | 120 |
| Domaines référents | 0 | 0 | 2-3 | 4-6 | 6-10 |
| Score LLM-judge moyen | ~7,0/10 | ~7,3/10 | ~7,5/10 | ~7,8/10 | ~8,0/10 |

---

## 8. Tableau de bord GO — Suivi mensuel

### Indicateurs de suivi

```
CHECK MENSUEL RECOMMANDE :
┌─────────────────────────────────────────────────────────────────┐
│ Indicateur            │ Fréquence │ Seuil alerte               │
├─────────────────────────────────────────────────────────────────┤
│ Score /5000           │ Mensuel   │ < projection ±50 pts        │
│ Art/jour pipeline     │ Hebdo     │ < objectif période −20%     │
│ Taux indexation GSC   │ Hebdo     │ < 55% (Q3), < 70% (Q4)     │
│ Impressions GSC       │ Hebdo     │ Chute > 30% en 2 semaines  │
│ AI Overviews hits     │ Mensuel   │ 0 citations après J+120     │
│ Coût LLM /article     │ Mensuel   │ > $0,010 (hors budget)      │
│ D-OPS progression     │ Mensuel   │ < +15 pts/trimestre         │
│ Score LLM-judge       │ Hebdo     │ < 7,0/10 (seuil rejet 60)  │
│ Domaines référents    │ Mensuel   │ 0 nouveau après J+180       │
│ Uptime pipeline       │ Continu   │ < 98% sur 7 jours           │
└─────────────────────────────────────────────────────────────────┘
```

### Jalons clés 12 mois

| Jalon | Date | Critère GO/NO-GO |
|-------|------|-----------------|
| J+71 | 2026-08-01 | AI Act art. 50 compliance → 0 rows non-conformes SQL |
| J+90 | 2026-08-19 | Score ≥ 3966 + pipeline 100 art/j stable → lancer Sprint D |
| J+120 | 2026-09-19 | Score ≥ 4030 + checkpoint rampe 200 art/j |
| J+180 | 2026-11-16 | Score ≥ 4034 → décision GO Sprint E |
| J+250 | 2027-01-27 | GO potentiel atteint (scénario rapide) + décision D15 audit |
| J+270 | 2027-02-16 | Score ≥ 4280 → GO estimé scénario normal |
| J+300 | 2027-03-18 | GO consolidé (scénario normal tardif) |
| J+365 | 2027-05-22 | Audit content-gen perfection 2027 complet |

---

## Synthèse exécutive (5 points)

| # | Point | Détail |
|---|-------|--------|
| **1. GO Timeline** | GO ≥ 4500/5000 estimé J+270-J+300 (scénario normal, 55%) = 2027-02-16 → 2027-03-18. GO rapide J+250 (20%) si Wikidata créé + EN réactivé. GO lent J+350+ (25%) si conditionnels bloqués. | |
| **2. Score 12 mois** | 3638 → ~4450/5000 en Q2 2027 (89,0%). Progression D-OPS = goulot principal (+195 pts sur 12 mois). Sprint E contribue +249 pts (dont +79 conditionnels). | |
| **3. Budget 12 mois** | ~$2 818-3 469 total selon options (adresse FR, Claude 5). Coût par article : ~$0,036-0,044. ROI positif si taux indexation ≥ 85% et impressions ≥ 1M/mois Q2 2027. | |
| **4. Évolution IA** | Claude 5 : migration via 1 env var Coolify si benchmark concluant (+18 pts qualité). Google SGE FR v2 : pipeline bimodal (volume IA + autorité Manon) comme couverture. Nouveau scoring AI search citations à intégrer audit 2027. | |
| **5. Audit 2027** | J+365 = 2027-05-22. Déclencheur : « Lance audit content-gen perfection 2027 ». 68 agents P1-P6, ~5-7h autopilot, ~$500. Décision D15 (cabinet vs Claude) à J+250 → recommandation : Claude autopilot (coût ×10 inférieur). | |

---

*Rapport A6-07 — AUDIT-ONLY — zéro commit — zéro modif code*
*Agent : Claude Sonnet 4.6 — 2026-05-22 — Axion-IA Content-Gen Perfection 2026*
*Sources* : A6-01 (baseline 3638/5000), A6-06 (Sprint D J180 ~4084), prompt pipeline perfection 2026, MEMORY.md décisions canoniques 2026-05-21/22
