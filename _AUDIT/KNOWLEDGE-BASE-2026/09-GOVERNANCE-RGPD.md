# 09 — Gouvernance, RGPD, sécurité — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` § Agent 9
> Agent : 9 — Gouvernance, RGPD, sécurité (audit-only, parallèle)
> Date : 2026-05-13
> Statut : DRAFT (Phase A — AUDIT-ONLY, aucun code écrit, aucune migration appliquée)
> Référence : HEAD `main` (commit `95bba36`), reality check `00-REALITY-CHECK.md`
> Lignes prompt source : ~304-312

---

## 0. TL;DR

- **Posture** : Axion-IA a déjà tous les briques RGPD/sécurité pour porter la KB sans dette nouvelle. On **réutilise** `pii-redaction.ts` (ADR 0010), `legal-snapshot.ts` (Sprint X.17), `subprocessors.ts` (Sprint X.17), `retention-purge-worker.ts` (Sprint 24), `gdpr-export` self-service (Sprint 24/D2), `rate-limit.ts` (Sprint 15), CSP nonce (Sprint 24), `ActivityLog`, `AdminRole` enum (4 valeurs).
- **Aucun modèle RBAC dédié à créer** : on **mappe** la matrice KB (OWNER/EDITOR/REVIEWER/READER) sur les 4 `AdminRole` existants (`super_admin`/`admin`/`editor`/`reader`). Pas d'enum nouveau, pas de table « rôles KB » distincte — sinon dette inutile. Le rôle `REVIEWER` est obtenu via une **claim secondaire** stockée dans `AdminUser.metadata` JSONB (déjà existant) ou via un flag `Setting` (préférence) — décision Phase A (STOP & ASK §10).
- **Pré-publish PII scan** : extension du helper `pii-redaction.ts` avec un détecteur de **présence** (`detectPii(text)`) en plus des fonctions de **redaction** actuelles. Bloque l'action `publish.ts` si `confidentiality='public'` et match email/téléphone/RIB non whitelisté. Whitelist gérée en `Setting` (`kb_pii_whitelist`).
- **Retention** : extension du worker `retention-purge-worker.ts` existant avec un 5ᵉ bloc « knowledge » qui purge `KnowledgeEntry.expiresAt < now()` après préavis 14 j (email `reviewedByEmail` + Telegram redacté).
- **Sous-processeurs V1** : aucun nouveau processeur (FTS only). **V1.5** : si embeddings Anthropic activés → patch `src/content/subprocessors.ts` ajout entrée Anthropic + mise à jour `legal.ts` § Données / Sous-traitants + DPA Anthropic à signer (online dashboard).
- **Refus dur embeddings confidentiels** : test bloquant Vitest qui assert `embedEntry(entry)` throws si `entry.confidentiality IN ('confidential','secret')`. Indispensable pour audit RGPD V1.5.
- **Export full-KB JSON** : route admin neuve `/api/internal/kb/export-full` (OWNER seulement, rate-limit 1/jour via `checkRateLimit`), masquage PII selon `confidentiality`, sortie `JSON.gz` signée HMAC.
- **Sécurité Tiptap SSR** : whitelist nodes/marks via `@tiptap/html` server-side + sanitization explicite. **Jamais** `dangerouslySetInnerHTML` brut sur `bodyHtml` venant de la DB.
- **CSP iframes embeds** : extension `frame-src` whitelist YouTube + Vimeo + Loom V1 ; tout autre embed rejeté avec fallback lien.
- **Rate limit** : `kb_helpful` 1/IP/entry/24 h, FTS public 60/IP/min, bulk import admin 5/min, RAG HMAC V1.5.
- **SSRF** : whitelist stricte domaines embeds + bloque resolution IP privée RFC 1918 / link-local côté server actions « hydrate embed metadata ».

---

## 1. MATRICE RBAC KB — 4 rôles × 25 actions

### 1.1 Rôles KB (cible) et mapping `AdminRole` actuel

Le code actuel (`schema.prisma` lignes 243-248) définit :

```prisma
enum AdminRole {
  super_admin
  admin
  editor   // = editeur (FR doctrine §14)
  reader   // = lecteur (FR doctrine §14)
}
```

**Mapping cible KB** :

| Rôle KB cible | `AdminRole` actuel                                                             | Justification                                                                                           |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **OWNER**     | `super_admin`                                                                  | Action destructives (`delete`, `import bulk`, `export-full`, `manageReviewer`). 1 à 3 individus max.    |
| **EDITOR**    | `admin` + `editor`                                                             | CRUD + draft + submit. `admin` est super-éditeur (peut bypass review), `editor` est rédacteur standard. |
| **REVIEWER**  | `admin` (par défaut) + claim `kbReviewer=true` dans `AdminUser.metadata` JSONB | Peut review/approve mais pas publier directement (sauf si aussi EDITOR). Voir §1.5.                     |
| **READER**    | `reader`                                                                       | Read-only sur admin (`/connaissances/*` route guard read-only).                                         |

**Décision Phase A — recommandation forte** : pas de nouvel enum `KbRole`, pas de table de jointure « rôles KB ». La granularité « REVIEWER » se modélise via un flag `metadata.kbReviewer = true` (booléen) sur `AdminUser`, lisible par tous les server actions via un helper unique `isKbReviewer(user)`. Évolution V1.5 : si besoin de granularité par `domain`, on ajoute `metadata.kbReviewerDomains = ['ia-strategy', 'data-eng']`.

### 1.2 Matrice des actions × rôles

Notation :

- ✅ : autorisé
- ❌ : interdit (server action throw `ForbiddenError`)
- 🟡 : conditionnel (voir notes)
- 🔒 : action audit-loggée systématiquement dans `ActivityLog`

| Action                                                     | OWNER (super_admin)       | EDITOR (admin / editor)                       | REVIEWER (admin + claim)                        | READER (reader) |
| ---------------------------------------------------------- | ------------------------- | --------------------------------------------- | ----------------------------------------------- | --------------- |
| `kb.entry.list`                                            | ✅ 🔒                     | ✅ 🔒                                         | ✅ 🔒                                           | ✅ 🔒           |
| `kb.entry.read` (admin draft+published)                    | ✅ 🔒                     | ✅ 🔒                                         | ✅ 🔒                                           | ✅ 🔒           |
| `kb.entry.read.confidential`                               | ✅ 🔒                     | 🟡 si `entry.assignedAuthorId === user.id` 🔒 | 🟡 si `entry.assignedReviewerId === user.id` 🔒 | ❌              |
| `kb.entry.create` (status=draft)                           | ✅ 🔒                     | ✅ 🔒                                         | ❌                                              | ❌              |
| `kb.entry.update.draft`                                    | ✅ 🔒                     | ✅ 🔒 (si auteur OR `admin`)                  | ❌                                              | ❌              |
| `kb.entry.submit` (draft→review)                           | ✅ 🔒                     | ✅ 🔒                                         | ❌                                              | ❌              |
| `kb.entry.review` (annotate, assign)                       | ✅ 🔒                     | 🟡 si `admin` (pas `editor`) 🔒               | ✅ 🔒                                           | ❌              |
| `kb.entry.approve` (review→approved)                       | ✅ 🔒                     | 🟡 si `admin` 🔒                              | ✅ 🔒                                           | ❌              |
| `kb.entry.publish` (approved→published)                    | ✅ 🔒                     | 🟡 si `admin` 🔒                              | ❌                                              | ❌              |
| `kb.entry.unpublish`                                       | ✅ 🔒                     | 🟡 si `admin` 🔒                              | ❌                                              | ❌              |
| `kb.entry.schedule` (published à T+N)                      | ✅ 🔒                     | 🟡 si `admin` 🔒                              | ❌                                              | ❌              |
| `kb.entry.archive`                                         | ✅ 🔒                     | ✅ 🔒 (si auteur OR `admin`)                  | ❌                                              | ❌              |
| `kb.entry.delete` (soft)                                   | ✅ 🔒                     | ❌                                            | ❌                                              | ❌              |
| `kb.entry.delete.hard` (purge réelle)                      | ✅ 🔒 (confirmation MFA)  | ❌                                            | ❌                                              | ❌              |
| `kb.entry.rollback` (à version N)                          | ✅ 🔒                     | ✅ 🔒 (si auteur OR `admin`)                  | ❌                                              | ❌              |
| `kb.entry.relation.add`                                    | ✅ 🔒                     | ✅ 🔒                                         | ❌                                              | ❌              |
| `kb.entry.relation.remove`                                 | ✅ 🔒                     | ✅ 🔒                                         | ❌                                              | ❌              |
| `kb.entry.tag.add`                                         | ✅ 🔒                     | ✅ 🔒                                         | ❌                                              | ❌              |
| `kb.entry.tag.remove`                                      | ✅ 🔒                     | ✅ 🔒                                         | ❌                                              | ❌              |
| `kb.tag.manage` (créer/renommer/fusionner tags)            | ✅ 🔒                     | 🟡 si `admin` (pas `editor`) 🔒               | ❌                                              | ❌              |
| `kb.reviewer.manage` (toggle `metadata.kbReviewer`)        | ✅ 🔒                     | ❌                                            | ❌                                              | ❌              |
| `kb.asset.upload`                                          | ✅ 🔒                     | ✅ 🔒                                         | ❌                                              | ❌              |
| `kb.asset.delete` (soft)                                   | ✅ 🔒                     | ✅ 🔒 (si uploader)                           | ❌                                              | ❌              |
| `kb.asset.delete.hard`                                     | ✅ 🔒 (MFA)               | ❌                                            | ❌                                              | ❌              |
| `kb.import.bulk` (markdown/Notion)                         | ✅ 🔒                     | ❌                                            | ❌                                              | ❌              |
| `kb.export.full` (`/api/internal/kb/export-full`)          | ✅ 🔒 (rate-limit 1/jour) | ❌                                            | ❌                                              | ❌              |
| `kb.export.entry` (1 entrée, masquage PII)                 | ✅ 🔒                     | ✅ 🔒                                         | ✅ 🔒                                           | ✅ 🔒           |
| `kb.setting.update` (seuils quality, retention, whitelist) | ✅ 🔒                     | ❌                                            | ❌                                              | ❌              |

### 1.3 Helpers proposés (audit-only, à implémenter Sprint KB-19)

```ts
// src/lib/knowledge/rbac.ts (cible)
export function isKbOwner(u: AdminUser): boolean {
  return u.role === "super_admin";
}
export function isKbEditor(u: AdminUser): boolean {
  return u.role === "super_admin" || u.role === "admin" || u.role === "editor";
}
export function isKbReviewer(u: AdminUser): boolean {
  if (u.role === "super_admin") return true;
  if (u.role === "admin") return Boolean((u.metadata as Record<string, unknown>)?.kbReviewer);
  return false;
}
export function isKbReader(u: AdminUser): boolean {
  return ["super_admin", "admin", "editor", "reader"].includes(u.role);
}

// Variantes "strictes" : `editor` ne peut pas review (sauf si claim explicite)
export function canPublishKb(u: AdminUser): boolean {
  return u.role === "super_admin" || u.role === "admin";
}
```

### 1.4 Route guard `/connaissances/*`

- Middleware admin existant (`(admin)/[adminPrefix]/layout.tsx`) déjà guard `AdminRole IN ('super_admin','admin','editor','reader')`.
- Sprint KB-19 ajoute filtrage **par action** dans chaque server action `src/server/actions/knowledge/*.ts` (helper `requireKbRole(user, 'editor' | 'reviewer' | 'owner')`).
- Page `/connaissances/medias/[id]/delete` exige MFA-step-up (réutilise pattern Sprint 24 si existant — sinon décision Phase A).

### 1.5 Claim REVIEWER — modélisation

**Option A (recommandée Phase A)** : `AdminUser.metadata` JSONB existe ; on stocke `{ kbReviewer: true, kbReviewerDomains?: [...] }`. Migration KB-1 ne touche pas `admin_users`.

**Option B** : table `KbReviewerAssignment { adminUserId, domain }` M2M. Plus propre relationnellement, mais alourdit KB-1.

**Décision Phase A** : Option A pour V1 (zero-friction), Option B en V1.5 si granularité domain devient critique.

---

## 2. PRE-PUBLISH PII SCAN — intégration dans `publish.ts`

### 2.1 Constat — `pii-redaction.ts` actuel

Le helper actuel (`src/lib/pii-redaction.ts`) expose :

- `redactEmail`, `redactName`, `redactPhone`, `redactContactLine`

→ **Ces fonctions FORMATENT** un PII connu, elles ne **DÉTECTENT pas** un PII dans du texte libre. Pour la KB, on a besoin du sens inverse : « scanner `bodyText` pour repérer un email/téléphone/RIB **avant** publication ».

### 2.2 Extension cible — `detectPii(text)` (Sprint KB-19)

```ts
// Extension de src/lib/pii-redaction.ts (audit-only, à implémenter Sprint KB-19)
export interface PiiMatch {
  kind: "email" | "phone" | "iban" | "rib" | "creditCard";
  value: string; // masqué (ex: "j****@acme.com")
  offset: number; // position dans le texte (pour highlight admin UI)
}
export function detectPii(text: string, whitelist?: ReadonlyArray<string>): ReadonlyArray<PiiMatch>;
```

Patterns proposés (ECMA, ancrés `\b`) :

- **Email** : `\b[\w.+-]+@[a-z0-9-]+\.[a-z]{2,}\b` (lowercased à la détection).
- **Téléphone FR** : `\b(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}\b` + variantes UE (DE `\+49`, ES `\+34`).
- **IBAN** : `\b[A-Z]{2}\d{2}(?:\s?\w{4}){2,7}\b` + checksum mod 97 (validation).
- **RIB FR** : `\b\d{5}\s?\d{5}\s?\d{11}\s?\d{2}\b`.
- **CB** : `\b(?:\d[ -]*?){13,19}\b` + Luhn check (anti faux positifs).

### 2.3 Intégration dans `publish.ts` server action (Sprint KB-19)

Pseudo-code (audit-only) :

```ts
// src/server/actions/knowledge/publish.ts (cible)
export async function publishKbEntryAction(input: PublishKbEntryInput) {
  const user = await requireAdminAuth();
  if (!canPublishKb(user)) throw new ForbiddenError("kb.publish");

  const entry = await prisma.knowledgeEntry.findUniqueOrThrow({
    where: { id: input.id },
    include: { translations: true },
  });
  if (entry.status !== "approved") throw new ValidationError("kb.publish.invalid_status");

  // PII scan bloquant
  if (entry.audience === "public" || entry.audience === "client") {
    const whitelist = await getKbPiiWhitelist();
    for (const t of entry.translations) {
      const piiInBody = detectPii(t.bodyText ?? "", whitelist);
      const piiInTitle = detectPii(t.title, whitelist);
      const piiInExcerpt = detectPii(t.excerpt ?? "", whitelist);
      const all = [...piiInBody, ...piiInTitle, ...piiInExcerpt];
      if (all.length > 0) {
        await logActivity(user, "kb.publish.blocked.pii", entry.id, {
          locale: t.locale,
          matches: all,
        });
        throw new ValidationError("kb.publish.pii_detected", { matches: all });
      }
    }
  }
  // (Quality score, alt-text check, etc. — voir Agent 12 et 14)
  // ...
  // OK → status='published', publishedAt=now, revalidatePath(...)
}
```

### 2.4 Whitelist PII — gestion

- Stockée dans `Setting` (KV existant) clé `kb_pii_whitelist` :
  ```json
  {
    "emails": ["contact@axion-ia.com", "presse@axion-ia.com"],
    "phones": ["+33123456789"],
    "ibans": [],
    "freeFormHints": ["dpo@axion-ia.com"]
  }
  ```
- Modifiable uniquement par OWNER via `/connaissances/parametres` (Sprint KB-13).
- Tests : Vitest `detectPii.test.ts` (~15 cases : positifs + faux positifs + whitelist applied + locale UE).

### 2.5 Anti-faux-positifs

- N° de téléphone dans un cas client anonymisé : « cf. cas client +33 \*\* \*\* \*\* XX YY » → pattern `\*\*` exclu (voir helper `redactPhone` qui produit déjà ces patterns).
- Email d'exemple générique `john@example.com` : whitelist `example.com` + `example.org` par défaut (TLD réservé RFC 6761).
- Limit : si > 50 matches, on plafonne (anti DoS via texte gigantesque malicieux).

### 2.6 Cohérence avec ADR 0010

ADR 0010 (mémoire `axionia_session_2026-05-09_sprint_24_1`) statue que **PII personnel direct ne doit pas être diffusé** vers sous-processeurs hors UE (Telegram) sans minimisation. Pour la KB, on étend la doctrine : **PII direct ne doit pas être diffusé en PUBLIC** sauf whitelist explicite (les emails de contact officiels sont OK).

---

## 3. RETENTION — champ `expiresAt` + cron extension

### 3.1 Champ `expiresAt` sur `KnowledgeEntry`

Modèle Prisma cible (Agent 1 spec ; rappel Phase A) :

```prisma
model KnowledgeEntry {
  // ...
  expiresAt          DateTime?  // RGPD — date au-delà de laquelle l'entrée est purgée
  expiresPreNoticeAt DateTime?  // Set automatiquement à expiresAt - 14 jours
  retentionPolicy    String?    // ex: "external-rgpd-12mo", "legacy-2024", "manual"
  // ...
  @@index([expiresAt])
}
```

### 3.2 Politiques de rétention par `type` (proposition Phase A — STOP & ASK §10)

| `type`                                                                  | Rétention recommandée                   | Justification                                       |
| ----------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| `article` (blog)                                                        | **Pas d'expiration auto**               | Contenu evergreen ; archive volontaire si obsolète. |
| `case_study`                                                            | **Pas d'expiration auto**               | Témoignage permanent (avec consent client durable). |
| `case_study` (anonyme, données client identifiables même indirectement) | 24 mois post-publication                | Aligné `RETENTION_SUBS_ARCHIVE_MONTHS` actuel.      |
| `faq`                                                                   | **Pas d'expiration auto**               | —                                                   |
| `help_article`                                                          | **Pas d'expiration auto**               | —                                                   |
| `glossary_term`                                                         | **Pas d'expiration auto**               | —                                                   |
| `guide`                                                                 | **Pas d'expiration auto**               | —                                                   |
| `doctrine` (interne admin/team)                                         | 36 mois                                 | Doctrine historique conservée 3 ans.                |
| `commercial_doc` (offres archivées, devis types périmés)                | 12 mois après `expiresAt` manuel        | Manuel : Will fixe la date.                         |
| `comparatif`                                                            | 18 mois (review obligatoire ou archive) | Compétitivité change vite.                          |

**Décision Phase A** : V1 = pas de défaut auto (toutes les entrées sont `expiresAt = null`), Will set manuellement. V1.5 = défaut par type via `Setting.kb_retention_defaults`.

### 3.3 Cron — extension `retention-purge-worker.ts`

Le worker existant (`src/server/queue/workers/retention-purge-worker.ts`, cron 03:00 UTC) gère déjà : activity_logs / submissions archived / newsletter unsub / bookings cancelled.

**Extension Sprint KB-19** : ajout d'un **5ᵉ bloc** dans le même worker (pas de nouveau worker — pattern minimaliste) :

```ts
// Pseudo-code à ajouter dans retention-purge-worker.ts
// 5) knowledge entries expirées
const expired = await prisma.knowledgeEntry.findMany({
  where: { expiresAt: { lt: new Date() }, status: { in: ["published", "archived"] } },
  select: { id: true, slug: true, type: true, assignedAuthorId: true, retentionPolicy: true },
});
for (const e of expired) {
  await prisma.$transaction(async (tx) => {
    // Soft delete (status='archived' + delete from public) puis hard delete après grace 30j
    // En V1, on archive + log. Hard delete = ADR ouverte (cf. STOP & ASK §10).
    await tx.knowledgeEntry.update({ where: { id: e.id }, data: { status: "archived" } });
    await tx.activityLog.create({
      data: {
        adminUserId: null,
        action: "kb.entry.expired.archived",
        targetType: "knowledge_entry",
        targetId: e.id,
        changes: { slug: e.slug, type: e.type, policy: e.retentionPolicy ?? "manual" },
      },
    });
  });
  counts.knowledgeEntries++;
}
```

### 3.4 Préavis 14 j

Cron quotidien dédié (séparé du purge job — pas de couplage) :

- **Job BullMQ** `kb-retention-prenotice` (cron 09:00 UTC, daily) :
  - Sélectionne `KnowledgeEntry` où `expiresAt BETWEEN now+13d AND now+14d` ET `expiresPreNoticeAt IS NULL`.
  - Envoie email à `assignedAuthorId.email` + `assignedReviewerId.email` (si distincts) via Mailwizz/PowerMTA self-hosted (mémoire `axionia_session_2026-05-13_seo_email_stack`).
  - Telegram redacté via `redactContactLine` (réutilise pattern ADR 0010).
  - Set `expiresPreNoticeAt = now()`.
  - Log `kb.entry.expiration.notified`.

### 3.5 Tests d'acceptation Sprint KB-19

- `retention-knowledge.test.ts` (5 cases) :
  1. Entry `expiresAt < now` archivée + log créé.
  2. Entry `expiresAt > now` non touchée.
  3. Entry sans `expiresAt` (null) jamais touchée (régression).
  4. Entry `status='draft'` jamais touchée (seul `published`/`archived` éligibles).
  5. Préavis 14j envoyé une seule fois (`expiresPreNoticeAt` empêche double-envoi).

---

## 4. SOUS-PROCESSEURS — embeddings V1.5

### 4.1 État V1 (FTS-only)

**Aucun nouveau sous-processeur**. La KB V1 utilise uniquement :

- Postgres (Hetzner DE) — déjà listé.
- Redis (Hetzner DE) — déjà listé.
- Cloudflare CDN — déjà listé.

→ **`src/content/subprocessors.ts` et `src/content/legal.ts` NE SONT PAS modifiés en V1**. RAS pour Sprint KB-1 à KB-20.

### 4.2 État V1.5 (embeddings activés — Sprint KB-21)

Si Will choisit l'option Anthropic (Voyage AI ou modèle Anthropic-hosted) pour les embeddings RAG :

**Patch obligatoire** :

1. **`src/content/subprocessors.ts`** : ajouter une 8ᵉ entrée :

```ts
{
  name: "Anthropic PBC",
  location: "San Francisco, USA",
  serversLocation: "USA + UE (option configurée si EU residency activée)",
  purposeFr:
    "Génération d'embeddings vectoriels pour la recherche sémantique de la base de connaissance (texte uniquement, jamais de PII). Refus dur d'envoi pour entrées 'confidential' ou 'secret'.",
  purposeEn:
    "Vector embedding generation for semantic search of the knowledge base (text only, no PII). Hard refusal for 'confidential' or 'secret' entries.",
  dataCategoriesFr:
    "Titre, excerpt, body text plain des entrées 'public' ou 'client' uniquement. Aucune donnée personnelle directe. Aucun contenu 'confidential' ou 'secret'.",
  dataCategoriesEn:
    "Title, excerpt, plain body text of 'public' or 'client' entries only. No direct PII. No 'confidential' or 'secret' content.",
  legalBasis: "6.1.f_legitimate_interest",
  dpaStatus: "auto_signable_dashboard",
  transferFramework: "scc",
  documentationUrl: "https://www.anthropic.com/legal/dpa",
}
```

2. **`src/content/legal.ts` — `politique-confidentialite`** : section « Sous-traitants » à mettre à jour avec mention Anthropic + finalité « génération d'embeddings pour recherche sémantique de la base de connaissance ». **Mention obligatoire RGPD art. 13** car nouveau destinataire.

3. **DPA Anthropic** : à signer via dashboard Anthropic (`auto_signable_dashboard`). Action humaine Will, hors Phase A. Référence : pattern Cloudflare/Stripe/Sentry déjà signés.

4. **Cookie banner / Page « Préférences cookies »** : pas d'impact (l'embedding est serveur-to-serveur, pas client-to-Anthropic). Pas de tracking utilisateur.

### 4.3 Alternative — embeddings self-hosted (option ouverte)

Si Will refuse Anthropic comme sous-processeur :

- Option 1 : `all-MiniLM-L6-v2` (Sentence-Transformers, MIT) self-hosted via worker Python sidecar. Coût RAM ~500 MB. Latence p95 ~ 50 ms/embedding.
- Option 2 : `bge-small-en-v1.5` (BAAI, MIT) self-hosted. Idem.
- Aucun sous-processeur ajouté. `subprocessors.ts` inchangé.

**Décision Phase A — STOP & ASK §10** : provider embeddings final + impact infra (RAM CPX32 8 GB est tendu si Postgres + Redis + Next + worker Python coexistent — risque OOM).

### 4.4 Refus dur `confidentiality` — test bloquant

```ts
// tests/server/knowledge/embed-refusal.test.ts (V1.5, audit-only)
describe("embedEntry — confidentiality refusal", () => {
  it("throws if confidentiality='confidential'", async () => {
    const entry = makeEntry({ confidentiality: "confidential" });
    await expect(embedEntry(entry)).rejects.toThrow("kb.embed.confidentiality_refusal");
  });
  it("throws if confidentiality='secret'", async () => {
    const entry = makeEntry({ confidentiality: "secret" });
    await expect(embedEntry(entry)).rejects.toThrow("kb.embed.confidentiality_refusal");
  });
  it("accepts confidentiality='public'", async () => {
    const entry = makeEntry({ confidentiality: "public" });
    await expect(embedEntry(entry)).resolves.toMatchObject({ vector: expect.any(Array) });
  });
  it("accepts confidentiality='internal'", async () => {
    const entry = makeEntry({ confidentiality: "internal" });
    await expect(embedEntry(entry)).resolves.toMatchObject({ vector: expect.any(Array) });
  });
});
```

Pseudo-code helper :

```ts
// src/server/knowledge/embed.ts (V1.5, audit-only)
const REFUSED_CONFIDENTIALITY = new Set(["confidential", "secret"]);
export async function embedEntry(entry: KnowledgeEntry): Promise<{ vector: number[] }> {
  if (REFUSED_CONFIDENTIALITY.has(entry.confidentiality)) {
    throw new Error("kb.embed.confidentiality_refusal");
  }
  const piiInBody = detectPii(entry.bodyText ?? "");
  if (piiInBody.length > 0) {
    throw new Error("kb.embed.pii_detected");
  }
  return callEmbeddingProvider(entry.title, entry.excerpt, entry.bodyText);
}
```

---

## 5. AUDIT RGPD CONSULTATIONS

### 5.1 Pattern de tracking — V1

**Public anonyme** (`/ressources/[type]/[slug]`) :

- **AUCUN tracking individuel** sans consentement Cookie banner.
- Plausible CE (mémoire `axionia_plausible_ce_deploy_2026-05-13`) compte vues page **agrégées, sans cookie**, IP anonymisée. OK par défaut RGPD (legitimate interest).
- Goal Plausible `kb_view` à ajouter (cible Sprint KB-20, Agent 18).
- Aucune écriture en DB par vue (anti-DoS + RGPD min).

**Client connecté** (`/mes-ressources` — Agent 7) :

- Tracking individuel `kb.view.client` dans `ActivityLog` (réutilise table existante, action `kb.view.client`, target = `entry.id`, adminUserId = null, changes = `{ clientUserId }`).
- Base légale : 6.1.b (exécution du contrat — contenu personnalisé post-booking).
- Mention Politique de confidentialité : « Vos consultations de ressources personnalisées sont enregistrées pour vous proposer un parcours pédagogique adapté. Vous pouvez vous y opposer via votre espace `/mes-donnees`. »

**Lecture entrée `confidentiality='confidential'` par admin** :

- **TOUJOURS** loggée dans `ActivityLog` (action `kb.entry.read.confidential`, targetId = `entry.id`, adminUserId = `user.id`, changes = `{ ip: req.headers['x-forwarded-for'] }`).
- Pattern aligné sur `gdpr-export` qui log déjà l'IP (cf. `route.ts` ligne 112).
- Audit trail RGPD art. 30 (registre des activités de traitement).

### 5.2 Vue admin — « qui a lu quoi »

- Route admin `/connaissances/audit-log?filter=kb.entry.read.confidential` (filtre sur `ActivityLog` existant).
- Pas de nouvelle table. Économie de schéma.

### 5.3 Compteur de vues agrégé (anonyme)

- Champ `KnowledgeEntry.viewCount` (entier dénormalisé) incrémenté en batch (job BullMQ `kb-view-counter`, traite les events Plausible 1×/heure).
- Pas d'écriture DB synchrone côté request (perf + min logs).
- Anti-pattern explicite : **ne PAS** logguer chaque vue anonyme dans `ActivityLog` (volume × bruit + RGPD : pas nécessaire si pas de consentement individuel).

---

## 6. EXPORT GDPR FULL-KB JSON — `/api/internal/kb/export-full`

### 6.1 Spec route (Sprint KB-19, audit-only)

```
POST /api/internal/kb/export-full
Auth   : session admin OWNER (super_admin) seulement
Rate   : 1/jour (key `kb:export-full:${user.id}`)
Body   : { confidentialityCeiling?: "public" | "client" | "internal" | "confidential" | "secret" }
Output : application/gzip
         JSON.gz signé HMAC-SHA256 (header `X-Signature` + checksum)
Headers réponse :
  Content-Disposition: attachment; filename="axionia-kb-full-${ISO_DATE}.json.gz"
  X-Signature: hmac-sha256:${base64}
  X-Export-Captured-At: ${ISO_DATETIME}
  X-Confidentiality-Ceiling: ${value}
```

### 6.2 Masquage PII selon `confidentiality`

- `confidentialityCeiling` détermine quelles entrées sont incluses **et** quelles champs PII sont émis :

| Demande           | Inclut entrées                               | Champs PII (auteur reviewer assigné)   | Body                |
| ----------------- | -------------------------------------------- | -------------------------------------- | ------------------- |
| `public` (défaut) | `audience='public'` AND `status='published'` | Auteurs : `redactName` + `redactEmail` | Plain (déjà public) |
| `client`          | `audience IN ('public','client')`            | Idem                                   | Plain               |
| `internal`        | + `audience='team'` non confidential         | Auteurs : nom complet + email business | Plain               |
| `confidential`    | + `confidentiality='confidential'`           | Idem                                   | Plain               |
| `secret`          | tout                                         | nom complet + email                    | Plain               |

**Le `confidentialityCeiling` est lui-même audit-loggé** (`kb.export.full.requested`) avec le ceiling demandé. Si > `internal`, **alerte Telegram redactée** au DPO/Will (mémoire ADR 0010).

### 6.3 Pseudo-code route

```ts
// src/app/api/internal/kb/export-full/route.ts (cible Sprint KB-19, audit-only)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await requireAdminAuth();
  if (!isKbOwner(user)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const rl = await checkRateLimit(`kb:export-full:${user.id}`, { limit: 1, windowSec: 86_400 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const parsed = exportFullSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const ceiling = parsed.data.confidentialityCeiling ?? "public";

  await prisma.activityLog.create({
    data: {
      adminUserId: user.id,
      action: "kb.export.full.requested",
      targetType: "knowledge_base",
      targetId: "global",
      changes: { ceiling, requestedAt: new Date().toISOString() },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    },
  });

  if (ceiling === "confidential" || ceiling === "secret") {
    await notifyTelegramRedacted("kb.export.full.high_ceiling", {
      user: redactContactLine(user.name, user.email),
      ceiling,
    });
  }

  const entries = await fetchEntriesForCeiling(ceiling);
  const json = JSON.stringify({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    ceiling,
    entries,
  });
  const gz = await gzip(Buffer.from(json, "utf8"));
  const sig = hmacSha256(gz, process.env.KB_EXPORT_HMAC_SECRET!);

  return new NextResponse(gz, {
    status: 200,
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="axionia-kb-full-${new Date().toISOString().slice(0, 10)}.json.gz"`,
      "X-Signature": `hmac-sha256:${sig}`,
      "X-Export-Captured-At": new Date().toISOString(),
      "X-Confidentiality-Ceiling": ceiling,
    },
  });
}
```

### 6.4 Sécurité — variables env

- `KB_EXPORT_HMAC_SECRET` : secret 32 bytes random, généré via `openssl rand -hex 32`, stocké dans Coolify env (pattern `AUTH_SECRET` existant — mémoire `axionia_session_2026-05-08_first_deploy`).
- Documenté dans `.env.example`.
- Jamais loggué.

### 6.5 Tests Vitest + e2e

- Vitest : `export-full.test.ts` (8 cases) — RBAC denied (editor/reader/reviewer), rate-limit 2ᵉ requête du jour rejetée, payload structure, signature valide, ceiling filtering.
- E2E Playwright : login owner, click bouton « Export KB complet », vérifier download `.json.gz`, vérifier que `editor` voit bouton désactivé.

---

## 7. SÉCURITÉ CONTENU TIPTAP — sanitization SSR

### 7.1 Risque

- `KnowledgeEntryTranslation.bodyJson` (JSON Tiptap) et `bodyHtml` (HTML rendered) viennent de la DB.
- Si on rend `bodyHtml` via `dangerouslySetInnerHTML`, **une injection malveillante par un éditeur compromis** (ou un import depuis Notion non sanitisé) introduit XSS.

### 7.2 Doctrine Phase A

**Source canonique au runtime public = `bodyJson` (Tiptap JSON)**, jamais `bodyHtml`.

- Le rendu public déserialise `bodyJson` → composants React SSR via helper `renderTiptapToReact(json)`.
- Le helper **n'émet que des composants React typés** (jamais `dangerouslySetInnerHTML`).
- Whitelist nodes : `doc`, `paragraph`, `heading` (level 1-6), `bulletList`, `orderedList`, `listItem`, `blockquote`, `codeBlock`, `code` (inline), `hardBreak`, `horizontalRule`, `image` (avec `src` validée whitelist), `link` (avec `href` validée), `figure`, `figcaption`, `callout` (custom), `embed` (custom — voir §8).
- Whitelist marks : `bold`, `italic`, `strike`, `underline`, `code`, `link`, `superscript`, `subscript`.
- **Rejet silencieux** des nodes/marks non whitelistés (loggué côté serveur en `WARN`).

### 7.3 `@tiptap/html` server-side

- À ajouter en dépendance Sprint KB-12 : `pnpm add @tiptap/html @tiptap/core`.
- Utilisé pour :
  - **À l'écriture** : convertir `bodyJson` → `bodyHtml` sanitisé (re-derivation à chaque save, jamais éditeur-fourni).
  - **À la lecture** : helper `renderTiptapToReact(json)` (préféré).
- `bodyHtml` est conservé en colonne pour **fallback RSS / OG image / accessibilité** (ARIA descriptive), mais **jamais utilisé comme source pour le rendu HTML public**.

### 7.4 Validation URL `image.src` / `link.href`

```ts
// src/lib/knowledge/url-validator.ts (audit-only)
const ALLOWED_IMAGE_PROTOCOLS = new Set(["https:", "data:"]); // data: limité aux SVG inline AssetLibrary
const ALLOWED_IMAGE_DATA_MIME = /^data:image\/(svg\+xml|png|webp|avif|jpeg);base64,/;
const ALLOWED_LINK_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);
const BLOCKED_LINK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254"]); // SSRF

export function isAllowedImageSrc(src: string): boolean {
  if (src.startsWith("/")) return true; // path interne Next/Image
  try {
    const u = new URL(src);
    if (!ALLOWED_IMAGE_PROTOCOLS.has(u.protocol)) return false;
    if (u.protocol === "data:") return ALLOWED_IMAGE_DATA_MIME.test(src);
    return true; // https: OK
  } catch {
    return false;
  }
}
export function isAllowedLinkHref(href: string): boolean {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    const u = new URL(href);
    if (!ALLOWED_LINK_PROTOCOLS.has(u.protocol)) return false;
    if (BLOCKED_LINK_HOSTS.has(u.hostname.toLowerCase())) return false;
    return true;
  } catch {
    return false;
  }
}
```

### 7.5 Tests

- `url-validator.test.ts` (~20 cases) : data: SVG OK, javascript: KO, file: KO, vbscript: KO, localhost KO, RFC 1918 KO (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), link-local KO (169.254.0.0/16), valid https OK.
- `renderTiptapToReact.test.ts` (~10 cases) : node non whitelist absent du DOM, mark non whitelist stripped, link `javascript:` retiré, image `file://` retiré.

---

## 8. CSP — extension iframes embeds

### 8.1 État actuel CSP

CSP nonce-based existant (`src/lib/csp.ts`, mémoire `axionia_session_2026-05-09_sprint_24`). Directives actuelles couvrent : `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `frame-ancestors 'none'` (anti-clickjacking).

### 8.2 Extension KB — `frame-src` whitelist

Pour Sprint KB-3 (éditeur) + KB-6 (public surface), ajouter directive `frame-src` :

```
frame-src 'self'
  https://www.youtube-nocookie.com    ; <-- YouTube no-cookie (RGPD friendly)
  https://www.youtube.com             ; <-- Fallback (mais on prefere nocookie)
  https://player.vimeo.com
  https://www.loom.com
  https://challenges.cloudflare.com   ; <-- Turnstile (existe déjà)
;
```

**Refus V1** : Twitter/X embed, Instagram embed, TikTok embed (frame-src non whitelistée → bloqués). Décision Phase A — STOP & ASK §10 : Will tranche si on étend V1 ou V2+.

### 8.3 Node `embed` custom Tiptap

```ts
// Schéma cible (audit-only) — src/components/admin/tiptap-extensions/embed.ts
const ALLOWED_EMBED_HOSTS: ReadonlyArray<{
  host: string;
  type: "youtube" | "vimeo" | "loom";
  pattern: RegExp;
  iframeUrl: (id: string) => string;
}> = [
  {
    host: "youtube.com",
    type: "youtube",
    pattern: /^(?:https:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/,
    iframeUrl: (id) => `https://www.youtube-nocookie.com/embed/${id}`,
  },
  {
    host: "youtu.be",
    type: "youtube",
    pattern: /^(?:https:\/\/)?youtu\.be\/([\w-]{11})/,
    iframeUrl: (id) => `https://www.youtube-nocookie.com/embed/${id}`,
  },
  {
    host: "vimeo.com",
    type: "vimeo",
    pattern: /^(?:https:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
    iframeUrl: (id) => `https://player.vimeo.com/video/${id}`,
  },
  {
    host: "loom.com",
    type: "loom",
    pattern: /^(?:https:\/\/)?(?:www\.)?loom\.com\/share\/([\w-]+)/,
    iframeUrl: (id) => `https://www.loom.com/embed/${id}`,
  },
];
```

- À l'insertion (admin Tiptap) : helper `parseEmbedUrl(input)` returns `{ type, id, iframeUrl } | null` selon whitelist.
- Si retour `null` → erreur user-facing « URL non supportée. Embeds autorisés : YouTube, Vimeo, Loom. »
- Au rendu (public SSR) : `<iframe src={iframeUrl} title="..." loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation">`.
- **Pas de `allow-popups`**, **pas de `allow-top-navigation`**, **pas de `allow-forms`** (lockdown sandbox).

### 8.4 Cookies tiers

- YouTube `youtube-nocookie.com` est la **règle** (RGPD friendly, pas de cookie pré-clic).
- Vimeo : par défaut pas de cookie strictement nécessaire (lecteur).
- Loom : pas de cookie tiers pour lecteur public.
- Cookie banner : si Will refuse YT/Vimeo/Loom sans consent → wrapping « Cliquer pour charger » (pattern « consent gate ») V1.5. **V1 = no-cookie + lazy = OK sans consent** (legitimate interest, IP min, fingerprinting bloqué par no-cookie).

### 8.5 Tests

- `parseEmbedUrl.test.ts` (~15 cases) : YT happy + variantes URL + youtu.be + invalides (TikTok, Twitter, file://, javascript:).
- E2E Playwright : entry avec YT embed visible et iframe loaded post-LCP (vérifie lazy).

---

## 9. RATE LIMITING — endpoints publics et admin

Réutilise `src/lib/rate-limit.ts` (Redis sliding window, déjà éprouvé).

### 9.1 Tableau récap

| Endpoint                                    | Key pattern                   | Limit | Window          | Justification                                  |
| ------------------------------------------- | ----------------------------- | ----- | --------------- | ---------------------------------------------- |
| `POST /api/kb/[id]/helpful` (👍/👎)         | `kb:helpful:${ip}:${entryId}` | 1     | 86_400 s (24 h) | Anti-spam vote ; pattern Hotjar/Reddit         |
| `GET /api/kb/search?q=...` (FTS public)     | `kb:search:${ip}`             | 60    | 60 s            | Anti-abuse FTS coûteux pgvector + autocomplete |
| `POST /api/internal/kb/import-bulk` (admin) | `kb:import:${userId}`         | 5     | 60 s            | Évite multi-clic accidentel batch lourd        |
| `POST /api/internal/kb/export-full` (OWNER) | `kb:export-full:${userId}`    | 1     | 86_400 s        | Cf. §6                                         |
| `GET /api/internal/kb/rag` (V1.5 HMAC)      | `kb:rag:${apiKeyId}`          | 100   | 60 s            | Cf. §9.2                                       |
| `POST /api/kb/[id]/comment` (V1.5 client)   | `kb:comment:${userId}`        | 5     | 600 s           | Anti-spam commentaire                          |

### 9.2 RAG endpoint V1.5 — HMAC + rate limit

```
POST /api/internal/kb/rag
Auth   : HMAC-SHA256 signature header `X-Signature: hmac-sha256:${base64}`
         + header `X-API-Key-Id` pour bind à un quota (multi-tenant possible V2)
Rate   : 100/min/api-key-id (sliding window Redis)
Body   : { q: string, locale: "fr"|"en", topK: number <= 10, ceiling?: "public"|"client" }
Output : { results: [{ entryId, slug, title, excerpt, score }], usedTokens?: number }
```

- **Refus dur** `confidentialityCeiling > 'client'` même si HMAC valide (anti-fuite agent IA externe).
- Sentry breadcrumb `kb.rag.query` (PII scrubbed).

### 9.3 Variables env (audit-only — à set en V1.5)

```
KB_RAG_HMAC_SECRET=...
KB_EXPORT_HMAC_SECRET=...
```

---

## 10. SSRF — whitelist domaines embeds + protections server-side fetches

### 10.1 Surfaces SSRF KB

- **Embed metadata hydration** (admin Tiptap, optionnel) : si on fetch `oembed` côté serveur pour récupérer titre/thumbnail vidéo → SSRF possible. **Décision Phase A** : pas d'hydratation oembed côté serveur en V1 (juste validation URL côté client). V1.5 si besoin.
- **Import bulk Markdown** (Sprint KB-16) : si markdown contient `![alt](https://attacker/internal-port)`, l'image est fetch ? **Non** : l'image n'est PAS fetch au moment de l'import. Elle est juste stockée comme URL. Render-time, Next/Image refuse si pas dans `images.remotePatterns` config.
- **Webhook IndexNow / sitemap ping** : URL outbound vers `https://api.indexnow.org`. Pas un risque SSRF (URL fixe).

### 10.2 Doctrine défensive

- `next.config.ts` : `images.remotePatterns` whitelist stricte (déjà existant pour Cloudflare).
- Helper `isAllowedLinkHref` / `isAllowedImageSrc` (§7.4) bloque déjà localhost + RFC 1918 + link-local.
- Si endpoint server action a besoin de fetch externe (V1.5 webhook ingest) → ajouter helper `fetchSafe(url, { allowedHosts, maxBytes, timeoutMs })` qui :
  - Resolve DNS et refuse IP privée.
  - Force HTTPS.
  - Max 5 MB body.
  - Timeout 5 s.
- Pattern testé : `legal-snapshot.ts` ne fait aucun fetch → propre.

### 10.3 Tests

- `fetchSafe.test.ts` (~10 cases, à créer V1.5) : localhost KO, 10.0.0.1 KO, 169.254.169.254 KO (AWS metadata IMDS — sentinel important même si on est sur Hetzner), redirect KO si target IP privée, HTTP KO, > 5 MB KO.

---

## 11. RISQUES, ANTI-PATTERNS, GARDE-FOUS

### 11.1 Anti-patterns à proscrire (KB ne doit jamais)

1. **Stocker un PII dans `bodyText` ou `bodyHtml` sans whitelist** → bypass via `publishKbEntryAction` qui n'appelle pas `detectPii`. **Garde-fou** : tests Vitest qui montent un mock entry avec PII et assertent que `publish` throw.
2. **Loguer le contenu intégral d'un body « confidential » dans Sentry** → règles de scrub Sentry doivent inclure `bodyText`, `bodyHtml`, `bodyJson`. Vérifier `sentry.server.config.ts`.
3. **Exposer `confidentiality='secret'` dans une URL publique** → `/ressources/[type]/[slug]` doit filtrer `audience='public' AND status='published' AND confidentiality IN ('public', 'internal')`. Confidential/secret = jamais dans listing public, jamais dans sitemap (§Agent 6).
4. **Dérouler un `bodyJson` venant de la DB via `dangerouslySetInnerHTML`** → cf. §7.
5. **`embedEntry` envoie un body « confidential » à un sous-processeur** → test bloquant §4.4.
6. **Activer YouTube standard `youtube.com/embed` au lieu de `youtube-nocookie.com`** → CSP `frame-src` doit lister `youtube-nocookie.com` en premier ; éditeur Tiptap force `youtube-nocookie.com` à l'insertion.
7. **Export CSV/JSON avec PII sans masquage** → `kb.export.entry` action applique `redactEmail`/`redactName`/`redactPhone` sur tous les `assignedAuthorEmail`, `assignedReviewerEmail`, `historyChangedBy` selon ceiling.
8. **Permettre `editor` (rôle standard) de publier sans review humaine** → `canPublishKb` ne retourne `true` que pour `super_admin` ou `admin` (jamais `editor`).
9. **Cron retention purge qui supprime un brouillon en cours d'édition** → filtre `status: { in: ['published', 'archived'] }` exclut `draft`/`review`/`approved` (cf. §3.3).
10. **`kb_helpful` 1/IP/entry bypassed via VPN rotating** → V1.5 ajoute fingerprint Turnstile token comme key complémentaire si abuse détecté.
11. **Tag « presse » ou « partenaire » créé par un `editor` sans contrôle** → `kb.tag.manage` restreint à `admin`+ (cf. matrice §1.2).
12. **iframe avec `allow-scripts allow-top-navigation`** → sandbox lockdown §8.3.
13. **Backup full DB sans chiffrement at-rest** → Hetzner Backup service propose chiffrement, valider activation (action Will hors Phase A).
14. **Pas de log d'accès `confidential`** → systématique `kb.entry.read.confidential` (§5.1).
15. **Logger les `bodyText` redactés dans `ActivityLog.changes`** → seulement métadonnées (length, entryId, locale), jamais le contenu.

### 11.2 Garde-fous résumés (à concevoir Sprint KB-19)

- `pre-commit` lint custom : interdiction `dangerouslySetInnerHTML` dans `src/components/knowledge/`.
- Test Vitest dédié `governance.test.ts` qui assert toutes les invariantes (RBAC matrix, PII refusal, embedding refusal, CSP whitelist).
- Sentry rules : scrub `body*` fields, scrub `metadata.kbReviewer` flag.
- Telegram notifs : `redactContactLine` (déjà ADR 0010).

---

## 12. STOP & ASK — décisions ouvertes Phase A

### 12.1 Embeddings (V1.5)

**Q1** — Provider embeddings final V1.5 :

- (a) Anthropic API (cohérent avec stack `claude-api`, prompt caching skill, qualité élevée, latence US ~150 ms p95) → DPA à signer.
- (b) Voyage AI (recommandation Anthropic pour embeddings, DPA séparé).
- (c) Self-hosted `bge-small-en-v1.5` ou `all-MiniLM-L6-v2` sur worker Python sidecar → 0 sous-processeur, 0 DPA, mais ~500 MB RAM et latence ~50 ms p95 + complexité ops.
- (d) Reporté V2+ (RAG en FTS-only en V1 et V1.5).

→ **Recommandation Phase A** : (c) self-hosted V1.5 pour zéro sous-processeur + cost stable. (a) si Will privilégie qualité absolue et accepte DPA Anthropic.

### 12.2 DPA mise à jour

**Q2** — Si Anthropic V1.5 retenu :

- `src/content/subprocessors.ts` doit être patché (8ᵉ entrée).
- `src/content/legal.ts` `politique-confidentialite` doit mentionner Anthropic + finalité.
- DPA Anthropic à signer via dashboard avant déploiement Sprint KB-21.

→ Action humaine Will + DPO hors Phase A. **Phase A bloque V1.5 jusqu'à signature**.

### 12.3 Retention duration par type

**Q3** — V1 = pas de défaut auto (manuel par entry), V1.5 = défaut par type via `Setting.kb_retention_defaults` ?

→ **Recommandation** : OUI V1 = manuel, V1.5 = défauts proposés §3.2 (24 mois case_study anonyme, 36 mois doctrine, 18 mois comparatif, 12 mois commercial_doc).

### 12.4 Hard delete vs archive

**Q4** — Quand `expiresAt < now` :

- (a) Archive seule (status='archived', purge manuelle ultérieure) → recommandation V1 conservatrice.
- (b) Hard delete après grace 30j auto.

→ **Recommandation** : (a) V1 + (b) V1.5 derrière feature flag `kb_hard_delete_after_expire` (Setting).

### 12.5 Claim REVIEWER

**Q5** — `metadata.kbReviewer` (Option A) ou table `KbReviewerAssignment` (Option B) ?

→ **Recommandation Phase A** : (A) V1, (B) V1.5 si granularité domain devient critique.

### 12.6 Embeds V1

**Q6** — Whitelist V1 :

- Confirmer YouTube + Vimeo + Loom suffisant V1 ?
- Twitter/X/Instagram/TikTok/LinkedIn embeds = V2+ ?

→ **Recommandation** : YT + Vimeo + Loom suffisant pour cabinet IA B2B (vidéos pédagogiques + démos). Réseaux sociaux = V2+ (besoin marketing rare en KB).

### 12.7 MFA step-up

**Q7** — Hard delete entry/asset doit-il exiger MFA step-up TOTP ?

- 2FA TOTP existe (`otplib`, mémoire Sprint 24).
- V1 admin global = login + TOTP au login déjà.
- Step-up = re-prompt TOTP avant action destructrice. Plus de friction mais zero-regret pour `kb.entry.delete.hard` + `kb.asset.delete.hard`.

→ **Recommandation** : OUI step-up pour les 2 actions hard delete + `kb.export.full` ceiling > `internal`.

### 12.8 Quota export entry

**Q8** — Limite quotidienne `kb.export.entry` par utilisateur ?

- Rate-limit 50/jour/userId (anti-scrape exhaustif d'un utilisateur compromis).
- → **Recommandation** : OUI, 50/jour.

### 12.9 Sentry PII scrubbing config

**Q9** — Vérifier `sentry.server.config.ts` scrub list inclut :

- `bodyText`, `bodyHtml`, `bodyJson`
- `assignedAuthorEmail`, `assignedReviewerEmail`
- `historyChangedByEmail`
- Helper `redactBeforeSentry(payload)` à appliquer dans tous les `Sentry.captureMessage` KB.

→ **Recommandation** : Sprint KB-19 ajoute test snapshot Sentry events qui assert ces champs scrub.

---

## 13. CARTE DES ARTÉFACTS À LIVRER (Sprint KB-19 — hors Phase A)

> **AUDIT-ONLY rappel** : Phase A ne produit que ce document. Les artefacts ci-dessous sont à implémenter en Phase B Sprint KB-19.

### 13.1 Code (cible Sprint KB-19)

1. `src/lib/knowledge/rbac.ts` — helpers `isKbOwner`, `isKbEditor`, `isKbReviewer`, `isKbReader`, `canPublishKb`, `requireKbRole`.
2. `src/lib/knowledge/url-validator.ts` — `isAllowedImageSrc`, `isAllowedLinkHref`.
3. `src/lib/knowledge/embed-parser.ts` — `parseEmbedUrl`, whitelist `ALLOWED_EMBED_HOSTS`.
4. `src/lib/knowledge/render-tiptap.tsx` — `renderTiptapToReact` SSR pur, whitelist nodes/marks.
5. `src/lib/pii-redaction.ts` — extension `detectPii(text, whitelist)`.
6. `src/server/actions/knowledge/publish.ts` — orchestrateur avec PII scan bloquant + quality score + revalidatePath.
7. `src/server/actions/knowledge/manage-reviewer.ts` — OWNER seulement.
8. `src/server/queue/workers/retention-purge-worker.ts` — extension bloc 5 (knowledge).
9. `src/server/queue/workers/kb-retention-prenotice-worker.ts` — nouveau worker.
10. `src/app/api/internal/kb/export-full/route.ts` — route OWNER.
11. `src/lib/csp.ts` — extension `frame-src`.

### 13.2 Patches contenu (V1.5 conditionnel)

12. `src/content/subprocessors.ts` — ajout Anthropic (si option (a) Q1).
13. `src/content/legal.ts` `politique-confidentialite` — mise à jour sous-traitants.

### 13.3 Tests (cible KB-19 + KB-21)

14. `src/lib/pii-redaction.test.ts` — extension `detectPii` (~15 cases).
15. `src/lib/knowledge/rbac.test.ts` — matrice complète (~25 cases).
16. `src/lib/knowledge/url-validator.test.ts` (~20 cases).
17. `src/lib/knowledge/embed-parser.test.ts` (~15 cases).
18. `src/lib/knowledge/render-tiptap.test.tsx` (~10 cases).
19. `src/server/actions/knowledge/publish.test.ts` (~10 cases — PII block, RBAC, status).
20. `src/server/queue/workers/retention-purge-worker.test.ts` extension (~5 cases new).
21. `src/server/knowledge/embed-refusal.test.ts` (V1.5, ~4 cases).
22. `src/app/api/internal/kb/export-full/route.test.ts` (~8 cases).
23. E2E `tests/e2e/kb/governance-rbac.spec.ts` — réviseur ne peut pas publier, reader ne voit pas bouton supprimer.

### 13.4 Setting keys (cibles Sprint KB-19)

- `kb_pii_whitelist` (JSON)
- `kb_retention_defaults` (JSON par type, V1.5)
- `kb_hard_delete_after_expire` (bool, V1.5)
- `kb_export_max_per_day` (int, défaut 50)

### 13.5 ADR à proposer

- `docs/adr/0021-knowledge-base.md` (générale, Agent 8) — référence ce document § RBAC, PII, retention, embeds.
- `docs/adr/0022-knowledge-embeddings-provider.md` (V1.5, si Q1 = a/b/c trancher).

### 13.6 Variables env (cibles Sprint KB-19 / KB-21)

```
KB_EXPORT_HMAC_SECRET=...     # 32 bytes hex
KB_RAG_HMAC_SECRET=...        # V1.5
KB_PII_WHITELIST_OVERRIDE=    # optionnel, override JSON Setting (dev only)
```

---

## 14. VERDICT AGENT 9

**GO ✅** pour Phase B Sprint KB-19 sur Gouvernance/RGPD/Sécurité.

- Toutes les briques existent : `pii-redaction`, `legal-snapshot`, `subprocessors`, `retention-purge-worker`, `gdpr-export`, `rate-limit`, CSP nonce, `ActivityLog`, `AdminRole` enum. **Aucune dette nouvelle**, juste de l'extension.
- Pas de migration de schéma destructive (sauf colonnes additives sur `KnowledgeEntry` : `expiresAt`, `expiresPreNoticeAt`, `retentionPolicy`, `confidentiality`).
- 9 questions ouvertes (§12) à trancher Will. Aucune ne bloque V1 FTS-only (toutes V1.5+ ou cosmétiques V1).
- Volume effort : Sprint KB-19 ~5-7 jour-développeurs (audit-only, mesure ordres de grandeur).

**Pré-requis Phase B avant Sprint KB-19** :

1. Will tranche Q1 (provider embeddings) — bloque seulement KB-21, pas KB-19.
2. Will tranche Q6 (whitelist embeds V1) — bloque KB-3 (Tiptap admin).
3. Will tranche Q7 (MFA step-up) — bloque KB-19.

---

**Fin Agent 9.**
