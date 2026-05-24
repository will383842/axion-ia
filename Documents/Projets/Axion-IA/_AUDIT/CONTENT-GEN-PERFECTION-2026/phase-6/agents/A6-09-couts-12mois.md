# A6-09 — Estimation coûts 12 mois pipeline content-gen AxionIA
**Agent:** A6-09 | **Date:** 2026-05-22 | **Horizon:** 2026-05-22 → 2027-05-22
**Mode:** AUDIT-ONLY — zéro commit, zéro modification code
**Société:** Axion-IA (société française pure, pas OÜ)
**Revision:** v2 — mise à jour volume rampe D-W1 (79 400 articles/an)

---

## 1. Hypothèses de calcul

| Paramètre | Valeur | Source |
|-----------|--------|--------|
| Coût Claude Sonnet 4.6 input | $3 / Mtokens | Anthropic pricing 2026-05 |
| Coût Claude Sonnet 4.6 output | $15 / Mtokens | Anthropic pricing 2026-05 |
| Tokens input / article | ~4 000 | Mesure pipeline |
| Tokens output / article | ~2 000 | Mesure pipeline |
| Coût brut / article | $0.042 + $0.030 = $0.072 | Calcul direct |
| Coût all-in / article (incl. reviewers + embeddings + overhead) | **$0.10** | PROMPT-MASTER §2.3 |
| OpenAI text-embedding-3-large | $0.130 / Mtokens | OpenAI pricing 2026-05 |
| Tokens embedding / article | ~500 | Mesure pipeline |
| Coût embedding / article | $0.000065 | Calcul direct |
| Infra Hetzner CPX42 | ~$56 / mois | Hetzner 2026 |
| Adresse FR domiciliation (D10 = A) | ~€30 / mois → ~$33 | Sedomicilier.fr |
| Ahrefs (optionnel) | $99 / mois | Ahrefs standard |
| GH Actions builds | ~100 min/build × 4 builds/mois × $0.008/min | GH pricing |
| GHCR storage | ~$5 / mois | GH pricing public repo |
| USD / EUR | 1.10 | Taux référence |

---

## 2. Volume articles par trimestre — rampe D-W1

| Période | Art/jour | Durée | Articles | Cumulé |
|---------|----------|-------|----------|--------|
| Q3 2026 (J0–J90) | 30 → 100 (moy. ~60) | 90 j | **~5 400** | 5 400 |
| Q4 2026 (J91–J180) | 100 → 200 (moy. ~150) | 90 j | **~13 500** | 18 900 |
| Q1 2027 (J181–J270) | 200 → 300 (moy. ~250) | 90 j | **~22 500** | 41 400 |
| Q2 2027 (J271–J365) | 300 → 500 (moy. ~400) | 95 j | **~38 000** | 79 400 |
| **TOTAL 12 mois** | | | **~79 400** | |

---

## 3. Tableau coûts complets — 3 scénarios

### Scénario BASE (adresse FR, sans Ahrefs) — RECOMMANDÉ

| Poste | Q3 2026 | Q4 2026 | Q1 2027 | Q2 2027 | **TOTAL 12m** |
|-------|--------:|--------:|--------:|--------:|--------------:|
| LLM Claude — génération ($0.10/art) | $540 | $1 350 | $2 250 | $3 800 | **$7 940** |
| OpenAI embeddings ($0.000065/art) | $0.35 | $0.88 | $1.46 | $2.47 | **$5** |
| Infra Hetzner CPX42 | $168 | $168 | $168 | $168 | **$672** |
| GitHub Actions (~4 builds/mois) | $3 | $3 | $3 | $3 | **$13** |
| GHCR storage | $15 | $15 | $15 | $15 | **$60** |
| Coolify (self-hosted) | $0 | $0 | $0 | $0 | **$0** |
| Postgres + Redis (inclus VPS) | $0 | $0 | $0 | $0 | **$0** |
| Adresse FR Sedomicilier (D10 = A) | $99 | $99 | $99 | $99 | **$396** |
| **TOTAL SCÉNARIO BASE** | **$825** | **$1 636** | **$2 537** | **$4 087** | **$9 086** |

### Scénario LEAN (sans adresse FR)

| Poste | Q3 2026 | Q4 2026 | Q1 2027 | Q2 2027 | **TOTAL 12m** |
|-------|--------:|--------:|--------:|--------:|--------------:|
| LLM Claude — génération | $540 | $1 350 | $2 250 | $3 800 | **$7 940** |
| OpenAI embeddings | $1 | $1 | $1 | $2 | **$5** |
| Infra Hetzner + GH + GHCR | $186 | $186 | $186 | $186 | **$745** |
| **TOTAL SCÉNARIO LEAN** | **$727** | **$1 537** | **$2 437** | **$3 988** | **$8 689** |

### Scénario PREMIUM (adresse FR + Ahrefs)

| Poste | Q3 2026 | Q4 2026 | Q1 2027 | Q2 2027 | **TOTAL 12m** |
|-------|--------:|--------:|--------:|--------:|--------------:|
| LLM Claude — génération | $540 | $1 350 | $2 250 | $3 800 | **$7 940** |
| OpenAI embeddings | $1 | $1 | $1 | $2 | **$5** |
| Infra Hetzner + GH + GHCR | $186 | $186 | $186 | $186 | **$745** |
| Adresse FR Sedomicilier | $99 | $99 | $99 | $99 | **$396** |
| Ahrefs ($99/mois) | $0 | $297 | $297 | $297 | **$891** |
| **TOTAL SCÉNARIO PREMIUM** | **$826** | **$1 933** | **$2 833** | **$4 384** | **$9 977** |

### Comparatif synthétique

| Scénario | Articles/an | TOTAL USD | TOTAL EUR (~1.10) | Coût/article all-in |
|----------|------------:|----------:|------------------:|--------------------:|
| LEAN (sans adresse FR) | 79 400 | **$8 689** | **~€7 899** | $0.109 |
| **BASE (avec adresse FR)** | **79 400** | **$9 086** | **~€8 260** | **$0.114** |
| PREMIUM (adresse + Ahrefs) | 79 400 | **$9 977** | **~€9 070** | $0.126 |

---

## 4. Coût par article publié — surveillance dérive

| Période | Articles | Coût trimestre | Coût/article (BASE) | Tendance |
|---------|--------:|--------------:|--------------------:|---------|
| Q3 2026 | 5 400 | $825 | **$0.153** | Référence (overhead dilué) |
| Q4 2026 | 13 500 | $1 636 | **$0.121** | -21 % ✅ |
| Q1 2027 | 22 500 | $2 537 | **$0.113** | -7 % ✅ |
| Q2 2027 | 38 000 | $4 087 | **$0.108** | -4 % ✅ économies d'échelle |

### Seuils d'alerte dérive coût/article

| Seuil | Valeur | Action |
|-------|--------|--------|
| WARNING | > $0.20/article | Auditer taux rejet LLM-judge (> 25 %) |
| ALERT | > $0.25/article | Suspendre scale-up, réviser prompts |
| STOP | > $0.35/article | STOP & ASK Will — bug pipeline ou pricing Anthropic changé |

**Cause principale de dérive :** taux de rejet LLM-judge élevé. Si le taux passe de 15 % → 40 %, le coût/article monte de ~$0.10 → ~$0.135 (+35 %).

---

## 5. Caps Anthropic recommandés par phase

| Phase | Période | Art/j max | Cap mensuel reco | Seuil alerte (80 %) |
|-------|---------|-----------|-----------------|---------------------|
| Phase 0 — Lancement | J0–J30 | 30 | **$200** | $160 |
| Phase 1 — Rampe douce | J31–J90 | 100 | **$500** | $400 |
| Phase 2 — Scale modéré | J91–J180 | 200 | **$1 000** | $800 |
| Phase 3 — Régime croisière | J181–J270 | 300 | **$1 500** | $1 200 |
| Phase 4 — Scale agressif | J271–J365 | 500 | **$2 500–$5 000** | $2 000–$4 000 |

**D12 :** upgrade cap à $1 500 avant scale > 100/j (~J+30). Décision Will uniquement pour Phase 4+.

---

## 6. Break-even ROI

### Hypothèses ROI

| Paramètre | Valeur |
|-----------|--------|
| Valeur moyenne client B2B | €2 000–€15 000 / mission |
| Panier retenu (conservateur) | **€5 000** |
| Taux conversion visite → lead | 0.5 % |
| Taux conversion lead → client | 15 % |

### Seuil de rentabilité — Scénario BASE ($9 086/an)

- **Break-even hard :** $9 086 / $5 000 ≈ **2 clients convertis/an** = **0.17 client/mois**
- **Break-even soft (panier €2 000) :** ≈ **5 clients/an**
- **Cible réaliste :** 4 leads B2B/mois dès Q3 → ROI positif dès J+90

### Modèle ROI simplifié (taux conversion 0.3 %)

| Période | Clics organiques est. | Leads (0.3 %) | Clients (15 %) | CA brut (€5K) | Coût (BASE) | ROI |
|---------|----------------------:|-------------:|--------------:|--------------:|------------:|----:|
| Q3 2026 | 5 000 | 15 | 2 | €10 000 | $825 (~€750) | **+€9 250** |
| Q4 2026 | 50 000 | 150 | 23 | €115 000 | $1 636 (~€1 487) | **+€113 513** |
| Q1 2027 | 120 000 | 360 | 54 | €270 000 | $2 537 (~€2 307) | **+€267 693** |
| Q2 2027 | 200 000 | 600 | 90 | €450 000 | $4 087 (~€3 716) | **+€446 284** |
| **TOTAL 12m** | **375 000** | **1 125** | **169** | **€845 000** | **$9 086 (~€8 260)** | **+€836 740** |

### Modèle ROI pessimiste (taux conversion 0.05 %)

| Période | Leads (0.05 %) | Clients (15 %) | CA brut | Coût (BASE) | ROI |
|---------|---------------:|--------------:|--------:|------------:|----:|
| Q3 2026 | 3 | 0 | €0 | €750 | **-€750** |
| Q4 2026 | 25 | 4 | €20 000 | €1 487 | **+€18 513** |
| Q1 2027 | 60 | 9 | €45 000 | €2 307 | **+€42 693** |
| Q2 2027 | 100 | 15 | €75 000 | €3 716 | **+€71 284** |
| **TOTAL 12m** | **188** | **28** | **€140 000** | **€8 260** | **+€131 740** |

**Conclusion :** même dans le scénario pessimiste, le pipeline est ROI-positif dès Q4 2026.

---

## 7. Risques budgétaires

| # | Risque | Impact | Probabilité | Mitigation |
|---|--------|--------|-------------|------------|
| R1 | Taux rejet LLM-judge > 25 % | +$1 500/an | Moyen | Révision prompts judge mensuelle |
| R2 | Scale > 200 art/j → upgrade CPX62 | +$180/an | Moyen | Prévu dans scénario HIGH |
| R3 | Pricing Anthropic hausse | Variable | Faible | Surveiller anthropic.com/pricing |
| R4 | GH Actions free tier dépassé | +$600/an | Faible | OK si ≤ 3 deploys/semaine |
| R5 | Adresse FR D10 non activée | -$396 économie | N/A | Décision Will |
| R6 | Ahrefs D15 activé | +$891/an | Faible | ROI backlinks à mesurer avant |

---

## 8. Recommandation finale

**Scénario BASE recommandé :** $9 086 / 12 mois avec adresse FR, sans Ahrefs.

- LLM : $7 940 (~87 % du budget) — variable strictement proportionnel au volume
- Infra : $745 fixe/an — à absorber sur 79 400 articles
- Adresse FR : $396/an — investissement légitimité locale SEO justifié
- Ahrefs : différer à Q4 2026 quand trafic organique > 10 000 clics/mois

**Cap initial : $500/mois** pour les 60 premiers jours → permet ~4 000-5 000 articles/mois en sécurité.

---

*Rapport A6-09 v2 — Agent estimation coûts 12 mois — Pipeline content-gen perfection AxionIA 2026*
*AUDIT-ONLY — aucun code modifié — aucun commit*
