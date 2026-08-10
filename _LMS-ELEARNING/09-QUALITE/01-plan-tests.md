# Plan de tests — LMS e-learning Axion-IA

> Stratégie de test **de bout en bout** du LMS propriétaire : unitaires (services, scoring quiz, règles de gating), intégration (Server Actions, workers BullMQ, vraie DB), E2E (parcours apprenant, octroi d'accès, quiz bloquant, certificat), conformité (preuves FOAD générées), accès/sécurité (cloisonnement domaine + RBAC + auth apprenant séparée).
>
> Source de vérité : data model `03-DATA-MODEL/*`, ADR `00-INDEX/DECISIONS-ARBITRAGES.md`, roadmap `11-ROADMAP/01-phasage-mvp-v1-v2.md`.
> Dernière mise à jour : 2026-06-27.

---

## 0. Outillage réel du repo (à réutiliser, NE PAS réinventer)

| Couche                           | Outil / fichier réel                                                                                              | Config                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Unitaire / composant**         | **Vitest 2.1.9** + `@vitest/coverage-v8` + jsdom + Testing Library                                                | `vitest.config.ts` (`pool: "forks"`, `fileParallelism: false`, setup `vitest.setup.ts`)  |
| **Intégration (vraie DB/Redis)** | Vitest, **config dédiée** `vitest.integration.config.ts` (`environment: "node"`, timeout 60 s, `coverage: false`) | `pnpm test:integration` ; setup `vitest.integration.setup.ts` charge `.env`/`.env.local` |
| **E2E**                          | **Playwright 1.59** (chromium, webkit, firefox, mobile-chrome Pixel 7, mobile-safari iPhone 14 Pro)               | `playwright.config.ts`, `tests/e2e/**` ; `pnpm test:e2e`                                 |
| **Accessibilité**                | `@axe-core/playwright` (jest-axe incompatible Vitest — cf. `vitest.setup.ts`)                                     | tests `@a11y` ; `pnpm a11y:audit`                                                        |
| **Perf**                         | Lighthouse CI                                                                                                     | `pnpm lhci`                                                                              |
| **Cloisonnement**                | scripts `*:isolation-check` (modèle `image-bank:isolation-check`, `qualiopi:isolation-check`)                     | à ajouter `elearning:isolation-check` (cf. §7.1)                                         |

**Conventions de mock (observées dans `src/features/booking/admin-actions.test.ts`)** :

- Auth admin : `vi.mock("@/auth", () => ({ auth: vi.fn() }))`.
- Prisma : `vi.mock("@/lib/prisma", () => ({ prisma: { <model>: { findUnique: vi.fn(), ... }, $transaction: vi.fn() } }))`. **Pas** de `vitest-mock-extended` (absent du repo) → mocks manuels par modèle, ou helper partagé à créer (cf. §1.0).
- `beforeEach(() => vi.clearAllMocks())`.
- Les **tests unitaires Server Actions valident d'abord Zod + RBAC** ; la logique DB complète est couverte en intégration (vraie DB).
- ⚠️ Build stub : les tests Vitest tournent avec un **PrismaClient mocké** (jamais affectés par le Proxy `stub.invalid`). L'intégration exige une vraie `DATABASE_URL` (pas `stub.invalid`).

### Emplacements des tests LMS (cloisonnement ADR-LMS-0007)

```
src/server/elearning/**/<service>.test.ts          # unitaires services (purs, sans DB)
src/server/elearning/**/<action>.test.ts           # unitaires Server Actions (Zod + RBAC)
src/server/queue/workers/__tests__/elearning-*.test.ts   # unitaires workers (logique mockée)
src/components/elearning/**/*.test.tsx              # unitaires composants apprenant
src/components/admin/elearning/**/*.test.tsx        # unitaires composants outil auteur
tests/integration/elearning/**/*.test.ts           # intégration vraie DB/Redis
tests/e2e/elearning/**/*.spec.ts                    # E2E parcours
tests/e2e/elearning/a11y-*.spec.ts                  # a11y WCAG 2.2 AA (@a11y)
prisma/seeds/elearning/**/*.spec.ts                 # fixtures pures (cours démo)
```

---

## 0.1 Cibles de couverture

Le repo applique un **ratchet** global bas (`vitest.config.ts` : statements 24, functions 31, lines 24, branches 25) — volontairement sous le niveau observé pour bloquer les régressions sans réécrire l'historique. **Le LMS doit faire monter le niveau, pas le diluer.** Cibles **par domaine** `src/server/elearning/**` (mesurées via `--coverage` filtré) :

| Zone                                       | Cible lignes | Cible branches | Justification                                                  |
| ------------------------------------------ | ------------ | -------------- | -------------------------------------------------------------- |
| **Scoring quiz** (`scoring/*`)             | **100 %**    | **100 %**      | Cœur métier critique, 12 types, pure → testable exhaustivement |
| **Règles de gating / unlock** (`gating/*`) | **100 %**    | **≥ 95 %**     | 5 `ElearningUnlockType` × états ; bloque la progression        |
| **Services progression / complétion**      | ≥ 90 %       | ≥ 85 %         | Reprise auto, agrégation, certificat trigger                   |
| **Auth apprenant** (`auth/*`)              | ≥ 95 %       | ≥ 90 %         | Sécurité (magic-link + argon2id), surface d'attaque            |
| **Server Actions** (Zod + RBAC)            | ≥ 90 %       | ≥ 80 %         | Validation entrée + garde d'accès                              |
| **Workers** (handler)                      | ≥ 80 %       | ≥ 70 %         | Branches d'erreur via `captureWorkerError`                     |
| **Conformité / preuves**                   | ≥ 95 %       | ≥ 90 %         | Non-conformité majeure Qualiopi Ind.11 si KO                   |

Objectif d'agrégat : remonter le ratchet global vers **40 %** une fois le LMS livré (palier intermédiaire avant la cible historique 60 %).

---

## 1. Tests unitaires

### 1.0 Helper de test partagé à créer (NEUF)

`src/server/elearning/__test-utils__/prisma-mock.ts` — factory qui assemble un mock Prisma typé pour tous les modèles LMS (`elearningCourse`, `elearningModule`, `elearningLesson`, `elearningEnrollment`, `lessonProgress`, `quiz`, `question`, `quizAttempt`, `elearningAccessGrant`, …) + `$transaction` (par défaut `impl(cb => cb(mockTx))`). Évite la duplication des `vi.mock` model-par-model dans 40+ fichiers.

`src/server/elearning/__test-utils__/factories.ts` — builders de fixtures purs (pas de DB) : `makeCourse()`, `makeModuleWithLessons()`, `makeQuiz(type)`, `makeAttempt()`, `makeEnrollment()`, `makeTrainee()`. Sortie alignée **exactement** sur les noms de champs Prisma du data model.

### 1.1 Scoring de quiz — `src/server/elearning/scoring/*` (NEUF, criticité MAX)

Fonction centrale visée : `scoreAttempt(quiz, questions, answers): { scorePct, parQuestion[], reussi, requiresManualGrading }`.

**Par type de question (les ~12 types de `03-schema-quiz-evaluations.md`)** — un fichier `scoring-<type>.test.ts` chacun :

| Type                              | Cas à couvrir                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QCM mono (`qcm_unique`)           | bonne unique ; mauvaise ; aucune réponse → 0 ; option inexistante ignorée                                                                                         |
| QCM multi (`qcm_multiple`)        | toutes correctes → plein ; **partiel** selon barème (tout-ou-rien vs proportionnel — tester les **deux** modes config) ; sur-sélection pénalisée ; sous-sélection |
| Vrai/Faux                         | vrai ; faux ; non répondu                                                                                                                                         |
| Appariement (`appariement`)       | toutes paires justes ; k/n paires justes (proportionnel) ; paire dupliquée ; cardinalités inégales                                                                |
| Texte à trous (`texte_a_trous`)   | match exact ; **insensible casse/accents/espaces** (normalisation) ; réponses alternatives acceptées ; un trou faux sur N                                         |
| Ordonnancement (`ordonnancement`) | ordre exact ; ordre inversé → 0 ; barème par position vs séquence exacte                                                                                          |
| Réponse courte (`reponse_courte`) | regex/liste d'acceptés ; normalisation ; vide                                                                                                                     |
| Essai (`essai`)                   | **jamais auto-noté** → `requiresManualGrading = true`, exclu du scorePct auto, statut `en_attente_correction`                                                     |
| Upload (`upload`)                 | présence fichier → soumis ; manuel ; n'auto-valide jamais le quiz                                                                                                 |

**Agrégation & pondération (`scoring-aggregate.test.ts`)** :

- `scorePct` = Σ(points obtenus) / Σ(points max) × 100, **arrondi déterministe** (définir : floor/round à 2 décimales — tester la règle figée).
- Pondération par question (`points`/`ponderation`) respectée ; question à 0 point n'altère pas le total.
- Quiz **mixte** auto + manuel : `scorePct` provisoire (auto seul) + flag `requiresManualGrading` ; après correction manuelle, recalcul total.
- Seuil de réussite (`quiz.seuilReussitePct`) → `reussi: boolean`. Bornes : score == seuil → **réussi** (≥, à figer et tester) ; seuil 0 ; seuil 100.
- Cas dégénérés : 0 question → erreur explicite (pas NaN) ; réponses pour question inexistante ignorées ; réponse nulle/undefined → 0 sans throw.

**Tirage / mélange (`scoring-selection.test.ts`)** — déterminisme via **seed injectable** (ne jamais tester `Math.random` direct) :

- Tirage **N parmi M** : exactement N questions, sans doublon, sous-ensemble de M.
- Shuffle questions ET réponses : permutation valide (même multiset), seed reproductible.
- Le scoring reste correct **après** shuffle (mapping réponse→option par id, pas par position) — test anti-régression clé.
- Feedback configurable : `feedbackMode` (immédiat / à la fin / jamais) renvoie/masque rationale au bon moment.

### 1.2 Règles de gating / déverrouillage — `src/server/elearning/gating/*` (NEUF, criticité MAX)

Fonction centrale : `computeUnlockState(node, enrollment, progress, attempts, now): { unlocked: boolean, reason: UnlockReason }`. La `reason` est **affichée à l'apprenant** (best practice : verrou + sa raison) → testée comme contrat.

Matrice par `ElearningUnlockType` (enum réel) :

| `unlockType`         | Cas verrouillé                                             | Cas déverrouillé                       | Bords                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `immediat`           | —                                                          | toujours ouvert                        | —                                                                                                                                                                         |
| `apres_precedent`    | précédent non complété                                     | précédent complété                     | premier élément (pas de précédent) → ouvert ; précédent `obligatoire=false` ignoré                                                                                        |
| `date_fixe`          | `now < unlockDate`                                         | `now >= unlockDate`                    | fuseau **serveur** (UTC) ; `unlockDate` null → fallback défini                                                                                                            |
| `offset_inscription` | `now < grantedAt + unlockOffsetJours`                      | après                                  | offset 0 = immédiat ; basé sur **octroi d'accès** (`ElearningEnrollment.grantedAt`/`accessGrantedAt`), pas la date du cours                                               |
| `score_quiz`         | quiz `unlockQuizId` non réussi OU score < `unlockScorePct` | meilleure tentative ≥ `unlockScorePct` | **gating par NOTE réelle, pas attempt-only** (anti-pattern à prévenir) ; aucune tentative → verrou ; quiz manuel non corrigé → verrou avec reason `en_attente_correction` |

**Cas transverses critiques** :

- **Override admin** : `ElearningAccessGrant`/flag `forceUnlock` → déverrouille en ignorant la règle ; la `reason` indique `override_admin` (traçabilité).
- Le **temps est serveur** (`now` injecté, jamais `new Date()` interne non mockable) → tests déterministes avec `vi.setSystemTime`.
- Chaînage : module verrouillé ⇒ toutes ses leçons verrouillées même si leçon `immediat` (la règle module domine — figer et tester).
- Cohérence `score_quiz` ↔ scoring : réutilise la meilleure tentative (`best of attempts`), pas la dernière (à figer).
- Anti-régression : gating ne doit **jamais** crasher sur données partielles (enrollment sans progress) → état `locked` sûr par défaut.

### 1.3 Services de progression — `src/server/elearning/progress/*` (NEUF)

- `recordLessonProgress(enrollmentId, lessonId, { positionSec, completed })` : upsert `LessonProgress` ; `watchedSec` **monotone** (ne régresse pas si l'apprenant revient en arrière) ; completion vidéo au seuil (ex. ≥ 90 % `videoDureeSec`) — tester le seuil exact.
- **Reprise auto** : `getResumePoint(enrollmentId)` retourne dernière position persistée serveur (best practice MUST-HAVE).
- Agrégation complétion cours : % = leçons obligatoires complétées / total obligatoires ; leçons `obligatoire=false` exclues ; module 100 % ⇒ complétion module.
- Déclenchement certificat : completion globale ≥ `ElearningCourse.seuilReussitePct` **ET** tous quiz bloquants réussis ⇒ enqueue génération certificat (mock queue, assert payload).
- Idempotence : double `recordLessonProgress` même payload → un seul état, pas de double comptage.

### 1.4 Auth apprenant — `src/server/elearning/auth/*` (NEUF, ADR-LMS-0001)

> Système **séparé de NextAuth** (qui ne gère que `AdminUser`). Réutilise/étend `PortailAcces` (token 64 hex, cookie HttpOnly 90 j) + ajoute `passwordHash` **optionnel** (argon2id, dep `argon2 ^0.44.0` présente).

- **Magic-link** : génération token (entropie ≥ 256 bits, hex), hashé en base (jamais en clair) ; `verifierToken` (réutilise `portail-service.ts:verifierToken`) — valide / expiré / révoqué / inexistant → `null`.
- **Mot de passe (optionnel)** : `setPassword` → `argon2.hash` (id, paramètres mémoire/itérations figés) ; `verifyPassword` true/false ; hash jamais loggé/retourné ; **timing-safe** via argon2.verify.
- `Trainee` n'a **pas** de `passwordHash` aujourd'hui → migration additive nullable (ADR-0008) ; test : compte sans password → seul magic-link possible.
- Séparation des mondes : un cookie apprenant ne donne **aucun** accès admin (cf. §5.1) ; les guards `requireAdmin*` ne valident pas un token apprenant.
- Rate-limit tentatives login password (lockout/backoff) — test compteur.

### 1.5 Composants apprenant — `src/components/elearning/**` (NEUF)

- **Player** : émet heartbeat throttlé (pas à chaque frame) ; reprend à `resumePoint` ; vitesse + sous-titres rendus ; pas d'`autoplay` (anti-pattern). Test INP-safe : handlers ne bloquent pas (pas de calcul lourd synchrone — risque INP identifié).
- **Quiz UI** : rend chaque type ; cible interactive ≥ 24 px (WCAG 2.5.8) ; **alternative au drag** pour appariement/ordonnancement (WCAG 2.5.7) — test présence contrôle clavier/boutons.
- **Barre de progression** + **verrou avec raison** affichée (le composant lit `reason` de §1.2).

### 1.6 Outil auteur — `src/components/admin/elearning/**` (NEUF)

- Réordonnancement drag&drop → réécrit `ordre` (0-based) en respectant `@@unique([courseId, ordre])` / `@@unique([moduleId, ordre])` : pas de collision (réécriture séquentielle complète).
- Validation publication : `brouillon → publie` exige ≥ 1 module, ≥ 1 leçon, quiz bloquant valide ; incrémente `version` + `publishedAt` (cf. data model §8).
- Aperçu « as-student » : rend l'état de gating sans muter la progression réelle.

---

## 2. Tests d'intégration (`tests/integration/elearning/**`, vraie DB/Redis)

> Config `vitest.integration.config.ts` (`environment: node`, vraie `DATABASE_URL`/`REDIS_URL` via `.env.local`). Pattern existant : `tests/integration/chatbot/**`. Chaque test crée ses fixtures et nettoie (transaction rollback ou cleanup `afterEach`).

### 2.1 Server Actions octroi d'accès — `src/server/elearning/access/*.ts`

- `grantAccessAction({ traineeId, courseId })` (manuel admin) : crée `ElearningEnrollment` (+ `ElearningAccessGrant` si modèle distinct), envoie email d'invitation (mock email-worker / assert job enqueué), idempotent (re-grant → pas de doublon, `@@unique`).
- **Octroi automatique** : session réalisée (`TrainingSession`/`Enrollment` existants) → e-learning ouvert. Test du pont : `Enrollment` présentiel → `ElearningEnrollment` créé.
- **Import CSV en masse** (`importLearnersCsvAction`) : N lignes valides → N enrollments ; lignes invalides (email malformé, `Trainee` introuvable) → rapport d'erreurs ligne-par-ligne, **transaction partielle maîtrisée** (les valides passent, le rapport liste les KO) ; doublons dédupliqués ; 1 000 lignes → perf acceptable.
- RBAC : action refusée si pas `requireAdminWrite` (rôles `super_admin`/`admin`/`editor`).

### 2.2 Server Actions quiz & progression

- Soumission tentative → persiste `QuizAttempt` avec `scorePct` calculé serveur (jamais client) ; nombre de tentatives ≤ `quiz.maxTentatives` (refus au-delà) ; temps serveur enregistré (`startedAt`/`submittedAt`) anti-triche.
- Lecture de cours filtre les leçons verrouillées : un apprenant **ne peut pas** charger le contenu d'une leçon verrouillée même par appel direct de l'action (gating appliqué côté serveur, pas seulement UI).

### 2.3 Workers BullMQ — `src/server/queue/workers/elearning-*-worker.ts`

> Pattern : enregistrement dans `src/server/queue/queues.ts` + `worker.ts` ; chaque worker wrappe ses erreurs via `captureWorkerError` (présent dans tous les workers existants) → tester le chemin d'erreur.

| Worker (NEUF)                        | Test d'intégration                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `elearning-video-ingest-worker`      | upload → enregistre `videoAssetId` (Cloudflare Stream/Bunny mocké), met à jour `videoDureeSec` ; échec transcodage → retry + `captureWorkerError`, statut `failed` propre                   |
| `elearning-certificate-worker`       | completion ⇒ génère certificat (réutilise `DocumentGenere` + `qrToken`), heures réalisées en **centièmes** (cohérent certificat Qualiopi existant), idempotent (un seul doc par enrollment) |
| `elearning-reminders-worker` (V1)    | relance anti-décrochage J+N sans connexion (Qualiopi Ind.12) ; pas de spam (1 relance / fenêtre)                                                                                            |
| `elearning-quiz-gen-worker` (IA, V1) | génère quiz depuis contenu (réutilise pipeline IA `qualiopi-formation-engine-worker`) ; sortie validée par schéma Zod, jamais publiée auto sans review                                      |

- ⚠️ `BULLMQ_DISABLED=true` et `stub.invalid` au build → les workers ne doivent **pas** s'initialiser au SSG. Test : import du module worker sans connexion Redis ne throw pas (lazy).
- ⚠️ `vitest.config.ts` désactive `fileParallelism` à cause de pollution d'état partagé des workers — respecter ce pattern pour les nouveaux worker tests (isolement).

---

## 3. Tests E2E (`tests/e2e/elearning/**`, Playwright)

> Pattern : `tests/e2e/flows/*.spec.ts` + fixtures `tests/e2e/fixtures/admin-auth.ts`. Ajouter `tests/e2e/fixtures/learner-auth.ts` (login apprenant magic-link + password). Projets multi-navigateurs (dont **mobile-chrome/mobile-safari** — mobile-first MUST-HAVE).

### 3.1 Parcours apprenant complet (`parcours-apprenant.spec.ts`) — scénario critique #1

1. Admin octroie l'accès (ou import CSV) → apprenant reçoit le lien.
2. Apprenant se connecte (magic-link).
3. Dashboard : cours visible, module 1 ouvert, modules suivants **verrouillés avec raison affichée**.
4. Lit leçon vidéo → progression persistée → **quitte et revient → reprise auto** à la bonne position (assert MUST-HAVE).
5. Complète le module 1 → module 2 toujours verrouillé (quiz bloquant pas encore réussi).

### 3.2 Quiz bloquant (`quiz-gating.spec.ts`) — scénario critique #2

- Tentative **échouée** (score < seuil) → module suivant **reste verrouillé**, raison « score insuffisant » affichée, tentative restante décrémentée.
- Tentative **réussie** (score ≥ seuil) → module suivant **se déverrouille** immédiatement.
- Quiz à essai/upload (manuel) → statut « en attente de correction », ne déverrouille pas tant que l'admin n'a pas corrigé ; après correction admin → déverrouillage.
- Shuffle : recharger le quiz mélange l'ordre, le scoring reste juste (mapping par id).

### 3.3 Octroi d'accès admin (`octroi-acces.spec.ts`) — scénario critique #3

- Octroi manuel 1 apprenant + octroi en masse via CSV (fichier fixture) → liste apprenants à jour, statuts corrects, rapport d'erreurs pour lignes KO.
- Révocation d'accès → apprenant ne peut plus charger le cours (403/redirect).

### 3.4 Certificat (`certificat.spec.ts`) — scénario critique #4

- Parcours 100 % + quiz réussi → certificat de réalisation généré (modèle officiel, heures réalisées), téléchargeable, **QR vérifiable** (`qrToken` → page de vérification publique 200).
- Parcours incomplet → **pas** de certificat (assert absence).

### 3.5 Accessibilité WCAG 2.2 AA (`a11y-*.spec.ts`, tag `@a11y`)

> Obligation légale UE (EAA, 28/06/2025). `@axe-core/playwright`, `pnpm a11y:audit`.

- Player, quiz, dashboard : 0 violation axe niveau AA.
- Navigation **100 % clavier** (focus visible, ordre logique) ; quiz drag (appariement/ordonnancement) a une **alternative non-drag** (2.5.7) ; cibles ≥ 24 px (2.5.8) ; auth accessible (3.3.8, pas de CAPTCHA cognitif bloquant) ; sous-titres vidéo présents.
- Tests sur projets **mobile** (Pixel 7 / iPhone 14 Pro).

### 3.6 Perf (Lighthouse CI, `pnpm lhci`)

- Pages publiques catalogue cours (V1) : budgets stricts AGENTS.md (LCP ≤ 1800, INP ≤ 100, CLS = 0, First Load ≤ 75 KB gz).
- Pages apprenant derrière auth (`force-dynamic`) : budget INP surveillé sur **player + quiz** (risque INP identifié) ; tout dépassement = STOP & ASK + ADR.

---

## 4. Tests de conformité (preuves FOAD générées) — `tests/integration/elearning/conformite/**`

> Non négociable (`08-CONFORMITE/*`). Art. **D.6313-3-1** (3 conditions cumulatives), **R.6313-3** (faisceau de preuves), Qualiopi V8 Ind.**11 (majeur)**, 12, 19. Ces tests **prouvent que les artefacts existent et sont exportables** — pas seulement que le code tourne.

| Exigence                                                                             | Test (assertion sur l'artefact produit)                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ind.11 (évaluations qui jalonnent/concluent)** — non-conformité MAJEURE si absente | un parcours FOAD complété produit ≥ 1 résultat d'évaluation persistant (`QuizAttempt` + `EvaluationAcquis` existant) ; export les liste                                                                                                                                                    |
| **D.6313-3-1 §2 (info activités + durée moyenne)**                                   | `ElearningCourse.dureeEstimeeMinutes` agrégé exposé sur la fiche + dans le certificat (heures)                                                                                                                                                                                             |
| **D.6313-3-1 §1 + Ind.19 (assistance technique ET pédagogique, délais formalisés)**  | trace d'assistance enregistrée (tuteur/contact), SLA documenté ; test : un message d'aide crée une trace horodatée                                                                                                                                                                         |
| **R.6313-3 (faisceau de preuves, émargement NON obligatoire)**                       | export « dossier de preuves » d'un enrollment = logs connexion LMS **+** progression **+** résultats évaluations **+** travaux rendus (`devoir`/upload) **+** traces accompagnement. Test : relevé de connexion **seul** est marqué insuffisant (le faisceau doit contenir ≥ 2 catégories) |
| **Certificat de réalisation (modèle officiel, depuis 01/06/2020)**                   | heures **réalisées** (centièmes), identité, dates ; non émis si parcours incomplet                                                                                                                                                                                                         |
| **EDOF (gated `EDOF_ENABLED=false`)**                                                | par défaut **désactivé** : aucun appel EDOF, aucune dépendance FranceConnect+ requise ; test que le flag off n'altère pas le parcours OPCO/direct                                                                                                                                          |
| **CPF bloqué sans RNCP/RS**                                                          | tant que pas de certification, le cours n'est **jamais** marqué éligible CPF (test invariant : `eligibleCpf` impossible à `true` sans `certificationRncpId`)                                                                                                                               |
| **Conservation**                                                                     | métadonnées de rétention posées (10 ans comptable / 6 ans fiscal-OPCO / 3-5 ans preuves / 6 mois-1 an logs techniques) ; purge logs techniques ne supprime pas les preuves de réalisation                                                                                                  |

**Export conformité** (`exportProofBundle(enrollmentId)`) : test que le bundle est complet, horodaté, et exportable (PDF/zip) pour un contrôle OPCO/France Travail.

---

## 5. Tests d'accès / sécurité

### 5.1 Cloisonnement des mondes auth (criticité MAX)

- Cookie/session **apprenant** ne donne **aucun** accès aux routes admin `/[locale]/(admin)/[adminPrefix]/**` → 403/redirect (test E2E + intégration).
- Inversement, un `AdminUser` n'usurpe pas un compte apprenant sans grant explicite.
- Token magic-link : expiré / révoqué / falsifié → refus ; non rejouable au-delà de la validité ; cookie `HttpOnly` + `Secure` + `SameSite`.
- `passwordHash` : jamais sérialisé dans une réponse, un log, ou un payload de Server Action.

### 5.2 RBAC console admin (réutilise `_guards.ts`)

- Chaque Server Action admin e-learning appelle le bon garde : lecture `requireAdminRead`, écriture `requireAdminWrite`, publication `requireAdminPublish`, suppression `requireAdminDelete` (rôles `super_admin`/`admin`/`editor`/`reader`).
- Un `reader` ne peut pas octroyer d'accès ni publier un cours.

### 5.3 Autorisation côté données (IDOR / cloisonnement tenant)

- Un apprenant ne peut lire/soumettre que **ses** enrollments/attempts (filtre serveur par `traineeId` de la session, jamais par paramètre client).
- **Multi-tenant (préparé V2, ADR-0002)** : `ElearningCourse.ownerClientId` non-null ⇒ cours réservé ; test qu'un apprenant hors client ne voit pas un cours `ownerClient`. Dès le MVP : invariant testé même si l'espace entreprise autonome est V2 (anti-dette).
- Gating appliqué **côté serveur** : impossible de charger une leçon/quiz verrouillé par appel direct (cf. §2.2).

### 5.4 Vidéo / médias

- URLs Cloudflare Stream **signées** + expirantes ; sans grant valide → 403 ; watermark par utilisateur présent.
- `ElearningResource` : `getSignedUrlR2` (réutilise `r2-storage.ts`) seulement si `telechargeable=true` ou droit d'accès ; URL signée expire.
- Upload : `getSignedUploadUrlR2` borné en type MIME + taille (`sizeBytes`), pas d'upload arbitraire.

### 5.5 Anti-triche léger (proportionné CNIL)

- Randomisation (shuffle + tirage N/M) effective ; temps **serveur** fait foi ; pas de proctoring imposé (optionnel/high-stakes seulement). Test : score recalculé serveur ignore tout score envoyé par le client.

### 5.6 Cloisonnement de code (`elearning:isolation-check`)

- Script (modèle `image-bank:isolation-check`/`qualiopi:isolation-check`) qui **échoue** si du code hors `src/server/elearning/**` etc. importe les internals LMS, ou si le LMS importe en dur des internals d'autres domaines (réutilisation via API publique des libs `r2-storage`, `prisma`, `auth`, `DocumentGenere` uniquement). À ajouter à `verify:all`.

---

## 6. Matrice de traçabilité (exigence → test)

| Exigence MVP (roadmap)                                 | Tests couvrants                       |
| ------------------------------------------------------ | ------------------------------------- |
| Modules déverrouillables (drip 3 déclencheurs + score) | §1.2, §3.1, §3.2                      |
| Quiz bloquants par **note réelle** (pas attempt-only)  | §1.1, §1.2 (`score_quiz`), §2.2, §3.2 |
| Reprise auto persistée serveur                         | §1.3, §3.1                            |
| Octroi accès auto + manuel + import CSV                | §2.1, §3.3                            |
| Auth apprenant hybride (séparée NextAuth)              | §1.4, §5.1                            |
| Certificat de réalisation (heures, QR)                 | §2.3, §3.4, §4                        |
| Conformité FOAD (Ind.11/19, faisceau de preuves)       | §4                                    |
| Vidéo HLS signée + watermark                           | §2.3, §5.4                            |
| Cloisonnement domaine + RBAC + IDOR                    | §5                                    |
| WCAG 2.2 AA + mobile                                   | §1.5, §3.5                            |
| Web Vitals (INP player/quiz)                           | §3.6                                  |
| Flags off (Stripe / EDOF / CPF) inertes                | §4, et invariants §1                  |

---

## 7. Intégration CI / commandes

```bash
pnpm test                    # unitaires Vitest (inclut src/server/elearning/**)
pnpm test:coverage           # + couverture (vérifier cibles §0.1 par domaine)
pnpm test:integration        # vraie DB/Redis (tests/integration/elearning/**)
pnpm test:e2e                # Playwright (tests/e2e/elearning/**)
pnpm a11y:audit              # @axe-core (@a11y)
pnpm lhci                    # budgets Web Vitals
pnpm elearning:isolation-check   # NEUF — cloisonnement (à ajouter à verify:all)
```

- **Gate A (PR)** : unitaires + couverture + isolation-check + typecheck/lint. Scoring & gating à **100 %** sont bloquants.
- **Gate B (build préalable + E2E)** : parcours critiques #1-#4 + a11y + security-headers.
- **Gate post-deploy** : lhci sur catalogue public (V1).
- Ratchet : la couverture LMS ne doit **jamais** régresser ; viser remontée du global vers 40 %.

### 7.1 Ordre d'écriture des tests (suivre le chemin critique roadmap)

1. **scoring** (§1.1) + **gating** (§1.2) — purs, 100 %, écrits **avant** le code (TDD recommandé : règles métier figées).
2. progression (§1.3) + auth apprenant (§1.4).
3. Server Actions octroi/quiz (§2.1, §2.2) + workers (§2.3).
4. E2E #1-#4 (§3) + conformité (§4).
5. sécurité/cloisonnement (§5) + a11y/perf (§3.5, §3.6).

---

## 8. Risques de test & parades

| Risque                                | Parade                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Non-déterminisme (shuffle, temps, IA) | seed injectable partout ; `vi.setSystemTime` ; sorties IA validées par schéma, pas par valeur exacte |
| Build `stub.invalid` casse des tests  | unitaires sur Prisma mocké (jamais le Proxy) ; intégration exige vraie `DATABASE_URL`                |
| Pollution état workers (BullMQ)       | `fileParallelism: false` déjà actif ; isoler chaque worker test                                      |
| Flaky E2E vidéo (Cloudflare Stream)   | mock du provider en intégration ; E2E utilise un asset fixture court                                 |
| Scoring faux après shuffle            | test anti-régression mapping par id (§1.1) — le plus important                                       |
| Gating attempt-only par erreur        | test explicite `score_quiz` exige la note (§1.2)                                                     |
| Couverture diluée                     | cibles **par domaine** (§0.1), pas seulement global                                                  |

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth), 0002 (multi-tenant), 0003 (CPF/EDOF), 0004 (Stripe), 0005 (vidéo), 0006 (xAPI), 0007 (cloisonnement), 0008 (migrations).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — modèles/enums testés (`ElearningCourse/Module/Lesson/Resource`, `ElearningUnlockType`, `ElearningLessonType`).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress` (cible §1.3).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`, `Question`, `QuizAttempt` (cible §1.1).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — auth apprenant (cible §1.4, §5.1).
- `04-BACKEND/05-authentification-apprenant.md` — magic-link + argon2id.
- `04-BACKEND/06-import-masse-provisioning.md` — import CSV (§2.1, §3.3).
- `04-BACKEND/07-pipeline-video-streaming.md` — vidéo signée (§2.3, §5.4).
- `08-CONFORMITE/01-foad-d6313-3-1.md`, `02-qualiopi-indicateurs-foad.md`, `06-tracabilite-preuves-realisation.md` — base des tests §4.
- `09-QUALITE/02-securite.md`, `03-web-vitals-performance.md`, `04-accessibilite-wcag22.md` — détail des §5, §3.6, §3.5.
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — ordre d'écriture des tests (§7.1).
