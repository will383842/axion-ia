# MANIFEST — Audit Booking Deposit-Validation-Gated + Admin Console 2026

> Audit Axion-IA — **cabinet IA opérationnel B2B premium** — V2.1 LIVE Hetzner CPX32 + Cloudflare Free + Coolify.
>
> **Mode** : 🚫 AUDIT-ONLY — AUTO-PILOT 1-GATE. Aucun code applicatif modifié. Seules sorties = `.md` dans ce dossier.
>
> **Note** : version V2 du manifest (post-review Will 2026-05-12). Vision V1 finale réécrite suite à échange interactif Will (DocuSeal au lieu de Yousign, validation manuelle Will = trigger AUTO, pricing DB-managé, multi-options simultanées, frais accessoires 3 modes, échéanciers configurables, géo-awareness, suivi paiements pro). Les 11 agents Phase 2 + Phase 0 + Phase 1 + Phase 3 + benchmarks restent **inchangés** (audit V0).

- **Date démarrage** : 2026-05-12
- **Date clôture** : 2026-05-12 (mode AUTO-PILOT — exécution d'un trait + 1 itération de réécriture suite review Will)
- **HEAD audité** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742` (branche `main`)
- **Prompt source** : `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` (V3)
- **Auditeur** : Claude Opus 4.7 (1M context)
- **Cible audit** : Axion-IA `https://axion-ia.com` (V2.1 LIVE Hetzner CPX32 + Cloudflare Free + Coolify)

---

## 1. Verdict

### 🔴 NO-GO

**Score pondéré : 37.5 / 100** — < 70 % et P0 ≥ 36 → NO-GO sans ambiguïté (cf. `SYNTHESE-FINALE.md` § 2 et `🚨-NO-GO-ALERT.md`).

**Lecture** : ne concerne pas la plateforme V2.1 (live, stable, sécurisée), uniquement la **promesse deposit-gated** affichée qui n'a aucun support code.

---

## 2. Périmètre temporel — Rappel

- **V1** : deposit-**validation**-gated minimal complet (validation manuelle Will = trigger AUTO contrat DocuSeal + facture Stripe + emails).
- **HORS V1** : Qualiopi, OPCO, e-invoicing FR PPF/PDP, régime TVA détaillé (architecture agnostique posée).
- **Structure juridique FR vs EE** : non tranchée → architecture TVA-agnostique paramétrable, default scénario EE selon `legal.ts:44`.

---

## 3. Décisions Will appliquées

### Défauts § 0.6 prompt source appliqués sans demander (D1→D32)

D1=30 % acompte par défaut (configurable par format admin, cf. D35), D2=48h délai (configurable par format, cf. D34), D3=Stripe Checkout, D5=non-remboursable sauf force majeure, D9=cadrage obligatoire hors `audit_flash_onsite`, D11=devis >5 000 € HT (cf. D33), D12=NDA ETI/grande-entreprise ou secteur sensible, D13=Yousign **REJETÉ → DocuSeal** (cf. D36), D17=state machine ~28 valeurs effectives V1 (~22 statuts business + 6 branches dérivées), D18=Customer Portal activé, D19=reschedule self-service ≥ J-7, D21=UTC stocké/Europe/Paris affiché, D22=EUR uniquement V1, D23=1/jour, 3/semaine, 8/mois, D24=buffer trajet auto + géo OSM (cf. D39), D25=`date-holidays` lib, D26=substitution J-1, D27=multi-participant emails, D28=file request signé (cf. Q4), D29=`AXION-2026-NNNN`, D30=archivage 10 ans, D31=PDF moteur (cf. Q3), D32=export CSV mensuel V1.

### Décisions Will tranchées 2026-05-12 (D33→D43) — cf. `STOP-AND-ASK.md` § 1

- **D33** — Devis NON universel (`requiresQuote` helper SSOT `pricing.ts`, formats à tarif fixe + ≤ 5 000 € HT = bon de commande, > 5 000 € HT OU IA Custom = devis DocuSeal).
- **D34** — Calendrier visiteur 5 statuts (4 visiteur visibles + 1 admin) : 🟢 Libre / 🟠 Pré-réservée / 🟡 Cap atteint / 🔴 Validée + ⚫ Bloquée admin (invisible visiteur). Multi-options simultanées, cap configurable `SiteSetting.maxConcurrentOptionsPerSlot` défaut 3.
- **D35** — Acompte % configurable depuis admin (`PricingConfig` table DB, modifiable per `InterventionType`, revalidation auto pages publiques).
- **D36** — Yousign REJETÉ → **DocuSeal self-hosted** retenu (gratuit, eIDAS-SES, Docker sur Hetzner CPX32).
- **D37** — Clic Will "Envoi contrat + demande acompte" parcours A (D49) = **trigger AUTO** (autres options `lost_other_won` + contrat PDF + facture acompte PDF + Stripe Checkout Session + email client). Slot reste 🟠 (status interne `contract_payment_sent`) ; il ne passe 🔴 qu'après le 2ème clic manuel Will "Valider sur le calendrier" (D49 + D51). Saisie admin obligatoire avant envoi (frais + Tiptap contrat, D55) — pas de seuil 1 500 € HT (D55).
- **D38** — Frais accessoires modélisés en DB (3 modes configurables par format : `real_costs` / `flat_rate_by_zone` / `included`).
- **D39** — Géo-awareness intelligent (OSM Nominatim + Haversine, fenêtre 48h, 🟡 si > 600 km, alerte 300-600 km).
- **D40** — Échéancier configurable par taille de ticket + override par booking (4 profils DB : ≤ 1 500 / 1 500-5 000 / 5 000-15 000 / > 15 000 €, modifiables admin).
- **D41** — Pas Qualiopi / pas OPCO V1 confirmé (hooks DB `Booking.trainingSessionId` + `Invoice.payerType=client` default préservés).
- **D42** — Stripe Checkout V1 + **mode hybride manuel** (`Payment.provider` enum : `stripe | manual_wire | manual_check | manual_cash`).
- **D43** — Système email maison existant (Nodemailer + PowerMTA + Mailwizz Phase 0) — pas de nouveau service.

### Décisions Will tranchées 2026-05-12 — UX E2E post-vérification (D44→D48) — cf. `UX-E2E-VERIFICATION.md` + `STOP-AND-ASK.md` § 1

- **D44** — **2 parcours visiteur distincts** : parcours **A** (format sans devis → `/reserver` calendrier multi-options → validation Will → trigger AUTO) et parcours **B** (format avec devis → `/demande-devis` formulaire qualifié → `Submission` type=`quote_request` → négociation hors-app → création manuelle Booking par Will via drawer admin unifié). `Booking.originPath` enum `direct` / `quote_negotiation` + `Booking.fromSubmissionId` FK nullable matérialisent la liaison.
- **D45** — **Pas de slot calendrier réservé pendant négo B** : la `Submission` reste « en pipeline » sans bloquer de slot tant que `createBookingFromSubmissionAction` n'est pas appelée. Will peut, dans le drawer §5.11.3.bis, ouvrir un mini-calendrier admin pour positionner mentalement les slots — mais le blocage formel n'a lieu qu'à l'envoi final.
- **D46** — **Création manuelle Booking B par Will** via Server Action `createBookingFromSubmissionAction(submissionId, slots[], amountHt, scheduleProfile|custom, fees, vatRate, contractDraftTiptap, quoteDraftTiptap)` (A16) qui matérialise la sortie de négociation en 1 clic (Booking + Quote + ContractDocument + Invoice deposit + Stripe Checkout + email unifié `contract-sent-with-deposit-link`).
- **D47** — **Drawer admin unifié parcours B** (§5.11.3.bis) : slot picker multi-slots + montant + 4 frais accessoires + échéancier (profil ou custom) + TVA + éditeur Tiptap contrat préremplé + éditeur Tiptap devis préremplé + bouton « Envoyer devis + contrat + lien paiement ». Action SSOT `createBookingFromSubmissionAction`. `super_admin` only si montant > 15 000 € HT.
- **D48** — **Crons spécifiques parcours B** : `negotiation-stalled-reminder` (job #21 — Telegram Will J+7/J+14/J+30 si Submission B inactive ; email visiteur uniquement à J+30) + `contract-signed-without-deposit-reminder` (job #22 — relance client + Will à J+3/J+7/J+14 si contrat signé mais acompte non payé ; flag auto-expire candidat à J+14).

### Décisions Will tranchées 2026-05-12 — Itération finale (D49→D58) — cf. `STOP-AND-ASK.md` § 1

- **D49** — **Validation calendrier = 2 clics distincts**. Bouton 1 dans `/admin/demandes` parcours A = **"Envoi contrat + demande acompte"** (renommage explicite de `validateBookingOptionAction` → `sendContractAndDepositRequestAction`, plus de bouton générique "Valider" pour éviter toute confusion). Bouton 2 dans la section dashboard "Prêts à valider" = **"Valider sur le calendrier"** (Server Action `validateBookingOnCalendarAction` ; transition `awaiting_admin_validation` → `confirmed` ; slot passe enfin 🔴 + email final client `booking-validated-on-calendar`).
- **D50** — **Critère bloquant unique pour passage 🔴 = paiement acompte reçu**. Le contrat signé n'est PAS bloquant : si pas signé via DocuSeal au moment du clic Will, la signature physique est faite le jour J de l'intervention. La console admin affiche dans ce cas un badge ⚠️ "Contrat à signer le jour J" sur le booking concerné, mais Will peut valider sur le calendrier dès que le paiement est encaissé.
- **D51** — **État intermédiaire `awaiting_admin_validation`** ajouté à `BookingStatus` enum entre `contract_payment_sent` (ou `deposit_pending`) et `confirmed`. Transition `contract_payment_sent → awaiting_admin_validation` **automatique** dès webhook Stripe acompte reçu (ou `recordManualPaymentAction` virement reçu). Slot reste 🟠 (status interne `awaiting_admin_validation`) jusqu'au clic manuel Will "Valider sur le calendrier", qui le bascule en 🔴.
- **D52** — **Délais d'expiration configurables depuis l'admin** via 2 clés `SiteSetting` :
  - `optionExpirationDaysIfNothingReceived` (défaut **5 jours**) — durée après envoi contrat+demande acompte au-delà de laquelle l'option est annulée si ni la signature DocuSeal ni le paiement Stripe ne sont reçus.
  - `contractSignedWithoutDepositCutoffDays` (défaut **10 jours**) — durée après signature contrat au-delà de laquelle le booking est résolu de plein droit si l'acompte n'a pas été payé (cf. clause CGV D53).
  - Édition possible depuis `/admin/parametres-delais`. Auditable via `ActivityLog`.
- **D53** — **Clause contractuelle par défaut** ajoutée dans `ContractTemplate.defaultLegalClauses` (JSONB), insérée automatiquement dans chaque contrat généré, modifiable Will avant envoi via Tiptap :
  > _"Article — Résolution pour défaut de paiement. Le présent contrat sera résolu de plein droit, sans formalité ni mise en demeure, en cas de non-paiement de l'acompte dans un délai de 10 jours suivant sa signature électronique. La date de prestation sera alors libérée."_
- **D54** — **Notifications Will = Telegram + console admin UNIQUEMENT**. Pas d'email vers Will. S'applique à : nouvelle demande A reçue, nouvelle demande devis B reçue, contrat signé DocuSeal, acompte payé Stripe, booking prêt à valider sur calendrier, expiration imminente (J-1 du seuil D52), conflit géographique (D39).
- **D55** — **Saisie admin OBLIGATOIRE avant envoi du contrat parcours A** : écran d'édition entre clic "Envoi contrat + demande acompte" et envoi effectif. Saisie des frais accessoires (déplacement / hôtel / repas / divers, **modifiables**) + édition du contrat Tiptap (template pré-rempli avec D53, modifications libres, **PAS de seuil >1 500 € HT** — le contrat est toujours éditable). Symétrique parcours B (déjà couvert par drawer admin unifié D47).
- **D56** — **Customer Portal Stripe RETIRÉ V1**. Les factures sont envoyées par email en pièce jointe PDF uniquement. Pas de page self-service Stripe billing pour V1. Économie ~0,5j ingé (suppression endpoint `/api/stripe/customer-portal` + drawer admin associé). Hook V2+ préservé via `Payment.providerCustomerId`.
- **D57** — **NPS J+1 RETIRÉ V1**. Pas de cron `booking-j1-debrief`, pas de template NPS. Économie ~0,5j ingé. À reconsidérer V1.5+ si Will veut industrialiser les témoignages.
- **D58** — **Onboarding docs RETIRÉ V1**. Pas de Sprint dédié onboarding-docs, pas de table `OnboardingDoc` créée V1. V1.5+ Will préfère un formulaire structuré (pas un upload fichiers libre). Pour V1, gestion hors-app par email. Économie ~1-2j ingé. Storage Hetzner Box reste utilisé V1 pour factures PDF + contrats signés PDF + devis PDF (cf. Q4 STOP-AND-ASK).

### Décisions Will tranchées 2026-05-12 — Itération ULTIME (D59→D63) — cf. `ULTIMATE-AUDIT.md` + `STOP-AND-ASK.md` § 1

- **D59** — **Échec paiement échéance 2/3 traité**. Ajout états `installment_overdue` (J+30 retard) + `disputed` (J+45 état terminal, recouvrement hors-app par Will) à `BookingStatus`. Cron `installment-overdue-escalation` quotidien (J+3 soft / J+15 ferme / J+30 Telegram urgent / J+45 status disputed). 3 nouveaux templates (`installment-overdue-soft`, `installment-overdue-firm`, `installment-disputed-notice`). Sprint X.4 + X.12 + X.13. Effort +0,5j.
- **D60** — **Drag-drop reschedule admin matérialisé**. Server Action `rescheduleBookingByAdminAction(bookingId, newSlotIds[], reason, notifyClient: bool)`. Restriction de statut (autorisé si ∈ {contract_payment_sent, awaiting_admin_validation, confirmed, paused}). Audit log obligatoire. Template `booking-rescheduled-by-admin` (#52) avec nouveau `.ics`. Sprint X.9. Effort +0,5j.
- **D61** — **Suspension booking `paused`**. Statut `paused` ajouté à `BookingStatus` + colonnes `Booking.pausedAt`/`pausedUntil`/`pauseReason`. 2 Server Actions `pauseBookingAction(bookingId, untilDate, reason)` + `resumeBookingAction(bookingId, newSlotIds[])`. Cron `paused-resume-reminder` (Telegram Will à pausedUntil - 7j / - 1j / 0). 2 templates (`booking-paused-confirmation`, `booking-resumed-notification`). Sprint X.4 + X.12 + X.13. Effort +0,5j.
- **D62** — **Versioning contrat post-envoi**. Server Actions `cancelAndReissueContractAction(contractId, newDraftTiptap, reason)` (avant signature uniquement — annule v1, crée v2) + `createContractAddendumAction(bookingId, addendumDraftTiptap)` (après signature — contrat principal immuable, avenant séparé). Colonnes `ContractDocument.version`/`previousVersionId`/`isAddendum`. Enum `ContractStatus.cancelled_admin`. Template `contract-version-updated` (#55). Sprint X.3 + X.13. Effort +0,5j.
- **D63** — **Migration data V0 → V1 obligatoire Sprint X.4**. Script `scripts/migrate-bookings-v0-to-v1.ts` idempotent : `pending → option_pending`/`cadrage_scheduled` selon `slotId`, `confirmed (passé) → archived` + Payment/Invoice rétroactifs `isHistorical=true`, `confirmed (futur) → confirmed` + Payment/Invoice rétroactifs, `cancelled → cancelled_by_admin`, `postponed → drop`. Test snapshot dev avant prod + audit log `BookingTransition.trigger='migration.v0_to_v1'` + backup Hetzner < 1h avant run + rollback plan. Colonne `Payment.isHistorical`. Sprint X.4. Effort +0,5j.

### 10 questions Will restantes (Q1→Q10) — cf. `STOP-AND-ASK.md` § 2

À trancher au Sprint X.0 (~30-45 min review dédiée) :

1. **Q1** — Provider visio cadrage V1 (reco : `manual_external` V1).
2. **Q2** — Structure juridique FR vs EE (peut attendre Sprint X.17).
3. **Q3** — PDF moteur (reco : `react-pdf`).
4. **Q4** — Storage onboarding docs (reco : Hetzner Storage Box).
5. **Q5** — Drag & drop calendrier admin (reco : V1 minimal).
6. **Q6** — Refunds auto vs manuel (reco : manuel V1).
7. **Q7** — J+1 debrief NPS (reco : V1).
8. **Q8** — Admin EN bilingue (reco : FR only V1).
9. **Q9** — Liste fermée secteurs sensibles NDA auto.
10. **Q10** — % d'acompte par défaut par format (reco : appliquer D40).

---

## 4. Statut des livrables

| Livrable                                  | Statut                                  | Agent / Source                        | Sources principales                                                                                                                                                                         |
| ----------------------------------------- | --------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MANIFEST.md                               | ✅ OK (V2)                              | Synthèse                              | Ce fichier                                                                                                                                                                                  |
| 00-REALITY-CHECK.md                       | ✅ OK                                   | Phase 0                               | `prisma/schema.prisma`, `src/features/**/actions.ts`, `src/app/[locale]/(admin)/**`, `src/server/queue/**`, `src/emails/**`, `src/content/{pricing,interventions,legal}.ts`, `package.json` |
| 01-INVENTAIRE-E2E.md                      | ✅ OK                                   | Phase 1                               | Flow visiteur + flow admin + cycle de vie + notifications                                                                                                                                   |
| 02-BENCHMARKS-2026.md                     | ✅ OK                                   | Phase 3                               | Doc officielle Stripe / DocuSeal / Cal.com / Linear / Doctolib + 24 outils benchmarkés                                                                                                      |
| agent-01-flow-visiteur.md                 | ✅ OK (V0 snapshot)                     | Agent 1                               | `src/app/[locale]/reserver/page.tsx`, `BookingCalendar.tsx`, CTAs Grep                                                                                                                      |
| agent-02-admin-organisation.md            | ✅ OK (V0 snapshot)                     | Agent 2                               | 17 sections admin actuelles + `layout.tsx` + `admin-path.ts`                                                                                                                                |
| agent-03-state-machine.md                 | ✅ OK (V0 snapshot)                     | Agent 3                               | `BookingStatus` enum, transitions, `admin-options/actions.ts`                                                                                                                               |
| agent-04-paiement-stripe.md               | ✅ OK (V0 snapshot)                     | Agent 4                               | Doc Stripe Checkout/Webhook/Portal/Invoices/Radar                                                                                                                                           |
| agent-05-calendrier-admin.md              | ✅ OK (V0 snapshot)                     | Agent 5                               | `admin/calendrier/page.tsx` + `CalendarBlockPanel.tsx` + `admin-calendar/actions.ts`                                                                                                        |
| agent-06-automatisations.md               | ✅ OK (V0 snapshot)                     | Agent 6                               | `src/server/queue/**` workers + crons existants                                                                                                                                             |
| agent-07-notifications.md                 | ✅ OK (V0 snapshot)                     | Agent 7                               | `src/emails/**` 13 templates V0 + `telegram.ts` + `pii-redaction.ts`                                                                                                                        |
| agent-08-rgpd-owasp.md                    | ✅ OK (V0 snapshot)                     | Agent 8                               | `legal.ts`, `auth.config.ts`, `next.config.ts`, OWASP 2025 + CNIL + Stripe docs                                                                                                             |
| agent-09-bout-en-bout.md                  | ✅ OK (V0 snapshot)                     | Agent 9                               | CTAs cross-pages + `interventions/page.tsx` + pSEO villes                                                                                                                                   |
| agent-10-pre-booking-cadrage-devis-nda.md | ✅ OK (V0 snapshot)                     | Agent 10                              | Doc Yousign + recommandation Whereby/Jitsi + onboarding docs. **Note** : Yousign mentionné dans l'audit V0 mais **REMPLACÉ PAR DOCUSEAL en cible V1** (cf. D36).                            |
| agent-11-conformite-legale-v1.md          | ✅ OK (V0 snapshot)                     | Agent 11                              | legifrance, impots, service-public, eur-lex, cnil, riigiteataja                                                                                                                             |
| 03-ARCHITECTURE-CIBLE.md                  | ✅ OK (V2 — réécrit)                    | Phase 4 (réécriture post-review Will) | Consolidation agents 3+4+6+7+10+11 + § 5 prompt source + vision V1 finale Will                                                                                                              |
| 04-PLAN-EXECUTION.md                      | ✅ OK (V2 — réécrit)                    | Phase 5 (réécriture post-review Will) | 20 sprints V1 chiffrés + 6 sprints V2+ reportés + DAG ASCII + vision V1 finale Will                                                                                                         |
| SYNTHESE-FINALE.md                        | ✅ OK (V2 — réécrit)                    | Phase 6                               | Score pondéré + verdict + Top 10 P0 + Top 10 quick wins + vision V1 finale                                                                                                                  |
| STOP-AND-ASK.md                           | ✅ OK (V2 — réécrit)                    | Phase 6                               | D33-D43 tranchées + Q1-Q10 restantes + bloquants externes                                                                                                                                   |
| 🚨-NO-GO-ALERT.md                         | ✅ OK (V2.3 — itération ultime D59-D63) | Phase 6                               | Alerte verdict + Voie A (build V1 54-60 j incl. parcours B D44 + D49-D58 + D59-D63) vs Voie B (palliatif copy 1-2 j)                                                                        |
| UX-E2E-VERIFICATION.md                    | ✅ OK                                   | Post-Phase 6                          | Vérification UX E2E 2 parcours A/B — 9 P0 + 7 P1 + 3 P2 identifiés, intégrés dans V2.1                                                                                                      |

**Total** : 20 livrables `.md`.

---

## 5. Score consolidé par agent (audit V0)

| Agent     | Périmètre                 | Score |     Poids |   Pondéré |
| --------- | ------------------------- | ----: | --------: | --------: |
| 1         | Flow visiteur `/reserver` |    51 |      12 % |      6.12 |
| 2         | Admin organisation        |    39 |      10 % |      3.90 |
| 3         | State machine             |    49 |      13 % |      6.37 |
| 4         | Paiement Stripe           |     7 |      13 % |      0.91 |
| 5         | Calendrier admin          |    18 |       9 % |      1.62 |
| 6         | Automatisations           |    29 |       9 % |      2.61 |
| 7         | Notifications             |    74 |       7 % |      5.18 |
| 8         | RGPD / OWASP              |    63 |       9 % |      5.67 |
| 9         | Bout-en-bout              |    50 |       5 % |      2.50 |
| 10        | Pre-booking               |     2 |       8 % |      0.16 |
| 11        | Conformité légale V1      |    50 |       5 % |      2.50 |
| **Total** |                           |       | **100 %** | **37.54** |

---

## 6. Architecture cible V1 — chiffres clés (cf. `03-ARCHITECTURE-CIBLE.md`)

- **16 tables nouvelles** (dont `OnboardingDoc` HORS V1 D58 — schéma préservé comme hook V1.5+ documenté, non migrée V1 ; **15 tables réellement migrées V1**) + extensions `Booking` (~25 colonnes : `originPath`, `fromSubmissionId` ajoutés D44 + `pausedAt`, `pausedUntil`, `pauseReason` ajoutés D61) + extension `Payment` (`isHistorical` D63) + extension `ContractDocument` (`version`, `previousVersionId`, `isAddendum` D62) + extension `BookingOption.status` enum + extension `SubmissionType` (ajout `quote_request`) + nouveau enum `SubmissionStatus` (`new/qualifying/negotiating/converted/lost/archived`) + enum `BookingOriginPath` + extension `ContractStatus` (`cancelled_admin` D62) + 2 clés `SiteSetting` D52 + colonne `ContractTemplate.defaultLegalClauses JSONB` D53.
- **State machine** : `BookingStatus` étendu à **~25 valeurs effectives V1** — ajout `awaiting_admin_validation` (D51) + `installment_overdue` (D59) + `disputed` (D59) + `paused` (D61). Transition automatique webhook Stripe → `awaiting_admin_validation` ; transition manuelle clic Will "Valider sur le calendrier" → `confirmed`. Transitions D59 : J+30 → `installment_overdue` ; J+45 → `disputed`. Transitions D61 bidirectionnelles `confirmed ↔ paused`.
- **~32 Server Actions cibles** (renommage A1 D49 + ajout A1bis D49 + V4 D44 + A16 + A17 D44 + **A18 `rescheduleBookingByAdminAction` D60** + **A19 `pauseBookingAction` D61** + **A20 `resumeBookingAction` D61** + **A21 `cancelAndReissueContractAction` D62** + **A22 `createContractAddendumAction` D62**).
- **~36 templates emails V1 FR+EN** (net +6 vs V2.2 : ajout `booking-rescheduled-by-admin` D60 #52 + `booking-paused-confirmation` D61 #53 + `booking-resumed-notification` D61 #54 + `contract-version-updated` D62 #55 + `installment-overdue-soft`/`-firm`/`-disputed-notice` D59 #56-58). + ~14 existants V0 = **~50 au total**.
- **~24 jobs cron au total V1** — retrait `booking-j1-debrief` (D57) ; ajouts D48 (#21, #22) + D52 (#23 + #23ter) + **D59 (#24 `installment-overdue-escalation`)** + **D61 (#25 `paused-resume-reminder`)**.
- **16 sections admin** (hausse vs 15 : ajout dédiée « Demandes devis » parcours B + sous-section "Prêts à valider" dans dashboard D49). Refonte sidebar par fréquence + Cmd+K + mobile + Dashboard.
- **TVA-agnostique** strict (FR vs EE non tranché).
- **Factures envoyées par email PJ uniquement** (D56) — Customer Portal Stripe HORS V1.
- **Script migration V0 → V1** obligatoire Sprint X.4 (D63) — `scripts/migrate-bookings-v0-to-v1.ts` idempotent + test snapshot dev + audit log + backup pré-run.
- **Hooks V2+** : Qualiopi / OPCO / e-invoicing PDP / VIES API / multi-currency / réconciliation comptable / Customer Portal Stripe / NPS J+1 / Onboarding docs structurés / **Recurring Bookings packs annuels (V2.RB)**.

---

## 7. Plan d'exécution V1 — chiffres clés (cf. `04-PLAN-EXECUTION.md`)

- **20 sprints V1** (X.0 → X.20 + X.5bis parcours B qualification — Sprint onboarding-docs retiré D58 ; D59-D63 absorbés dans sprints existants X.3 + X.4 + X.9 + X.12 + X.13). Renumérotation conservée pour préserver les références doc.
- **Total V1** : **~54-60 j ingé + 0,5j Will** (Sprint X.0 décisions Q1-Q10). Bilan vs V2.2 (~52-58 j) : itération ultime **D59 (+0,5j) + D60 (+0,5j) + D61 (+0,5j) + D62 (+0,5j) + D63 (+0,5j) = +2-3j absorbés dans sprints existants**.
- **Délai prévisionnel** : **10-12 semaines** avec 1 dev plein temps (inchangé, parallélisations absorbent +2-3j).
- **6 sprints V2+ principaux + 7 extensions** (incl. nouveau **V2.RB Recurring Bookings packs annuels**) : Qualiopi, OPCO, e-invoicing FR PPF/PDP, VIES API, multi-currency, réconciliation comptable + V2.VID/PDP/SMS/STR/MUL/BBR/RB. Plus 3 retirés-V1 reportés V1.5+ : Customer Portal Stripe (D56), NPS J+1 (D57), Onboarding docs structurés (D58).

---

## 8. Conformité mode AUDIT-ONLY (engagement § 11 prompt source — respecté)

- ✅ 0 ligne de code applicatif modifiée, ajoutée, supprimée.
- ✅ 0 migration Prisma écrite ou appliquée.
- ✅ 0 `pnpm add/install/remove/update`.
- ✅ 0 nouveau fichier `.ts/.tsx/.js/.sql/.env/.yaml/.json/.prisma` créé (hors `.md` dans le dossier de sortie).
- ✅ 0 `git add/commit/push/tag/stash`.
- ✅ 0 appel POST à Stripe, DocuSeal, Coolify, Cloudflare, Hetzner, Sentry, Telegram, Resend.
- ✅ 0 POST aux Server Actions du projet.
- ✅ 0 `pnpm dev/build brut/db:*/prisma migrate`.
- ✅ Qualiopi / OPCO / régime fiscal détaillé — non scopés V1.
- ✅ Structure juridique FR vs EE — architecture agnostique posée, pas tranchée.
- ✅ Tout output dans `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/`, format `.md` exclusivement.
- ✅ Citations systématiques `file:LINE` ou URL officielle.
- ✅ `[INCONNU — raison]` ou `[ABSENT]` quand non vérifiable.

---

## 9. Suite

→ Lire en priorité : `🚨-NO-GO-ALERT.md` (Will-action immédiate) + `SYNTHESE-FINALE.md` (vue d'ensemble) + `STOP-AND-ASK.md` (Q1-Q10 + D33-D43).

→ Pour le build : `03-ARCHITECTURE-CIBLE.md` (16 tables + ~23 valeurs state effectives incl. `awaiting_admin_validation` D51 + ~27 Server Actions + ~21 jobs cron V1 + ~30 templates V1 (+ ~14 existants V0 = ~44 total) + 16 sections admin + 2 parcours visiteur A/B D44 + 2 clics validation D49 + conformité TVA-agnostique + hooks V2+) + `04-PLAN-EXECUTION.md` (20 sprints chiffrés dont X.5bis parcours B + DAG + sprints V2+ reportés).

→ STOP unique respecté : pas de Sprint X.0 déclenché tant que Will n'a pas validé Voie A vs Voie B.
