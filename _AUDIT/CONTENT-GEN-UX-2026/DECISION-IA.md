# Décision IA — refonte UX nav `content-gen` (Phase 2 → 3)

> Date : 2026-06-16 · Rôle : juge final de 3 propositions de taxonomie (angles tâche / audience-moment / fréquence) · Base : `AUDIT-FONCTIONNEL.md` (65 routes, 7 flux cassés B1-B7, drift SSOT cmdk) + `src/lib/admin-nav.ts`.

## 0. Verdict — la taxonomie retenue

Les 3 propositions **convergent** sur 6 pôles orientés tâche. Je tranche en gardant ce squelette commun et en greffant les meilleures idées de chacune :

- **Squelette « tâche » (proposition 1)** : 6 pôles = verbes d'intention (Lancer / Suivre / Publier / Villes / Qualité & Coûts / Réglages). C'est le mental model du non-technicien.
- **Toggle Simple/Avancé par défaut Simple (proposition 2)** : le débutant voit **4 pôles** (Lancer, Suivre, Publier, Villes) ; le toggle « Avancé » révèle les pôles 5-6 **et** les items `tier: 'advanced'` à l'intérieur des pôles 1-4. C'est le levier « < 2 min » + « 100 % de puissance conservée ».
- **Ordre par fréquence (proposition 3)** : pôles ordonnés du plus chaud au plus froid (quotidien → occasionnel → config). Lancer > Suivre > Publier (quotidien) ; Villes > Qualité & Coûts (occasionnel) ; Réglages (rare).
- **UN point d'entrée de lancement** : le wizard `/campaigns/new`. Presets + génération à l'unité + génération par ville deviennent des **raccourcis/redirections vers le wizard pré-rempli**, jamais des portes concurrentes.

### Pôles niveau 1 retenus (6)

| # | Pôle | Sous-titre | Visible mode Simple | Fréquence |
|---|---|---|---|---|
| 1 | **Lancer** | Démarrer une génération (point d'entrée unique) | ✅ oui | quotidien |
| 2 | **Suivre** | Voir où ça en est | ✅ oui | quotidien |
| 3 | **Publier** | Valider & mettre en ligne | ✅ oui | quotidien |
| 4 | **Villes** | Couverture géographique des 2 100+ villes | ✅ oui | occasionnel |
| 5 | **Qualité & Coûts** | Santé du contenu & dépenses | ❌ Avancé | occasionnel |
| 6 | **Réglages** | Configurer une fois | ❌ Avancé | rare / setup |

**Règle des 2 niveaux visibles** : pôle (N1) → page (N2). Le 3e niveau (sous-onglets, 14 sous-pages `/settings/*`, détails `[id]`, items `tier:'advanced'`) reste replié (accordéon / hub / sous-page), jamais à plat dans la sidebar.

---

## 1. Arborescence cible (avec tier Simple/Avancé)

```
LANCER (quotidien · simple)
  • Nouvelle campagne              /campaigns/new           [simple]  ← POINT D'ENTRÉE UNIQUE (wizard 4 étapes)
  • Modèles prêts à l'emploi       /coverage/presets        [simple]  (raccourci → wizard ?preset=, après B6)
  • Générer une seule page         /orchestrator/adhoc      [avancé]  (cas unitaire)
  • Premiers pas                   /content-gen/onboarding  [conditionnel: visible si !onboarded]

SUIVRE (quotidien · simple)
  • Tableau de bord                /content-gen             [simple]
  • Campagnes                      /coverage                [simple]   → détail /coverage/[id] (N3)
  • Générations en cours           /jobs                    [simple]   → détail /jobs/[id] (N3, SSE)
  • Pilotage (cadence/lots)        /orchestrator            [avancé]   (KPIs fusionnés vers dashboard)
  • File d'attente                 /queue                   [avancé]   (onglet de Générations)

PUBLIER (quotidien · simple)
  • À valider                      /review-queue            [simple]   → relecture /review-queue/[id] (N3)
  • Contenus publiés               /publications            [simple]   → édition /publications/[id]/edit (N3)
  • Suivi des publications (kanban)/publications-status     [avancé]

VILLES (occasionnel · simple)
  • Couverture des villes          /cities-coverage         [simple]
  • Carte de couverture            /coverage-map            [simple]
  • Ordre de génération            /cities-order            [simple]
  • Équité entre villes            /city-equity             [avancé]
  • Qualité des données (pilote)   /city-coverage           [avancé]
  • Cockpit géo                    /geo                     [avancé]
  • Tableau croisé ville × secteur /geo/coverage-table      [avancé]

QUALITÉ & COÛTS (occasionnel · TOUT le pôle = avancé)
  • Qualité du contenu             /quality
  • Coûts                          /costs
  • Détection de doublons          /similarity-monitor      (après M1)
  • Dérive du ton éditorial        /brand-voice-drift       (après B1)
  • Suivi des vecteurs             /embeddings              (après M3)
  • Liens externes                 /external-links
  • Base de connaissances          /kb-readonly             → fiche /kb-readonly/[id] (N3)

RÉGLAGES (rare · TOUT le pôle = avancé)
  • Réglages génération (hub)      /settings                → 15 sous-pages (N3, dont kb-ingest après B3)
  • Sources RSS (actualités)       /rss                     → /rss/new, /rss/[id], /rss/import (N3)
  • Modèles de prompts             /templates               → /templates/new, /templates/[id] (N3)
  • Suivi des positions (mots-clés)/keyword-tracking        (+ onglet Stratégie = ex /keyword-strategy)
  • Variantes de landing           /landing-variants        → /landing-variants/[variant] (N3)
  • Profil de l'auteur (Manon)     /author/manon
```

---

## 2. Mapping EXHAUSTIF des 65 routes

> Légende action : **PÔLE** = entrée nav · **N3** = sous-page atteignable depuis sa liste (hors sidebar, résolue par breadcrumbs) · **FUSION** = doublon absorbé, redirection 308 conservée 6 mois · **MORT→REDIR** = route morte retirée de la nav + redirection permanente · **après Bx** = rattachement conditionné au fix.

### Pôle 1 — LANCER
| # | Route | Destination | Tier | Note |
|---|---|---|---|---|
| 1 | `/campaigns/new` | LANCER | simple | Wizard = point d'entrée unique |
| 2 | `/coverage/presets` | LANCER | simple | après **B6** ; raccourci → `?preset=` |
| 3 | `/orchestrator/adhoc` | LANCER | avancé | + `auth()` + lien job (M17) |
| 4 | `/content-gen/onboarding` | LANCER (conditionnel) | — | visible si `!onboarded` ; fix m1 |
| 5 | `/coverage/new` | **MORT→REDIR** 308 → `/campaigns/new` | — | propager query (B6/M8) ; retiré nav, gardé 6 mois |
| 6 | `/geo/[villeSlug]/generate` | **MORT→REDIR** → `/campaigns/new?ville=` | — | B2 (ne génère rien + CLI exposé) |

### Pôle 2 — SUIVRE
| # | Route | Destination | Tier | Note |
|---|---|---|---|---|
| 7 | `/content-gen` | SUIVRE (Tableau de bord) | simple | absorbe KPIs orchestrateur ; CTA → `/campaigns/new` (M8) |
| 8 | `/coverage` | SUIVRE (Campagnes) | simple | filtre `scheduled` (m2) |
| 9 | `/coverage/[id]` | N3 (détail) | — | distributions en tableaux (m9), tokens (m8) |
| 10 | `/jobs` | SUIVRE (Générations en cours) | simple | filtres `approved`/`quarantined_*` (m2), Zod (m3) |
| 11 | `/jobs/[id]` | N3 (détail + SSE) | — | OK |
| 12 | `/queue` | **FUSION** → `/jobs?view=queue` | avancé | doublon Prisma ; retirer titre « BullMQ » |
| 13 | `/orchestrator` | **FUSION** → `/content-gen` | avancé | doublon KPIs ; garde vue cadence/lots |
| 14 | `/monitoring` | **MORT→REDIR** → `/jobs?status=failed` | — | pur stub placeholder |

### Pôle 3 — PUBLIER
| # | Route | Destination | Tier | Note |
|---|---|---|---|---|
| 15 | `/review-queue` | PUBLIER (À valider) | simple | — |
| 16 | `/review-queue/[id]` | N3 (relecture) | — | feedback via `submitArticleFeedback` (M6) ; libellés indexée/non indexée |
| 17 | `/publications` | PUBLIER (Contenus publiés) | simple | renommages tier-1/2/3 |
| 18 | `/publications/[id]/edit` | N3 (édition) | — | IndexNow = « Notifier les moteurs » |
| 19 | `/publications-status` | PUBLIER (kanban) | avancé | retirer promesse drag&drop fantôme |

### Pôle 4 — VILLES
| # | Route | Destination | Tier | Note |
|---|---|---|---|---|
| 20 | `/cities-coverage` | VILLES (Couverture des villes) | simple | câbler `markCitiesPriority` (M2) |
| 21 | `/coverage-map` | VILLES (Carte) | simple | — |
| 22 | `/cities-order` | VILLES (Ordre de génération) | simple | OK |
| 23 | `/city-equity` | VILLES (Équité) | avancé | tokens admin (m8) |
| 24 | `/city-coverage` | VILLES (Qualité données pilote) | avancé | désambiguïsé |
| 25 | `/geo` | VILLES (Cockpit géo) | avancé | ex-orphelin ; commentaires (m12) |
| 26 | `/geo/coverage-table` | VILLES (Tableau croisé) | avancé | borner pagination (m11) |
| 27 | `/geo/batches` | **FUSION** → `/coverage` | avancé | doublon liste campaignCoverage |
| 28 | `/geo/history` | **FUSION** → `/coverage` | avancé | doublon coverageCampaign |
| 29 | `/geo/batches/new` | **MORT→REDIR** → `/campaigns/new` | — | stub trompeur (m16) |
| 30 | `/geo/batches/[id]` | **MORT→REDIR** → `/coverage/[id]` | — | page fantôme (m16) |

### Pôle 5 — QUALITÉ & COÛTS (pôle entièrement avancé)
| # | Route | Destination | Tier | Note |
|---|---|---|---|---|
| 31 | `/quality` | QUALITÉ & COÛTS | avancé | OK |
| 32 | `/costs` | QUALITÉ & COÛTS | avancé | OK |
| 33 | `/similarity-monitor` | QUALITÉ & COÛTS (Détection doublons) | avancé | après **M1** ; texte « Sprint 4 » périmé |
| 34 | `/brand-voice-drift` | QUALITÉ & COÛTS (Dérive du ton) | avancé | après **B1** (form inline) |
| 35 | `/embeddings` | QUALITÉ & COÛTS (Suivi des vecteurs) | avancé | après **M3** ; m14/m15 |
| 36 | `/external-links` | QUALITÉ & COÛTS (Liens externes) | avancé | loading.tsx (m14) |
| 37 | `/kb-readonly` | QUALITÉ & COÛTS (Base de connaissances) | avancé | loading.tsx (m14) |
| 38 | `/kb-readonly/[id]` | N3 (fiche) | — | OK |

### Pôle 6 — RÉGLAGES (pôle entièrement avancé)
| # | Route | Destination | Tier | Note |
|---|---|---|---|---|
| 39 | `/settings` | RÉGLAGES (hub) | avancé | ajouter kb-ingest (B3), chiffres (m10) |
| 40 | `/settings/providers` | N3 (hub) | — | Fournisseurs IA & budgets |
| 41 | `/settings/batches` | N3 (hub) | — | Cadence & parallélisme |
| 42 | `/settings/policies` | N3 (hub) | — | Règles éditoriales |
| 43 | `/settings/banned-phrases` | N3 (hub) | — | Expressions interdites |
| 44 | `/settings/llms-txt` | N3 (hub) | — | Fichier llms.txt |
| 45 | `/settings/coverage-distribution` | N3 (hub) | — | try/catch JSON (m5) |
| 46 | `/settings/audience-mix` | N3 (hub) | — | try/catch JSON (m5) |
| 47 | `/settings/search-intent-distribution` | N3 (hub) | — | Répartition intentions |
| 48 | `/settings/quality-loop` | N3 (hub) | — | Boucle d'amélioration |
| 49 | `/settings/benefit-gate` | N3 (hub) | — | Filtre bénéfice client |
| 50 | `/settings/qa-policies` | N3 (hub) | — | Règles Q-R |
| 51 | `/settings/kill-switch` | N3 (hub) | — | Arrêt d'urgence |
| 52 | `/settings/seed-initial` | N3 (hub) | — | Données initiales ; chiffres (m10) |
| 53 | `/settings/kb-ingest` | N3 (hub) | — | après **B3** (rattacher + feedback) |
| 54 | `/rss` | RÉGLAGES (Sources RSS) | avancé | — |
| 55 | `/rss/new` | N3 | — | Ajouter une source |
| 56 | `/rss/[id]` | N3 | — | après **B7** (câbler `updateRssSourceInDb`) |
| 57 | `/rss/import` | N3 | — | Import en masse |
| 58 | `/templates` | RÉGLAGES (Modèles de prompts) | avancé | — |
| 59 | `/templates/new` | N3 | — | try/catch JSON variables (m6) |
| 60 | `/templates/[id]` | N3 | — | après **B4+B5** ; champs inertes (m7) |
| 61 | `/keyword-tracking` | RÉGLAGES (Suivi des positions) | avancé | sync GSC |
| 62 | `/keyword-strategy` | **FUSION** → `/keyword-tracking` (onglet Stratégie) | avancé | dénominateur /6 + locale (m13) ; supprimer `KeywordStrategyView.tsx` (m4) |
| 63 | `/landing-variants` | RÉGLAGES (Variantes de landing) | avancé | après **M4** (toggle) |
| 64 | `/landing-variants/[variant]` | N3 | — | OK |
| 65 | `/author/manon` | RÉGLAGES (Profil auteur Manon) | avancé | ex-cmdk ; rebuild JSON-LD |

### Récapitulatif du mapping
- **65/65 routes placées.** Aucune oubliée.
- **Entrées nav (sidebar)** : 6 pôles ; ~36 items nav (dont ~13 simple, le reste avancé) ; les 14 sous-pages `/settings/*` + détails `[id]` en N3 hors sidebar.
- **Doublons FUSIONNÉS (5)** : `/queue`→`/jobs`, `/orchestrator`→`/content-gen`, `/geo/batches`→`/coverage`, `/geo/history`→`/coverage`, `/keyword-strategy`→`/keyword-tracking`. Redirections 308 conservées 6 mois. **0 capacité perdue.**
- **Routes MORTES retirées de la nav + redirigées (5)** : `/coverage/new`, `/monitoring`, `/geo/batches/new`, `/geo/batches/[id]`, `/geo/[villeSlug]/generate`. **Aucune supprimée sèchement.**

---

## 3. Tableau de RENOMMAGE du jargon (24 renommages)

| # | Ancien (jargon / actuel) | Nouveau (clair FR) |
|---|---|---|
| 1 | Générateur (tableau de bord) | Tableau de bord |
| 2 | Lancement ad-hoc / Dispatch un job | Générer une seule page |
| 3 | Jobs / Jobs content-gen | Générations en cours |
| 4 | Retry all failed | Relancer les échecs |
| 5 | Orchestrateur / Cockpit (géo) | Pilotage de la génération |
| 6 | Queue BullMQ / Inspecter BullMQ | File d'attente |
| 7 | File de revue / Review queue | À valider |
| 8 | Approuver (tier-2) / Promouvoir tier-1 | Approuver (page non indexée) / Mettre en avant (page indexée) |
| 9 | tier-1 / tier-2 / tier-3 | Indexée / Non indexée / Non suivie |
| 10 | Demote / Rollback / Draft (rollback) | Rétrograder / Revenir en arrière / Repasser en brouillon |
| 11 | Publications | Contenus publiés |
| 12 | IndexNow ping | Notifier les moteurs |
| 13 | Couverture villes (ambigu) | Couverture des villes |
| 14 | Équité villes | Équité entre villes |
| 15 | Ordre villes | Ordre de génération des villes |
| 16 | Anti-doublon (similarity/cosine/Jaccard) | Détection de doublons |
| 17 | Brand voice drift | Dérive du ton éditorial |
| 18 | Embeddings Backfill Monitor | Suivi des vecteurs de similarité |
| 19 | External Links Database | Liens externes |
| 20 | KB / KB entries | Base de connaissances / Fiches |
| 21 | Réglages génération + Anti-burst / Concurrency | Réglages génération + Cadence / Générations en parallèle |
| 22 | Benefit-gate / juge LLM PH3 | Filtre bénéfice client / Relecture par IA |
| 23 | Keyword tracking / Stratégie Keywords | Suivi des positions / Stratégie mots-clés |
| 24 | Sources RSS (news) / Templates de prompts / commande `pnpm tsx ...` | Sources RSS (actualités) / Modèles de prompts / bouton d'action (plus de CLI exposé) |

---

## 4. Maquettes ASCII

### 4.a — Sidebar du groupe `content_gen` (mode Simple, par défaut)

```
┌─ Génération de contenu ──────────────────┐
│  [ Simple ●───○ Avancé ]   ← toggle       │
│                                            │
│  ▸ LANCER                                  │
│      ➕ Nouvelle campagne                   │
│      ✨ Modèles prêts à l'emploi            │
│      (Premiers pas — si 1re visite)         │
│                                            │
│  ▾ SUIVRE                                  │
│      📊 Tableau de bord                     │
│      🗂️ Campagnes                           │
│      ⚙️ Générations en cours                │
│                                            │
│  ▸ PUBLIER                                 │
│      ✅ À valider                           │
│      📰 Contenus publiés                    │
│                                            │
│  ▸ VILLES                                  │
│      🏙️ Couverture des villes               │
│      🗺️ Carte de couverture                 │
│      🔢 Ordre de génération                 │
└────────────────────────────────────────────┘
        (Qualité & Coûts + Réglages masqués)
```

### 4.b — Sidebar mode Avancé (toggle ON → tout révélé)

```
┌─ Génération de contenu ──────────────────┐
│  [ Simple ○───● Avancé ]                  │
│                                            │
│  ▾ LANCER                                  │
│      ➕ Nouvelle campagne                   │
│      ✨ Modèles prêts à l'emploi            │
│      ⚡ Générer une seule page    [avancé] │
│                                            │
│  ▾ SUIVRE                                  │
│      📊 Tableau de bord                     │
│      🗂️ Campagnes                           │
│      ⚙️ Générations en cours                │
│      🎛️ Pilotage              [avancé]      │
│      ⏳ File d'attente        [avancé]      │
│                                            │
│  ▾ PUBLIER                                 │
│      ✅ À valider                           │
│      📰 Contenus publiés                    │
│      📋 Suivi (kanban)        [avancé]      │
│                                            │
│  ▾ VILLES                                  │
│      🏙️ Couverture des villes               │
│      🗺️ Carte de couverture                 │
│      🔢 Ordre de génération                 │
│      ⚖️ Équité entre villes   [avancé]      │
│      📐 Qualité données (pilote)[avancé]    │
│      🌍 Cockpit géo           [avancé]      │
│      📊 Tableau croisé        [avancé]      │
│                                            │
│  ▾ QUALITÉ & COÛTS            [avancé]      │
│      📈 Qualité du contenu                  │
│      💰 Coûts                               │
│      🔁 Détection de doublons               │
│      🎙️ Dérive du ton éditorial             │
│      🧮 Suivi des vecteurs                  │
│      🔗 Liens externes                      │
│      📚 Base de connaissances               │
│                                            │
│  ▾ RÉGLAGES                   [avancé]      │
│      ⚙️ Réglages génération (hub → 15)       │
│      📡 Sources RSS                         │
│      📋 Modèles de prompts                  │
│      🎯 Suivi des positions                 │
│      🧪 Variantes de landing                │
│      ✍️ Profil auteur (Manon)               │
└────────────────────────────────────────────┘
```

### 4.c — Wizard « Nouvelle campagne » (4 étapes)

```
┌──────────────────────────────────────────────────────────────┐
│  Nouvelle campagne                          ●──○──○──○  1/4    │
├──────────────────────────────────────────────────────────────┤
│  ÉTAPE 1 — Quoi générer ?                                      │
│                                                                │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│   │ 🏙️ Pages │ │ 📝 Blog  │ │ 📘 Guides│ │ ❓ Q-R   │         │
│   │  villes  │ │ articles │ │ piliers  │ │  / FAQ   │         │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│   ── ou partir d'un modèle prêt à l'emploi ──                  │
│   [ Article pilier ] [ Page ville ] [ Actualité ] …(presets)   │
│                                                                │
│   ↳ Raccourci : « Générer une seule page maintenant »          │
│                                          [ Suivant → ]          │
├──────────────────────────────────────────────────────────────┤
│  ÉTAPE 2 — Pour qui / où ?                  ○──●──○──○  2/4    │
│   Secteur / verticale : [ ▼ choisir ]                          │
│   Villes :  ( ) Toutes  (•) Métropoles  ( ) Sélection          │
│   Public visé (mix audiences) : [ ▼ défaut sûr ]               │
│                          [ ← Retour ]   [ Suivant → ]          │
├──────────────────────────────────────────────────────────────┤
│  ÉTAPE 3 — Combien / à quel rythme ?        ○──○──●──○  3/4    │
│   Volume / jour : [  20  ]                                     │
│   Rythme de publication (lissage) : [ ▼ Régulier ]            │
│   ▸ Personnaliser la répartition des types (avancé)            │
│                                                                │
│   ┌─ Estimation en direct ───────────────┐                    │
│   │  Coût estimé : ~ 42 $    Durée : ~3 j │  ← fix M7          │
│   └───────────────────────────────────────┘                    │
│                          [ ← Retour ]   [ Suivant → ]          │
├──────────────────────────────────────────────────────────────┤
│  ÉTAPE 4 — Vérifier & lancer                ○──○──○──●  4/4    │
│   Type ......... Pages villes                                  │
│   Cible ........ Restauration · Métropoles (12 villes)         │
│   Volume ....... 20/jour · ~240 contenus                       │
│   Coût est. .... ~42 $     Durée est. ... ~3 jours             │
│   Relecture .... (•) File de revue humaine  ( ) Auto           │
│                                                                │
│   [ 💾 Enregistrer comme modèle ]   [ 🚀 Lancer la campagne ]  │
│                                                                │
│   → après lancement : redirection vers /coverage/[id] (M8)     │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Plan d'implémentation Phase 3 (ordonné)

> Principe : **on répare AVANT de rattacher**. Une page n'entre dans la nav qu'une fois son flux réparé ; sinon elle reste en mode Avancé avec un badge « à réparer ». Migration V1/V2 : on touche les composants `_v2/` (V2 est la cible), V1 reste en fallback jusqu'à bascule sidebar.

### Étape A — Corriger les 7 flux cassés (prérequis de rattachement)
Ordre par visibilité (cf. §5 de l'audit) :
1. **B6** — Flux presets : lien direct `/campaigns/new?preset=<slug>` ; `campaigns/new/page.tsx` await `searchParams` ; `CampaignWizardV2` accepte `initialState` ; mapper slugs preset → `WizardContentType` (`blog_pillar`→`guide_pilier`). Débloque le pôle Lancer.
2. **B4 + B5** — `templates/[id]` « Tester » : propager `templateId` dans le payload BullMQ + lecture `dbJob.templateId` au worker (override) ; aligner `SearchIntentSchema` d'`enqueueDirectGen` sur l'enum DB (8 valeurs).
3. **B1** — `brand-voice-drift` : remplacer le `<Link>` mort `/recalibrate` par `<form action={recalibrateBrandVoice}>` inline.
4. **B2** — `geo/[villeSlug]/generate` : supprimer la route + redirection `/campaigns/new?ville=` ; retirer la CLI exposée.
5. **B7** — `rss/[id]` : câbler `<form action={updateRssSourceInDb}>` (réutiliser `RssFormClient`).
6. **B3** — `settings/kb-ingest` : ajouter au hub `SECTIONS` + capturer `accepted/rejected/rejectReason` via `useActionState`.

Embarquer aussi les fixes wizard liés : **M5** (`targetPerCity` masqué par défaut) + **M7** (poser `estimatedCostUsd/Duration` au create wizard) + **M8** (CTA → `/campaigns/new`, redirection post-lancement vers `/coverage/[id]`).

### Étape B — Restructurer le SSOT `admin-nav.ts` (cœur de cohérence)
1. **Étendre `AdminNavItem`** : ajouter 3 champs optionnels :
   - `subGroup?: string` (le pôle : `'lancer' | 'suivre' | 'publier' | 'villes' | 'qualite' | 'reglages'`),
   - `tier?: 'simple' | 'advanced'` (défaut `'simple'`),
   - `parent?: string` (href parent pour les N3 résolus en breadcrumbs, sans apparaître en sidebar).
2. Ajouter `CONTENT_GEN_POLE_LABELS` + `CONTENT_GEN_POLE_ORDER` (les 6 pôles ci-dessus, dans l'ordre fréquence).
3. **Réécrire les ~17 items `group: 'content_gen'`** en ~36 items taggés `subGroup` + `tier`, avec les libellés clairs du §3.

### Étape C — Aligner les 3 consommateurs du SSOT (fin du drift PR5)
1. **`AdminSidebar.tsx`** (`src/components/admin/AdminSidebar.tsx`) : rendre, pour `content_gen`, les pôles en accordéon (regroupés par `subGroup`) + un toggle Simple/Avancé en tête de groupe (état persisté localStorage ; en Simple, masque `tier:'advanced'` et les pôles Qualité+Réglages). Garder le rendu plat pour les autres groupes (zéro régression).
2. **`AdminCommandPalette.tsx`** (`src/app/[locale]/(admin)/[adminPrefix]/AdminCommandPalette.tsx`) : **supprimer la liste hardcodée**, consommer `buildAdminNav()` — fin du drift. La palette voit TOUS les items (simple + avancé), donc aucune route accessible « cmdk-only » ne disparaît.
3. **`AdminBreadcrumbs.tsx`** (`src/components/admin/ui/AdminBreadcrumbs.tsx`) : résoudre pathname → pôle → page via le SSOT, y compris les N3 (`parent`) — les libellés clairs deviennent la source unique.

### Étape D — Hubs & wizard
1. **Wizard** : appliquer les 4 étapes du §4.c (presets en étape 1, estimation coût en étape 3, récap lisible en étape 4, redirection `/coverage/[id]`).
2. **Hub `/settings`** : ajouter `kb-ingest` aux SECTIONS, corriger chiffres périmés (m10 : 290/8/14).
3. **Fusions en onglets** : `/jobs?view=queue` (File d'attente), `/content-gen` (absorbe Pilotage KPIs), `/keyword-tracking` onglet Stratégie.

### Étape E — Redirections (jamais de suppression sèche)
1. **MORT→REDIR** (permanent 308/301, retiré de la nav) : `/coverage/new`→`/campaigns/new` (propager query), `/monitoring`→`/jobs?status=failed`, `/geo/batches/new`→`/campaigns/new`, `/geo/batches/[id]`→`/coverage/[id]`, `/geo/[villeSlug]/generate`→`/campaigns/new?ville=`.
2. **FUSION** (308 conservé 6 mois) : `/queue`→`/jobs?view=queue`, `/orchestrator`→`/content-gen`, `/geo/batches`+`/geo/history`→`/coverage`, `/keyword-strategy`→`/keyword-tracking`.
3. Supprimer le code mort : `KeywordStrategyView.tsx`, imports morts `coverage/page.tsx`, `backfillRssSourcesFromJsonConfig`.

### Étape F — Mineurs de propreté (en fin de chantier)
m1-m17 restants (gating onboarding, filtres statuts, Zod sync, try/catch JSON, tokens admin couleurs, `loading.tsx`, `COST_PER_TOKEN` centralisé, pagination bornée, commentaires périmés).

### Garde-fous transverses
- **Web Vitals** : nav admin hors des 15 pages stratégiques publiques, mais respecter First Load JS ; le toggle = état client léger (pas de gros bundle).
- **Build stub.invalid** (ADR 0026) : aucune nouvelle page SSG ; les pages admin sont `force-dynamic`, non concernées par le stub Proxy.
- **Zéro capacité perdue** : chaque route fusionnée/morte a une redirection ; chaque item avancé reste accessible via toggle + cmdk.

---

*Décision finale. Squelette « tâche » (proposition 1) + toggle Simple/Avancé défaut-Simple (proposition 2) + ordre par fréquence (proposition 3). 65/65 routes mappées, 24 renommages, 6 pôles, 1 point d'entrée de lancement.*
