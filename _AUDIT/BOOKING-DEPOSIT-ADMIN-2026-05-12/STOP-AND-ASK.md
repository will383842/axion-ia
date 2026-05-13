# STOP-AND-ASK — Décisions Will pendantes — V2 (post-review interactive 2026-05-12)

> Audit Axion-IA — **cabinet IA opérationnel B2B premium** — Booking Deposit-Gated + Admin Console 2026 — version réécrite après échange interactif Will.
> HEAD `ff3ccbc`. Mode AUDIT-ONLY 1-GATE.
>
> Ce fichier liste UNIQUEMENT les points où Will doit trancher.
> Tous les défauts § 0.6 du prompt source (D1→D32) + nouvelles décisions Will (D33→D63 incl. itération ultime D59-D63 2026-05-12 nuit) sont consignés dans `MANIFEST.md` § « Décisions Will appliquées ».

---

## 1. Décisions Will déjà tranchées 2026-05-12

Will a tranché les points suivants lors de la review interactive de l'audit. Listés ici pour traçabilité (n'attendent plus rien) :

### D33 — Devis NON universel (signature via DocuSeal, cf. D36)

- Formats à tarif fixe publié ne nécessitent **pas de devis**.
- Helper `requiresQuote(interventionType, amountHtCents)` SSOT dans `pricing.ts`.
- `audit_flash_onsite` + conférences + catalogue ≤ 5 000 € HT = bon de commande.
- > 5 000 € HT OU IA Custom = devis (signé via DocuSeal au lieu de Yousign).

### D34 — Calendrier visiteur 5 statuts (4 visiteur visibles + 1 admin invisible visiteur) — multi-options simultanées

- 🟢 Libre / 🟠 Pré-réservé (N options actives, cap configurable) / 🟡 Cap atteint / 🔴 Validé (4 statuts visibles côté visiteur) + ⚫ Bloqué admin (1 statut admin, invisible visiteur).
- Cap par défaut `maxConcurrentOptionsPerSlot = 3`, modifiable via `SiteSetting` admin.
- Pas de course à la signature/paiement — **C'EST WILL QUI VALIDE manuellement** une option, ce qui transforme le slot en 🔴 et envoie aux autres pré-réservataires un email avec dates alternatives.

### D35 — Acompte % configurable depuis admin (pas hardcodé)

- Table DB `PricingConfig` SSOT (au lieu du fichier `pricing.ts` code).
- Per `InterventionType` : `depositPercentage` OU `depositFixedAmountCents` (override).
- Modifiable depuis admin `/admin/tarifs`, revalidation auto pages publiques.

### D36 — Yousign REJETÉ → DocuSeal self-hosted retenu

- DocuSeal open-source MIT, eIDAS-SES compatible, déployé Docker sur Hetzner CPX32.
- **Gratuit** (vs Yousign ~€9-30/mois ou €1,40/signature).
- API + webhook HMAC simple.
- Suffisant pour 99 % des contrats B2B (sauf actes notariés/immobiliers).

### D37 — Clic Will "Envoi contrat + demande acompte" parcours A = trigger AUTO (saisie admin avant)

- Clic Will dans `/admin/demandes` "Envoi contrat + demande acompte" (D49 — renommage de `validateBookingOptionAction` en `sendContractAndDepositRequestAction`) ouvre d'abord un écran d'édition admin obligatoire D55 (frais accessoires modifiables + édition contrat Tiptap libre — pas de seuil 1 500 € HT). Au clic « Envoyer » :
  - Slot reste 🟠 (status interne `contract_payment_sent`).
  - Autres options du slot → `lost_other_won` + email dates alternatives.
  - Génération contrat PDF (template ContractTemplate + clause D53 par défaut).
  - Génération facture acompte PDF.
  - Création Stripe Checkout Session.
  - Envoi email au client validé avec contrat à signer (DocuSeal) + lien paiement (Stripe).
- Le slot passe 🔴 **uniquement après** le 2ème clic manuel Will "Valider sur le calendrier" (D49 — Server Action `validateBookingOnCalendarAction`), qui réalise la transition `awaiting_admin_validation → confirmed` (D51).

### D38 — Frais accessoires modélisés en DB

- 3 modes configurables par format dans `PricingConfig.feesMode` :
  - `real_costs` — saisie admin + scan justificatifs (par défaut).
  - `flat_rate_by_zone` — 0 € IDF / 250 € FR métro / 450 € DOM-TOM (modifiables admin).
  - `included` — pas de ligne séparée (prix catalogue inclut frais).
- Champs Booking : `travelFeeCents`, `accommodationFeeCents`, `mealFeeCents`, `additionalFeesCents`, `additionalFeesNotes`.
- Facture affichage : lignes séparées + sous-total + TVA + total.

### D39 — Géo-awareness intelligent

- API OSM Nominatim (gratuite) pour géocoding ville.
- Haversine pour distance entre villes.
- Pour `audit_flash_onsite` et interventions on-site :
  - Distance > 600 km à J-2/J-1/J+1/J+2 → slot 🟡 « Logistique impossible » non cliquable.
  - 300-600 km → cliquable + alerte Telegram Will.
  - < 300 km → OK.
- Will peut override depuis admin si « train de nuit possible ».

### D40 — Échéancier configurable par taille de ticket + override par booking

- Table `PaymentScheduleProfile` : 4 profils par défaut (seuils 1500/5000/15000), modifiables admin.
- À la validation Will, échéancier dérivé auto du `Booking.amountHtCents` + profil correspondant.
- Override par booking via `BookingPaymentSchedule.overrideReason` + snapshot custom.
- Politique par défaut :
  - ≤ 1 500 € HT : 100 % à validation, dû sous 7j.
  - 1 500 - 5 000 € HT : 50 % validation (14j) + 50 % J-7 avant prestation (7j).
  - 5 000 - 15 000 € HT : 30 % validation (14j) + 30 % J-7 (7j) + 40 % J+30 (30j).
  - > 15 000 € HT : 30 % + 30 % + 40 % OU mensuel contractuel.
- Nouveaux clients sans historique → flag admin « Forcer 100 % avant prestation » (override).

### D41 — Pas Qualiopi / pas OPCO V1 (confirmé)

- Pas de table TrainingSession/Attendance/Evaluation/Certificate V1.
- Hook `Booking.trainingSessionId` nullable + `Invoice.payerType` enum avec `client` default V1.
- Interventions = prestations conseil B2B, **non considérées formation pro réglementée**.

### D42 — Stripe Checkout V1 + mode hybride manuel

- Stripe Checkout pour paiement par défaut.
- Customer Portal Stripe activé (D18) — self-service factures.
- **Aussi possible enregistrer paiement manuel** (virement/chèque/CB hors-Stripe) depuis admin avec audit log complet.
- `Payment.provider` enum : `stripe | manual_wire | manual_check | manual_cash`.

### D43 — Système email maison existant — pas nouveau service

- Phase 0 confirme : Nodemailer + PowerMTA + Mailwizz **déjà installés et fonctionnels**.
- ~30 templates V1 à créer dans `src/emails/` (compris dans Sprint X.13 + X.5bis pour 5 templates parcours B).

### D44 — 2 parcours visiteur distincts A (calendrier) vs B (devis qualifié) — post-`UX-E2E-VERIFICATION.md`

- **Parcours A — Format SANS devis** : formats à tarif fixe (`audit_flash_onsite`, conférences, catalogue ≤ 5 000 € HT) → `/reserver` calendrier 5 statuts → `BookingOption` → validation Will → trigger AUTO contrat + facture + Stripe + email unifié.
- **Parcours B — Format AVEC devis** : formats > 5 000 € HT, IA Custom (8-50 k€), packs annuels, transformation collective sur-mesure → **route dédiée `/demande-devis`** (FR) / `/request-quote` (EN) → formulaire qualifié → `Submission(type='quote_request', status='new')` → négociation hors-app Will/client (téléphone, email, 2-4 semaines) → drawer admin unifié → envoi unifié devis + contrat + lien paiement.
- DB : `Booking.originPath` enum `direct` / `quote_negotiation` + `Booking.fromSubmissionId` FK nullable. Extension enum `SubmissionType` (ajout `quote_request`) + nouveau enum `SubmissionStatus` (`new/qualifying/negotiating/converted/lost/archived`).

### D45 — Pas de slot calendrier réservé pendant la négo B

- La `Submission` parcours B reste « ouverte » sans bloquer de slot tant que `createBookingFromSubmissionAction` (A16) n'est pas appelée. Will peut visualiser/positionner mentalement les slots dans le drawer §5.11.3.bis, mais le blocage formel (🔴) n'a lieu qu'à l'envoi final.
- Évite slots fantômes pendant négo (2-4 sem.) qui pénaliseraient le parcours A.

### D46 — Will crée manuellement le Booking parcours B via Server Action

- `createBookingFromSubmissionAction(submissionId, slots[], amountHt, scheduleProfile|customInstallments[], fees, vatRate, vatReverseCharge, contractDraftTiptap, quoteDraftTiptap)` (A16).
- Matérialise sortie de négo : crée `Booking` (`originPath='quote_negotiation'`, `fromSubmissionId=id`) + bloque `slots[]` + crée `Quote` (DocuSeal) + `ContractDocument` (DocuSeal) + `Invoice deposit` + Stripe Checkout Session + envoi email unifié `contract-sent-with-deposit-link`.
- Marque `Submission.status='converted'`.

### D47 — Drawer admin unifié parcours B

- Route `/admin/demandes-devis/[submissionId]` — Drawer Radix Sheet plein-écran.
- Sections : récap soumission (read-only) / pipeline statut (toggle) / notes négo (Tiptap libre) / slot picker multi-slots / montant + 4 frais accessoires / échéancier (profil ou custom) / TVA (FR/EE) / éditeur Tiptap contrat préremplé / éditeur Tiptap devis préremplé / bouton « Envoyer devis + contrat + lien paiement ».
- Action SSOT `createBookingFromSubmissionAction`. `super_admin` only si montant > 15 000 € HT.

### D48 — Crons spécifiques parcours B

- **Job #21 `negotiation-stalled-reminder`** (`0 8 * * *`) : Telegram Will à J+7/J+14/J+30 si `Submission(type='quote_request', status IN ('qualifying','negotiating'))` inactive depuis > 7j. Email visiteur uniquement à J+30 (« Devis encore d'actualité ? »).
- **Job #22 `contract-signed-without-deposit-reminder`** (`0 9 * * *`) : relance client + Telegram Will à J+3/J+7/J+14 si Booking `contract_signed && deposit_pending`. À J+14 → flag candidat auto-expire.

### D49 — Validation calendrier en 2 clics distincts

- **Clic 1** dans `/admin/demandes` parcours A = **"Envoi contrat + demande acompte"** (renommage Server Action `validateBookingOptionAction` → `sendContractAndDepositRequestAction`). Plus de bouton générique "Valider" pour éviter toute confusion.
- **Clic 2** dans section dashboard "Prêts à valider" = **"Valider sur le calendrier"** (nouvelle Server Action `validateBookingOnCalendarAction`). Réalise la transition `awaiting_admin_validation → confirmed` + slot 🔴 + email final client `booking-validated-on-calendar`.

### D50 — Critère bloquant unique = paiement acompte reçu

- Le **paiement acompte reçu** (webhook Stripe OU saisie virement admin) est le seul critère qui débloque le passage à `awaiting_admin_validation`.
- Le **contrat signé n'est PAS bloquant** : si pas signé via DocuSeal au moment du clic Will, la signature physique se fait le jour J de l'intervention. Badge ⚠️ "Contrat à signer le jour J" dans console admin pour rappel.

### D51 — État intermédiaire `awaiting_admin_validation` ajouté à BookingStatus

- Inséré entre `contract_payment_sent` (ou `deposit_pending`) et `confirmed`.
- Transition `contract_payment_sent → awaiting_admin_validation` **automatique** dès webhook Stripe acompte reçu (ou `recordManualPaymentAction`).
- Transition `awaiting_admin_validation → confirmed` **manuelle** par Will via clic "Valider sur le calendrier" (D49).
- Slot reste 🟠 tant que `awaiting_admin_validation`.

### D52 — Délais d'expiration configurables depuis admin

- 2 clés `SiteSetting`, éditables depuis `/admin/parametres-delais` :
  - `optionExpirationDaysIfNothingReceived` (défaut **5 jours**) — si ni signature ni paiement reçu après envoi contrat+demande acompte.
  - `contractSignedWithoutDepositCutoffDays` (défaut **10 jours**) — si contrat signé mais acompte non payé (clause CGV D53 invoquée).
- Audit log obligatoire à chaque modification.

### D53 — Clause contractuelle par défaut dans ContractTemplate

- Nouvelle colonne `ContractTemplate.defaultLegalClauses JSONB`, insérée automatiquement dans chaque contrat généré, modifiable Will avant envoi (Tiptap) :
  > _"Article — Résolution pour défaut de paiement. Le présent contrat sera résolu de plein droit, sans formalité ni mise en demeure, en cas de non-paiement de l'acompte dans un délai de 10 jours suivant sa signature électronique. La date de prestation sera alors libérée."_

### D54 — Notifications Will = Telegram + console admin UNIQUEMENT (pas d'email Will)

- Aucun email vers Will pour les événements opérationnels du workflow booking.
- Couverture : nouvelle demande A, nouvelle demande devis B, contrat signé reçu, acompte payé reçu, booking prêt à valider sur calendrier, expiration imminente (J-1 du seuil D52), conflit géo (D39).

### D55 — Saisie admin obligatoire avant envoi contrat parcours A

- Écran d'édition entre clic "Envoi contrat + demande acompte" et envoi effectif :
  - Frais accessoires (déplacement / hôtel / repas / divers) — modifiables.
  - Contrat éditable Tiptap (template pré-rempli avec D53, modifications libres).
  - **PAS de seuil >1 500 € HT** — le contrat est toujours éditable.
- Symétrique parcours B (déjà couvert par drawer admin unifié D47).

### D56 — Customer Portal Stripe RETIRÉ V1

- Factures envoyées par email en pièce jointe PDF uniquement.
- Pas de page self-service Stripe billing pour V1. Économie ~0,5j ingé.
- Hook V2+ préservé via `Payment.providerCustomerId`.

### D57 — NPS J+1 RETIRÉ V1

- Pas de cron `booking-j1-debrief`, pas de template NPS, pas de table `NpsResponse`.
- Économie ~0,5j ingé. À reconsidérer V1.5+.

### D58 — Onboarding docs RETIRÉ V1

- Pas de Sprint dédié onboarding-docs, pas de table `OnboardingDoc` créée V1 (hook DB préservé optionnel pour V1.5+).
- V1.5+ : formulaire structuré (pas upload fichiers libre).
- V1 : géré hors-app par email. Économie ~1-2j ingé.

### D59 — Échec paiement échéance 2/3 traité (itération ULTIME 2026-05-12 nuit, cf. `ULTIMATE-AUDIT.md`)

- Ajout états `installment_overdue` (J+30 retard 2ème/3ème échéance) + `disputed` (J+45 état terminal recouvrement hors-app par Will) à `BookingStatus`.
- Cron `installment-overdue-escalation` quotidien : J+3 email soft `installment-overdue-soft` ; J+15 email ferme `installment-overdue-firm` + Telegram Will ; J+30 flip `installment_overdue` ; J+45 flip `disputed` + email `installment-disputed-notice`.
- 3 nouveaux templates V1. Sprint X.4 + X.12 + X.13. Effort +0,5j.

### D60 — Drag-drop reschedule admin matérialisé

- Server Action `rescheduleBookingByAdminAction(bookingId, newSlotIds[], reason, notifyClient: bool)`.
- Restriction de statut : autorisé si `Booking.status ∈ {contract_payment_sent, awaiting_admin_validation, confirmed, paused}` — refusé sinon.
- Audit log obligatoire. Template `booking-rescheduled-by-admin` (#52) avec nouveau `.ics`.
- Sprint X.9 effort +0,5j (3-4j → 4-5j).

### D61 — Suspension booking `paused`

- Statut `paused` ajouté à `BookingStatus` + colonnes `Booking.pausedAt`/`pausedUntil`/`pauseReason`.
- 2 Server Actions : `pauseBookingAction(bookingId, untilDate, reason)` (libère slots associés) + `resumeBookingAction(bookingId, newSlotIds[])` (rebloque nouveaux slots).
- Cron `paused-resume-reminder` : Telegram Will à `pausedUntil - 7j` / `- 1j` / `pausedUntil`.
- 2 templates : `booking-paused-confirmation` (#53) + `booking-resumed-notification` (#54).
- Sprint X.4 + X.12 + X.13. Effort +0,5j.

### D62 — Versioning contrat post-envoi

- Server Action `cancelAndReissueContractAction(contractId, newDraftTiptap, reason)` : **avant signature uniquement**. Annule v1 (`ContractDocument.status='cancelled_admin'`) + crée v2 + DocuSeal + email client.
- Server Action `createContractAddendumAction(bookingId, addendumDraftTiptap)` : **après signature uniquement**. Contrat principal signé reste **immuable (légal)** ; tout changement passe par avenant `ContractDocument(isAddendum=true, previousVersionId=signedContract.id)` séparé.
- Colonnes `ContractDocument.version` (Int default 1) + `previousVersionId` (FK self nullable) + `isAddendum` (Boolean default false).
- Enum `ContractStatus.cancelled_admin` ajouté.
- Template `contract-version-updated` (#55).
- Sprint X.3 + X.13. Effort +0,5j.

### D63 — Migration data V0 → V1 obligatoire Sprint X.4

- Script `scripts/migrate-bookings-v0-to-v1.ts` idempotent.
- Mapping : `pending → option_pending`/`cadrage_scheduled` selon `slotId` ; `confirmed (passé) → archived` + `Payment(isHistorical=true)` + `Invoice(isHistorical=true)` rétroactifs ; `confirmed (futur) → confirmed` + Payment/Invoice rétroactifs ; `cancelled → cancelled_by_admin` ; `postponed → drop`.
- Test sur snapshot dev avant prod (dump Postgres → restore staging → run → diff verification).
- Audit log `BookingTransition.trigger='migration.v0_to_v1'` obligatoire.
- Backup Hetzner < 1h avant run prod + rollback plan documenté.
- Colonne `Payment.isHistorical` ajoutée pour distinguer paiements rétrofittés.
- Sprint X.4. Effort +0,5j.

### V1.5 prévu — Versioning CGV par booking (NON BLOQUANT V1)

- Chaque booking porte une référence à la version CGV en vigueur à sa création (`Booking.cgvVersionAtSigning Int` + `Booking.cgvSnapshot JSONB`), immuable une fois booking confirmé.
- Pour V1 : version CGV courante seulement (pas de snapshot). Tous les bookings se réfèrent à la version « live » de `legal.ts`.
- Tradeoff V1 : si Will modifie CGV après booking confirmé, le client perd la version originale. Acceptable en B2B avec faible volume V1 (Will peut sauvegarder versions PDF hors-app si litige).
- À implémenter V1.5+ : ajout colonnes + helper `getCgvVersionFor(bookingId)` + UI admin pour gérer historique versions.
- Couvert dans `ULTIMATE-AUDIT.md` F6 (P1 — pas P0).

---

## 2. Décisions RESTANTES à trancher Will avant Sprint X.0

### Q1 — Provider visio cadrage V1 (D10)

**Question** : Outil pour les calls de cadrage 30 min ?

- **Option A** — Lien manuel par email (Google Meet, Whereby, Zoom — Will copie/colle au cas par cas) — V1 minimum.
- **Option B** — Whereby intégré (~€10-15/mois, sans création de compte client).
- **Option C** — Jitsi Meet self-hosted (gratuit, Docker, ops + RAM).

**Reco audit** : Option A V1 (pragmatique, zéro intégration). Whereby V1.5 si Will veut un lien généré auto.

**À confirmer** : A / B / C.

### Q2 — Structure juridique FR vs EE (D15)

**Question** : Société FR (SAS/SARL/EI) ou OÜ Estonie ?

- L'audit pose une architecture **TVA-agnostique** : `vatRate` + `vatReverseCharge` + `vatMention` paramétrables.
- N'attend PAS pour démarrer le code V1.
- N'attend PAS Sprint X.0.
- Doit être tranché **avant Sprint X.17** (Conformité légale) pour finaliser `legal.ts`.

**Reco audit** : décider en parallèle des sprints X.1-X.16, le plus tard possible à Sprint X.17.

**À confirmer** : FR / EE / encore en réflexion (décide plus tard).

### Q3 — PDF moteur (D31)

**Question** : Quel moteur pour générer PDF (factures, contrats, devis) ?

- **Option A** — `react-pdf` (programmatique, léger ~200KB, support multi-langue, contrôle pixel).
- **Option B** — Puppeteer + Chromium (HTML→PDF, plus flexible visuellement, plus lourd ~150MB).
- **Option C** — `@react-email/render` HTML + Puppeteer (hybride : templates Tiptap → HTML → PDF).

**Reco audit** : Option A pour MVP (léger, rapide, prévisible). Option C si Will veut un rendu typographique premium (utile pour contrats à fort enjeu image).

**À confirmer** : A / B / C.

### Q4 — Storage PDF (factures + contrats signés + devis)

**Question** : Stockage des PDF (factures + contrats signés DocuSeal + devis signés DocuSeal) ?

- **Option A** — Cloudflare R2 (S3-compatible, US-EU, ~€0,015/GB/mois, généreux egress).
- **Option B** — Hetzner Storage Box (DE, ~€3/mois 1TB, snapshots auto, déjà dans ton infra).

**Périmètre V1** : uniquement les **PDF factures / contrats / devis** générés par l'app. Les **onboarding docs sont RETIRÉS V1 (D58)** — gestion hors-app par email pour V1, formulaire structuré V1.5+ (pas upload fichiers libre).

**Reco audit** : Option B (Hetzner Storage Box) — souveraineté DE/UE, déjà dans ton stack, intégration simple, archivage 10 ans confortable.

**À confirmer** : A / B.

### Q5 — Drag & drop calendrier admin (Agent 5)

**Question** : Drag-drop reschedule depuis l'admin V1 ?

- Coût : ~1j supplémentaire + complexité transactions multi-slots.
- Bénéfice : UX power-user (Will réorganise rapidement).

**Reco audit** : V1 minimal (drag-drop simple, 1 slot à la fois, audit log). V2+ bulk operations.

**À confirmer** : V1 / V1.5 / V2+.

### Q6 — Refunds automatiques vs manuel admin (Agent 4)

**Question** : Annulation client J-15 → 50 % refund acompte (D6) auto ou manuel ?

- **Option A** — Auto via cron `refund-trigger` (annulation déclenche refund Stripe API).
- **Option B** — Manuel : Will marque « refund à émettre » + bouton refund 1-clic dans admin.
- **Option C** — Hybride : auto pour <500 €, manuel >500 €.

**Reco audit** : Option B V1 (Will garde la main, évite refunds par erreur), Option A V1.5.

**À confirmer** : A / B / C.

### Q7 — J+1 debrief NPS (cron `booking-j1-debrief`) — **RETIRÉ V1, D57**

**Question** : Email auto J+1 invitant à un mini-NPS ?

- Coût : ~0,5j (template + cron + table `NpsResponse` simple).
- Bénéfice : témoignages, scores satisfaction, signals retention.

**Décision Will 2026-05-12 (D57)** : **RETIRÉ V1** — pas de cron `booking-j1-debrief`, pas de template NPS. Économie ~0,5j ingé. À reconsidérer V1.5+ si Will veut industrialiser les témoignages.

**Statut** : tranché — V1.5+ (pas V1).

### Q8 — Admin EN bilingue (Agent 2)

**Question** : Console admin FR seulement V1 ou bilingue FR+EN ?

- Coût : ~1j i18n admin.
- Bénéfice : si Will collabore avec freelance/partenaire anglophone.

**Reco audit** : FR only V1, bilingue V1.5 si besoin émerge.

**À confirmer** : FR only V1 / bilingue V1.

### Q9 — Liste fermée secteurs sensibles (NDA auto — D12)

**Question** : Pour quels secteurs un NDA est-il auto-déclenché ?

- Liste proposée : `finance, santé, défense, aéronautique, énergie, télécom, juridique`.

**Reco audit** : liste fermée enum + champ `companySector` côté formulaire. Will peut override depuis admin.

**À confirmer** : liste OK / ajouter d'autres / NDA seulement manuel (pas d'auto V1).

### Q10 — Acompte par défaut par format

**Question** : Quel % acompte par défaut V1 ?

- Audit flash 890 € : 100 % à validation (cas ≤ 1 500 € HT D40).
- Conférences ≤ 5 000 € : 50/50 (D40).
- Interventions 5 000-15 000 € : 30/30/40 (D40).
- Interventions > 15 000 € : 30/30/40 ou mensuel.

**Reco audit** : appliquer D40 par défaut, ajuster par format depuis admin si besoin.

**À confirmer** : OK D40 / autre tableau ?

---

## 3. Bloquants externes Will (action humaine, hors code)

1. **DPA Stripe** (signature en ligne dashboard Stripe ~30 min).
2. **DPA Hetzner papier** (déjà en cours).
3. **Compte Stripe live + KYB validé** (~quelques jours selon dossier).
4. **DocuSeal self-hosted** : pas de DPA tiers (auto-hébergé sur Hetzner) — gain procédural.
5. **Boîte `dpo@axion-ia.com`** opérationnelle (cf. mémoire Sprint 24.1).
6. **DMARC/DKIM/SPF prod** vérifiés (cf. Agent 7 `[À VÉRIFIER]`).

---

## 4. Notes audit

**Auto-pilot a appliqué les défauts D1-D32** + nouvelles décisions Will D33-D43 + corrections post-`UX-E2E-VERIFICATION.md` D44-D48 + itération finale D49-D58 + **itération ULTIME D59-D63** (voir ci-dessus).

**Restent 10 questions ouvertes** (Q1-Q10) pour Sprint X.0 (Will tranche en 30-45 min lors d'une revue dédiée).

**P2 différés (cf. `UX-E2E-VERIFICATION.md` §1)** :

- P2-1 : Pas de timeline « durée moyenne négo B » dans dashboard admin (V1.5 — peut être dérivé statistiquement de `Submission.createdAt` vs `Submission.status='converted'`).
- P2-2 : Pas de tag UTM persisté sur `Submission` en mode devis (V1.5 — déjà couvert par Sprint X.18 `Submission.details.utmSource/Medium/Campaign`).
- P2-3 : Pas d'export CSV séparé A vs B pour comptabilité (V1.5 — l'export X.10 actuel fusionne A+B, distinction via colonne `originPath` si besoin).

---

## 5. Recommandation de workflow

1. Will lit `🚨-NO-GO-ALERT.md` (5 min — verdict + voies).
2. Will lit `SYNTHESE-FINALE.md` (10 min — vue d'ensemble).
3. Will tranche Q1-Q10 (45 min — review dédiée).
4. Will signe DPA Stripe en ligne (15 min).
5. Will démarre Sprint X.0 (Foundation décisions + bootstrap dev) — 0,5j Will + 1j dev.
6. Sprints X.1 → X.20 enchaînés selon DAG (cf. `04-PLAN-EXECUTION.md`).

**Total V1** : **~54-60 j ingé** sur **10-12 semaines** avec 1 dev plein temps (bilan post-itération ULTIME D59-D63 : ajouts +2-3j absorbés dans sprints existants X.3 + X.4 + X.9 + X.12 + X.13 ; vs ~52-58 j de la V2.2 post-D49-D58).
