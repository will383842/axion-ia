# Agent 04 — Paiement acompte / solde (Stripe + alternatives)

> **Mode** : AUDIT-ONLY. Aucune écriture code, aucun `git`, aucun `pnpm`. Lecture du repo + écriture du présent `.md` uniquement.
> **HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742` (branche `main`).
> **Date** : 2026-05-12. Auditeur : Claude Opus 4.7 (1M context).
> **Périmètre** : défauts D3 (Stripe Checkout = défaut acompte), D4 (Payment Link / alternatives solde), D15 (architecture TVA-agnostique, structure juridique FR vs EE non tranchée).
> **Doctrine cadre** : Code = SSOT. V1 = deposit-gated minimal complet. Qualiopi / OPCO / PDP / régime TVA détaillé = HORS V1.

---

## 1. Périmètre audité

Cet agent couvre exclusivement la **brique paiement** de la cible V1 (Phase 4 = architecture, sortie déléguée à `03-ARCHITECTURE-CIBLE.md`) :

- Comparaison des options de paiement (Stripe Checkout, Payment Element, Payment Link, GoCardless, virement classique).
- Architecture cible V1 (endpoints, modèles Prisma, webhooks, idempotence, refund, Customer Portal).
- Edge cases (Top 10 risques fraude / replay / out-of-order / network / disputes).
- RGPD (sous-processeur Stripe, DPA, résidence).
- PCI-DSS (SAQ-A confirmé).
- Tests (20 tests cibles Vitest + Playwright, **sans les écrire**).
- TVA-agnostique : 2 scénarios listés (FR / EE) sans trancher.

**Hors périmètre Agent 4** : flux complet visiteur (Agent 1), state machine 16 valeurs (Agent 3), admin facturation (Agent 5/2), notifications (Agent 7), conformité légale CGV/mentions (Agent 11), Yousign signature (Agent 10), cadrage + onboarding (Agent 10).

---

## 2. Constats positifs (état actuel)

Référence Phase 0 — `00-REALITY-CHECK.md` §7.1.

1. **Aucune dette technique Stripe pré-existante**. Le `package.json:65-113` ne référence ni `stripe` ni `@stripe/*`. La greenfield est totale, on peut adopter la dernière version du SDK Node (cf. [docs.stripe.com/api/versioning](https://docs.stripe.com/api/versioning)) sans migration.
2. **Pas d'iframe Stripe Elements existant à démonter**. Aucune CSP à élargir, aucune dette cookie tiers. Le choix Checkout hosted (D3) reste viable sans refonte CSP.
3. **Infrastructure Postgres + Redis + BullMQ déjà en place** (`prisma/schema.prisma`, `src/server/queue/queues.ts:27-53`). Les futures tables `Payment` / `Invoice` / `Refund` / `StripeWebhookEvent` s'inscrivent dans le même schéma Prisma sans nouvelle dépendance d'infra.
4. **Doctrine PII minimisation appliquée** (`src/lib/pii-redaction.ts`, ADR 0010). Les payloads Telegram envoyés en cas d'événement paiement (acompte reçu, refund) hériteront naturellement de la redaction.
5. **`pricing.ts` SSOT** (`src/content/pricing.ts`, mémoire 2026-05-08) déjà en place : les montants acompte 30 % / solde 70 % se dériveront par helper, **zéro hardcode** au niveau Stripe Checkout. Cohérent avec doctrine zéro-divergence.
6. **Verrou pessimiste BookingOption 48h existant** (`src/features/booking/actions.ts:191-235`) : la mécanique de réservation de slot pendant la session Checkout (TTL 30 min Stripe + sentinel DB) sera implémentée par analogie, code-pattern déjà éprouvé.
7. **Webhook handler pattern reproductible** : aucun webhook entrant n'existe aujourd'hui dans `src/app/api/` (Grep `webhook` → 0 route handler entrante). Greenfield = liberté d'architecture `/api/stripe/webhook` propre.

---

## 3. Constats négatifs

> **Hiérarchie** : P0 = bloquant V1 / P1 = critique mais contournable / P2 = qualité ops / P3 = nice-to-have.

### 3.1 P0 — Bloquants V1

- **P0.1 — Aucun modèle Payment** (`prisma/schema.prisma` — grep `model Payment` = 0). Phase 0 §1.1 confirmée. Sans `Payment`, impossible de tracer `paid_at`, `failed_at`, `provider_event_id`, `amount_cents`, `currency`, `type`. Risque : double-paiement non détectable, réconciliation comptable manuelle, audit RGPD impossible.
- **P0.2 — Aucun modèle Invoice** (`prisma/schema.prisma` — grep `model Invoice` = 0). Phase 0 §1.1 + GAP #3 (Doctrine vs réalité). La copy `interventions.ts:236` promet « Facture immédiate », non tenu. Sans numérotation séquentielle `AXION-2026-NNNN` (D29), risque légal FR (CGI art. 242 nonies A) + EE (Raamatupidamise seadus §7).
- **P0.3 — Aucun modèle Refund** (`prisma/schema.prisma` — grep `model Refund` = 0). Phase 0 §1.1. CGV `legal.ts:134` promet remboursement 100 % / 50 % / 0 % selon J-7, J-2 ; aucun mécanisme code-side. Risque : litige client + non-conformité DGCCRF / TOS Stripe Disputes.
- **P0.4 — Aucun modèle StripeWebhookEvent / Outbox** (`prisma/schema.prisma` — grep `Webhook|StripeEvent` = 0). Sans table d'idempotence par `event.id`, replay attack possible (Stripe webhook delivery garantit **at-least-once**, cf. [docs.stripe.com/webhooks#handle-duplicate-events](https://docs.stripe.com/webhooks#handle-duplicate-events)). Risque : double-confirmation booking, double-envoi email, double-facture.
- **P0.5 — Package `stripe` absent** (`package.json:65-113`). Aucun SDK serveur, aucun SDK client (`@stripe/stripe-js`). Bootstrap V1 nécessite : `pnpm add stripe @stripe/stripe-js` + types officiels (auto-inclus).
- **P0.6 — Aucune route handler `/api/stripe/webhook`** (Grep `api/stripe` `src/app/api/` = 0). Sans webhook, le retour `success_url` de Checkout est **non-fiable** comme source de vérité (l'utilisateur peut fermer l'onglet avant la redirection). Doctrine officielle [docs.stripe.com/payments/checkout/fulfill-orders](https://docs.stripe.com/payments/checkout/fulfill-orders) : **toujours fulfillment via webhook**, jamais via redirection.
- **P0.7 — Architecture TVA non décidée et non TVA-agnostique en code**. `legal.ts` mentionne « OÜ Estonie » (`legal.ts:44`) mais ni `vatRate` ni `vatReverseCharge` ni `vatMention` ne sont des colonnes Prisma. Migration future = `ALTER TABLE invoices` rétroactif sur des données existantes = risque de divergence FR/EE non gérable.

### 3.2 P1 — Critiques mais contournables

- **P1.1 — Stripe non listé en sous-processeur** dans `legal.ts:230` (FR) / `:274-275` (EN). Sous-processeurs actuels : Hetzner + Cloudflare + Telegram **uniquement**. Doit être ajouté **avant** la première transaction prod. Risque RGPD art. 28 (sous-traitance non documentée).
- **P1.2 — DPA Stripe non signé** (action Will). Stripe propose un DPA standard auto-signable via Dashboard (cf. [stripe.com/legal/dpa](https://stripe.com/legal/dpa)). À acter avant `LIVE_MODE=true`.
- **P1.3 — Pas de Customer Portal exposé** (D18 = activé par défaut, non implémenté). Conséquence : les clients devront contacter Will pour récupérer leur facture, scale impossible.
- **P1.4 — Pas de page `/sous-processeurs`** dédiée (Phase 0 §8.3 confirme intégration dans `/politique-confidentialite`). Doctrine SaaS B2B 2026 : avoir une URL stable `/sous-processeurs` pour les RFP DPO clients.
- **P1.5 — Numérotation `AXION-2026-NNNN` séquentielle non implémentée** (D29). Risque : trous de numérotation, audit FR/EE refusé (numérotation continue obligatoire CGI 242 nonies A + EE).

### 3.3 P2 — Qualité ops

- **P2.1 — Pas de Stripe Test mode toggle visuel** (cf. Benchmarks §4 Stripe Dashboard inspiration). En admin, distinguer LIVE vs TEST par bandeau global. Risque : envoi facture test à client réel.
- **P2.2 — Pas d'event log Stripe en admin**. Référence : `dashboard.stripe.com` Events tab. À reproduire pour debug webhooks failed.
- **P2.3 — Pas d'export CSV factures pour DPO / compta** (D32 = export mensuel V1). Implémentable en V1.
- **P2.4 — Pas de monitoring webhook (retry count, DLQ)**. Sentry capture les erreurs mais ne donne pas la métrique « webhooks failed / received par 24h ».

### 3.4 P3 — Nice-to-have

- **P3.1 — Pas de Apple Pay / Google Pay automatique**. Activable Dashboard Checkout en V1 sans code, à valider Will pour positionnement premium B2B (rarement utilisé en B2B FR).
- **P3.2 — Pas de Stripe Tax** (volontairement désactivé V1, cf. Benchmarks §2 Stripe Billing : architecture TVA-agnostique).
- **P3.3 — Pas de Stripe Radar pricing tier supérieur**. Le tier free Radar standard suffit V1.
- **P3.4 — Pas de hosted-invoice-url branding custom** (logo Axion-IA dans le PDF Stripe). Activable Dashboard Branding sans code.

---

## 4. Comparaison options paiement (D3, D4)

| Option                             | Avantages                                                                                                                                                                                                                                     | Inconvénients                                                                                                                | Coût                                                                                                                          | Verdict V1 Axion-IA                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Stripe Checkout (hosted)**       | PCI-DSS SAQ-A (aucune carte stockée côté Axion-IA). 3DS2 natif (PSD2). Refund API. 125+ moyens paiement Dashboard. Sessions expirables (30 min) → libère slot. [docs.stripe.com/payments/checkout](https://docs.stripe.com/payments/checkout) | Branding limité (volontaire Stripe). Pas d'embed natif (redirect obligatoire).                                               | 1,4 % + 0,25 € EU cartes consommateur, 2,5 % + 0,25 € premium / non-EU [stripe.com/fr/pricing](https://stripe.com/fr/pricing) | ✅ **ACOMPTE** (D3)                                                         |
| **Stripe Payment Element** (embed) | Custom UI in-page, contrôle CSS partiel. Apple/Google Pay inclus.                                                                                                                                                                             | Augmente surface PCI à SAQ-A-EP (formulaire hébergé Stripe mais embarqué). CSP à élargir. Plus complexe que Checkout.        | Tarification Stripe identique Checkout.                                                                                       | ❌ Hors V1 (sur-engineering, surface CSP)                                   |
| **Stripe Payment Link**            | No-code, créé en 30s Dashboard. QR code natif. UTM params. Webhook standard.                                                                                                                                                                  | Pas de logique conditionnelle / routing. Pas de réservation slot. Receipt branding Stripe par défaut.                        | Identique Checkout.                                                                                                           | ✅ **SOLDE** (D4) — fallback ad-hoc                                         |
| **GoCardless (SEPA debit)**        | Frais ultra-bas (0,2 % EU). Idéal abonnements maintenance V2+ (D14 récurrent). Mandat SEPA réutilisable. [gocardless.com/pricing](https://gocardless.com/pricing)                                                                             | Délai d'encaissement D+3 à D+5 (vs instant Stripe). Pas adapté à un acompte qui bloque un slot. Setup compte FR/EE complexe. | 0,2 % + 0,20 € (capped 4 €) FR.                                                                                               | ❌ Hors V1 (delay incompatible deposit-gated). V2+ pour solde grand compte. |
| **Virement classique**             | Zéro frais Axion-IA. Standard B2B grands comptes (>10k€). Pas de risque chargeback.                                                                                                                                                           | Délai 1-3j ouvrés. Pas d'automation. Reconciliation manuelle. Risque erreur RIB. Pas adapté à un acompte.                    | 0 € (frais bancaires Will).                                                                                                   | ✅ **SOLDE** (D4) — alternative grands comptes (>5 000 € HT)                |

### Décisions retenues V1

- **Acompte (30 % du devis)** = **Stripe Checkout hosted** (D3). Session expiry 30 min, mode `payment`, capture `automatic`, `metadata.bookingId` + `metadata.axionRef` + `metadata.type='deposit'`.
- **Solde (70 % post-livraison)** = **Stripe Payment Link** statique pour < 5 000 € HT (D4), **virement classique** au-delà ou si client le réclame (B2B grands comptes). Email transactionnel Axion-IA branded contenant le lien (jamais l'email Stripe natif, cf. Benchmarks §2 Customer Portal).
- **SEPA Direct Debit / GoCardless** : **différé V2+** (abonnement maintenance 290 €/mois — cf. pricing.ts mémoire 2026-05-08).

---

## 5. Architecture cible V1

### 5.1 Endpoints

| Endpoint                                             | Méthode | Authentification                                                                                               | Rôle                                                                                                                                                                                                                                                       | Source ref                                                                                                                                                                      |
| ---------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/stripe/create-checkout-session`           | POST    | Server Action OU API route (auth optionnelle, rate-limit `stripe-checkout:<ip>` 5/600s + Turnstile re-vérifié) | Crée `stripe.checkout.sessions.create({ mode:'payment', currency:'eur', success_url, cancel_url, customer_email, metadata:{bookingId,type:'deposit',axionRef}, expires_at:Date.now()+30*60*1000, payment_intent_data:{ description:..., metadata:... } })` | [docs.stripe.com/api/checkout/sessions/create](https://docs.stripe.com/api/checkout/sessions/create)                                                                            |
| `POST /api/stripe/webhook`                           | POST    | Signature obligatoire (`Stripe-Signature` header + `stripe.webhooks.constructEvent(body, sig, secret)`)        | Dispatch state machine selon `event.type`. Idempotence via `StripeWebhookEvent.stripeEventId @unique`. Réponse 200 immédiate, traitement async via enqueue BullMQ. Re-enqueue avec retry 5 + DLQ.                                                          | [docs.stripe.com/webhooks/signatures](https://docs.stripe.com/webhooks/signatures) + [docs.stripe.com/webhooks/best-practices](https://docs.stripe.com/webhooks/best-practices) |
| `POST /api/admin/bookings/:id/refund`                | POST    | `requireAdminWrite()` (super_admin / admin uniquement)                                                         | `stripe.refunds.create({ payment_intent, amount, metadata:{adminUserId,reason} })` + insère `Refund` row + `ActivityLog` `refund.created` + Telegram tag `REMBOURSEMENT` (PII redacted).                                                                   | [docs.stripe.com/api/refunds/create](https://docs.stripe.com/api/refunds/create)                                                                                                |
| `GET /api/stripe/customer-portal` (ou Server Action) | GET     | Lien magique email signé (token Submission/Booking 7j)                                                         | `stripe.billingPortal.sessions.create({ customer, return_url: '/mes-donnees', configuration: <portal_cfg_id> })` → redirect 302.                                                                                                                           | [docs.stripe.com/customer-management/integrate-customer-portal](https://docs.stripe.com/customer-management/integrate-customer-portal)                                          |

> **Doctrine** : préférer **Server Actions** (`src/features/payment/actions.ts`) pour `create-checkout-session` et `customer-portal` (cohérent doctrine existante `booking/actions.ts:41`). Garder **API route** `/api/stripe/webhook` car Stripe pousse un POST externe.

### 5.2 Tables Prisma (cible)

#### `Payment`

```text
id                Uuid PK
provider          PaymentProvider  // enum 'stripe' V1, extensible 'gocardless' V2
providerEventId   String UNIQUE    // pour idempotence webhook (Stripe event.id)
providerCustomerId        String?  // stripe customer cus_...
providerPaymentIntentId   String?  // pi_...
providerCheckoutSessionId String?  // cs_...
amountCents       Int
currency          String           // 'eur' uniquement V1 (D22)
type              PaymentType      // enum 'deposit' | 'balance' | 'refund'
status            PaymentStatus    // enum 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
paidAt            DateTime?
failedAt          DateTime?
failureReason     String?          // Citext, redacted PII
bookingId         Uuid FK -> Booking.id (onDelete: Restrict)
createdAt         DateTime @default(now())
updatedAt         DateTime @updatedAt
@@index([bookingId])
@@index([providerPaymentIntentId])
@@index([status, type])
@@map("payments")
```

#### `Invoice`

```text
id                Uuid PK
number            String UNIQUE     // 'AXION-2026-NNNN' séquentiel D29
bookingId         Uuid FK -> Booking.id (onDelete: Restrict)
paymentId         Uuid? FK -> Payment.id
type              InvoiceType        // enum 'deposit' | 'balance' | 'full' | 'credit_note'
amountHtCents     Int
amountTtcCents    Int
vatRate           Decimal(5,2)       // configurable, 0.00 ou 20.00 par défaut. D15
vatReverseCharge  Boolean @default(false)  // D15 — true = autoliquidation B2B intra-UE
vatMention        String?            // ex. 'Autoliquidation — Article 196 directive 2006/112/CE', config legal.ts
pdfUrl            String?            // Hetzner Object Storage signed URL OR stripe.hosted_invoice_url
hashSha256        String?            // intégrité PDF archivé
issuedAt          DateTime @default(now())
dueAt             DateTime?
paidAt            DateTime?
status            InvoiceStatus      // enum 'draft' | 'issued' | 'paid' | 'overdue' | 'void' | 'refunded'
archivedUntil     DateTime           // D30 = +10 ans, calculé au issued
payerType         PayerType @default(client)  // enum 'client' V1, extensible 'opco' | 'pdp' V2+
locale            Locale @default(fr)
createdAt         DateTime @default(now())
updatedAt         DateTime @updatedAt
@@index([bookingId])
@@index([status, issuedAt])
@@index([number])
@@map("invoices")
```

#### `Refund`

```text
id                Uuid PK
invoiceId         Uuid FK -> Invoice.id (onDelete: Restrict)
paymentId         Uuid FK -> Payment.id (onDelete: Restrict)
amountCents       Int                  // partial OR full
reason            String?              // 'requested_by_customer' | 'duplicate' | 'fraudulent' (mapping Stripe API)
status            RefundStatus         // enum 'pending' | 'succeeded' | 'failed' | 'canceled'
stripeRefundId    String? UNIQUE       // re_...
adminUserId       Uuid? FK -> AdminUser.id
createdAt         DateTime @default(now())
updatedAt         DateTime @updatedAt
@@index([invoiceId])
@@index([paymentId])
@@map("refunds")
```

#### `StripeWebhookEvent` (table outbox / dedup)

```text
id                Uuid PK
stripeEventId     String UNIQUE    // evt_...
type              String           // 'checkout.session.completed', 'charge.refunded', ...
livemode          Boolean
apiVersion        String?          // Stripe API version (ex. '2024-12-18.acacia')
payload           Json             // event entier persisté pour replay / audit
processedAt       DateTime?
error             Text?
retryCount        Int @default(0)
nextRetryAt       DateTime?
eventCreatedAt    DateTime         // event.created Unix → Date pour ordre logique
receivedAt        DateTime @default(now())
@@index([type, processedAt])
@@index([stripeEventId])
@@map("stripe_webhook_events")
```

> **Doctrine idempotence** : `stripeEventId @unique` + `INSERT … ON CONFLICT DO NOTHING` Postgres (Prisma `createMany skipDuplicates:true`). Si l'insert retourne 0 → événement déjà reçu, return 200 sans re-traitement. Cf. [docs.stripe.com/webhooks#handle-duplicate-events](https://docs.stripe.com/webhooks#handle-duplicate-events).

### 5.3 TVA-agnostique (D15 critique)

Conformément à la mémoire `axionia_naming_brand_vs_project` + Phase 0 §8.5 + prompt source §8 (« structure juridique FR vs EE non tranchée → architecture TVA-agnostique ») :

- `Invoice.vatRate` = colonne décimale paramétrable par facture (pas en dur 20 %).
- `Invoice.vatReverseCharge` = booléen par facture.
- `Invoice.vatMention` = string nullable, source = `legal.ts` (mention configurable selon scénario actif).
- **L'audit NE TRANCHE PAS** entre les 2 scénarios suivants :

#### Scénario A — France (Axion-IA SAS/EURL FR)

- TVA **20 %** B2B (CGI art. 261-B exclu, prestation services intra-UE).
- Mention obligatoire « TVA acquittée sur les débits » (CGI art. 269) **OU** « TVA acquittée sur les encaissements » selon option exercée.
- Régime réel normal ou simplifié, selon CA.
- Déclaration FR mensuelle / trimestrielle (CA3).
- **e-invoicing PPF/PDP 2026-2027** : Axion-IA devra émettre/recevoir factures B2B FR via Plateforme de Dématérialisation Partenaire (Pennylane / Sage / Cegid candidates, cf. Benchmarks §HORS-SCOPE). **[HORS V1]** — à acter V2+ une fois structure tranchée.
- Mention SIRET + RCS + TVA FR obligatoire sur tout document commercial.

#### Scénario B — Estonie (Axion-IA OÜ EE, comme `legal.ts:44`)

- B2B intra-UE : **reverse charge** (autoliquidation par le client) → TVA 0 % sur facture émise.
- Mention obligatoire « Autoliquidation — Article 196 de la directive 2006/112/CE » ou équivalent EN « Reverse charge — Article 196 of Council Directive 2006/112/EC ».
- Hors UE : 0 %, hors champ TVA EU.
- Validation **VIES** du numéro TVA client intra-UE obligatoire avant facturation reverse charge (sous peine de re-facturer la TVA EE 22 % rétroactivement). [ec.europa.eu/taxation_customs/vies](https://ec.europa.eu/taxation_customs/vies).
- Mention `registrikood` + `KMKR nr` (n° TVA EE format `EE123456789`) requise.
- Pas concerné par PPF/PDP FR (sauf si Axion-IA OÜ établit un établissement stable FR).
- **[HORS V1]** : décision FR vs EE = action Will. Audit garde architecture TVA-agnostique strictement.

### 5.4 Customer Portal Stripe (D18 activé)

Référence : [docs.stripe.com/customer-management](https://docs.stripe.com/customer-management).

- **Activation** : Dashboard → Settings → Billing → Customer portal → activate. No-code.
- **Configuration V1 minimaliste** :
  - Invoices view = ON (téléchargement PDF Stripe-hosted).
  - Update payment method = OFF (V1 one-shot, pas de récurrent).
  - Cancel subscription = OFF.
  - Update business info = ON (client peut corriger raison sociale / adresse facturation).
- **Domaine custom** : créer `billing.axion-ia.com` (CNAME → `*.stripe.com`) pour cohérence trust (Cloudflare DNS, déjà en place).
- **Auth** : pas de mot de passe Axion-IA. Stripe envoie lien magique email à l'adresse `customer.email` → ouvre le portail dans `stripe.billingPortal.sessions.create()` retour URL.
- **Limitation** : ne peut pas être embedded iframe (Benchmarks §2 Customer Portal point 1). On expose un bouton « Mes factures » dans `/mes-donnees` qui redirige.

### 5.5 Edge cases — Top 10 risques

> Sources : [docs.stripe.com/webhooks/best-practices](https://docs.stripe.com/webhooks/best-practices) + [docs.stripe.com/disputes](https://docs.stripe.com/disputes) + [docs.stripe.com/payments/3d-secure](https://docs.stripe.com/payments/3d-secure) + [docs.stripe.com/radar](https://docs.stripe.com/radar).

| #   | Risque                                         | Manifestation                                                                                                                          | Mitigation V1                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **3DS2 échoué**                                | `payment_intent.payment_failed` event avec `last_payment_error.code='authentication_required'` ou user abandon SCA.                    | Garder slot `reserved` jusqu'à expiry session (30 min) puis libérer via `option-expiration-worker` adapté. Email transactionnel « Paiement non finalisé — votre créneau est libéré ».                                                                                                  |
| 2   | **Carte refusée** (`charge.failed`)            | Insufficient funds, do_not_honor, lost_card, stolen_card.                                                                              | Idem 3DS échoué + log `Payment.failureReason` (redacted code Stripe, jamais le PAN ni le motif détaillé client).                                                                                                                                                                       |
| 3   | **Dispute** (`charge.dispute.created`)         | Client conteste auprès de sa banque (fraude, service non rendu, double débit).                                                         | Webhook → `Booking.status='disputed'` (extension state machine D17) + Telegram tag `LITIGE` immédiat super_admin + capture evidence (devis Yousign, email confirmation, ICS, livrables si livrés) à uploader dans `stripe.disputes.update({ evidence })` sous 7-21j (deadline Stripe). |
| 4   | **Refund partiel** (`charge.refunded` partiel) | Webhook avec `refund.amount < charge.amount`.                                                                                          | Insérer `Refund` row (status='succeeded'), recalculer `Invoice.amountTtcCents` résiduel, émettre **avoir** (`credit_note` type) automatiquement avec nouveau numéro `AXION-2026-NNNN` séquentiel.                                                                                      |
| 5   | **Webhook replay attack**                      | Attaquant rejoue un webhook capturé (Stripe-Signature valide tant que le secret reste valide).                                         | (a) Vérifier signature `stripe.webhooks.constructEvent` avec tolerance par défaut 5 min. (b) Idempotence `StripeWebhookEvent.stripeEventId @unique`. (c) Rotation du `STRIPE_WEBHOOK_SECRET` documentée tous les 12 mois.                                                              |
| 6   | **Webhook out-of-order**                       | Stripe garantit at-least-once, **pas** l'ordre. Ex: `charge.refunded` reçu avant `payment_intent.succeeded`.                           | Utiliser `event.created` (Unix timestamp) pour ordre logique. State machine défensive : transition `failed → succeeded` interdite, `succeeded → refunded` autorisée, etc. Si event arrive « du passé » et l'état actuel est plus avancé → log + skip.                                  |
| 7   | **Network timeout webhook**                    | Le webhook handler dépasse 30s ou retourne 5xx. Stripe re-tente avec exponential backoff (3j max).                                     | Webhook handler **ultra-rapide** (< 1s) : signature check + insert outbox + enqueue BullMQ → 200. Tout le métier en worker async. Retry BullMQ `attempts:5` (cohérent `queues.ts:27` doctrine emails). DLQ après 5 échecs.                                                             |
| 8   | **Fraude Radar** (`review.opened`)             | Stripe Radar flag une transaction comme suspect (score > threshold).                                                                   | Webhook `review.opened` → `Booking.status='review_pending'` + Telegram tag `FRAUDE_REVIEW` super_admin + bloquer fulfillment (pas d'email confirmation client, pas de cadrage scheduled) tant que `review.closed` avec `outcome='approved'` n'est pas reçu.                            |
| 9   | **Currency mismatch**                          | Session créée en EUR mais Stripe accepte le paiement en USD (Apple Pay carte US fallback).                                             | D22 = EUR uniquement V1. Réject `payment_method_options.card.allowed_currencies=['eur']` + double-check côté webhook `payment_intent.currency==='eur'`. Refund automatique si mismatch détecté.                                                                                        |
| 10  | **Booking déjà confirmed (race)**              | 2 webhooks `checkout.session.completed` arrivent en parallèle (replay + nouveau) → 2 `Booking.status='confirmed'` updates concurrents. | Transaction Postgres `SELECT ... FOR UPDATE` sur `Booking.id` + state machine transition guard `if booking.status === 'pending_payment' THEN ...` + idempotence outbox layer (cf. #5).                                                                                                 |

---

## 6. RGPD Stripe

### 6.1 Sous-processeur à inscrire

À ajouter dans `src/content/legal.ts` (clé `politique-confidentialite` FR + EN, et — recommandation P1 — créer page dédiée `/sous-processeurs`) :

> **Stripe Payments Europe Ltd** — traitement des paiements, génération factures, Customer Portal. Siège : 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irlande. UE-native. DPA standard signé (référence interne). Données traitées : nom, email client, raison sociale, adresse facturation, méthode de paiement (tokenisée Stripe-side, jamais reçue par Axion-IA), montants, devise, IP de paiement, identifiants techniques (cus*, pi*, cs*, evt*). Aucun cookie tiers déposé tant que `/api/stripe/create-checkout-session` n'est pas invoqué (zéro impact RGPD page de réservation). Politique de rétention Stripe : 7 ans en lecture seule pour conformité PSD2 / 6e Directive AML.

### 6.2 DPA à signer (action Will)

- **Procédure** : Stripe Dashboard → Settings → Compliance → Data Processing Agreement → Sign electronically.
- **Référence** : [stripe.com/legal/dpa](https://stripe.com/legal/dpa).
- **Sous-sous-processeurs Stripe** (à acter par Will dans le RoPA Axion-IA) : AWS US (data backups), Sentry, etc. Liste complète sur [stripe.com/legal/sub-processors](https://stripe.com/legal/sub-processors).

### 6.3 Résidence données

- **Stripe Payments Europe Ltd** = entité IE (Irlande UE) pour clients EU.
- Cartes traitées via Stripe global infrastructure (US/EU mix selon routing). Acceptable car Standard Contractual Clauses (SCC) + EU-US Data Privacy Framework couvrent le transfert. Documenté dans DPA.
- Pour clients **strictement UE-only** exigeant (rare cabinet IA B2B, mais possible secteur sensible / défense), Stripe propose des contrats Enterprise dédiés `[INCONNU — détail offre 2026 non vérifié]`. **HORS V1**.

### 6.4 Export RGPD client

L'endpoint `GET /api/gdpr-export` (Sprint 24, cf. mémoire `axionia_session_2026-05-09_sprint_24`) doit être étendu pour inclure :

- Liste des `Payment` du client (statuts, montants, dates, last4 redacted).
- Liste des `Invoice` (numéros, montants, PDFs liés).
- Liste des `Refund`.
- Pas d'export du PAN ni des données carte (jamais reçues par Axion-IA).

### 6.5 Erase RGPD

`POST /api/admin/submissions/:id/erase` (Sprint 24 existant) doit être étendu :

- Anonymiser `Payment.providerCustomerId` → garder l'ID Stripe (Stripe ne supprime pas, doctrine `customer.deleted` API supprime côté Stripe sur demande).
- Conserver `Invoice` (obligation comptable 10 ans D30 > droit à l'effacement RGPD art. 17.3.b) avec PII pseudonymisée (`buyerName → "[ERASED]"`, `buyerEmail → SHA-256 hash`).
- ActivityLog `payment.erased` + `invoice.pseudonymized`.

---

## 7. PCI-DSS

### 7.1 SAQ-A — confirmé pour Stripe Checkout hosted

Référence : [stripe.com/docs/security/guide#validating-pci-compliance](https://stripe.com/docs/security/guide#validating-pci-compliance).

- **SAQ-A** = Self-Assessment Questionnaire A = niveau **le plus permissif** PCI-DSS v4.
- Conditions à respecter pour qualifier SAQ-A avec Stripe Checkout :
  1. Carte **jamais saisie** sur un domaine Axion-IA → ✅ (Checkout redirect vers `checkout.stripe.com`).
  2. Aucun cardholder data **stocké, traité ou transmis** par les serveurs Axion-IA → ✅ (webhooks ne reçoivent que des tokens `cs_...`, `pi_...`, last4 et brand redacted ok).
  3. Toute la fonction paiement externalisée à un fournisseur PCI-DSS Level 1 (Stripe l'est) → ✅.
- **Action V1** : à documenter dans `_AUDIT/PCI-DSS-SAQ-A-2026.md` (Sprint dédié, hors Agent 4) avec auto-évaluation signée Will. Renouvellement annuel.
- **Re-classification possible vers SAQ-A-EP** si on bascule vers Payment Element embed (formulaire hébergé Stripe mais iframe sur Axion-IA → exige scan ASV trimestriel). **V1 reste SAQ-A** (D3 = Checkout hosted).

### 7.2 Headers / CSP

Aucune modification CSP nécessaire pour Stripe Checkout hosted (redirect external). En revanche, si on intègre **Apple Pay** dans Checkout, ajouter `apple-developer-merchantid-domain-association` à la racine + `connect-src https://*.apple.com` côté CSP **uniquement si Apple Pay activé** (D14 reporté V2+).

---

## 8. Tests (20 tests cibles, sans les écrire)

> **Doctrine** : Vitest + Playwright. Mock Stripe via `stripe-mock` ([github.com/stripe/stripe-mock](https://github.com/stripe/stripe-mock)) pour unit tests + Stripe CLI `stripe trigger` pour intégration locale + clés `STRIPE_SECRET_KEY=sk_test_...` en CI.

### 8.1 Unit (Vitest)

1. `createCheckoutSessionAction` retourne `{ok, url, sessionId}` avec metadata `{bookingId, axionRef, type:'deposit'}` correct.
2. `createCheckoutSessionAction` rejette si `pricePaidCents < minDepositCents` (30 % de pricing.ts).
3. `createCheckoutSessionAction` applique `expires_at = now + 30 min`.
4. `verifyStripeSignature` rejette payload modifié (Stripe-Signature invalide).
5. `verifyStripeSignature` rejette payload > 5 min tolerance (replay attack).
6. `handleCheckoutSessionCompleted` est idempotent (2 appels → 1 seul Booking.status='confirmed').
7. `handleChargeRefunded` insère `Refund` row + crée `Invoice` type='credit_note' + nouveau numéro séquentiel.
8. `generateInvoiceNumber` retourne `AXION-2026-0001`, `AXION-2026-0002`, … atomique sous concurrence (`SELECT … FOR UPDATE` ou Postgres sequence).
9. `computeVat` retourne `{rate:0, reverseCharge:true, mention:'Autoliquidation…'}` en scénario EE et `{rate:20, reverseCharge:false, mention:null}` en scénario FR (paramétré).
10. `pseudonymizeInvoice` remplace `buyerName` et `buyerEmail` par valeurs RGPD-clean après erase.

### 8.2 Intégration (Vitest + stripe-mock)

11. End-to-end `createCheckoutSession → webhook checkout.session.completed → Booking.status='confirmed'` (mock Stripe).
12. Webhook `payment_intent.payment_failed` → `Booking.status='pending'` reste, slot libéré après TTL.
13. Webhook `charge.dispute.created` → `Booking.status='disputed'` + Telegram tag `LITIGE` (mock).
14. Refund total via `/api/admin/bookings/:id/refund` → Stripe API call + Refund row + Invoice credit_note + ActivityLog.
15. Outbox dedup : injection de 2 webhooks avec même `event.id` → 1 seul traitement, 2 réponses 200.

### 8.3 E2E (Playwright)

16. Parcours visiteur `/reserver` → modale → 3DS Test card `4000 0027 6000 3184` → success → `/reserver/confirmation` affiche réf `AXION-2026-NNNN`.
17. Parcours échec : carte `4000 0000 0000 0002` (decline) → utilisateur revient sur `/reserver` avec banner « Paiement non finalisé ».
18. Customer Portal : email magique → click → portal ouvre → liste factures + download PDF.
19. Admin refund partiel : login → /admin/reservations/:id → button « Rembourser 50% » → confirm → Stripe API mock returns refund.succeeded → UI affiche timeline updated.
20. Webhook signature attack : POST `/api/stripe/webhook` avec Stripe-Signature forgée → 400 Bad Request + log Sentry `stripe.webhook.signature_invalid`.

---

## 9. Recommandations — Top 15 (impact × effort inverse)

| #   | Reco                                                                                                                        | Impact | Effort | Priorité | Marquage |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | -------- | -------- |
| 1   | **Adopter Stripe Checkout hosted pour l'acompte 30 %** (D3). PCI-DSS SAQ-A confirmé.                                        | 10/10  | 3/10   | P0       | V1       |
| 2   | **Créer table `StripeWebhookEvent`** (outbox/dedup) avec `stripeEventId @unique`. Idempotence webhook par design.           | 10/10  | 2/10   | P0       | V1       |
| 3   | **Créer tables `Payment`, `Invoice`, `Refund`** avec colonnes TVA-agnostique (`vatRate`, `vatReverseCharge`, `vatMention`). | 10/10  | 4/10   | P0       | V1       |
| 4   | **Implémenter route `/api/stripe/webhook`** avec signature check + signature tolerance 5 min + body raw + dispatch BullMQ.  | 10/10  | 3/10   | P0       | V1       |
| 5   | **Numérotation séquentielle `AXION-2026-NNNN`** atomique (Postgres sequence ou advisory lock + SELECT FOR UPDATE).          | 9/10   | 2/10   | P0       | V1       |
| 6   | **Ajouter Stripe dans sous-processeurs `legal.ts`** + créer page dédiée `/sous-processeurs` (FR + EN).                      | 9/10   | 1/10   | P0       | V1       |
| 7   | **DPA Stripe signé** (action Will Dashboard) avant `LIVE_MODE`.                                                             | 9/10   | 1/10   | P0       | V1       |
| 8   | **Customer Portal Stripe activé** (D18) avec config minimaliste invoices-only.                                              | 8/10   | 2/10   | P0       | V1       |
| 9   | **Top 10 edge cases** (cf. §5.5) testés Vitest + Playwright (cf. §8 — 20 tests cibles).                                     | 9/10   | 5/10   | P0       | V1       |
| 10  | **Payment Link statique** pour le solde 70 % (D4) + virement classique fallback grands comptes.                             | 8/10   | 1/10   | P1       | V1       |
| 11  | **Erase RGPD étendu** pour anonymiser Payment + pseudonymiser Invoice (conservation 10 ans D30).                            | 8/10   | 2/10   | P1       | V1       |
| 12  | **Export `/api/gdpr-export` étendu** avec Payments + Invoices + Refunds.                                                    | 7/10   | 2/10   | P1       | V1       |
| 13  | **Dashboard admin event log Stripe** (liste Events `evt_...` avec status, retry, response code).                            | 7/10   | 4/10   | P1       | V1.5     |
| 14  | **Test mode toggle visuel global** dans admin (bandeau orange si `STRIPE_LIVE_MODE=false`).                                 | 7/10   | 2/10   | P2       | V1.5     |
| 15  | **Domaine custom `billing.axion-ia.com`** pour Customer Portal (CNAME Stripe).                                              | 6/10   | 1/10   | P2       | V1.5     |

---

## 10. Sources citées (doc officielle Stripe + connexes)

- [docs.stripe.com/payments/checkout](https://docs.stripe.com/payments/checkout) — Checkout hosted page (D3).
- [docs.stripe.com/api/checkout/sessions/create](https://docs.stripe.com/api/checkout/sessions/create) — session params.
- [docs.stripe.com/webhooks/signatures](https://docs.stripe.com/webhooks/signatures) — Stripe-Signature header.
- [docs.stripe.com/webhooks/best-practices](https://docs.stripe.com/webhooks/best-practices) — retry, idempotence, ordre.
- [docs.stripe.com/webhooks#handle-duplicate-events](https://docs.stripe.com/webhooks#handle-duplicate-events) — dedup par event.id.
- [docs.stripe.com/payments/checkout/fulfill-orders](https://docs.stripe.com/payments/checkout/fulfill-orders) — fulfillment via webhook obligatoire.
- [docs.stripe.com/api/refunds/create](https://docs.stripe.com/api/refunds/create) — refund API.
- [docs.stripe.com/customer-management](https://docs.stripe.com/customer-management) — Customer Portal.
- [docs.stripe.com/customer-management/integrate-customer-portal](https://docs.stripe.com/customer-management/integrate-customer-portal) — billingPortal.sessions.create.
- [docs.stripe.com/disputes](https://docs.stripe.com/disputes) — disputes workflow.
- [docs.stripe.com/radar](https://docs.stripe.com/radar) — fraud detection.
- [docs.stripe.com/payments/3d-secure](https://docs.stripe.com/payments/3d-secure) — SCA PSD2.
- [docs.stripe.com/api/versioning](https://docs.stripe.com/api/versioning) — pinning API version.
- [stripe.com/fr/pricing](https://stripe.com/fr/pricing) — tarifs 2026.
- [stripe.com/legal/dpa](https://stripe.com/legal/dpa) — Data Processing Agreement.
- [stripe.com/legal/sub-processors](https://stripe.com/legal/sub-processors) — liste sous-sous-processeurs Stripe.
- [stripe.com/docs/security/guide#validating-pci-compliance](https://stripe.com/docs/security/guide#validating-pci-compliance) — PCI-DSS SAQ.
- [docs.stripe.com/payment-links](https://docs.stripe.com/payment-links) — Payment Link (D4).
- [docs.stripe.com/billing](https://docs.stripe.com/billing) — Stripe Billing (V2+).
- [github.com/stripe/stripe-mock](https://github.com/stripe/stripe-mock) — mock server pour tests.
- [gocardless.com/pricing](https://gocardless.com/pricing) — alternative SEPA Direct Debit (V2+).
- [ec.europa.eu/taxation_customs/vies](https://ec.europa.eu/taxation_customs/vies) — VIES validation TVA UE (scénario EE).
- Phase 0 — `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md` §1.1, §7.1, §9.
- Benchmarks Phase 3 — `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/02-BENCHMARKS-2026.md` §2 (Catégorie Paiement & facturation).
- Sources code — `prisma/schema.prisma:201-228` (Booking), `package.json:65-113` (deps), `src/lib/pii-redaction.ts` (PII), `src/server/queue/queues.ts:27-53` (BullMQ).

---

## 11. Score /100

> Pondération : sécurité 25 / idempotence 20 / RGPD 20 / UX 15 / refund 10 / reconciliation 10 = 100.

### 11.1 Score état actuel (HEAD `ff3ccbc`)

| Dimension      | Pondération | Score actuel | Justification                                                                                                                         |
| -------------- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Sécurité       | 25          | **2 / 25**   | Aucun paiement => aucune surface PCI à protéger. Mais aucun design défensif. Très bas par absence pure.                               |
| Idempotence    | 20          | **0 / 20**   | Aucun outbox, aucun handler webhook, aucune dedup. Toute future intégration partirait sans filet.                                     |
| RGPD           | 20          | **3 / 20**   | Doctrine PII redaction OK (ADR 0010), mais Stripe absent des sous-processeurs, pas de DPA, pas d'export RGPD étendu.                  |
| UX             | 15          | **2 / 15**   | `/reserver` mature visuel, mais aucun écran « paiement », aucun fallback échec, aucune confirmation.                                  |
| Refund         | 10          | **0 / 10**   | Aucun modèle Refund, aucune action admin, CGV `legal.ts:134` promet remboursement non implémenté → faute lourde.                      |
| Reconciliation | 10          | **0 / 10**   | Aucun export CSV, aucun event log, aucune table Payment. Reconciliation comptable impossible.                                         |
| **TOTAL**      | **100**     | **7 / 100**  | État pré-V1 : greenfield total, aucune dette mais aucun gain. Réécriture from-scratch nécessaire (couverte par Reco #1-#9 ci-dessus). |

### 11.2 Score cible post-V1 (après application Reco #1-#12)

| Dimension      | Pondération | Score cible  | Justification                                                                                                                        |
| -------------- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Sécurité       | 25          | **22 / 25**  | SAQ-A + signature webhook + Sentry + CSP intacte. -3 = pas encore d'audit pénétration tier sur le flow paiement (V2+).               |
| Idempotence    | 20          | **18 / 20**  | Outbox table + signature tolerance + state machine défensive. -2 = pas de circuit breaker / DLQ visualization V1.                    |
| RGPD           | 20          | **17 / 20**  | Sous-processeur + DPA signé + export + erase pseudonymisation. -3 = page `/sous-processeurs` dédiée et RoPA à structurer V1.5.       |
| UX             | 15          | **13 / 15**  | Checkout hosted = trust max + Customer Portal + fallback error + email branded. -2 = pas de session replay / a/b post-Checkout V1.   |
| Refund         | 10          | **9 / 10**   | Action admin + Stripe API + credit_note + ActivityLog. -1 = pas de workflow approbation 2-eyes (V2+ si volume).                      |
| Reconciliation | 10          | **8 / 10**   | Export CSV + event log + numérotation + sequence atomique. -2 = pas d'intégration compta automatique (Pennylane/Sage HORS V1).       |
| **TOTAL**      | **100**     | **87 / 100** | Niveau V1 deposit-gated robuste, prêt prod B2B premium. Marge progressive vers 95+ via V1.5 + V2+ (intégration PDP, audit PCI tier). |

---

## 12. Marquage V1 vs V2+

### V1 (deposit-gated minimal complet, sprint paiement dédié)

- Tables Payment, Invoice, Refund, StripeWebhookEvent.
- Endpoints `/api/stripe/create-checkout-session`, `/api/stripe/webhook`, `/api/admin/bookings/:id/refund`, `/api/stripe/customer-portal`.
- Stripe Checkout (acompte 30 %).
- Payment Link statique + virement (solde 70 %).
- Customer Portal Stripe activé (invoices-only).
- Numérotation `AXION-2026-NNNN`.
- TVA-agnostique : colonnes paramétrables, **scénario non tranché**.
- Sous-processeur Stripe inscrit + DPA signé.
- Export RGPD + erase étendus.
- 20 tests Vitest + Playwright.

### V1.5 (post-mise en prod V1, < 3 mois)

- Page `/sous-processeurs` dédiée.
- Dashboard admin event log Stripe (UI debug webhooks).
- Test mode toggle visuel.
- Domaine custom `billing.axion-ia.com`.
- Apple Pay / Google Pay activation Dashboard (optionnel selon retours B2B).

### V2+ (différé, décision Will requise)

- **Structure juridique tranchée** (FR vs EE) → migration `vatRate` / `vatReverseCharge` / `vatMention` vers valeur définitive.
- **e-invoicing PPF/PDP FR** (réforme 2026-2027) si scénario FR retenu.
- **Stripe Billing subscriptions** pour maintenance récurrente 290 €/mois.
- **GoCardless SEPA** pour grands comptes abonnés.
- **Stripe Tax automatic** (uniquement après tranche juridique).
- **Payment Element embed** (si UX justifie surcoût SAQ-A-EP).
- **Workflow approbation 2-eyes** sur refunds > 5 000 €.
- **Intégration Pennylane / Sage / Cegid** (export auto factures vers PDP candidate).
- **Audit pénétration tier paiement** (ASV trimestriel si bascule SAQ-A-EP).
- **Qualiopi / OPCO** financement intervention (HORS V1 absolu).

---

## 13. Top 10 risques (ordonné)

> Ordre = combinaison probabilité × impact business + impact légal.

1. 🚨 **Replay webhook attack** sans table outbox → double-confirmation booking, double-facture, double-cadrage. **Impact maximal**. Mitigation = Reco #2 (StripeWebhookEvent unique).
2. 🚨 **Numérotation `AXION-2026-NNNN` non atomique** → trous de séquence, audit FR/EE refusé (CGI 242 nonies A + Raamatupidamise seadus). Mitigation = Reco #5 (Postgres sequence / FOR UPDATE).
3. 🚨 **Dispute non gérée** (`charge.dispute.created`) → perte automatique sans evidence soumis sous 7-21j → débit complet remboursé client + frais 15 €. Mitigation = state machine `disputed` + Telegram + workflow evidence (cf. §5.5 #3).
4. ⚠️ **Webhook out-of-order** → state machine corrompue (`refunded → succeeded` interdit mais possible si pas de guard). Mitigation = `event.created` ordering + transition guards défensives.
5. ⚠️ **3DS échec** sans libération slot → bloque le calendrier (slot reserved infini). Mitigation = `option-expiration-worker` étendu sur sessions Checkout expirées.
6. ⚠️ **Currency mismatch** EUR/USD (Apple Pay carte non-EU fallback) → réconciliation impossible. Mitigation = D22 strict + check webhook.
7. ⚠️ **Refund partiel sans avoir** → facture initiale reste `paid` montant complet, comptabilité fausse. Mitigation = émission auto `credit_note` (Reco #3 + state machine).
8. ⚠️ **RGPD erase impossible** sans pseudonymisation Invoice (conservation 10 ans D30 vs droit à l'effacement art. 17.3.b). Mitigation = Reco #11 (pseudonymize, pas hard delete).
9. ⚠️ **DPA Stripe non signé** avant `LIVE_MODE` → non-conformité art. 28 RGPD dès la première transaction réelle. Mitigation = Reco #7 (action Will Dashboard).
10. ⚠️ **TVA-agnostique mal implémentée** : valeurs en dur 20 % au lieu de paramétrables → migration FR↔EE = `ALTER TABLE` rétroactif catastrophique. Mitigation = Reco #3 colonnes `vatRate` / `vatReverseCharge` / `vatMention` par facture dès le V1, pas de raccourci.

---

**Fin Agent 4** — `agent-04-paiement-stripe.md` — Auditeur : Claude Opus 4.7 (1M context) — 2026-05-12.
