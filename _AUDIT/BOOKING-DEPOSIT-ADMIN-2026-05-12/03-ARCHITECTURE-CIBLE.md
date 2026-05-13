# 03 — Architecture cible V1 · Audit Booking Deposit + Admin 2026

> Audit Axion-IA — **cabinet IA opérationnel B2B premium** — V2.1 LIVE — architecture cible papier post-review Will 2026-05-12.

**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742`
**Branch** : `main`
**Date** : 2026-05-12 (réécriture intégrale post-review Will)
**Mode** : 🚫 AUDIT-ONLY · papier uniquement, **aucun fichier source créé**.
**Phase** : 4/6 — Architecture cible V1 (déclinaison §5 du prompt master `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md`).
**Doctrine** : Code = SSOT · TVA-agnostique · Qualiopi/OPCO/PDP/régime fiscal détaillé HORS V1 · décision structure juridique FR vs EE NON tranchée.

> Ce document décrit **sur papier** l'architecture cible V1 deposit-gated.
> Il consolide :
>
> - 00 `REALITY-CHECK.md` (présence/absence tables, actions, templates).
> - 01 `INVENTAIRE-E2E.md` (flux visiteur + admin + cycle de vie).
> - Agent 3 (state machine ~23 valeurs effectives V1 incl. `awaiting_admin_validation` D51).
> - Agent 4 (Stripe + idempotence webhook + PCI-DSS SAQ-A — Customer Portal retiré V1 D56).
> - Agent 6 (**~21 jobs queue cibles V1** — incl. 2 crons D48 parcours B + 2 crons D52 délais configurables).
> - Agent 7 (**~30 templates email cibles** — incl. 5 parcours B).
> - Agent 10 (CadrageMeeting + DocuSeal Quote/Contract + OnboardingDoc).
> - Agent 11 (CGV TVA-agnostique + sous-processeurs + archivage 10 ans).
>
> Aucune ligne de TS, SQL, Prisma, JSX n'est livrée — uniquement la spec.

---

## Préambule — Vision V1 finale (review Will 2026-05-12)

Cette réécriture **annule et remplace** la version précédente du fichier qui reflétait une vision initiale plus naïve (Yousign payant, devis 100 % auto, option 48h universelle, acompte fixe 30 %, etc.). La doctrine V1 retenue après review interactive avec Will le 2026-05-12 est :

### Changements majeurs vs version précédente

1. **Yousign → DocuSeal self-hosted** (gratuit, eIDAS-SES, Docker sur Hetzner CPX32). Aucun coût SaaS signature.
2. **Devis NON automatique 100 %** : `Quote` est **semi-auto** — formulaire admin pré-rempli depuis `PricingConfig`, Will modifie/valide, génère PDF, envoie via DocuSeal.
3. **Contrat auto OU avec preview admin** : seuil 1 500 € HT — au-dessous = envoi auto direct, au-dessus = preview édition obligatoire (Tiptap).
4. **Option 48h → option durée variable par format** (`PricingConfig.optionDurationDays`).
5. **Acompte fixe → échéanciers configurables** par tranche de ticket (4 profils par défaut) + override admin par booking.
6. **TOUS paiements via Stripe Checkout** mais admin peut enregistrer un **paiement manuel virement/chèque** (`Payment.provider = manual_wire | manual_check`). Pas de monopole Stripe.
7. **Calendrier visiteur 5 statuts** (vs 3 dans version précédente) — **4 visiteur visibles + 1 admin invisible visiteur** : 🟢 Libre · 🟠 Pré-réservée (cliquable, multi-options) · 🟡 Cap atteint (alerte) · 🔴 Validée par Will + ⚫ Bloquée admin (état admin, non affiché côté visiteur).
8. **Multi-options simultanées** : `SiteSetting.maxConcurrentOptionsPerSlot` (défaut 3, configurable). C'est **Will qui valide** une demande, donc pas de course à la signature.
9. **Frais accessoires 3 modes** : `real_costs` (justificatifs) / `flat_rate_by_zone` (0/250/450 €) / `included`. Configurables par format.
10. **Géo-awareness intelligent** : OSM Nominatim + Haversine sur fenêtre 48h, slot 🟡 si distance > 600 km, alerte 300-600 km. Heatmap admin.
11. **Suivi paiements complet** : tableau global + fiche client + relances cron J-7/J+1/J+15/J+30 + audit log + avoirs.
12. **Pricing dynamique** : `PricingConfig` DB modifiable admin → revalidation auto pages publiques (plus de hardcode dans `pricing.ts`).
13. **Pas de Qualiopi / OPCO V1** : tables `TrainingSession`/`Attendance`/`Evaluation`/`Certificate` **non créées** V1. Hooks DB nullable préservés (`Booking.trainingSessionId`, `Invoice.payerType=client` default V1).
14. **Visio cadrage** : lien manuel envoyé par Will (Google Meet / Whereby / Jitsi, choix hors-app V1). Pas d'intégration provider.
15. **Validation calendrier en 2 clics distincts** (D49) : clic 1 "Envoi contrat + demande acompte" (renommage `validateBookingOptionAction` → `sendContractAndDepositRequestAction`, A1) ; clic 2 "Valider sur le calendrier" depuis section dashboard "Prêts à valider" (`validateBookingOnCalendarAction`, A1bis).
16. **Critère bloquant unique = paiement acompte reçu** (D50). Contrat non bloquant — signature physique le jour J si pas signé via DocuSeal.
17. **État intermédiaire `awaiting_admin_validation`** (D51) ajouté à `BookingStatus` entre `contract_payment_sent` et `confirmed`.
18. **Délais d'expiration configurables admin** (D52) : 2 clés `SiteSetting` (`optionExpirationDaysIfNothingReceived` default 5j + `contractSignedWithoutDepositCutoffDays` default 10j) + 2 crons dédiés.
19. **Clause contractuelle de résolution par défaut** D53 dans `ContractTemplate.defaultLegalClauses` (colonne JSONB ajoutée).
20. **Notifications Will = Telegram + console admin UNIQUEMENT** (D54) — pas d'email Will.
21. **Saisie admin obligatoire avant envoi contrat parcours A** (D55) — frais + Tiptap contrat, **PAS de seuil 1 500 € HT**, toujours éditable. Détail §5.11.4.
22. **Customer Portal Stripe RETIRÉ V1** (D56) — factures envoyées par email PJ uniquement. Hook V2+ préservé via `Payment.providerCustomerId`.
23. **NPS J+1 RETIRÉ V1** (D57) — pas de cron `booking-j1-debrief`, pas de template debrief.
24. **Onboarding docs RETIRÉ V1** (D58) — V1.5+ formulaire structuré, hors-app V1.
25. **Échec paiement échéance 2/3 traité** (D59) — états `installment_overdue` + `disputed` + cron escalade J+3/J+15/J+30/J+45 + 3 templates.
26. **Reschedule admin drag-drop matérialisé** (D60) — Server Action `rescheduleBookingByAdminAction` + email auto client + invariants statut.
27. **Suspension booking `paused`** (D61) — statut + colonnes `pausedAt/pausedUntil/pauseReason` + 2 actions + cron `paused-resume-reminder` + 2 templates.
28. **Versioning contrat post-envoi** (D62) — `cancelAndReissueContractAction` (avant signature) + `createContractAddendumAction` (avenant post-signature, contrat signé immuable) + colonne `ContractDocument.version`/`previousVersionId`.
29. **Migration data V0 → V1** (D63) — script `scripts/migrate-bookings-v0-to-v1.ts` obligatoire Sprint X.4 + colonne `Payment.isHistorical`.

### Portée V1

- Booking deposit-gated complet — **2 parcours visiteur (D44)** : A (calendrier `/reserver` → validation Will → trigger AUTO) + B (formulaire `/demande-devis` → négo hors-app → drawer admin unifié → envoi unifié devis + contrat + lien paiement).
- Admin reorg complet (**16 sections** — ajout « Demandes devis » pour parcours B, sidebar nouvelle).
- 4 profils d'échéancier par défaut + override booking-by-booking.
- DocuSeal eIDAS-SES pour devis + contrats.
- **~21 jobs cron au total V1** / **~30 templates V1** (+ ~14 existants V0 = ~44 total) / **~27 Server Actions** (incl. renommage A1 D49 + A1bis D49).
- TVA-agnostique strict (FR vs EE non tranché).

### Non-portée V1 (V2+ hooks préservés)

- ❌ Qualiopi / OPCO / PDP / e-invoicing FR.
- ❌ VIES API (validation TVA UE).
- ❌ Multi-currency (EUR-only V1).
- ❌ Stripe Billing subscriptions / GoCardless SEPA.
- ❌ Workflow approbation 2-eyes sur refunds.
- ❌ Sessions formation (table `TrainingSession`).
- ❌ **Customer Portal Stripe (D56)** — factures email PJ uniquement V1.
- ❌ **NPS J+1 (D57)** — pas de cron `booking-j1-debrief`, pas de template debrief V1.
- ❌ **Onboarding docs (D58)** — V1.5+ formulaire structuré, hors-app V1.

---

## Sommaire

- 5.1 — Schéma DB cible V1
- 5.2 — Server Actions cible V1 (~27)
- 5.3 — Route handlers cible V1 (+ pages publiques parcours B D44)
- 5.4 — Admin navigation cible V1 (mockup ASCII — 16 sections)
- 5.5 — State machine cible V1 (~23 valeurs effectives V1 incl. `awaiting_admin_validation` D51)
- 5.6 — Crons & workers cible V1 (~21 jobs au total V1)
- 5.7 — Templates emails cible V1 (~30 templates FR/EN)
- 5.8 — Architecture conformité légale V1
- 5.9 — Intégrations externes cible V1
- 5.10 — Hooks d'extension V2+
- 5.11 — Affinements Will-A (devis) + Will-B (multi-options) + **Will-C (parcours B D44)**
- 5.12 — Pricing dynamique (`PricingConfig` DB)
- 5.13 — Frais accessoires (3 modes)
- 5.14 — Échéanciers (4 profils + override)
- 5.15 — Géo-awareness (OSM Nominatim + Haversine)
- 5.16 — Suivi paiements (tableau + fiche + relances)
- 5.17 — DocuSeal vs Yousign (raison du choix)

---

## 5.1 Schéma DB cible V1

### 5.1.1 Vue d'ensemble

Ajouts V1 vs HEAD `ff3ccbc` (cf. `00-REALITY-CHECK.md` §1.1) :

**16 tables nouvelles V1** (dont 1 hook V1.5+ documenté mais NON migré V1, cf. D58) :

1. `Payment`
2. `Invoice`
3. `Refund`
4. `StripeWebhookEvent`
5. `DocusealWebhookEvent`
6. `ContractDocument`
7. `ContractTemplate`
8. `Quote`
9. `CadrageMeeting`
10. `OnboardingDoc` — **HORS V1 (D58)**, hook V1.5+ documenté (cf. §5.1.14). Préservée pour cohérence numérotation cross-livrables ; **non migrée V1**.
11. `CapacityWindow`
12. `PricingConfig`
13. `PaymentScheduleProfile`
14. `BookingPaymentSchedule`
15. `SiteSetting` (clé/valeur globale)
16. `BookingTransition` (event sourcing recommandé Agent 3 R2)

**Réel migré V1 = 15 tables** (OnboardingDoc exclue, D58). Le chiffre référentiel `16` reste affiché pour traçabilité cross-livrables (tag « 1 hook V1.5+ »).

Plus : **extensions** de `Booking` (15+ colonnes), `BookingOption` (statuts + `optionDurationDays` dérivé), enums étendus (`BookingStatus` 4 → **~23 valeurs effectives V1** incl. `awaiting_admin_validation` D51).

Hors V1 (V2+ hooks préservés) : `TrainingSession`, `Attendance`, `Evaluation`, `Certificate` (cf. §5.10). Hooks nullable conservés : `Booking.trainingSessionId? Uuid` (champ DB préparé, sans table associée V1) et `Invoice.payerType` enum avec `client` default V1 (`opco`/`autre` listables V2+ mais pas exposés UI).

### 5.1.2 Enums étendus

#### `BookingStatus` (4 → ~25 valeurs effectives V1 incl. `awaiting_admin_validation` D51 + `installment_overdue` D59 + `disputed` D59 + `paused` D61)

Source : Agent 3 §5.1 + prompt source §5.1 + itération ultime D59-D63.

```
enum BookingStatus {
  draft                        // état UI uniquement (visiteur en train de remplir), pas en DB
  option_pending               // demande posée par visiteur, en attente validation Will (multi-options simultanées tolérées jusqu'à cap)
  lost_other_won               // une AUTRE option du même slot a été validée par Will -> celle-ci perd
  refused                      // refusée par Will (raison optionnelle)
  expired_no_response          // option durée écoulée sans validation Will (rare car cap haute)
  cadrage_scheduled            // call de cadrage planifié (lien visio manuel envoyé)
  cadrage_held                 // call tenu (validationDecision = pertinent)
  cadrage_declined             // validationDecision = not_pertinent (terminal, refund éventuel)
  quote_required               // marqueur : devis semi-auto à émettre avant contrat (admin)
  quote_sent                   // devis DocuSeal envoyé (signature en attente)
  quote_signed                 // devis signé
  quote_declined               // devis refusé / expiré
  contract_pending             // contrat généré auto, prêt en preview admin (D55 — toujours éditable, PAS de seuil 1500 € HT)
  contract_payment_sent        // contrat DocuSeal envoyé + Stripe Checkout Session active (ex-`contract_sent` + `deposit_pending` fusionnés)
  contract_signed              // contrat signé DocuSeal — PAS bloquant pour la suite (D50). Si pas signé, signature physique le jour J.
  awaiting_admin_validation    // D51 — acompte reçu (Stripe webhook OU virement manuel admin) ; en attente du clic Will "Valider sur le calendrier" (D49)
  confirmed                    // après clic Will "Valider sur le calendrier" (D49) — slot 🔴, intervention verrouillée
  paused                       // D61 — projet reporté à date ultérieure, slots libérés pendant la pause (`pausedAt`/`pausedUntil`/`pauseReason`)
  reminded_j7                  // cron J-7 : rappel + facture solde émise si échéancier prévoit
  in_progress                  // jour J (cron 00:00 TZ Europe/Paris)
  completed                    // post-intervention (cron OR admin manuel — NPS J+1 retiré V1 D57)
  invoiced_balance             // facture solde émise (si pas déjà émise en reminded_j7)
  installment_overdue          // D59 — 1+ échéance(s) > 30j retard, escalade en cours (cron `installment-overdue-escalation`)
  paid_balance                 // solde réglé (terminal succès)
  disputed                     // D59 — état terminal recouvrement hors-app par Will après escalade J+45 sans paiement
  archived                     // cron retention ≥ 12 mois
  cancelled_by_user            // self-service magic-link
  cancelled_by_admin           // admin manuel
  no_show                      // J+1 admin, acompte conservé + invoice solde
  force_majeure                // refund total + reschedule prioritaire
  refunded_partial             // CGV 7-2j (50 %)
  refunded_full                // CGV >7j (100 %) ou force majeure ou cadrage_declined
}
```

**Transitions clés (D49 + D50 + D51)** :

- `contract_pending → contract_payment_sent` : clic Will "Envoi contrat + demande acompte" (D49 — Server Action `sendContractAndDepositRequestAction`) après saisie admin obligatoire (frais + Tiptap contrat, D55). Le slot reste 🟠.
- `contract_payment_sent → awaiting_admin_validation` : **automatique** dès webhook Stripe acompte reçu (ou `recordManualPaymentAction` virement reçu). D50 — paiement = seul critère bloquant. Le slot reste 🟠.
- `awaiting_admin_validation → confirmed` : **manuelle** par Will via clic "Valider sur le calendrier" (D49 — Server Action `validateBookingOnCalendarAction`). Bascule slot 🔴 + envoi email `booking-validated-on-calendar`.

#### `BookingOptionStatus` (étendu)

```
enum BookingOptionStatus {
  pending_validation     // attente Will (par défaut)
  validated              // Will a validé -> Booking créé (option terminale)
  lost_other_won         // autre option du même slot validée
  refused                // Will a refusé
  expired_no_response    // durée écoulée sans validation
}
```

Cap concurrent par slot : vérifié à la création via `SiteSetting.maxConcurrentOptionsPerSlot` (défaut 3).

#### Nouveaux enums

```
enum PaymentProvider { stripe  manual_wire  manual_check  manual_cash }
enum PaymentType     { deposit  installment_2  installment_3  balance  refund }
enum PaymentStatus   { pending  processing  succeeded  failed  refunded  cancelled }
enum InvoiceType     { deposit  installment  balance  full  credit_note }
enum InvoiceStatus   { draft  issued  paid  overdue  void  refunded }
enum PayerType       { client  opco  autre }   // V1 = client uniquement exposé UI
enum RefundStatus    { pending  succeeded  failed  cancelled }
enum QuoteStatus     { draft  sent  accepted  declined  expired }
enum ContractProvider { docuseal  manual_upload }
enum ContractStatus  { draft  sent  signed  declined  expired  cancelled_admin }  // D62 — cancelled_admin = annulé par Will avant signature pour réémission v2
enum CadrageStatus   { scheduled  held  cancelled  no_show }
enum ValidationDecision { pertinent  not_pertinent  reschedule }
enum FeesMode        { real_costs  flat_rate_by_zone  included }
enum CompanySize     { TPE  PME  ETI  GRANDE_ENTREPRISE }  // classification INSEE 4 tailles
enum ActorType       { admin  cron  webhook  user  system }

// Extensions Submission (D44 — 2 parcours visiteur distincts A/B)
enum SubmissionType    { audit  implementation  intervention  contact  quote_request }  // quote_request ajouté V1 (parcours B)
enum SubmissionStatus  { new  qualifying  negotiating  converted  lost  archived }      // V1 (suivi pipeline B)
enum BookingOriginPath { direct  quote_negotiation }                                    // A = direct, B = quote_negotiation
```

**Note D44** : `SubmissionType.quote_request` matérialise la nouvelle route publique `/demande-devis` (FR) / `/request-quote` (EN) — parcours B (formats avec devis). `SubmissionStatus` est inerte pour les autres `SubmissionType` (audit/implementation/intervention/contact restent en `new` par défaut) — l'enum sert avant tout au pipeline parcours B (`new → qualifying → negotiating → converted | lost | archived`).

### 5.1.3 Booking (extensions)

Ajouts colonnes V1 :

| Colonne                 | Type               | Default  | Nullable | Index | Rôle                                                                                                                                                           |
| ----------------------- | ------------------ | -------- | -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paymentDeadline`       | DateTime           | NULL     | oui      | —     | Deadline 1ère échéance (deposit_pending → expired)                                                                                                             |
| `cadrageScheduledAt`    | DateTime           | NULL     | oui      | —     | Snapshot cadrage planifié                                                                                                                                      |
| `cadrageHeldAt`         | DateTime           | NULL     | oui      | —     | Snapshot cadrage tenu                                                                                                                                          |
| `validationDecision`    | ValidationDecision | NULL     | oui      | —     | Decision call cadrage                                                                                                                                          |
| `quoteRequired`         | Boolean            | false    | non      | —     | Dérivé `PricingConfig.quoteRequired` (snapshot)                                                                                                                |
| `feesMode`              | FeesMode           | NULL     | oui      | —     | Snapshot mode frais (depuis `PricingConfig`)                                                                                                                   |
| `cancellationReason`    | VarChar(500)       | NULL     | oui      | —     | Saisie admin/user à l'annulation                                                                                                                               |
| `cancellationWindow`    | VarChar(20)        | NULL     | oui      | —     | `>15d` / `15-2d` / `<2d` / `fm` (grille SSOT D40 — cohérente 04-PLAN X.1)                                                                                      |
| `companySize`           | CompanySize        | NULL     | oui      | —     | Snapshot taille INSEE (depuis Submission.details)                                                                                                              |
| `companyCityNormalized` | VarChar(120)       | NULL     | oui      | idx   | Normalisée pour géo-awareness                                                                                                                                  |
| `companyLat`            | Decimal(9,6)       | NULL     | oui      | —     | Géocode OSM Nominatim                                                                                                                                          |
| `companyLng`            | Decimal(9,6)       | NULL     | oui      | —     | Géocode OSM Nominatim                                                                                                                                          |
| `travelBufferDays`      | Int                | 0        | non      | —     | 0/1/2 selon distance (calculé)                                                                                                                                 |
| `reschedulePriority`    | Boolean            | false    | non      | —     | Force majeure Will -> priorité reschedule                                                                                                                      |
| `j7ReminderSentAt`      | DateTime           | NULL     | oui      | —     | Sentinel cron J-7                                                                                                                                              |
| `inProgressAt`          | DateTime           | NULL     | oui      | —     | Sentinel cron jour J                                                                                                                                           |
| `completedAt`           | DateTime           | NULL     | oui      | —     | Sentinel cron J+1                                                                                                                                              |
| `archivedAt`            | DateTime           | NULL     | oui      | —     | Sentinel retention                                                                                                                                             |
| `trainingSessionId`     | Uuid               | NULL     | oui      | —     | HOOK V2+ Qualiopi (table absente V1)                                                                                                                           |
| `quoteId`               | Uuid               | NULL     | oui      | FK    | -> Quote.id                                                                                                                                                    |
| `contractDocumentId`    | Uuid               | NULL     | oui      | FK    | -> ContractDocument.id                                                                                                                                         |
| `cadrageMeetingId`      | Uuid               | NULL     | oui      | FK    | -> CadrageMeeting.id                                                                                                                                           |
| `fromSubmissionId`      | Uuid               | NULL     | oui      | FK    | **D44** — FK -> Submission.id ; renseignée pour parcours B (devis qualifié converti en Booking via `createBookingFromSubmissionAction`). NULL pour parcours A. |
| `originPath`            | BookingOriginPath  | `direct` | non      | idx   | **D44** — `direct` (parcours A calendrier) / `quote_negotiation` (parcours B formulaire qualifié + négociation hors-app).                                      |
| `pausedAt`              | DateTime           | NULL     | oui      | —     | **D61** — sentinel : date d'activation de la suspension `paused` (libération slot).                                                                            |
| `pausedUntil`           | DateTime           | NULL     | oui      | idx   | **D61** — date prévue de reprise ; cron `paused-resume-reminder` (J-7 / J-1 / J0) Telegram Will.                                                               |
| `pauseReason`           | VarChar(500)       | NULL     | oui      | —     | **D61** — motif libre saisie admin (audit log).                                                                                                                |

Le champ legacy `calendarEventId` (Cal.com) est marqué deprecated (drop V2+, cf. Agent 3 R9).

### 5.1.4 BookingOption (extensions)

```
model BookingOption {
  id              Uuid @id @default(uuid())
  slotId          Uuid                            // FK -> CalendarSlot (Cascade)
  status          BookingOptionStatus @default(pending_validation)
  companyName     VarChar(200)
  companySector   VarChar(120)?
  companySize     CompanySize?                    // INSEE classification
  contactName     VarChar(200)
  contactEmail    Citext
  contactPhone    VarChar(40)?
  interventionType InterventionType
  participantsCount Int?
  format          VarChar(80)?                    // collective_4j / individuel / dirigeants / conference
  message         Text?                           // message libre visiteur
  consentCgv      Boolean @default(false)
  consentDisplay  Boolean @default(false)         // social proof
  expiresAt       DateTime                        // = now + PricingConfig.optionDurationDays
  reminderSentAt  DateTime?
  validatedAt     DateTime?
  refusedAt       DateTime?
  refusedReason   VarChar(500)?
  locale          Locale @default(fr)
  ipAddress       VarChar(45)?
  userAgent       Text?
  turnstileScore  Decimal(3,2)?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([slotId, status])
  @@index([expiresAt])
  @@index([contactEmail])
}
```

Cap concurrent : vérifié à la création — `COUNT WHERE slotId=? AND status='pending_validation' < SiteSetting.maxConcurrentOptionsPerSlot`.

### 5.1.5 Payment

```
model Payment {
  id                       Uuid @id @default(uuid())
  bookingId                Uuid                       // FK -> Booking (Restrict)
  invoiceId                Uuid?                      // FK -> Invoice (SetNull)
  provider                 PaymentProvider            // stripe | manual_wire | manual_check | manual_cash
  providerEventId          String? @unique            // Stripe event.id OR manual reference (nullable pour manuel)
  providerCustomerId       String?                    // cus_...
  providerPaymentIntentId  String?                    // pi_...
  providerCheckoutSessionId String?                   // cs_...
  amountCents              Int
  currency                 VarChar(3) @default("EUR") // V1 EUR-only
  type                     PaymentType                // deposit | installment_2 | installment_3 | balance | refund
  status                   PaymentStatus @default(pending)
  paidAt                   DateTime?
  failedAt                 DateTime?
  failureReason            VarChar(500)?              // redacted, jamais le PAN
  receivedReference        VarChar(120)?              // n° virement, chèque, etc.
  mode                     VarChar(40)?               // "card", "sepa_credit_transfer", "cheque", "cash"
  notes                    Text?                      // notes admin libres (saisie manuelle)
  recordedByAdminId        Uuid?                      // FK -> AdminUser (qui a saisi le paiement manuel)
  isHistorical             Boolean @default(false)    // D63 — true si Payment rétrofitté par script `migrate-bookings-v0-to-v1.ts` (bookings V0 confirmés sans Payment réel)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  @@index([bookingId, status])
  @@index([providerPaymentIntentId])
  @@index([status, type, paidAt])
  @@index([provider, status])
  @@index([isHistorical])
  @@map("payments")
}
```

**Contraintes** :

- Si `provider = stripe` → `providerEventId` requis (idempotence webhook).
- Si `provider IN (manual_*)` → `recordedByAdminId` requis + `receivedReference` requis + `notes` recommandé (audit trail).

### 5.1.6 Invoice

```
model Invoice {
  id                        Uuid @id @default(uuid())
  number                    VarChar(40) @unique     // 'AXION-2026-NNNN' séquentiel atomique (D29)
  bookingId                 Uuid                     // FK -> Booking (Restrict)
  paymentId                 Uuid?                    // FK -> Payment (SetNull)
  type                      InvoiceType              // deposit | installment | balance | full | credit_note
  installmentNumber         Int?                     // 1, 2, 3 si type=installment
  basePriceHtCents          Int                      // depuis PricingConfig snapshot
  travelFeeCents            Int @default(0)
  accommodationFeeCents     Int @default(0)
  mealFeeCents              Int @default(0)
  additionalFeesCents       Int @default(0)
  additionalFeesNotes       Text?
  amountHtCents             Int                      // = base + travel + acc + meal + add
  vatRate                   Decimal(5,2)             // ex. 20.00 ou 0.00 (snapshot depuis PricingConfig au moment d'émission)
  vatReverseCharge          Boolean @default(false)  // true = autoliquidation B2B intra-UE EE
  vatMention                Text?                    // ex. "Autoliquidation — Article 196..."
  amountTtcCents            Int
  depositExpectedCents      Int?                     // dérivé échéancier
  balanceExpectedCents      Int?
  pdfUrl                    String?                  // Hetzner Storage Box signed URL OU Stripe hosted_invoice_url
  hashSha256                String?                  // intégrité PDF archivé
  issuedAt                  DateTime @default(now())
  dueAt                     DateTime?
  paidAt                    DateTime?
  status                    InvoiceStatus @default(draft)
  archivedUntil             DateTime                 // = issuedAt + 10 ans (D30, archivage légal)
  payerType                 PayerType @default(client) // V1 = client only UI
  payerName                 VarChar(300)?
  payerVatNumber            VarChar(40)?             // n° TVA UE pour reverse charge
  payerAddress              Text?
  payerEmail                Citext?
  locale                    Locale @default(fr)
  creditNoteOf              Uuid?                    // FK self -> Invoice.id (avoir lié à facture origine)
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  @@index([bookingId, status])
  @@index([status, issuedAt])
  @@index([number])
  @@index([payerEmail])
  @@map("invoices")
}
```

**Numérotation `AXION-2026-NNNN`** : séquentiel atomique via Postgres advisory lock `pg_advisory_xact_lock(hashtextextended('invoice_seq_2026', 0))` avant INSERT. Pas de trous, pas de réutilisation. Cf. Agent 4 §5.2 + Agent 11 P1-6.

### 5.1.7 Refund

```
model Refund {
  id              Uuid @id @default(uuid())
  invoiceId       Uuid                              // FK -> Invoice (Restrict)
  paymentId       Uuid                              // FK -> Payment (Restrict)
  amountCents     Int                               // partial OR full
  reason          VarChar(80)?                      // 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'force_majeure' | 'cgv_window'
  scope           VarChar(20)                       // 'partial' | 'full'
  status          RefundStatus @default(pending)
  stripeRefundId  String? @unique                   // re_...
  adminUserId     Uuid?                             // FK -> AdminUser
  notes           Text?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([invoiceId])
  @@index([paymentId])
  @@map("refunds")
}
```

### 5.1.8 StripeWebhookEvent

```
model StripeWebhookEvent {
  id              Uuid @id @default(uuid())
  stripeEventId   String @unique                    // evt_... (idempotence)
  type            VarChar(120)                       // 'checkout.session.completed', etc.
  livemode        Boolean
  apiVersion      VarChar(40)?
  payload         Json                              // event entier (audit/replay)
  processedAt     DateTime?
  error           Text?
  retryCount      Int @default(0)
  nextRetryAt     DateTime?
  eventCreatedAt  DateTime                          // event.created Unix -> Date (ordre logique)
  receivedAt      DateTime @default(now())

  @@index([type, processedAt])
  @@index([stripeEventId])
  @@map("stripe_webhook_events")
}
```

Insertion avant traitement : `INSERT ... ON CONFLICT (stripe_event_id) DO NOTHING`. Si 0 rows affected → événement déjà reçu, return 200 sans effet (cf. Agent 4 §5.2).

### 5.1.9 DocusealWebhookEvent

Symétrique à `StripeWebhookEvent`. HMAC-SHA256 vérifié (header `X-DocuSeal-Signature`).

```
model DocusealWebhookEvent {
  id              Uuid @id @default(uuid())
  docusealEventId String @unique
  type            VarChar(120)                      // 'submission.completed', 'submission.declined', etc.
  payload         Json
  processedAt     DateTime?
  error           Text?
  retryCount      Int @default(0)
  receivedAt      DateTime @default(now())

  @@index([type, processedAt])
  @@map("docuseal_webhook_events")
}
```

### 5.1.10 ContractDocument

```
model ContractDocument {
  id              Uuid @id @default(uuid())
  bookingId       Uuid                              // FK -> Booking (Restrict)
  provider        ContractProvider                  // docuseal | manual_upload
  providerId      String?                           // DocuSeal submission_id
  templateId      Uuid                              // FK -> ContractTemplate
  body            Json                              // snapshot Tiptap JSON au moment de l'envoi
  variables       Json                              // valeurs des {{vars}} interpolées
  status          ContractStatus @default(draft)
  sentAt          DateTime?
  signedAt        DateTime?
  declinedAt      DateTime?
  pdfUrl          String?                           // Hetzner Storage Box signed URL
  hashSha256      String?                           // intégrité PDF signé
  signerEmail     Citext
  signerName      VarChar(200)
  ipSigner        VarChar(45)?                      // IP eIDAS-SES
  version         Int @default(1)                   // D62 — versioning contrat (cancel & reissue avant signature OU avenant après)
  previousVersionId Uuid?                           // D62 — FK self -> ContractDocument.id pour traçabilité v1 -> v2 (cancel_admin) ou avenant
  isAddendum      Boolean @default(false)           // D62 — true si avenant post-signature (contrat principal reste immuable légal)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([bookingId, status])
  @@index([providerId])
  @@index([previousVersionId])
  @@map("contract_documents")
}
```

### 5.1.11 ContractTemplate

```
model ContractTemplate {
  id                   Uuid @id @default(uuid())
  name                 VarChar(120)
  slug                 VarChar(80) @unique
  body                 Json                              // Tiptap JSON master (avec {{variables}} Handlebars-like)
  variables            Json                              // schéma des variables: [{key, label, required}]
  defaultLegalClauses  Json                              // D53 — clauses légales par défaut insérées auto dans chaque contrat généré (ex. clause résolution J+10). Modifiable Will via Tiptap admin.
  isDefault            Boolean @default(false)
  version              Int @default(1)
  locale               Locale @default(fr)
  archivedAt           DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([slug])
  @@index([isDefault, archivedAt])
  @@map("contract_templates")
}
```

V1 : 1 template par défaut FR (`isDefault=true`) + 1 EN. Modifiables admin via éditeur Tiptap dans `/admin/templates`.

**`defaultLegalClauses` D53** — seed initial V1 (clause résolution pour défaut de paiement) :

```json
{
  "fr": [
    {
      "title": "Résolution pour défaut de paiement",
      "body": "Le présent contrat sera résolu de plein droit, sans formalité ni mise en demeure, en cas de non-paiement de l'acompte dans un délai de 10 jours suivant sa signature électronique. La date de prestation sera alors libérée."
    }
  ],
  "en": [
    /* idem traduit */
  ]
}
```

À chaque clic Will "Envoi contrat + demande acompte" (D49), les `defaultLegalClauses` sont **fusionnées automatiquement** dans le body Tiptap éditable (D55 — saisie admin obligatoire avant envoi). Will peut les modifier librement avant envoi.

### 5.1.12 Quote

```
model Quote {
  id                  Uuid @id @default(uuid())
  number              VarChar(40) @unique           // 'DEVIS-2026-NNNN'
  bookingId           Uuid                          // FK -> Booking (Restrict)
  body                Json                          // Tiptap JSON (pré-rempli admin depuis PricingConfig + édité)
  amountHtCents       Int
  vatRate             Decimal(5,2)
  vatReverseCharge    Boolean @default(false)
  vatMention          Text?
  amountTtcCents      Int
  validUntil          DateTime                      // = sentAt + 30j default
  pdfUrl              String?                       // Hetzner Storage Box
  hashSha256          String?
  status              QuoteStatus @default(draft)   // draft -> sent -> accepted/declined/expired
  sentAt              DateTime?
  acceptedAt          DateTime?
  declinedAt          DateTime?
  contractDocumentId  Uuid?                         // FK -> ContractDocument (chaîne après signature)
  docusealSubmissionId String?                       // DocuSeal submission pour signature devis
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([bookingId, status])
  @@index([number])
  @@map("quotes")
}
```

**Workflow Quote semi-auto V1** (cf. §5.11 Will-A) :

1. Will clique « Émettre devis » sur `/admin/reservations/:id`.
2. Formulaire pré-rempli depuis `PricingConfig` + données booking.
3. Will modifie (Tiptap rich text), valide.
4. PDF généré + envoyé via DocuSeal pour signature électronique.
5. Webhook `submission.completed` → `Quote.status = accepted` + chain vers `ContractDocument`.

### 5.1.13 CadrageMeeting

```
model CadrageMeeting {
  id                  Uuid @id @default(uuid())
  bookingId           Uuid @unique                 // 1 cadrage par booking
  scheduledAt         DateTime
  durationMinutes     Int @default(30)
  visioUrl            String                       // lien manuel saisi par Will (Meet/Whereby/Jitsi)
  visioProvider       VarChar(40)?                  // 'google_meet' | 'whereby' | 'jitsi' | 'other'
  status              CadrageStatus @default(scheduled)
  heldAt              DateTime?
  validationDecision  ValidationDecision?           // pertinent | not_pertinent | reschedule
  notes               Text?                         // CR cadrage (Tiptap simplifié recommandé)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([scheduledAt])
  @@map("cadrage_meetings")
}
```

V1 visio : **outil hors-app** (Will choisit). V2+ : intégration Whereby API rooms à durée limitée.

### 5.1.14 OnboardingDoc — **HORS V1 (D58)** — schéma préservé comme hook V1.5+, table non créée V1

> **⚠️ HORS V1 (D58)** — Décision Will 2026-05-12 : pas de Sprint dédié onboarding-docs, **table NON instanciée V1**. Géré hors-app par email pour V1, formulaire structuré V1.5+ (pas upload fichiers libre). Le schéma ci-dessous est documenté comme **hook V1.5+** uniquement — il **ne fait pas partie des chiffres V1**. La table `OnboardingDoc` n'est PAS comptée dans le « 16 tables nouvelles V1 ». Schéma final V1.5+ probable :

```
// HORS V1 — Hook V1.5+ documenté pour traçabilité, NON migré V1.
model OnboardingDoc {
  id                  Uuid @id @default(uuid())
  bookingId           Uuid                          // FK -> Booking (Cascade)
  type                VarChar(80)                   // 'briefing' | 'slides' | 'access_credentials' | 'ndas_signed_pdf' | 'other'
  filename            VarChar(255)
  storageUrl          String                        // Hetzner Storage Box S3-compat signed URL
  storageKey          String                        // chemin storage
  signedUrlExpiresAt  DateTime?                     // pour distribution sécurisée
  mimeType            VarChar(120)
  sizeBytes           BigInt
  uploadedByAdminId   Uuid?                         // FK -> AdminUser
  uploadedAt          DateTime @default(now())

  @@index([bookingId, type])
  @@map("onboarding_docs")
}
```

### 5.1.15 CapacityWindow

```
model CapacityWindow {
  id                  Uuid @id @default(uuid())
  weekStart           DateTime @unique              // lundi 00:00 TZ Europe/Paris
  maxInterventions    Int @default(2)               // Will solo, ~2 interventions confirmées par semaine
  currentBookings     Int @default(0)
  recomputedAt        DateTime @default(now())

  @@map("capacity_windows")
}
```

Mis à jour via cron `capacity-recompute` (J 03:00 UTC).

### 5.1.16 PricingConfig

```
model PricingConfig {
  id                          Uuid @id @default(uuid())
  interventionType            VarChar(80) @unique   // 'collective_4j' | 'individuel' | 'dirigeants' | 'conference' | 'audit_flash_onsite' | ...
  format                      VarChar(80)?           // sub-format si applicable
  basePriceHtCents            Int
  depositPercentage           Int?                   // 30, 50, 100 (si profile fixe)
  depositFixedAmountCents     Int?                   // si forfait
  paymentScheduleProfileId    Uuid?                   // FK -> PaymentScheduleProfile (override default)
  vatRate                     Decimal(5,2) @default(0)  // 0=EE reverse / 20=FR
  vatReverseCharge            Boolean @default(false)
  vatMention                  Text?
  quoteRequired               Boolean @default(false)  // > 5000 € HT ou format complexe
  contractTemplateId          Uuid?                   // FK -> ContractTemplate (override default)
  feesMode                    FeesMode @default(included)
  flatRateConfig              Json?                   // {idfCents:0, frMetroCents:25000, domTomCents:45000}
  optionDurationDays          Int @default(2)         // V1 défaut 48h, configurable
  isActive                    Boolean @default(true)
  updatedAt                   DateTime @updatedAt
  updatedByAdminId            Uuid?

  @@index([interventionType, isActive])
  @@map("pricing_configs")
}
```

**Doctrine** : modification admin → trigger `revalidatePath()` sur pages publiques (`/reserver`, `/interventions/**`, `/audit`, `/pricing`). Plus de hardcode `src/content/pricing.ts`.

### 5.1.17 PaymentScheduleProfile

```
model PaymentScheduleProfile {
  id                  Uuid @id @default(uuid())
  name                VarChar(120)                   // 'Sous 1500 €' / '1500-5000' / '5000-15000' / '>15000'
  slug                VarChar(80) @unique
  installments        Json                           // [{percentage:50, dueOffsetDays:14, description:"À la validation"}, ...]
  thresholdMinCents   Int?                           // borne inférieure (NULL = pas de min)
  thresholdMaxCents   Int?                           // borne supérieure (NULL = pas de max)
  isDefault           Boolean @default(false)
  archivedAt          DateTime?
  updatedAt           DateTime @updatedAt

  @@index([thresholdMinCents, thresholdMaxCents])
  @@map("payment_schedule_profiles")
}
```

**4 profils par défaut V1** (cf. §5.14) :

- `tiny` (≤ 1500 € HT) : 100 % à J+0, dû J+7.
- `small` (1500-5000) : 50 % J+0 (dû J+14) + 50 % J-7 avant prestation (dû J+7).
- `medium` (5000-15000) : 30 % J+0 (J+14) + 30 % J-7 (J+7) + 40 % J+30 après (J+30).
- `large` (> 15000) : 30/30/40 idem OU paiement mensuel custom (dates contractuelles).

### 5.1.18 BookingPaymentSchedule

```
model BookingPaymentSchedule {
  id                  Uuid @id @default(uuid())
  bookingId           Uuid @unique                  // 1 schedule par booking
  profileId           Uuid?                          // FK -> PaymentScheduleProfile (NULL si custom override)
  installments        Json                           // snapshot [{percentage, dueAt, status, paidAt, invoiceId}]
  overrideReason      VarChar(500)?                  // motif admin si override
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@map("booking_payment_schedules")
}
```

Si NULL profile → dérive du profile selon `Booking.totalAmountHtCents` lookup `thresholdMin/Max`. Si override → snapshot custom stocké.

### 5.1.19 SiteSetting

```
model SiteSetting {
  key                 VarChar(120) @id              // 'maxConcurrentOptionsPerSlot' | 'businessHolidays' | 'travelMaxKmInWindow48h' | etc.
  value               Json
  description         Text?
  updatedAt           DateTime @updatedAt
  updatedByAdminId    Uuid?

  @@map("site_settings")
}
```

Clés V1 utilisées :

- `maxConcurrentOptionsPerSlot` → Int (default `3`).
- `travelMaxKmInWindow48h` → Int (default `600`).
- `travelWarnKmInWindow48h` → Int (default `300`).
- `businessHolidays` → array de dates ISO.
- `slaConfirmHours` → Int (default `48`, « Will répond sous 48h »).
- **`optionExpirationDaysIfNothingReceived`** → Int (default **`5`**, D52) — annulation auto via cron `option-expiration-rien-recu` si ni signature DocuSeal ni paiement Stripe reçu après envoi contrat+demande acompte.
- **`contractSignedWithoutDepositCutoffDays`** → Int (default **`10`**, D52) — résolution de plein droit du contrat si signé mais acompte non payé (clause CGV D53 invoquée). Cron `contract-signed-without-deposit-cancel`.
- `paymentReminderDisabledFor` → array de UUID clients (relances paiement désactivées).

### 5.1.20 BookingTransition (event sourcing)

Agent 3 R2 — exigé V1 pour traçabilité state machine + idempotence.

```
model BookingTransition {
  id              Uuid @id @default(uuid())
  bookingId       Uuid                              // FK -> Booking (Cascade)
  fromStatus      BookingStatus?
  toStatus        BookingStatus
  trigger         VarChar(80)                        // 'admin.validate_option' | 'webhook.stripe.checkout_completed' | 'cron.j7_reminder' | etc.
  actorType       ActorType                         // admin | cron | webhook | user | system
  actorId         Uuid?
  changes         Json?                              // {before, after, fields:[...]}
  notes           Text?
  createdAt       DateTime @default(now())

  @@index([bookingId, createdAt])
  @@unique([bookingId, toStatus, trigger], map: "booking_transitions_idempotence")  // partielle one-shot
  @@map("booking_transitions")
}
```

### 5.1.21 Index partiels critiques

```sql
-- Cap concurrent options par slot
CREATE UNIQUE INDEX booking_options_active_per_slot
  ON booking_options (slot_id, contact_email)
  WHERE status = 'pending_validation';

-- Numérotation factures séquentielle (advisory lock)
CREATE INDEX invoices_number_year ON invoices (substring(number, 7, 4));

-- Webhooks idempotence (déjà UNIQUE)
-- pas d'index supplémentaire
```

---

## 5.2 Server Actions cible V1 (~25)

Format : `actionName(inputs) → output | rôle requis | idempotence | side effects`.

### 5.2.1 Actions visiteur (PUBLIC)

| #      | Action                                            | Inputs                                                                                                                                                                           | Output               | Rate-limit            | Turnstile | Idempotence                                                                                                    |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| V1     | `createBookingOptionAction`                       | FormData (slotId, company, size INSEE, sector, contact, format, message, consents)                                                                                               | `{ok, optionId}`     | `option:<ip>` 3/600s  | OUI       | Non (vérif cap concurrent + verrou pessimiste slot)                                                            |
| V2     | `requestCancellationByUserAction`                 | token signé + reason                                                                                                                                                             | `{ok, refundAmount}` | `cancel:<ip>` 3/3600s | non       | OUI (token one-shot)                                                                                           |
| V3     | `requestReschedulingByUserAction`                 | token signé + newDate (V2+ hook préservé V1)                                                                                                                                     | `{ok}`               | idem                  | non       | OUI                                                                                                            |
| **V4** | **`submitQuoteRequestAction`** (D44 — parcours B) | FormData (`intervention` slug, company, size INSEE, sector, contact, format, contexte business 200-500 mots, budget pressenti, timing semaines, lieu, nb participants, CGV+RGPD) | `{ok, submissionId}` | `quote:<ip>` 3/3600s  | OUI       | Non (création unique `Submission` type=`quote_request` status=`new`) — **AUCUN slot calendrier réservé** (D45) |

### 5.2.2 Actions admin booking

| #         | Action                                                                                         | Inputs                                                                                                                                                                                                                                            | Rôle                | Effets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1        | **`sendContractAndDepositRequestAction`** (D49 — renommé depuis `validateBookingOptionAction`) | `optionId`, `editedContractTiptap` (D55), `editedFees` (D55 — `travelFeeCents`, `accommodationFeeCents`, `mealFeeCents`, `additionalFeesCents`)                                                                                                   | super_admin / admin | Clic 1 Will "Envoi contrat + demande acompte" parcours A (D49). Ouvre d'abord écran admin obligatoire (D55 — frais modifiables + édition contrat Tiptap libre, **PAS de seuil 1 500 € HT**). Au clic « Envoyer » : marque option `validated` → Booking créé en `contract_pending` → `contract_payment_sent` → autres options du même slot → `lost_other_won` (emails alternatifs auto) → injecte clauses D53 dans contrat → envoie DocuSeal → crée Stripe Checkout Session 1ère échéance. **Slot reste 🟠** (status `contract_payment_sent`). |
| **A1bis** | **`validateBookingOnCalendarAction`** (D49 — nouveau)                                          | `bookingId`                                                                                                                                                                                                                                       | super_admin / admin | Clic 2 Will "Valider sur le calendrier" depuis section dashboard "Prêts à valider". Transition `awaiting_admin_validation → confirmed` (D51) + slot 🔴 + envoi email final `booking-validated-on-calendar`. Vérifie invariants : `Booking.status === 'awaiting_admin_validation'` (sinon refuse).                                                                                                                                                                                                                                             |
| A2        | `refuseBookingOptionAction`                                                                    | `optionId`, `reason?`                                                                                                                                                                                                                             | super_admin / admin | Option `refused` + email auto avec motif optionnel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| A3        | `editContractDraftAction`                                                                      | `contractId`, `bodyTiptap`, `variables`                                                                                                                                                                                                           | super_admin / admin | Update `ContractDocument.body` (avant envoi) — seulement si > 1500 € HT ou Will explicite                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| A4        | `sendContractForSignatureAction`                                                               | `contractId`                                                                                                                                                                                                                                      | super_admin / admin | `ContractDocument.status='sent'` + DocuSeal `POST /api/submissions` + email client `contract-sent`                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| A5        | `scheduleCadrageMeetingAction`                                                                 | `bookingId`, `scheduledAt`, `visioUrl`, `visioProvider`                                                                                                                                                                                           | super_admin / admin | `CadrageMeeting.create` + Booking `cadrage_scheduled` + email cadrage-scheduled                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A6        | `markCadrageHeldAction`                                                                        | `bookingId`, `validationDecision`, `notes?`                                                                                                                                                                                                       | super_admin / admin | `CadrageMeeting.heldAt=now` + Booking → `cadrage_held` ou `cadrage_declined`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| A7        | `emitQuoteAction`                                                                              | `bookingId`, `bodyTiptap`, `amountHtCents`, `validityDays`                                                                                                                                                                                        | super_admin / admin | `Quote.create(status=draft)` → numérotation `DEVIS-2026-NNNN` + send DocuSeal + email `quote-sent`                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| A8        | `recordPaymentAction`                                                                          | `invoiceId`, `amountCents`, `paidAt`, `mode`, `receivedReference`, `notes?`                                                                                                                                                                       | super_admin / admin | `Payment.create(provider=manual_*)` + update Invoice.status + audit log immutable                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| A9        | `createInstallmentInvoiceAction`                                                               | `bookingId`, `installmentNumber`                                                                                                                                                                                                                  | super_admin / admin | Génère Invoice échéance N + envoie email                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A10       | `triggerRefundAction`                                                                          | `paymentId`, `amountCents`, `reason`, `scope`                                                                                                                                                                                                     | super_admin / admin | `Refund.create` + Stripe `refunds.create` si provider stripe + Invoice `credit_note` auto                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| A11       | `cancelBookingByAdminAction`                                                                   | `bookingId`, `reason`, `refundDecision`                                                                                                                                                                                                           | super_admin / admin | Booking → `cancelled_by_admin` + refund auto si applicable + slot libéré                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A12       | `markCompletedAction`                                                                          | `bookingId`                                                                                                                                                                                                                                       | super_admin / admin | Booking `completed` + déclenche T17 invoiced_balance si pas déjà fait                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| A13       | `markNoShowAction`                                                                             | `bookingId`, `notes?`                                                                                                                                                                                                                             | super_admin / admin | Booking `no_show` + acompte conservé + invoice solde émise quand même                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| A14       | `markForceMajeureAction`                                                                       | `bookingId`, `reason`                                                                                                                                                                                                                             | super_admin (only)  | Booking `force_majeure` + refund total Stripe + slot libéré + `reschedulePriority=true`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A15       | `addAdditionalFeeAction`                                                                       | `bookingId`, `type`, `amountCents`, `notes?`                                                                                                                                                                                                      | super_admin / admin | Update Invoice.travelFee / accommodationFee / mealFee / additionalFee avant émission solde                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **A16**   | **`createBookingFromSubmissionAction`** (D44 + D46 — parcours B)                               | `submissionId`, `slots[]` (1..N CalendarSlot ids), `amountHtCents`, `scheduleProfileId \| customInstallments[]`, `fees{travel,accommodation,meal,additional}`, `vatRate`, `vatReverseCharge`, `contractDraftTiptap` JSON, `quoteDraftTiptap` JSON | super_admin / admin | **Matérialise sortie négociation hors-app B** : crée `Booking` (`originPath='quote_negotiation'`, `fromSubmissionId=submissionId`) + bloque les `slots[]` (🔴) + crée `Quote` (draft → DocuSeal) + `ContractDocument` (draft → DocuSeal) + `Invoice` deposit + Stripe Checkout Session → envoi email **unifié** `contract-sent-with-deposit-link` (devis DocuSeal + contrat DocuSeal + lien paiement Stripe). Marque `Submission.status='converted'`.                                                                                         |
| **A17**   | **`updateSubmissionDraftAction`** (D44 + P1-4 — parcours B)                                    | `submissionId`, `partialUpdates` (montantPressenti, datesPressenties, notesCall, status next ∈ `qualifying`/`negotiating`)                                                                                                                        | super_admin / admin | Saisie progressive Will pendant négociation (avant `createBookingFromSubmissionAction`). Met à jour `Submission.details` JSON + bascule `Submission.status` dans le pipeline B (`new → qualifying → negotiating`). N'envoie aucun email — c'est un brouillon admin.                                                                                                                                                                                                                                                                           |
| **A18**   | **`rescheduleBookingByAdminAction`** (D60 — nouveau)                                           | `bookingId`, `newSlotIds[]`, `reason`, `notifyClient: bool`                                                                                                                                                                                       | super_admin / admin | Drag-drop reschedule admin (X.9). **Restriction de statut** : autorisé si `Booking.status ∈ {contract_payment_sent, awaiting_admin_validation, confirmed, paused}` — refusé sinon (renvoyer `{ok: false, error: 'invalid_status_for_admin_reschedule'}`). Libère ancien(s) slot(s) + bloque nouveau(x) slot(s) (transactionnel). Audit log immutable `BookingTransition` avec diff slot. Si `notifyClient=true` → email `booking-rescheduled-by-admin` (template #52) avec nouveau `.ics`.                                                    |
| **A19**   | **`pauseBookingAction`** (D61 — nouveau)                                                       | `bookingId`, `pausedUntil: DateTime`, `pauseReason: string`                                                                                                                                                                                       | super_admin / admin | Statut `confirmed → paused`. Libère slots associés (slots redeviennent 🟢) + snapshot `Booking.pausedAt=now()`, `pausedUntil`, `pauseReason`. Email client `booking-paused-confirmation` (template #53). Active cron `paused-resume-reminder` (cf. §5.6 #24) qui pingue Telegram Will à J-7 / J-1 / J0 de `pausedUntil`.                                                                                                                                                                                                                      |
| **A20**   | **`resumeBookingAction`** (D61 — nouveau)                                                      | `bookingId`, `newSlotIds[]`                                                                                                                                                                                                                       | super_admin / admin | Statut `paused → confirmed`. Bloque les nouveaux slots `newSlotIds[]` (transactionnel). Email client `booking-resumed-notification` (template #54) avec nouveau `.ics`. Reset `pausedAt/pausedUntil/pauseReason` à NULL. Audit log diff slots.                                                                                                                                                                                                                                                                                                |
| **A21**   | **`cancelAndReissueContractAction`** (D62 — nouveau)                                           | `contractId`, `newDraftTiptap: Json`, `reason: string`                                                                                                                                                                                            | super_admin / admin | **Avant signature uniquement** : annule la submission DocuSeal courante (`ContractDocument.status → cancelled_admin`, version courante archivée) + crée v2 (`ContractDocument` nouveau avec `version = previous + 1`, `previousVersionId = old.id`, `isAddendum = false`) + push nouvelle submission DocuSeal + email client `contract-version-updated` (template #55). Audit log avec diff Tiptap (hash before/after). **Refuse si `ContractDocument.status === 'signed'`** : utiliser A22 avenant à la place.                               |
| **A22**   | **`createContractAddendumAction`** (D62 — nouveau)                                             | `bookingId`, `addendumDraftTiptap: Json`                                                                                                                                                                                                          | super_admin / admin | **Après signature uniquement** : crée un `ContractDocument` séparé (`isAddendum = true`, `previousVersionId = signedContract.id`, version indépendante). Mention claire : **le contrat principal signé reste immuable (légal)**, tout changement passe par avenant séparé envoyé via DocuSeal. Email client `contract-version-updated` (template #55). Audit log immutable.                                                                                                                                                                   |

### 5.2.3 Actions admin pricing / config

| #   | Action                               | Inputs                                      | Rôle                | Effets                                                                                   |
| --- | ------------------------------------ | ------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| C1  | `updatePricingConfigAction`          | `interventionType`, partial config          | super_admin / admin | Update + revalidatePath FR/EN sur `/reserver`, `/interventions/**`, `/audit`, `/pricing` |
| C2  | `upsertPaymentScheduleProfileAction` | profile data                                | super_admin         | Update profiles par défaut                                                               |
| C3  | `overridePaymentScheduleAction`      | `bookingId`, `customInstallments`, `reason` | super_admin / admin | Snapshot custom dans `BookingPaymentSchedule` (override profile par défaut)              |
| C4  | `upsertSiteSettingAction`            | `key`, `value`                              | super_admin         | Update setting global (ex. `maxConcurrentOptionsPerSlot`)                                |
| C5  | `upsertContractTemplateAction`       | template data                               | super_admin         | Update template (versioning Int auto-incrémenté)                                         |

### 5.2.4 Actions admin paiements / facture

| #   | Action                          | Inputs                | Rôle                | Effets                                            |
| --- | ------------------------------- | --------------------- | ------------------- | ------------------------------------------------- |
| P1  | `getPaymentDashboardAction`     | filters               | read                | Tableau global (cf. §5.16)                        |
| P2  | `getBookingPaymentDetailAction` | `bookingId`           | read                | Fiche complète + timeline + audit                 |
| P3  | `markInvoiceVoidAction`         | `invoiceId`, `reason` | super_admin         | Void facture (ex. erreur saisie)                  |
| P4  | `exportPaymentsCsvAction`       | filters               | super_admin / admin | Export CSV mensuel/trimestriel/annuel + BOM Excel |
| P5  | `recomputeCapacityAction`       | (manuel)              | super_admin         | Force recompute `CapacityWindow`                  |

Total : **~32 Server Actions cible V1** (visiteur + admin booking + admin pricing + admin paiements). Bilan vs version V2.2 : renommage A1 `validateBookingOptionAction` → `sendContractAndDepositRequestAction` (D49) + ajout A1bis `validateBookingOnCalendarAction` (D49) + ajout V4 `submitQuoteRequestAction` (D44 — parcours B) + A16 `createBookingFromSubmissionAction` (D44) + A17 `updateSubmissionDraftAction` (D44) + **A18 `rescheduleBookingByAdminAction` (D60)** + **A19 `pauseBookingAction` (D61)** + **A20 `resumeBookingAction` (D61)** + **A21 `cancelAndReissueContractAction` (D62)** + **A22 `createContractAddendumAction` (D62)**. Customer Portal Stripe action retirée V1 (D56).

---

## 5.3 Route handlers cible V1

Routes API (Next 16 App Router, méthodes typées) :

| Route                                        | Méthode | Auth                                 | Rôle                                                                                                                 |
| -------------------------------------------- | ------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `/api/stripe/webhook`                        | POST    | Signature `Stripe-Signature`         | Idempotence via `StripeWebhookEvent` + enqueue BullMQ async. Réponse 200 < 1s.                                       |
| `/api/docuseal/webhook`                      | POST    | HMAC `X-DocuSeal-Signature`          | Idempotence via `DocusealWebhookEvent`                                                                               |
| `/api/admin/calendar/ical/:token`            | GET     | Token signé HMAC                     | Export iCal `.ics` calendrier Will (consultation cross-device)                                                       |
| `/api/admin/bookings/:id/refund`             | POST    | Cookie admin + `requireAdminWrite()` | Wrapper `triggerRefundAction`                                                                                        |
| `/api/booking/self-service/:token`           | GET     | Token signé `gdpr-token.ts` factor   | Affiche page client annulation/reschedule                                                                            |
| `/api/booking/self-service/:token/cancel`    | POST    | idem                                 | Wrapper `requestCancellationByUserAction`                                                                            |
| ~~`/api/onboarding/upload/:token`~~          | —       | —                                    | **RETIRÉ V1 (D58)** — onboarding géré hors-app par email pour V1. V1.5+ formulaire structuré.                        |
| ~~`/api/stripe/customer-portal/:bookingId`~~ | —       | —                                    | **RETIRÉ V1 (D56)** — factures envoyées par email PJ uniquement. Hook V2+ préservé via `Payment.providerCustomerId`. |
| `/api/admin/geo/heatmap`                     | GET     | Cookie admin + read                  | JSON heatmap semaine (cf. §5.15)                                                                                     |

**Routes pages publiques bilingues — D44 parcours B (nouvelles)** :

| Route                            | Méthode | Locale | Rôle                                                                                                                                                                                                               |
| -------------------------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/fr/demande-devis`              | GET     | FR     | Page publique formulaire qualifié parcours B (formats avec devis : IA Custom, transformation collective custom, packs annuels, sur-mesure > 5 000 € HT). Accepte query `?intervention=<slug>` pour préfill format. |
| `/en/request-quote`              | GET     | EN     | Idem EN.                                                                                                                                                                                                           |
| `/fr/demande-devis/confirmation` | GET     | FR     | Confirmation post-`submitQuoteRequestAction` : « Demande reçue. William vous recontactera sous 24-48h pour cadrage. »                                                                                              |
| `/en/request-quote/confirmation` | GET     | EN     | Idem EN.                                                                                                                                                                                                           |

Formulaire qualifié `/demande-devis` (10-12 champs) : entreprise (raison sociale), taille INSEE (`CompanySize` enum), secteur (liste `companySectors`), contact (nom, email, téléphone), format souhaité (select dérivé `interventions-taxonomy.ts`), contexte business (textarea 200-500 mots), budget pressenti (input optionnel), timing en semaines, lieu (ville + déplacement Oui/Non), nombre de participants estimé, consentement CGV, consentement RGPD. Côté serveur : `submitQuoteRequestAction` (V4) → `Submission(type='quote_request', status='new')` + email visiteur `quote-request-received` + Telegram Will `QUOTE_REQUEST_RECEIVED`. **AUCUN slot calendrier réservé** (D45 — la négociation reste « ouverte » côté calendrier admin).

**Doctrine critique** (cf. Agent 8 P0-4) : `next.config.ts` doit déclarer `experimental.serverActions.allowedOrigins = ['axion-ia.com', 'www.axion-ia.com']` pour empêcher CSRF cross-origin sur Server Actions derrière proxy Cloudflare / Coolify.

---

## 5.4 Admin navigation cible V1 (mockup ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│  AXION-IA · ADMIN                       [Will ▾]  [TEST/LIVE]   │
├──────────────────────┬──────────────────────────────────────────┤
│ ▸ DASHBOARD          │                                          │
│   - KPIs paiements   │                                          │
│   - Capacité semaine │                                          │
│   - À traiter        │ (parcours A + B nouvelles demandes)      │
│   - Demandes devis B │ (Submissions en négo)                    │
│   - En attente client│ (status=contract_payment_sent)           │
│   - Prêts à valider  │ (D49 — status=awaiting_admin_validation) │
│   - Validés          │ (status=confirmed)                       │
│   - Alertes (geo/J7) │                                          │
│                      │                                          │
│ ▸ CALENDRIER         │                                          │
│   - Mois             │                                          │
│   - Semaine          │                                          │
│   - Jour             │                                          │
│   - Heatmap géo      │                                          │
│   - 5 statuts (4 visiteur 🟢🟠🟡🔴 + 1 admin ⚫ invisible)        │
│                      │                                          │
│ ▸ DEMANDES           │ (parcours A — BookingOption pending_val) │
│   - À valider (N)    │                                          │
│   - En cadrage       │                                          │
│   - Refusées         │                                          │
│   - Expirées         │                                          │
│                      │                                          │
│ ▸ DEMANDES DEVIS     │ (parcours B — Submission quote_request)  │
│   - Nouvelles (N)    │  status=new                              │
│   - En qualification │  status=qualifying                       │
│   - En négociation   │  status=negotiating                      │
│   - Converties       │  status=converted (→ Booking lié)        │
│   - Perdues          │  status=lost                             │
│   - Archivées        │  status=archived                         │
│                      │                                          │
│ ▸ RÉSERVATIONS       │ (Bookings post-validation, A + B fusion) │
│   - Toutes           │                                          │
│   - En cours         │                                          │
│   - Terminées        │                                          │
│   - Annulées         │                                          │
│                      │                                          │
│ ▸ CLIENTS (CRM 360°) │                                          │
│   - Liste            │                                          │
│   - Fiche entreprise │                                          │
│   - Historique       │                                          │
│                      │                                          │
│ ▸ PAIEMENTS          │                                          │
│   - Dashboard        │                                          │
│   - Échéances        │                                          │
│   - Retards          │                                          │
│   - Saisie manuelle  │                                          │
│   - Export CSV       │                                          │
│                      │                                          │
│ ▸ FACTURES & DEVIS   │                                          │
│   - Factures émises  │                                          │
│   - Avoirs           │                                          │
│   - Devis envoyés    │                                          │
│   - Numérotation     │                                          │
│                      │                                          │
│ ▸ CONTRATS           │                                          │
│   - En attente sign  │                                          │
│   - Signés           │                                          │
│   - DocuSeal status  │                                          │
│                      │                                          │
│ ▸ FRAIS ACCESSOIRES  │ (saisie rapide pré-facture solde)        │
│   - Bookings actifs  │                                          │
│   - Justificatifs    │                                          │
│                      │                                          │
│ ▸ TARIFS & TVA       │                                          │
│   - PricingConfig    │                                          │
│   - Mention TVA      │                                          │
│   - Reverse charge   │                                          │
│                      │                                          │
│ ▸ ÉCHÉANCIERS        │                                          │
│   - Profils défaut   │                                          │
│   - Custom overrides │                                          │
│                      │                                          │
│ ▸ TEMPLATES          │                                          │
│   - Contrats Tiptap  │                                          │
│   - Emails (30 tpls) │                                          │
│   - Variables {{ }}  │                                          │
│                      │                                          │
│ ▸ CONTENU            │                                          │
│   - Blog             │                                          │
│   - Études de cas    │                                          │
│   - FAQ              │                                          │
│   - Aide / Témoign.  │                                          │
│   - Catégories       │                                          │
│                      │                                          │
│ ▸ MARKETING          │                                          │
│   - Newsletter       │                                          │
│   - Alertes slots    │                                          │
│                      │                                          │
│ ▸ SYSTÈME            │                                          │
│   - Utilisateurs     │                                          │
│   - 2FA              │                                          │
│   - SiteSettings     │                                          │
│   - Paramètres délais│ (/admin/parametres-delais — D52)          │
│   - Journal activité │                                          │
│   - Infra & alertes  │                                          │
│   - Webhook events   │                                          │
│                      │                                          │
│ [hors V1, non affiché]                                          │
│   - Sessions form.   │                                          │
│   - Qualiopi         │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

**16 sections principales** (sans Qualiopi/sessions) — hausse vs version précédente (15) : section dédiée **« DEMANDES DEVIS »** ajoutée pour parcours B (D44). Mobile : sidebar drawer < 1024px.

**Distinction A vs B (P1-2)** :

- `/admin/demandes` → liste `BookingOption.status IN ('pending_validation','cadrage_scheduled','cadrage_held')` — pipeline A (visiteur a choisi un slot dans `/reserver`).
- `/admin/demandes-devis` → liste `Submission WHERE type='quote_request' AND status IN ('new','qualifying','negotiating')` — pipeline B (visiteur a soumis `/demande-devis`, négo hors-app en cours).
- Colonnes communes : Société / Taille INSEE / Format / Date soumission / Statut / Actions.
- Pour parcours B : colonnes additionnelles « Montant pressenti » + « Notes call » + « Dernière activité » + bouton « Convertir en Booking » → ouvre **Drawer parcours B** (cf. §5.11.3).

---

## 5.5 State machine cible V1 (~23 valeurs effectives V1, incl. `awaiting_admin_validation` D51)

Source : Agent 3 §5 (re-validé pour V1 finale).

### 5.5.1 Diagramme ASCII complet

```
                                  ┌─────────────┐
                                  │  draft (UI) │   visiteur remplit form
                                  └──────┬──────┘
                                         │ submit (multi-options autorisées jusqu'à cap)
                                         ▼
                                  ┌────────────────────┐
                                  │ option_pending     │ → email visiteur + Telegram Will
                                  └────────┬───────────┘
                                           │
        ┌──────────────────────────────────┼─────────────────────────────────────────┐
        │ Will valide                      │ Will refuse              expired_no_response │
        ▼                                  ▼                                ▼              │
 ┌─────────────────┐         ┌────────────┐                  ┌────────────────────┐       │
 │cadrage_scheduled│         │  refused   │                  │ expired_no_response│       │
 │(autres opts du  │         └────────────┘                  └────────────────────┘       │
 │ slot →          │                                                                       │
 │  lost_other_won)│                                                                       │
 └───────┬─────────┘                                                                       │
         │ Will marque cadrage tenu                                                        │
         ▼                                                                                 │
 ┌─────────────────┐                                                                       │
 │  cadrage_held   │                                                                       │
 └────────┬────────┘                                                                       │
          │                                                                                │
   ┌──────┼──────────┬─────────────────┐                                                   │
   │      │          │                 │                                                   │
   │ NEGATIVE      POSITIVE       reschedule                                               │
   ▼      │          │                 │                                                   │
 ┌─────────────────┐ │                  │                                                  │
 │cadrage_declined │ │                  └─→ option_pending (retour)                        │
 │(refund total)   │ │                                                                     │
 └─────────────────┘ │                                                                     │
                     │                                                                     │
        ┌────────────┴────────────┐                                                        │
        │ quoteRequired? (Pricing) │                                                       │
        ├──────────────┬──────────┘                                                        │
        │ OUI          │ NON                                                                │
        ▼              │                                                                    │
 ┌───────────────┐     │                                                                    │
 │  quote_sent   │     │                                                                    │
 │  (DocuSeal)   │     │                                                                    │
 └───────┬───────┘     │                                                                    │
         │             │                                                                    │
   ┌─────┴─────┐       │                                                                    │
   │           │       │                                                                    │
 signed      declined  │                                                                    │
   │           │       │                                                                    │
   │           ▼       │                                                                    │
   │     quote_declined│                                                                    │
   │     (refund)      │                                                                    │
   │                   │                                                                    │
   └───────────┬───────┘                                                                    │
               ▼                                                                            │
       ┌─────────────────┐                                                                  │
       │ contract_pending│ ← écran saisie admin D55 (frais + Tiptap contrat ; PAS de seuil) │
       │ (D55 saisie)    │                                                                  │
       └────────┬────────┘                                                                  │
                │ clic Will "Envoi contrat + demande acompte" (D49 sendContractAndDeposit)  │
                ▼                                                                            │
       ┌──────────────────────┐                                                              │
       │ contract_payment_sent│ (DocuSeal envoyé + Stripe Checkout actif — slot 🟠)         │
       └────────┬─────────────┘                                                              │
                │                                                                            │
        ┌───────┴─────────────────┐                                                          │
        │ webhook DocuSeal signed │ acompte reçu (webhook Stripe OU virement manuel)         │
        ▼                         ▼                                                          │
 ┌─────────────────┐    ┌────────────────────────────┐                                       │
 │ contract_signed │    │ awaiting_admin_validation  │ (D51 — slot reste 🟠)                 │
 │ (PAS bloquant   │    │ (badge ⚠️ "Contrat à        │                                      │
 │  D50 — signature│    │  signer le jour J" si      │                                      │
 │  jour J ok)     │    │  contract_signed manquant) │                                      │
 └─────────────────┘    └────────────┬───────────────┘                                       │
                                     │ clic Will "Valider sur le calendrier" (D49 — A1bis)  │
                                     ▼                                                       │
                            ┌────────────────┐                                               │
                            │   confirmed    │ (SLOT 🔴 — email booking-validated-on-calendar)│
                            └─────┬──────────┘                                               │
                                  │                                                          │
        ┌─────────────────────────┴──────────────┐                                            │
        │                                         │                                          │
   (transition normale)                  expired (cron D52 si rien reçu après 5j             │
                                         OU contrat signé sans acompte 10j → annulation D53) │
        │                                         │                                          │
        ▼                                         ▼                                          │
 ┌────────────┐                          ┌──────────────────┐                                │
 │ confirmed  │ (déjà ci-dessus)         │ expired_no_resp. │ (cron `option-expiration-rien- │
 └─────┬──────┘                          │ OU cancelled_by_ │  recu` D52, ou clause D53)     │
       │                                  │ admin (D53)      │                                │
       │                                  └──────────────────┘                                │
       │                                                                                    │
       │ cron J-7                                                                           │
       ▼                                                                                    │
 ┌─────────────┐                                                                            │
 │reminded_j7  │ + facture solde émise (si échéancier prévoit)                              │
 └─────┬───────┘                                                                            │
       │ cron jour J 00:00                                                                  │
       ▼                                                                                    │
 ┌──────────────┐                                                                           │
 │ in_progress  │                                                                           │
 └─────┬────────┘                                                                           │
       │ cron J+1 OU admin manuel                                                           │
       ▼                                                                                    │
 ┌─────────────┐                                                                            │
 │ completed   │                                                                            │
 └─────┬───────┘                                                                            │
       │ auto T17                                                                           │
       ▼                                                                                    │
 ┌─────────────────┐                                                                        │
 │invoiced_balance │                                                                        │
 └─────┬───────────┘                                                                        │
       │ webhook stripe ou recordPaymentAction (manuel)                                     │
       ▼                                                                                    │
 ┌─────────────┐                                                                            │
 │paid_balance │ (terminal succès)                                                           │
 └─────┬───────┘                                                                            │
       │ cron retention ≥ 12 mois                                                            │
       ▼                                                                                    │
 ┌─────────────┐                                                                            │
 │  archived   │                                                                            │
 └─────────────┘                                                                            │
                                                                                            │
 BRANCHES TRANSVERSALES (déclenchables depuis quasi-tout état) :                           │
   - cancelled_by_user (magic-link) → refund selon grille CGV (≥J-15=50% refund acompte / <J-15=0% refund / fm=100%)│
   - cancelled_by_admin → refund selon décision admin                                       │
   - no_show (J+1) → acompte conservé + invoice solde émise                                │
   - force_majeure → refund total + slot libéré + reschedulePriority=true                  │
   - refunded_partial / refunded_full → état dérivé (Refund row)                            │
```

~23 valeurs effectives en `BookingStatus` V1 (incl. `awaiting_admin_validation` D51 entre `contract_payment_sent` et `confirmed`, plus `draft` UI uniquement hors DB). Cf. Agent 3 §5.2 pour le détail des transitions (table de mapping). Branches transversales toujours valides : `cancelled_by_user`, `cancelled_by_admin`, `no_show`, `force_majeure`, `refunded_partial/full`.

### 5.5.2 Cas particulier `audit_flash_onsite`

```
option_pending → (SKIP cadrage) → contract_pending (saisie admin D55)
              → contract_payment_sent (slot 🟠) → awaiting_admin_validation (D51)
              → confirmed (clic Will "Valider sur le calendrier" D49, slot 🔴) → ... → archived
```

Skip cadrage car format défini d'avance (audit terrain 890 € fixe). Comme D55 supprime le seuil 1 500 € HT, l'écran de saisie admin (frais + Tiptap contrat) reste obligatoire AUSSI pour `audit_flash_onsite`.

---

## 5.6 Crons & workers cible V1 (~24 jobs au total V1)

Pattern existant : `BullMQ` + `Redis` + `ioredis` (cf. `00-REALITY-CHECK.md` §5). Reuse + extend.

| #      | Worker                                                            | Trigger    | Fréquence                         | Action                                                                                                                                                                                                                                                                                                                                                                                                                                            | Idempotence                                                                                                                         |
| ------ | ----------------------------------------------------------------- | ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `option-expiration-worker`                                        | repeatable | `*/5 * * * *`                     | flip `option_pending` → `expired_no_response` si `expiresAt < now` (existant, étendre)                                                                                                                                                                                                                                                                                                                                                            | verrou pessimiste + status guard                                                                                                    |
| 2      | `option-reminder-worker`                                          | repeatable | `0 * * * *`                       | rappel H+24 si option encore pending (existant)                                                                                                                                                                                                                                                                                                                                                                                                   | sentinel `reminderSentAt`                                                                                                           |
| 3      | `deposit-expiration-worker`                                       | repeatable | `*/5 * * * *`                     | flip `deposit_pending` → `expired` si `paymentDeadline < now` (sans refund)                                                                                                                                                                                                                                                                                                                                                                       | sentinel + status guard                                                                                                             |
| 4      | `payment-deposit-reminder-j-3`                                    | repeatable | `0 9 * * *`                       | email + Telegram J-3 avant échéance                                                                                                                                                                                                                                                                                                                                                                                                               | sentinel `j3ReminderSentAt` par échéance                                                                                            |
| 5      | `payment-reminder-j-plus-1`                                       | repeatable | `0 10 * * *`                      | email soft + Telegram à J+1 retard                                                                                                                                                                                                                                                                                                                                                                                                                | sentinel `j1OverdueAt`                                                                                                              |
| 6      | `payment-reminder-j-plus-15`                                      | repeatable | `0 10 * * *`                      | email ferme + Telegram à J+15 retard                                                                                                                                                                                                                                                                                                                                                                                                              | sentinel                                                                                                                            |
| 7      | `payment-reminder-j-plus-30`                                      | repeatable | `0 10 * * *`                      | Telegram urgent « recouvrement » + flag booking                                                                                                                                                                                                                                                                                                                                                                                                   | sentinel                                                                                                                            |
| 8      | `cadrage-reminder-j-1`                                            | repeatable | `0 18 * * *`                      | rappel J-1 cadrage scheduled                                                                                                                                                                                                                                                                                                                                                                                                                      | sentinel                                                                                                                            |
| 9      | `cadrage-reminder-h-2`                                            | repeatable | `*/15 * * * *`                    | rappel H-2 visio link                                                                                                                                                                                                                                                                                                                                                                                                                             | sentinel                                                                                                                            |
| 10     | `contract-expiration-j-plus-7`                                    | repeatable | `0 11 * * *`                      | relance signature si contrat `sent` depuis > 7j                                                                                                                                                                                                                                                                                                                                                                                                   | sentinel                                                                                                                            |
| 11     | `installment-due-reminder-j-7`                                    | repeatable | `0 9 * * *`                       | rappel J-7 avant échéance                                                                                                                                                                                                                                                                                                                                                                                                                         | sentinel par installmentN                                                                                                           |
| 12     | `booking-j-7-balance-invoice`                                     | repeatable | `0 7 * * *`                       | génère Invoice solde + envoie email si échéancier prévoit                                                                                                                                                                                                                                                                                                                                                                                         | sentinel `j7ReminderSentAt`                                                                                                         |
| 13     | `booking-j-1-reminder`                                            | repeatable | `0 18 * * *`                      | reminder J-1 client + Will                                                                                                                                                                                                                                                                                                                                                                                                                        | sentinel                                                                                                                            |
| 14     | `booking-j-0-checkin`                                             | repeatable | `0 0 * * *` (TZ Europe/Paris)     | flip → `in_progress`                                                                                                                                                                                                                                                                                                                                                                                                                              | sentinel `inProgressAt`                                                                                                             |
| 15     | `booking-completion-auto`                                         | repeatable | `0 19 * * *`                      | flip → `completed` auto si admin pas marqué (NPS J+1 retiré V1 D57 — pas d'email debrief)                                                                                                                                                                                                                                                                                                                                                         | sentinel `completedAt`                                                                                                              |
| 16     | `geo-conflict-check`                                              | on-demand  | à chaque création `BookingOption` | calcule distance avec bookings J-2/J-1/J+1/J+2 + alerte Telegram si > 300 km                                                                                                                                                                                                                                                                                                                                                                      | non applicable (one-shot)                                                                                                           |
| 17     | `capacity-recompute`                                              | repeatable | `0 3 * * *` UTC                   | recompute `CapacityWindow.currentBookings`                                                                                                                                                                                                                                                                                                                                                                                                        | timestamp `recomputedAt`                                                                                                            |
| 18     | `webhook-dlq-retry`                                               | repeatable | `*/10 * * * *`                    | retry webhooks Stripe + DocuSeal failed (max retryCount = 5)                                                                                                                                                                                                                                                                                                                                                                                      | dans `StripeWebhookEvent.retryCount`                                                                                                |
| 19     | `retention-purge-worker`                                          | repeatable | `0 3 * * *` UTC                   | purge `archived` ≥ 12 mois (existant)                                                                                                                                                                                                                                                                                                                                                                                                             | hard delete + emailHash log                                                                                                         |
| 20     | `refund-trigger`                                                  | on-demand  | à la demande                      | exécute Stripe `refunds.create` async                                                                                                                                                                                                                                                                                                                                                                                                             | dans `Refund.id` UNIQUE                                                                                                             |
| **21** | **`negotiation-stalled-reminder`** (D48 — parcours B)             | repeatable | `0 8 * * *`                       | scan `Submission WHERE type='quote_request' AND status IN ('qualifying','negotiating') AND updatedAt < now - 7d` → Telegram Will à J+7, J+14, J+30 avec récap (montant pressenti, dernier contact). Email visiteur uniquement à J+30 (« Devis encore d'actualité ? »).                                                                                                                                                                            | sentinels `lastStalledReminderAt` + level (`j7/j14/j30`) sur `Submission.details`                                                   |
| **22** | **`contract-signed-without-deposit-reminder`** (D48 — cas A et B) | repeatable | `0 9 * * *`                       | scan Bookings `contract_signed && deposit_pending` → email client `contract-signed-payment-pending-relance` (J+1/J+3/J+7) + Telegram Will. À `contractSignedWithoutDepositCutoffDays` (default 10j, D52) → trigger auto-annulation via cron `contract-signed-without-deposit-cancel` (clause CGV D53 invoquée).                                                                                                                                   | sentinels par échéance                                                                                                              |
| **23** | **`option-expiration-rien-recu`** (D52 — nouveau)                 | repeatable | `0 9 * * *`                       | scan Bookings `contract_payment_sent` sans signature ET sans paiement reçu depuis > `optionExpirationDaysIfNothingReceived` (default 5j, D52) → email visiteur `option-near-expiration-j-1-soft` (J-1 du seuil) puis `option-expired-no-response` à expiration + libération slot + Telegram Will.                                                                                                                                                 | sentinels par échéance                                                                                                              |
| **24** | **`installment-overdue-escalation`** (D59 — nouveau)              | repeatable | `0 10 * * *`                      | scan `BookingPaymentSchedule.installments[N]` avec `dueAt < now()` ET `status='pending'` → escalade graduelle : J+3 retard = email soft `installment-overdue-soft` (#56) ; J+15 = email ferme `installment-overdue-firm` (#57) ; J+30 = Telegram Will urgent + flip `Booking.status='installment_overdue'` ; J+45 = flip `Booking.status='disputed'` (état terminal, recouvrement hors-app par Will) + email `installment-disputed-notice` (#58). | sentinels par échéance + level (`j3/j15/j30/j45`) sur `BookingPaymentSchedule.installments[N].lastEscalationAt` + `escalationLevel` |
| **25** | **`paused-resume-reminder`** (D61 — nouveau)                      | repeatable | `0 8 * * *`                       | scan Bookings `status='paused'` AND `pausedUntil IS NOT NULL` → Telegram Will à `pausedUntil - 7j`, `pausedUntil - 1j`, et `pausedUntil` lui-même (rappel manuel reprise booking via `resumeBookingAction` A20).                                                                                                                                                                                                                                  | sentinels `lastPausedReminderAt` + level (`j7/j1/j0`)                                                                               |

> Note D57 : le cron `booking-j1-debrief` est **retiré V1** (NPS non implémenté). Total V1 = **~24 jobs cron** (23 numérotés ci-dessus + `option-expiration` + `option-reminder` + `retention-purge` existants - `booking-j-1-debrief` retiré + jobs 21/22 D48 + 23 D52 + **24 D59 + 25 D61** ultime).

DLQ + Sentry Crons pour chaque worker (~24 monitors). Concurrency `1` pour les workers à effet de bord transactionnel (locks pessimistes), concurrency 8 pour `emails`.

---

## 5.7 Templates emails cible V1 (~30 templates FR/EN)

Dossier : `src/lib/email/templates/`. Pattern existant : 1 template `.tsx` par type, dispatch via `renderEmailTemplate(template, locale, payload)`. Locale param FR/EN.

### 5.7.1 Liste des ~30 templates V1

| #      | Template                                                                 | Trigger                                                                                     | Destinataire                                                                                                                          |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `booking-option-received`                                                | `createBookingOptionAction` (visiteur)                                                      | visiteur (« Demande reçue, William vous recontacte sous 48h »)                                                                        |
| 2      | `booking-option-validated`                                               | `validateBookingOptionAction` (admin)                                                       | client validé (« Félicitations, créneau confirmé. Contrat à signer + lien paiement »)                                                 |
| 3      | `booking-option-refused`                                                 | `refuseBookingOptionAction`                                                                 | client refusé                                                                                                                         |
| 4      | `booking-option-lost-other-won`                                          | trigger A1 cascade                                                                          | autres pré-réservataires + 3 dates alternatives suggérées                                                                             |
| 5      | `booking-option-expired-no-response`                                     | cron `option-expiration-worker`                                                             | client (sans relance Will à temps)                                                                                                    |
| 6      | `cadrage-scheduled`                                                      | `scheduleCadrageMeetingAction`                                                              | client (lien visio Meet/Whereby/Jitsi + ICS attaché)                                                                                  |
| 7      | `cadrage-reminder-j-1`                                                   | cron                                                                                        | client + Will                                                                                                                         |
| 8      | `cadrage-reminder-h-2`                                                   | cron                                                                                        | client                                                                                                                                |
| 9      | `cadrage-declined`                                                       | `markCadrageHeldAction` (NEGATIVE)                                                          | client (refund éventuel mentionné)                                                                                                    |
| 10     | `quote-sent`                                                             | `emitQuoteAction`                                                                           | client (lien DocuSeal signature)                                                                                                      |
| 11     | `quote-signed`                                                           | webhook DocuSeal                                                                            | client + Will                                                                                                                         |
| 12     | `contract-sent`                                                          | `sendContractForSignatureAction`                                                            | client (lien DocuSeal)                                                                                                                |
| 13     | `contract-signed`                                                        | webhook DocuSeal                                                                            | client + Will                                                                                                                         |
| 14     | `payment-link-checkout`                                                  | trigger T11 (Stripe Checkout créé)                                                          | client (lien Stripe Checkout, expire J+N)                                                                                             |
| 15     | `payment-receipt`                                                        | webhook Stripe `payment_intent.succeeded`                                                   | client (facture jointe PDF)                                                                                                           |
| 16     | `payment-manual-receipt`                                                 | `recordPaymentAction` (virement saisi admin)                                                | client (confirmation paiement virement reçu)                                                                                          |
| 17     | `installment-due-j-7`                                                    | cron `installment-due-reminder-j-7`                                                         | client                                                                                                                                |
| 18     | `installment-overdue-j-1`                                                | cron `payment-reminder-j-plus-1`                                                            | client                                                                                                                                |
| 19     | `installment-overdue-j-15`                                               | cron `payment-reminder-j-plus-15`                                                           | client                                                                                                                                |
| 20     | `installment-overdue-j-30`                                               | cron `payment-reminder-j-plus-30`                                                           | client + Will Telegram                                                                                                                |
| 21     | `invoice-balance-issued`                                                 | trigger T17                                                                                 | client (PDF joint)                                                                                                                    |
| 22     | `booking-j-7-reminder`                                                   | cron `booking-j-7-balance-invoice`                                                          | client (rappel + facture solde si due)                                                                                                |
| 23     | `booking-j-1-reminder`                                                   | cron `booking-j-1-reminder`                                                                 | client                                                                                                                                |
| 24     | **`booking-validated-on-calendar`** (D49 — nouveau)                      | clic Will "Valider sur le calendrier" → `validateBookingOnCalendarAction`                   | client validé final (slot 🔴, intervention confirmée). Remplace `booking-debrief-j-plus-1` retiré V1 (D57).                           |
| 25     | `booking-cancelled-by-user`                                              | `requestCancellationByUserAction`                                                           | client (montant refund auto-calculé)                                                                                                  |
| 26     | `booking-cancelled-by-admin`                                             | `cancelBookingByAdminAction`                                                                | client (motif + refund éventuel) — **V1.5 optionnel**                                                                                 |
| 27     | `booking-no-show`                                                        | `markNoShowAction`                                                                          | client (acompte conservé, motif) — **V1.5 optionnel**                                                                                 |
| 28     | `booking-force-majeure`                                                  | `markForceMajeureAction`                                                                    | client (refund total + reschedule priorité) — **V1.5 optionnel**                                                                      |
| 29     | `refund-issued`                                                          | webhook Stripe `charge.refunded` OU `triggerRefundAction` manuel                            | client (avoir joint) — **V1.5 optionnel**                                                                                             |
| 30     | `slot-alert-released`                                                    | cron alerte slot libéré                                                                     | client `waitlist` (« créneau libéré, postulez ») — **V1.5 optionnel**                                                                 |
| **31** | **`quote-request-received`** (D44 — parcours B)                          | `submitQuoteRequestAction` (V4)                                                             | visiteur (« Demande de devis reçue. William vous recontactera sous 24-48h pour cadrage. »)                                            |
| **32** | **`quote-sent-from-negotiation`** (D44 — parcours B)                     | `createBookingFromSubmissionAction` (A16) — étape devis                                     | client (lien DocuSeal devis post-négociation, distinct de `quote-sent` X.13 #33 qui suit cadrage formel)                              |
| **33** | **`contract-sent-with-deposit-link`** (D44 — parcours B)                 | `createBookingFromSubmissionAction` (A16) — bundle final                                    | client (email **unifié** : devis DocuSeal + contrat DocuSeal + lien paiement Stripe — distinct de `contract-sent` qui suit cadrage A) |
| **34** | **`booking-confirmed-after-negotiation`** (D44 — parcours B)             | trigger paid deposit + signed contract pour `originPath='quote_negotiation'`                | client (variante de `booking-confirmed` adaptée au contexte négo B)                                                                   |
| **35** | **`negotiation-stalled-reminder`** (D48 — parcours B)                    | cron `negotiation-stalled-reminder` (job #21)                                               | **Will (Telegram)** + visiteur à J+30 uniquement                                                                                      |
| **36** | **`option-near-expiration-j-1-soft`** (D52 — nouveau)                    | cron `option-expiration-rien-recu` (J-1 du seuil)                                           | client (rappel doux : « Plus que 1 jour pour confirmer votre demande »)                                                               |
| **37** | **`option-near-expiration-j-3-firm`** (D52 — optionnel selon seuil >3j)  | cron (J-3 ou variant)                                                                       | client (ton ferme : risque d'expiration imminente)                                                                                    |
| **38** | **`option-expired-no-response`** (D52 — nouveau, remplace #5 historique) | cron `option-expiration-rien-recu` à expiration                                             | client (notification expiration définitive, slot libéré)                                                                              |
| **39** | **`contract-signed-payment-pending-relance-j1`** (D52 — nouveau)         | cron `contract-signed-without-deposit-reminder` à J+1 après signature contrat sans paiement | client (relance soft)                                                                                                                 |
| **40** | **`contract-signed-payment-pending-relance-j3`** (D52 — nouveau)         | cron à J+3                                                                                  | client (relance ferme)                                                                                                                |
| **41** | **`contract-signed-payment-pending-relance-j7`** (D52 — nouveau)         | cron à J+7                                                                                  | client (relance dernière chance avant invocation D53)                                                                                 |
| **52** | **`booking-rescheduled-by-admin`** (D60 — nouveau)                       | A18 `rescheduleBookingByAdminAction` si `notifyClient=true`                                 | client (notification décalage admin + nouveau `.ics` attaché)                                                                         |
| **53** | **`booking-paused-confirmation`** (D61 — nouveau)                        | A19 `pauseBookingAction`                                                                    | client (confirmation suspension projet + `pausedUntil` + motif)                                                                       |
| **54** | **`booking-resumed-notification`** (D61 — nouveau)                       | A20 `resumeBookingAction`                                                                   | client (reprise booking + nouveau `.ics` attaché)                                                                                     |
| **55** | **`contract-version-updated`** (D62 — nouveau)                           | A21 `cancelAndReissueContractAction` OU A22 `createContractAddendumAction`                  | client (nouvelle version contrat envoyée — précise « ignorer le précédent » si A21, OU « avenant complémentaire » si A22)             |
| **56** | **`installment-overdue-soft`** (D59 — nouveau)                           | cron `installment-overdue-escalation` J+3 retard                                            | client (relance soft échéance N+1/N+2 en retard)                                                                                      |
| **57** | **`installment-overdue-firm`** (D59 — nouveau)                           | cron `installment-overdue-escalation` J+15 retard                                           | client (relance ferme — mention conséquences)                                                                                         |
| **58** | **`installment-disputed-notice`** (D59 — nouveau)                        | cron `installment-overdue-escalation` J+45 retard                                           | client (notification basculement statut `disputed` + recouvrement hors-app par Will) + Will Telegram                                  |

V1 cap fonctionnel : **~36 nouveaux templates V1 strictement requis** (1–25 cadrage/booking A + 31–35 parcours B + #45 D49 + #46-51 D52 + #52 D60 + #53-54 D61 + #55 D62 + #56-58 D59 ; #26-30 V1.5 optionnels). + ~14 templates existants V0 réutilisés = **~50 templates au total**. Le template `booking-debrief-j-plus-1` (NPS J+1) est **retiré V1** (D57).

### 5.7.2 RFC 8058 (List-Unsubscribe)

Hérité Sprint 24 (cf. `00-REALITY-CHECK.md` §9 #12 verdict 🟢 OK) — appliqué automatiquement par `email-worker.ts`. Newsletter ET transactionnels via `unsubscribeToken`.

### 5.7.3 i18n FR + EN

Toutes les variables typées via `EmailPayload<TemplateName>`. Doubles fichiers `.tsx` non requis : signature unique `renderEmailTemplate(template, locale, payload)` (pattern existant).

---

## 5.8 Architecture conformité légale V1

### 5.8.1 CGV TVA-agnostique (Agent 11 P0-4 + P0-5)

`src/content/legal.ts` doit extraire :

- `vatClause` typé multi-scenarios (`scenarioA_FR` / `scenarioB_EE`).
- `jurisdictionClause` typé idem.
- Clauses nouvelles V1 :
  - **Acompte / échéancier** : remplace ancienne clause « acompte 50 % » par doctrine échéancier dérivé du `PaymentScheduleProfile`. Mention « Acompte non-remboursable au-delà du délai J-X » (X = 7j default).
  - **Cession droits** (Agent 11 P0-6) : licence d'usage interne par défaut V1, cession pleine sur option (devis spécifique).
  - **Confidentialité réciproque** (P0-7) : 3 ans post-fin contrat.
  - **Résiliation** (P1-5) : pour faute grave (impayé > 30j, manquement matériel) + préavis 14j.
  - **Public B2B exclusif** (P1-4) : « exclut consommateurs au sens L612-1 Code conso FR ».
  - **Force majeure étendue (définition contractuelle précise)** : référence article 1218 Code civil FR (« événement échappant au contrôle du débiteur, qui ne pouvait être raisonnablement prévu lors de la conclusion du contrat et dont les effets ne peuvent être évités par des mesures appropriées ») + équivalent EE (Võlaõigusseadus §103 « vis maior »). Liste **inclusive** : grève généralisée des transports impactant déplacement Will ; catastrophe naturelle (tempête, inondation, etc.) ; hospitalisation Will (certificat médical sous 48h) ; panne infra majeure non résolvable > 48h (Hetzner DC down, Cloudflare panne globale) ; restrictions sanitaires gouvernementales empêchant le déplacement. Liste **exclusive** (PAS force majeure) : manque de préparation du client (matériel non fourni, participants absents non-justifiés) ; retards administratifs prévisibles ; manque de motivation côté client ; aléas commerciaux normaux ; surcharge opérationnelle Will sans cause externe.

### 5.8.2 Numérotation immuable (Agent 11 P1-6)

- Format `AXION-2026-NNNN` séquentiel atomique.
- Postgres advisory lock `pg_advisory_xact_lock(hashtextextended('invoice_seq_2026', 0))` avant INSERT.
- Avoirs (`credit_note`) : numéro propre dans la même séquence.
- Pas de suppression de facture émise jamais (status `void` uniquement).

### 5.8.3 Archivage 10 ans (Agent 11 P1-7 + Agent 4 D30)

- `Invoice.archivedUntil = issuedAt + 10 ans` (couvre FR L123-22 / L102B + EE Raamatupidamise §12 conservative).
- Stockage : Hetzner Storage Box AES-256 (couvert par DPA Hetzner existant).
- Intégrité : `hashSha256` SHA-256 du PDF stocké.
- Backup disjoint serveur principal.

### 5.8.4 Sous-processeurs cible V1 (`legal.ts` extension)

Actuels (Hetzner / Cloudflare / Telegram) + ajouts V1 obligatoires :

- **Stripe Payments Europe Ltd** (Dublin IE, EU intra). DPA online.
- **DocuSeal self-hosted** : pas un sous-processeur (auto-hébergé Hetzner). Couvert par Hetzner.
- **Mailwizz** (FR/EU). DPA.
- **Sentry** (US/EU). DPA + plan EU.
- **OpenStreetMap Nominatim** (Allemagne, OSMF). API gratuite, pas de PII transmise (uniquement noms de villes). Pas un sous-processeur strict mais à mentionner par transparence.

Création page dédiée `/sous-processeurs` (FR + EN) recommandée P1 (Agent 11 #6).

### 5.8.5 RGPD export étendu

`/api/gdpr-export` (Sprint 24 existant) à étendre pour inclure `Payment`, `Invoice`, `Quote`, `ContractDocument`, `CadrageMeeting`, `OnboardingDoc`, `BookingOption`, `Refund` (cf. Agent 8 P1-2).

### 5.8.6 RGPD erase étendu

`eraseSubmissionAction` étend pour pseudonymiser `Invoice.payerName/Email/Address` (`[ERASED]` + email SHA-256) tout en **conservant** la facture (obligation comptable 10 ans > droit effacement art. 17.3.b). Cf. Agent 4 §6.5.

---

## 5.9 Intégrations externes cible V1

| Intégration                 | Rôle V1                                                                   | Coût                         | Hébergement                                        |
| --------------------------- | ------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| **Stripe**                  | Checkout hosted (acompte + échéances) + Customer Portal + webhooks signés | 1.4% + 0.25€ EU cartes       | SaaS, Dublin                                       |
| **DocuSeal self-hosted**    | eIDAS-SES signature électronique (devis + contrats)                       | Gratuit (open source)        | Docker sur Hetzner CPX32 (~50 MB RAM, ~50 MB disk) |
| **Hetzner Storage Box**     | PDF factures + contrats signés + onboarding docs                          | déjà inclus                  | Hetzner Frankfurt                                  |
| **OpenStreetMap Nominatim** | Geocoding villes (géo-awareness)                                          | Gratuit (rate-limit 1 req/s) | OSMF Allemagne                                     |
| **Telegram Bot API**        | Notifications Will (PII redacted ADR 0010)                                | Gratuit                      | UAE (DPA dérogation art. 49)                       |
| **SMTP / PowerMTA**         | Emails transactionnels (existant)                                         | déjà inclus                  | Hetzner self-hosted                                |
| **Plausible self-hosted**   | Analytics (existant)                                                      | déjà inclus                  | Hetzner                                            |
| **Visio cadrage**           | Lien manuel par Will : Google Meet / Whereby / Jitsi                      | choix par cas, V1 hors-app   | —                                                  |

### 5.9.1 Stripe — récap (cf. Agent 4 détaillé)

- Checkout hosted SAQ-A confirmé.
- Webhook `/api/stripe/webhook` signature + idempotence `StripeWebhookEvent`.
- **Customer Portal Stripe HORS V1 (D56)** — factures envoyées par email PJ uniquement. Hook V2+ préservé via `Payment.providerCustomerId` (cf. §5.10.7bis). Pas d'endpoint customer-portal V1.
- DPA Dashboard signé avant `LIVE_MODE`.
- Stripe Radar activé (gratuit niveau base).
- Domaine custom `billing.axion-ia.com` repoussé V2+ (lié à Customer Portal V2+).

### 5.9.2 DocuSeal — récap (cf. §5.17)

- Self-hosted Docker `ghcr.io/docuseal/docuseal:latest` sur Hetzner CPX32.
- Endpoint API : `https://sign.axion-ia.com/api/submissions`.
- Webhook signé HMAC vers `/api/docuseal/webhook`.
- PDFs signés stockés sur Hetzner Storage Box.
- Validité juridique eIDAS-SES (Simple Electronic Signature) — valable pour 99 % des contrats B2B.

### 5.9.3 OSM Nominatim — récap (cf. §5.15)

- API publique `https://nominatim.openstreetmap.org/search`.
- Rate-limit strict 1 req/s — cache Redis 30j sur résultats (ville normalisée → lat/lng).
- Pas de PII transmise (uniquement noms de villes saisis dans le form public).
- Fallback : si Nominatim down, géo-awareness désactivée pour la session (slot reste cliquable, alerte Telegram Will).

---

## 5.10 Hooks d'extension V2+ (sans implémentation V1)

### 5.10.1 Qualiopi (formation certifiée)

Tables prévues V2+, **non créées V1** :

- `TrainingSession { id, bookingId, startAt, endAt, location, modality, ... }`
- `Attendance { id, sessionId, participantEmail, signedAt, signatureMethod, ... }`
- `Evaluation { id, sessionId, participantEmail, scoreSatisfaction, scoreApprentissage, comments, ... }`
- `Certificate { id, attendanceId, pdfUrl, hashSha256, issuedAt, ... }`

V1 préserve hook : `Booking.trainingSessionId? Uuid` nullable (champ DB préparé sans table associée V1).

### 5.10.2 OPCO workflow (financement formation)

V1 préserve hook : `Invoice.payerType` enum `{client, opco, autre}` avec `client` default V1 (`opco`/`autre` listables V2+ mais pas exposés UI V1). Délais paiement 60-90j à appliquer V2+ via custom `BookingPaymentSchedule`.

### 5.10.3 E-invoicing FR PPF/PDP (réforme 2026-2027)

Conditionnel : dépend décision structure juridique FR vs EE. Hook : `Invoice.pdfUrl` peut pointer vers PDP candidate (Pennylane / Sage / Cegid) une fois intégration V2+. Format Factur-X (PDF/A-3 + XML CII) à prévoir.

### 5.10.4 VIES API

V2+ : validation TVA UE pour reverse charge B2B intra-UE EE. Hook V1 : `Invoice.payerVatNumber` colonne préservée.

### 5.10.5 Multi-currency

V2+ : GBP/USD. Hook V1 : `Payment.currency` + `Invoice.amountTtcCents` déjà multi-devise-ready, mais V1 EUR-only (D22).

### 5.10.6 Stripe Billing subscriptions (maintenance 290 €/mois)

V2+ : abonnement récurrent maintenance post-intervention. Nouvelle state machine `Subscription` séparée de Booking.

### 5.10.7 GoCardless SEPA Direct Debit

V2+ : alternative paiement grands comptes (D+3 à D+5 délai). Hook : `Payment.provider` enum extensible (`gocardless`).

### 5.10.8 Workflow approbation 2-eyes sur refunds > 5 000 €

V2+ : double validation super_admin requise pour refund > 5k€. Hook V1 : `Refund.adminUserId` + `Refund.notes` déjà préservés pour audit trail.

---

## 5.11 Affinements Will-A (devis) + Will-B (multi-options) + Will-C (parcours B D44)

### 5.11.1 Will-A — Devis semi-auto (vs 100 % auto initial)

**Décision Will 2026-05-12** : le devis est **semi-auto, pas 100 % automatique**.

Workflow :

1. Will déclenche `emitQuoteAction(bookingId)` depuis admin.
2. Formulaire **pré-rempli** depuis `PricingConfig` (basePriceHtCents, vatRate, mention TVA, conditions paiement standard).
3. Will **modifie librement** le contenu (Tiptap rich text) : ajouter clauses spécifiques, ajuster montant, modifier validity.
4. Will valide → `Quote.create(status='draft')` + PDF généré + envoi via DocuSeal pour signature électronique.
5. Webhook `submission.completed` DocuSeal → `Quote.status='accepted'` + déclenche chaîne `ContractDocument`.

`quoteRequired` dérivé de `PricingConfig.quoteRequired` (booléen par format) : si `true`, branch `quote_sent` obligatoire avant `contract_pending`. Si `false` (forfait classique), skip directement vers contrat.

### 5.11.2 Will-B — Multi-options simultanées (cap configurable)

**Décision Will 2026-05-12** : le calendrier visiteur a **5 statuts** (vs 3 dans version précédente) — **4 visiteur visibles + 1 admin** :

- 🟢 **Libre** (0 demande active) — cliquable, badge « Demandez ce créneau ». [VISITEUR]
- 🟠 **Pré-réservée** (1+ demandes actives, < cap) — **cliquable**, tooltip « N autres entreprises ont pré-réservé ce créneau. William valide manuellement une demande. Pré-réservez aussi, vous serez recontacté. ». [VISITEUR]
- 🟡 **Cap atteint** (=`SiteSetting.maxConcurrentOptionsPerSlot`, défaut 3) — non cliquable, bouton « M'alerter si libéré » (waitlist). [VISITEUR]
- 🔴 **Validée par Will** — non cliquable, grisée. [VISITEUR]
- ⚫ **Bloquée admin** (Will indisponible) — non cliquable, **invisible visiteur** (rendu comme 🟢 Libre côté public). [ADMIN]

Cap configurable via `SiteSetting.maxConcurrentOptionsPerSlot`. Pas de course à la signature/paiement (Will valide manuellement), donc la nuance « gel slot » s'applique seulement à `validated` (passage 🔴).

Une fois une option validée → autres options actives du même slot → `lost_other_won` → email auto avec 3 dates alternatives proposées (depuis `CapacityWindow` libre).

### 5.11.3 Will-C — Parcours B (devis qualifié sans calendrier visiteur) — D44/D45/D46/D47/D48

**Décision Will 2026-05-12** : pour les formats à tarif sur-mesure (IA Custom 8-50 k€, transformation collective custom, packs annuels, sur-devis > 5 000 € HT), le visiteur ne choisit **pas** de slot calendrier. Il soumet une demande qualifiée → Will négocie hors-app → Will crée manuellement le Booking + envoie tout en 1 clic.

**Diagramme parcours B** :

```
1.  Visiteur → page format (/interventions/ia-custom, /interventions/transformation-collective)
2.  Voit fourchette indicative (« sur devis »)
3.  CTA → /demande-devis?intervention=<slug>                     [route D44]
4.  Form qualifié (10-12 champs)                                  [§5.3 routes B]
5.  Submit → submitQuoteRequestAction (V4)                        [§5.2.1 V4]
    → Submission(type='quote_request', status='new')              [D45 : pas de slot bloqué]
6.  Email auto `quote-request-received` visiteur + Telegram Will  [tpl #31]
7.  NÉGOCIATION HORS-APP (téléphone, email, 2-4 semaines)
    → Will note avancée via updateSubmissionDraftAction (A17)     [P1-4]
    → Submission.status: new → qualifying → negotiating
8.  Will → /admin/demandes-devis → clic « Convertir en Booking »
    → ouvre Drawer parcours B (cf. §5.11.3.bis)
9.  Will saisit dans drawer unifié :
    - Slot picker multi-slots (1..N CalendarSlot via calendrier admin)
    - Montant total HT + frais accessoires (4 lignes)
    - Échéancier (profil dérivé OU custom installments)
    - TVA + reverseCharge selon legal.ts (FR/EE)
    - Éditeur Tiptap CONTRAT (template par défaut pré-rempli)
    - Éditeur Tiptap DEVIS (template par défaut pré-rempli)
10. Clic « Envoyer devis + contrat + lien paiement »
    → createBookingFromSubmissionAction (A16)
    → Booking créé (originPath='quote_negotiation', fromSubmissionId=id)
    → Slots[] → 🔴
    → Quote (DocuSeal) + ContractDocument (DocuSeal) + Invoice deposit
    → Stripe Checkout Session
    → Email UNIFIÉ `contract-sent-with-deposit-link` (#33) au client
    → Submission.status = 'converted'
11. Client signe devis DocuSeal (webhook submission.completed → Quote.signed)
12. Client signe contrat DocuSeal (webhook submission.completed → Contract.signed)
13. Client paie acompte Stripe (webhook checkout.session.completed → confirmed)
14. Email `booking-confirmed-after-negotiation` (#34)
15. Crons J-7/J-1/J+1 standards
```

#### 5.11.3.bis Drawer admin parcours B (D47)

Route : `/admin/demandes-devis/[submissionId]`. Drawer Radix Sheet plein-écran sur desktop, full-height sur mobile.

Sections (ordre d'écran) :

1. **Récap soumission** (read-only) : entreprise, taille INSEE, secteur, contact, format souhaité, contexte business (texte 200-500 mots), budget pressenti, timing semaines, lieu, participants, date de soumission, source UTM.
2. **Pipeline statut** (toggle) : `new → qualifying → negotiating → converted | lost | archived` — bascule via `updateSubmissionDraftAction` (A17).
3. **Notes négociation** (Tiptap libre) : Will saisit les compte-rendus de calls progressifs.
4. **Slot picker multi-slots** : ouvre une vue calendrier admin embedded → Will clique 1 ou plusieurs slots dispo (1 séance = 1 slot ; pack 4 jours = 4 slots ; etc.). Slots restent réservés tentativement (⚫ admin) tant que `createBookingFromSubmissionAction` n'est pas appelée.
5. **Montant & frais** : input `amountHtCents` + 4 inputs (`travelFeeCents`, `accommodationFeeCents`, `mealFeeCents`, `additionalFeesCents` + Tiptap notes).
6. **Échéancier** : select `PaymentScheduleProfile` par défaut OU mode custom (table éditable `customInstallments[]` avec %, dueAt, label).
7. **TVA** : select `vatRate` + checkbox `vatReverseCharge` + textarea `vatMention` (snapshot depuis `legal.ts` FR ou EE).
8. **Éditeur Tiptap CONTRAT** : zone rich-text préremplie depuis `ContractTemplate` par défaut (variables `{{client.name}}`, `{{amount.ttc}}`, etc. déjà substituées en preview). Will affine librement.
9. **Éditeur Tiptap DEVIS** : zone rich-text préremplie depuis template devis dédié (line items, validity 30j, mention TVA, conditions paiement).
10. **Bouton « Envoyer devis + contrat + lien paiement »** (un seul clic) → `createBookingFromSubmissionAction(submissionId, slots[], amountHtCents, scheduleProfileId|customInstallments[], fees, vatRate, vatReverseCharge, contractDraftTiptap, quoteDraftTiptap)`.
11. **Boutons secondaires** : « Sauvegarder brouillon » (`updateSubmissionDraftAction`) / « Marquer perdu » / « Archiver ».

**Sécurité** : RBAC `admin/super_admin` (read) + `super_admin` (action « Envoyer » si montant > 15 000 € HT, pour éviter erreur de saisie sur gros tickets).

**Audit log** : chaque sauvegarde brouillon ET chaque envoi final crée une entrée `ActivityLog(target='Submission', targetId=submissionId, actorId=adminId, action='updated'|'converted')`.

### 5.11.4 Écran de saisie admin avant envoi contrat parcours A (D55)

**Décision Will 2026-05-12 (D55)** : pour parcours A (calendrier direct), Will doit obligatoirement passer par un écran d'édition entre le clic "Envoi contrat + demande acompte" et l'envoi effectif. **PAS de seuil 1 500 € HT** — le contrat est toujours éditable.

Route conceptuelle : modal/drawer ouvert depuis `/admin/demandes/[optionId]` au clic du bouton "Envoi contrat + demande acompte" (renommage Server Action `validateBookingOptionAction` → `sendContractAndDepositRequestAction`, A1 §5.2.2).

Sections (ordre d'écran) :

1. **Récap demande** (read-only) : entreprise, taille INSEE, contact, format, slot demandé, message visiteur, géo (ville + distance OSM).
2. **Frais accessoires** (4 lignes, **modifiables**) :
   - `travelFeeCents` (préfill auto depuis `PricingConfig.feesMode` + zone géo OSM).
   - `accommodationFeeCents` (préfill 0).
   - `mealFeeCents` (préfill 0).
   - `additionalFeesCents` + `additionalFeesNotes` Tiptap libre.
3. **Édition contrat Tiptap** : zone rich-text préremplie depuis `ContractTemplate.body` (default FR/EN selon locale option) + `ContractTemplate.defaultLegalClauses` D53 fusionnées + variables substituées (`{{client.name}}`, `{{amount.ttc}}`, `{{slots.dates}}`). Will affine librement. **Aucun seuil monétaire** : toujours éditable.
4. **Récap échéancier** (read-only, dérivé du profil + montant total post-frais) — modifiable via lien vers override `BookingPaymentSchedule` si besoin.
5. **Bouton « Envoyer »** (1 clic) → `sendContractAndDepositRequestAction(optionId, editedContractTiptap, editedFees)` :
   - Trigger AUTO complet (cf. A1 §5.2.2).
   - Slot reste 🟠 (status `contract_payment_sent`).
   - Email client envoyé (contrat DocuSeal + lien Stripe Checkout).
   - Telegram Will + console admin notif (D54 — pas d'email Will).
6. **Bouton secondaire « Sauvegarder brouillon »** : sauvegarde l'édition sans envoyer (utile si Will attend une info).

**Audit log** : chaque envoi crée `ActivityLog(target='Booking', action='contract_and_deposit_sent', changes={feesEdited, contractTiptapHash})`.

---

## 5.12 Pricing dynamique (`PricingConfig` DB)

Doctrine : **tarifs et conditions paramétrables depuis admin**, plus de hardcode dans `src/content/pricing.ts` (V1 ancien).

### 5.12.1 Workflow modification tarif

1. Will accède `/admin/tarifs` → liste `PricingConfig` par `interventionType`.
2. Édite : `basePriceHtCents`, `depositPercentage`, `vatRate`, `quoteRequired`, `feesMode`, `flatRateConfig`, `optionDurationDays`, `paymentScheduleProfileId`.
3. Valide → `updatePricingConfigAction` :
   - Update DB.
   - `revalidatePath()` pour FR + EN sur : `/reserver`, `/interventions`, `/interventions/**`, `/audit`, `/audit/**`, `/pricing`, `/services`.
   - ActivityLog `pricing.config_updated` avec snapshot before/after.

### 5.12.2 Lecture pages publiques

Les pages publiques (`/reserver`, `/interventions/*`, etc.) lisent désormais depuis `PricingConfig` table — `src/content/pricing.ts` devient un **wrapper de fallback** qui interroge la DB (avec cache ISR / `revalidate=300`).

### 5.12.3 Cohérence copy interventions

`src/content/interventions.ts:236` (« acompte 50 % ») devient texte généré depuis `PricingConfig` (formule helper `formatDepositMention(pricingConfig)`). Plus de divergence copy/DB.

---

## 5.13 Frais accessoires (3 modes)

Configurable par format via `PricingConfig.feesMode` :

### 5.13.1 Mode `real_costs`

- Will saisit montants réels post-prestation (depuis `/admin/frais-accessoires`).
- Champs : `travelFeeCents`, `accommodationFeeCents`, `mealFeeCents`, `additionalFeesCents`, `additionalFeesNotes`.
- Stockage des justificatifs (PDF/JPG) V1 : **Hetzner Storage Box direct** (path `bookings/<bookingId>/expense-receipts/<filename>`), pas via `OnboardingDoc` (D58 — table non migrée V1). Référence stockée dans `Invoice.additionalFeesNotes` (Tiptap libre + lien signed URL).
- Affichés sur facture solde (lignes séparées avec mention « frais réels — justificatifs sur demande »).

### 5.13.2 Mode `flat_rate_by_zone`

- Forfait par zone géographique configurable dans `PricingConfig.flatRateConfig` :
  - Île-de-France (depuis Paris) : `0 €` (default, modifiable).
  - France métropolitaine hors IDF : `250 €` (default, modifiable).
  - DOM-TOM + étranger : `450 €` (default, modifiable).
- Zone calculée auto depuis `Booking.companyCityNormalized` + `geo-awareness` cron.
- Mode `flat_rate_by_zone` couvre déplacement + repas (forfait global). Hébergement = saisie manuelle si applicable.

### 5.13.3 Mode `included`

- Tarif `PricingConfig.basePriceHtCents` inclut tous frais → pas de ligne séparée sur facture.

### 5.13.4 Vue admin dédiée `/admin/frais-accessoires`

- Liste bookings actifs `confirmed`/`in_progress`/`completed` sans frais saisis.
- Saisie rapide (form inline) par booking.
- Upload justificatif drag & drop.
- Bouton « Émettre facture solde maintenant » → déclenche T17 + invoice avec frais inclus.

---

## 5.14 Échéanciers (4 profils par défaut + override)

### 5.14.1 Profils par défaut V1 (seedés à l'install)

| Profil   | Tranche           | Échéancier                                                                   |
| -------- | ----------------- | ---------------------------------------------------------------------------- |
| `tiny`   | ≤ 1500 € HT       | 100 % à la validation Will, dû J+7                                           |
| `small`  | 1500 - 5000 € HT  | 50 % à la validation (dû J+14) + 50 % à J-7 avant prestation (dû J+7)        |
| `medium` | 5000 - 15000 € HT | 30 % à la validation (J+14) + 30 % à J-7 (J+7) + 40 % à J+30 après (J+30)    |
| `large`  | > 15000 € HT      | 30/30/40 idem OU paiement mensuel custom (dates contractuelles via override) |

### 5.14.2 Sélection auto

Lookup `BookingPaymentSchedule.profileId IS NULL` → SELECT `PaymentScheduleProfile WHERE thresholdMinCents <= totalAmount AND (thresholdMaxCents IS NULL OR thresholdMaxCents > totalAmount)`.

### 5.14.3 Override par booking

`overridePaymentScheduleAction(bookingId, customInstallments, reason)` :

- Snapshot custom dans `BookingPaymentSchedule.installments` (JSONB).
- Motif obligatoire (audit log).
- Exemples :
  - Nouveau client → 100 % avant prestation.
  - Client de confiance → 30/70 sur 90 jours.
  - Sécurisation petit ticket → 50/50 paiements rapprochés.

### 5.14.4 Génération factures d'échéance

Cron `installment-due-reminder-j-7` + Action `createInstallmentInvoiceAction` :

- J-7 avant `dueAt` → email rappel.
- À `dueAt` → Invoice générée si pas déjà émise.
- Webhook Stripe ou `recordPaymentAction` manuel → flip status `Invoice.paid` + `BookingPaymentSchedule.installments[N].status = 'paid'`.

---

## 5.15 Géo-awareness (OSM Nominatim + Haversine)

### 5.15.1 Calcul distance

À chaque création `BookingOption` ou validation :

1. Si `Booking.companyLat`/`Lng` NULL → query Nominatim (cache Redis 30j).
2. Pour chaque booking confirmé dans fenêtre `[bookingDate - 2j, bookingDate + 2j]` :
   - Calcule distance Haversine entre `Booking.companyLat/Lng` et booking voisin.
3. Décision :
   - `distance > SiteSetting.travelMaxKmInWindow48h` (default 600 km) → slot affiché 🟡 « Logistique impossible » non cliquable visiteur, warning rouge admin.
   - `distance > SiteSetting.travelWarnKmInWindow48h` (default 300 km) → cliquable + alerte Telegram Will à validation.
   - `distance < 300 km` → OK silencieux.

### 5.15.2 Override admin

Will peut **forcer** la validation même si > 600 km via `validateBookingOptionAction(optionId, forceTravel=true, travelNote)` → Booking créé + `travelBufferDays = 1 ou 2` + Telegram « 🚆 train de nuit prévu ».

### 5.15.3 Heatmap admin (`/admin/calendrier/heatmap`)

Vue grille semaine × villes :

- Lignes = villes des bookings confirmés.
- Colonnes = jours (Lun → Dim).
- Cellules colorées :
  - vert = OK (< 300 km).
  - orange = warning (300-600 km).
  - rouge = blocage (> 600 km, force override).
- Tooltip : distance entre villes voisines.

Endpoint : `GET /api/admin/geo/heatmap?weekStart=2026-05-11`.

---

## 5.16 Suivi paiements (tableau + fiche + relances)

### 5.16.1 Dashboard global `/admin/paiements`

| Colonne           | Type      | Source                                                                |
| ----------------- | --------- | --------------------------------------------------------------------- |
| Client            | string    | `Booking.companyName` (via Submission)                                |
| Format            | enum      | `Booking.interventionType`                                            |
| Total HT/TTC      | int cents | `Invoice` agrégé                                                      |
| Acompte reçu      | int cents | `Payment.status='succeeded' AND type='deposit'`                       |
| Solde restant     | int cents | calculé                                                               |
| Échéance suivante | DateTime  | `BookingPaymentSchedule.installments[next].dueAt`                     |
| Statut            | enum      | dérivé : `à jour` / `retard 1-15j` / `retard 16-30j` / `retard > 30j` |

Filtres : statut, période, client, format. Tri par échéance ascendante.

Cards KPI haut de page :

- Total encaissé mois courant.
- Total prévisionnel mois courant (échéances à venir).
- Total en retard.
- Nombre de bookings actifs.

**Section "Prêts à valider" (D49 — nouveau)** : carte dédiée listant les Bookings `status='awaiting_admin_validation'` (acompte reçu, en attente du 2ème clic Will). Chaque ligne expose un bouton 1-clic **"Valider sur le calendrier"** déclenchant `validateBookingOnCalendarAction(bookingId)` (D49 — Server Action A1bis §5.2.2). Affichage badge ⚠️ "Contrat à signer le jour J" si `Booking.contractDocumentId` existe mais `ContractDocument.status !== 'signed'` (D50 — contrat non bloquant).

**Distribution factures (D56)** : les PDF factures émises sont attachées dans les emails transactionnels (`invoice-balance-issued`, `payment-receipt`, etc.). **Pas de page self-service Stripe Customer Portal en V1**. Le client a une copie email PJ + peut redemander via `/contact`. Hook V2+ préservé via `Payment.providerCustomerId`.

**Pipeline parcours B (P1-1 + UX-E2E 5.3)** : `/admin/paiements` expose en bas de page une carte « Pipeline devis B » (montants pressentis × probabilité conversion) listant les `Submission(type='quote_request', status IN ('qualifying','negotiating'))`. Montants non-encaissés mais utiles pour la projection trésorerie. Cliquable → ouvre drawer §5.11.3.bis.

**Fiche client unifiée (P1-1)** : la fiche entreprise (`/admin/clients/[id]`) agrège **tous** les Bookings (parcours A _et_ B) **plus** toutes les Submissions historiques (audit/implementation/intervention/contact/quote_request) du même `contactEmail` (ou `Submission.contactEmail` / `Booking.contactEmail`). Timeline mixte chronologique. Aucune duplication selon l'origine `originPath`.

### 5.16.2 Fiche détaillée par booking `/admin/reservations/:id/paiements`

- **Timeline visuelle** : échéances passées (vert/rouge) + à venir (gris).
- **Bouton + Enregistrer un paiement** : formulaire `recordPaymentAction` (amount/date/mode/référence/notes).
- **Historique audit log** : qui a saisi, quand, ancienne valeur, nouvelle valeur.
- **Bouton Générer un avoir** : déclenche `triggerRefundAction` + Invoice `credit_note` auto.
- **Bouton Marquer en litige** : flag `Booking.disputed=true` + Telegram urgent.

### 5.16.3 Relances automatiques

Voir §5.6 jobs cron #4-#7 + #11 + #17-20.

Désactivable par client via `SiteSetting.paymentReminderDisabledFor[]` (liste UUID clients de confiance).

### 5.16.4 Export CSV

`exportPaymentsCsvAction(period, format)` :

- BOM Excel UTF-8.
- Colonnes : Client / Format / Date prestation / Factures émises / Montants HT/TTC / Paiements reçus / Solde / Échéances / Statut.
- Période : mensuel / trimestriel / annuel / custom.
- Audit log `payments.csv_exported`.

---

## 5.17 DocuSeal vs Yousign (raison du choix)

> **DocuSeal RETENU — Yousign REJETÉ** (cf. D36 STOP-AND-ASK). Yousign n'est mentionné ci-dessous qu'en comparatif historique.

### 5.17.1 Décision Will 2026-05-12 : DocuSeal self-hosted

Raisons du choix vs Yousign initial :

| Critère                | DocuSeal self-hosted                                       | Yousign SaaS                                       |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| **Coût V1**            | Gratuit (open source MIT)                                  | 9-29 €/utilisateur/mois + frais signature          |
| **Validité juridique** | eIDAS SES (Simple Electronic Signature) — valable 99 % B2B | eIDAS SES (Standard) / AES (Advanced) selon plan   |
| **Hébergement**        | Self-hosted Docker sur Hetzner CPX32                       | SaaS, datacenter France (FR)                       |
| **DPA**                | Pas applicable (auto-hébergé, couvert par DPA Hetzner)     | DPA Yousign à signer + sous-processeur additionnel |
| **PII**                | Stockage sur Hetzner Storage Box (déjà couvert)            | Stockage Yousign, transfert UE                     |
| **API**                | REST simple, webhook HMAC                                  | REST + SDK, webhook HMAC                           |
| **Branding**           | Personnalisable (CSS + logo)                               | Personnalisable plan payant                        |
| **Empreinte mémoire**  | ~50 MB RAM                                                 | N/A                                                |

**Trade-offs assumés** :

- Pas de signature AES (Qualified Electronic Signature) en V1. Suffit pour 99 % B2B (contrats services). Pour cas spéciaux (cession parts, contrats > 100k€), upgrade Yousign ou Certigna possible V2+.
- Self-host = responsabilité maintenance / mises à jour Docker → couvert par stack Coolify existante.

### 5.17.2 Stack DocuSeal V1

```
Hetzner CPX32 (existant)
   └── Coolify
        ├── axion-ia-web (existant)
        ├── docuseal (nouveau)
        │   └── ghcr.io/docuseal/docuseal:latest
        │   └── PostgreSQL DB partagée (ou dédiée selon scaling)
        │   └── Volume Storage Box pour PDFs signés
        │   └── Domain: sign.axion-ia.com (Cloudflare CNAME)
        └── postgres / redis (existant)
```

### 5.17.3 Endpoints DocuSeal V1 utilisés

- `POST /api/submissions` : créer une signature request (devis ou contrat).
- `GET /api/submissions/:id` : status check.
- Webhook envoyé vers `/api/docuseal/webhook` :
  - `submission.completed` → `signed`
  - `submission.declined` → `declined`
  - `submission.expired` → `expired`

Signature HMAC-SHA256 sur `X-DocuSeal-Signature` (secret partagé).

PDFs signés téléchargés via API → stockés sur Hetzner Storage Box (S3-compat) → URL signée 24h pour distribution client.

### 5.17.4 Migration vers QTSP eIDAS QES V2+ (option, cf. V2.PDP)

Hook préservé V1 : `ContractDocument.provider` enum (`docuseal` | `manual_upload`). V2+ peut ajouter un QTSP eIDAS QES (Certigna, Universign, ou autre prestataire qualifié eIDAS QES — cf. sprint V2.PDP dans 04-PLAN §5) sans migration data lourde si une signature qualifiée (QES) devient requise pour cas spéciaux (cession parts, contrats > 100 k€, etc.).

---

## 5.18 Migration data V0 → V1 (D63) — script obligatoire Sprint X.4

### 5.18.1 Périmètre

Script `scripts/migrate-bookings-v0-to-v1.ts` exécuté une fois après application des migrations Prisma de Sprint X.4 (extension enum `BookingStatus` + ajout colonnes `Payment.isHistorical` D63 + ajout colonnes `Booking.pausedAt/pausedUntil/pauseReason` D61). Rétrofit des `Booking` V0 (status `pending | confirmed | cancelled | postponed`) vers la nouvelle enum V1 (~25 valeurs effectives).

### 5.18.2 Mapping V0 → V1

| Booking V0 status       | Booking V1 status                  | Action additionnelle                                                                                                                                            |
| ----------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending` (avec slotId) | `option_pending`                   | aucune (en attente validation Will, parcours A)                                                                                                                 |
| `pending` (sans slotId) | `cadrage_scheduled`                | aucune (cadrage déjà couru historique)                                                                                                                          |
| `confirmed` (passé)     | `archived`                         | crée `Payment(provider='manual_wire', status='succeeded', isHistorical=true)` rétroactif + `Invoice(type='full', status='paid', isHistorical=true)` rétroactive |
| `confirmed` (futur)     | `confirmed`                        | crée `Payment(isHistorical=true)` + `Invoice(isHistorical=true)` rétroactifs en supposant acompte payé hors-Stripe                                              |
| `cancelled`             | `cancelled_by_admin`               | conserve `cancellationReason` si existant, sinon `[MIGRATION V0 → V1]`                                                                                          |
| `postponed`             | drop (enum mort-né cf. Agent 3 N9) | logguer + alerter Will pour traitement manuel                                                                                                                   |

### 5.18.3 Garanties

- **Idempotent** : script peut être relancé sans effet (vérifie `Payment.isHistorical=true` AND `bookingId=X` avant insert).
- **Test obligatoire sur snapshot dev** avant exécution prod (dump Postgres → restore staging → run script → diff verification → SI OK → run prod).
- **Audit log** : chaque ligne migrée crée une entrée `BookingTransition(trigger='migration.v0_to_v1', actorType='system', changes={beforeV0Status, afterV1Status})`.
- **Backup pré-run** : snapshot Hetzner du VPS Postgres prod < 1h avant exécution.
- **Rollback plan** : restore snapshot Hetzner si > 10 erreurs détectées par batch de 100 Bookings.

### 5.18.4 Effort

Inclus dans Sprint X.4 (cf. `04-PLAN-EXECUTION.md` X.4 — +0,5j absorbés dans state machine).

---

## Notes méthodologiques

- Aucun code applicatif modifié, aucun `git`, `pnpm`, ni écriture hors ce `.md`. ✅ Conforme contrainte AUDIT-ONLY.
- Toutes les citations renvoient à des chemins relatifs `axionia/`-rooted (FR/Win). Lignes Prisma sourcées sur HEAD `ff3ccbc9` lu via `Read`.
- Cette réécriture **annule et remplace** la version précédente du fichier (datée 2026-05-12 matin, vision initiale). La présente version reflète la **vision V1 finale validée par Will en review interactive 2026-05-12** après-midi.
- Le doc se positionne en **architecture-cible papier**, à instrumenter via les sprints DB / paiement / admin / cron à venir (cf. mémoire `axionia_session_2026-05-12_*`).
- Les décisions Will sont **toutes intégrées** : DocuSeal self-hosted (vs Yousign payant), 5 statuts calendrier (4 visiteur visibles + 1 admin invisible, vs 3 dans version précédente), cap configurable multi-options, paiement manuel admin autorisé, échéanciers configurables, frais accessoires 3 modes, géo-awareness intelligent, pricing dynamique, devis semi-auto, contrat auto/preview selon seuil 1500 €, pas de Qualiopi/OPCO V1, **2 parcours visiteur distincts A/B (D44-D48) issus de `UX-E2E-VERIFICATION.md` 2026-05-12 — parcours B `/demande-devis` + drawer admin unifié + 2 crons + 5 templates dédiés**.

---

**Fin du document `03-ARCHITECTURE-CIBLE.md` (v2, réécriture intégrale 2026-05-12 post-review Will)**.
