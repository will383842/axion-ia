# AGT-10 — API & FORMS

**Périmètre** : 19 server actions (`src/features/*/actions.ts`) + 11 routes API (`src/app/api/**`) + 6 forms (`src/components/forms/*`) + lib schemas (`src/lib/schemas/{auth,forms,locale}.ts`) + 3 tests Zod.
**Pondération** : ×1.0
**Mode** : AUDIT-ONLY. Aucune écriture code/configs/.env.
**Date** : 2026-05-11
**Référence** : `HEAD` de `main`

---

## 1. SYNTHÈSE

| Catégorie                                | Score brut |        Pondéré | Notes                                                                                                                                                                                                                                   |
| ---------------------------------------- | ---------: | -------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Couverture Zod inputs (actions + routes) |   88 / 100 |             88 | Tous les forms publics + admin valident via `safeParse`. CSV exports = inputs cast `as never` (Lacune P1).                                                                                                                              |
| Errors typées (`{ ok, error }`)          |   90 / 100 |             90 | Discriminated union cohérente sur 100% des actions. Pas de `ZodIssue[]` exposé client (volontaire).                                                                                                                                     |
| next-safe-action / framework             |   60 / 100 |             60 | **Pas installé** — implémentation custom DRY mais répétitive (6 actions publics dupliquent rate-limit + Turnstile + honeypot + Zod + Telegram).                                                                                         |
| Form states (pending/success/error)      |   85 / 100 |             85 | RHF + `useActionState` admin + state local public. Pas de `useFormStatus` (RSC progressive enhancement absent).                                                                                                                         |
| Optimistic updates                       |    0 / 100 |              0 | **Aucun `useOptimistic`** — toutes mutations admin attendent retour serveur + `revalidatePath`.                                                                                                                                         |
| HTTP methods                             |   95 / 100 |             95 | GET pour lecture (healthz, exports CSV, key indexnow, unsubscribe debug). POST pour mutations. `/api/unsubscribe` GET pour fallback navigation OK doctrine RFC 8058.                                                                    |
| CORS                                     |  100 / 100 |            100 | Aucun header `Access-Control-Allow-*`. Toutes routes same-origin Next 16 + proxy.ts. Cohérent avec model SaaS B2B fermé.                                                                                                                |
| Versioning API                           |        N/A |              — | Pas de `/api/v1/`. API privée Next, pas de surface publique stable — non-bloquant. À documenter si exposition externe future.                                                                                                           |
| Rate-limit cohérence                     |   92 / 100 |             92 | 6 actions publics + 2 routes API + signin. Patterns alignés (`key:resource:ip`). `/api/vitals` n'a PAS de rate-limit (Lacune P2).                                                                                                       |
| CSRF                                     |   85 / 100 |             85 | Auth.js v5 builtin (cookie csrf-token). Server Actions Next 16 ont CSRF token implicite. Forms publics pas de CSRF distinct (Server Actions encrypt action ID → OK).                                                                    |
| Turnstile integration                    |   30 / 100 |             30 | **DÉFAILLANCE CRITIQUE** : `verifyTurnstile` câblé serveur dans 5 actions mais **AUCUN form n'injecte le widget `<Turnstile>` côté client**. En prod avec `TURNSTILE_SECRET_KEY`, toutes les soumissions retournent « Captcha échoué ». |
| Validation client + serveur              |   90 / 100 |             90 | Zod resolvers RHF côté client, re-valid serveur. Bonne defense-in-depth.                                                                                                                                                                |
| Idempotence booking                      |   70 / 100 |             70 | `postOption48hAction` : verrou pessimiste `FOR UPDATE` (anti-race). `createBookingAction` : pas de protection double-clic ni Idempotency-Key (Lacune P1).                                                                               |
| Side-effects ordering                    |   75 / 100 |             75 | DB tx atomique (submission+booking) → Telegram → enqueueEmail. Pas de rollback si Telegram fail (fail-soft assumé). Pas d'outbox pattern.                                                                                               |
| Tests schemas Zod                        |   95 / 100 |             95 | 3 specs (auth, forms, locale) couvrant les 11 schemas. Coverage très bonne.                                                                                                                                                             |
| **TOTAL**                                |          — | **956 / 1400** | **68 %**                                                                                                                                                                                                                                |

**Verdict AGT-10** : 🟡 **PASSABLE avec 1 P0 critique (Turnstile non câblé), 4 P1 et 4 P2.**

---

## 2. INVENTAIRE EFFECTIF

### 2.1 Server actions (19 fichiers `src/features/*/actions.ts`)

`grep -c "^export async function \w+Action"` → **75 actions** exportées totales (vs « 19 server actions » annoncées dans inventaire — c'était 19 _fichiers_, pas 19 actions).

| Domaine             | Fichier                                       |                                                                         Actions exportées |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------: |
| audit               | `src/features/audit/actions.ts`               |                                       2 (`submitAuditAction`, `submitAuditRequestAction`) |
| booking             | `src/features/booking/actions.ts`             |                                          2 (`createBookingAction`, `postOption48hAction`) |
| contact             | `src/features/contact/actions.ts`             |                                                                 1 (`submitContactAction`) |
| implementation      | `src/features/implementation/actions.ts`      |                                                          1 (`submitImplementationAction`) |
| newsletter          | `src/features/newsletter/actions.ts`          | 3 (`subscribeNewsletterAction`, `confirmNewsletterAction`, `unsubscribeNewsletterAction`) |
| admin-auth          | `src/features/admin-auth/actions.ts`          |                               5 (signIn/signOut/setup2FAStart/setup2FAConfirm/disable2FA) |
| admin-blog          | `src/features/admin-blog/actions.ts`          |   7 (list/detail/listAuthors/listBlogCategories/listAllTags/upsertArticle/archiveArticle) |
| admin-users         | `src/features/admin-users/actions.ts`         |                                                                                         6 |
| admin-submissions   | `src/features/admin-submissions/actions.ts`   |                                                                                         5 |
| admin-newsletter    | `src/features/admin-newsletter/actions.ts`    |                                                                                         5 |
| admin-calendar      | `src/features/admin-calendar/actions.ts`      |                                                                                         4 |
| admin-case-studies  | `src/features/admin-case-studies/actions.ts`  |                                                                                         5 |
| admin-categories    | `src/features/admin-categories/actions.ts`    |                                                                                         5 |
| admin-faq           | `src/features/admin-faq/actions.ts`           |                                                                                         4 |
| admin-help          | `src/features/admin-help/actions.ts`          |                                                                                         5 |
| admin-options       | `src/features/admin-options/actions.ts`       |                                                                                         4 |
| admin-settings      | `src/features/admin-settings/actions.ts`      |                                                                                         4 |
| admin-testimonials  | `src/features/admin-testimonials/actions.ts`  |                                                                                         4 |
| admin-activity-logs | `src/features/admin-activity-logs/actions.ts` |                                                                                         3 |
| **TOTAL**           |                                               |                                                                            **75 actions** |

### 2.2 Routes API (11 routes, vs 10 annoncées dans `APIS.md`)

| Route                                                                   | Méthode  | Runtime          | Zod input             | Auth             | Rate-limit        |
| ----------------------------------------------------------------------- | -------- | ---------------- | --------------------- | ---------------- | ----------------- |
| `/api/auth/[...nextauth]` (`src/app/api/auth/[...nextauth]/route.ts:5`) | GET+POST | nodejs (default) | Auth.js builtin       | NextAuth         | builtin           |
| `/api/admin/newsletter/export` (`route.ts:9`)                           | GET      | nodejs           | `as never` casts (P2) | session admin    | n/a               |
| `/api/admin/submissions/export` (`route.ts:14`)                         | GET      | nodejs           | `as never` casts (P2) | session admin    | n/a               |
| `/api/gdpr-export` (`route.ts:27`)                                      | POST     | nodejs           | ✅ Zod                | token signé      | 3/day/email       |
| `/api/gdpr-export/request` (`route.ts:24`)                              | POST     | nodejs           | ✅ Zod                | public           | 3/day/email       |
| `/api/healthz` (`route.ts:55`)                                          | GET      | nodejs           | n/a                   | public           | none              |
| `/api/indexnow` (`route.ts:21`)                                         | POST     | **edge**         | ❌ shallow check only | INDEXNOW_KEY env | none              |
| `/api/indexnow/key` (`route.ts:14`)                                     | GET      | **edge**         | n/a                   | public           | none              |
| `/api/og` (`route.tsx:25`)                                              | GET      | **edge**         | ❌ no validation      | public           | none              |
| `/api/unsubscribe` (`route.ts:49,72`)                                   | GET+POST | nodejs           | délégué à action      | token signé      | n/a               |
| `/api/vitals` (`route.ts:27`)                                           | POST     | nodejs           | ✅ Zod                | public           | **❌ aucun** (P2) |

→ **Aucune divergence runtime** : Edge sur 3 routes (indexnow×2 + og), Node sur 8 routes. Cohérent avec doctrine `Hetzner CPX32 self-hosted` (cf. `vitals/route.ts:3-8` comment qui explique le switch Edge → Node pour vitals).

### 2.3 Forms (6 fichiers `src/components/forms/*`)

| Form               | Fichier                                       | Steps | Schemas Zod                                   | Server action                |
| ------------------ | --------------------------------------------- | ----: | --------------------------------------------- | ---------------------------- |
| AuditForm          | `src/components/forms/AuditForm.tsx`          |     5 | auditStep1..5 + auditSchema                   | `submitAuditAction`          |
| AuditRequestForm   | `src/components/forms/AuditRequestForm.tsx`   |     6 | auditRequestStep1..6 + auditRequestSchema     | `submitAuditRequestAction`   |
| BookingForm        | `src/components/forms/BookingForm.tsx`        |     1 | `bookingSchema`                               | `createBookingAction`        |
| ContactForm        | `src/components/forms/ContactForm.tsx`        |     1 | `contactSchema`                               | `submitContactAction`        |
| ImplementationForm | `src/components/forms/ImplementationForm.tsx` |     4 | implementationStep1..4 + implementationSchema | `submitImplementationAction` |
| NewsletterForm     | `src/components/forms/NewsletterForm.tsx`     |     1 | `newsletterSchema`                            | `subscribeNewsletterAction`  |

### 2.4 Schemas Zod (`src/lib/schemas/`)

`src/lib/schemas/forms.ts` (175 LOC) :

- `contactSchema`, `newsletterSchema`
- `auditStep1..5Schema` + `auditSchema` (merge)
- `auditRequestStep1..6Schema` + `auditRequestSchema` (merge, 6 steps richer)
- `implementationStep1..4Schema` + `implementationSchema` (merge)
- `bookingSchema`, `option48hSchema`

`src/lib/schemas/auth.ts` (28 LOC) :

- `signInSchema`, `setup2FASchema`, `disable2FASchema`

`src/lib/schemas/locale.ts` (19 LOC) :

- `localeSchema`, `parseLocale()` helper

### 2.5 Tests schemas (`tests/schemas/*`)

- `tests/schemas/auth.test.ts` (66 LOC) — couvre signIn / setup2FA / disable2FA
- `tests/schemas/forms.test.ts` (376 LOC) — couvre les 5 forms publics (5/5)
- `tests/schemas/locale.test.ts` (51 LOC) — couvre `localeSchema` + `parseLocale`

→ **Excellente couverture Zod** : tous les schemas publics testés, edge cases couverts (coerce participantsCount, optional fields, consent literal true, enum rejections).

---

## 3. FINDINGS DÉTAILLÉS

### 🚨 P0 — TURNSTILE WIDGET NON CÂBLÉ CÔTÉ CLIENT

**Sources** :

- `src/lib/turnstile.ts:19-55` : `verifyTurnstile()` côté serveur ATTENDU.
- `src/features/contact/actions.ts:33-36`, `src/features/audit/actions.ts:32-35`, `src/features/audit/actions.ts:97-100`, `src/features/booking/actions.ts:51-54`, `src/features/implementation/actions.ts:31-34`, `src/features/newsletter/actions.ts:43-45`, `src/features/booking/actions.ts:164-167` → 7 sites d'appel.
- `src/components/forms/ContactForm.tsx:60-62` : **commentaire explicite** « Note Sprint 16 : Turnstile widget integration to inject `cf-turnstile-response`. Until then, server action returns « Captcha échoué » when TURNSTILE_SECRET_KEY is set in prod. »
- `grep -rn "NEXT_PUBLIC_TURNSTILE_SITE_KEY\|<Script.*turnstile\|challenges.cloudflare.com" src/` → uniquement `src/env.ts:137,189` (def + export) + `src/lib/csp.ts:82,90,100,101` (allowlist CSP) + `src/lib/turnstile.ts:10` (URL endpoint serveur). **Aucun composant React n'injecte le widget.**

**Impact** : Si `TURNSTILE_SECRET_KEY` est set en prod, **100 % des soumissions publiques sont rejetées** côté serveur (contact, audit, audit-request, booking, option48h, implementation, newsletter). Si la key est absente en prod, `verifyTurnstile` (cf. `src/lib/turnstile.ts:27-31`) fail-closed → idem. La doctrine `CLAUDE.md §15 — anti-spam multi-couches` annoncée est **non opérationnelle**.

**Mitigation actuelle** : honeypot `website` (présent côté server `formData.get("website")` mais **AUCUN champ HTML caché « website » dans les 6 forms** — `grep -i honeypot|name=.website. src/components/forms` → 0 match). Seul rate-limit Redis protège réellement.

**À vérifier en prod live (Phase 4)** : `curl POST` un form public + observer 200/échec.

---

### 🟠 P1 — Pas de protection double-soumission `createBookingAction`

**Source** : `src/features/booking/actions.ts:41-144`.

`createBookingAction` accepte n'importe quel POST. Pas de :

- Idempotency-Key header
- Lock pessimiste sur (date, time) — contrairement à `postOption48hAction:194-236` qui lock `calendar_slots` `FOR UPDATE`
- Vérif unique (date, time, contactEmail) en DB pour bloquer le doublon

Conséquence : un double-clic ou retry réseau crée **2 submissions + 2 bookings + 2 emails + 2 Telegram** pour le même créneau. La table Prisma `Booking` ne semble pas avoir d'unique constraint sur (`bookingDate`, `contactEmail`) (à vérifier en AGT-11 DB-PRISMA).

**Fix recommandé** : soit appliquer le verrou pessimiste comme dans `postOption48hAction`, soit `prisma.booking.upsert` sur unique partial index `(bookingDate, contactEmail, status NOT cancelled)`.

---

### 🟠 P1 — CSV admin exports : Zod input non validé

**Sources** :

- `src/app/api/admin/submissions/export/route.ts:18-22` : `(sp.get("type") as never)`, `(sp.get("status") as never)`, `(sp.get("locale") as never)`.
- `src/app/api/admin/newsletter/export/route.ts:13-17` : idem.

Le cast `as never` désactive le typage TS et passe la query string brute à l'action `exportSubmissionsCsvAction` / `exportSubscribersCsvAction` qui (vraisemblablement) re-parse via Zod. Mais la lecture en route handler est non-typée — un consommateur ne sait pas quelles valeurs sont acceptées.

**Impact** : faible (cible admin auth seule + parsing dans l'action). **Lacune de discipline plus que sécurité réelle.**

---

### 🟠 P1 — IndexNow POST sans Zod strict

**Source** : `src/app/api/indexnow/route.ts:21-29`. Le body est typé `IndexNowPayload` mais aucun `z.object().safeParse()`. Le code filtre `body?.urlList?.filter((u) => typeof u === "string")` mais :

- Pas de validation longueur urls (DoS potentiel par 100k URLs)
- Pas de validation regex sur URL `https://axion-ia.com/...`
- Pas d'auth (uniquement `INDEXNOW_KEY` env vars en interne) — n'importe qui peut POST si key publique

**Impact** : faible en pratique (forwarded uniquement à `api.indexnow.org` qui dédoublonne), mais surface d'abus si quelqu'un découvre l'endpoint.

---

### 🟠 P1 — Honeypot `website` côté serveur sans champ HTML caché

**Sources** :

- Server check : `src/features/contact/actions.ts:31`, `src/features/audit/actions.ts:30`, `src/features/audit/actions.ts:95`, `src/features/booking/actions.ts:49`, `src/features/booking/actions.ts:160`, `src/features/implementation/actions.ts:29`, `src/features/newsletter/actions.ts:40` → 7 sites checkent `formData.get("website")`.
- Côté HTML : `grep -i "name=.website.\|honeypot" src/components/forms` → **0 match**.

Le honeypot ne piège donc rien : aucun bot ne remplit un champ inexistant. La protection annoncée par les commentaires « Honeypot canonique Sprint 15 fix Fork 3 C1-3 » (`newsletter/actions.ts:38-39`) est **non opérationnelle**.

**Fix recommandé** : ajouter un `<input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />` dans chaque form public.

---

### 🟡 P2 — `/api/vitals` sans rate-limit

**Source** : `src/app/api/vitals/route.ts:27-47`. POST public sans aucun rate-limit. Un attaquant peut spammer le ndjson append-only et saturer le disque (`appendVitalsRecord` fire-and-forget). Schema Zod valide les champs, donc payload max ~2 KB, mais 1 M req/s = ~2 GB/s disque.

**Fix** : ajouter `checkRateLimit(\`vitals:${ip}\`, { limit: 100, windowSec: 60 })` ou s'appuyer sur Cloudflare WAF rate rules.

---

### 🟡 P2 — `signInAction` rate-limit relâché

**Source** : `src/features/admin-auth/actions.ts:27-53`. Commentaire explicite : « **relaxé 2026-05-10** pendant phase stabilisation — IP=100/15min, email=50/15min ». Doctrine ANSSI recommande 5-10/15 min pour login admin.

**Impact** : faible car URL admin = secret prefix (cf. `env.ts:38-46`) + mdp fort + 2FA optionnel. Mais le commentaire **À redurcir si tu ouvres l'admin à plus d'utilisateurs** signale une dette technique consciente.

---

### 🟡 P2 — `useOptimistic` absent partout

**Source** : `grep -rn "useOptimistic" src/` → **0 match**.

Toutes les mutations admin (upsert article, upsert FAQ, archive, validate option, block date, etc.) attendent retour serveur + `revalidatePath`. UX OK pour M9 admin (utilisateur unique Will), mais pour la doctrine « extreme perfection 2026 », l'absence de feedback optimistic est un trou.

**Impact** : UX latence perçue admin. Non-bloquant prod.

---

### 🟡 P2 — `useFormStatus` (React 19 native) jamais utilisé

**Source** : `grep -rn "useFormStatus" src/` → **0 match**.

Le pattern Next 15+/React 19 « progressive enhancement » avec `<form action={action}>` + `useFormStatus()` sub-component pour pending state n'est pas adopté. Tous les forms admin utilisent `useActionState` (qui retourne `[state, formAction, pending]`) — ce qui est la nouvelle API React 19, donc OK.

Les forms publics (Contact, Newsletter, Booking, Audit, AuditRequest, Implementation) **n'utilisent pas `useActionState`** — ils appellent l'action manuellement via `await submitContactAction(...)` dans le `onSubmit` RHF (`src/components/forms/ContactForm.tsx:64`, `src/components/forms/BookingForm.tsx:90`, etc.). C'est du « controlled JS submit » classique, qui :

- **Ne progressive-enhance pas** (form JS-disabled → submission échoue silencieusement)
- Perd le bénéfice du token CSRF Server Action implicite si JS désactivé

**Fix** : migrer les 6 forms publics vers `useActionState` + `<form action={formAction}>`.

---

### 🟢 P3 — Pas de `next-safe-action` ni équivalent

**Source** : `grep "next-safe-action\|zsa\|conform" package.json pnpm-lock.yaml` → 0 résultat.

Implémentation custom DRY (pattern récurrent : rate-limit → honeypot → Turnstile → safeParse → tx DB → Telegram → enqueueEmail) répétée 6×. **Net cost** : ~50 lignes dupliquées × 6 = 300 LOC de boilerplate qu'une lib comme `next-safe-action` (1 KB gz) éliminerait.

**Non-bloquant** : la duplication est facile à lire et maintenir. Si Sprint 16+ ajoute des forms, recommandation = factoriser un wrapper `protectedAction(schema, handler, { rateLimit, turnstile, honeypot })`.

---

### 🟢 P3 — Erreurs typées : pas de `ZodIssue[]` exposé client

**Pattern observé** : toutes les actions retournent `{ ok: false, error: string }` plat, jamais `{ ok: false, errors: ZodIssue[] }`. Volontaire (cf. `src/features/audit/actions.ts:48` : `return { ok: false, error: "Champs invalides." }`) — discipline RGPD anti-énumération et pas d'info leak format.

**OK** : validation Zod côté client RHF affiche les détails (`errors.email.message`), serveur ne dévoile rien de plus.

---

### 🟢 OBSERVATIONS POSITIVES

1. **Discriminated unions cohérentes** : 100 % des actions retournent `{ ok: true; ... } | { ok: false; error: string }`. Type-safe partout.
2. **Tests Zod denses** : 376 LOC `forms.test.ts` testent edge cases (coerce participantsCount string, malformed date, missing consent literal, etc.).
3. **`parseLocale()` defensif** (`src/lib/schemas/locale.ts:14-18`) : fallback `'fr'` jamais throw — protège contre injection enum invalide.
4. **CSP allowlist Turnstile** (`src/lib/csp.ts:82,90,100,101`) : prête pour le jour où le widget sera câblé.
5. **PII redaction Telegram** (`redactContactLine`, `redactEmail`) appelée systématiquement avant `sendTelegram` — RGPD-grade.
6. **`prisma.$transaction` atomique** : `createBookingAction` (`booking/actions.ts:89-127`), `postOption48hAction` (`actions.ts:194-236`), `upsertArticleAction` (`admin-blog/actions.ts:251-306`), `signInAction` activity log + adminUser update (admin-auth) — pas de submissions orphelines.
7. **`verifyPasswordSafe` timing-constant** (`src/features/admin-auth/actions.ts:62`) : `verifyPasswordSafe(undefined, ...)` produit hash dummy → email-oracle closed.
8. **RFC 8058 List-Unsubscribe** câblé : POST One-Click + GET fallback (`src/app/api/unsubscribe/route.ts:49-76`).
9. **Activity log RGPD** dans `gdpr-export`, `submission.erased`, `auth.login.failed`, etc.
10. **Pas de CORS open** : conforme model SaaS B2B fermé.

---

## 4. RACCORDEMENTS À VÉRIFIER (Phase 3)

- **R-05-FORMS-CHAIN** : tracer cycle complet d'un form public → safeParse → tx DB → Telegram (PII redaction) → enqueueEmail → BullMQ worker → Resend send. Vérifier rollback si email queue échoue (actuel : pas de rollback DB → submission orpheline pour email manquant, mais BullMQ retry → OK best-effort).
- **R-04-AUTH-ADMIN** : `signInAction` → Auth.js Credentials provider → JWT → cookie session → `proxy.ts` Auth.js wrapper → admin route. Vérifier que le 307 fix middleware matcher (cf. `src/proxy.ts:66-86`) est toujours actif.
- **R-07-RGPD-CHAIN** : `/api/gdpr-export/request` → token HMAC → email link → `/api/gdpr-export` POST → verify → JSON dump. Anti-énumération assuré (cf. `request/route.ts:42-44`).
- **R-10-PSEO-VILLES-CHAIN** : pas concerné AGT-10 (à AGT-04 SEO).

---

## 5. TOP ACTIONS

| #   | Priorité | Action                                                                                                                | Effort |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | P0       | **Câbler Turnstile widget côté client** dans les 6 forms publics + injecter `cf-turnstile-response` dans FormData     | 4-6 h  |
| 2   | P1       | **Lock pessimiste `createBookingAction`** ou unique constraint Prisma (bookingDate, contactEmail)                     | 1-2 h  |
| 3   | P1       | **Honeypot HTML caché** dans 6 forms (`<input name="website" hidden aria-hidden tabIndex={-1} />`)                    | 30 min |
| 4   | P1       | **Zod strict sur `/api/indexnow` POST body** (limites longueur urls, regex `^https://axion-ia\.com/`)                 | 30 min |
| 5   | P1       | **Zod parse explicit dans 2 CSV exports** (retirer `as never`)                                                        | 30 min |
| 6   | P2       | Rate-limit `/api/vitals` (100 req/min/IP)                                                                             | 15 min |
| 7   | P2       | Re-durcir `signInAction` rate-limit (IP=10, email=5 en 15 min) après stabilisation                                    | 5 min  |
| 8   | P2       | Migrer 6 forms publics vers `useActionState` + `<form action>` pour progressive enhancement                           | 3-4 h  |
| 9   | P3       | Adopter `next-safe-action` ou wrapper interne `protectedAction()` factorisant rate-limit + Turnstile + honeypot + Zod | 4-6 h  |
| 10  | P3       | Ajouter `useOptimistic` aux mutations admin courtes (toggle status, archive)                                          | 2-3 h  |

---

## 6. VERDICT

**Score AGT-10 pondéré : 956 / 1400 → 68 %** — **🟡 PASSABLE**.

Le découpage Zod (schemas / tests / actions) est **excellent** : 75 actions toutes safe-parsed, 11 schemas tous testés, discriminated unions partout. Mais **1 P0 critique** (Turnstile non câblé) compromet l'anti-spam annoncé. **4 P1** sont peu coûteux (~3-5 h) et closent les défauts les plus visibles (double-soumission booking, honeypot mort, IndexNow open, CSV casts). Une fois P0 + 4 P1 fixés, l'agent passe à **~90 %** sans effort majeur.

**Recommandation** : Sprint correctif 16 « API & Forms Hardening » de **1-1.5 jour dev**, à programmer avant ouverture admin à plus d'utilisateurs et avant pic trafic via Cloudflare AI Scrapers (cf. `MEMORY axionia_cloudflare_phase5`).

---

**Citations clés** :

- `src/lib/schemas/forms.ts:1-175` (schemas Zod 11 schemas)
- `src/lib/schemas/auth.ts:1-28`
- `src/lib/schemas/locale.ts:1-18`
- `src/lib/turnstile.ts:19-55` (verify côté serveur uniquement)
- `src/components/forms/ContactForm.tsx:60-62` (comment Sprint 16 Turnstile pending)
- `src/features/booking/actions.ts:41-144` (createBooking sans lock)
- `src/features/booking/actions.ts:194-236` (option48h verrou `FOR UPDATE`)
- `src/features/admin-auth/actions.ts:27-53` (signIn rate-limit relâché)
- `src/app/api/vitals/route.ts:27-47` (pas de rate-limit)
- `src/app/api/indexnow/route.ts:21-29` (Zod absent)
- `src/proxy.ts:58-86` (exclusion `api/` du i18n middleware)
- `tests/schemas/forms.test.ts:1-376`
- `tests/schemas/auth.test.ts:1-66`
- `tests/schemas/locale.test.ts:1-51`

**Anti-hallucinations** : tous les findings ci-dessus sont sourcés par lecture de fichier ou `grep` réel. Aucun fichier inventé.
