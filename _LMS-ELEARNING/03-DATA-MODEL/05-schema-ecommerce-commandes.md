# Data model — E-commerce & commandes e-learning (gated)

> Schéma Prisma des **commandes** e-learning : `ElearningOrder` / `ElearningOrderItem`, **sièges entreprise** (`ElearningSeat`), **coupons** (`ElearningCoupon` / `ElearningCouponRedemption`), réutilisation de l'infra `Invoice` / `Payment` / `Refund` existante, et **lien commande → octroi d'accès** (`ElearningEnrollment`).
>
> **Cadre figé** : ADR-0004 (Stripe gardé éteint, MVP = virement + octroi manuel), ADR-0002 (multi-tenant conçu maintenant / livré V2), ADR-0008 (migrations additives). Le paiement CB **n'est pas branché au MVP** : tout est `STRIPE_ENABLED`-ready mais dormant.
>
> **Conventions du repo** : UUID en `id`, `@map` snake_case, enums Prisma, index sur FK + colonnes filtrées, `createdAt`/`updatedAt`. Code sous `src/server/elearning/**` (ADR-0007). Montants **toujours en centimes entiers** (`*Cents Int`), devise `EUR` (cohérent `Payment.amountCents` / `Invoice.amountTtcCents`).

---

## 1. Vue d'ensemble

```
ElearningCoupon (code promo, %/€, plafonds, validité)
        │  (appliqué à)
        ▼
ElearningOrder ── acheteur : Trainee (particulier) OU Client (entreprise B2B)
   │   │  └─ ElearningCouponRedemption (trace d'usage idempotente)
   │   │
   │   └─ ElearningOrderItem[]  (1 ligne = 1 cours × quantité de sièges)
   │            │
   │            └─ ElearningSeat[]  (N sièges → bénéficiaires → ElearningEnrollment)
   │
   ├─ Invoice    (RÉUTILISÉ, via orderId ; numérotation AXION-2026-NNNN)
   ├─ Payment    (RÉUTILISÉ, via orderId ; virement manuel MVP / Stripe V1)
   └─ Refund     (RÉUTILISÉ tel quel, rattaché à Invoice+Payment)
```

**Deux parcours d'achat**, un seul modèle :

1. **Particulier / vente directe** : un `ElearningOrder` avec `acheteurTraineeId`, 1 item × 1 siège (l'acheteur est le bénéficiaire). MVP = virement → octroi manuel admin.
2. **Pack entreprise (sièges)** : un `ElearningOrder` avec `clientId` (CRM `Client`), 1+ items × N sièges. L'entreprise paie (virement / OPCO), l'admin Axion-IA ouvre les accès en masse (import CSV des bénéficiaires → `ElearningSeat` → `ElearningEnrollment`). L'**auto-gestion par l'entreprise** des sièges = **V2** (multi-tenant, ADR-0002) ; le data model est posé dès maintenant.

> **Octroi ≠ commande.** Une commande peut exister sans aucun accès ouvert (paiement en attente). L'**octroi** est l'acte qui crée les `ElearningEnrollment` (cf. doc 02). Une commande **gratuite** ou **offerte** (octroi sans paiement) est modélisée par `paymentMode = gratuit` / `octroi_manuel` avec `totalTtcCents = 0` — aucun `Invoice`/`Payment` requis.

---

## 2. EXISTANT réutilisé (ne pas dupliquer)

| Brique                   | Modèle / fichier                                                                                                               | Réutilisation pour l'e-commerce e-learning                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Facturation séquentielle | `Invoice` (schema.prisma ~1695), format `AXION-2026-NNNN`, advisory-lock atomique, `legalSnapshot`, archivage 10 ans           | **Réutilisé** : on ajoute `orderId String?` (FK `ElearningOrder`) + on **relâche** `bookingId` en nullable (voir §7). Facture exonérée TVA 261-4-4° CGI réutilisable pour la FOAD. |
| Encaissement             | `Payment` (~1644), enum `PaymentProvider {stripe, manual_wire, manual_check, manual_cash}`, `PaymentStatus`, `recordedByAdmin` | **Réutilisé** : ajout `orderId String?`. MVP = `provider = manual_wire`, saisie admin. V1 Stripe = `provider = stripe` (flag).                                                     |
| Remboursement            | `Refund` (~1761) rattaché à `Invoice`+`Payment`                                                                                | **Réutilisé tel quel** (passe par Invoice/Payment, donc transitivement par l'Order). Aucun champ ajouté.                                                                           |
| Idempotence webhook      | `StripeWebhookEvent` (~1793)                                                                                                   | **Réutilisé tel quel** quand `STRIPE_ENABLED=true` (V1).                                                                                                                           |
| Tarifs SSOT              | `src/content/pricing.ts`, `pricing-tokens.ts`                                                                                  | Source des `*PriceHtCents` snapshotés dans `ElearningOrderItem`. **Aucun prix en dur** ailleurs.                                                                                   |
| Client B2B               | `Client` (~4890, SIRET/OPCO)                                                                                                   | Acheteur entreprise (`ElearningOrder.clientId`). Pas multi-tenant (ADR-0002).                                                                                                      |
| Apprenant                | `Trainee` (~5274, PII chiffrées)                                                                                               | Acheteur particulier + bénéficiaire de siège. `passwordHash` ajouté par doc 04 (auth).                                                                                             |
| Flag CB                  | `src/env.ts` ~105 `STRIPE_ENABLED` (défaut false)                                                                              | Gate du parcours CB. MVP : false → virement only.                                                                                                                                  |
| Stockage                 | `src/lib/r2-storage.ts` (`invoicePdfKey`, `uploadToR2`, `getSignedUrlR2`)                                                      | PDF facture déjà géré par le flux Invoice existant.                                                                                                                                |
| Octroi                   | `ElearningEnrollment` (doc 02 — **NEUF**)                                                                                      | Cible du lien commande → accès.                                                                                                                                                    |
| Cours                    | `ElearningCourse` (doc 01), `vendableSeul`, `ownerClientId`                                                                    | Objet vendu (`ElearningOrderItem.courseId`).                                                                                                                                       |

> **Note de typage FK.** Les tables legacy (`Invoice`, `Payment`, `Client`, `Trainee`, `AdminUser`) utilisent `@db.Uuid`. Toute FK pointant vers elles **doit** porter `@db.Uuid` (sinon Prisma refuse la relation). Les FK internes au domaine e-learning (vers `ElearningCourse`, etc.) suivent la convention de la doc 01 (UUID texte, sans `@db.Uuid`). Les `id` des nouveaux modèles e-commerce sont alignés sur la doc 01 (`String @default(uuid())`, UUID texte).

---

## 3. Enums (NEUF)

```prisma
/// Cycle de vie d'une commande e-learning.
/// brouillon → en_attente_paiement → payee → octroyee (accès ouverts).
/// gratuit/octroi_manuel : peut aller direct en `octroyee` sans paiement.
enum ElearningOrderStatut {
  brouillon              // panier / devis non confirmé (admin ou futur tunnel)
  en_attente_paiement    // confirmée, attend virement (MVP) ou Checkout (V1)
  partiellement_payee    // acompte reçu (échéancier B2B), accès non encore ouverts
  payee                  // soldée, prête à octroyer
  octroyee               // accès e-learning ouverts (≥1 ElearningEnrollment créé)
  annulee                // annulée avant octroi (aucun accès ouvert)
  remboursee             // remboursée (Refund) — accès révoqués
  expiree                // virement jamais reçu après délai → auto-annulation
}

/// Mode de règlement décidé à la commande. Distinct de `Payment.provider`
/// (qui trace le mouvement réel). Pilote le parcours.
enum ElearningOrderPaymentMode {
  virement       // MVP par défaut — virement bancaire + octroi manuel admin
  stripe         // V1, gated STRIPE_ENABLED — paiement CB en ligne
  opco           // prise en charge OPCO (subrogation), virement OPCO
  gratuit        // offert / interne (totalTtcCents = 0, pas d'Invoice)
  octroi_manuel  // accès ouvert sans transaction (geste co., test, partenaire)
}

/// Nature d'une ligne de commande.
enum ElearningOrderItemType {
  cours          // un ElearningCourse (vendableSeul) — quantite = nb de sièges
  pack           // bundle de plusieurs cours (V1) — détail via metadata
}

/// État d'un siège entreprise (place achetée, attribuable à un bénéficiaire).
enum ElearningSeatStatut {
  disponible     // payé/octroyé mais pas encore attribué à une personne
  invite         // bénéficiaire renseigné, invitation/magic-link envoyé
  attribue       // bénéficiaire actif → ElearningEnrollment créé
  revoque        // siège retiré (réaffectable) — l'enrollment est suspendu
}

/// Type de réduction d'un coupon.
enum ElearningCouponType {
  pourcentage    // -X % (valeur 1..100)
  montant_fixe   // -X centimes (sur le total HT)
}

/// Statut d'un coupon (cycle de vie indépendant de la validité calendaire).
enum ElearningCouponStatut {
  actif
  suspendu       // désactivé manuellement, redemptions existantes conservées
  epuise         // quota global atteint
  expire         // dateFin dépassée
}
```

---

## 4. Modèle `ElearningOrder` (NEUF)

```prisma
model ElearningOrder {
  id            String                 @id @default(uuid())
  /// Référence lisible séquentielle, distincte des factures (ex. CMD-2026-000123).
  /// Générée par un compteur atomique (advisory lock, même pattern que Invoice.number).
  reference     String                 @unique @db.VarChar(40)

  statut        ElearningOrderStatut   @default(brouillon)
  paymentMode   ElearningOrderPaymentMode @default(virement) @map("payment_mode")

  // ── Acheteur : EXACTEMENT l'un des deux (contrainte applicative + CHECK SQL) ──
  /// Achat particulier / vente directe.
  acheteurTraineeId String?            @map("acheteur_trainee_id") @db.Uuid
  acheteurTrainee   Trainee?           @relation("TraineeElearningOrders", fields: [acheteurTraineeId], references: [id], onDelete: SetNull)
  /// Achat entreprise (CRM Client). Pack de sièges. SetNull = on garde l'historique.
  clientId          String?            @map("client_id") @db.Uuid
  client            Client?            @relation("ClientElearningOrders", fields: [clientId], references: [id], onDelete: SetNull)

  // ── Identité de facturation (snapshot, copiée vers Invoice.payer* à l'émission) ──
  payerName     String?                @map("payer_name") @db.VarChar(300)
  payerEmail    String?                @map("payer_email") @db.Citext
  payerVatNumber String?               @map("payer_vat_number") @db.VarChar(40)
  payerAddress  String?                @map("payer_address") @db.Text
  payerSiret    String?                @map("payer_siret") @db.VarChar(20)
  locale        Locale                 @default(fr)

  // ── Totaux (snapshot, centimes, EUR) — recalculés/figés à la confirmation ──
  /// Somme des lignes HT avant remise.
  subtotalHtCents Int                  @default(0) @map("subtotal_ht_cents")
  /// Remise coupon appliquée (≥0), en centimes HT.
  discountCents   Int                  @default(0) @map("discount_cents")
  totalHtCents    Int                  @default(0) @map("total_ht_cents")
  /// TVA — FOAD exonérée 261-4-4° CGI le plus souvent → 0. Snapshot du taux.
  vatRate         Decimal              @default(0) @map("vat_rate") @db.Decimal(5, 2)
  vatCents        Int                  @default(0) @map("vat_cents")
  totalTtcCents   Int                  @default(0) @map("total_ttc_cents")
  currency        String               @default("EUR") @db.VarChar(3)

  // ── Coupon (FK + snapshot du code pour traçabilité même si coupon supprimé) ──
  couponId        String?              @map("coupon_id")
  coupon          ElearningCoupon?     @relation(fields: [couponId], references: [id], onDelete: SetNull)
  couponCodeSnapshot String?           @map("coupon_code_snapshot") @db.VarChar(60)

  // ── Réutilisation infra paiement existante (relations inverses) ──
  /// Factures rattachées (1 simple, ou acompte+solde si échéancier B2B).
  invoices        Invoice[]            @relation("InvoiceElearningOrder")
  /// Paiements (virement manuel MVP, Stripe V1). Refund passe par Payment/Invoice.
  payments        Payment[]            @relation("PaymentElearningOrder")

  // ── Conformité OPCO (subrogation) — réutilise le vocabulaire Qualiopi existant ──
  /// Numéro de dossier / accord de prise en charge OPCO (si paymentMode=opco).
  opcoDossierRef  String?              @map("opco_dossier_ref") @db.VarChar(120)

  // ── Lignes & sièges ──
  items           ElearningOrderItem[]
  seats           ElearningSeat[]
  redemptions     ElearningCouponRedemption[]

  // ── Traçabilité / cycle de vie ──
  confirmedAt     DateTime?            @map("confirmed_at")    // passage brouillon → en_attente
  paidAt          DateTime?            @map("paid_at")         // soldée
  grantedAt       DateTime?            @map("granted_at")      // octroi effectué
  cancelledAt     DateTime?            @map("cancelled_at")
  /// Date limite de réception du virement (auto-expiration par worker).
  paymentDueAt    DateTime?            @map("payment_due_at")
  /// Admin ayant créé/validé la commande (octroi manuel, devis).
  createdByAdminId String?             @map("created_by_admin_id") @db.Uuid
  createdByAdmin   AdminUser?          @relation("AdminElearningOrders", fields: [createdByAdminId], references: [id], onDelete: SetNull)
  internalNotes   String?              @map("internal_notes") @db.Text

  createdAt       DateTime             @default(now()) @map("created_at")
  updatedAt       DateTime             @updatedAt @map("updated_at")

  @@index([statut])
  @@index([paymentMode])
  @@index([clientId])
  @@index([acheteurTraineeId])
  @@index([couponId])
  @@index([paymentDueAt])
  @@index([statut, paymentDueAt])  // worker d'expiration
  @@map("elearning_orders")
}
```

**Règles d'intégrité (contrainte SQL ajoutée par la migration, cf. §7) :**

- `CHECK (acheteur_trainee_id IS NOT NULL OR client_id IS NOT NULL)` — toute commande a un acheteur.
- `CHECK (total_ttc_cents >= 0 AND discount_cents >= 0)` — pas de montant négatif.
- Cohérence totaux validée applicativement (service `order-pricing.ts`), pas par CHECK (calcul sur lignes).

---

## 5. Modèle `ElearningOrderItem` (NEUF)

Une ligne = un cours acheté avec une **quantité de sièges**. Le **prix est snapshoté** (immuable même si `pricing.ts` change ensuite).

```prisma
model ElearningOrderItem {
  id            String                 @id @default(uuid())
  orderId       String                 @map("order_id")
  order         ElearningOrder         @relation(fields: [orderId], references: [id], onDelete: Cascade)

  type          ElearningOrderItemType @default(cours)

  /// Cours vendu. SetNull = on garde la ligne (preuve comptable) même si le
  /// cours est archivé/supprimé ; le libellé est snapshoté ci-dessous.
  courseId      String?                @map("course_id")
  course        ElearningCourse?       @relation(fields: [courseId], references: [id], onDelete: SetNull)

  // ── Snapshot libellé/prix (immuable) ──
  libelle       String                 @db.VarChar(300)   // ex. "Maîtriser l'IA au quotidien"
  /// Prix unitaire HT par siège, snapshot pricing.ts au moment de la commande.
  unitPriceHtCents Int                 @map("unit_price_ht_cents")
  /// Nombre de sièges achetés sur cette ligne (≥1). 1 = achat individuel.
  quantite      Int                    @default(1)
  /// Sous-total ligne HT = unitPriceHtCents × quantite (avant remise commande).
  lineHtCents   Int                    @map("line_ht_cents")

  /// Durée d'accès en jours à partir de l'octroi (null = illimité).
  /// Pilote ElearningEnrollment.expiresAt (cf. doc 02).
  accessDurationDays Int?              @map("access_duration_days")

  /// Métadonnées libres (composition d'un pack, options). JSON.
  metadata      Json?

  seats         ElearningSeat[]

  createdAt     DateTime               @default(now()) @map("created_at")
  updatedAt     DateTime               @updatedAt @map("updated_at")

  @@index([orderId])
  @@index([courseId])
  @@map("elearning_order_items")
}
```

> **Quantité ↔ sièges.** `quantite` est la **vérité de comptage payé**. À l'octroi, on matérialise `quantite` lignes `ElearningSeat` (une par place). L'achat individuel = `quantite = 1`, un seul siège auto-attribué à l'acheteur.

---

## 6. Modèle `ElearningSeat` (NEUF — siège entreprise)

Le **siège** est la place achetée, attribuable à un bénéficiaire, qui devient un `ElearningEnrollment` une fois attribué. C'est la pièce qui rend le **pack entreprise** opérable dès le MVP (octroi/import CSV par l'admin Axion-IA) et **réaffectable** (turnover salarié) sans re-facturer.

```prisma
model ElearningSeat {
  id            String              @id @default(uuid())
  orderId       String              @map("order_id")
  order         ElearningOrder      @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderItemId   String              @map("order_item_id")
  orderItem     ElearningOrderItem  @relation(fields: [orderItemId], references: [id], onDelete: Cascade)

  /// Cours du siège (dénormalisé depuis orderItem pour requêtes directes).
  courseId      String              @map("course_id")
  course        ElearningCourse     @relation(fields: [courseId], references: [id], onDelete: Restrict)

  statut        ElearningSeatStatut @default(disponible)

  // ── Bénéficiaire ──
  /// Email du bénéficiaire (clé d'invitation magic-link). citext.
  beneficiaireEmail String?         @map("beneficiaire_email") @db.Citext
  beneficiaireNom   String?         @map("beneficiaire_nom") @db.VarChar(200)
  /// Lien vers le Trainee une fois le compte apprenant résolu (auth, doc 04).
  beneficiaireTraineeId String?     @map("beneficiaire_trainee_id") @db.Uuid
  beneficiaireTrainee   Trainee?    @relation("TraineeElearningSeats", fields: [beneficiaireTraineeId], references: [id], onDelete: SetNull)

  /// L'accès matérialisé (créé à l'attribution). cf. doc 02.
  enrollmentId  String?             @unique @map("enrollment_id")
  enrollment    ElearningEnrollment? @relation(fields: [enrollmentId], references: [id], onDelete: SetNull)

  invitedAt     DateTime?           @map("invited_at")
  attribuedAt   DateTime?           @map("attribued_at")
  revokedAt     DateTime?           @map("revoked_at")

  createdAt     DateTime            @default(now()) @map("created_at")
  updatedAt     DateTime            @updatedAt @map("updated_at")

  /// Un même email ne peut occuper deux sièges du même cours dans une commande.
  @@unique([orderId, courseId, beneficiaireEmail])
  @@index([orderId])
  @@index([orderItemId])
  @@index([courseId])
  @@index([statut])
  @@index([beneficiaireEmail])
  @@index([beneficiaireTraineeId])
  @@map("elearning_seats")
}
```

> **Octroi (granting).** Le service `src/server/elearning/orders/grant-access.ts` :
>
> 1. vérifie `order.statut ∈ {payee, octroyee}` (ou `paymentMode ∈ {gratuit, octroi_manuel}`) ;
> 2. pour chaque siège `disponible/invite` avec bénéficiaire → crée `ElearningEnrollment` (doc 02), passe le siège en `attribue`, calcule `expiresAt = now + accessDurationDays` ;
> 3. envoie le magic-link d'accès (réutilise le mécanisme `PortailAcces` étendu, doc 04 ; email Nodemailer template `elearning-acces-octroye.tsx`) ;
> 4. passe l'order en `octroyee`, set `grantedAt`.
>    La **révocation** (`revoque`) suspend l'`ElearningEnrollment` mais conserve la trace (preuve FOAD + comptable).

---

## 7. Réutilisation `Invoice` / `Payment` — modifications additives requises

`Invoice` et `Payment` sont aujourd'hui **rattachés à `Booking`** (`bookingId` **NOT NULL**, `onDelete: Restrict`). Pour facturer une commande e-learning **sans** créer de `Booking` factice, on applique deux changements **additifs et non destructifs** (conformes ADR-0008) :

> **⚖️ Arbitrage vs `01-VISION-PERIMETRE/modele-economique-tarification.md` §6 (divergence assumée).** Le doc économique recommandait de réutiliser **`FactureFormation`** (monde « Organisme de formation », déjà découplé de `TrainingSession`) plutôt que `Invoice` (couplé `Booking`), pour éviter de relâcher `Invoice.bookingId`. **Ce doc retient l'option `Invoice`/`Payment`/`Refund`** (mission e-commerce explicite : « réutilisation Invoice/Payment/Refund »), pour trois raisons : (1) `Invoice` porte déjà la **numérotation séquentielle atomique** `AXION-2026-NNNN`, le `legalSnapshot` immuable, l'archivage 10 ans (`archivedUntil`) et le PDF (`invoicePdfKey`) — `FactureFormation` n'a ni numérotation atomique propre ni `legalSnapshot`/avoir self-FK ; (2) `Payment`/`Refund` fournissent l'**encaissement + remboursement** complets (providers, idempotence webhook Stripe) que `FactureFormation` n'a pas ; (3) la relaxation `bookingId → nullable` + `CHECK (booking_id IS NOT NULL OR order_id IS NOT NULL)` est **non destructive** (ADR-0008) et garde un seul moteur de facturation pour toute la plateforme. **Conséquence TVA :** l'exonération FPC 261-4-4° CGI est portée par `Invoice.vatRate`/`vatReverseCharge`/`vatMention` (snapshot `legalSnapshot`), pas par le `regimeTva` de `FactureFormation`. Si une décision ultérieure rebascule sur `FactureFormation`, elle reste **additive** (FK `FactureFormation.elearningOrderId` au lieu de `Invoice.orderId`) — à trancher dans `06-strategie-migrations.md`.

### 7.1 `Invoice` — ajout `orderId` + relâche `bookingId`

```prisma
model Invoice {
  // ... champs existants inchangés ...

  // CHANGEMENT 1 (additif) : bookingId devient nullable.
  // ALTER COLUMN ... DROP NOT NULL = relâchement de contrainte = non destructif.
  bookingId   String?   @map("booking_id") @db.Uuid
  booking     Booking?  @relation(fields: [bookingId], references: [id], onDelete: Restrict)

  // CHANGEMENT 2 (additif) : lien optionnel vers une commande e-learning.
  orderId     String?   @map("order_id") @db.Uuid
  order       ElearningOrder? @relation("InvoiceElearningOrder", fields: [orderId], references: [id], onDelete: SetNull)

  // ... reste inchangé (number, payer*, legalSnapshot, archivedUntil, etc.) ...

  @@index([orderId])  // ajout
  // index existants conservés
}
```

> ⚠️ **Typage** : `ElearningOrder.id` est un UUID **texte** (convention doc 01). Pour que `Invoice.orderId @db.Uuid` pointe dessus, **deux options** :
>
> - **(retenue)** aligner `ElearningOrder.id` (et les autres modèles e-commerce) sur `@db.Uuid` comme le reste du domaine financier — cohérent avec Invoice/Payment/Client. → on remplace `id String @id @default(uuid())` par `id String @id @default(uuid()) @db.Uuid` dans **tous** les modèles e-commerce de ce doc, et les FK internes (`orderId`, `orderItemId`, `courseId`…) reçoivent `@db.Uuid`. (Les FK vers `ElearningCourse`/`ElearningEnrollment` impliquent que ces modèles doc 01/02 soient aussi en `@db.Uuid` — **à arbitrer dans `06-strategie-migrations.md`** ; recommandation : tout le domaine e-learning en `@db.Uuid` pour homogénéité.)
> - (repli) garder `ElearningOrder.id` en texte et **ne pas** typer `Invoice.orderId` en `@db.Uuid` (texte des deux côtés). Refusé car incohérent avec la colonne `invoices` existante.

**Contrainte d'intégrité ajoutée** (migration SQL) :

```sql
ALTER TABLE invoices
  ADD CONSTRAINT invoices_booking_or_order_chk
  CHECK (booking_id IS NOT NULL OR order_id IS NOT NULL);
```

→ toute facture est rattachée **soit** à un booking (présentiel/live), **soit** à une commande e-learning. La numérotation séquentielle, le `legalSnapshot`, l'archivage 10 ans et le PDF (`invoicePdfKey`) restent **inchangés et mutualisés**.

### 7.2 `Payment` — ajout `orderId` + relâche `bookingId`

```prisma
model Payment {
  // ... champs existants inchangés ...

  bookingId   String?   @map("booking_id") @db.Uuid     // relâché nullable (additif)
  booking     Booking?  @relation(fields: [bookingId], references: [id], onDelete: Restrict)

  orderId     String?   @map("order_id") @db.Uuid       // lien commande e-learning
  order       ElearningOrder? @relation("PaymentElearningOrder", fields: [orderId], references: [id], onDelete: SetNull)

  @@index([orderId])
  // enums PaymentProvider/PaymentType/PaymentStatus RÉUTILISÉS tels quels.
  // MVP : provider=manual_wire, type=balance, recordedByAdmin renseigné.
}
```

```sql
ALTER TABLE payments
  ADD CONSTRAINT payments_booking_or_order_chk
  CHECK (booking_id IS NOT NULL OR order_id IS NOT NULL);
```

### 7.3 `Refund` — aucun changement

`Refund` est rattaché à `Invoice` + `Payment`. Comme ceux-ci portent désormais `orderId`, le remboursement d'une commande e-learning passe **sans modification** par le flux `Refund` existant (enum `RefundReason`/`RefundStatus`, `recordedByAdmin`, `stripeRefundId`). Le worker de remboursement repassera l'`ElearningOrder` en `remboursee` et révoquera les sièges/enrollments.

### 7.4 Champs inverses à ajouter aux modèles existants (additif, sans colonne)

```prisma
// model Trainee { ... }
  elearningOrders      ElearningOrder[] @relation("TraineeElearningOrders")
  elearningSeats       ElearningSeat[]  @relation("TraineeElearningSeats")

// model Client { ... }
  elearningOrders      ElearningOrder[] @relation("ClientElearningOrders")

// model AdminUser { ... }
  elearningOrdersCreated ElearningOrder[] @relation("AdminElearningOrders")

// model ElearningCourse { ... }  (doc 01)
  orderItems           ElearningOrderItem[]
  seats                ElearningSeat[]

// model ElearningEnrollment { ... }  (doc 02)
  seat                 ElearningSeat?   // back-relation de ElearningSeat.enrollment
```

---

## 8. Modèle `ElearningCoupon` (NEUF)

```prisma
model ElearningCoupon {
  id            String                @id @default(uuid())  // @db.Uuid si §7.1 retenu
  /// Code saisi par l'acheteur, insensible à la casse. Unique.
  code          String                @unique @db.Citext @db.VarChar(60)
  libelle       String?               @db.VarChar(200)      // usage interne

  type          ElearningCouponType
  /// pourcentage : 1..100. montant_fixe : centimes (>0).
  valeur        Int
  statut        ElearningCouponStatut @default(actif)

  // ── Validité calendaire ──
  dateDebut     DateTime?             @map("date_debut")
  dateFin       DateTime?             @map("date_fin")

  // ── Plafonds d'usage ──
  /// Nombre total d'utilisations autorisées (null = illimité).
  maxRedemptions Int?                 @map("max_redemptions")
  /// Compteur incrémenté atomiquement à chaque redemption (anti-survente).
  usedCount      Int                  @default(0) @map("used_count")
  /// Max par acheteur (email/trainee). null = illimité.
  maxPerBuyer    Int?                 @map("max_per_buyer")
  /// Montant HT minimum de commande pour appliquer (centimes). null = aucun.
  minOrderHtCents Int?                @map("min_order_ht_cents")

  // ── Ciblage (scoping) ──
  /// Restreint à certains cours (null/[] = tous les cours vendables).
  courseIds     Json                  @default("[]") @map("course_ids")
  /// Réservé à un Client entreprise (null = tout public).
  clientId      String?               @map("client_id") @db.Uuid
  client        Client?               @relation("ClientElearningCoupons", fields: [clientId], references: [id], onDelete: SetNull)

  createdByAdminId String?            @map("created_by_admin_id") @db.Uuid
  createdByAdmin   AdminUser?         @relation("AdminElearningCoupons", fields: [createdByAdminId], references: [id], onDelete: SetNull)

  orders        ElearningOrder[]
  redemptions   ElearningCouponRedemption[]

  createdAt     DateTime              @default(now()) @map("created_at")
  updatedAt     DateTime              @updatedAt @map("updated_at")

  @@index([statut])
  @@index([code])
  @@index([clientId])
  @@index([dateDebut, dateFin])
  @@map("elearning_coupons")
}
```

**Validation (service `src/server/elearning/orders/coupon.ts`)** — vérifie dans l'ordre : `statut=actif` → fenêtre `dateDebut/dateFin` → `usedCount < maxRedemptions` → `maxPerBuyer` (compte redemptions de l'acheteur) → `minOrderHtCents` → ciblage `courseIds`/`clientId`. L'incrément de `usedCount` se fait **dans la même transaction** que la création de la redemption (`UPDATE ... SET used_count = used_count + 1 WHERE id = ? AND (max_redemptions IS NULL OR used_count < max_redemptions)` → `rowCount=0` = épuisé, transaction annulée).

---

## 9. Modèle `ElearningCouponRedemption` (NEUF — trace idempotente)

```prisma
model ElearningCouponRedemption {
  id          String          @id @default(uuid())  // @db.Uuid si §7.1
  couponId    String          @map("coupon_id")
  coupon      ElearningCoupon @relation(fields: [couponId], references: [id], onDelete: Cascade)
  orderId     String          @map("order_id")
  order       ElearningOrder  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  /// Acheteur (pour le quota maxPerBuyer). L'un des deux selon le parcours.
  traineeId   String?         @map("trainee_id") @db.Uuid
  trainee     Trainee?        @relation("TraineeCouponRedemptions", fields: [traineeId], references: [id], onDelete: SetNull)
  clientId    String?         @map("client_id") @db.Uuid

  /// Remise réellement appliquée (centimes HT) — snapshot.
  discountCents Int           @map("discount_cents")
  createdAt   DateTime        @default(now()) @map("created_at")

  /// Idempotence : un coupon une seule fois par commande.
  @@unique([couponId, orderId])
  @@index([couponId])
  @@index([orderId])
  @@index([traineeId])
  @@map("elearning_coupon_redemptions")
}
```

> Champs inverses additifs : `Trainee.couponRedemptions ElearningCouponRedemption[] @relation("TraineeCouponRedemptions")`, `Client.elearningCoupons ElearningCoupon[] @relation("ClientElearningCoupons")`, `AdminUser.elearningCoupons ElearningCoupon[] @relation("AdminElearningCoupons")`.

---

## 10. Cycles de vie (machine à états)

### 10.1 Parcours MVP — virement + octroi manuel

```
[admin crée commande]            → brouillon
  confirmer (génère Invoice)     → en_attente_paiement   (paymentDueAt = +14j)
  admin enregistre Payment wire  → payee  (paidAt)        [si partiel → partiellement_payee]
  admin "Ouvrir les accès"       → octroyee (grantedAt)   → ElearningEnrollment(s) créés
  ── virement jamais reçu ──     → expiree (worker)       (aucun accès, Invoice → void/avoir)
```

### 10.2 Parcours gratuit / offert

```
[admin "Offrir l'accès"]  paymentMode=gratuit|octroi_manuel, totalTtcCents=0
  → octroyee directement (pas d'Invoice, pas de Payment)
```

### 10.3 Parcours CB (V1, gated `STRIPE_ENABLED=true`)

```
brouillon → (Checkout Session) → en_attente_paiement
  webhook checkout.session.completed (StripeWebhookEvent) → Payment(succeeded) → payee
  → octroi auto (worker) → octroyee
```

### 10.4 Remboursement

```
octroyee → [admin Refund] → Refund(pending→succeeded) → remboursee
  → sièges/enrollments révoqués (statut=revoque, enrollment suspendu)
```

---

## 11. Backend, workers, routes (cartographie — détail dans 04-BACKEND)

| Élément             | Chemin cible                                                                   | Rôle                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services domaine    | `src/server/elearning/orders/order-service.ts`                                 | CRUD commande, calcul totaux (lit `pricing.ts`), transitions d'état                                                                                                                     |
| Pricing commande    | `src/server/elearning/orders/order-pricing.ts`                                 | subtotal → coupon → TVA (exonération FOAD), snapshot lignes                                                                                                                             |
| Coupons             | `src/server/elearning/orders/coupon.ts`                                        | validation + redemption transactionnelle                                                                                                                                                |
| Octroi              | `src/server/elearning/orders/grant-access.ts`                                  | sièges → `ElearningEnrollment` + invitations (doc 02/04)                                                                                                                                |
| Facturation         | réutilise `src/server/qualiopi/.../invoice*` (numérotation atomique existante) | `Invoice` avec `orderId` au lieu de `bookingId`                                                                                                                                         |
| Server Actions      | `src/server/elearning/orders/actions.ts`                                       | `createElearningOrder`, `confirmOrder`, `recordWirefromAdmin`, `grantOrderAccess`, `cancelOrder`, `applyCoupon`, `importSeatsCsv` — gardées par `requireAdminWrite` (RBAC `_guards.ts`) |
| Worker expiration   | `src/server/queue/workers/elearning-order-expiry-worker.ts`                    | passe `en_attente_paiement` → `expiree` après `paymentDueAt` ; relances email J+3/J+7                                                                                                   |
| Worker octroi (V1)  | `src/server/queue/workers/elearning-grant-worker.ts`                           | octroi auto post-paiement Stripe                                                                                                                                                        |
| Import CSV sièges   | `src/server/elearning/orders/import-seats.ts` + action `importSeatsCsv`        | parse CSV (email,nom) → `ElearningSeat` + invitations en masse                                                                                                                          |
| Admin UI            | `src/app/[locale]/(admin)/[adminPrefix]/elearning/commandes/**`                | liste/détail commandes, bouton « Ouvrir les accès », import CSV, coupons                                                                                                                |
| Webhook Stripe (V1) | route existante `Payment`/`StripeWebhookEvent` étendue pour `orderId`          | gated `STRIPE_ENABLED`                                                                                                                                                                  |

> **Admin nav** : ajouter une section `elearning` dans `src/lib/admin-nav.ts` (sous-entrées « Commandes », « Coupons », « Sièges entreprise ») — composant monté = `AdminSidebarNav.tsx`. UI via `AdminPageShell` / `AdminTable` / `AdminBadge`.

---

## 12. Conformité & garde-fous

- **TVA / exonération FOAD** : la formation professionnelle est exonérée TVA (art. 261-4-4° a CGI) sous condition d'attestation ; `vatRate` snapshoté (0 par défaut FOAD, paramétrable par cours/commande). Le `legalSnapshot` de l'`Invoice` réutilise le mécanisme existant (mention TVA + statut juridique au moment d'émission).
- **OPCO** : `paymentMode=opco` + `opcoDossierRef`. Pour le paiement, l'OPCO exige facture + relevé de dépenses + **certificat de réalisation** (produit par le LMS, doc certificats). La commande conserve la trace de subrogation.
- **CPF/EDOF** : **hors périmètre commande** (ADR-0003). Aucun champ CPF ici ; le financement CPF transitera par EDOF (flag `EDOF_ENABLED`), pas par `ElearningOrder`, tant que pas de certification RNCP/RS.
- **Stripe éteint (ADR-0004)** : tout le code CB est gated `STRIPE_ENABLED=false`. Le MVP **ne crée jamais** de Checkout. Les colonnes `provider*` de `Payment` restent nullables/inutilisées en virement.
- **Conservation** : factures archivées 10 ans (`Invoice.archivedUntil`, mécanisme existant). Les `ElearningOrder`/`ElearningSeat` (preuves d'octroi/réalisation) suivent la politique de conservation FOAD (cf. `08-CONFORMITE/05-rgpd-conservation-preuves.md`).
- **Idempotence** : `reference` unique (advisory lock), `ElearningCouponRedemption @@unique([couponId, orderId])`, incrément `usedCount` conditionnel transactionnel, `StripeWebhookEvent.stripeEventId` unique (V1).
- **RBAC** : toutes les mutations commande/coupon/octroi exigent `requireAdminWrite`/`requireAdminPublish` (`src/server/actions/knowledge/_guards.ts`, rôles `super_admin`/`admin`). Lecture reporting = `requireAdminRead`.

---

## 13. Récapitulatif des changements de migration (additifs, ADR-0008)

**Nouvelles tables** : `elearning_orders`, `elearning_order_items`, `elearning_seats`, `elearning_coupons`, `elearning_coupon_redemptions`.
**Nouveaux enums** : `ElearningOrderStatut`, `ElearningOrderPaymentMode`, `ElearningOrderItemType`, `ElearningSeatStatut`, `ElearningCouponType`, `ElearningCouponStatut`.
**Colonnes ajoutées (nullable) sur tables existantes** : `invoices.order_id`, `payments.order_id`.
**Contraintes relâchées (non destructif)** : `invoices.booking_id` et `payments.booking_id` → `DROP NOT NULL`.
**CHECK ajoutés** : `invoices_booking_or_order_chk`, `payments_booking_or_order_chk`, `elearning_orders` (acheteur présent, montants ≥ 0).
**Relations inverses** (sans colonne) sur `Trainee`, `Client`, `AdminUser`, `ElearningCourse`, `ElearningEnrollment`.
**Aucun DROP de table/colonne. Aucune donnée existante modifiée.**

---

## Liens

- `01-schema-cours-modules-lecons.md` — `ElearningCourse` (`vendableSeul`, `ownerClientId`), objet vendu
- `02-schema-progression-tracking.md` — `ElearningEnrollment` (cible de l'octroi via `ElearningSeat.enrollment`)
- `03-schema-quiz-evaluations.md` — moteur quiz (sans impact e-commerce)
- `04-schema-comptes-acces-auth.md` — identité apprenant (`Trainee.passwordHash`), magic-link d'invitation des sièges
- `06-strategie-migrations.md` — arbitrage `@db.Uuid` vs UUID texte du domaine e-learning, ordre des migrations
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0002 (multi-tenant V2), ADR-0004 (Stripe éteint), ADR-0008 (additif)
- `04-BACKEND/06-import-masse-provisioning.md` — import CSV sièges entreprise
- `06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md` — UI octroi / sièges / coupons
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — conservation des preuves de commande/octroi
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — MVP (virement) vs V1 (CB Stripe) vs V2 (multi-tenant)
