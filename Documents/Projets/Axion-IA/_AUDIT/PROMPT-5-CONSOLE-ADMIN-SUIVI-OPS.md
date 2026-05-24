# PROMPT P5 — AUDIT CONSOLE ADMIN & SUIVI OPS — CONTENT-GEN AXION-IA
## Version 1.0 — 2026-05-21 — AUDIT-ONLY — Score /1000

---

## 1. CONTEXTE PROJET COMPLET

### 1.1 Stack technique
- **Framework** : Next.js 16 App Router (src/app/[locale]/)
- **ORM** : Prisma 5.22 + PostgreSQL (Coolify managed)
- **Queue** : BullMQ (Redis) — workers isolés src/server/queue/workers/
- **Admin** : Admin V2 derrière flag `ADMIN_V2_ENABLED` (cookie `admin_v2=1` en preview, env Coolify en prod)
- **Infra** : Hetzner CPX42 + Coolify + GHCR + Cloudflare
- **i18n** : FR canonique + EN miroir (`/en/` routes)
- **Tests** : Vitest (1229+ tests), typecheck strict, lint ESLint
- **Repo** : `will383842/axion-ia` — branche `main`
- **Répertoire projet** : `C:\Users\willi\Documents\Projets\Axion-IA`

### 1.2 Domaine métier Axion-IA
- **Site** : axion-ia.com
- **Positionnement** : 5 verticales métier (PAS que formation) :
  1. `interventions_formations` — formations et interventions IA en entreprise
  2. `un_a_un` — coaching IA individuel (1-to-1)
  3. `audits` — audits IA organisationnels
  4. `implementations` — implémentations techniques IA
  5. `sites_web_augmentes` — création de sites web augmentés IA
- **3 cibles** : `tpe`, `pme`, `eti`
- **9 types de contenu** (4 stubs non implémentés) :
  - ACTIFS : `landing_ville`, `blog_article`, `guide`, `faq_page`, `glossaire_term`
  - STUBS : `comparatif`, `rss_derived`, `qa_derived`, `blog_from_title`
- **39 villes pilote** indexables (Paris → Nancy)
- **Cible 12 mois** : 120 villes
- **Cap publication** : `MAX_PUBLISH_PER_DAY=30` → rampe vers 500/jour
- **Couleurs brand** : terracotta `#c24a1b` principale, bleu `#1a4dd9` pointes, fond ivoire `#faf8f3`

### 1.3 Scores baseline phases précédentes
| Phase | Score | Verdict |
|-------|-------|---------|
| P1 (Phase 1) | 531.5/1000 | REFONTE PARTIELLE + DOUBLE HOLD |
| P1.5 (Sprint compliance) | ~590-620/1000 | HOLD levé partiel |
| P1.5 Phase A livré | ~770-820/1000 | Score estimé post-corrections |
| P2 (cohérence infra) | 726/1000 | CONDITIONNEL |
| P3 (qualité contenu) | 689/1000 | CONDITIONNEL |
| P4 (ops & monitoring) | ~548/1000 | NO-GO |
| Addendum console admin | 46/95 | CRITIQUE |

### 1.4 Findings critiques des audits précédents — Console Admin

**Addendum A12-Add (17/30) — UX campagnes** :
- Violation loi de Hick : 10+ items flat sans hiérarchie
- Pause/resume inline ABSENT (opération critique indisponible)
- CTA "Nouvelle campagne" non persistant (disparaît selon contexte)
- Wizard campagne INEXISTANT (création en une seule page non guidée)
- Aucun indicateur d'avancement par campagne

**Addendum A13-Add (14/30) — Templates & scheduling** :
- `CampaignTemplate` table ABSENTE en base de données
- Scheduling avancé ABSENT (cron expressions, recurring, triggers)
- Bulk operations ABSENTES (pause/resume/delete multiple campagnes)
- Aucun preset prêt-à-l'emploi

**Addendum A02-Add (15/35) — Flows documentés** :
- 7 flows distincts non documentés dans l'UI
- `qa_derived` et `comparison` flows : stubs sans UI dédiée
- Aucun onboarding pour nouveaux utilisateurs

**P4 A4-10 (13/30) — Feedback & qualité** :
- Feedback Will (thumbs up/down par article) ABSENT
- Anomaly detection qualité ABSENT
- Reporting hebdomadaire ABSENT
- Aucun historique des rejets avec raisons

**P2 A2-04 — Observabilité** :
- Logs structurés présents dans code mais NON exposés UI admin
- Aucune visualisation BullMQ jobs depuis l'admin
- Alerting coût/qualité ABSENT

### 1.5 Exigences explicites Will (brief original)
1. Console admin FACILE — pas complexe
2. Suivi pointu : avancement par **ville / type / état** (généré / publié / refusé / redondant)
3. Suivi **extrêmement complet**
4. **Plusieurs campagnes parallèles visibles** côte à côte
5. Fixer **% par type contenu** (ex: 40% landing_ville, 30% blog, etc.)
6. Fixer **% par type entreprise** par campagne (ex: 60% PME, 30% TPE, 10% ETI)
7. **Volume jour configurable** (override MAX_PUBLISH_PER_DAY)
8. **Wizard campagne simple** — 4 étapes validées (D-Add-2)
9. **6 presets templates campagnes** (D-Add-3 validé) :
   - PME audits
   - interventions weekly
   - TPE burst
   - ETI pilier
   - Cities Paris
   - RSS daily

---

## 2. MODE OPÉRATOIRE

### 2.1 AUDIT-ONLY STRICT — RÈGLES ABSOLUES
```
INTERDICTIONS ABSOLUES :
- Aucun commit git (git commit, git add, git push)
- Aucune modification de fichiers source
- Aucune exécution de serveur, build, ou migration
- Aucune modification de base de données
- Aucune installation de dépendances (npm install, pnpm add)
- Aucune création de fichiers hors du répertoire _AUDIT/

AUTORISÉ :
- Lecture de tous les fichiers source (Read, Glob, Grep)
- Création de fichiers .md dans _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/
- Exécution de commandes lecture seule (git log, git diff --stat, pnpm typecheck --noEmit)
```

### 2.2 Architecture des 8 agents parallèles
```
ORCHESTRATEUR (ce prompt)
├── A5-01 : Dashboard principal           /120 pts
├── A5-02 : Wizard campagne               /120 pts
├── A5-03 : Suivi campagnes actives       /100 pts
├── A5-04 : Console qualité               /100 pts
├── A5-05 : Suivi par ville               /100 pts
├── A5-06 : Configuration & presets       /120 pts
├── A5-07 : Observabilité & alertes       /100 pts
└── A5-08 : UX simplicité                 /140 pts
                                   TOTAL : /1000 pts
```

### 2.3 Séquençage d'exécution AUTOPILOT
```
PHASE INIT (avant spawn agents) :
1. Cartographier src/app/[locale]/(admin)/[adminPrefix]/ — toutes les routes admin
2. Lister src/components/admin/ — tous les composants
3. Identifier src/server/ routes pertinentes content-gen
4. Lire prisma/schema.prisma — tables Campaign, CampaignTemplate, ContentJob, Article
5. Lire src/server/queue/workers/ — workers BullMQ actifs
6. Lire env vars contenu-gen dans .env.example ou Dockerfile

PHASE AGENTS (tous en parallèle) :
→ Spawn A5-01 à A5-08 simultanément
→ Chaque agent produit son fichier agents/A5-XX.md
→ Chaque agent retourne son score partiel

PHASE SYNTHESIS :
→ CROSS-CUTTING.md : problèmes transverses
→ PHASE-5-VERDICT.md : score global + recommandations P0/P1/P2
→ STOP & ASK Will : décisions canoniques
```

### 2.4 Chemin de travail
```
Répertoire projet  : C:\Users\willi\Documents\Projets\Axion-IA
Répertoire livrables : C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-5\
Fichiers à créer :
  - PHASE-5-VERDICT.md
  - agents/A5-01-DASHBOARD-PRINCIPAL.md
  - agents/A5-02-WIZARD-CAMPAGNE.md
  - agents/A5-03-SUIVI-CAMPAGNES-ACTIVES.md
  - agents/A5-04-CONSOLE-QUALITE.md
  - agents/A5-05-SUIVI-PAR-VILLE.md
  - agents/A5-06-CONFIGURATION-PRESETS.md
  - agents/A5-07-OBSERVABILITE-ALERTES.md
  - agents/A5-08-UX-SIMPLICITE.md
  - CROSS-CUTTING.md
```

---

## 3. PHASE INIT — CARTOGRAPHIE OBLIGATOIRE AVANT SPAWN

Avant de lancer les agents, l'orchestrateur DOIT exécuter cette cartographie :

### 3.1 Routes admin content-gen
```bash
# Lister toutes les routes admin liées au content-gen
# Chercher dans src/app/[locale]/(admin)/
# Patterns : /content-gen, /campaigns, /jobs, /articles, /coverage
```

Fichiers clés à lire :
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/` (toute la hiérarchie)
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/` 
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/`
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/jobs/`

### 3.2 Composants admin
```bash
# src/components/admin/ — tous les composants liés content-gen
# Patterns : Campaign*, ContentGen*, Coverage*, Job*, Article*
```

### 3.3 Schema Prisma — modèles clés
```bash
# prisma/schema.prisma
# Chercher : model Campaign, model CampaignTemplate, model ContentJob
# model Article, model CoverageScore, model QualityJudgment
```

### 3.4 Workers BullMQ
```bash
# src/server/queue/workers/
# Lister tous les workers + leurs noms de queues
# Chercher les workers content-gen (publish, gen, orchestrator, indexnow)
```

### 3.5 Configuration content-gen
```bash
# src/server/content-gen/config/ ou src/lib/content-gen/
# Fichiers : config.ts, constants.ts, types.ts
# Chercher MAX_PUBLISH_PER_DAY, JUDGE_THRESHOLD, CAP_*, rampe
```

### 3.6 API routes admin
```bash
# src/app/api/admin/ ou src/app/[locale]/(admin)/[adminPrefix]/api/
# Patterns : campaigns, jobs, articles, coverage, config
```

---

## 4. AGENT A5-01 — DASHBOARD PRINCIPAL — /120 pts

### Mission
Auditer la page dashboard principal de la console content-gen admin. Cette page doit afficher en temps réel la vue globale de tous les articles générés, publiés, refusés, redondants — croisés par ville, type de contenu, état et campagne.

### Fichiers à inspecter
```
src/app/[locale]/(admin)/[adminPrefix]/content-gen/page.tsx
src/app/[locale]/(admin)/[adminPrefix]/content-gen/dashboard/
src/components/admin/content-gen/Dashboard*.tsx
src/components/admin/content-gen/Stats*.tsx
src/components/admin/content-gen/Overview*.tsx
src/app/api/admin/content-gen/stats/
src/server/content-gen/queries/dashboard*.ts
```

### Critères de scoring A5-01

#### A5-01-C1 : Métriques temps réel (0-30 pts)
- [ ] **30 pts** : Compteurs live mis à jour < 30s via polling ou Server-Sent Events (articles générés / publiés / refusés / redondants)
- [ ] **20 pts** : Compteurs présents mais polling > 30s ou pas de mise à jour auto
- [ ] **10 pts** : Compteurs statiques (page refresh manuel)
- [ ] **0 pts** : Aucun compteur agrégé visible

Sous-critères :
- Compteur "Générés aujourd'hui" vs cap MAX_PUBLISH_PER_DAY : présent / absent
- Barre de progression cap journalier : présente / absente
- Timestamp dernière mise à jour affiché : présent / absent
- Breakdown par état (généré/publié/refusé/redondant) : présent / absent

#### A5-01-C2 : Filtres et tri (0-25 pts)
- [ ] **25 pts** : Filtres ville + type contenu + état + campagne + période (7/30/90j) tous fonctionnels, combinables
- [ ] **15 pts** : Au moins 3 filtres combinables fonctionnels
- [ ] **8 pts** : 1-2 filtres basiques
- [ ] **0 pts** : Aucun filtre

Sous-critères :
- Filtre par ville (dropdown searchable) : présent / absent
- Filtre par type contenu (checkbox multi) : présent / absent
- Filtre par état (généré/publié/refusé/redondant) : présent / absent
- Filtre par campagne : présent / absent
- Filtre par période : présent / absent
- Tri par colonne (clicks sur en-têtes) : présent / absent

#### A5-01-C3 : Tableau croisé ville × type × état (0-30 pts)
- [ ] **30 pts** : Tableau avec ville en ligne, type contenu en colonne, états en sous-colonnes, totaux marginaux, scroll horizontal géré
- [ ] **20 pts** : Tableau plat ville × type sans breakdown état
- [ ] **10 pts** : Liste simple sans croisement
- [ ] **0 pts** : Absent

Sous-critères :
- 39 villes affichables (pagination ou scroll virtuel si > 20) : oui / non
- Score moyen qualité par ville visible : oui / non
- Articles par verticale par ville : oui / non
- Indication villes avec 0 articles (gap visible) : oui / non

#### A5-01-C4 : Export CSV/Excel (0-15 pts)
- [ ] **15 pts** : Export CSV des données filtrées avec headers clairs, filename daté
- [ ] **8 pts** : Export CSV données complètes non filtrées
- [ ] **3 pts** : Copie presse-papier JSON
- [ ] **0 pts** : Aucun export

#### A5-01-C5 : Vue multi-campagnes (0-20 pts)
- [ ] **20 pts** : Section dédiée montrant toutes les campagnes actives avec statut + progress + articles générés ce jour
- [ ] **12 pts** : Liste campagnes actives sans détail progression
- [ ] **5 pts** : Lien vers liste campagnes
- [ ] **0 pts** : Absent

### Livrables A5-01
Fichier : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-01-DASHBOARD-PRINCIPAL.md`

Structure obligatoire :
```markdown
# A5-01 — Dashboard Principal — Score XX/120

## Fichiers inspectés
[liste des fichiers lus avec chemins absolus]

## État actuel (ce qui existe)
[description factuelle de ce qui est implémenté]

## Gaps identifiés
### P0 (bloquant)
### P1 (important)
### P2 (nice-to-have)

## Scoring détaillé
| Critère | Max | Score | Justification |
|---------|-----|-------|---------------|
| C1 Métriques temps réel | 30 | XX | ... |
| C2 Filtres et tri | 25 | XX | ... |
| C3 Tableau croisé | 30 | XX | ... |
| C4 Export CSV | 15 | XX | ... |
| C5 Vue multi-campagnes | 20 | XX | ... |
| **TOTAL** | **120** | **XX** | |

## Recommandations P0 urgentes
[code snippets ou specs de ce qui manque]
```

---

## 5. AGENT A5-02 — WIZARD CAMPAGNE — /120 pts

### Mission
Auditer l'existence et la qualité du wizard de création de campagne. Le wizard doit guider Will en 4 étapes maximum, avec 6 presets prêts à l'emploi, et permettre le lancement en moins de 4 clics.

### Fichiers à inspecter
```
src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/new/
src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/create/
src/components/admin/content-gen/CampaignWizard*.tsx
src/components/admin/content-gen/CampaignForm*.tsx
src/components/admin/content-gen/CampaignTemplate*.tsx
src/server/content-gen/campaign*.ts
src/server/content-gen/templates*.ts
prisma/schema.prisma (model CampaignTemplate)
src/app/api/admin/content-gen/campaigns/
```

### Critères de scoring A5-02

#### A5-02-C1 : Existence du wizard multi-étapes (0-35 pts)
- [ ] **35 pts** : Wizard 4 étapes avec stepper visuel, navigation avant/arrière, état persistant entre étapes
- [ ] **20 pts** : Formulaire multi-sections mais pas de stepper (tout sur une page)
- [ ] **10 pts** : Formulaire simple une page, tous les champs d'un coup
- [ ] **0 pts** : Absent (aucune UI de création campagne)

Les 4 étapes attendues :
1. Vertical + cible (verticale métier × TPE/PME/ETI)
2. Type de contenu (checkboxes avec % configurables)
3. Villes (sélection multi villes, toutes/filtre région)
4. Schedule (volume/jour, dates, récurrence)

Sous-critères par étape :
- Étape 1 : dropdowns vertical (5 choix) + cible (3 choix) : présent / absent
- Étape 2 : checkboxes type contenu avec slider % somme=100 : présent / absent
- Étape 3 : sélecteur villes searchable, sélectionner-tout, filtres région : présent / absent
- Étape 4 : date début/fin, MAX_PUBLISH_PER_DAY override, récurrence : présent / absent

#### A5-02-C2 : 6 presets CampaignTemplate (0-35 pts)
- [ ] **35 pts** : 6 presets configurés en DB ou seed, affichés avant le wizard avec preview résumé, applicable en 1 clic
- [ ] **20 pts** : Presets définis en code mais pas en DB, pas de table CampaignTemplate
- [ ] **10 pts** : 1-3 presets partiels
- [ ] **0 pts** : Aucun preset

Les 6 presets attendus (D-Add-3 validé par Will) :
```
1. "PME audits"           — vertical:audits, cible:pme, type:landing_ville+guide, 3 villes, 5/j
2. "Interventions weekly" — vertical:interventions_formations, cible:pme+eti, type:blog+faq, 10 villes, 7/j
3. "TPE burst"            — vertical:all, cible:tpe, type:landing_ville+blog, 20 villes, 15/j
4. "ETI pilier"           — vertical:implementations, cible:eti, type:guide+glossaire, 5 villes, 3/j
5. "Cities Paris"         — toutes verticales, villes:Paris+IDF, type:landing_ville, 10/j
6. "RSS daily"            — vertical:all, cible:all, type:rss_derived, toutes villes, 5/j
```

Vérifier :
- Table `CampaignTemplate` dans prisma/schema.prisma : présente / absente
- Seed ou fixtures avec les 6 presets : présents / absents
- UI card presets avant le wizard : présente / absente
- Preview résumé du preset (estimations articles, villes, types) : présent / absent

#### A5-02-C3 : Time-to-launch ≤ 4 clics (0-25 pts)
- [ ] **25 pts** : Depuis la page campagnes, lancement campagne via preset = 1 clic preset + 1 clic confirm = 2 clics
- [ ] **15 pts** : 3-4 clics depuis le wizard avec preset pré-rempli
- [ ] **8 pts** : 5-7 clics
- [ ] **0 pts** : > 7 clics ou impossible sans expert

#### A5-02-C4 : Validation inline (0-25 pts)
- [ ] **25 pts** : Validation par étape avec messages d'erreur inline, blocage passage étape suivante si invalide, somme % = 100 vérifiée
- [ ] **15 pts** : Validation au submit uniquement avec messages clairs
- [ ] **8 pts** : Validation basique HTML5 (required)
- [ ] **0 pts** : Aucune validation

Sous-critères :
- Alerte si % types contenu ne somment pas à 100% : présent / absent
- Alerte si aucune ville sélectionnée : présent / absent
- Alerte si cap/jour dépasse MAX_PUBLISH_PER_DAY global : présent / absent
- Preview "estimation articles totaux" avant lancement : présent / absent

### Livrables A5-02
Fichier : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-02-WIZARD-CAMPAGNE.md`

---

## 6. AGENT A5-03 — SUIVI CAMPAGNES ACTIVES — /100 pts

### Mission
Auditer la vue de suivi des campagnes en cours. Doit permettre de voir plusieurs campagnes parallèles côte à côte avec pause/resume inline, barre de progression, ETA, coût estimé et jobs BullMQ visibles.

### Fichiers à inspecter
```
src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/
src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/[id]/
src/components/admin/content-gen/CampaignCard*.tsx
src/components/admin/content-gen/CampaignList*.tsx
src/components/admin/content-gen/JobQueue*.tsx
src/server/queue/workers/content-gen-*.ts
src/server/queue/workers/publish-*.ts
src/app/api/admin/content-gen/campaigns/[id]/pause/
src/app/api/admin/content-gen/campaigns/[id]/resume/
src/app/api/admin/content-gen/jobs/
```

### Critères de scoring A5-03

#### A5-03-C1 : Pause/Resume inline (0-30 pts)
- [ ] **30 pts** : Bouton pause/resume sur chaque carte campagne, action optimiste (UI met à jour immédiatement), confirmation si campagne a des jobs en cours
- [ ] **20 pts** : Pause/resume disponible mais via page détail (pas inline)
- [ ] **8 pts** : Pause/resume via API documentée mais pas d'UI
- [ ] **0 pts** : Absent

Vérifier :
- API route PATCH/POST `/api/admin/content-gen/campaigns/[id]/pause` : présente / absente
- API route PATCH/POST `/api/admin/content-gen/campaigns/[id]/resume` : présente / absente
- Composant bouton avec état loading pendant action : présent / absent
- Gestion erreur (si pause échoue) : présente / absente

#### A5-03-C2 : Progress bar par campagne (0-25 pts)
- [ ] **25 pts** : Barre de progression (articles produits / articles cibles total) + pourcentage + articles aujourd'hui / cap jour
- [ ] **15 pts** : Compteur articles sans barre visuelle
- [ ] **5 pts** : Statut textuel seulement (actif/pausé)
- [ ] **0 pts** : Absent

Sous-critères :
- `articlesGenerated / articlesTarget` en % : présent / absent
- Articles publiés aujourd'hui vs cap jour : présent / absent
- ETA completion (jours restants estimés) : présent / absent

#### A5-03-C3 : ETA et coût estimé (0-20 pts)
- [ ] **20 pts** : ETA basée sur velocity actuelle (articles/heure × articles restants) + coût estimé total (tokens LLM × prix unitaire)
- [ ] **12 pts** : ETA date de fin théorique basée sur cap/jour uniquement
- [ ] **5 pts** : Date de fin configurée sans ETA dynamique
- [ ] **0 pts** : Absent

Sous-critères :
- Calcul ETA dynamique (velocity-based) : présent / absent
- Coût estimé en euros (tokens × tarif Claude) : présent / absent
- Alerte si coût dépasse budget configuré : présente / absente

#### A5-03-C4 : BullMQ jobs visibles (0-15 pts)
- [ ] **15 pts** : Tableau jobs BullMQ live (waiting/active/completed/failed) par campagne, retry possible sur failed
- [ ] **8 pts** : Compteurs jobs par statut sans détail
- [ ] **3 pts** : Lien externe vers Bull Dashboard
- [ ] **0 pts** : Absent

#### A5-03-C5 : Multi-campagnes parallèles côte à côte (0-10 pts)
- [ ] **10 pts** : Layout grid/flex permettant de voir 2-3 cartes campagne côte à côte, scroll horizontal si plus
- [ ] **5 pts** : Liste verticale avec cartes expansibles
- [ ] **0 pts** : Vue liste plate sans notion de parallélisme

### Livrables A5-03
Fichier : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-03-SUIVI-CAMPAGNES-ACTIVES.md`

---

## 7. AGENT A5-04 — CONSOLE QUALITE — /100 pts

### Mission
Auditer la console de suivi qualité : LLM-judge scoring par article, distribution des scores, articles rejetés avec raison, historique des itérations d'amélioration, feedback Will thumbs up/down.

### Fichiers à inspecter
```
src/app/[locale]/(admin)/[adminPrefix]/content-gen/quality/
src/app/[locale]/(admin)/[adminPrefix]/content-gen/articles/
src/components/admin/content-gen/QualityScore*.tsx
src/components/admin/content-gen/ArticleFeedback*.tsx
src/components/admin/content-gen/RejectionList*.tsx
src/server/content-gen/judge*.ts
src/server/content-gen/quality*.ts
prisma/schema.prisma (model QualityJudgment, model ArticleFeedback)
src/app/api/admin/content-gen/articles/[id]/feedback/
src/app/api/admin/content-gen/quality/
```

### Critères de scoring A5-04

#### A5-04-C1 : Score LLM-judge par article (0-25 pts)
- [ ] **25 pts** : Score numérique (0-100) affiché sur chaque article + badge couleur (vert/orange/rouge) + critères détaillés expandables
- [ ] **15 pts** : Score numérique sans détail des critères
- [ ] **8 pts** : Label qualitatif (bon/moyen/mauvais) sans score numérique
- [ ] **0 pts** : Absent

Vérifier :
- Modèle `QualityJudgment` dans Prisma : présent / absent
- `JUDGE_THRESHOLD` configurable : présent / absent
- Critères de scoring exposés (SEO, originalité, longueur, etc.) : présents / absents

#### A5-04-C2 : Distribution des scores (0-20 pts)
- [ ] **20 pts** : Histogramme ou courbe distribution scores + moyenne + médiane + p10/p90
- [ ] **12 pts** : Stats simples (moyenne, min, max)
- [ ] **5 pts** : Compteur articles par bucket (bon/moyen/mauvais)
- [ ] **0 pts** : Absent

#### A5-04-C3 : Articles rejetés avec raison (0-25 pts)
- [ ] **25 pts** : Liste filtrée articles rejetés avec : raison textuelle du rejet, score obtenu vs seuil, possibilité de relancer la génération
- [ ] **15 pts** : Liste rejetés avec raison mais pas de relance
- [ ] **8 pts** : Compteur rejetés sans détail
- [ ] **0 pts** : Absent

Sous-critères :
- Raison rejet structurée (enum ou texte) stockée en DB : présente / absente
- Bouton "Relancer génération" sur article rejeté : présent / absent
- Historique itérations d'amélioration (version 1, 2, 3...) : présent / absent

#### A5-04-C4 : Feedback Will thumbs up/down (0-20 pts)
- [ ] **20 pts** : Boutons thumbs up/thumbs down sur chaque article, feedback stocké en DB (model ArticleFeedback), stats feedback agrégées
- [ ] **12 pts** : Feedback présent mais non stocké (state local uniquement)
- [ ] **5 pts** : Système de notation étoiles sans persistance
- [ ] **0 pts** : Absent

Vérifier :
- API route POST `/api/admin/content-gen/articles/[id]/feedback` : présente / absente
- Modèle `ArticleFeedback` (userId, articleId, type, comment) : présent / absent
- Agrégation des feedbacks dans les stats qualité : présente / absente

#### A5-04-C5 : Articles améliorés N itérations (0-10 pts)
- [ ] **10 pts** : Visualisation de l'historique des versions avec delta de score (v1: 65 → v2: 82 après amélioration)
- [ ] **5 pts** : Compteur de tentatives par article
- [ ] **0 pts** : Absent

### Livrables A5-04
Fichier : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-04-CONSOLE-QUALITE.md`

---

## 8. AGENT A5-05 — SUIVI PAR VILLE — /100 pts

### Mission
Auditer la vue de suivi géographique : heatmap ou tableau ville × type × état, progression 39 → 120 villes, articles par ville par verticale, score moyen qualité par ville.

### Fichiers à inspecter
```
src/app/[locale]/(admin)/[adminPrefix]/content-gen/city-coverage/
src/app/[locale]/(admin)/[adminPrefix]/content-gen/cities/
src/components/admin/content-gen/CityHeatmap*.tsx
src/components/admin/content-gen/CityCoverage*.tsx
src/components/admin/content-gen/CityTable*.tsx
src/server/content-gen/coverage*.ts
src/server/content-gen/city*.ts
prisma/schema.prisma (model CoverageScore, City references)
src/app/api/admin/content-gen/coverage/
src/lib/cities/ ou src/data/cities/
```

### Critères de scoring A5-05

#### A5-05-C1 : Visualisation géographique (0-30 pts)
- [ ] **30 pts** : Heatmap France interactive (SVG ou lib cartographique) avec couleurs par taux de couverture par ville, tooltip au hover (articles count, score moyen, états)
- [ ] **20 pts** : Tableau ville × type × état complet, trié, paginé, searchable
- [ ] **10 pts** : Liste simple des villes avec compteur articles
- [ ] **0 pts** : Absent

Vérifier :
- Composant heatmap/carte France : présent / absent
- Tableau croisé ville × type contenu : présent / absent
- Colonne état (généré/publié/refusé) par type : présente / absente

#### A5-05-C2 : Progression 39 → 120 villes (0-25 pts)
- [ ] **25 pts** : Indicateur progression villes (39/120 villes couvertes), liste villes non encore activées, bouton "Activer ville" pour ajouter au plan
- [ ] **15 pts** : Compteur villes sans action disponible
- [ ] **5 pts** : Information statique dans documentation
- [ ] **0 pts** : Absent

Sous-critères :
- Barre progression (39/120 = 32.5%) : présente / absente
- Liste des 81 villes manquantes avec score potentiel estimé : présente / absente
- Priorisation villes par population/volume recherche : présente / absente

#### A5-05-C3 : Articles par ville par verticale (0-25 pts)
- [ ] **25 pts** : Tableau croisé avec ville en ligne, 5 verticales en colonnes, compteur articles + état dominant par cellule
- [ ] **15 pts** : Tableau ville × articles total sans breakdown verticale
- [ ] **8 pts** : Filtrage par ville dans liste articles générale
- [ ] **0 pts** : Absent

#### A5-05-C4 : Score moyen qualité par ville (0-20 pts)
- [ ] **20 pts** : Score qualité moyen affiché par ville (agrégation QualityJudgment), indicateur de la ville avec le score le plus bas (gap)
- [ ] **12 pts** : Score moyen global sans breakdown par ville
- [ ] **5 pts** : Compteur rejetés par ville uniquement
- [ ] **0 pts** : Absent

### Livrables A5-05
Fichier : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-05-SUIVI-PAR-VILLE.md`

---

## 9. AGENT A5-06 — CONFIGURATION & PRESETS — /120 pts

### Mission
Auditer la page de configuration globale de content-gen : override MAX_PUBLISH_PER_DAY depuis l'UI, % par type contenu, % par cible, gestion des 6 CampaignTemplate presets, ajustement JUDGE_THRESHOLDS.

### Fichiers à inspecter
```
src/app/[locale]/(admin)/[adminPrefix]/content-gen/config/
src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/
src/components/admin/content-gen/ContentGenConfig*.tsx
src/components/admin/content-gen/TemplateManager*.tsx
src/server/content-gen/config*.ts
src/lib/content-gen/constants.ts
src/lib/content-gen/defaults.ts
prisma/schema.prisma (model ContentGenConfig, model CampaignTemplate)
src/app/api/admin/content-gen/config/
src/app/api/admin/content-gen/templates/
```

### Critères de scoring A5-06

#### A5-06-C1 : MAX_PUBLISH_PER_DAY overridable UI (0-30 pts)
- [ ] **30 pts** : Slider ou input numérique dans l'UI admin pour modifier le cap jour, persisté en DB, pris en compte par les workers BullMQ immédiatement (pas de redémarrage requis)
- [ ] **20 pts** : Override possible via variable env (pas d'UI mais documenté)
- [ ] **8 pts** : Hardcodé dans code (MAX_PUBLISH_PER_DAY = 30)
- [ ] **0 pts** : Introuvable

Vérifier :
- Modèle `ContentGenConfig` ou équivalent en DB : présent / absent
- Lecture du cap depuis DB dans les workers (pas uniquement depuis env) : présent / absent
- Historique des modifications du cap : présent / absent

#### A5-06-C2 : % par type contenu configurable (0-25 pts)
- [ ] **25 pts** : Interface permettant de définir la répartition % par type (ex: 40% landing_ville, 30% blog, etc.) avec validation somme=100, applicable globalement ou par campagne
- [ ] **15 pts** : Répartition configurable mais sans validation somme=100
- [ ] **8 pts** : Répartition définie en constantes code non modifiable UI
- [ ] **0 pts** : Absent (répartition non configurable)

Les 9 types à configurer (4 stubs en lecture seule) :
- `landing_ville`, `blog_article`, `guide`, `faq_page`, `glossaire_term` (actifs, modifiables)
- `comparatif`, `rss_derived`, `qa_derived`, `blog_from_title` (stubs, affichés 0% non modifiables)

#### A5-06-C3 : % par cible configurable (0-20 pts)
- [ ] **20 pts** : Sliders ou inputs % pour TPE / PME / ETI avec validation somme=100, applicable par campagne
- [ ] **12 pts** : Configurable globalement mais pas par campagne
- [ ] **5 pts** : Valeurs fixes dans code
- [ ] **0 pts** : Absent

#### A5-06-C4 : Gestion 6 CampaignTemplate presets (0-30 pts)
- [ ] **30 pts** : CRUD complet des presets (créer, éditer, supprimer, dupliquer), 6 presets système non supprimables, aperçu avant application
- [ ] **20 pts** : 6 presets visibles et applicables mais non éditables
- [ ] **10 pts** : Presets en code uniquement, pas d'UI de gestion
- [ ] **0 pts** : Absent

Vérifier l'existence des 6 presets D-Add-3 :
- "PME audits" : présent / absent
- "Interventions weekly" : présent / absent
- "TPE burst" : présent / absent
- "ETI pilier" : présent / absent
- "Cities Paris" : présent / absent
- "RSS daily" : présent / absent

#### A5-06-C5 : JUDGE_THRESHOLDS ajustables (0-15 pts)
- [ ] **15 pts** : Seuils du juge qualité modifiables UI (seuil accept/reject, seuil amélioration auto, max itérations) avec preview impact estimé
- [ ] **8 pts** : Seuils modifiables via env vars documentés
- [ ] **3 pts** : Seuils hardcodés mais documentés
- [ ] **0 pts** : Absent / inconnu

### Livrables A5-06
Fichier : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-06-CONFIGURATION-PRESETS.md`

---

## 10. AGENT A5-07 — OBSERVABILITE & ALERTES — /100 pts

### Mission
Auditer l'observabilité du pipeline content-gen dans l'UI admin : anomaly detection, logs structurés exposés, alerting coût, reporting email hebdomadaire, warning keyword_select_exhausted.

### Fichiers à inspecter
```
src/app/[locale]/(admin)/[adminPrefix]/content-gen/logs/
src/app/[locale]/(admin)/[adminPrefix]/content-gen/monitoring/
src/components/admin/content-gen/LogViewer*.tsx
src/components/admin/content-gen/AlertPanel*.tsx
src/server/content-gen/monitoring*.ts
src/server/content-gen/anomaly*.ts
src/lib/monitoring/ ou src/lib/alerts/
src/server/email/ (templates reporting Will)
src/app/api/admin/content-gen/logs/
src/lib/logger*.ts
```

### Critères de scoring A5-07

#### A5-07-C1 : Anomaly detection qualité batch (0-25 pts)
- [ ] **25 pts** : Détection automatique des anomalies (chute score qualité > 15%, spike rejets > 50%, 0 articles générés depuis X heures) avec alerte visible dans l'UI
- [ ] **15 pts** : Seuils d'alerte configurés mais notification uniquement par email (pas dans UI)
- [ ] **8 pts** : Logs d'erreur présents sans détection d'anomalie
- [ ] **0 pts** : Absent

Sous-critères :
- Alerte si qualité moyenne batch < JUDGE_THRESHOLD - 20% : présente / absente
- Alerte si taux rejet > 50% sur dernière heure : présente / absente
- Alerte si aucun article généré depuis 4h pendant campagne active : présente / absente
- Badge alerte visible en header admin (red dot) : présent / absent

#### A5-07-C2 : Logs structurés exposés UI (0-25 pts)
- [ ] **25 pts** : Viewer de logs temps réel dans l'UI (filtrables par level/worker/campagne), avec search, syntax highlighting JSON, pagination
- [ ] **15 pts** : Logs affichés mais non filtrables (dump brut)
- [ ] **8 pts** : Lien externe vers service de logs (ex: Sentry)
- [ ] **0 pts** : Aucun accès logs depuis UI admin

Vérifier :
- API route GET `/api/admin/content-gen/logs` avec pagination : présente / absente
- Composant LogViewer avec filtres level (debug/info/warn/error) : présent / absent
- Filtrage par worker (publish/gen/orchestrator/indexnow) : présent / absent
- Sentry integration avec lien depuis UI vers traces : présent / absent

#### A5-07-C3 : Alerting dépassement coût (0-20 pts)
- [ ] **20 pts** : Budget mensuel configurable, alerte UI + email quand 80% atteint, blocage automatique campagne quand 100% atteint
- [ ] **12 pts** : Alerte email uniquement sans blocage automatique
- [ ] **5 pts** : Compteur coût visible sans alerting
- [ ] **0 pts** : Absent

Sous-critères :
- Coût estimé Claude API en temps réel (tokens × tarif) : présent / absent
- Budget mensuel configurable en UI : présent / absent
- Seuil d'alerte (80%) et blocage (100%) : présents / absents

#### A5-07-C4 : Reporting email Will lundi 8h (0-20 pts)
- [ ] **20 pts** : Cron job envoyant rapport hebdomadaire (articles publiés/refusés, coût semaine, score qualité moyen, villes avancées) tous les lundis à 8h, configurable
- [ ] **12 pts** : Rapport email existant mais fréquence non configurable ou pas lundi 8h
- [ ] **5 pts** : Export manuel uniquement (pas de cron)
- [ ] **0 pts** : Absent

Vérifier :
- Cron BullMQ ou cron système pour rapport hebdomadaire : présent / absent
- Template email rapport avec les KPIs listés : présent / absent
- Destinataire configurable (williamsjullin@gmail.com par défaut) : présent / absent

#### A5-07-C5 : keyword_select_exhausted warning (0-10 pts)
- [ ] **10 pts** : Warning visible dans UI quand pool de keywords pour une ville/verticale est épuisé, avec suggestion d'action (élargir pool, ajouter synonymes)
- [ ] **5 pts** : Erreur loguée sans UI warning
- [ ] **0 pts** : Absent

### Livrables A5-07
Fichier : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-07-OBSERVABILITE-ALERTES.md`

---

## 11. AGENT A5-08 — UX SIMPLICITE — /140 pts

### Mission
Auditer la qualité UX globale de la console admin content-gen selon les principes de simplicité exigés par Will : loi de Hick, CTA persistant, actions bulk, raccourcis clavier, mobile responsive, onboarding 0-to-first-campaign ≤ 5 min.

### Fichiers à inspecter
```
src/app/[locale]/(admin)/[adminPrefix]/content-gen/ (toute la hiérarchie)
src/components/admin/content-gen/ (tous les composants)
src/components/admin/Sidebar*.tsx ou NavAdmin*.tsx
src/app/[locale]/(admin)/[adminPrefix]/layout.tsx
src/styles/admin.css ou src/styles/admin-v2.css
src/app/globals.css (variables CSS admin)
```

### Critères de scoring A5-08

#### A5-08-C1 : Loi de Hick — max 7 items par menu (0-30 pts)
- [ ] **30 pts** : Navigation admin content-gen : ≤ 7 items au premier niveau, regroupement logique par catégorie, sous-menus révélés progressivement
- [ ] **20 pts** : 8-10 items avec labels clairs
- [ ] **8 pts** : 11-15 items flat
- [ ] **0 pts** : > 15 items flat ou navigation impossible à comprendre

Inventaire des items de navigation actuels :
- Lister tous les liens de menu dans la sidebar admin pour la section content-gen
- Compter les items de premier niveau
- Vérifier la hiérarchie (groupes, sous-menus)

#### A5-08-C2 : CTA "Nouvelle campagne" persistant (0-25 pts)
- [ ] **25 pts** : Bouton "Nouvelle campagne" visible sur TOUTES les pages admin content-gen (header sticky ou sidebar), couleur terracotta `#c24a1b`, jamais masqué
- [ ] **15 pts** : CTA présent sur la page principale campagnes seulement
- [ ] **5 pts** : CTA présent mais disparaît dans certains contextes
- [ ] **0 pts** : Absent

Sous-critères :
- CTA visible sur dashboard, liste campagnes, quality, coverage, config : oui / non
- Couleur correcte (`#c24a1b` terracotta) : oui / non
- Position fixe (pas de scroll requis pour l'atteindre) : oui / non

#### A5-08-C3 : Actions bulk (0-20 pts)
- [ ] **20 pts** : Checkbox multi-sélection sur listes campagnes et articles, actions bulk : pause, resume, delete, exporter CSV, avec confirmation
- [ ] **12 pts** : Actions bulk sur campagnes uniquement (pas articles)
- [ ] **5 pts** : Sélection individuelle possible, aucun bulk
- [ ] **0 pts** : Absent

#### A5-08-C4 : Raccourcis clavier (0-15 pts)
- [ ] **15 pts** : Au moins 5 raccourcis clavier documentés (N = nouvelle campagne, P = pause/resume, F = filtres, E = export, ? = aide)
- [ ] **8 pts** : 1-4 raccourcis (ex: Escape pour fermer modal)
- [ ] **0 pts** : Aucun raccourci documenté

#### A5-08-C5 : Mobile responsive (0-20 pts)
- [ ] **20 pts** : Console admin utilisable sur mobile/tablette (≥ 768px) : menu hamburger, cartes campagnes scrollables, tableaux avec scroll horizontal, formulaires adaptés
- [ ] **12 pts** : Partiellement responsive (> 50% des vues)
- [ ] **5 pts** : Tentative responsive mais tableaux cassés sur mobile
- [ ] **0 pts** : Desktop uniquement, mobile cassé

#### A5-08-C6 : Onboarding 0-to-first-campaign ≤ 5 min (0-30 pts)
- [ ] **30 pts** : Premier accès : tour guidé ou page "Démarrage rapide" affichée si 0 campagnes, avec les 6 presets en avant-plan, wizard en 4 étapes, première campagne lancée en < 5 min
- [ ] **20 pts** : Page vide avec CTA clair + wizard, pas de tour guidé mais intuitable en < 10 min
- [ ] **10 pts** : Page vide sans guidance, wizard disponible mais non mis en avant
- [ ] **0 pts** : Aucun onboarding, interface opaque sans aide

Sous-critères :
- Empty state avec CTA et presets visibles si 0 campagnes : présent / absent
- Tour guidé (tooltip step-by-step) : présent / absent
- Documentation in-app (? ou "Comment ça marche") : présente / absente
- Estimation time-to-first-campaign (compter les clics depuis page vide) : XX clics / XX min

### Livrables A5-08
Fichier : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-08-UX-SIMPLICITE.md`

---

## 12. CROSS-CUTTING — PROBLEMES TRANSVERSES

Après que tous les agents ont terminé, l'orchestrateur rédige `CROSS-CUTTING.md` :

### Thèmes transverses à analyser

#### XC-1 : Cohérence design system
- Couleurs respectent la charte (`#c24a1b` terracotta, `#1a4dd9` bleu, `#faf8f3` ivoire) : oui / non
- Composants admin V2 utilisés uniformément : oui / non
- Variables CSS admin-v2 correctement appliquées : oui / non

#### XC-2 : Performance admin
- Temps de chargement page dashboard estimé (taille bundle, requêtes N+1 détectables)
- Requêtes Prisma potentiellement lentes (absence d'index, jointures massives)
- Pagination présente sur toutes les listes longues (39 villes, N articles) : oui / non

#### XC-3 : Sécurité admin
- Routes admin protégées par middleware auth : oui / non
- Actions CRUD avec vérification rôle (admin only) : oui / non
- Pas d'exposition de tokens/clés API dans les logs UI : oui / non

#### XC-4 : Cohérence données
- Même source de vérité pour les compteurs (pas de double comptage) : oui / non
- États articles (GENERATED/PUBLISHED/REJECTED/REDUNDANT) définis en enum Prisma : oui / non
- Synchronisation état BullMQ / état DB : documentée / absente

#### XC-5 : Accessibilité WCAG
- Aria-labels sur boutons icon-only : présents / absents
- Contrast ratio vérifiable sur badges couleur (score qualité vert/rouge) : ok / insuffisant
- Focus visible sur éléments interactifs : oui / non

---

## 13. SCORING GLOBAL /1000

### Tableau récapitulatif

| Agent | Domaine | Max | Score | %age |
|-------|---------|-----|-------|------|
| A5-01 | Dashboard principal | 120 | XX | XX% |
| A5-02 | Wizard campagne | 120 | XX | XX% |
| A5-03 | Suivi campagnes actives | 100 | XX | XX% |
| A5-04 | Console qualité | 100 | XX | XX% |
| A5-05 | Suivi par ville | 100 | XX | XX% |
| A5-06 | Configuration & presets | 120 | XX | XX% |
| A5-07 | Observabilité & alertes | 100 | XX | XX% |
| A5-08 | UX simplicité | 140 | XX | XX% |
| **TOTAL** | | **1000** | **XX** | **XX%** |

### Seuils de décision

| Score | Verdict | Signification |
|-------|---------|---------------|
| ≥ 900 | GO | Console admin prête pour usage production Will |
| 750-899 | CONDITIONNEL | Utilisable avec corrections P0 sous 72h |
| 600-749 | SPRINT CORRECTIF | Sprint dédié console admin requis (~1 semaine) |
| < 600 | NO-GO | Refonte console admin nécessaire |

### Priorités correctifs

**P0 — Bloquant (à corriger avant tout lancement campagne)** :
[Liste issues P0 consolidée depuis tous les agents]

**P1 — Important (à corriger sous 72h)** :
[Liste issues P1 consolidée]

**P2 — Nice-to-have (backlog V2)** :
[Liste issues P2 consolidée]

---

## 14. LIVRAISON — FICHIERS PRODUITS

### Structure des livrables
```
C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-5\
├── PHASE-5-VERDICT.md          ← verdict global + scores + roadmap corrections
├── CROSS-CUTTING.md            ← problèmes transverses
└── agents\
    ├── A5-01-DASHBOARD-PRINCIPAL.md
    ├── A5-02-WIZARD-CAMPAGNE.md
    ├── A5-03-SUIVI-CAMPAGNES-ACTIVES.md
    ├── A5-04-CONSOLE-QUALITE.md
    ├── A5-05-SUIVI-PAR-VILLE.md
    ├── A5-06-CONFIGURATION-PRESETS.md
    ├── A5-07-OBSERVABILITE-ALERTES.md
    └── A5-08-UX-SIMPLICITE.md
```

### Template PHASE-5-VERDICT.md
```markdown
# PHASE 5 — CONSOLE ADMIN & SUIVI OPS — VERDICT FINAL
## Date : [DATE]
## Auditeur : Claude Sonnet 4.6 (AUDIT-ONLY)

## SCORE GLOBAL : XX/1000 — [GO / CONDITIONNEL / SPRINT CORRECTIF / NO-GO]

## Résumé exécutif (5 lignes max pour Will)
[Résumé en français simple, sans jargon technique]

## Scores par agent
[Tableau récapitulatif]

## Top 3 forces actuelles
1. ...
2. ...
3. ...

## Top 5 lacunes critiques
1. ...
2. ...
3. ...
4. ...
5. ...

## Roadmap corrections recommandée
### Sprint immédiat (< 24h) — P0
### Sprint court (72h) — P1 prioritaires
### Sprint moyen (1 semaine) — P1 complets
### Backlog (post-P2) — P2

## Effort estimé corrections complètes
[Estimation en heures-développeur par catégorie]
```

---

## 15. STOP & ASK WILL — DECISIONS CANONIQUES

Après la livraison de tous les fichiers, présenter à Will ces décisions :

### Décision D-P5-1 : Presets CampaignTemplate — valider les 6 configs
```
Les 6 presets détaillés ci-dessous sont-ils validés comme specs de référence
pour le Sprint Corrections P5 ?

1. "PME audits" :
   - Vertical : audits
   - Cible : pme (100%)
   - Types : landing_ville 50% + guide 30% + faq_page 20%
   - Villes : 5 villes (Paris, Lyon, Marseille, Bordeaux, Nantes)
   - Volume : 5 articles/jour
   - Durée : illimitée jusqu'à pause

2. "Interventions weekly" :
   - Vertical : interventions_formations
   - Cible : pme 60% + eti 40%
   - Types : blog_article 50% + faq_page 30% + guide 20%
   - Villes : 10 villes (top 10 population)
   - Volume : 7 articles/jour
   - Durée : illimitée

3. "TPE burst" :
   - Vertical : toutes (20% chacune)
   - Cible : tpe (100%)
   - Types : landing_ville 60% + blog_article 40%
   - Villes : 20 villes
   - Volume : 15 articles/jour
   - Durée : 14 jours (burst)

4. "ETI pilier" :
   - Vertical : implementations
   - Cible : eti (100%)
   - Types : guide 50% + glossaire_term 30% + faq_page 20%
   - Villes : 5 villes (Paris, Lyon, Bordeaux, Lille, Toulouse)
   - Volume : 3 articles/jour
   - Durée : illimitée

5. "Cities Paris" :
   - Vertical : toutes (20% chacune)
   - Cible : pme 50% + eti 30% + tpe 20%
   - Types : landing_ville (100%)
   - Villes : Paris + 4 communes IDF (Boulogne, Vincennes, Saint-Denis, Versailles)
   - Volume : 10 articles/jour
   - Durée : 7 jours

6. "RSS daily" :
   - Vertical : toutes
   - Cible : toutes
   - Types : rss_derived (100%) [stub — activation post-P2]
   - Villes : toutes les villes actives
   - Volume : 5 articles/jour
   - Durée : illimitée (cron récurrent)

OPTIONS WILL :
A. Valider les 6 presets tels quels → Sprint les implémente en DB
B. Modifier un ou plusieurs presets → préciser les changements
C. Réduire à 4 presets (supprimer RSS daily + ETI pilier) → moins de complexité
```

### Décision D-P5-2 : JUDGE_THRESHOLDS — seuil qualité
```
Quel seuil de qualité minimum pour publier un article ?

OPTIONS :
A. Seuil strict 75/100 — seuls les articles très bons publiés (~50% pass rate estimé)
B. Seuil modéré 60/100 — articles corrects publiés (~70% pass rate estimé)
C. Seuil souple 50/100 — articles moyens acceptés (~85% pass rate estimé)
D. Double seuil — 65/100 publié direct, 50-64 publié après révision Will

Contexte : cap actuel 30/j. Avec seuil 75 → ~15 articles/j effectifs.
                              Avec seuil 60 → ~21 articles/j effectifs.
```

### Décision D-P5-3 : Reporting email — fréquence et contenu
```
Rapport automatique content-gen envoyé à williamsjullin@gmail.com :

OPTIONS FRÉQUENCE :
A. Hebdomadaire lundi 8h (recommandé)
B. Quotidien 8h (plus verbeux)
C. Bi-hebdomadaire lundi + jeudi
D. Uniquement si anomalie détectée

CONTENU DU RAPPORT (tous inclus par défaut) :
- Articles publiés cette semaine (N total + breakdown par ville/type)
- Articles rejetés (N + raisons principales)
- Score qualité moyen (+ évolution vs semaine précédente)
- Coût Claude API estimé cette semaine
- Villes nouvellement couvertes
- Alertes actives (si anomalies)
- Progression vers objectif 120 villes

Valider contenu tel quel ou retirer des éléments ?
```

### Décision D-P5-4 : Heatmap vs Tableau pour suivi villes
```
Pour la vue "Suivi par ville" (A5-05), deux approches UX :

OPTION A — HEATMAP FRANCE (carte SVG interactive)
+ Intuitive visuellement, rapide à comprendre le gap géographique
+ Impact visuel fort dans les démos
- Complexité dev ~3 jours (lib svg-maps ou react-simple-maps)
- Moins précis pour des données détaillées (survol tooltip)

OPTION B — TABLEAU CROISÉ DYNAMIQUE
+ Données exhaustives (ville × type × état × score)
+ Filtrable/triable/exportable CSV immédiatement
+ Dev plus rapide ~1 jour
- Moins visuellement impactant

OPTION C — LES DEUX (heatmap + tableau en onglets)
+ Meilleure expérience globale
- Double effort ~4 jours

Choix Will ?
```

### Décision D-P5-5 : Volume rampe — schedule vers 500/jour
```
Plan de rampe MAX_PUBLISH_PER_DAY (actuellement = 30) :

OPTIONS :
A. Rampe manuelle — Will ajuste depuis l'UI config quand il est prêt
B. Rampe automatique graduelle :
   - Semaine 1-2 : 30/j (actuel)
   - Semaine 3-4 : 75/j (si qualité ≥ seuil D-P5-2)
   - Mois 2 : 150/j
   - Mois 3 : 300/j
   - Mois 4+ : 500/j
C. Rampe accélérée (si infrastructure validée) :
   - J+7 : 100/j
   - J+30 : 300/j
   - J+60 : 500/j

Note : Implique de surveiller les coûts API et la capacité PostgreSQL.
```

### Décision D-P5-6 : Sprint Corrections P5 — priorité d'exécution
```
Vu le score P5 (XX/1000), quel ordre pour le Sprint Corrections P5 ?

OPTIONS :
A. Quick wins d'abord — implémenter les P0 UX (CTA persistant + pause/resume + presets)
   en ~8h pour débloquer Will sur les campagnes immédiatement
B. Infrastructure d'abord — table CampaignTemplate + ContentGenConfig DB
   avant toute UI (base solide)
C. Wizard d'abord — permettre à Will de créer sa première campagne complète
   même si les vues de suivi sont incomplètes
D. Ordonnancement par score agent — corriger les agents les plus bas en score en premier

Recommandation Claude : [sera précisée dans PHASE-5-VERDICT.md selon les scores obtenus]
```

---

## 16. PHRASE DE LANCEMENT — AUTOPILOT DE BOUT EN BOUT

**INSTRUCTION POUR LE CLAUDE QUI EXECUTE CE PROMPT :**

Tu es Claude Code en mode AUTOPILOT. Tu dois exécuter l'intégralité de cet audit de bout en bout, sans t'arrêter pour demander des validations intermédiaires, jusqu'à la livraison complète des 10 fichiers dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/`.

**DOSSIER DE TRAVAIL :**
```
C:\Users\willi\Documents\Projets\Axion-IA
```

**ÉTAPES D'EXÉCUTION AUTOPILOT :**

```
ÉTAPE 1 — CRÉER LA STRUCTURE DE LIVRAISON
Créer les répertoires :
  C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-5\
  C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-5\agents\

ÉTAPE 2 — PHASE INIT : CARTOGRAPHIE (cf. section 3)
Lire et cartographier :
- Toutes les routes admin content-gen
- Tous les composants admin content-gen
- Schema Prisma (modèles clés)
- Workers BullMQ
- Configuration content-gen
- API routes admin
Résumer la cartographie dans un bloc interne avant de spawner les agents.

ÉTAPE 3 — SPAWN 8 AGENTS EN PARALLELE
Exécuter les agents A5-01 à A5-08 (sections 4 à 11).
Chaque agent DOIT :
a) Lire les fichiers listés dans sa section "Fichiers à inspecter"
b) Évaluer chaque critère de scoring (présent/absent + score)
c) Documenter les fichiers inspectés avec chemins absolus
d) Écrire son fichier agents/A5-XX-*.md

ÉTAPE 4 — CROSS-CUTTING (section 12)
Analyser les problèmes transverses XC-1 à XC-5.
Écrire CROSS-CUTTING.md.

ÉTAPE 5 — VERDICT FINAL (section 13 + 14)
Consolider les scores de tous les agents.
Calculer le score global /1000.
Déterminer le verdict (GO/CONDITIONNEL/SPRINT CORRECTIF/NO-GO).
Écrire PHASE-5-VERDICT.md selon le template section 14.

ÉTAPE 6 — PRÉSENTER STOP & ASK (section 15)
Présenter les 6 décisions canoniques à Will dans la réponse finale.
NE PAS MODIFIER LE CODE SOURCE. NE PAS COMMITER.

CONTRAINTES ABSOLUES :
- AUDIT-ONLY : zéro commit, zéro modification fichier source
- Chemins Windows absolus dans tous les fichiers produits
- Tous les fichiers en français
- Scores avec justification factuelle (pas d'estimations inventées)
- Si un fichier n'existe pas : noter "ABSENT — fichier non trouvé" et scorer 0 sur ce critère
```

**Lance l'audit AUTOPILOT maintenant. Commence par créer la structure de répertoires, puis exécute la cartographie, puis spawne les 8 agents en parallèle.**

---

*Prompt P5 — Console Admin & Suivi Ops — Axion-IA Content-Gen Perfection 2026*
*Généré le 2026-05-21 — Version 1.0 — Self-contained — AUDIT-ONLY*
*Score cible : ≥ 900/1000 pour GO — Baseline estimée P4 console : ~230/1000*
