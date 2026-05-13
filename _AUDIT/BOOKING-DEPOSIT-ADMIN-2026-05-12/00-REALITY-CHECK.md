# 00 — Reality Check · Audit Booking Deposit + Admin 2026

**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742`
**Branch** : `main`
**Date d'audit** : 2026-05-12
**Mode** : 🚫 AUDIT-ONLY (lecture-seule, aucune écriture code applicatif).
**Doctrine** : Code = SSOT (docs s'alignent dessus).

> Phase 0 du master `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` §1. Inventorier l'existant **sans interprétation** ni recommandation. Verdicts P0/P1/P2 limités au §9 (diff doctrine/réalité).

---

## 1. Inventaire DB (`prisma/schema.prisma`)

### 1.1 Présence/absence des tables attendues par la cible V1

| Table attendue                   | Présent ? | Source                                              |
| -------------------------------- | --------- | --------------------------------------------------- |
| `Payment`                        | 🔴 NON    | [grep `model Payment` `prisma/schema.prisma` → 0]   |
| `Invoice`                        | 🔴 NON    | [grep `model Invoice` `prisma/schema.prisma` → 0]   |
| `Refund`                         | 🔴 NON    | [grep `model Refund` `prisma/schema.prisma` → 0]    |
| `Webhook` / `StripeWebhookEvent` | 🔴 NON    | [grep `Webhook` `prisma/schema.prisma` → 0]         |
| `StripeCustomer`                 | 🔴 NON    | [grep `Stripe` `prisma/schema.prisma` → 0]          |
| `Quote`                          | 🔴 NON    | [grep `model Quote` `prisma/schema.prisma` → 0]     |
| `Nda` / `SignatureRequest`       | 🔴 NON    | [grep `Nda`/`Signature` `prisma/schema.prisma` → 0] |
| `CadrageMeeting`                 | 🔴 NON    | [grep `Cadrage` `prisma/schema.prisma` → 0]         |
| `CapacityWindow`                 | 🔴 NON    | [grep `Capacity` `prisma/schema.prisma` → 0]        |
| `OnboardingDoc`                  | 🔴 NON    | [grep `Onboarding` `prisma/schema.prisma` → 0]      |

> Le schéma ne contient **aucune table** liée au paiement, à la facturation, au devis, à la signature ou à un meeting de cadrage formel. Le `Booking` détient seulement `pricePaidCents` (montant indicatif dérivé de `pricing.ts`), pas un statut de règlement.

### 1.2 Modèles touchant booking / calendar / submission / user / log / option

#### `Submission` (`prisma/schema.prisma:157-195`)

- PK `id Uuid`. `type SubmissionType` (audit/implementation/intervention/contact). `status SubmissionStatus` default `new`.
- `locale Locale @default(fr)`. Identité société : `companyName`, `registrationNumber?`, `sector?`, `address?`, `employeesCount?`.
- Contact : `contactName`, `contactRole?`, `contactEmail @db.Citext`, `contactPhone?`.
- `details Json` (payload formulaire). Workflow admin : `internalNotes?`, `assignedTo?`.
- Anti-spam : `ipAddress?`, `userAgent?`, `referer?`, `turnstileScore?`.
- Timestamps : `submittedAt`, `updatedAt`.
- Relation : `bookings Booking[]` (one-to-many).
- 5 index (type, status, locale, submittedAt, contactEmail). `@@map("submissions")`.
- Soft-delete : 🔴 NON (purge hard via `retention-purge-worker`).

#### `Booking` (`prisma/schema.prisma:201-228`)

- PK `id Uuid`. `interventionType InterventionType`. `bookingDate DateTime`. `participantsCount Int`.
- Tarification : `participantsTier? VarChar(40)`, `pricePaidCents? Int`. ⚠️ **pas de** colonne `paymentStatus` / `depositPaid` / `balancePaid`.
- `locale Locale @default(fr)`. `submissionId? Uuid` (relation `Submission` `onDelete: SetNull`). `slotId? @unique` (relation `CalendarSlot` `onDelete: SetNull`).
- `calendarEventId? VarChar(255)` — **legacy Cal.com**, commenté ligne 217 « peut rester null après migration calendrier maison ». Grep `calendarEventId` dans `src/` → **0 résultat**, donc inutilisé.
- `status BookingStatus @default(pending)` (enum : pending/confirmed/cancelled/postponed).
- `internalNotes?`. Timestamps `createdAt`, `updatedAt`.
- 4 index. `@@map("bookings")`.
- Soft-delete : 🔴 NON (purge hard `cancelled` après N mois via retention worker `prisma/schema.prisma:201` / `src/server/queue/workers/retention-purge-worker.ts:128-134`).

#### `CalendarSlot` (`prisma/schema.prisma:234-252`)

- PK `id Uuid`. `slotDate @db.Date @unique` (1 slot par jour).
- `status CalendarSlotStatus @default(available)` (available/reserved/blocked).
- `displaySector? VarChar(100)`, `participantsCount?`, `interventionType?` (snapshot social proof).
- `showPublicly Boolean @default(true)`, `blockedReason? Text`.
- Relations : `booking Booking?` (1:1 via slot_id unique), `options BookingOption[]`.
- Timestamps. 1 index (status). `@@map("calendar_slots")`.

#### `BookingOption` (`prisma/schema.prisma:258-286`)

- PK `id Uuid`. `slotId Uuid` (relation Cascade). `companyName/Sector`, `participantsCount`, `interventionType`.
- Contact : `contactName`, `contactEmail @Citext`, `contactPhone`. `consentDisplay Boolean @default(false)` (RGPD social proof).
- `status BookingOptionStatus @default(pending)` (pending/confirmed/refused/expired/converted).
- `expiresAt DateTime`, `reminderSentAt?`, `confirmedAt?`. `notes? Text`. `locale Locale @default(fr)`.
- 3 index. `@@map("bookings_options")`.
- ⚠️ Pas de FK `submissionId`, pas de `paymentStatus`, pas de relation `Quote/Invoice`.

#### `AdminUser` (`prisma/schema.prisma:621-643`)

- PK `id Uuid`. `name`, `email @unique @Citext`. `passwordHash` (argon2id, doctrine `auth-password.ts`).
- `role AdminRole @default(reader)` (super_admin/admin/editor/reader). `status AdminStatus @default(active)`.
- 2FA TOTP : `twoFactorSecret?`, `twoFactorEnabled`, `twoFactorVerified`.
- Audit : `lastLoginAt?`, `lastLoginIp?`. Timestamps.
- Relation `activityLogs ActivityLog[]`. 2 index. `@@map("admin_users")`.

#### `ActivityLog` (`prisma/schema.prisma:649-666`)

- PK `id Uuid`. `adminUserId? Uuid` (SetNull). `action VarChar(120)`. `targetType?`, `targetId? Uuid`.
- `changes? Json`. `ipAddress?`, `userAgent? Text`. `createdAt` only (immutable).
- 4 index. `@@map("activity_logs")`. Soft-delete : 🔴 NON (purge hard via retention worker, default 12 mois).

#### `Setting` (`prisma/schema.prisma:672-680`)

- PK `key VarChar(120)`. `value Json`. `description? Text`. `updatedAt`, `updatedBy? Uuid`. Pas de versioning.

#### `NewsletterSubscriber` (`prisma/schema.prisma:686-709`)

- PK `id Uuid`. `email @unique @Citext`. `locale`, `status NewsletterStatus` (pending/confirmed/unsubscribed/bounced).
- Double opt-in : `confirmToken? @unique`, `confirmSentAt?`, `confirmedAt?`, `unsubscribedAt?`, `unsubscribeToken? @unique`.
- Source/marketing : `source?`, `ipAddress?`, `mailwizzListUid?`, `mailwizzSubUid?`. Timestamps. 2 index.

### 1.3 Autres modèles (présents mais hors scope booking/payment)

- Contenu : `Article` (`:292`), `ArticleTranslation` (`:316`), `ArticleTag` (`:341`), `ArticleTagOnArticle` (`:355`), `Author` (`:369`), `CaseStudy` (`:426`), `CaseStudyTranslation` (`:451`), `HelpArticle` (`:505`), `HelpArticleTranslation` (`:522`), `Category` (`:585`), `FAQ` (`:479`), `Testimonial` (`:390`).
- Surveys : `Survey` (`:548`), `SurveyResponse` (`:566`).

### 1.4 Enums

| Enum                  | Valeurs                                                                                                          | Ligne   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------- |
| `Locale`              | fr · en                                                                                                          | 35-38   |
| `SubmissionType`      | audit · implementation · intervention · contact                                                                  | 40-45   |
| `SubmissionStatus`    | new · in_progress · processed · archived                                                                         | 47-52   |
| `InterventionType`    | essentielle · approfondie · conference · dirigeants · gagner_du_temps · intervention_claude · audit_flash_onsite | 57-67   |
| `BookingStatus`       | pending · confirmed · cancelled · postponed                                                                      | 69-74   |
| `CalendarSlotStatus`  | available · reserved · blocked                                                                                   | 76-80   |
| `BookingOptionStatus` | pending · confirmed · refused · expired · converted                                                              | 82-88   |
| `PublishStatus`       | draft · published · archived                                                                                     | 90-94   |
| `TestimonialStatus`   | pending · published · refused · archived                                                                         | 96-101  |
| `FAQCategory`         | general · interventions · implementation · audit · pricing · process                                             | 103-110 |
| `SurveyTrigger`       | immediate · scroll_50 · delay_10s · exit_intent                                                                  | 112-117 |
| `SurveyStatus`        | draft · active · ended · archived                                                                                | 119-124 |
| `AdminRole`           | super_admin · admin · editor · reader                                                                            | 128-133 |
| `AdminStatus`         | active · suspended                                                                                               | 135-138 |
| `NewsletterStatus`    | pending · confirmed · unsubscribed · bounced                                                                     | 140-145 |
| `ModuleKind`          | intervention · implementation · audit                                                                            | 147-151 |

🔴 **Absents** : `PaymentStatus`, `PaymentMethod`, `InvoiceStatus`, `QuoteStatus`, `NdaStatus`, `SignatureProvider`.

### 1.5 Migrations Prisma

`prisma/migrations/` :

- `20260508175629_init/` — schéma 18 tables initial (Sprint 15).
- `20260508193001_intervention_type_align/` — alignement enum InterventionType ↔ slugs UI.
- `20260509120000_sprint_24_tiptap_json_text/` — ajout colonnes `bodyJson`/`bodyText`/`problemJson`/`solutionJson` (Article/CaseStudy/Help).
- `20260512100000_audit_flash_onsite_enum/` — extension `audit_flash_onsite` (Sprint 14.10.8, 2026-05-12, Will).
- `migration_lock.toml` — provider postgresql.

> Aucune migration de paiement, devis, signature ou DPA.

---

## 2. Inventaire Server Actions

### 2.1 Server Actions visiteur (PUBLIC)

| Action                        | Fichier:Ligne                               | Rôle requis | Inputs → Outputs                                                                                            | Idempotente ?                                 | Rate-limit               | Turnstile | Telegram                | Email enqueue                          |
| ----------------------------- | ------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------ | --------- | ----------------------- | -------------------------------------- |
| `createBookingAction`         | `src/features/booking/actions.ts:41`        | aucun       | `FormData` (date/time/contact/email/phone/consent/interventionType/participantsCount/…) → `{ok, bookingId}` | Non                                           | `booking:<ip>` 5/600s    | OUI       | tag `INTERVENTION`      | `booking-confirmed`                    |
| `postOption48hAction`         | `src/features/booking/actions.ts:150`       | aucun       | `FormData` (slotId/company/contact/consentDisplay/…) → `{ok, optionId, expiresAt}`                          | Non (verrou pessimiste `SELECT … FOR UPDATE`) | `option48h:<ip>` 3/600s  | OUI       | tag `OPTION`            | `option-posted`                        |
| `submitAuditAction`           | `src/features/audit/actions.ts:22`          | aucun       | `FormData` (size/modality/industry/goals/contact/email/…) → `{ok, submissionId}`                            | Non                                           | `audit:<ip>` 3/600s      | OUI       | tag `AUDIT`             | `audit-confirmed`                      |
| `submitAuditRequestAction`    | `src/features/audit/actions.ts:87`          | aucun       | `FormData` (auditType/size/industry/city/country/scope/maturity/tools/contact/…) → `{ok, submissionId}`     | Non                                           | `audit-req:<ip>` 3/600s  | OUI       | tag `AUDIT`             | `audit-confirmed`                      |
| `submitImplementationAction`  | `src/features/implementation/actions.ts:21` | aucun       | `FormData` (type/budget/description/contact/email/consent) → `{ok, submissionId}`                           | Non                                           | `impl:<ip>` 3/600s       | OUI       | tag `AUTO`              | `implementation-confirmed`             |
| `submitContactAction`         | `src/features/contact/actions.ts:21`        | aucun       | `FormData` (name/email/company?/message/consent) → `{ok}`                                                   | Non                                           | `contact:<ip>` 3/600s    | OUI       | tag `CONTACT`           | `contact-confirmed`                    |
| `subscribeNewsletterAction`   | `src/features/newsletter/actions.ts:26`     | aucun       | `FormData` (email/consent/source) → `{ok}` (double opt-in)                                                  | Oui (upsert)                                  | `newsletter:<ip>` 3/300s | OUI       | tag `NEWSLETTER` silent | `newsletter-confirm-optin` (marketing) |
| `confirmNewsletterAction`     | `src/features/newsletter/actions.ts:118`    | aucun       | `token: string` → `{ok, alreadyConfirmed, email, locale}`                                                   | Oui                                           | non                      | non       | tag `NEWSLETTER` silent | aucun                                  |
| `unsubscribeNewsletterAction` | `src/features/newsletter/actions.ts:186`    | aucun       | `token: string` → `{ok, alreadyUnsubscribed, email}`                                                        | Oui                                           | non                      | non       | tag `NEWSLETTER` silent | aucun                                  |

> Honeypot uniforme `formData.get("website")` sur les 6 forms (silent succès pour bots).

### 2.2 Server Actions admin

| Action                                                                                                                                                        | Fichier:Ligne                | Rôle requis                            | Action principale                                                          | Telegram               | Email                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------- | -------------------------------------------------------------------------- | ---------------------- | --------------------------- |
| **Submissions** (`admin-submissions/actions.ts`)                                                                                                              |                              |                                        |                                                                            |                        |                             |
| `listSubmissionsAction`                                                                                                                                       | `:78`                        | read (super_admin/admin/editor/reader) | List + filtres + pagination                                                | —                      | —                           |
| `getSubmissionDetailAction`                                                                                                                                   | `:150`                       | read                                   | Détail + bookings liés                                                     | —                      | —                           |
| `updateSubmissionAction`                                                                                                                                      | `:184`                       | super_admin/admin/editor               | Maj status/notes/assignedTo + ActivityLog                                  | —                      | —                           |
| `eraseSubmissionAction`                                                                                                                                       | `:241`                       | super_admin only                       | RGPD hard delete + emailHash audit                                         | —                      | —                           |
| `exportSubmissionsCsvAction`                                                                                                                                  | `:316`                       | super_admin/admin/editor               | Export CSV BOM Excel + ActivityLog                                         | —                      | —                           |
| **Calendar** (`admin-calendar/actions.ts`)                                                                                                                    |                              |                                        |                                                                            |                        |                             |
| `getCalendarMonthAction`                                                                                                                                      | `:56`                        | read                                   | Slots du mois + booking + pendingOptionsCount                              | —                      | —                           |
| `blockDateAction`                                                                                                                                             | `:101`                       | super_admin/admin                      | Crée/Update slot status=blocked (verrou `FOR UPDATE`)                      | —                      | —                           |
| `cancelBookingAction`                                                                                                                                         | `:202`                       | super_admin/admin                      | Booking.status=cancelled + libère slot + ActivityLog                       | tag `ANNULATION`       | `booking-cancelled`         |
| `unblockDateAction`                                                                                                                                           | `:341`                       | super_admin/admin                      | Slot blocked → available                                                   | —                      | —                           |
| **Options 48h** (`admin-options/actions.ts`)                                                                                                                  |                              |                                        |                                                                            |                        |                             |
| `listOptionsAction`                                                                                                                                           | `:65`                        | read                                   | List + pagination                                                          | —                      | —                           |
| `getOptionDetailAction`                                                                                                                                       | `:349`                       | read                                   | Détail (avec zod uuid guard)                                               | —                      | —                           |
| `validateOptionAction`                                                                                                                                        | `:122`                       | super_admin/admin                      | `option=converted` + crée Booking confirmé (verrou option+slot FOR UPDATE) | tag `OPTION CONFIRMÉE` | `option-confirmed-by-admin` |
| `refuseOptionAction`                                                                                                                                          | `:243`                       | super_admin/admin                      | `option=refused` + libère slot (sous conditions)                           | tag `OPTION REFUSÉE`   | `option-refused-by-admin`   |
| **Auth** (`admin-auth/actions.ts`)                                                                                                                            |                              |                                        |                                                                            |                        |                             |
| `signInAction`                                                                                                                                                | `:25`                        | aucun                                  | Login email+pwd argon2 + 2FA TOTP step                                     | —                      | —                           |
| `signOutAction`                                                                                                                                               | `:123`                       | session                                | Signout                                                                    | —                      | —                           |
| `setup2FAStartAction`                                                                                                                                         | `:136`                       | session                                | Génère secret TOTP + QR                                                    | —                      | —                           |
| `setup2FAConfirmAction`                                                                                                                                       | `:173`                       | session                                | Active 2FA après vérif code                                                | —                      | —                           |
| `disable2FAAction`                                                                                                                                            | `:219`                       | session                                | Désactive 2FA (self only)                                                  | —                      | —                           |
| **Users** (`admin-users/actions.ts`)                                                                                                                          |                              |                                        |                                                                            |                        |                             |
| `listAdminUsersAction`                                                                                                                                        | `:61`                        | read                                   | List + filtres role/status                                                 | —                      | —                           |
| `getAdminUserDetailAction`                                                                                                                                    | `:103`                       | read                                   | Détail                                                                     | —                      | —                           |
| `createAdminUserAction`                                                                                                                                       | `:134`                       | super_admin                            | Create + ActivityLog                                                       | —                      | —                           |
| `updateAdminUserAction`                                                                                                                                       | `:202`                       | super_admin/admin                      | Maj role/status                                                            | —                      | —                           |
| `reset2FACrossUserAction`                                                                                                                                     | `:259`                       | super_admin only                       | Force désactivation 2FA d'un autre user                                    | —                      | —                           |
| `resetPasswordCrossUserAction`                                                                                                                                | `:316`                       | super_admin only                       | Reset password d'un autre user                                             | —                      | —                           |
| **Settings** (`admin-settings/actions.ts`)                                                                                                                    |                              |                                        |                                                                            |                        |                             |
| `listSettingsAction`                                                                                                                                          | `:36`                        | read                                   | List clés                                                                  | —                      | —                           |
| `getSettingAction`                                                                                                                                            | `:43`                        | read                                   | Read clé                                                                   | —                      | —                           |
| `upsertSettingAction`                                                                                                                                         | `:63`                        | super_admin/admin                      | Upsert clé + ActivityLog                                                   | —                      | —                           |
| `deleteSettingAction`                                                                                                                                         | `:132`                       | super_admin                            | Delete clé                                                                 | —                      | —                           |
| **Activity Logs** (`admin-activity-logs/actions.ts`)                                                                                                          |                              |                                        |                                                                            |                        |                             |
| `listActivityLogsAction`                                                                                                                                      | `:31`                        | read                                   | List + filtres                                                             | —                      | —                           |
| `listAdminUsersOptionsAction`                                                                                                                                 | `:78`                        | read                                   | List users pour filtre                                                     | —                      | —                           |
| `getActivityLogStatsAction`                                                                                                                                   | `:87`                        | read                                   | Stats agrégées                                                             | —                      | —                           |
| **Newsletter** (`admin-newsletter/actions.ts`)                                                                                                                |                              |                                        |                                                                            |                        |                             |
| `listSubscribersAction`                                                                                                                                       | `:60`                        | read                                   | List + filtres                                                             | —                      | —                           |
| `getNewsletterStatsAction`                                                                                                                                    | `:109`                       | read                                   | Stats double opt-in                                                        | —                      | —                           |
| `forceUnsubscribeAction`                                                                                                                                      | `:141`                       | super_admin/admin                      | Forçage unsubscribe + ActivityLog                                          | —                      | —                           |
| `eraseSubscriberAction`                                                                                                                                       | `:199`                       | super_admin                            | RGPD hard delete + emailHash audit                                         | —                      | —                           |
| `exportSubscribersCsvAction`                                                                                                                                  | `:261`                       | super_admin/admin                      | Export CSV                                                                 | —                      | —                           |
| **Blog** (`admin-blog/actions.ts`)                                                                                                                            |                              |                                        |                                                                            |                        |                             |
| `listArticlesAction`/`getArticleDetailAction`/`listAuthorsAction`/`listBlogCategoriesAction`/`listAllTagsAction`/`upsertArticleAction`/`archiveArticleAction` | `:51/98/112/119/127/186/352` | read / write                           | CRUD articles + traductions FR/EN + Tiptap JSON/text                       | —                      | —                           |
| **Case Studies** (`admin-case-studies/actions.ts`)                                                                                                            |                              |                                        |                                                                            |                        |                             |
| `listCaseStudiesAction`/`getCaseStudyDetailAction`/`listCandidateTestimonialsAction`/`upsertCaseStudyAction`/`archiveCaseStudyAction`                         | `:48/94/105/179/329`         | read / write                           | CRUD case studies                                                          | —                      | —                           |
| **FAQ** (`admin-faq/actions.ts`)                                                                                                                              |                              |                                        |                                                                            |                        |                             |
| `listFAQsAction`/`getFAQDetailAction`/`upsertFAQAction`/`archiveFAQAction`                                                                                    | `:61/108/140/215`            | read / write                           | CRUD FAQ FR/EN                                                             | —                      | —                           |
| **Help** (`admin-help/actions.ts`)                                                                                                                            |                              |                                        |                                                                            |                        |                             |
| `listHelpArticlesAction`/`getHelpArticleDetailAction`/`listHelpCategoriesAction`/`upsertHelpArticleAction`/`archiveHelpArticleAction`                         | `:45/87/98/155/271`          | read / write                           | CRUD aide                                                                  | —                      | —                           |
| **Testimonials** (`admin-testimonials/actions.ts`)                                                                                                            |                              |                                        |                                                                            |                        |                             |
| `listTestimonialsAction`/`getTestimonialDetailAction`/`upsertTestimonialAction`/`archiveTestimonialAction`                                                    | `:48/94/134/224`             | read / write                           | CRUD témoignages                                                           | —                      | —                           |
| **Categories** (`admin-categories/actions.ts`)                                                                                                                |                              |                                        |                                                                            |                        |                             |
| `listCategoriesAction`/`getCategoryDetailAction`/`listPotentialParentsAction`/`upsertCategoryAction`/`archiveCategoryAction`                                  | `:46/92/98/145/233`          | read / write                           | CRUD catégories                                                            | —                      | —                           |

> 🔴 **Pas de** Server Action `requestQuoteAction` / `sendNdaAction` / `signNdaAction` / `createCheckoutSessionAction` / `handleStripeWebhookAction` / `issueInvoiceAction`.

### 2.3 Bilan inventaire actions

- **6 forms visiteurs** + **3 actions newsletter** = **9 actions publiques**.
- **53 actions admin** réparties sur **13 features admin** (`admin-{submissions,calendar,options,auth,users,settings,activity-logs,newsletter,blog,case-studies,faq,help,testimonials,categories}`).
- Aucune action admin pour **alerts** ou **infra** (pages SSR consommatrices d'API externes seulement — cf. §4).

---

## 3. Inventaire UI visiteur

### 3.1 `/reserver` (`src/app/[locale]/reserver/page.tsx`)

- Server Component async (`:397`). `setRequestLocale` + `routing` next-intl.
- Charge **bookings DB** via `loadDbBookedSlots()` (`:27`) — best-effort, fallback `[]` si pas de `DATABASE_URL`. Cap 250 rows, horizon 90j, exclus `cancelled`.
  - Anonymise : jamais le `companyName` côté visiteur — expose `city/sector/companySize/duration` dérivés de `Submission.details` et fallback `bracketParticipants()`.
- Merge avec **fixtures social proof** `buildFixtureBookedSlots()` (`:108`, 27 fixtures sur 90j FR/CH/BE/LU).
- `<BookingCalendarLazy initialBookedSlots locale />` (`:458`) — Client Component lazy-loaded.
- `<CtaBlock>` (`:462`) renvoie vers `/conditions-generales` avec mention « créneau verrouillé après acompte 50 % ».
- `<Breadcrumbs>` (avec JSON-LD intégré).
- Pas de form direct sur la page — tout passe par la modale du calendrier.

### 3.2 Composants `src/components/calendar/`

| Fichier                   | Rôle                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BookingCalendar.tsx`     | Client Component principal (mois nav + modal 4 steps + form state). Importe `createBookingAction`. INTERVENTION_OPTIONS hardcodé (5 slugs + audit-flash-onsite). |
| `BookingCalendarLazy.tsx` | Wrapper dynamic-import (code-split du calendrier).                                                                                                               |
| `BookingFlow.tsx`         | Flow d'étapes interne (Entreprise / Vous / Contexte IA / Récap+submit).                                                                                          |
| `HouseCalendar.tsx`       | Calendrier « maison » (rendu grille mois).                                                                                                                       |
| `HouseCalendar.test.tsx`  | Tests vitest.                                                                                                                                                    |

- **Accessibilité** : composants Radix Dialog (Dialog/Content/Header/Title/Description) + lucide icons + `aria-hidden` confirmés sur badges. `<Label>` Radix utilisé pour les inputs.
- **Responsive** : Tailwind 4 — calendrier `max-w-7xl` (`page.tsx:457`).
- **State** : `useSearchParams`/`useRouter`/`usePathname` pour pré-fill via `?intervention=slug`.

### 3.3 CTAs `/reserver` à travers le site

- Grep `/reserver|/book` dans `src/` → **60 occurrences** dans **31 fichiers**.
- Grep restreint `href="/reserver"` (forme stricte avec guillemets et début slash) → **12 fichiers** confirmés :
  1. `src/components/nav/Header.tsx` — CTA principal header.
  2. `src/components/sections/InterventionFormatCard.tsx` — cards listing.
  3. `src/components/sections/CollectiveDurationListing.tsx` — listing durées.
  4. `src/components/sections/VilleServicePageTemplate.tsx` — pSEO ville templates.
  5. `src/components/sections/VilleServiceDetailSection.tsx` — pSEO ville détail.
  6. `src/app/[locale]/interventions/page.tsx` — hub interventions.
  7. `src/app/[locale]/interventions/collectives/page.tsx` — hub collectives.
  8. `src/app/[locale]/interventions/essentielle/page.tsx` — page format.
  9. `src/app/[locale]/audit/page.tsx` — hub audit (Sprint 14.10.8 Flash terrain).
  10. `src/app/[locale]/implantations/page.tsx` — hub régions.
  11. `src/app/[locale]/implantations/[region]/page.tsx` — région.
  12. `src/app/[locale]/implantations/[region]/[ville]/page.tsx` — ville.

> Distribution typique : 1-3 CTAs par page hub, plus EN variant `/book` (alias `routing.ts`).

---

## 4. Inventaire UI admin

Routes sous `src/app/[locale]/(admin)/[adminPrefix]/` (prefix variable, voir `lib/admin-path.ts`).

| Route                              | Fichier `page.tsx`                                | Rôle requis (action backing) | Champs / Actions principaux                                                   |
| ---------------------------------- | ------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `/login`                           | `(admin)/[adminPrefix]/login/page.tsx`            | aucun                        | Email/pwd + 2FA TOTP                                                          |
| `/2fa`                             | `(admin)/[adminPrefix]/2fa/page.tsx`              | session                      | Étape post-login : input code TOTP                                            |
| `/2fa/setup`                       | `(admin)/[adminPrefix]/2fa/setup/page.tsx`        | session                      | QR + secret + confirm                                                         |
| `/submissions`                     | `(admin)/[adminPrefix]/submissions/page.tsx`      | read                         | Filtres (type/status/locale/dates/search) + table paginée + export CSV        |
| `/submissions/[id]`                | `(admin)/[adminPrefix]/submissions/[id]/page.tsx` | read+write/super             | Détail submission + bookings liés + edit notes/status/assignedTo + RGPD erase |
| `/calendrier`                      | `(admin)/[adminPrefix]/calendrier/page.tsx`       | read                         | Calendrier mensuel + bloquer/débloquer + annuler booking                      |
| `/options`                         | `(admin)/[adminPrefix]/options/page.tsx`          | read                         | Liste options 48h filtrable                                                   |
| `/options/[id]`                    | `(admin)/[adminPrefix]/options/[id]/page.tsx`     | read+write                   | Détail option + valider/refuser                                               |
| `/users`                           | `(admin)/[adminPrefix]/users/page.tsx`            | read                         | Liste admin users                                                             |
| `/users/new`                       | `(admin)/[adminPrefix]/users/new/page.tsx`        | super_admin                  | Création                                                                      |
| `/users/[id]`                      | `(admin)/[adminPrefix]/users/[id]/page.tsx`       | super/admin                  | Édit (role/status) + reset 2FA + reset pwd (super only)                       |
| `/settings`                        | `(admin)/[adminPrefix]/settings/page.tsx`         | read                         | Liste settings JSON                                                           |
| `/settings/new`                    | `(admin)/[adminPrefix]/settings/new/page.tsx`     | super/admin                  | Création                                                                      |
| `/settings/[key]`                  | `(admin)/[adminPrefix]/settings/[key]/page.tsx`   | super/admin                  | Édit                                                                          |
| `/activity-logs`                   | `(admin)/[adminPrefix]/activity-logs/page.tsx`    | read                         | Logs paginés + stats                                                          |
| `/newsletter`                      | `(admin)/[adminPrefix]/newsletter/page.tsx`       | read                         | Subscribers + force unsubscribe + erase RGPD + export CSV                     |
| `/blog`, `/blog/new`, `/blog/[id]` | `(admin)/[adminPrefix]/blog/…`                    | read/write                   | CRUD articles FR/EN + Tiptap                                                  |
| `/case-studies` (3 routes)         | `(admin)/[adminPrefix]/case-studies/…`            | read/write                   | CRUD cas client FR/EN                                                         |
| `/faq` (3 routes)                  | `(admin)/[adminPrefix]/faq/…`                     | read/write                   | CRUD FAQ FR/EN                                                                |
| `/help` (3 routes)                 | `(admin)/[adminPrefix]/help/…`                    | read/write                   | CRUD aide FR/EN                                                               |
| `/testimonials` (3 routes)         | `(admin)/[adminPrefix]/testimonials/…`            | read/write                   | CRUD témoignages                                                              |
| `/categories` (3 routes)           | `(admin)/[adminPrefix]/categories/…`              | read/write                   | CRUD catégories                                                               |
| `/alerts`                          | `(admin)/[adminPrefix]/alerts/page.tsx`           | read                         | Agrégation UptimeRobot/Coolify/etc. (SSR, pas d'action propre)                |
| `/infra`                           | `(admin)/[adminPrefix]/infra/page.tsx`            | read                         | Infos infra (SSR, pas d'action propre)                                        |

> `[INCONNU — non audité ligne par ligne]` : layout admin (sidebar, mobile responsiveness, breadcrumbs admin, dark mode). Le prompt §4 demande responsive mobile — pas inspecté individuellement par page faute de scope. À ouvrir page-par-page si requis pour Phase 2.

---

## 5. Inventaire Queue/Workers (`src/server/queue/**`)

| Fichier                                  | Queue / Worker             | Trigger                                                     | Idempotence                                                                   | DLQ                                             |
| ---------------------------------------- | -------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| `queues.ts:27`                           | `emails` Queue             | Enqueue manuel (`enqueueEmail`)                             | Pas natif — jobs identifiés par `EmailJobName` + payload                      | `attempts:5`, `removeOnFail age 30j count 5000` |
| `queues.ts:32`                           | `option-expiration` Queue  | Cron `*/5 * * * *` repeatable                               | Re-lit slot+option `FOR UPDATE` dans tx (`option-expiration-worker.ts:44-95`) | `attempts:1` (queue-level)                      |
| `queues.ts:37`                           | `option-reminder` Queue    | Cron `0 * * * *` repeatable                                 | Sentinel `reminderSentAt` flag avant insert                                   | `attempts:1`                                    |
| `queues.ts:42`                           | `newsletter` Queue         | (déclaré, pas utilisé concrètement dans actions inspectées) | —                                                                             | defaults                                        |
| `queues.ts:47`                           | `search-indexer` Queue     | (déclaré, pas utilisé)                                      | —                                                                             | defaults                                        |
| `queues.ts:53`                           | `retention-purge` Queue    | Cron `0 3 * * *` UTC                                        | Hard delete + ActivityLog `*.purged` (emailHash)                              | `attempts:1`                                    |
| `workers/email-worker.ts:15`             | Worker `emails`            | Concurrency 8                                               | Template + List-Unsubscribe + List-Unsubscribe-Post headers RFC 8058          | hérite défaults                                 |
| `workers/option-expiration-worker.ts:19` | Worker `option-expiration` | Concurrency 1                                               | Verrou pessimiste + re-vérif `status='pending'`                               | hérite                                          |
| `workers/option-reminder-worker.ts:13`   | Worker `option-reminder`   | Concurrency 1                                               | Fenêtre `[22h, 26h]` + `reminderSentAt=null`                                  | hérite                                          |
| `workers/retention-purge-worker.ts:54`   | Worker `retention-purge`   | Concurrency 1                                               | Hard delete par lots, env caps (`RETENTION_*_MONTHS`)                         | hérite                                          |

> Connection Redis : `connection.ts` (non lu). Boot : `bootRepeatableJobs()` (`queues.ts:84`).

---

## 6. Inventaire emails (`src/lib/email/templates/**`)

Aucun dossier `src/emails/` — les templates sont dans `src/lib/email/templates/`.

| Template                        | Trigger (enqueue site)                                      | Sujet (à vérifier)       |
| ------------------------------- | ----------------------------------------------------------- | ------------------------ |
| `_layout.tsx`                   | Layout React Email partagé                                  | —                        |
| `audit-confirmed.tsx`           | `submitAuditAction` + `submitAuditRequestAction`            | `[INCONNU — non ouvert]` |
| `booking-cancelled.tsx`         | `cancelBookingAction` (admin)                               | `[INCONNU]`              |
| `booking-confirmed.tsx`         | `createBookingAction`                                       | `[INCONNU]`              |
| `contact-confirmed.tsx`         | `submitContactAction`                                       | `[INCONNU]`              |
| `gdpr-export-link.tsx`          | (route `/api/gdpr-export` Sprint 24)                        | `[INCONNU]`              |
| `implementation-confirmed.tsx`  | `submitImplementationAction`                                | `[INCONNU]`              |
| `index.tsx`                     | `renderEmailTemplate(template, locale, payload)` dispatcher | —                        |
| `newsletter-confirm-optin.tsx`  | `subscribeNewsletterAction`                                 | `[INCONNU]`              |
| `option-confirmed-by-admin.tsx` | `validateOptionAction` (admin)                              | `[INCONNU]`              |
| `option-expired.tsx`            | `option-expiration-worker`                                  | `[INCONNU]`              |
| `option-posted.tsx`             | `postOption48hAction`                                       | `[INCONNU]`              |
| `option-refused-by-admin.tsx`   | `refuseOptionAction` (admin)                                | `[INCONNU]`              |
| `option-reminder.tsx`           | `option-reminder-worker` (H+24 fenêtre)                     | `[INCONNU]`              |

- Toutes les langues sont gérées via la signature `renderEmailTemplate(template, locale, payload)` (`workers/email-worker.ts:20`) — pas un fichier par langue (à confirmer dans `templates/index.tsx`, non ouvert).
- 🔴 **Absents** : `quote-sent.tsx`, `nda-sent.tsx`, `payment-receipt.tsx`, `invoice-issued.tsx`, `payment-reminder.tsx`, `payment-link.tsx`, `cadrage-scheduled.tsx`.

---

## 7. Inventaire intégrations externes

### 7.1 Stripe

- 🔴 **NON installé**. `package.json:65-113` — aucun `stripe` ni `@stripe/*`.
- Grep `stripe` dans `src/` → 6 fichiers, **tous en copy marketing/SEO** (Footer, LocalCoverageSection, ToolLogo, llms-full, og, globals.css). Aucun import SDK ni webhook handler.
- Mode test/live : non applicable.

### 7.2 Cal.com / Calendly

- Colonne `Booking.calendarEventId` (`prisma/schema.prisma:217`) commentée « legacy Cal.com — peut rester null après migration calendrier maison ».
- Grep `calendarEventId` dans `src/` → **0 résultat** → champ **inutilisé** en runtime.

### 7.3 Telegram

- ✅ Présent : `src/lib/telegram.ts` (utilitaire `sendTelegram({tag,body,silent?})`). Utilisé par 7 actions visiteur/admin + 2 workers.
- Tags identifiés : `INTERVENTION`, `OPTION`, `OPTION CONFIRMÉE`, `OPTION REFUSÉE`, `OPTION EXPIRÉE`, `AUDIT`, `AUTO`, `CONTACT`, `NEWSLETTER` (silent), `ANNULATION`.
- PII minimisation via `redactContactLine`/`redactEmail`/`redactName` (`src/lib/pii-redaction.ts`, ADR 0010).

### 7.4 Resend / SendGrid / Mailgun

- 🔴 **Interdits par doctrine** (`src/lib/email/client.ts:7`). Stack : Nodemailer → SMTP localhost:2525 → Mailhog (dev) / PowerMTA → IP dédiée Hetzner (prod).

### 7.5 Yousign / DocuSign

- 🔴 **Absent**. Grep `yousign|docusign` (case-insensitive) dans tout `axionia/` → 2 fichiers `_AUDIT/` uniquement (le prompt + son MANIFEST). Aucun code.

### 7.6 Visio (Jitsi / Whereby / Google Meet)

- Grep `jitsi|whereby|meet\.|google.?meet|visio` → 26 fichiers, **uniquement** dans la copy (`/audit`, `/interventions/**`, `pricing.ts`, `interventions.ts`, `Header.tsx`, etc.) ou JSON-LD SEO. Pas d'intégration provider.
- Mentions « call de cadrage en visio » abondantes (cf. §1.4 plus haut, 20+ hits dans `interventions.ts`).

### 7.7 Sentry, BullMQ, Redis, Postgres, Cloudflare Turnstile, NextAuth, Tiptap

- ✅ Tous présents dans `package.json:65-113`. `@sentry/nextjs ^10`, `bullmq ^5.76`, `ioredis ^5.10`, `@prisma/client ^5.22`, `next-auth 5.0.0-beta.31`, `@tiptap/* ^3.22`.
- Turnstile vérifié sur 6 forms (`src/lib/turnstile.ts` via `verifyTurnstile`).

---

## 8. Inventaire conformité légale actuelle

### 8.1 CGV `/conditions-generales`

- Route : `src/app/[locale]/conditions-generales/page.tsx` (FR) / `/terms-of-service` (EN, via `pathEn`).
- Contenu sourcé depuis `src/content/legal.ts` (`getLegal("conditions-generales")`).
- Clauses présentes :
  - **Annulation** : `legal.ts:134` « Annulation par le client > 7 j avant l'intervention : 100 % remboursement. Entre 7 et 2 j : 50 %. Moins de 2 j : aucun remboursement, créneau reportable une fois sans frais. » + EN `:176`.
  - **Force majeure** : `legal.ts:127` (mention dans clause délais) + `:454` (titre dédié « Annulation pour cas de force majeure ») + EN `:483`.
  - **RGPD** : pas dans `conditions-generales` directement, traité dans `politique-confidentialite` (cf. §8.3).
  - **Acompte / paiement 50 %** : 🔴 **ABSENT** de `conditions-generales`. Grep `acompte|50 %|deposit|cancellation` dans `conditions-generales/page.tsx` → 0 résultat (page n'a que les imports). Les mentions « acompte 50 % » apparaissent dans `interventions.ts:236` (page produit) et dans la copy hero `/reserver` (`page.tsx:447-448`), mais **pas en clause CGV opposable**.

### 8.2 Mentions légales `/mentions-legales`

- Source `legal.ts:33-100`.
- **Forme juridique** : « Axion-IA OÜ · société à responsabilité limitée de droit estonien » (`:44`).
- **Immatriculation / Capital** : `registrikood` et numéro de TVA EE **communiqués sur demande** (pas affichés). Pas de capital social déclaré.
- **Directeur de publication** : « Will (gérant). Email : contact@axion-ia.com » (`:48`).
- **Hébergeur** : « Hetzner Online GmbH · Industriestr. 25 · 91710 Gunzenhausen · Allemagne · UE. Données stockées et traitées dans l'UE (datacenter Frankfurt) » (`:52`).
- **DPO** : pas dédié dans mentions-legales (déclaré dans politique-confidentialite, `:247` EN). Email contact unique : `contact@axion-ia.com`.

### 8.3 Sous-processeurs (intégrés à `/politique-confidentialite`)

- Pas de page dédiée `/sous-processeurs`. Contenu intégré dans `politique-confidentialite` (`legal.ts:229-231` FR / `:274-275` EN).
- Liste actuelle (extrait `legal.ts:230` FR) :
  - **Hetzner Online GmbH** — hébergement VPS + Storage Box backups AES-256, Allemagne Frankfurt. DPA signé, ISO 27001.
  - **Cloudflare, Inc.** — CDN + DDoS + Turnstile. États-Unis (SCC + EU-US DPF).
  - **Telegram FZ-LLC** — notifications admin Bot API. Émirats Arabes Unis. Pas de DPA standard, PII minimisation appliquée.
- Mention « Aucune donnée n'est vendue ni partagée à des fins publicitaires. » (`:230`).

### 8.4 Politique de cookies

- Route `/cookies` (`src/app/[locale]/cookies/page.tsx`) + UX `/preferences-cookies`.
- Source `legal.ts:286-…` (slug `cookies`). 4 sections : strictement nécessaires (session admin + lang prefs), Plausible self-hosted anonymisé (sans consentement requis CNIL/AKI 2022), aucun cookie tiers, instructions navigateur.

### 8.5 Qualiopi / OPCO / e-invoicing / régime TVA détaillé

- ⚠️ **HORS SCOPE Phase 0** par instruction explicite du prompt §8. Aucun audit ici. À traiter `[À REVISITER V2+ — HORS SCOPE]` (structure juridique FR vs EE non tranchée — la mention « société de droit estonien » dans mentions-legales reste l'unique signal officiel à date).

---

## 9. Doctrine vs réalité — diff

> Tableau « Affirmation copy/doc | Source | Vérité code | Verdict P0/P1/P2 ». Aucune recommandation — uniquement les GAPs documentés.

| #   | Affirmation copy / doc                                                                                                 | Source affirmation                                                                           | Vérité code                                                                                                                                                                        | Source code                                                                     | Verdict                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | « Acompte de 50 % du prix de la formation — virement bancaire ou carte. Facture immédiate. »                           | `src/content/interventions.ts:236` (FR) + `:262` (EN)                                        | Pas de modèle `Payment`/`Invoice`. Pas d'intégration Stripe/SEPA. Aucune action `createCheckoutSession`. `Booking.pricePaidCents` = montant indicatif, pas un statut de règlement. | `prisma/schema.prisma:201-228` + `package.json:65-113` (no `stripe`)            | 🔴 **P0**                                |
| 2   | « Call de cadrage … pour valider le format choisi, l'effectif et les modalités pratiques. »                            | `interventions.ts:230` + ~20 autres sites (Grep `cadrage`)                                   | Pas de table `CadrageMeeting`. Pas de Server Action pour planifier le cadrage. Pas de visio provider intégré (Jitsi/Whereby/Meet absents — Grep §7.6 = 0 code).                    | `prisma/schema.prisma` (no `Cadrage`) + §7.6                                    | 🔴 **P0**                                |
| 3   | « Facture immédiate » (déclenchée après acompte 50 %).                                                                 | `interventions.ts:236` (FR) + `:262` (EN)                                                    | Pas de génération PDF, pas de modèle `Invoice`, pas de numérotation. Aucun template email `invoice-issued`.                                                                        | `prisma/schema.prisma` (no Invoice) + `templates/` (no invoice tpl)             | 🔴 **P0**                                |
| 4   | « Le créneau est verrouillé après le versement de l'acompte 50 %. »                                                    | `src/app/[locale]/reserver/page.tsx:471-472`                                                 | Le slot passe à `reserved` dès la création de la `BookingOption` 48h via verrou pessimiste — **sans paiement**. Confirmation = action admin manuelle `validateOptionAction`.       | `src/features/booking/actions.ts:194-235` + `admin-options/actions.ts:122`      | 🔴 **P0**                                |
| 5   | « Sous-processeurs : Hetzner + Cloudflare + Telegram » (3 only).                                                       | `legal.ts:230` (FR)                                                                          | Cohérent côté code : seuls Hetzner/CF/Telegram observés ; Mailwizz mentionné en `NewsletterSubscriber.mailwizzListUid` mais pas listé en sous-processeur.                          | `prisma/schema.prisma:701-702`                                                  | 🟡 **P1**                                |
| 6   | « Annulation > 7 j 100 % / 7-2 j 50 % / < 2 j 0 % » (CGV `:134`).                                                      | `legal.ts:134` (FR) + `:176` (EN)                                                            | Aucun mécanisme automatique de remboursement (pas de `Refund` modèle ni de webhook Stripe `charge.refunded`). Clause opposable uniquement par geste manuel.                        | `prisma/schema.prisma` + `package.json` (no stripe)                             | 🔴 **P0**                                |
| 7   | « Solde 50 % après l'intervention + frais (logement/repas/trajet) — devis transparent fourni avant signature. »        | `interventions.ts:244-246`                                                                   | Pas de modèle `Quote`. Aucune Server Action `createQuoteAction`. Pas de template email `quote-sent`.                                                                               | `prisma/schema.prisma` + `templates/`                                           | 🔴 **P0**                                |
| 8   | « Confirmation par email sous 1 h ouvrée » (`/reserver` meta).                                                         | `src/app/[locale]/reserver/page.tsx:391`                                                     | L'email `booking-confirmed` est enqueue immédiatement (`booking/actions.ts:134`) ; pas de SLA tracking, pas de surveillance latence queue (Sentry observability ≠ SLA).            | `src/features/booking/actions.ts:134`                                           | 🟡 **P1**                                |
| 9   | « Calendrier maison + verrou pessimiste 48h. »                                                                         | `src/server/queue/workers/option-expiration-worker.ts:1-7` + `_AUDIT/`                       | Conforme. `postOption48hAction` utilise `SELECT … FOR UPDATE`. Worker re-vérifie dans tx avec lock + sentinel.                                                                     | `src/features/booking/actions.ts:191-235` + `option-expiration-worker.ts:44-95` | 🟢 OK                                    |
| 10  | « Forme juridique : OÜ estonienne, registrikood communiqué sur demande. »                                              | `legal.ts:44`                                                                                | Pas de registrikood / TVA EE en dur en code. Doctrine TVA-agnostique préservée (cf. prompt §8 « V1+ non tranché »).                                                                | `legal.ts:44`                                                                   | 🟡 **P1**                                |
| 11  | « 4 rôles RBAC : super_admin / admin / editor / reader » (CLAUDE.md §14).                                              | `prisma/schema.prisma:128-133`                                                               | Conforme. Implémenté dans toutes les Server Actions admin via `requireAdminWrite()`/`requireAdminRead()`.                                                                          | `admin-*/actions.ts` (auth helpers répétés)                                     | 🟢 OK                                    |
| 12  | « RFC 8058 List-Unsubscribe sur newsletter + transactionnels avec unsubscribeToken. »                                  | `email-worker.ts:21-37`                                                                      | Conforme. Headers `List-Unsubscribe` + `List-Unsubscribe-Post` ajoutés. Action `unsubscribeNewsletterAction` consomme le token, conserve la ligne (audit trail) — non hard delete. | `email-worker.ts` + `newsletter/actions.ts:186`                                 | 🟢 OK                                    |
| 13  | « Honeypot champ `website` uniforme + Turnstile sur tous les forms. »                                                  | `_AUDIT/` Sprint 15 Fork 3 C1-3                                                              | Conforme sur 6 forms (booking/option48h/audit/audit-request/implementation/contact/newsletter). Tous appellent `verifyTurnstile`.                                                  | Grep `formData.get("website")` confirmé sur les 6 actions                       | 🟢 OK                                    |
| 14  | « Pas de Cal.com — calendrier maison ».                                                                                | `prisma/schema.prisma:216-217` (comment)                                                     | Champ `calendarEventId` reste dans le schéma mais inutilisé en code (`grep` = 0). Dette technique cosmétique uniquement.                                                           | `prisma/schema.prisma:217`                                                      | 🟡 **P2**                                |
| 15  | « Retention RGPD : logs 12 mois, submissions archived 24 mois, newsletter unsub 36 mois, bookings cancelled 12 mois. » | `retention-purge-worker.ts:11-16`                                                            | Conforme. Defaults respectés, overrides env safe (anti-misconfig si < 1). ActivityLog `*.purged` avec emailHash SHA-256 préservé.                                                  | `retention-purge-worker.ts:25-30` + `:80-93`                                    | 🟢 OK                                    |
| 16  | « NDA disponible avant intervention. »                                                                                 | `[INCONNU — non sourcé en copy auditée Phase 0]`                                             | Aucune table `Nda` / `SignatureRequest`. Aucun template email NDA. Aucun provider e-signature.                                                                                     | `prisma/schema.prisma` + `package.json`                                         | 🔴 **P0** _(si copy le promet ailleurs)_ |
| 17  | « Devis personnalisé (intra) / sur devis (au-delà du plafond). »                                                       | `interventions.ts:236` (mention indirecte) + `pricing.ts` SSOT                               | Pas de table `Quote`. Pas de PDF générator. Pas de numérotation devis.                                                                                                             | `prisma/schema.prisma`                                                          | 🔴 **P0**                                |
| 18  | « Onboarding documents (livret, slides, ressources). »                                                                 | `interventions.ts:241` (« ressources pédagogiques standardisées remises en fin de journée ») | Pas de modèle `OnboardingDoc`. Pas de mécanisme d'attachement de fichiers PDF/slides à un Booking.                                                                                 | `prisma/schema.prisma`                                                          | 🟡 **P1**                                |

### 9.1 Récapitulatif GAPs

- 🔴 **P0 (8 GAPs critiques)** : #1 Acompte 50 % sans Payment · #2 Cadrage sans CadrageMeeting · #3 Facture immédiate sans Invoice · #4 « créneau verrouillé après acompte » (verrou pré-paiement actuel) · #6 Remboursement annulation CGV sans Refund · #7 Devis transparent sans Quote · #16 NDA sans SignatureRequest · #17 Devis sans table dédiée.
- 🟡 **P1 (4 GAPs)** : #5 sous-processeurs vs Mailwizz · #8 SLA email 1h · #10 registrikood/TVA EE non publics · #18 OnboardingDoc.
- 🟡 **P2 (1 GAP)** : #14 `calendarEventId` legacy résiduel.
- 🟢 **OK (5)** : #9 verrou pessimiste · #11 RBAC 4 rôles · #12 RFC 8058 · #13 Honeypot + Turnstile · #15 Retention RGPD.

---

## 10. Notes méthodologiques

- Aucun code applicatif modifié, aucun `git`, `pnpm`, ni écriture hors ce `.md`. ✅ Conforme contrainte AUDIT-ONLY.
- Toutes les citations renvoient à des chemins relatifs `axionia/`-rooted (FR/Win). Lignes Prisma sourcées sur le HEAD `ff3ccbc9` lu via `Read`.
- Les templates d'emails (`templates/*.tsx`) n'ont **pas été ouverts individuellement** par souci de scope Phase 0 — leur sujet exact est marqué `[INCONNU]`. À ouvrir si Phase 2 le requiert.
- `[INCONNU]` également posé sur le layout admin responsive (page par page) et sur `connection.ts` (Redis pool) — non bloquants pour Phase 0.
- Phase 0 sans interprétation : la décomposition de GAPs P0/P1/P2 reste factuelle (présence/absence de modèle, intégration, action). La hiérarchisation business / la prescription corrective relèvent des phases suivantes (1 → 6).
