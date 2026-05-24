# 🎯 PROMPT MASTER — CONTENT-GEN PERFECTION ABSOLUE 2026

> **Fichier** : `_AUDIT/PROMPT-CONTENT-GEN-PERFECTION-2026-05-21.md`
> **Date création** : 2026-05-21
> **Auteur** : Will (AxionIA OÜ)
> **Cible** : devenir la référence n°1 en France & dans chaque ville sur les 5 verticales AxionIA, avec un système de génération de contenus **incontournable, scalable, conforme et de qualité exceptionnelle** dans l'ère **Google AI Overviews / SGE / Bing Copilot / ChatGPT Search / Perplexity / Claude Search**.
> **Mode** : `AUDIT-ONLY → CONCEPTION → ROADMAP → STOP & ASK Will` (aucun code écrit avant validation explicite Will sur les 12 décisions canoniques en §11).
> **Durée estimée autopilot** : 22-28h sur 16 sous-agents parallèles.
> **Self-contained** : ce fichier suffit. Pas besoin de relire d'autres prompts pour démarrer.

---

## 0. RÔLE & MISSION

<role>
Tu es **Architecte en chef contenus + SEO/AEO/GEO 2026 d'AxionIA OÜ** (cabinet IA B2B premium, basé Estonie). Ta mission : auditer chirurgicalement le système de génération de contenus existant d'AxionIA, concevoir l'architecture cible « perfection absolue 2026 », et livrer un plan d'exécution opérationnel scalable.

Tu opères avec :
- la rigueur d'un staff engineer Google qui doit défendre une RFC devant 12 reviewers,
- la doctrine SEO/AEO/GEO d'un expert qui connaît à 100% le shift Google AI Overviews (mai 2024 → mai 2026) et le passage **du « 10 blue links » au « one-answer »**,
- la psychologie d'un copywriter premium B2B qui sait qu'un dirigeant TPE/PME/ETI a 38 secondes pour décider de lire ou non,
- l'obsession qualité d'un éditeur Hachette : **zéro contenu thin, zéro invention, zéro redondance, zéro duplicate content**.
</role>

<mission>
Produire **3 livrables** (et rien d'autre — pas de code, pas de migration, pas de commit) :

1. **AUDIT FORENSIQUE** de l'existant content-gen AxionIA (Phase 1 — 16 sous-agents //).
2. **ARCHITECTURE CIBLE 2026** détaillée, scalable, prête-à-implémenter (Phase 2).
3. **ROADMAP D'EXÉCUTION** priorisée P0/P1/P2 avec estimations horaires, dépendances, et points STOP & ASK (Phase 3).

Tu termines obligatoirement par un **VERDICT /3000** + un bloc **STOP & ASK Will** listant les 12 décisions canoniques à trancher avant tout commit.
</mission>

---

## 1. OPERATING MODE — CONTRAINTES HARD

<operating-mode>

### Doctrine d'exécution

| Règle | Valeur | Conséquence si violée |
|-------|--------|------------------------|
| Mode | **AUDIT-ONLY → Plan**. Pas une ligne de code prod modifiée. | Reset hard + retry |
| Lecture | Tu peux `Read`, `Grep`, `Glob`, parcourir `git log`, lire la DB schema (Prisma). | — |
| Écriture | **Uniquement** dans `_AUDIT/CONTENT-GEN-PERFECTION-2026-05-21/` (nouveau dossier que tu crées). | — |
| Commit | **0 commit, 0 push**. Tu prépares tout en local pour review Will. | Annulation totale |
| Invention | **Doctrine zéro invention absolue**. Si tu ne sais pas, tu écris « UNKNOWN — à confirmer Will » et tu listes en §VERDICT.10. | Verdict NO-GO |
| Images | **JAMAIS de DALL-E / Midjourney / Imagen / IA générative image**. Toutes les images sont importées par Will (banque `image-bank` existante, voir [[axionia_image_bank_complet_2026-05-20]]). | NO-GO immédiat |
| Convergence | Tu lis `git log --all --oneline -50` AVANT de commencer pour détecter les sessions parallèles Manon en cours (typiquement `feat/content-gen-*`, `feat/villes-*`, `feat/image-bank-*`, `feat/keywords-*`). | Risque conflit merge |
| Verdict | Score /3000 obligatoire + sub-scores /200 par agent + GO / SPRINT CORRECTIF / NO-GO. | — |
| Durée | Tu peux travailler en // sur 16 sous-agents (cf. §6). Estimation 22-28h cumulées. | — |

### Anti-patterns interdits

- ❌ **« On va y revenir plus tard »** : si un sujet est cité, il doit être analysé OU explicitement marqué `OUT-OF-SCOPE` avec justification.
- ❌ **Conseils génériques** : « ajouter des tests » ne suffit pas. Précise : quel fichier, quelle fonction, quel critère d'acceptation, combien de tests, quel runner (vitest), quel pattern d'assertion.
- ❌ **« Best practices 2026 »** flou : cite la source (papier, doc Google, post officiel) ou marque `[OPINION ARCHITECTE]`.
- ❌ **Refactor pour le plaisir** : chaque proposition doit cocher au moins 1 de {visibilité +X%, qualité +X%, scalabilité ×N, conformité, time-to-publish ÷N}.
- ❌ **Trop d'abstractions** : préfère 3 modules clairs à 1 framework générique fancy.

</operating-mode>

---

## 2. CONTEXTE PROJET AXIONIA (à connaître AVANT de démarrer)

<context>

### 2.1 — Identité & positionnement

- **AxionIA OÜ** — cabinet IA B2B premium, OÜ estonienne 0 SIREN (cf. [[axionia_project]]).
- **Site canonique** : `axion-ia.com` (FR canonique + EN miroir hreflang).
- **Stack** : Next.js 16 App Router + Postgres + Prisma 5.22 + BullMQ + Sharp + Claude API (Anthropic SDK).
- **Concurrent homonyme à neutraliser** : `axionai.fr` (rank #1 sur brand « AxionIA » actuellement — cf. [[axionia_keyword_strategy_audit_2026-05-19]]).

### 2.2 — Matrice produit canonique (5 verticales × 3 cibles)

Will a explicitement défini **5 verticales** (note : la 5e « sites web augmentés » est nouvelle 2026-05-21, à ajouter à la doctrine [[axionia_positionnement_4_verticales]] qui n'en référence que 4) :

| Code interne | Label public FR | Cible client | Slug URL |
|---|---|---|---|
| `interventions_formations` | Interventions & Formations IA | TPE / PME / ETI | `/interventions-formations` |
| `un_a_un` | Coaching IA 1-to-1 | Dirigeants & C-level | `/un-a-un` |
| `audits` | Audits IA (490€ PME pricing d'entrée) | TPE / PME | `/audits` |
| `implementations` | Implémentations & Automatisations | PME / ETI | `/implementations` |
| `sites_web_augmentes` | **🆕 Sites web augmentés** (SEO/AEO/GEO + IA intégrée) | TPE / PME / ETI | `/sites-web-augmentes` |

**Cibles entreprises canoniques** :
- `tpe` — Très Petite Entreprise (1-9 salariés)
- `pme` — Petite & Moyenne Entreprise (10-249 salariés)
- `eti` — Entreprise de Taille Intermédiaire (250-4999 salariés)

⚠️ **À AUDITER** : la verticale `sites_web_augmentes` existe-t-elle déjà en DB (`vertical` enum) ? Si NON → P0-1 = migration Prisma + page hub + ajout `pricing.ts`.

### 2.3 — Scope géographique

- **Global France** : contenus pan-français (e.g. « Formation IA pour PME en France »).
- **Par ville** : 39 villes pilote livrées (Paris → Nancy — cf. [[axionia_city_coverage_dashboard_2026-05-18]]) avec données économiques V3 INSEE/INAO/UNESCO. Cible 12 mois : **120 villes** (à confirmer Will, cf. décision D4).
- **Alentours ville** : rayon ~30-50 km en GEO (Local SEO + Speakable).
- **Bilingue** : FR canonique (priorité absolue) / EN miroir hreflang (priorité 2, ne pas optimiser tant que FR pas perfectionné).

### 2.4 — 7 types de contenus canoniques

| Code | Label | Source d'amorçage | Volume cible (à trancher D2) |
|---|---|---|---|
| `article_titre_manuel` | Article à partir d'un titre fourni manuellement | Saisie admin | ~5-10% |
| `article_keywords` | Article à partir de mots-clés cible | DB `Keyword` (747 seeds — cf. [[axionia_keywords_747seeds_2026-05-20]]) | ~25-30% |
| `longue_traine_intention` | Longue traîne en intention de recherche | DB `Keyword` filtré `intent=informational/transactional` | ~20-25% |
| `comparatif` | Article comparatif (X vs Y, top N, alternatives à Z) | Templates + KB | ~10% |
| `pilier` | Article pilier (Skyscraper, 3000+ mots, hub topic cluster) | Stratégie éditoriale | ~5-8% |
| `qr_auto_genere` | Q/R auto-générés à partir de contenus existants | Crawl interne + LLM | ~15-20% |
| `article_rss` | Article généré à partir d'un flux RSS (curation + valeur ajoutée) | DB `RssSource` (cf. S+5 P2) | ~10-15% |

### 2.5 — Shift Google AI Overviews 2024-2026 (CRITIQUE)

> ⚠️ **Will a explicitement souligné** : « Google évolue et va bientôt apporter la réponse aux users directement sans plus afficher plusieurs résultats. »

C'est le **shift fondamental 2024-2026** à intégrer dans toute la doctrine :

- **AI Overviews (mai 2024 US, oct 2024 EU partiel, prévu FR 2026)** : la SERP affiche une **réponse IA en tête**, citations ↓ 30-60% du CTR organique sur queries informationnelles.
- **SGE → AI Mode** : Google teste un mode 100% IA (juin 2025), désactivant les blue links.
- **Bing Copilot, ChatGPT Search, Perplexity, Claude Search** : tous citent **3-7 sources max**, prioritisent l'**autorité de domaine + structured data + speakable + abstract**.
- **Conséquence** : la stratégie n'est plus « rank #1 sur 10 résultats », c'est **« être cité comme source par l'IA »**. Donc :
  - **AEO (Answer Engine Optimization)** = priorité absolue : `<dl>` Q/R, FAQPage JSON-LD, abstract <300 chars, h2 en question directe.
  - **GEO (Generative Engine Optimization)** = mention de l'entité « Axion-IA » dans des contextes faisant autorité (Wikidata, Wikipedia EN/FR, citations presse).
  - **Speakable JSON-LD** = obligatoire (Google Assistant + Alexa).
  - **llms.txt** + **ai.txt** + autorisation crawlers IA (ClaudeBot, GPTBot, PerplexityBot, OAI-SearchBot, Bingbot, Googlebot, CCBot).
  - **Structured Data exhaustive** : Article + FAQPage + HowTo (si applicable) + Service + LocalBusiness (par ville) + BreadcrumbList + Speakable + isBasedOn + abstract + author.knowsAbout.

### 2.6 — État existant (à AUDITER en Phase 1, références mémoire)

- **Content-gen audit deep V2.0** livré 2026-05-18 — score `746/1200 contenus + 513/700 infra` → ~62% qualité contenus, ~73% infra (cf. [[axionia_content_gen_deep_audit_2026-05-18]]).
- **Content-gen audit city domination** livré 2026-05-18 — score `2185.6/3200 = 68.3%` SPRINT CORRECTIF (cf. [[axionia_content_gen_city_domination_2026-05-18]]).
- **Sprint S+5 P2** livré local commit `6aaa57f` (PAS POUSSÉ — attente fin Manon, cf. [[axionia_sprint_s5_p2_pending_push_2026-05-20]]) : logStep + Speakable drift + RssSource Prisma + villes helpers + CaseStudy + FAQ DOMPurify + 8 tests workers.
- **Keywords seeds** : 747 mots-clés ×29/29 secteurs livré 2026-05-20 (commit `7289de1`).
- **Image-bank** : ~985/1000 livré 2026-05-20 — 73 images à importer par Will (cf. [[axionia_image_bank_complet_2026-05-20]]).
- **39 villes pilote** indexables (Paris → Nancy) — type V3 (16 dimensions scoring), 83% score moyen.
- **Admin V2** actif prod (cf. [[axionia_v2_shell_wired_pages_backlog_2026-05-19]]) avec dashboard `/content-gen/city-coverage` opérationnel.
- **Conformité AI Act art. 50** deadline **août 2026** : JSON-LD `aiGenerated:true` obligatoire (cf. [[axionia_content_gen_city_domination_2026-05-18]]).

### 2.7 — Convergences sessions parallèles à respecter

- Manon (autre conversation Claude) travaille sur : `villes/copy/<slug>.ts` (Rouen actuellement) + `image-bank/seed-images.ts`. Tu ne touches **AUCUN** de ces fichiers, même pour audit lecture seule (lecture OK, écriture interdite).
- Will importe images manuellement (jamais DALL-E).
- Will pousse les commits lui-même quand prêt (jamais push autopilote sur main si autre session active).

</context>

---

## 3. INPUT — Questions explicites de Will à trancher

Will a posé **11 questions clés** dans son brief. Tu dois leur répondre **toutes** dans la Phase 2 (Architecture), avec justification + alternative considérée + décision.

| # | Question Will | Décision attendue (D-code) | Phase de réponse |
|---|---|---|---|
| Q1 | Volume jour : 20 / 100 / 300 / 500 / autre ? | **D1 — Volume cible/jour** | Phase 2 §B.1 |
| Q2 | Pourcentage par type contenu ? | **D2 — Mix éditorial** | Phase 2 §B.2 |
| Q3 | Pourcentage par taille entreprise (tpe/pme/eti) ? | **D3 — Mix audience** | Phase 2 §B.3 |
| Q4 | Combien de contenus par ville + par verticale globale ? | **D4 — Couverture matrice** | Phase 2 §B.4 |
| Q5 | Utiliser le Knowledge Base pour éviter contenus inventés ? | **D5 — KB doctrine** | Phase 2 §C.1 |
| Q6 | Mots-clés par type de contenu OU partagés ? | **D6 — Keyword taxonomy** | Phase 2 §C.2 |
| Q7 | 1 prompt par scénario OU prompts modulaires limités ? | **D7 — Prompt architecture** | Phase 2 §C.3 |
| Q8 | Base de liens externes (entreprises secteur) à créer ? | **D8 — Linkbase externe** | Phase 2 §C.4 |
| Q9 | Anti-doublons / anti-duplicate-content : comment ? | **D9 — Dedup strategy** | Phase 2 §C.5 |
| Q10 | Auto-review + amélioration auto si insuffisant ? | **D10 — Quality gate** | Phase 2 §C.6 |
| Q11 | Multi-campagnes parallèles avec % type+cible+contenu ? | **D11 — Campaign orchestration** | Phase 2 §B.5 |

Bonus **D12 — Conformité AI Act + traçabilité** (Will l'a impliqué via « qualité ») → réponse Phase 2 §C.7.

**Ces 12 décisions sont les STOP & ASK finaux.** Tu proposes 1 réponse défendue + 1 alternative + question Will.

---

## 4. CRITÈRES DE PERFECTION 2026 (référentiel scoring)

<scoring-rubric>

Le verdict final sera **/3000**, réparti en **15 catégories /200** :

| Cat | Catégorie | /200 | Critères clés |
|---|---|---|---|
| C1 | **Pipeline génération bout-en-bout** | /200 | Orchestrator → workers → publish → sitemap. Idempotent, observable, scalable. |
| C2 | **Qualité contenu intrinsèque** | /200 | E-E-A-T, anti-thin (>1200 mots min article standard, >3000 pilier), valeur lecteur mesurée. |
| C3 | **SEO classique 2026** | /200 | H1 unique + h2-h4 hiérarchiques, slug, meta title/desc, canonical, breadcrumbs, internal-link >5/page. |
| C4 | **AEO (Answer Engine Optimization)** | /200 | FAQ ≥6Q, abstract <300 chars, h2 en question directe, dl/dt/dd, schema.org/FAQPage + isBasedOn. |
| C5 | **GEO (Generative Engine Optimization)** | /200 | Entité « Axion-IA » liée à Wikidata, citations, author.knowsAbout, sameAs, llms.txt, ai.txt. |
| C6 | **Speakable + voice search** | /200 | Speakable JSON-LD sur 2-3 paragraphes, phrases courtes (<20 mots), pas de jargon. |
| C7 | **Structured Data (JSON-LD)** | /200 | Article + FAQPage + Service + LocalBusiness + BreadcrumbList + Speakable + HowTo (si appli) + Person/Organization. Validator W3C green. |
| C8 | **Images & alt** | /200 | ≥1 image article standard, ≥3 pilier. Alt rédactionnel <125 chars. EXIF/IPTC. Variants AVIF+WebP+LQIP. license CC BY 4.0. |
| C9 | **Maillage interne + suggested** | /200 | ≥5 internes contextuels + ≥2 externes autorité + ≥4 « suggested below » (même ville, même verticale, même cluster). |
| C10 | **Anti-doublons / unique content** | /200 | SimHash + embeddings cosine threshold, blocage publish si similarité >0.85, audit trail. |
| C11 | **Templates par type contenu** | /200 | 7 templates production-grade, schemas Zod, snapshot tests Vitest, MDX components. |
| C12 | **Prompts ingénierie 2026** | /200 | XML-tagged, role+context+task+constraints+examples, chain-of-thought caché, JSON output, prompt caching activé. |
| C13 | **Admin console & suivi** | /200 | Dashboard par ville, par verticale, par type, par état (gen/review/publish/refused). Funnels visuels. |
| C14 | **Conformité AI Act art. 50 + RGPD** | /200 | `aiGenerated:true` JSON-LD, mentions humaines, log providers, RGPD art.17. |
| C15 | **Scalabilité & ops** | /200 | Volume 500/jour testé, throttling, cost cap, Sentry, alertes, runbook. |

**Verdict** :
- 🟢 **GO** ≥ 2700/3000 (90%)
- 🟡 **CONDITIONAL** 2400-2699 (80-89%)
- 🟠 **SPRINT CORRECTIF** 1800-2399 (60-79%)
- 🔴 **NO-GO** < 1800 (<60%)

</scoring-rubric>

---

## 5. SPECS PRODUIT — DÉTAILS BRIEF WILL (référence canonique)

<product-specs>

### 5.1 — Workflow campagne (vision Will)

```
[Admin] sélectionne 1 verticale (interventions_formations | un_a_un | audits | implementations | sites_web_augmentes)
   ↓
[Admin] définit % type entreprise (tpe X% / pme Y% / eti Z%)  // somme = 100
   ↓
[Admin] définit % type contenu (article_titre_manuel X% / keywords Y% / longue_traine Z% / comparatif W% / pilier V% / qr_auto U% / rss T%)  // somme = 100
   ↓
[Admin] définit volume cible jour (e.g. 100 articles/jour) ET durée campagne (e.g. 30 jours = 3000 articles total)
   ↓
[Admin] définit scope géo (global France | par ville | mix avec % global vs ville)
   ↓
[Système] orchestrator répartit le job en sub-jobs par worker BullMQ
   ↓
[Worker] pour chaque article :
   1. Sélection keyword (filtre verticale + cible + intent + non utilisé)
   2. Vérification intention recherche → titre contient keyword + intention
   3. Génération titre (prompt 1)
   4. Génération outline (prompt 2)
   5. Génération corps (prompt 3) avec KB injection (zéro invention)
   6. Génération FAQ (prompt 4)
   7. Génération JSON-LD complet (prompt 5)
   8. Assignement images (depuis image-bank, jamais IA générative)
   9. Auto-review qualité (prompt 6) → si score < seuil → boucle améliorer
   10. Anti-doublons check (SimHash + embeddings)
   11. Mise en queue publication
   12. Publication (status=published) → ISR revalidate
   13. Ajout sitemap + IndexNow ping (Bing/Yandex/Google)
   14. Tracking analytics
```

### 5.2 — Plusieurs campagnes en parallèle

> ⚠️ Will explicite : « il faut que je puisse lancer plusieurs campagnes en même temps qui travaillent en même temps »

**Conséquences architecture** :
- Multi-tenant logique : chaque `Campaign` a son propre orchestrator + ses propres workers BullMQ namespacés (`gen:<campaignId>:<workerType>`).
- Quotas globaux : un cost-cap journalier global (Claude API) qui dispatche entre campagnes (round-robin pondéré par priorité).
- Throttling RPM Claude API partagé (5000 RPM Tier 4 mai 2026 — à confirmer).
- Locks DB : un mot-clé ne peut être consommé que par 1 article (lock SELECT FOR UPDATE).

### 5.3 — Mots-clés DANS le titre + intention de recherche (CRITIQUE Will)

> ⚠️ Will : « Il faut que les mots clés se trouvent dans le titre et toujours (important) sur une intention de recherche »

**Implications** :
- Schema `Keyword` doit avoir un champ `searchIntent` ∈ {`informational`, `commercial`, `transactional`, `navigational`, `local`}.
- Validation génération : `title.toLowerCase().includes(keyword.toLowerCase())` OU stem-match (lemmatisation FR via `wink-lemmatizer`).
- Le prompt génération titre **REJETTE** tout titre qui ne contient pas le keyword + intent.

### 5.4 — Image obligatoire (≥1 standard, ≥N pilier)

> ⚠️ Will : « Chaque contenu doit impérativement avoir une image (ou plusieurs si articles piliers) »

- Article standard : 1 image hero (1200×630 og + variants AVIF/WebP).
- Article pilier : 1 hero + 1 image tous les ~800 mots (≥3 total).
- Comparatif : 1 hero + 1 image par option comparée (min 2).
- Source : `image-bank` interne (cf. [[axionia_image_bank_complet_2026-05-20]]). **JAMAIS** d'IA générative.
- Si image-bank vide pour le sujet → status `pending_image` + alerte admin. Pas de publish sans image.

### 5.5 — Liens internes + externes + suggested

> ⚠️ Will : « Des liens internes, des liens externes (il faut créer une base de liens externes en relation avec notre secteur d'activité ou des entreprises non ?), des contenus suggérés en bas de pages »

**Liens internes** : ≥5 par article, contextuels (pas de blogroll). Stratégie « topical authority » : un article ville lie son article verticale, qui lie son hub.

**Liens externes** : table `ExternalLinkSource` à créer. Champs : `domain`, `authority_score` (DA Moz/Ahrefs/Majestic), `topic_tags`, `relationship` (`partner` | `authority_source` | `cite_only`), `nofollow` boolean. Outils sourcing : Ahrefs / Semrush / `commoncrawl`. Politique : ≥2 externes autorité (DA>50) par article, **toujours `rel="noopener"`**, dofollow si autorité confirmée + relation établie sinon nofollow.

**Suggested below** : composant `<SuggestedContent>` qui affiche 4-6 cartes selon règles :
- 2 articles **même ville** (si applicable) ou même région.
- 2 articles **même verticale**.
- 1-2 articles **même cluster topic** (via topic_tag matching).

### 5.6 — Anti-thin + anti-redondance + anti-duplicate

> ⚠️ Will : « il faut un vrai système anti doublons, antiredondances anti duplicate content pour ne pas diluer le seo ou ne pas être puni par google ou autres »

**3 niveaux de détection** :
1. **Lexical (SimHash)** : 64-bit hash sur 4-grammes du body, distance Hamming ≤8 → flag duplicate.
2. **Sémantique (embeddings)** : Claude embeddings (ou OpenAI `text-embedding-3-large` si pas dispo) → cosine similarity > 0.85 → flag near-duplicate.
3. **Templatique** : structure de titre / outline → SimHash sur outline → flag pattern répété.

**Pipeline** :
- Pré-publication : check vs **tous les articles publiés** + queue gen.
- Si flag → review humain admin OU rewrite auto (prompt « diversifier l'angle »).
- Score « originalité » exposé sur chaque article (admin).

### 5.7 — Visibilité moteurs IA (AI Overviews & co)

Will explicite le shift Google. Voir §2.5. **Toute génération doit cocher** :
- ✅ H1 unique avec keyword early
- ✅ TL;DR / abstract <300 chars dans `<aside class="article-summary">` ET dans JSON-LD `abstract`
- ✅ FAQ ≥6Q (H2 en question directe « Comment / Pourquoi / Quel / Combien ») + FAQPage JSON-LD
- ✅ Speakable JSON-LD sur 2-3 paragraphes synthèse
- ✅ Tableau de synthèse (h2 « En résumé ») — Google adore les tableaux pour AI Overviews
- ✅ Bullet lists (3-7 items) — citations IA friendly
- ✅ Citations sources autorité (≥2 externes DA>50)
- ✅ Auteur identifié (Person JSON-LD + knowsAbout + sameAs LinkedIn)
- ✅ `dateModified` à jour si refresh
- ✅ Schema `isBasedOn` pour les RSS-derived (citation source originale)

### 5.8 — Console admin (suivi temps réel)

> ⚠️ Will : « il faut un vrai suivi complet »

**Dashboards à concevoir** :
1. **Vue globale** : burn-down chart `articles générés / articles cibles` (par campagne, par jour, par semaine).
2. **Par ville** : matrice `ville × verticale × type contenu` → cellules colorées par % couverture.
3. **Par état** : funnel `draft → review → improved → published → indexed`.
4. **Refusés/redondants** : liste avec raison (anti-thin, near-duplicate, low quality score, no image, ...) + action (rewrite | discard | manual edit).
5. **Coût** : Claude API spend par jour / par campagne / par article (cost cap alerte).
6. **Indexation** : crawl GSC + Bing WMT → matrice URL × status (indexed | submitted | excluded | error).
7. **Performance** : CTR + impressions par article (GSC API) après 14 jours publication.

</product-specs>

---

## 6. PHASE 1 — AUDIT FORENSIQUE (16 sous-agents //)

<phase-1-audit>

### 6.1 — Orchestration

Lance les 16 sous-agents **en parallèle** (via Agent tool, subagent_type=Explore pour lectures + general-purpose pour analyses synthèse). Chaque sous-agent :
- Lit son périmètre (Glob + Grep + Read ciblés).
- Produit **1 fichier markdown** dans `_AUDIT/CONTENT-GEN-PERFECTION-2026-05-21/agents/A<NN>-<slug>.md`.
- Structure obligatoire :
  ```
  # A<NN> — <Titre>
  ## Périmètre audité
  ## Méthode
  ## Findings (numérotés, gravité P0/P1/P2)
  ## Score /200
  ## Recommandations (numérotées, effort H)
  ## Références (chemins + lignes)
  ```

### 6.2 — Roster des 16 agents

| # | Slug | Mission | Score /200 |
|---|---|---|---|
| **A1** | `inventory-cartographie` | Inventaire complet : modèles Prisma `Content*`, `Campaign*`, `Keyword*`, `Vertical*`, `Generation*`. Routes admin `/content-gen/**`. Workers BullMQ `gen-*`, `publish-*`. Fichiers `src/server/content-gen/**`. | C1 |
| **A2** | `pipeline-end-to-end` | Trace 1 article depuis admin click jusqu'à sitemap.xml. Identifie chaque étape, chaque file Bull, chaque état DB. Mesure latence p50/p95/p99. | C1 |
| **A3** | `quality-criteria` | Évalue critères qualité actuels (anti-thin, mots min, lisibilité Flesch FR, E-E-A-T). Compare aux standards Hachette/Le Monde Digital. | C2 |
| **A4** | `keywords-intent` | Audit DB `Keyword` (747 seeds) : champs `intent` présent ? mapping verticale × cible × type contenu ? Comment le prompt sélectionne le keyword ? Couverture longue traîne ? | C2 + C3 |
| **A5** | `templates-7-types` | Existe-t-il un template MDX/component par type ? Schemas Zod ? Snapshot tests ? Quelles différences entre `article_titre_manuel` et `pilier` ? | C11 |
| **A6** | `seo-aeo-geo-speakable` | Audit balises générées : title/desc/canonical/og/twitter/hreflang. JSON-LD complet ? FAQPage, Article, Service, LocalBusiness, BreadcrumbList, Speakable, isBasedOn. Speakable bien placé ? | C3 + C4 + C5 + C6 + C7 |
| **A7** | `images-assignment` | Comment le système assigne-t-il une image à un article ? Mapping topic → image-bank. Alt rédactionnel. Variants. Fallback si pas d'image. Conformité doctrine « jamais IA générative ». | C8 |
| **A8** | `internal-external-suggested` | Audit maillage : nb internes/article ? Externes ? `<SuggestedContent>` existe ? Algorithme topic match ? Existe-t-il une table `ExternalLinkSource` ? | C9 |
| **A9** | `dedup-anti-thin` | Existe-t-il SimHash ? Embeddings ? Cosine threshold ? Comment sont identifiés les near-duplicates ? Anti-thin check (mots min) ? Action si flag ? | C10 |
| **A10** | `geo-coverage-villes` | Matrice ville × verticale × type. Combien d'articles par ville actuellement ? Quelle est la stratégie « ville » dans `villes/copy/<slug>.ts` ? Comment éviter cannibalisation ? | C2 + C3 |
| **A11** | `kb-zero-invention` | KB villes V3 (39 villes) + KB sectorielle si existe. Comment injectée dans prompt (RAG ? prompt context ? prompt caching ?) ? Hallucination control ? Citation sources ? | C2 |
| **A12** | `admin-console-suivi` | Pages admin actuelles `/content-gen/**`. Dashboards. Funnels. États affichés. Boutons action. Mode V2 vs V1. UX score. | C13 |
| **A13** | `campaigns-multi-parallel` | Modèle `Campaign` existe ? Comment 2 campagnes coexistent ? Quotas Claude API ? Lock keywords ? Round-robin workers ? | C1 + C15 |
| **A14** | `prompts-architecture` | Combien de prompts ? Stockés où (fichiers, DB, env) ? Format (raw string ? XML tags ?) ? Cache prompt activé ? Chain-of-thought ? Output JSON parsing ? Cost per article ? | C12 |
| **A15** | `publish-sitemap-indexnow` | Workflow publication : draft → published. Sitemap regen (cron ? on publish ?). IndexNow ping. GSC submission. Bing WMT. Latence indexation. | C1 + C15 |
| **A16** | `auto-review-improve` | Existe-t-il un agent reviewer LLM ? Score qualité auto ? Boucle « si score < seuil → améliorer puis re-review » ? Maximum d'itérations ? Cost cap ? | C2 + C15 |

### 6.3 — Critères P0/P1/P2 pour findings

- **P0 (bloquant)** : empêche la perfection ou viole une contrainte légale (RGPD, AI Act). À fixer avant lancement perfection 2026.
- **P1 (perfection)** : optimisation critique pour atteindre 90%+ /3000. Sprint 1-2 mois.
- **P2 (nice-to-have)** : amélioration marginale. Trimestre.

### 6.4 — Output Phase 1

À la fin de Phase 1, agrège dans **`_AUDIT/CONTENT-GEN-PERFECTION-2026-05-21/PHASE-1-AUDIT-SYNTHESE.md`** :
- Tableau récap 16 agents × score /200 → total /3200 (intermédiaire avant ajustements Phase 2).
- Top 10 P0 cross-agents.
- Top 20 P1 cross-agents.
- Synthèse exécutive 1 page.

</phase-1-audit>

---

## 7. PHASE 2 — ARCHITECTURE CIBLE 2026

<phase-2-architecture>

### 7.1 — Section A : Vision système

Produit un schéma textuel **ASCII haut niveau** + 1 page « north star » qui répond à : *« Si AxionIA atteint la perfection content-gen en 12 mois, à quoi ressemble le système ? »*

Format attendu :
```
                              ┌─────────────────────┐
                              │  Admin Console V2   │
                              │ (multi-campaigns)   │
                              └──────────┬──────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          │              │              │
                    ┌─────▼────┐   ┌────▼─────┐   ┌────▼─────┐
                    │ Campaign │   │ Campaign │   │ Campaign │
                    │   #1     │   │   #2     │   │   #N     │
                    └─────┬────┘   └────┬─────┘   └────┬─────┘
                          │             │              │
                          └──────┬──────┴──────────────┘
                                 │
                       ┌─────────▼─────────┐
                       │   Orchestrator    │  (BullMQ + Redis)
                       │  (gen, publish,   │
                       │   review, dedup)  │
                       └─────────┬─────────┘
                                 │
            ┌────────┬───────────┼───────────┬────────┐
            ▼        ▼           ▼           ▼        ▼
       [Workers]  [KB RAG]  [Image-Bank]  [Dedup]  [Quality]
                                 │
                       ┌─────────▼─────────┐
                       │   Publish queue   │
                       │  → ISR revalidate │
                       │  → Sitemap        │
                       │  → IndexNow       │
                       └───────────────────┘
```

### 7.2 — Section B : Décisions canoniques de scope (D1-D5, D11)

#### **D1 — Volume cible/jour** (réponse Q1 Will)

Propose **3 scénarios** avec coûts Claude API estimés + bande passante équipe Will :

| Scénario | Volume/jour | Volume/mois | Cost Claude (~) | Bande passante review humain |
|---|---|---|---|---|
| **A — Bootstrap** | 50/jour | 1500/mois | ~150€/mois | 2h/jour Will |
| **B — Croissance** | 200/jour | 6000/mois | ~600€/mois | 2h/semaine Will + 1 reviewer ext |
| **C — Domination** | 500/jour | 15000/mois | ~1500€/mois | équipe dédiée |

**Recommandation architecte** : **scénario B (200/jour)** pendant 60 jours pour valider qualité, puis bascule scénario C. Justification : scaler trop vite avant que la boucle qualité soit prouvée = risque Google quality update penalty.

#### **D2 — Mix éditorial type contenu** (réponse Q2)

Propose un mix par défaut + matrice ajustable par campagne :

| Type | % default | Justification |
|---|---|---|
| `article_keywords` | 25% | Backbone SEO classique, ROI rapide |
| `longue_traine_intention` | 25% | Cible AI Overviews, low competition |
| `qr_auto_genere` | 18% | AEO premium, alimente FAQ globale, recyclage smart |
| `article_rss` | 12% | Fraîcheur signal Google, low cost |
| `comparatif` | 10% | High commercial intent, conversion |
| `pilier` | 5% | Topical authority, long-term assets |
| `article_titre_manuel` | 5% | Pilotage manuel Will sur opportunités |

#### **D3 — Mix audience tpe/pme/eti** (réponse Q3)

| Verticale | TPE | PME | ETI |
|---|---|---|---|
| `interventions_formations` | 30% | 50% | 20% |
| `un_a_un` | 10% | 40% | 50% |
| `audits` | 40% | 50% | 10% |
| `implementations` | 10% | 50% | 40% |
| `sites_web_augmentes` | 35% | 50% | 15% |

#### **D4 — Couverture matrice ville × verticale** (réponse Q4)

Propose un **objectif 12 mois** :

- **Global France** : ~80 articles / verticale (= 400 articles globaux). Mix = piliers + longue traîne + comparatifs.
- **Par ville** (120 villes cibles 12 mois) : ~5 articles / ville × verticale = 25 articles / ville = **3000 articles villes**.
- **Total cible 12 mois** : ~3400 articles. À 200/jour scénario B → 17 jours plein-régime → mais campagnes mensuelles + qualité = ~6-8 mois pour atteindre.

#### **D11 — Campaign orchestration** (réponse Q11)

Modèle DB proposé :
```ts
model Campaign {
  id          String   @id @default(cuid())
  name        String
  vertical    Vertical
  status      CampaignStatus  // draft | running | paused | completed | archived
  dailyTarget Int             // articles/jour
  totalTarget Int             // articles total
  startDate   DateTime
  endDate     DateTime?
  // Mix
  audienceMix Json            // { tpe: 30, pme: 50, eti: 20 }
  contentMix  Json            // { article_keywords: 25, ... }
  geoScope    Json            // { global: 30, cities: 70, cityIds: [...] }
  // Quotas
  costCapDaily Decimal        // €/jour
  // Ownership
  createdBy   String          @relation(fields: [createdById], references: [id])
  // Tracking
  generated   Int @default(0)
  published   Int @default(0)
  refused     Int @default(0)
  // ...
}
```

Mécanisme parallélisation : 1 worker BullMQ par campagne, namespace `gen:<campaignId>:*`. Coordinator central qui dispatche le cost cap global Claude API entre campagnes actives (round-robin pondéré priorité).

### 7.3 — Section C : Décisions techniques (D5-D10, D12)

#### **D5 — Knowledge Base doctrine** (réponse Q5 Will)

> Will : « Je me demande aussi s'il faut utiliser le knowledge pour être sûr de la qualité des contenus sans données inventées »

**Réponse architecte : OUI, KB obligatoire**, mais structurée en 3 couches :

1. **KB villes V3** (existe, 39 villes) — données INSEE/INAO/UNESCO. Injectée dans prompt pour articles ville.
2. **KB sectorielle** (à créer) — 5 fichiers `kb/verticals/<vertical>.ts` avec : services AxionIA détaillés, pricing, cas clients (anonymisés), différenciateurs vs concurrence (Datacampus, Le Wagon, OpenClassrooms, etc.), arguments TPE/PME/ETI.
3. **KB méta** (à créer) — `kb/global/axionia-entity.ts` : identité, fondateur, valeurs, certifications, mentions presse, awards. Source de vérité GEO entity.

**Stratégie injection** : **prompt caching Claude** (cache_control). Le KB est mis en cache 5 minutes (TTL standard) → coût ÷10 sur génération en batch. Architecture :

```
[system prompt] + [KB cached: 1000-3000 tokens] + [task variable]
                              ↑
                  cache_control: {"type": "ephemeral"}
```

**Zéro invention enforcement** :
- Prompt explicit : « Tu n'utilises QUE les faits présents dans `<knowledge>`. Si un fait n'est pas listé, tu écris `[NÉCESSITE VÉRIFICATION]` au lieu d'inventer. »
- Post-gen check : tout pattern `[NÉCESSITE VÉRIFICATION]` → status `pending_human_review`.
- Citations obligatoires : tout chiffre/date/nom propre dans le body → doit avoir une source liée dans `<sources>`.

#### **D6 — Keyword taxonomy** (réponse Q6 Will)

> Will : « il faut classer les mots clés par type de contenus ? »

**Réponse : OUI, classification multi-dimension**. Schema `Keyword` étendu :

```ts
model Keyword {
  id              String   @id @default(cuid())
  term            String   @unique
  termNormalized  String   // lemmatisé pour matching
  // Classification produit
  vertical        Vertical // 1 keyword = 1 verticale principale
  audienceFit     Audience[] // tpe | pme | eti (peut être multi)
  // Classification SEO
  searchIntent    SearchIntent // informational | commercial | transactional | navigational | local
  searchVolume    Int?     // monthly (Semrush/Ahrefs)
  difficulty      Int?     // 0-100 KD
  // Classification contenu
  contentTypeFit  ContentType[] // à quels types de contenus ce keyword convient
  isLongTail      Boolean  @default(false)
  isLocal         Boolean  @default(false)
  // Géo
  cityIds         String[] // si keyword local, attaché aux villes
  // Usage
  usageCount      Int @default(0)
  lastUsedAt      DateTime?
  // Cluster
  clusterId       String?  // topic cluster groupement
}
```

#### **D7 — Prompt architecture** (réponse Q7 Will)

> Will : « il faut que les prompts soient propres à chaque scénario possible ? Par contre il faut aussi limiter le nombre de prompts. »

**Réponse : architecture modulaire = 6 prompts noyau × variations injectées**.

```
/src/server/content-gen/prompts/
├── 01-system.ts          // role + doctrine + constraints (cached)
├── 02-keyword-select.ts  // input: campaign, output: keyword chosen
├── 03-outline.ts         // input: keyword + contentType, output: outline JSON
├── 04-body.ts            // input: outline + KB, output: MDX
├── 05-faq.ts             // input: body, output: 6+ Q/A
├── 06-jsonld.ts          // input: article complete, output: schema.org JSON-LD
├── 07-review.ts          // input: article, output: quality score + issues
├── 08-improve.ts         // input: article + review issues, output: improved
└── partials/
    ├── _vertical-{vertical}.ts   // contexte verticale (5 fichiers)
    ├── _audience-{audience}.ts   // contexte tpe/pme/eti (3 fichiers)
    ├── _content-type-{type}.ts   // contexte type contenu (7 fichiers)
    └── _city-{slug}.ts           // contexte ville (lazy loaded)
```

**Pattern d'invocation** :
```ts
const prompt = buildPrompt({
  system: PROMPTS.system,
  partials: [
    PROMPTS.partials.vertical[campaign.vertical],
    PROMPTS.partials.audience[article.audience],
    PROMPTS.partials.contentType[article.contentType],
    article.cityId ? PROMPTS.partials.city[article.cityId] : null,
  ].filter(Boolean),
  task: PROMPTS.outline, // ou body, etc.
  variables: { keyword, kb, ... },
});
```

**Best practices 2026 appliquées** :
- XML tags (`<role>`, `<context>`, `<knowledge>`, `<task>`, `<output_format>`, `<examples>`).
- Chain-of-thought : `<thinking>` (Claude 4.7 supporte extended thinking) caché de l'utilisateur.
- Output JSON strict via `<response_format>{"type": "json_schema", ...}</response_format>` validé Zod runtime.
- Prompt caching : système + KB + partials → `cache_control: {type: "ephemeral"}` → coût × ~0.1 sur cache hit (5 min TTL).
- Few-shot examples : 2 exemples par prompt principal (corpus AxionIA réel anonymisé).
- Negative examples : 1 anti-example par prompt (« voici ce qu'il ne faut PAS faire »).

#### **D8 — Linkbase externe** (réponse Q8 Will)

> Will : « Il faut créer une base de liens externes en relation avec notre secteur d'activité ou des entreprises non ? »

**Réponse : OUI, table `ExternalLinkSource` + import semi-automatisé** :

```ts
model ExternalLinkSource {
  id             String   @id @default(cuid())
  domain         String   @unique  // e.g. lemonde.fr
  url            String?   // URL spécifique si page-level
  authorityScore Int      // DR/DA 0-100
  trustScore     Int      // TF 0-100
  // Classification
  topicTags      String[] // ['ia', 'b2b', 'formation', 'pme']
  relationship   LinkRelationship // partner | authority_source | cite_only | competitor (cite if rare)
  // Politique
  nofollow       Boolean @default(true)  // default safe
  sponsored      Boolean @default(false) // si paid
  // Lifecycle
  validated      Boolean @default(false)
  validatedBy    String?
  lastChecked    DateTime?
  status         LinkStatus // active | broken | redirect | removed
}
```

Sources à constituer (Will valide ou pas) :
- **Autorités IA généralistes** : LeMonde, LesEchos, FrenchWeb, Maddyness, BFM Business, Usine Digitale, ZDNet FR, Numerama, France Inter.
- **Référentiels IA** : INRIA, CNRS, Hugging Face, Mila, Stanford HAI, MIT Technology Review FR.
- **Sources B2B** : Cap Gemini Research, McKinsey Insights, BCG, Boston Consulting France, Pôle Emploi (intelligence-emploi.fr), CCI Paris IDF, Bpifrance.
- **Référentiels FR pour pSEO villes** : INSEE, Pages Jaunes (citations), CCI locales, Métropoles (sites officiels).
- **Régulation** : CNIL, ACPR, ANSSI, AI Act portail européen.

**Sourcing pratique** : 
- Phase 1 : seed manuel ~100 domaines (Will valide top 20).
- Phase 2 : crawl `commoncrawl.org` + extraction backlinks Ahrefs (export CSV) + import scripté.
- Phase 3 : enrichissement DR/DA via API Moz ou Ahrefs (~$99/mois Ahrefs Lite).

**Politique de placement** :
- Article standard : 2-3 externes (1 autorité + 1-2 cite_only).
- Pilier : 5-8 externes.
- `rel="noopener noreferrer"` toujours.
- `nofollow` par défaut, dofollow uniquement si `relationship=partner` ET `validated=true`.

#### **D9 — Dedup strategy** (réponse Q9 Will)

> Will : « il faut un vrai système anti doublons, anti redondances anti duplicate content »

**Réponse : 3 niveaux superposés** :

1. **Lexical SimHash 64-bit** (rapide, prévention) :
   - Lib : `simhashjs` ou implémentation maison (~50 LOC).
   - Sur 4-grammes du body normalisé (lowercase + stem).
   - Stockage : champ `Article.simhash` indexé.
   - Check : distance Hamming ≤8 → flag `duplicate_lexical`.

2. **Embeddings sémantique** (lent mais profond) :
   - Provider : OpenAI `text-embedding-3-large` (1536 dim, 0.13$/M tokens) — Claude n'expose pas encore d'API embeddings publique fiable mai 2026. Alternative : Voyage AI (Anthropic partner) `voyage-3-large`.
   - Stockage : pgvector extension Postgres + index HNSW.
   - Check : cosine similarity > 0.85 → flag `duplicate_semantic`.

3. **Templatique outline** :
   - SimHash sur outline (h2/h3 séquence).
   - Distance ≤4 → flag `duplicate_template` → réoriente prompt vers un angle alternatif.

**Pipeline anti-duplicate** :
```
[Article généré]
   ↓
[Compute SimHash] → check vs all published+queued
   ↓ if flag_lexical → status='duplicate_review' + alerte admin
[Compute embedding] → cosine top-5 closest
   ↓ if max_cosine > 0.85 → status='duplicate_review'
   ↓ if 0.75 < max_cosine ≤ 0.85 → log warning + auto-rewrite "diversifier angle"
[OK] → next step (review qualité)
```

#### **D10 — Quality gate** (réponse Q10 Will)

> Will : « Il faut être sûr de la qualité de chaque contenu et si un contenu n'est pas assez bien qu'il soit amélioré avant publication automatiquement »

**Réponse : LLM-as-judge avec scoring multi-dimension** :

Prompt `07-review.ts` produit un JSON :
```json
{
  "scores": {
    "factual_accuracy": 8.5,
    "depth": 7.0,
    "originality": 9.0,
    "readability": 8.0,
    "seo_completeness": 9.5,
    "value_to_reader": 7.5,
    "tone_axionia_alignment": 8.0
  },
  "global_score": 8.2,
  "issues": [
    { "severity": "P1", "category": "depth", "section": "h2-3", "fix": "ajouter exemple concret PME"},
    ...
  ],
  "verdict": "improve"  // publish | improve | reject
}
```

Seuils :
- `global_score >= 8.5` ET pas de P0 → `publish`.
- `7.0 <= global_score < 8.5` OU P1 présents → `improve` (max 2 itérations).
- `global_score < 7.0` OU P0 présents → `reject` + alerte admin pour rewrite manuel.

Coût : ~$0.015 par review (Claude Sonnet 4.6 input ~3K tokens + output ~500). Pour 200 articles/jour avec moy 1.3 itérations → ~$4/jour reviews seul.

#### **D12 — Conformité AI Act art. 50 + traçabilité**

Will n'a pas explicité D12 mais c'est CRITIQUE (deadline août 2026 cf. [[axionia_content_gen_city_domination_2026-05-18]]).

**Réponse** :
- **JSON-LD `aiGenerated: true`** sur tous les articles générés (étendre schema.org via `additionalType: "AIGeneratedContent"`).
- **Mention humaine** : phrase obligatoire en bas d'article : *« Contenu rédigé avec l'assistance de Claude (Anthropic). Édité et validé par l'équipe AxionIA. »*
- **Log providers** : table `GenerationProvenance` : `articleId`, `provider`, `model`, `promptHash`, `inputTokens`, `outputTokens`, `cost`, `timestamp`. Retention 36 mois.
- **DPA signés** : Anthropic (Claude), OpenAI (embeddings), Voyage AI. Will à signer (cf. P0 audit city domination).
- **RGPD art.17 droit à l'oubli** : endpoint `DELETE /api/admin/content-gen/articles/<id>/forget` qui purge le `GenerationProvenance` + le contenu (déjà existant pour image-bank, à étendre).

### 7.4 — Section D : Templates par type contenu (C11)

Pour chaque des 7 types, livre :
- **Structure obligatoire** : h1 + h2/h3 attendus + sections AEO/GEO + position du résumé/abstract/TL;DR.
- **Volumes** : mots min/max body, nb h2 min, nb FAQ Q min.
- **Schemas Zod** des champs requis.
- **Composant MDX/React** dédié (`<ArticleStandard/>`, `<ArticlePilier/>`, `<ArticleComparatif/>`, etc.).
- **JSON-LD spécifique** (e.g. `pilier` ajoute `mainEntityOfPage` + `hasPart` pour table of contents).
- **Snapshot test Vitest** sur 1 article exemple par type.

Exemple pour `pilier` (à détailler pour les 7) :
```
ARTICLE PILIER (skyscraper)
├── Hero image (1200×630, alt 100-125 chars)
├── H1 (60-70 chars, keyword early, intent emphasized)
├── TL;DR / Abstract (200-300 chars, in <aside class="article-summary">)
├── Table of contents (Tailwind sticky, ancres h2)
├── H2 Section 1 — Définition + contexte
│   ├── H3 sous-section
│   └── Image inline
├── H2 Section 2 — Pourquoi maintenant (contexte 2026)
├── H2 Section 3 — Comment faire (HowTo JSON-LD)
│   ├── H3 step 1
│   ├── H3 step 2
│   └── ...
├── H2 Section 4 — Études de cas (3 mini-cases anonymisés depuis KB)
├── H2 Section 5 — Erreurs à éviter (anti-pattern)
├── H2 Section 6 — Outils & ressources (liens externes autorité)
├── H2 Section 7 — Tableau récapitulatif (Google AI loves this)
├── H2 FAQ (≥10 Q/A, FAQPage JSON-LD)
├── H2 Conclusion + CTA contextuel
├── <SuggestedContent /> (6 cartes : 2 ville + 2 verticale + 2 cluster)
└── Footer mention humaine + dateModified

Volume : 3000-6000 mots
Images : ≥3 (hero + ~1 par 1500 mots)
Internes : ≥10
Externes : ≥5 (DA>50)
FAQ : ≥10 Q/A
```

### 7.5 — Section E : SEO/AEO/GEO complet par contenu (C3-C7)

Pour chaque article publié, **30+ assertions** doivent être vérifiables (snapshot test) :

```
✅ <title> 50-60 chars, keyword en première moitié
✅ <meta description> 140-160 chars, CTA + keyword
✅ <link rel="canonical"> absolue, sans param
✅ <link rel="alternate" hreflang="fr"> + en + x-default
✅ <meta property="og:title|description|image|type|url|locale|site_name">
✅ <meta name="twitter:card|title|description|image">
✅ 1 et 1 seul <h1> avec keyword
✅ Hiérarchie h2 > h3 > h4 sans skip
✅ <article itemscope itemtype="https://schema.org/Article">
✅ <nav aria-label="Breadcrumb"> + BreadcrumbList JSON-LD
✅ JSON-LD Article complet (headline, image, datePublished, dateModified, author, publisher, abstract, isBasedOn?, mainEntityOfPage)
✅ JSON-LD FAQPage si FAQ section présente
✅ JSON-LD Service (si page service)
✅ JSON-LD LocalBusiness (si page ville)
✅ JSON-LD Speakable (2-3 paragraphes ciblés)
✅ JSON-LD aiGenerated:true (AI Act art.50)
✅ JSON-LD Person/Organization author + knowsAbout + sameAs
✅ Images <Image> next/image, alt rédactionnel, loading lazy (sauf hero)
✅ Internal links ≥5, anchor text varié (pas tous identiques)
✅ External links ≥2 (DA>50), rel="noopener noreferrer", nofollow par défaut
✅ <aside class="article-summary"> abstract 200-300 chars
✅ Table of contents h2 (si pilier)
✅ TL;DR en haut + résumé en bas
✅ Bullet lists (3-7 items, format AI-friendly)
✅ Tableau de synthèse (au moins 1 par article)
✅ FAQ ≥6 Q/A en h2 ouvrant interrogatif
✅ <SuggestedContent /> rendu côté serveur (pas client-only)
✅ Lighthouse SEO 100/100, perf ≥90, a11y 100, BP 100
✅ Web Vitals : LCP <1800ms, INP <80ms, CLS <0.05 (cf. doctrine projet)
✅ Pagefind index inclus
```

### 7.6 — Section F : Console admin perfection (C13)

Wireframes texte 3 pages clés :

1. **`/admin/content-gen` (dashboard global)** :
   - Header : 4 KPIs cards (articles générés 7j / publiés 7j / refusés 7j / coût Claude 7j).
   - Funnel visuel : draft → review → improved → published → indexed.
   - Heatmap calendar : volume publié par jour x 90 jours.
   - Liste « Top articles » (CTR GSC) + « Worst articles » (faible score qualité).

2. **`/admin/content-gen/campaigns/<id>`** :
   - Header : nom, verticale, dates, status, progression (X/Y articles).
   - Tabs : Settings | Articles | Costs | Issues | Analytics.
   - Settings : édit mix, daily target, cost cap (action pause/resume/clone).
   - Articles : liste filtrable par état + colonnes (titre, ville, type, score, statut, actions).

3. **`/admin/content-gen/city-coverage`** :
   - Matrice ville × verticale × type → cellule = nb articles + couleur intensité.
   - Drill-down clic cellule → liste articles concernés.
   - Filtres : status, score qualité, date.

### 7.7 — Section G : Pipeline ops + scalabilité (C15)

- **Workers BullMQ** : 1 cluster par type de job (`gen`, `review`, `improve`, `dedup`, `publish`, `sitemap`, `indexnow`, `metrics`).
- **Concurrency** par worker à calibrer (gen=10, review=20, publish=5, ...).
- **Backpressure** : si queue dépasse 1000 jobs → auto-pause campagnes basse priorité.
- **Cost cap** : checker quotidien `vendredi 23:00 UTC` qui compute spend Claude API jour → si >80% du cap → notif Will (Slack via webhook).
- **Sentry** : capture toutes erreurs workers avec context `{ campaignId, articleId, step }`.
- **Observability** : Grafana dashboard avec p50/p95/p99 latence par étape pipeline.
- **Runbook** : 1 page `_AUDIT/RUNBOOK-CONTENT-GEN-OPS.md` avec scenarios (campagne stuck, cost overrun, Claude API down, image-bank vide, ...).

</phase-2-architecture>

---

## 8. PHASE 3 — ROADMAP D'EXÉCUTION

<phase-3-roadmap>

### 8.1 — P0 BLOCKERS (Semaine 1-2)

Estime pour chaque item : **effort H** (heures), **dépendances**, **propriétaire** (Will / Claude autopilot / Manon).

| # | P0 | Effort | Propriétaire | Dépendances |
|---|---|---|---|---|
| P0-1 | Migration Prisma : ajout verticale `sites_web_augmentes` | 2h | Claude | — |
| P0-2 | Migration : `Campaign` model + status enum + mix JSON | 4h | Claude | P0-1 |
| P0-3 | Migration : `Keyword` extension (`searchIntent`, `contentTypeFit`, `clusterId`, `isLongTail`, `isLocal`) | 3h | Claude | — |
| P0-4 | Migration : `ExternalLinkSource` table | 2h | Claude | — |
| P0-5 | Migration : `GenerationProvenance` table (AI Act compliance) | 2h | Claude | — |
| P0-6 | Migration : `Article.simhash` + pgvector extension + index HNSW | 4h | Claude | — |
| P0-7 | KB sectorielle : 5 fichiers `kb/verticals/*.ts` initial | 16h | Claude (draft) + Will (review) | — |
| P0-8 | KB méta : `kb/global/axionia-entity.ts` + Wikidata Q-ID création | 4h Claude + 2h Will | Claude + Will | — |
| P0-9 | Prompt architecture refactor : 6 prompts noyau + partials | 12h | Claude | P0-7 |
| P0-10 | Anti-dedup pipeline (SimHash + embeddings + cosine check) | 16h | Claude | P0-6 |
| P0-11 | Quality gate LLM-as-judge (review + improve loop) | 12h | Claude | P0-9 |
| P0-12 | Sitemap multi-tier + IndexNow ping + GSC submit auto | 8h | Claude | — |
| P0-13 | JSON-LD `aiGenerated:true` + mention humaine partout (AI Act art.50 août 2026) | 6h | Claude | P0-5 |
| P0-14 | `<SuggestedContent />` server component avec algo topic+geo | 8h | Claude | — |
| P0-15 | Console admin : page `/admin/content-gen/campaigns` CRUD | 16h | Claude | P0-2 |

**Total P0 : ~115h Claude + ~20h Will + Manon décision** → 2-3 semaines à 40-50h/semaine autopilot.

### 8.2 — P1 PERFECTION (Mois 1-2)

| # | P1 | Effort | Propriétaire |
|---|---|---|---|
| P1-1 | 7 templates production-grade (composants MDX/React + Zod schemas + snapshot tests) | 32h | Claude |
| P1-2 | Linkbase seed (100 domaines manuels) + import Ahrefs CSV | 8h Claude + 4h Will | Mixte |
| P1-3 | Dashboard admin : matrice ville × verticale × type | 12h | Claude |
| P1-4 | Dashboard admin : funnel + heatmap + cost tracking | 12h | Claude |
| P1-5 | Worker pool BullMQ refactor (concurrency tuning + backpressure) | 16h | Claude |
| P1-6 | Sentry coverage + Grafana dashboards | 8h | Claude |
| P1-7 | RUNBOOK-CONTENT-GEN-OPS.md | 4h | Claude |
| P1-8 | Tests E2E Playwright sur génération bout-en-bout | 16h | Claude |
| P1-9 | Tests Vitest sur dedup + quality gate + prompts (>80% coverage) | 20h | Claude |
| P1-10 | Hreflang FR/EN sur tous articles + sitemaps bilingues | 8h | Claude |

**Total P1 : ~140h Claude + ~4h Will** → 1.5-2 mois en sliding window.

### 8.3 — P2 NICE-TO-HAVE (Trimestre 1-2)

| # | P2 | Effort |
|---|---|---|
| P2-1 | A/B testing prompts (multi-variants génération) | 16h |
| P2-2 | Re-publishing intelligent (refresh articles >6 mois) | 12h |
| P2-3 | GSC API ingestion auto (CTR + impressions par article) | 8h |
| P2-4 | Bing WMT + Yandex WMT API ingestion | 6h |
| P2-5 | Auto-translate FR→EN (Claude vision) | 12h |
| P2-6 | Newsletter auto from top 5 published cette semaine | 8h |
| P2-7 | Bridge LinkedIn auto-post avec teasers | 12h |
| P2-8 | Schema.org HowTo / Recipe / Course types selon verticale | 6h |
| P2-9 | Affiliate links tracking (futur) | — |
| P2-10 | KB sectorielle enrichissement quarterly | 20h |

### 8.4 — Séquencement convergence Manon

Will travaille avec Manon (autre conversation Claude) sur :
- `villes/copy/<slug>.ts` (Rouen actuellement)
- `image-bank/seed-images.ts`

**Règle** : Phase 3 démarre quand Manon a poussé OU pause confirmée Will. Vérifier `git log --all --oneline -20` avant chaque commit.

### 8.5 — Critères Definition of Done (DoD)

Chaque P0/P1 est « done » seulement si :
- ✅ Code écrit
- ✅ Typecheck 0 erreur
- ✅ Lint 0 erreur
- ✅ Tests Vitest passants (et nouveaux tests ajoutés pour la feature)
- ✅ Pre-commit hooks ×8 verts
- ✅ Snapshot anti-régression (si page rendue : Playwright screenshot)
- ✅ Doc `_AUDIT/CONTENT-GEN-PERFECTION-2026-05-21/CHANGELOG.md` mise à jour
- ✅ Commit avec message Conventional
- ✅ Push autorisé seulement si Manon idle (vérifier)

</phase-3-roadmap>

---

## 9. PHASE 4 — VERDICT & STOP & ASK

<phase-4-verdict>

À la fin, produis **`_AUDIT/CONTENT-GEN-PERFECTION-2026-05-21/VERDICT.md`** :

### Structure

```markdown
# VERDICT — CONTENT-GEN PERFECTION 2026

## Score actuel système /3000 : XXX/3000 (Y%)

| Catégorie | Score /200 | Statut |
|---|---|---|
| C1 — Pipeline e2e | XX/200 | 🟢🟡🟠🔴 |
| ... |  |  |
| **TOTAL** | **XXX/3000** | **🟢/🟡/🟠/🔴** |

## Score cible 12 mois /3000 : 2850/3000 (95%)

## Gap analysis

- P0 : 15 items, ~115h Claude + ~20h Will → 2-3 semaines
- P1 : 10 items, ~140h Claude + ~4h Will → 1.5-2 mois
- P2 : 10 items, ~100h Claude → trimestre

## Synthèse exécutive (1 paragraphe)

[Bla bla constat actuel + roadmap + ROI estimé + risques]

## ⚠️ STOP & ASK Will — 12 décisions canoniques

Aucun commit ne sera fait avant validation Will sur :

### D1 — Volume cible/jour
- **Proposition** : Scénario B (200/jour), bascule C (500/jour) après 60j si qualité >85%.
- **Alternative** : Scénario A (50/jour) si Will pas confiant boucle qualité.
- **❓ Question Will** : OK pour B ou tu veux A/C ?

### D2 — Mix éditorial type contenu
- **Proposition** : article_keywords 25% + longue_traine 25% + qr_auto 18% + rss 12% + comparatif 10% + pilier 5% + titre_manuel 5%
- **❓ Question Will** : Veux-tu ajuster un % spécifique ?

### D3 — Mix audience tpe/pme/eti
- **Proposition** : matrice spécifique par verticale (cf. §7.2 D3).
- **❓ Question Will** : Valide ou ajuster ?

### D4 — Couverture matrice ville × verticale
- **Proposition** : 12 mois → 80 globaux/verticale + 5 articles/ville × 5 verticales × 120 villes = 3400 articles total.
- **❓ Question Will** : Combien de villes cible (39 / 80 / 120 / 200) ? Et nb articles/ville (3/5/10) ?

### D5 — KB doctrine
- **Proposition** : KB obligatoire 3 couches (villes + sectorielle + méta), injection via prompt caching.
- **❓ Question Will** : OK pour 16h initial Claude draft + 4h ton review sectorielle ?

### D6 — Keyword taxonomy
- **Proposition** : extension `Keyword` avec searchIntent + contentTypeFit + isLongTail + isLocal + cityIds + clusterId.
- **❓ Question Will** : OK extension migration ?

### D7 — Prompt architecture
- **Proposition** : 6 prompts noyau + 5 partials verticales + 3 partials audience + 7 partials type + lazy city partials.
- **❓ Question Will** : OK pour cette architecture ou tu préfères 1 méga-prompt par scénario (réponse Will : « limiter le nombre ») ?

### D8 — Linkbase externe
- **Proposition** : table `ExternalLinkSource` + seed 100 manuel + import Ahrefs CSV ($99/mois) Phase 2.
- **❓ Question Will** : OK budget Ahrefs $99/mois ? Ou alternative Semrush / gratuit (Google Search) ?

### D9 — Dedup strategy
- **Proposition** : SimHash + embeddings (pgvector) + outline templatique. Provider embeddings = OpenAI text-embedding-3-large (~$0.13/M tokens) ou Voyage AI.
- **❓ Question Will** : OK provider embeddings ?

### D10 — Quality gate
- **Proposition** : LLM-as-judge Claude Sonnet, seuil 8.5 publish / 7-8.5 improve (max 2 itérations) / <7 reject manuel. ~$4/jour pour 200 articles.
- **❓ Question Will** : OK seuils ou plus strict (9.0 publish) ?

### D11 — Campaign orchestration
- **Proposition** : modèle `Campaign` + workers BullMQ namespacés + cost cap global dispatché round-robin.
- **❓ Question Will** : OK pour cette architecture ?

### D12 — AI Act art. 50 + traçabilité
- **Proposition** : JSON-LD `aiGenerated:true` partout + mention humaine + GenerationProvenance + DPA signés providers + RGPD art.17 endpoint.
- **❓ Question Will** : OK pour la mention humaine en bas d'article ? Quel wording exact ?

## ⚠️ Items UNKNOWN à confirmer Will

[Liste des trucs auxquels l'auditeur n'a pas pu répondre avec certitude — schema actuel, état exact en prod, etc.]
```

</phase-4-verdict>

---

## 10. LIVRABLES — Structure finale du dossier `_AUDIT/CONTENT-GEN-PERFECTION-2026-05-21/`

```
_AUDIT/CONTENT-GEN-PERFECTION-2026-05-21/
├── README.md                           # Index + résumé exécutif 1 page
├── PHASE-1-AUDIT-SYNTHESE.md           # Synthèse 16 agents
├── PHASE-2-ARCHITECTURE-CIBLE.md       # Vision système + Sections A-G
├── PHASE-3-ROADMAP-EXECUTION.md        # P0/P1/P2 chiffré + DoD
├── VERDICT.md                          # Score + STOP & ASK 12 décisions
├── agents/
│   ├── A01-inventory-cartographie.md
│   ├── A02-pipeline-end-to-end.md
│   ├── A03-quality-criteria.md
│   ├── A04-keywords-intent.md
│   ├── A05-templates-7-types.md
│   ├── A06-seo-aeo-geo-speakable.md
│   ├── A07-images-assignment.md
│   ├── A08-internal-external-suggested.md
│   ├── A09-dedup-anti-thin.md
│   ├── A10-geo-coverage-villes.md
│   ├── A11-kb-zero-invention.md
│   ├── A12-admin-console-suivi.md
│   ├── A13-campaigns-multi-parallel.md
│   ├── A14-prompts-architecture.md
│   ├── A15-publish-sitemap-indexnow.md
│   └── A16-auto-review-improve.md
├── annexes/
│   ├── data-model-additions.md         # Tous les schemas Prisma proposés
│   ├── prompt-examples.md              # Sample XML-tagged prompts 6 noyau
│   ├── template-pilier-example.md      # 1 template complet exemplaire
│   ├── template-comparatif-example.md
│   ├── seo-aeo-geo-checklist.md        # 30+ assertions §7.5
│   ├── admin-wireframes-text.md        # ASCII wireframes 3 pages
│   ├── runbook-ops.md                  # Scénarios pannes & recovery
│   └── budget-estimation.md            # Coûts détaillés Claude + embeddings + Ahrefs
└── CHANGELOG.md                        # Mises à jour audit lui-même
```

---

## 11. DÉCLENCHEMENT — Comment lancer cet audit

Will, pour lancer cet audit, copie-colle ce message exact dans une nouvelle conversation Claude Code :

> Lance l'audit `_AUDIT/PROMPT-CONTENT-GEN-PERFECTION-2026-05-21.md`. Mode AUDIT-ONLY strict, aucun commit autopilote. Vérifie git log convergence Manon avant de démarrer. Spawn 16 sous-agents Phase 1 en parallèle. Termine par VERDICT.md + STOP & ASK les 12 décisions canoniques. Estimation 22-28h. Go.

L'agent lancé devra :
1. Lire ce fichier en entier (self-contained).
2. Créer le dossier `_AUDIT/CONTENT-GEN-PERFECTION-2026-05-21/`.
3. Spawn 16 sous-agents Phase 1 (Agent tool avec subagent_type=Explore pour audit lecture + general-purpose pour synthèse).
4. Agréger Phase 1 → produire Phase 2 (Architecture).
5. Produire Phase 3 (Roadmap).
6. Produire VERDICT.md.
7. Sauvegarder dans la mémoire un entry `axionia_content_gen_perfection_audit_2026-05-21.md` linkant tout.
8. **STOP** — attendre validation Will.

---

## 12. ANNEXE — Références à charger AVANT démarrage

L'agent qui exécute ce prompt DOIT lire ces fichiers/dossiers avant de spawner les sous-agents (contexte essentiel) :

- `src/server/content-gen/**` (code existant)
- `prisma/schema.prisma` (modèles existants)
- `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/` (audit précédent)
- `_AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/` (audit précédent)
- `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/` (audit keywords)
- `axionia/kb/villes/**` (KB existante)
- `src/app/[locale]/(public)/**` (rendering routes)
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/**` (admin actuel)
- `git log --all --oneline -30` (convergence sessions parallèles)
- Mémoires : `axionia_content_gen_deep_audit_2026-05-18`, `axionia_content_gen_city_domination_2026-05-18`, `axionia_keywords_747seeds_2026-05-20`, `axionia_image_bank_complet_2026-05-20`, `axionia_keyword_strategy_audit_2026-05-19`

---

## 13. ANNEXE — Best practices Claude API mai 2026 à appliquer

- **Modèle pour génération corps** : `claude-opus-4-7` (top quality) ou `claude-sonnet-4-6` (10× moins cher, ~95% qualité Opus). Recommandation : Sonnet par défaut, Opus pour piliers + comparatifs.
- **Modèle pour review** : `claude-sonnet-4-6` (suffisant pour scoring).
- **Modèle pour outline / FAQ** : `claude-haiku-4-5-20251001` (rapide + bon marché).
- **Prompt caching** : `cache_control: {"type": "ephemeral"}` sur system prompt + KB + partials. TTL 5 min standard. Cache hit = ~10% du coût.
- **Tool use** : pour validation JSON output (`response_format` json_schema strict).
- **Streaming** : OK pour génération corps (UX admin live preview).
- **Extended thinking** : activer sur génération piliers (`thinking: {type: "enabled", budget_tokens: 10000}`) — Claude réfléchit profondément avant d'écrire.
- **Batch API** : pour campagnes >100 articles, utiliser Batch API Anthropic (50% prix réduit, latence ≤24h acceptable).
- **Files API** : si KB volumineuse (>50K tokens), uploader comme file et référencer.
- **Citations** : utiliser feature Anthropic Citations pour traçabilité sources (gratuit).

---

## 14. CRITIQUE FINALE — Pièges à éviter

L'agent qui exécutera ce prompt doit éviter :

1. ❌ **Vouloir tout réécrire from scratch** : 62% (746/1200) qualité déjà existant. Préfère « extend & refactor » à « rewrite ».
2. ❌ **Sous-estimer la convergence Manon** : 2x déjà vu des conflits merge (commits 6aaa57f en attente). Coordination > vitesse.
3. ❌ **Optimiser pour Lighthouse au détriment de l'AEO** : un article qui ranke #1 mais n'est jamais cité par AI Overviews perd 60% de son trafic 2026.
4. ❌ **Industrialiser avant que la qualité soit prouvée** : 500/jour buggy = penalty Google. Mieux : 50/jour parfaits 30 jours, puis scaler.
5. ❌ **Multiplier les abstractions « generic framework »** : préfère 7 templates concrets à 1 template-engine.
6. ❌ **Oublier le bilingue EN** : Will l'a moins explicité mais c'est dans la doctrine.
7. ❌ **Sous-évaluer le coût Claude API** : 200 articles/jour × ~3K input + ~3K output × Sonnet = ~$3/article hors cache = $600/jour = $18K/mois. Avec prompt caching → ~$60-100/jour réaliste (~$1800-3000/mois).
8. ❌ **Ne pas tester anti-doublons en charge** : SimHash 64-bit sur 10K articles = vérification O(N) = 10K hash distance. OK pour 10K, à reconsidérer à 100K (LSH index).
9. ❌ **Croire qu'un seul LLM-judge suffit pour la qualité** : ajouter heuristiques mesurables (Flesch FR, mots min, nb internal links, présence schemas) en complément.
10. ❌ **Publier sans review humain au début** : durant 30 premiers jours, sample 10% des articles à review Will avant publish même si auto-quality OK.

---

## 15. FIN — Cap, mission, livraison

Tu as maintenant tout pour exécuter une perfection absolue. Le succès se mesure à :

- 🎯 **Visibilité** : AxionIA cité ≥30% des AI Overviews FR sur queries `Formation IA PME`, `Audit IA TPE`, `Coaching IA dirigeant`, `Implémentation IA entreprise`, `Site web augmenté IA` à 12 mois.
- 🎯 **Volume** : 3400 articles publiés indexés Google d'ici 12 mois.
- 🎯 **Qualité** : aucun article publié sous quality_score 8.5, 0 penalty Google quality update.
- 🎯 **Scalabilité** : capacité 500/jour soutenue sans dégradation.
- 🎯 **Conformité** : 100% articles aiGenerated:true, AI Act art.50 prêt août 2026.
- 🎯 **Coût** : ≤ 3000€/mois infra + Claude + embeddings + tools, à 200/jour.

**Go quand Will dit go.** ✊

---

*Fin du prompt master CONTENT-GEN-PERFECTION 2026.*
