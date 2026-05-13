# Agent 10 — Pre-booking (cadrage + devis + NDA + signature électronique)

**Mode** : 🚫 AUDIT-ONLY (lecture seule, aucune modification de code applicatif).
**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` · HEAD `ff3ccbc9`.
**Date** : 2026-05-12.
**Référence** : `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` §3 Agent 10 (défauts D9, D10, D11, D12, D13).
**Brief amont** : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md` (Stripe + Yousign + visio provider confirmés ABSENTS V0).

> Cet agent décrit **sur papier** la couche pre-booking V1 : cadrage avant acompte, devis (seuil > 5 000 € HT), NDA (seuil entreprise/secteur), onboarding docs post-acompte. Le périmètre Convention de formation Qualiopi est explicitement reporté V2+ (`_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` §0.0bis). Aucun code n'est écrit ici.

---

## 1. Périmètre audité

### 1.1 Inclus

1. **Call de cadrage** (D10) — étape 2/5 du tunnel doctrine (`src/content/interventions.ts:220` — « 1) je réserve 2) call de cadrage 3) acompte 50% 4) journée 5) solde + frais »).
   - Transition cible `option_pending → cadrage_scheduled → cadrage_held` (cf. Agent 3, `_AUDIT/.../agent-03-state-machine.md`).
   - Booking d'un slot 30 min visio.
   - Outil visio recommandé (Jitsi self-hosted vs Whereby vs Google Meet vs Zoom).
   - Lien visio + `.ics` calendar attachment.
   - Annulation/reschedule cadrage par client via lien magique.
   - Validation post-call par Will (« intervention pertinente OUI/NON ») → transition state machine.
   - **Skip cadrage automatique** pour `audit_flash_onsite` (D9, cohérent avec `audit-detail-configs.ts:204-217` qui pose `ctaType: "calendar"` direct, contrairement aux autres tiers `ctaType: "contact"`).
2. **Devis Yousign** (D11) — déclenché si `amountHtCents > 5_000_00` (500 000 centimes = 5 000 €).
   - Génération PDF via service-side render.
   - Table `Quote` (cf. §5.1 prompt source).
   - TVA agnostique (`vatRate`, `vatReverseCharge`) — pas de présomption FR 20 % ou EE 0 %.
   - Workflow Yousign API v3 : signature request → email signataire → webhook `quote_signed`.
   - Expiration 7j.
3. **NDA Yousign** (D12) — déclenché si `companySize ∈ {ETI, GRANDE_ENTREPRISE}` OU `companySector ∈ {finance, santé, défense}`.
   - Template NDA standard + variables paramétrables (juridiction non figée).
   - Yousign signature request + webhook `nda_signed`.
   - Expiration 7j.
4. **Onboarding docs** (D13) — post-acompte, file request signé R2 ou Hetzner Storage Box, signed URL 7j, notification admin (Telegram + email).

### 1.2 Hors V1 (reporté V2+)

- **Convention de formation Qualiopi/OPCO** — `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` §0.0bis. Hook V1 : champ nullable `Booking.trainingSessionId` peut être ajouté en colonne anticipée _sans_ table associée V1. Pas de table `TrainingSession` créée V1.
- **Signature qualifiée eIDAS (QES)** — V1 = SES (Simple Electronic Signature) Yousign Standard. AES (Advanced) si seuil business le justifie en V2+.
- **Mise en demeure cadrage no-show** — V2+ (suivi formel des participations dirigeants).
- **Pre-fill cadrage depuis CRM/Notion** — V2+ (intégration externe hors scope).

---

## 2. Constats positifs V0

> Peu d'éléments à conserver (la couche pre-booking n'existe pas en code). Ce qui existe est exploitable comme fondation :

1. **`Submission` riche et bien indexée** (`prisma/schema.prisma:157-195`) — porte déjà `companyName`, `sector`, `address`, `employeesCount`, `contactName`, `contactRole`, `contactEmail`, `contactPhone`, `details Json`. Permet d'alimenter sans friction la détection NDA via `employeesCount` (mapping INSEE) + `sector`.
2. **`BookingOption` 48h avec verrou pessimiste** (`src/features/booking/actions.ts:191-235`) — le slot est **déjà réservé** avant cadrage. La cible V1 « call de cadrage avant acompte » s'insère **sans casser** la mécanique de verrouillage : transition `option_pending → cadrage_scheduled` se fait sur la `BookingOption` existante, le `Booking` final n'est créé qu'après acompte.
3. **RBAC 4 rôles + `requireAdminWrite`/`Read`** opérationnels (`src/features/admin-options/actions.ts:122/243`) — réutilisables pour les Server Actions admin du pre-booking (`markCadrageHeldAction`, `triggerQuoteSignatureAction`, etc.).
4. **PII redaction Telegram** (`src/lib/pii-redaction.ts`, ADR 0010) — déjà appliquée à toutes les notifications. Réutilisable pour `cadrage-scheduled` / `quote-signed` / `nda-signed` / `onboarding-doc-uploaded`.
5. **Queue `emails` + `enqueueEmail`** (`src/server/queue/queues.ts:27` + `workers/email-worker.ts:15`) — supporte déjà attempts:5 + DLQ 30j + RFC 8058 headers. Aucune nouvelle infrastructure queue à introduire pour les emails pre-booking (5 templates supplémentaires suffisent).
6. **Doctrine TVA-agnostique** déjà appliquée dans `_AUDIT/` (cf. mémoire AxionIA pricing centralization 2026-05-08). Aucune réécriture nécessaire — la table `Quote` hérite naturellement de `vatRate` + `vatReverseCharge`.
7. **Hetzner Storage Box** déjà mentionné comme stockage backup dans `legal.ts:226-231` — provider `OnboardingDoc` cohérent doctrine UE (vs R2 US — cf. §4.3).
8. **`audit_flash_onsite` enum déjà aligné** (`prisma/migrations/20260512100000_audit_flash_onsite_enum/`) — la branche « skip cadrage » est triviale à brancher sur `Booking.interventionType === 'audit_flash_onsite'`.

---

## 3. Constats négatifs

### 3.1 🚨 P0 — bloquants V1

- **P0-1 · CadrageMeeting absent** — aucune table, aucune action serveur, aucun email, aucun provider visio. Le tunnel doctrine `interventions.ts:220` promet « call de cadrage » sur **5+ pages produit** (Grep `cadrage` = 29 fichiers `.ts/.tsx`) mais aucun mécanisme. C'est la plus grosse contradiction copy/code du périmètre pre-booking. Source : `prisma/schema.prisma` (no `Cadrage`) + `_AUDIT/.../00-REALITY-CHECK.md` ligne 26.
- **P0-2 · Aucune intégration provider visio** — Grep `jitsi|whereby|meet\.|google.?meet|visio` = 26 fichiers mais **uniquement de la copy** (cf. `_AUDIT/.../00-REALITY-CHECK.md` §7.6). Aucun lien généré, aucun calendar invite envoyé. Conséquence : si Will valide V1 sans provider, le call de cadrage est un Google Meet manuel envoyé à la main = friction Will + risque dropped slot.
- **P0-3 · Quote absente** — aucune table, aucun PDF generator, aucune numérotation, aucun template `quote-sent`. La copy `interventions.ts:236` (« facture immédiate ») + `interventions.ts:244-246` (« devis transparent fourni avant signature ») crée une **promesse opposable** sans mécanisme. Source : `_AUDIT/.../00-REALITY-CHECK.md` §9 GAP #7.
- **P0-4 · NDA absent** — aucune table `Nda`/`SignatureRequest`, aucun template, aucun provider e-signature (`yousign` absent du `package.json:65-113`). En l'état un prospect ETI/banque/santé qui demande un NDA reçoit un PDF Word à la main = signal premium cassé. Source : `_AUDIT/.../00-REALITY-CHECK.md` §9 GAP #16.
- **P0-5 · Pas de Server Actions cible** — aucune des 5 actions cibles (`scheduleCadrageMeetingAction`, `markCadrageHeldAction`, `triggerQuoteSignatureAction`, `triggerNdaSignatureAction`, `requestOnboardingDocsAction`) n'existe (`_AUDIT/.../00-REALITY-CHECK.md` §2.1/2.2 — 53 actions admin couvrent **uniquement** content + auth + calendar + options + submissions). Sans elles, aucun arbitrage admin n'est possible depuis la console.

### 3.2 ⚠️ P1 — qualité V1 essentielle

- **P1-1 · Pas de détection automatique NDA basée INSEE** — `BookingCalendar.tsx:231-239` propose 5 buckets effectifs (`1-9`, `10-49`, `50-249`, `250-999`, `1000+`) mais aucune normalisation INSEE (`TPE/PME/ETI/GRANDE_ENTREPRISE`). Pour brancher la règle « ETI/grande-entreprise = NDA auto » il faut un mapping explicite `lib/insee-size.ts` (`50-249 → PME`, `250-999 → ETI`, `1000+ → GRANDE_ENTREPRISE`) — ne pas réinventer le buckets, **mapper** vers INSEE.
- **P1-2 · `companySector` libre** (`prisma/schema.prisma:172` champ `sector? VarChar(100)`) — aucun enum, aucune liste contrôlée. La règle « finance/santé/défense → NDA auto » exige soit un enum, soit une regex tolérante (`/\b(finance|banque|assurance|sant[eé]|m[eé]dical|d[eé]fense|d[eé]fence|military|arm[eé]e)\b/i`). Risque : regex sur texte libre = faux négatifs (FinTech, BioTech, Aerospace). Recommandation : enum `CompanySectorTag` ou liste fermée curée — STOP-AND-ASK Will.
- **P1-3 · Pas de gestion 7j d'expiration côté DB** — la table `Quote` cible définit `validUntil` mais aucune cron ne flippe `status` à `expired`. Réutilisable : queue `option-expiration` (`src/server/queue/queues.ts:32`) avec un worker dédié `quote-expiration-worker` (concurrency 1 + sentinel `expiresAt < now()` + `FOR UPDATE`).
- **P1-4 · Pas de fallback si Yousign down** — la copy `interventions.ts:244-246` parle de « devis transparent fourni avant signature » : si Yousign est down 24h, le devis n'est jamais envoyé. Manque : path manuel `setQuotePdfUrlAction(quoteId, pdfUrl, signedManually=true)` super_admin only + audit log explicite + flag `bypassReason` obligatoire.
- **P1-5 · Onboarding docs sans inventory contrôlé** — la liste de docs (organigramme, mapping process, outils, accès) est en copy `interventions.ts` mais pas en source de vérité TS. Recommandation : enum `OnboardingDocType` figé V1 (5-7 valeurs canoniques) + sortable côté admin.

### 3.3 🟡 P2 — finitions

- **P2-1 · Pas de re-scheduling cadrage par client** — la doctrine prompt §3 Agent 10 dit « Annulation/reschedule cadrage par client » mais aucun magic-link token côté `BookingOption` / `CadrageMeeting`. Hook trivial : `magicToken VarChar(64) @unique` sur `CadrageMeeting`.
- **P2-2 · Pas de visio provider fallback** — un seul provider Jitsi self-hosted = SPOF. V2+ : autoriser bascule manuelle Whereby si Jitsi down + champ `visioProvider VarChar(20)` déjà prévu (cf. §6.1).
- **P2-3 · Pas de tracking durée cadrage** — `duration` est dans le schéma cible mais aucune capture automatique (`heldAt` seulement). Wishlist V1 : champ `actualDurationMin Int?` rempli manuellement par Will au moment de `markCadrageHeldAction`.
- **P2-4 · Pas de pré-fill questions standard cadrage** — chaque call démarre de zéro côté Will. V2+ : checklist 5-7 questions standard rendue dans drawer admin `/cadrage/[id]` + capturée dans `notes JSONB`.

### 3.4 ⚪ P3 — best-effort

- **P3-1 · Pas d'enregistrement audio/vidéo cadrage** — eIDAS/RGPD : enregistrement requiert consentement explicite + base légale + DPA. V2+ exclusivement, hors V1.
- **P3-2 · Pas de transcription IA cadrage** — Whisper local ou Deepgram = surcoût + DPA supplémentaire. V2+ exclusivement.
- **P3-3 · Pas de scoring automatique « intervention pertinente »** — décision humaine 100 %. Ne pas automatiser V1 (risque qualité brand).

---

## 4. Recommandations Top 12 (impact × effort inverse)

> Format : `[priorité]` · Action · _Impact / Effort_ · Référence.

### 4.1 Provider visio

#### Rec 1 · `[P0]` Trancher visio provider V1 par STOP-AND-ASK Will avant Sprint X.4 / 5j _Impact MAX × Effort MIN_

> Le choix est binaire et conditionne 4-6h d'intégration. À trancher cette semaine.

**Comparatif** :

| Provider                   | Souveraineté                                           | Coût récurrent                     | Ops cost                                               | Calendar invite                  | SDK Next.js       | Verdict V1                                |
| -------------------------- | ------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------ | -------------------------------- | ----------------- | ----------------------------------------- |
| **Jitsi Meet self-hosted** | ✅ FR/UE (Hetzner CPX21 secondaire ou subdomain CPX32) | 0 € (ou ~5 €/mois si VPS dédié)    | ⚠️ self-hosting + maintenance JitsiHelm/Prosody/Coturn | Manuel `.ics`                    | Lib JS standalone | **Souveraineté absolue, ops non-trivial** |
| **Whereby (Embedded)**     | ✅ Norvège UE (DPA art. 28)                            | ~€10-15/mois Pro plan (≤100 rooms) | ✅ zéro ops, API simple                                | API `meeting.add_calendarinvite` | REST API standard | **Zero ops + zero install client**        |
| **Google Meet**            | ❌ Data US (DPF — fragile post-CJEU)                   | 0 € (Google Workspace existant ?)  | ✅ zéro ops                                            | Calendar API auto                | Workspace API     | **Bannir V1** (cohérence doctrine UE)     |
| **Zoom**                   | ❌ Data US (DPF) + télémétrie agressive                | Pro $14.99/mois                    | ✅ zéro ops                                            | OAuth Zoom Calendar              | Web SDK lourd     | **Bannir V1** (mismatch positionnement)   |

**Recommandation Agent 10** : **Whereby** V1 (zero ops + UE + DPA standard art. 28 RGPD), avec fallback Jitsi self-hosted V2+ si volume > 500 calls/mois rentabilise la maintenance. Justification : Will a refusé toute charge ops récurrente côté infra (cf. décision Hetzner CPX32 mémoire `axionia_hosting_hetzner.md` — « pas CX22 insuffisant + pas CF Pro redondant »). Whereby Embedded à 10-15 €/mois rentre dans le même cadre minimaliste qu'il a validé pour le reste.

**STOP-AND-ASK Will avant Sprint X.4** : Jitsi (souveraineté max + 0 €) OU Whereby (zero ops + 10-15 €/mois) — pas Google/Zoom (cohérence doctrine).

### 4.2 State machine + actions

#### Rec 2 · `[P0]` Implémenter `scheduleCadrageMeetingAction(optionId, slotPreferences)` / 1.5j _Impact MAX × Effort MOY_

- Inputs : `optionId Uuid`, `slotPreferences { proposedAt: DateTime[], visioProvider?: VarChar(20), notes?: Text }`.
- Effet : crée `CadrageMeeting` (`status='scheduled'`) + transition `BookingOption` ou `Booking` draft `→ cadrage_scheduled` + génère `visioUrl` via Whereby/Jitsi API + enqueue `cadrage-scheduled` email avec `.ics` + Telegram tag `CADRAGE`.
- Idempotence : verrou `SELECT ... FOR UPDATE` sur `BookingOption` (réutiliser pattern `option-expiration-worker.ts:44-95`).
- Rate-limit : N/A (action admin uniquement, RBAC suffit).

#### Rec 3 · `[P0]` Implémenter `markCadrageHeldAction(meetingId, validationDecision, notes)` / 1j _Impact HAUT × Effort MIN_

- Inputs : `meetingId Uuid`, `validationDecision ∈ {pertinent, not_pertinent, reschedule_needed}`, `notes Text?`, `actualDurationMin Int?`.
- Effet :
  - `pertinent` → transition `cadrage_held` puis branch automatique :
    - Si `pricePaidCents > 500_000` (5 000 € HT) → enqueue `triggerQuoteSignatureAction`.
    - Si `companySize ∈ {ETI, GRANDE_ENTREPRISE}` OU `companySector` matche secteur sensible → enqueue `triggerNdaSignatureAction`.
    - Sinon → direct `deposit_pending` (création Stripe Checkout Session — cf. Agent 4).
  - `not_pertinent` → transition `cancelled_by_admin` + libère slot + email `cadrage-declined`.
  - `reschedule_needed` → flip `CadrageMeeting.status='reschedule_pending'` + email reschedule.
- ActivityLog obligatoire (audit trail Will).

#### Rec 4 · `[P0]` Implémenter `triggerQuoteSignatureAction(bookingId)` / 2j _Impact MAX × Effort MOY_

- Inputs : `bookingId Uuid`, override optionnel `validityDays Int = 7`.
- Effet :
  - Render PDF devis (via `@react-pdf/renderer` à ajouter au `package.json` V1, ou via SSR HTML → puppeteer-core en service worker — éviter Chromium dans le bundle Next.js).
  - Upload PDF dans Hetzner Storage Box (cohérent §4.3 cible storage).
  - POST `https://api.yousign.app/v3/signature_requests` (création) + POST `/documents` (upload PDF) + POST `/signers` (signataire client) + POST `/activate` (envoi).
  - Persiste `SignatureRequest` (`provider='yousign'`, `providerId`, `type='quote'`, `status='sent'`, `sentAt`) + `Quote` (`number AXION-Q-2026-NNNN` séquentiel, `signatureRequestId`).
  - Email `quote-sent` au signataire (template Yousign embarqué OU template maison + lien magique).
  - Telegram tag `DEVIS ENVOYÉ`.
- Numérotation : lock advisory Postgres `pg_advisory_xact_lock(hashtext('quote_seq_2026'))` dans la tx (pattern à dupliquer pour `Invoice` cf. Agent 11).

#### Rec 5 · `[P1]` Implémenter `triggerNdaSignatureAction(bookingId)` / 1j _Impact HAUT × Effort MIN_

- Identique Rec 4 mais avec template NDA + table `Nda`.
- Variables paramétrables : `parties JSONB` (Axion-IA OÜ + Société cliente), `effectiveDate`, `durationYears (default 3)`, `juridiction (default '[paramétrable — cf. legal.ts]')`.
- Yousign workflow identique : `POST /signature_requests` + webhook `POST /api/yousign/webhook`.

#### Rec 6 · `[P0]` Implémenter route webhook `POST /api/yousign/webhook` / 1j _Impact MAX × Effort MIN_

- Vérification signature HMAC : header `X-Yousign-Signature-256` (HMAC-SHA256 du raw body avec secret webhook). Réf : Yousign v3 webhooks doc (`https://developers.yousign.com/docs/webhooks`).
- Idempotency via `providerId + eventType` (table `YousignWebhookEvent` ou réutiliser pattern `StripeWebhookEvent` côté Agent 4).
- Events à gérer V1 :
  - `signature_request.done` → transition `quote_signed` ou `nda_signed`.
  - `signature_request.declined` → transition `quote_declined` ou `nda_declined`.
  - `signature_request.expired` → transition `quote_expired` ou `nda_expired` + email reminder admin.
- Réponse `200 OK` même en cas de duplicate (idempotency). Réponse `400` uniquement sur HMAC invalide.

### 4.3 Onboarding docs

#### Rec 7 · `[P0]` Implémenter `requestOnboardingDocsAction(bookingId, docTypes[])` / 1.5j _Impact HAUT × Effort MOY_

- Trigger : transition `confirmed` (après acompte payé).
- Inputs : `bookingId Uuid`, `docTypes (OnboardingDocType[])`.
- Effet :
  - Crée N rows `OnboardingDoc` (`status='pending'`, `signedUrlExpiresAt = now() + 7d`).
  - Génère signed URL Hetzner Storage Box (presigned PUT) OU magic link Next.js route `/upload/[token]` qui fait un proxy vers Storage Box.
  - Email `onboarding-docs-requested` avec lien magique + liste docs.
- Notification admin Telegram `UPLOAD ONBOARDING` quand client upload (webhook Storage Box OU polling cron 5min).

#### Rec 8 · `[P1]` Recommander Hetzner Storage Box plutôt que Cloudflare R2 V1 / 0j (décision)

> R2 = data US (Cloudflare San Francisco). Storage Box = Frankfurt UE déjà déclaré dans `legal.ts:226-231` (« datacenter Frankfurt »). V1 ne crée pas de nouveau sous-processeur US. STOP-AND-ASK Will si forte raison contraire (latence ? bandwidth coût ?).

### 4.4 Détection automatique seuils

#### Rec 9 · `[P1]` Créer `src/lib/insee-size.ts` (mapping `companySize` → INSEE enum) / 0.5j _Impact MOY × Effort MIN_

```
// Description seulement, code écrit en sprint dédié.
mapEmployeesToInsee("1-9")     → "TPE"
mapEmployeesToInsee("10-49")   → "PME"
mapEmployeesToInsee("50-249")  → "PME"   // INSEE PME = < 250 salariés
mapEmployeesToInsee("250-999") → "ETI"
mapEmployeesToInsee("1000+")   → "GRANDE_ENTREPRISE"
```

> Réf INSEE : décret n° 2008-1354 (PME < 250 + CA < 50 M€ ou bilan < 43 M€ ; ETI = 250-4999 ; GE ≥ 5000). V1 simplification volontaire sur effectif seul (CA inconnu côté form), ETI auto à partir de 250 salariés.

#### Rec 10 · `[P1]` Curer liste secteurs sensibles + créer `src/lib/sensitive-sectors.ts` / 0.5j _Impact MOY × Effort MIN_

- Liste fermée V1 : `["finance", "banque", "assurance", "fintech", "santé", "médical", "biotech", "pharmaceutique", "défense", "aérospatial", "nucléaire", "énergie critique"]`.
- Matching : substring + accent-insensitive + lowercase (PG `unaccent` extension OU JS `.toLowerCase().normalize("NFD")`).
- Stratégie : si match → NDA auto. Sinon NDA = bouton admin manuel (super_admin/admin) avec drawer drawer `markCadrageHeldAction(..., forceNda=true)`.

### 4.5 Worker expiration

#### Rec 11 · `[P1]` Ajouter worker `quote-nda-expiration-worker` / 0.5j _Impact MOY × Effort MIN_

- Queue `quote-nda-expiration` (`*/5 * * * *` repeatable, pattern `option-expiration-worker.ts:19`).
- Effet : flip `Quote.status='expired'` et `Nda.status='expired'` si `validUntil < now()` + email reminder admin (tag `EXPIRATION DEVIS/NDA`).
- Idempotence : sentinel `status='sent' AND validUntil < now()` dans `SELECT ... FOR UPDATE`.
- Concurrency 1 (cohérent avec autres workers expiration).

### 4.6 Templates email manquants

#### Rec 12 · `[P0]` Créer 5 templates email + email worker dispatch / 1j _Impact HAUT × Effort MIN_

> Cf. `_AUDIT/.../00-REALITY-CHECK.md` §6 : 5 absents. Ajout au dispatcher `src/lib/email/templates/index.tsx`.

| Template                        | Trigger                           | Sujet FR (proposé)                             | Sujet EN (proposé)                            |
| ------------------------------- | --------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `cadrage-scheduled.tsx`         | `scheduleCadrageMeetingAction`    | « Call de cadrage confirmé — {date} à {hour} » | « Framing call confirmed — {date} at {hour} » |
| `cadrage-reschedule.tsx`        | `rescheduleCadrageAction` (admin) | « Nouveau créneau cadrage »                    | « New framing call slot »                     |
| `quote-sent.tsx`                | `triggerQuoteSignatureAction`     | « Votre devis — signature électronique »       | « Your quote — electronic signature »         |
| `nda-sent.tsx`                  | `triggerNdaSignatureAction`       | « NDA à signer avant intervention »            | « NDA to sign before engagement »             |
| `onboarding-docs-requested.tsx` | `requestOnboardingDocsAction`     | « Documents à transmettre avant la journée »   | « Documents to share before the session »     |

> Tous via `_layout.tsx` partagé. RFC 8058 List-Unsubscribe automatique (déjà géré par `email-worker.ts:21-37`). PII redaction si Telegram parallel (déjà ADR 0010).

---

## 5. Sources citées

### 5.1 Code & schémas (HEAD `ff3ccbc9`)

- `src/content/interventions.ts:220` — tunnel doctrine 5 étapes (« je réserve → cadrage → acompte 50 % → journée → solde »).
- `src/content/interventions.ts:230-232` — description Call de cadrage : « valider le format choisi, l'effectif et les modalités pratiques ».
- `src/content/interventions.ts:236` — « Acompte 50 % … Facture immédiate ».
- `src/content/interventions.ts:244-246` — « devis transparent fourni avant signature ».
- `src/content/audit-detail-configs.ts:204-217` — `audit-flash-onsite` `ctaType: "calendar"` (skip cadrage cohérent D9).
- `src/content/pricing.ts:163-172` — tiers PME 4 900 / 9 900 € HT (premier seuil > 5 000 € qui déclencherait Quote).
- `src/components/calendar/BookingCalendar.tsx:231-239` — 5 buckets effectifs `1-9 / 10-49 / 50-249 / 250-999 / 1000+`.
- `src/features/booking/actions.ts:191-235` — verrou pessimiste `SELECT ... FOR UPDATE` sur `BookingOption` (pattern à dupliquer).
- `src/server/queue/queues.ts:32` + `workers/option-expiration-worker.ts:19` — pattern worker expiration réutilisable.
- `src/lib/pii-redaction.ts` (ADR 0010) — `redactContactLine`/`redactEmail`/`redactName` réutilisables pour Telegram pre-booking.
- `prisma/schema.prisma:157-195` — `Submission` (employeesCount + sector dispo).
- `prisma/schema.prisma:201-228` — `Booking` (manque colonnes pre-booking — cf. Agent 3).
- `prisma/migrations/20260512100000_audit_flash_onsite_enum/` — alignement enum récent.

### 5.2 Reality check + état audit

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md` §1 (DB), §2 (actions), §6 (emails), §7.5/7.6 (Yousign + visio absents), §9 GAP #2 #7 #16 #18.
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-03-state-machine.md` (transitions cible 16 états).
- `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` §3 Agent 10 (défauts D9-D13), §5.1 (schéma cible), §5.2 (actions cible).

### 5.3 Doc tierce (Yousign API v3)

- API base : `https://api.yousign.app/v3/`.
- `POST /signature_requests` (création), `POST /documents` (upload PDF), `POST /signers` (ajout signataire), `POST /activate` (envoi).
- Webhook : header `X-Yousign-Signature-256` HMAC-SHA256.
- Events V1 : `signature_request.done` · `signature_request.declined` · `signature_request.expired`.
- Doc canonique : `https://developers.yousign.com/docs` (API v3 + webhooks). _Non-fetched live — référence statique pour audit papier._
- eIDAS : Yousign SES (Simple) suffit V1 pour devis < 10 k€ et NDA standard. AES (Advanced) recommandé si V2+ devis > 50 k€.

### 5.4 Référentiels juridiques

- INSEE — décret n° 2008-1354 (catégories d'entreprise : TPE/PME/ETI/GE).
- eIDAS — Règlement UE n° 910/2014 (signature électronique simple/avancée/qualifiée).
- RGPD art. 28 — DPA obligatoire avec sous-processeur Yousign (à ajouter dans `legal.ts:230` cf. Agent 11).

---

## 6. Architecture cible V1 — synthèse papier

### 6.1 Tables (alignées prompt source §5.1 — affinements en gras)

| Table              | Colonnes clés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Affinement Agent 10                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `Quote`            | `id Uuid`, `number VarChar(40) @unique` (`AXION-Q-YYYY-NNNN`), `bookingId Uuid @unique`, `amountHtCents Int`, **`vatRate Decimal(5,2)`**, **`vatReverseCharge Boolean @default(false)`**, **`vatMention VarChar(200)`** (paramétrable cf. Agent 11), `validUntil DateTime`, `pdfUrl Text`, `pdfSha256 VarChar(64)`, `signatureRequestId Uuid`, `status QuoteStatus`, `createdBy Uuid`, `createdAt`, `signedAt?`, `expiredAt?`, `declinedAt?`                                                                 | Hash SHA256 du PDF immuable pour traçabilité (RGPD art. 5 minimisation/intégrité).                                                                                                                                                                                       |
| `Nda`              | `id Uuid`, `bookingId Uuid`, `signatureRequestId Uuid`, `signedAt? DateTime`, `expiresAt DateTime`, `pdfUrl Text`, `pdfSha256 VarChar(64)`, `parties JSONB`, **`durationYears Int @default(3)`**, **`juridiction VarChar(80) @default('[paramétrable]')`**                                                                                                                                                                                                                                                   | Multi-NDA possible (1 booking → N NDAs si renouvellement) — pas `@unique` sur bookingId.                                                                                                                                                                                 |
| `SignatureRequest` | `id Uuid`, `provider SignatureProvider`, `providerId VarChar(120) @unique`, `type SignatureRequestType (quote                                                                                                                                                                                                                                                                                                                                                                                                | nda)`, `status SignatureRequestStatus`, `sentAt DateTime`, `signedAt? DateTime`, `declinedAt? DateTime`, `expiredAt? DateTime`, **`signerEmail @db.Citext`**, `signerName VarChar(120)`, `signerIp? VarChar(45)`, **`hmacSecretHash VarChar(64)`\*\* (rotation possible) | Index unique `(provider, providerId)`. |
| `CadrageMeeting`   | `id Uuid`, `bookingOptionId Uuid?` (avant acompte) **OU** `bookingId Uuid?` (après), **CHECK XOR contrainte**, `scheduledAt DateTime`, **`actualDurationMin Int?`**, `visioUrl Text`, `visioProvider VarChar(20) @default('whereby')` (ou `'jitsi'`), `status CadrageStatus`, `heldAt? DateTime`, **`validationDecision CadrageDecision?`** (pertinent/not_pertinent/reschedule_needed), `notes Text?`, **`magicToken VarChar(64) @unique`** (reschedule client), `createdBy Uuid`, `createdAt`, `updatedAt` | Skip auto si `Booking.interventionType = 'audit_flash_onsite'` (D9).                                                                                                                                                                                                     |
| `OnboardingDoc`    | `id Uuid`, `bookingId Uuid`, **`type OnboardingDocType`** (enum 5-7 valeurs), `filename VarChar(255)?`, `storageUrl Text?` (presigned), **`storageProvider VarChar(20) @default('hetzner_storage_box')`**, `uploadedAt? DateTime`, `signedUrlExpiresAt DateTime`, `status OnboardingDocStatus (pending                                                                                                                                                                                                       | uploaded                                                                                                                                                                                                                                                                 | approved                               | rejected)`, `notes Text?` | RGPD : signed URL 7j max + auto-delete après 90j (retention worker existant). |

### 6.2 Enums nouveaux V1

```
QuoteStatus            = draft · sent · signed · declined · expired · cancelled
NdaStatus              = sent · signed · declined · expired · cancelled
SignatureProvider      = yousign           (extensible docusign V2+)
SignatureRequestType   = quote · nda
SignatureRequestStatus = sent · signed · declined · expired · failed
CadrageStatus          = scheduled · held · cancelled · reschedule_pending · no_show
CadrageDecision        = pertinent · not_pertinent · reschedule_needed
OnboardingDocType      = org_chart · process_mapping · tools_inventory · readonly_access · use_cases · other
OnboardingDocStatus    = pending · uploaded · approved · rejected
CompanySizeInsee       = TPE · PME · ETI · GRANDE_ENTREPRISE       (V2+ pour `Submission.employeesCountInsee` colonne dérivée)
```

### 6.3 Server Actions (5 cibles, cf. §1.1)

| Action                         | Inputs                                                            | Rôle requis         | Telegram                           | Email                         |
| ------------------------------ | ----------------------------------------------------------------- | ------------------- | ---------------------------------- | ----------------------------- |
| `scheduleCadrageMeetingAction` | `optionId`, `slotPreferences`                                     | super_admin · admin | `CADRAGE PROGRAMMÉ`                | `cadrage-scheduled`           |
| `markCadrageHeldAction`        | `meetingId`, `validationDecision`, `notes?`, `actualDurationMin?` | super_admin · admin | `CADRAGE TENU` ou `CADRAGE REFUSÉ` | `cadrage-declined` (si refus) |
| `triggerQuoteSignatureAction`  | `bookingId`, `validityDays = 7`                                   | super_admin · admin | `DEVIS ENVOYÉ`                     | `quote-sent`                  |
| `triggerNdaSignatureAction`    | `bookingId`, `durationYears = 3`                                  | super_admin · admin | `NDA ENVOYÉ`                       | `nda-sent`                    |
| `requestOnboardingDocsAction`  | `bookingId`, `docTypes[]`                                         | super_admin · admin | `ONBOARDING DEMANDÉ`               | `onboarding-docs-requested`   |

### 6.4 Route webhook

| Route                  | Méthode | Auth                                         | Idempotency                                    | Logging                                            |
| ---------------------- | ------- | -------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| `/api/yousign/webhook` | POST    | HMAC-SHA256 header `X-Yousign-Signature-256` | `(provider, providerId, eventType)` unique key | ActivityLog `signature.received` + Telegram silent |

### 6.5 Queue + workers

| Queue                  | Cron                 | Worker                                           | Effet                                                                             |
| ---------------------- | -------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `quote-nda-expiration` | `*/5 * * * *`        | `quote-nda-expiration-worker.ts` (concurrency 1) | flip `Quote/Nda.status='expired'` si `validUntil/expiresAt < now()` + email admin |
| `onboarding-reminder`  | `0 9 * * *` (9h UTC) | `onboarding-reminder-worker.ts` (concurrency 1)  | relance client J+2, J+5 si `OnboardingDoc.status='pending'`                       |

### 6.6 Routes admin

| Route                            | Fichier                                          | Rôle                                                               |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `/[adminPrefix]/cadrage`         | `(admin)/[adminPrefix]/cadrage/page.tsx`         | List CadrageMeeting + filtres                                      |
| `/[adminPrefix]/cadrage/[id]`    | `(admin)/[adminPrefix]/cadrage/[id]/page.tsx`    | Détail + `markCadrageHeldAction`                                   |
| `/[adminPrefix]/devis`           | `(admin)/[adminPrefix]/devis/page.tsx`           | List Quote + filtres status                                        |
| `/[adminPrefix]/devis/[id]`      | `(admin)/[adminPrefix]/devis/[id]/page.tsx`      | Détail + `triggerQuoteSignatureAction` + bypass manuel super_admin |
| `/[adminPrefix]/nda`             | `(admin)/[adminPrefix]/nda/page.tsx`             | List Nda + filtres                                                 |
| `/[adminPrefix]/nda/[id]`        | `(admin)/[adminPrefix]/nda/[id]/page.tsx`        | Détail + `triggerNdaSignatureAction`                               |
| `/[adminPrefix]/onboarding-docs` | `(admin)/[adminPrefix]/onboarding-docs/page.tsx` | Liste uploads + signed URLs + approbation                          |

### 6.7 Sous-processeurs à ajouter (à coordonner avec Agent 11)

- **Yousign SAS** — Paris, France · UE · eIDAS-conforme · DPA art. 28 obligatoire avant V1 prod. (À ajouter dans `legal.ts:230` FR + `:275` EN.)
- **Whereby AS** (si retenu) — Tromsø, Norvège · UE · DPA art. 28 disponible. (À ajouter `legal.ts:230`.)
- _Hetzner Storage Box_ — déjà déclaré (`legal.ts:226`). Aucun ajout.

### 6.8 Variables d'environnement à ajouter (déclarées dans `src/env.ts` Zod schema en sprint dédié)

```
YOUSIGN_API_KEY                       # secret
YOUSIGN_API_BASE_URL = https://api.yousign.app/v3
YOUSIGN_WEBHOOK_SECRET                # HMAC-SHA256 secret
WHEREBY_API_KEY                       # OU JITSI_DOMAIN (selon Rec 1)
WHEREBY_API_BASE_URL = https://api.whereby.dev/v1
HETZNER_STORAGE_BOX_HOST              # username@u123456.your-storagebox.de
HETZNER_STORAGE_BOX_USER
HETZNER_STORAGE_BOX_PASSWORD          # secret
ONBOARDING_DOC_SIGNED_URL_TTL_HOURS = 168    # 7j
QUOTE_VALIDITY_DAYS = 7
NDA_VALIDITY_DAYS = 7
NDA_DEFAULT_DURATION_YEARS = 3
QUOTE_THRESHOLD_HT_CENTS = 500000     # 5 000 € HT
```

---

## 7. Score /100

> Couverture V0 actuelle vs cible V1 (couverture, conformité, automatisation, UX, robustesse).

| Critère                                                                           | Pondération |   V0 | V1 cible (post-recs) | Notes                                                                                              |
| --------------------------------------------------------------------------------- | ----------: | ---: | -------------------: | -------------------------------------------------------------------------------------------------- |
| **Couverture cadrage** (table + visio + .ics + reschedule)                        |          25 | 0/25 |                22/25 | -3 V1 : pas de fallback provider visio + pas de checklist questions standard                       |
| **Couverture devis** (Quote + PDF + numérotation + TVA-agnostique)                |          20 | 0/20 |                18/20 | -2 V1 : pas de devis multi-devises (EUR only) + pas de versioning                                  |
| **Couverture NDA** (table + détection auto INSEE + secteurs)                      |          15 | 0/15 |                13/15 | -2 V1 : détection sectorielle regex partielle (faux négatifs) + pas de multi-langue NDA hors FR/EN |
| **Signature électronique** (Yousign API + webhook + eIDAS SES)                    |          15 | 0/15 |                14/15 | -1 V1 : SES suffit mais AES manquant pour V2+ devis > 50k€                                         |
| **Onboarding docs** (signed URL + UE storage + notif admin)                       |          10 | 0/10 |                 8/10 | -2 V1 : pas d'approbation workflow + pas de checklist auto-required                                |
| **Conformité RGPD** (DPA Yousign/Whereby + retention + sous-processeurs déclarés) |          10 | 2/10 |                 9/10 | +2 V0 : Hetzner DPA déjà signé. V1 : Yousign + Whereby DPA papier hors code.                       |
| **Robustesse** (idempotence + verrou + DLQ + bypass manuel)                       |           5 |  0/5 |                  5/5 | Patterns réutilisés (`option-expiration-worker.ts`)                                                |

### Score consolidé

- **V0 actuel** : **2/100** (seul Hetzner DPA signé + Submission riche, rien d'autre).
- **V1 cible post-recs Top 12** : **89/100** (perfection extrême sur l'essentiel, gaps assumés sur V2+).

> Le delta `2 → 89` reflète l'effort Sprint X.4 + X.5 (cf. prompt source §6 « ~3j Pre-booking cadrage » + « ~3-4j Devis & NDA Yousign » = **~6-7j dev V1 total pour cet agent**), hors dépendances (Stripe acompte = Agent 4, CGV/sous-processeurs = Agent 11).

---

## 8. Marquage V1 vs V2+

### V1 (perfection extrême)

✅ Tables `Quote`, `Nda`, `SignatureRequest`, `CadrageMeeting`, `OnboardingDoc`.
✅ 5 Server Actions (`scheduleCadrageMeetingAction`, `markCadrageHeldAction`, `triggerQuoteSignatureAction`, `triggerNdaSignatureAction`, `requestOnboardingDocsAction`).
✅ Webhook Yousign `/api/yousign/webhook` (HMAC + idempotency).
✅ 5 templates email (`cadrage-scheduled`, `cadrage-reschedule`, `quote-sent`, `nda-sent`, `onboarding-docs-requested`).
✅ Provider visio unique (Whereby **OU** Jitsi self-hosted — STOP-AND-ASK Will).
✅ Storage Hetzner Storage Box (UE).
✅ Détection auto NDA INSEE (`>=ETI`) + secteurs sensibles (liste curée fermée).
✅ Worker `quote-nda-expiration` + `onboarding-reminder`.
✅ eIDAS SES (suffit V1).
✅ TVA-agnostique (FR ou EE — décision Will hors audit).
✅ Hook nullable `Booking.trainingSessionId` anticipé V2+ Qualiopi.

### V2+ (reporté, hors V1)

⏭️ **Convention de formation Qualiopi/OPCO** — table `TrainingSession` + `Attendance` + `Evaluation` + `Certificate` (cf. prompt source §0.0bis).
⏭️ **AES (Advanced Electronic Signature)** Yousign — pour devis > 50 k€.
⏭️ **Multi-provider visio failover** (Jitsi primary + Whereby fallback OU inverse).
⏭️ **Multi-NDA reconduction automatique** post-expiration.
⏭️ **Enregistrement audio/vidéo cadrage** (consentement RGPD + base légale obligatoire).
⏭️ **Transcription IA cadrage** (Whisper local ou Deepgram + DPA supplémentaire).
⏭️ **Pre-fill cadrage depuis CRM** (Notion / Airtable / HubSpot).
⏭️ **Checklist questions standard cadrage** + capture structurée notes JSONB.
⏭️ **Multi-langue NDA** au-delà de FR/EN (DE, IT, ES selon expansion).
⏭️ **Devis multi-currency** (EUR + CHF + GBP).
⏭️ **Signature en présentiel iPad** (Yousign tablette).
⏭️ **Détection sectorielle ML** (au lieu de liste curée fermée).

---

## 9. STOP-AND-ASK Will (3 décisions à trancher avant Sprint X.4)

1. **Provider visio V1** : Whereby (~10-15 €/mois, zero ops, UE) **OU** Jitsi self-hosted (0 €, souveraineté max, +ops maintenance) — pas Google/Zoom. Recommandation Agent 10 : **Whereby** (cohérence décision Hetzner CPX32 sans plus de charge ops).
2. **Secteurs sensibles NDA auto** : valider la liste fermée V1 (`finance`, `banque`, `assurance`, `fintech`, `santé`, `médical`, `biotech`, `pharmaceutique`, `défense`, `aérospatial`, `nucléaire`, `énergie critique`) — ajouts/retraits ?
3. **Seuil `QUOTE_THRESHOLD_HT_CENTS`** : 5 000 € HT V1 confirmé ? (Le tier `audit-strategique-pme-20-50` à 4 900 € HT — `pricing.ts:163` — passe **juste en-dessous** du seuil par 100 €. Volonté ? Si oui maintenir. Sinon descendre à 4 500 € HT pour englober tous les Stratégique PME.)

---

**Fin Agent 10.** Document généré 2026-05-12 · 🚫 AUDIT-ONLY · aucun code modifié, aucun appel POST émis, aucun fichier non-`.md` créé.
