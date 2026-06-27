---
name: axionia-lms-authoring
description: >-
  Créer, générer, structurer et publier du CONTENU de cours e-learning pour le LMS
  propriétaire d'Axion-IA (organisme de formation IA, SAS française, NDA DREETS AURA,
  certifié Qualiopi). Couvre l'OUTIL AUTEUR (course-builder drag&drop : cours →
  modules → leçons → blocs/ressources), la GÉNÉRATION IA pédagogique (quiz-gen
  document-grounded, plan de cours Backward Design, réécriture, alt-text), la
  QUALITÉ PÉDAGOGIQUE (microlearning 2-10 min, objectifs mesurables Bloom, critique
  adversariale réutilisée du Formation Engine), la CHARTE ÉDITORIALE (ton, Editorial
  Premium Light, accessibilité WCAG 2.2 AA), et la gestion des MÉDIAS (upload R2
  signé + vidéo Cloudflare Stream HLS + sous-titres + transcodage). Modèles Prisma
  ElearningCourse / ElearningModule / ElearningLesson / ElearningResource (cœur LMS)
  + Quiz / Question / QuizAttempt (moteur quiz) + enums ElearningCourseStatut /
  ElearningLessonType / ElearningUnlockType. Stack RÉELLE : Next.js 16.2 App Router +
  Prisma 5.22 + Postgres + NextAuth 5 (admin) + BullMQ + @react-pdf/renderer +
  Nodemailer + @anthropic-ai/sdk + next-intl (FR canonique, EN désactivé) +
  Tailwind v4 @theme. Server Actions (pas REST), admin sous
  src/app/[locale]/(admin)/[adminPrefix]/elearning/**, code cloisonné sous
  src/server/elearning/**. Respecte le contrat de build stub.invalid (ADR 0026),
  les budgets Web Vitals, les migrations ADDITIVES, et le SSOT pricing.ts.
  Déclencheurs : « outil auteur », « course builder », « créer un cours e-learning »,
  « module / leçon e-learning », « quiz-gen IA », « générer un quiz », « banque de
  questions », « blocs de contenu / Tiptap », « upload vidéo Cloudflare Stream »,
  « sous-titres WCAG », « alt-text leçon », « plan de cours Backward Design »,
  « réécriture pédagogique », « publier / brouillon cours », « microlearning »,
  « aperçu as-student », « charte éditoriale e-learning ».
---

# Skill — Axion-IA LMS Authoring (outil auteur + IA pédagogique + médias)

> Périmètre : **créer et générer le contenu** des cours e-learning. Tout ce qui concerne
> la **consommation** côté apprenant (player, progression, déverrouillage, certificats)
> est dans `skill-axionia-lms-core`. Tout ce qui concerne la **conformité FOAD** (preuves,
> assistance, traçabilité) est dans `skill-axionia-foad-conformite`. Ce skill se concentre
> sur **l'auteur** (l'équipe Axion-IA qui remplit le LMS) et la **qualité du contenu produit**.

---

## 0. À LIRE AVANT D'ÉCRIRE UNE LIGNE

Ordre de lecture obligatoire (source de vérité, ne jamais contredire) :

1. `axionia/_LMS-ELEARNING/00-INDEX/DECISIONS-ARBITRAGES.md` — les 8 ADR figés (notamment ADR-0005 vidéo, ADR-0006 pas de SCORM, ADR-0007 cloisonnement, ADR-0008 migrations additives).
2. `axionia/_LMS-ELEARNING/03-DATA-MODEL/01-schema-cours-modules-lecons.md` — **noms exacts** des modèles/champs/enums du cœur LMS. **Ne pas réinventer un nom de modèle.**
3. `axionia/_LMS-ELEARNING/03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz` / `Question` / `QuizAttempt` (référencés par `ElearningLesson.quizId` et `ElearningModule.unlockQuizId`).
4. `axionia/_LMS-ELEARNING/11-ROADMAP/01-phasage-mvp-v1-v2.md` — ce qui est MVP (outil auteur **minimal**) vs V1 (outil auteur **abouti** + quiz-gen + banque).

Puis, le **code réel** (ancrage anti-hallucination) :

- `axionia/prisma/schema.prisma` — `Formation` (~5274), `Trainee` (~5274), `Enrollment` (~5310), `Client` (~4890), `DocumentGenere` (~5507, `qrToken` ~5530), `EvaluationAcquis` (~5653), `Questionnaire` (~5704).
- `axionia/src/lib/r2-storage.ts` — `uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`, `existsInR2`, `deleteFromR2`, `isR2Configured`.
- `axionia/src/lib/admin-nav.ts` — SSOT navigation admin (type `AdminNavGroup`, `AdminNavItem`). **Le composant sidebar monté est `AdminSidebarNav.tsx`** (pas `AdminSidebar.tsx`, obsolète).
- `axionia/src/server/queue/workers/qualiopi-formation-engine-worker.ts` — **patron à copier** pour l'IA pédagogique (machine d'états, `assertCostCapAvailable`/`trackCost`, cache IA, `withRetry`, trace `FormationGenerationJob`, `runAdversarialCritique`).
- `axionia/src/server/content-gen/providers/anthropic.ts` — provider Claude (prompt caching, pricing, `IProvider`).
- `axionia/src/server/content-gen/kb-client.ts` — client RAG/knowledge base réutilisable pour le grounding du quiz-gen.
- `axionia/src/server/qualiopi/portail/portail-service.ts` — modèle d'accès portail (token, `getEspaceStagiaire`).

---

## 1. Carte EXISTANT (réutiliser) vs NEUF (construire)

### 1.1 Réutiliser TEL QUEL (jamais dupliquer)

| Brique existante          | Fichier / modèle                                                                                                                    | Usage en authoring                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stockage objet            | `src/lib/r2-storage.ts`                                                                                                             | PDF, images, sous-titres `.vtt`, fichiers téléchargeables → `ElearningResource.r2Key` ; upload direct navigateur via `getSignedUploadUrlR2` (gros .pptx/.pdf sans transiter par Next). |
| Provider IA               | `src/server/content-gen/providers/anthropic.ts` (`anthropicProvider`)                                                               | quiz-gen, plan de cours, réécriture, alt-text. **Prompt caching** sur le system prompt (économie).                                                                                     |
| Garde-fous coût IA        | `src/server/content-gen/lib/cost-tracker.ts` (`assertCostCapAvailable`, `trackCost`) + `lib/retry.ts` (`withRetry`)                 | encadrer **chaque** appel IA.                                                                                                                                                          |
| Critique adversariale     | `src/server/qualiopi/engine/adversarial-critique.ts` (`runAdversarialCritique`) + `engine/validation-excellence.ts`                 | évaluer la qualité pédagogique d'un cours/quiz généré avant publication.                                                                                                               |
| Grille qualité + cache IA | `src/server/qualiopi/engine/grille.ts` (`getActiveGrille`), `engine/cache.ts` (`buildCacheKey`/`getCachedIa`/`setCachedIa`)         | mutualiser avec le Formation Engine.                                                                                                                                                   |
| RAG / knowledge base      | `src/server/content-gen/kb-client.ts`                                                                                               | quiz **document-grounded** + tuteur ancré (citations).                                                                                                                                 |
| Console admin             | `AdminPageShell`, `AdminHeader`, `StatCard`, `AdminTable`, `AdminBadge` (`src/components/admin/ui/**`) + `src/lib/admin-nav.ts`     | toutes les pages de l'outil auteur.                                                                                                                                                    |
| RBAC admin                | `src/server/actions/knowledge/_guards.ts` : `requireAdminRead/Write/Publish/Delete` (rôles `super_admin`/`admin`/`editor`/`reader`) | gate **toutes** les server actions d'authoring.                                                                                                                                        |
| Génération PDF            | `@react-pdf/renderer` + `DocumentGenere` (+ `qrToken`)                                                                              | export d'un cours en livret PDF / fiche programme (réutilise le moteur Qualiopi).                                                                                                      |
| Emails                    | Nodemailer + React Email + `email-worker`                                                                                           | notifier l'auteur (fin de transcodage vidéo, quiz généré prêt à relire).                                                                                                               |
| Modalité                  | enum `ModaliteFormation` (`presentiel`/`distanciel`/`hybride`) sur `Formation`                                                      | un `ElearningCourse.formationId` peut adosser un cours FOAD à une formation existante.                                                                                                 |

### 1.2 NEUF (à construire, cloisonné — ADR-0007)

- **Cœur LMS** : `ElearningCourse` / `ElearningModule` / `ElearningLesson` / `ElearningResource` (voir doc data-model 01). **Déjà spécifié** : ne PAS redéfinir, implémenter à l'identique.
- **Moteur quiz** : `Quiz` / `Question` / `QuizAttempt` (voir data-model 03). L'authoring crée/édite `Quiz` et `Question` + la **banque de questions**.
- **Outil auteur (course-builder)** : composants `src/components/admin/elearning/**`, pages `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, server actions `src/server/elearning/authoring/**`.
- **IA pédagogique d'authoring** : services `src/server/elearning/ia/**` + worker `elearning-authoring-worker.ts` (queue `elearning-authoring`).
- **Pipeline vidéo** : `src/server/elearning/video/**` (Cloudflare Stream) + worker `elearning-video-worker.ts` (queue `elearning-video`).
- **Éditeur de blocs riches** : schéma de contenu JSON (Tiptap) stocké dans `ElearningLesson.contenuJson`.

---

## 2. Arborescence de fichiers cible (authoring)

```
src/server/elearning/
  authoring/
    course-actions.ts          # CRUD cours (createCourse, updateCourse, publishCourse, archiveCourse, cloneCourse)
    module-actions.ts          # CRUD modules + reorderModules (transaction réécriture ordre)
    lesson-actions.ts          # CRUD leçons + reorderLessons + moveLessonToModule
    resource-actions.ts        # upload/lien ressources R2 (sous-titres, pdf, images)
    publish-service.ts         # validation pré-publication + incrément version + publishedAt
    content-schema.ts          # Zod schema des blocs Tiptap (contenuJson) + sanitization
    duree-service.ts           # recalcul dureeEstimeeMinutes (leçon → cours, cache)
  ia/
    quiz-gen-service.ts        # génération quiz document-grounded
    course-plan-service.ts     # plan de cours Backward Design (objectifs → modules → leçons)
    rewrite-service.ts         # réécriture pédagogique / résumé / niveau de lecture
    alt-text-service.ts        # alt-text d'image + titres de chapitres vidéo (WCAG)
    prompts.ts                 # builders system/user prompts (1 fichier, comme engine/prompts.ts)
    grounding.ts               # wrapper sur kb-client.ts (RAG) + extraction contenu cours source
  video/
    stream-client.ts           # Cloudflare Stream API (create upload URL, poll status, signed playback)
    subtitles-service.ts       # ingest/validation .vtt, langue, génération auto (option)
  authoring/_guards.ts         # re-export requireAdminWrite/Publish scoping "elearning"

src/app/[locale]/(admin)/[adminPrefix]/elearning/
  cours/
    page.tsx                   # liste des cours (AdminTable + AdminBadge statut)
    nouveau/page.tsx           # wizard création (titre, objectifs, formation liée, FOAD)
    [courseId]/
      page.tsx                 # course-builder (arbre modules/leçons + drag&drop)
      apercu/page.tsx          # aperçu "as-student" (rend le player en lecture seule)
      parametres/page.tsx      # SEO/vitrine, seuilReussitePct, vendableSeul, image couverture
  banque-questions/
    page.tsx                   # banque de questions (filtres, tags, tirage)
  medias/
    page.tsx                   # bibliothèque médias R2 + statut transcodage Stream

src/components/admin/elearning/
  CourseBuilderTree.tsx        # arbre drag&drop (dnd-kit) modules → leçons
  LessonEditor.tsx             # éditeur de leçon (switch par ElearningLessonType)
  BlockEditor.tsx              # éditeur de blocs riches (Tiptap) → contenuJson
  QuizBuilder.tsx              # construction quiz + questions + types
  QuestionBankPicker.tsx       # sélection depuis la banque + tirage N parmi M
  MediaUploader.tsx            # upload R2 signé / Stream + progress
  VideoChapterEditor.tsx       # chapitres + sous-titres
  AiQuizGenButton.tsx          # déclenche quiz-gen, ouvre le diff de relecture
  AsStudentPreview.tsx         # wrapper aperçu apprenant
  PublishChecklist.tsx         # checklist conformité avant publication

src/server/queue/workers/
  elearning-authoring-worker.ts # quiz-gen / plan de cours (longs appels IA, async)
  elearning-video-worker.ts     # poll transcodage Stream → maj ElearningLesson.videoAssetId/videoDureeSec
```

> **Pourquoi des workers** : un quiz-gen sur un cours entier ou un plan Backward Design = appels Claude multi-étapes (10-60s). Comme le `qualiopi-formation-engine-worker`, on **n'exécute jamais ça dans une server action synchrone** (timeout + UX). La server action `enqueue` + l'admin poll l'état (trace `ElearningAuthoringJob`, calqué sur `FormationGenerationJob`).

---

## 3. Outil auteur (course-builder) — spécification

### 3.1 Modèle mental

```
ElearningCourse (statut: brouillon → publie → archive ; version, publishedAt)
 └─ ElearningModule (ordre, unlockType)
     └─ ElearningLesson (type, ordre, contenuJson|videoAssetId|pdfKey|quizId, obligatoire, dureeEstimeeMinutes)
         └─ ElearningResource (r2Key, type, telechargeable)
```

Règles d'ordonnancement (issues du data-model) :

- `@@unique([courseId, ordre])` sur module et `@@unique([moduleId, ordre])` sur leçon → **le drag&drop réécrit tous les `ordre` en une transaction Prisma** (`reorderModules`/`reorderLessons`). Utiliser un `ordre` 0-based contigu après chaque réorganisation (pas de trous, pas de doublons → sinon violation d'unicité).
- Pour éviter les collisions d'unicité pendant la transaction (Postgres vérifie en fin de transaction si la contrainte est `DEFERRABLE`, sinon ligne par ligne) : faire un **double-pass** (offset temporaire +1000 sur tous les `ordre`, puis réassignation finale) OU une seule requête `UPDATE ... CASE`. Documenter le choix dans `module-actions.ts`.

### 3.2 Server actions (toutes gated RBAC)

Toutes sous `src/server/elearning/authoring/*` et commençant par :

```ts
"use server";
import { requireAdminWrite } from "@/server/elearning/authoring/_guards";
```

| Action                                         | Garde                 | Effet                                                                                                                                                        |
| ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createCourse(input)`                          | `requireAdminWrite`   | crée `ElearningCourse` en `brouillon`, `version=1`, `estFoad=true` par défaut. Slug `@db.Citext` unique (générer depuis `titre`, suffixe `-2` si collision). |
| `updateCourse(id, patch)`                      | `requireAdminWrite`   | maj méta (titre, objectifs[], prerequis[], publicVise, langue, seuilReussitePct, vendableSeul, formationId, ownerClientId).                                  |
| `createModule / updateModule / deleteModule`   | `requireAdminWrite`   | cascade `onDelete: Cascade` côté leçons (data-model).                                                                                                        |
| `reorderModules(courseId, orderedIds[])`       | `requireAdminWrite`   | transaction réécriture `ordre`.                                                                                                                              |
| `createLesson / updateLesson / deleteLesson`   | `requireAdminWrite`   | `type` ∈ `ElearningLessonType`. Selon le type, exiger le bon champ (cf. 3.3).                                                                                |
| `reorderLessons / moveLessonToModule`          | `requireAdminWrite`   | réécriture `ordre` (transaction).                                                                                                                            |
| `attachResource(lessonId, {type, r2Key, ...})` | `requireAdminWrite`   | crée `ElearningResource`.                                                                                                                                    |
| `publishCourse(id)`                            | `requireAdminPublish` | lance `publish-service` (validation + `statut=publie`, `version++`, `publishedAt=now`).                                                                      |
| `archiveCourse(id)`                            | `requireAdminPublish` | `statut=archive` (conserve pour preuves — ADR migrations additives, jamais de delete dur d'un cours publié).                                                 |
| `cloneCourse(id)`                              | `requireAdminWrite`   | duplique l'arbre complet en `brouillon` (V1).                                                                                                                |

**Anti-pattern à refuser** : exposer ces opérations en route REST. Le repo est **Server Actions par défaut**. Les seules routes (`route.ts`) légitimes en authoring sont les **webhooks/callbacks** (Cloudflare Stream notification de fin de transcodage) et le **proxy de lecture média signé**.

### 3.3 Éditeur de leçon — un éditeur par `ElearningLessonType`

`LessonEditor.tsx` fait un `switch (lesson.type)` :

| `ElearningLessonType` | Champ porteur                             | Éditeur                                         | Validation publication                                               |
| --------------------- | ----------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| `video`               | `videoAssetId` (Stream) + `videoDureeSec` | `MediaUploader` → Stream + `VideoChapterEditor` | asset `ready` + au moins une piste de **sous-titres** (WCAG AA).     |
| `texte`               | `contenuJson` (Tiptap)                    | `BlockEditor`                                   | contenu non vide + images avec `alt`.                                |
| `pdf`                 | `pdfKey` (R2)                             | `MediaUploader` → R2                            | `existsInR2(pdfKey)` vrai + PDF "tagué" si possible (accessibilité). |
| `quiz`                | `quizId`                                  | `QuizBuilder`                                   | quiz publié, ≥1 question, seuil cohérent.                            |
| `embed`               | `contenuJson.embed`                       | `BlockEditor` (bloc embed)                      | URL allow-listée (anti-XSS).                                         |
| `devoir`              | `contenuJson.consigne`                    | `BlockEditor` + config upload attendu           | consigne + critères d'évaluation (preuve FOAD).                      |

> `obligatoire=true` ⇒ la leçon **compte dans la complétion** (gating). Les leçons facultatives n'entrent pas dans le calcul du % (logique côté `lms-core`, mais l'auteur le décide ici).

### 3.4 Blocs riches (`contenuJson`) — schéma Tiptap

`ElearningLesson.contenuJson` stocke un document **Tiptap** (ProseMirror JSON). Définir le schéma autorisé dans `content-schema.ts` (Zod) :

- Blocs : `heading` (h2/h3 uniquement — h1 = titre de leçon, jamais dans le corps), `paragraph`, `bulletList`/`orderedList`, `image` (avec `alt` **obligatoire**, `r2Key`), `callout` (info/avertissement/astuce), `codeBlock`, `table`, `embed` (allow-list), `blockquote`, `divider`.
- **Sanitization** : réutiliser/aligner `src/server/content-gen/shared/html-sanitizer.ts` lors du rendu HTML (le player rend le JSON → HTML). Aucun HTML brut non sanitizé.
- **Accessibilité dans le schéma** : `image` sans `alt` = invalide à la publication ; un seul `h1` interdit ; ordre des headings cohérent (pas de saut h2→h4).

### 3.5 Workflow brouillon → publication

`publish-service.ts` exécute une **checklist bloquante** (rendue dans `PublishChecklist.tsx`) avant de passer `statut=publie` :

1. Cours a ≥1 module, chaque module a ≥1 leçon.
2. Toutes les leçons `obligatoire` ont un contenu valide pour leur type (cf. 3.3).
3. Toutes les vidéos ont sous-titres ; toutes les images ont `alt` (WCAG 2.2 AA — obligation légale EAA depuis 28/06/2025).
4. **Au moins une évaluation jalonnante** (quiz/devoir) si `estFoad=true` — sinon **non-conformité majeure Qualiopi Ind.11** (renvoyer vers `skill-axionia-foad-conformite`).
5. `seuilReussitePct` défini (défaut 70) et cohérent avec les seuils des quiz.
6. `dureeEstimeeMinutes` recalculé (`duree-service.ts`) — exigé par D.6313-3-1 §2 (information de durée).
7. Objectifs pédagogiques renseignés (`objectifs[]` non vide), formulés de façon mesurable (cf. §6.1).

À la publication : `version++`, `publishedAt = now()`. Un cours `brouillon` est **invisible des apprenants** (filtré `statut=publie` dans toutes les requêtes côté `lms-core`).

---

## 4. Moteur quiz — côté authoring

> Le **rendu/scoring** du quiz est dans `lms-core`. Ici on décrit **la construction** des `Quiz`/`Question` et la **banque de questions**. Les noms de modèles/champs définitifs sont dans `03-DATA-MODEL/03-schema-quiz-evaluations.md` — s'y conformer.

### 4.1 Types de questions à supporter (~12, best practice 2026)

QCM mono-réponse, QCM multi-réponses, vrai/faux, appariement (matching), texte à trous (fill-in-the-blank), ordonnancement (ordering), réponse courte (exacte/regex), essai (correction **manuelle**), upload de fichier. Chaque `Question` porte : `type`, `enonce` (rich), `reponses`/`options` (JSON), `bonnesReponses`, `ponderation`, `rationale` (explication affichée en feedback), `tags[]`, `difficulte`.

### 4.2 Banque + tirage

- **Banque** : les `Question` sont réutilisables, filtrables par `tags`/`difficulte`/cours d'origine (`QuestionBankPicker.tsx`).
- **Tirage aléatoire N parmi M** : un `Quiz` peut pointer un **pool** et tirer `N` questions à chaque tentative (config sur le `Quiz`). Le tirage effectif est figé **par tentative** côté `lms-core` (anti-triche léger).
- **Shuffle** : mélange des **questions** ET des **réponses** (options) — configurable sur le `Quiz`.
- Paramètres `Quiz` : `seuilReussitePct`, `nbTentativesMax` (null=illimité), `tempsLimiteSec` (temps **serveur**, pas client), `feedbackMode` (immédiat / fin / jamais), `melangeQuestions`, `melangeReponses`, `nbQuestionsTirees`.

### 4.3 Gating par score (vraie note)

Un module/leçon avec `unlockType = score_quiz` exige `unlockScorePct` **réellement atteint** sur `unlockQuizId` (pas un simple "attempt-only"). Le verrou doit afficher **sa raison** ("Réussis le quiz du module 2 (≥ 70 %) pour débloquer") + permettre un **override admin**. (Sémantique détaillée dans `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md`.)

---

## 5. IA pédagogique d'authoring

> **Patron obligatoire** : copier la mécanique du `qualiopi-formation-engine-worker.ts`.
> Chaque appel IA = `assertCostCapAvailable` (pré) → `buildCacheKey`/`getCachedIa` (hit = skip)
> → `withRetry(anthropicProvider.generate(...))` → `trackCost` (post) → `setCachedIa` →
> trace `ElearningAuthoringJob` (étape, status, tokensIn/Out, coutUsd, modele, cacheHit, dureeMs).
> Prompt **caching** sur le system prompt (`cache_control: ephemeral`). **Jamais** d'appel IA
> synchrone long dans une server action : `enqueue` sur la queue `elearning-authoring` + poll.

### 5.1 Quiz-gen document-grounded (`ia/quiz-gen-service.ts`)

- **Entrée** : un `ElearningCourse`/`ElearningModule`/`ElearningLesson` source → on extrait son **texte de référence** (`grounding.ts` : agrège `contenuJson`, transcripts de sous-titres `.vtt`, PDF extrait) + paramètres (nb questions, types voulus, difficulté, langue=fr).
- **Grounding RAG** : réutiliser `src/server/content-gen/kb-client.ts` pour ancrer les questions sur le **contenu réel du cours** + la knowledge base Axion-IA. **Anti-hallucination** : réutiliser `src/server/qualiopi/engine/anti-hallucination.ts` (`hasUnsourcedClaims`) → rejeter toute question dont la bonne réponse n'est pas justifiable par la source.
- **Sortie** : un brouillon de `Quiz` + `Question[]` créé **en statut non publié**, présenté à l'auteur en **diff de relecture** (`AiQuizGenButton.tsx` → modale). L'IA **ne publie jamais** : validation humaine obligatoire (comme le Formation Engine ne met jamais `validatedBy`).
- **Qualité** : chaque question générée passe `runAdversarialCritique` (clarté de l'énoncé, distracteurs plausibles non-piégeux, un seul niveau de difficulté, `rationale` présent). Score < plancher → refine (max N passes) puis flag "à revoir manuellement".

### 5.2 Plan de cours Backward Design (`ia/course-plan-service.ts`)

Réutilise les prompts `buildBackwardDesign*` du Formation Engine (`src/server/qualiopi/engine/prompts.ts`). Flux : **objectifs mesurables → évaluations (preuves d'atteinte) → modules/leçons (séquence)**. Sortie = arborescence `ElearningModule`/`ElearningLesson` en **brouillon** (titres + objectifs + durées estimées + emplacement des quiz), que l'auteur remplit ensuite. Respecte le microlearning (leçons 2-10 min).

### 5.3 Réécriture / résumé / niveau (`ia/rewrite-service.ts`)

Sur un bloc `texte` : réécrire selon la **charte éditoriale** (§6), résumer, ajuster le niveau de lecture, générer un TL;DR / objectifs de leçon. Toujours en **suggestion** (diff), jamais auto-appliqué.

### 5.4 Alt-text & chapitres (`ia/alt-text-service.ts`)

- Alt-text d'image (vision Claude) pour les `image` de `contenuJson` et `imageCouvertureKey` — **WCAG 1.1.1**.
- Titres de chapitres vidéo depuis le transcript (navigation + accessibilité).
- L'auteur valide/édite (jamais publié sans relecture).

### 5.5 Tuteur RAG (V1 — pointeur)

Le **tuteur apprenant** (assistance pédagogique ancrée, Qualiopi Ind.19) est spécifié dans `04-BACKEND/09-tuteur-rag-assistant.md`. Côté authoring, prévoir uniquement : marquer le contenu d'un cours comme **source indexable** pour le tuteur (flag + (ré)indexation via `kb-client.ts`) au moment de la publication.

### 5.6 Garde-fous IA (récap)

- Coût plafonné (`assertCostCapAvailable`/`trackCost`) — ne **jamais** retirer.
- Cache IA (`buildCacheKey`/`getCachedIa`/`setCachedIa`) — idempotence + économie.
- **Validation humaine systématique** : l'IA produit des **brouillons**, pas des publications.
- Anti-hallucination obligatoire sur tout contenu factuel/évaluatif.
- Provider = `anthropicProvider` (modèle par défaut Sonnet ; Opus seulement si justifié — pricing dans `providers/anthropic.ts`). **Ne jamais** router vers un autre fournisseur sans ADR.

---

## 6. Qualité pédagogique & charte éditoriale

### 6.1 Objectifs pédagogiques mesurables (Backward Design)

- Formulés avec des **verbes observables** (taxonomie de Bloom) : "identifier", "rédiger un prompt", "configurer", "évaluer" — **pas** "comprendre", "connaître", "savoir".
- Chaque objectif est **évalué** par au moins une question/devoir (lien objectif ↔ évaluation, cohérent avec `EvaluationAcquis.competences[].objectifRef`).
- Renseignés dans `ElearningCourse.objectifs[]` (et au niveau leçon dans `contenuJson` si pertinent).

### 6.2 Microlearning

- Leçons **2-10 min** (`dureeEstimeeMinutes`). Une leçon trop longue → la découper. Le `PublishChecklist` peut avertir (non bloquant) au-delà de ~12 min.
- **Pas un seul type par leçon imposé** : on peut mixer blocs (texte + image + callout + mini-quiz) dans une leçon `texte`. À éviter : pacing rigide, autoplay, classements imposés.

### 6.3 Ton & charte visuelle (Editorial Premium Light)

Aligné sur le reste de la plateforme (cf. skill qualiopi) :

- Couleurs tokens `@theme` (Tailwind v4) : terracotta `#c24a1b`, bleu `#1a4dd9`, ivoire `#faf8f3`, mocha `#2a2520`.
- Typographies : Manrope (corps), Fraunces (titres), Inconsolata (code/données).
- Ton : professionnel, concret, orienté praticien IA ; vouvoiement ; phrases courtes ; exemples sectoriels. Éviter le jargon non défini et le hype ("révolutionnaire", "unique") — banni côté content-gen, à respecter ici aussi.
- FR canonique (EN désactivé) : tout le contenu et l'UI auteur en français.

### 6.4 Accessibilité WCAG 2.2 AA (obligation légale UE — EAA 28/06/2025)

Le contenu **produit** par l'auteur doit être conforme. À garantir dans l'éditeur et la checklist :

- **1.1.1** alt-text sur toutes les images.
- **Sous-titres** sur toutes les vidéos (piste `.vtt`, `ElearningResource.type="sous_titres"`).
- Hiérarchie de titres correcte (h2/h3 dans le corps, jamais h1).
- Contraste suffisant (les tokens charte sont AA — ne pas introduire de combos faibles).
- **2.5.7** alternative au drag (toute action drag&drop de l'éditeur a une alternative clavier/boutons "monter/descendre").
- **2.5.8** cibles ≥ 24px ; **2.4.11** focus visible ; **3.3.8** auth accessible (côté apprenant).
- Le course-builder lui-même (outil interne) vise aussi l'accessibilité clavier.

### 6.5 Performance (budgets Web Vitals)

L'outil auteur est derrière auth admin (pas dans les 15 pages publiques stratégiques) mais **le contenu publié est consommé par l'apprenant** :

- Player + éditeur = risque **INP** → composants lourds (Tiptap, dnd-kit, lecteur vidéo) en **import dynamique** (`next/dynamic`), pas dans le First Load des pages publiques.
- Images uploadées : passer par un pipeline de variantes (réutiliser la logique image-bank si pertinent) ; jamais d'image brute non optimisée en couverture publique.
- Pages e-learning derrière auth = `force-dynamic` → **compatibles avec le contrat de build `stub.invalid`** (aucun rendu SSG ne tape la DB au build).

---

## 7. Médias

### 7.1 Fichiers (R2) — `src/lib/r2-storage.ts`

- PDF, images, fichiers téléchargeables, **sous-titres `.vtt`** → `ElearningResource.r2Key`.
- **Upload gros fichiers** (.pptx/.pdf 30-50 Mo) : `getSignedUploadUrlR2(key, contentType)` → le navigateur fait `fetch(url, { method:"PUT", body:file })` (ne transite pas par Next, contourne `bodySizeLimit`). ⚠️ Le bucket doit autoriser le **CORS PUT** depuis l'origine admin.
- **Lecture** : `getSignedUrlR2(key, ttl)` (URL signée, TTL court pour le contenu pédagogique). Pour le contenu **téléchargeable** (`telechargeable=true`) seulement, exposer un proxy/route signé ; sinon servir en lecture.
- **Convention de clé** : `elearning/courses/<courseId>/lessons/<lessonId>/<type>/<filename>` (partition lisible, alignée sur le style `invoicePdfKey`).
- Mode dégradé : `isR2Configured()` false → désactiver l'upload (l'authoring le signale, ne crash pas).

### 7.2 Vidéo (Cloudflare Stream — ADR-0005) — `src/server/elearning/video/stream-client.ts`

- **R2 ne streame pas.** La vidéo va sur **Cloudflare Stream** (HLS adaptatif, encodage et bande passante inclus, ~6× moins cher que Mux). Bunny Stream = alternative si résidence UE prioritaire.
- Flux : `MediaUploader` demande une **URL d'upload Stream** (one-time, via `stream-client.ts`) → upload direct navigateur → on stocke l'`uid` Stream dans `ElearningLesson.videoAssetId` (PAS dans `r2Key`).
- **Transcodage asynchrone** : `elearning-video-worker.ts` (queue `elearning-video`) poll le statut Stream (ou reçoit un **webhook** sur une `route.ts` dédiée) → quand `ready`, met à jour `videoAssetId`/`videoDureeSec` + notifie l'auteur par email (Nodemailer).
- **Protection** (ADR-0005) : **URLs de lecture signées** + **watermark dynamique par utilisateur** (DRM lourd réservé au premium). La signature de lecture est générée côté `lms-core` au moment de la lecture (token court, lié à l'apprenant).
- **Sous-titres** : ingest `.vtt` (uploadé ou généré). Soit attaché à l'asset Stream, soit servi depuis R2 comme `ElearningResource type="sous_titres"`. **Obligatoire** pour publier une leçon vidéo (WCAG).

### 7.3 Aperçu "as-student" (`AsStudentPreview.tsx` / `cours/[courseId]/apercu`)

Rend le **player réel** de `lms-core` en lecture seule, sur la version brouillon, sans créer de progression ni consommer de tentative. Permet à l'auteur de voir exactement le rendu apprenant (déverrouillages affichés en mode "simulation") avant publication.

---

## 8. Conformité (renvois — ne pas réimplémenter ici)

L'authoring **produit les preuves** mais la logique de conformité vit dans `skill-axionia-foad-conformite` :

- **Ind.11 (évaluations qui jalonnent)** : la checklist de publication exige ≥1 évaluation si `estFoad`. Non-conformité **majeure** sinon.
- **D.6313-3-1 §2 (information durée)** : `dureeEstimeeMinutes` agrégé + affiché.
- **Certificat de réalisation** : généré côté `lms-core` (réutilise `DocumentGenere` + `qrToken`), pas ici.
- **Conservation** : un cours publié ne se **supprime pas** (archive), pour garder les preuves (10 ans comptable / 6 ans OPCO / 3-5 ans réalisation).
- **CPF** : un cours e-learning n'est éligible CPF que si certification RNCP/RS (ADR-0003) → `EDOF_ENABLED` flag, hors code.

---

## 9. Navigation admin (`src/lib/admin-nav.ts`)

Ajouter un groupe e-learning au SSOT de nav (type `AdminNavGroup` + `ADMIN_NAV_GROUP_LABELS` + items). Rappels :

- Le composant rendu est **`AdminSidebarNav.tsx`** (pas `AdminSidebar.tsx`).
- Respecter la forme `AdminNavItem` (`href`, `label`, `icon`, `group`, `tier?`).
- Items minimum : "Cours", "Banque de questions", "Médias" (+ "Apprenants"/"Accès" qui appartiennent plutôt à `lms-core`).
- Tester contre le test de comptage de nav existant (un ajout d'item modifie le total attendu — mettre à jour le test `admin-nav.test`).

---

## 10. Contrat de build & contraintes plateforme (rappels durs)

- **Migrations ADDITIVES uniquement** (ADR-0008) : `CREATE TABLE`, `ADD COLUMN` nullable. Jamais de `DROP`. Les champs inverses sur `Formation`/`Client` (`elearningCourses`, `coursesProprietaires`) sont des relations sans colonne (purement additif).
- **Build `stub.invalid`** (ADR 0026) : aucune page e-learning ne doit faire d'appel DB au SSG. Toutes derrière auth + `force-dynamic`. Si une page tape la DB au build, ajouter un early-exit `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback>`.
- **Stripe éteint** (`STRIPE_ENABLED=false`) : pas de paiement CB dans l'authoring MVP. La vitrine (`vendableSeul`) prépare l'e-commerce mais l'octroi reste manuel/virement.
- **EN désactivé** : FR canonique, pas de traduction EN du contenu de cours.
- **`pricing.ts` = SSOT** : aucun prix en dur. Le prix d'un cours vendable seul passe par `pricing.ts`.
- **Server Actions par défaut** : pas de REST sauf webhook Stream + proxy média signé.
- **RBAC** : toute action gated `requireAdminWrite`/`requireAdminPublish` (`src/server/actions/knowledge/_guards.ts`).

---

## 11. Définition de "fait" (Definition of Done) pour un lot d'authoring

1. Modèles Prisma conformes au data-model (noms exacts), migration **additive** générée et vérifiée.
2. Server actions gated RBAC + validées Zod, sans REST inutile.
3. Workers IA/vidéo avec garde-fous coût + cache + retry + trace, **jamais d'appel IA synchrone long**.
4. Éditeur accessible (WCAG 2.2 AA) + alternative clavier au drag.
5. Checklist de publication bloquante (dont Ind.11 si FOAD).
6. Médias R2 (clé canonique, CORS) + vidéo Stream (signée + sous-titres + watermark).
7. Aperçu as-student fonctionnel.
8. Nav admin mise à jour + test de comptage corrigé.
9. Pas de régression Web Vitals sur les pages publiques (composants lourds en dynamic import).
10. Tests Vitest (services purs + actions) verts ; pas de fuite de contenu `brouillon` côté apprenant.

---

## Liens

- `../00-INDEX/README.md` — index maître du dossier LMS.
- `../00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001→0008 (figés).
- `../03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource` + enums (source des noms).
- `../03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz/Question/QuizAttempt` (moteur quiz).
- `../03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment/LessonProgress` (consommation côté core).
- `../04-BACKEND/07-pipeline-video-streaming.md` — détail Cloudflare Stream.
- `../04-BACKEND/08-ia-pedagogique-generation.md` — détail backend IA d'authoring.
- `../04-BACKEND/09-tuteur-rag-assistant.md` — tuteur RAG (V1).
- `../06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — spéc produit détaillée de l'outil auteur.
- `../06-CONSOLE-ADMIN/06-gestion-banque-quiz.md` — banque de questions.
- `../08-CONFORMITE/01-foad-d6313-3-1.md` + `02-qualiopi-indicateurs-foad.md` — Ind.11/19, preuves.
- `../09-QUALITE/04-accessibilite-wcag22.md` — critères WCAG 2.2 AA.
- `skill-axionia-lms-core.md` — player, progression, déverrouillage, certificats (consommation).
- `skill-axionia-foad-conformite.md` — preuves, assistance, traçabilité, conservation.
- `../11-ROADMAP/01-phasage-mvp-v1-v2.md` — outil auteur minimal (MVP) → abouti (V1).
