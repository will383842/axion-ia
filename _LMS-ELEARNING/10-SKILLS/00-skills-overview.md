# Aperçu des skills Claude Code à créer pour le LMS e-learning

> **Objet.** Ce document décrit les **skills Claude Code** dédiés à la construction et à la maintenance de la plateforme LMS e-learning d'Axion-IA. Il explique le **format d'un skill** (fichier `SKILL.md` + frontmatter + reference bundle), liste les **trois skills à créer**, délimite leur **périmètre** et leurs **déclencheurs**, et — point critique — **comment ils se complètent sans dupliquer** le skill `axionia-qualiopi` déjà en place.
>
> Public : équipe de dev senior + Will. Source de vérité pour qui implémente les skills.
> Dernière mise à jour : 2026-06-27.

---

## 0. TL;DR

| Skill (NEUF)                  | Rôle                                                                                                                                                                                       | Déclenche sur                                                                                                                                                | MVP/V1/V2                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| **`axionia-lms-core`**        | Cœur LMS runtime : data model, auth apprenant, octroi/import, player vidéo, progression, moteur de quiz, certificats, workers, espace apprenant.                                           | « LMS », « e-learning », « cours en ligne », « FOAD », « player vidéo », « quiz », « déverrouillage », « octroi d'accès », « certificat e-learning ».        | MVP → V2                      |
| **`axionia-lms-authoring`**   | Outil auteur (Course Builder) + IA pédagogique : éditeur drag&drop, blocs Tiptap, upload média, banque de questions, quiz-gen IA, tuteur RAG, aperçu _as-student_, publication.            | « outil auteur », « course builder », « créer un cours », « quiz-gen », « tuteur RAG », « banque de questions », « authoring IA ».                           | MVP (minimal) → V1            |
| **`axionia-foad-conformite`** | Conformité FOAD/Qualiopi/OPCO/CPF _spécifique e-learning_ : preuves de réalisation, indicateurs FOAD (1,6,9,10,11,12,17,19), certificat de réalisation, EDOF-readiness, RGPD/conservation. | « FOAD », « D.6313-3-1 », « preuves de réalisation », « indicateur Qualiopi FOAD », « assiduité e-learning », « EDOF e-learning », « conservation preuves ». | MVP (transversal) → V2 (EDOF) |

Les trois skills sont **cloisonnés** (ADR-LMS-0007) sous `src/server/elearning/**`, `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, `src/components/{elearning,admin/elearning}/**`, `src/app/[locale]/portail/**` (extension) et workers `src/server/queue/workers/elearning-*-worker.ts`. Ils **réutilisent** systématiquement les briques existantes plutôt que d'en recréer (cf. `02-ARCHITECTURE/reutilisation-existant.md`).

---

## 1. Pourquoi trois skills (et pas un seul, ni dix)

Le projet LMS a trois **natures de travail** distinctes, avec des contextes, des risques et des oracles de validation différents :

1. **Le runtime** (ce que l'apprenant et l'admin utilisent : data model, auth, player, quiz, progression, certificats, workers) — discipline « code réel fait foi », migrations additives, Web Vitals, idempotence des workers.
2. **L'authoring + l'IA** (ce que l'équipe pédagogique remplit : course builder, blocs, upload, génération de quiz, tuteur) — discipline UX « facile à remplir », « l'IA propose, l'humain dispose », kill-switch coût IA.
3. **La conformité FOAD** (ce que l'auditeur Qualiopi / l'OPCO / la CDC exigent : preuves, indicateurs, certificat de réalisation, EDOF) — discipline « conformité prouvée, pas affirmée », réglementation dure (Code du travail, RNQ V8, RGPD).

Un **skill unique** serait trop gros pour le budget de contexte (progressive disclosure cassée) et mélangerait des disciplines aux garde-fous opposés. **Dix skills** fragmenteraient inutilement (un seul data model, un seul contrat de build). Trois = une frontière nette par nature de travail, alignée sur la structure du dossier `_LMS-ELEARNING/`.

> **Frontière nette avec l'existant.** Le LMS asynchrone (FOAD) est un **monde séparé** du back-office Qualiopi présentiel/live (`axionia-qualiopi`). Les trois skills LMS **n'éditent jamais** `src/server/qualiopi/**` ; ils **importent/appellent** ses briques réutilisables (PDF, R2, emails, alertes, RBAC, Formation Engine). Voir §6.

---

## 2. Format d'un skill Claude Code (rappel opérationnel)

Un skill est un **dossier** contenant au minimum un fichier `SKILL.md`. Modèle de référence dans ce repo : `axionia/.claude/skills/axionia-qualiopi/SKILL.md` et `.claude/skills/axionia-image-bank/SKILL.md` (racine projet).

### 2.1 Structure de dossier

```
<racine>/.claude/skills/<nom-du-skill>/
├── SKILL.md                      # OBLIGATOIRE : frontmatter + instructions
└── reference/                    # OPTIONNEL : docs chargées « à la demande » (progressive disclosure)
    ├── 01-codebase-contract.md
    ├── 02-autopilot-workflow.md
    └── …
```

- **Emplacement.** Skill « projet » → `axionia/.claude/skills/…` (vit avec le code, suit la branche). Skill « utilisateur global » → `C:/Users/willi/.claude/skills/…`. Le LMS étant intégré au codebase `axionia`, **les trois skills LMS sont des skills projet** : `axionia/.claude/skills/{axionia-lms-core,axionia-lms-authoring,axionia-foad-conformite}/`.

### 2.2 Le frontmatter `SKILL.md` (YAML)

```yaml
---
name: axionia-lms-core
description: >-
  <Quand activer + ce que couvre + stack imposée + déclencheurs explicites>.
  C'est le SEUL champ lu pour décider d'activer le skill : il doit contenir
  les mots-clés que Will/le dev tapera (« LMS », « e-learning », …) ET le
  périmètre (modèles, chemins) pour éviter les faux positifs.
---
```

Règles (vérifiées sur `axionia-qualiopi`) :

- `name` : kebab-case, unique, = nom du dossier.
- `description` : **dense et exhaustive**. C'est l'unique signal de routage. On y met (a) le **rôle**, (b) la **stack réelle imposée** (Next.js 16.2 App Router + Prisma 5.22 + Postgres + NextAuth 5 + BullMQ + @react-pdf/renderer + nodemailer + @anthropic-ai/sdk + next-intl FR), (c) les **déclencheurs textuels** (`« … »`), (d) les **formulations de lancement de Will** à reconnaître, (e) les **anti-déclencheurs** (« ne pas utiliser pour … → renvoyer vers tel autre skill »).
- Le reste (corps Markdown sous le frontmatter) = **instructions** : quand l'utiliser / ne pas l'utiliser, table des documents `reference/` à charger à la demande, les « lois » du contrat, la boucle de fonctionnement, les `STOP & ASK`, le démarrage rapide.

### 2.3 Progressive disclosure (corps + reference/)

Le corps de `SKILL.md` reste **court** (il est toujours chargé). Le détail lourd va dans `reference/*.md`, chargés **uniquement quand la tâche le requiert**, via une table « Charger quand » (modèle `axionia-qualiopi` §« Documents de référence »). Pour le LMS, le `reference/` de chaque skill **pointe en priorité vers les docs déjà rédigés** dans `_LMS-ELEARNING/` (ne pas dupliquer le contenu : le skill référence, le dossier détaille).

> **Anti-pattern à éviter** : recopier dans `reference/` ce qui est déjà dans `_LMS-ELEARNING/03-DATA-MODEL/*` etc. Le skill **renvoie** vers ces fichiers (chemins absolus) ; il ne contient que le **contrat d'exécution** (lois, workflow, garde-fous, anti-duplication) propre au skill.

---

## 3. Skill `axionia-lms-core` — cœur LMS runtime

### 3.1 Mission

Implémenter, étendre, vérifier le **cœur fonctionnel** du LMS : tout ce qui fait qu'un apprenant reçoit un accès, suit un cours, est débloqué/bloqué, passe des quiz, progresse, et obtient un certificat — plus l'infrastructure serveur (data model, auth apprenant, octroi/import, workers, vidéo). C'est le skill « par défaut » du LMS : si la tâche n'est ni purement authoring/IA, ni purement conformité, c'est `axionia-lms-core`.

### 3.2 Périmètre (ce qu'il couvre)

**Data model (NEUF, doc `03-DATA-MODEL/*`)** — colonne vertébrale :

- `ElearningCourse` / `ElearningModule` / `ElearningLesson` / `ElearningResource` + enums `ElearningCourseStatut`, `ElearningLessonType`, `ElearningUnlockType` (doc 01).
- `ElearningEnrollment`, `LessonProgress` (progression, reprise, complétion — doc 02) + `ElearningActivityLog`, `ElearningVideoAsset`, `ElearningAccompagnementLog`, `ElearningPreuveRealisationSnapshot` (additifs, requis par les workers).
- `ElearningAccount` / `ElearningGrant` / `ElearningAccess` (auth & accès — doc 04).
- `ElearningOrder` (commande, octroi — doc 05 ; Stripe branché en V1, ADR-LMS-0004).
- Moteur de quiz **structures de données** (`Quiz`, `Question`, `QuizAttempt` — doc 03) : ce skill possède le **runtime de passage** (jouer, scorer, gating) ; la **création/banque** appartient à `axionia-lms-authoring` (§4).

**Auth apprenant (NEUF, ADR-LMS-0001, doc `04-BACKEND/05`)** :

- `src/server/elearning/auth/learner-auth-service.ts` — clone du pattern `PortailAcces`/`portail-service.ts` (token 64 hex, `timingSafeEqual`, cookie HttpOnly, stub-aware) + `passwordHash` optionnel argon2id (entreprises) + middleware/cookie **dédié, séparé de NextAuth**.

**Octroi & import (NEUF, doc `04-BACKEND/06`)** :

- `grantAccess()` idempotent partagé (auto session→cours, manuel admin, import CSV) ; upsert `ElearningGrant` sur `@@unique([accountId, courseId])`.

**Vidéo (NEUF, ADR-LMS-0005, doc `04-BACKEND/07`)** :

- intégration Cloudflare Stream (HLS, URLs signées courtes, watermark dynamique par apprenant) ; `ElearningLesson.videoAssetId` ; route webhook `POST /api/elearning/stream-webhook`.

**Workers (NEUF, doc `04-BACKEND/03`)** sous `src/server/queue/workers/elearning-*-worker.ts` :

- `elearning-video-worker`, `elearning-crons-worker` (octroi-auto, certificats-sweep, acces-expiration, video-reconcile, + relance-decrochage/preuves-foad partagés avec foad-conformite), `elearning-certificate-worker`.

**Frontend apprenant (NEUF, doc `05-FRONTEND-APPRENANT/01,02,03,04,05`)** :

- espace apprenant `/[locale]/portail/**` (extension), player (reprise auto, heartbeat, vitesse, sous-titres WCAG), moteur de quiz UI, déverrouillage (verrou affiché **avec sa raison**), mobile-first + WCAG 2.2 AA.

**Certificats runtime (doc `05-FRONTEND-APPRENANT/06`)** : émission via `DocumentGenere` (réutilisé) + worker certificat (la **conformité du modèle** appartient à `axionia-foad-conformite`).

### 3.3 Déclencheurs (`description`)

« LMS », « e-learning », « cours en ligne », « formation en ligne », « FOAD » (volet technique), « module / leçon », « player vidéo », « Cloudflare Stream », « quiz bloquant », « déverrouillage / drip / gating », « progression apprenant », « reprise auto », « octroi d'accès », « import CSV apprenants », « auth apprenant / magic-link apprenant », « certificat e-learning », « espace apprenant », « worker elearning ». Formulations Will : « lance le LMS », « le système e-learning », « la plateforme de cours en ligne ».

### 3.4 Anti-déclencheurs (renvoyer ailleurs)

- Créer/éditer le contenu d'un cours, drag&drop, quiz-gen IA, tuteur → **`axionia-lms-authoring`**.
- Preuves d'audit, indicateurs Qualiopi FOAD, modèle légal du certificat, EDOF, conservation RGPD → **`axionia-foad-conformite`**.
- Sessions présentiel/live, émargement, BPF, convention/attestation, OPCO subrogation présentiel → **`axionia-qualiopi`** (existant).

### 3.5 Reference bundle proposé

| `reference/`              | Contenu                                                                                                                | Renvoie vers                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `01-codebase-contract.md` | Les 5 lois adaptées LMS, stack imposée, cloisonnement ADR-0007, contrat `stub.invalid`, migrations additives ADR-0008. | `02-ARCHITECTURE/reutilisation-existant.md` |
| `02-data-model-map.md`    | Carte des modèles + où chacun est spécifié.                                                                            | `03-DATA-MODEL/01..06`                      |
| `03-runtime-workflow.md`  | Boucle autopilot (grounding→tranches→gate→croisement), idempotence workers, garde-fous Web Vitals/INP player.          | `04-BACKEND/03`, `09-QUALITE/03`            |

---

## 4. Skill `axionia-lms-authoring` — outil auteur + IA pédagogique

### 4.1 Mission

Tout ce qui sert à **fabriquer et remplir** un cours, et l'**assistance IA** associée. Cible la barre projet « facile à remplir » (doc `06-CONSOLE-ADMIN/03`) et la règle d'or « l'IA propose, l'humain dispose ».

### 4.2 Périmètre

**Course Builder (NEUF, doc `06-CONSOLE-ADMIN/03`)** :

- UI 3 colonnes sous `src/components/admin/elearning/builder/**` (arbre structurel / éditeur de leçon / inspecteur).
- Drag&drop via `@dnd-kit/*` (**déjà installé**, aucune dépendance neuve) + **alternative clavier obligatoire** (WCAG 2.5.7).
- Éditeur riche via `@tiptap/*` (**déjà installé**) → sérialisation JSON dans `ElearningLesson.contenuJson`.
- Upload média **direct navigateur → R2** via `getSignedUploadUrlR2` (pattern `kit-import.actions.ts`) ; vidéo → flux Cloudflare Stream (orchestré par `axionia-lms-core`, l'authoring déclenche).
- Autosave débouncé (`AdminAutosaveIndicator`), brouillon→publication, clonage, templates de cours, **aperçu _as-student_**.
- Server actions `src/server/elearning/actions/course-builder.actions.ts` + `_guards.ts` local (re-export `requireAdminRead/Write/Publish/Delete`).

**Banque de questions & quiz (volet création, doc `06-CONSOLE-ADMIN/06`)** :

- ~12 types de questions, banque, tirage N parmi M, shuffle questions/réponses, pondération, seuil, feedback/rationale. (Le **passage** du quiz est runtime → `axionia-lms-core`.)

**IA pédagogique (NEUF, doc `04-BACKEND/08` & `09`)** :

- `quiz-gen` (questions ancrées sur le contenu, anti-hallucination `hasUnsourcedClaims`), `authoring-draft` (ébauche document-grounded), `quiz-review` (critique adversariale type `runAdversarialCritique`).
- **Tuteur RAG** (assistance pédagogique, ancré + citations) : indexation worker `elearning-tutor-index-worker`, chat synchrone (Server Action/route streaming).
- **Réutilise** les sous-couches du Formation Engine : `anthropicProvider`, `withRetry`, `assertCostCapAvailable`/`trackCost`, cache IA, RAG knowledge existant. **Jamais** un second système IA/vectoriel.
- Workers `elearning-ai-worker` + `elearning-tutor-index-worker` (gates `ELEARNING_AI_ENABLED`, `ELEARNING_TUTOR_ENABLED`).

### 4.3 Déclencheurs

« outil auteur », « course builder », « créer / éditer un cours », « éditeur de leçon », « bloc Tiptap », « upload média cours », « drag&drop cours », « banque de questions », « générer un quiz / quiz-gen », « tuteur RAG / tuteur IA », « assistance authoring IA », « aperçu as-student », « publier un cours ». Formulations Will : « créer mes cours », « l'éditeur de cours », « l'IA qui génère les quiz ».

### 4.4 Anti-déclencheurs

- Jouer/scorer un quiz, progression, octroi, player, auth apprenant, certificat → **`axionia-lms-core`**.
- Vérifier qu'un quiz satisfait l'Ind. 11, qu'un cours expose la durée (Ind. 1/9), preuves → **`axionia-foad-conformite`**.
- Génération de **formations Qualiopi présentielles** (machine d'états `statutGeneration`, Backward Design, supports PDF présentiel) → **`axionia-qualiopi`** (existant). ⚠️ frontière subtile : voir §6.2.

### 4.5 Reference bundle proposé

| `reference/`                  | Contenu                                                                                                       | Renvoie vers                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `01-authoring-ux-contract.md` | 8 principes « facile à remplir », accessibilité auteur WCAG 2.2 AA, autosave, aperçu as-student.              | `06-CONSOLE-ADMIN/03`                                                  |
| `02-ai-reuse-contract.md`     | Réutilisation Formation Engine (provider/cache/cost-cap), règle « IA propose / humain dispose », ancrage RAG. | `04-BACKEND/08`, `09` ; `02-ARCHITECTURE/reutilisation-existant.md` §7 |
| `03-quiz-bank-spec.md`        | 12 types, banque, tirage/shuffle/pondération/seuil.                                                           | `03-DATA-MODEL/03`, `06-CONSOLE-ADMIN/06`                              |

---

## 5. Skill `axionia-foad-conformite` — conformité FOAD spécifique e-learning

### 5.1 Mission

Garantir que tout ce que produit le LMS est **finançable et auditable** : preuves de réalisation FOAD, indicateurs Qualiopi V8 mobilisés par la FOAD, certificat de réalisation au modèle officiel, EDOF-readiness (gated), conservation RGPD. Discipline : **conformité prouvée, pas affirmée** — chaque obligation reliée à un artefact logiciel ET à un test.

### 5.2 Périmètre

**FOAD — Art. D.6313-3-1 & R.6313-3 (doc `08-CONFORMITE/01,06`)** :

- 3 conditions cumulatives : (1) assistance technique ET pédagogique (tutorat + délais → relie au tuteur de `axionia-lms-authoring` et aux relances de `axionia-lms-core`) ; (2) information activités + durée moyenne ; (3) évaluations qui jalonnent/concluent.
- **Faisceau de preuves** (preuve libre, relevé de connexion seul insuffisant) : `LessonProgress`, `QuizAttempt`, `ElearningAccompagnementLog`, `ElearningPreuveRealisationSnapshot`, devoirs rendus. Export OPCO/contrôle.

**Indicateurs Qualiopi V8 FOAD (doc `08-CONFORMITE/02`)** : 1, 6, 9, 10, **11 (NC MAJEURE)**, 12, 17, **19 (seule obligation nommée FOAD)** — mapping exigence → fonctionnalité → modèle preuve → écran d'audit. Les autres indicateurs (2-5, 7-8, 13-16, 18, 20-32) restent gérés par `axionia-qualiopi` ; ce skill **n'y touche pas**.

**Certificat de réalisation (doc `05-FRONTEND-APPRENANT/06`, `08-CONFORMITE/06`)** : **modèle officiel** obligatoire depuis 01/06/2020, **heures réalisées en centièmes** calculées depuis les traces (pas déclaratives), `DocumentType` additif sur `DocumentGenere`, QR public. Ce skill possède la **conformité du modèle** ; l'émission technique est dans `axionia-lms-core`.

**CPF / EDOF (gated, ADR-LMS-0003, doc `08-CONFORMITE/03,04`)** : tout « certification-ready » ; intégration EDOF derrière `EDOF_ENABLED=false` (entrée effective, suivi assiduité, service fait, FranceConnect+). CPF **bloqué** tant que pas de certification RNCP/RS (dossier France Compétences, hors code). Dossier de certification documenté.

**RGPD & conservation (doc `08-CONFORMITE/05`)** : 10 ans comptable (L.123-22), 6 ans fiscal/OPCO (L.102B), 3-5 ans preuves réalisation (L.6362-6), 6 mois-1 an logs techniques (CNIL) ; droit à l'effacement via `RgpdDemande` existant ; PII chiffrée via `pii-crypto`.

### 5.3 Déclencheurs

« FOAD », « D.6313-3-1 », « R.6313-3 », « preuves de réalisation », « faisceau de preuves », « assiduité e-learning », « certificat de réalisation e-learning », « indicateur Qualiopi FOAD », « Ind. 11 / 19 FOAD », « EDOF e-learning », « CPF e-learning », « entrée effective / service fait », « conservation preuves LMS », « export OPCO e-learning », « contrôle SRC ». Formulations Will : « rendre le e-learning finançable », « les preuves pour l'OPCO », « conformité de la plateforme de cours ».

### 5.4 Anti-déclencheurs

- Coder le player, l'octroi, les quiz, l'auth → **`axionia-lms-core`**. Coder le builder, le tuteur, le quiz-gen → **`axionia-lms-authoring`**.
- **Conformité présentiel/live** : émargement, relevé de connexion synchrone, convention L.6353-1, attestation D.6353-1, BPF, 22 indicateurs globaux, OPCO subrogation présentiel, France Travail → **`axionia-qualiopi`** (existant). Ce skill ne gère QUE la couche **FOAD asynchrone**.

### 5.5 Reference bundle proposé

| `reference/`                 | Contenu                                                                                                       | Renvoie vers             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `01-foad-legal-contract.md`  | D.6313-3-1 (3 conditions), R.6313-3 (preuve libre), conservation, EAA/WCAG, frontière vs Qualiopi présentiel. | `08-CONFORMITE/01,05,06` |
| `02-qualiopi-foad-oracle.md` | Mapping 1/6/9/10/11/12/17/19 → preuve → test (oracle d'acceptation FOAD).                                     | `08-CONFORMITE/02`       |
| `03-cpf-edof-readiness.md`   | Gates EDOF, certification RNCP/RS, ce qui est codé vs hors-code.                                              | `08-CONFORMITE/03,04`    |

---

## 6. Complémentarité & anti-duplication (le point clé)

### 6.1 Carte des frontières entre les 4 skills

| Surface / brique                                                      | `axionia-qualiopi` (existant) |   `axionia-lms-core`   | `axionia-lms-authoring` |  `axionia-foad-conformite`   |
| --------------------------------------------------------------------- | :---------------------------: | :--------------------: | :---------------------: | :--------------------------: |
| Sessions présentiel/live, émargement, relevé connexion synchrone      |      **✔ Propriétaire**       |           —            |            —            |              —               |
| 22 indicateurs Qualiopi (global), BPF, registre réclamations          |      **✔ Propriétaire**       |           —            |            —            |     renvoie (FOAD only)      |
| Convention L.6353-1 / attestation D.6353-1 / facture exonérée         |      **✔ Propriétaire**       |           —            |            —            |           renvoie            |
| Formation Engine IA (machine `statutGeneration`, supports présentiel) |      **✔ Propriétaire**       | réutilise sous-couches | réutilise sous-couches  |              —               |
| Cours / module / leçon / ressource (data model LMS)                   |               —               |   **✔ Propriétaire**   |     édite (builder)     |        vérifie (Ind.)        |
| Auth apprenant, octroi, import CSV, accès                             |               —               |   **✔ Propriétaire**   |            —            |      vérifie (preuves)       |
| Player vidéo, progression, reprise, heartbeat                         |               —               |   **✔ Propriétaire**   |            —            |     vérifie (assiduité)      |
| Quiz : **passage/score/gating** (runtime)                             |               —               |   **✔ Propriétaire**   |            —            |      vérifie (Ind. 11)       |
| Quiz : **création / banque / quiz-gen IA**                            |               —               |           —            |   **✔ Propriétaire**    |      vérifie (Ind. 11)       |
| Course Builder, blocs Tiptap, upload média, aperçu                    |               —               |           —            |   **✔ Propriétaire**    |              —               |
| Tuteur RAG, assistance pédagogique IA                                 |               —               |   infra worker/queue   |   **✔ Propriétaire**    |      vérifie (Ind. 19)       |
| Certificat e-learning : **émission technique**                        |               —               |   **✔ Propriétaire**   |            —            |      définit le modèle       |
| Certificat e-learning : **modèle légal / heures centièmes**           |     parité PDF réutilisée     |          émet          |            —            |      **✔ Propriétaire**      |
| Preuves FOAD, indicateurs FOAD, EDOF, conservation                    |               —               |   produit la donnée    |    produit la donnée    |      **✔ Propriétaire**      |
| Banque d'images / galerie SEO                                         |               —               |           —            |            —            | — → **`axionia-image-bank`** |

Lecture : **un seul `✔ Propriétaire` par ligne** = pas de duplication. « réutilise / produit / vérifie / renvoie » = collaboration sans propriété.

### 6.2 Frontières subtiles à ne PAS confondre

1. **Génération de contenu IA : Formation Engine (Qualiopi) vs authoring LMS.**
   - `axionia-qualiopi` génère une **Formation Qualiopi** (structure pédagogique présentielle, Backward Design, machine d'états `formation.statutGeneration`, supports PDF, queue `formation-engine`).
   - `axionia-lms-authoring` génère du **contenu de cours e-learning** (leçons Tiptap, quiz) via les **mêmes sous-couches** (`anthropicProvider`, cost-tracker, cache, RAG) mais **un pipeline distinct, plus léger**, queues `elearning-ai`/`elearning-tutor-index`. **Ne PAS réutiliser** la machine `statutGeneration` ni la queue `formation-engine` (cf. `reutilisation-existant.md` §7).

2. **Quiz : `EvaluationAcquis`/`Questionnaire` (Qualiopi) vs `Quiz`/`Question`/`QuizAttempt` (LMS).**
   - Les premiers **stockent des résultats** Qualiopi (pré/post présentiel) — pas un moteur. Propriété `axionia-qualiopi`.
   - Le **moteur interactif** (types, tirage, gating par score) est NEUF, propriété `axionia-lms-core` (runtime) + `axionia-lms-authoring` (création). Pont possible plus tard, **sans fusion**.

3. **Certificat de réalisation.** Le **générateur PDF** (`@react-pdf/renderer`, `DocumentGenere`, QR) est mutualisé. La **parité de modèle** vient du Qualiopi existant. Mais **qui décide du contenu légal** (heures en centièmes, mentions obligatoires) du certificat e-learning = `axionia-foad-conformite` ; **qui l'émet techniquement** au bon moment = `axionia-lms-core`.

4. **Auth.** NextAuth = `AdminUser` uniquement (jamais touché par les skills LMS). Auth apprenant = système **séparé** (ADR-LMS-0001), propriété `axionia-lms-core`. Aucun skill LMS ne modifie `src/server/auth/**` NextAuth.

### 6.3 Briques existantes mutualisées (réutilisées par les 3 skills, jamais dupliquées)

R2 (`src/lib/r2-storage.ts`), Stripe (gated), `DocumentGenere`+QR, console admin (`AdminPageShell`, `admin-nav.ts` → groupe `elearning`, sidebar montée = `AdminSidebarNav.tsx`), RBAC `_guards.ts`, emails Nodemailer+BullMQ (`enqueueEmail`, templates `elearning-*.tsx`), `pricing.ts` (SSOT prix), BullMQ (`queues.ts`/`connection.ts`/`worker.ts`), `pii-crypto`, RAG knowledge, sous-couches IA du Formation Engine, `Trainee`/`Enrollment`/`Client`/`PortailAcces`/`Formation`. **Toute duplication d'une de ces briques est un bug de conception** (cf. `02-ARCHITECTURE/reutilisation-existant.md`).

---

## 7. Règle de routage (quel skill activer)

```
La tâche touche du contenu présentiel/live, l'émargement, le BPF, les 22 indicateurs
globaux, convention/attestation/facture, le Formation Engine présentiel ?
   → axionia-qualiopi  (existant — ne pas recréer)

Sinon, c'est du e-learning asynchrone (LMS). Affiner :

  • Créer/éditer le contenu d'un cours, builder, blocs, upload, banque de questions,
    quiz-gen IA, tuteur RAG, aperçu as-student, publication ?
      → axionia-lms-authoring

  • Preuves FOAD, indicateurs Qualiopi FOAD (1/6/9/10/11/12/17/19), modèle légal du
    certificat, heures en centièmes, EDOF/CPF readiness, conservation RGPD, export OPCO ?
      → axionia-foad-conformite

  • Tout le reste du runtime LMS : data model, auth apprenant, octroi/import, player,
    progression, déverrouillage, passage de quiz/gating, vidéo, workers, espace apprenant,
    émission technique du certificat ?
      → axionia-lms-core  (skill par défaut LMS)

Banque d'images / galerie SEO ?  → axionia-image-bank  (existant)
```

> Les skills LMS sont **composables** : une grosse tranche verticale (ex. « livrer le quiz bloquant ») peut mobiliser `axionia-lms-authoring` (créer le quiz) puis `axionia-lms-core` (le jouer/gater) puis `axionia-foad-conformite` (prouver l'Ind. 11). Activer le skill **dominant** de la tâche en cours ; basculer quand la nature change.

---

## 8. Contrat commun aux trois skills (hérité du codebase)

Repris de `axionia-qualiopi` et adapté LMS — à inscrire dans chaque `SKILL.md` (corps + `reference/01`) :

1. **Le code réel fait foi.** Vérifier dans le code `axionia` avant chaque tranche. Ordre d'autorité : code vivant > docs `_LMS-ELEARNING/` > skill.
2. **Stack imposée.** Prisma (pas SQL brut), Server Actions (pas REST `/api/v1`), NextAuth (admin only), BullMQ, @react-pdf/renderer, nodemailer, next-intl FR canonique, Tailwind v4 `@theme`. Réutiliser les briques (§6.3).
3. **Non destructif & resumable.** Migrations **additives** uniquement, colonnes ajoutées **nullable** (ADR-LMS-0008). Respect du contrat de build `stub.invalid` (pages LMS derrière auth + `force-dynamic` ; services stub-aware). Travail sur branche `feat/lms-elearning` ; jamais de push `main` sans accord (push = deploy).
4. **Zéro valeur en dur.** Prix via `pricing.ts`, paramètres via `SiteSetting`, couleurs via tokens, mentions légales centralisées.
5. **Conformité & qualité prouvées.** Chaque feature reliée à un test (Vitest, mock Prisma) ; Web Vitals respectés (risque INP sur player/quiz) ; WCAG 2.2 AA (EAA 28/06/2025) ; idempotence des workers (jobId déterministe, marqueurs « déjà fait »).

**STOP & ASK** (ne jamais deviner) : migration destructive, régression Web Vitals sur les 15 pages stratégiques, doute sur une mention légale/conformité FOAD, modification du contrat `stub.invalid`, activation d'un flag à impact financier (`STRIPE_ENABLED`, `EDOF_ENABLED`), choix vidéo Cloudflare Stream vs Bunny (résidence UE).

---

## 9. Plan de création des skills (ordre conseillé)

1. **`axionia-lms-core`** d'abord (fondations runtime + data model = dépendance de tout le reste, cf. roadmap MVP).
2. **`axionia-foad-conformite`** en parallèle/juste après (transversal dès le data model : les preuves se câblent en même temps que les modèles — roadmap §MVP lot 9).
3. **`axionia-lms-authoring`** ensuite (builder minimal en MVP lot 8, abouti en V1).

Pour chacun : créer `axionia/.claude/skills/<nom>/SKILL.md` (frontmatter §2.2 + corps : quand l'utiliser / ne pas l'utiliser, table `reference/`, les 5 lois §8, boucle autopilot, STOP & ASK, démarrage rapide) + le `reference/` bundle (§3.5/§4.5/§5.5) **pointant vers `_LMS-ELEARNING/`** (ne pas dupliquer).

---

## Liens

- `00-INDEX/README.md` — index maître du dossier LMS.
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 (auth) à 0008 (migrations additives) : socle des trois skills.
- `02-ARCHITECTURE/reutilisation-existant.md` — carte anti-duplication détaillée (briques réutilisées, frontières).
- `03-DATA-MODEL/01..06` — modèles possédés par `axionia-lms-core`.
- `04-BACKEND/03-workers-bullmq-crons.md` — workers `elearning-*` (core + authoring + foad).
- `04-BACKEND/08-ia-pedagogique-generation.md`, `09-tuteur-rag-assistant.md` — IA possédée par `axionia-lms-authoring`.
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — Course Builder (`axionia-lms-authoring`).
- `08-CONFORMITE/01..06` — périmètre de `axionia-foad-conformite`.
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — ordre de livraison aligné sur l'ordre de création des skills.
- `axionia/.claude/skills/axionia-qualiopi/SKILL.md` — modèle de format + skill voisin (présentiel/Qualiopi).
- `.claude/skills/axionia-image-bank/SKILL.md` — autre skill voisin (galerie/SEO).
- À créer : `skill-axionia-lms-core.md`, `skill-axionia-lms-authoring.md`, `skill-axionia-foad-conformite.md` (specs détaillées de chaque `SKILL.md`, dans ce même dossier `10-SKILLS/`).
