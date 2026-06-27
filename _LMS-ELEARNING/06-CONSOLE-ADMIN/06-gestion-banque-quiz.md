# Console admin — Gestion de la banque de quiz

Outil **auteur** de la console admin Axion-IA pour : créer/éditer des **questions** (12 types), les organiser en **banques réutilisables**, composer des **quiz** (questions épinglées + **tirage aléatoire N parmi M**), régler tous les **paramètres** (tentatives, seuil de réussite, pondération, feedback, shuffle, timer), **générer des questions par IA** avec **relecture humaine obligatoire**, **prévisualiser « comme un apprenant »**, et **corriger manuellement** les questions ouvertes (essai/upload).

> **Lire d'abord** (sources de vérité — ce doc s'y conforme, ne les redéfinit pas) :
>
> - `03-DATA-MODEL/03-schema-quiz-evaluations.md` — **tous** les modèles/enums/champs (`QuizBank`, `Question`, `QuestionChoice`, `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAttemptAnswer`, payloads §5, scoring §6, projection `EvaluationAcquis` §10). **Ce doc-ci ne réinvente aucun champ** : il spécifie l'**UX** et les **server actions** qui pilotent ce schéma.
> - `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningLesson.quizId`, `ElearningModule/Lesson.unlock*` (gating par score).
> - `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0007 (cloisonnement code), ADR-LMS-0008 (migrations additives), ADR-0006 (tracking xAPI-like).
> - `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — outil auteur des cours (le quiz s'y rattache via une `ElearningLesson type=quiz`).

**Statut de phasage** (cf. `11-ROADMAP/01-phasage-mvp-v1-v2.md`) : un **moteur de quiz minimal** (création directe, types essentiels, seuil, gating) est **MVP**. La **banque réutilisable**, le **tirage aléatoire**, **tous les types** et l'**assist IA quiz-gen** sont **V1**. Ce document décrit la **cible V1 complète** en signalant `[MVP]` / `[V1]` / `[V2]` à chaque bloc.

---

## 1. Réutilisation de l'existant (anti-duplication)

| Brique EXISTANTE                                                                                                                                                           | Réutilisation dans l'outil auteur quiz                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminPageShell` / `AdminPageHeader` / `AdminTable` / `AdminBadge` / `StatCard` (`src/components/admin/ui/**`)                                                             | **Toutes** les pages de liste & détail. Aucune nouvelle primitive UI admin.                                                                                                                                             |
| `admin-nav.ts` (SSOT navigation) + **`AdminSidebarNav.tsx`** (⚠️ c'est le composant **réellement monté**, pas `AdminSidebar.tsx`)                                          | Ajout des entrées sous le pôle e-learning (cf. §3).                                                                                                                                                                     |
| RBAC `_guards.ts` (`requireAdminRead/Write/Publish/Delete`, rôles `super_admin/admin/editor/reader`)                                                                       | Garde de **toutes** les server actions (cf. §5). Aucun nouveau système d'autorisation.                                                                                                                                  |
| `r2-storage.ts` : `uploadToR2()` (`:103`), `getSignedUrlR2()` (`:133`), `getSignedUploadUrlR2()` (`:156`)                                                                  | Médias d'énoncé (image/audio), images `zone_cliquable`, et **fichiers rendus** des questions `upload`/`essai`. Upload direct navigateur via URL présignée. **Pas de streaming** (vidéo = Cloudflare Stream, hors quiz). |
| Formation Engine IA (`qualiopi-formation-engine-worker.ts`) : `runAdversarialCritique()` (`:51`), `evaluateQuality`, `CacheIa`, `GrilleQualiteConfig`, `@anthropic-ai/sdk` | **Modèle de référence** pour l'IA quiz-gen `[V1]` : même pattern (génération → critique adverse → grille qualité → cache), même SDK. RAG `knowledge` existant pour l'ancrage document-grounded.                         |
| `EvaluationAcquis` (`schema.prisma:5653`), enum `EvaluationType` (`:5630`), `NiveauAcquisition` (`:5637`)                                                                  | **Preuve Qualiopi canonique** : un quiz `genereEvaluationAcquis=true` projette une ligne via `projection-evaluation.ts` (doc 03 §10). L'outil auteur **configure** ce lien, il ne duplique pas la preuve.               |
| `DocumentGenere` + `qrToken` (`:5507`)                                                                                                                                     | Relevé/corrigé PDF d'une tentative high-stakes (réutilisé, aucun nouveau modèle PDF).                                                                                                                                   |
| `email-worker.ts` + templates React Email Nodemailer                                                                                                                       | Notifs « quiz à corriger » / « résultat disponible » (cf. §12). Pas de service emailing tiers.                                                                                                                          |
| `IP_HASH_SALT` (pattern existant)                                                                                                                                          | `QuizAttempt.ipHash`/`userAgentHash` (jamais d'IP en clair).                                                                                                                                                            |

**NEUF (ce document spécifie l'UX/actions ; le schéma est dans doc 03)** : pages admin Banque/Quiz/Corrections, composants `QuestionEditor`/`QuizBuilder`/`QuestionBankBrowser`/`ManualGradingPanel`/`AsStudentPreview`, server actions CRUD + IA + correction, worker `elearning-quiz-grading-worker.ts`.

---

## 2. Arborescence des fichiers (cible — ADR-LMS-0007)

```
src/app/[locale]/(admin)/[adminPrefix]/elearning/quiz/
├── banques/
│   ├── page.tsx                      # liste des banques (QuizBank)
│   ├── nouvelle/page.tsx             # créer une banque
│   └── [bankId]/
│       ├── page.tsx                  # détail banque + liste questions (QuestionBankBrowser)
│       ├── questions/
│       │   ├── nouvelle/page.tsx     # éditeur question (création)
│       │   └── [questionId]/page.tsx # éditeur question (édition)
│       └── generer-ia/page.tsx       # [V1] assistant IA quiz-gen → file de relecture
├── quiz/
│   ├── page.tsx                      # liste des quiz
│   ├── nouveau/page.tsx             # créer un quiz
│   └── [quizId]/
│       ├── page.tsx                  # QuizBuilder (composition + paramètres)
│       ├── apercu/page.tsx           # aperçu « as-student »
│       └── resultats/page.tsx        # tentatives & analytics (renvoie à 08-reporting)
├── corrections/
│   ├── page.tsx                      # file des tentatives statut=a_corriger
│   └── [attemptId]/page.tsx          # ManualGradingPanel (essai/upload)
└── actions.ts                        # server actions (cf. §10)

src/components/admin/elearning/quiz/
├── QuestionBankBrowser.tsx           # table filtrable (type/difficulté/tag/objectifRef)
├── QuestionEditor.tsx                # switch sur les 12 types (form + payloadJson)
├── editors/                          # un éditeur par type (cf. §7)
│   ├── ChoiceEditor.tsx              # qcm_mono / qcm_multi / vrai_faux
│   ├── MatchingEditor.tsx            # appariement
│   ├── ClozeEditor.tsx               # texte_a_trous / menu_deroulant
│   ├── OrderingEditor.tsx            # ordonnancement
│   ├── ShortAnswerEditor.tsx         # reponse_courte
│   ├── NumericEditor.tsx             # numerique
│   ├── EssayEditor.tsx               # essai (grille de correction)
│   ├── UploadEditor.tsx              # upload (consignes fichier)
│   └── HotspotEditor.tsx             # zone_cliquable
├── QuizBuilder.tsx                   # composition + onglet Paramètres
├── QuizQuestionPicker.tsx            # épingler des questions depuis la/les banque(s)
├── RandomDrawConfig.tsx             # tirage N parmi M (pool + filtres)
├── QuizSettingsPanel.tsx             # tentatives/seuil/pondération/feedback/shuffle/timer
├── AiQuizGenPanel.tsx                # [V1] lancer IA + file de relecture
├── AiReviewQueue.tsx                 # [V1] valider/rejeter/éditer questions IA
├── AsStudentPreview.tsx             # rend QuizPlayer en mode brouillon (no-persist)
└── ManualGradingPanel.tsx            # correction essai/upload + commentaire

src/server/elearning/quiz/            # (doc 03 §11 — services partagés)
├── quiz-authoring.ts                 # CRUD banque/question/quiz (consommé par actions.ts)
├── question-payloads.ts             # schémas Zod des shapes payloadJson (§5 doc 03)
├── scoring.ts                        # algorithmes §6 doc 03 (pur, testable)
├── quiz-runtime.ts                   # start/save/submit/resume (player)
├── unlock-engine.ts                  # gating par score (consommé par player)
├── projection-evaluation.ts         # quiz → EvaluationAcquis (doc 03 §10)
└── quiz-gen-ai.ts                    # [V1] génération document-grounded (RAG + SDK)

src/server/queue/workers/
└── elearning-quiz-grading-worker.ts  # auto-soumission expirées + post-correction + projection
```

Les pages admin sont rendues sous le segment admin existant `(admin)/[adminPrefix]` ; elles sont **derrière auth NextAuth admin** et **`force-dynamic`** → **compatibles** avec le contrat de build `stub.invalid` (jamais SSG, aucun appel DB au build).

---

## 3. Navigation admin (`src/lib/admin-nav.ts`)

Ajouter un **pôle e-learning** (nouvelle valeur `AdminNavGroup = "elearning"` + label dans `ADMIN_NAV_GROUP_LABELS`). Sous ce pôle, **3 entrées** liées au quiz (les autres entrées e-learning — Cours, Apprenants, Accès — sont spécifiées par les docs 03/04/05 de ce dossier) :

| Label                      | `href` (suffixe après `[adminPrefix]`) | Icône (lucide) | `tier`   | Badge dynamique                                          |
| -------------------------- | -------------------------------------- | -------------- | -------- | -------------------------------------------------------- |
| **Banque de questions**    | `/elearning/quiz/banques`              | `Library`      | `simple` | nb questions                                             |
| **Quiz**                   | `/elearning/quiz/quiz`                 | `ListChecks`   | `simple` | nb quiz publiés                                          |
| **Corrections en attente** | `/elearning/quiz/corrections`          | `PenLine`      | `simple` | **count `QuizAttempt.statut=a_corriger`** (rouge si > 0) |

> ⚠️ Le composant **réellement monté** est `AdminSidebarNav.tsx` (cf. mémoire chantier « admin-nav-poles-clarity »). Vérifier que les nouvelles entrées s'affichent bien dans ce composant (et pas seulement dans l'obsolète `AdminSidebar.tsx`). Le badge « Corrections » se calcule via un compteur server (revalidé) — même pattern que les badges de comptage existants.

Breadcrumbs : `admin-nav.ts` étant la SSOT, `<AdminBreadcrumbs>` résout automatiquement les libellés ; pour les segments dynamiques (`[bankId]`, `[quizId]`, `[questionId]`, `[attemptId]`) la page passe le titre réel au shell.

---

## 4. RBAC (qui peut quoi)

Mapping sur les guards existants (`_guards.ts`) — **aucun nouveau rôle** :

| Action                                                                                        | Guard                 | Rôles autorisés                  |
| --------------------------------------------------------------------------------------------- | --------------------- | -------------------------------- |
| Lister/voir banques, questions, quiz, résultats                                               | `requireAdminRead`    | tous (`reader`+)                 |
| Créer/éditer banque, question, quiz ; lancer IA quiz-gen ; **valider/éditer une question IA** | `requireAdminWrite`   | `editor`, `admin`, `super_admin` |
| Corriger manuellement une tentative (essai/upload)                                            | `requireAdminWrite`   | `editor`, `admin`, `super_admin` |
| **Publier** un quiz (le rendre actif/gating) ; **forcer un override** de déverrouillage       | `requireAdminPublish` | `admin`, `super_admin`           |
| **Supprimer** une banque/question/quiz                                                        | `requireAdminDelete`  | `super_admin`                    |

**Garde-fou suppression** : une `Question` référencée par une `QuizQuestion` est protégée (`onDelete: Restrict`, doc 03 §7.2) → l'UI propose **archiver/détacher** plutôt que supprimer. Un `Quiz` ayant des `QuizAttempt` ne se supprime pas (preuve FOAD) → **archivage** (le quiz reste lié mais sort de la composition active).

---

## 5. Page « Banque de questions » (liste des banques)

Route : `/elearning/quiz/banques` — `AdminPageShell` + `AdminPageHeader` (titre « Banque de questions », CTA **Nouvelle banque**).

**StatCards (en-tête)** : `Banques`, `Questions au total`, `Questions IA en attente de relecture` (rouge si > 0), `Questions sans objectifRef` (alerte Ind.11 douce).

**Table (`AdminTable`)** — une ligne par `QuizBank` :

| Colonne    | Source                                                         | Note                             |
| ---------- | -------------------------------------------------------------- | -------------------------------- |
| Titre      | `QuizBank.titre`                                               | lien → détail                    |
| Portée     | `courseId` null → badge **Global** ; sinon **Cours : {titre}** | scope (doc 03 §4.1)              |
| Tags       | `QuizBank.tags` (chips)                                        | thèmes/compétences               |
| Questions  | `count(questions)`                                             | + répartition par type au survol |
| Couverture | nb questions auto-corrigées / manuelles                        | aide à composer                  |
| Maj        | `updatedAt`                                                    | tri par défaut desc              |

**Filtres** : recherche plein-texte (titre/tags), portée (global vs cours), « contient des questions IA non validées ».

**Création** (`/banques/nouvelle`) : formulaire minimal — `titre`, `description`, **portée** (Global ou rattachée à un `ElearningCourse` via select), `tags`. Action `createQuizBank`.

---

## 6. Détail banque — `QuestionBankBrowser` (liste des questions)

Route : `/elearning/quiz/banques/[bankId]` — table filtrable des `Question` de la banque, CTA **Nouvelle question** et **Générer par IA** `[V1]`.

**Filtres (server-side, indexés)** : `type` (12 valeurs), `difficulte` (`facile/moyen/difficile`), `tag`, `objectifRef`, `source` (humaine vs `sourceIa=true`), statut de relecture IA. Les index `Question.type/difficulte/objectifRef/bankId` (doc 03 §4.2) couvrent ces filtres.

**Colonnes** : énoncé (tronqué), `type` (`AdminBadge` couleur par famille), `difficulte`, `points`, `objectifRef`, `correctionMode` (icône « auto » / « manuelle »), badge **IA · à relire** si `sourceIa && !valideHumain`, `updatedAt`.

**Actions par ligne** : Éditer · Dupliquer · Aperçu (mini) · Archiver · Supprimer (`super_admin`, bloqué si épinglée → propose détacher).

**Actions de masse** : ajouter tag, changer difficulté, déplacer vers une autre banque, exporter (CSV/JSON), **valider en lot** les questions IA relues.

> **Suivi de la relecture IA** : on ne crée **pas** de nouvelle colonne DB pour le statut de relecture. On réutilise `Question.sourceIa` (doc 03 §4.2) + un drapeau de validation porté par `Question.tags` (convention `tag "ia:a-relire"` retiré à la validation) **ou**, si on préfère un champ propre, **un seul** booléen additif nullable `valideHumain Boolean? @map("valide_humain")` sur `Question` (migration additive, ADR-0008). Décision dans `03-schema-quiz-evaluations.md` à trancher en revue ; **par défaut on part sur le tag** (zéro migration). Une question IA non validée est **invisible** du tirage et du picker tant qu'elle n'est pas relue (filtre applicatif `quiz-authoring.ts`).

---

## 7. Éditeur de question — les 12 types (`QuestionEditor.tsx`)

Forme commune en haut (tous types), puis un **sous-éditeur** selon `type`. Le `type` est **figé après création** s'il existe des `QuizAttemptAnswer` (sinon modifiable). Toute écriture passe par `question-payloads.ts` (Zod) — **le serveur valide à la création ET re-valide à la correction** (doc 03 §5), jamais de confiance au client.

### 7.1 Bloc commun (toutes questions)

- **Énoncé** `enonce` (markdown léger) + option **énoncé riche** `enonceJson` (blocs) ; **consigne** `consigne`.
- **Média d'appui** `mediaR2Key` (image/audio) — upload direct R2 via `getSignedUploadUrlR2` ; aperçu inline ; **alt obligatoire** (WCAG 1.1.1).
- **Pondération** `points` (défaut 1) ; **difficulté** `difficulte` ; **tags** + **`objectifRef`** (mappe vers un objectif pédagogique — **clé Ind.11**, voir §13).
- **Comportement** : `shuffleChoices`, `scoringPartiel` (selon type), `correctionMode` (auto/manuelle/mixte — auto-déduit : `essai`/`upload` ⇒ `manuelle`).
- **Pédagogie** : `feedbackCorrect`, `feedbackIncorrect`, `rationale` (explication détaillée affichée selon `FeedbackMode` du quiz).

### 7.2 Sous-éditeurs par type

| Type             | Sous-éditeur               | UX clé                                                                                                                                     | Stockage                                   | Scoring (doc 03 §6)                                |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------- | ------------ | ----------------------- |
| `qcm_mono`       | `ChoiceEditor`             | liste de `QuestionChoice`, **une** marquée `estCorrect`, feedback par option                                                               | `QuestionChoice`                           | plein si choix == unique correct                   |
| `qcm_multi`      | `ChoiceEditor`             | plusieurs `estCorrect` ; toggle **scoring partiel**                                                                                        | `QuestionChoice`                           | partiel `(justes − faux)/nbCorrects` planché 0     |
| `vrai_faux`      | `ChoiceEditor`             | 2 choix pré-remplis (Vrai/Faux)                                                                                                            | `QuestionChoice`                           | comme qcm_mono                                     |
| `appariement`    | `MatchingEditor`           | 2 colonnes (gauche/droite) reliées par `matchKey` ; ajout/retrait de paires                                                                | `QuestionChoice` (`colonne`/`matchKey`)    | partiel `pairesJustes/nbPaires`                    |
| `texte_a_trous`  | `ClozeEditor`              | éditeur d'énoncé avec **insertion de trous `{{b1}}`** ; par trou : réponses acceptées, casse/accents/trim, points                          | `payloadJson.blanks[]`                     | somme points par trou juste                        |
| `menu_deroulant` | `ClozeEditor` (mode liste) | par trou : liste fermée d'options + bonne réponse                                                                                          | `payloadJson.blanks[]` (`options`/`bonne`) | idem                                               |
| `ordonnancement` | `OrderingEditor`           | items réordonnables (drag **+ alternative clavier**) ; le bon ordre = ordre saisi ; mode `exact/kendall_tau/positions_justes`              | `payloadJson.items[]` + `scoring`          | selon mode                                         |
| `reponse_courte` | `ShortAnswerEditor`        | réponses acceptées, regex optionnelle, normalisation (casse/accents/trim), `distanceLevenshteinMax`                                        | `payloadJson`                              | match normalisé / Levenshtein / regex              |
| `numerique`      | `NumericEditor`            | valeur cible ± tolérance **ou** intervalle `[min,max]` ; unité (texte exact ou aucune)                                                     | `payloadJson`                              | `                                                  | saisi−valeur | ≤tol` (ou ∈ intervalle) |
| `essai`          | `EssayEditor`              | **grille de correction** indicative (`criteres[{libelle,pointsMax}]`) ; pas de barème auto                                                 | `payloadJson.criteres`                     | **0 auto** → `a_corriger`                          |
| `upload`         | `UploadEditor`             | consignes de rendu : `mimes` autorisés, `tailleMaxMo` ; pas de barème auto                                                                 | `payloadJson.consignesFichier`             | **0 auto** → `a_corriger` (preuve FOAD « devoir ») |
| `zone_cliquable` | `HotspotEditor`            | upload image (`imageR2Key`) + **tracé de zones** rect/cercle/polygone (coords en % du conteneur) ; `correcte` par zone ; `nbClicsAttendus` | `payloadJson.zones[]`                      | partiel `zonesJustes/nbZones`                      |

**Validation à l'enregistrement** (`question-payloads.ts`) : au moins une bonne réponse (QCM), paires complètes (appariement), tous les trous référencés présents dans l'énoncé (cloze), au moins une zone correcte (hotspot), grille non vide (essai). Erreurs affichées **inline** par champ.

**Aperçu instantané** : panneau latéral « Aperçu » qui rend la question via le **vrai** `QuestionRenderer.tsx` apprenant (`src/components/elearning/quiz/`) en mode démo (no-persist) → l'auteur voit exactement le rendu apprenant, **dont** les alternatives WCAG (cf. §11).

---

## 8. `QuizBuilder` — composition d'un quiz

Route : `/elearning/quiz/quiz/[quizId]` — 3 onglets : **Composition**, **Paramètres**, **Articulation Qualiopi**. Plus un bouton **Aperçu as-student** (§9) et **Publier** (`requireAdminPublish`).

### 8.1 Onglet Composition — 3 modes combinables (doc 03 §7.2)

1. **Épinglé** (`QuizQuestionPicker` + liste réordonnable) : choisir des `Question` depuis une/des banque(s) → crée des `QuizQuestion` (ordre maîtrisé, `pointsOverride` optionnel, `obligatoire`). Drag&drop réécrit `ordre` en transaction. Filtrage du picker par banque/type/tag/objectifRef ; **les questions IA non validées sont masquées**.
2. **Tirage aléatoire** `[V1]` (`RandomDrawConfig`) : `tirageAleatoire=true` + `poolBankId` (banque source) + `poolFiltreJson` (`{tags?, difficulte?, objectifRef?}`) + `nbQuestionsTirees` (N). L'UI affiche **« N parmi M disponibles »** (M = questions de la banque passant le filtre) et **avertit si M < N**. Le tirage réel a lieu **au démarrage de chaque tentative** (`quiz-runtime.startAttempt`) et est figé dans `QuizAttempt.questionsSnapshot`.
3. **Mixte** : un socle épinglé + un complément tiré jusqu'à N (le service complète).

Bandeau récap : nb questions effectives, total de points, répartition par type, **couverture des `objectifRef`** (utile Ind.11).

### 8.2 Onglet Paramètres (`QuizSettingsPanel`) — mappe 1:1 sur `Quiz` (doc 03 §7.1)

| Réglage UI                                 | Champ `Quiz`                                                                    | Défaut             | Notes                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------- |
| Seuil de réussite (%)                      | `seuilReussitePct`                                                              | 70                 | **vraie note** — pilote le gating par score (pas attempt-only) |
| Note sur                                   | `noteSur`                                                                       | 100                |                                                                |
| Pondération active                         | `ponderationActive`                                                             | true               | sinon chaque question = 1 pt                                   |
| Tentatives max                             | `maxTentatives`                                                                 | null (illimité)    |                                                                |
| Délai entre tentatives (s)                 | `delaiEntreTentativesSec`                                                       | null               | anti-bruteforce léger                                          |
| Mélanger les questions                     | `shuffleQuestions`                                                              | true               | anti-triche léger                                              |
| Tirage aléatoire                           | `tirageAleatoire` + `nbQuestionsTirees` + `poolBankId` + `poolFiltreJson`       | false              | cf. §8.1                                                       |
| Temps limite (s)                           | `tempsLimiteSec`                                                                | null               | **horloge serveur fait foi** (`expiresAt`)                     |
| Mode de feedback                           | `feedbackMode` (`immediat/apres_soumission/apres_reussite/apres_cloture/aucun`) | `apres_soumission` |                                                                |
| Afficher score / corrigé / bonnes réponses | `afficherScore` / `afficherCorrige` / `afficherBonnesReponses`                  | true               | high-stakes : tout off                                         |
| Finalité                                   | `finalite` (`entrainement/positionnement/evaluation/final_certificatif`)        | `evaluation`       | pilote l'articulation Qualiopi                                 |

**Aide contextuelle** : presets rapides — **« Entraînement »** (illimité, feedback immédiat, pas de preuve), **« Évaluation jalon »** (1-3 tentatives, feedback après soumission, projette `EvaluationAcquis` intermédiaire), **« Final certificatif »** (1 tentative, timer, feedback `aucun`, projette `EvaluationAcquis` finale). Un preset pré-règle les champs ; l'auteur peut ajuster.

### 8.3 Onglet Articulation Qualiopi (mappe sur doc 03 §10)

- Toggle **« Cette tentative réussie produit une preuve d'acquisition »** → `genereEvaluationAcquis`.
- Si activé : sélecteur **`evaluationType`** (`initiale/intermediaire/finale`, enum existant) — pré-rempli depuis `finalite` (positionnement→initiale, evaluation→intermediaire, final_certificatif→finale).
- Encart d'explication : « Une tentative réussie projette **une** ligne `EvaluationAcquis` (synthèse par objectif), sans dupliquer le détail. La meilleure tentative réussie fait foi. » (doc 03 §10.3).
- **Garde-fou publication** : si le cours est FOAD certifiant, il doit comporter ≥ 1 quiz `evaluation`/`final_certificatif` avec `genereEvaluationAcquis` (Ind.11 majeur — §13).

### 8.4 Publication / cycle de vie du quiz

Un quiz se compose en **brouillon** (modifiable librement). **Publier** (`requireAdminPublish`) le rend actif : utilisable par une `ElearningLesson type=quiz` et comme cible de gating (`unlockQuizId`). Après publication, **toute modification structurelle** (questions, barème) **incrémente une version logique** et **n'affecte pas** les `QuizAttempt` déjà soumises (elles gardent leur `questionsSnapshot`). Garde : on **avertit** si des tentatives `en_cours` existent au moment d'un changement (proposer d'invalider/laisser finir). **Archivage** plutôt que suppression dès qu'une tentative existe (preuve FOAD).

---

## 9. Aperçu « as-student » (`AsStudentPreview.tsx`)

Route : `/elearning/quiz/quiz/[quizId]/apercu`. Rend le **vrai** `QuizPlayer.tsx` apprenant en **mode aperçu** : tirage + shuffle simulés, timer visible, navigation, **mais aucune persistance** (`QuizAttempt`/`QuizAttemptAnswer` non écrits — `quiz-runtime` appelé en mode `dryRun`). Permet de vérifier : rendu des 12 types, alternatives WCAG, feedback selon `FeedbackMode`, calcul de score (via `scoring.ts`, déterministe), message de **verrou** simulé (gating). Bouton « Rejouer le tirage » pour voir différentes combinaisons. Disponible aussi par question (mini-aperçu §7.2).

---

## 10. Server Actions (`.../elearning/quiz/actions.ts`)

`"use server"`. Toutes les actions appellent un guard `_guards.ts` en première ligne, valident les entrées en **Zod**, délèguent à `src/server/elearning/quiz/quiz-authoring.ts` (logique métier réutilisable/testable), puis `revalidatePath`. **Aucune logique métier dans le composant.**

```ts
// — Banques —
createQuizBank(input: { titre; description?; courseId?: string|null; tags?: string[] })      // requireAdminWrite
updateQuizBank(bankId, patch)                                                                  // requireAdminWrite
deleteQuizBank(bankId)                                                                         // requireAdminDelete (bloqué si questions épinglées)

// — Questions —
createQuestion(input: { bankId; type: QuestionType; enonce; ... ; choices?; payloadJson? })    // requireAdminWrite (Zod via question-payloads.ts)
updateQuestion(questionId, patch)                                                              // requireAdminWrite (type figé si attempts existent)
duplicateQuestion(questionId, { toBankId? })                                                   // requireAdminWrite
archiveQuestion(questionId) / deleteQuestion(questionId)                                       // delete = requireAdminDelete (Restrict si épinglée)
bulkUpdateQuestions(ids[], { addTags?; difficulte?; moveToBankId? })                           // requireAdminWrite
getMediaUploadUrl({ bankId; filename; contentType })                                           // requireAdminWrite → getSignedUploadUrlR2 (média énoncé/hotspot)

// — IA quiz-gen [V1] —
generateQuestionsAi(input: { bankId; sourceLessonId?: string; nb: number; types: QuestionType[]; difficulte? }) // requireAdminWrite → enqueue elearning-quiz queue
reviewAiQuestion(questionId, { action: "valider"|"editer"|"rejeter"; patch? })                 // requireAdminWrite (sort la question du statut « à relire »)
bulkValidateAiQuestions(ids[])                                                                 // requireAdminWrite

// — Quiz —
createQuiz(input: { courseId; lessonId?; titre; finalite })                                    // requireAdminWrite
updateQuizSettings(quizId, settings)                                                           // requireAdminWrite (mappe §8.2)
setQuizQuestions(quizId, items: { questionId; ordre; pointsOverride?; obligatoire }[])         // requireAdminWrite (transaction réécrit ordre)
configureRandomDraw(quizId, { poolBankId; poolFiltreJson; nbQuestionsTirees })                 // requireAdminWrite (avertit si M<N)
configureQualiopiProjection(quizId, { genereEvaluationAcquis; evaluationType? })               // requireAdminWrite
publishQuiz(quizId) / unpublishQuiz(quizId) / archiveQuiz(quizId)                              // requireAdminPublish (check Ind.11 §13)
previewQuiz(quizId): AttemptSnapshotPreview                                                     // requireAdminRead (dryRun, no-persist)

// — Corrections manuelles —
listAttemptsToGrade(filter): QuizAttempt[]                                                     // requireAdminRead (statut=a_corriger)
gradeAttemptAnswer(answerId, { noteManuelle; correcte; commentaireCorrecteur; feedbackDonne }) // requireAdminWrite (corrigeParId = session.userId)
finalizeAttemptGrading(attemptId)                                                              // requireAdminWrite → recalcul score → enqueue projection + notif
overrideUnlock(enrollmentId, moduleId, { raison })                                             // requireAdminPublish (tracé dans metadata — doc 03 §9.3)
```

**Tracking xAPI-like** (ADR-0006) : `finalizeAttemptGrading` et la soumission émettent des statements (`graded`/`passed`/`failed`) vers `ElearningXapiStatement` (doc 02) — côté runtime, pas authoring, mais l'outil auteur expose ces traces dans `resultats/`.

---

## 11. Accessibilité de l'outil auteur (WCAG 2.2 AA — EAA UE 28/06/2025)

L'outil **auteur** est une UI admin, mais il **produit** du contenu apprenant : double exigence.

**Côté éditeur (admin)** :

- Réordonnancement (`OrderingEditor`, picker, drag des choix) : **alternative au glisser** obligatoire — boutons « monter/descendre » + champ d'ordre numérique (critère **2.5.7**).
- Cibles interactives ≥ **24×24 px** (2.5.8) ; focus visible ; navigation 100 % clavier ; libellés de champs explicites.
- `HotspotEditor` : saisie des zones aussi possible **au clavier** (coordonnées numériques), pas uniquement à la souris.

**Côté contenu produit (garde-fous d'authoring qui empêchent de créer de l'inaccessible)** :

- **Alt obligatoire** sur tout média d'énoncé/option/hotspot (blocage à l'enregistrement si vide).
- Sous-titres : pour une leçon vidéo liée, rappel d'ajouter une piste `sous_titres` (`ElearningResource.type='sous_titres'`).
- Avertissement si un quiz `final_certificatif` impose un `tempsLimiteSec` court sans alternative (rappel 2.2.x — temps ajustable).
- Le rendu apprenant (`QuestionRenderer`) garantit timer annonçable (`aria-live`), pas d'autoplay, auth accessible (3.3.8) — vérifiable via l'aperçu (§9). Détail complet : `05-FRONTEND-APPRENANT/05-mobile-accessibilite-wcag.md`.

---

## 12. Corrections manuelles (`ManualGradingPanel.tsx`) & worker

Route : `/elearning/quiz/corrections` → file des `QuizAttempt.statut=a_corriger` (questions `essai`/`upload`). `[attemptId]` ouvre le panneau de correction.

**Panneau** : pour chaque `QuizAttemptAnswer` manuelle — affichage de la réponse (`essai` : texte ; `upload` : lien de **téléchargement signé** via `getSignedUrlR2` sur `reponseJson.fichierR2Key`), **grille de correction** rappelée (depuis `payloadJson.criteres`), saisie `noteManuelle` (≤ `pointsMax`), `correcte`, `commentaireCorrecteur`, `feedbackDonne` (figé montré à l'apprenant). `corrigeParId = session.userId` (audit). « Précédent/Suivant » entre copies.

**Finalisation** (`finalizeAttemptGrading`) → recalcul du score (`scoring.ts` agrège auto + manuel) → `statut=corrige` → **enqueue** sur la queue `elearning-quiz` :

- `projection-evaluation.ts` : si `genereEvaluationAcquis`, upsert/mise à jour de la ligne `EvaluationAcquis` (doc 03 §10.3) ; débloque le **certificat** si `final_certificatif` réussi.
- `unlock-engine` recalcule le gating (la note devient définitive → modules/leçons `score_quiz` peuvent s'ouvrir).
- **Notif apprenant** « Votre résultat est disponible » via `email-worker` (template React Email Nodemailer).

**Worker** `src/server/queue/workers/elearning-quiz-grading-worker.ts` (queue `elearning-quiz`) :

1. **Auto-soumission des tentatives expirées** (cron) : `QuizAttempt.expiresAt < now ET statut=en_cours` → `statut=expire`/`soumis`, correction auto, projection.
2. **Post-correction manuelle** : déclenché par `finalizeAttemptGrading` (recalcul + projection + notif).
3. **Notif « quiz à corriger »** : quand une soumission contient des questions manuelles → email aux correcteurs (Ind.19 — délais d'assistance formalisés).

> ⚠️ Build : ce worker doit respecter `BULLMQ_DISABLED=true` au build GH Actions (pas d'init Redis au SSG). Aucun appel DB direct dans une page SSG — les pages admin quiz sont `force-dynamic`.

---

## 13. Garde-fou conformité Ind.11 (à la publication)

`publishQuiz` et la publication du **cours** (doc 01 §8) appliquent un check applicatif (`quiz-authoring.ts`) :

- Un **cours FOAD certifiant** (`ElearningCourse.estFoad`) **doit** comporter au moins un `Quiz` `finalite ∈ {evaluation, final_certificatif}` avec `genereEvaluationAcquis=true` — sinon **publication bloquée** avec message explicite (« Ind.11 : aucune évaluation jalonnante/finale — non-conformité majeure »).
- **Couverture des objectifs** : avertissement (non bloquant) si des objectifs pédagogiques du cours n'ont **aucune** question portant l'`objectifRef` correspondant (qualité de la grille de compétences projetée).
- L'**assistance pédagogique** (tutorat, délais) relève d'Ind.19 → cf. `04-BACKEND/09-tuteur-rag-assistant.md`, hors périmètre quiz mais rappelée dans le bandeau de publication.

---

## 14. IA quiz-gen + relecture humaine `[V1]` (`AiQuizGenPanel` / `AiReviewQueue`)

**Principe** : **génération assistée, jamais auto-publiée**. Toute question IA entre en **file de relecture** ; une question non validée par un humain est **invisible** du tirage/picker.

**Flux** :

1. `AiQuizGenPanel` (route `/banques/[bankId]/generer-ia`) : l'auteur choisit la **source** (`sourceLessonId` — une `ElearningLesson` du cours, **document-grounded**), le **nombre**, les **types** souhaités, la **difficulté**, l'`objectifRef` cible. → `generateQuestionsAi` enqueue un job sur la queue `elearning-quiz`.
2. `quiz-gen-ai.ts` réutilise le **RAG knowledge** existant (ancrage + citations) + `@anthropic-ai/sdk`, sur le **modèle du Formation Engine** : génération → `runAdversarialCritique` (vérif factuelle/qualité) → `evaluateQuality` (grille) → `CacheIa` (cache prompt/réponse). Les questions créées ont `sourceIa=true`, `sourceLessonId` renseigné, et le drapeau « à relire ».
3. `AiReviewQueue` : l'auteur **valide / édite / rejette** chaque question (`reviewAiQuestion`) ou **valide en lot** (`bulkValidateAiQuestions`). L'édition réutilise `QuestionEditor` (§7). À la validation, le drapeau « à relire » tombe → la question devient utilisable.

**Garde-fous** : pas d'écriture directe dans un quiz publié ; ancrage obligatoire (citations vérifiables) ; coût/quota tracés (réutilise l'observabilité IA existante). Détail moteur : `04-BACKEND/08-ia-pedagogique-generation.md`.

---

## 15. Performance & Web Vitals

Les pages admin **ne sont pas** dans les 15 pages stratégiques publiques, mais on garde l'INP saine côté auteur (éditeurs riches = risque INP) :

- Éditeurs lourds (`HotspotEditor` canvas, drag, RTE) **chargés à la demande** (`dynamic import`, code-split par type).
- Autosave **débouncé** + optimistic UI ; transactions d'ordre groupées.
- Le **player apprenant** (réutilisé en aperçu) respecte les budgets stricts (INP ≤ 100 ms ; player = composant client isolé) — cf. `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` et `09-QUALITE/03-web-vitals-performance.md`.

---

## 16. Récapitulatif — EXISTANT vs NEUF

|                                         | Éléments                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Réutilisé**                           | `AdminPageShell`/`AdminTable`/`AdminBadge`/`StatCard`, `admin-nav.ts`+`AdminSidebarNav.tsx`, `_guards.ts` (RBAC), `r2-storage.ts` (upload/signature), Formation Engine IA (`runAdversarialCritique`/`evaluateQuality`/`CacheIa`) + `@anthropic-ai/sdk` + RAG knowledge, `EvaluationAcquis`+enums `EvaluationType`/`NiveauAcquisition`, `DocumentGenere`/`qrToken`, `email-worker` + React Email, `IP_HASH_SALT`. |
| **Neuf (UX/actions ; schéma = doc 03)** | Pages admin Banque/Quiz/Corrections + sous-routes, composants `QuestionBankBrowser`/`QuestionEditor`(+9 sous-éditeurs)/`QuizBuilder`/`QuizQuestionPicker`/`RandomDrawConfig`/`QuizSettingsPanel`/`AiQuizGenPanel`/`AiReviewQueue`/`AsStudentPreview`/`ManualGradingPanel`, `actions.ts`, services `quiz-authoring.ts` (CRUD), `elearning-quiz-grading-worker.ts`.                                                |

---

## Liens

- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — **schéma source** (modèles/enums/payloads/scoring/projection) que cet outil pilote.
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningLesson.quizId`, `unlock*` (gating consommé par les quiz).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment` (clé des tentatives), `ElearningXapiStatement` (tracking).
- `04-BACKEND/08-ia-pedagogique-generation.md` — moteur IA quiz-gen document-grounded (RAG).
- `04-BACKEND/09-tuteur-rag-assistant.md` — assistance pédagogique (Ind.19).
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` — `QuizPlayer`/`QuestionRenderer` réutilisés par l'aperçu.
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique du gating par score.
- `05-FRONTEND-APPRENANT/05-mobile-accessibilite-wcag.md` — WCAG 2.2 AA du rendu apprenant.
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — où le quiz se branche dans le cours.
- `06-CONSOLE-ADMIN/08-reporting-analytics.md` — résultats/analytics des tentatives.
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — Ind.11 (évaluations), Ind.19 (assistance).
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` + `06-tracabilite-preuves-realisation.md` — preuves FOAD (attempts/uploads), conservation, CNIL (proctoring/logs).
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0006/0007/0008.
