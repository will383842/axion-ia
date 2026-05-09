# Pass B — AGT-INTEGRATION (audit final production-ready bout-en-bout)

**Date** : 2026-05-09
**Agent** : AGT-INTEGRATION (audit #5 du Pass B)
**Périmètre** : frontend + backend + console admin, traçabilité bout-en-bout
**Méthode** : lecture-seule, code = SSOT (CLAUDE.md doctrine 2026-05-08)

## TL;DR

**Verdict : NO-GO**

Le pipeline backend (Server Actions / BullMQ / workers / Prisma / Telegram / email) est globalement bien câblé pour 4 des 5 formulaires publics et pour les 14 sections admin. **Mais 3 ruptures bout-en-bout P0 cassent le parcours utilisateur principal** :

1. Le calendrier `/reserver` est totalement déconnecté de la DB (slots = fixtures + submit handler = stub `setTimeout(600)` + `console.warn`).
2. Le double opt-in newsletter RFC 8058 est cassé : tokens générés et envoyés par email mais aucune route ne les consomme côté serveur.
3. Le formulaire `BookingForm.tsx` (chemin alternatif via `/reserver` BookingFlow) n'appelle aucune Server Action — second stub indépendant.

Tant que ces 3 wires ne sont pas branchés, ni la réservation ni la newsletter ne marchent en production.

## Compteurs findings

| Sévérité                          | Count  |
| --------------------------------- | ------ |
| P0 (bloque GO)                    | **5**  |
| P1 (haute, à corriger avant prod) | **6**  |
| P2 (moyenne)                      | **4**  |
| P3 (faible / cosmétique)          | **3**  |
| **Total**                         | **18** |

---

## 1) Tableau N×N — composant frontend ↔ Server Action ↔ DB ↔ Worker ↔ Notification

| Form / UI               | Page                                                          | Component                                         | Server Action                                                                 | DB write                                                                         | Worker               | Email template                              | Telegram tag                                            |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Contact                 | `/[locale]/contact/page.tsx:324`                              | `components/forms/ContactForm.tsx:64`             | `submitContactAction` (`features/contact/actions.ts:20`)                      | `submission` (type=contact)                                                      | email-worker         | `contact-confirmed`                         | `[CONTACT]`                                             |
| Audit (5 steps)         | `/[locale]/audit/page.tsx` (legacy)                           | `components/forms/AuditForm.tsx:111`              | `submitAuditAction` (`features/audit/actions.ts:21`)                          | `submission` (type=audit)                                                        | email-worker         | `audit-confirmed`                           | `[AUDIT]`                                               |
| Audit Demande (6 steps) | `/[locale]/audit/demande/page.tsx:402`                        | `components/forms/AuditRequestForm.tsx:310`       | `submitAuditRequestAction` (`features/audit/actions.ts:86`)                   | `submission` (type=audit)                                                        | email-worker         | `audit-confirmed`                           | `[AUDIT]`                                               |
| Implementation          | `/[locale]/implementation/...`                                | `components/forms/ImplementationForm.tsx:115`     | `submitImplementationAction` (`features/implementation/actions.ts:20`)        | `submission` (type=implementation)                                               | email-worker         | `implementation-confirmed`                  | `[AUTO]`                                                |
| Newsletter              | divers (`guide-ia/page.tsx`)                                  | `components/forms/NewsletterForm.tsx`             | `subscribeNewsletterAction` (`features/newsletter/actions.ts:25`)             | `newsletter_subscribers` (status=pending)                                        | email-worker         | `newsletter-confirm-optin` (marketing=true) | `[NEWSLETTER]` (silent)                                 |
| Newsletter confirm      | **MANQUE** (`/[locale]/confirmation/newsletter` n'existe pas) | —                                                 | **MANQUE** (aucune `confirmNewsletterAction`)                                 | doit faire `confirmedAt=now()`                                                   | —                    | —                                           | —                                                       |
| Newsletter unsubscribe  | `/[locale]/desabonnement/page.tsx:38`                         | inline (token `searchParams`)                     | **MANQUE** (page lit le token mais ne le consomme pas)                        | doit faire `unsubscribedAt=now()`                                                | —                    | —                                           | —                                                       |
| Booking direct          | `/[locale]/reserver/page.tsx:366`                             | `components/calendar/BookingCalendar.tsx:677-708` | **STUB** (`createBookingAction` jamais appelé)                                | aucun                                                                            | aucun                | aucun                                       | aucun                                                   |
| Booking via Flow        | (variante BookingFlow)                                        | `components/forms/BookingForm.tsx:54-64`          | **STUB** (`onSubmit` = `setTimeout(600)` + `console.warn`)                    | aucun                                                                            | aucun                | aucun                                       | aucun                                                   |
| Option 48h              | (forme prévue)                                                | `components/calendar/BookingCalendar.tsx:677-708` | **NON CÂBLÉ** (`postOption48hAction` n'a aucun `import` côté UI)              | aucun                                                                            | aucun                | aucun                                       | aucun                                                   |
| Slots calendrier        | `/[locale]/reserver/page.tsx:22,327`                          | `BookingCalendarLazy`                             | **buildFixtureBookedSlots** (fonction inline)                                 | aucun (fixtures hardcodées)                                                      | —                    | —                                           | —                                                       |
| Admin /options validate | `/[adminPrefix]/options/[id]/OptionActions.tsx:16`            | `OptionActions` client                            | `validateOptionAction` (`features/admin-options/actions.ts:121`)              | tx `bookingOption.update` + `booking.create` + `activityLog.create` (FOR UPDATE) | email-worker         | `option-confirmed-by-admin`                 | `[OPTION CONFIRMÉE]`                                    |
| Admin /options refuse   | idem                                                          | `OptionActions`                                   | `refuseOptionAction` (`features/admin-options/actions.ts:231`)                | tx `bookingOption.update` + libère slot + `activityLog`                          | email-worker         | `option-refused-by-admin`                   | `[OPTION CONFIRMÉE]` (utilise tag confirm, pas REFUSÉE) |
| Admin /blog upsert      | `/[adminPrefix]/blog/BlogForm.tsx`                            | `BlogForm`                                        | `upsertArticleAction` (`features/admin-blog/actions.ts:169`)                  | `article` + `articleTranslation` (×2) + `activityLog`                            | —                    | — (IndexNow ping si publish)                | —                                                       |
| Admin /case-studies     | idem                                                          | `CaseStudyForm`                                   | `upsertCaseStudyAction`                                                       | `case_study` + translations + `activityLog`                                      | —                    | —                                           | —                                                       |
| Admin /help             | idem                                                          | `HelpForm`                                        | `upsertHelpArticleAction`                                                     | `help_article` + translations + `activityLog`                                    | —                    | —                                           | —                                                       |
| Admin /faq              | idem                                                          | `FAQForm`                                         | `upsertFAQAction` / `archiveFAQAction`                                        | `faq` + `activityLog`                                                            | —                    | —                                           | —                                                       |
| Admin /categories       | idem                                                          | `CategoryForm`                                    | `upsertCategoryAction`                                                        | `category` + `activityLog`                                                       | —                    | —                                           | —                                                       |
| Admin /testimonials     | idem                                                          | `TestimonialForm`                                 | `upsertTestimonialAction`                                                     | `testimonial` + `activityLog`                                                    | —                    | —                                           | —                                                       |
| Admin /submissions      | idem                                                          | `SubmissionUpdateForm`                            | `updateSubmissionAction` (`features/admin-submissions/actions.ts:183`)        | `submission.update` + `activityLog`                                              | —                    | —                                           | —                                                       |
| Admin /newsletter       | idem                                                          | inline                                            | actions admin-newsletter                                                      | `newsletter_subscribers.update` (suspend, etc.)                                  | —                    | —                                           | —                                                       |
| Admin /users            | idem                                                          | `CreateUserForm`, `UserActions`                   | `createAdminUserAction`, etc.                                                 | `admin_user` + `activityLog`                                                     | —                    | —                                           | —                                                       |
| Admin /settings         | idem                                                          | `SettingForm`                                     | `upsertSettingAction`                                                         | `setting` + `activityLog`                                                        | —                    | —                                           | —                                                       |
| Admin /activity-logs    | idem                                                          | inline                                            | `listActivityLogsAction`                                                      | lecture seule                                                                    | —                    | —                                           | —                                                       |
| Admin /calendrier       | idem                                                          | `CalendarBlockPanel`                              | `blockSlotAction`, `unblockSlotAction` (`features/admin-calendar/actions.ts`) | `calendar_slot.update` + `activityLog`                                           | —                    | —                                           | —                                                       |
| Admin /login            | `/[adminPrefix]/login/LoginForm.tsx`                          | `LoginForm`                                       | `signInAction` (`features/admin-auth/actions.ts`)                             | NextAuth credentials + `activityLog auth.login.*`                                | —                    | —                                           | —                                                       |
| Admin /2fa/setup        | `/[adminPrefix]/2fa/setup/Setup2FAForm.tsx`                   | `Setup2FAForm`                                    | `setup2FAStartAction` + `setup2FAConfirmAction`                               | `admin_user.update twoFactorEnabled/Secret`                                      | —                    | —                                           | —                                                       |
| Cron expire option      | (worker)                                                      | —                                                 | `option-expiration-worker.ts:38-110`                                          | tx flip status + libère slot (FOR UPDATE)                                        | enqueue email-worker | `option-expired`                            | `[OPTION EXPIRÉE]` (silent)                             |
| Cron rappel H+24        | (worker)                                                      | —                                                 | `option-reminder-worker.ts`                                                   | flag `reminderSentAt`                                                            | enqueue email-worker | `option-reminder`                           | (silent)                                                |
| Sitemap auto            | `app/sitemap.ts`                                              | —                                                 | `getIndexableVilles()` + `getIndexableRegions()` (data files)                 | lecture statique                                                                 | —                    | —                                           | —                                                       |
| Healthz                 | `app/api/healthz/route.ts`                                    | —                                                 | `prisma.$queryRaw` + `redis.ping()`                                           | lecture                                                                          | —                    | —                                           | —                                                       |

---

## 2) Findings P0 (bloque GO)

### P0-1 — `/reserver` calendar est 100 % stub (pas branché à `createBookingAction`)

**Fichier** : `src/components/calendar/BookingCalendar.tsx:677-708`

```ts
function handleSubmit() {
  if (!openSlot) return;
  setSubmittingState("submitting");
  // [booking:submit:stub] — Sprint 17 branchera Server Action + Prisma + Telegram + email.
  if (process.env.NODE_ENV !== "production") {
    console.warn("[booking:submit:stub]", { ... });
  }
}
```

Aucun `import` de `createBookingAction` ou `postOption48hAction` dans le composant. La page `/reserver` (probablement la plus stratégique du business AxionIA — réservation directe) **n'écrit rien en DB, n'envoie aucun email, n'enregistre aucune activité**. La logique métier riche (steps 1-6, calcul de prix `ESSENTIELLE_TIERS`, capture firme + IA) est totalement perdue à la soumission.

**Impact** : tous les visiteurs qui « réservent » via `/reserver` voient un succès UI mais leur réservation est jetée. Will perd 100 % des leads chauds.

### P0-2 — `BookingForm.tsx` (path BookingFlow) est aussi stub

**Fichier** : `src/components/forms/BookingForm.tsx:54-64`

```ts
async function onSubmit(values: BookingInput) {
  setServerError(null);
  try {
    await new Promise((r) => setTimeout(r, 600));
    if (process.env.NODE_ENV !== "production") {
      console.warn("[booking:submit:stub]", values);
    }
  } catch {
    setServerError(labels.failure);
  }
}
```

Une seconde implémentation stub indépendante. Si un jour quelqu'un wire `BookingFlow` au lieu de `BookingCalendar`, la chaîne sera également cassée.

### P0-3 — `/reserver` n'utilise PAS Prisma pour les slots disponibles

**Fichier** : `src/app/[locale]/reserver/page.tsx:22,327`

```ts
function buildFixtureBookedSlots(): BookedSlot[] { ... }
// ...
const bookedSlots = buildFixtureBookedSlots();
```

Les slots affichés au visiteur sont des **fixtures hardcodées**. Le panneau admin `/[adminPrefix]/calendrier` qui appelle `blockSlotAction` met à jour `calendar_slots` en DB, mais rien ne se reflète sur la page publique. Aucun import `prisma.calendarSlot.findMany` dans le code de `/reserver`.

### P0-4 — Newsletter double opt-in : route de confirmation manquante

**Fichier** : `src/lib/email/templates/newsletter-confirm-optin.tsx:45`

```ts
const confirmHref = `${baseUrl}/${locale}/confirmation/newsletter?token=${p.confirmToken}`;
```

Mais aucun fichier n'existe à `src/app/[locale]/confirmation/newsletter/page.tsx` (vérifié — `ls src/app/[locale]/confirmation/` retourne uniquement `page.tsx` qui est la page générique de remerciement). Aucun grep `confirmToken` ne remonte de Server Action `confirmNewsletterAction`. Le flow RFC 8058 est cassé : l'utilisateur clique le lien email → 404.

**Impact** : RGPD non conforme (status reste `pending` indéfiniment, donc pas de consentement valide stocké). Toutes les inscriptions newsletter sont perdues.

### P0-5 — `/desabonnement` lit le token mais ne le consomme pas

**Fichier** : `src/app/[locale]/desabonnement/page.tsx:38-52`
La page récupère `token` via `searchParams` et passe `hasToken` à la vue, mais aucun appel à un `unsubscribeNewsletterAction`. Grep confirme : aucune Server Action ne fait `prisma.newsletterSubscriber.update({ unsubscribedAt: now() })` à partir d'un token.

**Impact** : List-Unsubscribe header / lien email cassé → RFC 8058 non conforme + risque blacklist anti-spam (Gmail / Microsoft refusent les expéditeurs sans unsubscribe fonctionnel).

---

## 3) Findings P1

### P1-1 — Admin /options ne revalide pas `/reserver` après validate/refuse

**Fichier** : `src/features/admin-options/actions.ts:217,324`
Seul `revalidatePath('/fr/<adminPrefix>/options')` appelé. Quand un admin valide ou refuse une option 48h, le slot devient `confirmed`/`available` en DB mais la page publique `/reserver` (bien qu'actuellement en fixtures, P0-3) n'est pas invalidée pour FR ni EN. À corriger en duo avec P0-3.

### P1-2 — Admin /calendrier ne revalide pas /reserver

**Fichier** : `src/features/admin-calendar/actions.ts:176,228`
Quand l'admin bloque un créneau, seul `/fr/<adminPrefix>/calendrier` revalide. `/fr/reserver` et `/en/booking` restent stales (encore une fois en duo avec P0-3).

### P1-3 — `[OPTION REFUSÉE]` tag déclaré mais jamais émis

**Fichier** : `src/lib/telegram.ts:17` déclare le tag, `src/features/admin-options/actions.ts:313` utilise quand même `[OPTION CONFIRMÉE]` avec un commentaire « tag canonical existant — refus est une "decision admin" ». Le tag dédié est mort. Cohérence Telegram dégradée.

### P1-4 — `[ANNULATION]` tag déclaré mais aucun caller

**Fichier** : `src/lib/telegram.ts:19` déclare `ANNULATION`. Grep confirme : 0 occurrence ailleurs. Pas de feature « annulation » exposée nulle part dans le frontend. Soit retirer, soit livrer la fonctionnalité.

### P1-5 — Tiptap éditeur ne sauvegarde que HTML (prompt attendait HTML+JSON+plain)

**Fichier** : `src/components/admin/TiptapEditor.tsx:33,44`
`onUpdate` appelle uniquement `editor.getHTML()` et le binde à un `<input type="hidden">`. Pas d'`getJSON()` ni de plain text. Le schéma Prisma `ArticleTranslation.body` (ligne 321) est un `String @db.Text` simple — donc pas de stockage JSON/plain prévu. Note : c'est cohérent avec la doctrine **code = SSOT** ; je classe en P1 plutôt que P0 car le prompt overshoot sur ce point. Pour FTS la GENERATED column suffit. Mais si l'audit prompt fait foi, il faut soit étendre le schéma soit corriger le prompt.

### P1-6 — Admin actions dependent on `process.env.ADMIN_URL_PREFIX` au runtime

**Fichier** : pattern répété dans `admin-options`, `admin-blog`, `admin-categories`, etc. (`revalidatePath(\`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"}/...\`)`)
Si `ADMIN_URL_PREFIX`change en prod et que le serveur a été buildé avec une autre valeur, les paths revalidés seront désynchronisés. À encapsuler dans un helper`adminPath()`qui lit la valeur runtime sécurisée, ou à figer en build-time via`NEXT_PUBLIC_ADMIN_URL_PREFIX`.

---

## 4) Findings P2

### P2-1 — Ops Telegram tags `DEPLOY/INCIDENT/BACKUP/MONITORING/SECURITY` zéro caller

**Fichier** : `src/lib/telegram.ts:78-97` exporte `alertOps()` et `alertIncident()`. Grep dans `src/` ET `scripts/` : zéro import. Sprint 23 prévoyait l'instrumentation ops mais le code instrumenté n'a pas été livré. **5 / 5 tags ops orphelins**.

### P2-2 — `searchIndexerQueue` orpheline

**Fichier** : `src/server/queue/queues.ts:46`
Queue déclarée, type `SearchIndexerJobData` exporté, mais aucun enqueue, aucun worker. À supprimer ou implémenter.

### P2-3 — `newsletterQueue` orpheline

**Fichier** : `src/server/queue/queues.ts:41`
Idem : queue déclarée, jamais utilisée. La newsletter campaign V1 n'est pas livrée.

### P2-4 — Admin /options activity log absent dans option-expiration-worker

**Fichier** : `src/server/queue/workers/option-expiration-worker.ts`
Le worker flip une option à `expired` et libère un slot mais **ne crée pas d'`activityLog`**. Trace d'audit incomplète : un admin qui audite l'historique d'une option ne verra pas qu'elle a expiré automatiquement (vs validate/refuse qui sont loggés).

---

## 5) Findings P3

### P3-1 — Tests d'intégration ne testent que des schémas Zod

**Fichier** : `tests/integration/server-actions.test.ts:1-20` (commentaire) admet : « V1 minimal : on verifie les schemas Zod + helpers (pas les mutations DB reelles qui exigent un setup test DB dedie) ». Aucun test ne valide la chaîne `Server Action → Prisma → BullMQ → Telegram → Mailhog`. À durcir Sprint 22+.

### P3-2 — `email-worker` ne distingue pas marketing dans les logs

**Fichier** : `src/server/queue/workers/email-worker.ts:33-35`
Logs `console.log` génériques sans tagger transactionnel vs marketing. Pour le diag prod (notamment si `news@` blacklisté vs `noreply@` clean), c'est utile.

### P3-3 — `IndexNow` ping cabré sur `/api/indexnow` sans auth

**Fichier** : `src/features/admin-blog/actions.ts:297-301`
Ping fire-and-forget non authentifié vers le propre endpoint. La route `/api/indexnow` est publique (Edge runtime). Risque : un attaquant peut spammer ce endpoint pour ping IndexNow avec des URLs arbitraires de notre site (deindex). Vérifier que la route refuse `urls` qui ne matchent pas `SITE_HOST`.

---

## 6) Cross-checks critiques (résultats)

### a) `Header.tsx` → /reserver → form → action → DB → email → telegram

- ✅ `Header.tsx:136,191` link href=/reserver
- ✅ `/[locale]/reserver/page.tsx` existe (Next 16 page)
- ✅ Form rendu via `BookingCalendarLazy`
- ❌ **CASSÉ** : `BookingCalendar.tsx:685` est un stub `console.warn` (P0-1)
- ❌ Aucun écriture DB
- ❌ Aucun email enqueue
- ❌ Aucun Telegram

**Verdict** : la chaîne la plus stratégique du site est cassée à 100 % côté client.

### b) Admin /options validate → DB UPDATE FOR UPDATE → email → telegram → revalidatePath

- ✅ `OptionActions.tsx:16` câble `validateOptionAction`
- ✅ `validateOptionAction` (`actions.ts:144-202`) fait `SELECT FOR UPDATE` puis tx avec `bookingOption.update` + `booking.create` + `activityLog`
- ✅ `enqueueEmail("option-confirmed-by-admin", ...)` ligne 210
- ✅ `sendTelegram({tag:"OPTION CONFIRMÉE", ...})` ligne 205
- ⚠️ **PARTIEL** : `revalidatePath` ligne 217 revalide UNIQUEMENT `/fr/<adminPrefix>/options` ; ne touche ni `/en/<adminPrefix>/options` (admin FR-only OK) ni `/fr/reserver` ni `/en/booking` (P1-1 + P0-3 pour les slots)

**Verdict** : pipeline backend fonctionnel, propagation publique manquante.

### c) Newsletter double opt-in /newsletter → token email → /confirm → confirmedAt

- ✅ Form `NewsletterForm.tsx` câble `subscribeNewsletterAction`
- ✅ Action génère `confirmToken` + `unsubscribeToken`, upsert pending, enqueue email `newsletter-confirm-optin`
- ✅ Email render avec `confirmHref` vers `/confirmation/newsletter?token=...`
- ❌ **CASSÉ** : route `/confirmation/newsletter` n'existe pas (P0-4)
- ❌ Aucun `confirmNewsletterAction` dans le repo
- ❌ `/desabonnement?token=...` est stale : page lit le token mais ne le consomme pas (P0-5)

**Verdict** : flow opt-in/out cassé bout-en-bout. Non conforme RFC 8058 ni RGPD.

---

## 7) Top 10 wires manquants ou cassés (priorisé)

| #   | Wire                                                                                      | Sévérité | Fichier impliqué                                      |
| --- | ----------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------- |
| 1   | `BookingCalendar.tsx:handleSubmit` → `createBookingAction`                                | P0       | `src/components/calendar/BookingCalendar.tsx:677-708` |
| 2   | `BookingCalendar.tsx` → `postOption48hAction` (path option 48h)                           | P0       | idem                                                  |
| 3   | `/reserver` page → `prisma.calendarSlot.findMany` (remplacer fixtures)                    | P0       | `src/app/[locale]/reserver/page.tsx:22,327`           |
| 4   | Route `/[locale]/confirmation/newsletter` → `confirmNewsletterAction`                     | P0       | à créer (manque)                                      |
| 5   | `/desabonnement` → `unsubscribeNewsletterAction`                                          | P0       | `src/app/[locale]/desabonnement/page.tsx`             |
| 6   | `BookingForm.tsx:onSubmit` (variante BookingFlow) → `createBookingAction`                 | P0       | `src/components/forms/BookingForm.tsx:54-64`          |
| 7   | `validateOptionAction` / `refuseOptionAction` → revalidate `/fr/reserver` + `/en/booking` | P1       | `src/features/admin-options/actions.ts:217,324`       |
| 8   | Admin /calendrier blockSlotAction → revalidate /reserver                                  | P1       | `src/features/admin-calendar/actions.ts:176,228`      |
| 9   | Tag `[OPTION REFUSÉE]` réellement émis (vs réutiliser `[OPTION CONFIRMÉE]`)               | P1       | `src/features/admin-options/actions.ts:313`           |
| 10  | `alertOps()` / `alertIncident()` callers (déploiement, healthz failure, backup KO)        | P2       | `src/lib/telegram.ts` orphelin                        |

---

## 8) Verdict final

| Axe                                         | État                 | Note                                            |
| ------------------------------------------- | -------------------- | ----------------------------------------------- |
| Server Actions wiring (formulaires publics) | 4/5 OK               | Booking 100 % stub (P0×3)                       |
| Admin → DB (14 sections)                    | 14/14 câblées        | OK                                              |
| BullMQ pipeline (queues + workers)          | 3/5 utilisées        | 2 queues orphelines (P2)                        |
| i18n parity emails (10 templates × FR/EN)   | 20/20 présents       | OK                                              |
| Telegram tags business (10 attendus)        | 7/10 émis activement | 3 tags morts (P1×2 + P2)                        |
| Telegram tags ops (5 attendus)              | 0/5 émis             | P2-1 entier                                     |
| CMS Tiptap (3 sections)                     | HTML uniquement      | P1-5                                            |
| Auth flow (middleware + 2FA + activity log) | OK                   | bien géré                                       |
| Pessimistic locking (`SELECT FOR UPDATE`)   | OK partout           | calendar_slots + bookings_options               |
| Healthz pipeline                            | OK                   | DB + Redis vérifiés                             |
| Sitemap auto-generation pSEO                | OK                   | `getIndexableVilles/Regions` chunké par région  |
| JSON-LD cohérence                           | OK                   | factories `lib/seo.ts` utilisées dans 20+ pages |
| Newsletter double opt-in (RFC 8058)         | CASSÉ                | P0-4 + P0-5                                     |

### Décision : **NO-GO** prod tant que les 5 P0 ne sont pas levés.

**Estimation effort minimal pour passer en CONDITIONAL GO** :

- P0-1 / P0-2 / P0-6 (booking submit branchement) : ~4-6 h (déjà tout côté backend prêt)
- P0-3 (slots Prisma sur /reserver) : ~2 h
- P0-4 / P0-5 (newsletter confirm/unsubscribe routes + actions) : ~3 h
- **Total minimal pour CONDITIONAL GO** : ~10-12 h dev focalisé

Une fois les P0 levés et un test end-to-end manuel passé sur les 5 forms + admin /options + cron expiration, le verdict pourra passer à **CONDITIONAL GO** (sous réserve de lever les P1-1, P1-2, P1-3 dans le sprint suivant).

Pour atteindre **GO** sans réserve, il faut aussi :

- Lever les 6 P1 (notamment revalidatePath public-facing, tag REFUSÉE, helper adminPath)
- Décider sur P1-5 (Tiptap : étendre schéma ou corriger prompt)
- Implémenter au moins les callers ops Telegram critiques (P2-1 — minimum INCIDENT et BACKUP)

Fin du rapport.
