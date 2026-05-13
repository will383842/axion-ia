# 16 — Import & migration tooling — Knowledge Base 2026

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` (Agent 16)
> Phase : A — AUDIT-ONLY (aucun code écrit ; ce document est un blueprint normatif pour Sprints KB-15 / KB-15.5)
> Date : 2026-05-13
> Statut : DRAFT
> Référence code : HEAD `main` (commit `95bba36`)
> Préalable lu : `00-REALITY-CHECK.md` §9.16 (Agent 16 attention points)

---

## 0. TL;DR

- **V1 (Sprint KB-15)** : 3 importers — `_AUDIT/*.md` (mappage MANUEL via wizard, ~70+ fichiers dont la majorité sont des rapports d'audit hors-scope éditorial), Markdown Git directory générique (pointeur sur `docs/` avec capture commit ref), Notion API (`@notionhq/client`, OAuth utilisateur).
- **V1.5 (Sprint KB-15.5)** : Google Docs API + OAuth, mapping styles → Tiptap.
- **V2+** : Confluence / Roam / Obsidian (stretch).
- **Doctrine** : tout import sort en `status='draft'`. Toujours dry-run avant commit. Toujours `KnowledgeImportBatch` pour rollback. PII-scan systématique sur body. ActivityLog parent + enfants par entry.
- **Slug strategy** : génération depuis title via `slugify` ; collision → suffixe `-2`, `-3`, ... ; `KnowledgeSlugHistory` JAMAIS sollicitée à l'import (slug neuf, pas de redirect historique à créer).
- **Anti-patterns** dans §10 — tout import qui contourne ces garde-fous est interdit.

---

## 1. CADRAGE

### 1.1 Objectif

Outiller la migration / l'ingestion **multi-source** vers `KnowledgeEntry`, **sans jamais corrompre** l'existant et **sans jamais publier** sans relecture humaine.

### 1.2 Hors-scope V1

- Auto-bulk-ingest des `_AUDIT/*.md` (volume ~90+ fichiers, dont rapports d'audit, prompts agents, logs de session, changelogs — non-éditorial publique).
- Import direct depuis Confluence / Roam / Obsidian (reporté V2+).
- Import qui écrit en `status='review'` ou supérieur (toujours `draft`).
- Réutilisation de `KnowledgeSlugHistory` à l'import (les slugs importés sont NEUFS, pas d'historique pré-existant à conserver côté KB).

### 1.3 Volume cible Phase B (Sprint KB-15)

| Source             | Volume estimé            | Sélection                                            | Statut sortie |
| ------------------ | ------------------------ | ---------------------------------------------------- | ------------- |
| `_AUDIT/*.md`      | ~90 fichiers physiques   | **Sélection MANUELLE wizard** (~5-15 fichiers en V1) | `draft`       |
| `docs/adr/*.md`    | 20 ADRs (`0001`-`0020`)  | Décision STOP & ASK Will (voir §11)                  | `draft`       |
| `docs/` (autres)   | À auditer agent 1        | Décision Will                                        | `draft`       |
| Notion workspace   | Inconnu (STOP & ASK §11) | Si Will utilise Notion                               | `draft`       |
| Google Docs (V1.5) | Inconnu                  | Reporté V1.5                                         | `draft`       |

---

## 2. IMPORTERS V1 — `_AUDIT/*.md`

### 2.1 Stratégie

**Mappage MANUEL obligatoire**, pas d'auto-ingest bulk. Justification :

- Reality check §9.16 : « ~70+ fichiers mais beaucoup sont audit reports (pas éditorial publique) ».
- Inventaire Glob (HEAD `95bba36`) : 90+ fichiers `.md` dans `_AUDIT/` dont :
  - **Rapports d'audit techniques** : `AUDIT-FRONTEND-V14-2026-*.md`, `AUDIT-WEB-VITALS-*.md`, `AUDIT-PARITY-*.md`, `AUDIT-VISUAL-RHYTHM-*.md`, `AUDIT-TYPOGRAPHY-*.md`, `AUDIT-PERFECTION-FINALE-*.md` — **hors-scope éditorial publique**.
  - **Prompts d'agents** : `PROMPT-CODAGE.md`, `PROMPT-FRONTEND-AUDIT-V14-2026.md`, `PROMPT-MAITRE.md`, `PROMPT-SEO-MASTER-2026.md`, `PROMPT-KNOWLEDGE-BASE-2026.md`, etc. — **hors-scope**.
  - **Logs de session** : `CONVERSATION-LOG-*.md`, `SESSION-LOG-*.md`, `IMPLEMENTATION-STATUS-*.md` — **hors-scope**.
  - **Changelogs internes** : `CHANGELOG-DEDUP.md`, `CHANGELOG-DESIGN-CLAUDE.md`, `CHANGELOG-WIREFRAMES.md` — **hors-scope**.
  - **Stratégies / décisions** publiables avec rewrite éditorial : `STRATEGIE-AEO-GEO-2026.md`, `PSEO-VILLES-INDUSTRIALISATION-DECISION.md`, `pseo-strategy.md`, `stack-fit-analysis.md`, `benchmarks-2026.md` — **candidats potentiels**, à valider Will.
  - **Propositions ADR** : `adr-0003-...-PROPOSITION.md`, `adr-0004-...-PROPOSITION.md` — **candidats methodology**.

→ Conclusion ferme : **aucun script bulk** qui aspire `_AUDIT/*.md` en masse. Le wizard fait défiler les fichiers UN PAR UN, l'admin coche / décoche, mappe `type`/`domain`/`audience` à la main.

### 2.2 Parser frontmatter YAML

**Stack** : `gray-matter` (existant dans repo ? à confirmer Sprint KB-15 ; sinon `pnpm add gray-matter`).

Conventions attendues dans les `.md` source :

```yaml
---
title: "Stratégie AEO/GEO 2026"
date: 2026-05-07
tags: [seo, aeo, geo, doctrine]
status: draft
author: william
---
```

**Mapping frontmatter → `KnowledgeEntry`** :

| Frontmatter               | KnowledgeEntry / KnowledgeTranslation                       | Fallback si manquant                                            |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| `title`                   | `translation.title` (locale courante)                       | nom de fichier sans extension, slugify                          |
| `date`                    | `entry.publishedAt` (proposé, modifiable wizard)            | `null`                                                          |
| `tags`                    | `entry.tags` (JSON array)                                   | `[]`                                                            |
| `status`                  | **IGNORÉ** (toujours `draft` à l'import, override interdit) | `draft`                                                         |
| `author`                  | `entry.authorId` (lookup `Author` par slug)                 | `manon` par défaut (selon ADR 0010 + skill `content-generator`) |
| `excerpt` / `description` | `translation.excerpt`                                       | extraction 160 premiers chars du body plain                     |
| `lang` / `locale`         | `translation.locale`                                        | `fr` par défaut                                                 |

**Robustesse parser** :

- Frontmatter manquant → wizard demande les champs en formulaire (pas d'erreur dure).
- Frontmatter invalide YAML → erreur dure, le fichier est skip + raison dans le rapport.
- Pas de second `---` → traité comme « pas de frontmatter », tout le contenu = body.

### 2.3 Conversion Markdown → Tiptap JSON

**Dépendance à ajouter** :

```bash
pnpm add prosemirror-markdown
```

**Pipeline** :

```
file.md
  ↓ gray-matter
  → { data: <frontmatter>, content: <markdown_string> }
  ↓ defaultMarkdownParser.parse(content)
  → ProseMirror Node (doc)
  ↓ .toJSON()
  → Tiptap-compatible JSON (TipTap StarterKit nodes)
  ↓ @tiptap/html renderToHTMLString(json)   (server-side render)
  → bodyHtml
  ↓ extractPlainText(json)
  → bodyText
```

**Triple persistance** alignée avec le pattern Sprint 24 C4 (mémoire `axionia_session_2026-05-09_sprint_24`) :

- `bodyJson` : canonique (édité par l'éditeur).
- `bodyHtml` : rendu SSR (pour `dangerouslyDeliverServerHTML` contrôlé via whitelist `@tiptap/html` server).
- `bodyText` : plain (pour FTS, excerpts, embeddings V1.5).

**Limitations connues `prosemirror-markdown`** :

| Markdown feature       | Mappé Tiptap StarterKit ? | Action                                                               |
| ---------------------- | ------------------------- | -------------------------------------------------------------------- |
| Headings (h1-h6)       | Oui                       | OK                                                                   |
| Bold / italic / strike | Oui                       | OK                                                                   |
| Lists (ul/ol, nested)  | Oui                       | OK                                                                   |
| Code inline + fenced   | Oui                       | OK                                                                   |
| Blockquote             | Oui                       | OK                                                                   |
| Hr                     | Oui                       | OK                                                                   |
| Liens                  | Oui (mark `link`)         | OK — exige extension Link Sprint KB-3                                |
| Images `![alt](url)`   | Oui (node `image`)        | **Asset pipeline** : downloader local + `KnowledgeAsset` (voir §2.5) |
| Tables GFM             | **Non par défaut**        | V1.5 — pour V1 → warning + bloc texte préformaté                     |
| Footnotes              | Non                       | V2+                                                                  |
| Callouts (admonitions) | Non                       | V1.5 (mapper sur custom node)                                        |
| HTML inline brut       | Risqué                    | **Strip + warning** (sanitization stricte)                           |
| Frontmatter            | N/A                       | déjà strip par `gray-matter`                                         |

### 2.4 Mapping `type` / `domain` / `audience` configurable

**Pas d'inférence automatique**. Le wizard impose un mapping explicite avant commit.

**Méthode 1 (recommandée V1)** : table de mapping en config JSON / table `KnowledgeImportMapping` :

```ts
// src/server/actions/knowledge/import-mapping.ts (proposé Sprint KB-15)
interface ImportMappingRule {
  source: "audit_md" | "docs_md" | "notion" | "google_docs";
  pattern: string; // regex sur filename ou path
  type: KbType; // ex. "doctrine", "methodology", "case_study"
  domain: KbDomain;
  audience: KbAudience[];
  authorOverride?: string; // slug Author
}
```

**Méthode 2 (V1.5)** : import CSV mapping `[filename, type, domain, audience]` pour gros batchs.

**Wizard UI** : §4. Pour chaque fichier preview, dropdowns `type` / `domain` / `audience` (multi-select) + `author` (multi-tenant Author table).

### 2.5 Asset pipeline — images dans `.md`

Quand un `![alt](url)` est rencontré pendant la conversion :

1. **URL absolue HTTP(S)** :
   - Whitelist domaines (`axion-ia.com`, `axion-ia.s3.*`, Cloudflare R2 si applicable).
   - Hors whitelist → warning + remplacement par placeholder `[image externe non importée]`.
   - Sur whitelist → fetch + sauvegarde via asset pipeline Sprint KB-11 (sharp + SHA-256 hash + `KnowledgeAsset`).
2. **URL relative** :
   - Résolution depuis le dossier du fichier source (ex. `docs/images/foo.png`).
   - Si fichier trouvé sur disque → asset pipeline KB-11.
   - Si fichier manquant → warning + placeholder.
3. **Alt manquant** : warning bloquant publish (quality score) mais pas bloquant import. Le `draft` reste importé.

### 2.6 Statut import — toujours `draft`

Verrou côté code (`src/server/actions/knowledge/import-md-batch.ts` proposé) :

```ts
// PSEUDOCODE — pas implémenté Phase A
const ALLOWED_IMPORT_STATUS = ["draft"] as const;
function assertImportStatus(s: string) {
  if (!ALLOWED_IMPORT_STATUS.includes(s as never)) {
    throw new Error(`Import status ${s} interdit — toujours 'draft'`);
  }
}
```

Le frontmatter `status: published` est **ignoré**. Documenté dans le wizard UI + rejet visible dans le rapport batch.

---

## 3. IMPORTERS V1 — Markdown Git directory

### 3.1 Cas d'usage

Pointer un dossier complet (ex. `docs/`, `docs/adr/`, `docs/skills/`) et importer **récursivement** tous les `.md`.

### 3.2 Capture commit ref

```ts
// PSEUDOCODE — Sprint KB-15
import { execSync } from "node:child_process";

function captureGitRef(dirPath: string): { commit: string; branch: string } {
  const commit = execSync("git log -1 --format=%H", { cwd: dirPath }).toString().trim();
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: dirPath }).toString().trim();
  return { commit, branch };
}
```

→ Stocké dans `KnowledgeImportBatch.sourceRef = "<branch>@<commit>"`. Permet le rollback Git-aware et l'audit reproductible.

### 3.3 Parcours récursif

- `glob("**/*.md", { cwd: dirPath, ignore: ["**/node_modules/**", "**/.next/**"] })`.
- Path relatif conservé pour traçabilité (`KnowledgeImportEntry.sourcePath = "docs/adr/0012-booking-v1-decisions-matrix-q1-q10.md"`).
- Frontmatter / Markdown → Tiptap : identique §2.

### 3.4 Volume `docs/adr/`

Le reality check §6 liste 20 ADRs (`0001`-`0020`). Question STOP & ASK §11 : faut-il les exposer publiquement en KB ? Les ADRs Axion-IA sont **internes** par défaut (décisions techniques). Une exposition publique nécessite :

- Rewrite éditorial (ton public, jargon allégé).
- `audience = ['client_existant', 'prospect_qualifie']` ? ou interne seulement ?
- `confidentiality = 'internal'` recommandé jusqu'à validation Will.

→ Décision déférée à Will (§11).

---

## 4. IMPORTERS V1 — Notion API

### 4.1 Stack

```bash
pnpm add @notionhq/client
```

### 4.2 OAuth utilisateur

- Endpoint admin `/fr/<adminPrefix>/connaissances/imports/notion/connect`.
- OAuth standard Notion (redirect URI `https://axion-ia.com/api/internal/notion/callback`).
- Token stocké chiffré (réutilise pattern `src/lib/crypto.ts` si existant, sinon `pnpm add @node-rs/argon2` déjà présent + helper AES-256-GCM).
- Token lié à `AdminUser.id` (multi-utilisateur OK).

### 4.3 Mapping blocks Notion → Tiptap

| Notion block type                                          | Tiptap node                | Notes                                                            |
| ---------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| `paragraph`                                                | `paragraph`                | direct                                                           |
| `heading_1` / `heading_2` / `heading_3`                    | `heading` level 1/2/3      | direct                                                           |
| `bulleted_list_item`                                       | `bulletList` > `listItem`  | regrouper consécutifs                                            |
| `numbered_list_item`                                       | `orderedList` > `listItem` | regrouper consécutifs                                            |
| `to_do`                                                    | `taskList` > `taskItem`    | Tiptap TaskList extension (à ajouter Sprint KB-3)                |
| `quote`                                                    | `blockquote`               | direct                                                           |
| `code`                                                     | `codeBlock`                | mapper `language`                                                |
| `divider`                                                  | `horizontalRule`           | direct                                                           |
| `image`                                                    | `image`                    | **download + asset pipeline KB-11 obligatoire**                  |
| `embed` (YouTube, etc.)                                    | custom node `embed`        | whitelist domaines (cf. Agent 17 §404)                           |
| `bookmark`                                                 | `link` mark sur texte URL  | direct                                                           |
| `callout`                                                  | custom node `callout`      | V1.5                                                             |
| `toggle`                                                   | `details` HTML5            | V1.5                                                             |
| `table`                                                    | `table`                    | Tiptap Table extension (V1.5)                                    |
| `database`                                                 | **non importable bloc**    | extraction par row → 1 KnowledgeEntry par row, type configurable |
| Rich text annotations (bold/italic/strike/code/link/color) | marks correspondantes      | `color` → ignoré ou mapping custom                               |

### 4.4 Gestion images Notion

- Notion sert les images via URLs S3 **signées et expirantes** (1h).
- → **Download immédiat** pendant l'import (pas de référence URL Notion stockée).
- → Pipeline asset KB-11 : sharp transform + WebP/AVIF + SHA-256 + `KnowledgeAsset`.
- Alt text récupéré depuis `image.caption` Notion (si présent), sinon vide + warning.

### 4.5 Pagination Notion

API Notion paginée `start_cursor` / `next_cursor`. Wrapper helper :

```ts
// PSEUDOCODE
async function fetchAllPages(notionClient: Client, query: QueryDatabaseParameters) {
  let cursor: string | undefined;
  const results = [];
  do {
    const res = await notionClient.databases.query({ ...query, start_cursor: cursor });
    results.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return results;
}
```

Rate limit Notion : 3 req/s → throttle via `p-limit` ou setTimeout backoff.

### 4.6 Mapping properties Notion → KB metadata

Wizard prompt l'admin pour mapper :

- Property Notion `Type` (select) → KB `type`
- Property Notion `Tags` (multi-select) → KB `tags`
- Property Notion `Domain` (select) → KB `domain`
- Property Notion `Author` (people) → KB `authorId` (fuzzy match Notion person email → `Author.email`)
- Property Notion `Published date` → KB `publishedAt` (proposé, override possible)

→ Mapping sauvegardé dans `KnowledgeImportMapping` pour réutilisation batchs futurs.

---

## 5. IMPORTERS V1.5 — Google Docs

### 5.1 Raison du report V1.5

- OAuth Google complexe (Workspace consent screen, scopes restrictifs).
- Pas de pattern OAuth Google déjà en place dans le repo (HEAD `95bba36` n'a que NextAuth + Notion à venir).
- Volume V1 suffit (`_AUDIT/*.md` + Notion).

### 5.2 Stack V1.5

```bash
pnpm add googleapis
# Scope minimum : https://www.googleapis.com/auth/documents.readonly
```

### 5.3 Mapping styles Google Docs → Tiptap

Google Docs expose un AST via `documents.get()` :

| GDoc element                                            | Tiptap node                         |
| ------------------------------------------------------- | ----------------------------------- |
| `paragraph.namedStyleType: HEADING_1..6`                | `heading` level 1-6                 |
| `paragraph.namedStyleType: NORMAL_TEXT`                 | `paragraph`                         |
| `bullet` (bullet preset)                                | `bulletList`                        |
| `bullet` (decimal preset)                               | `orderedList`                       |
| `textRun.textStyle.bold/italic/strikethrough/underline` | marks                               |
| `textRun.textStyle.link`                                | `link` mark                         |
| `inlineObject.embeddedObject.imageProperties`           | `image` (download + asset pipeline) |
| `table`                                                 | `table` (V2+)                       |
| `horizontalRule`                                        | `horizontalRule`                    |

### 5.4 Images Google Docs

URLs Drive `https://lh3.googleusercontent.com/...` — pas expirantes mais peuvent disparaître si Drive owner révoque accès. → **Download immédiat** pendant import. Asset pipeline KB-11.

---

## 6. HORS V1/V1.5 — V2+

Pas d'engagement Phase A. Listés pour anticipation.

| Source                       | Lib candidate                                            | Difficulté                                 | Cas d'usage           |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------ | --------------------- |
| Confluence Cloud             | `confluence-api` ou REST direct                          | Moyenne (OAuth + storage format XHTML)     | Si client SaaS migre  |
| Roam Research                | export JSON → parser custom                              | Faible (JSON simple, mais structure graph) | Niche                 |
| Obsidian                     | dossier Markdown → reuse importer Markdown Git directory | Faible (vault = dossier `.md`)             | OK gratuit si demande |
| Logseq                       | similaire Obsidian                                       | Faible                                     | Niche                 |
| Apple Notes / Bear / OneNote | export Markdown manuel → reuse importer Markdown         | N/A                                        | Workflow user         |

---

## 7. WIZARD UI — `/fr/<adminPrefix>/connaissances/imports`

### 7.1 Maquette ASCII

```
┌─────────────────────────────────────────────────────────────────────┐
│  Imports — Knowledge Base                            [+ Nouveau lot] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Source picker                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ( ) Fichiers .md — `_AUDIT/*.md`         (sélection unique) │   │
│  │  ( ) Dossier Git Markdown                  (`docs/...`)      │   │
│  │  ( ) Notion workspace                      [Connecter OAuth] │   │
│  │  ( ) Google Docs                           V1.5 (désactivé)  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Étape 2 — Sélection des items                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [x] STRATEGIE-AEO-GEO-2026.md            (3.2 KB, 2026-05) │   │
│  │  [ ] AUDIT-FRONTEND-V14-2026-A.md         (skip — rapport)  │   │
│  │  [x] PSEO-VILLES-INDUSTRIALISATION-       (4.1 KB, 2026-05) │   │
│  │  ...                                                         │   │
│  │  Sélectionnés : 5 / 90                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Étape 3 — Mapping fields                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Pour chaque item sélectionné :                              │   │
│  │   type      [ ▼ doctrine                ]                    │   │
│  │   domain    [ ▼ seo                     ]                    │   │
│  │   audience  [x] prospect_qualifie  [x] client_existant       │   │
│  │   author    [ ▼ Manon Editorial         ]                    │   │
│  │   locale    [ ▼ fr                      ]                    │   │
│  │   (Bulk apply to selection) [Appliquer]                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Étape 4 — Preview diff (10 premiers items)                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  STRATEGIE-AEO-GEO-2026.md                                   │   │
│  │   → slug proposé : strategie-aeo-geo-2026                    │   │
│  │   → collision : non                                          │   │
│  │   → title : "Stratégie AEO/GEO 2026"                         │   │
│  │   → excerpt : "Doctrine AEO/GEO 2026 Axion-IA..." (160c)    │   │
│  │   → images : 3 (toutes downloadées OK)                       │   │
│  │   → PII scan : ✅ clean                                       │   │
│  │   → Tiptap nodes : 47 (paragraph: 31, heading: 8, list: 6,  │   │
│  │     image: 3, blockquote: 2)                                 │   │
│  │   → warnings : 0                                             │   │
│  │  ...                                                         │   │
│  │  Voir tout (5 items) [Détail complet]                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Étape 5 — Dry-run                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Lancer dry-run] (transaction Prisma rollback automatique) │   │
│  │  Résultat : 5/5 OK — 0 erreur — 0 PII bloquante              │   │
│  │  Durée estimée commit : ~1.2s                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Étape 6 — Commit                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Commit 5 entrées en draft]                                 │   │
│  │  ⚠ Statut : toujours 'draft'. Publication = workflow séparé. │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Étapes wizard — détail technique

| Étape              | Action côté serveur                                                | Action côté DB                                         | Réversible ?              |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------- |
| 1. Source picker   | `GET /api/internal/kb/imports/sources`                             | Aucune                                                 | N/A                       |
| 2. Sélection items | `POST /api/internal/kb/imports/preview` (fetch + parse en mémoire) | Aucune (in-memory only)                                | N/A                       |
| 3. Mapping         | `POST /api/internal/kb/imports/mapping` (validation Zod)           | Aucune (in-memory)                                     | N/A                       |
| 4. Preview diff    | `POST /api/internal/kb/imports/diff` (rend 10 premiers à l'écran)  | Aucune                                                 | N/A                       |
| 5. Dry-run         | `POST /api/internal/kb/imports/dry-run`                            | Transaction Prisma **ouverte puis rollback**           | Auto-rollback             |
| 6. Commit          | `POST /api/internal/kb/imports/commit`                             | Transaction Prisma commit + `KnowledgeImportBatch` log | Rollback explicite via §8 |

### 7.3 Slug strategy

```ts
// PSEUDOCODE — src/lib/knowledge/slug.ts (Sprint KB-15)
import slugify from "slugify";

export async function generateUniqueSlug(
  title: string,
  type: KbType,
  locale: Locale,
  prisma: PrismaClient,
): Promise<string> {
  const base = slugify(title, { lower: true, strict: true, locale: locale });
  let candidate = base;
  let suffix = 2;
  while (
    await prisma.knowledgeTranslation.findFirst({
      where: { slug: candidate, locale, entry: { type } },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 100) {
      throw new Error(`Collision slug excessive pour "${title}" (>100 essais)`);
    }
  }
  return candidate;
}
```

**`KnowledgeSlugHistory` non utilisée à l'import** : Agent 17 §slug-history reserve cette table pour les **renames** post-publish. À l'import, le slug est neuf, il n'a pas d'historique à conserver.

---

## 8. ROLLBACK BULK — `KnowledgeImportBatch`

### 8.1 Modèle Prisma proposé

```prisma
// Phase A — pas écrit, à valider Agent 1 (Data model)
model KnowledgeImportBatch {
  id            String   @id @default(uuid())
  source        String   // 'audit_md' | 'docs_md' | 'notion' | 'google_docs'
  sourceRef     String?  // Git commit ref / Notion DB id / etc.
  importedById  String   // AdminUser.id
  importedBy    AdminUser @relation(fields: [importedById], references: [id])
  entries       Json     // [{ entryId: string, originalSlug: string, type: string }]
  entryCount    Int
  status        String   @default("committed") // 'committed' | 'rolled_back' | 'partial_rollback'
  warnings      Json?    // array of { entryId, message }
  errors        Json?
  createdAt     DateTime @default(now())
  rolledBackAt  DateTime?

  @@index([source, createdAt])
  @@index([importedById])
  @@index([status])
}
```

### 8.2 Action `rollback-import-batch.ts`

```ts
// PSEUDOCODE — src/server/actions/knowledge/rollback-import-batch.ts (Sprint KB-15)
export async function rollbackImportBatchAction(input: { batchId: string; reason: string }) {
  const session = await requireAdminSession();
  if (!hasRole(session, ["OWNER", "EDITOR"])) throw new Error("RBAC");

  const batch = await prisma.knowledgeImportBatch.findUnique({ where: { id: input.batchId } });
  if (!batch) throw new Error("Batch not found");
  if (batch.status !== "committed") throw new Error(`Batch déjà ${batch.status}`);

  const entries = batch.entries as Array<{ entryId: string; originalSlug: string; type: string }>;

  // SOFT-DELETE — pas de DELETE physique en V1 (auditabilité)
  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      // 1. Soft-archive : status='archived' + archivedAt
      await tx.knowledgeEntry.update({
        where: { id: entry.entryId },
        data: { status: "archived", archivedAt: new Date(), archivedReason: input.reason },
      });
      // 2. ActivityLog enfant
      await tx.activityLog.create({
        data: {
          adminUserId: session.userId,
          action: "kb.import.batch.rolled_back.entry",
          targetType: "KnowledgeEntry",
          targetId: entry.entryId,
          changes: { batchId: input.batchId, reason: input.reason },
        },
      });
    }
    // 3. ActivityLog parent
    await tx.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "kb.import.batch.rolled_back",
        targetType: "KnowledgeImportBatch",
        targetId: input.batchId,
        changes: { reason: input.reason, entryCount: entries.length },
      },
    });
    // 4. Marquer batch
    await tx.knowledgeImportBatch.update({
      where: { id: input.batchId },
      data: { status: "rolled_back", rolledBackAt: new Date() },
    });
  });

  return { ok: true, archivedCount: entries.length };
}
```

### 8.3 Rollback partiel (V1.5)

Si un seul entry du batch a été modifié post-import (workflow, traductions ajoutées), le rollback bulk doit **détecter et skipper** pour ne pas écraser. → `status='partial_rollback'` + liste des entries skippées dans `warnings`.

---

## 9. PII SCRUBBING À L'IMPORT

### 9.1 Helper réutilisé

`src/lib/pii-redaction.ts` (mémoire `axionia_session_2026-05-09_sprint_24_1`, ADR 0010) — déjà testé (`pii-redaction.test.ts`).

### 9.2 Intégration

```ts
// PSEUDOCODE — src/server/actions/knowledge/import-md-batch.ts
import { scanForPII } from "@/lib/pii-redaction";

const piiScanResult = scanForPII(bodyText);
// piiScanResult = { hasPII: boolean, matches: Array<{ type: 'email' | 'phone' | 'siren' | ..., value: string, position: number }> }

if (piiScanResult.hasPII) {
  if (importConfig.piiPolicy === "block") {
    return {
      entryId: null,
      error: `PII détectée (${piiScanResult.matches.length})`,
      matches: piiScanResult.matches,
    };
  }
  if (importConfig.piiPolicy === "warn") {
    warnings.push({
      entryId,
      message: `PII détectée — ${piiScanResult.matches.length} match(es)`,
      matches: piiScanResult.matches,
    });
  }
  // 'allow' : importer tel quel (réservé OWNER pour cas exceptionnel testimonials anonymisés)
}
```

### 9.3 Configuration par batch (wizard étape 3)

- **Default** : `piiPolicy = "warn"` (l'admin voit, choisit).
- **OWNER seul** : peut basculer `piiPolicy = "allow"` (justifier dans `reason`).
- **Pour `_AUDIT/*.md`** : `piiPolicy = "block"` (par défaut), car les rapports d'audit peuvent contenir des emails de testeurs.

### 9.4 PII types détectés

Réutilise `pii-redaction.ts` (HEAD `95bba36`) — couverture connue (mémoire) : email, téléphone FR, SIREN, IBAN. Documenter explicitement la couverture dans le wizard pour transparence.

---

## 10. AUDIT LOG — `ActivityLog`

### 10.1 Schéma logs

Réutilise `ActivityLog` existant (reality check §4.1) — aucune nouvelle table.

```ts
// 1 log parent par batch
{
  action: "kb.import.batch.created",
  targetType: "KnowledgeImportBatch",
  targetId: batch.id,
  changes: {
    source: "audit_md" | "notion" | ...,
    sourceRef: "main@95bba36",
    entryCount: 5,
    piiPolicy: "warn",
    durationMs: 1234,
  },
}

// 1 log enfant par entry
{
  action: "kb.created",
  targetType: "KnowledgeEntry",
  targetId: entry.id,
  changes: {
    via: "import",
    batchId: batch.id,
    sourcePath: "_AUDIT/STRATEGIE-AEO-GEO-2026.md",
    originalSlug: "strategie-aeo-geo-2026",
    type: "doctrine",
    domain: "seo",
  },
}
```

### 10.2 Indexation `(targetType, targetId)` existante

OK — confirmé reality check §1.1. Pas d'index supplémentaire requis.

### 10.3 Lecture cross-référencée

L'admin peut depuis `/fr/<adminPrefix>/activity-logs` filtrer par `action: kb.import.*` pour voir tous les imports + rollbacks. Lien direct vers batch detail page.

---

## 11. STOP & ASK — décisions Will requises

### Q1. Notion — Will utilise-t-il Notion ?

**Si OUI** → Sprint KB-15 inclut Notion API. ~3-5 jours de dev OAuth + mapping blocks.
**Si NON** → Sprint KB-15 livre seulement `_AUDIT/*.md` + Markdown Git directory. Notion reporté V2+.
**Mémoire actuelle** : aucune mention. Recommandation reality check § 9.16 : « STOP & ASK ».

### Q2. `_AUDIT/*.md` — quels fichiers à migrer en priorité V1 ?

Candidats potentiels publiables (après rewrite éditorial) :

- `STRATEGIE-AEO-GEO-2026.md`
- `PSEO-VILLES-INDUSTRIALISATION-DECISION.md` (V1.5 ? trop technique pour public ?)
- `pseo-strategy.md`
- `benchmarks-2026.md`
- `stack-fit-analysis.md`

Tous les autres (`AUDIT-*`, `PROMPT-*`, `CHANGELOG-*`, `SESSION-LOG-*`, `CONVERSATION-LOG-*`) → **NE PAS migrer** (rapports internes).

Décision Will : valider / amender cette shortlist.

### Q3. `docs/adr/0001-0020.md` — migration KB ?

3 options :

- **A. NON V1** : ADRs restent dans `docs/adr/` (markdown Git, accessible GitHub). Pas d'exposition publique KB. **Recommandation Phase A** : c'est la voie la plus sûre.
- **B. V1 — interne** : import sous `type='doctrine'` ou `type='adr'`, `audience=['admin']` ou `confidentiality='internal'`. Permet recherche dans l'admin KB.
- **C. V1.5 — publique post-rewrite** : extraction ciblée de quelques ADRs (ex. 0006 pSEO villes, 0009 hosting, 0011 taxonomy interventions) après rewrite éditorial pour le public.

Décision Will : A / B / C ?

### Q4. Type `KbType` — ajouter `'adr'` ?

Si Q3 = B ou C, ajouter `KbType.adr`. Sinon non.

### Q5. PII policy default pour batchs Notion / GDocs ?

`block` (strict) ou `warn` (permissif) ?

### Q6. Frontmatter `status` — quelle politique exacte ?

Recommandation : **ignoré silencieusement** (toujours `draft`). Alternative : warning explicite « status: published ignoré ». Décision Will.

### Q7. Volume Notion attendu si Q1 = OUI ?

Pour dimensionner Sprint KB-15 (50 pages ? 500 ? 5000 ?).

---

## 12. ANTI-PATTERNS — interdits par doctrine

1. **Import qui écrase silently un slug existant** — toujours `generateUniqueSlug` (§7.3).
2. **Import sans dry-run** — étape 5 obligatoire avant étape 6.
3. **Import sans audit log auteur original** — `ActivityLog` parent + enfants obligatoires (§10).
4. **Import sans PII scan** — `scanForPII` bloquant ou warning (§9).
5. **Import qui publie direct** (`status='published'`) — toujours `draft`, frontmatter ignoré (§2.6).
6. **Import qui écrit `KnowledgeSlugHistory` à la création** — table réservée aux renames post-publish.
7. **Import bulk `_AUDIT/*.md` sans curation** — mappage manuel obligatoire (§2.1).
8. **Import qui référence URL externe non-whitelistée pour images** — download obligatoire ou strip (§2.5).
9. **Import Notion qui garde les URLs S3 expirantes** — download obligatoire (§4.4).
10. **Rollback DELETE physique** — toujours soft-archive + `ActivityLog` (§8.2).
11. **Rollback qui écrase entries modifiées post-import** — détection + skip + warning (§8.3).
12. **Import qui ignore le `sourceRef` Git** — capture commit ref obligatoire (§3.2).
13. **Wizard sans étape preview diff** — UX casse l'audit (§7.1 étape 4).
14. **Mapping `type`/`domain`/`audience` inféré automatiquement sans validation admin** — toujours mappage explicite (§2.4).

---

## 13. INTÉGRATIONS CROSS-AGENTS

| Agent                            | Lien                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Agent 1 (Data model)             | Modèle `KnowledgeImportBatch` à valider §8.1                                       |
| Agent 3 (Admin UI)               | Routes `/fr/<adminPrefix>/connaissances/imports/*`                                 |
| Agent 4 (Server actions)         | Pattern 1-fichier-par-action confirmé (`src/server/actions/knowledge/import-*.ts`) |
| Agent 8 (Workflow / versionning) | Import = `KnowledgeVersion[0]` initiale (immutable)                                |
| Agent 9 (RGPD)                   | PII scrubbing §9 — réutilise `pii-redaction.ts` ADR 0010                           |
| Agent 13 (Médias)                | Asset pipeline §2.5 / §4.4 / §5.4                                                  |
| Agent 17 (Slug / sécurité)       | `KnowledgeSlugHistory` NON utilisée à l'import (clarification cross-doc)           |
| Agent 18 (Tests)                 | E2E scenario « bulk import » obligatoire (≥ 1 sur les 5 E2E cible)                 |

---

## 14. ESTIMATIONS SPRINT KB-15 (V1)

| Sous-tâche                                                             | Effort (j) | Dépendances          |
| ---------------------------------------------------------------------- | ---------- | -------------------- |
| Modèle Prisma `KnowledgeImportBatch` + migration                       | 0.5        | Agent 1 livré        |
| Parser frontmatter + Markdown → Tiptap (`prosemirror-markdown`)        | 1.5        | —                    |
| Importer `_AUDIT/*.md` + Markdown Git directory                        | 1.5        | Parser               |
| Importer Notion (OAuth + blocks mapping + images) — **conditionné Q1** | 3.0        | Q1 OUI               |
| Wizard UI 6 étapes                                                     | 2.5        | Admin UI Sprint KB-3 |
| Action `rollback-import-batch.ts`                                      | 0.5        | —                    |
| PII scrubbing intégration                                              | 0.25       | `pii-redaction.ts`   |
| Audit log integration                                                  | 0.25       | —                    |
| Tests unitaires + 1 E2E                                                | 1.5        | —                    |
| Documentation runbook                                                  | 0.25       | —                    |

**Total V1 (avec Notion)** : **~11.25 jours-développeur**.
**Total V1 (sans Notion, Q1 = NON)** : **~8.25 j-dev**.

Sprint KB-15.5 Google Docs : +2.5 à 3 j-dev additionnels.

---

## 15. RUNBOOK PROD — opérations courantes

### 15.1 Refaire un import qui a échoué

1. Le wizard affiche les `warnings` + `errors` du batch.
2. Si batch en `status='committed'` mais incomplet → rollback explicit (§8) puis nouveau passage avec mapping corrigé.
3. Si erreur DB pendant transaction → auto-rollback Prisma + message dans le rapport. Pas de commit partiel.

### 15.2 Rollback en urgence

`Admin → Connaissances → Imports → Lot #<id> → [Rollback]` avec raison obligatoire.

### 15.3 Re-import après correction source

Si un `_AUDIT/*.md` est corrigé après import (ex. typo) → option **« re-import » sur l'entry** (V1.5) qui :

- Crée une nouvelle `KnowledgeVersion`.
- Conserve le slug.
- Garde l'historique workflow.

V1 : ré-éditer manuellement dans Tiptap editor.

### 15.4 Audit traçabilité

Pour chaque entry KB on peut retrouver :

- Son `KnowledgeImportBatch` parent (via `ActivityLog.changes.batchId`).
- Sa source originale (via `ActivityLog.changes.sourcePath` ou `sourceRef`).
- Sa version 0 (via `KnowledgeVersion`).

---

## 16. SYNTHÈSE — décisions Phase A actées

| Décision                 | Choix                                        |
| ------------------------ | -------------------------------------------- |
| Volume V1 `_AUDIT/*.md`  | Mappage MANUEL, pas de bulk                  |
| Lib Markdown → Tiptap    | `prosemirror-markdown`                       |
| Statut sortie            | Toujours `draft` (frontmatter ignoré)        |
| Slug strategy            | `slugify` + suffixe collision                |
| Slug history             | NON utilisée à l'import                      |
| Rollback                 | `KnowledgeImportBatch` + soft-archive        |
| PII                      | `pii-redaction.ts` réutilisé, default `warn` |
| Audit log                | `ActivityLog` parent + enfants               |
| Notion V1 ?              | **STOP & ASK Will (Q1)**                     |
| `docs/adr/*` V1 ?        | **STOP & ASK Will (Q3)**                     |
| Google Docs              | V1.5                                         |
| Confluence/Roam/Obsidian | V2+                                          |

---

**Fin Agent 16 — AUDIT-ONLY.** Sept STOP & ASK ouverts (Q1-Q7). Aucun fichier source modifié.
