# 01 — Inventaire E2E · Audit Booking Deposit + Admin 2026

**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742`
**Branch** : `main`
**Date** : 2026-05-12
**Mode** : 🚫 AUDIT-ONLY (lecture-seule, écriture limitée à ce `.md`).
**Phase** : 1/6 — Inventaire des **flux** par-dessus le Reality Check Phase 0.

> Voir `00-REALITY-CHECK.md` pour l'inventaire détaillé des modèles DB, Server Actions, queues, templates email. Cette Phase 1 construit les **diagrammes de flux** : visiteur, admin, cycle de vie, raccordement interventions↔booking↔audits, notifications, légal/contractuel.

---

## 2.1 Flux visiteur actuel (E2E)

### 2.1.1 Vue d'ensemble — réservation directe (chemin majoritaire)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  LANDING                                                                 │
│  /interventions/essentielle  /audit  /interventions/dirigeants  ...      │
│  src/app/[locale]/interventions/essentielle/page.tsx:78                  │
│  src/app/[locale]/audit/page.tsx:185                                     │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │  Cta href="/reserver?intervention=<slug>[&tier=<id>]"
                                  │  (12 fichiers émettent ce CTA — cf. Reality Check §3.3)
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PAGE /reserver  (Server Component, FR) · /book (EN)                     │
│  src/app/[locale]/reserver/page.tsx:397                                  │
│                                                                          │
│  - loadDbBookedSlots()  ── lit Booking + Submission (anonymisé social    │
│    proof) — page.tsx:27                                                  │
│  - buildFixtureBookedSlots() — page.tsx:108                              │
│  - <BookingCalendarLazy initialBookedSlots locale /> — page.tsx:458      │
│  - Hero : "Réservation finalisée après call de cadrage + acompte 50 %"   │
│    → page.tsx:447                                                        │
│  - CtaBlock bas de page : "Le créneau est verrouillé après le versement  │
│    de l'acompte 50 %." → page.tsx:471                                    │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │  Click sur une date dispo dans le calendrier
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  MODAL <BookingCalendar />  (Client Component)                           │
│  src/components/calendar/BookingCalendar.tsx:1                           │
│                                                                          │
│  Pré-fill : useSearchParams() lit ?intervention=<slug>&tier=<id>         │
│                                                                          │
│  Step 1 Entreprise   companyName · sector · city · companySize           │
│  Step 2 Vous         firstName · lastName · email · phone · role         │
│  Step 3 Contexte IA  aiUsage · aiTools · automations · auditInterest     │
│  Step 4 Récap+CGU    checkbox consent (RGPD only, PAS CGV)               │
│                       BookingCalendar.tsx:1935-1947                      │
│                                                                          │
│  [GAP P0] Aucune mention/lien CGV cochable dans la modale.               │
│  [GAP P0] Aucun affichage tarif ni mention paiement.                     │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │  handleSubmit() → BookingCalendar.tsx:712
                                  │  formData (date, time=09:00, contact, email, phone,
                                  │  interventionType, participantsCount, locale,
                                  │  companyName, companyCity, companySize, notes)
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  SERVER ACTION  createBookingAction                                      │
│  src/features/booking/actions.ts:41                                      │
│                                                                          │
│  1. getClientIp()                          actions.ts:45                 │
│  2. checkRateLimit booking:<ip> 5/600s     actions.ts:46                 │
│  3. honeypot website                       actions.ts:49                 │
│  4. verifyTurnstile(cf-turnstile-response) actions.ts:51                 │
│  5. bookingSchema.safeParse(zod)           actions.ts:56-65              │
│  6. slugToEnum + getInterventionPriceCents actions.ts:70-76 (pricing.ts) │
│  7. prisma.$transaction([                  actions.ts:89                 │
│       submission.create(type='intervention'),                            │
│       booking.create(status='pending',  ← jamais flippé en pratique      │
│                       slotId=null      ← pas de slot lié sur cette voie) │
│     ])                                                                    │
│  8. sendTelegram tag=INTERVENTION (redact) actions.ts:129                │
│  9. enqueueEmail booking-confirmed         actions.ts:134                │
│ 10. return { ok, bookingId }                                             │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  CONFIRMATION UI (inline modale, pas de page dédiée)                     │
│  BookingCalendar.tsx:1229-1300                                           │
│                                                                          │
│  Bandeau "Demande enregistrée — pas encore confirmée"                    │
│  3 étapes annoncées :                                                    │
│   (1) Call de cadrage sous 48h ouvrées                                   │
│   (2) Acompte 50 % — virement/CB, "Facture immédiate"                    │
│   (3) Réservation confirmée et créneau bloqué                            │
│                                                                          │
│  [GAP P0] Étapes 1/2/3 promises mais aucun mécanisme code derrière :     │
│   - Pas de planification cadrage (pas de table CadrageMeeting)           │
│   - Pas de Stripe / Payment / Invoice                                    │
│   - Slot N'EST PAS bloqué en DB sur cette voie (pas de slotId set)       │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  EMAIL "booking-confirmed"  via queue `emails` (BullMQ)                  │
│  Sujet FR : "Votre intervention Axion-IA est réservée — <date>"          │
│  Sujet EN : "Your Axion-IA session is booked — <date>"                   │
│  src/lib/email/templates/booking-confirmed.tsx:40                        │
│                                                                          │
│  [GAP P0] Le sujet "est réservée" contredit la modale "pas encore        │
│  confirmée" (cf. BookingCalendar.tsx:1239) — incohérence message.        │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1.2 Vue d'ensemble — pose d'option 48h (voie minoritaire mais protégée)

```
   Visiteur sur /reserver (modale étendue ou form dédié)
              │
              │  formData (slotId, companyName, sector, contact, …)
              ▼
   ┌────────────────────────────────────────────────────────────┐
   │  postOption48hAction                                       │
   │  src/features/booking/actions.ts:150                       │
   │                                                            │
   │  • rate-limit option48h:<ip> 3/600s     actions.ts:155     │
   │  • Turnstile + honeypot                  actions.ts:160    │
   │  • option48hSchema (consentDisplay req)  actions.ts:170    │
   │  • tx :                                                    │
   │     SELECT ... FOR UPDATE calendar_slots actions.ts:197    │
   │     check status='available'             actions.ts:206    │
   │     bookingOption.create(status='pending',                 │
   │                          expiresAt=now+48h)                │
   │     calendarSlot.update(status='reserved')                 │
   │  • sendTelegram tag=OPTION               actions.ts:238    │
   │  • enqueueEmail option-posted            actions.ts:243    │
   │  → { ok, optionId, expiresAt }                             │
   └────────────────────────────────────────────────────────────┘
              │
              │   Slot passe `available` → `reserved` AVANT paiement.
              │   [GAP P0] Doctrine copy promet "verrouillé après acompte 50 %"
              │   mais le verrou est posé sans paiement.
              ▼
   ┌─── Worker option-reminder (cron 0 * * * *) ─────────────────┐
   │  src/server/queue/workers/option-reminder-worker.ts:13      │
   │  Fenêtre [now+22h, now+26h], reminderSentAt=null            │
   │  → enqueueEmail option-reminder                             │
   └──────────────────────────────────────────────────────────────┘
              │
              ▼
   ┌─── Worker option-expiration (cron */5 * * * *) ─────────────┐
   │  src/server/queue/workers/option-expiration-worker.ts:19    │
   │  expiresAt < now + status='pending'                         │
   │  → bookingOption.status='expired'                           │
   │  → calendarSlot.status='available' (si plus rien dessus)    │
   │  → enqueueEmail option-expired                              │
   │  → sendTelegram OPTION EXPIRÉE (silent)                     │
   └──────────────────────────────────────────────────────────────┘
              │
              │  OU action admin (cf. §2.2)
              ▼
   validateOptionAction → bookings_options.status='converted' + booking confirmed
   refuseOptionAction   → bookings_options.status='refused' + slot libéré
```

### 2.1.3 Détails de pré-fill `?intervention=<slug>`

| Slug                  | Source CTA principale                                                  | Fichier:ligne                                                                                        |
| --------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `essentielle`         | `/interventions/essentielle` (hub format) + sub-tier `&tier=<id>`      | `src/app/[locale]/interventions/essentielle/page.tsx:78,133`                                         |
| `approfondie`         | `/interventions/approfondie`                                           | `src/app/[locale]/interventions/approfondie/page.tsx:106`                                            |
| `gagner-du-temps`     | `/interventions/gagner-du-temps`                                       | `src/app/[locale]/interventions/gagner-du-temps/page.tsx:106`                                        |
| `audit-flash-onsite`  | `/audit` (Sprint 14.10.8) + `AuditDetailPage` sub-tiers                | `src/app/[locale]/audit/page.tsx:185,475,488` + `src/components/sections/AuditDetailPage.tsx:57,169` |
| `conference`          | (non vu en grep direct — passe par hub `/interventions/collectives`)   | `src/components/sections/CollectiveDurationListing.tsx:114`                                          |
| `dirigeants`          | (idem)                                                                 | `src/app/[locale]/interventions/page.tsx:739,919`                                                    |
| `intervention_claude` | aucun CTA `/reserver?intervention=intervention_claude` détecté en grep | `[GAP P1]` enum DB inutilisé en pre-fill                                                             |

CTAs « génériques » (sans pré-fill) :

- `src/components/nav/Header.tsx:108` (CTA header global)
- `src/app/[locale]/interventions/page.tsx:504,739,919` (hub)
- `src/app/[locale]/implantations/**/page.tsx` (pSEO régions/villes)

`[GAP P1]` Sub-tier preselection : `?tier=intimiste|standard|complete` géré uniquement pour `essentielle`. Pas équivalent pour `approfondie` (qui a aussi des sub-tiers selon `pricing.ts`).

---

## 2.2 Flux admin actuel (E2E)

```
                        ┌─────────────────────────┐
                        │  /login → /2fa → admin  │
                        │  signInAction + TOTP    │
                        │  features/admin-auth/   │
                        │     actions.ts:25       │
                        └────────────┬────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
   ┌────────────────┐        ┌────────────────┐       ┌──────────────────┐
   │ /submissions   │        │ /calendrier    │       │ /options         │
   │ listSubmiss…   │        │ getCalendar    │       │ listOptions      │
   │ admin-submiss/ │        │ MonthAction    │       │ admin-options/   │
   │ actions.ts:78  │        │ admin-calendar/│       │ actions.ts:65    │
   │                │        │ actions.ts:56  │       │                  │
   └───────┬────────┘        └────────┬───────┘       └────────┬─────────┘
           │                          │                        │
           │ click row                │ click date             │ click row
           ▼                          ▼                        ▼
   ┌────────────────┐        ┌────────────────┐       ┌──────────────────┐
   │ /submissions/  │        │  Panneau date  │       │ /options/[id]    │
   │   [id]         │        │  - voir slot   │       │ OptionActions    │
   │ updateSubm…    │        │  - bloquer     │       │  - valider       │
   │ eraseSubm…     │        │  - débloquer   │       │  - refuser       │
   │ (status/notes/ │        │  - annuler bk  │       │                  │
   │  assignedTo)   │        │                │       │                  │
   │ actions.ts:184 │        │                │       │                  │
   └────────────────┘        └────────┬───────┘       └────────┬─────────┘
                                      │                        │
                          ┌───────────┼───────────┐            │
                          ▼           ▼           ▼            │
                  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
                  │blockDate │ │unblock   │ │cancel    │       │
                  │Action    │ │Date      │ │Booking   │       │
                  │ :101     │ │Action    │ │Action    │       │
                  │FOR UPDATE│ │ :341     │ │ :202     │       │
                  │+ ActLog  │ │+ ActLog  │ │ Tel ANN. │       │
                  │          │ │          │ │ Email    │       │
                  └────┬─────┘ └────┬─────┘ │ booking- │       │
                       │            │       │ cancelled│       │
                       │            │       └─────┬────┘       │
                       │            │             │            │
                       ▼            ▼             ▼            ▼
              calendar_slots  calendar_slots  bookings    bookings_options
              status=blocked  status=avail.   status=     status=converted
                                              cancelled   ou refused
                                              + slot libéré

                       │ revalidatePath /reserver + /book (3 actions × C1)
                       ▼
                  Page publique reflète immédiatement la dispo
```

### 2.2.1 Actions présentes vs absentes côté admin booking/calendrier

| Action attendue                   | Présente ?                                       | Fichier:ligne                                                             |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Voir une réservation              | ✅ via `getSubmissionDetailAction`               | `admin-submissions/actions.ts:150`                                        |
| Accepter une option               | ✅ `validateOptionAction`                        | `admin-options/actions.ts:122`                                            |
| Refuser une option                | ✅ `refuseOptionAction`                          | `admin-options/actions.ts:243`                                            |
| Bloquer un slot                   | ✅ `blockDateAction`                             | `admin-calendar/actions.ts:101`                                           |
| Débloquer un slot                 | ✅ `unblockDateAction`                           | `admin-calendar/actions.ts:341`                                           |
| Annuler un booking confirmé       | ✅ `cancelBookingAction`                         | `admin-calendar/actions.ts:202`                                           |
| **Reporter / rescheduler**        | 🔴 **ABSENT** (enum `postponed` jamais utilisé)  | `prisma/schema.prisma:74` + grep = 0 hit                                  |
| Confirmer une réservation pending | 🔴 **ABSENT** (`pending → confirmed` impossible) | grep `status: "confirmed"` côté admin = 0 hit (sauf via option converted) |
| Gérer un conflit de slot          | ⚠️ implicite (verrous pessimistes) — pas d'écran | `actions.ts:194-235` + workers                                            |
| Saisir paiement / facture         | 🔴 **ABSENT** (pas de table Payment/Invoice)     | cf. Phase 0 §1.1                                                          |
| Saisir devis / NDA                | 🔴 **ABSENT**                                    | idem                                                                      |
| Reset 2FA d'un user               | ✅ `reset2FACrossUserAction` (super_admin)       | `admin-users/actions.ts:259`                                              |

`[GAP P0]` **Reschedule** : Will a documenté ce besoin dans le prompt source §4 « reporter », l'enum `BookingStatus.postponed` existe (`prisma/schema.prisma:74`), mais **aucun chemin admin** ne flippe vers cet état. Toutes les annulations forcent `cancelled`. Un report = aujourd'hui = annuler + reposer manuellement.

`[GAP P0]` **Confirm direct admin** : un booking créé via `createBookingAction` (voie directe sans option48h) reste pour toujours `status='pending'`. Aucun écran admin n'expose un bouton « marquer comme confirmé » (uniquement la voie option48h passe par `validateOptionAction` qui crée un booking direct `status='confirmed'`).

### 2.2.2 Garde-fous écriture admin

- `requireAdminWrite()` exige `role ∈ {super_admin, admin}` (`admin-calendar/actions.ts:25-31`).
- `requireAdminRead()` exige session valide (`:33-37`).
- Toute écriture booking/option/slot crée un `ActivityLog` immutable (cf. Reality Check §1).
- `blockDate` rejette si booking confirmé ou option pending sur le slot (`:140-145`) — `[GAP P1]` pas de mécanisme « force block » (utilité : reschedule client).

---

## 2.3 Cycle de vie actuel d'une réservation

### 2.3.1 États observés en code

#### `BookingStatus` (prisma/schema.prisma:69-74)

```
                           ┌──────────────────────────────────────────┐
                           │                                          │
                           │   ┌────────────┐                         │
        createBookingAction│   │            │                         │
       (voie directe)─────►┤   │  pending   │ ◄─── default value      │
        actions.ts:115     │   │            │                         │
                           │   └─────┬──────┘                         │
                           │         │                                │
                           │  ✗ aucune transition pending→confirmed   │
                           │  ✗ aucune transition pending→postponed   │
                           │  ✗ jamais réutilisé                      │
                           │         │                                │
                           │         ▼                                │
                           │   ┌────────────┐                         │
                           │   │ cancelled  │ ◄──── cancelBooking     │
                           │   └────────────┘       Action :252        │
                           │                                          │
                           │                                          │
                           │   ┌────────────┐                         │
                           │   │ confirmed  │ ◄──── validateOption    │
                           │   └────────────┘       Action crée       │
                           │         │              directement       │
                           │         │              status='confirmed'│
                           │         │              admin-options/    │
                           │         │              actions.ts:184    │
                           │         │                                │
                           │         │                                │
                           │  ✗ confirmed→cancelled OK (cancelBooking)│
                           │  ✗ confirmed→postponed PAS implémenté    │
                           │         │                                │
                           │         ▼                                │
                           │   ┌────────────┐                         │
                           │   │ cancelled  │                         │
                           │   └────────────┘                         │
                           │                                          │
                           │   ┌────────────┐  ✗ ORPHELIN — jamais   │
                           │   │ postponed  │     atteint en code    │
                           │   └────────────┘                         │
                           └──────────────────────────────────────────┘
```

#### `BookingOptionStatus` (prisma/schema.prisma:82-88)

```
                  postOption48hAction (visiteur)
                  actions.ts:211
                          │
                          ▼
                   ┌──────────────┐
                   │   pending    │ ◄── default
                   └──────┬───────┘
                          │
            ┌─────────────┼─────────────┬───────────────┐
            │             │             │               │
            ▼             ▼             ▼               ▼
   ┌──────────────┐  ┌─────────┐  ┌─────────┐    ┌────────────┐
   │  converted   │  │ refused │  │ expired │    │ confirmed  │
   │ (admin       │  │ (admin) │  │ (worker)│    │ ⚠️ ORPHELIN│
   │  validate)   │  │ :278    │  │ option- │    │ (jamais    │
   │  :189        │  │         │  │ expir.  │    │  atteint)  │
   │ + Booking    │  │         │  │ :63     │    │            │
   │ status=      │  │         │  │         │    │            │
   │ confirmed    │  │         │  │         │    │            │
   └──────────────┘  └─────────┘  └─────────┘    └────────────┘
```

#### `CalendarSlotStatus` (prisma/schema.prisma:76-80)

```
              ┌─────────────┐
              │  available  │ ◄── default
              └──────┬──────┘
                     │
        ┌────────────┼─────────────────┐
        │            │                 │
        ▼            ▼                 ▼
   ┌─────────┐  ┌─────────┐
   │reserved │  │ blocked │
   └────┬────┘  └────┬────┘
        │            │
        │ libération │ unblockDateAction
        │ (cancel    │ admin-calendar/
        │  Booking,  │ actions.ts:341
        │  refuse    │
        │  Option,   │
        │  expire    │
        │  Option)   │
        ▼            ▼
   ┌─────────┐  ┌─────────┐
   │available│  │available│
   └─────────┘  └─────────┘
```

### 2.3.2 Récapitulatif GAPs cycle de vie

| Transition manquante                           | Verdict    | Impact                                            |
| ---------------------------------------------- | ---------- | ------------------------------------------------- |
| `Booking.pending → confirmed` (admin)          | `[GAP P0]` | Booking voie directe reste à vie en pending       |
| `Booking.pending → postponed` (admin reporter) | `[GAP P0]` | Enum `postponed` jamais atteint                   |
| `Booking.confirmed → postponed`                | `[GAP P0]` | Idem — reschedule impossible sans cancel+new      |
| `BookingOption.pending → confirmed`            | `[GAP P2]` | Enum valeur `confirmed` jamais utilisée (mort-né) |
| `Booking.pending → cancelled` (auto-purge)     | `[GAP P1]` | Bookings pending orphelins jamais nettoyés        |

Cul-de-sacs identifiés :

- `Booking.status = postponed` : valeur enum définie, **0 chemin** vers cet état.
- `BookingOption.status = confirmed` : valeur enum définie, **0 chemin** vers cet état (`converted` est utilisé à la place).
- `Booking.status = pending` après `createBookingAction` directe : ne sort jamais vers `confirmed` côté admin.

---

## 2.4 Lien interventions ↔ booking ↔ audits ↔ implementation ↔ contact

### 2.4.1 Schéma de raccordement

```
   ┌──────────────────────────────────────────────────────────────────────┐
   │  SSOT TARIFS                                                          │
   │  src/content/pricing.ts                                               │
   │  - INTERVENTION_TIERS, ESSENTIELLE_SUB_TIERS, APPROFONDIE_SUB_TIERS   │
   │  - helpers (getEntryLabel, formatAmount, getTierById…)                │
   └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  SSOT CONTENU                                                         │
   │  src/content/interventions.ts                                         │
   │  src/content/audit-taxonomy.ts                                        │
   │  src/content/audit-detail-configs.ts                                  │
   │  src/content/interventions-taxonomy.ts (4 familles × N formats)       │
   └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  PAGES HUBS / DETAIL                                                  │
   │  /interventions, /interventions/collectives, /interventions/<slug>    │
   │  /audit, /audit/<slug>, /audit/demande                                │
   │  /implementation                                                       │
   │  /contact                                                              │
   │  /implantations/<region>/<ville> (pSEO 2150 villes)                   │
   └──────────────────────────────────────────────────────────────────────┘
                │              │                  │            │
                │ CTA          │ CTA              │ Form       │ Form
                │ ?intervention│ ?intervention    │ submit     │ submit
                ▼              ▼                  ▼            ▼
        /reserver       /reserver           /implementation  /contact
        (intervention)  (audit-flash-       (form 4 steps)  (form)
                         onsite)             submitImpl…    submitContact…
                                              actions.ts:21  actions.ts:21
        ─────────┬──── ─────────┬─────       ─────┬───────  ─────┬─────
                 │              │                 │              │
                 ▼              ▼                 ▼              ▼
        createBookingAction (or postOption48h)                   │
        actions.ts:41 / :150                                     │
                 │                                                │
                 ▼                                                ▼
        ┌─────────────────┐                          ┌──────────────────┐
        │  Submission     │ ─── one-to-many ───►     │  Submission      │
        │  type=          │                          │  type=           │
        │  intervention   │                          │  implementation  │
        │                 │                          │  audit           │
        │  + Booking      │                          │  contact         │
        │  (slotId via    │                          │                  │
        │  option48h, ou  │                          │  ✗ pas de        │
        │  null sur voie  │                          │  Booking lié     │
        │  directe)       │                          │  (sauf audit-    │
        └─────────────────┘                          │  flash-onsite    │
                                                     │  qui passe par   │
                                                     │  /reserver !)    │
                                                     └──────────────────┘
```

### 2.4.2 Mapping `InterventionType` (enum DB) ↔ `pricing.ts` ↔ pages

| Enum DB (`prisma/schema.prisma:57-67`) | Slug `pricing.ts` (tierId) | Pages source CTA → /reserver                                                                   |
| -------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `essentielle`                          | `intervention-essentielle` | `/interventions/essentielle/page.tsx:78,133` + hub `/interventions` + nav header               |
| `approfondie`                          | `intervention-approfondie` | `/interventions/approfondie/page.tsx:106`                                                      |
| `conference`                           | `intervention-conference`  | `/interventions/conference/page.tsx` (non vérifié ligne) + `CollectiveDurationListing.tsx:114` |
| `dirigeants`                           | `intervention-dirigeants`  | `/interventions/dirigeants/page.tsx` (non vérifié ligne)                                       |
| `gagner_du_temps`                      | `gagner-du-temps`          | `/interventions/gagner-du-temps/page.tsx:106`                                                  |
| `intervention_claude`                  | `intervention-claude`      | `[GAP P1]` Aucun CTA `?intervention=intervention_claude` détecté en grep                       |
| `audit_flash_onsite`                   | `audit-flash-onsite`       | `/audit/page.tsx:185,475,488` + `AuditDetailPage.tsx:57,169`                                   |

`[GAP P2]` Cohérence FR/EN URL : la page anglaise `/book` accepte aussi `?intervention=<slug>` mais slug reste français (`essentielle`, pas `essential`) car parseLocale + slugToEnum sont locale-agnostic (`src/lib/intervention-type.ts`).

### 2.4.3 Comportement par type de formulaire

| Form visiteur                     | Server Action                            | Crée Booking ?                               | Crée Submission ?      | Crée BookingOption ? | CalendarSlot impacté ? |
| --------------------------------- | ---------------------------------------- | -------------------------------------------- | ---------------------- | -------------------- | ---------------------- |
| `/reserver` direct                | `createBookingAction`                    | ✅ status=pending (jamais flippé)            | ✅ type=intervention   | ❌                   | ❌ (slotId null)       |
| `/reserver` option 48h            | `postOption48hAction`                    | ❌ (sera créé par admin via validateOption)  | ❌                     | ✅ status=pending    | ✅ available→reserved  |
| `/audit` (modale legacy)          | `submitAuditAction`                      | ❌                                           | ✅ type=audit          | ❌                   | ❌                     |
| `/audit/demande`                  | `submitAuditRequestAction`               | ❌                                           | ✅ type=audit          | ❌                   | ❌                     |
| `/audit` → audit-flash-onsite CTA | redirige vers `/reserver?intervention=…` | ✅ (cas particulier — audit avec un Booking) | ✅ type=intervention   | ❌                   | ❌ (sauf si option48h) |
| `/implementation`                 | `submitImplementationAction`             | ❌                                           | ✅ type=implementation | ❌                   | ❌                     |
| `/contact`                        | `submitContactAction`                    | ❌                                           | ✅ type=contact        | ❌                   | ❌                     |

`[GAP P1]` **audit-flash-onsite** crée un `Booking` (anomalie taxonomique : audit gère du booking) — distingue audits remote (Submission seulement) vs audit terrain (Booking + Submission). Pas explicité côté admin (les deux remontent dans `/submissions` sans signal visuel particulier).

### 2.4.4 Échantillon CTAs `/reserver` (12 fichiers, 60 occurrences brutes)

Comptage cible : `href="/reserver"` ou `href="/reserver?intervention=<…>"` ou variantes `href={`/reserver…`}`.

| Catégorie                            | Volume estimé | Fichiers représentatifs                                                                   |
| ------------------------------------ | ------------- | ----------------------------------------------------------------------------------------- |
| Header global                        | 1             | `nav/Header.tsx:108,153`                                                                  |
| Pages hub /interventions             | ~5            | `interventions/page.tsx:504,739,919` + `collectives/page.tsx:204`                         |
| Pages produit /interventions/<slug>  | ~4            | `essentielle/page.tsx:78,133`, `approfondie/page.tsx:106`, etc.                           |
| Page /audit (flash terrain)          | 3             | `audit/page.tsx:185,475,488`                                                              |
| Composant AuditDetailPage            | 2             | `AuditDetailPage.tsx:57,169`                                                              |
| Composants sections (cards, listing) | ~4            | `InterventionFormatCard.tsx:196`, `CollectiveDurationListing.tsx:114`                     |
| Pages pSEO villes/régions            | ~10           | `implantations/page.tsx:275` + `[region]/page.tsx` + `[ville]/page.tsx` + `VilleService*` |
| **Total estimé**                     | **~30**       | (les 60 occurrences brutes incluent variantes EN `/book`, regex string, etc.)             |

---

## 2.5 Notifications actuelles

### 2.5.1 Tableau exhaustif (côté code, lecture des `enqueueEmail` + `sendTelegram`)

| Trigger                                    | Destinataire                   | Canal    | Template / Tag                                                                      | Localisation           | Variables clés (payload)                                                                        |
| ------------------------------------------ | ------------------------------ | -------- | ----------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Réservation directe créée                  | Visiteur (`parsed.data.email`) | Email    | `booking-confirmed` — sujet « Votre intervention Axion-IA est réservée — <date> »   | FR + EN (locale param) | contactName, bookingDate, bookingTime, interventionType, participantsCount, bookingId           |
|                                            | Admin                          | Telegram | tag `INTERVENTION` (verbose, redact PII)                                            | FR (texte hardcodé)    | interventionType, date, participants, prix, redactContactLine, locale, ID                       |
| Option 48h posée                           | Visiteur                       | Email    | `option-posted` — « Option 48h sur le <date> — Axion-IA »                           | FR + EN                | contactName, companyName, bookingDate, interventionType, participantsCount, expiresAt, optionId |
|                                            | Admin                          | Telegram | tag `OPTION`                                                                        | FR                     | société, sector, intervention, participants, redactContactLine, expiresAt, locale, ID           |
| Option 48h — rappel H+24                   | Visiteur                       | Email    | `option-reminder` — « Rappel : option 48h expire dans 24h »                         | FR + EN                | contactName, bookingDate, interventionType, expiresAt, optionId                                 |
| Option 48h expirée (worker)                | Visiteur                       | Email    | `option-expired` — « Option 48h expirée — Axion-IA »                                | FR + EN                | contactName, bookingDate, interventionType                                                      |
|                                            | Admin                          | Telegram | tag `OPTION EXPIRÉE` (silent)                                                       | FR                     | redactName, date, intervention, ID                                                              |
| Option validée par admin (devient booking) | Visiteur                       | Email    | `option-confirmed-by-admin` — « Option confirmée — intervention Axion-IA réservée » | FR + EN                | contactName, bookingDate, interventionType, bookingId                                           |
|                                            | Admin                          | Telegram | tag `OPTION CONFIRMÉE`                                                              | FR                     | option ID, société, date, booking ID                                                            |
| Option refusée par admin                   | Visiteur                       | Email    | `option-refused-by-admin` — « Option non retenue — Axion-IA »                       | FR + EN                | contactName, bookingDate, interventionType, reason                                              |
|                                            | Admin                          | Telegram | tag `OPTION REFUSÉE`                                                                | FR                     | option ID, société, date, motif                                                                 |
| Booking annulé par admin                   | Visiteur (si email connu)      | Email    | `booking-cancelled` — « Réservation annulée — Axion-IA »                            | FR + EN                | contactName, bookingDate, interventionType, reason                                              |
|                                            | Admin                          | Telegram | tag `ANNULATION`                                                                    | FR                     | booking ID, date, type, motif                                                                   |
| Audit (legacy) soumis                      | Visiteur                       | Email    | `audit-confirmed` — « Demande d'audit reçue — Axion-IA »                            | FR + EN                | contactName, size, industry, submissionId                                                       |
|                                            | Admin                          | Telegram | tag `AUDIT`                                                                         | FR                     | size, modality, sector, redactContactLine, locale, ID                                           |
| Audit (form /audit/demande) soumis         | Visiteur                       | Email    | `audit-confirmed` (réutilisé)                                                       | FR + EN                | idem                                                                                            |
|                                            | Admin                          | Telegram | tag `AUDIT`                                                                         | FR                     | auditType, scope, city, size, industry…                                                         |
| Implementation soumis                      | Visiteur                       | Email    | `implementation-confirmed` — « Demande d'implémentation reçue — Axion-IA »          | FR + EN                | contactName, implType, budget, submissionId                                                     |
|                                            | Admin                          | Telegram | tag `AUTO`                                                                          | FR                     | type, budget, redactContactLine, locale, ID                                                     |
| Contact soumis                             | Visiteur                       | Email    | `contact-confirmed` — « Message bien reçu — Axion-IA »                              | FR + EN                | (à confirmer — non lu)                                                                          |
|                                            | Admin                          | Telegram | tag `CONTACT`                                                                       | FR                     | nom, email, message tronqué                                                                     |
| Newsletter double opt-in                   | Visiteur                       | Email    | `newsletter-confirm-optin`                                                          | FR + EN                | confirmToken, locale                                                                            |
|                                            | Admin                          | Telegram | tag `NEWSLETTER` (silent)                                                           | FR                     | email, source                                                                                   |
| RGPD export demandé                        | Visiteur                       | Email    | `gdpr-export-link` (Sprint 24)                                                      | FR + EN                | downloadUrl, expiresAt                                                                          |

### 2.5.2 GAPs notifications

`[GAP P0]` Aucun template `quote-sent`, `nda-sent`, `payment-receipt`, `invoice-issued`, `payment-link`, `payment-reminder`, `cadrage-scheduled`. Toute la promesse copy « call de cadrage + acompte + facture » est sans canal côté code.

`[GAP P1]` Sujet email `booking-confirmed` FR : « est réservée » alors que la modale et la copy promettent « pas encore confirmée — verrouillé après acompte 50 % ». Conflit sémantique.

`[GAP P1]` Aucune notification interne lorsque le slot d'un booking direct (`createBookingAction`) reste `pending` au-delà d'un seuil — aucun garde-fou pour ces orphelins.

`[GAP P2]` Pas de digest hebdomadaire / récap pour admin (toutes les notifs Telegram sont unitaires).

---

## 2.6 Flux légal/contractuel actuel

### 2.6.1 Engagement contractuel implicite au moment du clic « Réserver »

**Étape 4 de la modale `BookingCalendar` — Récap + Confirmation** :

```
BookingCalendar.tsx:1935-1947
─────────────────────────────────
  <label>
    <input type="checkbox" checked={consent} … />
    <span>
      FR : "J'accepte d'être contacté·e pour valider cette réservation
            et les modalités. Données traitées selon notre politique
            de confidentialité."
      EN : "I agree to be contacted to confirm this booking and discuss
            the practicalities. Data handled per our privacy policy."
    </span>
  </label>
```

**Constat factuel** :

- `[GAP P0]` La case cochable est un consentement **RGPD-uniquement** (être contacté · politique de confidentialité). Elle **NE référence PAS les CGV** (`/conditions-generales` / `/terms-of-service`).
- `[GAP P0]` Aucun lien vers CGV n'est affiché dans la modale ni dans le step 4. Le seul lien CGV est dans le `<CtaBlock>` bas de page `/reserver` (`reserver/page.tsx:475-477` — outside modale, hors entonnoir).
- `[GAP P0]` Pas de case « J'accepte les CGV », pas de mention « En cliquant Confirmer, vous acceptez les CGV ».
- `[GAP P0]` Pas de timestamp d'acceptation CGV stocké en DB (pas de colonne `Booking.acceptedTermsAt` ni `Submission.acceptedTermsAt`).
- `[GAP P1]` Pas d'horodatage de version CGV consentie (pas de `acceptedTermsVersion`).

### 2.6.2 Documents que reçoit le visiteur — état des lieux

Grep cible : `invoice`, `facture`, `quote`, `devis`, `nda`, `signature`, `stripe`, `payment-link` dans `src/` (hors copy marketing).

| Document attendu (par copy)                                | Présence code                                                                | Vérification grep                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Devis (PDF)                                                | 🔴 **ABSENT** — pas de `model Quote`, pas de template, pas de générateur PDF | Phase 0 §1.1 + grep `model Quote` = 0 + grep `quote-sent` template = 0     |
| NDA (PDF + signature)                                      | 🔴 **ABSENT** — pas de `model Nda`, pas de provider e-signature              | Grep `yousign                                                              | docusign` = 0 hit en code (`\_AUDIT` doc only). Cf. Phase 0 §7.5 |
| Facture acompte 50 %                                       | 🔴 **ABSENT** — pas de `model Invoice`, pas de numérotation, pas de template | Phase 0 §1.1                                                               |
| Facture solde 50 %                                         | 🔴 **ABSENT** — idem                                                         | idem                                                                       |
| Lien de paiement (Stripe Checkout / SEPA)                  | 🔴 **ABSENT** — pas de SDK Stripe, pas d'action `createCheckoutSession`      | `package.json:65-113` grep `stripe` = 0 + grep `payment-link` template = 0 |
| Reçu de paiement                                           | 🔴 **ABSENT**                                                                | grep `payment-receipt` template = 0                                        |
| Convocation cadrage (date + lien visio)                    | 🔴 **ABSENT** — pas de `model CadrageMeeting`, pas de visio provider intégré | Phase 0 §1.1 + §7.6                                                        |
| Confirmation booking (email transactionnel)                | ✅ `booking-confirmed.tsx`                                                   | ✓                                                                          |
| Confirmation cancellation (email transactionnel)           | ✅ `booking-cancelled.tsx`                                                   | ✓                                                                          |
| Confirmation option48h posée / expirée / validée / refusée | ✅ 4 templates                                                               | ✓                                                                          |
| Onboarding doc (livret, slides)                            | 🔴 **ABSENT** — pas de `model OnboardingDoc`, pas de mécanisme d'attachement | Phase 0 GAP #18                                                            |

### 2.6.3 Engagement légal CGV : ce que dit le code vs ce que disent les CGV

| Clause CGV (`legal.ts`)                                                        | Mécanisme code                                                       | Verdict    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------- |
| « Annulation > 7 j : 100 % remboursement » (`legal.ts:134`)                    | Aucun `Refund` model, aucune action de remboursement                 | `[GAP P0]` |
| « Annulation 7-2 j : 50 % » (`legal.ts:134`)                                   | idem                                                                 | `[GAP P0]` |
| « Annulation < 2 j : 0 % » (`legal.ts:134`)                                    | idem                                                                 | `[GAP P0]` |
| « Créneau reportable une fois sans frais » (`legal.ts:134`)                    | Aucun chemin code vers `Booking.status=postponed`                    | `[GAP P0]` |
| « Force majeure » (`legal.ts:127,454`)                                         | Aucun mécanisme automatisé                                           | `[GAP P1]` |
| « Acompte 50 % avant intervention » (copy `interventions.ts:236`)              | Aucune intégration paiement                                          | `[GAP P0]` |
| « Facture immédiate après acompte » (copy `interventions.ts:236`)              | Aucun générateur                                                     | `[GAP P0]` |
| « Devis transparent fourni avant signature » (copy `interventions.ts:244-246`) | Aucun `Quote` model                                                  | `[GAP P0]` |
| « Données conservées 24 mois après archive » (`legal.ts` politique)            | ✅ `retention-purge-worker.ts:11-16` (defaults `RETENTION_*_MONTHS`) | ✅ OK      |

### 2.6.4 Synthèse — chaîne contractuelle observée

```
   AUJOURD'HUI  (état HEAD ff3ccbc, V2.1 LIVE)
   ─────────────────────────────────────────────
   1. Visiteur clique "Réserver" sur /interventions/<slug>
   2. Pre-fill modale via ?intervention=<slug>[&tier=<id>]
   3. Saisit 4 steps  + coche RGPD-only consent
   4. Server Action createBookingAction  (ou postOption48h)
   5. Booking inséré status=pending
                (ou BookingOption pending + slot reserved)
   6. Email confirmation envoyé (template "...est réservée")
   7. Telegram tag INTERVENTION → Will alerté

   ⚠️  RIEN d'autre côté code.
   - Aucune CGV acceptée (juste RGPD).
   - Aucun devis émis.
   - Aucun NDA proposé.
   - Aucun lien paiement.
   - Aucune facture.
   - Aucun cadrage planifié.
   - Slot NON verrouillé sur la voie directe createBooking
     (slotId=null) — verrou uniquement via option48h ou conversion admin.

   Promesse copy ("call cadrage + acompte 50 % + facture immédiate")
   = engagement manuel hors-code, sans trace DB ni audit RGPD.
```

`[GAP P0]` La chaîne entre la promesse marketing (`/interventions/*`, `/reserver` CtaBlock, modale "3 étapes") et l'exécution code (un seul email + Telegram) est entièrement manuelle. Toute exécution doctrine (devis · NDA · acompte · facture · cadrage) est hors-code aujourd'hui.

---

## 9. Résumé final des GAPs identifiés en Phase 1

### P0 — Critique pour Sprint Booking-Deposit V1

1. **CGV non acceptées au booking** — checkbox RGPD-only, aucun lien CGV dans la modale, pas de `acceptedTermsAt` en DB.
2. **Slot non verrouillé sur voie directe** `createBookingAction` (slotId null) — promesse copy « créneau verrouillé après acompte » contredite par le verrou option48h pré-paiement.
3. **Reschedule impossible** — enum `Booking.status=postponed` orphelin, aucune action admin.
4. **Confirm direct admin impossible** — booking voie directe reste `pending` à vie (pas de bouton admin pour flipper en `confirmed`).
5. **Devis, NDA, facture, paiement, cadrage** — promesses copy (cf. `interventions.ts:236, 230, 244-246`) sans aucun modèle, action, template, ni provider intégré.
6. **Sujet email contradictoire** — `booking-confirmed.tsx:43` « est réservée » alors que la modale dit « pas encore confirmée ».
7. **Remboursement CGV non automatisé** — clauses annulation 100/50/0 % sans `Refund` model ni intégration Stripe.

### P1 — Important pour cohérence V1

8. **`intervention_claude`** enum DB inutilisé en CTA pre-fill (`?intervention=intervention_claude` = 0 grep).
9. **Sub-tier preselection** limitée à `essentielle` (pas pour `approfondie`).
10. **Audit-flash-onsite** crée un `Booking` (anomalie taxonomique audit vs intervention) sans distinction visuelle admin.
11. **Bookings pending orphelins** créés par voie directe — pas de purge auto si jamais flippés.
12. **Pas de timestamp version CGV** consentie (`acceptedTermsVersion`).
13. **Pas de force-block admin** sur slot avec option pending (utile pour reschedule).
14. **Pas de digest admin** (toutes les notifs Telegram sont unitaires).

### P2 — Dette technique

15. **`BookingOption.status=confirmed`** valeur enum mort-née (`converted` utilisée à la place).
16. **`Booking.calendarEventId`** colonne legacy Cal.com inutilisée (cf. Phase 0 GAP #14).
17. **URL `/book?intervention=essentielle`** garde le slug FR (non bloquant — locale-agnostic).

---

## Notes méthodologiques

- Aucune écriture code applicatif, aucun `git`, aucun `pnpm`. ✅ Conforme AUDIT-ONLY.
- Citations systématiques `file:LINE` sur HEAD `ff3ccbc9`.
- Diagrammes ASCII (rendu uniforme cross-éditeurs vs mermaid).
- Phase 0 `00-REALITY-CHECK.md` consultée mais pas réinventaire (uniquement réutilisation des sources).
- Templates email ouverts pour les sujets `booking-confirmed`, `booking-cancelled`, `option-posted`, `option-reminder`, `option-expired`, `option-confirmed-by-admin`, `option-refused-by-admin`, `audit-confirmed`, `implementation-confirmed`, `contact-confirmed` — sujets retranscrits §2.5.1.
- Le wiring `BookingCalendar.tsx::handleSubmit()` lu lignes 712-774 confirme : `participantsCount` mid-bracket, fullName concat, notes en string `|`-séparée, time hardcodé `09:00`, locale propagée.
- Phase 1 n'écrit que ce `.md`. Pas d'interprétation business — uniquement diff observable code vs copy/CGV.
