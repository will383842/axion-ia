# LOT 13 — Cartographie des envois d'e-mails

Date : 2026-08-16. Périmètre : les **75 gabarits** enregistrés dans
`src/lib/email/templates/index.tsx:169-432` (le registre `TEMPLATES` fait foi ; il est aligné
sur l'union `EmailJobName` de `src/server/queue/types.ts`).

Méthode : pour chaque gabarit, recherche exhaustive des appels `enqueueEmail("<nom>")` dans
`src/**` et `scripts/**`, puis remontée jusqu'au déclencheur réel (cron enregistré dans
`bootRepeatableJobs`, webhook, formulaire public, ou clic admin). Le régime d'envoi est lu
dans `src/server/email/outbox-policy.ts`. La colonne « lien vers l'espace » est établie en
lisant le gabarit lui-même (prop `cta={{ href }}` passée à `EmailLayout`, ou `<Link href>`
posé dans le corps), **pas** le payload de l'appelant.

Conventions de la dernière colonne :

- **oui** — porte un lien vers l'espace du destinataire ;
- **s.o.** — porte un lien utile (signature, facture, enquête, export…) mais le destinataire
  n'a pas d'espace dans ce dépôt ;
- **non** — ne porte aucun lien ;
- 🔴 — porte un lien qui **ne résout pas** (voir § 3).

Rien dans ce document n'est déduit d'un nom de fichier : quand le déclencheur n'a pas pu être
établi, la cellule porte « indéterminé » et le § 1 dit pourquoi.

---

## 1. Tableau — un gabarit par ligne

| Gabarit | Destinataire | Fonction qui l'envoie (fichier:ligne) | Déclencheur | Régime | Jalon | Lien vers l'espace ? |
| --- | --- | --- | --- | --- | --- | --- |
| `qualiopi-convocation` | Stagiaire | `src/server/qualiopi/notifications/notifications-service.ts:207` (`envoyerConvocation`) | Cron `formation-crons.convocation-j5` (`src/server/queue/queues.ts:1501`, `0 8 * * *`) → `src/server/queue/workers/qualiopi-formation-crons-worker.ts:731` | Automatique (`src/server/email/outbox-policy.ts:65`) | J-5 avant la session | oui — `lienPortail` (`qualiopi-convocation.tsx:57,62`) |
| `qualiopi-rappel-j7` | Stagiaire | `notifications-service.ts:294` (`envoyerRappelJ7`) | Cron `formation-crons.rappel-j7` (`queues.ts:1465`) → `qualiopi-formation-crons-worker.ts:449` | Automatique (`outbox-policy.ts:66`) | J-7 | oui — `lienPortail` (`qualiopi-rappel-j7.tsx:51`) + lien d'émargement personnel si premier émis (`notifications-service.ts:289`) |
| `qualiopi-satisfaction-j1` | Stagiaire | `notifications-service.ts:360` (`envoyerSatisfactionJ1`) | Cron `formation-crons.satisfaction-j1` (`queues.ts:1470`) → worker:525 ; aussi bouton console (`src/server/actions/qualiopi/questionnaires.ts:109`) | Automatique (`outbox-policy.ts:67`) | J+1 après la fin | oui — `lienQuestionnaire` est un jeton portail (`notifications-service.ts:357`, `qualiopi-satisfaction-j1.tsx:40`) |
| `qualiopi-suivi-j30` | Stagiaire | `notifications-service.ts:411` (`envoyerSuiviJ30`) | Cron `formation-crons.suivi-j30` (`queues.ts:1475`) → worker:594 ; bouton console (`questionnaires.ts:112`) | Automatique (`outbox-policy.ts:68`) | J+30 | oui — `lienPortail` (`qualiopi-suivi-j30.tsx:42`) |
| `qualiopi-positionnement` | Stagiaire | `notifications-service.ts:564` (`envoyerPositionnement`) | Bouton console (`questionnaires.ts:124`) ; après signature d'une pièce (`src/server/actions/qualiopi/piece-signature.ts:273`) ; relance (`notifications-service.ts:653`) | Automatique (`outbox-policy.ts:71`) | Avant la formation | oui — `lienQuestionnaire` = jeton portail (`qualiopi-positionnement.tsx:67`) |
| `qualiopi-questionnaire-relance` | Stagiaire | `notifications-service.ts:656` | Cron `formation-crons.relance-questionnaires` (`queues.ts:1490`, `30 8 * * *`) → worker:1007 ; bouton console (`questionnaires.ts:188`) | Automatique (`outbox-policy.ts:72`) | J+3 / J+10 sans réponse | oui (`qualiopi-questionnaire-relance.tsx:48`) |
| `qualiopi-enquete-entreprise` | Contact du client entreprise | `notifications-service.ts:735` (envoi initial) ; `notifications-service.ts:623` (relance) | Cron `formation-crons.enquete-entreprise-j30` (`queues.ts:1482`, `15 8 * * *`) → worker:1070 | Automatique (`outbox-policy.ts:73`) | J+30 après la session | s.o. — lien d'enquête public à jeton (`qualiopi-enquete-entreprise.tsx:49`) ; **aucun espace entreprise n'existe** |
| `qualiopi-attestation-disponible` | Stagiaire | `notifications-service.ts:479` | `src/server/qualiopi/evaluations/attestation-service.ts:501`, après génération — elle-même déclenchée par le cron `formation-crons.attestations-auto` (`queues.ts:1459`, `0 9 * * *`) | Automatique (`outbox-policy.ts:74`) | Attestation générée | oui (`qualiopi-attestation-disponible.tsx:44`) |
| `qualiopi-portail-acces` | Stagiaire | `src/server/qualiopi/portail/portail-service.ts:209` (`demanderAccesParEmail`) | Formulaire public `/fr/portail/demander-acces` → `src/server/actions/qualiopi/portail.ts:156` | Automatique (`outbox-policy.ts:75`) | Re-demande d'accès | oui (`qualiopi-portail-acces.tsx:34`) |
| `qualiopi-alerte-interne` | Équipe interne (`QUALIOPI_ALERTE_EMAIL`) | `notifications-service.ts:807` (`notifierAlerteInterne`) | Cron `formation-crons.alertes` (`queues.ts:1496`, `0 7 * * *`) → worker:648 | Automatique (`outbox-policy.ts:76`) | Alerte système créée | s.o. — CTA vers la console d'alertes (`qualiopi-alerte-interne.tsx:44`) ; destinataire interne |
| `qualiopi-relance-impayee` | Client entreprise | `src/server/actions/qualiopi/facturation-hub.ts:913` (`envoyerRelanceAction`) | Clic admin « Relances à traiter », après la case « j'ai vérifié mon relevé ». Le palier est proposé par le cron `formation-crons.factures-retard` (`queues.ts:1509`), qui n'envoie rien | Manuel — retiré de la file de validation le 2026-08-02 (`outbox-policy.ts:37-52`) | Facture échue J+1 / J+15 / J+30 | s.o. — `lienFacture` sinon `/fr/contact` (`qualiopi-relance-impayee.tsx:124-126`) |
| `devis-envoi` | Client entreprise | `src/server/actions/qualiopi/facturation-emails.ts:116` (`envoyerDevisEmailAction`) ; `src/server/actions/qualiopi/devis.ts:577` (`sendDevisAction`) | Clic admin « Envoyer au client » | **File de validation** (`outbox-policy.ts:53`) | Devis émis | s.o. — CTA de signature DocuSeal si `signatureUrl` (`devis-envoi.tsx:89`), sinon aucun lien |
| `convention-envoi` | Signataire du client entreprise | `src/server/actions/qualiopi/piece-lien-signature.ts:488` (`envoyerLienSignatureParEmailAction`) | Clic admin dans le panneau de signature | **File de validation** (`outbox-policy.ts:54`) | Convention prête à signer | s.o. — lien de signature porté par le bouton (`convention-envoi.tsx:106`) |
| `facture-envoi` | Client entreprise | `facturation-emails.ts:251` (`envoyerFactureEmailAction`) | Clic admin | **File de validation** (`outbox-policy.ts:55`) | Facture émise | **non** — aucun lien ; le PDF est en pièce jointe (clé R2) |
| `formateur-magic-link` | Formateur | `src/server/actions/formateur/auth.actions.ts:79` (`sendFormateurMagicLinkAction`) ; `src/server/actions/coaching-admin/formateurs.actions.ts:60` (`sendFormateurLinkAction`) | Self-service « recevoir mon lien » / envoi depuis la console | Automatique (self-service) · manuel (console) | Accès à l'espace formateur | oui — lien magique (`formateur-magic-link.tsx:60`) **et** adresse permanente de l'espace (`formateur-magic-link.tsx:104`) |
| `ressources-magic-link` | Commercial / apporteur | `src/server/actions/ressources/auth.actions.ts:64` (`sendRessourcesMagicLinkAction`) | Self-service | Automatique | Accès à l'espace ressources | oui (`ressources-magic-link.tsx:44`) |
| `documents-nouvelle-version` | Destinataires `DocumentRecipient` (formateurs / commerciaux) | `src/server/intervention-documents/notifications.ts:63` (`notifyNewVersion`) | Publication d'une version (`src/server/actions/intervention-documents/documents.actions.ts:212`) | Automatique | Version de document publiée | oui — `portalUrl` = `/fr/espace-ressources` (`notifications.ts:58`, `documents-nouvelle-version.tsx:107`) |
| `rgpd-demande-recue` | Stagiaire | `src/server/qualiopi/portail/rgpd-service.ts:415` (`creerDemandeRgpd`) | Dépôt d'une demande RGPD **depuis le portail stagiaire** | Automatique | Demande RGPD déposée | 🔴 **non** — aucun lien (voir § 3) |
| `rgpd-effacement-confirme` | Personne effacée | `src/app/api/gdpr-erase/route.ts:139` | Exécution de l'effacement | Automatique | Effacement exécuté | non — cohérent : l'espace n'existe plus |
| `gdpr-export-link` | Demandeur | `src/app/api/gdpr-export/request/route.ts:50` | Demande d'export RGPD | Automatique | Export prêt | s.o. — lien d'export signé (`gdpr-export-link.tsx:49`) |
| `contact-confirmed` | Contact | `src/features/unified-contact/actions.ts:336`, routé par `emailTemplateFor` (`actions.ts:134`) | Formulaire unifié, types `formation`/`un_a_un`/`partenariat`/`presse`/`recrutement`/`speaker`/`investisseur`/`support_client`/`autre` | Automatique | Accusé de réception | s.o. — `/interventions` (`contact-confirmed.tsx:48`) |
| `audit-confirmed` | Contact | `unified-contact/actions.ts:336` via `emailTemplateFor:115` | Formulaire unifié, type `audit` | Automatique | Accusé de réception | s.o. — `/methodologie` (`audit-confirmed.tsx:53`) |
| `implementation-confirmed` | Contact | `unified-contact/actions.ts:336` via `emailTemplateFor:117` | Formulaire unifié, type `implementation` | Automatique | Accusé de réception | s.o. — `/cas-concrets` (`implementation-confirmed.tsx:57`) |
| `quote-request-received` | Contact | `unified-contact/actions.ts:336` via `emailTemplateFor:122` | Formulaire unifié, type `devis` (branché le 2026-08-13) | Automatique | Accusé de réception | s.o. — `/interventions` (`quote-request-received.tsx:71`) |
| `avis-recu` | Auteur de l'avis | `src/features/review-submission/actions.ts:249` (`submitReviewAction`) | Dépôt d'un avis | Automatique | Avis déposé | non — pas d'espace pour ce destinataire |
| `podcast-demande-recue` | Demandeur | `src/features/podcast-request/actions.ts:126` (`submitPodcastRequestAction`) | Formulaire podcast | Automatique | Accusé de réception | non |
| `rappel-confirme` | Demandeur de rappel | `src/features/roi-report/actions.ts:332` (`attachRoiCallbackAction`) | Ajout d'un téléphone au rapport ROI | Automatique | Rappel demandé | non |
| `roi-report` | Demandeur | `src/features/roi-report/actions.ts:213` (`submitRoiReportAction`) | Simulateur ROI | Automatique | Rapport prêt | s.o. — `reportUrl` (`roi-report.tsx:120`) |
| `newsletter-confirm-optin` | Abonné | `src/features/newsletter/actions.ts:118` (`subscribeNewsletterAction`) | Inscription newsletter | Automatique | Double opt-in | s.o. — lien de confirmation (`newsletter-confirm-optin.tsx:51`) |
| `chatbot-demande-transmise` | Visiteur | `src/server/chatbot/tools/capturer-lead.ts:175` (`capturerLead`) ; `src/server/chatbot/tools/escalader-question.ts:74` (`escaladerQuestion`) | Outil appelé par le chatbot | Automatique | Lead capté / question escaladée | non |
| `candidature-recue` | Candidat | `src/features/job-application/actions.ts:377` (`submitJobApplicationAction`) | Dépôt de candidature | Automatique | Candidature reçue | non — pas d'espace candidat |
| `candidature-commercial-confirmee` | Candidat commercial | `src/features/commercial-application/actions.ts:353` (`submitCommercialApplicationAction`) | Tunnel de candidature commerciale | Automatique | Candidature reçue | s.o. — page d'accueil (`candidature-commercial-confirmee.tsx:64`) ; l'espace ressources n'est ouvert qu'après recrutement |
| `candidature-commercial-recap` | Équipe interne | `commercial-application/actions.ts:366` | Même soumission | Automatique | Candidature reçue | s.o. — fiche console si `consoleUrl` (`candidature-commercial-recap.tsx:99`) |
| `vivier-information` | Candidat du stock | `src/server/vivier/stock.ts:136` (`sendVivierInformationBatch`) | **indéterminé** — `sendVivierInformationBatch` n'a aucun appelant de production (ni cron, ni action, ni script) ; voir § 2 | indéterminé | Information vivier + fenêtre d'opposition 30 j | s.o. — lien d'opposition (`vivier-information.tsx:65`) |
| `submission-reply` | Contact | `src/features/admin-submissions/reply-actions.ts:147` (`replyToSubmissionAction`) ; `reply-actions.ts:370` (`retryFailedReplyAction`) | Réponse rédigée en console | Manuel | Réponse à une demande | s.o. — `/fr/appel` (`submission-reply.tsx:157`) |
| `booking-cancelled` | Client | `src/features/admin-calendar/actions.ts:383` (`cancelBookingAction`) | Annulation depuis le calendrier admin | Manuel | Annulation | s.o. — `/appel` (`booking-cancelled.tsx:54`) |
| `booking-validated-on-calendar` | Client | `src/features/booking/admin-actions.ts:532` (`assignTrainerToBookingAction`) ; `src/features/booking/self-service-actions.ts:289` (`rescheduleBookingByUserAction`) | Validation admin / report par le client | Manuel · automatique | Créneau validé | 🔴 `/mes-donnees/booking/<id>` — **route inexistante** (§ 3) |
| `booking-paused-confirmation` | Client | `booking/admin-actions.ts:190` (`pauseBookingAction`) | Mise en pause admin | Manuel | Mise en pause | 🔴 même CTA mort (§ 3) |
| `booking-resumed-notification` | Client | `booking/admin-actions.ts:276` (`resumeBookingAction`) | Reprise admin | Manuel | Reprise | 🔴 même CTA mort (§ 3) |
| `force-majeure-notice` | Client | `booking/admin-actions.ts:429` (`markForceMajeureAction`) | Déclaration de force majeure | Manuel | Force majeure | s.o. — `/contact` (`force-majeure-notice.tsx:59`) |
| `cancellation-confirmed-by-user` | Client | `booking/self-service-actions.ts:179` (`cancelBookingByUserAction`) ; `src/features/booking/refund-actions.ts:281` (`cancelBookingByAdminAction`) | Annulation par le client / par l'admin | Automatique · manuel | Annulation confirmée | s.o. — `/interventions` (`cancellation-confirmed-by-user.tsx:59`) |
| `refund-issued` | Client | `booking/refund-actions.ts:291` | Remboursement déclenché | Manuel | Remboursement | 🔴 même CTA mort (§ 3) |
| `booking-rescheduled-by-admin` | Client | `src/features/booking/reschedule-actions.ts:176` (`rescheduleBookingByAdminAction`) | Report admin | Manuel | Report de date | s.o. — `feedbackUrl` (`booking-rescheduled-by-admin.tsx:98`) |
| `cadrage-scheduled` | Client | `src/features/booking/cadrage-actions.ts:166` (`scheduleCadrageMeetingAction`) | Cadrage planifié | Manuel | Cadrage planifié | s.o. — `ctaUrl` (`cadrage-scheduled.tsx:77`) |
| `cadrage-declined` | Client | `booking/cadrage-actions.ts:297` (`markCadrageHeldAction`) | Cadrage refusé / non tenu | Manuel | Cadrage | s.o. — `/contact` (`cadrage-declined.tsx:58`) |
| `payment-link` | Client | `src/features/contract/admin-actions.ts:406` (`sendContractAndDepositRequestAction`) | Envoi du contrat + demande d'acompte | Manuel | Demande de paiement | s.o. — `checkoutUrl` (`payment-link.tsx:59`) |
| `payment-receipt` | Client | `src/app/api/stripe/webhook/route.ts:268` | Webhook Stripe (paiement réussi) | Automatique | Paiement encaissé | 🔴 même CTA mort (§ 3) |
| `payment-failed` | Client | `src/app/api/stripe/webhook/route.ts:311` | Webhook Stripe (échec) | Automatique | Échec de paiement | s.o. — `retryUrl` sinon `/contact` (`payment-failed.tsx:63-65`) |
| `contract-version-updated` | Client | `contract/admin-actions.ts:572` (`cancelAndReissueContractAction`) ; `contract/admin-actions.ts:706` (`createContractAddendumAction`) | Réémission ou avenant | Manuel | Nouvelle version de contrat | s.o. — `signUrl` (`contract-version-updated.tsx:81`) |
| `quote-sent` | Client | `src/features/booking/quote-actions.ts:340` (`sendQuoteAction`) | Envoi d'un devis booking | Manuel | Devis envoyé | s.o. — `pdfUrl` sinon `/contact` (`quote-sent.tsx:51-53`) |
| `quote-signed` | Client | `booking/quote-actions.ts:432` (`markQuoteSignedManuallyAction`) ; `src/app/api/docuseal/webhook/route.ts:299` | Marquage manuel / webhook DocuSeal | Manuel · automatique | Devis signé | s.o. — `/contact` (`quote-signed.tsx:52`) |
| `quote-declined` | Client | `booking/quote-actions.ts:512` (`markQuoteDeclinedAction`) ; `api/docuseal/webhook/route.ts:330` | Marquage manuel / webhook DocuSeal | Manuel · automatique | Devis refusé | s.o. — `/contact` (`quote-declined.tsx:53`) |
| `option-confirmed-by-admin` | Client | `src/features/admin-options/actions.ts:231` (`validateOptionAction`) | Validation d'une option | Manuel | Option confirmée | s.o. — `/confirmation` (`option-confirmed-by-admin.tsx:55`) |
| `option-refused-by-admin` | Client | `admin-options/actions.ts:338` (`refuseOptionAction`) | Refus d'une option | Manuel | Option refusée | s.o. — `/interventions` (`option-refused-by-admin.tsx:52`) |
| `option-reminder` | Client | `src/server/queue/workers/option-reminder-worker.ts:47` | Cron `option-reminder` — **désenregistré** tant que `LEGACY_BOOKING_WORKERS_ENABLED ≠ true` (`queues.ts:897-911`) | Automatique **mais dormant** | H+24 après pose d'option | s.o. — `/confirmation` (`option-reminder.tsx:53`) |
| `option-expired` | Client | `src/server/queue/workers/option-expiration-worker.ts:101` | Cron `option-expiration` — **désenregistré** (`queues.ts:881-895`) | Automatique **mais dormant** | Expiration de l'option 48 h | s.o. — `/interventions` (`option-expired.tsx:49`) |
| `payment-reminder-j7` | Client | `src/server/queue/workers/booking-crons-worker.ts:176` | Cron `booking-j7-reminder` (`queues.ts:1040`) — **non planifié** (`queues.ts:1076-1086`) | Automatique **mais dormant** | J-7, solde à régler | s.o. — `regularizeUrl` (`payment-reminder-j7.tsx:100`) |
| `booking-j1-reminder` | Client | `booking-crons-worker.ts:215` | Cron `booking-j1-reminder` (`queues.ts:1041`) — non planifié | Automatique **mais dormant** | J-1 avant intervention | s.o. — `feedbackUrl` (`booking-j1-reminder.tsx:93`) |
| `cadrage-j1-reminder` | Client | `booking-crons-worker.ts:262` | Cron `cadrage-j1-reminder` (`queues.ts:1042`) — non planifié | Automatique **mais dormant** | J-1 avant cadrage | s.o. — `visioUrl` (`cadrage-j1-reminder.tsx:89`) |
| `cadrage-h2-reminder` | Client | `booking-crons-worker.ts:310` | Cron `cadrage-h2-reminder` (`queues.ts:1043`) — non planifié | Automatique **mais dormant** | H-2 avant cadrage | s.o. — `visioUrl` (`cadrage-h2-reminder.tsx:86`) |
| `contract-reminder` | Client | `booking-crons-worker.ts:350` | Cron `contract-pending-reminder` (`queues.ts:1045`) — non planifié | **Double blocage** : cron dormant **et** file de validation (`outbox-policy.ts:57`) | Contrat non signé depuis 3 j | s.o. — `signUrl` (`contract-reminder.tsx:78`) |
| `quote-expired` | Client | `booking-crons-worker.ts:440` | Cron `quote-expiration-check` (`queues.ts:1055`) — non planifié | Automatique **mais dormant** | Devis périmé | s.o. — `quoteUrl` (`quote-expired.tsx:82`) |
| `booking-completed-thanks` | Client | `booking-crons-worker.ts:554` | Cron `booking-completed-thanks-sweep` (`queues.ts:1070`) — non planifié | Automatique **mais dormant** | Soir de fin d'intervention | s.o. — `feedbackUrl` (`booking-completed-thanks.tsx:95`) |
| `booking-confirmed` | Client | **aucun appelant de production** (seul `scripts/test-email-e2e.ts:14`) | **indéterminé** — voir § 2 | — | Réservation confirmée | s.o. — `/confirmation?id=` (`booking-confirmed.tsx:61`) |
| `option-posted` | Client | **aucun appelant** | **indéterminé** — voir § 2 | — | Option 48 h posée | s.o. — `/confirmation?option=` (`option-posted.tsx:58`) |
| `contract-sent` | Client | **aucun appelant** | **indéterminé** — voir § 2 | Déclaré en file de validation (`outbox-policy.ts:56`) alors que rien ne l'enfile | Contrat à signer | s.o. — `signUrl` (`contract-sent.tsx:78`) |
| `contract-signed` | Client | **aucun appelant** | **indéterminé** — voir § 2 | — | Contrat signé | s.o. — `contactUrl` (`contract-signed.tsx:76`) |
| `contract-refused` | Client | **aucun appelant** | **indéterminé** — voir § 2 | — | Contrat refusé | s.o. — `contactUrl` (`contract-refused.tsx:85`) |
| `payment-overdue-j1` | Client | **aucun appelant** | **indéterminé** — voir § 2 | — | Facture échue J+1 | s.o. — `regularizeUrl` (`payment-overdue-j1.tsx:100`) |
| `payment-overdue-j15` | Client | **aucun appelant** | **indéterminé** — voir § 2 | — | Facture échue J+15 | s.o. — `regularizeUrl` (`payment-overdue-j15.tsx:111`) |
| `payment-overdue-j30` | Client | **aucun appelant** | **indéterminé** — voir § 2 | — | Facture échue J+30 | s.o. — `regularizeUrl` (`payment-overdue-j30.tsx:115`) |
| `installment-overdue-soft` | Client | **aucun appelant** | **indéterminé** — voir § 2 | — | Échéance d'échéancier manquée | s.o. — `regularizeUrl` (`installment-overdue-soft.tsx:102`) |
| `installment-overdue-firm` | Client | **aucun appelant** | **indéterminé** — voir § 2 | — | Échéance manquée, relance ferme | s.o. — `regularizeUrl` (`installment-overdue-firm.tsx:112`) |
| `disputed-notice` | Client | **aucun appelant** | **indéterminé** — le gabarit le documente lui-même (`disputed-notice.tsx:9-11`) : « déclaré dans EmailJobName mais PAS encore enqueué », bouton admin prévu | — | Impayé après relances | s.o. — `regularizeUrl` (`disputed-notice.tsx:109`) |
| `quote-reminder` | Client | **aucun appelant** | **indéterminé** — voir § 2 | — | Devis sans réponse J+3 | s.o. — `quoteUrl` (`quote-reminder.tsx:90`) |

**Total : 75 lignes**, soit exactement les 75 clés de `TEMPLATES`
(`src/lib/email/templates/index.tsx:169-432`).

---

## 2. Analyse

### § 2.1 — Les gabarits JAMAIS envoyés (aucun appelant)

Douze gabarits n'ont **aucun** `enqueueEmail("<nom>")` dans `src/**`. Un treizième cas,
`vivier-information`, a un appelant qui n'est lui-même jamais appelé — il est traité à part
parce que le diagnostic y est inverse.

**A. Code mort — le flux « réservation payante » a été éteint autour d'eux (11 gabarits)**

`booking-confirmed`, `option-posted`, `contract-sent`, `contract-signed`, `contract-refused`,
`payment-overdue-j1`, `payment-overdue-j15`, `payment-overdue-j30`,
`installment-overdue-soft`, `installment-overdue-firm`, `quote-reminder`.

Ce n'est pas un oubli de câblage : ce sont les restes d'un flux dont les producteurs ont été
retirés, et dont le remplaçant existe et fonctionne.

- Les trois `payment-overdue-*` avaient pour producteur `handlePaymentOverdueScan`
  (`src/server/queue/workers/booking-crons-worker.ts:81`). Ce handler **n'envoie plus aucun
  e-mail** depuis la Phase 4 du hub facturation (`booking-crons-worker.ts:76-80`) : il détecte
  et écrit une `RelanceProposee`. L'envoi passe désormais par `qualiopi-relance-impayee`
  (`facturation-hub.ts:913`), sur clic admin. Les trois gabarits n'ont donc plus de rôle.
- `quote-reminder` : même conversion, dans `handleQuotePendingReminder`
  (`booking-crons-worker.ts:389-407`) — « AUCUN email client (manuel) ».
- `booking-confirmed` et `option-posted` dépendaient de `createBookingAction` /
  `postOption48hAction`, supprimées à l'audit 2026-07-09 (constat repris dans
  `queues.ts:863-870`). Seul `scripts/test-email-e2e.ts:14` enfile encore `booking-confirmed`,
  ce qui n'est pas un usage de production.
- `contract-sent` / `contract-signed` / `contract-refused` : l'envoi du contrat passe en fait
  par `payment-link` (`contract/admin-actions.ts:406`, `sendContractAndDepositRequestAction`),
  et la signature par le webhook DocuSeal, qui envoie `quote-signed` / `quote-declined`
  (`api/docuseal/webhook/route.ts:299,330`). Les trois gabarits font doublon.
- `installment-overdue-soft` / `installment-overdue-firm` : aucun producteur d'échéancier ne
  les enfile ; les paliers d'impayé sont portés par `RelanceProposee`.

**Incohérence à signaler** : `contract-sent` figure dans `EMAILS_A_VALIDER_PAR_DEFAUT`
(`outbox-policy.ts:56`) et dans `LIBELLE_TEMPLATE_EMAIL` (`outbox-policy.ts:93`). La corbeille
de validation offre donc à l'écran un réglage pour une nature d'e-mail qu'aucun code n'émet.
C'est inoffensif aujourd'hui, mais c'est précisément le genre de ligne qui fait croire qu'un
envoi est « sous contrôle » alors qu'il n'existe pas.

**B. Câblé mais jamais déclenché — `disputed-notice`**

`disputed-notice` est un cas déclaré : son en-tête (`disputed-notice.tsx:9-11`) dit qu'il est
enregistré mais pas enfilé, et qu'un bouton admin est prévu. Ce n'est donc **ni** du code mort
**ni** un oubli : c'est un gabarit en attente de son écran. À laisser tel quel tant que la
décision d'ouvrir ce bouton n'est pas prise.

**C. 🔴 Oubli de câblage caractérisé — `vivier-information`**

C'est le seul vrai oubli du lot, et il est structurel.

- `sendVivierInformationBatch` (`src/server/vivier/stock.ts:61`) est complète : elle
  déduplique par adresse, pose `vivierInfoSentAt`, signe un jeton d'opposition et enfile
  `vivier-information` (`stock.ts:136`). Elle est couverte par
  `src/server/vivier/__tests__/vivier.test.ts` (7 cas).
- **Aucun appelant de production** : recherche de `sendVivierInformationBatch` dans `src/**` et
  `scripts/**` → seuls les tests. Le cron `vivier-crons` (`queues.ts:1016-1027`,
  `0 5 * * *`) n'appelle que l'étape 2, `integrateVivierStock`
  (`src/server/queue/workers/vivier-crons-worker.ts:44`). Aucun bouton console non plus : les
  seuls fichiers d'interface qui mentionnent le vivier sont le formulaire de candidature et la
  page publique d'opposition.
- Conséquence en chaîne : l'étape 2 sélectionne les candidatures sur `vivierInfoSentAt`
  (colonne posée **uniquement** par l'étape 1). Comme l'étape 1 n'est jamais exécutée, l'étape 2
  tourne tous les jours à 05:00 et ne trouvera **jamais** rien. Le cron est vivant, la chaîne est
  morte — et rien ne le dit.

### § 2.2 — Ceux qui devraient être automatiques et ne le sont pas

**A. 🔴 `qualiopi-convocation` — automatique en droit, injoignable en fait**

C'est le manquement le plus grave du lot, parce qu'il porte une obligation réglementaire
(indicateur 9) et que son régime dit « automatique » (`outbox-policy.ts:65`).

Le gabarit est bien câblé (`notifications-service.ts:207`) et son unique déclencheur est le
cron `formation-crons.convocation-j5` (`queues.ts:1501`). Or ce cron ne retient que les
sessions `planifiee` dont `dateDebut` tombe dans une fenêtre étroite autour de J-5
(`qualiopi-formation-crons-worker.ts:731`). Le défaut est documenté dans le code lui-même
(`notifications-service.ts:137-155`) : **zéro envoi sur 98 e-mails**, tous dossiers confondus.

Deux causes distinctes :

1. `enrollTraineeAction` n'appelle pas `envoyerConvocation` — rien ne part à la confirmation
   d'inscription, contrairement à ce qu'annonce encore l'en-tête de
   `qualiopi-convocation.tsx:2` (« Envoyé dès la confirmation de l'inscription »).
2. Le cron ne rattrape rien : une inscription enregistrée à moins de 5 jours de la session —
   le cas d'un premier dossier réel — n'a plus aucune fenêtre.

Ce qui manque n'est donc pas un cron mais un **appel au point de confirmation d'inscription**,
et/ou un rattrapage fondé sur la colonne d'état `convocationEnvoyeeAt`
(`notifications-service.ts:233-236`) plutôt que sur une fenêtre de date.

**B. 🔴 `vivier-information` — voir § 2.1 C**

Le régime attendu est « automatique, gaté par `VIVIER_STOCK_ENABLED` ». Le verrou par drapeau
existe (`stock.ts:66-68`) et fonctionne. Ce qui manque est le déclencheur : un passage cron sur
la file `vivier-crons` (à côté de `integrate-stock`), ou un bouton console assumé. En l'état,
lever le drapeau ne produira **rien** — ce qui est le pire des deux mondes : le drapeau donne
l'impression d'un interrupteur alors qu'il n'y a pas d'ampoule.

**C. Les neuf envois du flux booking, automatiques par conception, désarmés par un drapeau**

`option-reminder`, `option-expired`, `payment-reminder-j7`, `booking-j1-reminder`,
`cadrage-j1-reminder`, `cadrage-h2-reminder`, `contract-reminder`, `quote-expired`,
`booking-completed-thanks`.

Tous ont un appelant valide et un cron **écrit**, mais `bootRepeatableJobs` appelle
systématiquement `removeRepeatable` et ne ré-`add` que si
`LEGACY_BOOKING_WORKERS_ENABLED === "true"` (`queues.ts:879`, `1076-1086`). C'est un choix
délibéré et documenté (`queues.ts:863-877`) : le flux de réservation payante est éteint.

À ne pas confondre avec un défaut. Le seul point à noter est que `contract-reminder` porte
**deux** verrous superposés — cron dormant *et* file de validation (`outbox-policy.ts:57`).
Le jour où quelqu'un relèvera le drapeau en croyant réarmer les relances, celle-ci s'arrêtera
quand même en corbeille.

**D. Faux positifs à ne pas corriger**

Trois envois sont manuels **par décision explicite**, documentée dans le code, et ne doivent
pas être « automatisés » :

- `qualiopi-relance-impayee` : la double validation en amont (case « j'ai vérifié mon relevé »)
  remplace le garage en corbeille, et `outbox-policy.ts:37-52` avertit explicitement contre le
  retour à deux garages successifs — « deux garages successifs sur un même envoi, c'est un
  envoi qui n'a pas lieu ».
- `devis-envoi`, `convention-envoi`, `facture-envoi` : file de validation assumée
  (`outbox-policy.ts:53-55`) — Will relit avant que ça parte.

### § 2.3 — 🔴 Ceux qui ne portent pas de lien vers l'espace du destinataire

**Rectification préalable de l'hypothèse de travail.** La consigne supposait que « seule la
convocation » porte un lien vers l'espace. C'est faux, et il faut le dire nettement : les
**huit** gabarits Qualiopi adressés au stagiaire portent tous un lien portail, résolu par
`getOrCreatePortailLien` (`notifications-service.ts:98-116`), qui réutilise un accès vivant ou
en crée un — convocation, rappel J-7, satisfaction J+1, suivi J+30, positionnement, relance de
questionnaire, attestation disponible, accès portail. Les espaces formateur et ressources sont
eux aussi correctement liés (`formateur-magic-link.tsx:104` va jusqu'à donner l'adresse
**permanente** de l'espace, pas seulement le lien jetable ; `documents-nouvelle-version` porte
`portalUrl` vers `/fr/espace-ressources`, `notifications.ts:58`).

La doctrine « l'e-mail annonce et rappelle, l'espace conserve » est donc **tenue** sur toute la
chaîne Qualiopi. Les manquements réels sont ailleurs, et ils sont de deux natures.

**Défaut A — 🔴 Cinq gabarits pointent vers une route qui n'existe pas**

Ces cinq gabarits construisent un CTA `${baseUrl}/${locale}/mes-donnees/booking/${p.bookingId}` :

| Gabarit | Ligne | Déclencheur | Encore atteignable ? |
| --- | --- | --- | --- |
| `booking-validated-on-calendar` | `booking-validated-on-calendar.tsx:65` | `booking/admin-actions.ts:532` (action console) | oui, probablement |
| `booking-paused-confirmation` | `booking-paused-confirmation.tsx:67` | `booking/admin-actions.ts:190` (action console) | oui, probablement |
| `booking-resumed-notification` | `booking-resumed-notification.tsx:62` | `booking/admin-actions.ts:276` (action console) | oui, probablement |
| `refund-issued` | `refund-issued.tsx:56` | `booking/refund-actions.ts:291` (action console) | oui, probablement |
| `payment-receipt` | `payment-receipt.tsx:71` | `api/stripe/webhook/route.ts:268` | non — Stripe est neutralisé |

Or `src/app/[locale]/mes-donnees/` ne contient que `page.tsx` et `export/`. Il n'existe **aucun**
segment `booking/[id]`. Toute URL de cette forme tombe donc dans
`src/app/[locale]/[...catchall]/page.tsx`, qui appelle `notFound()` — soit un **404 réel** (le
catch-all est explicitement `force-dynamic` pour garantir le vrai statut 404).

Le défaut n'est pas « pas de lien vers l'espace » : c'est pire. Le client reçoit un bouton
« consulter mon dossier », clique, et tombe sur une page d'erreur — ce qui donne l'impression
que son dossier a disparu. Un e-mail sans lien laisse le destinataire chercher ; un e-mail avec
un lien mort lui affirme qu'il n'y a rien.

**Défaut B — 🔴 `rgpd-demande-recue` : le seul destinataire qui a un espace, et zéro lien**

`rgpd-demande-recue` (`src/lib/email/templates/rgpd-demande-recue.tsx`) est envoyé depuis
`rgpd-service.ts:415` (`creerDemandeRgpd`) quand un stagiaire dépose une demande RGPD
**depuis son portail**. Le destinataire a donc, par construction, un espace vivant et vient
d'y être authentifié. Le gabarit ne porte ni `cta=`, ni `<Link>`, ni URL d'aucune sorte.

C'est le seul gabarit du dépôt dont le destinataire possède un espace utilisable au moment de
l'envoi et qui n'en dit rien. La personne qui veut suivre l'avancement de sa demande n'a aucun
chemin de retour.

**Cas voisins qui n'en sont PAS (à ne pas « corriger »)**

- `rgpd-effacement-confirme` (`api/gdpr-erase/route.ts:139`) : aucun lien, et c'est juste —
  après l'effacement, l'espace n'existe plus. Y renvoyer serait une promesse fausse.
- `facture-envoi`, `devis-envoi`, `convention-envoi`, `qualiopi-relance-impayee`,
  `qualiopi-enquete-entreprise` : le destinataire est le **client entreprise**, et le dépôt ne
  contient aucun espace client (les seuls espaces sont `/portail` stagiaire,
  `/espace-formateur` et `/espace-ressources`). L'écart est une fonctionnalité absente, pas un
  lien oublié. `facture-envoi` est le plus visible du lot : il ne porte **aucun** lien et son
  seul contenu utile est la pièce jointe.
- `candidature-recue`, `candidature-commercial-confirmee`, `avis-recu`,
  `podcast-demande-recue`, `rappel-confirme`, `chatbot-demande-transmise` : destinataires sans
  espace (candidat, visiteur, contact). Le candidat commercial n'obtient son espace ressources
  qu'après recrutement, via `ressources-magic-link`.

---

## 3. Ce qui n'a pas pu être vérifié

- **Aucun test n'a été exécuté** : ce worktree n'a pas de `node_modules`. Tout ce qui précède
  vient de la lecture du code et de recherches exhaustives sur `src/**` et `scripts/**`.
- **Régime effectif en production** : `resoudreModeEnvoi` (`outbox-policy.ts:137`) donne la
  priorité aux règles `RegleAutomatisation` lues en base (client puis global) avant les listes
  par défaut. La colonne « régime » du tableau donne donc le **défaut du code**, pas
  nécessairement l'état réel en base. Contrôler la table des règles avant de conclure sur un
  envoi précis.
- **Atteignabilité des actions console du flux booking** : je n'ai pas vérifié si
  `pauseBookingAction`, `resumeBookingAction`, `assignTrainerToBookingAction` et
  `cancelBookingByAdminAction` sont encore branchées à un écran de la console. Quatre des cinq
  liens morts du § 2.3 A en dépendent — si ces écrans ont été retirés, le défaut devient
  théorique. C'est le seul point du § 2.3 A qui reste à trancher.
- **`vivier-information`** : j'affirme l'absence d'appelant sur la base d'une recherche du
  symbole `sendVivierInformationBatch` dans `src/**` et `scripts/**`. Un déclencheur externe
  (tâche manuelle, appel `tsx` ponctuel, GitHub Action) échapperait à cette recherche. À
  confirmer auprès de Will avant de câbler quoi que ce soit.
- **`qualiopi-enquete-entreprise`** : compté une seule fois dans le tableau alors qu'il a deux
  points d'envoi distincts (initial `notifications-service.ts:735`, relance
  `notifications-service.ts:623`), le registre ne connaissant qu'un gabarit.
- **Locale** : les gabarits Qualiopi forcent `COPY.fr` quel que soit le `locale` reçu
  (ex. `qualiopi-convocation.tsx:55`). Non traité ici, mais à garder en tête si EN est
  réactivé.
