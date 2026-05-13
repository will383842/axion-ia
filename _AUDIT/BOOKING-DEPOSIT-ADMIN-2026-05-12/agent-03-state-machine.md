# Agent 03 — State Machine Booking (deposit-gated + cadrage + devis + NDA)

**Audit** : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/`
**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia\`
**HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742`
**Date** : 2026-05-12
**Mode** : AUDIT-ONLY (lecture-seule, aucune écriture code applicatif).
**Brief** : §3 prompt master `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` (Agent 3) — repose sur `00-REALITY-CHECK.md` §1 et §9.

---

## 1. Périmètre audité

| Fichier                                                | Rôle inspecté                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `prisma/schema.prisma` lignes 35-286                   | Enums `BookingStatus`, `CalendarSlotStatus`, `BookingOptionStatus` + modèles `Booking`, `CalendarSlot`, `BookingOption`. |
| `src/features/booking/actions.ts`                      | `createBookingAction` + `postOption48hAction`.                                                                           |
| `src/features/admin-options/actions.ts`                | `listOptionsAction` / `validateOptionAction` / `refuseOptionAction` / `getOptionDetailAction`.                           |
| `src/features/admin-calendar/actions.ts`               | `getCalendarMonthAction` / `blockDateAction` / `cancelBookingAction` / `unblockDateAction`.                              |
| `src/server/queue/workers/option-expiration-worker.ts` | Transition cron `pending → expired` (référencée via reality-check §5).                                                   |
| `src/server/queue/workers/option-reminder-worker.ts`   | Rappel H+24 (pas une transition d'état).                                                                                 |
| `src/server/queue/workers/retention-purge-worker.ts`   | Hard-delete `cancelled` après 12 mois (terminal).                                                                        |

Hors périmètre : Stripe, Yousign, Quote, Invoice, Refund, CadrageMeeting, OnboardingDoc — tous absents (cf. reality-check §1.1).

---

## 2. Constats positifs

- **P+1** — Verrou pessimiste `SELECT … FOR UPDATE` systématique : poste option (`booking/actions.ts:197`), validation option (`admin-options/actions.ts:146-150` + `:166`), annulation booking (`admin-calendar/actions.ts:223-229` + `:238`), block date (`admin-calendar/actions.ts:125-129`). Race condition « 2 admins valident même option » sealed.
- **P+2** — Audit log systématique sur chaque transition admin : `option.validated`, `option.refused`, `booking.cancelled`, `calendar.blocked`, `calendar.unblocked` (`activity_logs` table, immutable, `changes Json`). Conforme doctrine RGPD trace.
- **P+3** — Idempotence de re-validation : gardes `status !== "pending"` empêchent double validation (`admin-options/actions.ts:152` + `:269`).
- **P+4** — Re-vérif `slot.status === "reserved"` avant libération slot (`admin-options/actions.ts:299` + `admin-calendar/actions.ts:269`) → pas de retro-flip parasite si slot bloqué entre-temps.
- **P+5** — Worker `option-expiration` re-lit `status='pending'` dans la même tx avec lock (cf. reality-check §5) → idempotent même si cron déclenché 2× en concurrence.
- **P+6** — Émission Telegram + email **hors transaction** (`admin-options/actions.ts:213` + `:227`) → conforme audit Fork 1 C2 best-effort, pas de blocage tx sur I/O réseau.
- **P+7** — `Booking.slotId @unique` (`prisma/schema.prisma:214`) → garantie DB hard de l'invariant « 1 booking par slot ».
- **P+8** — `revalidatePath` triggered pour FR + EN sur chaque transition admin → cache public cohérent (Sprint 24 C1, `admin-options/actions.ts:226-229`).

---

## 3. Constats négatifs

### 3.1 P0 — State machine actuelle ne couvre pas le besoin V1 deposit-gated

| ID  | Gap                                                                                                                                                                                                 | Source code                                   | Impact |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------ |
| N1  | Enum `BookingStatus` n'a que 4 valeurs (`pending/confirmed/cancelled/postponed`) — insuffisant pour V1 cible (≈ 22 valeurs).                                                                        | `prisma/schema.prisma:69-74`                  | 🚨 P0  |
| N2  | `Booking.status='confirmed'` est posé **avant tout paiement** par `validateOptionAction` (`admin-options/actions.ts:184`). « Confirmed » ne traduit pas l'acompte reçu.                             | `admin-options/actions.ts:175-186`            | 🚨 P0  |
| N3  | Pas de FK `paymentId`/`invoiceId`/`quoteId` sur Booking → impossible de prouver liaison `confirmed ⇒ payment.succeeded`.                                                                            | `prisma/schema.prisma:201-228`                | 🚨 P0  |
| N4  | Cadrage non modélisé : pas de transition `cadrage_scheduled → cadrage_held`, pas de `CadrageMeeting`.                                                                                               | `prisma/schema.prisma` (no Cadrage)           | 🚨 P0  |
| N5  | Pas de branche `quote_required`/`nda_required` ni de garde-fou applicable (`amountHtCents > 5_000_00` / `companySize ∈ ETI`).                                                                       | `prisma/schema.prisma` (no Quote, no Nda)     | 🚨 P0  |
| N6  | Pas de transition `reminded_j7 / in_progress / completed / invoiced_balance / paid_balance / archived` → tout le post-acompte est invisible côté admin.                                             | `prisma/schema.prisma:69-74`                  | 🚨 P0  |
| N7  | Pas de différenciation `cancelled_by_user / cancelled_by_admin / no_show / force_majeure` → impossible d'appliquer la grille CGV `> 7j 100% / 7-2j 50% / < 2j 0%`.                                  | `prisma/schema.prisma:69-74` + `legal.ts:134` | 🚨 P0  |
| N8  | Pas de table `BookingTransition` (event sourcing) → l'audit trail vit dans `ActivityLog` générique avec `targetType='booking'`, pas de snapshot before/after dédié au booking, pas de rejouabilité. | `activity_logs` table                         | 🚨 P0  |

### 3.2 P1 — Robustesse / cohérence

| ID  | Gap                                                                                                                                                                                | Source                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------ | ----------------------------------- |
| N9  | Status `postponed` (`prisma/schema.prisma:73`) **n'est jamais écrit** par aucune action — grep `"postponed"` dans `src/features/` → 0 résultat. Mort-né.                           | `prisma/schema.prisma:73`                                     |
| N10 | `cancelBookingAction` ne stocke pas le motif applicable CGV (`cancellation_window: ">7d"                                                                                           | "2-7d"                                                        | "<2d"`) → calcul refund non automatisable. | `admin-calendar/actions.ts:252-258` |
| N11 | Pas de transition « reschedule » : le seul moyen actuel est `cancel` puis re-créer un Booking → casse traçabilité « créneau reportable une fois sans frais » (CGV `legal.ts:134`). | `admin-calendar/actions.ts`                                   |
| N12 | `audit_flash_onsite` (Sprint 14.10.8) traversera **le même flow cadrage** que les autres si rien n'est fait — non-skip non implémenté (D9).                                        | `prisma/schema.prisma:64-66`                                  |
| N13 | Pas de garde sur transitions arrière (`confirmed → pending`) — aujourd'hui prisma.update accepte n'importe quel flip. Manque table de transitions valides.                         | `admin-options/actions.ts:184` + tout `prisma.booking.update` |
| N14 | `Booking.bookingDate` ne distingue pas « date de l'intervention » vs « date du cadrage planifié » → si on encode le cadrage_scheduled on perd la date d'intervention.              | `prisma/schema.prisma:204`                                    |

### 3.3 P2 — Hygiène

| ID  | Gap                                                                                                                                                                          | Source                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| N15 | `BookingOption.status='confirmed'` (enum) **n'est jamais écrit** — `validateOptionAction` flippe directement vers `converted` (`admin-options/actions.ts:192`). État zombie. | `prisma/schema.prisma:84` + `admin-options/actions.ts:192` |
| N16 | Colonne `Booking.calendarEventId` (`prisma/schema.prisma:217`) — legacy Cal.com inutilisé (Grep `calendarEventId` src/ = 0). Reality-check §9 GAP 14.                        | `prisma/schema.prisma:217`                                 |
| N17 | Pas de field `paymentDeadline` sur Booking → l'expiration `deposit_pending → expired` ne peut pas être pilotée par cron sans donnée d'ancrage.                               | `prisma/schema.prisma:201-228`                             |
| N18 | Pas de table d'idempotence (Stripe `idempotencyKey`, Yousign `requestId`) → webhook replay non géré.                                                                         | reality-check §1.1                                         |

### 3.4 P3 — Cosmétique

| ID  | Gap                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N19 | Statuts enum en `snake_case` + futures valeurs longues (`cadrage_scheduled`, `invoiced_balance`) → vérifier que prisma génère le bon mapping. Postgres aime `snake_case`. |
| N20 | Documenter la doctrine dans `prisma/schema.prisma` au-dessus de l'enum (commentaire bloc) — actuellement zéro commentaire sur les valeurs.                                |

---

## 4. Section 1 (du brief) — State machine ACTUELLE (observée en code)

### 4.1 Valeurs `BookingStatus`

`prisma/schema.prisma:69-74` :

```
enum BookingStatus {
  pending
  confirmed
  cancelled
  postponed
}
```

`pending` = default création par `createBookingAction`. `confirmed` = posé par `validateOptionAction` (booking issu de l'option 48h, `admin-options/actions.ts:184`). `cancelled` = posé par `cancelBookingAction` (`admin-calendar/actions.ts:252-258`). `postponed` = **jamais écrit en code** (P1 N9).

### 4.2 Valeurs `CalendarSlotStatus`

`prisma/schema.prisma:76-80` :

```
enum CalendarSlotStatus { available  reserved  blocked }
```

### 4.3 Valeurs `BookingOptionStatus`

`prisma/schema.prisma:82-88` :

```
enum BookingOptionStatus { pending  confirmed  refused  expired  converted }
```

`confirmed` **mort-né** (jamais écrit, cf. N15).

### 4.4 Diagramme ASCII transitions actuelles

```
                                ┌──────────────────────────────────┐
                                │ CalendarSlot                       │
                                │ (available → reserved → available) │
                                └──────────────────────────────────┘
                                            ▲          │
                                            │          │ (option/booking liberation)
                                            │          ▼
visiteur                                    │   admin/cron
   │                                        │      │
   │ createBookingAction                    │      │ blockDateAction → blocked
   │ (path direct, sans slotId)             │      │
   │                                        │      │ unblockDateAction → available
   ▼                                        │      │
Booking.status = pending                    │      │ cancelBookingAction → release slot
   │                                        │      ▼
   │ (aucune transition de paiement)        │   BookingOption.status
   │                                        │   pending ──▶ converted (validateOption)
   └─ aucun flux observé pour faire         │   pending ──▶ refused   (refuseOption)
      pending → confirmed côté direct       │   pending ──▶ expired   (option-expiration cron)
                                            │
visiteur                                    │
   │ postOption48hAction                    │
   ▼                                        │
BookingOption.status = pending              │
slot.status = reserved                      │
   │                                        │
   │ validateOptionAction (admin)           │
   ▼                                        │
BookingOption.status = converted ────────────┘
+ crée Booking.status = "confirmed"
  (avec slotId @unique)
  ⚠️ confirmed posé AVANT paiement
```

### 4.5 Effets de bord observés par transition

| Transition source → cible                                      | Trigger                                  | Telegram           | Email enqueue               | Slot effet                                                          | Audit log                     |
| -------------------------------------------------------------- | ---------------------------------------- | ------------------ | --------------------------- | ------------------------------------------------------------------- | ----------------------------- |
| ∅ → `Booking.pending`                                          | `createBookingAction` (visiteur)         | `INTERVENTION`     | `booking-confirmed`         | aucun (path direct, pas de slotId)                                  | ∅ (création visiteur)         |
| ∅ → `BookingOption.pending` + slot `reserved`                  | `postOption48hAction` (visiteur)         | `OPTION`           | `option-posted`             | flip `available → reserved`                                         | ∅                             |
| `BookingOption.pending → converted` + crée `Booking.confirmed` | `validateOptionAction` (admin)           | `OPTION CONFIRMÉE` | `option-confirmed-by-admin` | reste `reserved`                                                    | `option.validated`            |
| `BookingOption.pending → refused`                              | `refuseOptionAction` (admin)             | `OPTION REFUSÉE`   | `option-refused-by-admin`   | si pas d'autre option/booking : `reserved → available`              | `option.refused`              |
| `BookingOption.pending → expired`                              | cron `option-expiration-worker` \*/5 min | `OPTION EXPIRÉE`   | `option-expired`            | si plus rien : `reserved → available`                               | (worker log, pas ActivityLog) |
| `Booking.* → cancelled`                                        | `cancelBookingAction` (admin)            | `ANNULATION`       | `booking-cancelled`         | si plus rien : `reserved → available`                               | `booking.cancelled`           |
| `Slot → blocked`                                               | `blockDateAction`                        | ∅                  | ∅                           | `available → blocked` (refuse si booking confirmed/options pending) | `calendar.blocked`            |
| `Slot blocked → available`                                     | `unblockDateAction`                      | ∅                  | ∅                           | `blocked → available`                                               | `calendar.unblocked`          |

### 4.6 Invariants observés (code actuel)

- ✅ `Booking.slotId @unique` → 1 booking par slot DB hard (`prisma/schema.prisma:214`).
- ✅ Verrou pessimiste `FOR UPDATE` sur option + slot avant flip (`admin-options/actions.ts:146-150` + `:166`).
- ✅ `validateOption` requiert `option.status='pending'` (idempotent re-call, `admin-options/actions.ts:152`).
- ✅ `cancelBooking` requiert `booking.status !== 'cancelled'` (idempotent, `admin-calendar/actions.ts:231`).
- ✅ `blockDate` refuse si `booking.confirmed` ou `options pending` existent (`admin-calendar/actions.ts:140-145`).

### 4.7 Invariants MANQUANTS

- 🚨 Aucun lien `Booking.status='confirmed' ⇒ Payment.status='succeeded'` (Payment n'existe pas).
- 🚨 Aucune table de transitions valides → tout `prisma.booking.update({ status })` peut être tenté.
- 🚨 Pas de role check granulaire par transition (only `super_admin/admin` vs `read`). Pas de séparation « peut annuler avec refund » vs « peut juste no-show ».
- 🚨 Pas d'horloge déterministe pour `bookingDate` vs `cadrageDate` vs `paymentDeadline` (1 seul champ `bookingDate`).
- 🚨 Pas de garde « si `validationDecision = NEGATIVE` au cadrage → terminate sans facturation » (D14 prompt master).

---

## 5. Section 2 — State machine CIBLE V1 (deposit-gated) — VALIDATION

### 5.1 Diagramme cible commenté

Le diagramme du brief (§3 Agent 3 prompt source) est **conservé in extenso** avec annotations de validation :

```
draft (form en cours — état UI uniquement, pas en DB)
   → option_pending (option 48h posée, slot.reserved)  [V1, existe partiellement]
      → cadrage_scheduled (call de cadrage planifié)    [V1, NOUVEAU]
         → cadrage_held (call effectué)                  [V1, NOUVEAU]
            ├─ validationDecision = NEGATIVE → cadrage_declined (terminate, refund total option)
            ├─ quote_required ? (amountHtCents > 5_000_00)
            │     → quote_sent (Yousign signature request)         [V1, NOUVEAU]
            │        → quote_signed                                 [V1, NOUVEAU]
            │        → quote_declined (terminate, refund)
            └─ nda_required ? (companySize ∈ {ETI, GRANDE} OR sector sensitive)
                  → nda_pending → nda_signed | nda_declined (terminate)
            → deposit_pending (Stripe Checkout Session créée)       [V1, NOUVEAU]
               → confirmed (webhook payment_intent.succeeded)        [V1, redéfini]
                  → reminded_j7 (cron J-7 facture solde émise)        [V1, NOUVEAU]
                     → in_progress (jour J)                            [V1, NOUVEAU]
                        → completed (J+1 admin OU cron auto)             [V1, NOUVEAU]
                           → invoiced_balance                              [V1, NOUVEAU]
                              → paid_balance                                 [V1, NOUVEAU]
                                 → archived (cron retention, ≥ 12 mois)        [V1, NOUVEAU]

Branches d'erreur/sortie (transversales) :
   expired               (cron 48h sans paiement deposit_pending → expired)
   cancelled_by_user     (lien magique self-service, ≥ J-7 = full refund / 7-2j = 50% / <2j = 0%)
   cancelled_by_admin    (rétractation Will = refund total + slot libéré)
   no_show               (J+1 admin : aucun refund, facture solde émise quand même)
   force_majeure         (Will côté / catastrophe : refund total + reschedule prio)
   refunded_partial      (50%)
   refunded_full         (100%)
   quote_declined        (V1)
   nda_declined          (V1)
   cadrage_declined      (V1, validationDecision = NEGATIVE)

Branches V2+ envisagées :
   reschedule_pending → reschedule_confirmed (D19, ≥ J-7 client, 1x sans frais CGV legal.ts:134)
```

**Validation prompt master § 3 Agent 3** : le diagramme est cohérent **sous condition** d'introduire :

1. Enum `BookingStatus` étendu de 22 valeurs.
2. Table `BookingTransition` (event sourcing) : `id`, `bookingId`, `fromStatus`, `toStatus`, `trigger`, `actorType` (admin/cron/webhook/user), `actorId?`, `changesJson`, `createdAt`.
3. Champs additionnels Booking : `paymentDeadline`, `cadrageScheduledAt`, `cadrageHeldAt`, `validationDecision`, `quoteRequired`, `ndaRequired`, `cancellationReason`, `cancellationWindow` (`>7d|2-7d|<2d|fm`), `companySize` (snapshot).
4. Tables FK : `Payment`, `Quote`, `Nda`, `Invoice`, `Refund`, `CadrageMeeting` (reality-check §1.1).

### 5.2 Tableau détaillé des transitions (par cible V1)

Format : `From → To | Trigger | Effets de bord | Idempotence | Audit |`

| #   | From                                             | To                               | Trigger                                                                                  | Effets de bord (email/Telegram/slot/invoice/refund/log)                                                                                                                      | Idempotence (clé naturelle)                                          | Audit log                    |
| --- | ------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------- |
| T1  | ∅                                                | option_pending                   | visiteur form `postOption48h`                                                            | Email `option-posted` · Telegram `OPTION` · `slot.reserved` · `BookingTransition`                                                                                            | `bookingId` (nouveau)                                                | `booking.option_posted`      |
| T2  | option_pending                                   | cadrage_scheduled                | admin propose créneau cadrage (visio link Whereby/Jitsi)                                 | Email `cadrage-scheduled` (NEW template) · Telegram `CADRAGE PLANIFIÉ` · `CadrageMeeting.create()`                                                                           | `(bookingId, "cadrage_scheduled")`                                   | `booking.cadrage_scheduled`  |
| T3  | cadrage_scheduled                                | cadrage_held                     | admin marque held après le call                                                          | Telegram `CADRAGE TENU` · `CadrageMeeting.heldAt=now` · log decision `validationDecision`                                                                                    | `(bookingId, "cadrage_held")`                                        | `booking.cadrage_held`       |
| T4  | cadrage_held                                     | cadrage_declined                 | admin choisit "intervention non pertinente"                                              | Email `cadrage-declined` · Telegram `CADRAGE REFUSÉ` · si option encore : `expire option` · `slot.available`                                                                 | `(bookingId, "cadrage_declined")`                                    | `booking.cadrage_declined`   |
| T5  | cadrage_held                                     | quote_sent                       | si `amountHtCents > 5_000_00` (D11)                                                      | Yousign signature request POST · Email `quote-sent` (NEW) · Telegram `DEVIS ENVOYÉ` · `Quote.create()`                                                                       | `Quote.yousignRequestId` (Yousign idempotency key)                   | `booking.quote_sent`         |
| T6  | quote_sent                                       | quote_signed                     | webhook Yousign `signature.signed`                                                       | Email `quote-signed` (NEW) · Telegram `DEVIS SIGNÉ` · `Quote.signedAt=now`                                                                                                   | `Quote.yousignRequestId` + `eventId` (webhook payload)               | `booking.quote_signed`       |
| T7  | quote_sent                                       | quote_declined                   | webhook Yousign `signature.declined` ou expiration cron 15j                              | Email `quote-declined` (NEW) · refund option si payé · `slot.available`                                                                                                      | `Quote.yousignRequestId` + event/cron                                | `booking.quote_declined`     |
| T8  | quote_signed (ou cadrage_held si pas de devis)   | nda_pending                      | si `companySize ∈ {ETI,GRANDE}` OR sector sensible (D12)                                 | Yousign NDA request · Email `nda-sent` (NEW) · Telegram `NDA ENVOYÉ` · `Nda.create()`                                                                                        | `Nda.yousignRequestId`                                               | `booking.nda_sent`           |
| T9  | nda_pending                                      | nda_signed                       | webhook Yousign `signature.signed`                                                       | Email `nda-signed` · Telegram `NDA SIGNÉ` · `Nda.signedAt=now`                                                                                                               | `Nda.yousignRequestId` + `eventId`                                   | `booking.nda_signed`         |
| T10 | nda_pending                                      | nda_declined                     | webhook decline ou expiration                                                            | refund option · `slot.available`                                                                                                                                             | `Nda.yousignRequestId` + event                                       | `booking.nda_declined`       |
| T11 | nda_signed (ou cadrage_held si pas devis ni NDA) | deposit_pending                  | admin click "Émettre Checkout"                                                           | Stripe `checkout.sessions.create` · Email `payment-link` (NEW) · Telegram `LIEN PAIEMENT` · `Payment.create(status=pending, idempotencyKey)` · set `paymentDeadline=now+48h` | `Payment.stripeIdempotencyKey`                                       | `booking.deposit_pending`    |
| T12 | deposit_pending                                  | confirmed                        | webhook Stripe `payment_intent.succeeded`                                                | Email `payment-receipt` (NEW) + `invoice-issued` (acompte) · Telegram `ACOMPTE PAYÉ` · `Payment.status=succeeded` · `Invoice.create(deposit)`                                | `(bookingId, payment_intent.id)` + table `StripeWebhookEvent` dedupe | `booking.confirmed`          |
| T13 | deposit_pending                                  | expired                          | cron `deposit-expiration-worker` (toutes 5 min, deadline dépassée)                       | Email `deposit-expired` (NEW) · `slot.available` · option originelle si liée : `expired`                                                                                     | `(bookingId, "deposit_expired")` + `now >= paymentDeadline`          | `booking.deposit_expired`    |
| T14 | confirmed                                        | reminded_j7                      | cron `j7-reminder-worker` (quotidien)                                                    | Email `reminder-j7` (NEW) · `Invoice.create(balance, dueAt=bookingDate+15d)` · Telegram `J-7 SOLDE`                                                                          | `(bookingId, "reminded_j7")` + sentinel `j7ReminderSentAt`           | `booking.reminded_j7`        |
| T15 | reminded_j7                                      | in_progress                      | cron `intervention-start-worker` (jour J 00:00 TZ Europe/Paris)                          | aucun email · Telegram `INTERVENTION EN COURS` (optionnel)                                                                                                                   | `(bookingId, "in_progress")` + sentinel `inProgressAt`               | `booking.in_progress`        |
| T16 | in_progress                                      | completed                        | cron J+1 OR admin manuel                                                                 | Email `intervention-completed` (NEW) · Telegram `INTERVENTION TERMINÉE`                                                                                                      | `(bookingId, "completed")` + sentinel `completedAt`                  | `booking.completed`          |
| T17 | completed                                        | invoiced_balance                 | cron J+1 auto OR admin manuel                                                            | `Invoice.send(balance)` · Email `invoice-balance` (NEW) · Telegram `FACTURE SOLDE`                                                                                           | `(bookingId, "invoiced_balance")` + `Invoice.id`                     | `booking.invoiced_balance`   |
| T18 | invoiced_balance                                 | paid_balance                     | webhook Stripe `payment_intent.succeeded` (id ≠ acompte) OR admin marque payé (virement) | Email `payment-receipt-balance` · Telegram `SOLDE PAYÉ`                                                                                                                      | `(bookingId, payment_intent.id)`                                     | `booking.paid_balance`       |
| T19 | paid_balance                                     | archived                         | cron retention (12 mois après payment)                                                   | hard preserve, marque `archivedAt`                                                                                                                                           | `(bookingId, "archived")` + sentinel `archivedAt`                    | `booking.archived`           |
| T20 | any except completed/paid_balance/archived       | cancelled_by_user                | lien magique self-service (D6, signed token)                                             | Email `booking-cancelled-user` (NEW) · Telegram `ANNULATION CLIENT` · refund par grille CGV (`>7d=100%`, `7-2d=50%`, `<2d=0%`) · `Refund.create()`                           | `(bookingId, magicToken)` (one-shot)                                 | `booking.cancelled_by_user`  |
| T21 | any except completed/paid_balance/archived       | cancelled_by_admin               | admin manuel `cancelBookingAction`                                                       | Email `booking-cancelled` (existe déjà) · Telegram `ANNULATION ADMIN` · refund total Stripe · `slot.available`                                                               | `(bookingId, "cancelled_by_admin")`                                  | `booking.cancelled_by_admin` |
| T22 | confirmed (ou ≥ in_progress)                     | no_show                          | admin J+1 marque                                                                         | Email `intervention-no-show` (NEW) · Telegram `NO SHOW` · `Invoice.send(solde+acompte conservé)`                                                                             | `(bookingId, "no_show")`                                             | `booking.no_show`            |
| T23 | any except archived                              | force_majeure                    | admin manuel (Will catastrophe)                                                          | Email `booking-force-majeure` (NEW) · Telegram `FORCE MAJEURE` · refund total · `slot.available` · flag `reschedulePriority=true`                                            | `(bookingId, "force_majeure")`                                       | `booking.force_majeure`      |
| T24 | any with refund                                  | refunded_partial / refunded_full | webhook Stripe `charge.refunded`                                                         | Email `refund-issued` (NEW) · Telegram `REMBOURSEMENT` · `Refund.create(amountCents, scope)`                                                                                 | `(refundId, charge.refunded.id)` + `StripeWebhookEvent` dedupe       | `booking.refunded_*`         |

### 5.3 Cas particulier `audit_flash_onsite` (D9)

```
draft → option_pending → (SKIP cadrage) → deposit_pending → confirmed → in_progress → completed → invoiced_balance → paid_balance → archived
```

Aucun cadrage car format défini d'avance (audit terrain 890 € fixe). Skip déclenché par `interventionType === 'audit_flash_onsite'` dans la state machine guard.

Idem possible pour `gagner_du_temps` selon D9 — à acter par Will (📋 STOP & ASK).

### 5.4 Force majeure Will (D8)

Trigger : admin manuel via `forceMajeureBookingAction` (V1 nouveau, super_admin only). Effets :

1. `Refund.create({ scope: 'full', stripePaymentIntent })` + Stripe `refunds.create` idempotency key `bookingId-fm`.
2. `slot.available` + flag `reschedulePriority=true` sur Booking.
3. Email `booking-force-majeure` + Telegram `FORCE MAJEURE`.
4. Si `reschedule_pending` (V2+) : créneau prioritaire offert.

### 5.5 Reschedule client ≥ J-7 (D19)

V2+ recommandé. V1 = pas implémenté → si client veut reporter > J-7 : passe par `cancelled_by_user` 100% refund + repose option lui-même. Mention CGV `legal.ts:134` « créneau reportable une fois sans frais » 🟡 inappliquée en V1 sans transition dédiée.

### 5.6 Annulation client D6/D7 — politique chiffrée

Grille appliquée automatiquement à T20 selon `daysUntilBookingDate(now, booking.bookingDate)` :

| Fenêtre   | Refund % | État final          | Acompte conservé ?               |
| --------- | -------- | ------------------- | -------------------------------- |
| ≥ J-7     | 100%     | `refunded_full`     | non                              |
| J-7 à J-2 | 50%      | `refunded_partial`  | 50% non, 50% oui                 |
| < J-2     | 0%       | `cancelled_by_user` | oui (créneau reportable 1×, V2+) |

Source CGV : `legal.ts:134` (FR) + `:176` (EN). À adosser sur `cancellationWindow` Booking field (P0 N7 fix).

---

## 6. Section 3 — Invariants à appliquer (V1)

Liste exhaustive (DB constraint + code guard) :

1. **I1 — Slot atomicity** : `Booking.slotId @unique` ✅ déjà DB. + `BookingOption.slotId` actif `pending|confirmed` ≤ 1 par slot → ajouter index partiel `CREATE UNIQUE INDEX ... ON bookings_options (slot_id) WHERE status IN ('pending','confirmed')`.
2. **I2 — Confirmed ⇒ Payment** : `Booking.status='confirmed' ⇒ EXISTS Payment WHERE bookingId=Booking.id AND status='succeeded' AND scope='deposit'`. Garde T12 + DB constraint via trigger ou check (V2+ trigger).
3. **I3 — Transition autorisée** : table `BookingTransition` whitelist (cf. §5.2 T1-T24). Helper `assertTransitionAllowed(from, to, role)` à chaque update. **Pas de transition arrière** sauf `(cancelled_by_admin → any)` réservé super_admin avec motif obligatoire (audit log).
4. **I4 — Audit log obligatoire** : Toute transition crée 1 ligne `BookingTransition` (snapshot before/after JSON) + 1 `ActivityLog` (action `booking.<to>`). Pas de update silencieux.
5. **I5 — `audit_flash_onsite` skip cadrage** : Guard `if (interventionType === 'audit_flash_onsite') skip T2/T3` → directement T11 (deposit_pending). D9.
6. **I6 — Quote requis** : `amountHtCents > 5_000_00` ⇒ T5 obligatoire avant T11. D11. `pricing.ts` SSOT → calcul amount = formule habituelle.
7. **I7 — NDA requis** : `companySize ∈ {ETI, GRANDE_ENTREPRISE}` OR `sector ∈ SENSITIVE_SECTORS` (liste à figer V1 : santé/défense/finance régulée) ⇒ T8 obligatoire avant T11. D12.
8. **I8 — Cadrage NEGATIVE = terminate** : `validationDecision === 'NEGATIVE'` ⇒ branche T4 forcée, pas de T5/T8/T11.
9. **I9 — Idempotence webhooks** : table `StripeWebhookEvent (eventId UNIQUE)` + `YousignWebhookEvent (eventId UNIQUE)`. Insertion before processing → si déjà présent, return 200 sans effets.
10. **I10 — Idempotence transitions** : clé naturelle `(bookingId, toStatus)` unique sur `BookingTransition` → re-déclenchement worker/admin = no-op.
11. **I11 — Pas de double slot reserved** : verrou `SELECT ... FOR UPDATE` slot + option avant toute transition touchant slot (déjà OK pour T11 et après).
12. **I12 — Refund grille CGV** : T20 calcule `cancellationWindow` depuis `daysUntilBookingDate(now, bookingDate)` → applique 100/50/0 selon `legal.ts:134`.
13. **I13 — Role check par transition** : `super_admin` only pour `force_majeure`, `cancelled_by_admin avec refund > 50%`, `no_show`. `admin` pour les autres transitions manuelles. `reader/editor` jamais. Cron pas de role check (process boundary).
14. **I14 — Pas de transition pendant `in_progress` ou `completed`** sauf `no_show` (admin) ou `force_majeure` (super_admin).
15. **I15 — Refund expiry** : `expired` (T13) ne déclenche **aucun** refund (l'acompte n'a jamais été pris). Différencier T13 (deposit_pending → expired) vs T20 (paid → cancelled_by_user).

---

## 7. Section 5 — Tests Vitest cibles (15-20 tests à écrire)

Intents only (pas écriture). Cibles : `src/features/booking/__tests__/state-machine.test.ts` (Vitest, mock Prisma + queue).

| #    | Fichier test cible                                    | Intent                                                                                                                                           |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| TS1  | `state-machine/transitions.test.ts`                   | Pour chaque transition T1-T24 : assert `assertTransitionAllowed(from, to, role)` returns true/false selon whitelist.                             |
| TS2  | `state-machine/idempotence.test.ts`                   | T12 (`deposit_pending → confirmed`) appelé 2× avec même `payment_intent.id` → 2e call no-op (pas de double email/Telegram/Invoice).              |
| TS3  | `state-machine/concurrency.test.ts`                   | 2 admins lancent `validateOptionAction` sur même option en parallèle → 1 succès + 1 `option_not_pending`. (déjà couvert P+1, à étendre cible V1) |
| TS4  | `state-machine/audit-flash-skip.test.ts`              | I5 — Booking `audit_flash_onsite` après T1 saute directement à T11 (deposit_pending).                                                            |
| TS5  | `state-machine/quote-required.test.ts`                | I6 — Booking avec `amountHtCents = 6_000_00` exige T5 avant T11 (assertion `cannot_skip_quote`).                                                 |
| TS6  | `state-machine/quote-not-required.test.ts`            | I6 — Booking avec `amountHtCents = 4_000_00` peut passer T11 sans quote (skip T5).                                                               |
| TS7  | `state-machine/nda-required-eti.test.ts`              | I7 — Booking avec `companySize='ETI'` exige T8 avant T11.                                                                                        |
| TS8  | `state-machine/nda-required-sensitive.test.ts`        | I7 — Booking avec `sector='sante'` ⇒ T8 obligatoire même si TPE.                                                                                 |
| TS9  | `state-machine/cadrage-negative-terminate.test.ts`    | I8 — `validationDecision = NEGATIVE` à T3 ⇒ seul T4 atteignable, T5/T8/T11 throw `cadrage_declined`.                                             |
| TS10 | `state-machine/deposit-expiration.test.ts`            | T13 — booking `deposit_pending` avec `paymentDeadline < now` ⇒ worker flip → `expired`, slot libéré, **aucun refund émis** (I15).                |
| TS11 | `state-machine/cancellation-window-7d.test.ts`        | I12 — `cancelled_by_user` à J-10 ⇒ `refunded_full` 100%.                                                                                         |
| TS12 | `state-machine/cancellation-window-3d.test.ts`        | I12 — `cancelled_by_user` à J-3 ⇒ `refunded_partial` 50%.                                                                                        |
| TS13 | `state-machine/cancellation-window-1d.test.ts`        | I12 — `cancelled_by_user` à J-1 ⇒ `cancelled_by_user` sans refund.                                                                               |
| TS14 | `state-machine/force-majeure.test.ts`                 | T23 — admin lance force_majeure ⇒ refund 100% + `reschedulePriority=true` + slot libéré. Role requis: super_admin.                               |
| TS15 | `state-machine/no-show.test.ts`                       | T22 — `confirmed → no_show` après bookingDate ⇒ invoice solde émise + acompte conservé, pas de refund.                                           |
| TS16 | `state-machine/role-guards.test.ts`                   | I13 — reader/editor ne peut **aucune** transition manuelle (`forbidden`). `admin` ne peut pas `force_majeure`.                                   |
| TS17 | `state-machine/webhook-stripe-dedupe.test.ts`         | I9 — Stripe webhook `payment_intent.succeeded` reçu 2× avec même `event.id` ⇒ 2e call no-op.                                                     |
| TS18 | `state-machine/webhook-yousign-dedupe.test.ts`        | I9 — Yousign webhook `signature.signed` reçu 2× ⇒ 2e call no-op.                                                                                 |
| TS19 | `state-machine/transition-audit-log.test.ts`          | I4 — Chaque transition crée 1 `BookingTransition` row (from/to/actor/snapshot) + 1 `ActivityLog`.                                                |
| TS20 | `state-machine/path-happy-deposit-to-archive.test.ts` | Parcours complet T1→T12→T14→T15→T16→T17→T18→T19 sans erreur, ordre respecté.                                                                     |

Bonus V2+ : `state-machine/reschedule.test.ts` (D19), `state-machine/magic-link-expiry.test.ts` (T20 token TTL).

---

## 8. Recommandations

### 8.1 V1 (Sprint 14.11.x cf. master prompt § 11)

- **R1** — Étendre `BookingStatus` à 22 valeurs (snake_case enum Prisma). Migration Prisma + backfill (`pending → option_pending`, `confirmed → confirmed` si `validateOptionAction` source, `cancelled → cancelled_by_admin`, `postponed` → drop).
- **R2** — Créer table `BookingTransition` (event sourcing) : `id uuid pk`, `bookingId uuid fk`, `fromStatus`, `toStatus`, `trigger varchar`, `actorType enum(admin,cron,webhook,user)`, `actorId? uuid`, `changesJson`, `createdAt`. Index `(bookingId, createdAt)`. UNIQUE `(bookingId, toStatus)` partiel pour transitions one-shot (idempotence I10).
- **R3** — Helper `src/features/booking/state-machine.ts` :
  ```ts
  export const TRANSITIONS: Readonly<Record<BookingStatus, ReadonlyArray<BookingStatus>>> = { ... }
  export function assertTransitionAllowed(from, to, role): void
  export async function applyTransition(tx, bookingId, to, { actorType, actorId, changes }): Promise<void>
  ```
  Toute Server Action booking utilise `applyTransition` (jamais `prisma.booking.update({ status })` direct).
- **R4** — Champs Booking additionnels : `paymentDeadline DateTime?`, `cadrageScheduledAt DateTime?`, `cadrageHeldAt DateTime?`, `validationDecision enum(POSITIVE,NEGATIVE)?`, `quoteRequired Boolean @default(false)`, `ndaRequired Boolean @default(false)`, `cancellationReason VarChar(500)?`, `cancellationWindow enum('>7d','2-7d','<2d','fm')?`, `companySize VarChar(40)?`, `reschedulePriority Boolean @default(false)`, `j7ReminderSentAt DateTime?`, `archivedAt DateTime?`.
- **R5** — Pas de `xstate`. Library externe = overkill pour 22 états séquentiels mostly linéaires + 7 branches d'erreur. Table de transitions + helper Vitest-testé suffit. Trade-off : si V2+ ajoute parallèle (par exemple devis + NDA simultanés), reconsidérer.
- **R6** — Index partiel `bookings_options` : `CREATE UNIQUE INDEX bookings_options_active_per_slot ON bookings_options (slot_id) WHERE status IN ('pending','confirmed')`.
- **R7** — Cron workers à créer : `deposit-expiration-worker`, `j7-reminder-worker`, `intervention-start-worker`, `intervention-completion-worker`. Tous reposent sur le pattern existant `option-expiration-worker` (re-lock + sentinel).
- **R8** — `BookingOptionStatus.confirmed` (mort-né N15) : drop dans Prisma migration ou réaffecter. Recommandation = `[OPTION REFUSÉE]` Will, garder pour rétro-compat (jamais écrit ⇒ pas de migration data).
- **R9** — Drop `calendar_event_id` colonne (N16) si Cal.com confirmé jamais re-activé.

### 8.2 V2+ (post-V1)

- **V+1** — Transition `reschedule_pending → reschedule_confirmed` (D19, CGV legal.ts:134).
- **V+2** — Subscription / récurrence (maintenance 290 €/mois) : nouvelle state machine `Subscription`, hors scope booking.
- **V+3** — Si `xstate` devient nécessaire (visualisation Stately + audit graphique), migration ciblée sur 1 helper, pas refonte globale.

### 8.3 Marquage V1 vs V2+

| Item                                                     | V1  | V2+ |
| -------------------------------------------------------- | --- | --- |
| Enum 22 valeurs                                          | ✅  |     |
| Table `BookingTransition`                                | ✅  |     |
| Helper `assertTransitionAllowed` + `applyTransition`     | ✅  |     |
| Cron workers (deposit-expiration, j7, start, completion) | ✅  |     |
| `audit_flash_onsite` skip cadrage                        | ✅  |     |
| Quote `> 5000€` + NDA `ETI`/sensible                     | ✅  |     |
| Refund grille `>7d/7-2d/<2d`                             | ✅  |     |
| `force_majeure` super_admin                              | ✅  |     |
| Magic-link self-service annulation (T20)                 | ✅  |     |
| Reschedule (T26+) D19                                    |     | ✅  |
| xstate migration                                         |     | ✅  |
| Drop `calendar_event_id`                                 |     | ✅  |

---

## 9. Sources citées

- `prisma/schema.prisma:69-74` — enum `BookingStatus` actuel.
- `prisma/schema.prisma:76-80` — enum `CalendarSlotStatus`.
- `prisma/schema.prisma:82-88` — enum `BookingOptionStatus`.
- `prisma/schema.prisma:201-228` — modèle `Booking` (slotId @unique, pricePaidCents, calendarEventId legacy).
- `prisma/schema.prisma:234-252` — modèle `CalendarSlot`.
- `prisma/schema.prisma:258-286` — modèle `BookingOption`.
- `src/features/booking/actions.ts:41-144` — `createBookingAction` (path direct, pas de slotId).
- `src/features/booking/actions.ts:150-264` — `postOption48hAction` + verrou pessimiste `FOR UPDATE` (`:197-201`).
- `src/features/admin-options/actions.ts:122-231` — `validateOptionAction` (booking confirmed AVANT paiement, `:184`).
- `src/features/admin-options/actions.ts:146-150` — verrou option.
- `src/features/admin-options/actions.ts:166` — verrou slot (Sprint 24+ audit 2026-05-10).
- `src/features/admin-options/actions.ts:243-341` — `refuseOptionAction` (libération slot conditionnelle).
- `src/features/admin-calendar/actions.ts:101-184` — `blockDateAction` (refuse si booking confirmed ou option pending).
- `src/features/admin-calendar/actions.ts:202-330` — `cancelBookingAction` (annulation admin, double lock booking+slot).
- `src/features/admin-calendar/actions.ts:341-385` — `unblockDateAction`.
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md` §1.1, §1.4, §9 — inventaire DB + diff doctrine/code.
- `src/content/legal.ts:134` (FR) + `:176` (EN) — clause CGV annulation `>7j 100% / 7-2j 50% / <2j 0%`.
- `src/content/interventions.ts:236` (FR) + `:262` (EN) — affirmation copy « acompte 50 % + facture immédiate ».
- `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` §3 Agent 3 + §5.5 (state machine cible) + D6-D19 (décisions Will).

---

## 10. Score

| Critère                            | Poids | Note actuelle (code HEAD)                                                                    | Note cible V1 (post-impl)              |
| ---------------------------------- | ----- | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| Couverture états                   | 25    | 6 / 25 (4/22 enum + 3/22 BookingOption utiles, vs 22 cibles)                                 | 25 / 25                                |
| Invariants applicables             | 20    | 8 / 20 (slot @unique + 5 guards code, manque I2-I10 cible)                                   | 20 / 20                                |
| Idempotence                        | 20    | 12 / 20 (FOR UPDATE + status guard OK ; manque dedup webhook + transition table)             | 19 / 20                                |
| Auditabilité                       | 15    | 9 / 15 (ActivityLog admin OK ; manque BookingTransition event-sourcing + audit log par cron) | 14 / 15                                |
| Robustesse (concurrence + erreurs) | 20    | 14 / 20 (locks pessimistes solides ; manque path payment/refund + role check granulaire)     | 19 / 20                                |
| **Total**                          | 100   | **49 / 100** (état actuel)                                                                   | **97 / 100** (post-V1 si R1-R7 livrés) |

🚨 État actuel = 49 / 100. La state machine actuelle est **fonctionnelle pour le flow option 48h pré-paiement uniquement**. Pour le cible deposit-gated V1, **manque 73 % du graphe**.

---

## 11. Hors-scope explicite

- ❌ Qualiopi / OPCO / PDP / régime TVA détaillé (HORS V1 par prompt § 8).
- ❌ Structure juridique FR vs EE non tranchée → architecture TVA-agnostique préservée. Aucun choix d'architecture state-machine ne dépend de cette décision (Quote/Invoice/Refund tables restent identiques).
- ❌ V2 multi-formateurs / multi-tenant — V1 mono-Will, 1 slot/jour (cf. `CalendarSlot.slotDate @unique`).
