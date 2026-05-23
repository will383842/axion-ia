# PHASE 5 — CONSOLE ADMIN & SUIVI OPS — VERDICT FINAL
## Date : 2026-05-21
## Auditeur : Claude Sonnet 4.6 (AUDIT-ONLY)
## HEAD audité : 37ca0147

---

## SCORE GLOBAL : 315/1000 — 🔴 NO-GO

---

## Résumé exécutif (pour Will)

La console admin content-gen existe et fonctionne techniquement, mais elle n'est **pas conçue pour le pilotage opérationnel quotidien**. Tu peux créer une campagne, voir ses jobs, surveiller les coûts et configurer les distributions de types de contenus — mais tout ça nécessite de savoir où chercher et de manipuler des JSON bruts. Il manque 4 choses fondamentales : (1) un wizard guidé pour créer une campagne en 4 clics, (2) les boutons pause/resume directement depuis la liste, (3) une vue de suivi par ville croisée avec les articles générés, et (4) aucun preset prêt à l'emploi. Le score est 315/1000 — il faut un sprint correctif dédié (~40h) avant de pouvoir piloter la production sereinement.

---

## Scores par agent

| Agent | Domaine | Max | Score | % | Verdict |
|-------|---------|-----|-------|---|---------|
| A5-01 | Dashboard principal | 120 | 23 | 19% | 🔴 NO-GO |
| A5-02 | Wizard campagne | 120 | 28 | 23% | 🔴 NO-GO |
| A5-03 | Suivi campagnes actives | 100 | 42 | 42% | 🔴 NO-GO |
| A5-04 | Console qualité | 100 | 28 | 28% | 🔴 NO-GO |
| A5-05 | Suivi par ville | 100 | 28 | 28% | 🔴 NO-GO |
| A5-06 | Configuration & presets | 120 | 60 | 50% | 🔴 NO-GO |
| A5-07 | Observabilité & alertes | 100 | 38 | 38% | 🔴 NO-GO |
| A5-08 | UX simplicité | 140 | 68 | 49% | 🔴 NO-GO |
| **TOTAL** | | **1000** | **315** | **32%** | **🔴 NO-GO** |

---

## Top 3 forces actuelles

### Force 1 — Configuration technique complète (A5-06 : 60/120)
La stack de configuration est la partie la mieux implémentée : `CoverageDistributionProfile` (% par type, CRUD avec validation somme=100), `AudienceMixProfile` (% par cible, CRUD), `QualityLoopV2` (seuils qualité, budget mensuel), `BatchesV2` (`dailyTargetByType` par type, anti-burst, plafond 500/j), `ProviderConfig` (cost caps par provider). Cette infrastructure solide facilite les corrections.

### Force 2 — Pause/resume implémenté côté serveur (A5-03)
Les Server Actions `pauseCampaign` et `resumeCampaign` existent dans `coverage.ts`, avec purge BullMQ et audit trail SOC2. La fonctionnalité manque uniquement dans l'UI de la **liste** (accessible depuis la page détail uniquement).

### Force 3 — Coût tracking temps réel (A5-07)
`cost-tracker.ts` est robuste : alerte Telegram à 80% du cap mensuel, désactivation automatique du provider à 100%, kill-switch global si plus aucun provider disponible, audit trail en DB. `CostsV2` colore visuellement les lignes à risque (>80% rouge).

---

## Top 5 lacunes critiques

### Lacune 1 — Pas de CampaignTemplate / presets (A5-02, A5-06)
**Impact : -65 pts** (35 pts C2 A5-02 + 30 pts C4 A5-06). Le modèle `CampaignTemplate` est **absent du schéma Prisma**. Les 6 presets validés par Will (PME audits, Interventions weekly, TPE burst, ETI pilier, Cities Paris, RSS daily) n'existent nulle part — ni en DB, ni en code, ni en UI. Créer une campagne = saisir manuellement 2 blocs JSON.

### Lacune 2 — Dashboard figé sans temps réel (A5-01)
**Impact : -75 pts** (C1, C2, C3 du dashboard). Server Component `force-dynamic` uniquement — pas de polling, pas de SSE, pas de filtres, pas de tableau croisé ville×type. Pour voir les nouvelles valeurs : F5 obligatoire. Pas de barre de progression cap journalier. Pas de vue multi-campagnes avec ETA.

### Lacune 3 — Suivi géographique incomplet (A5-05)
**Impact : -72 pts** (C1, C2, C3). `CityCoverageV2` mesure la MATIÈRE data (pour ContentGen), pas les articles générés. Aucune server action ne fait `groupBy anchorVilleSlug` — zéro tableau croisé ville×articles×verticale. Le GeoCockpit agrège au niveau région, pas ville. Heatmap France = placeholder non livré.

### Lacune 4 — Feedback Will thumbs up/down absent (A5-04)
**Impact : -20 pts** (C4 A5-04). Le modèle `ArticleFeedback` est absent du schéma Prisma. L'exigence explicite de Will (feedback par article pour guider le pipeline) n'est pas implémentée. Zero endpoint, zero UI.

### Lacune 5 — Onboarding opaque + navigation surchargée (A5-08)
**Impact : -46 pts** (C1 Hick + C2 CTA + C6 Onboarding). Le dashboard liste 22 liens flat sans regroupement interactif (violation loi de Hick). Le CTA "Nouvelle campagne" est couleur bleue (pas terracotta) et absent de 20/22 sous-pages. La page `OnboardingV2` existe mais n'est pas déclenchée à 0 campagnes et impose une commande CLI.

---

## Roadmap corrections recommandée

### Sprint immédiat (< 24h) — P0 — Débloquer l'usage Will

**P0-1 : Boutons pause/resume dans la liste campagnes** (~2h)
Ajouter 2 boutons (`<form action={pause}>` / `<form action={resume}>`) dans `CoverageListV2` sur chaque ligne. Les Server Actions existent déjà. Gain : +20 pts A5-03.

**P0-2 : CTA "Nouvelle campagne" terracotta persistant** (~1h)
Changer la classe CSS du bouton `admin-button` → couleur terracotta `#c24a1b`. Ajouter le CTA dans le layout admin content-gen (header sticky) pour qu'il apparaisse sur toutes les pages. Gain : +15 pts A5-08.

**P0-3 : `MAX_PUBLISH_PER_DAY` champ UI dans BatchesV2 ou dashboard** (~2h)
Ajouter un input numérique "Cap global articles/jour" dans `BatchesV2` (ou le dashboard) qui écrit en DB via `writeContentGenConfig`. Le worker lit déjà depuis DB. Gain : +10 pts A5-06.

**P0-4 : Exposer qualityImprovementAttempts dans ReviewDetailV2** (~30 min)
Ajouter 1 champ à la query Prisma existante dans `review.ts` + 1 ligne d'affichage. Gain : +5 pts A5-04.

---

### Sprint court (72h) — P1 prioritaires

**P1-1 : 6 CampaignTemplate presets en DB** (~8h)
- Créer modèle `CampaignTemplate` dans `schema.prisma` (id, name, description, config JSON, isSystem, createdAt)
- Migrer (`prisma migrate dev`)
- Seed les 6 presets validés D-P5-1
- UI `templates/preset/` (liste cards + preview résumé + bouton "Utiliser ce preset")
- Gain : +20 pts A5-02, +20 pts A5-06 = +40 pts total

**P1-2 : Formulaire création campagne : pré-remplissage depuis preset** (~4h)
- Passer le preset sélectionné en query param `?preset=pme-audits`
- `CoverageNewV2` lit le preset et pré-remplit les champs
- Gain : +10 pts A5-02, +5 pts A5-08

**P1-3 : Progress bars visuelles dans CoverageDetailV2** (~2h)
- Remplacer le texte `(XX %)` par un élément `<progress value={X} max={100}>` ou div CSS styled
- Ajouter : articles publiés aujourd'hui / cap jour + ETA dynamique (velocity × restant)
- Gain : +17 pts A5-03

**P1-4 : Section campagnes actives sur dashboard** (~3h)
- Requête Prisma `findMany({ where: { status: "running" }, take: 5 })` sur dashboard
- Afficher 3-5 cartes campagne (nom, progression, articles ce jour, statut)
- Gain : +15 pts A5-01

**P1-5 : Feedback thumbs up/down par article** (~5h)
- Créer modèle `ArticleFeedback` (articleId, userId, type: 'up'|'down', comment, createdAt)
- Endpoint `POST /api/admin/content-gen/articles/[id]/feedback`
- Bouton inline dans `ReviewDetailV2`
- Gain : +20 pts A5-04

---

### Sprint moyen (1 semaine) — P1 complets

**P1-6 : Tableau croisé ville × articles × verticale** (~6h)
- Server action `getJobsByVilleAndSector()` avec `groupBy [anchorVilleSlug, serviceSector]`
- Page `/content-gen/geo/coverage-table` ou intégrer dans GeoCockpit
- Gain : +25 pts A5-05

**P1-7 : Barre de progression 39/120 villes** (~2h)
- Comparer villes avec jobs publiés vs liste 120 villes cibles
- Afficher `(39/120 = 32.5%)` dans CityCoverageV2 ou dashboard
- Gain : +15 pts A5-05

**P1-8 : Anomaly detection batch** (~4h)
- Dans `content-monitoring-worker.ts` : ajouter 3 checks
  - Chute score qualité moyen > 15% sur 1h
  - Taux rejet > 50% sur 1h
  - 0 articles générés depuis 4h sur campagne running
- Notification : badge rouge dans sidebar admin (état via `ContentGenConfig.key="alert_count"`)
- Gain : +15 pts A5-07

**P1-9 : Regroupement dashboard en ≤7 liens niveau 1** (~2h)
- Créer 3-4 groupes sémantiques dans le dashboard (Pilotage | Qualité | Sources | Réglages)
- Utiliser des accordéons/sections visuellement distinctes
- Gain : +10 pts A5-08

---

### Backlog (post-P2) — P2

- **A5-01** : Polling 15s sur compteurs queue (SSE ou polling client) : +10 pts
- **A5-01** : Tableau croisé complet ville × type × état : +25 pts
- **A5-04** : Distribution histogramme scores avec p10/p90 : +8 pts
- **A5-05** : Heatmap France SVG interactive : +10 pts supplémentaires
- **A5-07** : Rapport email hebdomadaire automatique lundi 8h : +20 pts
- **A5-07** : Logs structurés viewer dans UI (LogViewer filtrable) : +15 pts
- **A5-08** : 5 raccourcis clavier documentés : +7 pts
- **A5-08** : Mobile responsive sidebar hamburger : +5 pts

---

## Effort estimé corrections complètes

| Niveau | Items | Effort estimé | Gain pts |
|--------|-------|---------------|----------|
| P0 immédiat (< 24h) | 4 items | ~5-6h | ~50 pts |
| P1 court (72h) | 5 items | ~20h | ~107 pts |
| P1 moyen (1 semaine) | 4 items | ~14h | ~65 pts |
| P2 backlog | 8 items | ~20-25h | ~100 pts |
| **Total** | **21 items** | **~60-65h** | **~322 pts** |

**Score estimé post-corrections complètes : 315 + 322 = ~637/1000 (SPRINT CORRECTIF → seuil CONDITIONNEL)**

Pour atteindre GO (≥900), un sprint supplémentaire P3 sur la console admin serait nécessaire (~20h additionnelles sur les fonctionnalités avancées : heatmap, reporting email, wizard complet 4 étapes).

---

## Score par rapport aux baselines précédentes

| Phase | Score | Domaine |
|-------|-------|---------|
| P1 (Phase 1 content-gen) | 531.5/1000 | Pipeline technique général |
| P2 (cohérence infra) | 726/1000 | Infrastructure + workers |
| P3 (qualité contenu) | 689/1000 | Qualité contenu produit |
| P4 (ops & monitoring) | ~548/1000 | Ops général |
| **P5 (console admin)** | **315/1000** | **Console admin spécifique** |
| Addendum (baseline) | 46/95 | Addendum console add-on |

**Interprétation** : Le score P5 (315/1000) reflète non pas un bug mais un **manque de fonctionnalités UX** spécifiques à la console admin. La stack technique est solide (P2 726/1000 = la base est là). Ce qui manque = la couche interface opérationnelle pour Will.

---

*Rapport P5 — Console Admin & Suivi Ops — Axion-IA Content-Gen Perfection 2026*
*Généré le 2026-05-21 — Claude Sonnet 4.6 — AUDIT-ONLY — Zéro commit*
