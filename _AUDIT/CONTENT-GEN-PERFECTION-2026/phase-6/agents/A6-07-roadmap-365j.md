# ROADMAP 365J — Vision 12 mois (J181-J365)

## Date : 2026-05-22 | Score entrant : ~4251/5000 | Score sortant estimé : ~4500-4650/5000

---

### Objectif vision

Le second semestre est celui de l'atteinte du **GO ≥ 4500** (estimé J250-J270), de la scale
maximale 500 art/j, de l'audit perfection 2027 (mai 2027), et de l'évaluation migration Claude 5
si disponible.

Gain cible : **+250 à +400 pts** pour franchir le seuil GO 4500 et viser 4600-4650/5000 fin J365.

---

### Jalons clés

| Jalon                    | Date estimée                         | Condition                          |
| ------------------------ | ------------------------------------ | ---------------------------------- |
| **GO 4500 atteint**      | J250-J270 (~2027-01-27 à 2027-02-16) | Trajectoire J91 confirmée          |
| Scale 500 art/j activée  | J270-J300                            | Infra stable 300/j + budget validé |
| Audit perfection 2027    | J365 (~2027-05-22)                   | Annual review                      |
| Migration Claude 5       | J200-J300 (si disponible)            | Anthropic roadmap                  |
| Backlinks trimestriel #2 | J180-J270                            | Suite backlinks #1                 |
| Backlinks trimestriel #3 | J270-J365                            | Maturité domaine                   |

---

### Items inclus

| #   | Item                                                | Dimension | Effort Claude | Effort Will | Gain pts    | Coût $               | Dépendances              |
| --- | --------------------------------------------------- | --------- | ------------- | ----------- | ----------- | -------------------- | ------------------------ |
| A   | Scale 300→500 art/j (config progressive)            | D-Etat    | 2h            | 1h          | +30         | $4 500/trimestre     | Scale 300/j stable       |
| B   | Migration Claude 5 (si disponible)                  | D-Qual    | 8h            | 2h          | +25         | ~$0 (coût par token) | Anthropic disponibilité  |
| C   | Backlinks trimestriel #2 (Q1 2027)                  | D-Visi    | 8h            | 5h          | +15         | ~$0                  | Backlinks #1 en cours    |
| D   | Backlinks trimestriel #3 (Q2 2027)                  | D-Visi    | 8h            | 5h          | +15         | ~$0                  | Backlinks #2             |
| E   | Audit qualité #4 (500 articles, LLM-judge)          | D-Qual    | 8h            | 1h          | +25         | ~$50                 | 10 000+ articles publiés |
| F   | Optimisation prompts post-audit #4                  | D-Qual    | 8h            | 1h          | +20         | ~$0                  | Audit #4                 |
| G   | GBP premium features (Q&A automatisés, produits)    | D-Visi    | 4h            | 2h          | +10         | ~$0                  | GBP actif 6+ mois        |
| H   | Audit content-gen perfection 2027 (25 agents //)    | Toutes    | 8h            | 3h          | +0 (mesure) | ~$20                 | J365                     |
| I   | Pages AMP ou ISR agressif pour mobile speed         | D-Visi    | 10h           | 1h          | +15         | ~$0                  | Web Vitals stables       |
| J   | Intégration GSC SearchAnalytics → dashboard interne | D-Visi    | 6h            | 30 min      | +20         | ~$0                  | GSC service account      |
| K   | Auto-refresh prompts (drift détection automatique)  | D-Qual    | 8h            | 1h          | +15         | ~$5/mois             | LLM-judge opérationnel   |
| L   | Entity graph (Knowledge Graph local)                | D-Archi   | 12h           | 2h          | +20         | ~$0                  | KB 4 verticales          |
| M   | Bilingue EN (si D14=oui et non livré J121-J150)     | D-Etat    | 30h           | 4h          | +15         | ~$30 dev             | Bug next-intl fixé       |

---

### Planning par trimestre

#### Trimestre Q3 2026 (J181-J270) — GO et scale 300→500

**J181-J210 : Accélération D-Visi**

- **J181-J190** : Backlinks trimestriel #2 (item C) — relance Q1 2027
  - Suivi backlinks #1 : compter domaines référents gagnés
  - Nouvelles cibles : podcasts IA FR + newsletters sectorielles
  - Claude rédige 5 articles guest posts supplémentaires

- **J191-J205** : GSC SearchAnalytics → dashboard interne (item J)
  - API GSC : impressions, clicks, CTR, position moyenne par URL
  - Dashboard admin onglet "Performance SEO" temps réel (hebdo)
  - Alertes : si CTR < 1% sur page stratégique → alerte révision contenu

- **J206-J210** : GBP premium features (item G)
  - Q&A GBP : 20 questions/réponses courantes pré-remplies
  - Produits GBP : 4 verticales listées avec prix indicatifs

Sous-total J181-J210 : **+45 pts** (D-Visi +40, D-Ops +5)

**J211-J245 : Scale 500/j + Migration Claude 5**

- **J211-J225** : Migration Claude 5 (item B) — si Anthropic annonce disponibilité
  - Évaluation : benchmark qualité Claude 5 vs Claude Sonnet 4.6 sur 50 articles test
  - Si qualité >= +5% à coût <= +20% : migration go
  - Mise à jour `MODEL_ID` dans générateurs + tests regression vitest
  - Gain qualité estimé : **+25 pts D-Qual**

- **J226-J245** : Scale 300→500 art/j (item A)
  - Config MAX_PUBLISH progressif : 300→350→400→450→500 sur 4 semaines
  - BullMQ workers : 5 processeurs publish parallèles
  - Infra : évaluation upgrade VPS si RAM > 80% peak
  - Budget : $4 500/trimestre (45k articles × $0.10)

Sous-total J211-J245 : **+55 pts** (D-Etat +30, D-Qual +25)

**J246-J270 : GO 4500 — Gate décision**

À J250 (estimé) : score projeté ~4500.

Audit flash 10 agents (3h Claude) pour confirmer le score réel.

| Score J250 | Verdict        | Action                             |
| ---------- | -------------- | ---------------------------------- |
| >= 4500    | **GO ATTEINT** | Annoncer + continuer scale         |
| 4400-4499  | GO J270        | Finaliser items E-F                |
| < 4400     | Écart résiduel | STOP & ASK Will — sprint correctif |

Sous-total J246-J270 : **+30 pts** (D-Archi +20 entity graph partiel, D-Qual +10)

#### Trimestre Q4 2026-Q1 2027 (J271-J365) — Perfection et audit annuel

**J271-J310 : Qualité perfection**

- **J271-J285** : Audit qualité #4 (item E) — 500 articles LLM-judge
  - Score moyen cible : > 80/100
  - Rapport détaillé par type de contenu (blog / landing / FAQ / comparison)
  - Identification top 10% articles (à booster) + bottom 10% (à réviser ou dépublier)

- **J286-J300** : Optimisation prompts post-audit #4 (item F)
  - Mise à jour partials verticaux + générateurs sous-performants
  - Auto-refresh prompts : système de drift détection (item K)
    - LLM-judge score rolling 7j : si baisse > 5 pts → alerte + régénération prompt

- **J301-J310** : Entity graph (item L)
  - Graphe JSON-LD interne : liens entité-article-sujet
  - Enrichissement structured data `isPartOf`, `mentions`, `about`

Sous-total J271-J310 : **+60 pts** (D-Qual +45, D-Archi +20)

**J311-J355 : Backlinks #3 + Mobile + ISR**

- **J311-J325** : Backlinks trimestriel #3 (item D)
  - Bilan 6 mois backlinks : domaines référents gagnés, DA/DR évolution
  - Nouvelles cibles : publications académiques IA + instituts formation

- **J326-J340** : ISR agressif pour mobile speed (item I)
  - Audit Web Vitals mobile 15 pages stratégiques
  - ISR `revalidate=1800` sur landing villes + blog piliers
  - Si LCP mobile > 2000ms : lazy images + font subsetting

- **J341-J355** : Bilingue EN sprint S+7 (item M) — si non livré J121-J150

Sous-total J311-J355 : **+60 pts** (D-Visi +15, D-Etat +15, D-Ops +15, D-Qual +15)

**J356-J365 : Audit Perfection 2027**

- Audit content-gen perfection 2027 (item H) — 25 agents parallèles
- Score toutes dimensions mesuré
- Rapport final `_AUDIT/CONTENT-GEN-PERFECTION-2027-ANNUEL.md`
- Roadmap 2027-2028 élaborée

---

### Coût total vision 12 mois (J181-J365)

| Poste                                                       | Montant           |
| ----------------------------------------------------------- | ----------------- |
| Tokens Claude (dev / audits / backlinks / prompts)          | ~$100-150         |
| Génération articles 500 art/j × 90j Q4 = 45k articles       | ~$4 500           |
| Génération articles 300 art/j × 90j Q3 (déjà dans J91-J180) | (inclus J91-J180) |
| Audit qualité #4 LLM-judge 500 articles                     | ~$50              |
| Auto-refresh prompts LLM-judge rolling                      | ~$60/an           |
| Audit perfection 2027 25 agents                             | ~$20              |
| Infra upgrade VPS si nécessaire (CPX52 delta)               | ~$0-360/an        |
| **Total J181-J365**                                         | **~$4 730-5 140** |

---

### Score estimé post-vision 12 mois

| Dimension | J180      | J365      | Delta J181-J365                          |
| --------- | --------- | --------- | ---------------------------------------- |
| D-Etat    | ~838      | ~898      | +60 (scale 500/j + EN)                   |
| D-Archi   | ~836      | ~876      | +40 (entity graph + drift detection)     |
| D-Visi    | ~897      | ~957      | +60 (backlinks ×2 + GBP + GSC dashboard) |
| D-Qual    | ~904      | ~984      | +80 (Claude 5 + audits + prompts)        |
| D-Ops     | ~776      | ~836      | +60 (ISR + CampaignTemplate + rapports)  |
| **TOTAL** | **~4251** | **~4551** | **+300**                                 |

> Fourchette optimiste (Claude 5 disponible, backlinks excellents, EN livré) : **~4650/5000**
> Fourchette conservatrice (Claude 5 indispo, backlinks lents) : **~4450/5000**

---

### KPIs cibles 12 mois (J365 = 2027-05-22)

#### Volume et génération

| KPI                           | Valeur cible   |
| ----------------------------- | -------------- |
| Articles publiés total        | ~60 000-80 000 |
| Cadence journalière           | 500 art/j      |
| Score qualité moyen LLM-judge | > 80/100       |
| Taux erreurs workers          | < 2%           |

#### SEO et visibilité

| KPI                          | Valeur cible |
| ---------------------------- | ------------ |
| Impressions GSC mensuelles   | > 500 000    |
| Clicks organiques mensuels   | > 15 000     |
| Position moyenne GSC         | < 25         |
| Domaines référents           | > 50         |
| GBP vues fiche mensuelle     | > 1 000      |
| Featured Snippets position 0 | > 20 URLs    |

#### Opérationnel

| KPI                             | Valeur cible        |
| ------------------------------- | ------------------- |
| Score pipeline content-gen      | >= 4 500/5 000 (GO) |
| Temps moyen publication article | < 90s               |
| Taux succès BullMQ              | > 98%               |
| Coût tokens / article           | < $0.12             |

#### Conformité

| KPI                       | Valeur cible         |
| ------------------------- | -------------------- |
| AI Act art. 50 compliance | 100% articles tagués |
| RGPD droit à l'effacement | Endpoint actif       |
| Mentions légales IA       | A jour               |

---

### Scénario GO J250 — Calcul détaillé

Pour atteindre GO 4500 à J250, voici la trajectoire point par point :

| Jalon                | Score estimé |
| -------------------- | ------------ |
| J0 (2026-05-22)      | ~3715        |
| J30 (Sprint A)       | ~3840        |
| J60 (Sprint B)       | ~3960        |
| J90 (Sprint C)       | ~4049        |
| J180 (Sprint D)      | ~4251        |
| **J250 (GO estimé)** | **~4500**    |
| J365 (Vision 12m)    | ~4551-4650   |

Écart J180→J250 à combler : **~249 pts en 70 jours**

- Scale 500/j : +30 pts D-Etat
- Migration Claude 5 : +25 pts D-Qual
- Backlinks #2 : +15 pts D-Visi
- GSC dashboard : +20 pts D-Visi
- Audit qualité #4 partiel : +15 pts D-Qual
- Entity graph partiel : +10 pts D-Archi
- GBP premium : +10 pts D-Visi
- Optimisation continue : +124 pts (D-Ops + D-Qual compounding)

**Total J180→J250 = ~249 pts** — GO 4500 atteint J250 dans scénario médian.

---

### Risques vision 12 mois

| Risque                                   | Probabilité | Impact         | Mitigation                                            |
| ---------------------------------------- | ----------- | -------------- | ----------------------------------------------------- |
| Claude 5 non disponible avant J300       | Moyenne     | -25 pts D-Qual | Optimiser Sonnet 4.6 via prompts (item K)             |
| Google SGE remplace Featured Snippets    | Moyenne     | -30 pts D-Visi | Pivoter vers AEO / GEO / IA Overviews                 |
| Coût tokens 500/j dépasse $15k/an        | Faible      | Budget         | Stop-loss $1200/mois, optimiser prompts               |
| Backlinks très lents (6+ mois impact DA) | Haute       | -30 pts D-Visi | Normal SEO long-terme — prévoir J270 pour mesurer     |
| Regulation EU 2027 (AI Act extension)    | Faible      | Inconnu        | Veille trimestrielle + audit compliance automatique   |
| VPS CPX42 insuffisant à 500/j            | Moyenne     | -20 pts D-Ops  | Upgrade CPX52 (~$40/mois delta) ou workers distribués |
| Score GO non atteint J250                | Faible      | Déception      | Sprint correctif J251-J270 ciblé (STOP & ASK Will)    |

---

### Dépendances critiques vision

```
Sprint D (J91-J180)
  └─ Rampe 300/j stable → Scale 500/j (item A)
  └─ Audit intermédiaire J91 → Trajectoire GO confirmée
  └─ GBP actif 6+ mois → GBP premium (item G)
  └─ Backlinks #1 → Backlinks #2 (item C)

Décisions externes
  └─ Anthropic Claude 5 → Migration (item B)
  └─ D14 (Will) → Bilingue EN (item M)
  └─ Adresse FR → GBP (déjà J61-J90)
```
