# ADR 0013 — Stripe Checkout V1 + mode hybride manuel

> ⚠️ **SUPERSEDED (identité) — Axion-IA est désormais une SAS française (régime France).** Les mentions « RIB / chèque à l'ordre de Axion-IA OÜ » et « KYB documents OÜ » ci-dessous réfèrent à l'ancienne structure ; lire **Axion-IA SAS**. La logique de paiement (Stripe + modes manuels) reste valable. Corps historique conservé pour l'audit trail.

**Statut** : ✅ Acté Sprint X.0 booking-v1 · 2026-05-13
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : audit booking V2.3 — `agent-04-paiement-stripe.md`, `03-ARCHITECTURE-CIBLE.md` §5.1.5 + §5.9.1 + §5.16, `STOP-AND-ASK.md` D42 / D56

---

## Contexte

Le module paiement Booking V1 doit accepter :

1. **Paiements en ligne** carte / Apple Pay / Google Pay / SEPA Direct Debit (cible : 80 % des clients PME / TPE).
2. **Paiements hors-ligne** virement bancaire, chèque, espèces (cible : grands comptes, secteur public, dirigeants qui paient personnellement).
3. **Cas dégradé** Stripe indisponible (panne API ou compte suspendu) → ne pas bloquer la business.

Trois options avaient été comparées (`agent-04-paiement-stripe.md` §2) :

- **A. Stripe Payment Intents API custom** : contrôle total UX, lourd à coder, surface PCI (~3 semaines V1).
- **B. Stripe Checkout (hosted page)** : redirection vers `checkout.stripe.com`, intégration minimale, PCI DSS SAQ-A automatique (~3 jours V1).
- **C. Stripe Billing (subscriptions)** : pour récurrent uniquement, hors scope V1 (reporté §5.10.6).

## Décision

### V1 = Stripe Checkout + mode hybride manuel

#### 1. Stripe Checkout (option B)

- Une session `checkout.sessions.create` est créée par échéance (`Payment` row) avec :
  - `mode: 'payment'` (one-shot, pas de subscription)
  - `payment_method_types: ['card', 'sepa_debit']` (configurable via `SiteSetting.stripePaymentMethods`)
  - `customer_email` préfillé depuis `Client.email`
  - `metadata: { bookingId, paymentId, scheduleIndex }`
  - `success_url` / `cancel_url` → pages dédiées `/paiement/confirmation/:paymentId` et `/paiement/annulation/:paymentId`
- Le webhook `/api/webhooks/stripe` reçoit `checkout.session.completed`, `charge.succeeded`, `charge.failed`, `charge.refunded`, `payment_intent.succeeded`, `payment_intent.payment_failed` (6 events). Idempotence via `StripeWebhookEvent.eventId` (PK Stripe).
- Customer Portal Stripe **RETIRÉ V1** (D56). Les factures sont envoyées par email avec PJ PDF (`react-pdf`). Voir ADR 0012 Q3.

#### 2. Mode hybride manuel — `Payment.provider`

Le champ `Payment.provider` accepte 4 valeurs :

| Valeur         | UX                                                                             | Cas d'usage                                     |
| -------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| `stripe`       | Lien `checkout.stripe.com` envoyé au client par email                          | Défaut V1 — clients PME/TPE                     |
| `manual_wire`  | RIB Axion-IA OÜ envoyé au client par email, validation admin à réception       | Grands comptes, OPCO, secteur public            |
| `manual_check` | Mention « chèque à l'ordre de Axion-IA OÜ », validation admin à l'encaissement | Cas rares, B2B traditionnels                    |
| `manual_cash`  | Saisie admin lors du jour J                                                    | Très rare V1, capture du flux pour comptabilité |

Pour les 3 modes `manual_*`, l'admin saisit la confirmation de paiement via le bouton **« Saisir paiement manuel »** dans `/admin/reservations/:id/paiements` (cf. ADR 0019). La transition `Payment.status` passe de `pending` → `succeeded` avec `manualConfirmedBy` (userId) + `manualConfirmedAt` (timestamp) + `manualConfirmationNote` (commentaire libre).

#### 3. Cas dégradé Stripe indisponible

Si l'API Stripe est down (HTTP 500 sur `sessions.create`), l'admin peut **forcer** un booking en mode `manual_wire` via bouton dédié. La résilience opérationnelle est documentée ADR 0019.

#### 4. Mode TEST → LIVE

V1 démarre en mode **TEST** (`sk_test_*`). Bascule LIVE conditionnée à :

- DPA Stripe signé (dashboard.stripe.com → Compliance → DPA).
- KYB validé (vérification documents OÜ).
- Webhook prod testé (Stripe CLI `listen --forward-to`).
- Variables `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` + `STRIPE_WEBHOOK_SECRET` renseignées en prod (Coolify).

## Conséquences

### Techniques

- Surface PCI réduite : Axion-IA n'héberge aucune donnée carte (SAQ-A).
- Webhook idempotence garantie par `StripeWebhookEvent` (PK = `eventId` Stripe).
- 6 events à gérer (vs 30+ pour Payment Intents custom).
- Lib `stripe@latest` (~150 KB gz côté serveur uniquement, 0 KB côté client — pas de `@stripe/stripe-js` V1).
- Pas de Customer Portal = un endpoint `/api/gdpr-export` doit inclure les `Payment` et `Invoice` du client (RGPD).

### Business

- Stripe fees : ~1.4% + 0.25 € (CB Europe) ou 0.8% capped à 5 € (SEPA DD). Acceptable.
- Mode manuel = 0 fee Stripe mais charge admin (saisie + relances + rapprochement bancaire). Sprint X.11 prévoit un export CSV mensuel pour le comptable.
- Bascule LIVE possible J+5 après création compte Stripe live (validation KYB rapide).

### Sécurité

- Webhook signé HMAC SHA-256 vérifié à chaque réception (`stripe.webhooks.constructEvent`).
- Idempotency-Key sur tous les appels mutants Stripe (`sessions.create`, `refunds.create`).
- Audit log `Payment.history` JSONB (transitions de status).

## Alternatives écartées

- **Payment Intents API custom** : 3 semaines V1, surface PCI accrue, gain UX minime (Checkout est déjà très bien).
- **Stripe Billing** : hors scope V1, réservé maintenance 290 €/mois (§5.10.6).
- **Customer Portal Stripe V1** : D56 — alourdit l'UX (compte Stripe à créer côté client), redondant avec self-service via lien magique V1 (Sprint X.15).
- **GoCardless SEPA DD V1** : §5.10.7 — V2+ pour récurrents.

## Liens

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-04-paiement-stripe.md`
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md` §5.1.5 (Payment), §5.9.1 (Stripe récap), §5.16 (suivi paiements)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/STOP-AND-ASK.md` D42, D56
- ADR 0012 Q4 (storage PDF), ADR 0015 (TVA agnostique), ADR 0019 (modes manuels)
