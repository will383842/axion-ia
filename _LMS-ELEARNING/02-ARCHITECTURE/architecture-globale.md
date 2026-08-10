# Architecture technique globale — Plateforme LMS e-learning Axion-IA

> Document d'architecture **de référence** pour l'équipe dev senior. Il décrit les composants, la greffe sur l'existant, les flux principaux et la justification vs best practices LMS 2026.
>
> Source de vérité pour les **noms de modèles/enums** : `03-DATA-MODEL/*`. Source de vérité pour les **arbitrages** : `00-INDEX/DECISIONS-ARBITRAGES.md` (ADR-0001 → 0008).
>
> Convention de lecture : **[EXISTANT]** = brique réutilisée telle quelle / étendue · **[NEUF]** = à construire sous les chemins cloisonnés (ADR-0007).
>
> Dernière mise à jour : 2026-06-27.

---

## 0. Principes directeurs (non négociables)

1. **Cloisonnement strict** (ADR-0007). Tout le code LMS vit sous des chemins dédiés ; on **réutilise** les briques existantes sans jamais les dupliquer.
2. **Migrations additives** (ADR-0008). CREATE TABLE / ADD COLUMN nullable uniquement. `Trainee.passwordHash` ajouté **nullable**.
3. **Deux mondes d'auth séparés** (ADR-0001). NextAuth v5 = `AdminUser` (admin). Auth apprenant = système **indépendant** (cookie + middleware dédiés), pour zéro régression admin.
4. **Contrat de build `stub.invalid`** (ADR plateforme 0026). Toute page e-learning est **derrière auth + `force-dynamic`** → jamais rendue au SSG build → **aucun risque stub**. Les workers respectent `BULLMQ_DISABLED`. Les services LMS sont **stub-aware** (lecture → fallback sûr, mutation → throw) comme `portail-service.ts`.
5. **Budgets Web Vitals** stricts sur les pages **publiques** (catalogue, vitrine cours). L'**espace apprenant authentifié** (player, quiz) n'est pas dans les 15 pages stratégiques mais vise les mêmes cibles internes ; le **risque INP** est sur le player vidéo et le moteur de quiz (cf. §10).
6. **FR canonique** (EN désactivé). `langue` prévu sur `ElearningCourse` pour extension future sans surcoût.
7. **Tout « certification-ready », activable par flag** (ADR-0003) : `EDOF_ENABLED=false`, `STRIPE_ENABLED=false`, multi-tenant V2.

---

## 1. Vue d'ensemble des composants

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ NAVIGATEUR                                                                      │
│  ┌───────────────────────────┐      ┌──────────────────────────────────────┐  │
│  │ APPRENANT (public + auth) │      │ ADMIN (NextAuth + 2FA + RBAC)        │  │
│  │  /catalogue, /cours/[slug]│      │  /[adminPrefix]/elearning/**         │  │
│  │  /apprendre/** (player)   │      │  outil auteur, octroi, reporting     │  │
│  └────────────┬──────────────┘      └───────────────────┬──────────────────┘  │
└───────────────┼────────────────────────────────────────┼─────────────────────┘
                │ Server Actions ('use server')           │ Server Actions
                │ + Route Handlers (heartbeat, webhooks)  │
┌───────────────▼─────────────────────────────────────────▼─────────────────────┐
│ NEXT.JS 16.2 (App Router) — process WEB                                         │
│                                                                                 │
│  src/server/elearning/**  (couche domaine — services purs, stub-aware)         │
│   ├─ courses/        (lecture catalogue, arbre cours, publication)             │
│   ├─ access/         (auth apprenant, octroi, import CSV, sessions cookie)     │
│   ├─ progression/    (LessonProgress, completion, reprise, gating/unlock)      │
│   ├─ quiz/           (moteur : assemblage tentative, correction, scoring)      │
│   ├─ video/          (Cloudflare Stream : create asset, signed URL, webhook)   │
│   ├─ certificates/   (génère certificat réalisation via DocumentGenere)        │
│   ├─ ai/             (quiz-gen, tuteur RAG — réutilise knowledge/RAG)          │
│   └─ compliance/     (faisceau de preuves FOAD, exports)                       │
│                                                                                 │
│  Réutilise : src/lib/prisma.ts · r2-storage.ts · pii-crypto.ts ·              │
│              pricing.ts · seo.ts · email (Nodemailer) · stripe.ts (gated)      │
└───────────────┬───────────────────────────────────────┬────────────────────────┘
                │ Prisma 5.22                            │ enqueue (BullMQ)
┌───────────────▼──────────┐                ┌────────────▼──────────────────────┐
│ POSTGRES                 │                │ REDIS (BullMQ)                     │
│  elearning_* (NEUF)      │                │  files elearning-* (NEUF)         │
│  trainees / enrollments  │                └────────────┬──────────────────────┘
│  clients / documents…    │                             │
└──────────────────────────┘                ┌────────────▼──────────────────────┐
                                            │ PROCESS WORKER (`pnpm worker`)     │
   ┌──────────────────────┐                 │  src/server/queue/workers/         │
   │ CLOUDFLARE R2        │◄────────────────┤   elearning-video-worker.ts        │
   │  pdf, sous-titres,   │   uploadToR2    │   elearning-quiz-gen-worker.ts     │
   │  pièces jointes,     │                 │   elearning-certificate-worker.ts  │
   │  devoirs apprenant   │                 │   elearning-engagement-worker.ts   │
   └──────────────────────┘                 │   elearning-crons-worker.ts        │
   ┌──────────────────────┐                 │   email-worker (EXISTANT, étendu)  │
   │ CLOUDFLARE STREAM    │◄───── webhook ──┤                                    │
   │  HLS, signed URL,     │  (route handler)└────────────────────────────────────┘
   │  watermark, captions │
   └──────────────────────┘
```

**Trois plans d'exécution**, comme l'existant :

- **Process WEB** (Next.js) : rend les pages, exécute les Server Actions, sert les Route Handlers (heartbeat, webhooks vidéo, lecture signée).
- **Process WORKER** (`pnpm worker`, service Coolify dédié) : exécute les jobs BullMQ (transcodage suivi, génération IA, certificats, relances). Démarré par `src/server/queue/worker.ts` qui appelle chaque `startXxxWorker()` + `bootRepeatableJobs()`.
- **Externes** : Postgres, Redis, R2 (S3), Cloudflare Stream.

---

## 2. Couche de données (Postgres / Prisma)

### 2.1 Modèles NEUFS (cœur LMS)

Définis dans `03-DATA-MODEL/*`. Rappel synthétique :

| Domaine      | Modèles                                                                                                                  | Doc                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Cœur cours   | `ElearningCourse`, `ElearningModule`, `ElearningLesson`, `ElearningResource`                                             | `03-DATA-MODEL/01-*` |
| Progression  | `ElearningEnrollment`, `LessonProgress`, (`ElearningActivityEvent` — grammaire xAPI verbe/objet)                         | `03-DATA-MODEL/02-*` |
| Quiz         | `Quiz`, `Question`, `QuestionOption`, `QuizAttempt`, `QuizAnswer`, (banque + tirage)                                     | `03-DATA-MODEL/03-*` |
| Accès / auth | `ElearningLearnerAuth` (passwordHash optionnel), `ElearningAccessGrant`, `ElearningSessionToken`, `ElearningImportBatch` | `03-DATA-MODEL/04-*` |
| E-commerce   | `ElearningOrder`, `ElearningOrderItem` (Stripe gated)                                                                    | `03-DATA-MODEL/05-*` |

Enums figés (ADR / doc 01) : `ElearningCourseStatut {brouillon, publie, archive}`, `ElearningLessonType {video, texte, pdf, quiz, embed, devoir}`, `ElearningUnlockType {immediat, apres_precedent, date_fixe, offset_inscription, score_quiz}`.

### 2.2 Greffe sur les modèles EXISTANTS (relations inverses additives)

- **`Trainee`** [EXISTANT, `schema.prisma:5274`] — pivot identité apprenant.
  - Ajout **nullable** : `passwordHash String? @map("password_hash")` (argon2id, ADR-0001) — ou porté par `ElearningLearnerAuth` (préféré, cf. §6).
  - Relations inverses ajoutées (sans colonne) : `elearningEnrollments ElearningEnrollment[]`, `lessonProgress LessonProgress[]`, `quizAttempts QuizAttempt[]`, `elearningGrants ElearningAccessGrant[]`.
  - **Réutilise** : PII chiffrée (`handicap_details_chiffre` via `pii-crypto.ts`), consentements (`consentementFormation/Email`), `deletedAt` (soft-delete RGPD).
- **`Enrollment`** [EXISTANT, `5310`] — lien participant↔session présentiel/live. Source de l'**octroi automatique** : une session `realisee` peut déclencher l'ouverture d'un cours e-learning de renforcement (cf. §8.1). FK optionnelle `ElearningAccessGrant.enrollmentId` pour tracer l'origine.
- **`Client`** [EXISTANT, `~4890`] — CRM entreprise (SIRET/OPCO). `ElearningCourse.ownerClientId` (cours réservé) + `ElearningAccessGrant.clientId` (octroi pour le compte d'une entreprise). **Pas** de cloisonnement strict en MVP (ADR-0002) ; les requêtes apprenant filtrent par `traineeId`, pas par tenant.
- **`Formation`** [EXISTANT] — `ElearningCourse.formationId` (cours adossé à une formation Qualiopi OU autonome). Relation inverse `Formation.elearningCourses`.
- **`DocumentGenere`** [EXISTANT, `5507`] — **réutilisé tel quel** pour le **certificat de réalisation** e-learning : `type` (DocumentType à étendre additivement, ex. `certificat_realisation_foad`), `numero` unique, `pdfUrl` (R2 signée), `hashSha256`, **`qrToken`** (vérif publique timing-safe déjà implémentée), `suppressionPrevueAt` (rétention). Aucun nouveau modèle certificat.
- **`SiteSetting`** [EXISTANT] — flags & seuils LMS centralisés (ex. `elearning.tutorat_delai_reponse_h`, `elearning.relance_inactivite_jours`), à l'image des flags Qualiopi.

> **Anti-duplication** : on ne recrée **ni** un modèle « utilisateur apprenant » (c'est `Trainee`), **ni** un modèle « certificat » (c'est `DocumentGenere`), **ni** un helper stockage (c'est `r2-storage.ts`). Carte complète dans `02-ARCHITECTURE/reutilisation-existant.md`.

### 2.3 Tracking modélisé xAPI (ADR-0006)

`ElearningActivityEvent` enregistre `{ actorTraineeId, verb, objectType, objectId, resultJson, contextJson, occurredAt }` — grammaire **verbe/objet** xAPI (`launched`, `played`, `paused`, `completed`, `passed`, `failed`, `answered`). Permet plus tard un émetteur xAPI/LRS **sans refonte**, et alimente dès le MVP le **faisceau de preuves FOAD** (§9) et le reporting (§7.3).

---

## 3. Couche domaine (`src/server/elearning/**`) [NEUF]

Services **purs** (pas de `'use server'`), appelés par les Server Actions et les workers. Tous **stub-aware** (early-exit sur `DATABASE_URL.includes("stub.invalid")` pour les fonctions appelables au build, comme `portail-service.ts`).

| Sous-module     | Fichiers clés                                                                            | Responsabilité                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `courses/`      | `course-service.ts`, `course-tree.ts`, `publish-service.ts`                              | Lecture catalogue, assemblage arbre cours→modules→leçons, transition `brouillon→publie` (incrémente `version`, set `publishedAt`), `purgeCdn` |
| `access/`       | `learner-auth-service.ts`, `learner-session.ts`, `grant-service.ts`, `import-service.ts` | Magic-link (réutilise primitives `portail-service.ts`), mot de passe argon2id, octroi/révocation, import CSV                                  |
| `progression/`  | `progress-service.ts`, `unlock-engine.ts`, `completion-service.ts`                       | Persistance reprise/watch, calcul **déverrouillage** (5 `ElearningUnlockType`), calcul complétion cours + seuil certificat                    |
| `quiz/`         | `quiz-assembler.ts`, `quiz-grader.ts`, `quiz-attempt-service.ts`                         | Tirage N parmi M, shuffle questions/réponses, correction auto (11 types) + file d'attente correction manuelle (essai/upload), scoring pondéré |
| `video/`        | `stream-client.ts`, `signed-playback.ts`                                                 | Cloudflare Stream : créer asset, URL HLS signée + watermark, ingestion captions                                                               |
| `certificates/` | `certificate-service.ts`                                                                 | Génère certificat réalisation (heures réalisées en centièmes) → `DocumentGenere` + QR                                                         |
| `ai/`           | `quiz-generator.ts`, `tutor-rag.ts`                                                      | Génération de quiz document-grounded + tuteur RAG ancré (réutilise knowledge/RAG)                                                             |
| `compliance/`   | `foad-evidence.ts`, `evidence-export.ts`                                                 | Agrège le faisceau de preuves, exporte (ZIP/PDF) pour OPCO/audit                                                                              |
| `constants.ts`  | —                                                                                        | Noms de queues, seuils défaut, clés R2 (`elearning/...`)                                                                                      |

**Cœur métier transverse : le moteur de déverrouillage (`unlock-engine.ts`).** Fonction pure `computeUnlockState(course, modules, lessons, enrollment, progress, attempts, now)` → pour chaque module/leçon : `{ unlocked: boolean, reason: UnlockReason }`. Best practice 2026 : **le verrou est affiché AVEC sa raison** (« Disponible le 12/07 », « Réussissez le quiz du module 2 (≥ 70 %) »). `score_quiz` lit une **vraie note** (`QuizAttempt.scorePct`), jamais un simple « attempt fait » (anti gating attempt-only). **Override admin** : `ElearningAccessGrant.unlockOverride` (Json) force l'ouverture d'éléments précis.

---

## 4. Server Actions & Route Handlers [NEUF]

### 4.1 Server Actions (mode par défaut, pas de REST)

**Côté admin** — `src/app/[locale]/(admin)/[adminPrefix]/elearning/**/actions.ts`, gardées par `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`, rôles `super_admin/admin/editor/reader`) :

- `createCourseAction`, `updateCourseTreeAction` (drag&drop → réécrit `ordre` en transaction), `publishCourseAction` (Publish), `archiveCourseAction` (Delete).
- `uploadMediaAction` (retourne une URL signée R2 via `getSignedUploadUrlR2` pour upload direct navigateur — gros fichiers sans transit serveur), `createVideoAssetAction` (Cloudflare Stream).
- `grantAccessAction`, `revokeAccessAction`, `importLearnersCsvAction` (enqueue `elearning-import`), `generateQuizFromContentAction` (enqueue IA).

**Côté apprenant** — `src/app/[locale]/apprendre/**/actions.ts`, gardées par `requireLearnerSession()` [NEUF, §6] :

- `markLessonViewedAction`, `submitQuizAttemptAction` (validation Zod côté serveur, **temps serveur** anti-triche), `submitDevoirAction` (upload via URL signée), `requestCertificateAction`.

### 4.2 Route Handlers (`route.ts`) — quand un Server Action ne suffit pas

- `POST /api/elearning/progress/heartbeat` — **heartbeat player** (position vidéo toutes ~15 s). Route Handler (et non Server Action) pour latence minimale + `keepalive`/`sendBeacon` à l'unload. `force-dynamic`, garde session apprenant. Débounce + upsert `LessonProgress`.
- `POST /api/webhooks/cloudflare-stream` — webhook « asset prêt / erreur transcodage ». Vérifie la signature, met à jour `ElearningLesson.videoDureeSec` + statut média, enqueue `elearning-engagement` (notif auteur).
- `GET /api/elearning/playback/[lessonId]` — renvoie l'**URL HLS signée + watermark** après vérification d'accès+déverrouillage (jamais l'asset id brut au client).
- `GET /api/elearning/resource/[resourceId]` — proxifie une URL R2 signée (`getSignedUrlR2`) après contrôle `telechargeable` + accès. Même pattern que `/api/presse/media/[id]` et `/api/admin/invoices/[id]/pdf` existants.
- `POST /api/webhooks/stripe` [EXISTANT, étendu] — si `STRIPE_ENABLED`, `checkout.session.completed` sur un `ElearningOrder` → octroi automatique (cf. §8.4). Éteint en MVP.

---

## 5. Workers BullMQ & crons [NEUF]

Pattern strictement aligné sur l'existant (`queues.ts`, `worker.ts`, `bootRepeatableJobs`). Chaque queue est `Queue | null` (no-op si `BULLMQ_DISABLED`/pas de Redis). Helpers `enqueueXxx` qui short-circuit proprement. Workers démarrés dans `src/server/queue/worker.ts`.

| Queue                   | Worker                                             | Déclencheur                          | Rôle                                                                                                                                            |
| ----------------------- | -------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `elearning-video`       | `elearning-video-worker.ts`                        | event (post-upload) + webhook Stream | Crée l'asset Stream depuis l'upload, suit le transcodage, ingère sous-titres, met à jour la leçon                                               |
| `elearning-quiz-gen`    | `elearning-quiz-gen-worker.ts`                     | event (action admin)                 | IA : génère `Quiz`/`Question`/`QuestionOption` document-grounded depuis le contenu de leçon (statut `brouillon`, validation auteur obligatoire) |
| `elearning-certificate` | `elearning-certificate-worker.ts`                  | event (complétion ≥ seuil)           | Génère le PDF certificat (`@react-pdf/renderer`), upload R2, crée `DocumentGenere` + QR, enqueue email                                          |
| `elearning-engagement`  | `elearning-engagement-worker.ts`                   | event + cron                         | Relances anti-décrochage (Qualiopi Ind.12), notifications déverrouillage, accusés tuteur                                                        |
| `elearning-import`      | (porté par `elearning-engagement` ou worker dédié) | event (CSV admin)                    | Parse CSV entreprise → upsert `Trainee` + `ElearningAccessGrant` + magic-links, idempotent par `ElearningImportBatch`                           |
| `elearning-crons`       | `elearning-crons-worker.ts`                        | cron (repeatable)                    | Drip `date_fixe`/`offset_inscription` (ouverture programmée), scan inactivité, expiration d'accès, rappels d'échéance FOAD                      |

**Crons ajoutés à `bootRepeatableJobs()`** (mêmes patterns que les crons formation à 08:00 UTC) :

- `elearning.drip-unlock` — quotidien 06:30 UTC — ouvre les modules dont `unlockDate`/offset est atteint, notifie l'apprenant.
- `elearning.inactivity-scan` — quotidien 08:00 UTC — détecte les apprenants inactifs > N jours (`SiteSetting elearning.relance_inactivite_jours`) → relance (Ind.12) + journalise une **trace d'accompagnement** (preuve FOAD).
- `elearning.access-expiry` — quotidien 07:00 UTC — révoque les accès expirés, prévient J-7.

**Réutilise** : `email-worker.ts` + `enqueueEmail()` pour tout envoi (Nodemailer maison, **aucun service tiers**). Nouveaux templates React Email `qualiopi-elearning-*.tsx` (accès ouvert, déverrouillage, relance inactivité, certificat).

---

## 6. Authentification apprenant [NEUF] (ADR-0001)

Système **séparé de NextAuth** (qui ne gère que `AdminUser`). Deux mondes étanches.

- **Identité** = `Trainee` (déjà PII-aware). **Auth** portée par `ElearningLearnerAuth` (FK `traineeId`) : `passwordHash String?` (argon2id), `emailVerifiedAt`, compteurs anti-bruteforce. Le mot de passe est **optionnel** (comptes entreprise) ; le **magic-link reste le défaut**.
- **Magic-link** : réutilise les **primitives de `portail-service.ts`** — token 64 hex (`randomBytes(32)`), comparaison `timingSafeEqual`, cookie **HttpOnly** (séparé du cookie portail Qualiopi pour cloisonner les surfaces). Modèle de session `ElearningSessionToken` (calqué sur `PortailAcces` : token, `expiresAt`, `revoked`, `lastUsedAt`).
- **Garde** : `requireLearnerSession()` (helper [NEUF] sous `access/`) lit le cookie, vérifie le token, renvoie `{ traineeId }`. Middleware dédié sous `src/app/[locale]/apprendre/**` (ne touche **pas** le middleware admin/next-intl).
- **WCAG 3.3.8** (auth accessible, EAA 28/06/2025) : magic-link = pas de mémorisation imposée ; si mot de passe, autoriser le collage + pas de CAPTCHA cognitif.

> Procédure détaillée + diagrammes : `04-BACKEND/05-authentification-apprenant.md`.

---

## 7. Front apprenant [NEUF]

Sous `src/app/[locale]/` (public) et `src/app/[locale]/apprendre/**` (authentifié, `force-dynamic`). Composants sous `src/components/elearning/**`.

### 7.1 Surfaces publiques (budgets Web Vitals stricts)

- `/catalogue` + `/cours/[slug]` (vitrine) — **Server Components**, JSON-LD `Course` (réutilise `src/lib/seo.ts`), ISR `revalidate` raisonnable. Aucune dépendance lourde client → LCP ≤ 1800, CLS = 0. Détail `05-FRONTEND-APPRENANT/07-*`.

### 7.2 Espace apprenant authentifié

- `/apprendre` (tableau de bord : cours en cours, **reprise** « Continuer », progression). Détail `05-FRONTEND-APPRENANT/01-*`.
- `/apprendre/[courseSlug]` (sommaire modules/leçons avec **verrous explicites + raison**). Détail `04-*`.
- `/apprendre/[courseSlug]/[lessonId]` (**lecteur**) :
  - **Player vidéo** HLS standard (vitesse, **sous-titres WCAG AA**, clavier/focus). Reprise auto via heartbeat (§4.2). Risque **INP** → chargé en **client component isolé + `dynamic()`**, hors bundle des pages publiques.
  - **Moteur de quiz** UI (`src/components/elearning/quiz/**`) : ~12 types (QCM mono/multi, vrai/faux, appariement, texte à trous, ordonnancement, réponse courte, essai, upload). Soumission **validée + corrigée côté serveur** (`submitQuizAttemptAction`), feedback configurable + rationale. Détail `05-FRONTEND-APPRENANT/03-*`.
- `/apprendre/certificats` (téléchargement certificats — R2 signé). Détail `06-*`.

**Mobile-first + microlearning** (leçons 2-10 min via `dureeEstimeeMinutes`). **À éviter** (best practices) : autoplay, classements imposés, pacing rigide.

### 7.3 Accessibilité (WCAG 2.2 AA — obligation légale EAA)

Critères ciblés : 2.4.11 (focus non masqué), 2.5.7 (**alternative au drag** dans l'ordonnancement/appariement : boutons monter/descendre), 2.5.8 (cibles ≥ 24px), 3.3.8 (auth accessible), sous-titres, navigation clavier complète, contrastes. Détail `09-QUALITE/04-*`.

---

## 8. Flux principaux (bout en bout)

### 8.1 Octroi automatique (session présentiel/live → e-learning de renforcement)

```
TrainingSession → statut realisee (cron formation EXISTANT)
   └─ hook → grant-service.grantFromEnrollment(enrollment, courseId)
       ├─ upsert ElearningAccessGrant {traineeId, courseId, source: 'enrollment', enrollmentId}
       ├─ crée ElearningEnrollment (cours e-learning)
       └─ enqueueEmail('qualiopi-elearning-acces-ouvert', trainee.email, ...) → magic-link
```

### 8.2 Octroi manuel + import masse entreprise (MVP — ADR-0002/0004)

```
Admin → /[adminPrefix]/elearning/acces
   ├─ octroi unitaire : grantAccessAction(courseId, email|traineeId, clientId?)
   └─ import CSV : importLearnersCsvAction(file)
        └─ upload R2 + crée ElearningImportBatch → enqueue 'elearning-import'
             worker: parse → upsert Trainee → ElearningAccessGrant → magic-link email
             (idempotent par batchId ; rapport succès/erreurs en DB)
```

### 8.3 Consommation → progression → déverrouillage

```
Apprenant clique magic-link → ElearningSessionToken → cookie HttpOnly
   → /apprendre/[course]/[lesson]
       ├─ GET /api/elearning/playback/[lessonId] → URL HLS signée + watermark
       ├─ POST /heartbeat (≈15s) → upsert LessonProgress (watch, position) + ElearningActivityEvent('played')
       └─ fin de leçon → markLessonViewedAction → completion-service
            └─ unlock-engine recompute → module/leçon suivant unlocked|locked(+reason)
```

### 8.4 Évaluation (quiz bloquant — gating par score)

```
Leçon type=quiz → quiz-assembler (tirage N/M, shuffle) → rendu UI
   → submitQuizAttemptAction (Zod + temps serveur)
        ├─ quiz-grader : correction auto (11 types) + scorePct pondéré
        │     (types essai/upload → statut 'correction_manuelle' → file admin)
        ├─ QuizAttempt {scorePct, passed, durationSec} + ElearningActivityEvent('passed'|'failed')
        └─ unlock-engine : si module.unlockType=score_quiz && scorePct ≥ unlockScorePct
              → module suivant déverrouillé ; sinon reste verrouillé AVEC raison
```

### 8.5 Certificat de réalisation (FOAD)

```
completion-service : complétion cours ≥ seuilReussitePct (ElearningCourse)
   → enqueue 'elearning-certificate'
        worker:
          ├─ calcule heures réalisées (centièmes) depuis durées leçons + traces
          ├─ @react-pdf/renderer → PDF modèle officiel (heures réalisées, mentions FOAD)
          ├─ uploadToR2('elearning/certificats/AAAA/<numero>.pdf') + hashSha256
          ├─ DocumentGenere {type: certificat_realisation_foad, numero, qrToken, pdfUrl}
          └─ enqueueEmail('qualiopi-elearning-certificat', ...)
   → /apprendre/certificats (URL signée) ; vérif publique via QR (route existante)
```

### 8.6 Achat (V1 — Stripe activé) / virement (MVP)

MVP : virement + `grantAccessAction` manuel (ADR-0004). V1 : `ElearningOrder` → Stripe Checkout (si `STRIPE_ENABLED`) → webhook `checkout.session.completed` → octroi automatique (§4.2). Aucune refonte : le flag bascule le tunnel.

---

## 9. Conformité FOAD (transversale, dès le MVP)

Câblée dans le data model et les flux (ADR-0003, doc `08-CONFORMITE/*`). Art. D.6313-3-1 — 3 conditions cumulatives :

1. **Assistance technique ET pédagogique** (Qualiopi Ind.19) : **tuteur RAG** + canal de contact + **délais formalisés** (`SiteSetting elearning.tutorat_delai_reponse_h`). Chaque échange = `ElearningActivityEvent` (trace d'accompagnement).
2. **Information activités + durée moyenne** : `ElearningCourse.dureeEstimeeMinutes` (agrégé) affiché avant entrée (D.6313-3-1 §2).
3. **Évaluations qui jalonnent/concluent** (Qualiopi Ind.11 — **non-conformité MAJEURE si absente**) : quiz de module (gating) + évaluation finale. Pont possible vers `EvaluationAcquis`/`Questionnaire` existants pour l'agrégation Qualiopi.

**Faisceau de preuves** (R.6313-3 — preuve libre, relevé de connexion **seul insuffisant**) assemblé par `compliance/foad-evidence.ts` : `LessonProgress` (logs LMS) + `QuizAttempt` (évaluations) + devoirs rendus (R2) + traces tuteur + certificat de réalisation (modèle officiel obligatoire depuis 01/06/2020). Export OPCO/audit via `evidence-export.ts`.

**Rétention** (RGPD + légal) : réutilise la mécanique `suppressionPrevueAt` de `DocumentGenere` + `retention-purge-worker.ts` existant. Logs techniques 6-12 mois ; preuves de réalisation 3-5 ans ; comptable 10 ans. Détail `08-CONFORMITE/05-*` et `06-*`.

**CPF/EDOF** : tout `EDOF_ENABLED`-gated, dormant (ADR-0003). Bloqué tant que pas de certification RNCP/RS (hors code).

---

## 10. Performance & Web Vitals (justification)

- **Pages publiques** (catalogue/vitrine) : Server Components + JSON-LD, zéro JS lourd → respect strict des budgets (LCP ≤ 1800, INP ≤ 100, CLS = 0, First Load ≤ 75 KB gz).
- **Espace apprenant** : `force-dynamic` (hors SSG/stub). Le **player** et le **moteur de quiz** sont les seuls foyers d'INP → isolés en client components `dynamic()`, lazy, hors bundle public ; player HLS natif (pas de gros SDK). Heartbeat débouncé + `sendBeacon` pour ne pas bloquer le thread.
- **Vidéo** : Cloudflare Stream (HLS adaptatif) — pas d'auto-hébergement (egress prohibitif, ADR-0005). URLs signées + watermark par utilisateur (anti-partage léger ; DRM lourd réservé au premium).
- **Bundle gate** : `size-limit` ; toute hausse > +5 KB gz vs `main` est bloquée → composants apprenant sous budget propre.

---

## 11. Console admin [NEUF]

Sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, composants `src/components/admin/elearning/**`. Réutilise `AdminPageShell`/`Header`/`StatCard`/`Table`/`Badge` et la RBAC `requireAdmin*`.

- **Navigation** : nouveau groupe `elearning` dans `src/lib/admin-nav.ts` (`AdminNavGroup`), rendu par **`AdminSidebarNav.tsx`** (⚠️ le composant réellement monté ; pas `AdminSidebar.tsx`). Sections : Cours (outil auteur), Apprenants & accès, Banque de quiz, Certificats, Reporting/Conformité.
- **Outil auteur** (`03-*`) : drag&drop sections→leçons (réécrit `ordre` en transaction), blocs mixtes dans une leçon, upload média transcodé auto, **aperçu as-student**, brouillon→publication (`version`++).
- **Gestion accès/entreprises** (`05-*`) : octroi, révocation, import CSV, suivi par `Client`.
- **Reporting** (`08-*`) : complétion, temps, scores, exports conformité (depuis `ElearningActivityEvent` + `QuizAttempt`).

---

## 12. IA pédagogique [NEUF] (réutilise l'existant)

- **Quiz-gen** (`ai/quiz-generator.ts`, worker `elearning-quiz-gen`) : **document-grounded** sur le contenu de leçon (Anthropic `@anthropic-ai/sdk`, même client que le Formation Engine `qualiopi-formation-engine-worker.ts`). Sortie en `brouillon` → **validation auteur obligatoire** (pas de publication auto de quiz). Réutilise les garde-fous qualité/critique adversariale du Formation Engine (`runAdversarialCritique`, `GrilleQualiteConfig`).
- **Tuteur RAG** (`ai/tutor-rag.ts`, V1) : assistance pédagogique **ancrée avec citations**, réutilise le pipeline knowledge/RAG existant (chatbot-ingest / chat_kb_chunks). Pas de wrapper ChatGPT nu, pas d'avatar maison. Sert l'Ind.19 (assistance pédagogique). Détail `04-BACKEND/08-*` et `09-*`.

---

## 13. Multi-tenant (V2 — conçu maintenant) [NEUF différé]

ADR-0002 : data model **préparé** (`ElearningCourse.ownerClientId`, `ElearningAccessGrant.clientId`) ; MVP filtre par `traineeId` (pas de scoping tenant). V2 : cloisonnement strict par `Client`, admin entreprise délégué, branding, reporting par organisation, SSO/SCIM. Stratégie complète : `02-ARCHITECTURE/multi-tenant-strategie.md`.

---

## 14. Sécurité & contrat de build

- **Stub-aware** : services LMS appelables au build → early-exit `stub.invalid` (lecture fallback, mutation throw), comme `portail-service.ts`/`prisma.ts`. Pages apprenant `force-dynamic` derrière auth → jamais SSG → hors stub.
- **R2** : jamais d'URL brute exposée ; toujours `getSignedUrlR2` à TTL court via Route Handler gardé. Upload direct navigateur via `getSignedUploadUrlR2` (CORS PUT bucket à configurer).
- **Vidéo** : asset id jamais exposé ; seule l'URL HLS signée+watermark transite, après contrôle accès+déverrouillage.
- **Anti-triche** : randomisation (tirage + shuffle) + **temps serveur** + correction serveur. Proctoring **uniquement high-stakes** (CNIL : proportionné, optionnel, alternative). Détail `09-QUALITE/02-*`.
- **RGPD** : PII via `pii-crypto.ts`, IP hashées si journalisées, soft-delete `Trainee.deletedAt`, rétention via `retention-purge-worker`.

---

## 15. Synthèse — EXISTANT vs NEUF

| Brique                                                                | Statut                                                                | Réf. code                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| `Trainee`, `Enrollment`, `Client`, `Formation`, `DocumentGenere`(+QR) | EXISTANT (relations inverses additives)                               | `schema.prisma` 5274/5310/4890/5507              |
| `PortailAcces` + `portail-service.ts` (primitives token)              | EXISTANT (réutilisé pour magic-link apprenant)                        | `src/server/qualiopi/portail/portail-service.ts` |
| R2 (`uploadToR2`/`getSignedUrlR2`/`getSignedUploadUrlR2`)             | EXISTANT                                                              | `src/lib/r2-storage.ts`                          |
| BullMQ (`queues.ts`/`worker.ts`/`bootRepeatableJobs`)                 | EXISTANT (étendu : 5-6 queues `elearning-*`)                          | `src/server/queue/*`                             |
| Email Nodemailer + React Email + `enqueueEmail`                       | EXISTANT (nouveaux templates)                                         | `email-worker.ts`                                |
| Formation Engine IA + critique adversariale                           | EXISTANT (réutilisé par quiz-gen)                                     | `qualiopi-formation-engine-worker.ts`            |
| RAG/knowledge (chatbot-ingest)                                        | EXISTANT (réutilisé par tuteur)                                       | `chatbot-ingest-worker.ts`                       |
| Stripe (`Invoice`/`Payment`/webhook, flag)                            | EXISTANT, ÉTEINT (V1)                                                 | `src/lib/stripe.ts`, `env.ts:103`                |
| Admin shell + `admin-nav.ts` + RBAC                                   | EXISTANT (groupe `elearning` ajouté, monté par `AdminSidebarNav.tsx`) | `src/lib/admin-nav.ts`                           |
| Cœur LMS `ElearningCourse/Module/Lesson/Resource`                     | NEUF                                                                  | `03-DATA-MODEL/01-*`                             |
| Progression, quiz, auth apprenant, certificats e-learning             | NEUF                                                                  | `src/server/elearning/**`                        |
| Streaming vidéo HLS (Cloudflare Stream)                               | NEUF                                                                  | `elearning/video/**`                             |
| Outil auteur, import masse, IA quiz/tuteur                            | NEUF                                                                  | `(admin)/.../elearning/**`, `elearning/ai/**`    |
| Multi-tenant strict                                                   | NEUF — V2                                                             | `multi-tenant-strategie.md`                      |

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 → 0008 (figés)
- `02-ARCHITECTURE/reutilisation-existant.md` — carte anti-duplication détaillée
- `02-ARCHITECTURE/multi-tenant-strategie.md` — V2
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — modèles/enums cœur (SSOT)
- `03-DATA-MODEL/02-schema-progression-tracking.md` — progression + grammaire xAPI
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — moteur quiz
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — auth apprenant + accès
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder` (Stripe gated)
- `03-DATA-MODEL/06-strategie-migrations.md` — migrations additives
- `04-BACKEND/*` — services, server actions, workers, vidéo, IA, emails
- `05-FRONTEND-APPRENANT/*` — dashboard, player, quiz, déverrouillage, WCAG, certificats
- `06-CONSOLE-ADMIN/*` — navigation, outil auteur, accès, reporting
- `08-CONFORMITE/*` — FOAD D.6313-3-1, Qualiopi, CPF/EDOF, RNCP, RGPD, preuves
- `09-QUALITE/*` — tests, sécurité, Web Vitals, accessibilité
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — ordre de construction
