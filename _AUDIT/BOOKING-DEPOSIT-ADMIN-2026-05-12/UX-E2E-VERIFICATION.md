# UX E2E VERIFICATION — Audit Booking Deposit-Validation-Gated V2

> Vérification post-audit menée 2026-05-12 sur la doctrine V2 (post-review Will).
> Mode AUDIT-ONLY. HEAD `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742`.
> Périmètre : confronter les 6 livrables V2 (`MANIFEST`, `SYNTHESE-FINALE`, `🚨-NO-GO-ALERT`, `STOP-AND-ASK`, `03-ARCHITECTURE-CIBLE`, `04-PLAN-EXECUTION`) à la vision V1 finale **2 parcours** A/B portée par Will 2026-05-12.

---

## 1. Résumé exécutif

État global : 🚨 **INCOMPLET — un parcours visiteur sur deux est manquant dans la doc V2.**

| Priorité | Nombre de trous | Sujets phares                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | --------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       |           **9** | Parcours B « avec devis » jamais distingué du parcours A ; `/demande-devis` absent ; `createBookingFromSubmissionAction` absente ; UX visiteur post-paiement parcours B non couverte ; templates emails parcours B (~6) manquants ; admin n'a pas de drawer unifié « gros tickets en négo » ; suivi paiements parcours B (créé manuellement) non décrit ; toggle « relances OFF par client » non implémenté ; bouton « M'alerter si libéré » (waitlist) non Server-Action-isé       |
| P1       |           **7** | Pas de cron « Submission en négo inactive > 7j » ; pas d'état Booking « contract_signed && deposit_pending » sans paiement (= état coincé) ; pas de `Submission.status = qualifying / negotiating / converted` ; pas de cron rappel signature DocuSeal côté visiteur ; pas de page mère client « Mes réservations » ; copy CGV ne distingue pas A vs B (J-7 reschedule pour A vs négo libre pour B) ; CTAs hubs > 5 000 € HT renvoient vers `/reserver` au lieu de `/demande-devis` |
| P2       |           **3** | Pas de timeline « durée moyenne négo B » dans dashboard admin ; pas de tag UTM persisté sur Submission en mode devis ; pas d'export CSV séparé A vs B pour comptabilité                                                                                                                                                                                                                                                                                                             |

**Top 3 corrections immédiates** :

1. Ajouter une route **`/demande-devis`** + Server Action **`submitQuoteRequestAction`** + Submission `type='quote_request'` + template email `quote-request-received` dans `03-ARCHITECTURE-CIBLE.md` § 5.1/5.2/5.7 et `04-PLAN-EXECUTION.md` (nouveau Sprint X.5bis « Parcours B — qualification » ~2-3 j).
2. Ajouter la Server Action admin **`createBookingFromSubmissionAction(submissionId, slots[], amount, schedule, fees, contractDraft, quoteDraft)`** qui matérialise la sortie de négociation hors-app (parcours B → DB) dans `03-ARCHITECTURE-CIBLE.md` § 5.2 et `04-PLAN-EXECUTION.md` Sprint X.8.
3. Décliner explicitement les **5 templates emails parcours B** manquants (`quote-request-received`, `quote-sent-from-negotiation`, `contract-sent-with-deposit-link`, `booking-confirmed-after-negotiation`, `negotiation-stalled-reminder`) dans Sprint X.13.

---

## 2. Parcours A — Format sans devis (calendrier direct)

### 2.1 Diagramme cible (11 étapes — couverture V2 partielle)

```
1.  Visiteur → /reserver?intervention=<slug>&city=<v>           [✅ X.18 préfill]
2.  Voit calendrier 5 statuts (🟢🟠🟡🔴 visiteur + ⚫ admin)   [✅ X.5 / 03-ARCH §5.11.2]
3.  Clic slot 🟢 ou 🟠 (multi-options, cap config)               [✅ X.5]
4.  Form (entreprise + INSEE size + secteur + CGV)              [✅ X.1 / agent-01]
5.  Submit → postOption48hAction → BookingOption.create         [✅ X.4 refactor]
6.  Email auto visiteur « Demande reçue, William sous 24-48h »  [✅ X.13 #3 option-posted]
    + Telegram Will                                             [✅ X.13 alerts]
7.  Will → /admin/demandes → clic « Valider »                    [✅ X.8 / X.14]
8.  TRIGGER AUTO :                                               [✅ X.4 invariant I6]
    - Slot 🔴                                                    [✅]
    - autres options → lost_other_won + email alternatives       [✅ X.5 cascade]
    - Contrat PDF généré depuis ContractTemplate                [✅ X.3]
    - Facture acompte PDF générée                                [✅ X.10]
    - Stripe Checkout Session créée                              [✅ X.2]
    - Email client : contrat DocuSeal + lien paiement           [✅ X.13 #29 + #19]
9.  Client signe DocuSeal (webhook submission.completed)        [✅ X.3]
10. Client paie acompte Stripe (webhook checkout.completed)     [✅ X.2]
11. Booking confirmé → crons J-7/J-1/J+1 → archivé               [✅ X.12]
```

**Verdict parcours A** : ✅ **COUVERT** par la doc V2.

- État machine ~28 valeurs effectives intègre l'enchaînement (cf. `03-ARCHITECTURE-CIBLE.md:122-153`).
- Sprint X.4 invariant **I6** code explicitement le trigger AUTO (cf. `04-PLAN-EXECUTION.md:435-440`).
- Skip `audit_flash_onsite` documenté (`03-ARCHITECTURE-CIBLE.md:1009-1016`).

**Trous mineurs détectés** :

- ⚠️ Pas d'écran d'attente client entre étapes 8 et 9 (« William prépare votre contrat… »). Couvert implicitement par email mais aucune page de tracking n'est mentionnée.
- ⚠️ Bouton « M'alerter si libéré » mentionné (`03-ARCH §5.11.2 cap atteint`) mais **aucune Server Action `subscribeWaitlistAction`** ni template `slot-alert-released` dans X.13 strict V1 (marqué « V1.5 optionnel » § 5.7.1 ligne 30).

---

## 3. Parcours B — Format avec devis (formulaire qualifié, pas de calendrier)

### 3.1 Diagramme cible (13 étapes — couverture V2 inexistante)

```
1.  Visiteur → page format (/interventions/<slug>, /interventions/transformation-collective, /interventions/ia-custom)
2.  Voit « sur devis » (fourchette indicative)                  [⚠️ Copy à clarifier — pricing.ts:235 D33]
3.  CTA → /demande-devis?intervention=<slug>                     [🚨 ABSENT V2]
4.  Form qualifié (identité + contexte 200-500 mots +
    budget pressenti + timing semaines + lieu + nb participants
    + CGV/RGPD)                                                 [🚨 ABSENT V2]
5.  Submit → submitQuoteRequestAction → Submission              [🚨 ABSENT V2]
    type='quote_request' (PAS de BookingOption, PAS de slot)
6.  Email auto « Demande reçue. William vous recontactera sous   [🚨 ABSENT V2 — Q'un seul
    24-48h pour cadrage »                                         template `quote-sent`
                                                                  existe dans X.13 #33]
7.  Will → Telegram + email                                       [✅ existant]
8.  NÉGOCIATION HORS-APP : appels, emails, échange besoin,       [🚨 ABSENT V2 —
    propositions dates, fixation prix                              aucune trace de cet état
                                                                   long dans state machine
                                                                   ni dans state Submission]
9.  Will → /admin/demandes (filtre quote_request) → clic         [🚨 ABSENT V2 —
    « Créer la réservation »                                       seule la voie
                                                                   « BookingOption valide
                                                                   par slot visiteur » est
                                                                   couverte par X.8]
   - Sélectionne 1-N slots (block manuel calendrier admin)
   - Saisit montant total HT + fees accessoires
   - Sélectionne ou override échéancier
   - Sélectionne TVA (FR/EE selon legal.ts)
   - Rédige/édite contrat Tiptap
   - Rédige/édite devis (form admin + Tiptap)
   - Clic « Envoyer devis + contrat + lien paiement »
10. TRIGGER AUTO :
   - Slots → 🔴
   - Email client : devis DocuSeal + contrat DocuSeal +
     lien paiement Stripe
   - PDF facture acompte générée
11. Client signe devis + contrat (DocuSeal webhook)               [✅ X.3+X.7 réutilisables
                                                                    si étape 9 livrée]
12. Client paie acompte (Stripe webhook)                          [✅ X.2 réutilisable]
13. Booking confirmé → crons J-7/J-1/J+1                          [✅ X.12]
```

**Verdict parcours B** : 🚨 **P0 — Le parcours B n'est PAS un parcours distinct dans la doc V2.**

### 3.2 Constat — la doc V2 traite le devis comme une **variante de parcours A**

Le V2 résume le devis ainsi (`03-ARCH §5.11.1`, `04-PLAN X.7`) :

- Visiteur clique un slot 🟠 → `BookingOption` posée.
- Will valide → si `requiresQuote(interventionType, basePriceHtCents) === true`, alors le flow passe par `quote_sent → quote_signed` AVANT `contract_pending`.

Cette modélisation **suppose 3 choses incompatibles avec le parcours B** décrit par Will 2026-05-12 :

1. Le visiteur **doit choisir un slot** AVANT de poser une demande de devis → impossible pour un gros ticket en négo où la date est elle-même négociable sur plusieurs semaines.
2. Le visiteur **doit accepter d'avance un prix précis** (`basePriceHtCents` issu de `PricingConfig`) → contraire au principe « tarif sur-mesure 8-50 k€ pour IA Custom ».
3. La Server Action `emitQuoteAction(bookingId)` (`03-ARCH §5.2.2 A7`) **part d'un `bookingId`** déjà créé → impossible quand la négociation a lieu _avant_ tout booking.

**Conséquence** : tous les formats > 5 000 € HT OU IA Custom (5-50 k€) OU packs annuels OU transformation collective custom n'ont **aucun parcours visiteur fonctionnel dans la doc V2**. Sans correction, ces leads tomberont sur :

- `/reserver` (formulaire avec slot, mais prix non affiché → friction) ;
- ou `/contact` (form générique, pas qualifié, pas tracé `Submission.type='quote_request'`).

### 3.3 Trous P0 à corriger sur le parcours B

| #      | Trou                                                                                                                                                                            | Impact                                                   | Localisation correction                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| B-P0-1 | Route publique `/demande-devis` (FR) + `/request-quote` (EN) absente                                                                                                            | Visiteur tombe sur `/contact` ou `/reserver` non adaptés | `03-ARCH §5.3` Route handlers + `04-PLAN` nouveau Sprint X.5bis                                 |
| B-P0-2 | Server Action `submitQuoteRequestAction` absente                                                                                                                                | Pas de capture qualifiée                                 | `03-ARCH §5.2.1` ajout V4 + `04-PLAN` X.5bis                                                    |
| B-P0-3 | `SubmissionType` enum ne contient pas `quote_request` (V0 a `audit/implementation/intervention/contact` cf. `00-REALITY-CHECK §1.2`)                                            | Pas de filtrage admin                                    | `03-ARCH §5.1.2` ajouter `SubmissionType` extension                                             |
| B-P0-4 | `Submission.status` enum ne distingue pas `new / qualifying / negotiating / converted / lost / archived`                                                                        | Will perd la trace des leads en négo                     | `03-ARCH §5.1.2`                                                                                |
| B-P0-5 | Server Action admin `createBookingFromSubmissionAction(submissionId, slots[], amountHt, scheduleProfile, fees, vatRate, contractDraft, quoteDraft)` absente                     | Sortie de négociation manuelle non-couverte              | `03-ARCH §5.2.2` ajout A16 + `04-PLAN` X.8 drawer admin                                         |
| B-P0-6 | Aucun template email pour parcours B (`quote-request-received`, `quote-sent-from-negotiation`, `contract-sent-from-negotiation`, `negotiation-stalled-reminder`)                | Pas de feedback visiteur, lead perdu                     | `04-PLAN` X.13 ajout ~5 templates                                                               |
| B-P0-7 | Drawer admin `/admin/demandes/[id]` ne prévoit pas formulaire unifié (slots picker + montant + fees + schedule + TVA + Tiptap contrat + Tiptap devis + bouton « Envoyer tout ») | Will doit naviguer entre 5 écrans                        | `04-PLAN` X.8 §Drawer riche extension                                                           |
| B-P0-8 | Pas de cron `negotiation-stalled-reminder` pour Submission inactive > 7j                                                                                                        | Will oublie de relancer                                  | `04-PLAN` X.12 ajout job #21                                                                    |
| B-P0-9 | Le calendrier admin n'a pas de mode « bloquer plusieurs slots pour un lead en négo (réservé tentatif) »                                                                         | Will ne peut pas pré-positionner sans valider            | `04-PLAN` X.9 drag-drop multi-slot ; ⚫ état `blocked` réutilisable mais sans `submissionId` FK |

---

## 4. UX visiteur — trous identifiés

### 4.1 Cas commun (A + B)

- ⚠️ Visiteur ne dispose **pas** d'une page mère « Mes réservations » (token magique ouvre annulation/reschedule d'**un** booking, cf. X.15, mais pas un dashboard agrégé). Si un client a un booking A + un devis B en cours → 2 emails séparés, 2 magic-links, 0 vue globale.
- ⚠️ Si client **signe contrat mais ne paie pas** → état `contract_signed && deposit_pending` (cf. state machine `03-ARCH §5.5`). Email de rappel J-3 / J+1 / J+15 / J+30 prévus côté facture (`04-PLAN X.12 #4/#5/#6/#7`), mais aucun email spécifique « contrat signé en attente de paiement, votre créneau n'est pas verrouillé ».
- ⚠️ Si client **paie mais ne signe pas** → état `deposit_pending succeeded` mais `contract_sent` toujours. Aucun trigger côté cron pour relancer la signature après paiement reçu (`04-PLAN X.12 #8/#9 contract-expiration` couvre l'absence de paiement, pas l'inverse). Risque : argent encaissé sans contrat → conformité douteuse.

### 4.2 Parcours A spécifique

- ⚠️ `lost_other_won` (option visiteur perdue car Will a validé une autre option) → template `option-lost-other-won` prévu (X.13 #7) avec « 3 dates alternatives ». Mais aucun mécanisme garantit que ces 3 dates sont **toujours dispo au moment de l'envoi** (race condition : entre le calcul et l'email, un autre visiteur pose une option → l'email peut suggérer un slot déjà 🟠).
- ⚠️ Bouton « M'alerter si libéré » mentionné `03-ARCH §5.11.2` mais traité comme V1.5 dans X.13 (template `slot-alert-released` n°30 « V1.5 optionnel »). Cap atteint = visiteur **sans recours** côté V1.

### 4.3 Parcours B spécifique

- 🚨 Visiteur ne sait **pas où il en est** entre étape 6 (« William vous recontacte sous 24-48h ») et étape 10 (« Devis + contrat + paiement »). Aucun template intermédiaire. Si négo dure 3 semaines → silence radio.
- 🚨 Visiteur ne peut **pas annuler** sa demande de devis sans contacter Will (pas de magic-link sur `Submission`).
- 🚨 Visiteur ne **voit pas** sur le calendrier que son négo bloque temporairement des slots (puisque slots admin ⚫ sont invisibles côté visiteur). Si Will pré-bloque 3 slots pour ce lead pendant 2 semaines, le visiteur ne sait pas lesquels.
- 🚨 Si client paye acompte avant que Will ait formellement créé le `Booking` (race exotique : devis signé + lien paiement actif, Will en vacances) → état incohérent. Mais en V2 strict, Stripe Checkout est créée _après_ la création du Booking — donc OK _si_ `createBookingFromSubmissionAction` existe. Si elle n'existe pas (cas actuel V2), pas de scénario défini → 🚨 P0.

---

## 5. UX admin — trous identifiés

### 5.1 Vue unifiée

- ⚠️ `03-ARCH §5.4` admin nav décrit 15 sections, dont `DEMANDES` (BookingOption pending_validation) et `RÉSERVATIONS` (Bookings post-validation). **Aucune section pour les `Submission type='quote_request'` en négo**. Will devrait pouvoir filtrer :
  - Demandes parcours A (BookingOption pending_validation).
  - Demandes parcours B (Submission qualifying/negotiating).
  - Bookings actifs (parcours A et B fusionnés, distinction via `Booking.originPath` enum à ajouter).
- ⚠️ Pas de **badge distinction visuelle** A vs B dans la liste `/admin/demandes` (X.8 décrit Type/Date/Cadrage statut → manque colonne « Origine »).

### 5.2 Workflow admin parcours B

- 🚨 Drawer admin `04-PLAN X.8` ne couvre PAS le scénario où Will :
  - Sélectionne plusieurs slots simultanément (1, 2 ou plusieurs séances).
  - Saisit montant total HT custom + fees détaillés.
  - Override échéancier (override `BookingPaymentSchedule.installments` JSONB).
  - Sélectionne TVA selon `legal.ts` (FR ou EE).
  - Rédige contrat Tiptap (X.3 prévoit Tiptap mais après création du Booking, pas avant).
  - Rédige devis Tiptap (X.7 prévoit `emitQuoteAction(bookingId)` qui suppose un Booking préalable).
  - Envoie tout en 1 clic.
- ⚠️ Will peut modifier une option en cours de négo (montant qui change) ? La doc V2 ne décrit pas explicitement. Il faut ajouter à `03-ARCH §5.2.3` une action `editSubmissionNegotiationAction(submissionId, partialFields)` ou un drawer libre.

### 5.3 Suivi paiements

- ✅ Tableau paiements `03-ARCH §5.16` montre tous les bookings (A et B fusionnés via FK `bookingId`) — OK si parcours B aboutit à un Booking.
- ⚠️ **Si parcours B reste en négo**, aucune trace dans `/admin/paiements` (pas de prévisionnel). Will perd la vue « pipeline ».
- ⚠️ Relances paiement J-7 / J+1 / J+15 / J+30 fonctionnent identiquement pour A et B (basées sur `BookingPaymentSchedule.installments[i].dueAt`) — ✅ OK.
- ⚠️ **Toggle « désactiver relances auto par client »** mentionné `03-ARCH §5.16.3` (`SiteSetting.paymentReminderDisabledFor[]`) mais :
  - **Pas d'admin UI** prévue dans X.11 pour éditer cette liste.
  - **Pas de doc** sur comment Will toggle un client.
  - 🚨 P0 mineur, fix dans X.11.

### 5.4 Drawer client unifié

- ⚠️ `03-ARCH §5.4` sidebar « CLIENTS (CRM 360°) » → « Fiche entreprise » → « Historique » mais le détail manque. Will doit voir :
  - Tous les Bookings (A + B) du client.
  - Toutes les Submissions (audit, implementation, contact, quote_request) du client.
  - Tous les Payments + Invoices + Refunds + Quotes + Contracts.
  - Timeline mixte chronologique.
- ⚠️ Lien entre Submission B → Booking (parcours B) : aucune FK `Booking.fromSubmissionId` n'est explicitement décrite dans `03-ARCH §5.1.3` (extensions Booking). 🚨 P1.

### 5.5 Calendrier admin parcours B

- ⚠️ Will doit pouvoir **pré-bloquer** des slots pour un lead en négo (⚫ admin) **avec un lien vers la Submission**. Aujourd'hui `CalendarSlot.blockedReason` est un `Text?` libre (`00-REALITY-CHECK §1.2`) → pas de FK `linkedSubmissionId`. Conséquence : Will doit écrire à la main « blocked for Acme negotiation » et ne peut pas filtrer/débloquer en masse. 🚨 P1.

---

## 6. Rappels paiement

### 6.1 Cadence

| Évènement                                       | Cron / template                                                            | Sprint cible         | Statut                          |
| ----------------------------------------------- | -------------------------------------------------------------------------- | -------------------- | ------------------------------- |
| J-7 avant échéance                              | `installment-due-reminder-j-7` + email `installment-due-j-7` (#17)         | X.12 #11 + X.13      | ✅ Présent                      |
| J+1 retard                                      | `payment-reminder-j-plus-1` + `installment-overdue-j-1` (#18)              | X.12 #5 + X.13       | ✅ Présent                      |
| J+15 retard                                     | `payment-reminder-j-plus-15` + `installment-overdue-j-15` (#19)            | X.12 #6 + X.13       | ✅ Présent                      |
| J+30 retard                                     | `payment-reminder-j-plus-30` + `installment-overdue-j-30` (#20) + Telegram | X.12 #7 + X.13       | ✅ Présent                      |
| Désactivation par client (clients de confiance) | `SiteSetting.paymentReminderDisabledFor[]`                                 | X.11 + X.16          | ⚠️ Pas d'UI                     |
| Escalation Telegram Will                        | Tag `IMPAYE_CRITIQUE` à J+30                                               | X.13 §triggers admin | ✅ Présent (`04-PLAN X.13 #20`) |

### 6.2 Verdict

✅ Cohérent **pour parcours A + parcours B** (post-création Booking).
⚠️ Pas de UI admin pour toggle désactivation → fix mineur X.11.
🚨 **Pas de relance « Submission B inactive > 7j »** côté Will pour relancer le client en négo → fix Sprint X.12 nouveau job #21 (`negotiation-stalled-reminder` cron + Telegram).

---

## 7. Système email

### 7.1 Stack confirmé

✅ Système maison Nodemailer + PowerMTA + Mailwizz **confirmé Phase 0** (cf. `MANIFEST D43` + `STOP-AND-ASK §1 D43`).
✅ ~25 templates V1 dans Sprint X.13 + ~14 existants V0 (= ~39 au total).
⚠️ DMARC/DKIM/SPF prod : statut `[À VÉRIFIER]` (cf. `STOP-AND-ASK §3 bloquant #6`). 🚨 P0 ops pré-prod.

### 7.2 Couverture parcours A

✅ Tous les templates clés présents (cf. `04-PLAN X.13` table) :

- `option-posted` (#3 MAJ), `option-validated` (#6), `option-lost-other-won` (#7), `option-refused-by-admin` (#8).
- `cadrage-scheduled` (#14) + reminders J-1/H-2 (#15-16) + recap (#17) + decline (#18).
- `payment-link` (#19), `payment-receipt` (#20), `payment-failed` (#21).
- `contract-sent` (#29), `contract-signed` (#30), `contract-refused` (#31), `contract-reminder` (#32).
- `invoice-issued` (#22), `credit-note-issued` (#23).
- `payment-reminder-j7` (#24), `payment-overdue-j1/j15/j30` (#25).
- `booking-rescheduled` (#26), `booking-j1-reminder` (#27), `booking-j1-debrief` (#28).
- `force-majeure-notice` (#38), `refund-issued` (#39).

### 7.3 Couverture parcours B — **incomplète**

| Template attendu                                                                                                                    | Présent V2 ?                                               | Localisation             |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| `quote-request-received` (étape 6 — confirmation réception demande de devis qualifié)                                               | 🚨 ABSENT                                                  | Ajouter X.13             |
| `quote-sent-from-negotiation` (étape 10 — distinct de `quote-sent` X.13 #33 car ne suit pas un cadrage formel)                      | 🚨 ABSENT                                                  | Ajouter X.13             |
| `contract-sent-with-deposit-link` (étape 10 — bundle devis + contrat + lien paiement, distinct de `contract-sent` qui suit cadrage) | 🚨 ABSENT                                                  | Ajouter X.13             |
| `booking-confirmed-after-negotiation` (étape 13 — distinct de `booking-confirmed` car contexte différent)                           | ⚠️ Réutilisable `booking-confirmed` mais sans copy adaptée | Variante X.13            |
| `negotiation-stalled-reminder` (cron — relance Will si Submission > 7j inactive)                                                    | 🚨 ABSENT                                                  | Ajouter X.12 + X.13      |
| `quote-signed` (#34), `quote-declined` (#35), `quote-reminder` (#36), `quote-expired` (#37)                                         | ✅ Présents                                                | Réutilisables parcours B |

🚨 **5 templates manquants pour parcours B**.

---

## 8. Risques UX critiques

| #   | Risque                                                                                                                                                                                                                               | Probabilité                                                                                                                                | Impact                             | Mitigation                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Confusion visiteur entry point A vs B** : un visiteur intéressé par IA Custom (50 k€) tombe sur `/reserver`, voit un calendrier, choisit un slot, et soumet → BookingOption posée pour un prix qui sera négocié → friction massive | Élevée (la doc V2 force ce comportement par absence de `/demande-devis`)                                                                   | Lead perdu OU promesse intenable   | P0 — ajouter route `/demande-devis` + redirect intelligents depuis hubs `/interventions/ia-custom`, `/interventions/transformation-collective` (X.18) |
| 2   | **Will oublie de relancer un lead B en négo** depuis 14j → lead perdu                                                                                                                                                                | Élevée (rythme commercial humain irrégulier)                                                                                               | Revenu manqué                      | P1 — cron `negotiation-stalled-reminder` Telegram Will à J+7/J+14/J+30                                                                                |
| 3   | **Client B paye l'acompte mais Will n'a pas créé le Booking** → argent encaissé sans contrat                                                                                                                                         | Faible (Stripe Checkout n'est créée qu'après création Booking) — sauf si `createBookingFromSubmissionAction` absente → P0 par construction | Litige client                      | P0 — implémenter A16 dans X.8                                                                                                                         |
| 4   | **Cap 3 atteint → visiteur sans recours** côté V1 (waitlist V1.5) → frustration                                                                                                                                                      | Modérée                                                                                                                                    | UX dégradée                        | P1 — passer `subscribeWaitlistAction` + template `slot-alert-released` en V1 strict                                                                   |
| 5   | **Client signe contrat mais ne paye pas** → état coincé `contract_signed && deposit_pending` ; pas d'email dédié, pas d'expiration                                                                                                   | Modérée                                                                                                                                    | Slot indisponible artificiellement | P1 — ajouter cron `contract-signed-without-deposit` J+3/J+7 + template + auto-expire J+14                                                             |

---

## 9. Corrections à apporter (par fichier cible)

| Fichier                    | Section                                    | Correction                                                                                                                                                                                                                                | Priorité                                                                   |
| -------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --- |
| `03-ARCHITECTURE-CIBLE.md` | §5.1.2 (enums)                             | Étendre `SubmissionType` (ajouter `quote_request`) + créer `SubmissionStatus` (`new`, `qualifying`, `negotiating`, `converted`, `lost`, `archived`)                                                                                       | P0                                                                         |
| `03-ARCHITECTURE-CIBLE.md` | §5.1.3 (Booking extensions)                | Ajouter `fromSubmissionId Uuid? FK → Submission`, `originPath enum {direct, quote_negotiation} @default(direct)`                                                                                                                          | P0                                                                         |
| `03-ARCHITECTURE-CIBLE.md` | §5.2.1 (actions visiteur)                  | Ajouter V4 `submitQuoteRequestAction(formData)` → `{ok, submissionId}`                                                                                                                                                                    | P0                                                                         |
| `03-ARCHITECTURE-CIBLE.md` | §5.2.2 (actions admin booking)             | Ajouter A16 `createBookingFromSubmissionAction(submissionId, slots[], amountHtCents, scheduleProfile                                                                                                                                      | customInstallments, fees, vatRate, contractDraftTiptap, quoteDraftTiptap)` | P0  |
| `03-ARCHITECTURE-CIBLE.md` | §5.3 (route handlers)                      | Ajouter route page publique `/demande-devis` (FR) + `/request-quote` (EN), Server Action coupling                                                                                                                                         | P0                                                                         |
| `03-ARCHITECTURE-CIBLE.md` | §5.4 (admin nav)                           | Ajouter sous-section « DEMANDES > Devis qualifiés (Submission quote_request) » distinct des « BookingOption pending_validation »                                                                                                          | P0                                                                         |
| `03-ARCHITECTURE-CIBLE.md` | §5.5 (state machine)                       | Documenter chemin parcours B : `Submission new → qualifying → negotiating → converted → Booking option_pending` (skip cadrage si déjà négocié) → `contract_pending → contract_sent → contract_signed → deposit_pending → confirmed → ...` | P0                                                                         |
| `03-ARCHITECTURE-CIBLE.md` | §5.7 (templates)                           | Ajouter 5 templates parcours B : `quote-request-received`, `quote-sent-from-negotiation`, `contract-sent-with-deposit-link`, `booking-confirmed-after-negotiation`, `negotiation-stalled-reminder`                                        | P0                                                                         |
| `03-ARCHITECTURE-CIBLE.md` | §5.11 (affinements Will)                   | Nouvelle section 5.11.3 « Will-C — Parcours B (devis qualifié sans calendrier visiteur) » avec diagramme dédié                                                                                                                            | P0                                                                         |
| `03-ARCHITECTURE-CIBLE.md` | §5.15 (suivi paiements)                    | Mentionner que `/admin/paiements` doit aussi exposer un pipeline « Submissions B en négo, montant pressenti, durée écoulée »                                                                                                              | P1                                                                         |
| `04-PLAN-EXECUTION.md`     | §1 vue d'ensemble + DAG §4                 | Ajouter Sprint **X.5bis — Parcours B qualification (~2-3 j)** entre X.5 et X.6 : page `/demande-devis`, `submitQuoteRequestAction`, extension Submission, 1 template `quote-request-received`                                             | P0                                                                         |
| `04-PLAN-EXECUTION.md`     | X.8 (admin réservations drawer)            | Ajouter dans le drawer admin une vue « Submissions B en négo » + bouton « Convertir en Booking » → ouvre formulaire complet (slots picker + montant + fees + schedule + TVA + Tiptap contrat + Tiptap devis + envoi unifié)               | P0                                                                         |
| `04-PLAN-EXECUTION.md`     | X.9 (calendrier admin)                     | Ajouter mode « pré-bloquer N slots pour Submission [id] » via drag-drop multi-slot + FK `CalendarSlot.linkedSubmissionId`                                                                                                                 | P1                                                                         |
| `04-PLAN-EXECUTION.md`     | X.11 (paiements)                           | Ajouter admin UI toggle `paymentReminderDisabledFor[]` (liste UUID clients)                                                                                                                                                               | P1                                                                         |
| `04-PLAN-EXECUTION.md`     | X.12 (crons)                               | Ajouter job #21 `negotiation-stalled-reminder` (J+7/J+14/J+30 Telegram Will pour Submission B inactive) + job #22 `contract-signed-without-deposit-reminder`                                                                              | P0 + P1                                                                    |
| `04-PLAN-EXECUTION.md`     | X.13 (templates)                           | Ajouter explicitement les 5 templates parcours B + 1 template `contract-signed-without-deposit-reminder`                                                                                                                                  | P0                                                                         |
| `04-PLAN-EXECUTION.md`     | X.15 (self-service client)                 | Ajouter magic-link sur `Submission type='quote_request'` pour permettre au client d'annuler / suivre l'état de sa demande                                                                                                                 | P1                                                                         |
| `04-PLAN-EXECUTION.md`     | X.17 (CGV)                                 | Clause spécifique « Demandes de devis : durée de validité 30 j, possibilité d'annulation sans frais à tout moment avant signature du devis »                                                                                              | P1                                                                         |
| `04-PLAN-EXECUTION.md`     | X.18 (préfill + CTAs)                      | Mapper CTAs `/interventions/ia-custom`, `/interventions/transformation-collective`, hubs B → `/demande-devis?intervention=<slug>` au lieu de `/reserver`                                                                                  | P0                                                                         |
| `MANIFEST.md`              | §3 Décisions Will                          | Tracer décision **D44 — 2 parcours visiteur distincts A (sans devis) vs B (avec devis)** + estampille review Will 2026-05-12                                                                                                              | P0                                                                         |
| `SYNTHESE-FINALE.md`       | §3 Vision V1 finale + §4 Top 10 P0         | Documenter les 2 parcours en diagramme + ajouter les 9 P0 parcours B au Top 10 P0                                                                                                                                                         | P0                                                                         |
| `STOP-AND-ASK.md`          | §1 décisions tranchées                     | Ajouter **D44** « Parcours B (devis qualifié) = route dédiée `/demande-devis` + workflow admin distinct »                                                                                                                                 | P0                                                                         |
| `🚨-NO-GO-ALERT.md`        | Section « Ce qui est réellement en NO-GO » | Ajouter bullet « ❌ Aucun parcours visiteur dédié aux formats > 5 000 € HT / sur-devis (route `/demande-devis` absente, Server Action absente) »                                                                                          | P0                                                                         |

---

## 10. Conclusion

### Verdict UX : 🚨 **INCOMPLET**

La doctrine V2 (post-review Will 2026-05-12) couvre **parfaitement le parcours A** (calendrier direct, validation Will = trigger AUTO contrat + facture + Stripe). Tous les détails techniques sont en place : state machine 28 valeurs, multi-options simultanées, DocuSeal self-hosted, Stripe hybride, échéanciers configurables, géo-awareness, suivi paiements pro, ~25 templates emails.

**MAIS** la doctrine V2 **traite le devis comme une variante interne du parcours A** (helper `requiresQuote` qui insère une étape `quote_sent → quote_signed` au milieu du chemin visiteur+admin standard). Cette modélisation est **incompatible** avec la réalité business B2B premium :

- Un format à tarif sur-mesure (IA Custom 8-50 k€, transformation collective, pack annuel) **ne peut pas exiger du visiteur qu'il choisisse un slot avant d'avoir négocié le prix**.
- La négociation **prend 2 à 4 semaines hors-app** (appels, emails, propositions de dates) et nécessite une `Submission type='quote_request'` qui n'est PAS un `BookingOption`.
- Will doit pouvoir **matérialiser** la sortie de négociation en créant manuellement un Booking + 1-N slots + montant + échéancier + contrat + devis + envoi unifié — opération non documentée dans V2.

### Effort de correction estimé

- **Sprint X.5bis (nouveau)** : parcours B qualification visiteur — ~2-3 j ingé.
- **X.8 extension** : drawer admin unifié parcours B — ~1 j ingé.
- **X.12 + X.13 extensions** : 2 crons + 5 templates — ~1 j ingé.
- **Patches docs (03-ARCH + 04-PLAN + MANIFEST + SYNTHESE + STOP-AND-ASK + NO-GO-ALERT)** : ~0,5 j.

**Total** : **~4-5 j ingé** ajoutés au plan V1 (passage de ~50-55 j à ~54-60 j). Sans cette correction, le V1 livre une plateforme **inadaptée à 30-50 % du CA potentiel** (gros tickets).

### Recommandation à Will

1. **Acter D44** explicitement : 2 parcours visiteur distincts A et B.
2. **Patcher** les 7 fichiers identifiés § 9 avant de lancer Sprint X.0.
3. **Insérer Sprint X.5bis** dans le DAG (après X.5, avant X.6) — parallélisable avec X.6 pour absorber le délai.
4. **Confirmer** que pour V1 strict, la route `/demande-devis` accepte un formulaire simple (10 champs) et **ne pré-bloque pas** de slots côté calendrier — le pré-blocage admin reste une feature X.9.

---

**Fin de `UX-E2E-VERIFICATION.md` — 2026-05-12 — Mode AUDIT-ONLY respecté (0 code, 0 git, 0 pnpm, 1 seul fichier `.md` écrit dans `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/`).**
