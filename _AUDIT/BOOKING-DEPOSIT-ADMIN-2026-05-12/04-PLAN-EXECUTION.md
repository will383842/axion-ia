# 04 — Plan d'exécution chiffré V1 · Booking deposit-validation-gated + Admin Console 2026

> Audit Axion-IA — **cabinet IA opérationnel B2B premium** — V2.1 LIVE — plan d'exécution V1 post-review Will 2026-05-12.

**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742` · branche `main`
**Date de réécriture** : 2026-05-12 (vision V1 finale Will)
**Mode** : 🚫 AUDIT-ONLY — Phase 5 du master `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` §6.
**Statut sprints** : ⚠️ Aucun sprint n'est exécuté pendant l'audit. Will déclenche chaque sprint séparément via prompt dédié.

> Ce plan **remplace intégralement** la version précédente (basée sur Yousign + 30 % universel + option 48h universelle). Vision V1 finale tranchée par Will 2026-05-12 : multi-options simultanées (cap 3 par défaut), validation Will déclenche AUTO (contrat DocuSeal + facture Stripe + emails), DocuSeal self-hosted (gratuit) au lieu de Yousign payant, Stripe Checkout + Customer Portal, pricing DB-managé, frais accessoires 3 modes, échéancier configurable, TVA agnostique, géo-awareness, suivi paiements pro, mode paiement hybride. Pas de Qualiopi/OPCO en V1.

---

## 0. Méthode de chiffrage

Chaque sprint est borné par :

- **Périmètre** : livrables exhaustifs (migrations, actions, routes, templates, helpers, tests).
- **Durée affinée** : fourchette `min-max j ingé` ajustée sur GAPs réels relevés par les 11 agents.
- **Priorité interne** : P0 / P1 / P2 / P3 selon master §6 + §0.0bis (Qualiopi/OPCO/PDP → V2+).
- **Dépendances** : sprints amont obligatoires (DAG §C).
- **Sources GAP** : agents Phase 2 + reality check Phase 0.

Échelles :

- **P0** = bloquant lancement deposit-validation-gated.
- **P1** = should V1, livré dans le sprint mais facile à mettre en backlog si rupture.
- **P2** = could V1 si temps disponible, sinon V1.x.
- **P3** = won't V1 — bascule V2+.

Marqueurs visuels : 🚨 critique · ⚠️ important · ✅ acquis · `[À REVISITER V2+]`.

### 0.bis Écarts vs version précédente (synthèse)

| Changement majeur                      | Avant                                                                | Maintenant                                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mécanisme verrou slot                  | Option 48h universelle pré-paiement                                  | Multi-options simultanées (cap config, défaut 3) sans course à la signature                                                                                     |
| Trigger contrat + facture              | Acompte 30 % Stripe → confirme                                       | Validation Will → AUTO contrat DocuSeal + facture Stripe + emails (déposit-validation-gated)                                                                    |
| Provider e-signature                   | Yousign SaaS (FR, payant)                                            | DocuSeal self-hosted Docker Coolify (gratuit)                                                                                                                   |
| Pricing                                | `pricing.ts` SSOT TS hardcodé                                        | `PricingConfig` table DB + admin UI + revalidation auto                                                                                                         |
| Frais accessoires                      | Logement/repas/trajet ad-hoc CGV                                     | 3 modes (`real_costs` / `flat_rate_by_zone` / `included`) par format                                                                                            |
| Échéancier                             | 50 % / solde post (figé)                                             | 4 profils DB par défaut + override par booking + montants %/€ paramétrables                                                                                     |
| Mode paiement                          | Stripe Checkout seul                                                 | Hybride Stripe Checkout par défaut + admin saisit paiement hors-Stripe (virement/chèque/CB manuel)                                                              |
| Contrat                                | PDF figé                                                             | Auto-généré depuis `ContractTemplate` DB + édition Tiptap admin avant envoi DocuSeal                                                                            |
| Géo-awareness                          | Mention copy uniquement                                              | OSM Nominatim + Haversine + heatmap admin + buffer trajet auto                                                                                                  |
| Suivi paiements                        | Manuel admin via tableau Booking                                     | Tableau global + fiche client + relances J-7/J+1/J+15/J+30 + audit log + export CSV comptable                                                                   |
| Qualiopi/OPCO                          | Mentionné en hooks                                                   | Repoussé V2+ ferme, hooks DB nullable préparés                                                                                                                  |
| Emails                                 | Resend/Yousign                                                       | Système maison Nodemailer + PowerMTA + Mailwizz Phase 0 — ~30 nouveaux templates à créer (dont 5 parcours B) + ~14 V0 = ~44 total                               |
| Parcours visiteur (D44)                | 1 seul (calendrier `/reserver`) — devis = variante interne du flow A | **2 parcours distincts** : A (calendrier direct) + B (`/demande-devis` formulaire qualifié → négo hors-app → drawer admin unifié → envoi unifié)                |
| Validation calendrier (D49)            | 1 clic Will = trigger AUTO complet + slot 🔴                         | **2 clics distincts** : clic 1 "Envoi contrat + demande acompte" (slot reste 🟠, status `contract_payment_sent`) + clic 2 "Valider sur le calendrier" (slot 🔴) |
| Critère bloquant 🔴 (D50)              | Acompte payé + contrat signé                                         | **Acompte payé uniquement** (contrat signature physique jour J si pas signé via DocuSeal)                                                                       |
| État `awaiting_admin_validation` (D51) | Inexistant                                                           | Ajouté à `BookingStatus` entre `contract_payment_sent` et `confirmed`                                                                                           |
| Délais expiration (D52)                | Hardcodés/implicites                                                 | **2 clés `SiteSetting` modifiables admin** : 5j si rien reçu + 10j si contrat signé sans acompte                                                                |
| Clause contrat par défaut (D53)        | Pas centralisée                                                      | `ContractTemplate.defaultLegalClauses JSONB` (clause résolution J+10 par défaut, modifiable Will)                                                               |
| Notifications Will (D54)               | Email + Telegram                                                     | **Telegram + console admin uniquement** (pas d'email Will)                                                                                                      |
| Saisie admin avant envoi (D55)         | Seuil 1 500 € HT pour preview Tiptap                                 | **Écran saisie obligatoire pour TOUT envoi** (frais + Tiptap contrat) — pas de seuil                                                                            |
| Customer Portal Stripe (D56)           | Activé                                                               | **RETIRÉ V1** — factures email PJ uniquement                                                                                                                    |
| NPS J+1 (D57)                          | Cron `booking-j1-debrief`                                            | **RETIRÉ V1**                                                                                                                                                   |
| Onboarding docs (D58)                  | Sprint dédié + table `OnboardingDoc`                                 | **RETIRÉ V1** — V1.5+ formulaire structuré                                                                                                                      |

---

## 1. Vue d'ensemble V1

| Sprint     | Nom                                                                                | Durée              | P0/P1     | Dépend.                    | Agents source     |
| ---------- | ---------------------------------------------------------------------------------- | ------------------ | --------- | -------------------------- | ----------------- |
| X.0        | Décisions Will + bootstrap                                                         | 0,5j Will + 1j dev | P0 (gate) | —                          | Tous (STOP & ASK) |
| X.1        | Foundation paiements & pricing                                                     | 5-6j               | P0        | X.0                        | 4, 8, 11          |
| X.2        | Stripe Checkout & webhook                                                          | 3j                 | P0        | X.1                        | 4, 8              |
| X.3        | DocuSeal self-hosted + versioning contrat D62                                      | 3,5-4j             | P0        | X.1                        | 10, 8             |
| X.4        | State machine + migration V0→V1 D63 + paused D61 + overdue D59                     | 5j                 | P0        | X.1, X.2, X.3              | 3, 7              |
| X.5        | Multi-options simultanées                                                          | 2j                 | P0        | X.4                        | 3, 1              |
| **X.5bis** | **Parcours B Formulaire devis qualifié (D44)**                                     | **2j**             | **P0**    | **X.4, X.5**               | **UX-E2E §3**     |
| X.6        | Pre-booking cadrage (manual_external V1)                                           | 3j                 | P0        | X.4                        | 10, 7             |
| X.7        | Devis semi-auto + signature DocuSeal                                               | 3j                 | P0        | X.3, X.4                   | 10, 11            |
| X.8        | Admin Réservations + Demandes devis (drawer A + drawer B)                          | 4-5j               | P0        | X.4, X.5bis                | 2, 5, UX-E2E §5   |
| X.9        | Admin Calendrier v2 + drag-drop reschedule D60                                     | 4-5j               | P0        | X.4, X.8                   | 5, 2              |
| X.10       | Admin Factures V1 (PDF + numérotation immuable)                                    | 4j                 | P0        | X.1, X.2                   | 4, 11             |
| X.11       | Admin Paiements (suivi pro + hybride)                                              | 3j                 | P0        | X.10                       | 4, 2, 8           |
| X.12       | Crons & workers (~24 jobs incl. D59 + D61)                                         | 4j                 | P0        | X.2, X.4, X.7, X.5bis      | 6, UX-E2E §6      |
| X.13       | Emails templates V1 (~36 templates FR+EN incl. D49/D52/D59/D60/D61/D62)            | 5-6j               | P0        | X.4, X.5bis, X.6, X.7, X.8 | 7, UX-E2E §7      |
| X.14       | Admin nav refactor + Dashboard « Aujourd'hui » + section "Prêts à valider" D49     | 2-3j               | P0        | X.8                        | 2                 |
| X.15       | Self-service client (magic-link cancel/reschedule — Customer Portal retiré V1 D56) | 1,5-2j             | P0        | X.2, X.4, X.10             | 1, 4, 8           |
| X.16       | Géo-awareness & capacité (OSM Nominatim + Haversine + heatmap)                     | 2j                 | P0        | X.9                        | 5                 |
| X.17       | Conformité légale V1 (CGV + sous-processeurs + archivage)                          | 3-4j               | P0        | X.10                       | 11, 8             |
| X.18       | Bout-en-bout préfill + tracking funnel                                             | 1-2j               | P0        | X.4                        | 9, 1              |
| X.19       | Tests E2E Playwright (happy path + edge cases)                                     | 3j                 | P0        | X.1-X.18                   | 4, 3, 1           |
| X.20       | Doc + ADRs + CHANGELOG                                                             | 1j                 | P1        | X.19                       | Tous              |

**Total V1 affiné** : **~54-60 j ingé** + **~0,5j Will** (Sprint X.0). Délai prévisionnel : **10-12 semaines** avec 1 dev plein temps (parallélisations absorbent +2-3j D59-D63).

Bilan effort vs V2.2 post-`UX-E2E-VERIFICATION.md` (~52-58j) :

- **D55** — Écran saisie admin obligatoire avant envoi contrat parcours A (frais + Tiptap, pas de seuil) = **+0,5j** (X.4 + X.8).
- **D51** — État `awaiting_admin_validation` + Server Action `validateBookingOnCalendarAction` + section dashboard "Prêts à valider" = **+0,5j** (X.4 + X.8 + X.14).
- **D56** — Customer Portal Stripe RETIRÉ V1 = **-0,5j** (X.2 + X.15).
- **D57** — NPS J+1 RETIRÉ V1 (pas de cron `booking-j1-debrief`, pas de template) = **-0,5j** (X.12 + X.13).
- **D58** — Onboarding docs RETIRÉ V1 (pas de Sprint dédié, pas de table `OnboardingDoc` V1) = **-1 à -2j**.
- **D59** — Échec paiement échéances : 2 nouveaux états + cron escalade + 3 templates = **+0,5j** (X.4 + X.12 + X.13).
- **D60** — Drag-drop reschedule admin matérialisé `rescheduleBookingByAdminAction` + email + invariants statut = **+0,5j** (X.9).
- **D61** — Statut `paused` + 2 Server Actions + cron + 2 templates = **+0,5j** (X.4 + X.12 + X.13).
- **D62** — Versioning contrat (`cancelAndReissueContractAction` + avenant) = **+0,5j** (X.3 + X.13).
- **D63** — Script migration V0 → V1 + test dev + run prod = **+0,5j** (X.4).
- Net D59-D63 : **+2-3j** absorbés dans sprints existants. Délai inchangé (parallélisations + buffer).
- Total : ~52-58 + 2-3 = **~54-60 j ingé**.

---

## 2. Section A — Sprints V1 détaillés

### Sprint X.0 — Décisions Will + bootstrap (~0,5j Will + 1j dev)

> 🚨 **Gate humain bloquant.** Aucun code applicatif avant ces décisions.

**Périmètre — Décisions Will à trancher** :

- **D-PROV-VISIO** : provider visio cadrage V1. Options : Whereby Embedded (~10-15 €/mois UE Norvège, DPA art. 28, intégration API native) vs Google Meet (gratuit, RGPD DPF, UI lourd) vs Jitsi self-hosted (0 €, souveraineté max, charge ops moyenne) vs **« lien manuel »** (provider=`manual_external`, Will saisit l'URL Meet/Whereby/Jitsi à la main dans drawer admin). Recommandation Agent 10 V1 : **manual_external** pour ship V1 sans dépendance externe ; provider natif → V1.5.
- **D-STORAGE** : storage docs onboarding + PDF factures + PDF contrats archivés. Options : Cloudflare R2 (US, gratuit jusqu'à 10 GB, zero egress) vs Hetzner Storage Box (UE Frankfurt, déjà couvert DPA Hetzner, ~4 €/mois 1 TB). Recommandation Agent 10 : **Hetzner Storage Box** (souveraineté UE, cohérence DPA).
- **D-PDF-MOTEUR** : moteur PDF factures/devis/contrats. Options : `react-pdf` (rendu serveur Node, léger, ≤ 200 KB) vs Puppeteer/Playwright (rendu HTML via Chromium headless, lourd, ~150 MB image Docker, fidélité 100 % CSS). Recommandation : **react-pdf** V1 (templates legaux propres, pas besoin Chromium).
- **D-LEGAL** : structure juridique FR vs EE — pas tranchée. Conséquence : `legal.ts` rendu **paramétrable** via `SiteSetting` (vatRate / vatReverseCharge / vatMention / juridiction / loi applicable). Le scénario par défaut V1 reste **OÜ EE** comme aujourd'hui (`legal.ts:44`). Will peut basculer en SAS FR sans refactor code via admin UI.
- **D-DEPOSIT** : % d'acompte par défaut par format (paramétrable DB ensuite). Default proposé, dérivé de la grille SSOT D40 (seuils 1 500 / 5 000 / 15 000 € HT — cf. D-SEUILS-ECHEANCIER ci-dessous) :
  - `essentielle` (490/790/1190 € HT, tranche ≤ 1 500) → **100 % à validation** (profil `tiny`).
  - `approfondie` (890/1390/1990 € HT, tranche ≤ 1 500 ou 1 500-5 000 selon sub-tier) → **100 %** (≤ 1 500) ou **50/50** (1 500-5 000).
  - `conference` (≤ 5 000 € HT typiquement) → **50/50** (profil `small`).
  - `dirigeants` (variable 1 500-15 000 € HT selon sub-tier) → **50/50** ou **30/30/40** selon montant.
  - `gagner_du_temps` (990 € HT, ≤ 1 500) → **100 %**.
  - `intervention_claude` (5 000-50 000 € HT) → **30/30/40** (profil `medium`) ou **30/30/40 / mensuel** (`large`) selon montant.
  - `audit_flash_onsite` (890 € HT, ≤ 1 500) → **100 % à validation** (paiement intégral, pas de solde).
- **D-CAP-OPTIONS** : multi-options simultanées cap default. Proposé : **3 options par slot**. Paramétrable global `SiteSetting.maxConcurrentOptionsPerSlot` + override par `interventionType` via `PricingConfig.maxConcurrentOptions`.
- **D-SEUILS-ECHEANCIER** : seuils déclenchant profil échéancier par défaut (grille SSOT D40 — cohérente avec STOP-AND-ASK D40 + 03-ARCH §5.14) :
  - **≤ 1 500 € HT** → profil `tiny` : 100 % à la validation Will (dû J+7).
  - **1 500 - 5 000 € HT** → profil `small` : 50 % à la validation (dû J+14) + 50 % à J-7 avant prestation (dû J+7).
  - **5 000 - 15 000 € HT** → profil `medium` : 30 % à la validation (dû J+14) + 30 % à J-7 avant prestation (dû J+7) + 40 % à J+30 après prestation (dû J+30).
  - **> 15 000 € HT** → profil `large` : 30 % + 30 % + 40 % (idem `medium`) **OU** paiement mensuel contractuel (custom override admin).
  - Nouveaux clients sans historique → override admin « Forcer 100 % avant prestation ».

**Périmètre — Bootstrap dev (1j)** :

- ADRs squelettes : ADR 0011-decisions-foundation-V1, ADR 0012-stripe-checkout-saq-a, ADR 0013-docuseal-self-hosted, ADR 0014-tva-agnostic, ADR 0015-multi-options-simultanees, ADR 0016-pricing-db-managed, ADR 0017-echeancier-configurable, ADR 0018-geo-awareness-osm, ADR 0019-paiement-hybride.
- `.env.example` étendu : `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LIVE_MODE`, `STRIPE_API_VERSION`, `DOCUSEAL_URL`, `DOCUSEAL_API_TOKEN`, `DOCUSEAL_WEBHOOK_SECRET`, `STORAGE_BOX_ENDPOINT`, `STORAGE_BOX_KEY`, `STORAGE_BOX_SECRET`, `STORAGE_BOX_BUCKET`, `OSM_NOMINATIM_USER_AGENT`.
- `docker-compose.coolify.yml` étendu : service `docuseal` (Docker image officielle `docuseal/docuseal:latest`).
- Pinning dépendances : `stripe ^17.x`, `@stripe/stripe-js ^4.x`, `@react-pdf/renderer ^4.x`, `node-haversine ^1.x`.

**Livrables** : 10 entrées Q1-Q10 validées dans `_AUDIT/.../STOP-AND-ASK.md` § 2. 9 ADRs squelettes (0011-0019). `.env.example` patché. Dépendances installées + lockfile à jour.

**Mapping Q1-Q10 ↔ D-XXX (Sprint X.0)** :

| Q   | Sujet                                              | D-XXX correspondante                                 | Sprint impacté                                         |
| --- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Q1  | Provider visio cadrage V1                          | `D-PROV-VISIO`                                       | X.6                                                    |
| Q2  | Structure juridique FR vs EE                       | `D-LEGAL`                                            | X.17 (peut attendre)                                   |
| Q3  | PDF moteur (react-pdf / Puppeteer / hybride)       | `D-PDF-MOTEUR`                                       | X.10, X.7                                              |
| Q4  | Storage onboarding docs (R2 / Hetzner Storage Box) | `D-STORAGE`                                          | X.3, X.10                                              |
| Q5  | Drag-drop calendrier admin V1                      | (nouvelle décision Sprint X.0) — D-DRAG-DROP         | X.9                                                    |
| Q6  | Refunds auto vs manuel admin                       | (nouvelle décision Sprint X.0) — D-REFUND-MODE       | X.4, X.12                                              |
| Q7  | J+1 debrief NPS                                    | (nouvelle décision Sprint X.0) — D-NPS               | X.12, X.13                                             |
| Q8  | Admin EN bilingue V1                               | (nouvelle décision Sprint X.0) — D-ADMIN-I18N        | X.8, X.14                                              |
| Q9  | Liste fermée secteurs sensibles NDA auto           | (nouvelle décision Sprint X.0) — D-SENSITIVE-SECTORS | X.1 (helpers `sensitive-sectors.ts`)                   |
| Q10 | % d'acompte par défaut par format                  | `D-DEPOSIT` + `D-SEUILS-ECHEANCIER`                  | X.1 (seeds `PricingConfig` + `PaymentScheduleProfile`) |

Q5-Q9 ne portent pas de D-XXX nommé dans le bootstrap initial — les renommer en D-DRAG-DROP / D-REFUND-MODE / D-NPS / D-ADMIN-I18N / D-SENSITIVE-SECTORS lors du Sprint X.0 review.

**Priorités** : `P0 — Gate Will (humain)`.

**Dépendances** : aucune.

---

### Sprint X.1 — Foundation paiements & pricing (~5-6j)

**Périmètre — Migrations Prisma (8 tables + extensions)** :

- **`PricingConfig`** : SSOT tarification DB.
  - PK `id Uuid`. `interventionType InterventionType @unique` (FK enum). `defaultBasePriceHtCents Int`.
  - `subTiers Json` (sub-tiers Essentielle 490/790/1190 + Approfondie 890/1390/1990 + autres). Cf. mémoire `axionia_pricing_centralization`.
  - `defaultDepositPct Decimal(5,2)` (override D-DEPOSIT par format).
  - `defaultScheduleProfileId? Uuid` (FK `PaymentScheduleProfile`).
  - `feesMode FeesMode @default(included)` (enum `real_costs | flat_rate_by_zone | included`).
  - `flatFeeByZone Json?` (si `feesMode='flat_rate_by_zone'` : `{ paris: 0, idf: 150_00, metro: 400_00, dom_tom: 1200_00 }`).
  - `quoteThresholdCents Int @default(500_000_00)` (5 000 € HT seuil devis).
  - `requiresQuoteAlways Boolean @default(false)`.
  - `requiresNdaAlways Boolean @default(false)`.
  - `maxConcurrentOptions Int @default(3)`.
  - `vatRate Decimal(5,2) @default(0.00)` (TVA agnostique D14).
  - `vatReverseCharge Boolean @default(false)`.
  - `vatMention VarChar(255)?` (« TVA non applicable, art. 293 B du CGI » FR ou « Reverse charge — Art. 196 EU VAT directive » EE).
  - `updatedAt`, `updatedBy?`.
- **`PaymentScheduleProfile`** : 4 profils échéancier par défaut + admin extensible.
  - PK `id Uuid`. `slug VarChar(64) @unique` (`tiny`, `small`, `medium`, `large`, `custom`) — cohérent avec 03-ARCH §5.14.1 et grille SSOT D40.
  - `name VarChar(120)`, `description? Text`.
  - `tranches Json` (array `{ pctOrAmount, mode: 'pct'|'fixed', label, dueOffset: { from: 'validation'|'booking_date', days: number } }`).
  - `isDefault Boolean @default(false)`. `applicableMinCents Int?`, `applicableMaxCents Int?`.
- **`BookingPaymentSchedule`** : échéancier matérialisé par booking (override possible vs profil).
  - PK `id Uuid`. `bookingId Uuid @unique` (FK Cascade).
  - `profileId? Uuid` (FK `PaymentScheduleProfile`, nullable si custom).
  - `tranches Json` (array `{ orderIndex, amountCents, label, dueDate DateTime, status: 'pending'|'paid'|'overdue'|'refunded' }`).
  - `createdAt`, `updatedAt`, `updatedBy?`.
- **`Payment`** : trace tous les flux entrants.
  - PK `id Uuid`. `bookingId Uuid` (FK SetNull).
  - `provider PaymentProvider` (enum SSOT 4 valeurs : `stripe | manual_wire | manual_check | manual_cash` — cohérent MANIFEST D42 + STOP-AND-ASK D42 + 03-ARCH §5.1.5).
  - `providerEventId? VarChar(255)` (Stripe `event.id`), `providerPaymentIntentId? VarChar(255)`, `providerSessionId? VarChar(255)`.
  - `amountCents Int`. `currency VarChar(3) @default("EUR")`.
  - `type PaymentType` (enum : `deposit`, `tranche_2`, `tranche_3`, `balance`, `additional_fee`, `correction`).
  - `status PaymentStatus` (enum : `pending`, `succeeded`, `failed`, `refunded`).
  - `paidAt DateTime?`, `failureReason VarChar(500)?`.
  - `recordedByAdminUserId? Uuid` (FK SetNull, si saisie manuelle).
  - `reference VarChar(255)?` (n° virement/chèque/RIO).
  - `notes Text?`.
  - Index `(bookingId)`, `(providerPaymentIntentId)`, `(status, type)`, UNIQUE `(provider, providerEventId)`.
- **`Invoice`** : facture officielle (acompte/solde/avoir).
  - PK `id Uuid`. `number VarChar(32) @unique` (séquentiel immuable `AXION-2026-NNNN`).
  - `bookingId Uuid` (FK SetNull). `payerType PayerType @default(direct_client)` (enum `direct_client`, `opco` nullable hook V2+).
  - `type InvoiceType` (enum : `deposit`, `tranche`, `balance`, `credit_note`).
  - `status InvoiceStatus` (enum : `draft`, `issued`, `paid`, `partially_paid`, `overdue`, `cancelled`).
  - `issuedAt DateTime?`, `dueDate DateTime?`, `paidAt DateTime?`.
  - `subtotalHtCents Int`, `vatRate Decimal(5,2)`, `vatReverseCharge Boolean`, `vatAmountCents Int`, `totalTtcCents Int`.
  - `travelFeeCents Int @default(0)`, `accommodationFeeCents Int @default(0)`, `mealFeeCents Int @default(0)`, `additionalFeesCents Int @default(0)`, `additionalFeesNotes Text?`.
  - `vatMention VarChar(255)?`.
  - `pdfUrl VarChar(500)?`, `pdfHashSha256 VarChar(64)?`, `archivedUntil DateTime?` (= `issuedAt + 10 ans`).
  - `locale Locale @default(fr)`.
  - Index `(bookingId)`, `(status, issuedAt)`, `(number)`.
- **`Refund`** : avoir/remboursement.
  - PK `id Uuid`. `invoiceId Uuid` (FK SetNull), `paymentId? Uuid` (FK SetNull).
  - `amountCents Int`, `reason VarChar(500)`.
  - `status RefundStatus` (enum : `pending`, `processed`, `failed`).
  - `stripeRefundId? VarChar(255) @unique`.
  - `adminUserId Uuid` (FK SetNull), `creditNoteInvoiceId? Uuid @unique` (FK Invoice — avoir lié).
  - Timestamps. Index `(invoiceId)`, `(status)`.
- **`StripeWebhookEvent`** : outbox idempotence.
  - PK `stripeEventId VarChar(255)` (Stripe `event.id`).
  - `type VarChar(120)`, `payload Json`, `eventCreatedAt DateTime`, `receivedAt DateTime @default(now())`.
  - `processedAt DateTime?`, `retryCount Int @default(0)`, `lastError? Text`.
- **`SiteSetting`** : variables business globales (extension `Setting` ou nouvelle table dédiée typée).
  - PK `key VarChar(120)`. `value Json`, `description? Text`.
  - Clés V1 : `maxConcurrentOptionsPerSlotDefault`, `quoteThresholdCentsDefault`, `vatRateDefault`, `vatReverseChargeDefault`, `vatMentionDefault`, `juridictionDefault`, `loiApplicableDefault`, `companyLegalForm`, `companyRegistrationNumber`, `companyVatNumber`, `paymentReminderDays`, `archiveRetentionYears`.

**Périmètre — Migrations `Booking` extensions** :

- `depositAmountCents Int?` (montant acompte à percevoir).
- `balanceAmountCents Int?` (solde restant).
- `basePriceHtCents Int?` (snapshot prix HT au moment validation).
- `travelFeeCents Int @default(0)`, `accommodationFeeCents Int @default(0)`, `mealFeeCents Int @default(0)`.
- `additionalFeesCents Int @default(0)`, `additionalFeesNotes Text?`.
- `quoteRequired Boolean @default(false)` (dérivé via helper).
- `ndaRequired Boolean @default(false)`.
- `feesMode FeesMode?` (snapshot mode au moment validation).
- `companyCity VarChar(120)?`, `companyCityNormalized VarChar(120)?` (slug + accent fold), `companyCityLat Decimal(9,6)?`, `companyCityLng Decimal(9,6)?` (geocoding).
- `travelBufferDays Decimal(3,1) @default(0)` (0 / 0.5 / 1).
- `trainingSessionId? Uuid` (**hook V2+ Qualiopi**, nullable, sans table associée V1).
- `paymentDeadline DateTime?` (TTL Checkout session ou échéance manuelle).
- `validationDecision ValidationDecision?` (enum `POSITIVE | NEGATIVE`, posée par Will à validation).
- `cancellationReason VarChar(500)?`, `cancellationWindow CancellationWindow?` (enum `>15d | 15-2d | <2d | fm`).
- `companySize CompanySize?` (enum INSEE `TPE | PME | ETI | GRANDE_ENTREPRISE`, dérivé `employeesCount`).
- `j7ReminderSentAt DateTime?`, `archivedAt DateTime?`.

**Périmètre — Extensions enums** :

- `BookingStatus` : 4 → ~28 valeurs effectives (~22 statuts business + 6 branches dérivées) — cf. Sprint X.4.
- `BookingOptionStatus` : 5 → 9 valeurs (`pending`, `pending_validation`, `confirmed` retiré, `lost_other_won`, `refused`, `expired_no_response`, `converted`).
- Nouveaux enums Prisma : `PaymentProvider`, `PaymentType`, `PaymentStatus`, `InvoiceType`, `InvoiceStatus`, `RefundStatus`, `PayerType`, `FeesMode`, `ValidationDecision`, `CancellationWindow`, `CompanySize`.

**Périmètre — Seeds** :

- Seed 4 `PaymentScheduleProfile` (cf. D-SEUILS-ECHEANCIER).
- Seed 7 `PricingConfig` par `InterventionType` (mappage depuis `pricing.ts` actuel + valeurs D-DEPOSIT).
- Seed `SiteSetting` defaults (16 clés).

**Périmètre — Admin UI V1** :

- `/admin/tarifs` : liste + édition `PricingConfig` (drawer Tiptap pour `subTiers` riche + form numérique pour `defaultDepositPct` / `quoteThresholdCents` / `vatRate` / `feesMode` / `flatFeeByZone` / `maxConcurrentOptions`). Bouton « Sauvegarder + Revalidate pages » → trigger `revalidatePath('/fr/interventions/**')` + `/en/interventions/**`. Audit log obligatoire.
- `/admin/echeanciers` : CRUD `PaymentScheduleProfile` (tableau tranches + dueOffset). Apercu calcul sur montant test.
- `/admin/parametres` : 16 `SiteSetting` clés (form structuré par section : Société / TVA / Cap options / Relances / Archivage).

**Périmètre — Helpers métier** :

- `src/lib/pricing-helpers.ts` :
  - `requiresQuote(interventionType, amountHtCents): boolean` (lit `PricingConfig.requiresQuoteAlways` OR `amountHtCents > quoteThresholdCents`).
  - `requiresNda(interventionType, companySize, sector): boolean` (lit `requiresNdaAlways` OR `companySize in [ETI, GRANDE_ENTREPRISE]` OR `sector in SENSITIVE_SECTORS`).
  - `computeInvoiceTotal({ basePriceHt, fees, vatRate, vatReverseCharge }): { subtotalHt, vatAmount, totalTtc }`.
  - `derivePaymentSchedule({ totalTtcCents, interventionType, override? }): BookingPaymentSchedule`.
  - `deriveDepositAmount(totalTtcCents, depositPct): number`.
- `src/lib/insee-size.ts` : `mapEmployeesToInseeSize(employeesCount): CompanySize`.
- `src/lib/sensitive-sectors.ts` : liste fermée curée (finance, banque, assurance, santé, défense, aerospace, etc.).
- `src/lib/stripe/client.ts` : singleton SDK + `apiVersion` pinned.

**Priorités** :

- **P0** : 8 migrations, seeds, ADRs Stripe + TVA + Pricing + Échéancier, helpers, admin UI `/admin/tarifs` + `/admin/echeanciers` + `/admin/parametres`.
- **P1** : revalidation auto pages publiques après modif `PricingConfig` (`revalidatePath`).
- **P2** : `StripeCustomer` table (V1 cache `providerCustomerId` dans Payment) — différable.
- **P3** : `Subscription`/`Mandate` tables (récurrent V2+).

**Tests Vitest** : `requiresQuote`, `requiresNda`, `computeInvoiceTotal` (avec VAT 0 % / 20 % / reverse-charge), `derivePaymentSchedule` (4 profils × 3 montants), `mapEmployeesToInseeSize` (5 buckets), `deriveDepositAmount`. CI `prisma migrate diff` sur shadow DB.

**Dépendances** : X.0 (gate Will).

**Sources GAP** : Reality Check §1.1 (8 tables absentes) + Agent 4 P0-1 à P0-5 + Agent 8 P0-2 + Agent 11 P0-1/2/3/6/7 + Agent 10 P1-1.

---

### Sprint X.2 — Stripe Checkout & webhook (~3j)

**Périmètre — Route handlers** :

- `POST /api/stripe/webhook` (Next 16 Route Handler, raw body via `request.text()`).
  - Signature : `stripe.webhooks.constructEvent(rawBody, sig, secret)` tolerance 5 min.
  - Idempotency outbox : insertion `StripeWebhookEvent` avec `ON CONFLICT DO NOTHING`. Si insert retourne 0 → 200 OK sans re-traitement.
  - Dispatch async : signature OK + outbox insert → BullMQ `stripeQueue.add('stripe.${event.type}', payload, { jobId: event.id })` → 200 OK immédiat.
- ~~`GET /api/stripe/customer-portal`~~ → **RETIRÉ V1 (D56)** — factures email PJ uniquement.

**Périmètre — Server Actions** :

- `createStripeCheckoutSessionAction(invoiceId)` (`src/features/payment/actions.ts`).
  - Inputs Zod : `invoiceId UUID`, optionnels `successUrl`, `cancelUrl`.
  - Garde-fous : `requireAdminWrite()` côté admin OU action publique via magic-link client-side (token signé). Turnstile + rate-limit `stripe:checkout:<ip>` 5/600s (Agent 8 P1-4).
  - `Idempotency-Key: ${invoiceId}-v1` (Agent 8 P1-5).
  - `zod.url().startsWith('https://axion-ia.com/')` sur `successUrl` / `cancelUrl` (Agent 8 P0-6 — anti open redirect).
  - `stripe.checkout.sessions.create({ mode:'payment', currency:'eur', expires_at: now+30min, customer_email, metadata: { bookingId, invoiceId, type, axionRef } })`.
- `cancelStripeCheckoutSessionAction(sessionId)` : annule session Checkout pending.

**Périmètre — Workers BullMQ** (stripe events) :

- `checkout.session.completed` → recherche `Invoice` par `metadata.invoiceId`, marque `Payment.status='succeeded'`, transition `Booking.status` selon échéancier, declenche email `payment-receipt`.
- `payment_intent.payment_failed` → log + ne pas libérer slot (la validation Will reste actée, juste relance paiement requise).
- `charge.refunded` → insert `Refund` + crée `Invoice type='credit_note'` (Agent 4 §5.5 #4).
- `charge.dispute.created` → flip `Booking.status='disputed'` + Telegram tag `LITIGE` (Agent 8 P1-6).
- `review.opened` → Telegram `FRAUDE_REVIEW`, bloque fulfillment (Agent 4 §5.5 #8).
- `customer.subscription.*` → ignore V1 (hook V2+).

**Périmètre — Sécurité Next.js** :

- `next.config.ts` → `experimental.serverActions.allowedOrigins = ['axion-ia.com', 'www.axion-ia.com']` (Agent 8 P0-4).
- CSP `connect-src` : ajout `https://api.stripe.com`.
- Stripe Radar activé Dashboard + ADR 0020-stripe-radar (règles `Block CVC fails > 1`, `Block IP riskscore > 75`).

**Périmètre — Templates emails** :

- `payment-link.tsx` (envoyé à validation Will, contient URL Checkout session).
- `payment-receipt.tsx` (envoyé à `checkout.session.completed`).
- `payment-failed.tsx` (envoyé à `payment_intent.payment_failed`).

**Priorités** :

- **P0** : webhook handler + signature + outbox + 5 events critiques (`completed`, `failed`, `refunded`, `dispute.created`, `review.opened`).
- **P0** : `createStripeCheckoutSessionAction` + Idempotency-Key + allowedOrigins + URL validation.
- **P0** : 3 templates emails.
- ~~**P1** : Customer Portal endpoint~~ → **RETIRÉ V1 (D56)** — factures email PJ uniquement. Hook V2+ préservé.
- **P1** : Stripe Radar activation + ADR.
- **P2** : Apple Pay / Google Pay Dashboard (no-code) — V1.5.

**Tests** : tests Vitest stripe-mock (signature OK, signature KO, idempotence replay, dispute handler, refund flow). Coverage cibles 1-10 Agent 4 §8.1.

**Dépendances** : X.1 (tables + SDK).

**Sources GAP** : Agent 4 P0-1 à P0-6 + Agent 8 P0-2/4/6 + P1-4/5/6/7.

---

### Sprint X.3 — DocuSeal self-hosted (~3-4j)

> 🚨 **Substitution stratégique** : DocuSeal remplace Yousign (économie ~50 €/mois SaaS, souveraineté UE, self-hosted Coolify Hetzner).

**Périmètre — Infra Coolify** :

- Ajout service `docuseal` dans `docker-compose.coolify.yml` (image `docuseal/docuseal:latest`).
- Volume persistant pour BDD SQLite/Postgres DocuSeal + templates uploaded.
- Reverse-proxy Caddy : `docuseal.axion-ia.com` SSL strict.
- Backup Hetzner Storage Box quotidien (cron).
- Configuration SMTP DocuSeal → relais Nodemailer existant.

**Périmètre — Migrations Prisma** :

- **`ContractTemplate`** : templates auto-générés.
  - PK `id Uuid`. `slug VarChar(64) @unique` (`contract_essentielle_v1`, `contract_approfondie_v1`, `nda_eti_v1`, `nda_sensitive_v1`).
  - `name VarChar(120)`. `bodyTiptapJson Json`, `bodyTiptapText Text` (pattern Sprint 24 Tiptap JSON+text).
  - `interventionTypes InterventionType[]` (formats applicables).
  - `variables Json` (placeholders auto-remplis : `clientName`, `companyName`, `amountTtc`, `dateIntervention`, `juridiction`, `vatMention`, etc.).
  - `locale Locale @default(fr)`, `isDefault Boolean`, `archived Boolean @default(false)`.
  - `updatedAt`, `updatedBy?`.
- **`ContractDocument`** : contrat instancié par booking.
  - PK `id Uuid`. `bookingId Uuid @unique` (FK Cascade).
  - `templateId Uuid` (FK SetNull).
  - `bodyTiptapJson Json`, `bodyTiptapText Text` (snapshot post-édition admin).
  - `pdfUrl VarChar(500)?`, `pdfHashSha256 VarChar(64)?`.
  - `docusealSubmissionId VarChar(255)? @unique` (référence DocuSeal API).
  - `status ContractStatus` (enum : `draft`, `pending_admin_review`, `sent_for_signature`, `signed`, `refused`, `expired`).
  - `signedAt DateTime?`, `expiresAt DateTime?`, `archivedUntil DateTime?` (10 ans).
  - Timestamps + `updatedBy?`.
- **`DocusealWebhookEvent`** : outbox idempotence (pattern Stripe).
  - PK `docusealEventId VarChar(255)`. `type`, `payload Json`, `receivedAt`, `processedAt?`, `retryCount`.

**Périmètre — Server Actions** :

- `generateContractDraftAction(bookingId)` : déclenchée à validation Will (X.4 trigger AUTO). Sélectionne `ContractTemplate` matching `interventionType`, remplit variables, crée `ContractDocument.status='draft'`.
- `editContractDraftAction(contractId, bodyTiptapJson)` : édition manuelle Tiptap avant envoi DocuSeal. Audit log.
- `sendContractForSignatureAction(contractId)` : push vers DocuSeal API → crée `submission`, récupère URL signataire, transition `pending_admin_review → sent_for_signature`. Email `contract-sent` envoyé.
- `markContractSignedManuallyAction(contractId, pdfUrl, signedAt)` : fallback super_admin si DocuSeal indisponible (path manuel + `bypassReason` obligatoire).
- **`cancelAndReissueContractAction(contractId, newDraftTiptap, reason)`** (D62 — nouveau) : versioning contrat **avant signature**. Annule submission DocuSeal courante → `ContractDocument.status='cancelled_admin'` + crée v2 (`version = previous + 1`, `previousVersionId = old.id`, `isAddendum=false`) + push nouvelle submission DocuSeal + email client `contract-version-updated`. Audit log diff Tiptap (hash before/after). Refuse si status `signed`.
- **`createContractAddendumAction(bookingId, addendumDraftTiptap)`** (D62 — nouveau) : avenant **après signature**. Crée nouveau `ContractDocument(isAddendum=true, previousVersionId=signedContract.id)` séparé. Contrat principal signé reste immuable (légal). Email client `contract-version-updated`.

**Périmètre — Versioning DB (D62)** :

- Colonnes ajoutées `ContractDocument` : `version Int @default(1)`, `previousVersionId Uuid?` (FK self), `isAddendum Boolean @default(false)`.
- Enum `ContractStatus` étendu : ajout `cancelled_admin` (annulation Will avant signature pour réémission v2).
- Audit log obligatoire : diff Tiptap JSON via hash SHA-256 stocké dans `BookingTransition.changes`.

**Périmètre — Webhook** :

- `POST /api/docuseal/webhook` HMAC SHA-256 (header `X-Docuseal-Signature`).
- Events traités : `submission.completed` → `ContractDocument.status='signed'`, transition `Booking.status='contract_signed'`. `submission.declined` → `status='refused'` + Telegram. `submission.expired` → `status='expired'`.

**Périmètre — Admin UI `/admin/contrats`** :

- Liste contrats par statut (filtre : draft / pending review / sent / signed / refused / expired).
- Drawer détail : Tiptap editor pour édition body avant envoi + bouton « Envoyer pour signature » + lien URL signataire (copyable) + timeline événements DocuSeal.
- Sous-route `/admin/contrats/templates` : CRUD `ContractTemplate` (Tiptap + variables JSON + locale FR/EN + interventionTypes).

**Périmètre — Templates emails** :

- `contract-sent.tsx` (envoyé après `sendContractForSignatureAction`, contient lien signataire DocuSeal).
- `contract-signed.tsx` (à `submission.completed`).
- `contract-refused.tsx` (à `submission.declined`).
- `contract-reminder.tsx` (J+2 si pas signé).

**Priorités** :

- **P0** : Coolify deploy DocuSeal, migrations Prisma, 4 Server Actions, webhook handler, admin UI list + drawer + Tiptap editor, 4 templates emails.
- **P0** : 1 `ContractTemplate` seed par défaut FR + EN (contrat prestation cabinet IA standard).
- **P1** : sous-route `/admin/contrats/templates` CRUD admin.
- **P2** : versioning templates (V2+).

**Tests** : E2E DocuSeal Docker (`docker-compose up docuseal` + envoi submission + webhook fake). Tests Vitest helpers signature HMAC + idempotence.

**Dépendances** : X.1 (infra DB).

**Sources GAP** : Agent 10 P0-3/4/5 + Agent 8 P0-3 (substitution Yousign → DocuSeal).

---

### Sprint X.4 — State machine deposit-validation gated (~4j)

> 🚨 **Refactor central**. Trigger AUTO à validation Will = contrat DocuSeal + facture Stripe + emails.

**Périmètre — Migration enum `BookingStatus`** (4 → ~25 valeurs effectives V1 incl. `awaiting_admin_validation` D51 + `installment_overdue` D59 + `disputed` D59 + `paused` D61) :

```
option_pending · cadrage_scheduled · cadrage_held · cadrage_declined ·
quote_sent · quote_signed · quote_declined ·
contract_pending · contract_payment_sent · contract_signed · contract_declined ·
awaiting_admin_validation · confirmed · paused · expired_unpaid ·
reminded_j7 · in_progress · completed · invoiced_balance ·
installment_overdue · paid_balance · disputed · archived ·
cancelled_by_user · cancelled_by_admin · no_show · force_majeure ·
refunded_partial · refunded_full · lost_other_won
```

**Invariants étendus D59-D61** :

- `confirmed → installment_overdue` : automatique via cron `installment-overdue-escalation` (#24) au J+30 retard 2ème/3ème échéance.
- `installment_overdue → disputed` : automatique au J+45 retard cumulé (état terminal recouvrement hors-app Will). Pas de rollback en code (Will marque manuellement résolu si paiement reçu après).
- `confirmed ↔ paused` : transitions bidirectionnelles via `pauseBookingAction` (A19) et `resumeBookingAction` (A20). Libère/bloque slots associés transactionnellement.
- `installment_overdue / disputed / paused` : aucune transition vers `archived` avant résolution explicite (statut bloquant rétention auto).

**Transitions clés D49 + D50 + D51** :

- `contract_pending → contract_payment_sent` : clic Will 1 "Envoi contrat + demande acompte" (Server Action `sendContractAndDepositRequestAction`, ex-`validateBookingOptionAction` renommée D49) après saisie admin obligatoire D55.
- `contract_payment_sent → awaiting_admin_validation` : **automatique** dès webhook Stripe acompte reçu (OU `recordManualPaymentAction` virement reçu). Critère bloquant unique D50 = paiement.
- `awaiting_admin_validation → confirmed` : **manuelle** par Will clic 2 "Valider sur le calendrier" (Server Action `validateBookingOnCalendarAction` nouveau D49). Slot bascule 🔴 + email final `booking-validated-on-calendar`.

**Périmètre — Backfill migration + Script migration V0 → V1 (D63)** :

- `pending → option_pending` (si slotId présent) sinon `cadrage_scheduled`.
- `confirmed (passé) → archived` + crée `Payment(isHistorical=true)` + `Invoice(isHistorical=true)` rétroactifs.
- `confirmed (futur) → confirmed` + crée `Payment(isHistorical=true)` + `Invoice(isHistorical=true)` rétroactifs.
- `cancelled → cancelled_by_admin`.
- `postponed → drop` (mort-né cf. Agent 3 N9) + alerte Will pour traitement manuel.
- **Livrable obligatoire D63** : `scripts/migrate-bookings-v0-to-v1.ts` idempotent + test sur snapshot dev avant prod + audit log immutable (`BookingTransition.trigger='migration.v0_to_v1'`) + backup Hetzner < 1h avant run prod + rollback plan documenté (cf. `03-ARCHITECTURE-CIBLE.md` §5.18).

**Périmètre — Table `BookingTransition` (event sourcing)** :

- PK `id Uuid`. `bookingId Uuid` (FK Cascade).
- `fromStatus BookingStatus?`, `toStatus BookingStatus`.
- `trigger VarChar(120)` (`admin.validateBookingOption`, `cron.option-expiration`, `webhook.stripe.checkout.completed`, `user.magic-link.cancel`, etc.).
- `actorType ActorType` (enum : `admin`, `cron`, `webhook`, `user`, `system`).
- `actorId? Uuid` (FK SetNull AdminUser).
- `changesJson Json` (snapshot `{ before, after, fields }` Agent 8 P1-3).
- `createdAt DateTime @default(now())` (immutable).
- UNIQUE partiel `(bookingId, toStatus) WHERE toStatus IN (confirmed, completed, paid_balance)` — transitions one-shot.

**Périmètre — Helper `src/features/booking/state-machine.ts`** :

- `TRANSITIONS: Readonly<Record<BookingStatus, ReadonlyArray<BookingStatus>>>` (whitelist).
- `assertTransitionAllowed(from, to, role): void`.
- `applyTransition(tx, bookingId, to, { actorType, actorId, changes }): Promise<void>` (insère `BookingTransition` + update `Booking.status` dans la même tx, audit log obligatoire).

**Périmètre — Guards (invariants)** :

- I1 — UNIQUE partiel option active : `CREATE UNIQUE INDEX bookings_options_active_per_slot ON bookings_options (slot_id) WHERE status IN ('pending','pending_validation')` — bloqué par cap config.
- I2 — Cap multi-options : `SiteSetting.maxConcurrentOptionsPerSlotDefault` (default 3) + override `PricingConfig.maxConcurrentOptions`. Check au `postOption48hAction`.
- I3 — Skip cadrage si `interventionType === 'audit_flash_onsite'` (D-DEPOSIT 100 % paiement intégral). Direct `option_pending → deposit_pending`.
- I4 — `requiresQuote(interventionType, basePriceHtCents) === true` → flow passe par `quote_sent → quote_signed` avant `contract_pending`.
- I5 — `requiresNda` → flow inclut NDA via DocuSeal (réutilise X.3).
- I6 — Clic Will 1 "Envoi contrat + demande acompte" (D49 — Server Action `sendContractAndDepositRequestAction`) après saisie admin D55 (frais + Tiptap contrat, pas de seuil) déclenche AUTO (transition `pending_validation → contract_pending → contract_payment_sent`) :
  - Recherche `ContractTemplate` matching `interventionType` + fusion `defaultLegalClauses` D53 → contrat Tiptap rempli.
  - Application des édits Will sur frais et corps Tiptap (D55 — saisie obligatoire).
  - Genère draft `Invoice type='deposit'` selon `BookingPaymentSchedule.tranches[0]` → `issueInvoiceAction(bookingId, type='deposit')`.
  - Crée Stripe Checkout session via `createStripeCheckoutSessionAction(invoiceId)` → URL stockée dans `Invoice`.
  - Envoie contrat DocuSeal + email client `contract-sent-with-deposit-link` (ou `payment-link` selon variante).
  - Notification Will = Telegram + console admin uniquement (D54, pas d'email Will).
  - Pour autres `BookingOption` du même slot : transition vers `lost_other_won` + email `option-lost-other-won`.
- **I6bis — Webhook Stripe acompte reçu (D50 + D51)** : `contract_payment_sent → awaiting_admin_validation` automatique. Critère bloquant unique = paiement. Le contrat signé n'est PAS bloquant (badge ⚠️ "Contrat à signer le jour J" si non signé via DocuSeal). Notification Telegram Will + console admin ("Booking prêt à valider sur calendrier").
- **I6ter — Clic Will 2 "Valider sur le calendrier" (D49 — Server Action `validateBookingOnCalendarAction`)** : transition `awaiting_admin_validation → confirmed`. Slot bascule 🔴. Envoi email final `booking-validated-on-calendar` au client. Vérifie invariant `Booking.status === 'awaiting_admin_validation'` sinon refuse.
- I7 — `validationDecision === 'NEGATIVE'` → forcer `cadrage_declined`, refuser T5/T8/T11.
- I8 — Refund grille CGV configurable (Sprint X.17). Défaut V1 : J-15+ = 50 % acompte refund / < J-15 = acompte conservé / force majeure = 100 % refund.
- I9 — Role check par transition (super_admin only pour `force_majeure`, `cancelled_by_admin` > 50 % refund, `no_show`).

**Périmètre — Server Actions admin** :

- **`sendContractAndDepositRequestAction(optionId, editedContractTiptap, editedFees)`** (D49 — renommage de `validateBookingOptionAction`) — clic Will 1 (après écran saisie admin D55) déclenche AUTO trigger I6.
- **`validateBookingOnCalendarAction(bookingId)`** (D49 — nouveau) — clic Will 2 (depuis section dashboard "Prêts à valider") déclenche I6ter (transition `awaiting_admin_validation → confirmed`).
- `refuseBookingOptionAction(optionId, reason)` — flip `pending → refused` + email `option-refused`.
- `cancelBookingByAdminAction(bookingId, reason, refundOverride?)` — calcule `cancellationWindow` + applique grille refund.
- `markCompletedAction(bookingId)` — `in_progress → completed`.
- `markNoShowAction(bookingId)` — `confirmed → no_show` (super_admin only).
- `markForceMajeureAction(bookingId, reason)` — `* → force_majeure` (super_admin only).
- `rescheduleBookingAction(bookingId, newDate)` — décale sans refund si ≥ J-7.
- **`pauseBookingAction(bookingId, pausedUntil, pauseReason)`** (D61 — nouveau A19) — `confirmed → paused` + libère slots + email client `booking-paused-confirmation` + active cron `paused-resume-reminder`.
- **`resumeBookingAction(bookingId, newSlotIds[])`** (D61 — nouveau A20) — `paused → confirmed` + bloque nouveaux slots + email client `booking-resumed-notification`.
- **`cancelAndReissueContractAction(contractId, newDraftTiptap, reason)`** (D62 — nouveau A21) — refuse si `ContractDocument.status === 'signed'`. Annule v1 (`cancelled_admin`) + crée v2 + DocuSeal + email client `contract-version-updated`.
- **`createContractAddendumAction(bookingId, addendumDraftTiptap)`** (D62 — nouveau A22) — avenant post-signature, contrat principal reste immuable. Crée ContractDocument séparé (`isAddendum=true`) + DocuSeal + email client `contract-version-updated`.

**Périmètre — Refactor Server Actions existantes** :

- `createBookingAction` → ne pose plus `Booking.status='confirmed'`, route vers `option_pending`.
- `postOption48hAction` → branche cadrage avant acompte + check cap multi-options.
- `validateOptionAction` (legacy) → renommée **`sendContractAndDepositRequestAction`** (D49) + trigger AUTO I6 (clic Will 1). Nouvelle Server Action `validateBookingOnCalendarAction` ajoutée pour clic Will 2 (I6ter).
- `cancelBookingAction` (legacy) → calcule `cancellationWindow` + grille refund.

**Périmètre — Drop legacy** :

- `Booking.calendarEventId` (Reality Check GAP #14) — drop migration.
- `BookingStatus.postponed` (mort-né) — drop migration.
- `BookingOptionStatus.confirmed` (mort-né N15) — drop migration.

**Tests Vitest** : 30+ tests cibles Agent 3 §7 (TS1-TS20 + extensions multi-options) :

- Transitions whitelisted, idempotence webhook, concurrence admin, skip flash onsite, quote required threshold, NDA required ETI+sensitive, cadrage NEGATIVE terminate, deposit expiration sans refund, refund grille J-15, role check super_admin, multi-options cap, validation AUTO trigger I6.

**Dépendances** : X.1 (tables Payment/Invoice), X.2 (Stripe Checkout), X.3 (DocuSeal Contract).

**Sources GAP** : Agent 3 P0 N1-N8 + Agent 7 P0-7 (cancellation visiteur asymétrique).

---

### Sprint X.5 — Multi-options simultanées (~2j)

> 🚨 **Changement doctrinal** : suppression de la course à la signature (option 48h universelle), Will valide librement parmi N options.

**Périmètre — Refactor verrou** :

- Suppression du verrou pessimiste exclusif `FOR UPDATE` sur `CalendarSlot.status='reserved'` lors du `postOption48hAction` (cf. Agent 3 §5).
- Le slot ne passe `reserved` qu'à `validateBookingOptionAction` (= validation Will). Tant qu'aucune validation : slot reste `available` côté DB mais marqué « pré-réservé N » côté visiteur.

**Périmètre — Cap config** :

- `SiteSetting.maxConcurrentOptionsPerSlotDefault Int @default(3)`.
- Override `PricingConfig.maxConcurrentOptions Int @default(3)` par `interventionType`.
- Helper `getMaxConcurrentOptions(interventionType): number`.
- Check au `postOption48hAction` : `COUNT(BookingOption WHERE slotId=$slot AND status IN ('pending','pending_validation')) >= max` → return `{ ok: false, error: 'cap_reached' }`.

**Périmètre — Extensions `BookingOptionStatus`** :

- `pending` → en attente validation Will.
- `pending_validation` → vu par Will, en cours d'analyse (optionnel, sinon directement `pending` → validation finale).
- `lost_other_won` → autre option validée pour le même slot.
- `refused` → refusée par Will.
- `expired_no_response` → expiré sans réponse Will (TTL configurable, default 7j).
- `converted` → convertie en Booking (post-validation).

**Périmètre — Cascade à validation Will** :

- À `validateBookingOptionAction(optionId)` : sélectionne autres `BookingOption` du même `slotId` avec `status IN ('pending','pending_validation')` → transition `lost_other_won` + enqueue email `option-lost-other-won` (avec dates alternatives suggérées via `findAvailableSlotsNear(date, ±14j)`).

**Périmètre — UI calendrier visiteur** (5 statuts : 4 visiteur visibles + 1 admin invisible) :

- `libre` : 0 options actives, slot dispo. [VISITEUR]
- `pré-réservé N` : compteur visible si > 0 et < cap (ex « 2 entreprises ont pré-réservé ce créneau »). [VISITEUR]
- `cap atteint` : N === cap, slot fermé aux nouvelles options. [VISITEUR]
- `validé` : `CalendarSlot.status='reserved'` post-validation. [VISITEUR]
- `bloqué` : `CalendarSlot.status='blocked'` (vacances Will) — **invisible visiteur**, rendu comme `libre` côté public. [ADMIN]
- Update `loadDbBookedSlots()` (`reserver/page.tsx:27`) + `BookingCalendar` cell rendering.

**Périmètre — Emails templates** :

- `option-posted` (déjà existant, à mettre à jour : « vous êtes en option n°X sur Y, validation Will sous 24-48h »).
- `option-lost-other-won` (nouveau, suggère 3 dates alternatives proches).
- `option-validated` (nouveau, déclenche AUTO contrat + paiement).

**Tests Vitest** : race conditions (3 visiteurs simultanés sur même slot avec cap=3 → 3 options OK ; 4ème → cap_reached). Cascade `lost_other_won` à validation.

**Dépendances** : X.4 (state machine).

**Sources GAP** : Agent 3 N1-N3 + Agent 1 P0-2/3 (mensonge UX corrigé).

---

### Sprint X.5bis — Parcours B Formulaire devis qualifié (D44) (~2j)

> 🆕 **Sprint ajouté post-`UX-E2E-VERIFICATION.md`** : matérialise le **parcours B** (formats avec devis : IA Custom, transformation collective sur-mesure, packs annuels, > 5 000 € HT). Le visiteur ne choisit pas de slot — il soumet une demande qualifiée → négociation hors-app → Will matérialise le Booking via drawer admin (couvert par X.8 ext).

**Périmètre — Migration Prisma** :

- Extension enum `SubmissionType` : ajout `quote_request` (V0 a `audit / implementation / intervention / contact`).
- Création enum `SubmissionStatus` : `new / qualifying / negotiating / converted / lost / archived` (inerte pour types V0, sert pipeline B).
- Création enum `BookingOriginPath` : `direct / quote_negotiation`.
- Extension `Booking` : ajout colonnes `originPath BookingOriginPath @default(direct)` (index) + `fromSubmissionId Uuid?` (FK -> Submission, SetNull).
- Helper Prisma `getSubmissionPipelineCounts()` pour `/admin/demandes-devis` (counts par status).

**Périmètre — Pages publiques** :

- Route `/fr/demande-devis` (FR) + `/en/request-quote` (EN) avec form qualifié 10-12 champs :
  - Entreprise (raison sociale, taille INSEE select `CompanySize`, secteur select `companySectors`).
  - Contact (nom, email, téléphone).
  - Format souhaité (select dérivé `interventions-taxonomy.ts`, préfill via `?intervention=<slug>`).
  - Contexte business (textarea 200-500 mots, validation min 200 chars).
  - Budget pressenti (input optionnel).
  - Timing en semaines.
  - Lieu (ville + déplacement Oui/Non).
  - Nombre de participants estimé.
  - Consentement CGV + consentement RGPD (checkboxes).
- Honeypot `website` + widget Turnstile.
- Page de confirmation `/fr/demande-devis/confirmation` + `/en/request-quote/confirmation`.

**Périmètre — Server Action visiteur** :

- `submitQuoteRequestAction(formData)` (V4) :
  - Rate-limit `quote:<ip>` 3/3600s.
  - Vérif Turnstile + honeypot.
  - Crée `Submission(type='quote_request', status='new', details=<formData>, referer=..., locale=...)`.
  - **AUCUN slot calendrier réservé** (D45).
  - Enqueue email `quote-request-received` (visiteur) + alerte Telegram Will `QUOTE_REQUEST_RECEIVED`.
  - Return `{ok, submissionId}`.

**Périmètre — Templates emails** :

- `quote-request-received` (template #31, visiteur) : « Demande de devis reçue. William vous recontactera sous 24-48h pour cadrage. ». Plain-text fallback. Pas d'ETA ferme (négo libre).

**Périmètre — Tracking & funnel** :

- Plausible event `Quote Request Submitted` (props : intervention, fromCity, utmSource).
- Persist `Submission.referer` + UTM dans `Submission.details` (cohérent X.18).

**Priorités** :

- **P0** : Page FR + EN + Server Action V4 + extension enums + email #31 + Telegram tag + page confirmation.
- **P0** : Liaison admin nav (sidebar « Demandes devis »).
- **P1** : Plausible funnel events.
- **P2** : Préfill UTM/region cookie (réutilise X.18 logic).
- **P3** : i18n complet EN (V1.5 si copy EN pas prête).

**Tests Vitest** : Server Action V4 validation (champs requis, longueur contexte, Turnstile mock), idempotence Submission.

**Dépendances** : X.4 (state machine — pour cohérence pipeline) + X.5 (extension enums) + X.18 (Plausible).

**Sources GAP** : `UX-E2E-VERIFICATION.md` B-P0-1 + B-P0-2 + B-P0-3 + B-P0-4 + B-P0-6 (partiel : template #31).

---

### Sprint X.6 — Pre-booking cadrage (manual_external V1) (~3j)

> ⚠️ **Décision Will X.0** : provider visio = `manual_external` V1 (Will saisit lien Meet/Whereby/Jitsi manuellement). Provider natif → V1.5.

**Périmètre — Migration Prisma** :

- **`CadrageMeeting`** :
  - PK `id Uuid`. `bookingOptionId Uuid @unique` (FK Cascade).
  - `provider CadrageProvider @default(manual_external)` (enum : `manual_external`, `whereby`, `google_meet`, `jitsi` — V1.5).
  - `scheduledAt DateTime`. `durationMin Int @default(30)`.
  - `videoUrl VarChar(500)?` (saisi manuellement par Will dans drawer).
  - `heldAt DateTime?`, `actualDurationMin Int?`, `notesJson Json?` (Tiptap).
  - `validationDecision ValidationDecision?` (POSITIVE | NEGATIVE — posée à `markCadrageHeldAction`).
  - `magicToken VarChar(64) @unique` (lien magique client annulation/reschedule).
  - `expiresAt DateTime?` (TTL magic-link 14j).
  - `reminderSentJ1At DateTime?`, `reminderSentH2At DateTime?`.
  - Timestamps. Index `(scheduledAt)`, `(bookingOptionId)`.

**Périmètre — Server Actions** :

- `scheduleCadrageMeetingAction(bookingOptionId, scheduledAt, videoUrl?)` (admin) :
  - Crée `CadrageMeeting` + magicToken HMAC.
  - Transition `BookingOption.status: option_pending → cadrage_scheduled`.
  - Enqueue email `cadrage-scheduled` avec lien visio (si fourni) + lien magique reschedule + `.ics` attachment.
- `markCadrageHeldAction(cadrageId, decision: POSITIVE | NEGATIVE, notes?)` (admin) :
  - Pose `heldAt = now()`, `validationDecision`, `notesJson`.
  - Si `POSITIVE` : transition vers `pending_validation` (prête pour validation Will dans `/admin/demandes`).
  - Si `NEGATIVE` : transition vers `cadrage_declined` + email `cadrage-declined`.
- `rescheduleCadrageByClientAction(magicToken, newScheduledAt)` (public via magic-link) :
  - Vérifie token HMAC + non-expiré.
  - Update `scheduledAt` + emails update FR/Will.
- `cancelCadrageByClientAction(magicToken, reason)` (public).

**Périmètre — Drawer admin cadrage** :

- Sous-section dans `/admin/demandes/[id]` (drawer Sprint X.8) :
  - Champ « Lien visio » (input URL, copy-paste manuel Meet/Whereby/Jitsi).
  - Champ « Date + heure cadrage » (datetime-local input).
  - Bouton « Planifier » → `scheduleCadrageMeetingAction`.
  - Section « Après le cadrage » :
    - Champ « Durée réelle » (min).
    - Tiptap « Notes cadrage » (questions standard pré-remplies).
    - Boutons « Décision positive → continuer » / « Décision négative → refuser ».

**Périmètre — Templates emails** :

- `cadrage-scheduled` (visiteur : confirmation + lien visio + `.ics` + lien magique reschedule).
- `cadrage-reminder-j1` (J-1).
- `cadrage-reminder-h2` (H-2).
- `cadrage-recap` (post-cadrage, lien step suivant).
- `cadrage-declined` (refus côté Will, motif libre).
- `cadrage-rescheduled-by-client` (notification Will).

**Périmètre — `.ics` attachment** :

- Helper `src/lib/ics-generator.ts` : génère `VCALENDAR` minimal avec `SUMMARY`, `DTSTART`, `DTEND`, `LOCATION` (URL visio), `DESCRIPTION`, `ORGANIZER`.

**Périmètre — Skip cadrage `audit_flash_onsite`** :

- Si `interventionType === 'audit_flash_onsite'` : transition directe `option_pending → pending_validation` (skip `cadrage_scheduled`). Cohérent doctrine D9 + audit-detail-configs.ts:204.

**Priorités** :

- **P0** : `CadrageMeeting` + 4 actions + 6 templates + `.ics` + drawer admin.
- **P0** : Skip flash onsite.
- **P1** : magic-link reschedule/cancel client.
- **P2** : checklist questions standard cadrage (V1 wishlist).
- **P3** : enregistrement audio/vidéo (V2+).

**Tests** : Vitest scheduling + reminder windows + magic-link HMAC + skip flash onsite.

**Dépendances** : X.4 (state machine).

**Sources GAP** : Agent 10 P0-1/2 + Agent 7 P0-1/2.

---

### Sprint X.7 — Devis semi-auto + signature DocuSeal (~3j)

**Périmètre — Migration Prisma** :

- **`Quote`** :
  - PK `id Uuid`. `bookingId Uuid` (FK SetNull).
  - `number VarChar(32) @unique` (séquentiel `AXION-DEVIS-2026-NNNN`).
  - `status QuoteStatus` (enum : `draft`, `sent_for_signature`, `signed`, `declined`, `expired`).
  - `validUntil DateTime`. `signedAt DateTime?`.
  - `subtotalHtCents`, `vatRate`, `vatReverseCharge`, `vatAmountCents`, `totalTtcCents`.
  - `lineItems Json` (array : nb jours, nb participants, options, frais accessoires détaillés).
  - `feesMode FeesMode` (snapshot).
  - `pdfUrl VarChar(500)?`, `pdfHashSha256 VarChar(64)?`.
  - `docusealSubmissionId VarChar(255)? @unique` (réutilise pipeline DocuSeal X.3).
  - Index, timestamps.
- **`SignatureRequest`** : abstraction commune Quote/Contract/NDA (peut être fusionné avec `ContractDocument` si simplification).

**Périmètre — Server Actions** :

- `generateQuoteDraftAction(bookingId)` (admin) :
  - Pré-rempli depuis `PricingConfig.defaultBasePriceHtCents` + `Booking.companySize` + `participantsCount` + frais accessoires selon `feesMode`.
  - Crée `Quote.status='draft'`.
- `editQuoteDraftAction(quoteId, lineItems, fees, notes)` : édition admin (form structuré + Tiptap pour conditions particulières).
- `sendQuoteForSignatureAction(quoteId)` : push DocuSeal (réutilise X.3 pipeline) → `status='sent_for_signature'`. Email `quote-sent`.
- `markQuoteSignedManuallyAction(quoteId, pdfUrl)` : fallback super_admin.

**Périmètre — Trigger `requiresQuote`** :

- Helper `requiresQuote(interventionType, basePriceHtCents)` (X.1) appelé dans state machine.
- Si `true` au validateBookingOption → flow `pending_validation → quote_sent → quote_signed → contract_pending → deposit_pending`.

**Périmètre — Admin UI `/admin/devis/[bookingId]`** :

- Form pré-rempli (nb jours, nb participants, options, frais).
- Tiptap « Conditions particulières ».
- Bouton « Générer PDF » (react-pdf).
- Bouton « Envoyer pour signature DocuSeal ».
- Timeline événements (draft → sent → signed).

**Périmètre — Templates emails** :

- `quote-sent` (lien signature + PDF attached).
- `quote-signed` (notification Will + client).
- `quote-declined` (motif libre).
- `quote-reminder` (J+3 si pas signé).
- `quote-expired` (J+7).

**Priorités** :

- **P0** : Quote model + 4 actions + admin UI + 5 templates + intégration DocuSeal.
- **P1** : numérotation séquentielle locked Postgres advisory.
- **P2** : multi-versions devis (V1.5).
- **P3** : approval workflow (V2+ multi-admin).

**Tests** : Vitest numérotation séquentielle concurrence, helper `requiresQuote`, DocuSeal pipeline mock.

**Dépendances** : X.3 (DocuSeal), X.4 (state machine).

**Sources GAP** : Agent 10 P0-3 + Agent 11 P0-7 (devis transparent).

---

### Sprint X.8 — Admin Réservations + Demandes devis (liste + drawer riche A + drawer unifié B) (~4-5j)

> 🆕 **Périmètre étendu post-`UX-E2E-VERIFICATION.md`** : ajout `/admin/demandes-devis` (parcours B) + drawer admin unifié B (D47) + Server Action `createBookingFromSubmissionAction` (A16) + Server Action `updateSubmissionDraftAction` (A17). +1-2j vs version précédente (3-4j → 4-5j).

**Périmètre — Routes admin** :

- `/admin/demandes` : liste `BookingOption` (parcours A) en attente validation (`status IN ('pending','pending_validation','cadrage_scheduled','cadrage_held')`).
- **`/admin/demandes-devis`** (D44 — parcours B) : liste `Submission WHERE type='quote_request' AND status IN ('new','qualifying','negotiating')`. Onglets latéraux par status : Nouvelles / En qualification / En négociation / Converties / Perdues / Archivées.
- `/admin/reservations` : liste `Booking` validées (A + B fusionnées, badge origine `direct` vs `quote_negotiation`).

**Périmètre — Liste `/admin/demandes`** :

- Filtres : statut option, interventionType, période, ville, urgence (badge ⌛ « < 24h », ⏰ « < 48h »).
- Table : Société | Type | Date demandée | Cadrage statut | Décision Will | Actions.
- Bouton **« Envoi contrat + demande acompte »** (D49 — renommage du bouton « Valider ») → ouvre **écran saisie admin obligatoire D55** :
  - Récap demande (read-only).
  - 4 inputs frais accessoires (déplacement / hôtel / repas / divers + Tiptap notes) — modifiables, préfill auto OSM.
  - Édition contrat Tiptap (template + `defaultLegalClauses` D53 fusionnées + variables substituées) — toujours éditable, PAS de seuil 1 500 € HT.
  - Bouton « Envoyer » → `sendContractAndDepositRequestAction(optionId, editedContractTiptap, editedFees)` (A1 §5.2.2 03-ARCH).
  - Bouton « Sauvegarder brouillon » (sauvegarde sans envoyer).
- Bouton « Refuser » → drawer motif libre.

**Périmètre — Section dashboard "Prêts à valider" (D49)** :

- Carte dédiée dans `/admin` (Dashboard) listant les Bookings `status='awaiting_admin_validation'` (acompte reçu, en attente du 2ème clic Will).
- Chaque ligne expose : Société | Slot(s) | Montant acompte reçu | Date paiement | Badge ⚠️ "Contrat à signer le jour J" (si contrat non signé via DocuSeal, D50 — non bloquant).
- Bouton **« Valider sur le calendrier »** (1 clic) → `validateBookingOnCalendarAction(bookingId)` (A1bis §5.2.2 03-ARCH).
- Confirmation modale : « Bascule slot 🔴 + email final client + non-réversible. »
- Audit log : `ActivityLog(target='Booking', action='validated_on_calendar', changes={fromStatus:'awaiting_admin_validation', toStatus:'confirmed'})`.

**Périmètre — Liste `/admin/reservations`** :

- Filtres : statut booking, période, client, montant.
- Table : N° | Client | Date | Type | Montant | Statut paiement | Échéance suivante.
- Tri par échéance proche.

**Périmètre — Drawer détail riche** (Radix Sheet, mobile-friendly) :

- **Section Timeline** : `BookingTransition[]` rendus chronologiquement.
- **Section État machine** : status badge + boutons transitions autorisées.
- **Section Cadrage** : date + lien visio + bouton « Marquer tenu » (link X.6).
- **Section Contrat** : statut + lien preview PDF + bouton « Éditer Tiptap » (link X.3).
- **Section Facture** : Invoice (acompte/tranches/solde) + bouton « Générer facture » (link X.10).
- **Section Paiements** : liste `Payment[]` + bouton « + Enregistrer paiement manuel » (link X.11).
- **Section Frais accessoires** : `travelFee`, `accommodationFee`, `mealFee`, `additionalFees` + Tiptap notes.
- **Section Activity log** : `ActivityLog` filtrés `targetId=bookingId`.

**Périmètre — Liste `/admin/demandes-devis` (D44 — parcours B)** :

- Filtres : status pipeline B, période, interventionType, taille INSEE.
- Table : Société | Format souhaité | Date soumission | Statut pipeline (badge couleur) | Montant pressenti | Dernière activité | Actions.
- Bouton « Convertir en Booking » → ouvre **Drawer parcours B** (cf. ci-dessous).
- Bouton « Marquer perdu » + textarea raison.
- Bouton « Archiver » (status = `archived`).

**Périmètre — Drawer admin parcours B (D47)** (Radix Sheet plein-écran desktop, full-height mobile) :

Sections (ordre d'écran) :

1. **Récap soumission** (read-only depuis `Submission.details`) : entreprise, taille INSEE, secteur, contact (nom/email/tél), format souhaité, contexte business (200-500 mots), budget pressenti, timing semaines, lieu, participants, date soumission, source UTM, referer.
2. **Pipeline statut** : toggle radio `new → qualifying → negotiating → converted | lost | archived`. Bascule via `updateSubmissionDraftAction` (A17).
3. **Notes négociation** (Tiptap libre, sauvegarde brouillon auto debounce 2s).
4. **Slot picker multi-slots** : embed mini-calendrier admin (Mois + Semaine). Will clique 1 ou plusieurs slots dispo → sélection persistée dans state local drawer. Slots restent visuellement « tentatifs » (badge ⚫ admin pending) tant que `createBookingFromSubmissionAction` n'est pas appelée. Affiche distance OSM + alerte géo (link X.16).
5. **Montant & frais** : input `amountHtCents` (auto-format €) + 4 inputs (`travelFeeCents`, `accommodationFeeCents`, `mealFeeCents`, `additionalFeesCents`) + Tiptap notes additionnelles.
6. **Échéancier** : select `PaymentScheduleProfile` par défaut (auto-suggéré selon montant total) OU mode custom (table éditable lignes %, dueAt, label).
7. **TVA** : select `vatRate` + checkbox `vatReverseCharge` (FR ou EE selon Sprint X.17) + textarea `vatMention` (préremplé depuis `legal.ts`).
8. **Éditeur Tiptap CONTRAT** : zone rich-text préremplie depuis `ContractTemplate` par défaut. Variables `{{client.name}}`, `{{amount.ttc}}`, `{{slots.dates}}` substituées en preview live.
9. **Éditeur Tiptap DEVIS** : zone rich-text préremplie depuis template devis dédié (line items détaillés, validity 30j par défaut, conditions paiement).
10. **Bouton « Envoyer devis + contrat + lien paiement »** (1 clic) → confirm dialog → `createBookingFromSubmissionAction(submissionId, slots[], amountHtCents, scheduleProfileId|customInstallments[], fees, vatRate, vatReverseCharge, contractDraftTiptap, quoteDraftTiptap)` (A16).
11. **Boutons secondaires** : « Sauvegarder brouillon » (`updateSubmissionDraftAction` A17) / « Marquer perdu » / « Archiver ».

**Périmètre — Server Actions parcours B** :

- `createBookingFromSubmissionAction(submissionId, slots[], amountHtCents, scheduleProfileId | customInstallments[], fees, vatRate, vatReverseCharge, contractDraftTiptap, quoteDraftTiptap)` (A16) :
  - Crée `Booking` (`originPath='quote_negotiation'`, `fromSubmissionId=submissionId`).
  - Bloque les `slots[]` (transition `CalendarSlot.status='reserved'` cascade).
  - Crée `Quote(status='draft' → sent_for_signature)` via DocuSeal (réutilise pipeline X.3).
  - Crée `ContractDocument(status='draft' → sent)` via DocuSeal.
  - Crée `Invoice deposit` + Stripe Checkout Session.
  - Snapshot échéancier dans `BookingPaymentSchedule`.
  - Enqueue email **unifié** `contract-sent-with-deposit-link` (#33).
  - Marque `Submission.status='converted'`.
  - Audit log `Booking.created from Submission`.
  - RBAC `super_admin` only si `amountHtCents > 1500000` (> 15 000 €).
- `updateSubmissionDraftAction(submissionId, partialUpdates)` (A17) :
  - Met à jour `Submission.details` JSON + transitions status pipeline B.
  - Aucun email/Telegram envoyé (brouillon admin pur).
  - Audit log `Submission.updated`.

**Périmètre — Bulk actions V1 limité** :

- Annulation multiple (max 10) en cas de force majeure (vacances Will imprévues).

**Périmètre — Sécurité** :

- RBAC : `read` pour liste + drawer ; `admin/super_admin` pour actions.
- `super_admin` only pour `cancel_by_admin > 50% refund`, `force_majeure`, `no_show`.

**Priorités** :

- **P0** : `/admin/demandes` + `/admin/demandes-devis` + `/admin/reservations` + drawer riche A complet + drawer unifié B complet + bouton Valider AUTO (A) + bouton « Envoyer devis + contrat + lien paiement » (B) via A16.
- **P0** : Server Actions A16 + A17 (parcours B).
- **P0** : Fiche client unifiée (P1-1) — agrège tous Bookings A+B + toutes Submissions historiques même `contactEmail`.
- **P1** : Bulk actions annulation (max 10).
- **P2** : Recherche full-text (V1.5).
- **P3** : Saved filters (V2+).

**Tests** : Vitest RBAC par action + drawer rendering snapshot + A16 createBookingFromSubmissionAction happy path (1 slot et N slots) + A17 transitions pipeline B.

**Dépendances** : X.4 (state machine), X.5bis (parcours B foundation), X.3 (DocuSeal), X.2 (Stripe), X.10 (Invoice numbering).

**Sources GAP** : Agent 2 P0 (drawer absent, navigation 3x) + Agent 5 P0-2 (drawer dossier) + `UX-E2E-VERIFICATION.md` B-P0-5 + B-P0-7 + P1-1 + P1-2 + P1-4.

---

### Sprint X.9 — Admin Calendrier v2 (vues + capacité + heatmap géo) (~3-4j)

**Périmètre — Vues** :

- Tabs `[Mois | Semaine | Jour | Agenda]` (React Server Components + URL searchParams).
- Vue Mois : grille 7×6 existante améliorée.
- Vue Semaine : grille 7 jours horizontale.
- Vue Jour : timeline 8h-20h.
- Vue Agenda : liste plate 90 prochains jours triée.

**Périmètre — États visibles** (5 catégories) :

- `libre`, `pré-réservé N` (avec compteur), `validé`, `bloqué`, `férié`.

**Périmètre — Filtres** :

- Intervention (enum 7 valeurs), statut booking, ville (text + autocomplete depuis `companyCity`), période, checkbox « options pending only ».

**Périmètre — Heatmap capacité Will** (D23) :

- Calcul `CapacityWindow` recompute quotidien (X.16) : 1 intervention/jour, 3/semaine, 8/mois.
- Badge en haut de chaque semaine `2/3 sem`. Couleur cell : vert ≤ saturation, jaune = saturé, rouge > saturation.

**Périmètre — Heatmap géographique** (D24) :

- Pour chaque slot avec `audit_flash_onsite` ou intervention `onsite` : affichage `📍 Lyon — buffer 0,5j`.
- Calcul `targetCity` depuis `Booking.companyCity` + table buffer par zone (Paris/IDF=0j, métro=0,5j, DOM-TOM=1j).
- Auto-bloque J-1/J+1 si métro (transition automatique slot adjacent `blocked` avec `blockedReason='travel_buffer'`).
- Alertes Telegram conflits (cf. X.16).

**Périmètre — Export iCal signé** :

- Endpoint `/api/admin/calendar/ical/:token` (HMAC signed, TTL 90j) → flux iCal lecture-seule pour Google Calendar perso Will.
- Inclut `Booking` confirmés + `CadrageMeeting` planifiés + slots bloqués.

**Périmètre — Drag-drop reschedule admin (D60 — matérialisé)** :

- Server Action **`rescheduleBookingByAdminAction(bookingId, newSlotIds[], reason, notifyClient: bool)`** (A18 §5.2.2 03-ARCH).
- Restriction statut : autorisé si `Booking.status ∈ {contract_payment_sent, awaiting_admin_validation, confirmed, paused}` — refusé sinon (return `{ok: false, error: 'invalid_status_for_admin_reschedule'}`).
- Drag-drop UI : Will déplace 1 ou plusieurs slots (multi-jours support pour packs collectifs 4j) vers nouvelles dates.
- Modal confirmation « Décaler du DD/MM au DD/MM ? Notifier le client ? ».
- Audit log obligatoire (`BookingTransition.trigger='admin.reschedule'`, changes={oldSlotIds, newSlotIds, reason}).
- Si `notifyClient=true` → email client `booking-rescheduled-by-admin` (template #52) avec nouveau `.ics` attaché.
- Transactionnel : libère ancien(s) slot(s) + bloque nouveau(x) slot(s) atomique (Postgres tx).

**Périmètre — Mobile responsive** (P1-1 Agent 5) :

- Breakpoint `< md` : bascule vue Agenda (liste verticale). Card par jour. Swipe gauche ouvre drawer.
- `@container` queries Tailwind v4.

**Périmètre — Raccourcis clavier** (P1-2 Agent 5) :

- `J/K` navigation jour/jour. `B` = bloquer date courante. `V` = valider option focus. `?` = help overlay.
- Aria-keyshortcuts annoncé.

**Périmètre — Jours fériés FR** (P1-3 Agent 5) :

- Lib `date-holidays` (JSON statique, zéro dépendance runtime).
- Cell `férié` affichée bordure striée + étiquette « 14 juil. — Fête nat. ».
- Bloque l'option visiteur côté DB (check au `postOption48hAction`).

**Priorités** :

- **P0** : 4 vues + filtres + drawer dossier (link X.8) + heatmap capacité + iCal export + mobile responsive + raccourcis clavier + jours fériés.
- **P0** : Heatmap géo (link X.16).
- **P0** : Drag-drop reschedule admin matérialisé via `rescheduleBookingByAdminAction` (D60) — Server Action + email + invariants statut.
- **P2** : Bulk operations vacances (range picker, V1.5).
- **P3** : Mini-calendar navigation année (V2+).

**Tests** : Playwright vues + filtres + drag-drop + raccourcis clavier + Vitest A18 `rescheduleBookingByAdminAction` (invariants statut, transactionnalité, audit log, email avec/sans `notifyClient`).

**Dépendances** : X.4 (state machine — incl. A18 D60), X.8 (drawer).

**Effort affiné** : 4-5j (était 3-4j) — +0,5j pour drag-drop D60 matérialisé.

**Sources GAP** : Agent 5 P0-1 à P0-7 + P1-1 à P1-4 + R1-R9 + ULTIMATE-AUDIT B15+Top5-#2.

---

### Sprint X.10 — Admin Factures V1 (PDF + numérotation immuable + frais 3 modes) (~4j)

**Périmètre — Numérotation immuable** :

- Helper `nextInvoiceNumber()` : `pg_advisory_xact_lock(hashtext('invoice_seq_2026'))` + sequence Postgres.
- Format `AXION-YYYY-NNNN` (reset annuel).
- Pas de trou (mandatory CGI 242 nonies A FR + EE).

**Périmètre — Moteur PDF** :

- `react-pdf` (D-PDF-MOTEUR X.0).
- Template factures FR + EN (logo Axion-IA + adresses paramétrables `SiteSetting` + clauses pied de page).
- Génère PDF + hash SHA-256 + stockage Hetzner Storage Box (signed URL 90j).

**Périmètre — Frais accessoires 3 modes** :

- Mode `real_costs` : admin saisit `travelFeeCents`, `accommodationFeeCents`, `mealFeeCents`, `additionalFeesCents` dans drawer facture. Préfills depuis dernière facture similaire.
- Mode `flat_rate_by_zone` : auto-calculé depuis `PricingConfig.flatFeeByZone` + zone détectée par `companyCity`.
- Mode `included` : tous frais à 0, mention « prix tout-inclus » sur facture.

**Périmètre — Server Actions** :

- `issueInvoiceAction(bookingId, type: 'deposit'|'tranche'|'balance'|'credit_note')` :
  - Calcule montant depuis `BookingPaymentSchedule.tranches[orderIndex]`.
  - Génère numéro séquentiel.
  - Génère PDF.
  - Crée Stripe Checkout session via `createStripeCheckoutSessionAction(invoiceId)`.
  - Envoie email `payment-link` au client.
  - Transition `Booking.status` selon type.
- `issueCreditNoteAction(invoiceId, reason)` : génère avoir + flip status `cancelled` / `refunded_partial`.
- `markInvoicePaidManuallyAction(invoiceId, amount, date, mode, reference)` : link X.11.
- `regenerateInvoicePdfAction(invoiceId)` : super_admin only (audit log).

**Périmètre — Admin UI `/admin/factures`** :

- Liste filtrée par statut + période + payerType.
- Détail : pré-fill frais accessoires + apercu PDF + lien Stripe Checkout session.
- Bouton « Générer avoir ».
- Export CSV mensuel pour comptable.

**Périmètre — Crons** :

- `booking-j7-balance-invoice` (X.12) : auto génère `Invoice type='balance'` à J-7.

**Périmètre — Templates emails** :

- `invoice-issued` (avec PDF attached).
- `credit-note-issued`.
- `invoice-overdue-soft` (J+15).
- `invoice-overdue-firm` (J+30).

**Priorités** :

- **P0** : Numérotation séquentielle locked, react-pdf, frais 3 modes, 4 actions, admin UI, 4 templates, export CSV.
- **P0** : Auto-trigger facture acompte à validation Will (link X.4 I6).
- **P1** : Cron `booking-j7-balance-invoice` (link X.12).
- **P2** : Branding PDF custom logo upload admin (V1.5).
- **P3** : Multi-currency GBP/USD (V2+).

**Tests** : Vitest numérotation concurrence (1000 inserts parallèles → 1000 numéros uniques), helper `computeInvoiceTotal`, react-pdf snapshot.

**Dépendances** : X.1 (Invoice + Payment models), X.2 (Stripe Checkout).

**Sources GAP** : Agent 4 P0-2 (Invoice) + Agent 11 P0-1/2/6/7 (numérotation, archivage, frais).

---

### Sprint X.11 — Admin Paiements (suivi pro + mode hybride) (~3j)

> 🚨 **Innovation V1** : mode paiement hybride Stripe + manuel (virement/chèque/CB) avec audit log complet.

**Périmètre — Route `/admin/paiements`** :

- **Tableau global** : Client | Total | Acompte | Solde | Échéance suivante | Statut.
- Filtres : période, client, statut (paid/pending/overdue), provider.
- Tri par échéance proche + montant restant.

**Périmètre — Fiche détaillée par booking** :

- Timeline échéancier visuel (4 profils) :
  - Tranches déjà payées : ✅ + montant + date + provider.
  - Tranche en cours : ⏳ Stripe Checkout URL active.
  - Tranches futures : 🔜 dueDate.
- Bouton « + Enregistrer paiement manuel » → modal Server Action `recordManualPaymentAction`.

**Périmètre — Server Action `recordManualPaymentAction(invoiceId, amount, date, mode, reference, notes)`** :

- `provider IN ('manual_wire', 'manual_check', 'manual_cash')` (cf. enum SSOT `PaymentProvider`).
- Crée `Payment.provider=mode` + `Payment.status='succeeded'` + `paidAt=date`.
- Update `Invoice.status` (paid si totalement réglé, partially_paid sinon).
- Audit log complet (`recordedByAdminUserId`, IP, UA, snapshot before/after).
- Email `payment-receipt` envoyé client (avec mention mode = virement/chèque/CB).

**Périmètre — Vue mensuelle « Trésorerie »** :

- Sections : Encaissé (Stripe + manuel) / En attente (Stripe pending + factures émises) / Retards (overdue J+15/J+30).
- Graphique simple (ligne mensuelle 12 mois).

**Périmètre — Export CSV comptable** :

- Colonnes : Date | N° facture | Client | Type | Montant HT | TVA | TTC | Mode paiement | Référence | N° Payment.
- Format compatible Pennylane / Indy / Tiime (encodage UTF-8 BOM, séparateur `;`).

**Périmètre — Relances automatiques** (link X.12) :

- J-7 avant échéance solde : email `payment-reminder-j7`.
- J+1 retard : email `payment-overdue-j1`.
- J+15 retard : email `payment-overdue-j15` + Telegram tag `RELANCE`.
- J+30 retard : email `payment-overdue-j30` + Telegram tag `IMPAYÉ_CRITIQUE`.

**Périmètre — Webhook Stripe auto** (link X.2) :

- `checkout.session.completed` → auto-record `Payment.provider='stripe'` (enum SSOT 4 valeurs) + **transition automatique `contract_payment_sent → awaiting_admin_validation`** (D51 — déclenche apparition Booking dans section dashboard "Prêts à valider" D49 + Telegram + console admin Will D54).
- `charge.refunded` → auto-record `Refund` + génère avoir.

**Périmètre — Section "Prêts à valider" (D49)** :

- Le suivi paiements lit également les Bookings `status='awaiting_admin_validation'` pour les exposer dans une carte dédiée (cf. X.8 dashboard).
- Badge ⚠️ "Contrat à signer le jour J" affiché si `Booking.contractDocumentId IS NOT NULL` ET `ContractDocument.status !== 'signed'` (D50 — contrat non bloquant).
- Le bouton 1-clic "Valider sur le calendrier" déclenche `validateBookingOnCalendarAction` (couvert X.8).

**Priorités** :

- **P0** : Tableau global + fiche détaillée + recordManualPaymentAction + export CSV + Trésorerie vue.
- **P0** : Relances J-7/J+1/J+15/J+30 (link X.12 + X.13).
- **P0** : Audit log mode hybride.
- **P1** : Réconciliation Stripe ↔ banque (V1.5).
- **P2** : Notification SMS retard critique (V2+).
- **P3** : API comptable directe Pennylane (V2+).

**Tests** : Vitest hybrid recording (Stripe + manual) + idempotence + audit log integrity.

**Dépendances** : X.10 (Invoice).

**Sources GAP** : Agent 4 P0-1/2 + Agent 8 P1-3 (snapshot before/after).

---

### Sprint X.12 — Crons & workers (~4j)

> 🆕 **Périmètre étendu post-itération ultime D59-D63** : ajout 2 crons parcours B (D48 — job #21 + #22) + 2 crons délais configurables (D52 — job #23 + #23bis) + **2 crons itération ultime (D59 — job #24 `installment-overdue-escalation` + D61 — job #25 `paused-resume-reminder`)**. Retrait `booking-j1-debrief` (D57). +0,5j sprint (~3,5j → 4j).

**Périmètre — ~24 jobs cron V1** (cible Agent 6 §3.1 + D48 parcours B + D52 délais configurables + D59 + D61 ; D57 retire `booking-j1-debrief`) :

| #              | Job                                                                | Cadence        | Description                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1              | `payment-deposit-expiration`                                       | `*/15 * * * *` | Stripe Checkout session expirée → libère slot                                                                                                                                                                                                                                                                                                                                                                                    |
| 2              | `payment-deposit-reminder-j1`                                      | `0 9 * * *`    | Rappel J+1 client si lien Checkout pas cliqué                                                                                                                                                                                                                                                                                                                                                                                    |
| 3              | `payment-deposit-reminder-j2`                                      | `0 9 * * *`    | Rappel J+2 (escalade)                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4              | `cadrage-reminder-j1`                                              | `0 9 * * *`    | Rappel J-1 cadrage                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5              | `cadrage-reminder-h2`                                              | `0 * * * *`    | Rappel H-2 cadrage                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6              | `quote-expiration`                                                 | `0 4 * * *`    | Devis DocuSeal > 7j sans signature → expired                                                                                                                                                                                                                                                                                                                                                                                     |
| 7              | `quote-reminder-j3`                                                | `0 4 * * *`    | Devis J+3 sans signature                                                                                                                                                                                                                                                                                                                                                                                                         |
| 8              | `contract-expiration`                                              | `0 4 * * *`    | Contrat DocuSeal > 7j → expired                                                                                                                                                                                                                                                                                                                                                                                                  |
| 9              | `contract-reminder-j2`                                             | `0 4 * * *`    | Contrat J+2 sans signature                                                                                                                                                                                                                                                                                                                                                                                                       |
| 10             | `booking-j7-balance-invoice`                                       | `0 5 * * *`    | Auto-génère Invoice type='balance' J-7                                                                                                                                                                                                                                                                                                                                                                                           |
| 11             | `booking-j1-reminder`                                              | `0 9 * * *`    | Rappel intervention J-1 client                                                                                                                                                                                                                                                                                                                                                                                                   |
| 12             | `booking-j0-checkin`                                               | `0 8 * * *`    | Trans `confirmed → in_progress`                                                                                                                                                                                                                                                                                                                                                                                                  |
| 13             | `booking-completion-auto`                                          | `0 19 * * *`   | Trans `in_progress → completed` (auto soir)                                                                                                                                                                                                                                                                                                                                                                                      |
| ~~14~~         | ~~`booking-j1-debrief`~~                                           | —              | **RETIRÉ V1 (D57)** — NPS J+1 non implémenté.                                                                                                                                                                                                                                                                                                                                                                                    |
| 15             | `invoice-overdue-j15`                                              | `0 6 * * *`    | Relance solde retard J+15                                                                                                                                                                                                                                                                                                                                                                                                        |
| 16             | `invoice-overdue-j30`                                              | `0 6 * * *`    | Relance solde retard J+30 + Telegram IMPAYÉ                                                                                                                                                                                                                                                                                                                                                                                      |
| 17             | `refund-trigger`                                                   | `0 7 * * *`    | Trigger refund auto si cancellation grille CGV                                                                                                                                                                                                                                                                                                                                                                                   |
| 18             | `webhook-dlq-retry`                                                | `*/5 * * * *`  | Retry Stripe + DocuSeal webhook events failed                                                                                                                                                                                                                                                                                                                                                                                    |
| (existant)     | `option-expiration`                                                | `*/5 * * * *`  | (déjà OK X.4 refactor)                                                                                                                                                                                                                                                                                                                                                                                                           |
| (existant)     | `option-reminder`                                                  | `0 * * * *`    | (déjà OK)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| (existant)     | `retention-purge`                                                  | `0 3 * * *`    | (déjà OK Sprint 24)                                                                                                                                                                                                                                                                                                                                                                                                              |
| 19             | `capacity-recompute`                                               | `0 0 * * *`    | Recalcule `CapacityWindow` (link X.16)                                                                                                                                                                                                                                                                                                                                                                                           |
| 20             | `geo-conflict-alert`                                               | `0 7 * * *`    | Détecte conflits villes semaine (link X.16)                                                                                                                                                                                                                                                                                                                                                                                      |
| **21**         | **`negotiation-stalled-reminder`** (D48 — parcours B)              | `0 8 * * *`    | Scan `Submission WHERE type='quote_request' AND status IN ('qualifying','negotiating') AND updatedAt < now - 7d` → Telegram Will à J+7, J+14, J+30 (récap montant pressenti + dernier contact). Email visiteur uniquement à J+30 (« Devis encore d'actualité ? »). Sentinels `lastStalledReminderAt` + level (`j7/j14/j30`) sur `Submission.details`.                                                                            |
| **22**         | **`contract-signed-without-deposit-reminder`** (D48 — cas A et B)  | `0 9 * * *`    | Scan Bookings `contract_signed && deposit_pending` → email client `contract-signed-payment-pending-relance-j1/j3/j7` + Telegram Will. Sentinels par échéance.                                                                                                                                                                                                                                                                    |
| **22bis / 23** | **`contract-signed-without-deposit-cancel`** (D52 — extension D53) | `0 9 * * *`    | Au seuil `contractSignedWithoutDepositCutoffDays` (default 10j, `SiteSetting` modifiable admin) sans acompte payé → annulation automatique du booking (clause CGV D53 invoquée) + email visiteur + Telegram Will + libération slot.                                                                                                                                                                                              |
| **23ter / 24** | **`option-expiration-rien-recu`** (D52 — nouveau)                  | `0 9 * * *`    | Au seuil `optionExpirationDaysIfNothingReceived` (default 5j, `SiteSetting` modifiable admin) sans signature ET sans paiement → annulation auto + email visiteur `option-expired-no-response` + Telegram Will + libération slot. À J-1 du seuil → email soft `option-near-expiration-j-1-soft`.                                                                                                                                  |
| **24**         | **`installment-overdue-escalation`** (D59 — nouveau)               | `0 10 * * *`   | Scan `BookingPaymentSchedule.installments[N]` `dueAt < now() AND status='pending'` → escalade graduelle : J+3 = email soft `installment-overdue-soft` (#56) ; J+15 = email ferme `installment-overdue-firm` (#57) + Telegram Will ; J+30 = flip `Booking.status='installment_overdue'` ; J+45 = flip `Booking.status='disputed'` + email `installment-disputed-notice` (#58). Sentinels par échéance + level (`j3/j15/j30/j45`). |
| **25**         | **`paused-resume-reminder`** (D61 — nouveau)                       | `0 8 * * *`    | Scan Bookings `status='paused' AND pausedUntil IS NOT NULL` → Telegram Will à `pausedUntil - 7j`, `pausedUntil - 1j`, et `pausedUntil` lui-même. Sentinels `lastPausedReminderAt` + level.                                                                                                                                                                                                                                       |

**Périmètre — DLQ dédiée** :

- Queue BullMQ `dlq` séparée.
- Workers `failed` → push vers DLQ après `attempts:5` exhausted.
- Admin UI `/admin/jobs` : liste DLQ jobs + bouton « Retry » manuel.

**Périmètre — Sentry Crons monitoring** :

- `Sentry.captureCheckIn({ monitorSlug: 'payment-deposit-expiration', status: 'ok' })` à chaque tick.
- Si Redis down 24h → alerte Sentry « monitor missed ».
- Configure **~24 monitors Sentry Dashboard** (retrait `booking-j1-debrief` D57 + ajouts D48 + D52 + **D59 #24 + D61 #25**).

**Périmètre — Alertes Telegram échecs** :

- `worker.on('failed', err)` → `alertOps({ tag: 'CRON_FAILED', monitor: jobName, error: err.message })`.

**Priorités** :

- **P0** : ~24 jobs cron V1 + idempotence + Sentry Crons + Telegram fail alerts + DLQ.
- **P0** : Jobs #21 + #22 parcours B (D48).
- **P0** : Jobs #23 + #23ter/24 délais configurables (D52 — `contract-signed-without-deposit-cancel` + `option-expiration-rien-recu`).
- **P0** : Job **#24 `installment-overdue-escalation` (D59)** + Job **#25 `paused-resume-reminder` (D61)**.
- **P1** : Admin UI DLQ retry.
- **P2** : Backoff configurable par job (V1.5).

**Tests** : Vitest idempotence (replay tick 2× → 1 effet), DLQ ack, Sentry checkIn mock + Vitest stalled-negotiation sentinel logic (J+7/J+14/J+30 escalation) + contract-signed-without-deposit sentinel.

**Dépendances** : X.2 (Stripe), X.4 (state machine), X.7 (Quote), X.3 (Contract), X.5bis (Submission pipeline B).

**Sources GAP** : Agent 6 P0-1 (15 jobs absents → étendus à 20 V1) + `UX-E2E-VERIFICATION.md` B-P0-8 + B-P0-9.

---

### Sprint X.13 — Emails templates V1 (~36 templates FR+EN) (~5-6j)

> 🆕 **Périmètre étendu post-itération ultime D59-D63** : ajout 5 templates parcours B (D44+D48 — #40-44) + 1 template `booking-validated-on-calendar` D49 (#45) + 6 templates D52 (#46-51) + **1 template D60 `booking-rescheduled-by-admin` (#52)** + **2 templates D61 `booking-paused-confirmation` (#53) + `booking-resumed-notification` (#54)** + **1 template D62 `contract-version-updated` (#55)** + **3 templates D59 `installment-overdue-soft` (#56) + `installment-overdue-firm` (#57) + `installment-disputed-notice` (#58)**. Retrait `booking-j1-debrief` D57 (#28). Net **~36 nouveaux V1** + ~14 existants V0 = **~50 templates au total**. Effort 5-6j (+0,5-1j vs 4-5j post-D49-D58 pour 6 templates D59-D62 ajoutés).

**Périmètre — ~30 templates** (Agent 7 §4 + UX-E2E §7.3) :

| #      | Template                                                                   | Trigger                                                                      | FR+EN                                                                                                                |
| ------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1      | `booking-confirmed`                                                        | existant, à mettre à jour                                                    | ✅                                                                                                                   |
| 2      | `booking-cancelled`                                                        | existant                                                                     | ✅                                                                                                                   |
| 3      | `option-posted`                                                            | existant, MAJ multi-options                                                  | ✅                                                                                                                   |
| 4      | `option-reminder`                                                          | existant                                                                     | ✅                                                                                                                   |
| 5      | `option-expired`                                                           | existant                                                                     | ✅                                                                                                                   |
| 6      | `option-validated`                                                         | X.4 trigger AUTO                                                             | ✅                                                                                                                   |
| 7      | `option-lost-other-won`                                                    | X.5 cascade                                                                  | ✅                                                                                                                   |
| 8      | `option-refused-by-admin`                                                  | existant                                                                     | ✅                                                                                                                   |
| 9      | `audit-confirmed`                                                          | existant                                                                     | ✅                                                                                                                   |
| 10     | `implementation-confirmed`                                                 | existant                                                                     | ✅                                                                                                                   |
| 11     | `contact-confirmed`                                                        | existant                                                                     | ✅                                                                                                                   |
| 12     | `newsletter-confirm-optin`                                                 | existant                                                                     | ✅                                                                                                                   |
| 13     | `gdpr-export-link`                                                         | existant                                                                     | ✅                                                                                                                   |
| 14     | `cadrage-scheduled`                                                        | X.6                                                                          | ✅                                                                                                                   |
| 15     | `cadrage-reminder-j1`                                                      | X.12                                                                         | ✅                                                                                                                   |
| 16     | `cadrage-reminder-h2`                                                      | X.12                                                                         | ✅                                                                                                                   |
| 17     | `cadrage-recap`                                                            | X.6                                                                          | ✅                                                                                                                   |
| 18     | `cadrage-declined`                                                         | X.6                                                                          | ✅                                                                                                                   |
| 19     | `payment-link`                                                             | X.4 trigger AUTO                                                             | ✅                                                                                                                   |
| 20     | `payment-receipt`                                                          | X.2 webhook                                                                  | ✅                                                                                                                   |
| 21     | `payment-failed`                                                           | X.2 webhook                                                                  | ✅                                                                                                                   |
| 22     | `invoice-issued`                                                           | X.10                                                                         | ✅                                                                                                                   |
| 23     | `credit-note-issued`                                                       | X.10                                                                         | ✅                                                                                                                   |
| 24     | `payment-reminder-j7`                                                      | X.12                                                                         | ✅                                                                                                                   |
| 25     | `payment-overdue-j1/j15/j30`                                               | X.12 (3 variantes)                                                           | ✅                                                                                                                   |
| 26     | `booking-rescheduled`                                                      | X.9 drag-drop                                                                | ✅                                                                                                                   |
| 27     | `booking-j1-reminder`                                                      | X.12                                                                         | ✅                                                                                                                   |
| ~~28~~ | ~~`booking-j1-debrief`~~                                                   | ~~X.12 NPS~~                                                                 | **RETIRÉ V1 (D57)** — NPS J+1 non implémenté. Remplacé par `booking-validated-on-calendar` D49 (cf. ci-dessous #45). |
| 29     | `contract-sent`                                                            | X.3                                                                          | ✅                                                                                                                   |
| 30     | `contract-signed`                                                          | X.3 webhook                                                                  | ✅                                                                                                                   |
| 31     | `contract-refused`                                                         | X.3 webhook                                                                  | ✅                                                                                                                   |
| 32     | `contract-reminder`                                                        | X.12                                                                         | ✅                                                                                                                   |
| 33     | `quote-sent`                                                               | X.7                                                                          | ✅                                                                                                                   |
| 34     | `quote-signed`                                                             | X.7 webhook                                                                  | ✅                                                                                                                   |
| 35     | `quote-declined`                                                           | X.7 webhook                                                                  | ✅                                                                                                                   |
| 36     | `quote-reminder`                                                           | X.12                                                                         | ✅                                                                                                                   |
| 37     | `quote-expired`                                                            | X.12                                                                         | ✅                                                                                                                   |
| 38     | `force-majeure-notice`                                                     | X.4 markForceMajeureAction                                                   | ✅                                                                                                                   |
| 39     | `refund-issued`                                                            | X.4 grille CGV                                                               | ✅                                                                                                                   |
| **40** | **`quote-request-received`** (D44 — parcours B)                            | X.5bis `submitQuoteRequestAction`                                            | ✅                                                                                                                   |
| **41** | **`quote-sent-from-negotiation`** (D44 — parcours B)                       | X.8 `createBookingFromSubmissionAction` étape devis                          | ✅                                                                                                                   |
| **42** | **`contract-sent-with-deposit-link`** (D44 — parcours B, email **unifié**) | X.8 `createBookingFromSubmissionAction` étape envoi final                    | ✅                                                                                                                   |
| **43** | **`booking-confirmed-after-negotiation`** (D44 — parcours B)               | trigger paid deposit + signed contract pour `originPath='quote_negotiation'` | ✅                                                                                                                   |
| **44** | **`negotiation-stalled-reminder`** (D48 — parcours B)                      | X.12 job #21                                                                 | ✅ (Will Telegram + visiteur J+30 seulement)                                                                         |
| **45** | **`booking-validated-on-calendar`** (D49 — nouveau)                        | clic Will "Valider sur le calendrier" → `validateBookingOnCalendarAction`    | ✅ (client validé final, slot 🔴, intervention confirmée — remplace `booking-j1-debrief` retiré V1 D57)              |
| **46** | **`option-near-expiration-j-1-soft`** (D52 — nouveau)                      | cron `option-expiration-rien-recu` à J-1 du seuil                            | ✅ (rappel doux visiteur)                                                                                            |
| **47** | **`option-near-expiration-j-3-firm`** (D52 — optionnel)                    | cron variant si seuil > 3j                                                   | ✅ (ton ferme visiteur)                                                                                              |
| **48** | **`option-expired-no-response`** (D52 — nouveau)                           | cron `option-expiration-rien-recu` à expiration                              | ✅ (notification définitive visiteur, slot libéré)                                                                   |
| **49** | **`contract-signed-payment-pending-relance-j1`** (D52 — nouveau)           | cron `contract-signed-without-deposit-reminder` à J+1                        | ✅                                                                                                                   |
| **50** | **`contract-signed-payment-pending-relance-j3`** (D52 — nouveau)           | cron à J+3                                                                   | ✅                                                                                                                   |
| **51** | **`contract-signed-payment-pending-relance-j7`** (D52 — nouveau)           | cron à J+7                                                                   | ✅ (dernière chance avant invocation D53)                                                                            |
| **52** | **`booking-rescheduled-by-admin`** (D60 — nouveau)                         | A18 `rescheduleBookingByAdminAction` si `notifyClient=true`                  | ✅ (client, nouveau `.ics` attaché)                                                                                  |
| **53** | **`booking-paused-confirmation`** (D61 — nouveau)                          | A19 `pauseBookingAction`                                                     | ✅ (client, motif + pausedUntil)                                                                                     |
| **54** | **`booking-resumed-notification`** (D61 — nouveau)                         | A20 `resumeBookingAction`                                                    | ✅ (client, nouveau `.ics`)                                                                                          |
| **55** | **`contract-version-updated`** (D62 — nouveau)                             | A21 `cancelAndReissueContractAction` OU A22 `createContractAddendumAction`   | ✅ (client, précise « ignorer précédent » OU « avenant complémentaire »)                                             |
| **56** | **`installment-overdue-soft`** (D59 — nouveau)                             | cron #24 J+3 retard                                                          | ✅ (relance soft échéance 2/3)                                                                                       |
| **57** | **`installment-overdue-firm`** (D59 — nouveau)                             | cron #24 J+15 retard                                                         | ✅ (relance ferme — conséquences)                                                                                    |
| **58** | **`installment-disputed-notice`** (D59 — nouveau)                          | cron #24 J+45 retard                                                         | ✅ (notification basculement `disputed` + recouvrement hors-app)                                                     |

> Note : compte réel ~36 nouveaux templates V1 (#1-25 cadrage/booking + #40-44 parcours B + #45 D49 + #46-51 D52 + #52 D60 + #53-54 D61 + #55 D62 + #56-58 D59 ; #28 NPS retiré D57 ; #26-30 V1.5 optionnels). + ~14 existants = ~50 au total. Effort 5-6j sur ~36 nouveaux (réutilisation `_layout.tsx` + dictionnaire COPY pattern existant).

**Périmètre — Standards** :

- Preheader distinct du subject (P0-9 Agent 7).
- Plain-text fallback systématique (existant).
- List-Unsubscribe RFC 8058 sur marketing uniquement.
- PII minimisation : pas de prix/Total dans subject (anti-leak preview).

**Périmètre — Triggers admin Telegram manquants** :

- `CADRAGE_PLANIFIE`, `CADRAGE_TENU`, `VALIDATION_AUTO_TRIGGER`, `CONTRAT_SIGNE`, `PAIEMENT_RECU_STRIPE`, `PAIEMENT_RECU_MANUEL`, `IMPAYE_J15`, `IMPAYE_J30`, `LITIGE`, `FRAUDE_REVIEW`, `RELANCE`, `RESCHEDULE_CLIENT`, `FORCE_MAJEURE`.

**Priorités** :

- **P0** : ~30 templates FR+EN avec preheaders + plain-text fallback + 13 nouveaux Telegram tags + tag `QUOTE_REQUEST_RECEIVED`.
- **P0** : 5 templates parcours B (#40-44, D44+D48).
- **P1** : Tests rendering snapshot (`@react-email/render`).
- **P2** : Preview admin `/admin/emails-preview` (V1.5).
- **P3** : A/B testing subjects (V2+).

**Tests** : Vitest snapshot des ~30 templates × 2 locales (~60 snapshots).

**Dépendances** : X.4, X.5bis (parcours B), X.6, X.7, X.3, X.8 (A16/A17).

**Sources GAP** : Agent 7 P0-1 à P0-9 (10 templates absents + admin Telegram) + `UX-E2E-VERIFICATION.md` § 7.3 (5 templates parcours B).

---

### Sprint X.14 — Admin nav refactor + Dashboard (~2-3j)

**Périmètre — Sidebar par fréquence** (Agent 2 §3) :

- **Group « Activité quotidienne »** : Dashboard / Demandes / Réservations / Calendrier / Cadrage en attente.
- **Group « Paiements & facturation »** : Paiements / Factures / Devis / Contrats.
- **Group « Contenu »** : Blog / Case studies / FAQ / Help / Testimonials / Categories.
- **Group « Engagement »** : Newsletter / Submissions / Soumissions audit.
- **Group « Configuration »** : Tarifs / Échéanciers / Paramètres / Contrats templates.
- **Group « Ops & monitoring »** : Infra / Alerts / Jobs DLQ / Activity logs.
- **Group « Système »** : Users / 2FA / Settings.

**Périmètre — Cmd+K command palette** :

- Lib `cmdk` (ou `kbar`).
- Actions : navigation rapide (toutes routes admin), recherche global submissions/bookings/clients/factures, raccourcis transitions (« Valider booking [id] »).
- Raccourci `Cmd+K` / `Ctrl+K`.

**Périmètre — Mobile responsive** :

- Breakpoint `< md` : sidebar drawer burger (Radix Sheet).
- Bottom bar mobile pour 5 actions principales (Dashboard / Demandes / Calendrier / Paiements / +Menu).

**Périmètre — Dashboard `/admin`** (refonte) :

- **KPIs cartes** :
  - Aujourd'hui : N options à valider + N cadrages à tenir + N paiements à enregistrer.
  - Cette semaine : capacité X/3 + revenus encaissés €Y + factures en retard N.
  - Ce mois : capacité X/8 + revenus prévisionnels €Z + NPS moyen.
- **Liste « À traiter aujourd'hui »** (urgent) : options < 24h, cadrages H-2, paiements J+15.
- **Heatmap mois en cours** (link X.9).
- **Graphique 12 mois revenus** (trésorerie vue link X.11).
- **Alertes Telegram** : 5 dernières.

**Périmètre — Breadcrumbs + raccourcis clavier globaux** :

- `?` = aide overlay raccourcis.
- `/` = focus search global.
- `G + D` = goto Demandes. `G + R` = goto Réservations. `G + C` = goto Calendrier.

**Priorités** :

- **P0** : Sidebar refactor + Cmd+K + Mobile responsive + Dashboard KPIs.
- **P1** : Raccourcis clavier globaux.
- **P2** : Notifications in-app (V1.5).
- **P3** : Themes / dark mode (V2+).

**Tests** : Playwright sidebar mobile + Cmd+K palette navigation.

**Dépendances** : X.8 (drawer).

**Sources GAP** : Agent 2 P0 (mobile + Cmd+K + dashboard manquants).

---

### Sprint X.15 — Self-service client (lien magique annulation/reschedule) (~1,5j post-D56)

> 🔻 **Périmètre réduit post-D56** : Customer Portal Stripe RETIRÉ V1 (factures email PJ uniquement). Reste : magic-link annulation + magic-link reschedule. Économie ~0,5j vs version V2.

**Périmètre — Lien magique HMAC** :

- Helper `src/lib/magic-token.ts` (factorise `gdpr-token.ts` Sprint 24).
- Scope : `{ action: 'cancel'|'reschedule'|'portal', bookingId, email, jti, exp }`.
- TTL 24h pour cancel/reschedule, 30 min pour portal (Stripe lien actif).

**Périmètre — Routes** :

- `/booking/[token]/cancel` (page publique) : confirme annulation, calcule refund grille CGV, transition `Booking.status='cancelled_by_user'`.
- `/booking/[token]/reschedule` : page sélection nouvelle date (si ≥ J-7).
- `/booking/[token]/portal` : redirect vers Stripe Customer Portal (download factures).

**Périmètre — Server Actions** :

- `cancelBookingByUserAction(token)` :
  - Vérifie token HMAC + non-expiré.
  - Calcule `cancellationWindow` (≥ J-15, 15-2j, < 2j, fm).
  - Applique grille refund (V1 default : J-15+ = 50 % refund acompte / < J-15 = acompte conservé / force majeure = 100 %).
  - Trans `Booking.status='cancelled_by_user'` + email `cancellation-confirmed-by-user`.
- `rescheduleBookingByUserAction(token, newDate)` :
  - Vérifie token + check ≥ J-7 + slot dispo.
  - Trans état + email `booking-rescheduled` + Telegram Will.

**Périmètre — Customer Portal Stripe** :

- **RETIRÉ V1 (D56)** — factures envoyées par email PJ uniquement. Pas d'endpoint `/api/stripe/customer-portal-link`.
- Hook V2+ préservé : `Payment.providerCustomerId` est bien renseigné côté Stripe pour activation V2+ sans migration.

**Périmètre — Templates emails** :

- `cancellation-confirmed-by-user` (avec montant refund).
- `refund-issued` (lors processedAt webhook Stripe refund).
- Inclusion lien magique dans `booking-confirmed`, `payment-receipt`, `booking-j1-reminder`.

**Priorités** :

- **P0** : Magic-link cancel + reschedule + Customer Portal.
- **P0** : 3 templates emails.
- **P1** : Rate-limit `magic:<token-prefix>` 10/600s.
- **P2** : Notification SMS option (V1.5).
- **P3** : Multi-langue Customer Portal Stripe (V2+).

**Tests** : Vitest HMAC token signing/verifying + replay attack + expiration.

**Dépendances** : X.2 (Stripe), X.4 (state machine), X.10 (Invoice).

**Sources GAP** : Agent 8 P0-7 + Agent 1 P0-8 (lien magique self-service).

---

### Sprint X.16 — Géo-awareness & capacité (OSM Nominatim + Haversine + heatmap) (~2j)

**Périmètre — Migration Prisma** :

- **`CapacityWindow`** : agrégation calculée quotidiennement.
  - PK `id Uuid`. `windowType WindowType` (enum : `day`, `week`, `month`).
  - `windowStart DateTime` (start window, indexé).
  - `bookingsCount Int`, `capacityMax Int` (1/3/8 par défaut).
  - `geoConflictCount Int @default(0)`.
  - Index `(windowType, windowStart)`.

**Périmètre — Geocoding OSM Nominatim** :

- Service `src/lib/geocode.ts` : `geocodeCity(city: string, country: string): { lat, lng, normalized }`.
- Cache `SiteSetting.geocodeCache` (JSON key/value, TTL 90j).
- Respect ToS Nominatim : 1 req/s, User-Agent custom.
- À `createBookingAction` : si `companyCity` saisi → geocode + update `Booking.companyCityLat/Lng/Normalized`.

**Périmètre — Distance Haversine** :

- Helper `src/lib/haversine.ts` : `distanceKm(lat1, lng1, lat2, lng2): number`.
- Hub Will (Paris par défaut, paramétrable `SiteSetting.hubLat/hubLng`).
- Buffer auto : `< 50 km` = 0j, `< 500 km` = 0.5j, `≥ 500 km` = 1j.

**Périmètre — CapacityWindow recompute** :

- Cron `capacity-recompute` (X.12) : tous les jours minuit.
- Recalcule windows D/W/M sur 90j sliding window.
- Update `Booking.travelBufferDays` selon distance.

**Périmètre — Heatmap admin semaine** (link X.9) :

- Vue `/admin/calendrier?view=week` : badge capacité par semaine + couleur cell selon `bookingsCount / capacityMax`.
- Vue heatmap géo : pin Paris + interventions semaine sur carte (Leaflet ou static SVG simplifié V1).

**Périmètre — Alertes Telegram conflits** :

- Cron `geo-conflict-alert` : détecte 2 bookings villes éloignées même semaine.
- Ex : Lundi Lyon + Mardi Lille → trajet impossible.
- Telegram tag `GEO_CONFLICT` avec dates + villes.

**Périmètre — Auto-bloque trajet** :

- À `validateBookingOptionAction` (X.4 I6) : si `travelBufferDays >= 0.5` → trans slot J-1 (et J+1 si `1.0`) à `blocked` avec `blockedReason='travel_buffer'`.

**Priorités** :

- **P0** : Geocoding + Haversine + `CapacityWindow` recompute + heatmap capacité.
- **P0** : Alertes conflits + buffer auto-bloque.
- **P1** : Heatmap géo carte interactive.
- **P2** : Calcul carbone footprint (V2+).
- **P3** : Optimisation tournée multi-clients (V2+).

**Tests** : Vitest Haversine + geocode mock + capacity recompute.

**Dépendances** : X.9 (calendrier).

**Sources GAP** : Agent 5 P0-4/5 (capacité + géo) + Agent 11 P0-5 (déplacements clauses).

---

### Sprint X.17 — Conformité légale V1 (~3-4j)

**Périmètre — Sous-processeurs `legal.ts`** :

- Ajouter : Stripe Payments Europe Ltd (Dublin IE, EU intra, DPA auto-signable), DocuSeal (self-hosted Hetzner DE — pas un sous-traitant externe, mais référencer en transparence), Mailwizz/PowerMTA (self-hosted, Hetzner DE), R2 Cloudflare uniquement si retenu (sinon Storage Box déjà couvert).
- Page dédiée `/sous-processeurs` (`/subprocessors` EN) avec table : Nom | Localisation | Finalité | Base légale | DPA | Cadre transfert.

**Périmètre — CGV update** (`src/content/legal.ts`) :

- **Clause acompte non-remboursable** (D-DEPOSIT) : « Un acompte de X % est demandé à validation de la réservation. Cet acompte n'est pas remboursable hors cas de force majeure ou annulation par Axion-IA. »
- **Clause annulation grille V1** : « > J-15 = 50 % de l'acompte remboursé ; ≤ J-15 = acompte intégralement conservé ; force majeure (côté client) = report sans frais 1× ; annulation Axion-IA (maladie/force majeure) = refund total + reschedule prioritaire. »
- **Clause force majeure étendue (définition contractuelle)** : référence article **1218 Code civil FR** + équivalent EE **Võlaõigusseadus §103** (« vis maior »). Liste **inclusive** : grève généralisée transports, catastrophe naturelle, hospitalisation Will (certificat médical 48h), panne infra majeure non résolvable > 48h (Hetzner DC down, Cloudflare panne globale), restrictions sanitaires gouvernementales. Liste **exclusive** (PAS force majeure) : manque de préparation client, retards administratifs prévisibles, manque de motivation client, aléas commerciaux normaux, surcharge opérationnelle Will sans cause externe.
- **Clause TVA paramétrable** : « TVA applicable selon régime fiscal de l'Axion-IA OÜ — actuellement [vatMention dynamique]. » (SiteSetting auto-injection).
- **Clause juridiction paramétrable** : « Droit applicable : [loiApplicableDefault]. Tribunaux compétents : [juridictionDefault]. »
- **Clause cession de droits** : explicite que les livrables (audit, code, contenus) sont cédés au client à paiement intégral.
- **Clause confidentialité** : engagement réciproque NDA implicite + DocuSeal pour ETI+.
- **Clause J-15 cohérente** : aligne grille refund.

**Périmètre — Mentions légales paramétrables** :

- `SiteSetting.companyLegalForm`, `companyRegistrationNumber`, `companyVatNumber` (renseignés Sprint X.0 D-LEGAL ou plus tard si Will bascule FR).

**Périmètre — Politique cookies CNIL** :

- Page `/cookies` déjà OK (Plausible self-hosted, pas de cookie publicitaire).
- Ajout mention Stripe : cookies fonctionnels Stripe Checkout (consent obligatoire si embed iframe — V1 redirect = pas de cookie tiers).

**Périmètre — Numérotation immuable confirmée** :

- ADR 0021-immutable-invoice-numbering (ref X.10 lock advisory Postgres).
- Doctrine documentée `_AUDIT/`.

**Périmètre — Archivage 10 ans** :

- `Invoice.archivedUntil = issuedAt + 10 ans`.
- Cron `archive-old-invoices` : tous les ans, exclut de `retention-purge-worker`.
- Hetzner Storage Box : backup quotidien chiffré AES-256.

**Périmètre — DPA papier/online** (action Will) :

- Stripe : DPA auto-signable Dashboard.
- DocuSeal self-hosted : pas de DPA externe requis (auto-hébergé Hetzner UE).
- Hetzner : DPA papier (déjà en cours).
- Cloudflare : DPA online Dashboard.
- Mailwizz/PowerMTA : self-hosted, pas de DPA externe.

**Priorités** :

- **P0** : CGV update + sous-processeurs + page `/sous-processeurs` + DPA Stripe signé.
- **P0** : Mentions légales paramétrables + politique cookies update.
- **P0** : Archivage 10 ans confirmé.
- **P1** : ADR 0021 numérotation.
- **P2** : VIES API multi-régime (V2+).
- **P3** : E-invoicing PPF/PDP (V2+ loi PACTE).

**Tests** : Vitest rendering `legal.ts` paramétrable + snapshot CGV FR+EN.

**Dépendances** : X.10 (Invoice).

**Sources GAP** : Agent 11 P0-1 à P0-7 + Agent 8 P1-1 (Mailwizz sous-processeur).

---

### Sprint X.18 — Bout-en-bout préfill + tracking funnel (~1-2j)

**Périmètre — URL paramétrée `/reserver`** :

- `BookingCalendar.tsx` : lecture `?type=`, `?from=`, `?city=`, `?utm_source=`, `?utm_medium=`, `?utm_campaign=`, `?service=`.
- Mapping `service=audit` → `interventionType='audit_flash_onsite'`.
- Mapping `service=interventions` → `interventionType='essentielle'` (default).
- Mapping `service=implementation` → redirect `/contact` (avec préfill UTM).

**Périmètre — Préfill `companyCity`** :

- `?city=lyon` → préfill input step 1 `BookingCalendar.tsx:412`.
- Fallback cookie `referrerCity` (set par middleware sur pSEO `/audit/par-ville/[ville]`, `/implantations/[region]/[ville]`).

**Périmètre — Persistence tracking** :

- `Submission.referer` (existant, schema.prisma:188) populé via `headers().get('referer')`.
- Extension `Submission.details Json` : ajout `utmSource`, `utmMedium`, `utmCampaign`, `referrerCity`, `referrerPhase`, `referrerRegion`.

**Périmètre — Plausible / PostHog events** :

- `plausible('Booking Submitted', { props: { intervention, fromService, fromCity, utmSource } })`.
- `plausible('Option Posted', { props: { intervention, hasCadrage, requiresQuote, requiresNda } })`.
- Funnel events : `Audit Started`, `Audit Submitted`, `Booking Started`, `Booking Confirmed`, `Payment Completed`.

**Périmètre — Correction CTAs nus** :

- `interventions/page.tsx:504,739,919` : ajouter `?intervention=<slug>` (Agent 9 P0-4).
- Audit cross-fichiers : Grep `href="/reserver"` → ajout query params manquants (Agent 9 P0-1).

**Périmètre — Mapping CTAs vers `/demande-devis` (D44 — P0-5 parcours B)** :

- CTAs des hubs **`/interventions/ia-custom`** + **`/interventions/transformation-collective`** (et tout format sur-devis dérivé `requiresQuote(interventionType, basePriceHtCents) === true`) → redirigés vers **`/demande-devis?intervention=<slug>`** au lieu de `/reserver?intervention=<slug>`.
- Helper `getBookingCtaPath(intervention)` : returns `/demande-devis` si `requiresQuote(intervention)` else `/reserver`.
- Audit Grep all `<CtaPrimary>` + `<Link href="/reserver"` à scanner cross-fichiers pour appliquer le mapping conditionnel.
- Variante EN : `/request-quote?intervention=<slug>`.

**Périmètre — Honeypot + Turnstile widget** :

- Ajout champ `<input name="website" hidden tabIndex={-1} aria-hidden>` dans `BookingCalendar.tsx` (Agent 1 P0-6).
- Injection widget `<Turnstile />` dans form `BookingCalendar.tsx` (Agent 1 P0-1).

**Priorités** :

- **P0** : URL paramétrée + préfill + correction CTAs + Turnstile widget + honeypot.
- **P0** : Plausible events funnel.
- **P1** : PostHog si retenu (V1.5).
- **P2** : Dashboard `/admin/pseo-stats` (V1.5).

**Tests** : Playwright préfill URL + funnel events tracking.

**Dépendances** : X.4 (state machine).

**Sources GAP** : Agent 9 P0-1 à P0-4 + Agent 1 P0-1/5/6.

---

### Sprint X.19 — Tests E2E Playwright (~3j)

**Périmètre — Happy path complet** :

1. Visiteur arrive sur `/reserver?intervention=essentielle&city=paris&utm_source=google`.
2. Préfill OK step 1.
3. Pose option via `postOption48hAction` (multi-options cap=3 OK).
4. Email `option-posted` reçu (Mailhog assertion).
5. Will valide cadrage manuellement (`scheduleCadrageMeetingAction`).
6. Email `cadrage-scheduled` reçu avec `.ics`.
7. Cadrage tenu (`markCadrageHeldAction(decision=POSITIVE)`).
8. Will valide booking dans `/admin/demandes` → `validateBookingOptionAction`.
9. Trigger AUTO : `ContractDocument` créé + `Invoice deposit` émise + Stripe Checkout session créée + emails `option-validated` + `payment-link` + `contract-sent` envoyés.
10. Autres options même slot transitent `lost_other_won` + emails.
11. Visiteur signe contrat DocuSeal (mock) → webhook → `contract_signed`.
12. Visiteur paie acompte Stripe (mock) → webhook `checkout.session.completed` → `confirmed`.
13. Cron J-7 → `booking-j7-balance-invoice` → email + Invoice solde émise.
14. Visiteur paie solde Stripe → `paid_balance`.
15. Cron J0 → `in_progress`. Cron J+1 → `completed` + email NPS.
16. Cron J+15 → `archived`.

**Périmètre — Edge cases** :

- Refund grille CGV (cancel ≥ J-15, < J-15, force majeure).
- Multi-options simultanées : 3 visiteurs simultanés cap=3 OK, 4ème refusé.
- Géo-conflit : Lyon Lundi + Lille Mardi → Telegram `GEO_CONFLICT`.
- Échéancier override : facture 18 000 € → profil `large` (30/30/40 ou mensuel custom) appliqué auto.
- Webhook replay : 2× même `event.id` Stripe → 1 seul effet.
- DocuSeal indisponible → fallback `markContractSignedManuallyAction`.
- Cadrage NEGATIVE → email refus + pas de trigger AUTO.
- audit_flash_onsite : skip cadrage + 100 % paiement intégral.
- Frais 3 modes : real_costs / flat_rate_by_zone / included rendus correctement sur PDF.
- Paiement manuel virement : `recordManualPaymentAction` → Payment + audit log + email receipt.

**Périmètre — Lighthouse CI** :

- `/reserver` perf >= 90 (cible interne LCP ≤ 1.8s).
- `/admin/dashboard` mobile responsive OK.

**Priorités** :

- **P0** : Happy path complet + 10 edge cases critiques + Lighthouse CI.
- **P1** : Tests visuels regression Percy (V1.5).
- **P2** : Load test k6 100 RPS (V1.5).

**Tests** : Playwright suite ~20 scénarios + GitHub Actions CI.

**Dépendances** : tous X.1-X.18.

**Sources GAP** : Tous agents (validation finale).

---

### Sprint X.20 — Doc + ADRs + CHANGELOG (~1j)

**Périmètre** :

- **ADRs finalisés** (11 ADRs, 0011-0021) :
  - 0011-decisions-foundation-V1
  - 0012-stripe-checkout-saq-a
  - 0013-docuseal-self-hosted
  - 0014-tva-agnostic
  - 0015-multi-options-simultanees
  - 0016-pricing-db-managed
  - 0017-echeancier-configurable
  - 0018-geo-awareness-osm
  - 0019-paiement-hybride
  - 0020-stripe-radar
  - 0021-immutable-invoice-numbering
- **CHANGELOG V1** (`_AUDIT/CHANGELOG-V1-BOOKING.md`) : récap 20 sprints V1 (X.0 → X.20 + X.5bis ; D56/D57/D58 retirent les sprints Customer Portal Stripe / NPS / Onboarding-docs reportés V1.5+) + dates + commits.
- **Doc admin utilisateur Will** (~10 pages PDF) :
  - Section 1 : flow daily Will (matin : check `/admin/demandes`, valider options, planifier cadrages).
  - Section 2 : gestion paiements + saisie manuelle.
  - Section 3 : édition contrats Tiptap.
  - Section 4 : modifier tarifs DB.
  - Section 5 : annulations + refunds grille CGV.
  - Section 6 : raccourcis clavier + Cmd+K.
- **Update CLAUDE.md / AGENTS.md** : doctrine deposit-validation-gated + multi-options + DocuSeal.
- **README backend** : section déploiement DocuSeal Coolify.

**Priorités** :

- **P0** : 11 ADRs (0011-0021) + CHANGELOG + Doc utilisateur PDF.
- **P1** : CLAUDE.md / AGENTS.md update.
- **P2** : Vidéo onboarding 5 min (V1.5).

**Dépendances** : X.19.

---

## 3. Section B — Total V1 et délai

| Sprint         | Durée min           | Durée max |
| -------------- | ------------------- | --------- |
| X.0            | 1j dev (+0,5j Will) | 1j dev    |
| X.1            | 5j                  | 6j        |
| X.2            | 3j                  | 3j        |
| X.3            | 3,5j                | 4j        |
| X.4            | 5j                  | 5j        |
| X.5            | 2j                  | 2j        |
| **X.5bis**     | **2j**              | **2j**    |
| X.6            | 3j                  | 3j        |
| X.7            | 3j                  | 3j        |
| X.8            | 4j                  | 5j        |
| X.9            | 4j                  | 5j        |
| X.10           | 4j                  | 4j        |
| X.11           | 3j                  | 3j        |
| X.12           | 4j                  | 4j        |
| X.13           | 5j                  | 6j        |
| X.14           | 2j                  | 3j        |
| X.15           | 1,5j                | 2j        |
| X.16           | 2j                  | 2j        |
| X.17           | 3j                  | 4j        |
| X.18           | 1j                  | 2j        |
| X.19           | 3j                  | 3j        |
| X.20           | 1j                  | 1j        |
| **Total dev**  | **65j**             | **74,5j** |
| **Total Will** | **0,5j**            | **0,5j**  |

> ✅ **Total V1 référentiel post-itération ultime D59-D63** : **~54-60 j ingé** + 0,5j Will (cohérent MANIFEST/SYNTHESE/NO-GO/STOP-AND-ASK). La table brute ci-dessus somme 65-74,5j sans parallélisations ; après application des trois parallélisations §4 (X.2//X.3, X.9//X.10, X.15//X.16) et buffers ajustés, l'effort cible converge sur **~54-60 j ingé** (médiane ~57 j). Chemin critique optimisé : **~44-50 j** (cf. §4). Délai prévisionnel : **10-12 semaines** avec 1 dev plein temps (parallélisations absorbent D59-D63).
>
> Bilan vs V2.2 post-`UX-E2E-VERIFICATION.md` (~52-58j) : ajouts ultimes **D59 (+0,5j)** + **D60 (+0,5j)** + **D61 (+0,5j)** + **D62 (+0,5j)** + **D63 (+0,5j)** = **+2-3j net** (X.3 +0,5j versioning + X.4 +1j migration+overdue+paused + X.9 +0,5j drag-drop + X.12 +0,5j crons #24+#25 + X.13 +0,5-1j templates #52-#58).
>
> Marge buffer recommandée 15 % → cible commercialisation **fin juillet / mi-août 2026** si démarrage 2026-05-13.

---

## 4. Section C — Chemin critique (DAG ASCII)

```
                                            ┌──────────────┐
                                            │ X.0 Décisions│ (gate Will, ~0,5j)
                                            │   + bootstrap│
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                    ┌──────────────────────────────┐
                                    │  X.1 Foundation paiements    │ (5-6j)
                                    │  & pricing (8 tables + ADM)  │
                                    └────────────┬─────────────────┘
                                                 │
                          ┌──────────────────────┼──────────────────────┐
                          ▼                                              ▼
              ┌───────────────────────┐                       ┌─────────────────────┐
              │  X.2 Stripe Checkout  │ (3j)                  │  X.3 DocuSeal       │ (3-4j)
              │  & webhook            │                       │  self-hosted        │
              └───────────┬───────────┘                       └──────────┬──────────┘
                          │                                              │
                          └──────────────────┬───────────────────────────┘
                                             ▼
                                ┌────────────────────────────┐
                                │ X.4 State machine          │ (4j)
                                │ deposit-validation-gated   │
                                │ (~28 valeurs + AUTO trigger)│
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.5 Multi-options          │ (2j)
                                │ simultanées (cap config)   │
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.5bis Parcours B          │ (2j) 🆕 D44
                                │ Formulaire devis qualifié  │
                                │ (/demande-devis + V4)      │
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.6 Pre-booking cadrage    │ (3j)
                                │ (manual_external V1)       │
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.7 Devis semi-auto +      │ (3j)
                                │ signature DocuSeal         │
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.8 Admin Réservations     │ (3-4j)
                                │ liste + drawer riche       │
                                └──────────────┬─────────────┘
                                               │
                            ┌──────────────────┼──────────────────┐
                            ▼                                      ▼
              ┌───────────────────────┐                ┌───────────────────────┐
              │ X.9 Admin Calendrier  │ (3-4j)         │ X.10 Admin Factures   │ (4j)
              │ v2 + heatmap géo      │                │ V1 + frais 3 modes    │
              └───────────┬───────────┘                └──────────┬────────────┘
                          │                                       │
                          │                                       ▼
                          │                              ┌─────────────────────┐
                          │                              │ X.11 Admin Paiements│ (3j)
                          │                              │ suivi pro + hybride │
                          │                              └──────────┬──────────┘
                          │                                         │
                          └──────────────────┬──────────────────────┘
                                             ▼
                                ┌────────────────────────────┐
                                │ X.12 Crons & workers       │ (3j)
                                │ (22 jobs total + DLQ + Sentry)│
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.13 Emails templates V1   │ (3-4j)
                                │ (~30 templates FR+EN)      │
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.14 Admin nav refactor    │ (2-3j)
                                │ + Dashboard « Aujourd'hui » │
                                └──────────────┬─────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                                          ▼
              ┌───────────────────────┐                   ┌───────────────────────┐
              │ X.15 Self-service     │ (2j)              │ X.16 Géo-awareness    │ (2j)
              │ client + Customer Pt  │                   │ OSM + Haversine       │
              └───────────┬───────────┘                   └───────────┬───────────┘
                          │                                           │
                          └────────────────────┬──────────────────────┘
                                               ▼
                                ┌────────────────────────────┐
                                │ X.17 Conformité légale V1  │ (3-4j)
                                │ CGV + sous-proc + archive  │
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.18 Préfill + tracking    │ (1-2j)
                                │ funnel + correction CTAs   │
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.19 Tests E2E Playwright   │ (3j)
                                │ happy path + 10 edge cases │
                                └──────────────┬─────────────┘
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ X.20 Doc + ADRs + CHANGELOG│ (1j)
                                └────────────────────────────┘
```

**Chemin critique long** (sans parallélisation) : X.0 → X.1 → X.2 → X.4 → X.5 → X.5bis → X.6 → X.7 → X.8 → X.9 → X.11 → X.12 → X.13 → X.14 → X.15 → X.17 → X.18 → X.19 → X.20 = **~48-52j**.

**Parallélisations possibles** :

- X.2 et X.3 en // après X.1 (économie ~3-4j).
- X.5bis peut tourner en // avec X.6 après X.5 (économie ~2j si dev parallèle dispo ; pas si 1 dev unique).
- X.9 et X.10 en // après X.8 (économie ~3-4j).
- X.15 et X.16 en // après X.14 (économie ~2j).

**Chemin critique optimisé avec parallélisations** : **~42-48j**.

---

## 5. Section D — Sprints V2+ (P3 — REPORTÉ, listés pour traçabilité)

> ⚠️ **Distinction référentielle** : 6 sprints principaux (cohérents MANIFEST/SYNTHESE/NO-GO §1.7) + 6 extensions secondaires optionnelles. Seuls les 6 principaux constituent le chiffre référentiel V2+ (~17-25 j ingé) communiqué dans les autres livrables V2.

### 5.1 — 6 sprints V2+ principaux (référentiel, ~17-25 j ingé)

| Sprint V2+ | Nom                                                                                                         | Durée | Trigger                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------- |
| V2.Q1      | Qualiopi (TrainingSession + Attendance + Evaluation + Certificate + convention formation)                   | 5-7j  | Décision Will + certification Qualiopi obtenue |
| V2.Q2      | OPCO workflow (Invoice.payerType=opco, factures 60-90j, relances OPCO spécifiques, conventions tripartites) | 3-4j  | Volume bookings OPCO > 2/mois                  |
| V2.EI      | E-invoicing FR PPF/PDP (loi PACTE 2026-2027 — Factur-X + Chorus Pro)                                        | 5-7j  | Décision juridique FR définitive               |
| V2.VIES    | VIES API multi-régime TVA intra-UE                                                                          | 1-2j  | Décision juridique FR + clients EU intra > 5   |
| V2.MC      | Multi-currency GBP/USD                                                                                      | 1-2j  | Premier client UK/US                           |
| V2.CR      | Réconciliation comptable API (Pennylane/Indy/Tiime)                                                         | 2-3j  | Volume factures > 50/mois                      |

**Sous-total 6 principaux** : **~17-25 j ingé** (référentiel V2+).

### 5.2 — 6 extensions secondaires optionnelles (annexe, ~12-15 j ingé supplémentaires)

> Ces sprints ne sont pas comptés dans le total référentiel V2+ des autres livrables. Ils sont listés pour traçabilité et activables à la demande selon signaux business.

| Sprint V2+ | Nom                                                          | Durée | Trigger                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2.VID     | Provider visio natif (Whereby Embedded OU Jitsi self-hosted) | 2-3j  | Volume cadrages > 5/semaine                                                                                                                                                             |
| V2.PDP     | E-signature qualifiée eIDAS (QES upgrade)                    | 2-3j  | Demande client ETI/banque                                                                                                                                                               |
| V2.SMS     | Notifications SMS critiques (impayés J+30, cadrage H-2)      | 1-2j  | Conversion < 80 % réponse email                                                                                                                                                         |
| V2.STR     | Stripe Payment Element embed (vs hosted Checkout)            | 3-4j  | Conversion checkout < 60 %                                                                                                                                                              |
| V2.MUL     | Multi-admin + workflow approval                              | 3-4j  | Recrutement Axion-IA team                                                                                                                                                               |
| V2.BBR     | Branding PDF custom (logo upload admin)                      | 1j    | Demande client ou rebranding                                                                                                                                                            |
| V2.RB      | **Recurring Bookings (packs annuels 6 audits/an répétés)**   | 2-3j  | Volume packs annuels > 3 clients OU demande Will V2+. Table `BookingSeries(parentBookingId, frequency, count)` + cron `recurring-bookings-generate` + UI admin (cf. ULTIMATE-AUDIT G6). |

**Sous-total 7 extensions** : **~14-18 j ingé** (hors total référentiel).

**Total V2+ complet (principaux + extensions)** : ~30-40 j ingé (déroulé sur 12-18 mois selon priorités business). Le chiffre référentiel communiqué aux autres livrables V2 (MANIFEST/SYNTHESE/NO-GO) reste **6 sprints / 17-25 j** (sprints principaux uniquement).

---

## 6. Section E — Top 10 P0 transverses (impact × effort inverse)

| Rang | P0                                                                                                                                               | Impact  | Effort | Sprint cible   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------ | -------------- |
| 1    | Aucun modèle Payment/Invoice/Refund (greenfield Stripe complet)                                                                                  | 🚨 MAX  | M      | X.1, X.2, X.10 |
| 2    | Pas de webhook Stripe sécurisé (signature + idempotence)                                                                                         | 🚨 MAX  | S      | X.2            |
| 3    | State machine 4 statuts insuffisante (besoin ~28 valeurs effectives : ~22 statuts business + 6 branches dérivées) + trigger AUTO validation Will | 🚨 MAX  | M      | X.4            |
| 4    | Aucun cadrage en code malgré copy `interventions.ts:230` (mensonge UX)                                                                           | 🚨 MAX  | S      | X.6            |
| 5    | Pricing TS hardcodé non-DB-managé (cap pour admin évolutif)                                                                                      | 🚨 MAX  | M      | X.1            |
| 6    | Aucun moyen de signer contrat/devis (DocuSeal substitution Yousign)                                                                              | 🚨 MAX  | M      | X.3, X.7       |
| 7    | Échéancier figé 50/solde (besoin 4 profils + custom + override)                                                                                  | 🚨 HIGH | S      | X.1            |
| 8    | Aucun système suivi paiements pro + relances auto                                                                                                | 🚨 HIGH | S      | X.11, X.12     |
| 9    | CGV non opposables (acompte non-remboursable + grille refund + force majeure symétrique)                                                         | 🚨 HIGH | S      | X.17           |
| 10   | Aucun préfill URL pSEO (~6500 routes pSEO vides côté funnel)                                                                                     | 🚨 HIGH | XS     | X.18           |

---

## 7. Section F — Dépendances externes Will (bloquants)

| #   | Dépendance                                                    | Type          | Statut                           | Sprint impact |
| --- | ------------------------------------------------------------- | ------------- | -------------------------------- | ------------- |
| 1   | Compte Stripe live + KYB validé (Atlas Estonia ou France SAS) | Action Will   | À acter avant X.2                | X.2, X.10     |
| 2   | DPA Stripe signé (auto Dashboard)                             | Action Will   | À signer avant X.2 prod          | X.17          |
| 3   | DPA Hetzner papier                                            | Action Will   | En cours                         | X.17          |
| 4   | DPA Cloudflare online                                         | Action Will   | À signer                         | X.17          |
| 5   | Décision structure juridique FR vs EE pour `legal.ts`         | Décision Will | NON tranchée — code paramétrable | X.0, X.17     |
| 6   | DMARC/DKIM/SPF prod axion-ia.com vérifiés (Mailwizz Phase 0)  | Action ops    | À tester                         | X.13          |
| 7   | Domaine `docuseal.axion-ia.com` + SSL Caddy + DNS             | Action ops    | À configurer                     | X.3           |
| 8   | Hetzner Storage Box S3-compatible activé                      | Action ops    | À provisionner                   | X.0, X.3      |
| 9   | Choix `ContractTemplate` v1 FR + EN (rédaction juridique)     | Action Will   | À rédiger                        | X.3, X.17     |
| 10  | Choix `ContractTemplate` NDA standard FR + EN                 | Action Will   | À rédiger                        | X.3, X.17     |
| 11  | Décision provider visio (manual_external V1 par défaut)       | Décision Will | À acter X.0                      | X.6           |
| 12  | Validation 4 profils échéancier V1 default                    | Décision Will | À acter X.0                      | X.1           |

---

## 8. Section G — Risques bloquants + mitigations

### Risque 1 — DocuSeal self-hosted instable

- **Impact** : si DocuSeal Docker bug ou indisponible, blocage signature contrats / devis → blocage flow validation → blocage acompte Stripe → revenu stoppé.
- **Probabilité** : moyenne (logiciel open-source mature mais self-hosted = SPOF).
- **Mitigation** :
  - Sprint X.3 livre `markContractSignedManuallyAction` super_admin fallback (saisie PDF + audit log + flag `bypassReason`).
  - Backup DocuSeal SQLite quotidien Hetzner Storage Box.
  - Healthcheck Docker + auto-restart Coolify.
  - V1.5 : provider Yousign en parallèle activable via SiteSetting si volume bookings > 10/semaine.

### Risque 2 — Stripe radar bloque transactions légitimes B2B

- **Impact** : faux positifs (CVC retry, IP riskscore Cloudflare WARP) → checkout échoué → conversion chute.
- **Probabilité** : moyenne (Stripe Radar tier free agressif).
- **Mitigation** :
  - Sprint X.2 ADR 0020 documente règles Radar conservatrices V1.
  - Admin UI `/admin/paiements/disputes` liste blocages Radar avec bouton « Whitelist client ».
  - Monitoring Telegram tag `FRAUDE_REVIEW` pour intervention manuelle Will.

### Risque 3 — Numérotation séquentielle facture sous concurrence

- **Impact** : si lock Postgres advisory échoue → trous numérotation → non-conformité CGI 242 nonies A FR + EE.
- **Probabilité** : faible (lock advisory bien testé Postgres).
- **Mitigation** :
  - Sprint X.10 helper `nextInvoiceNumber()` avec `pg_advisory_xact_lock(hashtext('invoice_seq_2026'))`.
  - Tests Vitest concurrence 1000 inserts parallèles → 1000 numéros uniques.
  - Monitoring : alerte Sentry si gap détecté (cron `numbering-audit` mensuel).

### Risque 4 — Sous-estimation effort multi-options + cascade `lost_other_won`

- **Impact** : Sprint X.5 ne livre que 2j mais cascade impacte X.4 + X.13 (templates) + UX visiteur 5 statuts (4 visibles + 1 admin). Risque sous-estimation.
- **Probabilité** : moyenne.
- **Mitigation** :
  - Buffer 15 % global sur Sprint X.5 + X.13.
  - Tests Playwright early dans X.5 (race conditions cap=3).
  - Si dérive : V1.x avec cap=1 (mono-option = comportement V0) puis cap=3 V1.5.

### Risque 5 — Géo-awareness OSM Nominatim rate-limit

- **Impact** : ToS Nominatim = 1 req/s. Avec 17 500 routes pSEO + bookings, géocodage massif possible → ban IP.
- **Probabilité** : faible (cache 90j + batch).
- **Mitigation** :
  - Sprint X.16 cache géocoding 90j dans `SiteSetting.geocodeCache`.
  - User-Agent custom `axion-ia.com/contact@axion-ia.com`.
  - Fallback : self-hosted Nominatim Docker si volume > 1000 req/jour.

---

## 9. Notes méthodologiques

- Aucun code applicatif modifié pendant cet audit. Toutes durées sont **fourchettes prudentes**, marge 15 % recommandée pour buffer imprévu (debug DocuSeal Coolify, intégration Stripe Test → Live, etc.).
- L'estimation référentiel `~52-58 j ingé` (post-itération D49-D58 ; table brute 61-70,5j ajustée parallélisations §4) correspond à un dev expert Next 16 + Prisma + Stripe + BullMQ + DocuSeal. Si dev junior : multiplier par 1.5 à 2.
- L'estimation suppose 1 dev plein temps (5j/semaine, 8h/jour effectif). Si rythme partiel : recalculer délai prévisionnel.
- Le DAG §4 considère parallélisation possible (X.2//X.3, X.9//X.10, X.15//X.16) qui économise ~5j si 2 devs.
- Toutes les décisions Will tranchées dans X.0 sont **paramétrables ensuite** via admin UI (`/admin/tarifs`, `/admin/echeanciers`, `/admin/parametres`) sans refactor code.
- La doctrine **Code = SSOT** est respectée : tous les choix V1 sont implémentables, testables, déployables sans dépendance à un provider externe payant (DocuSeal substitution Yousign économise ~50 €/mois SaaS).
- Le périmètre Qualiopi/OPCO/PDP/régime fiscal détaillé reste **HORS V1** ferme (master prompt §0.0bis), avec hooks DB nullable préparés (`Booking.trainingSessionId`) pour intégration V2+ sans migration destructrice.

---

**Fin du document `04-PLAN-EXECUTION.md`** · Vision V1 finale Will 2026-05-12 · Réécrit pour cohérence avec architecture cible 03 + 11 agents Phase 2.
