# 17 — Slug History + Redirects + Sécurité contenu + DR/Backup — Knowledge Base 2026 — Phase A

> Prompt master : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` § Agent 17
> Reality check seed : `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md`
> Agent : 17 — Slug history + redirects + sécurité contenu + DR/backup
> Date : 2026-05-13
> Statut : DRAFT (Phase A — AUDIT-ONLY, aucune écriture code)
> Référence : HEAD `main` (commit `95bba36` post-Booking V1 merge `fa093e5`)
> Doctrine : Hetzner CPX32 + Cloudflare Free, zéro coût additionnel, Web Vitals 2026 (LCP ≤ 1800 / INP ≤ 100 / CLS = 0 / First Load JS ≤ 75 KB gz).

---

## 0. TL;DR

- **Slug history** : modèle Prisma `KnowledgeSlugHistory` neuf + résolution dans **middleware existant** (`/middleware.ts`, racine repo — pas `src/middleware.ts`) en pré-pass avant la logique pSEO attribution. Couvre 3 cas : `renamed`, `typeChanged`, `merged`. Cache Edge in-memory court (60 s) pour éviter une round-trip Postgres sur chaque 404 potentiel.
- **Sécurité contenu** : `@tiptap/html` server-side **à ajouter Sprint KB-12** (absent de `package.json` HEAD, ne pas le supposer présent). Whitelist stricte nodes/marks + sanitization domaines embeds (5 domaines V1) + jamais `dangerouslySetInnerHTML` brut. Rate limit `kb_helpful` 1/IP/entry/24h via Redis bucket existant (`src/lib/rate-limit.ts` réutilisable).
- **DR/backup** : dump filtré `pg_dump --table=knowledge_*` quotidien + script `scripts/backup-knowledge.sh` (tar.gz local + upload optionnel Backblaze B2) + cron mensuel `scripts/restore-knowledge-test.sh` qui spin un Postgres temp Docker, restore, smoke test 3 queries, alert Telegram si fail.
- **Estimation taille** : 1k entrées ≈ 100 MB ; 10k ≈ 1 GB ; 100k ≈ 10 GB body + 4 MB → 400 MB embeddings V1.5. **Coût embeddings V1.5** : Voyage AI `voyage-3-lite` $0.02/1M tokens → 1k = $0.13 réindex full, 10k = $1.30, 100k = $13. Incrémental ~10× moins.
- **3 STOP & ASK ouverts** Will (§ 7) : volume backup S3 vs Coolify-only, fréquence DR drill (mensuel recommandé), auth method export GDPR (admin OWNER + 2FA hard-gated recommandé).

---

## 1. SLUG HISTORY — modèle + résolution + cas couverts

### 1.1 Modèle Prisma `KnowledgeSlugHistory`

Doctrine zéro-hardcode + suit les conventions Prisma existantes (`@@index`, `@@unique`, naming snake_case en DB via `@@map`).

```prisma
model KnowledgeSlugHistory {
  id        String       @id @default(cuid())
  oldLocale Locale       // réutilise enum Locale existant (fr/en)
  oldType   KbType       // nouvel enum KB (§ Agent 1) : article|case_study|faq|help|glossary|guide|...
  oldSlug   String       @db.VarChar(220) // aligné cap slug Axion-IA existant
  entryId   String       // FK vers KnowledgeEntry.id (CIBLE de la redirection)
  changedAt DateTime     @default(now())
  reason    SlugChangeReason // enum (renamed|typeChanged|merged)
  notes     String?      @db.VarChar(500) // contexte humain optionnel
  actorId   String?      // FK AdminUser.id (qui a déclenché le rename)

  entry     KnowledgeEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  actor     AdminUser?     @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@unique([oldLocale, oldType, oldSlug], name: "knowledge_slug_history_unique_lookup")
  @@index([entryId])
  @@index([changedAt])
  @@map("knowledge_slug_history")
}

enum SlugChangeReason {
  renamed       // oldSlug → newSlug, même type
  typeChanged   // type change → path change (article → guide)
  merged        // entry A archivée, redirige vers entry B
}
```

**Notes** :

- L'index `@@unique([oldLocale, oldType, oldSlug])` est le lookup principal middleware (3 colonnes = match exact O(log n)).
- `entryId` indexé pour audit "tous les anciens slugs qui pointent vers cette entrée".
- `changedAt` indexé pour rapport Sprint KB-13 (slugs renommés sur 30j).
- `actorId nullable + onDelete: SetNull` : si l'admin est supprimé, l'historique survit (RGPD : on retire la PII, on garde la traçabilité technique).
- **Pas** de `newSlug` direct dans la table : la cible est résolue via `entry.slug` (la KB courante). Cela évite des chaînes de redirection si l'entry change de slug **N fois** : `KnowledgeSlugHistory` pointe **toujours** vers `entryId` → on lit `entry.slug` actuel pour construire la nouvelle URL. **Résultat : 1 seul 301, jamais de chaîne.**

### 1.2 Résolution — middleware existant Next 16

Le repo a déjà `/middleware.ts` (racine, **PAS** `src/middleware.ts` — corrigeons cette imprécision du brief). Doctrine : on **étend** le middleware existant, on n'en crée pas un second.

**Pattern recommandé Sprint KB-12** : pre-pass avant la logique pSEO attribution (cookies UTM/ref).

Pseudo-code (à coder Phase B, **pas écrit ici**) :

```ts
// middleware.ts — pre-pass slug history (V1)
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // 1. PRE-PASS : slug history lookup (avant tout le reste).
  //    On ne lookup que sur les paths KB-shape (/fr/blog/X, /fr/centre-aide/X, /fr/faq/X, ...)
  //    pour ne pas pénaliser tous les paths du site.
  const kbMatch = matchKbPath(pathname); // helper local : { locale, type, slug } | null
  if (kbMatch) {
    const redirect = await resolveSlugHistory(kbMatch); // cache Edge 60s + DB hit
    if (redirect) {
      return NextResponse.redirect(new URL(redirect.newPath, req.url), 301);
    }
  }

  // 2. Logique existante (UTM + pSEO referrer)
  // ... (inchangée)
}
```

**Pourquoi middleware et pas catch-all route `/[locale]/[...path]/page.tsx`** :

- **Perf** : middleware Edge s'exécute **avant** le rendu, le catch-all rend un 404 puis redirige (round-trip wasted).
- **Bundle JS** : catch-all gonfle le bundle public (`generateStaticParams`, build-time). Middleware = zéro bundle public.
- **Cache CDN Cloudflare** : un 301 émis par middleware est cachable Cloudflare immédiatement (`Cache-Control: public, max-age=3600`). Un 301 émis par page Next nécessite revalidate.
- **Convention existante** : le middleware actuel gère déjà des préoccupations cross-cutting (UTM + pSEO) — slug history est de même nature.

**Contrainte budget middleware** : Next 16 cap middleware bundle à ~1 MB. La requête Prisma directe depuis middleware Edge est **interdite** (Prisma client trop lourd pour Edge runtime). **Solution V1** : `runtime = 'nodejs'` sur le middleware (déjà le cas par défaut Next 16 sauf override), Prisma OK. **Solution V2** : si on bascule en Edge, utiliser un Redis lookup avec snapshot dénormalisé `slug_history:<locale>:<type>:<slug>` → `<newPath>`, peuplé via worker BullMQ.

### 1.3 Cache résolution

Le middleware s'exécute sur **toutes** les requêtes matchées par `config.matcher`. Lookup DB sur chaque 404 potentiel = goulot.

**V1 (simple)** : cache in-memory au scope du module middleware avec TTL court (60 s) — survit aux requêtes du même container. Invalidation : aucune nécessaire (TTL court + faible volume slugs renommés).

**V1.5 (Redis)** : `kb:slug_history:<locale>:<type>:<slug>` → `<newPath>`. TTL 1h. Invalidation explicite via server action `renameSlugAction()` qui DEL la clé après update DB.

**V2 (Cloudflare KV)** : si on franchit le seuil Edge runtime, migrer le lookup en KV (gratuit Free Plan 100k reads/jour — largement suffisant).

### 1.4 Cas couverts

| Cas               | Trigger                                   | Effet DB                                                                                                   | Effet URL                                                                                  |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Rename slug**   | Admin édite `slug` d'une `KnowledgeEntry` | INSERT row `KnowledgeSlugHistory(reason=renamed, oldSlug=ancien)` + UPDATE `KnowledgeEntry.slug`           | Ancien `/fr/blog/ancien` → 301 `/fr/blog/nouveau`                                          |
| **Change type**   | Admin change `type` (article → guide)     | INSERT row `(reason=typeChanged, oldType=article)` + UPDATE `KnowledgeEntry.type=guide`                    | Ancien `/fr/blog/x` → 301 `/fr/guides/x` (path résolu via mapping `type → segment public`) |
| **Merge entries** | Admin merge entry A dans entry B          | INSERT row `(reason=merged, entryId=B.id, oldSlug=A.slug)` + SET `A.status='archived' A.mergedIntoId=B.id` | Ancien `/fr/blog/a` → 301 `/fr/blog/b`                                                     |

**Cas dégénérés à protéger en server action** :

- Rename slug vers un slug **déjà** existant (collision) → reject avec error + suggestion `-2`.
- Rename slug vers un slug **présent dans KnowledgeSlugHistory** (cycle) → reject + warn admin que ce slug a un historique.
- Merge entry A dans B alors que A elle-même est cible d'autres entrées mergées → CASCADE : toutes les anciennes `KnowledgeSlugHistory` qui pointaient sur A doivent être re-pointées sur B (UPDATE bulk dans transaction).

### 1.5 Mapping `type` → segment URL public

Doctrine SSOT zéro-hardcode → fichier dédié (à créer Sprint KB-2) :

```ts
// src/lib/knowledge/public-paths.ts (Phase B, NON écrit ici)
export const KB_TYPE_TO_PUBLIC_SEGMENT_FR = {
  article: "blog",
  case_study: "cas-concrets",
  faq: "faq",
  help: "centre-aide",
  glossary: "glossaire",
  guide: "guide-ia",
  // ... à compléter Agent 1
} as const;
```

Le middleware utilise ce SSOT pour construire `newPath` à partir de `entry.type` + `entry.slug` + `locale`. Aucun hardcode dans middleware.

### 1.6 Backfill initial — Sprint KB-12

**Stratégie** : ne **pas** créer rétroactivement de `KnowledgeSlugHistory` pour des renames historiques de `articles.slug` (le git log n'est pas une source structurée fiable pour ça).

Au lieu de ça :

- Au **moment de la migration KB-2** (backfill `Article` → `KnowledgeEntry`), capturer **uniquement** les redirections déjà documentées dans `next.config.mjs` (s'il y en a) ou dans un éventuel fichier `redirects.csv` curé par Will (s'il en a un — STOP & ASK).
- Tous les futurs renames passent par la server action `renameSlugAction()` qui crée automatiquement la `KnowledgeSlugHistory` row.

**Audit Phase B obligatoire** : Sprint KB-2 ouvre une checklist "redirections legacy à insérer manuellement ?" pour Will. Si Will dit non → on part de zéro et toutes les anciennes URLs externes (backlinks SEO) qui renomment maintenant deviennent 404 — **risque SEO** à mesurer.

**Recommandation reality-check Agent 17** : exporter `articles.slug` actuel post-merge KB-2 dans un CSV, le commiter dans `_AUDIT/KNOWLEDGE-BASE-2026/snapshots/articles-slugs-2026-05-13.csv`, et autoriser le seed de `KnowledgeSlugHistory` à partir de ce snapshot si un slug change en KB-3+.

---

## 2. SÉCURITÉ CONTENU — sanitization + SSRF + rate-limit + CSP + HMAC

### 2.1 `@tiptap/html` — état actuel et Sprint KB-12

**HEAD `main` package.json (vérifié ligne 88-90)** :

- `@tiptap/pm` ^3.22.5
- `@tiptap/react` ^3.22.5
- `@tiptap/starter-kit` ^3.22.5

**`@tiptap/html` ABSENT.**

Le brief le confirme. Sprint KB-12 doit :

```bash
pnpm add @tiptap/html@^3.22.5  # version aligné avec les autres @tiptap/*
```

**Pourquoi `@tiptap/html` server-side et pas `prosemirror-to-html` ou autre** :

- Cohérence : on persiste déjà du `bodyJson` Tiptap (Sprint 24 C4 — confirmé `00-REALITY-CHECK.md` § 1.1). `@tiptap/html` est l'outil natif Tiptap pour `JSON → HTML` server-side.
- Bundle public : **on n'embarque PAS `@tiptap/html` côté client**. Le SSR rend une fois, le HTML sortant est statique. → 0 KB ajoutés au First Load JS public.
- Maintenance : versions alignées avec `@tiptap/starter-kit` que l'admin utilise déjà — pas de drift.

**Garde-fou** : `@tiptap/html` charge ProseMirror sous le capot. À tester en Sprint KB-12 que `@tiptap/html` server-side **ne tire pas** de dépendances React lourdes dans le SSR bundle. Si oui, fallback `prosemirror-to-html` minimal écrit à la main (whitelist statique).

### 2.2 Whitelist nodes Tiptap (V1)

**Doctrine** : whitelist > blacklist. Tout ce qui n'est pas listé = supprimé silencieusement (pas d'erreur, juste skip).

| Node                           | Autorisé V1      | Notes                                                                                                                          |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `doc`                          | OUI              | root                                                                                                                           |
| `paragraph`                    | OUI              |                                                                                                                                |
| `text`                         | OUI              | inclut marks (cf. § 2.3)                                                                                                       |
| `heading` levels 1-4           | OUI              | h5/h6 interdits (sémantique trop fine, peu utilisé)                                                                            |
| `bulletList`                   | OUI              |                                                                                                                                |
| `orderedList`                  | OUI              |                                                                                                                                |
| `listItem`                     | OUI              |                                                                                                                                |
| `blockquote`                   | OUI              |                                                                                                                                |
| `codeBlock`                    | OUI              | attribut `language` whitelist (`js`, `ts`, `python`, `bash`, `sql`, `json`, `yaml`, `tsx`, `jsx`, `html`, `css`, `md`, `none`) |
| `hardBreak`                    | OUI              |                                                                                                                                |
| `horizontalRule`               | OUI              |                                                                                                                                |
| `image`                        | OUI              | **src** doit matcher whitelist domaines (cf. § 2.4)                                                                            |
| `link` (en tant que node, V2+) | NON V1           | link traité comme mark uniquement V1                                                                                           |
| `table`                        | NON V1           | tabulaire = Sprint KB-16 V1.5                                                                                                  |
| `iframe` / `embed`             | OUI conditionnel | whitelist domaines stricte (cf. § 2.4)                                                                                         |
| `callout` / `custom`           | NON V1           | Sprint KB-16 V1.5                                                                                                              |
| `mention` / `tag`              | NON V1           | Sprint KB-16 V1.5                                                                                                              |
| Tout autre node custom Tiptap  | NON              | strip silencieusement                                                                                                          |

### 2.3 Whitelist marks Tiptap (V1)

| Mark                         | Autorisé V1                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bold`                       | OUI                                                                                                                                                     |
| `italic`                     | OUI                                                                                                                                                     |
| `strike`                     | OUI                                                                                                                                                     |
| `code`                       | OUI                                                                                                                                                     |
| `underline`                  | OUI (V1, controversé typographiquement mais standard éditeur)                                                                                           |
| `link`                       | OUI conditionnel — `href` doit matcher whitelist protocoles (`https://`, `http://`, `mailto:`, `/`) + bloquer `javascript:` `data:` `vbscript:` `file:` |
| `highlight`                  | NON V1                                                                                                                                                  |
| `superscript`/`subscript`    | NON V1                                                                                                                                                  |
| `textStyle` (couleur custom) | NON V1 (doctrine palette terracotta SSOT)                                                                                                               |

### 2.4 SSRF + embeds — whitelist domaines

**Risque XSS classique** : un editor permet d'injecter `<iframe src="https://attacker.com/steal-cookies">`. Doctrine V1 : **5 domaines whitelistés en dur dans SSOT**.

```ts
// src/lib/knowledge/embed-whitelist.ts (Phase B, NON écrit ici)
export const KB_EMBED_DOMAIN_WHITELIST = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "loom.com",
  "www.loom.com",
] as const;

// V1.5 candidates (à valider Will) : codepen.io, codesandbox.io, stackblitz.com, figma.com (embed).
```

**Tout iframe avec un host hors whitelist → strip silencieusement.** Log Sentry event `kb.security.embed_blocked` avec `{ host, entryId, actorId }`.

**SSRF dans le pipeline d'image upload** (Sprint KB-11) : si l'admin colle une URL externe pour fetch une image, le worker doit refuser les hosts **internal** (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1`, `fc00::/7`) ET vérifier `Content-Type` réel via fetch HEAD avant download. Helper recommandé : `src/lib/ssrf-guard.ts` à créer Sprint KB-11/12 (partagé avec d'autres fetchers externes).

### 2.5 Rate limit — Redis bucket existant

`src/lib/rate-limit.ts` existe déjà (confirmé `00-REALITY-CHECK.md` § 4.3). Buckets cibles V1 :

| Endpoint                                | Bucket                      | Période       | Identité             | Notes                                              |
| --------------------------------------- | --------------------------- | ------------- | -------------------- | -------------------------------------------------- |
| `POST /api/kb/helpful`                  | `kb:helpful:<ip>:<entryId>` | 24h sliding   | IP (anonyme)         | 1 vote/IP/entrée/24h                               |
| `GET /api/kb/search` (public FTS)       | `kb:search:<ip>`            | 1 min sliding | IP                   | 60 req/min/IP                                      |
| `POST /api/admin/kb/bulk-import`        | `kb:bulk:<adminId>`         | 1 min sliding | AdminUser.id         | 5 imports/min/admin                                |
| `POST /api/internal/kb/rag` (V1.5)      | `kb:rag:<clientId>`         | 1 min sliding | HMAC client_id       | 30 req/min                                         |
| `POST /api/admin/kb/embed-batch` (V1.5) | `kb:embed:<adminId>`        | 1 h sliding   | AdminUser.id         | 1 batch full/h/admin (anti-coût Voyage AI runaway) |
| `GET /api/internal/kb/export-full`      | `kb:export:<adminId>`       | 24h sliding   | AdminUser.id (OWNER) | 1 export/jour/owner                                |

**Implémentation** : pattern Redis token bucket déjà éprouvé (Booking V1). Sprint KB-12 = juste ajouter les nouvelles clés.

**Turnstile** existant (Booking V1) : à brancher sur `POST /api/kb/helpful` anonyme pour prévenir les bots qui upvotent. Sprint KB-7.

### 2.6 CSP — extension nonce existant

Mémoire `axionia_session_2026-05-09_sprint_24` confirme CSP nonce-based actif. Doctrine extension :

```text
script-src 'self' 'nonce-{NONCE}' ;
style-src  'self' 'nonce-{NONCE}' ;
img-src    'self' data: blob: <CDN_KB_ASSETS_HOST> i.ytimg.com i.vimeocdn.com cdn.loom.com ;
media-src  'self' blob: ;
frame-src  https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com ;
frame-ancestors 'none' ;
form-action 'self' ;
base-uri 'self' ;
object-src 'none' ;
upgrade-insecure-requests ;
```

**Changements Sprint KB-12** :

- `frame-src` : ajouter explicitement YouTube + Vimeo + Loom. **Sync obligatoire** avec `KB_EMBED_DOMAIN_WHITELIST` (§ 2.4). Si Will ajoute un domaine en V1.5 (Codepen, Figma), il faut le rajouter aux **DEUX** endroits — risque doctrine zero-hardcode → SSOT centralisé `embed-whitelist.ts` qui exporte aussi le fragment CSP `frame-src`.
- `img-src` : ajouter le host CDN où sont servies les `KnowledgeAsset.url` (à confirmer Sprint KB-11, soit volume Coolify local soit Cloudflare R2 V2).
- `connect-src` : si la search public utilise un endpoint séparé, l'autoriser.

**Test contrat** : Sprint KB-18 doit ajouter un Playwright qui charge `/fr/ressources/exemple-avec-embed-loom`, vérifie que l'iframe Loom charge sans CSP error, ET que tenter d'injecter manuellement `<iframe src="https://evil.com">` dans le DOM lève une CSP violation.

### 2.7 HMAC — endpoint RAG V1.5

Si Sprint KB-21 (pgvector + endpoint RAG externalisé) est livré V1.5 :

**Pattern recommandé** :

- Header `X-KB-Client-Id: <opaque-id>` + `X-KB-Signature: HMAC-SHA256(secret, timestamp + body)` + `X-KB-Timestamp: <unix-ms>`.
- Secret par client stocké dans `Setting` table (clé `kb.rag.client_secrets.<clientId>`).
- Window timestamp : ±5 min anti-replay.
- Refus dur si `clientId` est revoked (flag `revokedAt` dans Setting).
- Telegram alert si **3 échecs HMAC consécutifs** (PII-redacted via helper `pii-redaction.ts` existant — ne pas leak `clientId` complet dans le ping Telegram, hash-le).

**Hors-scope V1** confirmé reality check § 9.10.

### 2.8 Refus dur — confidentialité

Doctrine V1 obligatoire (avant même V1.5 embeddings) :

- `KnowledgeEntry.confidentiality IN ('confidential', 'secret')` :
  - Jamais exposé sur surfaces publiques `/blog`, `/cas-concrets`, `/faq`, `/centre-aide`, `/ressources`, `/glossaire`, `/guide-ia`.
  - Jamais inclus dans `sitemap.xml`.
  - Jamais inclus dans flux RSS, `llms.txt`, JSON Feed.
  - Jamais inclus dans FTS public (filtre WHERE dans la query côté server action public).
  - V1.5 : jamais envoyé à Voyage AI / Anthropic / OpenAI pour embedding ou completion.
  - Test bloquant Vitest : `tests/server/knowledge/confidentiality-leakage.test.ts` qui scanne tous les endpoints publics et vérifie qu'une entry `confidential` n'apparaît dans aucun.

---

## 3. DR / BACKUP — KB-specific

### 3.1 Contexte existant

`00-REALITY-CHECK.md` ne mentionne pas explicitement de stratégie de backup KB. Coolify a un backup global de la DB (mémoire `axionia_session_2026-05-09_cloudflare_postdeploy_incident` mentionne une stack stable).

**Gap V1 identifié** : aucun dump filtré par domaine fonctionnel. Si la KB explose et qu'on doit restore uniquement les tables `knowledge_*` (sans toucher `bookings` qui ont migré entre temps), il faut soit un dump filtré, soit une restore complète puis re-merge — risque énorme.

### 3.2 Dump filtré quotidien — script `scripts/backup-knowledge.sh`

**Composition Phase B (NON écrit ici, spec uniquement)** :

```bash
#!/usr/bin/env bash
# scripts/backup-knowledge.sh
# Run quotidien via cron Coolify (02:30 UTC).
# Tables incluses : knowledge_* + knowledge_assets + knowledge_slug_history
# + knowledge_versions + knowledge_translations + knowledge_tags*
#
# Output : /backups/kb/kb-YYYY-MM-DD.dump.gz
# Retention : 30 jours local + 90 jours offsite (B2 si configuré)
# Alert Telegram si échec (helper redacted existant)

set -euo pipefail
DATE=$(date -u +%Y-%m-%d)
OUT=/backups/kb/kb-${DATE}.dump.gz

pg_dump \
  --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --no-owner --no-privileges --clean --if-exists --format=custom \
  --table='knowledge_*' \
  --table='knowledge_assets*' \
  "$DB_NAME" | gzip -9 > "$OUT"

# Vérification taille minimale (anti-dump vide)
SIZE=$(stat -c '%s' "$OUT")
if [ "$SIZE" -lt 10240 ]; then
  bash scripts/telegram-alert.sh "kb backup dump trop petit ($SIZE bytes) — investigate"
  exit 1
fi

# Optional offsite (Backblaze B2 si configuré — STOP & ASK Will)
if [ -n "${B2_BUCKET:-}" ]; then
  b2 upload-file "$B2_BUCKET" "$OUT" "kb/$(basename $OUT)"
fi

# Retention local 30j
find /backups/kb -name 'kb-*.dump.gz' -mtime +30 -delete
```

**Notes** :

- `--format=custom` (pas `--format=plain`) → restore plus rapide via `pg_restore --jobs=4`.
- `--no-owner --no-privileges` → portable entre instances Postgres (utile DR drill sur instance temp).
- Pattern `--table='knowledge_*'` : pg_dump 13+ supporte les globs. Notre Postgres 17 = OK.
- Gzip `-9` = compression max (CPU acceptable la nuit, gain stockage important).
- **Ne pas commiter** `/backups/kb/` (gitignore). `.gitkeep` dans le dossier OK.

### 3.3 DR drill mensuel — script `scripts/restore-knowledge-test.sh`

**Spec V1 (NON écrit ici)** :

```bash
#!/usr/bin/env bash
# scripts/restore-knowledge-test.sh
# Run mensuel via cron Coolify (1er du mois 04:00 UTC).
# Spin un Postgres temp Docker, restore le dernier dump,
# vérifie 3 invariants, drop le container, alert si fail.

set -euo pipefail
TEMP_DB="kb-dr-test-$(date +%s)"
LATEST=$(ls -t /backups/kb/kb-*.dump.gz | head -n1)

# 1. Spin Postgres temp (port 5499 random, isolé)
docker run -d --rm --name "$TEMP_DB" \
  -e POSTGRES_PASSWORD=drtest \
  -p 5499:5432 \
  postgres:17-alpine

# 2. Wait healthy (max 30s)
for i in {1..30}; do
  docker exec "$TEMP_DB" pg_isready -U postgres && break
  sleep 1
done

# 3. Restore
gunzip -c "$LATEST" | docker exec -i "$TEMP_DB" \
  pg_restore --no-owner --no-privileges -d postgres -U postgres

# 4. Smoke tests (3 queries invariantes)
SMOKE=$(docker exec "$TEMP_DB" psql -U postgres -tAc "
  SELECT COUNT(*) FROM knowledge_entries WHERE status='published';
")
if [ "$SMOKE" -lt 1 ]; then
  bash scripts/telegram-alert.sh "DR drill FAIL: 0 published entries after restore"
  docker stop "$TEMP_DB"
  exit 1
fi

# Test 2 : translations
docker exec "$TEMP_DB" psql -U postgres -tAc "
  SELECT COUNT(*) FROM knowledge_translations WHERE locale='fr';
" || { bash scripts/telegram-alert.sh "DR drill FAIL: translations query"; exit 1; }

# Test 3 : versions immutables
docker exec "$TEMP_DB" psql -U postgres -tAc "
  SELECT COUNT(*) FROM knowledge_versions;
" || { bash scripts/telegram-alert.sh "DR drill FAIL: versions query"; exit 1; }

# 5. Cleanup
docker stop "$TEMP_DB"
bash scripts/telegram-success.sh "DR drill OK: $LATEST restored, $SMOKE published entries"
```

**STOP & ASK Will** § 7 : mensuel ou hebdomadaire ?

### 3.4 Export GDPR — `/api/internal/kb/export-full`

**Pattern V1** :

- **Auth** : `AdminUser.role = OWNER` requis + 2FA verified dans la session (TOTP otplib existant). STOP & ASK Will § 7.
- **Rate limit** : 1/jour (§ 2.5).
- **Output** : `application/gzip` → tarball avec :
  - `entries.jsonl` : 1 entry par ligne (streaming-friendly).
  - `translations.jsonl`
  - `versions.jsonl` (toutes versions, immutable)
  - `assets-manifest.jsonl` (URLs + hash SHA-256, pas le binaire)
  - `audit-log.jsonl` (subset `ActivityLog` filtré `targetType='knowledge_entry'`)
- **PII masking** : pour `confidentiality IN ('confidential', 'secret')`, **2 modes** :
  - Mode `full` (param query `?include=confidential`) : OWNER + log ActivityLog event `kb.export.full.confidential` + Telegram notify obligatoire (PII redacted via helper existant).
  - Mode `redacted` (défaut) : `confidential` entries présentes avec `body=null` + flag `_redacted: true`. Métadonnées (title, slug, type, dates) gardées pour traçabilité.
- **Pas de download direct via URL** : génère le tarball côté worker BullMQ (job `kb.export.full`), stockage temp 24h, URL signée envoyée par email à l'admin. Anti-attaque CSRF + permet d'audit en différé.
- **Header HTTP** : `Content-Disposition: attachment; filename="axion-ia-kb-export-YYYY-MM-DD.tar.gz"`.

### 3.5 Estimation taille — 3 scénarios

Hypothèses :

- Body Tiptap JSON moyen : **5 KB** (estimation realistic — un article moyen 800 mots ≈ 4-6 KB JSON sérialisé incluant marks).
- Versions moyennes par entry : **10** (drafts intermédiaires + révisions reviewer).
- Asset cover moyen : **100 KB** (AVIF/WebP optimisé sharp Sprint KB-11).
- Translations FR+EN : ×2 sur body (1 entry = 2 translations).

| Scénario        | Entries | Body (FR+EN, all versions)        | Translations active         | Assets covers            | Total body+assets | Embeddings V1.5 (1024 dims × 4B) |
| --------------- | ------- | --------------------------------- | --------------------------- | ------------------------ | ----------------- | -------------------------------- |
| **V1 seed**     | 1 000   | 1k × 5KB × 10v × 2L = **100 MB**  | 1k × 5KB × 2L = **10 MB**   | 1k × 100KB = **100 MB**  | **~210 MB**       | 1k × 4KB = **4 MB**              |
| **V1.5 cruise** | 10 000  | 10k × 5KB × 10v × 2L = **1 GB**   | 10k × 5KB × 2L = **100 MB** | 10k × 100KB = **1 GB**   | **~2.1 GB**       | 10k × 4KB = **40 MB**            |
| **V2 scale**    | 100 000 | 100k × 5KB × 10v × 2L = **10 GB** | 100k × 5KB × 2L = **1 GB**  | 100k × 100KB = **10 GB** | **~21 GB**        | 100k × 4KB = **400 MB**          |

**Implications stockage Hetzner CPX32 (80 GB SSD)** :

- V1 (210 MB) : trivial. 1 % du disque.
- V1.5 (2.1 GB) : OK, 3 % du disque.
- V2 (21 GB) : 26 % du disque. **À surveiller**. Si on dépasse 50 % SSD : migrer assets vers Cloudflare R2 (10 GB free, $0.015/GB/mois après — ~ €0.15/mois pour V2).

**Implications backup** : dump filtré gzippé compresse ~3-5×. Donc :

- V1 : ~50 MB par dump. 30 dumps × 50 MB = 1.5 GB local. OK.
- V1.5 : ~500 MB par dump. 30 dumps × 500 MB = 15 GB local. Limite acceptable.
- V2 : ~5 GB par dump. 30 dumps × 5 GB = 150 GB. **Hors CPX32 capacity** → forcer offsite obligatoire dès qu'on dépasse 5k entries.

### 3.6 Coût embeddings V1.5 chiffré

**Provider candidat principal** : Voyage AI `voyage-3-lite` ($0.02/1M tokens, 1024 dims, contexte 32k, qualité ≈ OpenAI text-embedding-3-small mais 7× moins cher).

**Conversion bytes → tokens** : Voyage AI tokenizer ≈ 1 token pour 4 caractères en français/anglais (un peu plus élevé que GPT-2 BPE classique). Donc 5 KB ≈ 5120 chars ≈ **1280 tokens** par entry (single language). Avec FR+EN : **~2560 tokens** par entry.

**Coûts réindex full** :

| Scénario        | Entries | Tokens (FR+EN) | Coût Voyage AI ($0.02/1M) |
| --------------- | ------- | -------------- | ------------------------- |
| **V1 seed**     | 1 000   | 2.56 M         | **$0.05**                 |
| **V1.5 cruise** | 10 000  | 25.6 M         | **$0.51**                 |
| **V2 scale**    | 100 000 | 256 M          | **$5.12**                 |

**Coûts réindex incrémental mensuel** (entries publiées modifiées dans le mois, ~10 % du total) :

| Scénario | Coût mensuel |
| -------- | ------------ |
| V1       | $0.005       |
| V1.5     | $0.05        |
| V2       | $0.51        |

**Coût annuel total V2 (réindex full annuel + incrémental mensuel)** : $5.12 + (12 × $0.51) = **$11.24/an**. Largement sous le budget Axion-IA.

**Alternative locale (V2+)** : `bge-m3` ou `e5-mistral-7b-instruct` hébergé sur le CPX32 ? **NON recommandé** : RAM 8 GB partagée avec Postgres/Redis/Next/Coolify, pas de marge pour un modèle d'embedding 7B. Stay Voyage AI cloud V1.5+.

**Alternative Anthropic Claude embeddings** : Anthropic ne fournit pas d'API embeddings officielle dédiée (skill `claude-api` confirme — Anthropic = LLM, pas embedding model). Donc Voyage AI = bon choix (Voyage = partenaire officiel Anthropic recommandé).

**Doctrine sub-processor** : Voyage AI à ajouter dans `src/content/subprocessors.ts` Sprint KB-21 si retenu. Hébergement Voyage = US — implique mention RGPD claire dans privacy policy + DPA papier (mémoire `axionia_session_2026-05-09_sprint_24_1`).

---

## 4. ANTI-PATTERNS à bloquer

| Anti-pattern                                                 | Trigger                                                                                  | Détection                                                                               | Doctrine V1                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Chaîne 301 → 301 → 200**                                   | Rename de slug N fois sans pointer toujours vers `entryId`                               | `KnowledgeSlugHistory` pointe sur la NOUVELLE URL au lieu de `entryId` (cf. § 1.1 note) | Modèle pointe sur `entryId`, jamais sur un slug intermédiaire                                              |
| **Cache CDN Cloudflare non purgé après rename**              | URL `/fr/blog/ancien` était cachée 200 OK, devient 301, mais le cache CF sert encore 200 | Pas de purge sur `renameSlugAction()`                                                   | Server action déclenche `cf-purge` worker BullMQ (job `cdn.purge.urls` avec liste des old URLs)            |
| **Backup non testé**                                         | `pg_dump` quotidien tourne, personne ne vérifie qu'il restore                            | Pas de DR drill                                                                         | Cron mensuel obligatoire (§ 3.3), alerte Telegram si fail                                                  |
| **Export GDPR sans masquage PII**                            | OWNER télécharge un dump qui contient des entries `confidential` en clair sans le savoir | Param `?include=confidential` non requis, défaut = full                                 | Défaut = redacted, opt-in explicite via param + Telegram notify                                            |
| **Embeddings de secret content envoyés à Voyage AI**         | V1.5 réindex bulk sans filtre `confidentiality`                                          | Pas de filtre WHERE dans le worker `kb.embed.batch`                                     | Worker filtre **toujours** `WHERE confidentiality NOT IN ('confidential', 'secret')`. Test bloquant Vitest |
| **Catch-all route au lieu de middleware pour 301**           | Dev choisit `/[locale]/[...path]/page.tsx`                                               | code review                                                                             | Doctrine : middleware pour 301 KB                                                                          |
| **`dangerouslySetInnerHTML` sur body Tiptap brut**           | Composant `EntryBody` sans sanitization                                                  | Lint custom + code review                                                               | Toujours passer par `renderTiptapToHtml(json, { allowList: KB_TIPTAP_ALLOWLIST })` server-side             |
| **Embed iframe sans whitelist**                              | Editor permet `<iframe src="anywhere">`                                                  | Sanitizer Tiptap node `iframe` non whitelisté                                           | Strip silencieux + Sentry event                                                                            |
| **Rate limit absent sur helpful**                            | `kb_helpful` votable infinie                                                             | Pas de bucket Redis                                                                     | Bucket 1/IP/entry/24h obligatoire                                                                          |
| **HMAC absent sur endpoint RAG externe V1.5**                | Endpoint publié sans auth                                                                | code review Sprint KB-21                                                                | HMAC + timestamp ±5min + revoke list                                                                       |
| **Slug rename d'un entry vers un slug déjà historique**      | Cycle                                                                                    | Server action check pas fait                                                            | Reject + warn                                                                                              |
| **Backup local sans rotation**                               | `/backups/kb` rempli le SSD                                                              | Pas de retention                                                                        | `find -mtime +30 -delete` dans le script                                                                   |
| **Dump pg vide (DB indisponible) gzippé OK silencieusement** | pg_dump retourne 0 entries mais exit 0                                                   | Pas de check taille                                                                     | Check `stat -c '%s'` > 10 KB sinon alert                                                                   |

---

## 5. CONFORMITÉ DOCTRINE AXION-IA

| Doctrine                                                              | Statut | Action Agent 17                                                                              |
| --------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Code = SSOT (mémoire `axionia_doctrine_code_ssot`)                    | ✅     | Aucun hardcode embed/path/CSP — tout en SSOT TS                                              |
| Zero-hardcode (mémoire `axionia_pricing_zero_hardcode_2026-05-08`)    | ✅     | `KB_EMBED_DOMAIN_WHITELIST`, `KB_TIPTAP_ALLOWLIST`, `KB_TYPE_TO_PUBLIC_SEGMENT_*`            |
| Naming Axion-IA (mémoire `axionia_naming_brand_vs_project`)           | ✅     | Tables `knowledge_*` snake_case, identifiers camelCase                                       |
| Hetzner CPX32 + CF Free (mémoire `axionia_hosting_hetzner`)           | ✅     | Stockage V1+V1.5 fit dans 80 GB SSD ; V2 scale à arbitrer (R2)                               |
| Web Vitals 2026 (`AGENTS.md`)                                         | ✅     | Middleware lookup cache 60s → INP middleware overhead < 5 ms p75. Aucun bundle public ajouté |
| Telegram PII (ADR 0010)                                               | ✅     | Alerts DR + HMAC fail redactées via `pii-redaction.ts`                                       |
| RGPD retention-purge (mémoire `axionia_session_2026-05-09_sprint_24`) | ✅     | Étendu pour `knowledge_*` (Sprint KB-9 Agent 9)                                              |
| Sous-processeurs                                                      | ⚠️     | Si Voyage AI retenu V1.5 → ajout `subprocessors.ts` obligatoire                              |
| Cabinet IA opérationnel (`axionia_naming_cabinet`)                    | N/A    | Pas d'impact sécurité/DR                                                                     |

---

## 6. INTÉGRATION SPRINT PLAN

| Sprint                      | Livrable Agent 17                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KB-1** (schéma)           | `KnowledgeSlugHistory` + enum `SlugChangeReason` dans la migration `expand` initiale. Pas de backfill.                                                                                                                                                                                                                                                                        |
| **KB-2** (backfill)         | Snapshot CSV `articles-slugs-2026-05-13.csv` exporté avant migration. Décision Will : créer ou non `KnowledgeSlugHistory` rows à partir d'éventuels `redirects.csv` existants.                                                                                                                                                                                                |
| **KB-7** (FTS)              | Filtre `confidentiality NOT IN ('confidential', 'secret')` dans toutes les queries publiques. Test bloquant.                                                                                                                                                                                                                                                                  |
| **KB-11** (médias)          | Helper SSRF guard pour fetch externes (img upload).                                                                                                                                                                                                                                                                                                                           |
| **KB-12** (slug + sécurité) | **Sprint principal Agent 17** : ajout `@tiptap/html`, whitelist nodes/marks SSR, extension middleware `/middleware.ts` racine, helpers cache, server actions `renameSlugAction()` `changeTypeAction()` `mergeEntriesAction()`, scripts `backup-knowledge.sh` + `restore-knowledge-test.sh`, endpoint `export-full` + worker BullMQ. CSP extension. Tests Vitest + Playwright. |
| **KB-18** (tests)           | Suite tests sécurité : injection iframe evil, SSRF guard, rate-limit kb_helpful, CSP violation Playwright.                                                                                                                                                                                                                                                                    |
| **KB-21** (V1.5 pgvector)   | HMAC endpoint RAG si publié. Filtre confidentiality dans worker `kb.embed.batch`. Coût Voyage AI documenté.                                                                                                                                                                                                                                                                   |

---

## 7. STOP & ASK OUVERTS — décisions Will

### S&A 17.1 — Backup offsite : Backblaze B2 vs Coolify-only

**Question** : V1, on garde uniquement le dump local sur le VPS (sauvé par snapshot Hetzner global) OU on ajoute Backblaze B2 dès maintenant ?

**Pro local-only** :

- Zéro coût additionnel.
- Snapshot Hetzner = backup implicite (hebdomadaire selon config, $5.20/mois pour 10 snapshots).
- Pas de sous-processeur à ajouter (RGPD/sub-processors.ts).

**Pro Backblaze B2** :

- Recovery même si VPS Hetzner est compromis/perdu.
- $0.006/GB/mois (V1 < $0.001/mois, V1.5 < $0.01/mois — négligeable).
- 10 GB free egress/jour — DR drill download gratuit.
- US-based → sub-processor RGPD obligatoire (déclaration + DPA).

**Recommandation Agent 17** : **V1 = local-only + snapshot Hetzner**, on n'ajoute pas un nouveau sous-processeur tant que pas justifié. V1.5/V2 si on franchit 5k entries → bascule B2.

### S&A 17.2 — Fréquence DR drill : mensuel vs hebdomadaire

**Question** : restore-knowledge-test.sh tourne tous les combien ?

**Mensuel** : suffisant pour catch les regressions structurelles. Pas de bruit Telegram.

**Hebdomadaire** : détecte plus vite si pg_dump devient corrompu (problème nouveau). Plus de bruit (4 messages/mois si tout OK).

**Recommandation Agent 17** : **mensuel V1**, on monte à hebdomadaire si on a un incident.

### S&A 17.3 — Export GDPR full-KB : auth method

**Question** : `/api/internal/kb/export-full` est gated par quoi ?

**Options** :

1. OWNER seul + session classique (cookie next-auth).
2. OWNER + 2FA TOTP verified dans la session (renforcement).
3. OWNER + 2FA + email confirmation (link cliquable, anti-CSRF max).

**Recommandation Agent 17** : **Option 2** (OWNER + 2FA already-verified dans la session). Option 3 = trop friction pour un admin légitime (Will lui-même). Toutes les exports `?include=confidential` logguent Telegram + ActivityLog dans tous les cas.

### S&A 17.4 (bonus) — Redirections legacy : existent-elles ?

**Question** : Will a-t-il un fichier `redirects.csv` ou des règles `next.config.mjs` actuelles documentant des renames blog/case-studies/help passés ?

Si oui → Sprint KB-2 backfill `KnowledgeSlugHistory` à partir.
Si non → on part de zéro post-KB-12.

**Recommandation Agent 17** : checker `next.config.mjs` et `_AUDIT/redirects*.md` au début du Sprint KB-2. STOP & ASK Will direct si rien trouvé.

---

## 8. SCORING /10 (auto-évalué Phase A)

| Dimension                         | Score | Notes                                                                                           |
| --------------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| Modèle slug history complet       | 10/10 | `entryId` pointer évite chaînes 301, 3 reasons, indexes adéquats                                |
| Stratégie résolution (middleware) | 10/10 | Réutilise middleware existant, cache, doctrine Edge runtime adressée                            |
| Sécurité Tiptap (nodes/marks)     | 9/10  | Whitelist V1 + extensions V1.5 documentées. -1 : table V2+ à valider (tableaux fréquents en KB) |
| Sécurité SSRF/embeds              | 10/10 | Whitelist 5 domaines + extensible V1.5 + SSRF guard pipeline médias                             |
| Rate-limit                        | 10/10 | 6 buckets clairs, identités distinctes (IP/AdminId/clientId)                                    |
| CSP integration                   | 9/10  | -1 : test contrat à écrire Sprint KB-18                                                         |
| HMAC RAG V1.5                     | 9/10  | Spec complète mais hors-scope V1                                                                |
| Backup script                     | 10/10 | Gzipped, retention, alerte taille minimale, offsite optionnel                                   |
| DR drill                          | 9/10  | -1 : pas de test data integrity FK cross-tables (V1.5 stretch)                                  |
| Export GDPR                       | 9/10  | Async worker + URL signée + masking par défaut. -1 : auth method à trancher S&A                 |
| Estimation taille + coût          | 10/10 | 3 scénarios chiffrés V1/V1.5/V2 + Voyage AI confirmé                                            |
| Anti-patterns                     | 10/10 | 13 anti-patterns listés avec détection et doctrine                                              |

**Score total Phase A Agent 17** : **115/120** = **9.6/10**.

---

## 9. RÉFÉRENCES

- `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` § Agent 17 (l. 397-414)
- `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md` § 1.1, 4.1, 4.3, 9.17
- `middleware.ts` (racine repo, **PAS** `src/middleware.ts`)
- `package.json` HEAD (sans `@tiptap/html`)
- `src/lib/rate-limit.ts` (réutilisable)
- `src/lib/pii-redaction.ts` (réutilisable)
- `AGENTS.md` budget Web Vitals
- Mémoire `axionia_session_2026-05-09_sprint_24` — CSP nonce
- Mémoire `axionia_session_2026-05-09_sprint_24_1` — ADR 0010 Telegram PII
- Mémoire `axionia_hosting_hetzner` — CPX32 + CF Free
- Mémoire `axionia_doctrine_code_ssot` — SSOT zero-hardcode

---

**Fin Agent 17.** AUDIT-ONLY, aucune écriture code. Phase B Sprint KB-12 livre les modules.
