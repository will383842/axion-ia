# A6-04 — Roadmap Sprint B (31-60 jours)

**Agent** : A6-04 | **Date** : 2026-05-22 | **HEAD** : e573da64 (origin/main)
**Mission** : AUDIT-ONLY — roadmap chiffrée J31-J60, zéro commit, zéro modif code
**Fenêtre** : 2026-06-21 → 2026-07-21 (J31-J60 depuis J0 = 2026-05-22)
**Score entrant Sprint B** : ~3 751/5 000 (post-Sprint A estimé, base 3 638 + ~113 pts Sprint A)
**Objectif Sprint B** : +135 pts → **~3 886/5 000**
**Gap vers GO (4 500)** : −614 pts

---

## 0. Prérequis post-Sprint A (J0-J30) — Conditions d'entrée Sprint B

Sprint B ne démarre sereinement qu'avec ces livrables Sprint A vérifiés :

| Prérequis | Criticité | Vérification |
|-----------|-----------|-------------|
| P0-3 promptHash réel câblé (AI Act J+71 = 2026-08-02) | BLOQUANT | `grep "SHA-256" src/server/content-gen/generators/` retourne hash contenu réel |
| 3 drifts schema.prisma synchronisés (P0-1/P0-5/P0-6) | BLOQUANT | `pnpm prisma migrate status` = "All migrations applied" |
| CampaignTemplate + 6 presets en DB | FORT | Admin → table CampaignTemplate = 6 rows |
| Générateurs comparison.ts + qa-derived.ts opérationnels | FORT | Vitest `comparison.test.ts` + `qa-derived.test.ts` verts |
| Boucle improve fix (P0-2 Sprint A) | FORT | 2 passes distinctes, `issues[]` injectées au re-prompt |
| KPIs J30 verts : taux rejet < 20%, score moyen > 7.0/10 | DÉCISION | Point de contrôle Will avant rampe 30→50 |
| MAX_PUBLISH_PER_DAY = 30 actif + UI câblée | REQUIS | Champ BatchesV2 écrit en DB |

**Si prérequis P0-3 ou schema.prisma non livrés** : Sprint B démarre quand même sur les items KB. Ne pas bloquer l'ensemble du sprint sur ces 2 items — mais le risque légal AI Act subsiste jusqu'à J+71.

---

## 1. Tableau des priorités Sprint B

| # | Item | Type | Dates | Resp. | Effort | Gain pts | Dimension |
|---|------|------|-------|-------|--------|----------|-----------|
| B-01 | KB sectorielle `un_a_un` (10 facts B2B sourcés) | Code | J31-J33 | Claude | 8h | +20 | D-QUAL |
| B-02 | KB sectorielle `implementations` (10 facts sourcés) | Code | J33-J35 | Claude | 8h | +15 | D-QUAL |
| B-03 | KB sectorielle `sites_web_augmentes` (10 facts sourcés) | Code | J35-J37 | Claude | 6h | +10 | D-QUAL |
| B-04 | Monitoring coût LLM dashboard (chart + alertes) | Code | J37-J39 | Claude | 4h | +10 | D-ARCHI |
| B-05 | Dashboard SSE temps réel (Server-Sent Events) | Code | J39-J42 | Claude | 6h | +20 | D-OPS |
| B-06 | Logs viewer BullMQ admin (filtres + export CSV) | Code | J42-J45 | Claude | 7h | +15 | D-OPS |
| B-07 | Adresse FR domiciliation souscrite | Will | J31 | Will | 30 min | — | Prérequis GBP |
| B-08 | Google Business Profile activation (post-adresse) | Will | J36-J40 | Will | 2-3h | +15 | D-VISI |
| B-09 | Rampe MAX_PUBLISH 30→50 (si KPIs J45 verts) | Will | J45-J46 | Will | 5 min | +0 direct | Volume |
| B-10 | Audit mini post-J45 (3 dimensions, 1 agent) | Audit | J45-J46 | Claude | 2h | — | Contrôle |
| B-11 | Backlink pitch presse 1 article FR | Will | J48-J51 | Will | 3h | +10 | D-VISI |
| B-12 | Featured Snippets comparatif prompt tableau | Code | J51-J55 | Claude | 4h | +15 | D-VISI |
| B-13 | Buffer qualité + corrections dérive | Mix | J56-J60 | Mix | 2h+2h | inclus | — |

**Total effort Claude** : ~37h  
**Total effort Will** : ~9-10h  
**Gain Sprint B** : **+130 à +135 pts**

---

## 2. Plan semaine par semaine

### Semaine B-1 : J31-J37 (2026-06-21 → 2026-06-27)
**Thème : KB verticales prioritaires + fondations observabilité**

#### J31-J33 — KB `un_a_un` (8h Claude)
- Fichier `src/server/content-gen/kb/un-a-un-facts.ts`
- 10 facts vérifiés : coût horaire coaching IA France, taux rétention 1-to-1 vs groupe, % dirigeants ayant recours coaching IA, ROI mesurable, durée médiane engagement, secteurs surreprésentés, OPCO finançables, certifications coaching éligibles
- Sources : Syntec, FFCP, Deloitte FR, HubSpot
- Intégration : `kb-context-builder.ts` + flag `sector: "un_a_un"` dans `blog-article.ts`
- **Gain : +20 pts D-QUAL**

#### J33-J35 — KB `implementations` (8h Claude)
- Fichier `src/server/content-gen/kb/implementations-facts.ts`
- 10 facts : budget moyen implémentation IA ETI, durée projet de bout en bout, taux d'échec projets IA (Gartner), types IA les plus déployés FR, % DSI avec budget IA 2025, coût intégration API LLM, ROI automatisation processus
- Sources : Gartner, McKinsey, BpiFrance, CIGREF
- Intégration : `implementations-generator.ts` via `kb-context-builder.ts`
- **Gain : +15 pts D-QUAL**

#### J35-J37 — KB `sites_web_augmentes` (6h Claude)
- Fichier `src/server/content-gen/kb/sites-web-augmentes-facts.ts`
- 10 facts : % sites FR avec composant IA 2025, coût intégration chatbot IA, taux conversion chatbot, délai amortissement, CMS compatibles IA, % e-commerce FR avec reco IA
- Sources : Fevad, Médiamétrie, Nielsen Norman Group, W3Techs
- **Gain : +10 pts D-QUAL**

**Score fin semaine B-1 : ~3 796/5 000**

---

### Semaine B-2 : J38-J44 (2026-06-28 → 2026-07-04)
**Thème : Observabilité coûts + SSE temps réel**

#### J37-J39 — Monitoring coût LLM dashboard (4h Claude)
- Page `/content-gen/monitoring/costs`
- Données : coût LLM cumulé par jour, par campagne, par provider, par type contenu
- Chart barres 30j + compteur mensuel + alerte Telegram à 80% cap configuré
- Requête Prisma : aggregation `ai_content_reviews` + `ai_generated_content.cost_usd`
- **Gain : +10 pts D-ARCHI**

#### J39-J42 — Dashboard SSE temps réel (6h Claude)
- Endpoint `GET /api/admin/content-gen/stream` (Server-Sent Events, `text/event-stream`)
- Events : `jobs_pending`, `jobs_running`, `jobs_done_today`, `cap_used_pct`, `campaign_active_count`, `last_error`
- Hook client `useContentGenStream.ts` + fallback polling 15s si SSE non supporté
- Composant `DashboardLiveCounters.tsx` : 4 compteurs animés + badge rouge si erreur
- **Gain : +20 pts D-OPS**

#### J42-J45 — Logs viewer BullMQ (7h Claude)
- Page `/content-gen/monitoring/logs`
- `getJobs(['failed', 'completed'], 0, 50)` BullMQ
- Colonnes : timestamp, jobId, type, statut, durée, score qualité, erreur
- Filtres : campagne, type contenu, statut, date + export CSV
- **Gain : +15 pts D-OPS**

**Score fin semaine B-2 : ~3 841/5 000**

---

### Semaine B-3 : J45-J51 (2026-07-05 → 2026-07-11)
**Thème : Décision rampe + GBP + audit mini**

#### J45-J46 — Point de décision Will : rampe 30→50 articles/jour

**STOP & ASK obligatoire avant exécution :**

| KPI à vérifier | Seuil GO | Source |
|----------------|----------|--------|
| Score moyen articles publiés (LLM-judge) | ≥ 7.0/10 | DB `ai_content_reviews.avg(overallScore)` |
| Taux rejet (REJECT / total) | ≤ 20% | DB `count(verdict="REJECT")` |
| 0 pénalité manuelle Google Search Console | Confirmé Will | GSC → Sécurité et actions manuelles |
| 0 chute trafic organique > 15% sur J1-J30 | Confirmé Will | GSC → Performances → Clics |
| promptHash AI Act livré Sprint A | Confirmé | DB `ai_generated_content.promptHash` non null |

Si tous verts → Will valide `MAX_PUBLISH_PER_DAY = 50` dans BatchesV2 UI (5 min).
Si un KPI orange → maintenir 30, diagnostic 48h, re-point J47.

#### J45-J46 — Audit mini post-J45 (2h Claude)
- 1 agent ciblant 3 dimensions : D-QUAL (score moyen LLM-judge), D-OPS (logs viewer opérationnel), D-VISI (GBP activé ?)
- Vérifie les prérequis de la rampe
- Rapport court dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/sprint-b-j45-checkup.md`

#### J36-J40 — Google Business Profile (Will, conditionnel adresse FR)
- **Exécuter seulement si Will a obtenu adresse domiciliation FR à J31**
- Création GBP : `https://business.google.com/create` — catégorie "Services de conseil en IA"
- Description 750 cars, photos Will, URL `axion-ia.com`
- Vérification GBP par carte postale (~5 jours) → Will gère
- Ajout `streetAddress` + `telephone` dans `buildOrganizationJsonLd()` par Claude (1h)
- **Gain (si adresse OK) : +15 pts D-VISI**
- **Gain (si adresse NON OK) : 0 pts — item non livrable ce sprint**

#### J48-J51 — Backlink pitch presse 1 article FR (Will, 3h)
- Identification 3-5 médias FR pertinents : JDN, FrenchWeb, L'Usine Digitale, Maddyness
- Pitch personnalisé : angle expertise IA B2B FR + lien vers ressource interne
- 1 article invité cible → lien retour `axion-ia.com`
- **Gain : +10 pts D-VISI** (évalué sur obtention + indexation, différé J+60)

**Score fin semaine B-3 : ~3 866/5 000** (avec GBP) ou ~3 851 (sans GBP)

---

### Semaine B-4 : J52-J60 (2026-07-12 → 2026-07-21)
**Thème : Featured Snippets + buffer qualité**

#### J51-J55 — Featured Snippets comparatif prompt tableau (4h Claude)
- Prompt système dédié dans `src/server/content-gen/generators/comparison.ts`
- Contrainte : "DOIT produire au moins 1 `<table>` HTML avec `<thead>` et ≥ 3 colonnes"
- Structure : Solution A | Solution B | Axion-IA | Critère (coût, délai, ROI, profil cible)
- JSON-LD `Table` + `ItemList` généré automatiquement
- Meta description contrainte : "Comparatif [keyword] : tableau [N solutions] avec coût, délai et ROI"
- TOC auto-insérée si comparatif > 1500 mots
- **Gain : +15 pts D-VISI**

#### J56-J60 — Buffer qualité + corrections dérives
- Revue manuelle 20 articles aléatoires (Will, 2h) — vérification brand voice + facts
- Correction prompte si dérive détectée (Claude, 2-4h selon gravité)
- Mise à jour seuils LLM-judge si distribution biaisée (seuil qualité 60/100 confirmé D-P5-2)
- Notes décisions opérationnelles dans `_AUDIT/`

**Score fin semaine B-4 : ~3 886/5 000**

---

## 3. Tableau des gains par dimension

| Dimension | Score entrant B | Items Sprint B | Gain | Score sortant B | Écart GO |
|-----------|----------------|----------------|------|----------------|----------|
| D-ETAT | 795 | (non ciblé) | +0 | **795** | −205 |
| D-ARCHI | 796 | B-04 (monitoring coût) | +10 | **806** | −194 |
| D-VISI | 778 | B-08 (GBP) + B-11 (backlink) + B-12 (snippets) | +40 | **818** | −182 |
| D-QUAL | 770 | B-01 (un_a_un) + B-02 (impl.) + B-03 (sites web) | +45 | **815** | −185 |
| D-OPS | 580 | B-05 (SSE) + B-06 (logs viewer) | +35 | **615** | −385 |
| **TOTAL** | **3 719** | | **+130** | **~3 849** | **−651** |

> Note : score entrant B = 3 751 (3 638 + ~113 Sprint A estimé). La base dimension ci-dessus est approchée ; le total recalculé depuis 3 751 donne **3 751 + 135 = ~3 886/5 000**.

```
D-ETAT  [████████████████████████████████████████░░░░░░░░░░]   795 → 795
D-ARCHI [████████████████████████████████████████░░░░░░░░░░]   796 → 806
D-VISI  [███████████████████████████████████████░░░░░░░░░░░]   778 → 818
D-QUAL  [███████████████████████████████████████░░░░░░░░░░░]   770 → 815
D-OPS   [██████████████████████████████░░░░░░░░░░░░░░░░░░░░]   580 → 615
         ────────────────────────────────────────────────────
TOTAL   [█████████████████████████████████████░░░░░░░░░░░░░]  3 886/5 000  77.7%

Seuil GO  (4 500) : ──────────────────────────────────────────────────── 90.0%
Position J60      : ──────────────────────────────────────── 77.7% (−12.3%)
```

---

## 4. Effort et coûts Sprint B

### 4.1 Effort développement Claude

| Item | Effort | Coût dev estimé |
|------|--------|----------------|
| KB `un_a_un` (B-01) | 8h | ~$2.50 |
| KB `implementations` (B-02) | 8h | ~$2.50 |
| KB `sites_web_augmentes` (B-03) | 6h | ~$1.80 |
| Monitoring coût LLM (B-04) | 4h | ~$1.20 |
| Dashboard SSE (B-05) | 6h | ~$1.80 |
| Logs viewer BullMQ (B-06) | 7h | ~$2.20 |
| Adresse JSON-LD si SIREN (B-08, 1h) | 1h | ~$0.30 |
| Featured Snippets comparatif (B-12) | 4h | ~$1.20 |
| Buffer/corrections (B-13) | 2h | ~$0.60 |
| Audit mini J45 | 2h | ~$0.60 |
| **Total Claude** | **~48h** | **~$14.70** |

### 4.2 Coût production articles

| Période | Volume | Coût/article | Coût LLM prod |
|---------|--------|--------------|---------------|
| J31-J44 (30/j × 14j) | 420 articles | $0.018 | ~$7.56 |
| J45-J60 (50/j × 16j, si rampe OK) | 800 articles | $0.018 | ~$14.40 |
| J31-J60 conservateur (30/j × 30j) | 900 articles | $0.018 | ~$16.20 |
| **Total prod (scénario rampe)** | **~1 220 art** | | **~$22** |
| **Total prod (scénario flat)** | **~900 art** | | **~$16** |

> Note : le brief mentionne "$27 LLM Sprint B" pour 50 art/j × 30j = 1 500 articles × $0.018. Ce chiffre correspond à la rampe pleine dès J31. La projection ci-dessus est plus conservative (30/j les 14 premiers jours, puis 50/j si KPIs verts à J45).

### 4.3 Effort Will Sprint B

| Tâche | Effort Will | Coût estimé |
|-------|-------------|-------------|
| Domiciliation FR (B-07) | 30 min | ~30€/mois |
| Google Business Profile (B-08) | 2-3h | ~0€ |
| Point de décision rampe J45 (B-09) | 30 min | — |
| Backlink pitch presse (B-11) | 3h | ~150€ valeur temps |
| Revue qualité buffer J56-J60 (B-13) | 2h | ~100€ valeur temps |
| **Total Will** | **~9h** | **~250€ + 30€/mois domicil.** |

### 4.4 Récapitulatif coûts Sprint B

| Poste | Montant |
|-------|---------|
| Développement Claude API | ~$15 (~14€) |
| Production articles (rampe) | ~$22 (~20€) |
| Production articles (flat conservateur) | ~$16 (~15€) |
| Domiciliation FR (mensuel) | ~30€/mois |
| Temps Will | ~250€ valeur temps |
| **Total Sprint B (rampe)** | **~325€** |
| **Total Sprint B (flat conservateur)** | **~310€** |

---

## 5. Jalons mesurables Sprint B

| Jalon | Date | Critère mesurable | Responsable |
|-------|------|-------------------|-------------|
| J37 — KB 3 verticales livrées | 2026-06-27 | 3 fichiers `kb/*.ts` + tests Vitest verts | Claude |
| J40 — GBP créé | 2026-06-30 | URL GBP active + streetAddress dans JSON-LD | Will |
| J42 — Dashboard SSE + coûts opérationnels | 2026-07-02 | `/content-gen/monitoring/costs` + SSE stream 200 | Claude |
| J45 — Logs viewer livré | 2026-07-05 | `/content-gen/monitoring/logs` opérationnel | Claude |
| J45-J46 — Point décision rampe | 2026-07-05 | 5 KPIs verts → Will valide 50/j | Will |
| J51 — Backlink pitch envoyé | 2026-07-11 | Email envoyé à 3+ médias FR | Will |
| J55 — Featured Snippets livré | 2026-07-15 | comparison.ts produit tableau HTML + JSON-LD | Claude |
| J60 — Score vérifié Sprint B | 2026-07-21 | Audit agent → score ≥ 3 886/5 000 | Claude |

---

## 6. Points de décision Will — Sprint B

### D-B1 : Domiciliation FR (J31)
- Souscrire domiciliation WeWork Paris ou équivalent (~30€/mois)
- Sans adresse → GBP impossible → −15 pts D-VISI

### D-B2 : Rampe MAX_PUBLISH 30→50 (J45-J46)
- Option A : Rampe si 5/5 KPIs verts
- Option B : Maintenir 30 si 1 KPI orange, diagnostic 48h
- Option C : Palier à 40 si 4/5 KPIs verts
- **Recommandation** : Option A si verts, Option B sinon

### D-B3 : Backlink stratégie presse (J48-J51)
- Engager ou non la démarche presse FR
- Impact : +10 pts D-VISI (différé indexation J+60)

---

## 7. Risques Sprint B

### R1 — Dérive qualité à 50 articles/jour (PROBABILITÉ HAUTE)
**Description** : Doublement du volume à J45. LLM-judge peut laisser passer des articles borderline (score 6.5-6.8/10) avec accumulation de patterns répétitifs.
**Mitigation** : Badge alerte sidebar + revue Will 5 articles/semaine + rollback `MAX_PUBLISH=30` immédiat.
**Impact si non mitigé** : −10 à −30 pts D-QUAL Sprint B.

### R2 — Adresse FR non obtenue à J31 (PROBABILITÉ MOYENNE)
**Description** : Sans domiciliation, GBP impossible → −15 pts D-VISI non récupérables Sprint B.
**Mitigation** : Will traite en J1-J2 du Sprint B. WeWork Paris 1er arrondissement disponible sans délai.
**Impact** : Score Sprint B plafonné à ~3 871 (sans GBP).

### R3 — Core Update Google (PROBABILITÉ 40% sur 30j)
**Description** : Déploiement Core Update entre J31-J60 pénalisant le contenu IA à haut volume.
**Mitigation** : AI disclaimer en prod (promptHash Sprint A), SimHash déduplication actif, rollback `MAX_PUBLISH=0` immédiat via UI.
**Impact si déclenché** : STOP production, sprint gelé sur items dev uniquement.

### R4 — Sprint A non terminé à J30 (PROBABILITÉ MOYENNE)
**Description** : Featured Snippets (B-12) et logs viewer (B-06) dépendent des générateurs Sprint A.
**Mitigation** : Items KB (B-01, B-02, B-03) et monitoring coûts (B-04) sont indépendants. Décaler B-12 en buffer J56-J60 si nécessaire.
**Impact** : −15 pts Sprint B (B-12 seul item réellement dépendant de Sprint A).

---

## 8. Aperçu Sprint C (J61-J90)

Pour information, Sprint C devra combler ~614 pts vers GO depuis le score attendu à J60.
Les items prioritaires identifiés :

| Levier Sprint C | Gain estimé | Dimension | Effort |
|----------------|-------------|-----------|--------|
| AI Act art. 50 vérification (deadline J+71 = 2026-08-02) | Compliance | D-ARCHI | 4h si gap |
| Rampe MAX_PUBLISH 50→100 (si KPIs J60 verts) | +volume | D-ETAT | Will 5 min |
| Featured Snippets comparatif (si non livré B) | +15 pts | D-VISI | 4h |
| Heatmap villes France (si D-P5-4 révisé) | +10 pts | D-OPS | 8h |
| Script monitoring qualité auto | +10 pts | D-OPS | 4h |
| Bilingue EN re-enable (si bug next-intl fixé, D14) | +30 pts | D-VISI | 20h |
| Audit content-gen mini (3 agents, 2h) | tracker | — | 2h |
| Préparation audit P6.2 (automne 2026) | — | — | 2h |

Score projeté post-Sprint C : 3 886 + 80 = **~3 966/5 000**

---

## 9. Synthèse exécutive Sprint B

| Indicateur | Valeur |
|------------|--------|
| Score entrant Sprint B | ~3 751/5 000 |
| Score sortant Sprint B | **~3 886/5 000 (77.7%)** |
| Verdict Sprint B | **CONDITIONNEL** — Sprint C nécessaire |
| Gap restant vers GO (4 500) | **−614 pts** |
| Effort Claude Sprint B | **~48h** |
| Effort Will Sprint B | **~9h** |
| Coût LLM développement | **~$15** |
| Coût LLM production articles | **~$22-27** |
| Articles produits Sprint B | **~900-1 220** |
| Décisions Will bloquantes | **3 (domiciliation, rampe ×1, backlink)** |
| Risque principal | **Dérive qualité à 50+ art/j** |
| Dimension la plus progressée | **D-QUAL (+45) et D-VISI (+40)** |
| Sprint C nécessaire | **Oui — 614 pts restants** |

---

*Rapport A6-04 — AUDIT-ONLY — zéro commit — zéro modif code*
*Agent : Claude Sonnet 4.6 — 2026-05-22 — Pipeline Content-Gen Perfection Axion-IA 2026*
