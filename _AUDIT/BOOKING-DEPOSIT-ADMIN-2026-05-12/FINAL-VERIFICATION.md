# FINAL-VERIFICATION — Audit Booking Deposit-Validation-Gated V2.2 (post-itération Will D49-D58)

> Vérification finale post-corrections 2026-05-12.
> Mode AUDIT-ONLY. HEAD `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742`.
> Périmètre : confronter les 6 livrables V2 (`MANIFEST`, `SYNTHESE-FINALE`, `🚨-NO-GO-ALERT`, `STOP-AND-ASK`, `03-ARCHITECTURE-CIBLE`, `04-PLAN-EXECUTION`) à la vision V1 finale post-itération Will 2026-05-12 (D49→D58 ajoutées).

---

## Section 1 — Résumé exécutif

État global : ✅ **COMPLET**

| Métrique                                   | Valeur                                                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Décisions Will nouvelles ajoutées          | **10** (D49 → D58)                                                                                                                                                                                   |
| Corrections fichier par fichier appliquées | **A. MANIFEST** : 4 ; **B. STOP-AND-ASK** : 5 ; **C. SYNTHESE-FINALE** : 6 ; **D. NO-GO-ALERT** : 3 ; **E. 03-ARCHITECTURE-CIBLE** : 11 ; **F. 04-PLAN-EXECUTION** : 13 — Total ≈ **42 corrections** |
| Total corrections prévues (cf. prompt)     | ≈ 41 corrections                                                                                                                                                                                     |
| Incohérences résiduelles détectées         | 0 (chiffres alignés ; références cross-fichiers cohérentes)                                                                                                                                          |
| Mode AUDIT-ONLY respecté                   | ✅ — 0 code, 0 git, 0 pnpm, 0 POST ; modifications limitées aux 6 fichiers V2 + écriture `FINAL-VERIFICATION.md`                                                                                     |

---

## Section 2 — Diagrammes finaux parcours A et B (validés)

### Parcours A — Format SANS devis (calendrier direct, validation 2 clics D49)

```
1.  Visiteur → /reserver?intervention=<slug>&city=<v>
                  (calendrier 5 statuts : 🟢🟠🟡🔴 visiteur + ⚫ admin invisible visiteur)
2.  Formulaire + accepte CGV
3.  Submit → createBookingOptionAction (V1)
        → BookingOption(status='pending_validation')
        → Email visiteur "Demande reçue, William sous 24-48h" + Telegram + console admin Will (D54)
4.  Will → /admin/demandes ─── CLIC 1 "Envoi contrat + demande acompte" (D49)
                                  ▼
                          ┌──────────────────────────────────────────────┐
                          │ ÉCRAN SAISIE ADMIN OBLIGATOIRE (D55)         │
                          │ • Frais accessoires modifiables (4 lignes)   │
                          │ • Édition contrat Tiptap libre               │
                          │   (template + defaultLegalClauses D53)       │
                          │ • PAS de seuil 1 500 € HT — toujours éditable│
                          └──────────────────────────────────────────────┘
                                  ▼ clic "Envoyer"
        → sendContractAndDepositRequestAction (A1 renommée D49)
        TRIGGER AUTO :
        • Slot RESTE 🟠 (status `contract_payment_sent`)
        • Autres options du slot → 'lost_other_won' + email dates alternatives
        • Contrat PDF généré (template + clauses D53) + envoi DocuSeal
        • Facture acompte PDF générée
        • Stripe Checkout Session créée
        • Email client : contrat (DocuSeal) + lien paiement (Stripe)
        • Telegram + console admin Will (D54 — pas d'email Will)
5.  [Client signe contrat DocuSeal (webhook) — PAS bloquant D50]
6.  Client paie acompte (Stripe webhook OU virement manuel saisi admin)
        → AUTO transition `contract_payment_sent → awaiting_admin_validation` (D51)
        → Slot reste 🟠 + Telegram + console admin Will "Booking prêt à valider"
7.  Will → Dashboard "Prêts à valider" ─── CLIC 2 "Valider sur le calendrier" (D49)
        → validateBookingOnCalendarAction (A1bis nouvelle D49)
        → Transition `awaiting_admin_validation → confirmed`
        → SLOT BASCULE 🔴
        → Email final client `booking-validated-on-calendar` (D49)
8.  Booking confirmé (originPath='direct')
9.  Crons : J-7 facture solde, J-1 reminder (PAS de NPS J+1 — retiré V1 D57)
10. Prestation (signature physique contrat le jour J si non signé DocuSeal D50)
11. Facture solde envoyée par email PJ uniquement (D56), paiement reçu, archivé
```

### Parcours B — Format AVEC devis (formulaire qualifié + négo hors-app)

```
1.  Visiteur → /interventions/ia-custom OU /interventions/transformation-collective (hub)
2.  Clic CTA → /demande-devis?intervention=<slug> (FR) ou /request-quote (EN)
3.  Formulaire qualifié (10-12 champs)
4.  Submit → submitQuoteRequestAction (V4 D44)
        → Submission(type='quote_request', status='new', details=<formData>)
        → AUCUN slot calendrier réservé (D45)
        → Email visiteur `quote-request-received` (#31)
        → Telegram + console admin Will (D54)
5.  NÉGOCIATION HORS-APP (téléphone, email, 2-4 sem.)
        → Will tracking via updateSubmissionDraftAction (A17)
        → Submission.status : new → qualifying → negotiating
6.  Will → /admin/demandes-devis → clic "Convertir en Booking"
        → ouvre Drawer parcours B (D47, §5.11.3.bis)
7.  Will saisit dans drawer admin unifié :
        • Slot picker multi-slots (1..N)
        • Montant total HT + 4 frais accessoires
        • Échéancier (profil dérivé OU custom)
        • TVA + reverseCharge selon legal.ts (FR/EE)
        • Tiptap CONTRAT préremplé (template + clauses D53)
        • Tiptap DEVIS préremplé
8.  Clic "Envoyer devis + contrat + lien paiement"
        → createBookingFromSubmissionAction (A16 D44+D46)
        → Booking créé (originPath='quote_negotiation', fromSubmissionId)
        → Slots[] → 🟠 (contract_payment_sent)
        → Quote (DocuSeal) + ContractDocument (DocuSeal) + Invoice deposit + Stripe Checkout Session
        → Email UNIFIÉ `contract-sent-with-deposit-link` (#33) au client
        → Submission.status='converted'
9.  [Client signe devis + contrat DocuSeal — non bloquant D50]
10. Client paie acompte Stripe
        → AUTO transition `contract_payment_sent → awaiting_admin_validation` (D51)
        → Slot reste 🟠 + Telegram + console admin Will
11. Will → Dashboard "Prêts à valider" → clic 2 "Valider sur le calendrier" (D49)
        → validateBookingOnCalendarAction (A1bis)
        → SLOT BASCULE 🔴 + email `booking-validated-on-calendar` (variante B `booking-confirmed-after-negotiation` #34)
12. Crons J-7 / J-1 / prestation / facture solde email PJ D56 / archivé.
```

Note : les 2 parcours **convergent** à partir de l'état `awaiting_admin_validation` (D51) — même 2ème clic Will, même slot 🔴, même cycle de vie post-confirmation.

---

## Section 3 — State machine finale (D51 intégré)

```
                                ┌─────────────┐
                                │  draft (UI) │  visiteur remplit form
                                └──────┬──────┘
                                       ▼ submit
                                ┌────────────────────┐
                                │  option_pending    │  multi-options cap=3
                                └─────────┬──────────┘
                                          │ ou direct via Submission B
                                          ▼
                                ┌────────────────────┐
                                │ cadrage_scheduled  │  (skip si audit_flash_onsite OU parcours B)
                                └─────────┬──────────┘
                                          ▼
                                ┌────────────────────┐
                                │  cadrage_held      │
                                └─────────┬──────────┘
                                          ▼ POSITIVE
                                ┌────────────────────────┐
                                │  contract_pending      │  (saisie admin D55 obligatoire)
                                └─────────┬──────────────┘
                                          │ clic Will 1 "Envoi contrat + demande acompte" (D49)
                                          ▼
                                ┌────────────────────────┐
                                │ contract_payment_sent  │  Slot 🟠
                                │ DocuSeal envoyé +      │
                                │ Stripe Checkout actif  │
                                └─────────┬──────────────┘
                                          │ webhook Stripe acompte reçu (D50)
                                          │ OU virement manuel admin
                                          ▼
                                ┌────────────────────────────┐
                                │ awaiting_admin_validation  │  Slot 🟠 (D51)
                                │ Badge ⚠️ "Contrat à signer  │
                                │ le jour J" si pas signé    │
                                │ DocuSeal (D50 non bloquant) │
                                └─────────┬──────────────────┘
                                          │ clic Will 2 "Valider sur le calendrier" (D49)
                                          ▼
                                ┌────────────────────┐
                                │     confirmed      │  SLOT 🔴
                                │ Email final client │
                                │ booking-validated- │
                                │ on-calendar (D49)  │
                                └─────────┬──────────┘
                                          ▼
                              ┌─────► reminded_j7 ───► in_progress ───► completed
                              │       (cron J-7)       (cron J 00h)    (cron OU admin —
                              │                                          NPS J+1 retiré D57)
                              │                                                  ▼
                              │                                          invoiced_balance ───► paid_balance ───► archived
                              │
   BRANCHES TRANSVERSALES :
   • Cron `option-expiration-rien-recu` (D52, default 5j) si ni signature ni paiement
        → contract_payment_sent → cancelled_by_admin + email visiteur `option-expired-no-response`
   • Cron `contract-signed-without-deposit-cancel` (D52, default 10j) si contrat signé sans acompte
        → cancelled_by_admin + invocation clause D53 + libération slot
   • cancelled_by_user (magic-link) ; cancelled_by_admin (manuel) ; no_show ; force_majeure ;
     refunded_partial / refunded_full ; lost_other_won
```

**~23 valeurs effectives V1** dans `BookingStatus` (incl. ajout `awaiting_admin_validation` D51).

---

## Section 4 — Tableau notifications Will (D54)

| Événement                                                        | Email Will | Telegram Will | Console admin |
| ---------------------------------------------------------------- | :--------: | :-----------: | :-----------: |
| Nouvelle demande A (`BookingOption pending_validation`)          |     ❌     |      ✅       |      ✅       |
| Nouvelle demande devis B (`Submission quote_request status=new`) |     ❌     |      ✅       |      ✅       |
| Contrat signé DocuSeal reçu                                      |     ❌     |      ✅       |      ✅       |
| Acompte payé reçu (Stripe webhook OU virement)                   |     ❌     |      ✅       |      ✅       |
| Booking prêt à valider (`status=awaiting_admin_validation`)      |     ❌     |      ✅       |      ✅       |
| Expiration imminente (J-1 du seuil D52)                          |     ❌     |      ✅       |      ✅       |
| Conflit géographique (D39)                                       |     ❌     |      ✅       |      ✅       |

✅ **D54 respectée** : pas d'email Will. Telegram + console admin uniquement.

---

## Section 5 — Délais configurables admin + crons V1 (D52)

### Délais configurables (clés `SiteSetting` — modifiables depuis `/admin/parametres-delais`)

| Clé                                      |      Default | Description                                                                                     | Cron concerné                                             |
| ---------------------------------------- | -----------: | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `optionExpirationDaysIfNothingReceived`  |  **5 jours** | Annulation auto si ni signature DocuSeal ni paiement reçu après envoi contrat + demande acompte | `option-expiration-rien-recu` (job #24)                   |
| `contractSignedWithoutDepositCutoffDays` | **10 jours** | Résolution de plein droit (clause D53) si contrat signé mais acompte non payé                   | `contract-signed-without-deposit-cancel` (job #22bis/#23) |

### Liste des ~21 crons V1

| #        | Cron                                             | Cadence        | Statut V1                          |
| -------- | ------------------------------------------------ | -------------- | ---------------------------------- |
| 1        | `payment-deposit-expiration`                     | `*/15 * * * *` | ✅                                 |
| 2        | `payment-deposit-reminder-j1`                    | `0 9 * * *`    | ✅                                 |
| 3        | `payment-deposit-reminder-j2`                    | `0 9 * * *`    | ✅                                 |
| 4        | `cadrage-reminder-j1`                            | `0 9 * * *`    | ✅                                 |
| 5        | `cadrage-reminder-h2`                            | `0 * * * *`    | ✅                                 |
| 6        | `quote-expiration`                               | `0 4 * * *`    | ✅                                 |
| 7        | `quote-reminder-j3`                              | `0 4 * * *`    | ✅                                 |
| 8        | `contract-expiration`                            | `0 4 * * *`    | ✅                                 |
| 9        | `contract-reminder-j2`                           | `0 4 * * *`    | ✅                                 |
| 10       | `booking-j7-balance-invoice`                     | `0 5 * * *`    | ✅                                 |
| 11       | `booking-j1-reminder`                            | `0 9 * * *`    | ✅                                 |
| 12       | `booking-j0-checkin`                             | `0 8 * * *`    | ✅                                 |
| 13       | `booking-completion-auto`                        | `0 19 * * *`   | ✅ (renommé — pas de NPS D57)      |
| ~~14~~   | ~~`booking-j1-debrief`~~                         | —              | ❌ RETIRÉ V1 (D57)                 |
| 15       | `invoice-overdue-j15`                            | `0 6 * * *`    | ✅                                 |
| 16       | `invoice-overdue-j30`                            | `0 6 * * *`    | ✅                                 |
| 17       | `refund-trigger`                                 | `0 7 * * *`    | ✅                                 |
| 18       | `webhook-dlq-retry`                              | `*/5 * * * *`  | ✅                                 |
| 19       | `capacity-recompute`                             | `0 0 * * *`    | ✅                                 |
| 20       | `geo-conflict-alert`                             | `0 7 * * *`    | ✅                                 |
| 21       | `negotiation-stalled-reminder` (D48 parcours B)  | `0 8 * * *`    | ✅ NOUVEAU                         |
| 22       | `contract-signed-without-deposit-reminder` (D48) | `0 9 * * *`    | ✅ NOUVEAU                         |
| 22bis/23 | `contract-signed-without-deposit-cancel` (D52)   | `0 9 * * *`    | ✅ NOUVEAU — annulation auto à 10j |
| 24       | `option-expiration-rien-recu` (D52)              | `0 9 * * *`    | ✅ NOUVEAU — annulation à 5j       |

Total V1 = **~21 jobs cron** (numérotation flottante 1-24 selon ordre d'apparition Sprint X.12 ; `booking-j1-debrief` #14 retiré ; jobs D52 #22bis/23 + #24 ajoutés).

---

## Section 6 — Cohérence finale cross-files

Vérification d'alignement des chiffres référentiels dans les 6 fichiers V2 :

| Chiffre référentiel                                              | MANIFEST | SYNTHESE | NO-GO |       STOP-ASK       |        03-ARCH        |     04-PLAN      | Verdict |
| ---------------------------------------------------------------- | :------: | :------: | :---: | :------------------: | :-------------------: | :--------------: | :-----: |
| Total V1 (~52-58 j ingé)                                         |    ✅    |    ✅    |  ✅   |          ✅          | n/a (chiffré 04-PLAN) |        ✅        |   ✅    |
| Délai (10-12 semaines)                                           |    ✅    |    ✅    |  n/a  |          ✅          |          n/a          |        ✅        |   ✅    |
| Sprints (20 V1 incl. X.5bis)                                     |    ✅    |    ✅    |  ✅   | n/a (renvoi 04-PLAN) |          n/a          |        ✅        |   ✅    |
| Tables (16 nouvelles)                                            |    ✅    |    ✅    |  n/a  |         n/a          |          ✅           |        ✅        |   ✅    |
| BookingStatus (~23 valeurs V1 incl. `awaiting_admin_validation`) |    ✅    |    ✅    |  ✅   |         n/a          |          ✅           |        ✅        |   ✅    |
| Server Actions (~27)                                             |    ✅    |    ✅    |  ✅   |         n/a          |          ✅           |        ✅        |   ✅    |
| Templates V1 (~30)                                               |    ✅    |    ✅    |  ✅   |          ✅          |          ✅           |        ✅        |   ✅    |
| Crons V1 (~21)                                                   |    ✅    |    ✅    |  ✅   |         n/a          |          ✅           |        ✅        |   ✅    |
| Sections admin (16)                                              |    ✅    |    ✅    |  n/a  |         n/a          |          ✅           |       n/a        |   ✅    |
| Score V0 (37.5 / 100)                                            |    ✅    |    ✅    |  ✅   |         n/a          |          n/a          |       n/a        |   ✅    |
| Décisions Will tranchées (D33 → D58 = 26)                        |    ✅    |    ✅    |  ✅   |          ✅          |   ✅ (référencées)    | ✅ (référencées) |   ✅    |
| Questions restantes (Q1 → Q10 ; Q7 marquée RETIRÉ V1 D57)        |    ✅    |    ✅    |  ✅   |          ✅          |          n/a          |       n/a        |   ✅    |

---

## Section 7 — Workflow vérifié

### Parcours A modélisé

`/reserver` → `BookingOption(option_pending)` → Will clic "Envoi contrat + demande acompte" (D49 — avec écran saisie admin D55 frais + édition contrat Tiptap) → `Booking(status=contract_payment_sent)` (slot 🟠) → webhook Stripe acompte reçu (D50) → AUTO `awaiting_admin_validation` (D51) → Will clic "Valider sur le calendrier" (D49) → `confirmed` (slot 🔴) + email final client.

✅ Workflow A correctement modélisé.

### Parcours B modélisé

`/demande-devis` → `Submission(type=quote_request, status=new)` (D44 — pas de slot bloqué D45) → négo hors-app (`A17 updateSubmissionDraftAction` — `new → qualifying → negotiating`) → Will drawer admin unifié (D47, §5.11.3.bis) avec montant, frais, échéancier, TVA, Tiptap contrat, Tiptap devis → clic "Envoyer devis + contrat + lien paiement" → `createBookingFromSubmissionAction` (A16 D46) → `Booking(originPath='quote_negotiation', fromSubmissionId, status=contract_payment_sent)` (slots[] 🟠) → ... → identique parcours A à partir de `awaiting_admin_validation` (D51) → clic Will "Valider sur le calendrier" → `confirmed`.

✅ Workflow B correctement modélisé.

---

## Section 8 — Edge cases

| Cas                                                                     | Comportement V1                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Délai 5j sans rien (ni signature ni paiement) après envoi contrat (D52) | Cron `option-expiration-rien-recu` (#24) → annulation auto + email visiteur `option-expired-no-response` (#48) + Telegram Will + libération slot. À J-1 du seuil → email soft `option-near-expiration-j-1-soft` (#46).                                                                  |
| Délai 10j contrat signé sans paiement (D52 + D53)                       | Cron `contract-signed-without-deposit-cancel` (#22bis/23) → annulation auto + clause CGV D53 invoquée (« résolution de plein droit ») + Telegram Will + libération slot + email client. Relances client `contract-signed-payment-pending-relance-j1/j3/j7` (#49-51) avant l'expiration. |
| Paiement reçu sans contrat signé (D50 — paiement = seul bloquant)       | AUTO `contract_payment_sent → awaiting_admin_validation`. Badge ⚠️ "Contrat à signer le jour J" affiché dans console admin. Will peut valider sur calendrier quand même → signature physique le jour J de l'intervention.                                                               |
| Multi-options simultanées (cap 3 par défaut, D34)                       | Tant que cap non atteint, Will peut valider l'une d'elles. Au clic "Envoi contrat + demande acompte" (D49) sur une option → autres options du même slot → `lost_other_won` + email auto avec 3 dates alternatives.                                                                      |
| Contrat envoyé puis aucun paiement reçu après 5j                        | Cron #24 (D52) → annulation auto + libération slot.                                                                                                                                                                                                                                     |
| Contrat signé + paiement reçu rapidement                                | Transition normale `contract_payment_sent → awaiting_admin_validation` (D51) → Will clique "Valider sur le calendrier" → `confirmed`.                                                                                                                                                   |
| Customer demande sa facture (D56)                                       | Email PJ uniquement V1 — pas de Customer Portal Stripe. Hook V2+ préservé via `Payment.providerCustomerId`.                                                                                                                                                                             |

---

## Section 9 — Verdict final UX

✅ **COMPLET et COHÉRENT** pour Will V1 (vision finale itérée 2026-05-12, D33→D58 incluses).

- Les 2 parcours visiteur A et B sont entièrement modélisés (D44-D48 issus de `UX-E2E-VERIFICATION.md`).
- La validation calendrier en 2 clics distincts (D49) supprime toute confusion entre "envoi" et "validation finale".
- L'état `awaiting_admin_validation` (D51) matérialise la phase d'attente du 2ème clic Will entre paiement reçu et bascule slot 🔴.
- Les délais configurables admin (D52) + clause contractuelle par défaut (D53) sécurisent la résolution juridique des bookings impayés.
- La saisie admin obligatoire avant envoi du contrat (D55) garantit la maîtrise complète du contenu envoyé au client.
- Les retraits V1 (D56 Customer Portal Stripe + D57 NPS + D58 onboarding docs) ne dégradent pas le périmètre métier — hooks V2+ préservés.
- Les notifications Will (D54) sont focalisées sur Telegram + console admin (cohérent avec son mode opératoire).

---

## Section 10 — Recommandation

**Verdict NO-GO reste valide** : l'écart V0 → V1 = build à faire (deposit-validation-gated absent du code actuel `HEAD ff3ccbc`).

**Voie A recommandée** : build complet V1 sur ~52-58 j ingé + 0,5j Will, soit 10-12 semaines avec 1 dev plein temps.

Pré-requis Will avant Sprint X.0 (~0,5j non-dev) :

1. Trancher 10 questions restantes Q1-Q10 (cf. `STOP-AND-ASK.md` § 2) — 30-45 min review dédiée. Q7 NPS J+1 close (D57 retiré V1).
2. Signer DPA Stripe en ligne (~30 min).
3. Activer compte Stripe live + KYB validé (~quelques jours selon dossier).
4. Trancher structure juridique FR vs EE (peut attendre fin Sprint X.17).

---

**Fin de `FINAL-VERIFICATION.md` — 2026-05-12 — Mode AUDIT-ONLY respecté (0 code, 0 git, 0 pnpm, 0 POST ; 6 fichiers V2 modifiés via Edit + 1 fichier `.md` écrit dans `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/`).**
