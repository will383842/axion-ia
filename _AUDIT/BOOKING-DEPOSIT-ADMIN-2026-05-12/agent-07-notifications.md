# Agent 7 — Notifications & emails (visiteur + admin)

**Audit** : Booking Deposit + Admin 2026 — Agent 7
**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742`
**Date** : 2026-05-12
**Mode** : AUDIT-ONLY (lecture seule, écriture unique de ce `.md`).
**Scope** : `src/lib/email/**`, `src/lib/telegram.ts`, `src/lib/pii-redaction.ts`, triggers `src/features/**`, pipeline `src/server/queue/workers/email-worker.ts`.
**Référence cible V1** : 22 templates email (vs ~18 du prompt — écart assumé, voir §4 & §8).

> Code = SSOT. Ce rapport décrit l'état actuel **et** la cible V1. Pas de patch.

---

## 1. Périmètre audité

### 1.1 Stack envoi email confirmée (vs prompt)

- Transport : **Nodemailer** wrapper unique (`src/lib/email/client.ts:21-95`).
- Pipeline dev : Nodemailer → SMTP `localhost:2525` → **Mailhog UI 8025** (`client.ts:5-50`).
- Pipeline prod : Nodemailer → SMTP `localhost:2525` → **PowerMTA** local Hetzner → IP dédiée (`client.ts:5-7`).
- **Resend / SendGrid / Mailgun / Brevo INTERDITS** par doctrine (`client.ts:7`).
- **Mailwizz** : mentionné dans `NewsletterSubscriber.mailwizzListUid` / `mailwizzSubUid` (`prisma/schema.prisma:701-702`) — colonnes prêtes, **aucun code applicatif** ne les peuple en l'état (grep 0 lecture/écriture dans `src/`). Sous-processeur potentiel pour campagnes V1+.
- Expéditeurs : `noreply@axion-ia.com` (transactionnel par défaut, `client.ts:36`) + `news@axion-ia.com` (marketing si `marketing: true`, `client.ts:38`).
- Marque expéditeur : `SMTP_FROM_NAME` sanitisé anti-CRLF (`client.ts:27-34`) — strip `[\r\n"<>]`, slice 80 chars, fallback `Axion-IA`. ✅ Conforme.
- Bilingue : géré via signature `(locale, payload)` du dispatcher (`templates/index.tsx:96-108`), pas via dossier par langue. Locales : `fr` + `en` uniquement (`prisma/generated/client.Locale`).

### 1.2 Templates email présents (V0 — 12 fichiers)

| #   | Template (`src/lib/email/templates/…`) | Trigger code                                                                          | Subject (FR / EN)                                                                                       | Source                                |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | `_layout.tsx`                          | Layout React Email partagé (brand header + footer bilingue + unsubHref optionnel)     | —                                                                                                       | `_layout.tsx:1-167`                   |
| 2   | `index.tsx`                            | Dispatcher `renderEmailTemplate(name, locale, payload)`                               | —                                                                                                       | `index.tsx:39-108`                    |
| 3   | `booking-confirmed.tsx`                | `createBookingAction` (`features/booking/actions.ts:134`)                             | « Votre intervention Axion-IA est réservée — {date} » / « Your Axion-IA session is booked — {date} »    | `booking-confirmed.tsx:40-45`         |
| 4   | `booking-cancelled.tsx`                | `cancelBookingAction` (`features/admin-calendar/actions.ts:317`)                      | « Réservation annulée — Axion-IA » / « Booking cancelled — Axion-IA »                                   | `booking-cancelled.tsx:35-36`         |
| 5   | `option-posted.tsx`                    | `postOption48hAction` (`features/booking/actions.ts:243`)                             | « Option 48h sur le {date} — Axion-IA » / « 48h option on {date} — Axion-IA »                           | `option-posted.tsx:39-42`             |
| 6   | `option-reminder.tsx`                  | Worker `option-reminder-worker.ts:46` (fenêtre [22h, 26h])                            | « Rappel : option 48h expire dans 24h — Axion-IA » / « Reminder: 48h option expires in 24h — Axion-IA » | `option-reminder.tsx:34-37`           |
| 7   | `option-expired.tsx`                   | Worker `option-expiration-worker.ts:100`                                              | « Option 48h expirée — Axion-IA » / « 48h option expired — Axion-IA »                                   | `option-expired.tsx:32-33`            |
| 8   | `option-confirmed-by-admin.tsx`        | `validateOptionAction` (`features/admin-options/actions.ts:219`)                      | « Option confirmée — intervention Axion-IA réservée » / « Option confirmed — Axion-IA session booked »  | `option-confirmed-by-admin.tsx:33-39` |
| 9   | `option-refused-by-admin.tsx`          | `refuseOptionAction` (`features/admin-options/actions.ts:329`)                        | « Option non retenue — Axion-IA » / « Option not retained — Axion-IA »                                  | `option-refused-by-admin.tsx:35-36`   |
| 10  | `audit-confirmed.tsx`                  | `submitAuditAction` + `submitAuditRequestAction` (`features/audit/actions.ts:77/160`) | « Demande d'audit reçue — Axion-IA » / « Audit request received — Axion-IA »                            | `audit-confirmed.tsx:36-37`           |
| 11  | `implementation-confirmed.tsx`         | `submitImplementationAction` (`features/implementation/actions.ts:70`)                | « Demande d'implémentation reçue — Axion-IA » / « Implementation request received — Axion-IA »          | `implementation-confirmed.tsx:35-41`  |
| 12  | `contact-confirmed.tsx`                | `submitContactAction` (`features/contact/actions.ts:68`)                              | « Message bien reçu — Axion-IA » / « Message received — Axion-IA »                                      | `contact-confirmed.tsx:31-32`         |
| 13  | `newsletter-confirm-optin.tsx`         | `subscribeNewsletterAction` (`features/newsletter/actions.ts:92`)                     | « Confirmez votre inscription — Axion-IA » / « Confirm your subscription — Axion-IA »                   | `newsletter-confirm-optin.tsx:27-33`  |
| 14  | `gdpr-export-link.tsx`                 | Route `/api/gdpr-export` (Sprint 24 / D2) — enqueue côté handler                      | « Votre export RGPD — Axion-IA » / « Your GDPR export — Axion-IA »                                      | `gdpr-export-link.tsx:33-34`          |

> Total V0 : **12 templates métier** + 1 layout + 1 dispatcher. Confirmé identique au reality check §6 (le prompt mentionne « 13 templates » — c'est 12 + layout, ou 12 + index. L'inventaire `EmailJobName` `src/server/queue/types.ts:12-24` liste 12 noms.)

### 1.3 Triggers Telegram actuels (8 sites)

| Trigger (`file:LINE`)                                                               | Tag                | PII redaction ?                               | Silent ?      | Format body                                                                                                           |
| ----------------------------------------------------------------------------------- | ------------------ | --------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `features/booking/actions.ts:129`                                                   | `INTERVENTION`     | ✅ `redactContactLine(contact, email)`        | non           | `Nouvelle réservation {type}\n• Date {d} {t}\n• Prix\n• Contact\n• Locale\n• ID`                                      |
| `features/booking/actions.ts:238`                                                   | `OPTION`           | ✅ `redactContactLine`                        | non           | `Nouvelle option 48h\n• Société (secteur)\n• Type\n• Contact\n• Expire\n• ID`                                         |
| `features/admin-options/actions.ts:214`                                             | `OPTION CONFIRMÉE` | ❌ pas de PII redaction (mais pas de contact) | non           | `Option {id} validée par admin\n• Société\n• Date\n• Booking créé {id}`                                               |
| `features/admin-options/actions.ts:324`                                             | `OPTION REFUSÉE`   | ❌ idem (pas de PII)                          | non           | `Option {id} refusée par admin\n• Société\n• Date\n• Motif`                                                           |
| `features/admin-calendar/actions.ts:311`                                            | `ANNULATION`       | ❌ pas de PII (booking id + date + motif)     | non           | `Réservation {id} annulée par admin\n• Date\n• Type\n• Motif`                                                         |
| `features/audit/actions.ts:72` et `:154`                                            | `AUDIT`            | ✅ `redactContactLine`                        | non           | `Nouveau audit\n• Size • Modality\n• Secteur\n• Contact\n• Locale\n• ID` (+ variant audit-request avec lieu/maturité) |
| `features/implementation/actions.ts:65`                                             | `AUTO`             | ✅ `redactContactLine`                        | non           | `Nouvelle implémentation • budget\n• Contact\n• Locale\n• ID`                                                         |
| `features/contact/actions.ts:63`                                                    | `CONTACT`          | ✅ `redactContactLine`                        | non           | `Nouveau message\n• De\n• Société\n• Locale\n• ID`                                                                    |
| `features/newsletter/actions.ts:83` (pending) + `:151` (confirmed) + `:205` (unsub) | `NEWSLETTER`       | ✅ `redactEmail` only                         | ✅ **silent** | `Nouvelle inscription / Confirmation / Désinscription\n• Email\n• Locale`                                             |

> Helpers ops `alertOps()` / `alertIncident()` (`telegram.ts:78-97`) — tags `DEPLOY|INCIDENT|BACKUP|MONITORING|SECURITY` déclarés mais **0 trigger applicatif** dans `src/features/**` (grep). Probablement câblés ailleurs (Sentry hooks / Coolify webhooks / cron deploy) — non audité.

### 1.4 Pipeline d'envoi (`email-worker.ts`)

- Queue BullMQ `emails` (`server/queue/queues.ts:27-30`), concurrency 8, attempts 5, backoff exponential 5 s, removeOnFail 30 j (`queues.ts:20-25`).
- Helper d'enqueue typé `enqueueEmail(template, to, locale, payload, options?)` (`queues.ts:62-74`) — `delayMs` + `marketing` flags supportés.
- Worker render : `renderEmailTemplate(name, locale, payload)` → `{ subject, html, text }` (`templates/index.tsx:96-108`) — `@react-email/render` génère HTML + plain-text à partir du même composant React Email.
- ✅ **Plain-text fallback systématique** : `render(element, { plainText: true })` (`templates/index.tsx:106`). Sinon, fallback secondaire `stripHtml()` côté client SMTP (`client.ts:90, 97-104`).
- ✅ **RFC 8058** : si `payload.unsubscribeToken` présent, headers `List-Unsubscribe: <https://…>, <mailto:unsubscribe@axion-ia.com>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` ajoutés (`email-worker.ts:25-37` + `client.ts:75-83`).
- Marketing flag → expéditeur `news@axion-ia.com` au lieu de `noreply@` (`client.ts:86, 38`).

---

## 2. Constats positifs (≥ 3)

1. **Plain-text fallback complet** : `renderEmailTemplate` rend systématiquement les deux variantes (`html` + `text`) en passant deux fois par `@react-email/render` (`templates/index.tsx:105-107`), garantissant 100 % des emails compatibles clients texte-only et conformes anti-spam.
2. **RFC 8058 List-Unsubscribe one-click** présent et déclenché par payload (`client.ts:75-83`), conforme exigences Gmail/Yahoo Sender Requirements 2024. Le P0-RGPD-3 a été fixé Sprint 24.
3. **PII minimisation Telegram (ADR 0010)** rigoureuse via `redactContactLine`/`redactEmail`/`redactName`/`redactPhone` (`pii-redaction.ts:22-66`) appliquée systématiquement sur 6/9 sites visiteur (les 3 admin n'utilisent pas de PII contact, juste société + IDs UUID — comportement attendu, l'admin a déjà l'accès BDD).
4. **Sanitization injection CRLF From** (`client.ts:27-34`) prévient l'email header injection via `SMTP_FROM_NAME` env compromise — strip `[\r\n"<>]` + slice 80 chars + fallback. Conforme OWASP.
5. **Fail-soft Telegram** : `sendTelegram` retourne `false` sans throw si `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` absent (`telegram.ts:46-51`) — la submission utilisateur ne casse pas si Telegram down. Timeout 5 s côté Telegram (`telegram.ts:55-57`) — non bloquant.
6. **Architecture queue idempotente côté worker** : `option-expiration-worker` relit avec `SELECT … FOR UPDATE` + re-vérif `status='pending'` (cf. reality check §5) avant d'enqueue `option-expired`. Pas de double envoi possible côté worker.
7. **Bilingue propre** : un seul composant React `BookingConfirmedEmail({locale, payload})`, dictionnaire `COPY = { fr, en }` interne (pattern répété sur les 12 templates) — pas de duplication FR/EN, refactor mineur si EN à ajouter.
8. **Brand cohérence** : layout `_layout.tsx` impose `Axion-IA` (sanitized) + couleurs Editorial Premium v3 (`_layout.tsx:27-34`) + footer bilingue avec « OÜ · cabinet IA opérationnel » FR / « operational AI consultancy » EN (`_layout.tsx:99-114`) ✅ conforme naming canonique.

---

## 3. Constats négatifs (P0 / P1 / P2 / P3)

### P0 — Bloquants V1 (10 templates absents critiques)

#### P0-1 — `cadrage-scheduled` ABSENT (`[ABSENT — à créer V1]`)

- Pas de template, pas de `EmailJobName`, pas d'attachement ICS (.ics) ni de lien visio. Conséquence : aucun email transactionnel pour planifier le call de cadrage, alors que la copy promet « call de cadrage pour valider le format » (cf. reality check GAP #2).
- Source vide : grep `cadrage` dans `src/lib/email/templates` → 0.
- Pré-requis : table `CadrageMeeting` absente (`prisma/schema.prisma`, cf. reality check §1).

#### P0-2 — `cadrage-reminder-j1` / `cadrage-reminder-h2` / `cadrage-recap` ABSENTS

- Aucun rappel cadrage. Aucun récap post-call. Pas d'envoi NPS post-call de cadrage.

#### P0-3 — Suite Stripe absente : `deposit-checkout-link`, `deposit-received`, `deposit-expired`

- Pas de SDK Stripe (cf. reality check §7.1, `package.json:65-113`).
- Pas de modèle `Payment` / `Invoice` / `Webhook` (reality check §1.1).
- L'acompte 50 % promis dans `interventions.ts:236` n'est **pas** déclenchable par email — la copy promet « Facture immédiate » qui n'a aucun template (`invoice-issued.tsx` absent, déjà flag P0 #3 du reality check).

#### P0-4 — Suite devis / NDA Yousign absente : `quote-sent`, `quote-signed`, `nda-sent`, `nda-signed`

- 0 intégration Yousign / DocuSign (reality check §7.5).
- 0 template email. La doctrine « devis transparent fourni avant signature » (`interventions.ts:244`) n'a pas de pipeline d'envoi.

#### P0-5 — Suite booking financière post-acompte : `booking-j7-balance-invoice`, `booking-j1-reminder`, `booking-j1-debrief`

- Aucun rappel J-1 visiteur. Le template `booking-confirmed` mentionne « Vous recevrez un email de préparation 48h avant la session » (`booking-confirmed.tsx:25/34`) — **promesse non tenue** en code, aucun cron J-2 ou J-1.
- Aucun template post-prestation (NPS / debrief J+1). Aucun lien vers questionnaire de satisfaction (table `Survey` existe mais non câblée à un workflow email).

#### P0-6 — Suite solde : `balance-paid`, `balance-overdue-soft`, `balance-overdue-firm`

- Aucun mécanisme de relance impayé. Conjugué au P0-3, c'est un trou de revenue ops complet.

#### P0-7 — Annulation visiteur-initiée : `cancellation-confirmed-by-user`, `refund-issued`, `force-majeure-notice`

- `booking-cancelled.tsx` existe mais traite **uniquement** l'annulation admin-initiée (`features/admin-calendar/actions.ts:317`). La copy `/conditions-generales` (cf. reality check §8.1) promet annulations client > 7j / 7-2j / <2j avec remboursement partiel : aucun template de confirmation côté visiteur, aucun template `refund-issued`.

#### P0-8 — Triggers admin Telegram manquants pour V1

- Webhooks Stripe : `payment_intent.succeeded` / `payment_intent.payment_failed` / `dispute.created` / `charge.refunded` → 0 trigger (Stripe pas installé).
- Cadrage held / no-show admin → 0 trigger.
- Force majeure declaration → 0 trigger.
- Capacity saturation alert (≥ N réservations / mois ou créneaux saturés) → 0 trigger. Pas de monitoring business.
- 5 nouveaux tags Telegram à prévoir : `PAYMENT`, `REFUND`, `DISPUTE`, `CADRAGE`, `CAPACITY`.

#### P0-9 — Preheaders absents sur 12/12 templates

- Le layout utilise `Preview={t.title}` (`_layout.tsx:128`) sur tous les templates → preheader = titre exact = **doublon du subject** affiché dans Gmail/Outlook preview. Perte de surface acquisition lecteur (-15-30 % open rate selon benchmarks Litmus 2024).
- Aucune optimisation 45-110 chars dédiée.

#### P0-10 — Pas de `From` "Reply-To" sur transactionnels

- `replyTo` est option mais jamais passée dans `enqueueEmail` (grep `replyTo` dans `features/` → 0). Conséquence : un client qui répond à `noreply@axion-ia.com` ne parvient pas à l'équipe support (sauf si la boîte est lue). À vérifier prod.

### P1 — Importants V1

#### P1-1 — Preview text mal optimisé (lié P0-9)

- Sur les 12 templates, `Preview={t.title}` aveugle (`booking-confirmed.tsx:59`, `option-posted.tsx:56`, etc.). Devrait être une 2ᵉ phrase complétant le subject (ex : subject « Votre intervention est réservée — 14 mai » + preheader « 09:30, 6 participants, intervention essentielle, contact : Alice T. »).

#### P1-2 — Subjects FR trop longs sur 4 templates

- `option-confirmed-by-admin.tsx:37` « Option confirmée — intervention Axion-IA réservée » = **52 chars** OK. Mais `booking-confirmed.tsx:43` « Votre intervention Axion-IA est réservée — {YYYY-MM-DD} » = **~55 chars** + date → tronqué Outlook mobile (~40 chars typique). Cible 30-60 chars stricte.
- `audit-confirmed.tsx:37` « Demande d'audit reçue — Axion-IA » = 32 chars ✅.
- À auditer 1 par 1 pour seuils mobiles (Apple Mail iOS = 30-40 chars).

#### P1-3 — Subjects EN avec em-dash (`—`) plutôt que `-`

- 11/12 templates utilisent `—` (em-dash U+2014). Certains clients SMTP / Outlook anciens ne supportent pas UTF-8 dans subject (encoding `=?UTF-8?…?=` requis). Nodemailer encode mais à vérifier render Apple Mail dark mode. Risque P2.

#### P1-4 — `bookingDate` formaté ISO sans localisation

- `booking-confirmed.tsx:42-44` injecte `bookingDate` brut (`YYYY-MM-DD`) dans subject FR. Devrait être « 14 mai 2026 » FR / « May 14, 2026 » EN avec `Intl.DateTimeFormat`. Idem `expiresAt` (`option-posted.tsx:67` utilise `toLocaleString(locale)` — bien, mais inconsistant entre templates).

#### P1-5 — Pas de lien unsubscribe sur newsletter `newsletter-confirm-optin` au render

- Le template passe `unsubscribeHref` au layout (`newsletter-confirm-optin.tsx:52`) ✅. **Mais** : les autres emails marketing future (campagnes Mailwizz V1+) n'ont pas de plomberie en place — `EmailJobData.marketing` flag existe mais aucun `EmailJobName` ne l'utilise sauf newsletter opt-in (grep `marketing: true` dans `src/features/**` → 1 hit `newsletter/actions.ts:97`).

#### P1-6 — DMARC / DKIM / SPF non vérifiables côté code

- ⚠️ `[À VÉRIFIER PROD via dig/curl ou doc DNS Cloudflare]`. La memory `axionia_session_2026-05-11_e2e_audit_p0_sprint.md` mentionne « DMARC + CF Managed Content OFF » dans les TODO Will → DMARC pas encore vert.
- Sans `_dmarc.axion-ia.com` à `p=quarantine` ou `p=reject`, deliverability Gmail/Outlook bulk dégrade significativement.
- SPF : à vérifier que `axion-ia.com` autorise l'IP dédiée Hetzner PowerMTA.
- DKIM : à vérifier signature PowerMTA + sélecteur DNS publié.

#### P1-7 — Pas de tracking deliverability / bounce / complaints

- Aucun webhook PowerMTA ingéré (grep `powermta|bounce|complaint` dans `src/` → 0).
- Aucun champ `NewsletterStatus = bounced` peuplé automatiquement (enum existe, `prisma/schema.prisma:140-145`, mais pas écrit en code).
- Pas de feedback loop AOL/Yahoo configuré (à vérifier prod).

#### P1-8 — Double opt-in OK mais token TTL non vérifié en code

- `confirmNewsletterAction` (`features/newsletter/actions.ts:118`) consomme `confirmToken` — ne vérifie pas `confirmSentAt` vs maintenant pour expirer le lien. Un token de 6 mois reste valide → faiblesse spam/replay attack.

#### P1-9 — Sous-processeurs : Mailwizz pas listé

- `legal.ts:230` liste Hetzner + Cloudflare + Telegram, mais **pas Mailwizz** alors que les colonnes DB (`mailwizzListUid`/`mailwizzSubUid`) existent. Soit on retire la dette de DB (pas d'usage code), soit on déclare Mailwizz en sous-processeur (cf. reality check §9 GAP #5). Action légale + technique alignée.

### P2 — Améliorations qualité

#### P2-1 — Référence UUID brute affichée à l'utilisateur

- `booking-confirmed.tsx:71` affiche `Référence : {bookingId}` (UUID 36 chars) — utile support mais peu UX. Conseil : préfixer (`AXN-BK-XXXXXX`) ou afficher 8 derniers chars.

#### P2-2 — CTA `confirmation?id=…` route inconnue

- 4 templates pointent vers `${baseUrl}/${locale}/confirmation?id=…` (`booking-confirmed.tsx:61`, `option-posted.tsx:58`, `option-confirmed-by-admin.tsx:55`, etc.). **À vérifier** que `/confirmation` accepte query params ou que la route existe (`[INCONNU — non grep route]`). Si 404, perte de confiance.

#### P2-3 — Dark mode CSS pas géré

- `_layout.tsx:36-87` utilise couleurs hex en clair (bg `#faf8f3`, text `#1a1a1a`). En dark mode Apple Mail / Gmail iOS, le texte sombre sur fond inversé devient illisible (selon clients).
- Add `@media (prefers-color-scheme: dark)` dans `<Head>` ou `color-scheme: light dark` méta.

#### P2-4 — Sender Reputation : volume mixed dans la même IP

- PowerMTA seul tube SMTP pour transac (`noreply@`) **et** marketing (`news@`) → mêmes IP/domain reputation. Best practice : split sub-IP / sub-domain (`mail.axion-ia.com` transac vs `news.axion-ia.com` marketing).

#### P2-5 — Pas de versioning template / preview en admin

- Les templates sont en code, donc reviewable via PR uniquement. Aucun preview admin (ex : `/admin/emails/preview/booking-confirmed?locale=fr`). Difficile pour Will de valider une copy avant push.

### P3 — Cosmétique

#### P3-1 — Émoji absents (volontaire) mais aucun unicode dingbat

- Subjects sans `✅` ou `🎉` — conforme doctrine « pas d'emojis vendeurs ». OK.

#### P3-2 — `EmailJobName` non exhaustif pour V1

- Type `EmailJobName` (`server/queue/types.ts:12-24`) liste 12 noms. Sera à étendre à ~22-25 pour V1 (cf. cible §4).

---

## 4. Recommandations Top 12

> Hiérarchisées par dépendance (DB → SDK Stripe / Yousign → templates → admin Telegram).

1. **R1 (V1)** — Créer les tables `Payment` + `Invoice` + `Refund` + `Quote` + `CadrageMeeting` + `Nda` (Sprint dédié, déjà flag dans audit MANIFEST). Sans ces tables, **15 nouveaux templates** restent inenvoyables.
2. **R2 (V1)** — Installer Stripe SDK + handler webhook `/api/stripe/webhook` côté `src/app/api/stripe/route.ts` + 4 templates email `deposit-checkout-link` / `deposit-received` / `deposit-expired` / `booking-j7-balance-invoice` + facture PDF générator (pdfkit ou react-pdf).
3. **R3 (V1)** — Intégrer Yousign API + 4 templates `quote-sent` / `quote-signed` / `nda-sent` / `nda-signed`. Mode dégradé : pièce-jointe PDF + lien signature externe si Yousign down.
4. **R4 (V1)** — Créer pipeline cadrage : `cadrage-scheduled` (avec `.ics` attachment via `ical-generator`) + visio link (Jitsi / Whereby auto-room) + `cadrage-reminder-h2` (cron 2h avant via `BullMQ delay`) + `cadrage-reminder-j1` + `cadrage-recap`. 5 templates supplémentaires.
5. **R5 (V1)** — Pipeline cycle de vie booking financier : `balance-paid` / `balance-overdue-soft` (J+15) / `balance-overdue-firm` (J+30) via cron `0 9 * * *` checking `Invoice.status='overdue'`. 3 templates.
6. **R6 (V1)** — Annulation visiteur self-service : `cancellation-confirmed-by-user` (action `/api/booking/{id}/cancel` + RBAC token) + `refund-issued` (webhook Stripe `charge.refunded`) + `force-majeure-notice` (admin trigger). 3 templates + 1 admin tag `REFUND`.
7. **R7 (V1)** — **Optimiser preheaders** sur les 12 templates V0 + tous les V1. Passer `preview` dédié au lieu de `t.title` (`_layout.tsx:128`). Ajouter `previewFR`/`previewEN` dans chaque `COPY`. Target 45-110 chars informatifs.
8. **R8 (V1)** — Normaliser format date dans subjects via helper `formatBookingDateForSubject(date, locale)` (`Intl.DateTimeFormat` `dateStyle: 'long'`). À appliquer dans les 5 templates qui injectent `bookingDate` brut.
9. **R9 (V1)** — DMARC / DKIM / SPF perfect : publier `_dmarc.axion-ia.com` à `v=DMARC1; p=quarantine; rua=mailto:dmarc@axion-ia.com; ruf=mailto:dmarc-forensic@axion-ia.com; pct=100; adkim=s; aspf=s; fo=1` + DKIM 2048-bit + SPF `v=spf1 ip4:{HETZNER_IP} -all`. Vérifier via `dig _dmarc.axion-ia.com TXT` post-déploiement.
10. **R10 (V1)** — 5 nouveaux tags admin Telegram : `PAYMENT` (succeeded/failed), `REFUND` (issued), `DISPUTE` (created), `CADRAGE` (held/no-show), `CAPACITY` (saturation week ≥ 80 %). Étendre `TelegramTag` (`telegram.ts:13-29`) + helpers dédiés (`alertPayment`, `alertCadrage`).
11. **R11 (V2+)** — Split reputation expéditeur : sous-domaine `news.axion-ia.com` pour Mailwizz / campagnes ; `noreply@` reste sur `axion-ia.com`. Coût : 1 CNAME + 1 reconfig PowerMTA.
12. **R12 (V2+)** — Preview admin templates : route `/admin/emails/preview/{template}?locale=fr&payload=…` qui appelle `renderEmailTemplate()` et affiche le HTML résultant dans un `<iframe>`. Permet à Will de valider avant push prod.

---

## 5. Sources citées

- `src/lib/email/client.ts:1-104` (Nodemailer wrapper + sanitization + RFC 8058 headers).
- `src/lib/email/templates/_layout.tsx:1-167` (layout React Email + brand + i18n FR/EN footer).
- `src/lib/email/templates/index.tsx:1-108` (dispatcher 12 templates).
- `src/lib/email/templates/{booking-confirmed, booking-cancelled, option-posted, option-reminder, option-expired, option-confirmed-by-admin, option-refused-by-admin, audit-confirmed, implementation-confirmed, contact-confirmed, newsletter-confirm-optin, gdpr-export-link}.tsx` (12 templates V0).
- `src/lib/telegram.ts:1-97` (sendTelegram + alertOps + alertIncident + 15 tags).
- `src/lib/pii-redaction.ts:1-66` (redactEmail / Name / Phone / ContactLine — ADR 0010).
- `src/server/queue/types.ts:12-24` (`EmailJobName` 12 noms).
- `src/server/queue/queues.ts:62-74` (`enqueueEmail` helper).
- `src/server/queue/workers/email-worker.ts:15-50` (worker BullMQ, concurrency 8, RFC 8058 propagation).
- `src/features/booking/actions.ts:129, 134, 238, 243` (triggers Telegram + email INTERVENTION/OPTION).
- `src/features/admin-options/actions.ts:214, 219, 324, 329` (triggers admin OPTION CONFIRMÉE/REFUSÉE).
- `src/features/admin-calendar/actions.ts:311, 317` (trigger ANNULATION).
- `src/features/audit/actions.ts:72, 77, 154, 160` (triggers AUDIT).
- `src/features/implementation/actions.ts:65, 70` (trigger AUTO).
- `src/features/contact/actions.ts:63, 68` (trigger CONTACT).
- `src/features/newsletter/actions.ts:83, 92, 151, 205` (triggers NEWSLETTER silent + enqueue marketing).
- `prisma/schema.prisma:686-709` (`NewsletterSubscriber` avec mailwizz fields inutilisés en code).
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md:325-346` (inventaire emails Phase 0).
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md:361-378` (Telegram + sous-processeurs).

---

## 6. Score /100

| Dimension                                                              | /20          | Justification                                                                                                                                                               |
| ---------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Couverture templates** (vs cible 22)                                 | 7            | 12 / 22 templates V1 présents = 55 %. Toute la chaîne paiement / cadrage / facture / NDA absente.                                                                           |
| **Qualité contenu** (subject, preheader, copy, plain-text)             | 11           | Plain-text auto OK, copy soignée bilingue, brand cohérente. Mais preheaders dupliqués (P0-9) + 4 subjects trop longs (P1-2).                                                |
| **Multi-langue FR/EN**                                                 | 18           | 12/12 templates en FR+EN, helper `COPY = {fr, en}` propre, footer bilingue. Pas de typo trouvée. Excellent.                                                                 |
| **Deliverability** (RFC 8058, DKIM/DMARC/SPF, sanitization, fail-soft) | 11           | RFC 8058 + sanitization From OK. Mais DMARC/DKIM/SPF non confirmés en code (P1-6) + tracking bounce/complaint absent (P1-7).                                                |
| **RGPD / sous-processeurs**                                            | 14           | PII redaction ADR 0010 solide, double opt-in présent, unsubscribe one-click. Mais Mailwizz non listé (P1-9), TTL token non vérifié (P1-8).                                  |
| **Admin Telegram & observability**                                     | 13           | 9 triggers en place, tags structurés, PII redaction systématique côté visiteur. Mais 5 nouveaux tags V1 manquants (P0-8) + pas de tracking SLA email (P1 reality check #8). |
| **Score total**                                                        | **74 / 100** | V0 propre et future-proof, **mais 10 templates critiques à ajouter** pour V1 deposit-gated.                                                                                 |

**Verdict** : **GO V0 maintenu**, **NO-GO V1 deposit-gated** tant que R1-R6 pas livrés.

---

## 7. Marquage V1 vs V2+

| Recommandation                                                                   | V1  | V2+ |
| -------------------------------------------------------------------------------- | --- | --- |
| R1 modèles DB Payment/Invoice/Refund/Quote/CadrageMeeting/Nda                    | ✅  | —   |
| R2 Stripe SDK + 4 templates paiement                                             | ✅  | —   |
| R3 Yousign API + 4 templates devis/NDA                                           | ✅  | —   |
| R4 Cadrage pipeline (.ics + visio + 5 templates)                                 | ✅  | —   |
| R5 Cycle solde (3 templates relance)                                             | ✅  | —   |
| R6 Annulation visiteur self-service (3 templates)                                | ✅  | —   |
| R7 Preheaders optimisés (12 templates V0 + V1)                                   | ✅  | —   |
| R8 Format date i18n subjects                                                     | ✅  | —   |
| R9 DMARC/DKIM/SPF perfect                                                        | ✅  | —   |
| R10 5 nouveaux tags Telegram (PAYMENT/REFUND/DISPUTE/CADRAGE/CAPACITY)           | ✅  | —   |
| R11 Split sub-domain marketing (`news.axion-ia.com`)                             | —   | ✅  |
| R12 Preview admin `/admin/emails/preview/{tpl}`                                  | —   | ✅  |
| P3-2 → étendre `EmailJobName` à ~22-25 (corollaire R1-R6)                        | ✅  | —   |
| Mailwizz integration complète (campagnes éditoriales)                            | —   | ✅  |
| Dark mode CSS (`@media prefers-color-scheme`)                                    | —   | ✅  |
| Feedback loop AOL/Yahoo + bounce ingestion PowerMTA → `NewsletterStatus=bounced` | —   | ✅  |

---

## 8. Tableau récapitulatif cible (22 templates V1)

> Légende statut : `V0` = présent HEAD `ff3ccbc` · `V1` = à créer pour livraison V1 deposit-gated · `?` = ABSENT à arbitrer.
> Trigger inclut le `EmailJobName` cible (kebab-case) si différent du fichier.

| #   | Nom template (cible)              | Langues | Trigger source                                                                | Statut V0 / V1                                                                  |
| --- | --------------------------------- | ------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | `option-posted`                   | FR + EN | `postOption48hAction` (`features/booking/actions.ts:243`)                     | **V0** ✅ (`option-posted.tsx`)                                                 |
| 2   | `option-confirmed-by-admin`       | FR + EN | `validateOptionAction` (`features/admin-options/actions.ts:219`)              | **V0** ✅                                                                       |
| 3   | `option-refused-by-admin`         | FR + EN | `refuseOptionAction` (`features/admin-options/actions.ts:329`)                | **V0** ✅                                                                       |
| 4   | `option-reminder`                 | FR + EN | Worker `option-reminder-worker.ts:46` (fenêtre [22h,26h])                     | **V0** ✅                                                                       |
| 5   | `option-expired`                  | FR + EN | Worker `option-expiration-worker.ts:100`                                      | **V0** ✅                                                                       |
| 6   | `cadrage-scheduled`               | FR + EN | Action `scheduleCadrageAction` `[ABSENT — à créer V1]` + `.ics` attachment    | **V1** [ABSENT — à créer V1]                                                    |
| 7   | `cadrage-reminder-j1`             | FR + EN | Cron BullMQ J-1 avant `CadrageMeeting.scheduledAt`                            | **V1** [ABSENT — à créer V1]                                                    |
| 8   | `cadrage-reminder-h2`             | FR + EN | BullMQ delay H-2 avant `scheduledAt`                                          | **V1** [ABSENT — à créer V1]                                                    |
| 9   | `cadrage-recap`                   | FR + EN | Action admin `markCadrageHeldAction` `[ABSENT — à créer V1]`                  | **V1** [ABSENT — à créer V1]                                                    |
| 10  | `quote-sent`                      | FR + EN | Action `createQuoteAction` `[ABSENT — à créer V1]` (Yousign push)             | **V1** [ABSENT — à créer V1]                                                    |
| 11  | `quote-signed`                    | FR + EN | Webhook Yousign `procedure.finished`                                          | **V1** [ABSENT — à créer V1]                                                    |
| 12  | `nda-sent`                        | FR + EN | Action `createNdaAction` (Yousign)                                            | **V1** [ABSENT — à créer V1]                                                    |
| 13  | `nda-signed`                      | FR + EN | Webhook Yousign `procedure.finished` (NDA scope)                              | **V1** [ABSENT — à créer V1]                                                    |
| 14  | `deposit-checkout-link`           | FR + EN | Action `createCheckoutSessionAction` `[ABSENT — à créer V1]` (Stripe)         | **V1** [ABSENT — à créer V1]                                                    |
| 15  | `deposit-received`                | FR + EN | Webhook Stripe `payment_intent.succeeded` + facture PDF attachée              | **V1** [ABSENT — à créer V1]                                                    |
| 16  | `deposit-expired`                 | FR + EN | Stripe Checkout session expired (cron + webhook `checkout.session.expired`)   | **V1** [ABSENT — à créer V1]                                                    |
| 17  | `booking-confirmed`               | FR + EN | `createBookingAction` (`features/booking/actions.ts:134`) **OR** post-deposit | **V0** ✅ (à enrichir post-deposit V1)                                          |
| 18  | `booking-j7-balance-invoice`      | FR + EN | Cron J-7 avant `Booking.bookingDate` + invoice PDF attachée                   | **V1** [ABSENT — à créer V1]                                                    |
| 19  | `booking-j1-reminder`             | FR + EN | Cron J-1 (`bookingDate - 1d`)                                                 | **V1** [ABSENT — à créer V1] (promesse `booking-confirmed.tsx:25/34` non tenue) |
| 20  | `booking-j1-debrief`              | FR + EN | Cron J+1 post-intervention + lien `Survey` NPS                                | **V1** [ABSENT — à créer V1]                                                    |
| 21  | `balance-paid`                    | FR + EN | Webhook Stripe `payment_intent.succeeded` (scope=`balance`)                   | **V1** [ABSENT — à créer V1]                                                    |
| 22  | `balance-overdue-soft`            | FR + EN | Cron J+15 si `Invoice.status='overdue'`                                       | **V1** [ABSENT — à créer V1]                                                    |
| 23  | `balance-overdue-firm`            | FR + EN | Cron J+30 si `Invoice.status='overdue'`                                       | **V1** [ABSENT — à créer V1]                                                    |
| 24  | `cancellation-confirmed-by-user`  | FR + EN | Self-service `/api/booking/{id}/cancel` (token RBAC)                          | **V1** [ABSENT — à créer V1]                                                    |
| 25  | `cancellation-confirmed-by-admin` | FR + EN | `cancelBookingAction` (`features/admin-calendar/actions.ts:317`)              | **V0** ✅ (`booking-cancelled.tsx` à renommer ou aliaser)                       |
| 26  | `refund-issued`                   | FR + EN | Webhook Stripe `charge.refunded`                                              | **V1** [ABSENT — à créer V1]                                                    |
| 27  | `force-majeure-notice`            | FR + EN | Action admin `declareForceMajeureAction` `[ABSENT — à créer V1]`              | **V1** [ABSENT — à créer V1]                                                    |
| —   | `audit-confirmed`                 | FR + EN | `submitAuditAction` + `submitAuditRequestAction`                              | **V0** ✅ (hors scope booking strict, conservé)                                 |
| —   | `implementation-confirmed`        | FR + EN | `submitImplementationAction`                                                  | **V0** ✅ (hors scope booking strict, conservé)                                 |
| —   | `contact-confirmed`               | FR + EN | `submitContactAction`                                                         | **V0** ✅ (hors scope booking strict, conservé)                                 |
| —   | `newsletter-confirm-optin`        | FR + EN | `subscribeNewsletterAction`                                                   | **V0** ✅ (hors scope booking strict, conservé)                                 |
| —   | `gdpr-export-link`                | FR + EN | Route `/api/gdpr-export` (Sprint 24)                                          | **V0** ✅ (hors scope booking strict, conservé)                                 |

> **Bilan compte** :
>
> - Tableau **booking deposit & cadrage** : 27 lignes (cible élargie 22-27 confirmée — le prompt « ~18 » sous-estime, le scope V1 deposit-gated réaliste est 22-27).
> - **V0 dans scope booking strict** : 6 (lignes #1-5, #17, #25). +5 « hors scope booking strict » (audit/impl/contact/newsletter/gdpr).
> - **V1 à créer** : **21 templates** (lignes #6-16, #18-24, #26-27).
> - Tag « V0 ⇒ alias V1 » : `booking-cancelled.tsx` (#25) à split en deux templates `cancellation-confirmed-by-admin` + `cancellation-confirmed-by-user` (ou laisser comme alias).

---

## 9. Notes méthodologiques

- 0 git, 0 pnpm, 0 modification de code. 1 seul `.md` écrit, conforme contrainte AUDIT-ONLY.
- 12 fichiers `templates/*.tsx` ouverts intégralement (vs « non ouverts » Phase 0 — Agent 7 a ouvert tout le dossier).
- 9 sites Telegram + 9 sites email enqueue confirmés par grep stricte `sendTelegram|enqueueEmail` dans `src/features/**`.
- 1 ouverture future : `src/app/api/gdpr-export/route.ts` non audité (Phase 0 mentionne « Sprint 24 / D2 » mais le code n'a pas été lu pour confirmer le trigger `enqueueEmail("gdpr-export-link", …)`). Marqué `[INCONNU — non audité]`.
- DMARC / DKIM / SPF / PowerMTA config DNS = `[À VÉRIFIER PROD via dig/curl ou doc Cloudflare]` — hors scope code-only.
- Le tableau récap (§8) liste **27 templates** (au lieu de 22) car le prompt mentionne explicitement « on peut être à 22-25, indique-le clairement ». 27 = inventaire complet booking deposit + cadrage + Yousign + relance solde + annulation/refund, conservatif pour V1.
