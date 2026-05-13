# BUILD STATE — Booking V1 (feature/booking-v1)

> Tracker progression du build V1. Mis à jour à chaque fin de session.

## État au 2026-05-13 (Session 1)

### ✅ Sprint X.0 — Décisions Will + bootstrap (TERMINÉ)

- 9 ADRs créés : `docs/adr/0012-` à `docs/adr/0020-*.md`.
  - 0012 — Matrice des 10 décisions Q1–Q10
  - 0013 — Stripe Checkout V1 + mode hybride manuel
  - 0014 — DocuSeal self-hosted vs Yousign
  - 0015 — Architecture TVA agnostique FR vs EE
  - 0016 — Pricing DB-managed via PricingConfig
  - 0017 — Multi-options simultanées (cap configurable défaut 3)
  - 0018 — Validation admin 2 clics (Envoi vs Calendrier)
  - 0019 — Modes manuels D64 togglables
  - 0020 — Migration data V0 → V1
- `.env.example` étendu (Stripe + DocuSeal + OSM Nominatim + toggles booking + délais expiration).
- 10 décisions Q1–Q10 actées (cf. ADR 0012).
- Aucune dépendance npm ajoutée encore (Sprint X.1+).

### ✅ Sprint X.1 — Extensions Prisma schema (TERMINÉ session 2026-05-13)

**Fichier touché** : `prisma/schema.prisma` uniquement (de 714 → 1661 lignes).

**Modèles ajoutés (15 actifs V1 + 1 hook V1.5+ documenté)** :

1. `Payment` (Stripe + manuels, EUR-only, isHistorical D63)
2. `Invoice` (numérotation AXION-2026-NNNN, legalSnapshot JSONB, archivedUntil 10 ans)
3. `Refund` (Stripe + manuels, RefundReason enum)
4. `StripeWebhookEvent` (idempotence event.id UNIQUE)
5. `DocusealWebhookEvent` (idempotence HMAC-SHA256)
6. `ContractDocument` (DocuSeal V1, versioning D62 self-FK previousVersionId)
7. `ContractTemplate` (Tiptap JSON, defaultLegalClauses D53)
8. `Quote` (DEVIS-2026-NNNN, semi-auto Will-A)
9. `CadrageMeeting` (visio manual_external V1)
10. `OnboardingDoc` — **HORS V1 (D58)** — documenté comme hook V1.5+, **non instancié** comme modèle Prisma.
11. `CapacityWindow` (~3 interventions/semaine)
12. `PricingConfig` (DB-managed, remplace hardcode pricing.ts — ADR 0016)
13. `PaymentScheduleProfile` (4 profils défaut tiny/small/medium/large)
14. `BookingPaymentSchedule` (snapshot custom + override)
15. `SiteSetting` (clé/valeur catégorisée — distinct du `Setting` V0)
16. `BookingTransition` (event sourcing state machine, unique partiel idempotence)

**Booking — 22 colonnes ajoutées V1** (cf. `03-ARCH §5.1.3`) :
`basePriceHtCents`, `travelFeeCents`, `accommodationFeeCents`, `mealFeeCents`,
`additionalFeesCents`, `additionalFeesNotes`, `feesMode`, `depositAmountCents`,
`depositPaidAt`, `balanceAmountCents`, `balancePaidAt`, `quoteRequired`,
`ndaRequired`, `originPath`, `fromSubmissionId`, `cadrageMeetingId`, `quoteId`,
`contractDocumentId`, `paymentScheduleProfileId`, `companyCityNormalized`,
`companyLat`, `companyLng`, `travelBufferDays`, `companySize`, `confirmedAt`,
`completedAt`, `cancelledAt`, `cancellationReason`, `cancellationWindow`,
`cancelledByUserId`, `forceMajeureNotes`, `pausedAt`, `pausedUntil`,
`pauseReason`, `overrides`, `trainingSessionId` (hook V2+ Qualiopi).

**BookingStatus** : 4 valeurs V0 -> ~27 valeurs (V0 préservées + V1 complètes).

**Enums ajoutés (16)** : `PaymentProvider`, `PaymentType`, `PaymentStatus`,
`InvoiceType`, `InvoiceStatus`, `RefundStatus`, `RefundReason`, `QuoteStatus`,
`SignatureProvider`, `ContractStatus`, `CadrageStatus`, `CadrageDecision`,
`ValidationDecision` (alias rétro-compat), `FeesMode`, `PayerType`,
`BookingOriginPath`, `CancellationWindow`, `TransitionTriggeredBy`,
`ActorType` (alias rétro-compat), `SiteSettingCategory`, `CompanySize`.

**Extensions V0 préservées** : `Submission` (+`bookingsFromSubmission` reverse),
`AdminUser` (+7 reverses), `BookingOption` (+`@@index([slotId, status])`),
`SubmissionType` (`quote_request`), `SubmissionStatus`
(`qualifying`/`negotiating`/`converted`/`lost`), `BookingOptionStatus`
(V1 valeurs sémantiques ajoutées).

**Validation** :

- `npx prisma format` -> ✅ OK (291 ms)
- `npx prisma validate` -> ✅ OK (`The schema at prisma\schema.prisma is valid 🚀`)
- Aucune migration appliquée (interdit ce sprint).

**Préservations** :

- Modèles V0 intacts, aucun champ existant supprimé.
- `BookingStatus` V0 (`pending`, `postponed`) conservés pour mapping V0->V1 (Sprint X.4 / ADR 0020).
- `CalendarSlotStatus` non étendu — dérivation UI (ADR 0017 Option B2).
- Will's WIP `InterventionType` (`demarrage_ia_express`, `atelier_ia_cible`) inchangé.

### ⚙️ Sprint X.2 — Stripe Checkout & webhook (P0 SKELETON, partiel)

**Livré session 2026-05-13** :

- `pnpm add stripe@22.1.1` ✅ SDK installé.
- `src/lib/stripe.ts` — singleton + `STRIPE_API_VERSION` figé `2026-04-22.dahlia` + helpers `isStripeConfigured()` / `getWebhookSecret()`.
- `src/app/api/stripe/webhook/route.ts` — POST handler raw body + signature `constructEvent` + outbox `StripeWebhookEvent.create` (idempotence P2002 → 200). Dispatch BullMQ marqué TODO Sprint X.4+.
- `src/features/payment/actions.ts` — `createStripeCheckoutSessionAction` + `cancelStripeCheckoutSessionAction` avec Zod, `requireAdminWrite`, `checkRateLimit` (5/600s), `isAllowedRedirectUrl` (anti open-redirect Agent 8 P0-6), `Idempotency-Key: ${invoiceId}-v1`.
- `next.config.ts` — `experimental.serverActions.allowedOrigins = ['axion-ia.com', 'www.axion-ia.com']` (Agent 8 P0-4).
- `src/lib/csp.ts` — `connect-src` += `api.stripe.com`, `frame-src` += `checkout.stripe.com`.
- `src/lib/telegram.ts` — tags `STRIPE_EVENT` + `STRIPE_WEBHOOK_SIGNATURE_FAIL` ajoutés.
- `.env.example` — `STRIPE_API_VERSION` aligné `2026-04-22.dahlia` (env informative, la version est dans le code).
- `src/lib/stripe.test.ts` — 4 tests skeleton (config flags + API version pinned).
- TS clean + 153/153 vitest verts (149 existants + 4 nouveaux).

**Reste à faire X.2** :

- Workers BullMQ pour les 5 events critiques (`checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `review.opened`). **HORS skeleton** — dépend BullMQ infrastructure Sprint X.12.
- Tests intégration webhook avec `stripe-mock` (Sprint X.4).
- Templates emails `payment-link`, `payment-receipt`, `payment-failed` (Sprint X.13).
- Stripe Radar activation + ADR (P1).

### ⚙️ Sprint X.4 — State machine deposit-validation gated (FOUNDATIONS livré)

**Livré session 2026-05-13 (suite session)** :

- `src/features/booking/state-machine.ts` — helper TS pur (sans DB) :
  - `TRANSITIONS: Record<BookingStatus, ReadonlyArray<BookingStatus>>` — whitelist
    exhaustive 32 statuts (V0 legacy + V1 complets). Couvre tous les flows D49-D51,
    pause/reprise D61, installment_overdue D59, force_majeure, cancellations.
  - `TERMINAL_STATES: ReadonlySet<BookingStatus>` — 15 statuts sémantiquement
    terminaux (incl. cancelled*\*, no_show, paid_balance, force_majeure qui
    ont des transitions comptables vers refunded*\*/archived).
  - `isTransitionAllowed(from, to)` — helper pur, utilisable côté admin UI pour
    filtrer les actions disponibles.
  - `assertTransitionAllowed(from, to)` — throw `StateMachineError('transition_not_allowed')`.
  - `isTerminalState(status)` — helper.
  - `applyTransition(tx, bookingId, opts)` — atomique :
    1. Lecture du fromStatus (anti-race au minimum, caller doit idéalement
       `SELECT … FOR UPDATE`).
    2. Assert whitelist OK.
    3. Insert BookingTransition (UNIQUE `(bookingId, toStatus, trigger)`
       garantit l'idempotence — webhook Stripe rejoué = no-op si `ignoreDuplicate`).
    4. Update Booking.status.
  - Erreur typée `StateMachineError` avec code `transition_not_allowed |
booking_not_found | booking_status_mismatch | transition_duplicate`.
- `src/features/booking/state-machine.test.ts` — 21 tests purs :
  - Transitions clés D49-D51 (option_pending → cadrage → contrat → acompte → confirmed)
  - Skip cadrage I3 (audit_flash_onsite)
  - Devis flow I4 (quote_required → quote_sent → quote_signed → contract_pending)
  - Pause/reprise D61 bidirectionnel
  - Escalade D59 (confirmed/invoiced_balance → installment_overdue → disputed)
  - Refus transitions hors whitelist + backward
  - Identification terminaux + invariants TS1-TS8
- TS clean + 173/173 vitest verts (152 + 21 nouveaux).

**Reste X.4 (sprints suivants ou dépendances bloquantes)** :

- Server Actions admin : `sendContractAndDepositRequestAction`, `validateBookingOnCalendarAction`,
  `markCompletedAction`, `markNoShowAction`, `markForceMajeureAction`, `pauseBookingAction`,
  `resumeBookingAction`, `cancelAndReissueContractAction`, `createContractAddendumAction`.
  ⟶ Dépend de templates emails (Sprint X.13) + DocuSeal (Sprint X.3) + Stripe webhook
  workers (Sprint X.12 BullMQ).
- Refactor Server Actions legacy : `createBookingAction → option_pending`, `postOption48hAction`,
  `validateOptionAction → sendContractAndDepositRequestAction`, `cancelBookingAction`.
  ⟶ Plus risqué — touche du code en prod, à faire avec migration backfill V0→V1 (D63).
- Migration V0→V1 backfill script `scripts/migrate-bookings-v0-to-v1.ts` (D63).
  ⟶ Bloqué tant que le code legacy n'est pas refactoré (sinon mismatch).
- Drop legacy : `Booking.calendarEventId`, `BookingStatus.postponed`, `BookingOptionStatus.confirmed`.
  ⟶ Migration séparée, dépendances code legacy purgé.
- Tests intégration applyTransition() avec Prisma + concurrence admin.

### ⏳ PROCHAIN — Sprint X.3 DocuSeal self-hosted (3-4j) — infra Coolify externe

### 📋 BACKLOG SPRINTS V1

- X.1 Foundation paiements & pricing (5-6j) — Prisma schema + migrations + seed
- X.2 Stripe Checkout & webhook (3j)
- X.3 DocuSeal self-hosted Docker (3-4j)
- X.4 State machine deposit-validation gated + migration V0→V1 (4j)
- X.5 Multi-options simultanées (2j)
- X.5bis Parcours B formulaire devis qualifié /demande-devis (2j)
- X.6 Pre-booking cadrage manual_external (3j)
- X.7 Devis semi-auto + signature DocuSeal (3j)
- X.8 Admin Réservations + drawer parcours B (3-4j)
- X.9 Admin Calendrier v2 + heatmap (3-4j)
- X.10 Admin Factures V1 + numérotation immuable (4j)
- X.11 Admin Paiements suivi pro hybride (3j)
- X.12 Crons & workers (~24 jobs) (3j)
- X.13 Emails templates V1 (~36 nouveaux) (3-4j)
- X.14 Admin nav refactor + Dashboard Aujourd'hui (2-3j)
- X.15 Self-service client lien magique (2j)
- X.16 Géo-awareness OSM + heatmap (2j)
- X.17 Conformité légale V1 + DPA + CGV agnostiques (3-4j)
- X.18 Bout-en-bout préfill + tracking funnel (1-2j)
- X.19 Tests E2E Playwright (3j)
- X.20 Doc + ADRs + CHANGELOG (1j)

### 🚧 Bloquants externes Will (à faire en parallèle)

- [ ] DPA Stripe signé (dashboard.stripe.com → Compliance)
- [ ] Compte Stripe live + KYB validé
- [ ] Boîte dpo@axion-ia.com opérationnelle
- [ ] DMARC/DKIM/SPF prod vérifiés (Cloudflare DNS)

### 📂 Modifications en cours préservées sur la branche

Le worktree contient des modifs non-commitées de Will (taxonomy enums, pages interventions, BookingCalendar, etc.) — préservées sur la branche `feature/booking-v1`, à commiter par Will quand prêt.

### 🔄 Reprise dans la prochaine session

- Branche : `feature/booking-v1` (PAS main).
- Sprint suivant : X.1 — extensions Prisma schema selon `03-ARCHITECTURE-CIBLE.md` §5.1.
- Commande de reprise : "continue le build V1 sprint X.1".

---

## ÉTAT FINAL CYCLE 2026-05-13 (Sprint X.20 clôture)

**Branche `feature/booking-v1`** : 25 commits ahead de `main` (X.0 + X.1 +
11 sprints partiels session 2026-05-13 + X.20 doc).

**Tests** : 149 → 286 (+137 nouveaux)

**Sprints partiellement livrés en autonomie cette session** :
X.2 Stripe + X.4 state machine + X.4 admin actions + X.5bis parcours B

- X.6 cadrage + X.7 devis + X.13 emails ciblés + X.15 self-service
- X.16 géo + X.17 legal + X.18 funnel/UTM + X.20 doc.

**Récap exhaustif** : voir `_AUDIT/CHANGELOG-V1-BOOKING.md`.

**Action Will** : voir section finale du CHANGELOG pour passage en prod.

- Sprint suivant prioritaire (après merge main) : X.3 DocuSeal (infra Coolify)
  ou X.12 BullMQ workers (infra Redis).
- Commande de reprise après merge : "continue le build V1 sprint X.3 ou X.12".
