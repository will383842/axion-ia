# COÛTS ESTIMÉS 12 MOIS — Content-Gen Perfection 2026
## Baselines 2026-05-22 | Projections 2027-05-22
**Revision v2 — rampe D-W1 : 79 400 articles/an | $0.10/article Claude Sonnet 4.6**

---

## VOLUME — RAMPE D-W1

| Période | Art/jour | Durée | Articles | Cumulé |
|---------|----------|-------|----------|--------|
| Q3 2026 (J0–J90) | 30 → 100 (moy. ~60) | 90 j | ~5 400 | 5 400 |
| Q4 2026 (J91–J180) | 100 → 200 (moy. ~150) | 90 j | ~13 500 | 18 900 |
| Q1 2027 (J181–J270) | 200 → 300 (moy. ~250) | 90 j | ~22 500 | 41 400 |
| Q2 2027 (J271–J365) | 300 → 500 (moy. ~400) | 95 j | ~38 000 | 79 400 |
| **TOTAL 12 mois** | | | **~79 400** | |

---

## SCÉNARIO BASE — RECOMMANDÉ (adresse FR, sans Ahrefs)

| Poste | Q3 2026 | Q4 2026 | Q1 2027 | Q2 2027 | **TOTAL 12m** | Notes |
|-------|--------:|--------:|--------:|--------:|--------------:|-------|
| LLM Claude Sonnet 4.6 (génération) | $540 | $1 350 | $2 250 | $3 800 | **$7 940** | $0.10/art incl. reviewers + overhead |
| OpenAI text-embedding-3-large | $0.35 | $0.88 | $1.46 | $2.47 | **$5** | ~$0.000065/art — négligeable |
| Infra Hetzner CPX42 (~$56/mois) | $168 | $168 | $168 | $168 | **$672** | VPS existant |
| GitHub Actions builds | $3 | $3 | $3 | $3 | **$13** | ~100 min × 4 builds/mois × $0.008/min |
| GHCR storage (~$5/mois) | $15 | $15 | $15 | $15 | **$60** | Images Docker public repo |
| Coolify (self-hosted) | $0 | $0 | $0 | $0 | **$0** | Open source |
| Postgres + Redis | $0 | $0 | $0 | $0 | **$0** | Inclus dans VPS |
| Adresse FR Sedomicilier (~€30/mois) | $99 | $99 | $99 | $99 | **$396** | D10 = A — légitimité SEO local |
| **TOTAL SCÉNARIO BASE** | **$825** | **$1 636** | **$2 537** | **$4 087** | **$9 086** | |

---

## SCÉNARIO LEAN (sans adresse FR)

| Poste | Q3 2026 | Q4 2026 | Q1 2027 | Q2 2027 | **TOTAL 12m** |
|-------|--------:|--------:|--------:|--------:|--------------:|
| LLM Claude (génération) | $540 | $1 350 | $2 250 | $3 800 | **$7 940** |
| OpenAI embeddings | $1 | $1 | $1 | $2 | **$5** |
| Infra Hetzner + GH + GHCR | $186 | $186 | $186 | $186 | **$745** |
| **TOTAL SCÉNARIO LEAN** | **$727** | **$1 537** | **$2 437** | **$3 988** | **$8 689** |

---

## SCÉNARIO PREMIUM (adresse FR + Ahrefs)

| Poste | Q3 2026 | Q4 2026 | Q1 2027 | Q2 2027 | **TOTAL 12m** |
|-------|--------:|--------:|--------:|--------:|--------------:|
| LLM Claude (génération) | $540 | $1 350 | $2 250 | $3 800 | **$7 940** |
| OpenAI embeddings | $1 | $1 | $1 | $2 | **$5** |
| Infra Hetzner + GH + GHCR | $186 | $186 | $186 | $186 | **$745** |
| Adresse FR Sedomicilier | $99 | $99 | $99 | $99 | **$396** |
| Ahrefs ($99/mois — activé Q4) | $0 | $297 | $297 | $297 | **$891** |
| **TOTAL SCÉNARIO PREMIUM** | **$826** | **$1 933** | **$2 833** | **$4 384** | **$9 977** |

---

## COMPARATIF SYNTHÉTIQUE 3 SCÉNARIOS

| Scénario | Articles/an | TOTAL USD | TOTAL EUR | Coût/article all-in |
|----------|------------:|----------:|----------:|--------------------:|
| LEAN (sans adresse FR) | 79 400 | $8 689 | ~€7 899 | $0.109 |
| **BASE (avec adresse FR) ← RECO** | **79 400** | **$9 086** | **~€8 260** | **$0.114** |
| PREMIUM (adresse + Ahrefs) | 79 400 | $9 977 | ~€9 070 | $0.126 |

---

## COÛT PAR ARTICLE PUBLIÉ — TENDANCE

| Période | Articles | Coût (BASE) | Coût/article | Tendance |
|---------|--------:|-----------:|-------------:|---------|
| Q3 2026 | 5 400 | $825 | **$0.153** | Référence (overhead fort) |
| Q4 2026 | 13 500 | $1 636 | **$0.121** | -21 % ✅ |
| Q1 2027 | 22 500 | $2 537 | **$0.113** | -7 % ✅ |
| Q2 2027 | 38 000 | $4 087 | **$0.108** | -4 % ✅ |

Seuils d'alerte :

- WARNING > $0.20/article — auditer taux rejet LLM-judge
- ALERT > $0.25/article — suspendre scale-up
- STOP > $0.35/article — STOP & ASK Will

---

## CAPS ANTHROPIC RECOMMANDÉS

| Phase | Période | Art/j max | Cap mensuel | Seuil alerte (80 %) |
|-------|---------|-----------|-------------|---------------------|
| Phase 0 — Lancement | J0–J30 | 30 | **$200** | $160 |
| Phase 1 — Rampe douce | J31–J90 | 100 | **$500** | $400 |
| Phase 2 — Scale modéré | J91–J180 | 200 | **$1 000** | $800 |
| Phase 3 — Régime croisière | J181–J270 | 300 | **$1 500** | $1 200 |
| Phase 4 — Scale agressif (D12) | J271–J365 | 500 | **$2 500–$5 000** | $2 000–$4 000 |

**Cap initial recommandé : $500/mois** pour J0–J60 (≈ 4 000–5 000 articles/mois sans risque de facture surprise).

---

## BREAK-EVEN ROI

**Axion-IA = services B2B IA** (Interventions + Audit + Implémentations + 1-to-1 + Web & Digital IA)

| Paramètre | Valeur |
|-----------|--------|
| Panier moyen client B2B (conservateur) | €5 000 / mission |
| Break-even LEAN | $8 689 / €5 000 ≈ **2 clients/an** |
| Break-even BASE | $9 086 / €5 000 ≈ **2 clients/an** |
| Break-even PREMIUM | $9 977 / €5 000 ≈ **2 clients/an** |
| Break-even panier minimal (€2 000) | ≈ **5 clients/an** = 0.4 client/mois |
| Cible Q3 | 4 leads qualifiés/mois → ROI positif dès J+90 |

### Modèle ROI conservateur (conversion 0.3 %)

| Période | Clics org. est. | Leads (0.3 %) | Clients (15 %) | CA brut (€5K) | Coût BASE | ROI |
|---------|----------------:|-------------:|--------------:|-------------:|---------:|----:|
| Q3 2026 | 5 000 | 15 | 2 | €10 000 | ~€750 | **+€9 250** |
| Q4 2026 | 50 000 | 150 | 23 | €115 000 | ~€1 487 | **+€113 513** |
| Q1 2027 | 120 000 | 360 | 54 | €270 000 | ~€2 307 | **+€267 693** |
| Q2 2027 | 200 000 | 600 | 90 | €450 000 | ~€3 716 | **+€446 284** |
| **TOTAL** | **375 000** | **1 125** | **169** | **€845 000** | **~€8 260** | **+€836 740** |

### Modèle ROI pessimiste (conversion 0.05 %)

| Période | Leads | Clients | CA brut | Coût BASE | ROI |
|---------|------:|--------:|--------:|---------:|----:|
| Q3 2026 | 3 | 0 | €0 | ~€750 | **-€750** |
| Q4 2026 | 25 | 4 | €20 000 | ~€1 487 | **+€18 513** |
| Q1 2027 | 60 | 9 | €45 000 | ~€2 307 | **+€42 693** |
| Q2 2027 | 100 | 15 | €75 000 | ~€3 716 | **+€71 284** |
| **TOTAL** | **188** | **28** | **€140 000** | **~€8 260** | **+€131 740** |

**Conclusion :** ROI positif dès Q4 2026 même en scénario pessimiste. Le pipeline est auto-financé par 2 clients B2B convertis dans l'année.

---

## RECOMMANDATION CLAUDE — SCÉNARIO BASE

Le scénario BASE à **$9 086/an** est la bonne option pour les raisons suivantes :

1. **LLM ($7 940 = 87 % du budget)** est strictement proportionnel au volume — zéro gaspillage, coût s'arrête si le pipeline s'arrête.
2. **Adresse FR ($396/an)** : ROI justifié — Local SEO + légitimité B2B française essentielle pour les 5 verticales d'Axion-IA. Décision D10 = A recommandée.
3. **Ahrefs ($891/an)** : différer à Q4 2026 quand trafic organique dépasse 10 000 clics/mois et que la valeur des données backlink devient mesurable.
4. **Infra ($745/an fixe)** : déjà existante, coût marginal réel = $0.
5. **Break-even à 2 clients** : seuil extrêmement bas pour du B2B IA à €5K/mission — le risque budgétaire est quasi-nul.

**Actions immédiates :**
- Configurer cap Anthropic à **$500/mois** (J0)
- Upgrader à **$1 500/mois** avant J+30 si rampe 100/j validée (D12)
- Activer alerte email Anthropic à **80 % du cap** mensuel
- Surveiller coût/article rolling 7j dans dashboard admin content-gen

---

*Document principal COUTS-ESTIMES-12-MOIS.md — v2 2026-05-22*
*Source : Agent A6-09 | Pipeline content-gen perfection AxionIA 2026*
*AUDIT-ONLY — aucun code modifié*
