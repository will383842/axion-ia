# CHANGELOG Booking V1 — feature/booking-v1

Récapitulatif des sprints partiels livrés sur la branche `feature/booking-v1`.
Cycle ouvert post-audit `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/` (12 mai 2026).

## Légende statut

- ✅ **Livré complet** — tous les attendus du plan sont commités/testés
- ⚙️ **Livré partiel** — fondations posées, reste à câbler avec un sprint dépendant
- 🚧 **Reporté** — dépend infra externe (DocuSeal/BullMQ/admin UI X.8/X.9)

---

## Sprint X.0 — Décisions Will + bootstrap ✅

**Commit (avant session)** : `417b783 feat(adr): sprint x.0 booking v1`

- 9 ADRs créés (`docs/adr/0012-` à `0020-*.md`)
- `.env.example` étendu (Stripe + DocuSeal + OSM Nominatim + toggles)
- 10 décisions Q1–Q10 actées (ADR 0012)
- Aucune dépendance npm encore ajoutée

## Sprint X.1 — Schema Prisma extensions ✅

**Commit (avant session)** : `8bf1f2c feat(prisma): sprint x.1 booking v1 — schema extensions (15 tables, 18 enums)`

- 15 modèles ajoutés : Payment, Invoice, Refund, StripeWebhookEvent,
  DocusealWebhookEvent, ContractDocument, ContractTemplate, Quote,
  CadrageMeeting, CapacityWindow, PricingConfig, PaymentScheduleProfile,
  BookingPaymentSchedule, SiteSetting, BookingTransition
- Booking étendu (+22 colonnes V1)
- BookingStatus : 4 valeurs V0 → ~35 valeurs V1
- 16 enums ajoutés (PaymentProvider, QuoteStatus, CadrageStatus, etc.)
- `prisma format` + `prisma validate` OK

## Sprint X.2 — Stripe Checkout + webhook ⚙️

**Commit** : `1bf855c feat(payment): sprint x.2 stripe checkout + webhook skeleton`

**Livré** :

- SDK `stripe@22.1.1` installé
- `src/lib/stripe.ts` — singleton + `STRIPE_API_VERSION` figé `2026-04-22.dahlia` + helpers
- `src/app/api/stripe/webhook/route.ts` — POST handler raw body + signature `constructEvent` + outbox idempotent
- `src/features/payment/actions.ts` — `createStripeCheckoutSessionAction` + `cancelStripeCheckoutSessionAction` avec Zod, rate-limit 5/600s, Idempotency-Key, anti open-redirect
- `next.config.ts` `allowedOrigins` + CSP `api.stripe.com` + `checkout.stripe.com`
- `src/lib/stripe.test.ts` — 3 tests

**Reste à faire** :

- 🚧 Workers BullMQ events (`checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `review.opened`) — Sprint X.12
- 🚧 Tests intégration `stripe-mock` — Sprint X.4 fin
- 🚧 Stripe Radar activation — P1

## Sprint X.4 — State machine deposit-validation gated ⚙️

**Commits** :

- `d80d406 feat(booking): sprint x.4 state machine foundations`
- `278d0a9 feat(booking): sprint x.4 admin Server Actions sans deps externes`

**Livré** :

- `src/features/booking/state-machine.ts` :
  - `TRANSITIONS` whitelist 35 statuts (V0 + V1)
  - `TERMINAL_STATES` 15 statuts terminaux
  - `isTransitionAllowed`, `assertTransitionAllowed`, `isTerminalState`
  - `applyTransition(tx, bookingId, opts)` atomique + audit log immuable
  - `StateMachineError` typed
- `src/features/booking/admin-actions.ts` — 5 Server Actions :
  - `pauseBookingAction` (D61 → paused + libère slot + email)
  - `resumeBookingAction` (D61 → confirmed + re-bloque slot + email)
  - `markCompletedAction` (in_progress → completed)
  - `markNoShowAction` (super_admin only, confirmed → no_show)
  - `markForceMajeureAction` (super_admin only, \* → force_majeure + email)
- Wiring `enqueueEmail` pour les 3 actions livrant des emails
- 21 tests state-machine + 14 tests admin-actions

**Reste à faire** :

- 🚧 `sendContractAndDepositRequestAction` (clic Will 1) — dépend DocuSeal + emails complet
- 🚧 `validateBookingOnCalendarAction` (clic Will 2) — dépend emails
- 🚧 Refactor legacy (`createBookingAction`, `postOption48hAction`) — migration V0→V1
- 🚧 Script `scripts/migrate-bookings-v0-to-v1.ts` (D63)

## Sprint X.5bis — Parcours B devis qualifié ✅

**Commit** : `98119fb feat(quote-request): sprint x.5bis — parcours B devis qualifié (D44)`

**Livré complet** :

- Schema Zod `quoteRequestSchema` 14 champs (entreprise + contact + projet + consentements)
- `submitQuoteRequestAction` V4 (rate-limit 3/3600s, Turnstile, honeypot, Submission.create type='quote_request', Telegram, email)
- `QuoteRequestForm` (RHF + zodResolver, 4 sections)
- Pages `/[locale]/demande-devis` + `/demande-devis/confirmation` (FR + EN)
- Email template `quote-request-received` (FR + EN)
- 8 tests vitest

## Sprint X.6 — Cadrage manual_external ⚙️

**Commit** : `2ee6e18 feat(booking): sprint x.6 — cadrage manual_external (skeleton + emails)`

**Livré** :

- `src/lib/ics-generator.ts` — VCALENDAR RFC 5545 + helper `generateCadrageIcs` FR/EN, UID stable
- `src/features/booking/cadrage-actions.ts` :
  - `scheduleCadrageMeetingAction` (refus audit_flash_onsite I3, idempotence, transition + email)
  - `markCadrageHeldAction` (I7 cascade not_pertinent → cadrage_declined terminal)
- Templates emails `cadrage-scheduled` + `cadrage-declined` (FR + EN)
- 7 tests ICS

**Reste à faire** :

- 🚧 Magic-link reschedule/cancel client → V1.5
- 🚧 4 templates cron (J-1/H-2/recap/rescheduled-by-client) → Sprint X.12
- 🚧 Drawer admin UI → Sprint X.8

## Sprint X.7 — Devis semi-auto (sans DocuSeal) ⚙️

**Commit** : `ab8dc18 feat(booking): sprint x.7 — devis semi-auto (partiel sans DocuSeal)`

**Livré** :

- `src/lib/quote-helpers.ts` — `requiresQuote`, `generateQuoteNumber` (DEVIS-YYYY-NNNN), `computeQuotePricing` (TVA agnostique FR/EE)
- `src/features/booking/quote-actions.ts` — 5 Server Actions (generateDraft, edit, send, markSignedManually super_admin, markDeclined)
- Templates emails `quote-sent` + `quote-signed` + `quote-declined`
- 13 tests quote-helpers

**Reste à faire** :

- 🚧 Intégration DocuSeal signature électronique → Sprint X.3
- 🚧 PDF auto-render react-pdf → V1.5
- 🚧 Admin UI `/admin/devis/[bookingId]` → Sprint X.8
- 🚧 `pg_advisory_lock` numérotation atomique → Sprint X.10
- 🚧 Templates `quote-reminder` (J+3) + `quote-expired` (J+7) → Sprint X.12

## Sprint X.13 — Templates emails (ciblés) ⚙️

**Commit** : `77b809a feat(emails): sprint x.13 — 7 templates emails ciblés`

**Livré** :

- 7 nouveaux templates (FR + EN) :
  - `payment-link` (X.2 clic Will 1)
  - `payment-receipt` (X.2 webhook completed)
  - `payment-failed` (X.2 webhook failed)
  - `booking-validated-on-calendar` (X.4 clic Will 2)
  - `booking-paused-confirmation` (X.4 D61)
  - `booking-resumed-notification` (X.4 D61)
  - `force-majeure-notice` (X.4 A23)
- Wiring `enqueueEmail` dans `admin-actions.ts` (pause/resume/forceMajeure)
- 14 tests render templates

**Reste à faire** :

- 🚧 ~29 autres templates V1 (cadrage J-1/H-2/recap, contract-sent/signed/refused/reminder, quote-reminder/expired, payment-reminder-j7, payment-overdue-j1/j15/j30, booking-rescheduled, booking-j1-reminder, contract-version-updated, installment-overdue-soft/firm/disputed-notice, negotiation-stalled-reminder)
- 🚧 Câblage workers BullMQ Stripe events → Sprint X.12

## Sprint X.15 — Self-service client (magic-link) ✅

**Commit** : `59290f1 feat(booking): sprint x.15 — self-service client (magic-link cancel/reschedule)`

**Livré complet** :

- `src/lib/magic-token.ts` — sign/verify HMAC-SHA256 (factorise `gdpr-token.ts`), 3 scopes (cancel 24h / reschedule 24h / portal 30min)
- `src/features/booking/self-service-actions.ts` :
  - `cancelBookingByUserAction` (rate-limit 10/600s, grille refund V1, libère slot)
  - `rescheduleBookingByUserAction` (J-7 enforced, audit log)
  - `computeRefundFromCancellation` (50%/0%/0% par fenêtre)
- Pages `/[locale]/booking/[token]/cancel|reschedule` (Server + Client Form)
- Templates `cancellation-confirmed-by-user` + `refund-issued`
- 11 tests magic-token

## Sprint X.16 — Géo-awareness OSM ⚙️

**Commit** : `2996b26 feat(geo): sprint x.16 — haversine + OSM Nominatim geocoding`

**Livré** :

- `src/lib/haversine.ts` — `distanceKm` (Haversine), `computeTravelBufferDays` (<50/500/+ → 0/0.5/1j), DEFAULT_HUB Paris
- `src/lib/geocode.ts` — `geocodeCity(city, country?)` Nominatim avec cache `SiteSetting` 90j, User-Agent custom, timeout 5s, fail-soft
- 16 tests Haversine (Paris→Lyon/Marseille/Bordeaux/Versailles/Bruxelles)

**Reste à faire** :

- 🚧 Cron recompute `CapacityWindow` → Sprint X.12
- 🚧 Heatmap admin `/admin/calendrier` → Sprint X.9
- 🚧 Alertes Telegram `GEO_CONFLICT` cron → Sprint X.12
- 🚧 Auto-bloque slot J-1/J+1 selon buffer → Sprint X.4 fin

## Sprint X.17 — Conformité légale V1 ⚙️

**Commit** : `901aff5 feat(legal): sprint x.17 — sous-processeurs RGPD + legal-snapshot`

**Livré** :

- `src/lib/legal-snapshot.ts` — capture immuable {fiscalRegime, vatMention, vatRate, vatReverseCharge, loiApplicable, juridiction, ...} FR/EE selon `SiteSetting.fiscal_regime`
- `src/content/subprocessors.ts` — SSOT 7 sous-processeurs (Hetzner, Cloudflare, Stripe, Sentry, OSM Nominatim, Plausible self-hosted, DocuSeal self-hosted)
- Page `/[locale]/sous-processeurs` (RGPD art. 28)
- 7 tests legal-snapshot

**Reste à faire** :

- 🚧 Update `src/content/legal.ts` clauses CGV (acompte/refund/force majeure) — revue Will avant copy
- 🚧 DPA papier Hetzner/Stripe/Cloudflare → action Will dashboard
- 🚧 ADR 0021 immutable invoice numbering → Sprint X.10
- 🚧 Cron `archive-old-invoices` 10 ans → Sprint X.12

## Sprint X.18 — Préfill UTM + tracking funnel ⚙️

**Commit** : `5a0bd1b feat(funnel): sprint x.18 — préfill UTM + tracking funnel typé + CTA routing`

**Livré** :

- `src/lib/booking-cta-path.ts` — `getBookingCtaPath` route /reserver vs /demande-devis selon `requiresQuote`, locale, UTM forward, city préfill
- `src/lib/tracking.ts` — `FunnelEvent` type union (13 events), `trackFunnel` filter, `priceBucketFromCents` 5 plages anonymisées
- `src/lib/utm.ts` — parse 5 keys, sanitize injection, cookie base64url 30j (Secure + HttpOnly + SameSite=Lax)
- 23 tests

**Reste à faire** :

- 🚧 Wiring `BookingCalendar.tsx` ?city= préfill — sprint dédié
- 🚧 Middleware pSEO cookie set `referrerCity` → sprint dédié
- 🚧 Audit cross-fichiers CTAs nus vers /reserver (Agent 9 P0-1)
- 🚧 Dashboard `/admin/pseo-stats` → V1.5

## Sprint X.20 — Documentation + CHANGELOG ✅

**Ce sprint** :

- `_AUDIT/CHANGELOG-V1-BOOKING.md` (ce fichier)
- Update `BUILD-STATE.md` final
- Mémoire session sauvegardée

---

## Sprints reportés (dépendances infra externes)

| Sprint                                 | Bloqueur                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| X.3 DocuSeal self-hosted               | 🚧 Docker container Coolify + DNS `docuseal.axion-ia.com` + reverse-proxy Caddy |
| X.5 Multi-options simultanées          | ⚠️ Refactor legacy `postOption48hAction` + `PricingConfig` seedé                |
| X.8 Admin Réservations + drawer        | ⚠️ UI admin riche (4-5j)                                                        |
| X.9 Admin Calendrier v2 + heatmap      | ⚠️ UI admin (3-4j)                                                              |
| X.10 Admin Factures V1 + numérotation  | ⚠️ PDF render + admin UI (4j)                                                   |
| X.11 Admin Paiements suivi hybride     | ⚠️ UI admin (3j)                                                                |
| X.12 Workers BullMQ ~24 jobs           | 🚧 Redis + worker container Coolify                                             |
| X.13 reste templates emails ~29        | ⚠️ Volume + dépendances multi-sprints                                           |
| X.14 Admin nav refactor + Dashboard    | ⚠️ UI admin (2-3j)                                                              |
| X.19 Tests E2E Playwright              | ⚠️ Stack E2E + scénarios (3j)                                                   |
| X.21 Wiring final BookingCalendar X.18 | ⚠️ Refactor legacy ?city préfill                                                |

---

## Métriques du cycle

- **Branche** : `feature/booking-v1` (15 commits ahead de `main`)
- **Commits de session** : 11 sprints partiels livrés en autonomie
- **Tests vitest** : 149 → **286 (+137 nouveaux)**
- **Templates emails** : 12 → **24** (12 existants + 12 nouveaux V1)
- **Server Actions** : ~10 → **~24** (paiement, état, cadrage, devis, self-service)
- **Helpers TS purs** : Stripe lib, state-machine, ics-generator, quote-helpers, magic-token, haversine, geocode, legal-snapshot, booking-cta-path, tracking, utm
- **Pages publiques V1** : 4 nouvelles (`/demande-devis` + confirmation + `/booking/[token]/cancel|reschedule` + `/sous-processeurs`)

## Vérifications finales

- ✅ TypeScript clean
- ✅ ESLint 0 errors (19 warnings cosmétiques)
- ✅ 286/286 tests vitest verts
- ✅ Doctrines projet : anti-hex / anti-siren / use-client OK
- ✅ 18/18 routes smoke HTTP en dev
- ✅ Prod `axion-ia.com` non-régression (3/3 contenus critiques live)
- ✅ Sécurité : CSP Stripe + allowedOrigins + 26×rate-limit + 17×Turnstile + 8×honeypot

---

## Action Will pour passer en prod (post-cycle)

1. **Merger `feature/booking-v1` → `main`** quand prêt (déploiement auto Coolify).
2. **DPA papier** : Hetzner (en cours), Stripe (auto-signable dashboard), Cloudflare (auto-signable dashboard).
3. **DocuSeal Coolify** : déployer container `docuseal.axion-ia.com` (Sprint X.3 — infra Will).
4. **BullMQ infra Redis** : provisionner worker container Coolify (Sprint X.12).
5. **Revue juridique CGV** : valider/ajuster clauses Sprint X.17 avant publication.
6. **Migration DB V0→V1** (D63) : exécuter `scripts/migrate-bookings-v0-to-v1.ts` (à écrire Sprint X.4 fin).
