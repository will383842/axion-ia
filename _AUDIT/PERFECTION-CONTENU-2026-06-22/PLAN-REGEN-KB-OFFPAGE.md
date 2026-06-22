# Perfection contenu — Régénération + KB + Off-page (2026-06-22)

3 leviers hors-template pour que la refonte #134 « rende » à fond. Les items #1/#2
sont des opérations **runtime PROD** (worker + DB + Redis + LLM) ; #3 est du
**hors-code** (notoriété). Ce document = runbooks exécutables + design code +
stratégie. ⚠️ Coordination requise avec les autres sessions avant tout déclenchement prod.

## ✅ STATUT 2026-06-22 (ce qui est livré dans cette session)
- **#1 régénération-en-place : CODÉE + testée** (branche dédiée, voir §#1). Worker
  branché update-vs-create (slug préservé), action `regenerateArticle` /
  `regenerateTier1Corpus`, helper pur + 6 tests, **bouton admin** dans le dashboard
  content-gen (« Régénérer le lot tier-1 »). typecheck/eslint/isolation/throttle verts.
  → reste : merger la PR + déployer, puis cliquer le bouton en prod (après KB seedée).
- **#2 KB : AUCUN code à écrire** — le seed existe déjà (~340 facts) + un workflow
  GitHub Actions prêt. → reste : déclencher le workflow (voir §#2).
- **#3 off-page : assets LIVRÉS** dans `offpage/` (CP Observatoire, fiche Wikidata,
  annuaires FR priorisés, 5 tribunes Williams). → reste : tes identifiants + envoi.
- **Ordre d'exécution prod** : (1) seeder la KB → (2) régénérer le corpus → (3) off-page.

---

## ⚠️ CONTEXTE GLOBAL À RESPECTER (chantiers fraîchement mergés)
Régénérer/peupler/promouvoir **après** ces merges récents → le contenu produit
doit en tenir compte, sinon on régénère des incohérences :

- **France-only #129** (plus d'OÜ estonienne) : tout contenu régénéré + KB +
  off-page = **France-only**. Société = SAS FR, identité SIREN/SIRET, « basé en
  France ». Zéro trace Estonie/EE/OÜ. ⚠️ régénérer AVANT que Will mette les
  vrais SIREN/TVA = on fige des placeholders → **régénérer après les vrais
  identifiants** (voir [[france-only-no-estonia-chantier]]).
- **Qualiopi #128** : disclosure publique encore **gated/dormant** → ne pas
  faire revendiquer Qualiopi par le contenu généré tant que l'agrément n'est pas
  actif (sinon allégation non conforme).
- **Campagnes multi-axes #127** : la régénération doit passer par le système 8
  axes + **profils qualité** → vérifier `QUALITY_PROFILES_ENABLED=true` en prod
  AVANT régénération de masse (sinon qualité non calibrée).
- **Stripe neutralisé** (France-only) : le contenu ne doit pas pousser un
  paiement CB en ligne (parcours = lead manuel / virement).
- Off-page : Google Business Profile + Wikidata = **entité française**, NAP
  cohérent avec le JSON-LD LocalBusiness France-only.

---

## #1 — RÉGÉNÉRER LE CONTENU EXISTANT

### Pourquoi
Les nouveaux blocs (réponse 40-60 mots/H2, avis d'expert, point clé, callouts,
images de corps, liens profonds, stats inline) sont produits par les
**générateurs** → ils n'apparaissent qu'aux **nouvelles générations**. Les
articles déjà en base gardent l'ancien `bodyHtml`. Re-rendre ≠ régénérer : le
template (prose/blocs) s'applique au rendu, mais les blocs **alimentés par la
donnée** (expert/point-clé/FAQ/images/liens) restent vides tant que l'article
n'est pas re-généré.

### Le point dur : régénérer SANS créer de doublon
- `enqueueDirectGen` (`actions/content-gen/enqueue.ts`) crée un **nouveau**
  ContentGenJob → un **nouvel** Article (slug neuf). Régénérer ainsi = doublon
  d'URL (cannibalisation + dilution).
- `content-publish-worker.ts` publie en **`tx.article.create`** (pas `upsert`).

### Design code à construire (régénération EN PLACE — idempotent)
1. **Action admin** `regenerateArticle(articleId)` (+ `regenerateTier1Corpus({batch})`) :
   - lit l'Article + son `generatedByJobId` (params d'origine : contentType,
     primaryKeyword, secteur, ville, intention…) ;
   - crée un ContentGenJob `mode:"refresh"` portant `refreshArticleId` + ces params.
2. **content-gen-worker** : inchangé (génère via `getGenerator`).
3. **content-publish-worker** : si `refreshArticleId` présent →
   `tx.article.update({ where:{id}, data:{ body, faqJson, keyTakeaway,
   expertQuote*, directAnswer, updatedAt: now, … } })` au lieu de `create`
   → **même slug, même URL, contenu neuf** + `dateModified` réel (vraie maj, pas
   date-gaming) + ping IndexNow.
4. Garde-fous : ne régénérer que `tier_1_indexable`, batch ≤ 10, respect du
   `BUDGET_CAP`, lock anti-double-run, skip si un job actif existe déjà pour l'article.

⚠️ Touche `content-publish-worker.ts` (fichier que d'autres sessions modifient) →
**à coder sur une branche dédiée + PR, après vérif qu'aucune session ne le modifie.**

### Runbook (une fois le mécanisme livré + déployé)
1. Console admin → Génération de contenus → « Régénérer le corpus tier-1 » (ou par article).
2. Lots de 10, du plus ancien au plus récent. Surveiller `ContentGenJob` + coûts.
3. **Estimation coût** : ~0,10-0,15 $/article (cf. `BUDGET_CAP_USD`). Pour N
   articles tier-1 : N × ~0,12 $. (Ex. 200 articles ≈ 24 $.)
4. Vérifier 2-3 articles régénérés (réponses-par-H2, expert, images, liens).

### Alternative SANS code (si urgent, mais imparfaite)
Re-`enqueueDirectGen` sur les mêmes sujets → nouveaux articles enrichis, puis
**archiver** les anciens (301 vers le neuf via slug-history). Plus risqué
(maillage/URL) → la régénération-en-place est préférable.

---

## #2 — PEUPLER LA KB PUBLIQUE (active le RAG vectoriel)

### Pourquoi
`VOYAGE_API_KEY` posée mais `KnowledgeEntry` public **vide** → `kbRetrieve` tombe
en FTS lexical (pas de sémantique) → le RAG nourrit peu les prompts → qualité
plafonnée. Peupler la KB = grounding réel + dedup sémantique + ancrage local.

### ✅ Découverte : RIEN à coder — le seed + le workflow existent déjà
La KB n'est pas vide par manque de contenu : **~340 faits vérifiés** (audits,
interventions-formations, un-a-un, implémentations, sites-web, villes) sont déjà
définis dans `src/server/content-gen/kb/*.ts` et seedés par
`prisma/seeds/content-gen/seed-kb-facts.ts` (idempotent, upsert sur slug, tous
`audience=public`). Le blocage est **opérationnel** : les seeds ne tournent PAS au
deploy (migrations seulement). Sources réelles citées : AI Act EUR-Lex, BPI, ANSSI,
CNIL, ISO, Syntec, DARES, OCDE, McKinsey, Gartner, ICF France, DGE. Ce sont des
**faits de grounding** (anti-hallucination du RAG) — exactement ce qu'il faut.

### Runbook (déclencher le seed en prod)
1. **GitHub → Actions → « Seed KB (manuel) » → Run workflow → taper `SEED`**
   (`.github/workflows/seed-kb-manual.yml` : checkout repo + tunnel SSH vers la
   Postgres prod + `run-seed-kb.ts`). Idempotent, ~15 min.
   - Pré-requis (1 fois) : secret `VPS_SSH_KEY` configuré dans le repo.
2. En local (si DATABASE_URL pointe sur la cible) : `pnpm content-gen:seed-kb`.
3. Effet immédiat : ~340 entrées publiques → **`assertKbReady` (≥ 50) passe** →
   le worker content-gen ne bloque plus, et `kbRetrieve` exploite le vectoriel
   Voyage (clé déjà posée). **À faire AVANT la régénération de masse (#1)** : sinon
   les jobs de refresh bloquent sur la garde KB.
4. Vérifier : `/ressources` se peuple ; les sub-sitemaps `knowledge-*` repassent à 200.

### Garde-fou
Les faits seedés portent leur source (URL vérifiée). Idempotent → ré-exécutable
sans risque de doublon.

---

## #3 — AUTORITÉ OFF-PAGE (levier GEO #10 — déterminant, hors template)

Aucun template ne crée d'autorité : être **cité par les IA** dépend largement de
ta présence sur des sites tiers. Plan concret + assets.

### A. Fondations entité (quick wins, semaine 1)
- **Google Business Profile** (SAS française) — NAP cohérent avec le JSON-LD
  LocalBusiness du site.
- **Wikidata** : créer/compléter l'entité « Axion-IA » + « Williams Jullin »
  (lié au `sameAs` déjà émis) → désambiguïsation entité forte pour les LLM.
- **LinkedIn entreprise** + page fondateur (williamsjullin déjà en `sameAs`).
- **Annuaires métier FR** : Société.com, Pages Jaunes Pro, Les Pages Conseil,
  Welcome to the Jungle (déjà des offres carrières), French Tech, BPI/France Num
  partenaires.

### B. Citations & mentions (semaines 2-6)
- **Répertoires IA/conseil** : annuaires de cabinets IA, Clutch, Sortlist,
  GoodFirms (avis B2B = signal fort).
- **Communiqués de presse** (le site a déjà `/presse` + kit) : 1 angle fort
  (ex. « Observatoire IA 2026 » déjà publié → le diffuser : Relations Presse,
  Cision, agrégateurs FR).
- **Guest posts / tribunes** : Journal du Net, Frenchweb, Maddyness, blogs
  sectoriels — 1 tribune/mois signée Williams sur un sujet où vous êtes cités.
- **Données ouvertes** : l'Observatoire IA (CC BY 4.0) → soumettre à data.gouv,
  agrégateurs de stats → backlinks + citations IA (les LLM adorent les stats sourcées).

### C. Réutilisation de tes assets existants
- L'**Observatoire IA** = ton meilleur aimant à citations (stats originales) :
  le promouvoir activement = le levier #4 (stats sourcées) + #10 (off-page) combinés.
- Les **cas concrets / témoignages** (quand tu en auras) → études de cas
  publiables sur LinkedIn + sites partenaires.

### Assets que je peux générer (dis-moi)
- Communiqué de presse prêt-à-envoyer (angle Observatoire IA).
- Liste priorisée d'annuaires/citations FR avec URLs de soumission.
- 3-5 angles de tribunes (titres + pitch) signés Williams.
- Fiche entité Wikidata (propriétés + sources).

### KPI à suivre
Le tracking des référents IA est **déjà câblé** (`RefererTracker` → Plausible :
chatgpt/perplexity/claude/gemini). Suivre la part de trafic « citation IA » dans
le temps = mesure directe de l'efficacité off-page + AEO.

---

## ACCÈS PROD (état constaté)
- `.env.local` / `.env.dev` présents (non lus — secrets) ; `.env.production.example` (exemple).
- Pas de `.secrets/` dans ce checkout. Scripts prod existants : `deploy-prod.sh`,
  `check-prod-env.sh`, `regen-villes-complete.ts` (précédent de régénération batch).
- → Déclencher #1/#2 en prod = via **console admin** (recommandé) ou un script
  lancé **avec l'env prod** (DATABASE_URL/REDIS_URL prod). Je ne le fais PAS
  d'ici sans ton go (coût LLM + collision possible avec d'autres sessions).

## CE QUI RESTE À DÉCIDER (toi)
1. Je code la **régénération-en-place** sur une branche dédiée (après vérif
   anti-collision sur `content-publish-worker.ts`) ? → puis tu la déclenches en prod.
2. Quels **assets off-page** je génère en premier (CP Observatoire / liste annuaires / tribunes / Wikidata) ?
3. Tu veux que je prépare le **script de seed KB** (sujets ci-dessus) à lancer en prod ?
