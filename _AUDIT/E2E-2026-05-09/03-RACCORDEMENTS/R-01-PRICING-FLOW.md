# R-01 — PRICING FLOW (raccordement transverse)

## Diagramme ASCII

```
                    ┌─────────────────────────────────┐
                    │   src/content/pricing.ts        │  ← SSOT (1 fichier)
                    │   PricingTier, PricingSubTier   │
                    │   8 helpers (formatPrice…)      │
                    └────────────┬────────────────────┘
                                 │ import
        ┌────────────────────────┼─────────────────────────────┐
        ▼                        ▼                             ▼
┌───────────────┐    ┌─────────────────────┐      ┌─────────────────────┐
│ Pages         │    │ Components          │      │ JSON-LD factories   │
│ /interventions│    │ PricingCard         │      │ buildOfferLd()      │
│ /audit/*      │    │ PricingMatrix       │      │ buildServiceLd()    │
│ /implementation│   │ PricingTable        │      │ buildProductLd()    │
│ /reserver     │    └─────────────────────┘      └─────────────────────┘
└───────┬───────┘             (118 invocations formatPrice/formatAmount AGT-15)
        │ CTA "Réserver" + tier param
        ▼
┌────────────────────────────────────┐
│ /reserver page                     │
│ BookingCalendar (~2 131 LOC)       │
│ + BookingForm RHF + Zod            │
└────────────┬───────────────────────┘
             │ submit FormData (NO Turnstile token ⚠️ AGT-10 P0)
             ▼
┌────────────────────────────────────┐
│ src/features/booking/actions.ts    │
│ createBookingAction (Zod parse)    │
│ verifyTurnstile (fail-closed prod) │
│ NO lock pessimiste ⚠️ AGT-10 P1    │
└──┬────────────┬────────────────────┘
   │            │
   ▼            ▼
┌──────────┐  ┌─────────────────────┐
│ Prisma   │  │ BullMQ email-worker │
│ Booking  │  │ + Telegram (PII     │
│ insert   │  │ redacted ADR 0010)  │
└──────────┘  └─────────────────────┘
```

## Findings clés (cite path:line)

1. **SSOT solide** : `src/content/pricing.ts` (Sprint 14.10.5) référencé par 118 sites via 8 helpers (AGT-15 § content). 0 montant hardcodé hors `pricing.ts` (anti-hex check OK).
2. **JSON-LD propagation** : `src/lib/seo/*` factories tirent `pricing.ts` pour Offer/Product/Service (AGT-04). Cohérent.
3. **Lien CTA → Booking** : `/interventions/*` → `/reserver?tier=…` → `BookingCalendar` lit query → `BookingForm` (AGT-10).
4. **Trous critiques sur le flow** (Pass B-confirmable) :
   - **P0** Turnstile widget client absent → toute soumission rejetée si `TURNSTILE_SECRET_KEY` set (AGT-10 `ContactForm.tsx:60-62` commentaire explicite).
   - **P1** Pas de lock pessimiste sur `createBookingAction` vs `postOption48hAction` qui lock `FOR UPDATE` → double-click = 2 bookings + 2 emails (AGT-10 + AGT-11).
   - **P1** Honeypot serveur sans champ HTML caché (AGT-10).
5. **Pricing change → propagation** : 1 modif `pricing.ts` se propage à pages + JSON-LD + email + Telegram. **Aucun cache invalidation step requis** (SSG révalide au prochain deploy).

## Cohérence transverse

✅ Pricing SSOT = code (intouchable § 0.1 respecté).
⚠️ Le flow `/reserver` est **fonctionnellement cassé en prod si Turnstile actif** — bloquant conversion business.
