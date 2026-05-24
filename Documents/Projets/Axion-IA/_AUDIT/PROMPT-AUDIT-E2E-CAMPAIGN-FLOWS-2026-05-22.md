# PROMPT AUDIT E2E CAMPAIGN FLOWS COMPLET
## AxionIA — Vérification bout-en-bout exécution réelle 25 scénarios campagne → publication

**Date création** : 2026-05-22
**Type** : Audit comportemental E2E (exécution réelle des scénarios, pas juste lecture code)
**Mode** : **AUDIT-ONLY pour le code** + **création de données test contrôlées** pour exécuter scénarios
**Effort estimé** : 8-12h autopilot
**Modèle recommandé** : Sonnet 4.6 (suffit, audit fonctionnel)
**À lancer APRÈS** : `PROMPT-AUDIT-FINAL-PROD-READY-2026-05-22.md` ET `PROMPT-AUDIT-ADMIN-RACCORDEMENT-COMPLET-2026-05-22.md` livrés
**Demandé par Will explicitement le 2026-05-22** : "vérifier concrètement si tout fonctionne pour le lancement de campagnes pour tous les scénarios possibles en partant de la console d'administration jusqu'à la publication sur la plateforme web"

---

## 0. CONTEXTE PROJET AXION-IA

### Société française AxionIA — 5 verticales
- `interventions_formations`, `audits`, `un_a_un`, `implementations`, `sites_web_augmentes`

### Stack
- Next.js 16 + Prisma + Postgres + BullMQ Redis + Claude Sonnet 4.6 + Anthropic + OpenAI embeddings
- Workers : 12+ BullMQ workers
- Auth : NextAuth.js admin

### Décisions Will canoniques FIGÉES
- **D-W1** : `MAX_PUBLISH_PER_DAY=30` initial
- **D-W3** : `factoryAutoPublishAllBlogTypes` ACTIVÉ
- **D-W4** : OpenAI embeddings text-embedding-3-large
- **D-P5-1** : 6 presets CampaignTemplate
- **D-P5-2** : Seuil qualité 60/100
- **D-P5-5** : MAX_PUBLISH rampe manuelle UI
- **D1** : Seuil REJECT = 6.0/10
- **D2** : 3 itérations `blog_pillar`+`landing_ville`, 2 autres types
- **D3** : Persona "Manon, experte IA chez Axion-IA"
- **D4** : Wording AI Act = "Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA."
- **D7** : Société française pure

### EXCLUSIONS WILL ABSOLUES
- ❌ Wikidata, DPA, CF WAF, toggle auto/manuel publication

---

## 1. MISSION DU PROMPT

Exécuter **25 scénarios bout-en-bout** réels, depuis la console admin jusqu'à la publication sur la plateforme web. Pour chaque scénario :
1. Créer les **préconditions** (campagne test, données test)
2. **Déclencher** le scénario (création campagne, force conditions, etc.)
3. **Observer** le résultat (DB queries, observation UI, logs Sentry, sitemap, IndexNow, etc.)
4. **Vérifier** la conformité (résultat attendu vs observé)
5. **Documenter** dans rapport `scenarios/scenario-XX-<nom>.md`
6. **Cleanup** des données test après chaque scénario

**Sortie principale** : `VERDICT-E2E-CAMPAIGN-FLOWS.md` avec X scénarios OK / Y scénarios KO + roadmap correctif si KO.

---

## 2. FICHIERS À LIRE EN PREMIER

### Mémoires Claude
1. `axionia_decisions_will_final_2026-05-21.md` (D7 + exclusions)
2. `axionia_p4_decisions_canoniques_2026-05-21.md` (D1-D5)
3. `axionia_p5_decisions_canoniques_2026-05-21.md` (D-P5-1 à D-P5-6)
4. `axionia_sprint_p5_corrections_livre_2026-05-21.md`
5. `axionia_sprint_campaign_controls_livre_2026-05-22.md` (si livré)
6. `axionia_sprint_external_links_database_livre_2026-05-22.md` (si livré)
7. `axionia_audit_admin_raccordement_2026-05-22.md` (si livré)

### Code source clés
8. `src/server/queue/workers/content-gen-worker.ts`
9. `src/server/queue/workers/content-publish-worker.ts`
10. `src/server/queue/workers/content-quality-improver-worker.ts`
11. `src/server/queue/workers/content-gen-orchestrator-worker.ts`
12. `src/server/content-gen/admin/coverage.ts` (createCampaign, pauseCampaign, etc.)
13. `src/server/content-gen/generators/*.ts` (7 generators)
14. `src/server/content-gen/reviewer/llm-judge.ts`
15. `src/server/content-gen/factcheck/fact-checker.ts`
16. `src/server/content-gen/dedup/*.ts`
17. `src/server/content-gen/keyword-selector.ts`
18. `src/server/content-gen/images/assign-hero-image.ts`
19. `prisma/schema.prisma`

### Configuration
20. `.env.example` + `.env.local` (vérifier env vars critiques)
21. `package.json` (scripts disponibles `content-gen:*`)

---

## 3. PRÉ-REQUIS AVANT EXÉCUTION

### A. Vérifier env de test
```powershell
# Vérifier que la DB est connectée
pnpm prisma db push --skip-generate --accept-data-loss=false

# Vérifier que BullMQ Redis est actif
redis-cli ping  # → PONG attendu

# Vérifier que les env vars critiques sont valorisées
echo $env:ANTHROPIC_API_KEY  # ne doit PAS être vide
echo $env:OPENAI_API_KEY     # ne doit PAS être vide

# Démarrer dev server pour observation UI
pnpm dev  # background
```

### B. Créer un user test admin (si pas déjà existant)
- Login : `test-admin@axion-ia.local` (ou créer manuellement via Prisma Studio)
- Password : valorisé en env var test

### C. Identifier prefix admin
- `ADMIN_URL_PREFIX` env var → noter la valeur pour URL admin

### D. Nettoyer données test précédentes (si existantes)
```sql
DELETE FROM articles WHERE slug LIKE 'test-e2e-%';
DELETE FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%';
DELETE FROM content_gen_jobs WHERE campaign_id IN (SELECT id FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%');
```

---

## 4. 25 SCÉNARIOS E2E À EXÉCUTER

Pour chaque scénario : préconditions + étapes + résultats attendus + vérifications.

### 🟢 SC-01 — Création campagne basique sans preset

**Préconditions** : Admin connecté, aucune campagne test en cours.

**Étapes** :
1. Aller sur `/[adminPrefix]/content-gen/coverage/new`
2. Wizard étape 1 : nom `TEST_E2E_01_basic`, verticale `audits`, scope `national`
3. Étape 2 : `typeDistribution = { blog_from_keywords: 100 }`, `audienceMix = { pme: 100 }`
4. Étape 3 : `totalTargetCount = 1` (1 seul article pour test)
5. Étape 4 : submit
6. Attendre 5 min

**Résultat attendu** :
- DB row `coverage_campaigns` créée avec status `running`
- BullMQ : 1 job `content-gen-worker` créé pour cette campagne
- Après ~2 min : 1 article en status `generated`
- Après ~1 min de plus : article passe en `quality_check`, puis `published`
- Article visible sur `/blog/[slug]` (avec slug auto-généré)

**Vérifications** :
```sql
SELECT status, generated_count, published_count FROM coverage_campaigns WHERE name='TEST_E2E_01_basic';
-- Attendu : status='running' ou 'completed', generated_count=1, published_count=1

SELECT slug, status, published_at FROM articles WHERE generated_by_job_id IN (SELECT id FROM content_gen_jobs WHERE campaign_id=...);
-- Attendu : 1 row, status='published', published_at NOT NULL
```

```powershell
curl -s "http://localhost:3000/fr/blog/<slug>" -I  # → 200
```

### 🟢 SC-02 à SC-07 — Création depuis 6 presets

Pour chaque preset (D-P5-1) :
- `pme-audits` (PME audits)
- `interventions-weekly` (Interventions weekly)
- `tpe-burst` (TPE burst)
- `eti-pilier` (ETI pilier)
- `cities-paris` (Cities Paris)
- `rss-daily` (RSS daily)

**Étapes** :
1. Aller sur `/[adminPrefix]/content-gen/templates/`
2. Click "Utiliser ce preset" sur preset X
3. Vérifier wizard pré-rempli avec config preset
4. Réduire `totalTargetCount` à 1 (pour test rapide)
5. Modifier `name = TEST_E2E_0X_preset_<slug>`
6. Submit

**Résultat attendu** :
- Campagne créée avec config respectant le preset
- 1 article généré + publié dans verticale appropriée
- Pour `cities-paris` : article `anchorVilleSlug='paris'`
- Pour `rss-daily` : article généré via `blog-from-rss` generator

**Vérifications** :
- DB row + article publié
- Pour rss-daily : pas de mention "Source : [site]" dans le body (exigence Will)

### 🟢 SC-08 — Campagne avec startDate futur (si Sprint Campaign Controls livré)

**Préconditions** : Sprint Campaign Controls livré.

**Étapes** :
1. Créer campagne `TEST_E2E_08_scheduled` avec `startDate = NOW() + 5 min`
2. Vérifier status DB = `scheduled` immédiatement après création
3. Vérifier aucun job BullMQ créé pour le moment
4. Attendre 5 min
5. Vérifier status passe à `running`, jobs enqueued

**Vérifications** :
```sql
SELECT status, started_at FROM coverage_campaigns WHERE name='TEST_E2E_08_scheduled';
```

### 🟢 SC-09 — Campagne avec endDate (auto-stop)

**Préconditions** : Sprint Campaign Controls livré.

**Étapes** :
1. Créer campagne `TEST_E2E_09_endDate` avec `endDate = NOW() + 10 min`, `totalTargetCount = 100` (pour ne pas finir avant)
2. Observer pendant 10 min
3. À T+10 : worker `content-gen-deadline-checker` doit passer la campagne en `completed` avec `completedReason = 'deadline_reached'`

### 🟢 SC-10 — Campagne récurrente cron

**Préconditions** : Sprint Campaign Controls livré.

**Étapes** :
1. Créer campagne `TEST_E2E_10_recurring` avec `recurringSchedule = '*/2 * * * *'` (toutes les 2 min pour test)
2. Vérifier BullMQ Repeatable Job enregistré
3. Observer pendant 6 min : la campagne déclenche un batch de jobs toutes les 2 min
4. Pauser la campagne → repeatable job removed

### 🟢 SC-11 — Campagne sequential ville par ville

**Préconditions** : Sprint Campaign Controls livré.

**Étapes** :
1. Créer campagne `TEST_E2E_11_sequential` avec :
   - `cityProcessingMode = 'sequential'`
   - `anchorVilleSlugs = ['paris', 'lyon', 'marseille']`
   - `totalTargetCount = 6` (2 par ville)
2. Observer : Paris doit être TOTALEMENT complétée (2 articles publiés) avant Lyon
3. Vérifier `currentCityIndex` DB s'incrémente

**Vérifications** :
```sql
SELECT current_city_index FROM coverage_campaigns WHERE name='TEST_E2E_11_sequential';
-- Devrait passer de 0 → 1 → 2 → 3 (terminé)
```

### 🟢 SC-12 — Campagne parallèle multi-villes

**Étapes** :
1. Créer campagne `TEST_E2E_12_parallel` avec :
   - `cityProcessingMode = 'parallel'` (défaut)
   - `anchorVilleSlugs = ['paris', 'lyon', 'marseille', 'toulouse', 'nice']`
   - `totalTargetCount = 5`
2. Observer : tous les jobs créés en parallèle, articles publiés en ordre non-déterministe

### 🟢 SC-13 à SC-19 — Génération 7 types de contenu

Pour chaque type :
- `blog_pillar`
- `landing_ville`
- `blog_from_keywords`
- `blog_from_title`
- `blog_from_rss`
- `qa_derived`
- `comparison`

**Étapes** :
1. Créer campagne `TEST_E2E_1X_<type>` avec `typeDistribution = { <type>: 100 }`, `totalTargetCount = 1`
2. Observer génération article

**Résultats attendus pour CHAQUE article** :
- Persona "Manon, experte IA chez Axion-IA" dans le contenu ou byline (D3)
- AiContentDisclaimer wording exact en bas (D4)
- ≥ 2 liens externes (sources autorité)
- `aiGenerated:true` dans JSON-LD
- `<AuthorByline />` rendu si page article
- Pour `blog_pillar` : article ~2500-3500 mots + TOC
- Pour `landing_ville` : LocalBusiness JSON-LD + section villes proches
- Pour `comparison` : `<table>` HTML présent (acquis BUG-5 commit `8b3f470`)
- Pour `qa_derived` : QAPage JSON-LD + Speakable
- Pour `blog_from_rss` : **PAS de mention "Source :"** + similarité SimHash < 0.50 vs source

**Vérifications** :
```sql
SELECT content_type, slug, has_ai_disclaimer, external_link_count FROM articles WHERE slug LIKE 'test-e2e-%';
```

### 🟢 SC-20 — Article qualité < seuil → boucle improve

**Étapes** :
1. Forcer un article qualité 5.5 (mock LLM-judge response OU article avec issues volontaires)
2. Observer boucle improve :
   - Pour `blog_from_keywords` : 2 itérations max (D2)
   - Pour `blog_pillar` : 3 itérations max (D2)
3. Vérifier `qualityImprovementAttempts` DB s'incrémente
4. Si après max iterations toujours < 6.0 → status `needs_review`

**Vérifications** :
```sql
SELECT quality_improvement_attempts, status FROM articles WHERE id='...';
```

### 🟢 SC-21 — Article avec violation P0 → REJECT-P0 quarantained_critical

**Étapes** :
1. Forcer génération article avec SIREN hardcoded dans le contenu (ex: "123 456 789")
2. LLM-judge doit détecter violation P0
3. Article status = `quarantined_critical`
4. Alerte Telegram envoyée (vérifier logs webhook)

**Vérifications** :
```sql
SELECT status, quarantine_reason FROM articles WHERE id='...';
-- Attendu : status='quarantined_critical', quarantine_reason contient 'siren_hardcoded' ou similaire
```

### 🟢 SC-22 — Fact-check score < 50 → quarantained_factcheck

**Étapes** :
1. Forcer génération article avec claim faux ("L'INSEE a publié en 2030 que...")
2. Fact-checker score < 50
3. Article status = `quarantined_factcheck`

**Vérifications** :
```sql
SELECT status, fact_check_score FROM articles WHERE id='...';
-- Attendu : status='quarantined_factcheck', fact_check_score < 50
```

### 🟢 SC-23 — Cap journalier MAX_PUBLISH_PER_DAY atteint

**Étapes** :
1. Set `MAX_PUBLISH_PER_DAY = 5` (temporairement via UI ou env var)
2. Créer campagne `TEST_E2E_23_cap` avec `totalTargetCount = 10`
3. Observer 30 min : seuls 5 articles publiés aujourd'hui
4. 5 autres en attente (status `awaiting_publish_slot`)
5. Vérifier Redis INCR atomique : `GET axion:pub:YYYYMMDD` = 5

**Vérifications** :
```bash
redis-cli GET "axion:pub:$(date +%Y%m%d)"
# Attendu : 5
```

### 🟢 SC-24 — Pause campagne running

**Étapes** :
1. Sur campagne `TEST_E2E_24_pause` running (50+ jobs en attente)
2. Click "Pause" depuis liste admin
3. Vérifier `pauseCampaign()` Server Action exécutée
4. BullMQ jobs purgés (queue depth diminue)
5. Status DB = `paused`
6. Click "Resume" → jobs ré-enqueued, status `running`

**Vérifications** :
- Avant pause : `bullmq queue depth = X`
- Après pause : `bullmq queue depth = 0` (pour cette campagne)
- Après resume : `bullmq queue depth > 0`

### 🟢 SC-25 — Publication multi-targets blog + hub ville

**Étapes** :
1. Créer campagne `TEST_E2E_25_multitarget` avec :
   - Verticale `audits`
   - `anchorVilleSlugs = ['paris']`
   - `typeDistribution = { landing_ville: 100 }`
   - `totalTargetCount = 1`
2. Observer génération + publication

**Résultats attendus** :
- Article publié visible sur :
  - `/fr/blog/[slug]` ✅
  - `/fr/audits/paris/` (hub vertical × ville) ✅
  - `/fr/implantations/paris/` (hub ville) ✅

**Vérifications** :
```powershell
curl -s "http://localhost:3000/fr/blog/[slug]" | grep -c "<h1>"  # 1
curl -s "http://localhost:3000/fr/audits/paris/" | grep -c "[slug]"  # 1 (article listé)
curl -s "http://localhost:3000/fr/implantations/paris/" | grep -c "[slug]"  # 1
```

### 🟢 SC-26 — Indexation rapide IndexNow + sitemap

**Étapes** :
1. Après publication article SC-01
2. Vérifier IndexNow ping envoyé (logs worker `indexnow-worker`)
3. Vérifier sitemap-news.xml inclut l'URL dans les 5 min
4. Vérifier sitemap-blog.xml inclut l'URL

**Vérifications** :
```powershell
curl -s "http://localhost:3000/sitemap-news.xml" | grep -c "[slug]"  # 1
curl -s "http://localhost:3000/sitemap-blog.xml" | grep -c "[slug]"  # 1
```

### 🟢 SC-27 — Liens externes rotation (si External Links sprint livré)

**Étapes** :
1. Générer 10 articles consécutifs verticale `audits` ville Paris
2. Pour chaque : noter les 3 liens externes injectés
3. Vérifier rotation : pas les MÊMES 3 liens 10 fois
4. Vérifier diversité organisations (pas 3 fois INSEE)
5. Vérifier filtres durs : aucun lien concurrent, aucun paywall, aucun HTTP

**Vérifications** :
```sql
SELECT external_link_id, COUNT(*) FROM external_link_usage
WHERE last_used_at > NOW() - INTERVAL '1 hour'
GROUP BY external_link_id ORDER BY count DESC LIMIT 20;
-- Distribution équilibrée attendue
```

### 🟢 SC-28 — Image hero assignment + zéro DALL-E

**Étapes** :
1. Pour 5 articles random publiés en SC-01 à SC-25
2. Vérifier `featuredImage` non-null pour chaque
3. Vérifier image dans image-bank avec `isAiGenerated=false`

**Vérifications** :
```sql
SELECT featured_image_path FROM articles WHERE id IN (...);
-- Tous non-null

SELECT COUNT(*) FROM image_assets WHERE is_ai_generated=true AND ai_model IS NULL;
-- Attendu : 0 (acquis P1.5 QW-7)
```

### 🟢 SC-29 — Cost cap mensuel atteint

**Étapes** :
1. Force `cost_records` cumulé = 100% monthly cap Anthropic via DB update test
2. Observer : provider Anthropic auto-désactivé
3. Vérifier alerte Telegram envoyée (logs webhook)
4. Si tous providers off → kill-switch global activé

**Vérifications** :
```sql
SELECT key, value FROM content_gen_config WHERE key LIKE 'provider_%_disabled';
-- anthropic_disabled = true attendu

SELECT key, value FROM content_gen_config WHERE key = 'kill_switch_global';
-- true si tous providers off
```

### 🟢 SC-30 — Cleanup final

**Étapes** :
1. Supprimer toutes les données test :
```sql
DELETE FROM articles WHERE slug LIKE 'test-e2e-%';
DELETE FROM content_gen_jobs WHERE campaign_id IN (SELECT id FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%');
DELETE FROM generation_provenance WHERE article_id NOT IN (SELECT id FROM articles);
DELETE FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%';
```
2. Restaurer `MAX_PUBLISH_PER_DAY` à 30 (si modifié SC-23)
3. Restaurer cost caps si modifiés SC-29
4. Vérifier état DB cohérent (pas d'orphelins)

---

## 5. ZONES INTERDITES

- ❌ Aucun `git commit`, `git push`, modification source code (sauf création fichiers `_AUDIT/`)
- ❌ Aucune installation dépendance
- ❌ Aucune modification env vars permanente (les changements env var test doivent être reset au cleanup SC-30)
- ❌ Aucune création de campagnes/articles NON marqués `TEST_E2E_` (toujours préfixer pour cleanup facile)
- ✅ Création données test marquées `TEST_E2E_<num>_<nom>` autorisée
- ✅ Forçage conditions test (mock LLM-judge response, etc.) si nécessaire pour scénario
- ✅ Cleanup obligatoire en SC-30 final

---

## 6. LIVRABLES OBLIGATOIRES

### Structure
```
_AUDIT/AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22/
├── VERDICT-E2E-CAMPAIGN-FLOWS.md          (livrable principal)
├── SCENARIOS-MATRIX.md                     (tableau OK/KO 30 scénarios)
├── BOTTLENECKS-DETECTED.md                 (goulots d'étranglement détectés)
├── CLEANUP-LOG.md                          (preuve cleanup post-tests)
└── scenarios/
    ├── SC-01-creation-basique.md
    ├── SC-02-preset-pme-audits.md
    ├── SC-03-preset-interventions-weekly.md
    ├── SC-04-preset-tpe-burst.md
    ├── SC-05-preset-eti-pilier.md
    ├── SC-06-preset-cities-paris.md
    ├── SC-07-preset-rss-daily.md
    ├── SC-08-scheduled-startdate.md
    ├── SC-09-deadline-enddate.md
    ├── SC-10-recurring-cron.md
    ├── SC-11-sequential-villes.md
    ├── SC-12-parallel-villes.md
    ├── SC-13-blog-pillar.md
    ├── SC-14-landing-ville.md
    ├── SC-15-blog-from-keywords.md
    ├── SC-16-blog-from-title.md
    ├── SC-17-blog-from-rss.md
    ├── SC-18-qa-derived.md
    ├── SC-19-comparison.md
    ├── SC-20-boucle-improve.md
    ├── SC-21-reject-p0-siren.md
    ├── SC-22-quarantined-factcheck.md
    ├── SC-23-cap-journalier.md
    ├── SC-24-pause-resume.md
    ├── SC-25-multi-targets.md
    ├── SC-26-indexnow-sitemap.md
    ├── SC-27-liens-externes-rotation.md
    ├── SC-28-image-hero-no-dalle.md
    ├── SC-29-cost-cap.md
    └── SC-30-cleanup.md
```

### Format `VERDICT-E2E-CAMPAIGN-FLOWS.md`

```markdown
# VERDICT AUDIT E2E CAMPAIGN FLOWS
## Date : YYYY-MM-DD
## HEAD audité : <SHA>
## Score : XX/30 scénarios OK (XX%)

---

## RÉSUMÉ EXÉCUTIF

**XX/30 scénarios OK** — 🟢 PARFAIT | 🟡 GAPS MINEURS | 🔴 GAPS BLOQUANTS

### Top 3 forces du pipeline E2E
1. ...
2. ...
3. ...

### Top 3 scénarios qui échouent (P0)
1. SC-XX : <description> — Cause : ... — Effort fix : Xh
2. ...
3. ...

### Action recommandée
<1 ligne>

---

## MATRICE DES SCÉNARIOS

| # | Scénario | Statut | Durée exécution | Notes |
|---|----------|--------|-----------------|-------|
| SC-01 | Création basique | ✅ OK | 5 min | — |
| SC-02 | Preset pme-audits | ✅ OK | 4 min | — |
| ... |
| SC-21 | REJECT-P0 SIREN | ❌ KO | — | Alerte Telegram non envoyée |
| ... |
| SC-30 | Cleanup | ✅ OK | 1 min | 47 rows supprimées |

---

## BOTTLENECKS DÉTECTÉS

| Étape | Latence observée | Attendu | Impact |
|-------|------------------|---------|--------|
| Génération article LLM | 4 min | 1-2 min | Coût × 2 |
| Fact-check Voyage AI | 30s | 5s | Si Voyage activé |
| ... |

---

## GAPS À CORRIGER

### P0 (bloquant prod)
- SC-XX : ... (effort, action)

### P1 (important)
- ...

### P2 (polish)
- ...

---

## CLEANUP CONFIRMATION

- Campagnes TEST_E2E supprimées : ✅ X rows
- Articles TEST_E2E supprimés : ✅ X rows
- Jobs orphelins : ✅ 0
- DB state cohérent : ✅
- Env vars restaurées : ✅
```

### Mémoire
Slug : `axionia_audit_e2e_campaign_flows_2026-05-22`

### MEMORY.md
```
- [🟢/🟡/🔴 AxionIA Audit E2E campaign flows LIVRÉ 2026-05-22 — XX/30 scénarios OK](axionia_audit_e2e_campaign_flows_2026-05-22.md) — 30 scénarios bout-en-bout exécutés (création basique, 6 presets, scheduled, deadline, recurring, sequential, parallel, 7 types contenu, boucle improve, REJECT-P0, factcheck quarantaine, cap journalier, pause/resume, multi-targets, IndexNow, rotation liens externes, image hero, cost cap, cleanup). Verdict PARFAIT/GAPS MINEURS/GAPS BLOQUANTS.
```

---

## 7. STOP & ASK FINAL

```
✅ Audit E2E campaign flows livré.

📊 Score : XX/30 scénarios OK (YY%)

✨ Top 3 forces :
1. ...

❌ Top 3 scénarios KO (P0) :
1. SC-XX : ...

🛠️ Bottlenecks détectés : X
🧹 Cleanup : ✅ confirmé

🚀 Choix Will :
[A] Pipeline E2E parfait → activer prod
[B] Sprint correctif sur scénarios KO (~Xh)
[C] Validation manuelle + monitoring 48h
```

---

## 8. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance l'audit E2E campaign flows décrit dans `_AUDIT/PROMPT-AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22.md`. Mode AUDIT-ONLY pour le code (zéro commit, zéro modif source) + création de données test contrôlées préfixées TEST_E2E_* pour exécuter les scénarios. Décisions Will canoniques figées (D-W1-5 + D-P5-1-6 + D1-D5 + D7 société française pure) — NE PAS re-demander. Exclusions absolues : Wikidata, DPA, CF WAF, toggle auto/manuel publication. Lire EN PREMIER les mémoires Bloc 1-7 + code source Bloc 8-19. Vérifier pré-requis (DB connectée, Redis actif, env vars ANTHROPIC_API_KEY + OPENAI_API_KEY valorisées, dev server actif). Exécuter SÉQUENTIELLEMENT les 30 scénarios SC-01 à SC-30 : création basique, 6 presets, scheduled startDate, endDate auto-stop, recurring cron, sequential villes, parallel villes, 7 types contenu (blog_pillar/landing_ville/blog_from_keywords/blog_from_title/blog_from_rss/qa_derived/comparison), boucle improve, REJECT-P0 SIREN, quarantained_factcheck, cap journalier MAX_PUBLISH atteint, pause/resume BullMQ, publication multi-targets blog+hub ville, IndexNow+sitemap rapide, rotation liens externes diversification, image hero zéro DALL-E, cost cap mensuel kill-switch, CLEANUP final supprimer toutes données TEST_E2E_*. Pour CHAQUE scénario : préconditions documentées, étapes exécutées réellement, résultats observés via DB queries + curl + observation logs, verdict OK/KO, rapport `scenarios/SC-XX-<nom>.md`. Si scénario KO : documenter cause + effort fix estimé. Self-troubleshoot toutes erreurs. Cleanup obligatoire SC-30 (DELETE rows TEST_E2E_*, restaurer MAX_PUBLISH=30, cost caps). Produis VERDICT-E2E-CAMPAIGN-FLOWS.md + SCENARIOS-MATRIX.md + BOTTLENECKS-DETECTED.md + CLEANUP-LOG.md + 30 rapports scenarios dans `_AUDIT/AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22/`. Mémoire axionia_audit_e2e_campaign_flows_2026-05-22 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec score XX/30 + verdict 🟢/🟡/🔴 + 3 options [A/B/C]. Go.
```

---

## 9. QUAND LANCER

⏳ **APRÈS** :
- Mega-audit final pré-prod livré (`PROMPT-AUDIT-FINAL-PROD-READY-2026-05-22.md`)
- Audit admin raccordement livré (`PROMPT-AUDIT-ADMIN-RACCORDEMENT-COMPLET-2026-05-22.md`)

Pourquoi cet ordre :
1. Mega-audit final : vue globale 1000 pts
2. Admin raccordement : zoom 100% admin code
3. **CE PROMPT** : exécution réelle E2E des scénarios (validation comportementale)

Les 3 audits combinés = **certitude pré-production** à 100% (architecture + raccordement + comportement).

---

*Audit E2E campaign flows — 8-12h Sonnet 4.6 autopilot — 30 scénarios bout-en-bout réels exécutés*
