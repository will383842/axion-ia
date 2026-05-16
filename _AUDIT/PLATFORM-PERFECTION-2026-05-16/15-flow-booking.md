# 15 — Flow BOOKING (Phase 4 — Agent 4.A)

- **Date** : 2026-05-16
- **SHA HEAD** : `4cdfbe4` (branche `feat/image-bank-v1`)
- **Mode** : AUDIT-ONLY · zéro mutation code
- **Score** : **84/100** · **Verdict 🟢 GO conditionnel** (3 P0 mineurs)

---

## 1. Diagramme flow (textuel)

```
Visiteur /fr/reserver
   │  (page.tsx loadDbBookedSlots → fixtures + DB booked slots 90j)
   ▼
BookingCalendarLazy (client) — choisit slug intervention + slot
   │
   ├─► postOption48hAction (FormData)                                [option 48h]
   │     ├─ rate-limit ip 3/600s + Turnstile + Zod option48hSchema
   │     ├─ TX Postgres FOR UPDATE sur calendar_slots
   │     ├─ cap N options concurrentes (option-cap.ts, ADR 0017)
   │     ├─ bookingOption.create + slot flip→reserved si premier OU cap atteint
   │     ├─ sendTelegram (PII-redacted) + enqueueEmail "option-posted"
   │     └─ → /confirmation?id=...
   │
   └─► createBookingAction (parcours direct A)
         ├─ rate-limit ip 5/600s + idempotencyKey UUID v4 (anti double-submit)
         ├─ Turnstile + Zod bookingSchema
         ├─ getInterventionPriceCents(slug, count) ← pricing.ts SSOT
         ├─ TX Prisma : Submission(PII encryptPii v1) + Booking + BookingTransition
         ├─ status=`option_pending` (parcours visiteur, deposit-gated)
         ├─ sendTelegram + enqueueEmail "booking-confirmed"
         └─ → /confirmation?id=<bookingId>

Workers BullMQ
   ├─ booking-crons-worker           (J-7 / J0 / J+1 / archive)
   ├─ option-expiration-worker       (status=pending + expiresAt<now → expired + email)
   ├─ option-reminder-worker         (rappel H-24 avant expiration)
   └─ retention-purge-worker         (deleteMany cancelled > 12 mois)

Admin /admin/reservations [+ /[id]]
   └─ admin-actions.ts : cadrage → quote → contract → deposit → calendar validation

Webhooks
   ├─ POST /api/docuseal/webhook  (verifyWebhookAuth dual-mode HMAC v1 + secret v2)
   └─ POST /api/stripe/webhook    (Stripe.constructEvent + STRIPE_WEBHOOK_SECRET)

RGPD
   ├─ /api/gdpr-export : inclut bookings (date + interventionType, déchiffrage PII via decryptPii)
   └─ retention-purge-worker : DELETE bookings status=cancelled + updatedAt > 12 mois
```

---

## 2. Matrice 9 prestations × { DB enum × UI calendar × Email template × pricing.ts }

⚠️ **Le brief mentionne 8 prestations `intervention_essentielle / audit_flash·essentiel·approfondi / formation_demi·pleine / implementation_courte·longue`. La taxonomie réelle V1 diffère** : implémentation ne passe PAS par `/reserver` (parcours `/demande-devis` séparé), audit hors-`flash-onsite` non bookable direct, formation 4 h existe en 2 slugs distincts.

| #   | DB enum (`InterventionType`) | UI slug (`BookingCalendar`) | Email template          | pricing.ts tier                                          | Statut |
| --- | ---------------------------- | --------------------------- | ----------------------- | -------------------------------------------------------- | ------ |
| 1   | `essentielle`                | `essentielle`               | `booking-confirmed.tsx` | `intervention-essentielle` + 3 sub-tiers (490/790/1190)  | ✅ OK  |
| 2   | `approfondie`                | `approfondie`               | `booking-confirmed.tsx` | `intervention-approfondie` + 3 sub-tiers (880/1420/2140) | ✅ OK  |
| 3   | `conference`                 | `conference`                | `booking-confirmed.tsx` | `intervention-conference` (Sur devis)                    | ✅ OK  |
| 4   | `dirigeants`                 | `dirigeants`                | `booking-confirmed.tsx` | `intervention-dirigeants` (990 €)                        | ✅ OK  |
| 5   | `gagner_du_temps`            | `gagner-du-temps`           | `booking-confirmed.tsx` | `intervention-temps` (990 €)                             | ✅ OK  |
| 6   | `intervention_claude`        | `intervention-claude`       | `booking-confirmed.tsx` | `intervention-claude` (690 €)                            | ✅ OK  |
| 7   | `audit_flash_onsite`         | `audit-flash-onsite`        | `booking-confirmed.tsx` | `audit-flash` sub-tier `audit-flash-onsite` (890 €)      | ✅ OK  |
| 8   | `demarrage_ia_express`       | `demarrage-ia-express`      | `booking-confirmed.tsx` | `intervention-4h` (390 €)                                | ✅ OK  |
| 9   | `atelier_ia_cible`           | `atelier-ia-cible`          | `booking-confirmed.tsx` | `intervention-4h` (390 €)                                | ✅ OK  |

**Email template** : un seul (`booking-confirmed.tsx`) qui reçoit `interventionType` brut (enum snake_case → string injecté tel quel dans `body`). Pas de labels localisés FR/EN ni de mapping vers `labelFr`/`labelEn` pricing.ts → **P0-1** ci-dessous.

**Couverture** : 9/9 slugs DB ↔ UI ↔ pricing.ts ↔ Telegram payload ↔ email. **Aucun slug orphelin**.

**Sub-tiers `Essentielle 490/790/1190` + `Approfondie 2j 880/1420/2140`** : câblés via `getInterventionPriceCents()` → `bracketSubTierId()` (intervention-type.ts:77-89). Brackets `2-8 / 9-15 / 16-30`. Persistés dans `Booking.participantsTier` (labelFr du sub-tier) + `Booking.pricePaidCents`. ✅

**Note brief vs réalité** :

- `audit_essentiel / audit_approfondi` : **PAS bookable calendrier** (uniquement `/audit/*` → formulaire `/demande-devis`). Décision Will 2026-05-12 documentée pricing.ts.
- `implementation_courte / longue` : **PAS de flow booking** (4 tiers `IMPLEMENTATION_TIERS` → `/implementation` → formulaire devis).
- `formation_demi / pleine` : split réel V1 = `demarrage_ia_express` + `atelier_ia_cible` (4 h, 390 €) ; pas de format 1 jour formation pure (`Essentielle` 1 jour couvre).

---

## 3. Conformité tarifs (pricing.ts SSOT)

- `createBookingAction` → `getInterventionPriceCents()` dérive `pricePaidCents` + `participantsTier` UNIQUEMENT depuis `INTERVENTION_TIERS` / sub-tiers (zéro hardcode). ✅
- `formatPrice()` / `getEntryLabel()` utilisés par `/reserver` page (ligne 472-473) → CTA « Essentielle À partir de 490 € HT » dérivé. ✅
- Snapshot `Booking.basePriceHtCents` + `feesMode` + `depositAmountCents` (schéma X.1) prêts mais **non remplis en parcours visiteur direct** : Will les calcule en admin lors de la transition `cadrage_held → quote_required`. Acceptable V1.

---

## 4. DocuSeal webhook signature v2

`src/lib/docuseal.ts:436-474` :

- `verifyWebhookSignature` : HMAC SHA-256 hex (v1.x legacy, 64 chars). ✅
- `verifyWebhookSecret` : secret brut timing-safe (v2.x, prod actuel). ✅
- `verifyWebhookAuth` : **dual-mode** (tente HMAC puis secret en clair). ✅

**MERGÉ sur main** — contrairement au memo MEMORY `axionia_docuseal_webhook_signature_todo.md` (mémo périmé). Cohérent avec audit 1.D.

⚠️ Le memo TODO mentionnait `<timestamp>.<sha256>` Stripe-like → **non implémenté**, mais DocuSeal v2.x prod n'utilise PAS ce format (juste secret en clair) → non-bloquant.

---

## 5. Stripe LIVE / TEST isolation

`src/env.ts:82-145` :

- `STRIPE_LIVE_MODE=true` force `sk_live_*` + `pk_live_*` (refuse `sk_test_*` via `superRefine`). ✅
- `STRIPE_WEBHOOK_SECRET` regex `^whsec_` + min 20 chars. ✅
- Fail-fast au boot prod si absent (cert plateforme 2026-05-16). ✅

⚠️ `STRIPE_API_VERSION` dans `stripe.ts:30` = `"2026-04-22.dahlia"` **figée** (intentionnel ADR). À vérifier compat SDK Stripe Node v22+ runtime.

---

## 6. RGPD

- **Retention** : `retention-purge-worker.ts:154-162` — `Booking.deleteMany({ status: "cancelled", updatedAt: { lt: monthsAgo(12) } })`. ✅
- **Export RGPD** : `/api/gdpr-export/route.ts:85-95` inclut bookings via `Submission.bookings` (sélect `bookingDate`, mais **manque `interventionType` + `pricePaidCents` + `status`** dans le sélect → export partiel). → **P0-2**.
- **PII** : `encryptPii(contactName/Email/Phone)` au create + déchiffrage via `decryptPii` aux read sites (cohérent avec memo `axionia_session_2026-05-09_sprint_24_1.md`). ✅

---

## 7. Annulation cooldown + option-expiration

- **Cancel self-service** : `/booking/[token]/cancel/page.tsx` (121 lignes) + `CancelForm.tsx`. Magic-link token. Logique `refund-calc.ts` calcule fenêtre CGV (≥7j 100 %, 2-7j 50 %, <2j 0 %). ✅
- **Reschedule** : `/booking/[token]/reschedule/page.tsx` + `RescheduleForm.tsx` + `reschedule-actions.ts`. ✅
- **Option-expiration-worker** : `worker.run({ name: "option-expiration", ... })` parcourt `status=pending + expiresAt<now`, flip → `expired`, enqueue `option-expired` mail. ✅ Cron-driven via BullMQ-Pro.
- **Option-reminder-worker** : envoie rappel H-24 avant expiration. ✅

---

## 8. Scoring /100

| Dimension                    | Note   | Note max |
| ---------------------------- | ------ | -------- |
| Parcours visiteur happy path | 18     | 20       |
| pricing.ts SSOT cohérence    | 19     | 20       |
| State machine + transitions  | 17     | 20       |
| Webhooks (Stripe + DocuSeal) | 14     | 15       |
| RGPD (retention + export)    | 9      | 15       |
| Workers + crons              | 7      | 10       |
| **Total**                    | **84** | **100**  |

---

## 9. P0 (bloquants merge-into-main / GO public)

### P0-1 — Email `booking-confirmed.tsx` affiche enum brut `intervention_claude`

**Fichier** : `src/lib/email/templates/booking-confirmed.tsx:23-24,32-33`
Le template insère `interventionType` brut dans la phrase FR/EN (« Votre intervention « intervention_claude » est confirmée… »). Aucune locale-aware label resolution. Le client reçoit du snake_case enum DB. → ajouter mapping `enumToLabel(enum, locale)` → `INTERVENTION_TIERS.find(t => t.id === SLUG_TO_TIER_ID[enumToSlug(enum)])?.labelFr|labelEn`.
**Impact** : UX premium dégradée (chaque email Booking V1). Effort : ~30 min.

### P0-2 — `/api/gdpr-export` retourne export partiel pour bookings

**Fichier** : `src/app/api/gdpr-export/route.ts:85-95` — `select: { bookingDate: true }` uniquement. Manque `interventionType`, `pricePaidCents`, `status`, `participantsCount`, `depositPaidAt`, `cancellationReason` → export Art.20 RGPD non-conforme (« portabilité données traitées »).
**Impact** : risque CNIL si demande accès. Effort : ~20 min (ajouter colonnes au select + déchiffrage si nécessaire).

### P0-3 — Brief vs réalité : taxonomie 8 prestations désynchronisée

Le brief référence `audit_essentiel/approfondi/formation_demi/pleine/implementation_courte/longue` **inexistants** en DB enum V1. C'est attendu côté code (décision Will 2026-05-12 : audit ≥ ciblé + implementation = devis qualifié hors-calendrier). À documenter explicitement dans le prompt master pour éviter confusion futur agent. Effort : 0 min (clarification doc dans master prompt).

---

**Verdict** : 🟢 **GO conditionnel** — flow booking V1 robuste, idempotent, deposit-gated, pricing SSOT. Les 3 P0 sont mineurs (~50 min de fix total), aucun bloquant infra ou contrat.
