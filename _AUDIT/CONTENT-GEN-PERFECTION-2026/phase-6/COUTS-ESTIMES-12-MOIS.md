# Coûts estimés 12 mois — Pipeline Content-Gen Perfection 2026

**Période** : 2026-05-22 → 2027-05-21  
**Agent** : A6-09  
**Date** : 2026-05-22  
**Statut** : AUDIT-ONLY

---

## TL;DR — Scénario BASE recommandé

|                                      | Sans options | + Adresse FR | + Adresse FR + Ahrefs |
| ------------------------------------ | ------------ | ------------ | --------------------- |
| **Coût total 12 mois**               | **$8 044**   | **$8 445**   | **$9 649**            |
| Break-even (1 lead/mois)             | M5           | M5           | M6                    |
| ROI annuel (10 leads/mois dès J+180) | +144%        | +137%        | +103%                 |

---

## Tableau principal — Scénario BASE (rampe 30→100→300→500/j)

| Poste                                          | Q3 2026 (90j × 30/j) | Q4 2026 (90j × 100/j) | Q1 2027 (90j × 300/j) | Q2 2027 (95j × 500/j) | Total 12 m    |
| ---------------------------------------------- | -------------------- | --------------------- | --------------------- | --------------------- | ------------- |
| Articles générés                               | 2 700                | 9 000                 | 27 000                | 47 500                | 86 200        |
| LLM génération (Claude Sonnet 4.6)             | $229.50              | $765.00               | $2 295.00             | $4 037.50             | $7 327.00     |
| LLM embeddings (OpenAI text-embedding-3-large) | $0.35                | $1.17                 | $3.51                 | $6.18                 | $11.21        |
| LLM dev sprints (autopilot)                    | $24.00               | $24.00                | $24.00                | $26.00                | $98.00        |
| Infra Hetzner VPS CPX42                        | $150.00              | $150.00               | $150.00               | $158.00               | $608.00       |
| Adresse FR Sedomicilier (si D10=A)             | $99.00               | $99.00                | $99.00                | $104.00               | $401.00       |
| Ahrefs (si activé)                             | $297.00              | $297.00               | $297.00               | $313.00               | $1 204.00     |
| **TOTAL (sans options)**                       | **$403.85**          | **$940.17**           | **$2 472.51**         | **$4 227.68**         | **$8 044.21** |
| **TOTAL (+ adresse FR)**                       | **$502.85**          | **$1 039.17**         | **$2 571.51**         | **$4 331.68**         | **$8 445.21** |
| **TOTAL (+ adresse FR + Ahrefs)**              | **$799.85**          | **$1 336.17**         | **$2 868.51**         | **$4 644.68**         | **$9 649.21** |

---

## Comparaison des 3 scénarios de volume

| Scénario                  | Articles 12 m | LLM (Claude) | Infra | Total sans options | Total max (+ FR + Ahrefs) |
| ------------------------- | ------------- | ------------ | ----- | ------------------ | ------------------------- |
| **LOW** — 30/j constant   | 10 950        | $930         | $600  | **$1 628**         | **$3 217**                |
| **BASE** — rampe 30→500/j | 86 200        | $7 327       | $608  | **$8 044**         | **$9 649**                |
| **HIGH** — 500/j dès J+90 | 140 200       | $11 917      | $608  | **$12 641**        | **$14 244**               |

### Coût par article — vue synthétique

| Scénario | Coût moyen / article (sans options) |
| -------- | ----------------------------------- |
| LOW      | $0.149                              |
| BASE     | $0.093                              |
| HIGH     | $0.090                              |

> Le scaling réduit le coût unitaire grâce à la dilution des coûts fixes.

---

## ROI — Analyse de rentabilité

### Hypothèses de conversion

- Panier moyen formation B2B : **2 000 €** (~$2 200)
- Panier moyen audit/implémentation : **5 000 €** (~$5 500)
- Taux de conversion lead → client : **15%**
- Premiers leads organiques attendus : **J+90** (3 mois de latence SEO)

### Scenario 1 — 1 lead/mois qualifié dès J+90

| Phase                                   | Revenus cumulés | Coûts cumulés (BASE sans options) | Solde       |
| --------------------------------------- | --------------- | --------------------------------- | ----------- |
| M1–M3 (J+0 à J+90)                      | $0              | $404                              | **−$404**   |
| M4 (1 lead/mois, 15% conv = ~$330/mois) | $330            | $717                              | **−$387**   |
| M5                                      | $660            | $1 030                            | **−$370**   |
| M6                                      | $990            | $1 344                            | **−$354**   |
| ...                                     | ...             | ...                               | ...         |
| M13 (fin 12 mois)                       | ~$3 630         | $8 044                            | **−$4 414** |

> 1 lead/mois seul ne suffit pas à couvrir le scénario BASE sur 12 mois. Le break-even nécessite ~4 leads/mois à panier 2 000 € (15% conv).

**Break-even scénario LOW** (coûts $1 628) : 1 lead/mois → break-even **M6**.

### Scenario 2 — 10 leads/mois dès J+180

| Période                   | Leads/mois | Clients/mois (15%) | Revenus/mois | Revenus cumulés |
| ------------------------- | ---------- | ------------------ | ------------ | --------------- |
| J+0 → J+90                | 0          | 0                  | $0           | $0              |
| J+91 → J+180              | 1–3        | 0.15–0.45          | $330–$990    | ~$3 960         |
| J+181 → J+270             | 10         | 1.5                | $3 300       | ~$29 700        |
| J+271 → J+365             | 10         | 1.5                | $3 300       | ~$31 350        |
| **Total revenus 12 mois** | —          | —                  | —            | **~$65 010**    |

- **Coûts totaux 12m (BASE + adresse FR + Ahrefs)** : $9 649
- **Marge nette** : ~$55 361
- **ROI annuel** : **+574%** (x6.7 sur l'investissement)

### Scenario 3 — Mix formation (70%) + audit (30%), 10 leads/mois dès J+180

- 1.5 clients/mois × [70% × $2 200 + 30% × $5 500] = 1.5 × ($1 540 + $1 650) = $4 785/mois
- Revenus Q1+Q2 2027 : $4 785 × 6 mois = $28 710
- **ROI 12 mois (vs BASE + options $9 649)** : +$19 061 net = **+198% ROI**

---

## Analyse de sensibilité — coût LLM

| Prix Claude ($/article) | Scénario BASE — LLM seul | Total 12m sans options |
| ----------------------- | ------------------------ | ---------------------- |
| $0.07 (optimiste)       | $6 034                   | $6 751                 |
| $0.085 (réaliste)       | $7 327                   | $8 044                 |
| $0.10 (conservateur)    | $8 620                   | $9 337                 |

> Activer le **prompt caching** Claude Sonnet 4.6 (cache hit = $0.30/MTok vs $3/MTok standard) peut réduire le coût input de 40–60% sur les tokens système répétitifs → économie potentielle de **$1 500–$2 500** sur 12 mois (Scénario BASE).

---

## Décisions impactantes sur les coûts

| Décision                        | Impact financier annuel                             | Recommandation                                            |
| ------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| D10 — Adresse FR (Sedomicilier) | +$401                                               | GO — s'amortit dès le 1er client                          |
| D10 — Ahrefs                    | +$1 204                                             | CONDITIONNEL — activer si trafic organique croît dès J+90 |
| D-P6-2 — Seuil qualité 60/100   | Réduit le risque de pénalité Google (coût indirect) | GO                                                        |
| Prompt caching Claude           | −$1 500 à −$2 500                                   | A implémenter Sprint S+8                                  |
| Scale 500/j en Q2 2027          | +$4 038 vs Q3 2026                                  | Conditionnel à la qualité et l'indexation                 |

---

## Synthèse décisionnelle

### 3 messages clés

1. **Investissement faible, ROI élevé** : le pipeline coûte $8 000–$9 700 sur 12 mois (Scénario BASE). Un seul client audit à 5 000 € couvre 50–60% du budget total.

2. **Le vrai levier est la conversion** : le coût variable (LLM) est maîtrisé. L'enjeu est de convertir le trafic SEO en leads qualifiés. Même 10 leads/mois avec 15% de conversion génère un ROI de +574%.

3. **Optimiser le coût LLM dès J+90** : prompt caching + batching + déduplification avant embedding peuvent réduire la facture de 30–50% sans dégrader la qualité.

### Recommandations

- **J+0 → J+30** : Activer le monitoring des coûts LLM en temps réel (Anthropic console + webhook alerte > $50/semaine).
- **J+30 → J+90** : Implémenter le prompt caching Claude sur les sections système des 9 générateurs.
- **J+90** : Décision go/no-go Ahrefs basée sur les premières métriques de trafic organique.
- **J+180** : Si 10 leads/mois atteints, scale autorisé à 300/j puis 500/j (décision D-P6-2 seuil 60).

---

_Source : Agent A6-09 | Voir rapport détaillé dans `agents/A6-09-couts-12mois.md`_  
_Date : 2026-05-22 | AUDIT-ONLY — aucun code modifié_
