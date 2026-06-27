---
name: axionia-lms-core
description: >-
  Implémenter, étendre, vérifier ou auditer le CŒUR de la plateforme e-learning / LMS PROPRIÉTAIRE
  d'Axion-IA (organisme de formation IA — SAS française, NDA DREETS AURA, certifié Qualiopi). Couvre le
  modèle de données LMS (ElearningCourse / ElearningModule / ElearningLesson / ElearningResource), le
  suivi de progression serveur (ElearningEnrollment, LessonProgress, heartbeat/reprise auto), le moteur
  de quiz interactif (Quiz / Question / QuizAttempt, ~12 types, gating PAR SCORE), le déverrouillage de
  modules/leçons (drip + unlock immédiat/après-précédent/date-fixe/offset-inscription/score-quiz),
  l'authentification APPRENANT hybride (magic-link PortailAcces étendu + mot de passe optionnel, SÉPARÉE
  de NextAuth admin), l'octroi d'accès (auto session-réalisée + manuel admin + import CSV masse), le
  pipeline vidéo HLS (Cloudflare Stream / Bunny, URLs signées + watermark), le lecteur de cours, les
  certificats de réalisation e-learning (réutilise DocumentGenere + QR), et la conformité FOAD (preuves
  D.6313-3-1 / R.6313-3, Qualiopi Ind.11/19, conservation). Stack RÉELLE imposée : Next.js 16.2 App
  Router + Prisma 5.22 + Postgres + NextAuth 5 (2FA, ADMIN uniquement) + BullMQ + @react-pdf/renderer +
  nodemailer + @anthropic-ai/sdk + next-intl (FR canonique, EN désactivé) + Tailwind v4 tokens @theme +
  Cloudflare R2. Server Actions (pas REST), admin sous src/app/[locale]/(admin)/[adminPrefix]/elearning/**,
  espace apprenant sous src/app/[locale]/(apprendre)/**. Cloisonnement strict src/server/elearning/**.
  Respecte le contrat de build stub.invalid (ADR 0026), les budgets Web Vitals, le SSOT pricing.ts et les
  migrations additives. Déclencheurs : « LMS », « e-learning », « FOAD », « cours en ligne », « modules
  qui se déverrouillent », « drip / gating », « quiz bloquant », « moteur de quiz », « banque de
  questions », « progression apprenant », « reprise auto », « lecteur de cours / player vidéo »,
  « Cloudflare Stream / Bunny », « URL signée vidéo / watermark », « auth apprenant / mot de passe
  apprenant », « octroi d'accès / import CSV apprenants », « certificat e-learning », « tuteur IA / quiz
  IA », « espace apprenant », « outil auteur / course builder ». Formulations de Will : « lance/lancer le
  LMS », « le système e-learning », « la plateforme de cours en ligne », « démarrer le module
  e-learning ». → activer ce skill puis lire les docs socle sous axionia/_LMS-ELEARNING/.
stack: Next.js 16.2 App Router · React 19 · Prisma 5.22 + PostgreSQL · NextAuth 5 (admin only) · BullMQ 5 + ioredis · Cloudflare R2 (@aws-sdk/client-s3) · Cloudflare Stream / Bunny (vidéo HLS) · @react-pdf/renderer 4.5 · nodemailer + @react-email · @anthropic-ai/sdk 0.40 · next-intl 4.11 (FR canonique) · Tailwind v4 @theme · Zod + react-hook-form · TanStack Query 5 · argon2 · Vitest + Playwright
---

# Axion-IA — LMS / e-learning : cœur (skill `axionia-lms-core`)

Ce skill pilote l'implémentation, l'extension et la vérification du **cœur** de la plateforme
e-learning **propriétaire** d'Axion-IA (pas de Moodle/Teachable/360Learning), **à l'intérieur du codebase
`axionia`** (Next.js 16). Il couvre la colonne vertébrale LMS : cours/modules/leçons, progression,
quiz + gating, auth apprenant, octroi d'accès, vidéo, certificats e-learning, conformité FOAD.

Il est conçu pour un fonctionnement **autopilot de bout en bout** : exploration → plan → tranches
verticales → vérifications croisées → réconciliation → conformité prouvée, **sans jamais casser
l'existant** (Formation Engine / Qualiopi déjà en prod) ni le contrat de build.

> **Périmètre des skills LMS.** Ce skill = le **cœur** (data model, progression, quiz, auth apprenant,
> octroi, vidéo, certificats, conformité). L'**outil auteur** (course builder drag&drop, IA quiz-gen,
> aperçu as-student) relève de `skill-axionia-lms-authoring`. La **conformité FOAD détaillée** (oracle
> d'acceptation, faisceau de preuves, EDOF) relève de `skill-axionia-foad-conformite`. Quand une tâche
> chevauche, charger les deux skills.

---

## 1. Quand l'utiliser

Active ce skill dès que la tâche touche : le modèle de données LMS, le suivi de progression, le moteur
de quiz interactif, le déverrouillage (drip/gating), l'authentification apprenant, l'octroi/import
d'accès, le pipeline vidéo, le lecteur de cours, les certificats e-learning, ou la conformité FOAD du
parcours asynchrone.

**Ne l'utilise PAS pour** (router vers le bon skill) :

- Le back-office **Qualiopi présentiel/live** (sessions, émargement, BPF, 22 indicateurs, OPCO,
  conventions, attestations présentiel) → **`axionia-qualiopi`**.
- L'**outil auteur / course builder** (édition drag&drop, blocs riches, IA quiz-gen, clonage) →
  **`axionia-lms-authoring`**.
- La **conformité FOAD profonde** (matrice d'acceptation, EDOF, dossier RNCP/RS) →
  **`axionia-foad-conformite`**.
- La **banque d'images** → `axionia-image-bank`.
- Le **site marketing public** hors e-learning / le contenu SEO → autres skills.

---

## 2. Documents socle (source de vérité — LIRE AVANT D'ÉCRIRE)

Ces documents ont été rédigés par le lead. **Ils font foi pour les noms de modèles/enums/décisions.**
Toujours les relire en Phase 0 ; en cas de conflit avec ce skill, **les docs socle + le code réel
gagnent** (et on signale la divergence).

| Fichier                                                                   | Charger quand                                                                                                                                                    |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axionia/_LMS-ELEARNING/00-INDEX/README.md`                               | **Toujours, en premier.** Index maître, structure du dossier, vue réutilisé/neuf.                                                                                |
| `axionia/_LMS-ELEARNING/00-INDEX/DECISIONS-ARBITRAGES.md`                 | **Toujours.** Les 8 ADR figés (auth hybride, multi-tenant V2, CPF ready, Stripe éteint, vidéo Stream, pas de SCORM, cloisonnement, migrations additives).        |
| `axionia/_LMS-ELEARNING/03-DATA-MODEL/01-schema-cours-modules-lecons.md`  | Avant de toucher au schéma cœur. Prisma exact : `ElearningCourse/Module/Lesson/Resource`, enums `ElearningCourseStatut/ElearningLessonType/ElearningUnlockType`. |
| `axionia/_LMS-ELEARNING/03-DATA-MODEL/02-schema-progression-tracking.md`  | Progression : `ElearningEnrollment`, `LessonProgress`, heartbeat, grammaire xAPI.                                                                                |
| `axionia/_LMS-ELEARNING/03-DATA-MODEL/03-schema-quiz-evaluations.md`      | Moteur de quiz : `Quiz`, `Question`, `QuizAttempt`, types, gating par score.                                                                                     |
| `axionia/_LMS-ELEARNING/03-DATA-MODEL/04-schema-comptes-acces-auth.md`    | Auth apprenant + octroi + import + multi-tenant (clé d'appartenance).                                                                                            |
| `axionia/_LMS-ELEARNING/11-ROADMAP/01-phasage-mvp-v1-v2.md`               | Ordre de construction (MVP → V1 → V2) + dépendances critiques.                                                                                                   |
| `axionia/_LMS-ELEARNING/08-CONFORMITE/01-foad-d6313-3-1.md` (et 02/05/06) | Dès qu'on touche aux preuves FOAD / certificat / conservation.                                                                                                   |

> Le **contrat de codebase Qualiopi** (`axionia/.claude/skills/axionia-qualiopi/reference/01-codebase-contract.md`)
> reste la référence pour les conventions communes du repo (Prisma `prisma/generated/client`, gates
> `verify:all`, `proxy.ts`, `admin-nav.ts`, etc.). Le LMS **réutilise** ce contrat ; ce skill ne décrit
> que les spécificités e-learning.

---

## 3. Les 6 lois (contrat non négociable)

1. **Le code réel fait foi, en permanence.** Zéro hypothèse : toute décision est vérifiée par
   Grep/Glob/Read dans le code actuel d'`axionia` avant chaque tranche. Ordre d'autorité : \*\*code vivant
   > docs socle LMS > ce skill > best-practices génériques\*\*. Toute divergence → suivre le code,
   > corriger le doc, noter dans le journal de reprise.
2. **Stack imposée, briques existantes réutilisées.** Prisma (jamais de SQL `ALTER TABLE`), Server
   Actions (jamais de REST `/api/v1` métier — `app/api/*` réservé webhooks + routes média signées),
   BullMQ workers, `@react-pdf/renderer`, nodemailer + `@react-email`, next-intl FR, Tailwind v4 `@theme`.
   Réutiliser : `src/lib/prisma.ts`, `src/lib/redis.ts`, `src/lib/r2-storage.ts`, providers IA
   `src/server/content-gen/providers/`, `cost-tracker`, `src/lib/email/*`, `src/lib/admin-nav.ts`,
   `src/content/pricing.ts`, modèles `Trainee`/`Enrollment`/`Client`/`PortailAcces`/`DocumentGenere`.
   **Jamais de second système parallèle.**
3. **Non destructif & resumable.** Migrations Prisma **strictement additives** (CREATE TABLE / ADD
   COLUMN **nullable**), aucun `DROP` (ADR-LMS-0008). Respect du contrat `stub.invalid` (ADR 0026).
   Travail sur branche ; **jamais de push `main` sans accord explicite de Will** (push = deploy prod).
4. **Cloisonnement strict** (ADR-LMS-0007) : tout le code LMS sous les chemins dédiés du §5. Réutilisation
   explicite des briques ; jamais de duplication. Prévoir un gate `elearning:isolation-check` (miroir
   `image-bank:isolation-check` / `qualiopi:isolation-check`).
5. **Zéro valeur en dur, zéro TODO/stub.** Couleurs via tokens `@theme` (gate anti-hex), prix via
   `pricing.ts`, paramètres métier via `SiteSetting` (catégorie **`elearning`**, helpers
   `get/setElearningConfig`), seuils par défaut (drip, seuil réussite, heartbeat) configurables, jamais
   recopiés en dur dans le code. Chaque fonction livrée est réelle.
6. **Conformité FOAD prouvée, pas affirmée.** Chaque obligation (D.6313-3-1 §1/2/3, R.6313-3 faisceau de
   preuves, Ind.11 évaluations jalonnantes — **non-conformité MAJEURE si absente**, Ind.19 assistance) est
   reliée à un artefact logiciel **ET** à un test automatisé. Le **certificat de réalisation** (modèle
   officiel, heures réalisées) est obligatoire.

---

## 4. ADR figés — rappel opérationnel (détail : `DECISIONS-ARBITRAGES.md`)

| ADR                     | Décision                                                                                                             | Conséquence directe sur le code                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0001 Auth apprenant** | Hybride : magic-link par défaut + `passwordHash` **optionnel** (argon2id). Système **SÉPARÉ de NextAuth**.           | Cookie/middleware apprenant dédiés. NextAuth ne gère QUE `AdminUser`. Jamais brancher l'apprenant sur `auth()`.                                                                                                       |
| **0002 Multi-tenant**   | Conçu maintenant, **livré V2**. MVP = accès individuels + import CSV.                                                | Poser dès maintenant la clé d'appartenance entreprise (`ownerClientId` sur cours, `clientId` sur l'accès apprenant) ; **ne pas** construire l'espace entreprise autonome ni le scoping par `tenant_id` global au MVP. |
| **0003 CPF/RNCP**       | « Certification-ready » ; EDOF derrière flag `EDOF_ENABLED=false`. CPF **bloqué** tant que pas de certif RNCP/RS.    | Produire dès le MVP toutes les preuves (assiduité, progression, éval, certificat, traces d'assistance). Brancher EDOF mais gated.                                                                                     |
| **0004 E-commerce**     | Infra Stripe **éteinte** (`STRIPE_ENABLED=false`). MVP = virement + octroi manuel.                                   | Modèle `ElearningOrder` qui sait octroyer l'accès ; paiement CB gated. Réutiliser `Invoice/Payment`.                                                                                                                  |
| **0005 Vidéo**          | **Cloudflare Stream** par défaut (Bunny alt UE). HLS + URLs signées + watermark. **Pas d'auto-hébergement.**         | La vidéo ne passe PAS par `r2Key` mais par `videoAssetId`. R2 = PDF/sous-titres/ressources, pas streaming.                                                                                                            |
| **0006 Standards**      | 100 % natif. **Pas de SCORM/xAPI/LTI** au lancement. Tracking interne modélisé sur grammaire **xAPI (verbe/objet)**. | `LessonProgress` / événements pensés verbe-objet (`completed`/`answered`/`passed`) pour un futur émetteur xAPI sans refonte.                                                                                          |
| **0007 Cloisonnement**  | Code sous `src/server/elearning/**` etc.                                                                             | Voir §5.                                                                                                                                                                                                              |
| **0008 Migrations**     | Strictement additives, colonnes ajoutées nullable.                                                                   | `Trainee.passwordHash String?`, relations inverses sans colonne, etc.                                                                                                                                                 |

---

## 5. Cloisonnement & arborescence (ADR-LMS-0007)

Tout le code LMS vit sous des chemins dédiés. **Réutilisation explicite** des briques existantes, jamais
de duplication.

```
src/
  server/elearning/                          ← cœur métier LMS (services domaine)
    courses/            (course-service.ts, module-service.ts, lesson-service.ts, publish.ts)
    progress/           (progress-service.ts, heartbeat.ts, completion.ts, unlock-engine.ts)
    quiz/               (quiz-service.ts, grading.ts, attempt-service.ts, question-bank.ts)
    access/             (learner-auth.ts, grant-service.ts, csv-import.ts, magic-link.ts)
    video/              (stream-provider.ts  ← Cloudflare Stream | Bunny, signed-url.ts, watermark.ts)
    certificates/       (certificate-service.ts  ← réutilise DocumentGenere + QR)
    foad/               (evidence-service.ts, attendance.ts  ← faisceau de preuves)
    config.ts           (get/setElearningConfig → SiteSetting cat. "elearning")
    _guards.ts          (re-export RBAC admin + logElearningActivity ; guards apprenant séparés)

  server/actions/elearning/                  ← Server Actions ("use server", Zod, auth, idempotence, audit)
    courses/  modules/  lessons/  quiz/  progress/  access/  certificates/

  server/queue/workers/                      ← workers BullMQ (miroir pattern existant)
    elearning-video-worker.ts                (poll transcodage Stream, MAJ videoAssetId/statut)
    elearning-crons-worker.ts                (drip date_fixe/offset, relances anti-décrochage Ind.12)
    elearning-certificate-worker.ts          (génération PDF certificat asynchrone)
    elearning-csv-import-worker.ts           (import masse apprenants)
    (enregistrer les queues dans src/server/queue/queues.ts + bootRepeatableJobs())

  app/[locale]/(admin)/[adminPrefix]/elearning/   ← console admin LMS (auto-protégée par proxy.ts)
    page.tsx  cours/  apprenants/  acces/  banque-quiz/  certificats/  reporting/

  app/[locale]/(apprendre)/                   ← ESPACE APPRENANT (auth apprenant, PAS NextAuth)
    apprendre/                                (dashboard, /apprendre/cours/[slug], lecteur, quiz)
    connexion/                                (magic-link + login mot de passe optionnel)
    (layout dédié : auth apprenant via cookie HttpOnly séparé)

  app/api/elearning/                          ← UNIQUEMENT : webhooks (Stream) + routes média signées
    video/[lessonId]/route.ts                (renvoie URL HLS signée + token watermark, auth apprenant)
    stream-webhook/route.ts                  (webhook transcodage Cloudflare Stream, HMAC)

  components/elearning/                        ← UI apprenant (player, quiz UI, progression, certificat)
  components/admin/elearning/                  ← UI admin LMS (suffixe V2 si refonte)
```

**Note `(apprendre)` vs portail existant.** Le portail stagiaire actuel (`src/app/[locale]/portail/`,
service `src/server/qualiopi/portail/portail-service.ts`, `getEspaceStagiaire`) est lié au présentiel
(émargement, attestations, RGPD). L'espace **apprendre** est l'espace e-learning asynchrone. Décision à
acter en Phase 1 : **étendre `portail/` OU créer `(apprendre)/`**. Recommandation par défaut : **groupe
de routes `(apprendre)` dédié** (UX cours-centrée, player lourd, auth hybride distincte), avec un lien
croisé depuis `portail/mon-espace` pour les stagiaires qui ont aussi du e-learning. Confirmer avec Will
avant de coder.

---

## 6. Data model — cœur LMS (NEUF, additif)

Les modèles complets sont dans `03-DATA-MODEL/01..04`. **Respecter exactement** ces noms (PascalCase,
préfixe `Elearning` pour le cœur). Conventions repo : `id` UUID `@db.Uuid`, `@map` snake_case, `@@map`
table snake_case pluriel, index sur FK + colonnes filtrées, timestamps `created_at`/`updated_at`.

### 6.1 Hiérarchie de contenu (doc 01 — déjà figé)

```
ElearningCourse  →  ElearningModule  →  ElearningLesson  →  ElearningResource
```

- **`ElearningCourse`** : `slug` unique citext, `titre`, `statut` (`ElearningCourseStatut` :
  brouillon/publie/archive), `version` (incrément à publication), `publishedAt`, `objectifs`/`prerequis`
  Json, `dureeEstimeeMinutes` (cache, sert l'**information de durée** D.6313-3-1 §2), `estFoad`,
  `seuilReussitePct` (défaut 70 → certificat), `vendableSeul`, `imageCouvertureKey` (R2). FK
  **optionnelles** : `formationId → Formation` (cours adossé à une formation Qualiopi OU autonome),
  `ownerClientId → Client` (multi-tenant : null = catalogue global). Index `statut`/`formationId`/`ownerClientId`.
- **`ElearningModule`** : `courseId`, `titre`, `ordre` (`@@unique([courseId, ordre])`), champs de
  déverrouillage `unlockType` (`ElearningUnlockType`), `unlockDate`, `unlockOffsetJours`, `unlockQuizId`,
  `unlockScorePct`.
- **`ElearningLesson`** : `moduleId`, `titre`, `type` (`ElearningLessonType` :
  video/texte/pdf/quiz/embed/devoir), `ordre` (`@@unique([moduleId, ordre])`), contenu selon type
  (`contenuJson` blocs riches, `videoAssetId`+`videoDureeSec`, `pdfKey`, `quizId`), `dureeEstimeeMinutes`
  (microlearning 2-10 min), `obligatoire` (compte dans la complétion), mêmes champs `unlock*` (gating fin).
- **`ElearningResource`** : médias rattachés à une leçon (`type` pdf/image/audio/fichier/**sous_titres**),
  `r2Key`, `mimeType`, `sizeBytes`, `telechargeable`, `ordre`. Stockage **via `src/lib/r2-storage.ts`**.

**Champs inverses additifs** sur modèles existants (relations sans colonne, zéro risque) :
`Formation.elearningCourses ElearningCourse[]` et
`Client.coursesProprietaires ElearningCourse[] @relation("ClientCoursesProprietaires")`.

### 6.2 Progression / tracking (doc 02 — NEUF)

- **`ElearningEnrollment`** = inscription apprenant ↔ cours e-learning (**distinct** de `Enrollment`
  présentiel↔session, qui est conservé tel quel). Porte : statut (en_cours/termine/expire), date d'octroi
  (`grantedAt` → base de calcul `offset_inscription`), `lastAccessedAt`, `progressionPct` (cache),
  `completedAt`, `scoreGlobalPct`, lien vers l'accès apprenant et, si pertinent, `clientId` (employeur,
  inter / pack entreprise) + `enrollmentPresentielId` optionnel (cours adossé à une session).
- **`LessonProgress`** = état par leçon par apprenant : `status` (non_commence/en_cours/termine),
  `watchedSeconds`/`lastPositionSeconds` (reprise auto vidéo), `completedAt`, `firstStartedAt`. **Reprise
  auto persistée SERVEUR** (best practice 2026, pas localStorage seul). `@@unique([enrollmentId, lessonId])`.
- **Heartbeat** : Server Action `recordHeartbeat` (toutes ~15-30 s côté player) qui met à jour
  `watchedSeconds`/`lastPositionSeconds` + horodatage serveur → **trace d'assiduité FOAD** + anti-triche
  (temps serveur). Throttle + idempotence (clé `enrollmentId+lessonId+bucket`).
- **Grammaire xAPI** (ADR-0006) : modéliser les événements de progression en triplets verbe/objet
  (`completed`/`answered`/`passed`/`attempted` sur lesson/quiz) pour permettre un futur émetteur xAPI/LRS
  sans refonte. Pas de table LRS au MVP.

### 6.3 Quiz / évaluations (doc 03 — NEUF)

- **`Quiz`** : `titre`, `seuilReussitePct`, `maxTentatives` (null = illimité), `tempsLimiteSec`
  (chronomètre **serveur**), `shuffleQuestions`/`shuffleReponses`, `tirageAleatoireN` (N parmi M de la
  banque), `feedbackMode` (immédiat / fin / jamais), `afficheRationale`.
- **`Question`** : `type` (~12 : QCM mono, QCM multi, vrai/faux, appariement, texte à trous,
  ordonnancement, réponse courte, essai+correction manuelle, upload…), `enonce`, `pointsPonderation`,
  `rationale`, `reponses`/`bareme` Json, `banqueId?` (banque de questions réutilisable, tirage aléatoire).
- **`QuizAttempt`** : `enrollmentId`, `quizId`, `reponsesJson`, `scorePct`, `reussi` (bool),
  `tentativeNumero`, `startedAt`/`submittedAt`, `corrigeManuellementPar?` (essai/upload). La **correction
  auto** (`grading.ts`) calcule le score serveur ; l'essai/upload passe en correction manuelle admin.
- **Gating PAR SCORE** : un `ElearningModule`/`Lesson` en `unlockType = score_quiz` se déverrouille
  quand le **meilleur `QuizAttempt.scorePct` ≥ `unlockScorePct`** (vraie note, **PAS** attempt-only —
  best practice 2026). Le verrou est **affiché AVEC sa raison** (« Réussissez le quiz X à ≥ 80 % »).
  **Override admin** possible (tracé dans `ActivityLog`).
- **Anti-triche léger** : randomisation (`shuffle*`, `tirageAleatoire`) + temps serveur + 1 seule
  soumission en cours. Proctoring uniquement high-stakes (CNIL : proportionné, optionnel, alternative).

### 6.4 Auth & accès apprenant (doc 04 — NEUF, ADR-0001)

- **`Trainee.passwordHash String?`** (additif nullable, argon2id) — réutilise le modèle `Trainee`
  existant (PII chiffrée, consentements). **Pas de nouveau modèle utilisateur.** Magic-link reste le
  défaut ; mot de passe activable pour comptes entreprise.
- **Accès apprenant** : réutiliser/étendre **`PortailAcces`** (token 64 hex, cookie HttpOnly 90 j,
  `revoked`, `expiresAt`, `lastUsedAt`). Décision Phase 1 : étendre `PortailAcces` (ajouter portée
  e-learning) **OU** créer `ElearningSession`/`ElearningAccessToken` dédié — recommandation : **étendre
  `PortailAcces`** (déjà éprouvé, RGPD, révocable) avec un champ de portée nullable, sauf si la sémantique
  diverge trop. Confirmer avec Will.
- **Octroi (`grant-service.ts`)** : 3 chemins → (a) **auto** quand une `TrainingSession` est réalisée
  (offrir le e-learning adossé), (b) **manuel** admin (1 clic), (c) **import CSV** masse (entreprise) via
  `elearning-csv-import-worker.ts` (validation Zod ligne par ligne, création `Trainee` idempotente sur
  email citext, envoi magic-link). L'octroi crée un `ElearningEnrollment` + un accès + envoie l'email.
- **Cohabitation NextAuth STRICTE** : l'auth apprenant est un **monde séparé** (cookie dédié, garde
  dédiée dans le layout `(apprendre)`). **Ne jamais** appeler `auth()` (NextAuth admin) côté apprenant,
  ni l'inverse. `proxy.ts` protège l'admin ; l'espace apprenant a sa propre garde.

### 6.5 E-commerce (doc 05 — gated, ADR-0004)

- **`ElearningOrder`** : commande e-learning (apprenant/client, cours, montant via `pricing.ts`, statut).
  Sait **octroyer l'accès** après paiement. Paiement CB **éteint** (`STRIPE_ENABLED=false`) → MVP =
  virement + octroi manuel. Réutiliser `Invoice`/`Payment`/`Refund`. Le jour où Stripe est activé : aucune
  refonte.

---

## 7. Réutilisation de l'existant (carte anti-duplication)

| Besoin LMS                                       | Existant `axionia` à réutiliser                                                                                                                               | Action                                                                                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apprenant (PII, handicap chiffré, consentements) | `Trainee` (`schema.prisma:5274`)                                                                                                                              | **ÉTENDRE** : `passwordHash String?` (additif). Pas de nouveau user.                                                                                                                     |
| Inscription présentiel                           | `Enrollment` (`:5310`)                                                                                                                                        | **NE PAS confondre** : créer `ElearningEnrollment` distinct (cours↔apprenant). Lien optionnel via `enrollmentPresentielId`.                                                              |
| Accès portail token                              | `PortailAcces` (`:6236`, token 64 hex, cookie HttpOnly 90 j, revoked) + service `src/server/qualiopi/portail/portail-service.ts`                              | **RÉUTILISER/ÉTENDRE** pour l'octroi e-learning + magic-link apprenant.                                                                                                                  |
| CRM entreprise                                   | `Client` (`:4890`, SIRET/OPCO)                                                                                                                                | **RÉUTILISER** comme `ownerClientId` (multi-tenant V2) / employeur. **PAS** un tenant au MVP.                                                                                            |
| Modalité                                         | enum `ModaliteFormation` (`:5031` : presentiel/distanciel/hybride) + `Formation`/`TrainingSession`                                                            | **RÉUTILISER**. Le e-learning asynchrone (FOAD) est une nouvelle dimension, lien optionnel `formationId`.                                                                                |
| Stockage fichiers                                | `src/lib/r2-storage.ts` (`uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`, `existsInR2`, `getObjectBufferR2`)                                           | **RÉUTILISER** pour PDF/sous-titres/ressources/image couverture. **PAS** pour la vidéo (→ Stream). Upload gros fichiers via URL signée PUT directe navigateur.                           |
| Vidéo streaming                                  | (n'existe pas — R2 ne streame pas)                                                                                                                            | **CRÉER** `src/server/elearning/video/stream-provider.ts` (Cloudflare Stream par défaut, interface provider pour Bunny).                                                                 |
| Documents PDF + QR                               | `DocumentGenere` (`:5507`) + `@react-pdf/renderer` + `qrToken`                                                                                                | **RÉUTILISER** pour le **certificat de réalisation e-learning** (heures réalisées, modèle officiel).                                                                                     |
| Emails                                           | `src/lib/email/*` (`sendEmail`, `enqueueEmail` → `emailsQueue`) + templates React Email + `email-worker.ts`                                                   | **RÉUTILISER** la queue + helper ; **CRÉER** templates `elearning-*.tsx` (octroi accès, magic-link, relance anti-décrochage, certificat prêt).                                           |
| Workers / crons                                  | pattern `booking-crons-worker.ts` / `qualiopi-formation-crons-worker.ts` + `bootRepeatableJobs()` + `queues.ts`                                               | **MIROIR** : `elearning-crons` (drip date/offset, relances) + `elearning-video` + `elearning-certificate` + `elearning-csv-import`. Enregistrer dans `queues.ts`.                        |
| Provider IA                                      | `src/server/content-gen/providers/anthropic.ts` (IProvider, prompt caching) + `cost-tracker` + `retry.ts`                                                     | **RÉUTILISER** pour quiz-gen + tuteur RAG (V1) — **ne jamais hardcoder un model id** ; utiliser la config provider.                                                                      |
| RAG / Knowledge                                  | base knowledge + RAG existants (réutilisés par content-gen)                                                                                                   | **RÉUTILISER** pour le **tuteur RAG ancré** (citations, Ind.19) — V1.                                                                                                                    |
| RBAC admin                                       | `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`), pattern `src/server/actions/qualiopi/_guards.ts` (`logQualiopiActivity`) | **RÉUTILISER** → créer `src/server/elearning/_guards.ts` (re-export guards admin + `logElearningActivity` → `ActivityLog`, targetType préfixé `elearning.`).                             |
| Navigation admin                                 | `src/lib/admin-nav.ts` (groupe `qualiopi` existant `:463+`)                                                                                                   | **AJOUTER** un groupe `elearning` (ou sous-section) : Vue d'ensemble, Cours, Apprenants, Accès, Banque de quiz, Certificats, Reporting. Sidebar montée = **`AdminSidebarNav.tsx`**.      |
| Settings métier                                  | `SiteSetting` (clé/valeur JSON + catégories + audit)                                                                                                          | **RÉUTILISER** catégorie **`elearning`** (seuils drip, heartbeat interval, seuil réussite défaut, fournisseur vidéo) via `get/setElearningConfig`. **PAS** de table de config parallèle. |
| Flags de phase                                   | pattern `STRIPE_ENABLED` (`src/env.ts:105`), `EN_LOCALE_ENABLED`                                                                                              | **CRÉER** `EDOF_ENABLED` (CPF/EDOF, défaut false) + au besoin `ELEARNING_PUBLIC_CATALOG_ENABLED` ; validés dans `src/env.ts`.                                                            |
| Formateur magic-link                             | `FormateurMagicLink` (`:6601`) + `src/app/[locale]/espace-formateur/`                                                                                         | **RÉFÉRENCE de pattern** pour l'auth magic-link apprenant (route `/connexion/[token]/route.ts`).                                                                                         |
| Pricing                                          | `src/content/pricing.ts` (SSOT, `getTierById`, `formatPrice`)                                                                                                 | **RÉUTILISER** pour tout prix de cours / pack. **Zéro prix en dur.**                                                                                                                     |
| Évaluations présentiel                           | `EvaluationAcquis` (`:5653`) + `Questionnaire` (`:5704`)                                                                                                      | **NE PAS réutiliser comme moteur quiz** (ils stockent des résultats, pas de moteur interactif). Le quiz e-learning = nouveau moteur (§6.3). Lien possible pour consolider les preuves.   |

---

## 8. Conventions de code (calquer l'existant)

- **Server Action** : `"use server"` → validation **Zod** → garde (admin via `requireAdmin*` **OU** garde
  apprenant dédiée selon le côté) → clé d'idempotence → mutation Prisma (transaction si multi-tables) →
  effets de bord via queue (email/vidéo/certificat) → `logElearningActivity` (ActivityLog) → retour typé
  `{ data } | { error }`. **Jamais** d'API REST métier.
- **Prisma** : importer le client + types depuis **`prisma/generated/client`** (output custom), **jamais**
  `@prisma/client`. Réutiliser le singleton `src/lib/prisma.ts` (stub-aware).
- **Enums** : exactement ceux des docs socle (`ElearningCourseStatut`, `ElearningLessonType`,
  `ElearningUnlockType`, + quiz/progress à figer dans docs 02/03). snake_case en DB.
- **UI** : Server Components par défaut ; `"use client"` minimal et justifié (le **player vidéo** et le
  **moteur de quiz** sont les principaux îlots client — surveiller l'INP). Couleurs via tokens `@theme`
  (charte Editorial Premium Light, cf. `axionia-qualiopi/reference/03-design-charte.md`). TanStack Query
  pour les listes/dashboards admin (pagination cursor, virtualisation).
- **i18n** : FR canonique (`messages/fr.json`), EN désactivé. Routes admin/apprenant en FR. Parité
  vérifiée (`pnpm i18n:check`).
- **Tests** : Vitest (unit + intégration, Prisma mock distinct du stub build) + Playwright e2e + a11y. Un
  parcours apprenant e2e (octroi → leçon → quiz bloquant → déverrouillage → certificat) est l'oracle MVP.

---

## 9. Garde-fous (STOP & ASK — ne jamais deviner)

Interromps et demande à Will pour :

1. **Migration destructive** ou non strictement additive (toute migration LMS doit être ADD only).
2. **Modification du contrat `stub.invalid`** (ADR 0026) ou de `SKIP_ENV_VALIDATION`/`BULLMQ_DISABLED`.
3. **Régression Web Vitals** sur les 15 pages stratégiques publiques (le **catalogue public e-learning**
   et la fiche cours publique peuvent y entrer ; le **player** est client-heavy → risque INP). Tout patch
   dégradant un budget → STOP & ASK + ADR. `pnpm lhci` = autorité ; `size-limit` = garde-fou (+5 KB gz max).
4. **Toute mention légale / conformité FOAD** (certificat de réalisation, durée affichée, faisceau de
   preuves, conservation) → vérifier le texte exact ; au moindre doute, demander.
5. **Couplage auth apprenant ↔ NextAuth** : si une approche risque de mêler les deux mondes → STOP.
6. **Activation EDOF/CPF/Stripe/multi-tenant** : ce sont des **flags/V2**, jamais activés sans décision
   explicite. Ne pas construire l'espace entreprise autonome au MVP.
7. **Choix portail existant vs `(apprendre)` dédié**, **PortailAcces étendu vs token dédié**,
   **fournisseur vidéo Stream vs Bunny** : recommandations données ci-dessus, mais à **confirmer** avant
   d'écrire (impact structurant).
8. **`push main`** (= deploy prod) : jamais sans accord explicite. Travailler sur branche.

Tout le reste : décider selon le contrat + les docs socle, documenter, continuer.

---

## 10. Conformité FOAD — exigences câblées dès le data model (résumé)

Détail dans `08-CONFORMITE/*` et le skill `axionia-foad-conformite`. Le cœur LMS **doit produire** :

- **D.6313-3-1 §1** : assistance technique ET pédagogique accessible (tutorat, délais formalisés) →
  Qualiopi **Ind.19**. Câbler au minimum un canal d'assistance + traces (V1 : tuteur RAG).
- **D.6313-3-1 §2** : information sur les activités + **durée moyenne** → `dureeEstimeeMinutes` agrégée +
  affichage parcours.
- **D.6313-3-1 §3** : évaluations qui **jalonnent ET concluent** → quiz de module + quiz final →
  Qualiopi **Ind.11** (**non-conformité MAJEURE si absente** : un parcours sans évaluation jalonnante est
  non conforme).
- **R.6313-3** (preuve libre) : **faisceau de preuves** — évaluations + travaux rendus (`devoir`) + **logs
  LMS** (heartbeat, `LessonProgress`, `lastAccessedAt`) + traces d'accompagnement. Le relevé de connexion
  **seul** est insuffisant : `evidence-service.ts` agrège l'ensemble et l'exporte.
- **Certificat de réalisation** (modèle officiel, heures réalisées, depuis 01/06/2020) → réutiliser
  `DocumentGenere` + QR ; **obligatoire**.
- **Conservation** : 10 ans comptable, 6 ans fiscal/OPCO, 3-5 ans preuves de réalisation, 6 mois-1 an logs
  techniques (CNIL). Poser les `suppression_prevue_at` / purges en conséquence (additif).
- **CPF** : éligible **seulement** si certification RNCP/RS → e-learning non certifiant **non éligible
  CPF** ; intégration EDOF gated `EDOF_ENABLED=false` (entrée effective = 1re connexion substantielle,
  service fait, FranceConnect+).

---

## 11. Boucle de fonctionnement (autopilot)

```
Phase 0  Grounding : lire docs socle LMS + code réel (schema.prisma, r2-storage, portail-service,
         admin-nav, queues.ts, env.ts) → RAPPORT D'EXPLORATION (aucun code). Confirmer chaque chemin.
Phase 1  Plan : tranches verticales ordonnées par dépendance (cf. roadmap MVP) :
         data model → auth apprenant → octroi/import → vidéo → player+progression → quiz+gating
         → certificat → outil auteur minimal → conformité FOAD transversale → section admin.
Phase 2..N Par tranche : schéma Prisma (additif) → service domaine → Server Action → UI → doc/PDF/email
         → test → GATE (pnpm verify:all : typecheck, lint, i18n:check, anti-siren, anti-hex, use-client,
         contrast, radius, elearning:isolation-check, vitest ; + lhci + size-limit si frontend public)
         → CROISEMENT (docs socle ✕ code réel ✕ conformité FOAD ✕ charte) → RÉCONCILIATION → commit branche.
Final    Récapitulatif + parcours apprenant e2e vert + preuves FOAD générables + 0 régression.
```

---

## 12. Démarrage rapide

1. Lire `00-INDEX/README.md` + `00-INDEX/DECISIONS-ARBITRAGES.md` + `03-DATA-MODEL/01..04` +
   `11-ROADMAP/01-phasage-mvp-v1-v2.md`.
2. Relire le contrat de codebase commun (`axionia-qualiopi/reference/01-codebase-contract.md`).
3. Phase 0 : Grep/Glob/Read le code réel (`schema.prisma` autour des lignes citées, `r2-storage.ts`,
   `portail-service.ts`, `admin-nav.ts`, `queues.ts`, `env.ts`) → RAPPORT D'EXPLORATION.
4. Dérouler les tranches MVP avec gate + croisement + réconciliation à chacune, sur branche, sans push
   `main`.

---

## Liens

- `axionia/_LMS-ELEARNING/00-INDEX/README.md` — index maître + structure du dossier.
- `axionia/_LMS-ELEARNING/00-INDEX/DECISIONS-ARBITRAGES.md` — les 8 ADR figés.
- `axionia/_LMS-ELEARNING/03-DATA-MODEL/01-schema-cours-modules-lecons.md` — cœur Prisma (figé).
- `axionia/_LMS-ELEARNING/03-DATA-MODEL/02-schema-progression-tracking.md` — progression/heartbeat/xAPI.
- `axionia/_LMS-ELEARNING/03-DATA-MODEL/03-schema-quiz-evaluations.md` — moteur de quiz + gating.
- `axionia/_LMS-ELEARNING/03-DATA-MODEL/04-schema-comptes-acces-auth.md` — auth apprenant + octroi + import.
- `axionia/_LMS-ELEARNING/03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder` (gated).
- `axionia/_LMS-ELEARNING/03-DATA-MODEL/06-strategie-migrations.md` — stratégie migrations additives.
- `axionia/_LMS-ELEARNING/11-ROADMAP/01-phasage-mvp-v1-v2.md` — phasage + dépendances critiques.
- `axionia/_LMS-ELEARNING/08-CONFORMITE/01-foad-d6313-3-1.md` (+ 02/03/05/06) — conformité FOAD.
- `axionia/_LMS-ELEARNING/10-SKILLS/skill-axionia-lms-authoring.md` — outil auteur / course builder.
- `axionia/_LMS-ELEARNING/10-SKILLS/skill-axionia-foad-conformite.md` — oracle de conformité FOAD/EDOF.
- `axionia/.claude/skills/axionia-qualiopi/reference/01-codebase-contract.md` — contrat de codebase commun.
- `axionia/.claude/skills/axionia-qualiopi/reference/03-design-charte.md` — charte/tokens (UI, PDF, email).
