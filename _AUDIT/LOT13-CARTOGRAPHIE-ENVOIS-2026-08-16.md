# LOT 13 — Cartographie exhaustive des envois d'e-mails et de leurs déclencheurs

Date : 2026-08-16
Périmètre : worktree `axionia-wt-qualiopi-fix`
Nature : livrable d'INVENTAIRE. Aucun fichier source modifié.

---

## 1. Périmètre et méthode

### 1.1 La source de vérité

Le SSOT des gabarits est le couple :

- **`src/server/queue/types.ts:12-124`** — l'union de types `EmailJobName`. C'est elle qui verrouille l'ensemble : tout envoi passe par `enqueueEmail(template: EmailJobName, …)` (`src/server/queue/queues.ts:690-691`), donc un nom hors de l'union ne compile pas.
- **`src/lib/email/templates/index.tsx:162-432`** — la table `TEMPLATES`, typée `TemplateMap = { [K in EmailJobName]: … }` (`index.tsx:162-167`). Le mapped type sur l'union rend cette table **exhaustive par construction** : un membre de l'union sans entrée ici ne compile pas non plus.

**Décompte : 75 gabarits.** Vérifié mécaniquement (75 clés au premier niveau de `TEMPLATES`). Les 75 sont dans le tableau du §2 ; aucun n'est omis.

Un second garde-fou existe : `src/lib/email/templates/templates-coverage.test.ts` confronte `EMAIL_TEMPLATE_NAMES` (`index.tsx:435`) à l'union.

### 1.2 Les chemins d'envoi

Il n'existe qu'un entonnoir : `enqueueEmail()` (`queues.ts:690-781`) → file BullMQ `emails` → `email-worker.ts:118` qui rend le gabarit (`renderEmailTemplate`) et envoie.

Trois appelants indirects méritent d'être nommés, parce qu'ils masquent le nom du gabarit au grep naïf :

| Indirection | Fichier:ligne | Effet |
|---|---|---|
| `enqueueClientEmail(template, …)` | `src/server/queue/workers/booking-crons-worker.ts:44-67` | wrapper des crons booking (déchiffre le PII puis délègue) |
| `emailTemplateFor(type)` | `src/features/unified-contact/actions.ts:112-136`, appelé `:336` | choisit 1 gabarit parmi 4 selon le type de formulaire |
| `email.template as EmailJobName` | `src/server/actions/qualiopi/email-outbox.ts:111-125` | ré-émetteur UNIVERSEL : renvoie n'importe quel gabarit après approbation en corbeille |

### 1.3 Les trois régimes

- **automatique** — part seul (cron, webhook, conséquence d'un événement). Défaut de `modeParDefaut()` (`src/server/email/outbox-policy.ts:164-167`).
- **file de validation** — garé en corbeille `EmailOutbox` avant envoi (`queues.ts:739-758` → `outbox-service.ts:64-88`). **5 gabarits seulement** : `devis-envoi`, `convention-envoi`, `facture-envoi`, `contract-sent`, `contract-reminder` (`outbox-policy.ts:36-58`).
- **manuel** — déclenché par un clic admin dans une action serveur, envoyé directement.

⚠️ Un quatrième état de fait, non prévu par la doctrine : **dormant**. Le gabarit a un appelant, mais cet appelant n'est jamais exécuté en production (cron non planifié, route 404). Il est distingué dans le tableau.

---

## 2. Le tableau — 75 gabarits

Légende régime : `AUTO` = automatique · `VALID` = file de validation · `MANU` = manuel · `DORMANT` = appelant existant mais non exécuté en prod · `SANS APPELANT` = aucun appelant dans le code.

Légende lien espace : `oui` / `non` / `s.o.` (le destinataire n'a pas d'espace : prospect anonyme, financeur, interne).

### 2.1 Chaîne Qualiopi — stagiaire, client entreprise, interne (13 gabarits)

| # | Gabarit | Objet réel rendu (FR) | Destinataire | Déclencheur exact (fichier:ligne) | Régime | Jalon | Lien espace | Motif du régime |
|---|---|---|---|---|---|---|---|---|
| 1 | `qualiopi-convocation` | `Convocation — {titreFormation} — Axion-IA` (`qualiopi-convocation.tsx:42`) | stagiaire | cron `formation-crons.convocation-j5`, 08:00 UTC (`queues.ts:1501-1505`) → `handleConvocationJ5` (`qualiopi-formation-crons-worker.ts:687`) → `envoyerConvocation` (`notifications-service.ts:157`) | AUTO | **J-5** (plafond 5,5 j, **plancher supprimé** → rattrapage quotidien, `worker.ts:707-730`) | **oui** — `lienPortail` (`qualiopi-convocation.tsx:57,62`) | obligation ind. 9 : la retenir en validation exposerait à ne jamais convoquer (`outbox-policy.ts:64-77`) |
| 2 | `qualiopi-rappel-j7` | `Rappel J-7 — {titreFormation} — Axion-IA` (`qualiopi-rappel-j7.tsx:32`) | stagiaire | cron `formation-crons.rappel-j7`, 08:00 UTC (`queues.ts:1464-1468`) → `handleRappelJ7` (`worker.ts:426`) → `notifications-service.ts:247` | AUTO | **J-7** | **oui** — portail (`qualiopi-rappel-j7.tsx:46,51`) + lien d'émargement conditionnel (`:70`) | idem ind. 9 |
| 3 | `qualiopi-positionnement` | `Avant votre formation {titreFormation} — 5 minutes à nous accorder — Axion-IA` (`qualiopi-positionnement.tsx:48`) | stagiaire | **conséquence de signature** : `consequenceSignatureComplete` (`piece-signature.ts:291-305`) → `declencherPositionnement` (`:273`), appelée depuis `:462` et `:600`. Aussi manuel (`questionnaires.ts:124`) et en relance (`notifications-service.ts:653`) | AUTO | **avant J0**, sans date fixe | oui, **en repli seulement** (`qualiopi-positionnement.tsx:62,67`) | « un positionnement retenu en validation manque la formation qu'il devait préparer » (`outbox-policy.ts:69-71`) |
| 4 | `qualiopi-questionnaire-relance` | `Un petit rappel — votre avis sur {titreFormation} — Axion-IA` (`qualiopi-questionnaire-relance.tsx:29`) | stagiaire | cron `formation-crons.relance-questionnaires`, 08:30 UTC (`queues.ts:1489-1493`) → `handleRelanceQuestionnaires` (`worker.ts:979`) → `envoyerRelanceQuestionnaire`, branche `else` (`notifications-service.ts:656`). Manuel : `questionnaires.ts:188` | AUTO | **J+3 puis J+10** après l'envoi (`worker.ts:986-1002`), plafond 2 | **oui** — `getOrCreatePortailLien` (`notifications-service.ts:655`) | trace de relance = preuve devant l'auditeur (ind. 30, `worker.ts:957-967`) |
| 5 | `qualiopi-satisfaction-j1` | `Votre avis compte — {titreFormation} — Axion-IA` (`qualiopi-satisfaction-j1.tsx:23`) | stagiaire | cron `formation-crons.satisfaction-j1`, 08:00 UTC (`queues.ts:1469-1473`) → `handleSatisfactionJ1` (`worker.ts:472`, sélection sur **l'état**, pas la fenêtre) → `notifications-service.ts:329`. Manuel : `questionnaires.ts:109` | AUTO | **J+1** | 🔴 **non** — CTA = `lienQuestionnaire` seul, sans repli portail (`qualiopi-satisfaction-j1.tsx:40`) | ind. 30 |
| 6 | `qualiopi-suivi-j30` | `Suivi J+30 — {titreFormation} — Axion-IA` (`qualiopi-suivi-j30.tsx:23`) | stagiaire | cron `formation-crons.suivi-j30`, 08:00 UTC (`queues.ts:1474-1478`) → `handleSuiviJ30` (`worker.ts:555`, état) → `notifications-service.ts:383`. Manuel : `questionnaires.ts:112` | AUTO | **J+30** | **oui** (`qualiopi-suivi-j30.tsx:37,42`) | 2ᵉ source ind. 30 |
| 7 | `qualiopi-enquete-entreprise` | `Votre avis sur la formation {titreFormation} — Axion-IA` (`qualiopi-enquete-entreprise.tsx:32`) | client entreprise | cron `formation-crons.enquete-entreprise-j30`, 08:15 UTC (`queues.ts:1481-1485`) → `handleEnqueteEntrepriseJ30` (`worker.ts:1036`) → `notifications-service.ts:696`. Relance : `notifications-service.ts:623` | AUTO | **J+30** | **non** — CTA = jeton public `/fr/portail/enquete/{token}` (`notifications-service.ts:632`) ; aucun espace client entreprise n'existe | ind. 30 exige ≥ 2 sources |
| 8 | `qualiopi-attestation-disponible` | `Votre {typeDocument} est disponible — Axion-IA` (`qualiopi-attestation-disponible.tsx:25`) | stagiaire | conséquence de génération : `attestation-service.ts:501`, atteint par le cron `formation-crons.attestations-auto` 09:00 UTC (`queues.ts:1456-1462` → `worker.ts:398`) **et** par l'action manuelle `evaluations.ts:158` | AUTO | **≈ J+1** (après clôture) | **oui** (`qualiopi-attestation-disponible.tsx:39,44`) | pièce due au stagiaire |
| 9 | `qualiopi-portail-acces` | `Votre lien d'accès à votre espace — Axion-IA` (`qualiopi-portail-acces.tsx:17`) | stagiaire | `demanderAccesParEmail` (`portail-service.ts:220`), depuis l'action publique `portail.ts:156` | AUTO | hors calendrier | **oui** — c'est son objet même (`:29,34`) | self-service anti-énumération |
| 10 | `qualiopi-alerte-interne` | `[CRITIQUE]/[IMPORTANT]/[INFO] Alerte Qualiopi — {titre} — Axion-IA` (`qualiopi-alerte-interne.tsx:23-25`) | **interne** | `notifierAlerteInterne` (`notifications-service.ts:807`), appelé par le cron `formation-crons.alertes` 07:00 UTC (`queues.ts:1495-1499` → `worker.ts:648`) | AUTO | hors calendrier | oui — console admin, ⚠️ **préfixe admin en dur** `/fr/admin-dev-x7k2n9/…` (`qualiopi-alerte-interne.tsx:39`) | une alerte retenue n'alerte plus |
| 11 | `qualiopi-relance-impayee` | 4 variantes selon `ton` — ex. `MISE EN DEMEURE — facture {n} impayée · Axion-IA` (`qualiopi-relance-impayee.tsx:81-90`) | client entreprise (payeur) | clic admin dans le hub facturation → `facturation-hub.ts:913`, après case à cocher de pointage bancaire | **MANU** | hors calendrier | **non** — CTA `lienFacture` sinon `/fr/contact` (`:124-126`) | retiré de la corbeille le 2026-08-02 : deux garages successifs = envoi qui n'a pas lieu (`outbox-policy.ts:37-52`) |
| 12 | `convention-envoi` | `Convention de formation à signer — {titre} — Axion-IA` (`convention-envoi.tsx:81`) | client entreprise (signataire) | clic admin `envoyerLienSignatureParEmailAction` (`piece-lien-signature.ts:488`), après `requireHabilitation("contresigner")` (`:456`) | **VALID** (`outbox-policy.ts:54`) | hors calendrier | **non** — seul lien = `signatureUrl` DocuSeal (`convention-envoi.tsx:96,106`) | engage juridiquement → relecture |
| 13 | `documents-nouvelle-version` | `Mise à jour — {slotTitre} ({interventionLabel}) — Axion-IA` (`documents-nouvelle-version.tsx:32`) | formateur / destinataire ressources | publication d'une version → `intervention-documents/notifications.ts:63` | AUTO | hors calendrier | **oui** — `portalUrl` vers `/fr/espace-ressources` (`notifications.ts:57`, rendu `documents-nouvelle-version.tsx:104-112`) | information de service |

### 2.2 Facturation / vente (5 gabarits)

| # | Gabarit | Objet réel | Destinataire | Déclencheur | Régime | Jalon | Lien espace | Motif |
|---|---|---|---|---|---|---|---|---|
| 14 | `devis-envoi` | `Votre devis {numero} — Axion-IA` (`devis-envoi.tsx:69`) | client | clic admin : `devis.ts:577` (envoi initial) **et** `facturation-emails.ts:116` (renvoi) | **VALID** (`outbox-policy.ts:53`) | hors cal. | **non** — `signatureUrl` conditionnel (`devis-envoi.tsx:82,89`) | engage un prix |
| 15 | `facture-envoi` | `Votre facture {n} — Axion-IA` / `Votre avoir {n} — Axion-IA` (`facture-envoi.tsx:68`) | client | clic admin `facturation-emails.ts:251` | **VALID** (`outbox-policy.ts:55`) | hors cal. | **non** — aucun CTA (`facture-envoi.tsx:88-92`) | facturer = acte engageant |
| 16 | `payment-link` | `Lien de paiement acompte — {invoiceNumber} — Axion-IA` (`payment-link.tsx:42`) | client | clic admin `features/contract/admin-actions.ts:406` | MANU | hors cal. | **non** — CTA Stripe (`:59`) | appel de fonds |
| 17 | `payment-receipt` | `Paiement reçu — {invoiceNumber} — Axion-IA` (`payment-receipt.tsx:48`) | client | webhook Stripe `app/api/stripe/webhook/route.ts:268` | **DORMANT** — la route renvoie 404 si `!isStripeConfigured()` (`route.ts:70-72`) ; 0 ligne en prod (`route.ts:64-66`) | hors cal. | non — CTA vers `/mes-donnees/booking/{id}` (`:71`) 🔴 route inexistante | webhook |
| 18 | `payment-failed` | `Paiement non abouti — {invoiceNumber} — Axion-IA` (`payment-failed.tsx:49`) | client | webhook Stripe `route.ts:311` | **DORMANT** (même gate) | hors cal. | non (`:63-65`) | webhook |

### 2.3 Booking / options / cadrage / devis-contrats hérités (31 gabarits)

⚠️ Contexte transverse : les crons `booking-crons` **ne sont planifiés que si `LEGACY_BOOKING_WORKERS_ENABLED=true`** (`queues.ts:879`, `:1076-1086`). Le drapeau est OFF par défaut (`queues.ts:783-797`). Idem pour `option-expiration` (`:881-895`) et `option-reminder` (`:897-911`).

| # | Gabarit | Objet réel | Destinataire | Déclencheur | Régime | Jalon | Lien espace | Motif |
|---|---|---|---|---|---|---|---|---|
| 19 | `booking-confirmed` | `Votre intervention Axion-IA est réservée — {bookingDate}` (`booking-confirmed.tsx:43`) | client | 🔴 **aucun** | **SANS APPELANT** | — | non (`:61`) | — |
| 20 | `booking-cancelled` | `Réservation annulée — Axion-IA` (`booking-cancelled.tsx:36`) | client | action admin `features/admin-calendar/actions.ts:383` | MANU | hors cal. | non (`:54`) | annulation décidée par un humain |
| 21 | `booking-validated-on-calendar` | `Intervention Axion-IA confirmée — {bookingDate}` (`booking-validated-on-calendar.tsx:47`) | client | admin `features/booking/admin-actions.ts:532` **+** client `self-service-actions.ts:289` | MANU + AUTO | hors cal. | non — `/mes-donnees/booking/{id}` (`:65`) 🔴 route inexistante | validation calendaire |
| 22 | `booking-paused-confirmation` | `Intervention mise en pause — Axion-IA` (`booking-paused-confirmation.tsx:51`) | client | admin `admin-actions.ts:190` | MANU | hors cal. | non (`:67`) 🔴 route inexistante | décision admin |
| 23 | `booking-resumed-notification` | `Intervention reprogrammée — {resumedDate} — Axion-IA` (`booking-resumed-notification.tsx:44`) | client | admin `admin-actions.ts:276` | MANU | hors cal. | non (`:62`) 🔴 idem | décision admin |
| 24 | `booking-rescheduled-by-admin` | `Nouvelle date pour votre intervention — {newDate} — Axion-IA` (`booking-rescheduled-by-admin.tsx:68`) | client | admin `features/booking/reschedule-actions.ts:176` | MANU | hors cal. | non (`:90`) | décision admin |
| 25 | `booking-j1-reminder` | `Votre intervention, c'est demain — {interventionType} — Axion-IA` (`booking-j1-reminder.tsx:64`) | client | cron `booking-j1-reminder` (`queues.ts:1041`) → `booking-crons-worker.ts:215` | **DORMANT** | J-1 | non (`:85`) | cron éteint |
| 26 | `booking-completed-thanks` | `Merci {contactName} pour votre confiance — Axion-IA` (`booking-completed-thanks.tsx:66`) | client | cron `booking-completed-thanks-sweep` 18:00 (`queues.ts:1069-1073`) → `worker.ts:554` | **DORMANT** | J+1 | non (`:87`) | cron éteint |
| 27 | `force-majeure-notice` | `Force majeure — intervention annulée — Axion-IA` (`force-majeure-notice.tsx:42`) | client | admin `admin-actions.ts:429` | MANU | hors cal. | non (`:59`) | décision admin |
| 28 | `option-posted` | `Option 48h sur le {bookingDate} — Axion-IA` (`option-posted.tsx:41`) | client | 🔴 **aucun** | **SANS APPELANT** | — | non (`:58`) | — |
| 29 | `option-reminder` | `Rappel : option 48h expire dans 24h — Axion-IA` (`option-reminder.tsx:36`) | client | cron horaire → `option-reminder-worker.ts:47` | **DORMANT** (`queues.ts:897-911`) | H+24 | non (`:53`) | cron éteint |
| 30 | `option-expired` | `Option 48h expirée — Axion-IA` (`option-expired.tsx:33`) | client | cron 5 min → `option-expiration-worker.ts:101` | **DORMANT** (`queues.ts:881-895`) | H+48 | non (`:49`) | cron éteint |
| 31 | `option-confirmed-by-admin` | `Option confirmée — intervention Axion-IA réservée` (`option-confirmed-by-admin.tsx:38`) | client | admin `features/admin-options/actions.ts:231` | MANU | hors cal. | non (`:55`) | décision admin |
| 32 | `option-refused-by-admin` | `Option non retenue — Axion-IA` (`option-refused-by-admin.tsx:36`) | client | admin `features/admin-options/actions.ts:338` | MANU | hors cal. | non (`:52`) | décision admin |
| 33 | `cadrage-scheduled` | `Cadrage Axion-IA planifié` (`cadrage-scheduled.tsx:47`) | client | admin `features/booking/cadrage-actions.ts:166` | MANU | hors cal. | non — lien Google Calendar (`:72`) | planification humaine |
| 34 | `cadrage-declined` | `Cadrage Axion-IA — non retenu` (`cadrage-declined.tsx:42`) | client | admin `cadrage-actions.ts:297` | MANU | hors cal. | non (`:58`) | refus humain |
| 35 | `cadrage-j1-reminder` | `Votre call de cadrage, c'est demain — Axion-IA` (`cadrage-j1-reminder.tsx:65`) | client | cron `cadrage-j1-reminder` (`queues.ts:1042`) → `worker.ts:262` | **DORMANT** | J-1 | non (`:80`) | cron éteint |
| 36 | `cadrage-h2-reminder` | `Votre call commence dans 2 heures — Axion-IA` (`cadrage-h2-reminder.tsx:62`) | client | cron horaire (`queues.ts:1043`) → `worker.ts:310` | **DORMANT** | H-2 | non (`:77`) | cron éteint |
| 37 | `quote-request-received` | `Demande de devis reçue — Axion-IA` (`quote-request-received.tsx:55`) | prospect | formulaire unifié type `devis` → `unified-contact/actions.ts:122` puis `:336` | AUTO | J0 dépôt | s.o. | accusé de réception |
| 38 | `quote-sent` | `Devis {quoteNumber} — Axion-IA` (`quote-sent.tsx:38`) | client | admin `features/booking/quote-actions.ts:340` | MANU | hors cal. | non (`:51-53`) | engage un prix |
| 39 | `quote-signed` | `Devis {quoteNumber} signé — étape contrat — Axion-IA` (`quote-signed.tsx:34`) | client | **conséquence de signature** : webhook DocuSeal `app/api/docuseal/webhook/route.ts:299` ; aussi `quote-actions.ts:432` | AUTO (webhook) | hors cal. | non (`:52`) | événement de signature |
| 40 | `quote-declined` | `Devis {quoteNumber} non retenu — Axion-IA` (`quote-declined.tsx:35`) | client | webhook DocuSeal `route.ts:330` ; aussi `quote-actions.ts:512` | AUTO (webhook) | hors cal. | non (`:53`) | événement de refus |
| 41 | `quote-reminder` | `Votre devis {quoteNumber} est toujours valable — Axion-IA` (`quote-reminder.tsx:65`) | client | 🔴 **aucun** — le cron `quote-pending-reminder` ne fait que PROPOSER une relance, verrouillé par `relances-manuelles-garde-fou.spec.ts:36-42` | **SANS APPELANT** | — | non (`:82`) | règle « relances 100 % manuelles » |
| 42 | `quote-expired` | `Votre devis {quoteNumber} a atteint sa date de validité — Axion-IA` (`quote-expired.tsx:58`) | client | cron `quote-expiration-check` (`queues.ts:1054-1058`) → `worker.ts:440` | **DORMANT** | hors cal. | non (`:74`) | cron éteint |
| 43 | `contract-sent` | `Votre contrat est prêt à signer — Axion-IA` (`contract-sent.tsx:55`) | client | 🔴 **aucun** — pourtant déclaré en corbeille (`outbox-policy.ts:56`) | **SANS APPELANT** | — | non (`:70`) | — |
| 44 | `contract-signed` | `Votre contrat est signé — merci ! — Axion-IA` (`contract-signed.tsx:53`) | client | 🔴 **aucun** | **SANS APPELANT** | — | non (`:68`) | — |
| 45 | `contract-refused` | `Votre décision concernant le contrat — Axion-IA` (`contract-refused.tsx:61`) | client | 🔴 **aucun** | **SANS APPELANT** | — | non (`:77`) | — |
| 46 | `contract-reminder` | `Rappel : votre contrat attend votre signature — Axion-IA` (`contract-reminder.tsx:55`) | client | cron `contract-pending-reminder` (`queues.ts:1044-1048`) → `worker.ts:350` | **DORMANT** + VALID (`outbox-policy.ts:57`) | hors cal. | non (`:70`) | cron éteint ; et relance = relecture |
| 47 | `contract-version-updated` | `Nouvelle version de votre contrat à signer — Axion-IA` (`contract-version-updated.tsx:57`) | client | admin `features/contract/admin-actions.ts:572` et `:706` | MANU | hors cal. | non (`:73`) | révision décidée par un humain |
| 48 | `payment-reminder-j7` | `Rappel : votre facture arrive à échéance — Axion-IA` (`payment-reminder-j7.tsx:69`) | client | cron `booking-j7-reminder` (`queues.ts:1040`) → `booking-crons-worker.ts:176` | **DORMANT** | J-7 avant intervention | non (`:92`) | cron éteint |
| 49 | `payment-overdue-j1` | `Votre facture {n} arrivée à échéance — Axion-IA` (`payment-overdue-j1.tsx:69`) | client | 🔴 **aucun** — retiré par la règle « relances manuelles » (`relances-manuelles-garde-fou.spec.ts:28-34`) | **SANS APPELANT** | — | non (`:92`) | le cron détecte, l'humain envoie |
| 50 | `payment-overdue-j15` | `Votre facture {n} reste à régler — Axion-IA` (`payment-overdue-j15.tsx:79`) | client | 🔴 **aucun** (idem) | **SANS APPELANT** | — | non (`:103`) | idem |
| 51 | `payment-overdue-j30` | `Dernier rappel : votre facture {n} — Axion-IA` (`payment-overdue-j30.tsx:83`) | client | 🔴 **aucun** (idem) | **SANS APPELANT** | — | non (`:107`) | idem |
| 52 | `installment-overdue-soft` | `Rappel — échéance en attente {n} — Axion-IA` (`installment-overdue-soft.tsx:74`) | client | 🔴 **aucun** | **SANS APPELANT** | — | non (`:94`) | — |
| 53 | `installment-overdue-firm` | `Échéance en attente de règlement {n} — Axion-IA` (`installment-overdue-firm.tsx:84`) | client | 🔴 **aucun** | **SANS APPELANT** | — | non (`:104`) | — |
| 54 | `disputed-notice` | `Votre facture {n} en attente de règlement — Axion-IA` (`disputed-notice.tsx:81`) | client | 🔴 **aucun** — auto-documenté `disputed-notice.tsx:9-11` | **SANS APPELANT** | — | non (`:101`) | — |
| 55 | `refund-issued` | `Remboursement effectué — Axion-IA` (`refund-issued.tsx:40`) | client | admin `features/booking/refund-actions.ts:291` | MANU | hors cal. | non (`:56`) 🔴 route inexistante | remboursement = acte engageant |
| 56 | `cancellation-confirmed-by-user` | `Annulation confirmée — Axion-IA` (`cancellation-confirmed-by-user.tsx:43`) | client | client `self-service-actions.ts:179` ; admin `refund-actions.ts:281` | AUTO + MANU | hors cal. | non (`:59`) | confirmation d'un acte du client |

### 2.4 Formulaires publics, accusés, RGPD, magic-links, vivier (19 gabarits)

| # | Gabarit | Objet réel | Destinataire | Déclencheur | Régime | Jalon | Lien espace | Motif |
|---|---|---|---|---|---|---|---|---|
| 57 | `audit-confirmed` | `Demande d'audit reçue — Axion-IA` (`audit-confirmed.tsx:37`) | prospect | `unified-contact/actions.ts:115` puis `:336` | AUTO | J0 dépôt | s.o. | accusé de réception |
| 58 | `implementation-confirmed` | `Demande d'implémentation reçue — Axion-IA` (`implementation-confirmed.tsx:40`) | prospect | `unified-contact/actions.ts:117` puis `:336` | AUTO | J0 | s.o. | idem |
| 59 | `contact-confirmed` | `Message bien reçu — Axion-IA` (`contact-confirmed.tsx:32`) | prospect (9 types) | `unified-contact/actions.ts:134` puis `:336` | AUTO | J0 | s.o. | idem |
| 60 | `newsletter-confirm-optin` | `Confirmez votre inscription — Axion-IA` (`newsletter-confirm-optin.tsx:32`) | prospect | `features/newsletter/actions.ts:118`, `marketing: true` (`:126`) | AUTO | J0 | s.o. | double opt-in |
| 61 | `roi-report` | `Votre estimation : {montant} par an — Axion-IA` (`roi-report.tsx:87`) | prospect | `features/roi-report/actions.ts:213` | AUTO | J0 | s.o. — mais lien PERMANENT vers le rapport (`:120`) | livraison du rapport demandé |
| 62 | `rappel-confirme` | `On vous rappelle — Axion-IA` (`rappel-confirme.tsx:47`) | prospect | `features/roi-report/actions.ts:332` | AUTO | J0 | s.o. | accusé |
| 63 | `podcast-demande-recue` | `Votre demande de tournage podcast — Axion-IA` (`podcast-demande-recue.tsx:55`) | prospect | `features/podcast-request/actions.ts:126` | AUTO | J0 | s.o. | accusé |
| 64 | `chatbot-demande-transmise` | `Votre demande est transmise — Axion-IA` (`chatbot-demande-transmise.tsx:57`) | prospect | `chatbot/tools/capturer-lead.ts:175` **et** `chatbot/tools/escalader-question.ts:74` | AUTO | J0 | s.o. | accusé |
| 65 | `candidature-recue` | `Votre candidature est bien arrivée — Axion-IA` (`candidature-recue.tsx:58`) | candidat | `features/job-application/actions.ts:377` | AUTO | J0 | s.o. | accusé |
| 66 | `avis-recu` | `Merci pour votre avis — Axion-IA` (`avis-recu.tsx:46`) | client | `features/review-submission/actions.ts:249` | AUTO | J0 | s.o. | accusé |
| 67 | `candidature-commercial-confirmee` | `On a bien reçu ta candidature — Axion-IA` (`candidature-commercial-confirmee.tsx:44`) | candidat commercial | `features/commercial-application/actions.ts:353` | AUTO | J0 | s.o. | accusé |
| 68 | `candidature-commercial-recap` | `[CANDIDATURE COMMERCIAL] {Prénom Nom} — {ville}` (`candidature-commercial-recap.tsx:56`) | **interne** | `features/commercial-application/actions.ts:366`, destinataire résolu `:69-71` | AUTO | J0 | oui (console admin, `:100`) | notification interne |
| 69 | `gdpr-export-link` | `Votre export RGPD — Axion-IA` (`gdpr-export-link.tsx:34`) | personne concernée | `app/api/gdpr-export/request/route.ts:50` | AUTO | J0 | s.o. — lien expirant (`:49`) | droit d'accès art. 15 |
| 70 | `rgpd-demande-recue` | `Votre demande RGPD a bien été reçue — Axion-IA` (`rgpd-demande-recue.tsx:61`) | stagiaire | `portail/rgpd-service.ts:415` | AUTO | J0 (départ du délai d'1 mois) | 🔴 **non** — le destinataire A un espace | preuve de dépôt art. 12.3 |
| 71 | `rgpd-effacement-confirme` | `Confirmation : vos données ont été effacées — Axion-IA` (`rgpd-effacement-confirme.tsx:73`) | personne concernée | `app/api/gdpr-erase/route.ts:139` | AUTO | J0 | s.o. | preuve art. 17, irrattrapable après anonymisation (`route.ts:125-134`) |
| 72 | `formateur-magic-link` | `Votre lien de connexion — Espace formateur Axion-IA` (`formateur-magic-link.tsx:17`) | **formateur** | self-service `actions/formateur/auth.actions.ts:79` ; admin `coaching-admin/formateurs.actions.ts:60` | AUTO + MANU | hors cal. | **oui** — lien 15 min (`:60`) **et** adresse permanente (`:41-44`, `:104`) | authentification |
| 73 | `ressources-magic-link` | `Votre lien de connexion — Espace ressources Axion-IA` (`ressources-magic-link.tsx:17`) | commercial / formateur | `actions/ressources/auth.actions.ts:64` | AUTO | hors cal. | **oui** — lien 15 min seul (`:44`), ⚠️ **pas d'adresse permanente** | authentification |
| 74 | `submission-reply` | `{payload.subject}`, repli `Réponse — Axion-IA` (`submission-reply.tsx:27`) | prospect / demandeur | admin `features/admin-submissions/reply-actions.ts:147` (1ʳᵉ réponse) et `:370` (suite) | MANU | hors cal. | s.o. | réponse rédigée par un humain |
| 75 | `vivier-information` | `Votre candidature chez Axion-IA — conservation dans notre vivier` (`vivier-information.tsx:40`) | candidat | cron `vivier-integrate-stock` 05:00 UTC (`queues.ts:1019-1025`) → `server/vivier/stock.ts:136`, `bypassValidation: true` (`:152`) | AUTO | hors cal. | s.o. — lien d'opposition signé (`:66`) | information RGPD obligatoire, pas une sollicitation (`stock.ts:149-152`) |

**Total : 75.**

Chemin transverse non compté comme gabarit : `email-outbox.ts:111-125` peut réémettre **n'importe lequel** des 75 après approbation en corbeille.

---

## 3. 🔴 Gabarits SANS AUCUN APPELANT — 12

Vérification : recherche du littéral de chaque clé dans `src/**`, hors `src/lib/email/templates/`, hors `.spec`/`.test`. Résultat = uniquement `src/server/queue/types.ts` (la déclaration) et, pour deux d'entre eux, `outbox-policy.ts`.

| Gabarit | Ce que le gabarit promet | Pourquoi c'est un mensonge en attente |
|---|---|---|
| `booking-confirmed` | « Votre intervention est **confirmée** » | promesse de confirmation sans émetteur |
| `option-posted` | pose d'une option 48 h | aucune option n'est jamais posée |
| `contract-sent` | « Votre contrat est prêt à signer » | 🔴 **et il figure dans `EMAILS_A_VALIDER_PAR_DEFAUT` (`outbox-policy.ts:56`)** : une corbeille de validation existe pour un envoi qui n'a aucun émetteur |
| `contract-signed` | « signé par les deux parties » + « vous recevrez le PDF final » | promet un second e-mail qui n'existe dans aucun gabarit |
| `contract-refused` | prise en compte d'un refus | — |
| `payment-overdue-j1` | relance J+1 | remplacé par `RelanceProposee` + clic admin (`booking-crons-worker.ts:76-79`) |
| `payment-overdue-j15` | relance J+15 | idem |
| `payment-overdue-j30` | relance J+30 | idem |
| `installment-overdue-soft` | relance douce d'échéancier | — |
| `installment-overdue-firm` | relance ferme d'échéancier | — |
| `disputed-notice` | traitement d'un litige | 🔴 auto-documenté « PAS encore enqueué » (`disputed-notice.tsx:9-11`), et son corps est un doublon de `payment-overdue-j30.tsx:43-52` — la clé annonce un litige, le texte relance un impayé |
| `quote-reminder` | relance de devis | verrouillé volontairement par `relances-manuelles-garde-fou.spec.ts:36-42` |

**Lecture** : sur ces 12, **8 sont des reliquats assumés** de la bascule « relances 100 % manuelles » (les 3 `payment-overdue-*`, les 2 `installment-overdue-*`, `disputed-notice`, `quote-reminder`) et l'absence d'appelant y est la règle, pas le défaut — mais rien dans le code ne le DIT au niveau du gabarit lui-même (seul `disputed-notice.tsx:9-11` le fait). **4 sont de véritables trous** : `booking-confirmed`, `option-posted`, `contract-sent`, `contract-signed`/`contract-refused` — le cycle contrat entier n'a aucun émetteur alors que 5 gabarits l'attendent.

### 3.b Gabarits à appelant DORMANT — 11

Distincts des précédents : l'appelant existe, il n'est simplement jamais exécuté.

- **9 par le drapeau `LEGACY_BOOKING_WORKERS_ENABLED`** (OFF, `queues.ts:783-797`, `:879`) : `option-reminder`, `option-expired`, `booking-j1-reminder`, `booking-completed-thanks`, `cadrage-j1-reminder`, `cadrage-h2-reminder`, `contract-reminder`, `payment-reminder-j7`, `quote-expired`.
- **2 par la configuration Stripe** (`route.ts:70-72`, route 404, « 0 ligne dans `stripe_webhook_events` » `route.ts:64-66`) : `payment-receipt`, `payment-failed`.

**Conséquence** : sur 75 gabarits, **23 (12 + 11) ne peuvent structurellement rien envoyer aujourd'hui**. Le nombre de gabarits réellement vivants est de **52**.

### 3.c 🔴 La garde « Qualiopi part toujours seul » a ZÉRO appelant

`estEmailQualiopiAutomatique()` est définie en `src/server/email/outbox-policy.ts:170-172`. Les seules autres occurrences du symbole dans tout le dépôt sont son propre test (`outbox-policy.spec.ts:16,122,124`). **Aucun code de production ne l'appelle.**

Ce qui protège réellement la chaîne Qualiopi aujourd'hui n'est pas cette fonction, mais le fait que `modeParDefaut()` (`outbox-policy.ts:164-167`) ne consulte QUE `EMAILS_A_VALIDER_PAR_DEFAUT` et renvoie `"auto"` par défaut. **La liste `EMAILS_AUTOMATIQUES_PAR_DEFAUT` (`outbox-policy.ts:64-77`) n'est donc lue par aucun chemin d'exécution.** Elle est documentaire.

⚠️ Effet réel : une règle `EmailAutomationSetting` de portée **globale et template `null`** en mode `validation` (résolution `outbox-policy.ts:148-154`, cas 4) mettrait **toute la chaîne Qualiopi en corbeille**, convocation comprise — exactement ce que la liste prétend interdire. Rien ne l'en empêche.

---

## 4. 🔴 Les corps qui mentent

Classés par gravité. Chaque entrée cite le texte exact et sa ligne.

### 4.1 Le corps affirme un fait faux au moment où il part

| # | Gabarit | Texte | Preuve de fausseté |
|---|---|---|---|
| M1 | `refund-issued` | « Nous vous confirmons le remboursement de **undefined** sur la facture **undefined**, traité le **undefined**. » (`refund-issued.tsx:23`) | l'appelant envoie `amountRefunded` / `stripeRefundId` / `bookingId` (`refund-actions.ts:291-296`), le gabarit lit `refundAmount` / `invoiceNumber` / `processedAt` (`refund-issued.tsx:11-16`) |
| M2 | `cancellation-confirmed-by-user` | « Conformément à nos CGV, **l'acompte est conservé** pour cette fenêtre d'annulation. » (`:21`) | le gabarit teste `p.refundPercentage > 0` (`:65`) ; l'appelant admin ne transmet pas ce champ (`refund-actions.ts:281-288`) → toujours faux, **y compris quand un remboursement Stripe vient d'être déclenché** (`refund-actions.ts:290-296`). Plus « Référence : undefined » (`:24,69`) |
| M3 | `payment-reminder-j7` | « votre facture **concernée** d'un montant de **restant dû** arrive à échéance le **son échéance** » (`:42`) | le cron envoie `{contactName, interventionType, bookingDate, balanceAmount}` (`booking-crons-worker.ts:176-185`), le gabarit attend `invoiceNumber`/`amountTtc`/`dueDate` et tombe sur ses replis (`:84-90`). **Aucune facture n'est en réalité à échéance ce jour-là** : le cron cible une INTERVENTION à J+7 |
| M4 | `booking-confirmed` | « Votre intervention est **confirmée** » (`:24`), objet « est **réservée** » (`:43`) | contredit mot pour mot par `quote-signed.tsx:18` : « L'intervention ne sera officiellement verrouillée qu'après réception de l'acompte » |
| M5 | `booking-paused-confirmation` | « est mise en pause…, **conformément à notre échange**. » (`:23`) | `pauseBookingAction` est unilatérale côté admin (`admin-actions.ts:190`) ; aucun consentement client n'est enregistré |
| M6 | `contract-signed` | « désormais **signé par les deux parties** » (`:31`) puis « Vous recevrez sous peu, par email séparé, **le PDF final** » (`:32`) | rien ne garantit la contre-signature à cet instant ; et **aucun gabarit d'envoi de PDF de contrat n'existe** dans `EmailJobName` |
| M7 | `payment-failed` | « Le créneau reste **pré-réservé pendant 48 h** » (`:28`) | aucune logique de hold n'est branchée ; contredit par `option-expired.tsx:18` (« le créneau redevient disponible ») |
| M8 | `force-majeure-notice` | « Un **remboursement complet** sera traité sous 5 à 10 jours ouvrés. » (`:22`) | `markForceMajeureAction` (`admin-actions.ts:429`) enfile l'e-mail et rien d'autre — aucun refund Stripe ; l'en-tête du fichier relativise lui-même (`:4`) |
| M9 | `rgpd-effacement-confirme` | « Ce message est le **dernier** que vous recevrez… votre adresse **ne figure plus** dans nos fichiers. » (`:49`) | le layout colle ensuite le footer d'acquisition (réseaux sociaux, tagline commerciale, « Contact ») — `_layout.tsx:408-443` |
| M10 | `qualiopi-enquete-entreprise` | « **Il y a un mois**, {raisonSociale} nous confiait la formation… » (`:54-55`) | phrase EN DUR, alors que le même gabarit sert de relance (`notifications-service.ts:618-636`) : à la 2ᵉ relance on est à ≈ J+43 |
| M11 | `qualiopi-attestation-disponible` | « Ce document officiel **atteste de votre participation**. » (`:57`) | `typeDocument` peut valoir « attestation partielle » (`:12`) — le document constate alors l'inverse. Aucune variante de formulation |
| M12 | `qualiopi-suivi-j30` | « Retrouvez également vos documents (**attestation**, supports) dans votre espace » (`:56`) | envoyé à J+30 sans conditionner sur l'existence effective de l'attestation |
| M13 | `qualiopi-convocation` | « Quelques jours avant la session, **vous recevrez** votre lien personnel de signature de présence » (`:29-30`) | la livraison est conditionnelle : le rappel J-7 n'affiche le lien que s'il est le PREMIER à en mettre un en circulation (`qualiopi-rappel-j7.tsx:17-23`, `notifications-service.ts:80-96`) — et le J-7 lui-même ne part pas pour une inscription tardive (cf. §6, T2) |
| M14 | `documents-nouvelle-version` | « **Liens valables 14 jours.** » (`:94`) | le TTL réel dépend de la signature R2 (`intervention-documents/notifications.ts:47,55-56`) ; l'en-tête du fichier dit « ~14 jours » (`:4`) — l'approximation devient une certitude dans le corps |

### 4.2 Le corps promet un délai que rien ne tient

| # | Gabarit | Texte | Contradiction |
|---|---|---|---|
| M15 | `audit-confirmed` | « revient vers vous **sous 48 heures ouvrées** » (`:20`) + « Vous recevrez un rapport actionnable… » (`:21`) | `candidature-recue.tsx:4-14` documente cette promesse de 48 h comme FAUSSE et l'a retirée — côté candidats seulement. Et le rapport est décrit comme dû alors que rien n'est vendu |
| M16 | `implementation-confirmed` | « **sous 48 heures ouvrées** » (`:19`) + « **Tous nos déploiements** sont hébergés sur infrastructure UE Hetzner » (`:20`) | idem ; la seconde est une affirmation absolue vérifiable, fausse dès qu'un tiers intervient |
| M17 | `contact-confirmed` | « **sous 48 heures ouvrées** » (`:16`) + « intervention **sous 7 jours** » (`:17`) | idem, dans un accusé automatique |
| M18 | `candidature-commercial-confirmee` | « Compte **quelques jours ouvrés** pour notre retour » (`:23`) puis « **Pense à vérifier tes spams** si tu n'as pas de nouvelles » (`:24`) | contredit frontalement la doctrine de `candidature-recue.tsx:4-14`. Deux candidats reçoivent deux politiques opposées selon le formulaire emprunté ; et l'e-mail organise par avance l'excuse de son propre silence |

### 4.3 Le corps s'adresse au mauvais public

| # | Gabarit | Constat |
|---|---|---|
| M19 | `contact-confirmed` | sert d'accusé à **9 types** de formulaire (`unified-contact/actions.ts:125-134`) : un journaliste, un investisseur, un partenaire, un demandeur de support reçoivent un texte de prospect commercial |
| M20 | `candidature-commercial-recap` | e-mail **interne** rendu avec le layout **public** : CV complet du candidat (`:120-146`) sous la tagline commerciale et les liens Facebook personnels du fondateur, avec un lien direct vers la console admin (`:100`) et le nom du candidat en clair dans l'objet (`:56`). Aucun marqueur « ne pas transférer » |
| M21 | `submission-reply` | eyebrow « Un mot de **Williams** » (`:154`) et signature forcée à « Williams » (`:144`) quel que soit l'auteur réel. Et c'est le **seul** des 75 à afficher le bandeau Qualiopi + note d'avis (`:159`) — une réponse à une réclamation porte donc un argumentaire de vente |
| M22 | `vivier-information` | corps validé juridiquement, dont l'en-tête interdit toute « accroche commerciale » (`:14-15`) — mais le layout en ajoute une (`_layout.tsx:251`) et n'expose **aucun lien de désinscription** (`unsubscribeHref` non passé, `:61-68`) |
| M23 | `rgpd-demande-recue` | e-mail à valeur probante portant la tagline commerciale et les réseaux sociaux personnels du fondateur (`_layout.tsx:251`, `:414-425`) |

### 4.4 Le corps garde un piège actif (non déclenché aujourd'hui)

| # | Gabarit | Constat |
|---|---|---|
| M24 | `qualiopi-questionnaire-relance` | « **Vous avez suivi la formation {titre}** et votre {libellé} attend toujours votre réponse. » (`:53`). Corrigé pour le type `positionnement` par un re-routage (`notifications-service.ts:637-653`), mais le garde-fou est un `else if` sur ce SEUL type : la branche `else` (`:654-668`) attrape tout autre type. Le repli `?? "questionnaire"` (`:616`) montre qu'un nouveau type non-satisfaction y retomberait. **Fragilité structurelle, pas bug actif.** |
| M25 | `qualiopi-portail-acces` | « Vous avez **demandé** un nouveau lien… » (`:39`) et « si vous n'êtes pas à l'origine de cette demande, **vous pouvez ignorer cet email** » (`:43-44`). Exact aujourd'hui (seul appelant : `portail-service.ts:205-224`, self-service). C'est ce gabarit qui portait le positionnement jusqu'au 2026-08-15 (`questionnaires.ts:118-127`). **À ne jamais réutiliser pour un envoi non sollicité.** |

### 4.5 ⚠️ L'e-mail de convention — vérification demandée

**Verdict : confirmé. Le corps ne nomme ni le montant, ni les dates, ni la durée, ni le lieu.**

Le défaut est en amont, **dans le payload** : `piece-lien-signature.ts:492-499` n'envoie que `signataireNom`, `clientNom`, `numero`, `titreFormation`, `signatureUrl`, et un `messagePersonnalise` optionnel. **Aucun champ montant ni date n'existe dans l'interface `Payload` du gabarit** (`convention-envoi.tsx:23-36`).

Intégralité du corps textuel rendu (`convention-envoi.tsx:44-57`, rendu `:108-133`) :

1. `Votre convention de formation à signer` (bandeau, `:45`)
2. `Bonjour {signataireNom},` (`:46` → `:108`)
3. le `messagePersonnalise` de l'admin, **s'il existe** (`:109-114`) — seul endroit possible pour un montant ou une date, ni garanti ni structuré
4. `La convention de formation professionnelle relative à « {titreFormation} », établie avec {clientNom}, est prête à être signée.` (`:48` → `:116`)
5. `Le lien ci-dessous ouvre la convention : vous pouvez la lire intégralement avant de signer, puis apposer votre signature en ligne.` (`:50` → `:118`)
6. `Ce lien vous est personnel et vaut signature : merci de ne pas le transférer.` (`:52`)
7. `Référence du document : {numero}` (`:53`)
8. `Pour toute question sur le contenu ou les modalités, répondez simplement à cet email` (`:55`)
9. `Bien cordialement, / L'équipe Axion-IA` (`:56`)
10. CTA `Signer la convention` → `signatureUrl` (`:51` → `:106`). **Si `signatureUrl` est vide, aucun bouton n'est rendu et l'e-mail ne porte plus aucun lien** (`:103-106`)

Aucune pièce jointe (choix explicite, `:15-17`).

**Conséquence** : un signataire reçoit une demande de signature engageante dans laquelle rien ne lui rappelle le prix, les dates, la durée ni le lieu de ce qu'il engage. Par contraste, `devis-envoi.tsx:43-44` et `facture-envoi.tsx:37,40-43` nomment tous deux montant et échéance dans le corps.

---

## 5. Les envois SANS lien vers l'espace alors que le destinataire EN A UN

Doctrine du plan : *l'e-mail annonce et rappelle, l'espace conserve*.

Trois publics disposent d'un espace : **stagiaire** (`/fr/portail/mon-espace`, `portail-service.ts`), **formateur** (`/fr/espace-formateur`, `formateur-magic-link.tsx:41-44`), **destinataire ressources** (`/fr/espace-ressources`, `intervention-documents/notifications.ts:57`).

### 5.1 Les envois qui portent bien un lien d'espace — 8

`qualiopi-convocation` (`:57,62`) · `qualiopi-rappel-j7` (`:46,51`) · `qualiopi-suivi-j30` (`:37,42`) · `qualiopi-attestation-disponible` (`:39,44`) · `qualiopi-portail-acces` (`:29,34`) · `qualiopi-questionnaire-relance` (`:43,48`, alimenté par `getOrCreatePortailLien`, `notifications-service.ts:655`) · `formateur-magic-link` (`:60` + adresse permanente `:41-44`) · `ressources-magic-link` (`:44`) · `documents-nouvelle-version` (`:104-112`).

⚠️ Précision par rapport à l'hypothèse de départ (« seule la convocation porte un `lienPortail` ») : **c'est inexact au 16/08**. Six gabarits de la chaîne Qualiopi portent un lien d'espace. Deux le portent **en repli seulement** (`qualiopi-positionnement.tsx:62`, `qualiopi-questionnaire-relance.tsx:43` : `p.lienQuestionnaire ?? …/mon-espace`), ce qui, en nominal, envoie vers le questionnaire et non vers l'espace.

### 5.2 🔴 Les envois SANS lien alors que le destinataire a un espace — 3

| Gabarit | Destinataire | Constat |
|---|---|---|
| `qualiopi-satisfaction-j1` | stagiaire | CTA = `p.lienQuestionnaire` **sans aucun repli portail** (`:40`). C'est le seul gabarit stagiaire de la chaîne dépourvu de toute porte vers l'espace : si le lien de questionnaire est mort, le stagiaire n'a nulle part où aller |
| `rgpd-demande-recue` | stagiaire (titulaire d'un accès portail) | aucun CTA du tout (`:74`) — alors que la demande a précisément été déposée DEPUIS le portail (`rgpd-service.ts:415`) |
| `ressources-magic-link` | commercial / formateur | porte le lien magique 15 min (`:44`) mais **pas l'adresse permanente de l'espace**, contrairement à `formateur-magic-link.tsx:86-95` qui documente ce besoin (« un formateur qui revient la semaine suivante n'a aucun moyen de retrouver son espace »). Le correctif n'a pas été propagé |

### 5.3 Le cas particulier du client entreprise

`qualiopi-enquete-entreprise` (`:49`), `convention-envoi` (`:96`), `devis-envoi` (`:82`), `facture-envoi` (aucun CTA, `:88-92`), `qualiopi-relance-impayee` (`:124-126`) ne portent pas de lien d'espace — **mais aucun espace client entreprise n'existe** dans le code. Ce n'est donc pas un défaut de gabarit, c'est un manque de produit : le financeur / client entreprise n'a aucun endroit où retrouver ses conventions, devis et factures.

### 5.4 ⚠️ Cinq CTA pointent vers une route inexistante

`${baseUrl}/${locale}/mes-donnees/booking/{bookingId}` — seules `src/app/[locale]/mes-donnees/page.tsx` et `.../export/page.tsx` existent ; il n'y a pas de segment `booking/[id]`.

Concernés : `booking-validated-on-calendar.tsx:65` · `booking-paused-confirmation.tsx:67` · `booking-resumed-notification.tsx:62` · `payment-receipt.tsx:71` · `refund-issued.tsx:56`.

Quatre autres CTA pointent vers `/confirmation` avec un query param que la page ignore (`src/app/[locale]/confirmation/page.tsx:16,46` ne lit que `?type=`) : `booking-confirmed.tsx:61` (`?id=`), `option-posted.tsx:58` (`?option=`), `option-reminder.tsx:53`, `option-confirmed-by-admin.tsx:55`.

Et **19 gabarits** utilisent un repli `${SITE_URL}/contact` **non localisé**, alors que `routing.ts` est en `localePrefix: "always"` : `booking-rescheduled-by-admin.tsx:90` · `booking-j1-reminder.tsx:85` · `booking-completed-thanks.tsx:87` · `cadrage-j1-reminder.tsx:80` · `cadrage-h2-reminder.tsx:77` · `contract-sent.tsx:70` · `contract-signed.tsx:68` · `contract-refused.tsx:77` · `contract-reminder.tsx:70` · `contract-version-updated.tsx:73` · `quote-reminder.tsx:82` · `quote-expired.tsx:74` · `payment-reminder-j7.tsx:92` · `payment-overdue-j1.tsx:92` · `payment-overdue-j15.tsx:103` · `payment-overdue-j30.tsx:107` · `installment-overdue-soft.tsx:94` · `installment-overdue-firm.tsx:104` · `disputed-notice.tsx:101`. Cette branche est empruntée en pratique : les crons `booking-j1-reminder` (`booking-crons-worker.ts:215-223`) et `booking-completed-thanks` (`:554-562`) n'envoient jamais `feedbackUrl`.

---

## 6. Le calendrier de communication vu comme un tout

### 6.1 La frise réelle, du côté stagiaire

```
 inscription        J-10   J-7        J-5        J-2   J0      J+1        J+3   J+10   J+30
     │               │      │          │          │     │       │          │      │      │
     │               │      │          │          │  formation │          │      │      │
     ▼               ▼      ▼          ▼          ▼     ▼       ▼          ▼      ▼      ▼
  [ RIEN ]         [TROU] rappel-j7  convocation [TROU] [TROU] satisfaction-j1  relances  suivi-j30
                          (fenêtre)  (état, OK)                attestation      (état)   (état)
                                                               (≈J+1)
  positionnement : à la signature de la pièce qui engage l'action, sans jalon
```

Côté client entreprise :

```
  devis-envoi ──▶ convention-envoi ──▶ (formation) ──▶ facture-envoi ──▶ [J+30] enquete-entreprise
    (manuel)         (manuel)                            (manuel)              (auto)
                                                              └──▶ relance-impayee (manuel, sur clic)
```

### 6.2 Les trous, jalon par jalon

| Jalon | Ce qui devrait exister | État réel |
|---|---|---|
| **Inscription (J-x)** | accusé au stagiaire : « vous êtes inscrit à … », accès portail | 🔴 **RIEN.** `enrollTraineeAction` (`actions/qualiopi/enrollments.ts:64`) crée l'inscription et les questionnaires (`:95`) et **n'enfile aucun e-mail**. Le stagiaire n'apprend son inscription qu'à J-5 |
| **Accès portail** | envoi proactif du lien d'espace à l'inscription | 🔴 **RIEN.** `qualiopi-portail-acces` n'a qu'UN déclencheur : la re-demande self-service (`portail-service.ts:220`). L'action admin `genererPortailAccesAction` (`portail.ts:409`) retourne l'URL à l'écran mais **n'envoie aucun e-mail** — l'admin doit la copier à la main |
| **J-10** | — | rien, et rien n'est prévu |
| **J-7** | rappel + lien d'émargement | ⚠️ existe, mais sur **FENÊTRE** `[J+6,5 ; J+7,5]` (`worker.ts:433-441`), **sans colonne d'état ni rattrapage**. C'est exactement le défaut qui avait rendu la convocation muette. Une session créée moins de 7 jours avant son début — le cas de TOUS les dossiers réels observés (`worker.ts:707-716`) — n'a plus aucune fenêtre |
| **J-5** | convocation réglementaire (ind. 9) | ✅ corrigé : sélection sur l'ÉTAT (`convocationEnvoyeeAt: null`), plafond 5,5 j **sans plancher**, rattrapage quotidien, et consignation explicite de ce qui n'est plus rattrapable (`worker.ts:717-745`) |
| **J-2** | rappel logistique final (horaires, adresse précise, accès, contact du jour) | 🔴 **RIEN.** Et la convocation elle-même ne porte ni horaires, ni durée, ni nom du formateur, ni contact référent handicap (`qualiopi-convocation.tsx:65-73`) |
| **J0** | rien attendu | rien |
| **J+1** | satisfaction à chaud + attestation | ✅ deux envois séparés (`satisfaction-j1` 08:00, `attestations-auto` 09:00), tous deux sur l'ÉTAT (`worker.ts:497-517`, `:398`) |
| **J+3 / J+10** | relances des questionnaires sans réponse | ✅ sur l'ÉTAT, plafond 2 (`worker.ts:986-1002`) |
| **J+30** | suivi à froid stagiaire + enquête entreprise | ✅ deux crons, tous deux sur l'ÉTAT (`worker.ts:571-586`, `:1043-1063`) |
| **Après J+30** | rien | rien — cohérent |

### 6.3 Lecture d'ensemble

Trois constats structurent la frise :

1. **La partie AVANT la formation est la plus faible.** Trois des quatre trous durs (inscription, accès portail, J-2) sont en amont. Le seul jalon amont fiable est la convocation J-5, et il est fiable **parce qu'il a été réparé le 2026-08-15** ; le J-7 porte encore le défaut d'origine.
2. **La partie APRÈS la formation est solide** : quatre envois, tous pilotés par l'état, tous avec rattrapage et borne haute. C'est le modèle à propager en amont.
3. **Le patron qui marche est identifié et documenté** : sélectionner sur une colonne d'état (`envoyeAt: null`, `convocationEnvoyeeAt: null`), jamais sur une tranche horaire, avec plafond de fraîcheur et consignation de l'irrattrapable. `handleRappelJ7` est le dernier cron Qualiopi à ne pas l'appliquer.

---

## 7. La frontière : ce qui n'engage rien / ce qui engage

La frontière du projet n'est pas *manuel / automatique*, elle est **« produire un brouillon » / « poser un acte »**. Produire s'automatise ; **signer, contresigner, facturer, attester, habiliter** restent des actes humains habilités.

### 7.1 Côté « n'engage rien » — peut et doit rester automatique

Toute la chaîne d'information et de recueil : les 9 envois Qualiopi stagiaire/entreprise (convocation, rappel J-7, positionnement, relances, satisfaction J+1, suivi J+30, enquête entreprise, attestation disponible, accès portail), les 11 accusés de réception de formulaires, les 3 envois RGPD, les 2 magic-links, `documents-nouvelle-version`, `vivier-information`, `qualiopi-alerte-interne`, et les notifications d'événements déjà survenus (`quote-signed`, `quote-declined`, `cancellation-confirmed-by-user`, `payment-receipt`, `payment-failed`).

**Motif commun** : ces envois *constatent* ou *informent*. Aucun ne crée d'obligation nouvelle. Les retenir coûte plus que les laisser partir — la doctrine est écrite en toutes lettres dans `outbox-policy.ts:6-14` et `queues.ts:730-738` : « l'incertitude ne doit jamais retenir un email ».

⚠️ Nuance sur `qualiopi-attestation-disponible` : **l'e-mail** ne fait qu'annoncer, il peut partir seul. Mais son déclencheur est la **génération** de l'attestation (`attestation-service.ts:501`), et *attester* est un acte qui engage. La frontière ne passe donc pas sur l'e-mail mais sur le cron `attestations-auto` (`queues.ts:1456-1462`) qui génère l'attestation sans intervention humaine. **C'est le seul point de la chaîne où un acte engageant est produit par un cron.** À arbitrer hors de ce lot.

### 7.2 Côté « engage » — ne doit JAMAIS être automatique

| Envoi | Acte engagé | Protection actuelle | Suffisante ? |
|---|---|---|---|
| `convention-envoi` | met en circulation un lien **qui vaut signature** (`convention-envoi.tsx:52`) | `requireHabilitation("contresigner")` (`piece-lien-signature.ts:456`) **+** corbeille de validation (`outbox-policy.ts:54`) | ✅ double |
| `devis-envoi` | engage un prix, porte un lien de signature | corbeille (`outbox-policy.ts:53`) | ✅ |
| `facture-envoi` | facture — acte comptable | corbeille (`outbox-policy.ts:55`) | ✅ |
| `qualiopi-relance-impayee` | met en demeure, chiffre des pénalités (`facturation-hub.ts:895-910`) | case à cocher de pointage bancaire en amont, **et non** la corbeille (retiré volontairement, `outbox-policy.ts:37-52`) | ✅ mais fragile : la protection est une case à cocher d'écran, pas une garde serveur |
| `payment-link` | appel de fonds | clic admin seul (`contract/admin-actions.ts:406`) | ⚠️ aucune corbeille, aucune habilitation nommée |
| `contract-sent` | met en circulation un contrat à signer | corbeille (`outbox-policy.ts:56`) — **mais aucun émetteur** | 🔴 protection d'un envoi qui n'existe pas |
| `contract-reminder` | relance de signature | corbeille (`outbox-policy.ts:57`) + cron dormant | 🔴 idem |
| `contract-version-updated` | remet en signature une version révisée | clic admin (`contract/admin-actions.ts:572,706`) | ⚠️ pas de corbeille alors que `contract-sent` en a une — incohérent |
| `refund-issued` | constate un remboursement d'argent | clic admin (`refund-actions.ts:291`) | ⚠️ et le corps est cassé (M1) |
| `force-majeure-notice` | annule et promet un remboursement intégral | clic admin (`admin-actions.ts:429`) | ⚠️ promesse non exécutée (M8) |
| `booking-cancelled`, `option-refused-by-admin`, `cadrage-declined`, `booking-paused-confirmation`, `booking-rescheduled-by-admin` | refus / annulation / report unilatéral | clic admin | ⚠️ acceptable, le geste humain est le contrôle |
| `submission-reply` | parole de l'entreprise, rédigée | clic admin (`reply-actions.ts:147,370`) | ✅ le contenu est écrit à la main |

### 7.3 🔴 Les incohérences de frontière

1. **`contract-sent` et `contract-reminder` sont protégés par une corbeille et n'ont aucun émetteur** (`outbox-policy.ts:56-57`). Deux entrées de la liste de validation sur cinq ne servent à rien.
2. **`contract-version-updated` engage exactement autant que `contract-sent`** et n'est pas dans la liste. Le seul gabarit contrat réellement émis est celui qui n'est pas protégé.
3. **`payment-link` fait un appel de fonds sans corbeille ni habilitation nommée**, alors que `facture-envoi` — moins engageant, puisque la facture est déjà émise — en a une.
4. **`convention-envoi` est le seul envoi du dépôt protégé DEUX fois** (habilitation + corbeille), et c'est aussi celui dont le corps est le plus pauvre (§4.5). La rigueur du contrôle et la qualité du message ne sont pas corrélées.
5. **`estEmailQualiopiAutomatique()` n'a aucun appelant** (§3.c) : la frontière du côté « ne pas retenir » n'est pas exécutée, seulement écrite.

---

## 8. Le routage des alertes internes — le canal réel

**Question tranchée : il y a DEUX canaux internes distincts, et ils ne se recouvrent pas.**

### 8.1 Canal A — le hub `notify()` : Telegram (+ Sentry, + WhatsApp)

`src/server/notifications/routing.ts:15-104` définit 40 catégories. **Toutes** routent vers `telegram`, six doublent avec `sentry`, une seule (`ADMIN_REPLIED_TO_SUBMISSION:63`) ne route nulle part. Onze salons thématiques (`routing.ts:130-232`), résolution du couple (bot, salon) en `:409-435`. Doublon WhatsApp pour 12 catégories « leads humains » (`routing.ts:264-319`).

🔴 **Le canal `email` du hub est un no-op.** `src/server/notifications/channels/email.ts:14-22` retourne `false` sans rien faire, et **aucune catégorie ne le déclare** dans `ROUTING` (vérifié : `"email"` n'apparaît que dans `types.ts:10` et `index.ts:94`). Le hub n'envoie donc **jamais** d'e-mail.

### 8.2 Canal B — les alertes Qualiopi : UN E-MAIL PAR ALERTE

Chemin : cron `formation-crons.alertes` 07:00 UTC (`queues.ts:1495-1499`) → `handleAlertes` (`worker.ts:648`) → `notifierAlerteInterne` (`notifications-service.ts:761`) → `enqueueEmail("qualiopi-alerte-interne", …)` (`notifications-service.ts:807`).

**Un e-mail par alerte**, avec verrou d'idempotence en base (`notifiedAt`, `:767-771`) et `jobId` BullMQ (`:808`).

### 8.3 🔴 Le repli en dur sur une adresse Gmail personnelle EXISTE TOUJOURS

```
src/server/qualiopi/notifications/notifications-service.ts:790-793
  const destinataire =
    process.env["QUALIOPI_ALERTE_EMAIL"] ??
    process.env["WEEKLY_REPORT_EMAIL"] ??
    "williamsjullin@gmail.com";
```

**Vérifié le 2026-08-16 : présent, inchangé.** Et il est **dupliqué** :

| Emplacement | Usage |
|---|---|
| `notifications-service.ts:791-793` | destinataire des alertes Qualiopi |
| `features/commercial-application/actions.ts:69-71` | destinataire du récapitulatif de candidature commerciale (qui contient le CV complet du candidat, cf. M20) |
| `queues.ts:337` (commentaire) | rapport hebdomadaire — mais le worker, lui, replie sur `contact@axion-ia.com` (`content-weekly-report-worker.ts:22`) |

Trois emplacements, **deux valeurs de repli différentes** (`williamsjullin@gmail.com` vs `contact@axion-ia.com`) pour la même notion de « destinataire interne ». Aucun SSOT.

⚠️ Portée RGPD : le repli de `commercial-application/actions.ts:71` envoie des **données personnelles de candidats** (nom, ville, parcours, message libre) vers une boîte Gmail personnelle si l'env var n'est pas posée.

### 8.4 Verdict

| Affirmation du plan console | Réalité du code |
|---|---|
| « les alertes internes partent sur un canal Telegram » | **Vrai pour le hub `notify()`** (40 catégories, `routing.ts:15-104`) — **faux pour les alertes Qualiopi**, qui partent en e-mail unitaire (`notifications-service.ts:807`) |
| « repli en dur sur une adresse Gmail personnelle » | **Confirmé, et présent à DEUX endroits** (`notifications-service.ts:793`, `commercial-application/actions.ts:71`) |

**Le canal réel dépend donc de la source de l'alerte** : `AlerteSysteme` → e-mail ; tout le reste → Telegram. Les deux ne se croisent nulle part : une alerte Qualiopi n'apparaît dans aucun salon Telegram, et aucune catégorie du hub ne produit d'e-mail.

---

## 9. Observations secondaires

Hors périmètre strict du lot, relevées au passage et vérifiées.

1. **Le sujet corrigé en corbeille n'atteint jamais le destinataire.** `approuverEmailAction` met à jour `EmailOutbox.sujet` (`email-outbox.ts:84`) puis appelle `enqueueEmail` **sans passer `sujet`** (`:111-125`) ; et de toute façon `sujet` n'est utilisé que pour garer (`queues.ts:747`). Le worker rend le sujet depuis le gabarit (`email-worker.ts:118`). L'édition du sujet en corbeille est donc purement cosmétique.
2. **`legalForm` en dur dans le layout.** `_layout.tsx:262` code `"SAS française"` alors qu'un SSOT paramétrable existe (`src/lib/legal-identity.ts:116,176`, surchargeable par env). Mention légale sur 100 % des envois, y compris probants.
3. **Bilinguisme cassé sur 3 gabarits** : `formateur-magic-link` et `ressources-magic-link` ont un objet traduit (`:17-18`) et un corps FR en dur (`:51-107` / `:35-68`) sous un footer traduit ; `submission-reply.tsx:157` construit un CTA vers `/fr/appel` en ignorant `locale` alors que le libellé, lui, est traduit (`:156`).
4. **`interventionType` (enum brut) injecté dans la prose** : « votre **essentielle** démarre demain » (`booking-j1-reminder.tsx:35`), idem `booking-completed-thanks.tsx:35`, `booking-rescheduled-by-admin.tsx:37`.
5. **Référence interne fuitée** : « après réception de l'acompte **(D50-D51)** » (`quote-signed.tsx:18`).
6. **Promesse de préparation contradictoire** : « 48 h avant la session » (`booking-confirmed.tsx:25`, `option-confirmed-by-admin.tsx:20`) vs « 7 jours avant la session » (`booking-validated-on-calendar.tsx:26`, `booking-resumed-notification.tsx:23`). Un même client reçoit les deux.
7. **Un seul gabarit sur 75 porte un lien de désinscription** : `newsletter-confirm-optin.tsx:52`. `roi-report` et `vivier-information` n'en ont pas alors qu'ils portent des liens permanents vers des données personnelles.
8. **Préfixe admin en dur dans un gabarit** : `qualiopi-alerte-interne.tsx:39` code `/fr/admin-dev-x7k2n9/qualiopi/alertes`. Un changement du préfixe secret casse silencieusement le seul lien de l'alerte.

---

## 10. Récapitulatif chiffré

| Mesure | Valeur |
|---|---|
| Gabarits déclarés (SSOT `EmailJobName` × `TEMPLATES`) | **75** |
| Gabarits sans aucun appelant | **12** |
| Gabarits à appelant dormant (cron OFF / Stripe non configuré) | **11** |
| Gabarits réellement émissibles aujourd'hui | **52** |
| Gabarits en file de validation | **5** déclarés (`outbox-policy.ts:36-58`), dont **1 sans appelant** (`contract-sent`) et **1 dormant** (`contract-reminder`) → **3 réellement actifs** |
| Gabarits en régime manuel pur (clic admin, envoi direct) | **17** |
| Gabarits en régime automatique et vivants | **32** |
| Corps qui affirment un fait faux au moment de l'envoi | **14** (M1–M14) |
| Corps promettant un délai que rien ne tient | **4** (M15–M18) |
| Corps s'adressant au mauvais public | **5** (M19–M23) |
| Envois sans lien d'espace alors que le destinataire en a un | **3** |
| CTA vers une route inexistante | **5** |
| CTA vers un repli `/contact` non localisé | **19** |
| Trous durs du calendrier | **4** (inscription, accès portail, J-2, et J-7 sur fenêtre) |
| Canaux d'alerte interne distincts | **2** (Telegram pour le hub, e-mail unitaire pour `AlerteSysteme`) |
| Emplacements du repli Gmail personnel en dur | **2** |
