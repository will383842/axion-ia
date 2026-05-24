# SYNTHÈSE ADDENDUM P1 — 3 mini-audits A02 + A12 + A13

> **Mode** : AUDIT-ONLY strict (zéro commit, zéro modification)
> **Date** : 2026-05-21
> **HEAD audité** : `37ca0147` (origin/main)
> **Baseline P1.5** : score ~770-820/1000, Vitest 1376/1383
> **Méthode** : 3 sous-agents Explore parallèles + synthèse main

---

## 🎯 Verdict global addendum : **46/95 (48 %)** — 🟠 SPRINT CORRECTIF

| Agent | Score | % | Statut |
|---|---|---|---|
| A02-Add Flows par type | **15/35** | 43 % | 🟠 |
| A12-Add UX simplicité admin V2 | **17/30** | 57 % | 🟠 |
| A13-Add Programmation campagnes | **14/30** | 47 % | 🟠 |
| **TOTAL Addendum** | **46/95** | **48 %** | **🟠** |

---

## Intégration avec score parent P1

Le score parent P1 reste `531.5/1000` (audit forensique initial du 2026-05-21).

Le score P1.5 post-implémentation est `~770-820/1000` (rapport vérification finale du 2026-05-21, GO 192/200).

L'addendum ajoute **complément `/95`** indépendant — il ne modifie PAS le score P1 parent ni P1.5. Il documente 3 dimensions complémentaires sous-couvertes par l'audit initial.

**Choix doctrine** : addendum complémentaire `/95` reporté dans PHASE-1-VERDICT.md sans repondération du scoring parent. Bonus signal pour staff engineer review.

---

## Top P0 cross-cutting (ordre priorité)

| # | Item | Agent | Effort | Impact |
|---|---|---|---|---|
| 1 | **Implémenter `qa_derived` generator complet** (Q/R + cosine anti-cannibalisation) | A02 | 8-12h | Débloque flow 6/7 + anti-thin SEO |
| 2 | **Implémenter `comparison` generator** (tableau + ClaimReview JSON-LD) | A02 | 8-12h | Débloque flow 4/7 + commercial intent |
| 3 | **`CampaignTemplate` table + 6 presets seedés** | A13 | 4-6h | Will exigence simplicité (4 clicks campagne) |
| 4 | **Étendre `CoverageCampaign`** : cronExpression + scheduledStart + scheduledEnd + type + priority | A13 | 4h | Débloque scheduling avancé |
| 5 | **`pilier` outline review humain** (status `pending_human_outline_review`) | A02 | 4-6h | Quality control investissement skyscraper |
| 6 | **Table `ContentGenFlowMetrics`** daily aggregation per-flow | A02 | 6h | Cécité ops actuelle (latence/cost/success) |
| 7 | **Collapse Réglages dashboard 10 → 3 tabs** | A12 | 3h | Hick's Law violation P0 |
| 8 | **Persist "Nouvelle campagne" sidebar** (pas seulement dashboard header) | A12 | 2h | Journey #1 -1 click |
| 9 | **Wizard 4-step création campagne** (template → scope → distribution → estimate → launch) | A13 | 8h | Will exigence simplicité atteinte |
| 10 | **Inline pause/resume dashboard cards** | A12 | 4h | Journey #4 BLOCKED → 1 click |
| 11 | **Délai 48h post-publication source pour `article_rss`** | A02 | 1h | Compliance Google anti-scrape |
| 12 | **DLQ explicite + Telegram dead-letter alerts** tous workers | A02 | 4h | Visibilité ops jobs morts |

**Total P0 effort estimé** : ~55-65h (~10 sprint days)

---

## Top P1 (15 items cross-cutting)

Voir détails dans les 3 sous-rapports :
- `A02-flows-by-type.md` §3 (15 items)
- `A12-ux-simplicite-admin.md` §6 (6 items P1)
- `A13-programmation-campagnes-avancee.md` §3 (15 items)

---

## ⏸️ STOP & ASK Will — 3 décisions canoniques addendum

### **D-Add-1** — Flow `pilier` : étape outline review humain

**Question** : L'étape `pending_human_outline_review` est-elle :
- (a) **Obligatoire** pour tout pilier (Will valide outline avant body 3000-6000 mots)
- (b) **Skippable** si quality score outline ≥9.0/10 (auto-approve)
- (c) **Obligatoire 1ères 20 piliers**, puis (b) après calibration confiance modèle

**Reco** : (c) — calibration pragmatique. Premier mois manuel, puis bascule auto si scoring outline stable.

### **D-Add-2** — UX wizard campagne

**Question** : Création campagne via :
- (a) **Wizard 4 étapes** (template → scope → distribution → estimate → launch) — recommandé A12+A13
- (b) **Page monolithique optimisée** (1 seul scroll, sections collapsables)

**Reco** : (a) — wizard 4 étapes. Aligné Will exigence « simple » + clicks count cible ≤8. Friction step-by-step plus faible que cognitive load 30 champs simultanés.

### **D-Add-3** — Templates presets initiaux (6 templates à seeder)

**Question** : Valider la liste suivante pour seed P0 ?

1. `pme-audits-standard-30j` — 100/jour 30j, distribution 100% blog_keywords
2. `pme-interventions-weekly` — 5/sem lundi 9h, 80% blog_keywords + 20% comparatif
3. `tpe-audits-burst-14j` — 50 articles 14j, 70% keywords + 30% longue_traine
4. `eti-impl-pilier-monthly` — 2/mois 1er du mois, 100% pilier
5. `cities-domination-paris-burst` — 20 villes one-shot, 80% landing_ville + 20% blog_keywords
6. `rss-curation-daily-10` — 10/jour 3×/jour, 100% article_rss

**Reco** : tel quel, mais possible ajustement quotas/cron post-validation Will. Templates 1 + 6 prioritaires (PME audits = pilier business, RSS = quick win).

---

## Délégations downstream

### → P2 (Architecture data pipeline)
- **Table `ContentGenFlowMetrics`** daily aggregation (A02)
- **Extension `CoverageCampaign`** : cronExpression + scheduledStart + scheduledEnd + type + priority + costCapUsd (A13)
- **Table `CampaignTemplate`** marketplace presets (A13)
- **Table `Trigger`** : 5 trigger types + rate limit (A13)
- **DLQ infrastructure** : worker `content-dlq-worker.ts` (A02)

### → P3 (SEO/AEO/GEO)
- Pattern AEO renforcé `longue_traine_intention` (A02)
- JSON-LD `ClaimReview` pour `comparatif` (A02)
- JSON-LD `isBasedOn` pour `qa_derived` + `article_rss` (A02)

### → P4 (Editorial Quality + Templates)
- Doctrines par flow (pilier review humain, qa_derived anti-cannibalisation, RSS 48h délai) (A02)
- 7 templates production-grade × prompt module (A02)

### → P5 (Console Admin Ops)
- **Wizard 4 étapes** création campagne (D-Add-2) (A13)
- **Vue calendrier campagnes** drag-drop (A13)
- **Timeline next 7d/30d** viz (A13)
- **Bulk operations** table (A13)
- **Templates marketplace UI** (A13)
- **Collapse Réglages** 10 → 3 tabs (A12)
- **Persist CTA "Nouvelle campagne"** sidebar (A12)
- **Inline pause/resume** dashboard (A12)
- **Empty state guards** zero-campaign (A12)
- **Mobile UX test** iPhone SE / iPad (A12)

### → P6 (Roadmap)
- Items P0 à séquencer dans plan chiffré (12 P0 × effort ~55-65h)
- Validation Will D-Add-1/2/3 nécessaire avant priorisation

---

## Fichiers livrés

```
_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/addendum/
├── A02-flows-by-type.md                       (15/35)
├── A12-ux-simplicite-admin.md                 (17/30)
├── A13-programmation-campagnes-avancee.md     (14/30)
└── SYNTHESE-ADDENDUM.md                       (ce fichier — score global /95)
```

PHASE-1-VERDICT.md du parent **mis à jour** avec le bonus addendum complémentaire `/95` (cf. section dédiée).

---

*Fin synthèse addendum. Verdict 46/95 — système content-gen P1.5 est solide sur core pipeline + compliance, mais addendum révèle 12 P0 sur flows distincts, UX simplicité et programmation campagnes avant production scale.*
