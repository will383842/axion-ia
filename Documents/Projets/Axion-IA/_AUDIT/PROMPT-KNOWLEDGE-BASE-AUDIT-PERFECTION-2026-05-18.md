# PROMPT — Audit perfection 2026 de la Knowledge Base AxionIA

**Date** : 2026-05-18
**Auteur** : Will (via Claude Code, Opus 4.7 1M)
**Cible repo** : `axionia/` (Next.js 16 + Prisma 5 + PostgreSQL + BullMQ)
**Mode** : AUDIT-ONLY (lecture seule du code, écriture autorisée uniquement dans `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/`)
**Durée estimée** : 8-12 h autopilote (6 sous-agents //)
**Scoring** : /2000 (10 catégories × 200 pts) → 🟢 ≥ 1700 / 🟡 1400-1699 / 🟠 1100-1399 / 🔴 < 1100
**Langage de sortie** : français simple et concret, zéro jargon non expliqué, comme si tu parlais à un dirigeant qui n'est pas dev

---

## 0. Pourquoi ce prompt existe (lecture humaine)

Tu (Will) veux savoir **trois choses concrètes** sur ta Knowledge Base :

1. **Est-ce que tout est parfait et bien raccordé ?**
   → Tous les modules `Knowledge*` du schéma Prisma sont-ils utilisés ? Les composants front affichent-ils bien ce que la base contient ? Les workers d'ingest tournent-ils ? Y a-t-il des bouts morts (code écrit mais jamais appelé) ou des trous (feature promise mais pas câblée) ?

2. **Quelles parties puis-je modifier depuis l'admin** (`/connaissances/` et `/content-gen/kb-readonly/`) **sans toucher au code, et lesquelles exigent un dev ?**
   → Pour chaque champ et chaque type de contenu, dis-moi en clair : "ça, tu peux. Ça, tu peux pas, faut un dev."

3. **À quoi sert chaque morceau dans la vraie vie, et avec quel outil il parle ?**
   → Le pgvector embedding sert à quoi quand un visiteur arrive sur le site ? Le worker d'ingest, il va chercher quoi et il livre où ? La KB nourrit-elle le ContentGen ? L'image-bank ? Le blog ? Les sitemaps ?

**Tout doit être expliqué en langage simple, avec des exemples concrets** : "Quand un visiteur tape 'comment IA cabinet' dans la recherche, voici le chemin réel : visiteur → Pagefind index → ... → résultat affiché."

---

## 1. Périmètre exact (ce que tu dois auditer)

### 1.1 — Modèles Prisma (18 modèles `Knowledge*`)

À lire dans `axionia/prisma/schema.prisma` (lignes ~1935 à ~2430) :

| # | Modèle | Rôle attendu (à vérifier) |
|---|---|---|
| 1 | `KnowledgeEntry` | Entrée racine (article, FAQ, glossaire, étude de cas, doctrine, ADR, RFC…) |
| 2 | `KnowledgeTranslation` | Traduction FR + EN (slug, titre, body, SEO, OG…) |
| 3 | `KnowledgeVersion` | Historique (versions précédentes, rollback) |
| 4 | `KnowledgeTag` | Tags libres modérés |
| 5 | `KnowledgeTagOnEntry` | M2M Entry ↔ Tag |
| 6 | `KnowledgeRelation` | Liens internes ("voir aussi", "remplace", "prerequisite") |
| 7 | `KnowledgeFeedback` | Vote 👍/👎 visiteur public |
| 8 | `KnowledgeAsset` | Image / fichier joint à une entrée |
| 9 | `KnowledgeSlugHistory` | Vieux slugs → 301 (SEO préservé) |
| 10 | `KnowledgeBookmark` | Favoris admin |
| 11 | `KnowledgeAnnotation` | Notes internes (review, post-it éditorial) |
| 12 | `KnowledgeCollection` | Regroupements thématiques |
| 13 | `KnowledgeCollectionItem` | M2M Collection ↔ Entry |
| 14 | `KnowledgeImportBatch` | Trace des imports en masse (markdown, sitemap, etc.) |
| 15 | `KnowledgeReviewerAssignment` | Attribution review (qui valide quoi) |
| 16 | `KnowledgeEmbedding` | pgvector — recherche sémantique |
| 17 | `KnowledgeIngestRequest` | Requête d'ingest URL externe / sitemap |
| 18 | `KnowledgeAuditLog` | Audit trail (qui a fait quoi) + `KnowledgeSeoCache` (cache SEO calculé) |

**Pour chaque modèle, le rapport doit dire** :
- ✅ Utilisé en lecture (par quel fichier) / ⚠️ jamais lu / ❌ jamais lu ni écrit (table morte)
- ✅ Utilisé en écriture (par quel server action ou worker) / ⚠️ jamais écrit (table fantôme)
- 🔗 Champs FK cohérents (cascade / setNull / restrict bien choisi ?)
- 📐 Index présent sur les colonnes filtrées en pratique (UI admin + recherche publique)
- 🧪 Couvert par au moins 1 test (unit / intégration)

### 1.2 — 12 types V4 Knowledge Factory

Lus dans `schema.prisma:478-510` et `src/content/knowledge/types.ts`.
Pour chacun (article, FAQ, glossary, case-study, doctrine, ADR, RFC, help-article, methodology, comparison, legal, press) :
- Est-il créable depuis l'admin ? (capture du formulaire ou explication "non, hardcodé en seed")
- A-t-il un template d'affichage côté public ? (route, composant, exemple URL)
- Existe-t-il un test de rendu / SEO ?
- Génère-t-il du JSON-LD spécifique ? (FAQPage, HowTo, TechArticle, etc.)

### 1.3 — Server actions (24 fichiers, `src/server/actions/knowledge/`)

```
_audit.ts            _guards.ts           _revalidate.ts      _transition.ts
_zod-schemas.ts      add-relation.ts      annotations.ts      approve.ts
archive.ts           assign-reviewer.ts   collections.ts      create-entry.ts
delete-entry.ts      get-entry.ts         ingest.ts           list-entries.ts
publish.ts           restore.ts           rollback-version.ts save-draft.ts
schedule-publish.ts  seo-cache.ts         submit-for-review.ts unpublish.ts
update-entry.ts      upload-asset.ts
```

Pour chaque action :
- Vérifier `_guards.ts` (auth + RBAC role minimum requis)
- Vérifier `_zod-schemas.ts` (validation input → pas de XSS / SQLi possible)
- Vérifier `_audit.ts` appelé → trace dans `KnowledgeAuditLog`
- Vérifier `_revalidate.ts` appelé → ISR `revalidatePath` / `revalidateTag` propre
- Vérifier `_transition.ts` respecte la state machine (`src/lib/knowledge/state-machine.ts`)

### 1.4 — Lib (~40 modules, `src/lib/knowledge/`)

Inventaire vérifié au lancement :
```
alt-text-validation, audit-log, banned-words, client-surface, dedup-check,
embeddings, feature-flag, hmac, kb-coverage, kill-switch,
legacy-import-mapping, legacy-mapping-{case-study, faq, glossary-hardcode, help-article},
locale-policy, markdown-import, pii-scan, prisma-helpers, public-fetch,
quality-gates, readability, readers, retention-policy, rgpd-export,
search-fts, seo-generator, slug-history, snapshot, state-machine,
tiptap-sanitize, toc-generator, toc-readability
```

**Vérifier pour chaque module** :
- A-t-il un fichier `.test.ts` à côté ? (TDD réel ou pas)
- Est-il importé quelque part en runtime ? (`grep -r "from.*lib/knowledge/<module>"`)
- Sa logique correspond-elle à son nom ? (un module `banned-words` qui ne filtre rien = mort)
- Sortie : "✅ vivant et utilisé / ⚠️ écrit mais jamais importé / ❌ vide"

### 1.5 — UI admin (2 sections)

**Section principale** : `src/app/[locale]/(admin)/[adminPrefix]/connaissances/`
- `page.tsx` (liste)
- `nouvelle/page.tsx` (création)
- `[id]/page.tsx` (édition)
- `_v2/` (route flag V2, voir `ADMIN_V2_ENABLED`)

**Section secondaire** : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/kb-readonly/`
- `page.tsx` (vue read-only depuis le module ContentGen)
- `[id]/page.tsx`

Pour CHAQUE champ visible à l'écran, classer :
- 🟢 **Éditable admin** — Will peut modifier sans dev (ex : titre, body, tags, status)
- 🟡 **Éditable admin mais avec garde-fous** — modification possible mais validation côté serveur (ex : slug → écrit dans `KnowledgeSlugHistory`)
- 🔴 **Hardcodé dans le code** — exige une PR (ex : taxonomie des types V4, audiences canoniques)
- ⚫ **Calculé automatiquement** — non éditable (ex : `KnowledgeEmbedding`, `readingTimeMinutes`)

### 1.6 — API publique + API interne

- `src/app/api/internal/kb/` (signée HMAC `INDEXNOW_INTERNAL_HMAC_SECRET` ?)
- Routes publiques de consommation (`/fr/blog/[slug]`, `/fr/glossaire/[slug]`, `/fr/faq`, etc.) → vérifier qu'elles lisent bien `KnowledgeEntry` + `KnowledgeTranslation` et non du markdown statique
- Sitemap : `KnowledgeEntry` publiées apparaissent-elles dans `sitemap-*.xml` ?
- JSON-LD : factory `buildArticleJsonLd` / `buildFAQPageJsonLd` / `buildHowToJsonLd` câblées ?

### 1.7 — Workers BullMQ (`src/server/queue/workers/`)

Chercher tous les `*kb*` ou `*knowledge*` worker :
- Worker d'ingest (`kb-ingest` ?) — quelles URL il fetch ? Quel rate-limit ? Quel parsing (`sitemap-parser`, `url-extractor`, `robots-respect`) ?
- Worker d'embedding — quel modèle ? (Claude embed ? OpenAI ada ? bge-m3 local ?) Quelle dimension vector ? Coût estimé pour 10 000 entries ?
- Worker de SEO cache — quelle TTL ?
- Worker RGPD — droit à l'oubli purge bien `KnowledgeEntry` + cascade ?

### 1.8 — Cross-cuttings (interconnexions)

| Module amont | Module aval | Vérification |
|---|---|---|
| `KnowledgeEntry` | `ContentGen` (audit trail RAG) | Champ `knowledgeEntries KnowledgeEntry[]` sur `ContentGenJob` est-il rempli en pratique ? |
| `KnowledgeAsset` | `image-bank` (V1) | Une asset KB peut-elle pointer vers une image image-bank V1 (ou est-ce un système parallèle) ? |
| `KnowledgeEntry` | Pagefind index | L'index Pagefind couvre-t-il les entries publiées ? (Sprint 15 placeholder ?) |
| `KnowledgeEntry` | Sitemap | Toutes les entries `status=PUBLISHED` sont-elles dans `sitemap-knowledge.xml` ? |
| `KnowledgeEntry` | JSON-LD `subjectOf` / `isBasedOn` | Le graph JSON-LD lie-t-il les pages aux entries KB ? |
| `KnowledgeIngestRequest` | Robots.txt | Le worker respecte-t-il `robots-respect.ts` (User-Agent Allow / Disallow) ? |
| `KnowledgeEmbedding` | Recherche sémantique publique | Existe-t-il une route `/api/search` qui utilise pgvector ? Ou est-ce uniquement FTS Postgres (`search-fts.ts`) ? |

---

## 2. Méthode (6 sous-agents //)

### Agent A1 — Inventaire & cohérence schéma
- Lire `schema.prisma` (modèles `Knowledge*` + relations entrantes depuis `ContentGen*`, `Image*`, `User`)
- Produire `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/A1-SCHEMA-INVENTORY.md`
- Sortie : tableau 18 modèles × { lu, écrit, indexé, FK saine, testé } + verdict /200

### Agent A2 — Server actions × state machine
- Lire `src/server/actions/knowledge/*.ts`
- Vérifier que CHAQUE transition (DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED → RESTORED) appelle bien `_transition.ts` + `_audit.ts` + `_revalidate.ts`
- Vérifier RBAC (`_guards.ts`)
- Sortie `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/A2-SERVER-ACTIONS-STATE-MACHINE.md` + verdict /200

### Agent A3 — UI admin : qu'est-ce que Will peut modifier ?
- Lire les 6 routes admin (`connaissances/` + `content-gen/kb-readonly/`)
- Pour chaque champ du formulaire, classer 🟢/🟡/🔴/⚫ comme défini §1.5
- Produire un **GROS tableau ergonomique** : 1 ligne = 1 champ × 1 type de contenu
- Inclure capture conceptuelle ("dans /admin/connaissances/nouvelle, tu vois : [titre] [slug] [body Tiptap] [tags] [collection] [...]")
- Sortie `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/A3-ADMIN-EDITABILITY-MATRIX.md` + verdict /200

### Agent A4 — Workers + ingest + embeddings
- Lire `src/server/queue/workers/` (tous les fichiers `*kb*` ou liés)
- Lire `src/server/content-gen/kb-ingest/`
- Identifier le modèle d'embedding utilisé + son coût mensuel attendu pour ~10k entries
- Vérifier que `robots-respect.ts` est appelé avant tout fetch externe
- Sortie `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/A4-WORKERS-INGEST-EMBEDDINGS.md` + verdict /200

### Agent A5 — Consommation publique (front + SEO + sitemaps)
- Lister toutes les routes publiques qui lisent du `KnowledgeEntry`
- Vérifier sitemap inclusion + hreflang FR/EN + JSON-LD par type
- Vérifier 301 `KnowledgeSlugHistory`
- Vérifier Pagefind index réel ou stub (Sprint 15)
- Sortie `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/A5-PUBLIC-CONSUMPTION-SEO.md` + verdict /200

### Agent A6 — Cross-cuttings : à quoi sert la KB en vrai ?
- Tracer 5 user journeys concrets et écrire le chemin technique réel pour chacun :
  1. Visiteur tape "audit IA cabinet" dans la recherche site
  2. ContentGen génère une page ville → quelles entries KB sont citées dans le prompt RAG ?
  3. Admin crée une nouvelle entrée FAQ → où apparaît-elle en prod (URL exacte + délai ISR) ?
  4. Visiteur clique 👎 sur une entrée → où va le feedback ? Qui le voit ? Quand ?
  5. RGPD : visiteur demande effacement → `KnowledgeFeedback`/`KnowledgeAnnotation` liés à son user sont-ils purgés ?
- Sortie `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/A6-USER-JOURNEYS-LANGAGE-SIMPLE.md` + verdict /200

### Synthèse finale (Will lit ça)
- `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/VERDICT-FINAL.md`
- `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/EXEC-SUMMARY-WILL.md` ← **le doc qui compte pour toi**
- `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/MANIFEST.md` (inventaire des 9+ livrables)

---

## 3. Forme du `EXEC-SUMMARY-WILL.md` (le plus important)

Doit contenir, dans cet ordre, **en langage simple** :

### 3.1 — En une phrase
"Ta KB c'est : [X entries en base, Y types possibles, Z% utilisé, ça nourrit A/B/C, ça pèse N Mo, ça coûte M €/mois]."

### 3.2 — À quoi ça sert dans la vraie vie
Liste à puces, 1 phrase chacune, **sans jargon** :
- "Ça alimente le blog public (`/fr/blog`) — sans la KB, le blog est vide."
- "Ça nourrit l'IA ContentGen quand elle écrit une page ville — la KB fournit les sources d'autorité."
- "Ça génère le glossaire SEO + les FAQ → ce sont des aimants à trafic Google."
- (etc.)

### 3.3 — Ce que tu peux faire directement depuis l'admin (sans dev)
**Tableau gros et lisible** :

| Action | Où dans l'admin | Effet immédiat | Délai avant visible en prod |
|---|---|---|---|
| Créer une FAQ | `/admin/connaissances/nouvelle` puis type "FAQ" | Brouillon créé | Invisible tant que pas publié |
| Publier une entrée | Bouton "Publier" sur la fiche | Status → PUBLISHED + sitemap màj + ping IndexNow | ~30s (ISR `revalidatePath`) |
| Modifier le titre | Formulaire édition | Nouveau titre + version archivée auto | ~30s |
| Changer le slug | Formulaire édition (champ slug) | Ancien slug 301 vers nouveau (auto via `KnowledgeSlugHistory`) | ~30s |
| ... | ... | ... | ... |

### 3.4 — Ce que tu ne peux PAS faire depuis l'admin (exige un dev)
**Tableau** :

| Ce que tu voudrais faire | Pourquoi c'est verrouillé | Solution / ETA |
|---|---|---|
| Ajouter un 13e type de contenu | Hardcodé dans `schema.prisma` enum + composants front | PR dev 2-4h |
| Modifier l'audience "PME-ETI" canonique | Seed `audiences.ts` | PR dev 30min + migration data |
| Changer le modèle d'embedding | Worker hardcode | PR dev 1h + recompute ~M€ |
| ... | ... | ... |

### 3.5 — Avec quels outils c'est raccordé
**Schéma ASCII + explication 1 phrase par flèche** :

```
                ┌──────────────────────┐
                │   KnowledgeEntry     │ ← table racine
                └──────┬───────────────┘
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
   PostgreSQL    Worker BullMQ      Front public
   (Prisma 5)    (ingest + embed)   (Next.js 16 ISR)
       │               │                │
       │               ▼                ▼
       │         pgvector          Sitemap +
       │         (recherche         JSON-LD +
       │          sémantique)       Pagefind
       │                                │
       └────────┬───────────────────────┘
                ▼
        ContentGen RAG
        (cite les entries
         dans le prompt
         qui génère les
         pages villes)
```

Puis 1 paragraphe par outil :
- **PostgreSQL** : stockage, 18 tables, ~X Mo, sauvegarde quotidienne via cron
- **BullMQ Redis** : file de tâches, traite l'ingest URL externe et le calcul d'embedding
- **pgvector** : extension PostgreSQL qui permet la recherche par similarité sémantique (= "trouve-moi les entrées qui parlent du même sujet, même si les mots sont différents")
- **Next.js ISR** : régénération à la demande quand une entrée est publiée (`revalidatePath`)
- **Pagefind** : moteur de recherche statique compilé au build (= recherche dans la barre `⌘K`)
- **IndexNow** : ping Bing/Yandex/Naver quand une entrée est publiée → indexation rapide
- **JSON-LD** : balises invisibles dans le HTML qui disent à Google "ceci est un FAQPage / TechArticle"
- **ContentGen** : module qui génère des pages SEO → consomme la KB comme source d'autorité

### 3.6 — Verdict final
- Note globale /2000
- Top 5 P0 (bloquants à corriger)
- Top 5 P1 (importants ce mois)
- Top 5 quick-wins (< 2h chacun)
- Décisions Will à trancher

---

## 4. Règles de rédaction (très important — c'est ce qui fait la valeur du livrable)

1. **Aucun acronyme non expliqué.** Première occurrence = définition entre parenthèses. "FTS (recherche plein-texte Postgres)", "RAG (le LLM va lire des sources et cite ces sources)".
2. **Toujours des exemples concrets.** Au lieu de "table sous-utilisée" → "la table `KnowledgeBookmark` est créée mais aucun code ne l'écrit jamais → tu ne peux pas mettre un favori depuis l'admin, le bouton n'existe pas".
3. **Toujours dire le "et alors ?"**. Au lieu de "embedding dim 1536" → "embeddings dim 1536 (= chaque entrée est convertie en une signature de 1536 nombres → utilisé pour la recherche 'trouve-moi des entrées similaires sémantiquement')".
4. **Quantifier dès que possible.** "~X €/mois", "~Y secondes", "~Z entries", "~N lignes de code".
5. **Distinguer "présent dans le code" vs "vivant en prod".** Une table peut exister en base sans aucun lecteur → c'est mort.
6. **Distinguer "configurable en seed" vs "éditable en admin".** Une audience canonique modifiable dans `audiences.ts` n'est PAS modifiable depuis l'admin tant qu'un dev n'a pas push.
7. **Toujours donner le chemin de fichier** + ligne quand pertinent (`schema.prisma:1941`).
8. **Si tu détectes un trou (code mort, feature promise pas câblée), NE PAS le réparer** — c'est un AUDIT-ONLY. Juste lister dans le verdict.

---

## 5. Contraintes opérationnelles

- **Mode lecture seule code** : zéro modification dans `axionia/src/`, `axionia/prisma/`, `axionia/scripts/`
- **Écriture autorisée uniquement** dans `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/`
- **Pas de `git commit`** sans le go explicite Will
- **Pas de `gh pr`** sans le go explicite Will
- **Si bloqué** sur une ambiguïté → noter dans `STOP-AND-ASK-WILL.md`, ne pas inventer
- **Mémoires AxionIA** : consulter les memories pertinentes (axionia_audit_indexation_*, axionia_content_gen_*, etc.) pour ne pas redécouvrir l'eau chaude

---

## 6. Livrables attendus (au minimum 9 fichiers)

```
_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/
├── MANIFEST.md                              ← inventaire des livrables
├── EXEC-SUMMARY-WILL.md                     ← LE doc que Will lit (langage simple)
├── VERDICT-FINAL.md                         ← scoring /2000 + P0/P1/P2
├── A1-SCHEMA-INVENTORY.md                   ← 18 modèles, vivants / morts / fantômes
├── A2-SERVER-ACTIONS-STATE-MACHINE.md       ← 24 actions, RBAC, audit trail
├── A3-ADMIN-EDITABILITY-MATRIX.md           ← QUI peut modifier QUOI sans dev
├── A4-WORKERS-INGEST-EMBEDDINGS.md          ← BullMQ, pgvector, coûts
├── A5-PUBLIC-CONSUMPTION-SEO.md             ← sitemaps, JSON-LD, hreflang, Pagefind
├── A6-USER-JOURNEYS-LANGAGE-SIMPLE.md       ← 5 parcours expliqués comme à un dirigeant
└── STOP-AND-ASK-WILL.md                     ← (optionnel) décisions à trancher
```

---

## 7. Comment lancer ce prompt

Quand tu (Will) veux exécuter l'audit, copie-colle :

> Lance l'audit décrit dans `_AUDIT/PROMPT-KNOWLEDGE-BASE-AUDIT-PERFECTION-2026-05-18.md`.
> Mode autopilote, 6 sous-agents //, AUDIT-ONLY, livre les 9+ fichiers dans `_AUDIT/KB-AUDIT-PERFECTION-2026-05-18/`.
> Tiens-moi au courant en langage simple. STOP & ASK si ambigu.

---

## 8. Pourquoi ce prompt est conforme aux meilleures pratiques 2026

- ✅ **Self-contained** : un sous-agent peut l'exécuter sans contexte conversationnel
- ✅ **Scoring quantifié** /2000 + seuils 🟢🟡🟠🔴
- ✅ **Périmètre explicite** (18 modèles + 24 actions + ~40 lib modules + 2 sections admin + workers + cross-cuttings)
- ✅ **Méthode parallélisable** (6 agents indépendants)
- ✅ **Forme de sortie standardisée** (MANIFEST + EXEC-SUMMARY + VERDICT + agents)
- ✅ **Public cible clair** (Will, dirigeant, langage simple)
- ✅ **Contraintes ops** (AUDIT-ONLY, pas de commit auto, STOP & ASK)
- ✅ **Reproductible** : peut être rejoué dans 3 mois pour mesurer la progression

**Fin du prompt.**
