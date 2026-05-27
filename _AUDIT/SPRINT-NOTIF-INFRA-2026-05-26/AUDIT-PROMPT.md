# Audit forensique — Sprint Notifications Infra + Contacts/Calendly (Axion-IA)

> **Date prévue d'exécution** : après merge de la PR `feat/notif-infra-contacts-calendly` sur main
> **Mode** : LECTURE uniquement (pas d'édition), mode AUTOPILOT strict (pas de STOP & ASK)
> **Référence** : sprint exécuté selon `_AUDIT/SPRINT-NOTIF-INFRA-2026-05-26/PROMPT.md`
> **Output** : rapport markdown `_AUDIT/SPRINT-NOTIF-INFRA-2026-05-26/AUDIT-REPORT.md`

---

## Mission

Tu es un auditeur forensique senior. Tu vérifies que le sprint « Notifications Infra + Contacts/Calendly » livré par la conv autopilot précédente est **parfaitement implémenté, sans bug, sans régression, sans bombe à retardement, sans angle mort sécurité ou RGPD**.

Tu n'édites RIEN. Tu lis, tu greppes, tu testes, tu corrèles. Tu produis un rapport markdown structuré avec un verdict global (GO PROD / GO CONDITIONNEL / NO-GO) et une liste priorisée P0/P1/P2 des bugs/régressions/risques identifiés.

Tu travailles sur `C:\Users\willi\Documents\Projets\Axion-IA\axionia`. Lis impérativement `CLAUDE.md` + `AGENTS.md` à la racine AVANT toute analyse — ils contiennent les contraintes Web Vitals, le contrat stub.invalid, le statut EN locale désactivé.

**Règle autopilot stricte** : tu n'utilises `AskUserQuestion` que pour reporter un **blocage technique imprévu** (ex : repo non clean, branche manquante, dépendances cassées). Sinon, audit du début à la fin sans pause.

---

## Mode opératoire — 11 phases en parallèle puis convergence

Les phases A à I sont **indépendantes** et peuvent être lancées en parallèle via Agent (subagent_type=Explore). La phase J est une convergence finale séquentielle. La phase K est le verdict + rapport.

Lance les 9 phases d'audit en parallèle dans un SEUL message avec 9 sub-agents Explore. Récupère les résultats, croise-les, fais les vérifications finales (J), puis émets le verdict (K).

---

## Phase A — Inventaire des fichiers livrés (preuve que le sprint a tout produit)

### Vérifie l'existence de TOUS les fichiers suivants

**Hub notifications (Chantier 1)** :
- `src/server/notifications/index.ts`
- `src/server/notifications/types.ts`
- `src/server/notifications/catalog.ts`
- `src/server/notifications/routing.ts`
- `src/server/notifications/dedup.ts`
- `src/server/notifications/rate-limit.ts`
- `src/server/notifications/format.ts`
- `src/server/notifications/channels/telegram.ts`
- `src/server/notifications/channels/email.ts`
- `src/server/notifications/channels/sentry.ts`
- `src/server/notifications/__tests__/notify.test.ts`
- `src/server/notifications/__tests__/routing.test.ts`
- `src/server/notifications/__tests__/format.test.ts`
- `src/server/queue/workers/notifications-worker.ts`

**Admin Contacts & Messages (Chantier 2)** :
- `src/app/[locale]/(admin)/[adminPrefix]/contacts/page.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/contacts/layout.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/contacts/messages/page.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/contacts/messages/[id]/page.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/contacts/calendly/page.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/contacts/calendly/[id]/page.tsx`
- `src/components/admin/AdminTabs.tsx`
- `src/components/admin/__tests__/AdminTabs.test.tsx`

**Reply System (Chantier 5)** :
- `src/features/admin-submissions/reply-actions.ts`
- `src/features/admin-submissions/__tests__/reply-actions.test.ts`
- `src/components/admin/contacts/ReplyComposer.tsx`
- `src/components/admin/contacts/ReplyHistory.tsx`
- `src/components/admin/contacts/__tests__/ReplyComposer.test.tsx`
- `src/lib/email/templates/submission-reply.tsx`

**Calendly Embed JS (Chantier 3)** :
- `src/components/booking/CalendlyEventCapture.tsx`
- `src/app/api/calendly/client-event/route.ts`
- `src/app/api/calendly/client-event/__tests__/route.test.ts`

**Tests E2E** :
- `e2e/admin-contacts-tabs.spec.ts`
- `e2e/admin-reply-submission.spec.ts`

**ADRs** :
- `docs/adr/0027-notifications-hub.md`
- `docs/adr/0028-calendly-embed-js.md`
- `docs/adr/0029-reply-system.md`

**Migrations Prisma** (vérifier que les fichiers existent dans `prisma/migrations/`) :
- `add_submission_replies_v1` (ou nom similaire avec timestamp)
- `add_calendly_events_v1`

**Redirects rétrocompat** :
- `src/app/[locale]/(admin)/[adminPrefix]/submissions/page.tsx` → `redirect("/contacts/messages")`
- `src/app/[locale]/(admin)/[adminPrefix]/submissions/[id]/page.tsx` → `redirect("/contacts/messages/[id]")`

### Reporter dans la phase A

- Liste des fichiers manquants (NO-GO si ≥1 fichier critique manque)
- Liste des fichiers présents mais vides ou stubs (P0)
- LOC moyen par fichier (sanity check : <50 LOC = stub suspect, >500 LOC = god class possible)

---

## Phase B — Audit Hub Notifications (Chantier 1)

### B.1 Type-safety du catalogue

Lis `src/server/notifications/types.ts` + `catalog.ts`. Vérifie :

- ✅ `NotificationEvent` est une **discriminated union** TS literal (pas de `string` libre)
- ✅ Toutes les catégories suivantes existent (au minimum) :
  - `CONTACT_FORM_SUBMITTED`
  - `AUDIT_REQUEST_SUBMITTED`
  - `INTERVENTION_REQUEST_SUBMITTED`
  - `IMPLEMENTATION_REQUEST_SUBMITTED`
  - `QUOTE_REQUEST_RECEIVED`
  - `NEWSLETTER_PENDING` / `NEWSLETTER_CONFIRMED` / `NEWSLETTER_UNSUBSCRIBED`
  - `BOOKING_CREATED` / `BOOKING_CANCELLED`
  - `OPTION_CONFIRMED` / `OPTION_REFUSED` / `OPTION_EXPIRED`
  - `CALENDLY_INVITEE_CREATED` / `CALENDLY_INVITEE_CANCELED` / `CALENDLY_INVITEE_RESCHEDULED`
  - `DEPLOY_SUCCESS` / `DEPLOY_FAILED`
  - `BACKUP_SUCCESS` / `BACKUP_FAILED`
  - `SECRET_ROTATION_NEEDED`
  - `SECURITY_ALERT`
  - `DB_HEALTH_DEGRADED`
  - `SENTRY_ERROR_SPIKE`
  - `STRIPE_DISPUTE_CREATED`
  - `CONTENT_GEN_COST_CAP_REACHED`
  - `CONTENT_GEN_PROVIDER_DOWN`
- ✅ Chaque variante a un `payload` typé spécifique (pas de `payload: any` ou `unknown`)
- ✅ `NotificationSeverity` = union `"info" | "warn" | "error" | "critical"` strict
- ✅ `NotificationChannel` = union `"telegram" | "email" | "sentry"` strict

### B.2 API publique `notify()`

Lis `src/server/notifications/index.ts`. Vérifie :

- ✅ Export d'une fonction unique `notify(event: NotificationEvent & { severity?, channels?, dedupKey?, force? }): Promise<NotifyResult>`
- ✅ Fail-soft : aucun `throw` propagé au caller (catch interne + log + return)
- ✅ Timeout protégé : si Telegram ne répond pas en 3-5s, abandon sans bloquer
- ✅ Mode async respecté : si `severity ∈ ["error", "critical"]` OU contexte non-Server-Action → queue BullMQ. Sinon → sync.
- ✅ Si `BULLMQ_DISABLED=true` → fallback sync silencieux (preuve : pas de `throw` quand queue=null)
- ✅ Si `REDIS_URL` contient `stub.invalid` → dedup/rate-limit no-op (preuve via code path)

### B.3 Channels

Lis chaque channel `channels/{telegram,email,sentry}.ts`. Vérifie :

- ✅ Tous implémentent la même interface (probablement `NotificationChannelHandler`)
- ✅ Channel Telegram : retry exponentiel (1 retry minimum, max 3) avec backoff
- ✅ Channel Telegram : format MarkdownV2 avec échappement strict des 18 caractères réservés (`_ * [ ] ( ) ~ \` > # + - = | { } . !`)
- ✅ Channel Email : utilise `enqueueEmail` existant (pas de nouveau client SMTP)
- ✅ Channel Sentry : utilise `Sentry.captureMessage` ou `addBreadcrumb` selon severity

### B.4 Dedup + rate-limit Redis

Lis `dedup.ts` et `rate-limit.ts`. Vérifie :

- ✅ Dedup : `SET key NX EX ttl` (atomic, pas de race condition)
- ✅ Rate-limit : token bucket OU sliding window (avec lua script atomic)
- ✅ Si Redis down OU stub.invalid → return `false` (laisser passer, fail-open)
- ✅ Clés Redis namespacées : `notif:dedup:{category}:{hash}` et `notif:ratelimit:{category}:...`

### B.5 Backward compat `src/lib/telegram.ts`

Lis le wrapper. Vérifie :

- ✅ Marqué `@deprecated` JSDoc
- ✅ Mappe les anciens tags vers `notify()` correctement (ex `"NEWSLETTER"` → `CATEGORY: NEWSLETTER_PENDING/CONFIRMED/UNSUBSCRIBED`)
- ✅ Les ~9 call-sites legacy existent encore et compilent (grep `sendTelegram(` dans tout le projet, doit retourner ≥6 résultats)
- ✅ Au moins 3 call-sites migrés vers `notify()` direct (grep `notify({` ou `await notify(` doit retourner ≥3 résultats hors notifications/)

### B.6 Tests unitaires Chantier 1

- ✅ `notify.test.ts` : ≥6 cas (sync send, async queue, dedup hit, dedup miss, channel down → fail-soft, env vars manquantes → fail-soft)
- ✅ `routing.test.ts` : assert routing par catégorie correct
- ✅ `format.test.ts` : assert escapeMarkdownV2 + format `Europe/Paris` via `Intl.DateTimeFormat`

### B.7 Croisements Chantier 1

- ✅ Les call-sites Calendly (`/api/calendly/client-event/route.ts`) appellent `notify({ category: "CALENDLY_INVITEE_CREATED", ... })`
- ✅ Le reply-actions admin (`reply-actions.ts`) PEUT appeler `notify(...)` (mais décision figée : pas de notif audit-trail → vérifier qu'il ne le fait PAS)
- ✅ Les content-gen-alerts (`src/server/content-gen/shared/content-gen-alerts.ts`) appellent encore l'ancien helper OU migrés vers notify

---

## Phase C — Audit Admin Contacts & Messages (Chantier 2)

### C.1 Structure des routes

Vérifie via Glob :

- ✅ `/[locale]/(admin)/[adminPrefix]/contacts/page.tsx` existe et redirige vers `/contacts/messages` (default tab)
- ✅ `/[locale]/(admin)/[adminPrefix]/contacts/layout.tsx` contient les AdminTabs
- ✅ `/[locale]/(admin)/[adminPrefix]/contacts/messages/*` route fonctionne
- ✅ `/[locale]/(admin)/[adminPrefix]/contacts/calendly/*` route fonctionne
- ✅ Redirects 301 depuis `/submissions/**` → `/contacts/messages/**`

### C.2 AdminTabs réutilisable

Lis `src/components/admin/AdminTabs.tsx`. Vérifie :

- ✅ Server Component (pas `"use client"` sauf si justifié)
- ✅ A11y : `role="tablist"` + `role="tab"` + `aria-current="page"` sur l'actif
- ✅ Style : underline terracotta sur l'actif
- ✅ Focus visible

### C.3 Sidebar updated

Lis `src/components/admin/AdminSidebar.tsx`. Vérifie :

- ✅ L'entrée « Submissions » est REMPLACÉE par « Contacts & Messages »
- ✅ Icon `Inbox` de Lucide
- ✅ Groupe `main`
- ✅ Badge unread (compteur de submissions `needsAttention=true AND archivedAt IS NULL`) présent
- ✅ Query Prisma cachée via `unstable_cache` 30s (preuve : import + wrap)

### C.4 Réutilisation de SubmissionsV2

- ✅ Le sous-onglet Messages réutilise EXACTEMENT le composant `SubmissionsV2.tsx` existant (pas de duplication)
- ✅ Les filtres existants (type, status, locale, date, search) fonctionnent
- ✅ La pagination 25/page fonctionne
- ✅ L'export CSV fonctionne

### C.5 Tests Chantier 2

- ✅ `e2e/admin-contacts-tabs.spec.ts` : login admin → /contacts → tabs visibles → switch tabs → listings visibles
- ✅ `AdminTabs.test.tsx` : render + tabs interactives + a11y roles

---

## Phase D — Audit Reply System (Chantier 5)

### D.1 Modèle Prisma `SubmissionReply` + extensions `Submission`

Lis `prisma/schema.prisma`. Vérifie :

- ✅ Model `SubmissionReply` existe avec TOUS les champs documentés dans le PROMPT.md (id, submissionId, repliedByUserId, repliedByName, repliedAt, toEmail, subject, bodyHtml, bodyText, deliveryStatus, providerMessageId, sentAt, failedAt, errorMsg, retryCount, templateUsed, internalNote)
- ✅ Enum `SubmissionReplyStatus` : `pending | sent | delivered | bounced | complained | failed`
- ✅ Index sur `submissionId`, `deliveryStatus`, `repliedAt`
- ✅ Relation `submission` avec `onDelete: Cascade`
- ✅ Relation `repliedByUser` avec `onDelete: SetNull` (snapshot `repliedByName` préservé)
- ✅ Extensions `Submission` : `replyCount Int @default(0)`, `firstRepliedAt DateTime?`, `lastRepliedAt DateTime?`, `needsAttention Boolean @default(true)`, `archivedAt DateTime?`, `replies SubmissionReply[]`

### D.2 Migration Prisma additive

Vérifie via Glob `prisma/migrations/*_add_submission_replies_v1/migration.sql` :

- ✅ Seulement `CREATE TABLE` + `CREATE INDEX` + `ADD COLUMN` (nullable)
- ❌ Aucun `DROP`, `RENAME`, ou `NOT NULL` sans default
- ✅ Pas de drift avec `pnpm prisma migrate diff` (run la commande, doit retourner empty diff)

### D.3 Server Actions `reply-actions.ts`

Lis `src/features/admin-submissions/reply-actions.ts`. Vérifie chaque action :

#### `replyToSubmissionAction`
- ✅ RBAC : `requireAdminWriteSession()` en début
- ✅ Zod schema strict (subject min 1, max ~200 ; bodyMarkdown min 1, max ~10000)
- ✅ Fetch Submission ; throw `notFound` si absent
- ✅ Render template React Email via `@react-email/render`
- ✅ Create `SubmissionReply` en transaction
- ✅ Enqueue email via `enqueueEmail("submission-reply", to, locale, { replyId, ... })`
- ✅ Update Submission : `replyCount++`, `needsAttention=false`, `status="in_progress"` si actuellement `new`
- ✅ `revalidatePath` sur `/admin/contacts/messages` et `/admin/contacts/messages/[id]`
- ✅ Aucun appel `notify()` audit-trail (décision figée Will = NON)

#### `archiveSubmissionAction` / `unarchiveSubmissionAction`
- ✅ RBAC
- ✅ Idempotent (archive 2× → toujours archivé)
- ✅ Met à jour `status="archived"` ET `archivedAt=now()` simultanément

#### `bulkArchiveSubmissionsAction` / `bulkUnarchiveSubmissionsAction`
- ✅ Accepte un array d'IDs validé Zod
- ✅ Transaction pour atomicité
- ✅ Cap raisonnable (max 100 items par batch) pour éviter OOM

#### `markNeedsAttentionAction`
- ✅ Toggle boolean

#### `retryFailedReplyAction`
- ✅ Reset `deliveryStatus="pending"`, `errorMsg=null`, incrémente retryCount
- ✅ Re-enqueue email

### D.4 Email worker handler

Lis `src/server/queue/workers/email-worker.ts`. Vérifie qu'il y a un case `"submission-reply"` qui :

- ✅ Fetch SubmissionReply via id
- ✅ Appel SMTP avec `replyTo: process.env.ADMIN_REPLY_FROM ?? "contact@axion-ia.com"`
- ✅ Header `Message-ID` : `<{replyId}@axion-ia.com>` (RFC 5322)
- ✅ Update `deliveryStatus="sent"` + `sentAt` + `providerMessageId` si succès
- ✅ Update `deliveryStatus="failed"` + `failedAt` + `errorMsg` + `retryCount++` si erreur
- ✅ Re-throw l'erreur pour que BullMQ retry avec backoff

### D.5 Template React Email

Lis `src/lib/email/templates/submission-reply.tsx`. Vérifie :

- ✅ Branded Axion-IA : terracotta `#c2410c` + canvas `#fef3e6` + serif
- ✅ Signature footer : « Williams Jullin · Axion-IA » + contact email
- ✅ Plain-text fallback auto-généré
- ✅ Markdown rendu en HTML basique (paragraphes, bold, italic, liens) — pas de XSS (escape strict si pas de lib markdown safe)

### D.6 UI ReplyComposer

Lis `src/components/admin/contacts/ReplyComposer.tsx`. Vérifie :

- ✅ Client component (`"use client"`)
- ✅ Field subject + bodyMarkdown + internalNote (optionnel) + templateSelect
- ✅ Preview du rendu HTML (côté client, idéalement iframe sandboxée)
- ✅ Bouton « Envoyer » disabled pendant la soumission
- ✅ Error inline affiché si Server Action échoue
- ✅ Pas de upload fichiers (out of scope V1)

### D.7 UI ReplyHistory

Lis `src/components/admin/contacts/ReplyHistory.tsx`. Vérifie :

- ✅ Server Component
- ✅ Timeline triée par `repliedAt` desc
- ✅ Affiche statut delivery avec emoji par statut (🟡 pending, 🟢 sent, ✅ delivered, ⚠️ bounced, 🔴 failed, 🚨 complained)
- ✅ Bouton « Réessayer » disponible si `deliveryStatus ∈ ["bounced", "failed"]`
- ✅ Toggle pour voir le contenu HTML rendu

### D.8 Indicateurs visuels listing

Lis `SubmissionsV2.tsx` ou le composant équivalent. Vérifie :

- ✅ Badges :
  - 🔴 « Sans réponse » : `replyCount=0 AND status=new`
  - 🟠 « En attente » : `replyCount=0 AND status=in_progress`
  - 🟢 « Répondu (N) » : `replyCount>0`
  - ⚠️ « Échec envoi » : dernière reply `deliveryStatus ∈ ["bounced", "failed"]`
  - 🗄️ « Archivé » : `status=archived`
- ✅ Filtre par défaut : « Sans réponse + non archivé »
- ✅ Filtre « Inclure archivés » checkbox
- ✅ Bulk actions sticky bar quand ≥1 ligne sélectionnée

### D.9 Tests Chantier 5

- ✅ `reply-actions.test.ts` : ≥8 cas (happy path, RBAC, 404, Zod, archive idempotent, bulk archive, retry failed, toggle attention)
- ✅ `ReplyComposer.test.tsx` : render + submit + error display
- ✅ `e2e/admin-reply-submission.spec.ts` : flow E2E login → reply → check timeline

---

## Phase E — Audit Calendly Embed JS (Chantier 3)

### E.1 Modèle Prisma `CalendlyEvent`

Lis `prisma/schema.prisma`. Vérifie :

- ✅ Model `CalendlyEvent` existe avec champs : id, eventTypeName, eventTypeSlug, status, startTime, endTime, timezone, location, inviteeName, inviteeEmail, inviteePhone, source, rawPayload, pageUrl, utmSource, utmCampaign, utmMedium, referrer, linkedSubmissionId, capturedAt, updatedAt, notes
- ✅ Enum `CalendlyEventStatus` : scheduled | canceled | completed | no_show
- ✅ Enum `CalendlyEventSource` : embed_js | manual_import | webhook
- ✅ Index sur status, startTime, inviteeEmail, capturedAt
- ✅ Relation `linkedSubmission` avec `onDelete: SetNull`

### E.2 Migration additive

Idem D.2 : `pnpm prisma migrate diff` doit être vide. Seulement CREATE/ADD nullable.

### E.3 Component `CalendlyEventCapture`

Lis `src/components/booking/CalendlyEventCapture.tsx`. Vérifie :

- ✅ `"use client"` (nécessaire pour `window.addEventListener`)
- ✅ Listener `message` enregistré dans `useEffect` avec cleanup
- ✅ **Origin check strict** : `e.origin.endsWith("calendly.com")` (PAS de `includes`, PAS de wildcard naïf)
- ✅ Type check sur `e.data` (object + event field string + startsWith `"calendly."`)
- ✅ Filtre uniquement `calendly.event_scheduled` (les 3 autres events sont juste analytics, pas persistés)
- ✅ POST vers `/api/calendly/client-event` avec `keepalive: true` (survit à un close immédiat)
- ✅ Fail-soft : try/catch autour du fetch, pas de throw au caller
- ✅ Pas de UI rendue (`return null`)

### E.4 Endpoint `/api/calendly/client-event`

Lis `src/app/api/calendly/client-event/route.ts`. Vérifie :

- ✅ `export const runtime = "nodejs"` (besoin Prisma)
- ✅ Rate-limit par IP (max 5/min) AVANT parse — protection anti-spam
- ✅ IP hashée via `hashIp()` (`IP_HASH_SALT`, RGPD)
- ✅ Zod schema strict sur le body
- ✅ Dédup logique 60s (slug + IP hash) AVANT insert
- ✅ Insert CalendlyEvent + appel `notify({ category: "CALENDLY_INVITEE_CREATED", ... })`
- ✅ Pas de signature webhook (Embed JS = client-side, on ne peut pas signer)
- ✅ Return JSON avec ok/eventId/deduped
- ✅ Handle errors : 400 invalid JSON, 400 invalid payload, 429 rate limited

### E.5 Intégration `/appel/page.tsx`

Lis la page `/appel`. Vérifie :

- ✅ `<CalendlyEventCapture calendlyUrl={CALENDLY_APPEL_URL} trackingContext={...} />` monté à côté du `<CalendlyInlineWidget />`
- ✅ UTM/referrer extraits côté Server Component via `searchParams` et `headers().get("referer")`
- ✅ pageUrl correct

### E.6 UI admin Calendly listing + détail

Lis `/contacts/calendly/page.tsx` + `[id]/page.tsx`. Vérifie :

- ✅ Listing trié `capturedAt desc`
- ✅ Colonnes : Date, Type event, Invitee, Page d'origine, UTM, Statut, Action
- ✅ Filtres : Statut, période, recherche email
- ✅ **Bandeau d'info honnête** sur la page mère : « La capture Calendly fonctionne en mode client-side gratuit. Seules les créations depuis /appel sont captées automatiquement. Les annulations et déplacements doivent être marqués manuellement... »
- ✅ Détail : édition inline des champs invitee + JSON viewer rawPayload + bouton « Lier à une Submission » + bouton « Ouvrir dans Calendly »
- ✅ Bouton « + Ajouter manuellement un RDV » sur la page mère → server action `createManualCalendlyEventAction`

### E.7 Tests Chantier 3

- ✅ `route.test.ts` (client-event) : ≥6 cas (POST valide, rate limit, payload invalide, JSON malformé, dédup, payload sans invitee.email)
- ✅ `CalendlyEventCapture.test.tsx` : simule postMessage + assert fetch appelé avec bons params

---

## Phase F — Croisements end-to-end (CRUCIAL — c'est là que les bugs surgissent)

Cette phase teste les **interactions** entre chantiers. Si chaque chantier isolé est OK mais que les croisements cassent → NO-GO.

### F.1 Flow contact form → Telegram → admin

Pour chaque type de formulaire public (contact, audit, devis, intervention, implementation) :

1. Localise la Server Action qui crée la `Submission` (probablement `src/features/unified-contact/actions.ts`)
2. Vérifie qu'elle appelle `notify({ category: ... })` OU `sendTelegram(...)` (wrapper deprecated)
3. La submission créée doit avoir `needsAttention=true` par défaut
4. La submission doit apparaître dans `/admin/contacts/messages` avec badge « Sans réponse »
5. La notif Telegram doit contenir : type form + contact + extrait du message

### F.2 Flow reply admin → email → status delivery → timeline

1. Admin ouvre `/admin/contacts/messages/[id]`
2. Clique « Répondre » → `ReplyComposer` ouvert
3. Submit form → `replyToSubmissionAction`
4. `SubmissionReply` créée avec `deliveryStatus=pending`
5. Email enqueué dans queue BullMQ
6. Worker email pick le job → SMTP send → update `deliveryStatus=sent`
7. `Submission.replyCount++` + `lastRepliedAt=now()` + `needsAttention=false` + `status="in_progress"`
8. Listing : badge passe de « Sans réponse » à « Répondu (1) »
9. Timeline : nouvelle entrée avec statut 🟢 « Envoyé »

**Vérifie chaque étape via grep + lecture du code. Si une étape manque → P0.**

### F.3 Flow Calendly Embed JS → DB → Telegram → admin

1. Visiteur sur `/fr/appel` choisit un créneau dans iframe Calendly
2. Calendly émet `postMessage` event `calendly.event_scheduled`
3. `CalendlyEventCapture` capte → POST `/api/calendly/client-event`
4. Endpoint persiste `CalendlyEvent` + appelle `notify({ category: "CALENDLY_INVITEE_CREATED" })`
5. Telegram reçoit notif avec emoji + horaire formaté Europe/Paris
6. Visible dans `/admin/contacts/calendly` listing

**Test code-level uniquement (pas runtime) : vérifie que les imports/calls existent dans la chaîne.**

### F.4 Cycle archive/unarchive

1. Listing default `/admin/contacts/messages` : seulement non-archivés visibles
2. Sélectionne 5 submissions → bulk archive
3. Disparaissent du listing default
4. Active filtre « Inclure archivés » → réapparaissent avec badge 🗄️
5. Bulk unarchive → reviennent dans listing default

**Vérifie via tests E2E si existants OU lis le code pour confirmer la logique de filtrage.**

### F.5 RBAC : non-admin essaie d'accéder

- ✅ Visiteur anonyme sur `/admin/contacts/messages` → redirect login
- ✅ User `viewer` (read-only) sur `replyToSubmissionAction` → 403 / throw
- ✅ User `editor` → autorisé selon `requireAdminWriteSession()` (vérifie la définition)
- ✅ User `admin` ou `super_admin` → autorisé

### F.6 Idempotence webhook Calendly (même si Embed JS, dedup logique)

1. `postMessage` émis 2× rapidement (cas réel : visiteur double-clique)
2. 2 POST `/api/calendly/client-event` simultanés
3. Dédup logique 60s (slug + IP hash) → 1 seul `CalendlyEvent` créé
4. 1 seule notif Telegram (dedupKey `notify()`)

**Vérifie via code review : lecture de la dédup logique + dedupKey passé à notify().**

### F.7 Stub.invalid build GH Actions

- ✅ Tous les nouveaux fichiers du sprint respectent le contrat stub.invalid (cf. AGENTS.md)
- ✅ `pnpm build` avec `DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub` + `REDIS_URL=redis://stub.invalid:6379` + `BULLMQ_DISABLED=true` doit passer
- ✅ Le hub notifications no-op en mode stub (queue null + Redis Proxy null)
- ✅ Le webhook Calendly ne fait pas de query Prisma au SSG (route handler runtime only)
- ✅ Les pages admin sont protégées par auth → ne s'exécutent pas au SSG

**Vérifie via lecture du code + grep `stub.invalid` dans les fichiers nouveaux.**

### F.8 Migration backwards-compat `/submissions/*` → `/contacts/messages/*`

1. URL legacy `https://axion-ia.com/fr/admin/submissions` → 301 vers `/fr/admin/contacts/messages`
2. URL legacy `https://axion-ia.com/fr/admin/submissions/{id}` → 301 vers `/fr/admin/contacts/messages/{id}`
3. Les anciens liens dans emails admin (si existants) continuent à fonctionner
4. SEO : les redirects sont 301 (permanent), pas 302/307

---

## Phase G — Sécurité + RGPD

### G.1 Pas de leak de secrets

Grep dans tous les nouveaux fichiers :

- ❌ Aucun `TELEGRAM_BOT_TOKEN` hardcodé
- ❌ Aucun `ADMIN_REPLY_FROM` hardcodé en clair (sauf `.env.example` ou fallback `contact@axion-ia.com`)
- ❌ Aucun `IP_HASH_SALT` ou secret similaire hardcodé
- ❌ Aucun `console.log` qui leak un email user ou un token

### G.2 RGPD

- ✅ Email invitee Calendly est en `@db.Citext` (case-insensitive index)
- ✅ Si le payload Calendly contient PII (email, nom, téléphone), il est persisté en clair dans `rawPayload Json` — vérifier qu'une mention RGPD est documentée dans l'ADR 0028 (purge cron > 24 mois)
- ✅ `SubmissionReply.toEmail` snapshoté au moment de l'envoi (immuable)
- ✅ IP visitor du endpoint client-event est hashée via `hashIp()` (pas stockée en clair)
- ✅ Tableau RGPD article 30 mis à jour si nécessaire (lis `docs/DPA-REGISTER.md` ou équivalent)

### G.3 Anti-XSS

Lis le template React Email + le ReplyHistory. Vérifie :

- ✅ Le bodyMarkdown rendu en HTML utilise une lib safe (ex `react-markdown` ou `remark-html` avec sanitize) OU escape strict des caractères HTML
- ✅ Aucun `dangerouslySetInnerHTML` sans sanitize en amont
- ✅ Le JSON viewer du rawPayload Calendly escape les chaînes (pas de injection si invitee.name contient `<script>`)

### G.4 CSRF

- ✅ Les Server Actions Next.js bénéficient du CSRF protection natif (POST same-origin + token)
- ✅ Le route handler `/api/calendly/client-event` accepte des POST cross-origin (depuis l'iframe Calendly via postMessage → relayé par notre JS) → vérifier que le check origin postMessage compense

### G.5 SQL injection / Prisma

- ✅ Toutes les queries Prisma utilisent les méthodes typées (`.findUnique`, `.create`, `.update`) — pas de `$queryRaw` non paramétré
- ✅ Si `$queryRaw` utilisé : vérifier qu'il est paramétré via `Prisma.sql\`...\``

### G.6 Rate-limiting global

- ✅ Endpoint `/api/calendly/client-event` rate-limité (≤5/min/IP)
- ✅ Server Actions admin (reply, archive, etc.) protégées par RBAC (pas besoin rate-limit explicite)
- ✅ Telegram channel a rate-limit interne pour éviter le spam si bug appelle notify 1000× en boucle

---

## Phase H — Performance Web Vitals

Référence : `axionia/CLAUDE.md` budget Web Vitals 2026 (LCP ≤ 1800ms, INP ≤ 100ms, CLS = 0, First Load JS ≤ 75 KB gz par route).

### H.1 Pages admin (cible : pas de dégradation)

- ✅ `/admin/contacts/messages` : First Load JS ≤ 110 KB gz (exception admin, tolérance plus large)
- ✅ Pas de Client Components massifs introduits (le tabs SSR si possible)
- ✅ `ReplyComposer` chargé en lazy (dynamic import) si non utilisé immédiatement

### H.2 Page `/appel` (cible : ne pas dégrader le LCP < 1800ms)

- ✅ `<CalendlyEventCapture />` ajouté en Client Component → vérifier impact bundle
- ✅ Script Calendly toujours en `lazyOnload` ou `afterInteractive` (pas `beforeInteractive`)
- ✅ Pas de nouvelle image LCP non-optimisée

### H.3 Bundle delta

Vérifier (si scriptable) :
- `pnpm build` puis `pnpm size-limit` (si configuré)
- Diff vs main avant le sprint : delta ≤ +5 KB gz par route public

Si pas scriptable en mode lecture : reporter une **estimation** basée sur la taille des fichiers nouveaux (rough mais utile).

### H.4 Migrations Prisma + impact runtime

- ✅ Aucune migration introduit un index manquant qui causerait un table scan en prod
- ✅ Les colonnes ajoutées sur `Submission` (replyCount, etc.) ont un `@default()` → pas de NULL backfill bloquant
- ✅ Les indexes ajoutés sur SubmissionReply et CalendlyEvent sont pertinents (vérifier alignement avec les requêtes du listing/filtres)

---

## Phase I — Tests verts + couverture

### I.1 `pnpm typecheck`

- ✅ 0 erreur
- Si erreurs : report exact + path:line + message

### I.2 `pnpm vitest run`

- ✅ Baseline préservée (≥ 1905/1912 pré-sprint)
- ✅ Nouveaux tests ajoutés : compter les tests ajoutés (~25-30 attendus selon PROMPT.md)
- ✅ Taux d'échec : 0% (aucun test rouge)
- Si tests rouges : report par fichier + raison

### I.3 `pnpm lint`

- ✅ 0 erreur ESLint
- Warnings acceptés mais à reporter

### I.4 `pnpm anti-siren:check` / `anti-hex:check` / `use-client:check`

- ✅ Tous verts

### I.5 Couverture (si configuré via `pnpm vitest run --coverage`)

- ✅ Nouvelles fonctions / branches couvertes
- ✅ Pas de drop majeur de la couverture globale

### I.6 E2E Playwright (si Docker dispo)

- ✅ Tous les tests E2E nouveaux passent
- ✅ Tests E2E existants préservés (pas de régression sur les flows critiques)

---

## Phase J — Smoke tests prod-ready (CONVERGENCE)

Cette phase agrège les findings des phases A-I + ajoute des vérifications transverses qui ne pouvaient pas être faites en parallèle.

### J.1 Cohérence ADRs

- ✅ ADR 0027 (notifications-hub) couvre architecture + décisions clés (sync/async, fail-soft, type catalog)
- ✅ ADR 0028 (calendly-embed-js) couvre limitations Free + path d'upgrade Standard
- ✅ ADR 0029 (reply-system) couvre limitation V1 (pas de threading IMAP) + V2 future

### J.2 Cohérence `.env.example`

- ✅ Toutes les nouvelles env vars listées avec doc :
  - `ADMIN_REPLY_FROM`
  - `ADMIN_REPLY_FROM_NAME`
  - (Calendly : aucune nouvelle car Embed JS pas de signing key)
- ✅ Toutes valeurs vides ou exemples sains (pas de secret en clair)

### J.3 Cohérence `src/env.ts` (Zod schema)

- ✅ Les nouvelles env vars sont validées en Zod (optional pour Telegram, optional pour reply-from avec default)

### J.4 Mémoire entry MEMORY.md mise à jour

- ✅ Nouvelle entry dans `MEMORY.md` listant le sprint livré avec date + commit SHA + résultats

### J.5 Cohérence Sidebar admin badge unread

Croisement entre :
- Le badge sidebar (compteur Prisma)
- Le filtre default `Sans réponse + non archivé`

Les deux doivent reposer sur la **même requête logique** : `needsAttention=true AND archivedAt IS NULL`. Vérifier qu'il n'y a pas de divergence.

### J.6 Migration Prisma : drift check final

Run `pnpm prisma migrate status` :
- ✅ « Database schema is up to date » OU équivalent
- ❌ Aucun « pending migration » ou « drift detected »

### J.7 Health check imports

Grep tous les imports du nouveau code :
- ✅ Aucun `import` cassé (chemin inexistant)
- ✅ Aucun `import` circulaire (suspect si A importe B qui importe A)
- ✅ Aucun import depuis un module non publié (pas de `node_modules/.cache`, etc.)

### J.8 Côté production réel

(Optionnel, si l'audit tourne post-deploy)

- ✅ `curl -I https://axion-ia.com/fr/admin/contacts/messages` → 302 vers login (RBAC marche)
- ✅ `curl https://axion-ia.com/api/calendly/client-event` (GET) → 405 Method Not Allowed
- ✅ Envoyer un POST mock vers `/api/calendly/client-event` avec body invalide → 400
- ✅ Le widget Calendly s'affiche sur `/fr/appel` (curl HTML + grep `calendly-inline-widget`)

---

## Phase K — Verdict + Rapport

Produis `_AUDIT/SPRINT-NOTIF-INFRA-2026-05-26/AUDIT-REPORT.md` avec la structure suivante :

```markdown
# Audit Forensique — Sprint Notif Infra + Contacts/Calendly

> Date audit : {date}
> Branche / commit auditée : {sha}
> Verdict global : GO PROD ✅ / GO CONDITIONNEL 🟡 / NO-GO 🔴

## Synthèse

- **Phases passées** : A/B/C/D/E/F/G/H/I/J ({nombre passées}/10)
- **P0 trouvés** : {n}
- **P1 trouvés** : {n}
- **P2 trouvés** : {n}
- **Bombes à retardement** : {n}
- **Risques RGPD** : {n}
- **Risques sécurité** : {n}

## Top 5 actions Will (prioritaires)

1. ...
2. ...

## Détail par phase

### Phase A — Inventaire
✅/🟡/🔴 {résumé 2-3 lignes}
{tableau fichiers manquants / vides / OK}

### Phase B — Hub notifications
{idem pour chaque phase}

[... répéter pour C, D, E, F, G, H, I, J]

## Bugs P0 (bloquants prod)

### P0-1 : {titre}
- **Fichier** : `path:line`
- **Symptôme** : ...
- **Reproduction** : ...
- **Fix proposé** : ...

## Bugs P1 (importants mais non bloquants)

{idem}

## Risques P2 (nice-to-fix)

{idem}

## Croisements problématiques (Phase F)

{liste des flows qui ont un trou)

## Recommandations post-audit

- Si GO PROD : actions Will post-merge
- Si GO CONDITIONNEL : checklist des P0 à corriger avant deploy
- Si NO-GO : plan de remédiation détaillé
```

---

## Critères de verdict

### GO PROD ✅
- 0 P0
- ≤ 3 P1
- Phases A-J toutes ≥ 90% OK
- Tests verts (typecheck + vitest + lint + anti-* + use-client)
- Aucun secret leaké
- Aucune régression sur les 9 call-sites Telegram existants

### GO CONDITIONNEL 🟡
- 0 P0 OU ≤ 2 P0 avec fix trivial documenté (< 30 min)
- ≤ 5 P1
- Phases A-J ≥ 75% OK
- Tests verts

### NO-GO 🔴
- ≥ 1 P0 sans fix trivial
- OU ≥ 6 P1
- OU tests rouges
- OU régression critique sur l'existant
- OU secret leaké
- OU drift Prisma irréversible

---

## Contraintes globales

- 🚫 NE PAS éditer le code — uniquement lire, grep, analyser
- 🚫 NE PAS exécuter de migration Prisma destructive ou lancer un push
- ✅ PEUT exécuter `pnpm typecheck`, `pnpm vitest run`, `pnpm lint`, `pnpm prisma migrate status` (read-only)
- ✅ PEUT exécuter `gh pr view` pour lire la PR diff
- ✅ PEUT lancer des sub-agents Explore pour paralléliser les phases A-I
- ✅ Garder le contrat stub.invalid intact pendant les vérifications
- ✅ Output final = UNIQUEMENT le rapport markdown dans `_AUDIT/SPRINT-NOTIF-INFRA-2026-05-26/AUDIT-REPORT.md`

---

## Démarrage

1. Lis `axionia/CLAUDE.md` + `axionia/AGENTS.md`
2. Vérifie que la branche `feat/notif-infra-contacts-calendly` est mergée sur main (`git log main --oneline | grep "notif-infra"`)
3. Si pas mergée : reporter via AskUserQuestion « PR pas mergée, audit prématuré, on attend ? »
4. Sinon : lance les 9 sub-agents Explore en parallèle pour phases A-I
5. Convergence Phase J
6. Émettre verdict K + écrire AUDIT-REPORT.md
7. STOP, ne push pas le rapport (Will commit s'il veut)

Durée estimée : 30-60 min (parallélisation des 9 phases via sub-agents).

---

## Phrase à coller dans une nouvelle conversation Claude Code

```
Exécute en mode AUTOPILOT strict l'audit décrit dans axionia/_AUDIT/SPRINT-NOTIF-INFRA-2026-05-26/AUDIT-PROMPT.md. Pas d'édition de code — uniquement lecture, grep, tests read-only. Lance les phases A-I en parallèle via sub-agents Explore, converge en Phase J, et produis le rapport final AUDIT-REPORT.md avec verdict GO PROD / GO CONDITIONNEL / NO-GO et liste priorisée P0/P1/P2 des findings.
```
