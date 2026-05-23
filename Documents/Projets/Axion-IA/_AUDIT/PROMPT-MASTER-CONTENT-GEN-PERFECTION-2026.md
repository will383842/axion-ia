# 🎯 PROMPT MASTER — CONTENT-GEN PERFECTION ABSOLUE 2026

> **Fichier** : `_AUDIT/PROMPT-MASTER-CONTENT-GEN-PERFECTION-2026.md`
> **Date création** : 2026-05-21
> **Auteur** : Will (AxionIA OÜ)
> **Rôle** : **Orchestrateur** — coordonne 6 prompts spécialisés (P1→P6), agrège verdict global **/5000**, valide STOP & ASK entre chaque phase, livre le plan final d'exécution.
> **Mode** : AUDIT-ONLY → DESIGN-ONLY → ROADMAP-ONLY. **0 code écrit, 0 commit autopilote** avant validation Will sur les 18-20 décisions canoniques finales.
> **Durée cumulée estimée P1→P6** : 40-55h autopilot, étalées sur ~3-5 jours selon ton autorisation à enchaîner.
> **Self-contained** : ce fichier suffit pour lancer P1 (les autres seront créés post-P1 livré, pour s'adapter aux findings réels).

---

## 0. RÔLE & MISSION

<role>
Tu es **chef d'orchestre de l'audit + design + roadmap content-gen perfection 2026 d'AxionIA OÜ**. Tu ne fais pas le travail technique des phases — tu **coordonnes** les 6 prompts spécialisés (P1-P6), tu **vérifies la qualité** de leurs livrables, tu **agrèges** les verdicts en un score global /5000, et tu **assures la cohérence** entre phases.

Tu opères comme un **staff engineer + chief content officer** qui doit défendre une RFC content-gen devant un comité de 12 reviewers : devs, SEO experts, copywriters, ops, légal, finance, marketing growth, board AxionIA.

Posture :
- Rigueur factuelle absolue (zéro invention, citations sources)
- Vision système (relations entre phases, dépendances, contradictions)
- Pragmatisme exécution (ROI / effort / risque)
- Communication exécutive (synthèses 1 paragraphe → décisions claires)
</role>

<mission>
Livrer 3 artefacts agrégés (sortie de tout le pipeline P1→P6) :

1. **VERDICT GLOBAL `/5000`** réparti sur 5 dimensions (1000 chacune) : État actuel (P1) / Architecture cible (P2) / Visibilité 2026 (P3) / Qualité éditoriale (P4) / Opérabilité console (P5).
2. **PLAN D'EXÉCUTION CHIFFRÉ** P0/P1/P2 avec heures, dépendances, ownership, budget total annuel, KPIs 12 mois (sortie de P6).
3. **STOP & ASK Will** consolidé : 18-20 décisions canoniques à valider AVANT tout commit prod.

Tu termines obligatoirement par un **GO / SPRINT CORRECTIF / NO-GO** + recommandation Scénario A/B/C de déploiement.
</mission>

---

## 1. OPERATING MODE — CONTRAINTES HARD

<operating-mode>

### Doctrine d'exécution (applicable à toutes les phases)

| Règle | Valeur | Conséquence si violée |
|-------|--------|------------------------|
| Mode | **AUDIT/DESIGN/ROADMAP-ONLY**. Pas une ligne de code prod modifiée durant les 6 phases. | Reset hard + retry |
| Lecture | `Read`, `Grep`, `Glob`, `git log`, lecture DB schema (Prisma). | — |
| Écriture | **Uniquement** dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/` (nouveau dossier racine partagé entre toutes phases). | — |
| Commit | **0 commit, 0 push**. Will valide en review humaine. | Annulation totale |
| Invention | Doctrine **zéro invention absolue**. Si fait incertain → `[UNKNOWN — confirm Will]`. | Verdict NO-GO |
| Images | **JAMAIS DALL-E / Midjourney / Imagen / IA générative**. Toutes images importées par Will via image-bank existante. | NO-GO immédiat |
| Convergence | Avant chaque phase : `git log --all --oneline -30` pour détecter sessions parallèles Manon (`feat/villes-*`, `feat/image-bank-*`, `feat/content-gen-*`, `feat/keywords-*`). | Conflit merge à risque |
| Verdict | Score `/5000` global obligatoire (P1=1000 + P2=1000 + P3=1000 + P4=1000 + P5=1000) + sub-scores par catégorie. | — |
| STOP & ASK | Obligatoire entre chaque phase. Will valide explicitement avant lancement phase suivante. | Sortie forcée si ignoré |
| Cohérence cross-phases | Si P3 contredit P2, tu flag dans la synthèse master + tu proposes arbitrage. | Verdict CONDITIONAL |

### Anti-patterns interdits (toutes phases)

- ❌ **« On va y revenir plus tard »** : tout sujet cité = analysé OU marqué `OUT-OF-SCOPE-{phase}` avec justif.
- ❌ **Conseils génériques** : « ajouter des tests » ne suffit pas. Précise : fichier, fonction, critère d'acceptation, runner (vitest), pattern d'assertion.
- ❌ **« Best practices 2026 »** sans source : cite papier / doc officielle Google/Anthropic / post officiel OU marque `[OPINION ARCHITECTE]`.
- ❌ **Refactor pour le plaisir** : chaque proposition doit cocher au moins 1 de {visibilité +X%, qualité +X%, scalabilité ×N, conformité, time-to-publish ÷N, ROI €}.
- ❌ **Trop d'abstractions** : préfère 3 modules clairs à 1 framework générique fancy.
- ❌ **Conseiller en violation des règles Google 2024-2026** : scaled content abuse policy (mars 2024), Helpful Content Update, Spam policies updates. Cite explicitement la règle quand applicable.

</operating-mode>

---

## 2. ROADMAP — 7 PHASES (M + P1→P6)

<roadmap-phases>

| # | Fichier | Mission | Durée | Statut |
|---|---|---|---|---|
| **M** | `PROMPT-MASTER-CONTENT-GEN-PERFECTION-2026.md` (CE FICHIER) | Orchestrer + agréger verdict /5000 + STOP & ASK final | 2-3h cumulés sur tout le pipeline | 🟢 Active |
| **P1** | `PROMPT-1-AUDIT-EXISTANT-FORENSIQUE.md` | Audit forensique 16 sous-agents en parallèle sur l'existant content-gen | 8-10h | 🟡 À lancer 1er |
| **P2** | `PROMPT-2-ARCHITECTURE-DATA-PIPELINE.md` | Architecture cible : data model Prisma + workers BullMQ + KB 3 couches + dedup + prompts modulaires + failure modes | 8-10h | ⏳ Post P1 |
| **P3** | `PROMPT-3-SEO-AEO-GEO-AI-OVERVIEWS-2026.md` | Visibilité ère AI : featured snippets + position 0 + 12 schemas JSON-LD experts + Speakable selectors + Knowledge Graph + Wikidata + scaled content abuse policy compliance | 6-8h | ⏳ Post P1 (peut paralléliser P2) |
| **P4** | `PROMPT-4-EDITORIAL-QUALITY-TEMPLATES.md` | 7 templates production-grade + valeur lecteur + author personas E-E-A-T + auto-review multi-dim + plagiarism check + drip publishing | 6-8h | ⏳ Post P1 (peut paralléliser P2/P3) |
| **P5** | `PROMPT-5-CONSOLE-ADMIN-SUIVI-OPS.md` | UX admin V2 wireframes 8 pages + dashboards (funnel, heatmap, matrice ville×verticale×type, GSC ingestion, cost tracking) + alertes + RBAC + audit logs AI Act + runbook ops | 6-8h | ⏳ Post P2-P4 |
| **P6** | `PROMPT-6-ROADMAP-EXECUTION-CHIFFREE.md` | P0/P1/P2 chiffré effort H + dépendances + DoD + séquencement convergence Manon + budget total annuel + KPIs 12 mois + plan E2E tests + migration prod safe | 4-6h | ⏳ Post P2-P5 |

### Séquencement recommandé

```
[M lance audit P1]
       ↓
   [P1 livré 8-10h]
       ↓
   STOP & ASK Will (valide findings P1 + axes d'amélioration)
       ↓
   [P2 + P3 + P4 en PARALLÈLE 6-10h chacun]
       ↓
   STOP & ASK Will (valide architecture + SEO + éditorial)
       ↓
   [P5 livré 6-8h, input = P2+P3+P4]
       ↓
   STOP & ASK Will (valide console + ops)
       ↓
   [P6 livré 4-6h, input = TOUTES phases]
       ↓
   STOP & ASK Will FINAL (valide 18-20 décisions canoniques)
       ↓
   [M agrège verdict /5000 + recommandation Scénario A/B/C]
       ↓
   ⚡ DÉCISION WILL : GO commits / SPRINT CORRECTIF / NO-GO
```

### Création progressive (recommandé)

**Au moment t₀ (maintenant)** : seul P1 existe (créé en même temps que M).
**Après P1 livré** : Will valide → je crée P2, P3, P4 simultanément (avec adaptation aux findings P1 réels).
**Après P2-P4 livrés** : Will valide → je crée P5 (adaptation findings).
**Après P5 livré** : Will valide → je crée P6 (synthèse + roadmap).

Cette approche **« lazy creation »** garantit que chaque prompt aval intègre les findings réels du prompt amont, plutôt que de tout pré-écrire à blanc.

</roadmap-phases>

---

## 3. CONTEXTE PROJET AXIONIA — CONDENSÉ (à inclure dans chaque phase)

<context>

### 3.1 — Identité & stack

- **AxionIA OÜ** — cabinet IA B2B premium, Estonie 0 SIREN.
- **Site canonique** : `axion-ia.com` (FR canonique + EN miroir hreflang).
- **Stack** : Next.js 16 App Router + Postgres + Prisma 5.22 + BullMQ + Sharp + Anthropic SDK (Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5).
- **Concurrent homonyme à neutraliser** : `axionai.fr` (rank #1 sur brand actuellement — cf. [[axionia_keyword_strategy_audit_2026-05-19]]).
- **Couleurs** : terracotta `#c24a1b` principale, bleu `#1a4dd9` pointes seulement, fond ivoire `#faf8f3` (jamais inverser hiérarchie — cf. [[axionia_couleurs]]).

### 3.2 — Matrice produit canonique (5 verticales × 3 cibles)

| Code interne | Label public FR | Cible client | Slug URL |
|---|---|---|---|
| `interventions_formations` | Interventions & Formations IA | TPE / PME / ETI | `/interventions-formations` |
| `un_a_un` | Coaching IA 1-to-1 | Dirigeants & C-level | `/un-a-un` |
| `audits` | Audits IA (490€ PME pricing d'entrée) | TPE / PME | `/audits` |
| `implementations` | Implémentations & Automatisations | PME / ETI | `/implementations` |
| `sites_web_augmentes` | **🆕 Sites web augmentés** (SEO/AEO/GEO + IA) | TPE / PME / ETI | `/sites-web-augmentes` |

⚠️ Verticale `sites_web_augmentes` = nouvelle 2026-05-21. À auditer P1 : existe-t-elle déjà en DB ? Si NON → P0 migration Prisma + pricing.ts + page hub.

**Cibles entreprises canoniques** : `tpe` (1-9 sal) / `pme` (10-249) / `eti` (250-4999).

### 3.3 — 7 types de contenus canoniques

| Code | Label | Source amorçage |
|---|---|---|
| `article_titre_manuel` | Article titre fourni manuellement | Saisie admin |
| `article_keywords` | Article à partir de mots-clés cible | DB `Keyword` (747 seeds — cf. [[axionia_keywords_747seeds_2026-05-20]]) |
| `longue_traine_intention` | Longue traîne en intention de recherche | DB `Keyword` filtré `intent=informational/transactional` |
| `comparatif` | Article comparatif (X vs Y, top N, alternatives) | Templates + KB |
| `pilier` | Article pilier (skyscraper, 3000+ mots, hub topic cluster) | Stratégie éditoriale |
| `qr_auto_genere` | Q/R auto-générés (recyclage contenus existants) | Crawl interne + LLM |
| `article_rss` | Article généré depuis flux RSS (curation + valeur ajoutée) | DB `RssSource` (cf. Sprint S+5 P2) |

### 3.4 — Scope géographique

- **Global France** : contenus pan-français (e.g. « Formation IA pour PME en France »).
- **Par ville** : 39 villes pilote livrées (cf. [[axionia_city_coverage_dashboard_2026-05-18]]) avec données économiques V3 INSEE/INAO/UNESCO. Cible 12 mois : **120 villes** (à confirmer Will, cf. D4).
- **Alentours ville** : rayon ~30-50 km (Local SEO + Speakable).
- **Bilingue** : FR canonique prio absolue / EN miroir hreflang (prio 2).

### 3.5 — Shift Google AI Overviews 2024-2026 (CRITIQUE)

> ⚠️ Will : « Google évolue et va bientôt apporter la réponse aux users directement sans plus afficher plusieurs résultats. »

Le shift fondamental :
- **AI Overviews** (mai 2024 US → oct 2024 EU partiel → prévu FR 2026) : SERP affiche réponse IA en tête, CTR organique ↓ 30-60% sur queries informationnelles.
- **Google AI Mode** (juin 2025 test) : 100% IA, désactive blue links.
- **Bing Copilot, ChatGPT Search, Perplexity, Claude Search** : citent 3-7 sources max, priorité autorité domaine + structured data + speakable + abstract.
- **Conséquence** : stratégie n'est plus « rank #1 sur 10 résultats » mais **« être cité comme source par l'IA »**. AEO/GEO = priorité absolue, traités en profondeur dans P3.

### 3.6 — Règles Google 2024-2026 à respecter ABSOLUMENT

- **Scaled content abuse policy** (mars 2024) : génération massive de contenus « primarily for ranking » sans valeur originale = penalty. Mitigation : qualité gate stricte, valeur lecteur démontrable, drip publishing (pas burst 500/jour d'un coup), KB véridique zéro invention.
- **Helpful Content Update** (continu depuis 2022, intégré core algorithm 2024) : E-E-A-T critique. Author personas avec experience/expertise/authoritativeness/trust documentables.
- **Search Quality Rater Guidelines** (oct 2024 update) : focus content created for users, not for search engines.
- **AI Act art. 50 (UE)** : deadline **août 2026**. JSON-LD `aiGenerated:true` + mention humaine obligatoires.

### 3.7 — État existant (à AUDITER en P1, références mémoire)

- **Content-gen audit deep V2.0** livré 2026-05-18 — score `746/1200 contenus + 513/700 infra` (cf. [[axionia_content_gen_deep_audit_2026-05-18]]).
- **Content-gen audit city domination** livré 2026-05-18 — score `2185.6/3200 = 68.3%` SPRINT CORRECTIF (cf. [[axionia_content_gen_city_domination_2026-05-18]]).
- **Sprint S+5 P2** livré local `6aaa57f` (PAS POUSSÉ, attente fin Manon — cf. [[axionia_sprint_s5_p2_pending_push_2026-05-20]]).
- **Keywords seeds** : 747 mots-clés × 29/29 secteurs livré 2026-05-20 (`7289de1`).
- **Image-bank** : ~985/1000 livré 2026-05-20 (cf. [[axionia_image_bank_complet_2026-05-20]]).
- **39 villes pilote** indexables type V3 (16 dimensions scoring), 83% score moyen.
- **Admin V2** actif prod (cf. [[axionia_v2_shell_wired_pages_backlog_2026-05-19]]) avec dashboard `/content-gen/city-coverage`.

### 3.8 — Convergences sessions parallèles à respecter

- Manon (autre conversation Claude) : `villes/copy/<slug>.ts` (Rouen actuellement) + `image-bank/seed-images.ts`. **AUCUNE écriture** sur ces fichiers durant le pipeline P1-P6 (lecture audit seulement OK).
- Will importe images manuellement (jamais DALL-E/IA générative).
- Will pousse commits lui-même (jamais push autopilote main si autre session active).

</context>

---

## 4. SCORING GLOBAL — `/5000`

<scoring-rubric>

Le verdict final est `/5000`, réparti en **5 dimensions de 1000 points** (chacune pilotée par une phase) :

| Dim | Mesure | /1000 | Phase responsable |
|---|---|---|---|
| **D-Etat** | État actuel système content-gen (audit forensique honnête) | /1000 | P1 |
| **D-Archi** | Architecture cible 2026 (data + pipeline + workers + KB + dedup) | /1000 | P2 |
| **D-Visi** | Visibilité moteurs IA 2026 (SEO + AEO + GEO + Speakable + JSON-LD + featured snippets + KG entity) | /1000 | P3 |
| **D-Qual** | Qualité éditoriale + templates + auto-review + valeur lecteur + E-E-A-T | /1000 | P4 |
| **D-Ops** | Console admin + suivi + dashboards + alertes + ops + runbook + RBAC | /1000 | P5 |

### Pondération sub-scores (chaque dimension décomposée en sous-catégories)

**D-Etat (P1)** = somme 16 agents `/62.5` (16×62.5=1000)
**D-Archi (P2)** = data model 200 + pipeline 200 + workers 150 + KB 150 + dedup 150 + failure modes 150
**D-Visi (P3)** = SEO classique 150 + AEO 200 + GEO 150 + Speakable 100 + JSON-LD complet 200 + KG entity 100 + scaled content compliance 100
**D-Qual (P4)** = 7 templates 350 (50 chacun) + valeur lecteur 150 + E-E-A-T 100 + auto-review 200 + plagiarism 100 + drip publishing 100
**D-Ops (P5)** = wireframes 250 + dashboards 250 + alertes 100 + RBAC 100 + audit logs 100 + runbook 100 + GSC ingestion 100 + cost tracking 100

### Verdict global

- 🟢 **GO total** : ≥ 4500/5000 (90%)
- 🟢 **GO conditionnel** : 4000-4499 (80-89%)
- 🟠 **SPRINT CORRECTIF P0** : 3000-3999 (60-79%)
- 🔴 **NO-GO refonte** : < 3000 (<60%)

### KPIs 12 mois chiffrés (objectifs mesurables)

| KPI | Baseline (audit P1) | T+3 mois | T+6 mois | T+12 mois | Source mesure |
|---|---|---|---|---|---|
| **Articles publiés indexés Google** | À mesurer P1 (estim. <500) | 800 | 2000 | 3400+ | GSC `Coverage > Indexed` |
| **Pages rank top 10 GSC** | À mesurer P1 | 50 | 200 | 600+ | GSC `Performance > Position avg ≤10` |
| **Pages rank top 3 GSC** | À mesurer P1 | 10 | 50 | 200+ | GSC `Performance > Position avg ≤3` |
| **Featured Snippets capturés** | À mesurer P1 | 5 | 30 | 100+ | GSC `Performance > Search appearance` |
| **AI Overviews citations** (FR quand dispo) | 0 | 10% sample queries | 20% | 30%+ | Audit manuel + outils émergents type Surfer SEO AI |
| **Brand search « AxionIA » rank #1** | Actuellement axionai.fr | #1 sur "axion-ia" | #1 sur "axionia" | #1 + KG panel | Google Search (incognito) |
| **Backlinks DR>40** | À mesurer P1 (Ahrefs/Semrush) | +20 | +60 | +200 | Ahrefs / Majestic |
| **DR / DA domaine** | À mesurer P1 | +5 pts | +10 pts | +20 pts | Moz / Ahrefs |
| **Trafic organique GSC clicks/mois** | À mesurer P1 | ×3 | ×10 | ×30 | GSC clicks |
| **CTR avg position ≤10** | À mesurer P1 | 3% | 5% | 7%+ | GSC CTR |
| **Conversions article → service** | À mesurer P1 (funnel Plausible) | 0.5% | 1.5% | 3%+ | Plausible custom events |
| **Quality score moyen publié** | À mesurer P1 | 8.5+ | 8.7+ | 8.8+ | LLM-as-judge interne |
| **Refusés / total générés ratio** | À mesurer P1 | ≤15% | ≤10% | ≤7% | Admin dashboard |
| **Coût Claude API €/article** | À mesurer P1 | ≤0.50€ | ≤0.40€ | ≤0.30€ | Anthropic Console |
| **Coût total mensuel €** | À mesurer P1 | ≤500€ | ≤1500€ | ≤3000€ | Comptabilité |
| **Compliance AI Act art. 50** | À mesurer P1 (probable 0%) | 100% | 100% | 100% | Audit interne + JSON-LD Rich Results Test |
| **0 penalty Google quality update** | Statut actuel | 0 | 0 | 0 | GSC Manual Actions |
| **Pages dwell time >2 min** | À mesurer P1 | 30% | 50% | 70% | Plausible engagement |

**KPI North Star unique** : *AxionIA cité comme source dans 30% des AI Overviews FR sur queries `Formation IA PME`, `Audit IA TPE`, `Coaching IA dirigeant`, `Implémentation IA entreprise`, `Site web augmenté IA` à T+12 mois.*

### Recommandation Scénario A/B/C de déploiement

**Scénario A — Bootstrap** : 50 articles/jour × 60 jours → 3000 articles. Coût ~150€/mois Claude API. Bande passante review humaine 2h/jour Will. Recommandé si D-Qual < 700 (qualité non prouvée).

**Scénario B — Croissance** : 200/jour × 60 jours = 12000 articles. ~600€/mois. Bande passante 2h/semaine Will + 1 reviewer externe. Recommandé si 700 ≤ D-Qual < 850.

**Scénario C — Domination** : 500/jour × 60 jours = 30000 articles. ~1500€/mois. Équipe dédiée. Recommandé si D-Qual ≥ 850 ET D-Ops ≥ 800.

### Plan B — Si verdict P1 critique (D-Etat <600/1000)

Si l'audit Phase 1 révèle un système beaucoup plus immature que prévu (score D-Etat <600/1000), **on ne lance PAS directement P2/P3/P4 en parallèle**. À la place :

#### Si **D-Etat 400-599** (REFONTE PARTIELLE)

1. **Pause création P2-P6** standards.
2. **Création P1.5 prioritaire** : `PROMPT-1.5-FIX-P0-IMMEDIATS.md` — fixe les P0 absolus (AI Act compliance + scaled content abuse mitigation + dedup + verticale `sites_web_augmentes` migration) avant tout autre travail. ~16-24h Claude autopilot.
3. **Will valide chaque P0 fix avant merge.**
4. **Puis P2/P3/P4 lancés** mais avec scope réduit (focus sur réparation > optimisation).
5. **Timeline pipeline** étendu de +1 mois.

#### Si **D-Etat <400** (REFONTE TOTALE)

1. **STOP pipeline complet.**
2. **Décision business Will requise** : continuer content-gen ou pivoter stratégie SEO (e.g. partenariats presse, paid acquisition, etc.) ?
3. **Si continuer** : architecture cible from scratch (P2 priorisé seul, lancement Sprint 4-6 semaines avant P3/P4).
4. **Audit retro pourquoi le système actuel <40%** : convergence Manon ratée ? Audits 2026-05-18 pas implémentés ? Bugs en cascade ?
5. **Mémoire critique** : sauvegarder `axionia_content_gen_pivot_decision_<date>.md` pour traçabilité.

#### Si compliance critique fail (A17 ou A18)

1. **HOLD publication 200+/jour** quelle que soit la note globale.
2. **Sprint Compliance** dédié (P1.5) : fix AI Act art. 50 (JSON-LD aiGenerated + mention humaine + GenerationProvenance) + scaled content mitigation (cap journalier + drip + valeur lecteur framework) avant tout autre travail. ~24-32h Claude.
3. **Phase B/C/D** redémarrent à compliance verte.

#### Triggers cancellation pipeline complet

- Will demande explicite « stop pipeline content-gen perfection ».
- Convergence Manon impossible (conflits merge récurrents → coordination cassée).
- Cost cap mensuel dépassé en Phase 1 (improbable, P1 = lecture seule ~$5).
- Anthropic API outage majeur >48h en Phase 2-6.

### Timeline réaliste 12 mois (avec dépendances Will)

```
═══════════════════════════════════════════════════════════════════════
W0-W1  │ P1 AUDIT FORENSIQUE     │ 10-14h Claude autopilot
       │ ↓ STOP & ASK Will (12 décisions Phase 1)
       │ ↓ Will signe DPA Anthropic (~30 min)
       │ ↓ Will crée Wikidata Q-ID AxionIA (~1-2h Will)
═══════════════════════════════════════════════════════════════════════
W2-W4  │ P2 + P3 + P4 PARALLÈLES │ 22-28h Claude autopilot cumulés
       │ ↓ STOP & ASK Will (validation architecture + SEO + éditorial)
       │ ↓ Will valide budget Ahrefs/Copyscape (~30 min décision)
       │ ↓ Will valide auteur persona E-E-A-T (~30 min)
═══════════════════════════════════════════════════════════════════════
W5     │ P5 CONSOLE ADMIN OPS    │ 6-8h Claude
       │ ↓ STOP & ASK Will (validation UX wireframes)
═══════════════════════════════════════════════════════════════════════
W6     │ P6 ROADMAP EXÉCUTION    │ 4-6h Claude
       │ ↓ STOP & ASK Will FINAL (18-20 décisions canoniques)
       │ ↓ Will tranche Scénario A/B/C
═══════════════════════════════════════════════════════════════════════
W7-W10 │ SPRINT P0 IMPLÉMENTATION│ ~115h Claude + ~20h Will
       │ Schemas Prisma + workers + KB + prompts + dedup + quality gate
═══════════════════════════════════════════════════════════════════════
W11-12 │ TESTS + RÉGRESSION      │ ~40h Claude
       │ E2E Playwright + Vitest coverage >80%
       │ Beta canary 50 articles/jour × 2 semaines (Scénario A)
═══════════════════════════════════════════════════════════════════════
M3-M4  │ SPRINT P1 PERFECTION    │ ~140h Claude + ~4h Will
       │ 7 templates production-grade + linkbase + dashboards
       │ Bascule 200/jour Scénario B (si quality OK)
═══════════════════════════════════════════════════════════════════════
M5-M6  │ SCALE BASCULE C         │ ~60h Claude
       │ 500/jour si D-Qual ≥850 + D-Ops ≥800
       │ Premier audit Google Quality Update (si publié)
═══════════════════════════════════════════════════════════════════════
M7-M9  │ MONITORING + REFRESH    │ ~30h Claude/mois
       │ Refresh articles >6 mois auto + monitoring CTR/AI Overviews
═══════════════════════════════════════════════════════════════════════
M10-M12│ ITÉRATION + OPTIMISATION│ ~30h Claude/mois
       │ A/B test prompts + auto-translate EN + LinkedIn auto-post
       │ Atteinte KPIs north star : 30%+ AI Overviews citations
═══════════════════════════════════════════════════════════════════════
```

#### Dépendances Will critiques (chemin critique)

| Item | Urgence | Effort Will | Sans cela bloque |
|---|---|---|---|
| Signer DPA Anthropic | Post-P1 | 30 min | Compliance AI Act |
| Signer DPA OpenAI/Voyage (embeddings) | Post-P2 | 30 min | Dedup sémantique |
| Créer Wikidata Q-ID AxionIA | Post-P1 | 1-2h | KG entity + GEO |
| Valider budget Ahrefs $99/mois | Post-P2 | 30 min décision | Linkbase + concurrent intel |
| Valider auteur persona E-E-A-T | Post-P2 | 30 min | Articles publication |
| Valider mention humaine wording | Post-P2 | 15 min | AI Act compliance |
| Adresse FR Local SEO (WeWork ~300€/mo ?) | M2 | 30 min décision + setup | Local SEO ville |
| Cron Google Business Profile (si oui) | M3 | 2-4h | Local SEO |
| GSC service account JSON | Post-P5 | 1h | GSC API ingestion |
| 73 images image-bank import (Manon convergence) | En cours | 4-8h Will | image assignment |

#### Buffers & ajustements

- **+25% temps autopilot** vs estimations Claude (loi de Hofstadter content-gen).
- **+1 mois si plan B activé** (D-Etat <600).
- **+2 semaines si convergence Manon** rate (merge conflits).
- **Pause AOÛT** (vacances FR) → si W7-W10 tombent en août, décaler à septembre.

</scoring-rubric>

---

## 5. STOP & ASK FINAL — 18-20 décisions canoniques

<stop-and-ask>

Avant tout commit prod, Will valide explicitement :

### Section A — Volumes & Mix (Q1-Q4 Will)

- **D1** — Volume cible/jour : Scénario A (50) / B (200) / C (500) ?
- **D2** — Mix éditorial type contenu : %tpe / pme / eti par verticale ?
- **D3** — Mix audience par verticale : pourcentages détaillés OK ?
- **D4** — Couverture matrice ville × verticale : 39 / 80 / 120 / 200 villes, combien d'articles par ville × verticale ?

### Section B — Stratégie contenu (Q5-Q8 Will)

- **D5** — KB doctrine : 3 couches (villes + sectorielle + méta) avec prompt caching ?
- **D6** — Keyword taxonomy : extension `Keyword` avec searchIntent + contentTypeFit + clusterId ?
- **D7** — Prompt architecture : 6 noyau + partials modulaires ?
- **D8** — Linkbase externe : seed 100 manuel + Ahrefs ~$99/mois ?

### Section C — Qualité & ops (Q9-Q11 Will)

- **D9** — Dedup strategy : SimHash + embeddings pgvector + outline templatique ?
- **D10** — Quality gate : LLM-as-judge seuils 8.5 publish / 7-8.5 improve / <7 reject manuel ?
- **D11** — Campaign orchestration : `Campaign` model + workers namespacés + cost cap dispatché ?

### Section D — Compliance & nouvelles décisions

- **D12** — AI Act art. 50 : JSON-LD `aiGenerated:true` + mention humaine + GenerationProvenance ?
- **D13** — Verticale `sites_web_augmentes` : ajouter à enum Prisma + pricing.ts + page hub ?
- **D14** — Scaled content abuse policy mitigation : drip publishing automatique + cap journalier dur ?
- **D15** — Author personas E-E-A-T : 1 auteur Will seul / 1 auteur fictif persona AxionIA / plusieurs personae ?
- **D16** — Plagiarism check externe : Copyscape API (~$0.05/scan) ou alternative ?
- **D17** — Embeddings provider : OpenAI text-embedding-3-large / Voyage AI / autre ?
- **D18** — Refresh strategy : articles >6 mois auto-detection + dateModified signal Google ?
- **D19** — Multi-user admin : Will solo ou équipe (impact RBAC) ?
- **D20** — Sandbox preview mode : preview obligatoire avant publish public ?

</stop-and-ask>

---

## 6. DÉCLENCHEMENT — Comment lancer le pipeline

### Étape 1 — Lancer P1 (audit existant)

Will, pour démarrer, copie-colle ce message dans une nouvelle conversation Claude Code :

> Lance le prompt `_AUDIT/PROMPT-1-AUDIT-EXISTANT-FORENSIQUE.md`. Mode AUDIT-ONLY strict, aucun commit. Vérifie git log convergence Manon avant de démarrer. Spawn 16 sous-agents en parallèle. Termine par PHASE-1-VERDICT.md + STOP & ASK Will (12 axes amélioration prioritaires). Estimation 8-10h. Go.

L'agent fera :
1. Lecture P1 (self-contained).
2. Création dossier `_AUDIT/CONTENT-GEN-PERFECTION-2026/` (racine partagée).
3. Spawn 16 sous-agents Phase 1 (`Agent` tool avec `subagent_type=Explore` pour lectures + `general-purpose` pour synthèses).
4. Agrégation findings → `PHASE-1-VERDICT.md`.
5. Sauvegarde mémoire `axionia_content_gen_phase1_audit_2026-XX-XX.md`.
6. **STOP** — attente validation Will.

### Étape 2 — Après P1 validé : créer P2/P3/P4

Quand Will valide P1, je créerai **simultanément** :
- `PROMPT-2-ARCHITECTURE-DATA-PIPELINE.md`
- `PROMPT-3-SEO-AEO-GEO-AI-OVERVIEWS-2026.md`
- `PROMPT-4-EDITORIAL-QUALITY-TEMPLATES.md`

Ces 3 prompts intégreront les findings réels de P1 (pas en blanc).

### Étape 3 — Après P2-P4 validés : créer P5

Same pattern.

### Étape 4 — Après P5 validé : créer P6 + agréger verdict /5000

Same pattern. Phase finale.

### Étape 5 — Verdict global + STOP & ASK Will final

Master agrège tout, propose Scénario A/B/C, et déclenche la décision Will : GO commits / SPRINT CORRECTIF / NO-GO.

---

## 7. CHECKLIST DE VALIDATION MASTER (pour chaque phase livrée)

Avant de marquer une phase « validée » et passer à la suivante, Master vérifie :

| ✅ | Check | Phase |
|---|---|---|
| ☐ | Dossier `_AUDIT/CONTENT-GEN-PERFECTION-2026/` existe | M |
| ☐ | Sub-dossier `phase-X/` créé par chaque phase | P1-P6 |
| ☐ | Verdict sub-score `/1000` produit par chaque phase | P1-P5 |
| ☐ | Top P0/P1 listés (≥10 P0 si trouvés, ≥20 P1) | P1 |
| ☐ | STOP & ASK Will explicite à la fin de chaque phase | P1-P6 |
| ☐ | Cohérence cross-phases vérifiée (P2/P3/P4 ne se contredisent pas) | M après P4 |
| ☐ | Budget total annuel chiffré (Claude + embeddings + tools + infra) | P6 |
| ☐ | KPIs 12 mois définis avec critères mesurables | P6 |
| ☐ | Mémoire sauvegardée après chaque phase | P1-P6 |
| ☐ | Sentry / observability mentionnés | P5 |
| ☐ | Tests Vitest + Playwright plan E2E inclus | P6 |
| ☐ | Convergence Manon vérifiée (git log) avant chaque phase | Chaque |
| ☐ | Doctrine zéro invention respectée (`[UNKNOWN]` flagués) | Chaque |

---

## 8. ANNEXE — Mémoires à charger AVANT démarrage P1

L'agent qui exécute P1 DOIT lire ces mémoires + fichiers :

- `_AUDIT/PROMPT-CONTENT-GEN-PERFECTION-2026-05-21.megaprompt-archive.md` (mégaprompt initial, référence historique mais NE PAS exécuter)
- `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/**`
- `_AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/**`
- `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/**`
- `src/server/content-gen/**` (code existant)
- `prisma/schema.prisma` (modèles existants)
- `axionia/kb/villes/**` (KB existante)
- Mémoires : `axionia_content_gen_deep_audit_2026-05-18`, `axionia_content_gen_city_domination_2026-05-18`, `axionia_keywords_747seeds_2026-05-20`, `axionia_image_bank_complet_2026-05-20`, `axionia_keyword_strategy_audit_2026-05-19`, `axionia_city_coverage_dashboard_2026-05-18`, `axionia_sprint_s5_p2_pending_push_2026-05-20`
- `git log --all --oneline -30` (convergence sessions parallèles Manon)

---

## 9. FIN — Cap, mission, succès

Le succès du pipeline complet se mesure à :

🎯 **Visibilité** : AxionIA cité ≥30% des AI Overviews FR sur queries `Formation IA PME`, `Audit IA TPE`, `Coaching IA dirigeant`, `Implémentation IA entreprise`, `Site web augmenté IA` à 12 mois.
🎯 **Volume** : 3400+ articles publiés indexés Google dans 12 mois (cible D4).
🎯 **Qualité** : aucun article publié sous quality_score 8.5, 0 penalty Google quality update, 0 flag scaled content abuse policy.
🎯 **Scalabilité** : capacité 500/jour soutenue sans dégradation.
🎯 **Conformité** : 100% articles `aiGenerated:true`, AI Act art.50 prêt août 2026, RGPD art.17 droit à l'oubli endpoint, DPA providers signés.
🎯 **Coût** : ≤ 3000€/mois infra + Claude + embeddings + tools, à 200/jour.

**Go quand Will dit go.** ✊

---

*Fin du PROMPT MASTER. Étape suivante : lancer P1 (`PROMPT-1-AUDIT-EXISTANT-FORENSIQUE.md`).*
