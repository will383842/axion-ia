# 04 — API & SERVER ACTIONS — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` § Agent 4
> Reality check : `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md`
> Date : 2026-05-13
> Statut : DRAFT (Phase A — AUDIT-ONLY, aucune écriture de `.ts` réel)
> Référence code : HEAD `main` (commit `95bba36`)

---

## 0. TL;DR

- **Surface API V1** : 24 server actions + 7 endpoints REST internes (≈ 31 entry-points).
- **Pattern recommandé** : `1 fichier par action` sous `src/server/actions/knowledge/<action>.ts` + 1 `_zod-schemas.ts` mutualisé + 1 `_guards.ts` mutualisé (permissions / context). Diverge volontairement du legacy god-file `src/features/admin-*/actions.ts` (justification scalabilité ~25 actions, lisibilité, code-splitting builds incrémentaux).
- **Audit log** : 100 % via `ActivityLog` existant (table déjà indexée `(targetType, targetId)`), namespace event `kb.*` (`kb.created`, `kb.updated`, `kb.draft-saved`, `kb.submitted-for-review`, `kb.published`, `kb.unpublished`, `kb.scheduled`, `kb.archived`, `kb.restored`, `kb.deleted`, `kb.relation.added`, `kb.relation.removed`, `kb.translation.added`, `kb.bulk.imported`, `kb.bulk.exported`, `kb.bulk.tagged`, `kb.bulk.archived`, `kb.version.rolledback`, `kb.reviewer.assigned`, `kb.asset.uploaded`, `kb.asset.deleted`, `kb.feedback.voted`, `kb.bookmark.toggled`, `kb.import.batch.rolledback`).
- **Revalidation** : `revalidatePath` ET `revalidateTag` systématique (tag `kb:entry:<id>` + tag `kb:type:<type>` + tag `kb:hub`).
- **IndexNow** : helper `pingIndexNow` existant (`src/lib/indexnow.ts`) appelé sur transitions `publish`, `unpublish` (delete URL), `update` si déjà publié.
- **Embedding regen V1.5** : enqueue BullMQ `kb-embed` job au lieu de bloquer la mutation. Worker `embed.worker.ts`.
- **Rate limit** : `checkRateLimit` (Redis sorted-set, `src/lib/rate-limit.ts`) — soft pour admin authentifié, dur pour public.
- **STOP & ASK ouverts** : 8 décisions, listées § 9.

---

## 1. RÉFÉRENCE — RÉALITÉ CODE ACTUEL (reality check § 2.3, § 4.3)

### 1.1 Pattern god-file legacy

`src/features/admin-blog/actions.ts` (373 lignes, **7 exports**) et `src/features/admin-case-studies/actions.ts` (372 lignes, **7 exports**) suivent le pattern :

- `'use server'` en tête du fichier (toutes les exports sont des server actions).
- 2 guards locaux (`requireAdminWrite` / `requireAdminRead`) **dupliqués** entre fichiers.
- Zod schemas inline (`listSchema`, `upsertSchema`, `translationSchema`, `tiptapJsonString`).
- `formData.get(...)` + `safeParse` (formulaires React 19 Server Actions natifs).
- Transaction Prisma : upsert article → upsert translations × 2 (fr/en) → `activityLog.create` → return.
- `revalidatePath` × 5 (admin + public FR + public EN + slug FR + slug EN).
- `pingIndexNow` fire-and-forget si `status === "published"`.

**Dette identifiée pour KB** : duplication des guards, schémas inline non testables individuellement, mutation + audit log + revalidation + IndexNow couplés dans la même fonction. À refactoriser pour KB (per-action + helpers mutualisés).

### 1.2 ActivityLog (réutilisable direct)

```prisma
model ActivityLog {
  id          String     @id @default(uuid()) @db.Uuid
  adminUserId String?    @map("admin_user_id") @db.Uuid
  action      String     @db.VarChar(120)
  targetType  String?    @map("target_type") @db.VarChar(80)
  targetId    String?    @map("target_id") @db.Uuid
  changes     Json?
  ipAddress   String?    @map("ip_address") @db.VarChar(64)
  userAgent   String?    @map("user_agent") @db.Text
  createdAt   DateTime   @default(now()) @map("created_at")
  @@index([targetType, targetId])
  @@index([action])
  @@index([createdAt])
  @@map("activity_logs")
}
```

→ aucune nouvelle table audit nécessaire (cohérent avec décision reality check § 9.8). KB consigne `targetType='knowledge_entry'` (ou `'knowledge_asset'`, `'knowledge_relation'`, etc.).

### 1.3 AdminRole actuel vs matrice KB cible

```prisma
enum AdminRole {
  super_admin
  admin
  editor
  reader
}
```

vs matrice KB prompt § 9.1 : `OWNER`, `EDITOR`, `REVIEWER`, `READER`.

→ pas de rôle `reviewer` aujourd'hui. **Décision Phase A — STOP & ASK Q1** : (a) étendre `AdminRole` avec `reviewer`, (b) ajouter une table `KnowledgeRoleAssignment` per-entry (over-engineering V1 ?), (c) mapper `editor` = `editor + reviewer` en V1 et splitter en V1.5. **Recommandation : (a) étendre l'enum** — coût migration minime, sémantique propre, compatible chaîne de revue.

Matrice KB V1 retenue (mapping recommandé) :

| Action KB                    | super_admin | admin |       editor        |   reviewer (new)   | reader |
| ---------------------------- | :---------: | :---: | :-----------------: | :----------------: | :----: |
| createEntry                  |     ✅      |  ✅   |         ✅          |         ❌         |   ❌   |
| updateEntry / saveDraft      |     ✅      |  ✅   | ✅ (own + assigned) | ✅ (assigned only) |   ❌   |
| submitForReview              |     ✅      |  ✅   |         ✅          |         ❌         |   ❌   |
| publish / schedulePublish    |     ✅      |  ✅   |         ❌          |         ✅         |   ❌   |
| unpublish                    |     ✅      |  ✅   |         ❌          |         ✅         |   ❌   |
| archive / restore            |     ✅      |  ✅   |      ✅ (own)       |         ✅         |   ❌   |
| deleteEntry (hard delete)    |     ✅      |  ❌   |         ❌          |         ❌         |   ❌   |
| rollbackVersion              |     ✅      |  ✅   |         ❌          |         ✅         |   ❌   |
| addRelation / removeRelation |     ✅      |  ✅   |         ✅          |         ✅         |   ❌   |
| addTranslation               |     ✅      |  ✅   |         ✅          |         ❌         |   ❌   |
| bulkImport / bulkExport      |     ✅      |  ✅   |         ❌          |         ❌         |   ❌   |
| bulkTag / bulkArchive        |     ✅      |  ✅   |         ❌          |         ❌         |   ❌   |
| rollbackImportBatch          |     ✅      |  ✅   |         ❌          |         ❌         |   ❌   |
| assignReviewer               |     ✅      |  ✅   |         ❌          |         ❌         |   ❌   |
| uploadAsset / deleteAsset    |     ✅      |  ✅   |         ✅          |         ✅         |   ❌   |
| Read (list/get/search admin) |     ✅      |  ✅   |         ✅          |         ✅         |   ✅   |

`reader` n'a aucun droit d'écriture — il observe l'admin via UI.
Public anonyme (sans session) : `feedbackVote` + `bookmarkToggle` (si session client NextAuth) + endpoints REST internes publics § 4.

---

## 2. ARCHITECTURE FICHIERS — `src/server/actions/knowledge/`

```
src/server/actions/knowledge/
├── _zod-schemas.ts        ← TOUS les schemas Zod KB (single source)
├── _guards.ts             ← requireKbRole(), requireKbReviewer(), requireKbOwner()
├── _audit.ts              ← logKbActivity() helper (DRY wrapper sur prisma.activityLog.create)
├── _revalidate.ts         ← revalidateKbPaths(entry) helper (tags + paths cohérents)
├── _embedding-queue.ts    ← enqueueEmbeddingRegen(entryId) helper (V1.5)
│
├── createEntry.ts
├── updateEntry.ts
├── saveDraft.ts
├── submitForReview.ts
├── publish.ts
├── unpublish.ts
├── schedulePublish.ts
├── archive.ts
├── restore.ts
├── deleteEntry.ts         ← hard delete super_admin only
│
├── addRelation.ts
├── removeRelation.ts
├── addTranslation.ts
│
├── bulkImport.ts
├── bulkExport.ts
├── bulkTag.ts
├── bulkArchive.ts
├── rollbackImportBatch.ts
│
├── rollbackVersion.ts
├── assignReviewer.ts
│
├── uploadAsset.ts
├── deleteAsset.ts
│
├── feedbackVote.ts        ← public anonyme + Turnstile
└── bookmarkToggle.ts      ← client NextAuth session
```

**Total V1 : 24 actions + 5 helpers internes** (préfixés `_` pour clarifier qu'ils ne sont **pas** des server actions exportées).

**Justification per-file vs god-file** (réponse explicite reality check § 9.4) :

- ✅ **Scalabilité** : 24 actions × 100-200 lignes ≈ 3 000-5 000 lignes total. Un seul fichier `actions.ts` deviendrait illisible.
- ✅ **Build incrémental** : Next 16 watch + tsc-incremental → un edit n'invalide qu'un fichier.
- ✅ **Test colocalisé** : `publish.test.ts` à côté de `publish.ts` (pattern repo déjà confirmé § 5).
- ✅ **Code review** : diff PR scoped (1 action = 1 file change).
- ✅ **Convention import** : `import { publish } from "@/server/actions/knowledge/publish"` parlant.
- ⚠️ **Risque** : sur-fragmentation pour les actions triviales (`bookmarkToggle` = 30 lignes). Atténué : helpers mutualisés réduisent chaque file à l'essentiel (parse → guard → mutate → audit → revalidate → enqueue).

---

## 3. SERVER ACTIONS — SIGNATURES TYPESCRIPT EXHAUSTIVES

### 3.0 Conventions communes

Chaque action :

1. Commence par `"use server";`.
2. Signature `(input: FormData)` OU `(input: TypedInput)` selon le caller (form classique = FormData, RSC button programmatique = typed input).
3. Parse via Zod (schemas dans `_zod-schemas.ts`).
4. Garde via `_guards.ts` (jette `unauthorized` / `forbidden` côté serveur — pas de retour `{ok:false}` pour ces cas, le client doit traiter via `error.tsx`).
5. Mutation Prisma dans `$transaction` (atomique avec `activityLog.create`).
6. `revalidatePath` + `revalidateTag` via `_revalidate.ts`.
7. `pingIndexNow` fire-and-forget si transition publique.
8. `enqueueEmbeddingRegen` fire-and-forget V1.5 si contenu textuel a changé.
9. Retour `Promise<{ ok: true, ...data } | { ok: false, error: string, fieldErrors?: Record<string,string> }>`.

### 3.1 `createEntry`

```ts
"use server";
import { z } from "zod";

export const createEntrySchema = z.object({
  type: z.enum([
    "article",
    "case_study",
    "faq",
    "help_article",
    "glossary_term",
    "guide",
    "playbook",
    "snippet",
    "doctrine",
    "commercial_doc",
  ]),
  locale: z.enum(["fr", "en"]),
  title: z.string().min(3).max(255),
  slug: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9-]+$/),
  audience: z.enum(["public", "client", "team"]).default("public"),
  confidentiality: z.enum(["public", "internal", "confidential", "secret"]).default("public"),
  domain: z.string().max(80).optional(),
  excerpt: z.string().max(500).optional(),
  authorId: z.string().uuid().nullable().optional(),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type CreateEntryState =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createEntry(
  _prev: CreateEntryState,
  formData: FormData,
): Promise<CreateEntryState>;
```

- **Permissions** : `super_admin | admin | editor`.
- **Side-effects** :
  - `prisma.knowledgeEntry.create` + `KnowledgeTranslation` (locale seul, draft).
  - `ActivityLog action='kb.created' targetType='knowledge_entry'`.
  - `revalidatePath(adminPath("fr","connaissances"))` + `revalidateTag("kb:list")`.
  - Pas d'IndexNow (entrée non publiée).
- **Anti-pattern à éviter** : créer + publier en 1 click (toujours créer en `draft`, séparation explicite via `publish`).

### 3.2 `updateEntry`

```ts
"use server";

export const updateEntrySchema = z.object({
  id: z.string().uuid(),
  patch: z.object({
    title: z.string().min(3).max(255).optional(),
    slug: z
      .string()
      .min(3)
      .max(255)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    excerpt: z.string().max(500).optional(),
    body: z.string().optional(), // HTML Tiptap
    bodyJson: z.string().optional(), // JSON serialisé, re-parsed
    bodyText: z.string().optional(),
    metaTitle: z.string().max(70).optional(),
    metaDescription: z.string().max(160).optional(),
    domain: z.string().max(80).optional(),
    audience: z.enum(["public", "client", "team"]).optional(),
    confidentiality: z.enum(["public", "internal", "confidential", "secret"]).optional(),
    tags: z.array(z.string()).max(20).optional(),
    coverImageId: z.string().uuid().nullable().optional(),
    heroLayout: z.enum(["none", "image", "schema"]).optional(),
    reviewDueAt: z.string().datetime().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    pinned: z.boolean().optional(),
    featured: z.boolean().optional(),
  }),
  locale: z.enum(["fr", "en"]),
  expectedVersion: z.number().int().min(0), // optimistic concurrency
});

export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type UpdateEntryState =
  | { ok: true; id: string; version: number }
  | { ok: false; error: string; conflictVersion?: number };

export async function updateEntry(input: UpdateEntryInput): Promise<UpdateEntryState>;
```

- **Permissions** : `super_admin | admin | editor (own + assigned) | reviewer (assigned only)`.
- **Side-effects** :
  - Vérifie `entry.version === expectedVersion` (sinon `{ ok:false, conflictVersion }`).
  - Crée 1 nouveau row `KnowledgeVersion` (immutable snapshot, reality check § 9.8).
  - Met à jour `KnowledgeTranslation` + bump `knowledgeEntry.version` + `updatedAt`.
  - `ActivityLog action='kb.updated' changes={diff: { keys: [...] }}` (pas la valeur intégrale → log lourd).
  - `revalidateKbPaths(entry)` (tag + path admin + path public si déjà publié).
  - `pingIndexNow` UNIQUEMENT si `status === "published"` (sinon noop).
  - `enqueueEmbeddingRegen(entryId)` si `body` ou `title` ou `excerpt` a changé.
- **Anti-pattern à éviter** : `prisma.knowledgeEntry.update` sans optimistic lock (deux éditeurs simultanés écrasent l'un l'autre — UX silencieuse de perte de contenu).

### 3.3 `saveDraft` (autosave throttled)

```ts
"use server";

export const saveDraftSchema = z.object({
  id: z.string().uuid(),
  locale: z.enum(["fr", "en"]),
  body: z.string(), // HTML Tiptap
  bodyJson: z.string(), // JSON serialisé
  bodyText: z.string(),
  title: z.string().min(3).max(255).optional(),
  excerpt: z.string().max(500).optional(),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type SaveDraftState =
  | { ok: true; savedAt: string } // ISO timestamp pour aria-live indicator
  | { ok: false; error: string };

export async function saveDraft(input: SaveDraftInput): Promise<SaveDraftState>;
```

- **Permissions** : même que `updateEntry`.
- **Side-effects** :
  - **Pas** de création de `KnowledgeVersion` (sinon explosion volumétrie : 1 save / 2 s → 1800 versions / heure).
  - Update `KnowledgeTranslation.body/bodyJson/bodyText` + bump `knowledgeEntry.updatedAt`.
  - Active `entry.hasUnsavedChanges = false` (drapeau UI).
  - `ActivityLog action='kb.draft-saved'` mais **throttlé serveur-side** : 1 log / 5 minutes / entry / user (sinon log table devient bruit). Implémentation : `checkRateLimit("kb-draft-log:" + entryId + ":" + userId, { limit: 1, windowSec: 300 })` — si bloqué, on update sans logger.
  - **Pas** de `revalidatePath` (pas besoin, contenu non publié).
  - **Pas** d'IndexNow.
  - **Pas** d'embedding regen (trop coûteux à l'autosave).
- **Anti-pattern à éviter** : créer une version par autosave ; logger chaque autosave dans `ActivityLog` (saturation table) ; await IndexNow / embedding dans le path autosave.
- **Throttling client** : `debounce(2000ms)` côté Tiptap (reality check § 9.3) + indicator `aria-live="polite"` "Brouillon enregistré HH:MM".

### 3.4 `submitForReview`

```ts
"use server";

export const submitForReviewSchema = z.object({
  id: z.string().uuid(),
  reviewerId: z.string().uuid().optional(), // si null → matched par domain + auto-assign
  note: z.string().max(2000).optional(),
});

export type SubmitForReviewState =
  | { ok: true; reviewerId: string | null }
  | { ok: false; error: string };

export async function submitForReview(
  _prev: SubmitForReviewState,
  formData: FormData,
): Promise<SubmitForReviewState>;
```

- **Permissions** : `editor` (sur ses entrées) + `admin` + `super_admin`.
- **Side-effects** :
  - Transition `status: draft → review`.
  - Set `entry.submittedForReviewAt = now()` + `entry.assignedReviewerId`.
  - `ActivityLog action='kb.submitted-for-review' changes={reviewerId}`.
  - Notification Telegram **redactée** (ADR 0010, mémoire `axionia_session_2026-05-09_sprint_24_1`) : `[KB-REVIEW] entry=<id> reviewer=<email-redacted>` — payload PII-scrubbed via `pii-redaction.ts`.
  - Enqueue BullMQ `kb-reviewer-email` job (assigne reviewer reçoit email de notification).
  - Pas de revalidatePath public (transition admin-only).
- **Anti-pattern à éviter** : publier directement depuis `draft` en bypassing review (UI peut le permettre pour `admin+`, mais l'event log doit distinguer `kb.published-without-review` pour audit).

### 3.5 `publish`

```ts
"use server";

export const publishSchema = z.object({
  id: z.string().uuid(),
  publishedAt: z.string().datetime().optional(), // si fourni + futur → schedulePublish
  forcePublish: z.boolean().default(false), // bypass PII scan blocking (super_admin only)
});

export type PublishState =
  | { ok: true; id: string; publishedAt: string; urls: { fr?: string; en?: string } }
  | { ok: false; error: string; piiViolations?: Array<{ field: string; type: string }> };

export async function publish(_prev: PublishState, formData: FormData): Promise<PublishState>;
```

- **Permissions** : `super_admin | admin | reviewer` (matrice § 1.3).
- **Side-effects** :
  - **Pre-publish PII scan** (reality check § 9.9) via `pii-redaction.ts` sur tous les `KnowledgeTranslation.bodyText` + `excerpt` + `metaDescription`. Si match non whitelisté ET `forcePublish=false` → `{ ok:false, piiViolations:[...] }`.
  - **Pre-publish alt text gate** (reality check § 9.12) : toutes les images du `bodyJson` doivent avoir `alt`. Sinon bloquant.
  - Transition `status: draft|review|scheduled → published`. Set `publishedAt` (now si non fourni).
  - `ActivityLog action='kb.published' changes={publishedAt, fromStatus}`.
  - **Snapshot legal-doctrine** : si `type IN ('commercial_doc','doctrine')`, créer `KnowledgeDoctrineSnapshot` (pattern `legal-snapshot.ts` reality check § 4.1).
  - `revalidatePath` × N : admin + hub `/ressources` + type liste `/ressources/[type]` + slug FR + slug EN + sitemap.
  - `revalidateTag("kb:hub")` + `revalidateTag(\`kb:type:\${type}\`)`+`revalidateTag(\`kb:entry:\${id}\`)`.
  - `pingIndexNow(urls)` fire-and-forget — réutilise `src/lib/indexnow.ts` (mémoire `axionia_session_2026-05-13_seo_email_stack`).
  - `enqueueEmbeddingRegen(entryId)` V1.5.
  - Si `type='article'` ET RSS opt-in → invalidate cache `/blog/feed.xml`.
- **Anti-pattern à éviter** :
  - publier avec `confidentiality IN ('confidential','secret')` (le guard doit refuser ces niveaux pour `audience='public'` — règle DB-level idéalement).
  - oublier le snapshot doctrine sur commercial_doc (perte de traçabilité juridique).
  - publier sans `lastReviewedAt` (E-E-A-T § 9.12) — bloquant ou warning ? **Décision : warning** (V1.5 = bloquant).

### 3.6 `unpublish`

```ts
"use server";

export const unpublishSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(10).max(500), // obligatoire pour traçabilité (RGPD + éditorial)
  redirectToId: z.string().uuid().optional(), // si l'entrée est remplacée → 301
});

export type UnpublishState = { ok: true; id: string } | { ok: false; error: string };

export async function unpublish(_prev: UnpublishState, formData: FormData): Promise<UnpublishState>;
```

- **Permissions** : `super_admin | admin | reviewer`.
- **Side-effects** :
  - Transition `status: published → draft` (ou `deprecated` si `redirectToId` fourni — reality check § 9.8).
  - Si `redirectToId` → ajoute `KnowledgeSlugHistory(oldSlug, newSlugFromRedirect, locale)` pour le 301 statique.
  - `ActivityLog action='kb.unpublished' changes={reason, redirectToId}` — `reason` est **obligatoire** pour audit.
  - `revalidatePath` admin + public (pour faire disparaître la page).
  - `pingIndexNow` avec l'URL supprimée (Bing accepte les notifications de retrait).
  - **Pas** de `enqueueEmbeddingRegen` (l'entrée existe encore en DB, on garde l'embedding pour la recherche admin V1.5).
- **Anti-pattern à éviter** : unpublish sans `reason` (perte de pourquoi) ; unpublish sans `revalidatePath` (la page reste en cache CDN).

### 3.7 `schedulePublish`

```ts
"use server";

export const schedulePublishSchema = z.object({
  id: z.string().uuid(),
  publishAt: z
    .string()
    .datetime()
    .refine((s) => new Date(s) > new Date(), {
      message: "publishAt doit être dans le futur",
    }),
});

export type SchedulePublishState =
  | { ok: true; jobId: string; publishAt: string }
  | { ok: false; error: string };

export async function schedulePublish(
  _prev: SchedulePublishState,
  formData: FormData,
): Promise<SchedulePublishState>;
```

- **Permissions** : `super_admin | admin | reviewer`.
- **Side-effects** :
  - Transition `status: draft|review → scheduled`. Set `entry.publishedAt = publishAt`.
  - Enqueue BullMQ `kb-scheduled-publish` job avec `delay: publishAt - now`. Job appelle `publish` interne (server-only, pas via server action publique).
  - Idempotency : si déjà scheduled → cancel previous job avant enqueue.
  - `ActivityLog action='kb.scheduled' changes={publishAt}`.
  - Pas d'IndexNow (publication réelle se fait au tick, IndexNow déclenché à ce moment-là).
- **Anti-pattern à éviter** : ne pas cancel l'ancien job → 2 publications successives au pire moment.

### 3.8 `archive`

```ts
"use server";

export const archiveSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type ArchiveState = { ok: true } | { ok: false; error: string };

export async function archive(_prev: ArchiveState, formData: FormData): Promise<ArchiveState>;
```

- **Permissions** : `super_admin | admin | editor (own) | reviewer`.
- **Side-effects** :
  - Transition `status: * → archived`. Set `archivedAt = now()`.
  - `ActivityLog action='kb.archived' changes={fromStatus, reason}`.
  - `revalidatePath` admin uniquement (archived n'est pas listé en public).
  - Si l'entrée était `published` → IndexNow notify URL removal (comme `unpublish`).
- **Anti-pattern à éviter** : `archive` = hard delete (NON — soft delete, restorable via `restore`).

### 3.9 `restore`

```ts
"use server";

export const restoreSchema = z.object({
  id: z.string().uuid(),
});

export type RestoreState =
  | { ok: true; id: string; restoredToStatus: "draft" | "review" }
  | { ok: false; error: string };

export async function restore(_prev: RestoreState, formData: FormData): Promise<RestoreState>;
```

- **Permissions** : `super_admin | admin | editor (own) | reviewer`.
- **Side-effects** :
  - Transition `status: archived → draft` (toujours `draft`, jamais `published` direct — exige re-publish workflow).
  - Set `archivedAt = null`.
  - `ActivityLog action='kb.restored'`.
- **Anti-pattern à éviter** : `restore` directement à `published` (court-circuite la review).

### 3.10 `deleteEntry` (hard delete)

```ts
"use server";

export const deleteEntrySchema = z.object({
  id: z.string().uuid(),
  confirmSlug: z.string(), // doit matcher entry.translations[0].slug pour confirmer
});

export type DeleteEntryState = { ok: true } | { ok: false; error: string };

export async function deleteEntry(
  _prev: DeleteEntryState,
  formData: FormData,
): Promise<DeleteEntryState>;
```

- **Permissions** : **`super_admin` UNIQUEMENT**.
- **Side-effects** :
  - Vérifie `confirmSlug === entry.translations.find(t=>t.locale==='fr').slug`. Sinon `{ ok:false, error:'slug-mismatch' }`.
  - Vérifie `entry.archivedAt !== null` (pas de hard delete direct depuis `published`).
  - Hard delete avec cascade Prisma (translations, versions, relations, feedback, bookmarks).
  - **Préserve** `ActivityLog` (`onDelete: SetNull` sur adminUserId mais conserve `targetType='knowledge_entry' + targetId`).
  - Préserve `KnowledgeSlugHistory` (pour le 301 toujours valable).
  - `ActivityLog action='kb.deleted' changes={slug, type, lastTitle}` (les meta pour pouvoir auditer la suppression a posteriori).
  - `pingIndexNow` URL removal.
- **Anti-pattern à éviter** :
  - hard delete sans `confirmSlug` (catastrophe en 1 click).
  - hard delete `published` (faute d'attention, perte SEO/AEO).
  - oublier de préserver l'audit log avec les méta minimales.

### 3.11 `addRelation`

```ts
"use server";

export const addRelationSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  kind: z.enum([
    "related", // bidirectional
    "prerequisite", // directional (A requires B)
    "next", // directional (sequence)
    "supersedes", // A replaces B → B becomes deprecated
    "translates", // EN of FR ou vice-versa (édge case, normalement géré par translation)
  ]),
  note: z.string().max(500).optional(),
});

export type AddRelationState = { ok: true; relationId: string } | { ok: false; error: string };

export async function addRelation(
  _prev: AddRelationState,
  formData: FormData,
): Promise<AddRelationState>;
```

- **Permissions** : `super_admin | admin | editor | reviewer`.
- **Side-effects** :
  - Vérifie pas de cycle (`fromId === toId` ou cycle indirect via `prerequisite` → erreur).
  - Crée `KnowledgeRelation(fromId, toId, kind, createdById, createdAt)`.
  - Si `kind='related'` → crée aussi la relation inverse automatiquement (bidirectional).
  - Si `kind='supersedes'` → met à jour `entry(toId).status='deprecated'` + `supersededById=fromId`.
  - `ActivityLog action='kb.relation.added' changes={kind, toId}`.
  - `revalidatePath` des 2 entrées publiques si l'une est publiée.
- **Anti-pattern à éviter** : cycle prerequisite (A requires B, B requires A → infinite loop UI) ; manquer la relation inverse pour `related`.

### 3.12 `removeRelation`

```ts
"use server";

export const removeRelationSchema = z.object({
  relationId: z.string().uuid(),
});

export type RemoveRelationState = { ok: true } | { ok: false; error: string };

export async function removeRelation(
  _prev: RemoveRelationState,
  formData: FormData,
): Promise<RemoveRelationState>;
```

- **Permissions** : `super_admin | admin | editor | reviewer`.
- **Side-effects** :
  - Hard delete `KnowledgeRelation`.
  - Si bidirectional (`kind='related'`) → delete relation inverse aussi.
  - `ActivityLog action='kb.relation.removed' changes={kind, fromId, toId}`.

### 3.13 `addTranslation`

```ts
"use server";

export const addTranslationSchema = z.object({
  entryId: z.string().uuid(),
  targetLocale: z.enum(["fr", "en"]),
  // soit on traduit from scratch :
  title: z.string().min(3).max(255),
  slug: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9-]+$/),
  body: z.string().min(10),
  bodyJson: z.string(),
  bodyText: z.string(),
  excerpt: z.string().max(500).optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  // soit on initialise depuis l'autre locale (clone) :
  cloneFromSourceLocale: z.boolean().default(false),
});

export type AddTranslationState =
  | { ok: true; translationId: string }
  | { ok: false; error: string };

export async function addTranslation(
  _prev: AddTranslationState,
  formData: FormData,
): Promise<AddTranslationState>;
```

- **Permissions** : `super_admin | admin | editor`.
- **Side-effects** :
  - Vérifie qu'il n'existe pas déjà de `KnowledgeTranslation(entryId, targetLocale)`. Sinon erreur (utiliser `updateEntry` à la place).
  - Crée la translation en `draft` (jamais directement publiée — workflow review).
  - `ActivityLog action='kb.translation.added' changes={targetLocale}`.
  - `revalidatePath` admin (la liste affiche maintenant 2 locales).
- **Anti-pattern à éviter** :
  - auto-publish la translation à la création (court-circuite la review humaine V1.5 § 9.10).
  - autoriser plus de 2 traductions par entrée V1 (V1.5 ouvrira multi-locale).

### 3.14 `bulkImport`

```ts
"use server";

export const bulkImportSchema = z.object({
  source: z.enum(["markdown-zip", "notion-export", "csv", "json"]),
  fileUrl: z.string().url(), // pre-uploadé via uploadAsset, ou URL externe vérifiée
  dryRun: z.boolean().default(true),
  // mapping :
  defaultType: z.enum([
    "article",
    "case_study",
    "faq",
    "help_article",
    "glossary_term",
    "guide",
    "playbook",
    "snippet",
    "doctrine",
    "commercial_doc",
  ]),
  defaultLocale: z.enum(["fr", "en"]).default("fr"),
  defaultAudience: z.enum(["public", "client", "team"]).default("public"),
  defaultConfidentiality: z.enum(["public", "internal", "confidential"]).default("internal"),
});

export type BulkImportState =
  | {
      ok: true;
      batchId: string;
      preview: Array<{
        slug: string;
        title: string;
        status: "would-create" | "would-update" | "conflict";
      }>;
      counts: { create: number; update: number; conflict: number };
    }
  | { ok: false; error: string };

export async function bulkImport(
  _prev: BulkImportState,
  formData: FormData,
): Promise<BulkImportState>;
```

- **Permissions** : `super_admin | admin`.
- **Side-effects** :
  - `dryRun=true` (défaut) : parse fichier + produit le `preview`, **aucune écriture DB**.
  - `dryRun=false` : enqueue BullMQ `kb-bulk-import` job avec `KnowledgeImportBatch(id, source, fileUrl, status='running', ...)` créé. Le job traite ligne par ligne avec rollback support.
  - `ActivityLog action='kb.bulk.imported' changes={batchId, dryRun, counts}`.
  - Aucun IndexNow (les entrées créées sont en `draft`, pas publiées).
- **Anti-pattern à éviter** :
  - écrire pendant le dry-run.
  - import sans `KnowledgeImportBatch` traçable (impossible de rollback).
  - bulk import qui n'enqueue pas (timeout server action 60s sur Coolify si > 50 entrées).

### 3.15 `bulkExport`

```ts
"use server";

export const bulkExportSchema = z.object({
  filter: z.object({
    type: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
    domain: z.array(z.string()).optional(),
    audience: z.array(z.string()).optional(),
    locale: z.enum(["fr", "en", "both"]).default("both"),
  }),
  format: z.enum(["json", "markdown-zip", "csv"]),
  includeBody: z.boolean().default(true),
  redactPII: z.boolean().default(true), // applique pii-redaction.ts (default ON)
});

export type BulkExportState =
  | { ok: true; downloadUrl: string; expiresAt: string }
  | { ok: false; error: string };

export async function bulkExport(
  _prev: BulkExportState,
  formData: FormData,
): Promise<BulkExportState>;
```

- **Permissions** : `super_admin | admin`.
- **Side-effects** :
  - Enqueue BullMQ `kb-bulk-export` job. Job écrit dans `/data/knowledge-exports/<batchId>.<format>` (volume Coolify).
  - URL signée à TTL court (15 min) via `magic-token.ts` existant.
  - **Refus dur** si `redactPII=false` ET `confidentiality IN ('confidential','secret')` dans le filtre — sauf `super_admin` explicite (reality check § 9.9).
  - `ActivityLog action='kb.bulk.exported' changes={filter, format, redactPII, totalRows}`.
- **Anti-pattern à éviter** :
  - export `confidentiality='secret'` non redacté envoyé par email (sortie PII).
  - URL d'export sans TTL (lien éternel = fuite).

### 3.16 `bulkTag`

```ts
"use server";

export const bulkTagSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1).max(500), // hard cap
  addTags: z.array(z.string().max(60)).default([]),
  removeTags: z.array(z.string().max(60)).default([]),
});

export type BulkTagState = { ok: true; affected: number } | { ok: false; error: string };

export async function bulkTag(_prev: BulkTagState, formData: FormData): Promise<BulkTagState>;
```

- **Permissions** : `super_admin | admin`.
- **Side-effects** :
  - Transaction Prisma `$transaction` → update N entries (cap 500).
  - `ActivityLog action='kb.bulk.tagged' changes={addTags, removeTags, entryIds: [first 50]}` (cap pour ne pas exploser le `changes` JSON).
  - `revalidateTag("kb:list")` + `revalidateTag` per type concerné.
- **Anti-pattern à éviter** : pas de cap → DoS interne ; logger les 500 IDs dans `changes` (bloat).

### 3.17 `bulkArchive`

```ts
"use server";

export const bulkArchiveSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().max(500).optional(),
});

export type BulkArchiveState = { ok: true; affected: number } | { ok: false; error: string };

export async function bulkArchive(
  _prev: BulkArchiveState,
  formData: FormData,
): Promise<BulkArchiveState>;
```

- **Permissions** : `super_admin | admin`.
- **Side-effects** :
  - Pour chaque ID : applique la même logique que `archive` (préserve les audits per-entry).
  - `ActivityLog` × N (1 entry per row, **pas** un seul log agrégé — sinon perte de traçabilité per-entry).
  - +1 log agrégé `kb.bulk.archived changes={count, reason}` pour la corrélation.
  - IndexNow batch des URLs supprimées.
- **Anti-pattern à éviter** : 1 seul log agrégé sans logs per-entry (audit perdu) ; pas de batch IndexNow (rate limit indexnow.org).

### 3.18 `rollbackVersion`

```ts
"use server";

export const rollbackVersionSchema = z.object({
  entryId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export type RollbackVersionState = { ok: true; newVersion: number } | { ok: false; error: string };

export async function rollbackVersion(
  _prev: RollbackVersionState,
  formData: FormData,
): Promise<RollbackVersionState>;
```

- **Permissions** : `super_admin | admin | reviewer`.
- **Side-effects** :
  - Lit `KnowledgeVersion(versionId)` (immutable).
  - Crée une **nouvelle** version qui restaure le contenu de la version cible (ne supprime jamais les versions intermédiaires — reality check § 9.8).
  - Update `KnowledgeTranslation` avec le contenu de la version cible.
  - Bump `entry.version`.
  - `ActivityLog action='kb.version.rolledback' changes={fromVersion, toVersion, versionId}`.
  - Si l'entrée est `published` → `revalidatePath` + `pingIndexNow` + `enqueueEmbeddingRegen`.
- **Anti-pattern à éviter** : delete les versions postérieures (perte historique) ; rollback sans new version (impossible de revenir au présent).

### 3.19 `assignReviewer`

```ts
"use server";

export const assignReviewerSchema = z.object({
  entryId: z.string().uuid(),
  reviewerId: z.string().uuid().nullable(), // null = unassign
  note: z.string().max(2000).optional(),
});

export type AssignReviewerState =
  | { ok: true; reviewerId: string | null }
  | { ok: false; error: string };

export async function assignReviewer(
  _prev: AssignReviewerState,
  formData: FormData,
): Promise<AssignReviewerState>;
```

- **Permissions** : `super_admin | admin`.
- **Side-effects** :
  - Vérifie `reviewerId` a bien le rôle `reviewer` (ou supérieur).
  - Update `entry.assignedReviewerId`.
  - `ActivityLog action='kb.reviewer.assigned' changes={reviewerId, previousReviewerId}`.
  - Notification Telegram redactée + email reviewer (BullMQ `kb-reviewer-email`).
- **Anti-pattern à éviter** : assigner un user sans le rôle requis (UI doit pré-filtrer la liste).

### 3.20 `uploadAsset`

```ts
"use server";

export const uploadAssetSchema = z.object({
  // FormData inclut le fichier en tant que File (multipart)
  altText: z.string().min(3).max(280), // bloquant non vide (a11y § 9.12)
  caption: z.string().max(500).optional(),
  usage: z.enum(["body", "cover", "open_graph"]).default("body"),
  forEntryId: z.string().uuid().optional(), // si lié à une entrée
});

export type UploadAssetState =
  | { ok: true; assetId: string; url: string; width: number; height: number }
  | { ok: false; error: string };

export async function uploadAsset(
  _prev: UploadAssetState,
  formData: FormData,
): Promise<UploadAssetState>;
```

- **Permissions** : `super_admin | admin | editor | reviewer`.
- **Side-effects** :
  - Validation taille (≤ 10 MB image, ≤ 50 MB doc) + mimetype whitelist (jpeg/png/webp/avif/pdf).
  - SHA-256 hash → si déjà en DB → réutilise (dedup).
  - Strip EXIF/GPS via `sharp` (RGPD reality check § 9.13).
  - Conversion `sharp` queued (BullMQ `kb-asset-process`) — variantes 320/640/1024/1920/3840 + AVIF/WebP/JPEG fallback.
  - `prisma.knowledgeAsset.create(...)` avec `hash`, `originalPath`, `width`, `height`, `bytes`, `altText`, `uploadedById`.
  - `ActivityLog action='kb.asset.uploaded' changes={assetId, bytes, mime}`.
  - Lien éventuel à l'entrée via `forEntryId` (cover ou OG).
- **Anti-pattern à éviter** :
  - publier sans alt text (gate côté Zod min(3)).
  - stocker l'asset en base64 dans le JSON Tiptap (reality check § 9.13 anti-pattern).
  - service via API route Next (overhead → serve via Caddy directement).

### 3.21 `deleteAsset`

```ts
"use server";

export const deleteAssetSchema = z.object({
  assetId: z.string().uuid(),
  force: z.boolean().default(false), // true = supprime même si usageCount > 0
});

export type DeleteAssetState = { ok: true } | { ok: false; error: string; usageCount?: number };

export async function deleteAsset(
  _prev: DeleteAssetState,
  formData: FormData,
): Promise<DeleteAssetState>;
```

- **Permissions** : `super_admin | admin`.
- **Side-effects** :
  - Vérifie `usageCount === 0` (sinon nécessite `force=true`).
  - Soft delete : flag `deletedAt`. Le GC cron 30 j supprime physiquement.
  - `ActivityLog action='kb.asset.deleted' changes={assetId, force, usageCount}`.
- **Anti-pattern à éviter** : hard delete immédiat (perte d'historique image).

### 3.22 `feedbackVote` (public anonyme)

```ts
"use server";

export const feedbackVoteSchema = z.object({
  entryId: z.string().uuid(),
  vote: z.enum(["up", "down"]),
  reason: z.string().max(500).optional(), // facultatif si down
});

export type FeedbackVoteState =
  | { ok: true; helpfulCount: number; notHelpfulCount: number }
  | { ok: false; error: string };

export async function feedbackVote(
  _prev: FeedbackVoteState,
  formData: FormData,
): Promise<FeedbackVoteState>;
```

- **Permissions** : **public** (pas de session requise, mais Turnstile obligatoire).
- **Side-effects** :
  - Turnstile verify (`verifyTurnstile` existant `src/lib/turnstile.ts`).
  - Rate limit `kb_feedback:<ip>:<entryId>` → `1 / IP / entry / 24 h` (Redis).
  - Si déjà voté (IP+entry+24h) → idempotent silencieux (ne retourne pas d'erreur, juste les counts actuels).
  - `prisma.knowledgeFeedback.create(...)` avec `ipHash` (PBKDF2 short, jamais l'IP en clair — ADR 0010-style PII).
  - Update `entry.helpfulCount` / `entry.notHelpfulCount` (denormalised counters).
  - `ActivityLog action='kb.feedback.voted' changes={vote, entryId}` mais **adminUserId=null** (public).
  - Pas de `revalidatePath` (les counts s'affichent via fetch on-demand ou stream RSC).
  - Pas d'IndexNow.
- **Anti-pattern à éviter** :
  - stocker l'IP en clair (RGPD).
  - permettre un vote sans Turnstile (bot floods).
  - mettre à jour les counters en transaction lente (déni de service involontaire) — utiliser update direct + race-condition acceptée (vote count est approximatif).

### 3.23 `bookmarkToggle` (client connecté)

```ts
"use server";

export const bookmarkToggleSchema = z.object({
  entryId: z.string().uuid(),
});

export type BookmarkToggleState = { ok: true; bookmarked: boolean } | { ok: false; error: string };

export async function bookmarkToggle(
  _prev: BookmarkToggleState,
  formData: FormData,
): Promise<BookmarkToggleState>;
```

- **Permissions** : **session NextAuth client requise** (booking client, pas admin).
- **Side-effects** :
  - Vérifie `entry.audience IN ('public','client')` (un client ne peut pas bookmark une entrée `team`).
  - Toggle `prisma.knowledgeBookmark` `(userId, entryId)`.
  - `ActivityLog action='kb.bookmark.toggled' targetType='knowledge_entry' adminUserId=null changes={userId, bookmarked}` (audit client séparé via `targetType` distinct possible — décision § 9 Q3).
  - `revalidatePath("/fr/mes-ressources")`.
- **Anti-pattern à éviter** : bookmark sur entrée `audience='team'` (fuite info).

### 3.24 `rollbackImportBatch`

```ts
"use server";

export const rollbackImportBatchSchema = z.object({
  batchId: z.string().uuid(),
  hardDelete: z.boolean().default(false), // true = delete created entries, false = archive only
});

export type RollbackImportBatchState =
  | { ok: true; rolledBack: number }
  | { ok: false; error: string };

export async function rollbackImportBatch(
  _prev: RollbackImportBatchState,
  formData: FormData,
): Promise<RollbackImportBatchState>;
```

- **Permissions** : `super_admin | admin`.
- **Side-effects** :
  - Vérifie `batch.status IN ('done','partial')` (pas pendant `running`).
  - Si `hardDelete=false` (défaut) : archive toutes les entrées créées par ce batch.
  - Si `hardDelete=true` : hard delete (super_admin ONLY).
  - Met à jour `batch.status='rolledback'`.
  - `ActivityLog action='kb.import.batch.rolledback' changes={batchId, hardDelete, count}`.
  - `revalidateTag("kb:list")`.
- **Anti-pattern à éviter** : rollback sans tracking précis des IDs créés par le batch (mémoriser `KnowledgeImportBatchItem(batchId, entryId)`).

---

## 4. ENDPOINTS REST INTERNES

Routes Next 16 `route.ts` sous `src/app/api/internal/kb/*`. Tous sous middleware d'auth + rate limit.

### 4.1 `GET /api/internal/kb/search` (public + admin)

```ts
// src/app/api/internal/kb/search/route.ts
// Auth : optionnelle (admin = soft limit, public = hard limit + Turnstile pour > N req/min)
// Stack : FTS Postgres V1 + pgvector hybride V1.5 (reality check § 9.5)

export type KbSearchQuery = {
  q: string; // min 2 chars
  locale: "fr" | "en";
  types?: string[]; // facette type
  domain?: string[];
  audience?: ("public" | "client" | "team")[]; // team filtré côté serveur selon rôle
  tags?: string[];
  page?: number; // default 1
  pageSize?: number; // default 20, max 50
  sortBy?: "relevance" | "recent" | "popular"; // default relevance
};

export type KbSearchResponse = {
  hits: Array<{
    id: string;
    type: string;
    title: string;
    excerpt: string;
    slug: string;
    url: string;
    snippet: string; // FTS ts_headline highlighted
    score: number;
    publishedAt: string;
    lastReviewedAt: string | null;
    tags: string[];
  }>;
  total: number;
  facets: {
    type: Record<string, number>;
    domain: Record<string, number>;
    tags: Array<{ tag: string; count: number }>;
  };
  page: number;
  pageSize: number;
};

export async function GET(req: Request): Promise<Response>;
```

- **Rate limit** : `kb_search:<ip>` → 60/IP/min (public) ; admin authentifié = 300/IP/min (soft).
- **Side-effects** : aucun (lecture only). Sentry breadcrumb sur `q` (PII-scrubbed).
- **Cache** : `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (anonyme), `private, no-store` (admin).
- **Anti-pattern à éviter** : query non quotée → SQL injection sur FTS ; charger toute la table puis filtrer (utiliser tsvector index GIN) ; retourner `audience='team'` à un non-admin.

### 4.2 `GET /api/internal/kb/[id]` (admin + client si visible)

```ts
// src/app/api/internal/kb/[id]/route.ts
export type KbGetEntryResponse = {
  entry: {
    id: string;
    type: string;
    status: string;
    audience: string;
    confidentiality: string;
    translations: Array<{
      locale: string;
      title: string;
      slug: string;
      body: string;
      bodyJson: unknown;
      bodyText: string;
      excerpt: string;
    }>;
    tags: string[];
    publishedAt: string | null;
    lastReviewedAt: string | null;
    author: { id: string; name: string; slug: string } | null;
    relations: Array<{
      kind: string;
      toEntry: { id: string; title: string; slug: string; type: string };
    }>;
    helpfulCount: number;
    notHelpfulCount: number;
  };
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response>;
```

- **Rate limit** : `kb_get:<ip>:<id>` → 120/IP/min.
- **Permissions** : public si `audience='public'` ET `status='published'`. Client si `audience IN ('public','client')` + session NextAuth. Admin si rôle.
- **Cache** : `s-maxage=300` si public published.

### 4.3 `POST /api/internal/kb/feedback` (alias REST de `feedbackVote`)

Exposé en plus de l'action pour permettre les clients qui ne sont pas RSC (analytics, scripts externes autorisés). Réutilise la logique de `feedbackVote` (DRY via helper interne `castFeedbackVote(input)`).

```ts
// src/app/api/internal/kb/feedback/route.ts
export type FeedbackBody = {
  entryId: string;
  vote: "up" | "down";
  reason?: string;
  turnstileToken: string;
};

export async function POST(req: Request): Promise<Response>;
```

- **Rate limit** : `kb_feedback:<ip>:<entryId>` → 1/IP/entry/24h (cohérent avec § 3.22).
- **Anti-pattern à éviter** : duplication de logique vs `feedbackVote` action (utiliser helper interne mutualisé).

### 4.4 `GET /api/internal/kb/[id]/pdf` (admin + client)

```ts
// src/app/api/internal/kb/[id]/pdf/route.ts
// Génère PDF on-demand via @react-pdf/renderer (reality check § 9.15 anti-puppeteer)

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response>;
```

- **Rate limit** : `kb_pdf:<ip>` → 10/IP/min.
- **Permissions** : même que `GET /api/internal/kb/[id]` (le PDF expose ce que la page expose).
- **Side-effects** :
  - Génère le PDF avec doctrine snapshot embarqué (footer immutable).
  - Cache disque `/data/knowledge-pdf-cache/<id>-<version>.pdf` (10 min TTL).
  - Headers `Content-Disposition: inline; filename="..."`.
  - `ActivityLog action='kb.pdf.generated'` si admin (pas pour public, sinon table inflation).
- **Anti-pattern à éviter** :
  - puppeteer (RAM CPX32 reality check § 9.15).
  - regen PDF à chaque requête (cache disque obligatoire).

### 4.5 `POST /api/internal/kb/export-full` (admin only)

```ts
// src/app/api/internal/kb/export-full/route.ts
// Wrapper REST de bulkExport (asynchrone via BullMQ).

export type ExportFullBody = {
  filter: {
    /* idem bulkExportSchema */
  };
  format: "json" | "markdown-zip" | "csv";
  redactPII?: boolean;
};

export async function POST(req: Request): Promise<Response>;
```

- **Rate limit** : `kb_export:<adminUserId>` → 3/admin/heure (export = lourd).
- **Permissions** : `super_admin | admin`.
- **Anti-pattern à éviter** : export sync dans la requête HTTP (timeout) ; URL résultat sans TTL.

### 4.6 `POST /api/internal/kb/rag` (V1.5)

```ts
// src/app/api/internal/kb/rag/route.ts
// V1.5 — RAG hybrid search via pgvector + Claude API

export type RagBody = {
  query: string;
  topK?: number; // default 8, max 20
  locale?: "fr" | "en";
  audience?: "public" | "client" | "team"; // filtré selon caller
  filters?: { type?: string[]; domain?: string[] };
  stream?: boolean; // SSE streaming response
};

export type RagResponse = {
  answer: string; // Claude generated
  citations: Array<{
    entryId: string;
    title: string;
    url: string;
    snippet: string;
    score: number;
  }>;
  latencyMs: number;
};

export async function POST(req: Request): Promise<Response>;
```

- **Auth** : HMAC signature (header `X-KB-Signature: <hmac-sha256(body, RAG_SECRET)>`) — secret rotation possible. Endpoint **non public**.
- **Rate limit** : `kb_rag:<callerId>` → 60/h (admin), 600/h (back-end interne).
- **Permissions** : refus dur `confidentiality IN ('confidential','secret')` envoyé à Claude API (skill `claude-api` doctrine).
- **Side-effects** :
  - hybrid search RRF (FTS + cosine pgvector top-K).
  - Reranking optionnel (V1.5 phase 2).
  - Skill `claude-api` doctrine : prompt caching ON.
  - `ActivityLog action='kb.rag.queried' changes={query (redacted), topK, locale}` — query PII-scrubbed via `pii-redaction.ts`.
  - Cible latence p95 < 800 ms (reality check § 9.10).
- **Anti-pattern à éviter** :
  - RAG sans citation (réponse non sourçable = halluc).
  - envoyer `confidentiality='secret'` à API tierce (sous-processeurs § 9.9).
  - HMAC absent → endpoint exposable.

### 4.7 `POST /api/internal/kb/embed` (V1.5, internal/cron only)

```ts
// src/app/api/internal/kb/embed/route.ts
// V1.5 — endpoint déclencheur batch re-embed (utilisé par cron + admin re-index)

export type EmbedBody = {
  entryIds?: string[]; // si fourni : ces entries
  all?: boolean; // sinon : full re-embed (max 1/jour)
  model?: string; // override modèle (default = config.kb.embedModel)
};

export type EmbedResponse = {
  enqueued: number;
  jobIds: string[];
};

export async function POST(req: Request): Promise<Response>;
```

- **Auth** : HMAC signature ou session `super_admin`.
- **Rate limit** : `kb_embed:full` → 1/jour (full re-embed) ; `kb_embed:partial` → 100/jour.
- **Side-effects** :
  - Enqueue BullMQ `kb-embed` jobs.
  - Worker batches par 50 (skill `claude-api` doctrine).
  - `ActivityLog action='kb.embed.triggered' changes={count, model}`.
- **Anti-pattern à éviter** : full re-embed > 1/jour ; ré-embedding synchronisé dans le path autosave.

---

## 5. POLITIQUE DE RATE LIMIT (SYNTHÈSE)

Utilise `checkRateLimit` (`src/lib/rate-limit.ts`, sorted-set Redis, fail-open). Pattern déjà éprouvé sur `contact:`, `auth:login:`, `quote:`, etc. (reality check § 4.3).

| Endpoint / action                             | Key shape                                                          | Limit                   | Window | Niveau |
| --------------------------------------------- | ------------------------------------------------------------------ | ----------------------- | ------ | ------ |
| `feedbackVote` + `POST /feedback`             | `kb_feedback:<ip>:<entryId>`                                       | 1                       | 24 h   | hard   |
| `GET /search` (public)                        | `kb_search:<ip>`                                                   | 60                      | 60 s   | hard   |
| `GET /search` (admin)                         | `kb_search_admin:<adminUserId>`                                    | 300                     | 60 s   | soft   |
| `GET /[id]`                                   | `kb_get:<ip>:<id>`                                                 | 120                     | 60 s   | hard   |
| `GET /[id]/pdf`                               | `kb_pdf:<ip>`                                                      | 10                      | 60 s   | hard   |
| `POST /export-full`                           | `kb_export:<adminUserId>`                                          | 3                       | 1 h    | hard   |
| `POST /rag` (V1.5)                            | `kb_rag:<callerId>`                                                | 60 admin / 600 internal | 1 h    | hard   |
| `POST /embed` (V1.5)                          | `kb_embed:full` / `kb_embed:partial`                               | 1 / 100                 | 24 h   | hard   |
| `saveDraft` (action)                          | _pas de rate limit, log throttled à 1/5min/entry/user_             | —                       | —      | —      |
| `bulkImport` / `bulkExport`                   | _pas de rate limit additionnel, déjà gated par BullMQ concurrency_ | —                       | —      | —      |
| `uploadAsset`                                 | `kb_upload:<adminUserId>`                                          | 60                      | 5 min  | soft   |
| Toutes mutations admin (créer/update/publish) | `kb_admin_mutate:<adminUserId>`                                    | 600                     | 60 s   | soft   |

**Convention** : `hard` = retourne `{ok:false, error:"rate-limit"}` ou HTTP 429. `soft` = log Sentry alert mais laisse passer (fail-open est l'attitude du helper `checkRateLimit` actuel quand Redis down ; pour `soft` on étend volontairement).

**Anti-pattern à éviter** :

- pas de rate limit sur `feedbackVote` → bot flood des compteurs.
- rate limit sur `saveDraft` → autosave casse l'UX.
- rate limit identique public/admin → admin bloqué par son propre bot d'import.

---

## 6. HELPERS MUTUALISÉS (DRY)

### 6.1 `_guards.ts`

```ts
// src/server/actions/knowledge/_guards.ts
import { auth } from "@/auth";

export type KbRole = "super_admin" | "admin" | "editor" | "reviewer" | "reader";

export async function requireKbRole(allowed: KbRole[]): Promise<{ userId: string; role: KbRole }>;

export async function requireKbReviewerOnAssigned(
  entryId: string,
): Promise<{ userId: string; role: KbRole }>;

export async function requireKbOwnerOrAdmin(
  entryId: string,
): Promise<{ userId: string; role: KbRole }>;

/** Pour les endpoints publics avec session optionnelle */
export async function getKbVisibilityContext(): Promise<{
  userId: string | null;
  role: KbRole | "anonymous" | "client";
  allowedAudiences: ("public" | "client" | "team")[];
}>;
```

→ remplace les `requireAdminRead` / `requireAdminWrite` dupliqués dans le legacy.

### 6.2 `_audit.ts`

```ts
// src/server/actions/knowledge/_audit.ts
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";

export type KbAuditEvent =
  | "kb.created"
  | "kb.updated"
  | "kb.draft-saved"
  | "kb.submitted-for-review"
  | "kb.published"
  | "kb.unpublished"
  | "kb.scheduled"
  | "kb.archived"
  | "kb.restored"
  | "kb.deleted"
  | "kb.relation.added"
  | "kb.relation.removed"
  | "kb.translation.added"
  | "kb.bulk.imported"
  | "kb.bulk.exported"
  | "kb.bulk.tagged"
  | "kb.bulk.archived"
  | "kb.version.rolledback"
  | "kb.reviewer.assigned"
  | "kb.asset.uploaded"
  | "kb.asset.deleted"
  | "kb.feedback.voted"
  | "kb.bookmark.toggled"
  | "kb.import.batch.rolledback"
  | "kb.rag.queried"
  | "kb.embed.triggered"
  | "kb.pdf.generated";

export async function logKbActivity(input: {
  adminUserId: string | null;
  action: KbAuditEvent;
  targetType:
    | "knowledge_entry"
    | "knowledge_asset"
    | "knowledge_relation"
    | "knowledge_import_batch"
    | "knowledge_version";
  targetId: string | null;
  changes?: Record<string, unknown>;
}): Promise<void>;
```

→ wrapper unique sur `prisma.activityLog.create`, force l'enum d'event (pas de string libre), capte IP automatiquement.

### 6.3 `_revalidate.ts`

```ts
// src/server/actions/knowledge/_revalidate.ts
import { revalidatePath, revalidateTag } from "next/cache";

export type KbRevalidateInput = {
  entryId: string;
  type: string;
  slugFr?: string;
  slugEn?: string;
  isPublished: boolean;
  isHubAffected?: boolean; // ex: featured/pinned changed
};

export function revalidateKbPaths(input: KbRevalidateInput): void;
```

→ centralise tous les `revalidatePath` (`/fr/ressources`, `/en/resources`, `/fr/ressources/[type]`, `/fr/ressources/[type]/[slug]`, admin) + tags (`kb:list`, `kb:type:<type>`, `kb:entry:<id>`, `kb:hub`).

### 6.4 `_embedding-queue.ts`

```ts
// src/server/actions/knowledge/_embedding-queue.ts (V1.5)
import { getQueue } from "@/server/queue/queues";

export function enqueueEmbeddingRegen(entryId: string): Promise<void>;
```

→ wrapper sur BullMQ. En V1, noop (queue pas encore consommée). En V1.5, push job.

---

## 7. SIDE-EFFECTS MATRIX (RÉFÉRENCE COMPACTE)

| Action              |  ActivityLog   |          revalidatePath           |       revalidateTag       |           IndexNow           | EmbedRegen (V1.5) |                  BullMQ side-job                  |
| ------------------- | :------------: | :-------------------------------: | :-----------------------: | :--------------------------: | :---------------: | :-----------------------------------------------: |
| createEntry         |       ✅       |               admin               |          kb:list          |              ❌              |        ❌         |                        ❌                         |
| updateEntry         |       ✅       |    admin + public si published    |     kb:entry, kb:type     |         si published         | ✅ si body changé |                        ❌                         |
| saveDraft           |  ⚠️ throttled  |                ❌                 |            ❌             |              ❌              |        ❌         |                        ❌                         |
| submitForReview     |       ✅       |               admin               |            ❌             |              ❌              |        ❌         |                  reviewer-email                   |
| publish             |       ✅       |     admin + public + sitemap      | kb:hub, kb:type, kb:entry |              ✅              |        ✅         | doctrine-snapshot si type=doctrine/commercial_doc |
| unpublish           |       ✅       |          admin + public           | kb:hub, kb:type, kb:entry |          ✅ removal          |        ❌         |                        ❌                         |
| schedulePublish     |       ✅       |               admin               |            ❌             |              ❌              |        ❌         |               kb-scheduled-publish                |
| archive             |       ✅       | admin + public si était published |          kb:list          | si était published (removal) |        ❌         |                        ❌                         |
| restore             |       ✅       |               admin               |          kb:list          |              ❌              |        ❌         |                        ❌                         |
| deleteEntry         |  ✅ meta-only  |          admin + public           |      kb:hub, kb:type      |          ✅ removal          |        ❌         |                     asset-gc                      |
| addRelation         |       ✅       |      public si lié à publié       |       kb:entry × 2        |              ❌              |        ❌         |                        ❌                         |
| removeRelation      |       ✅       |      public si lié à publié       |       kb:entry × 2        |              ❌              |        ❌         |                        ❌                         |
| addTranslation      |       ✅       |               admin               |          kb:list          |              ❌              |        ❌         |                        ❌                         |
| bulkImport          | ✅ + per-entry |               admin               |          kb:list          |              ❌              |        ❌         |                  kb-bulk-import                   |
| bulkExport          |       ✅       |                ❌                 |            ❌             |              ❌              |        ❌         |                  kb-bulk-export                   |
| bulkTag             |       ✅       |               admin               |   kb:list, kb:type × n    |              ❌              |        ❌         |                        ❌                         |
| bulkArchive         | ✅ + per-entry |          admin + public           |   kb:list, kb:type × n    |       ✅ batch removal       |        ❌         |                        ❌                         |
| rollbackVersion     |       ✅       |    admin + public si published    |         kb:entry          |         si published         |        ✅         |                        ❌                         |
| assignReviewer      |       ✅       |               admin               |            ❌             |              ❌              |        ❌         |                  reviewer-email                   |
| uploadAsset         |       ✅       |                ❌                 |            ❌             |              ❌              |        ❌         |                 kb-asset-process                  |
| deleteAsset         |       ✅       |                ❌                 |            ❌             |              ❌              |        ❌         |                     asset-gc                      |
| feedbackVote        |   ✅ (anon)    |                ❌                 |            ❌             |              ❌              |        ❌         |                        ❌                         |
| bookmarkToggle      |  ✅ (client)   |          /mes-ressources          |            ❌             |              ❌              |        ❌         |                        ❌                         |
| rollbackImportBatch |       ✅       |               admin               |          kb:list          |       ✅ batch removal       |        ❌         |                        ❌                         |

---

## 8. ANTI-PATTERNS IDENTIFIÉS (RAPPEL CONSOLIDÉ)

1. **Action sans Zod** : le legacy fait du `safeParse` correct, KB doit le maintenir ; aucune action ne lit `formData.get(...)` sans schéma.
2. **Mutation sans `ActivityLog`** : la transaction Prisma `$transaction` doit toujours inclure `activityLog.create`. Risque sinon : action invisible dans `/admin/activity-logs`.
3. **Oubli `revalidatePath` ET `revalidateTag`** : le legacy fait `revalidatePath` × N en clair (DRY-failed). KB centralise via `revalidateKbPaths`. Sinon les pages servies en cache CDN/Cloudflare restent obsolètes.
4. **Oubli IndexNow** : sur transitions publiques, omettre `pingIndexNow` = perte SEO instantanée (Bing/Yandex). Helper `pingIndexNow` est fire-and-forget, jamais await.
5. **Hard delete sans guard** : pas de hard delete sans `confirmSlug` + status `archived`.
6. **PII scan absent** : `publish` doit appeler `pii-redaction.ts` sur tous les `bodyText`. Bloquant. Sinon fuite RGPD.
7. **Optimistic concurrency manquant** : `updateEntry` doit vérifier `expectedVersion` (sinon écrasement silencieux par 2 éditeurs simultanés).
8. **Audit log lourd** : `changes` JSON ne doit jamais contenir le body complet (use diff key list). Sinon `activity_logs` explose en volume.
9. **Side-effects synchrones long** : embedding regen, PDF generation, image processing → **toujours** BullMQ (jamais await dans le path action).
10. **Public endpoint sans rate limit ni Turnstile** : `feedbackVote`, `POST /feedback`, `GET /search` public — tous les 3 requièrent rate limit Redis (et Turnstile pour `feedbackVote`).
11. **Audit log dupliqué** : feedback vote anonyme = `adminUserId=null` mais on log quand même (séparation des audits client/admin via `targetType`).
12. **God-file actions** (legacy) : à éviter délibérément pour KB.
13. **Stockage base64 dans Tiptap JSON** : asset library obligatoire (`uploadAsset` puis ref dans JSON).
14. **HMAC absent sur RAG/embed** : endpoint exposable sans auth → fuite contenu confidentiel.
15. **Throttle autosave côté serveur** : `saveDraft` lui-même non rate-limité, mais son audit log est throttlé (sinon `activity_logs` saturée).
16. **Slug history oublié sur unpublish-replace** : la perte des 301 historiques détruit le SEO.

---

## 9. STOP & ASK OUVERTS (8 décisions)

| #   | Décision                                                                                             | Recommandation                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Q1  | Étendre `AdminRole` enum avec `reviewer` ?                                                           | **Oui, étendre** (cohérent, peu coûteux)                                                                     |
| Q2  | Optimistic concurrency : `version: number` int OU `updatedAt: DateTime` ?                            | **`version: number`** (clean, robuste)                                                                       |
| Q3  | `bookmarkToggle` log dans `ActivityLog` (`adminUserId=null`) ou nouvelle table `ClientActivityLog` ? | **Réutiliser `ActivityLog` avec `targetType='knowledge_bookmark'`** (V1) ; séparer V1.5 si volume > 10K/mois |
| Q4  | `deleteEntry` requiert `confirmSlug` ; OK avec UX modale 2-clics + slug typed ?                      | **Oui** (cohérent doctrine 2-clics § ADR 0018)                                                               |
| Q5  | `addRelation` cycle detection : Prisma raw query OU CTE recursive OU app-side BFS ?                  | **CTE recursive Postgres** (perf O(N), max depth 6) — Sprint KB-8                                            |
| Q6  | `feedbackVote` exige `bookmarkToggle` requièrent Turnstile + IP hash. OK ?                           | **Oui** (cohérent contact form existant)                                                                     |
| Q7  | Action `publish` warning vs blocking pour `lastReviewedAt=null` ?                                    | **Warning V1, blocking V1.5** (UX progressif)                                                                |
| Q8  | Tracking de granularité dans `changes` JSON : keys-only OU full diff `jsondiffpatch` ?               | **Keys-only V1** (volume) ; `jsondiffpatch` exposé sur `KnowledgeVersion` (déjà stocké en clair)             |

---

## 10. RÉFÉRENCES CODE EXISTANT

- `src/features/admin-blog/actions.ts` (legacy god-file, 373 lignes, à ne **pas** reproduire pour KB).
- `src/features/admin-case-studies/actions.ts` (idem, 372 lignes).
- `src/features/contact/actions.ts` (pattern public + rate limit + Turnstile + Telegram + BullMQ — modèle pour `feedbackVote`).
- `src/lib/rate-limit.ts` (sliding window Redis sorted-set, fail-open).
- `src/lib/indexnow.ts` (helper centralisé, fire-and-forget, host validation).
- `src/lib/pii-redaction.ts` (à intégrer dans `publish.ts` blocant).
- `src/lib/legal-snapshot.ts` (pattern à réutiliser pour `KnowledgeDoctrineSnapshot` sur `commercial_doc`/`doctrine`).
- `prisma/schema.prisma` `model ActivityLog` lignes 1079-1096 (à utiliser tel quel).
- `prisma/schema.prisma` `enum AdminRole` lignes 243-248 (à étendre Q1).

---

**Fin Agent 4.** Spec API/Actions prête pour Phase B (lecture par Agents 8 Workflow, 9 RGPD, 11 Perf, 18 Tests).
