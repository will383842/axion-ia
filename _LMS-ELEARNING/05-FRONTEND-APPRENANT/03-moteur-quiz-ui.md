# Frontend apprenant — Moteur de quiz (UI)

UI **complète** du moteur de quiz côté apprenant : rendu des **12 types de questions**, soumission, **feedback configurable** (immédiat / différé + rationale), affichage du **score**, gestion des **tentatives**, **timer serveur**, **écran de résultat** et **gating** (réussite → module/leçon suivant déverrouillé). Accessibilité **WCAG 2.2 AA** intégrée (clavier, ARIA, alternative au glisser, cibles ≥ 24 px, auth accessible, timer annonçable).

> **Lire d'abord (source de vérité, ne rien réinventer) :**
>
> - `03-DATA-MODEL/03-schema-quiz-evaluations.md` — modèles `Quiz`/`Question`/`QuizAttempt`/`QuizAttemptAnswer`, **enums** `QuestionType`/`FeedbackMode`/`QuizAttemptStatut`, **shapes `payloadJson`** (§5), **algorithmes de scoring** (§6), gating (§9). **Ce doc-ci ne fait que rendre, jamais corriger** — toute correction est serveur.
> - `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment` (identité apprenant côté quiz), `ModuleProgress.verrouRaison`/`estDeverrouille`, statements xAPI `answered`/`passed`/`failed`.
> - `01-schema-cours-modules-lecons.md` — `ElearningLesson.type=quiz` → `quizId`, `ElearningModule.unlockType=score_quiz`.
> - `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth apprenant séparée de NextAuth, cookie portail), ADR-0007 (cloisonnement `src/components/elearning/**`), ADR-0008 (additif).
> - `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — le player monte le quiz quand `lesson.type=quiz`.
> - `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique fine des verrous (ce doc consomme `verrouRaison`).

**Principe directeur (non négociable) :** _Zéro confiance au client._ La bonne réponse, le barème, le seuil, le temps restant et le verdict **n'existent jamais dans le bundle apprenant** tant qu'ils ne doivent pas être affichés. Le client envoie des **réponses brutes** ; le serveur **figne le snapshot, corrige, décide la réussite, déverrouille**. Le composant React n'est qu'un **rendu + collecteur de saisie**.

---

## 1. EXISTANT réutilisé vs NEUF

### EXISTANT (réutilisé, **non** dupliqué)

| Brique                                    | Rôle ici                                                                                                                                                           | Référence réelle                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth apprenant par cookie portail         | Identifie le `Trainee` → résout l'`ElearningEnrollment` → autorise l'attempt. **Système séparé de NextAuth** (ADR-0001).                                           | `src/server/qualiopi/portail/cookie.ts` (`getPortailToken`, cookie `portail_session` HttpOnly), `portail-service.ts` (`verifierToken(token) → { traineeId }`) |
| Route d'accès portail                     | Modèle des routes apprenant `force-dynamic` + rate-limit IP fail-open.                                                                                             | `src/app/[locale]/portail/acces/[token]/route.ts`                                                                                                             |
| `getEspaceStagiaire(traineeId)`           | Pattern de chargement des données apprenant (à étendre pour l'e-learning).                                                                                         | `portail-service.ts:205`                                                                                                                                      |
| `checkRateLimit`                          | Anti-brute-force sur `startAttempt`/`submitAttempt` (fail-open si Redis stub).                                                                                     | `src/lib/rate-limit.ts`                                                                                                                                       |
| `getSignedUploadUrlR2` / `getSignedUrlR2` | Questions `upload` (rendu fichier apprenant) + médias d'énoncé (image/audio). **Pas de streaming** (fichiers).                                                     | `src/lib/r2-storage.ts`                                                                                                                                       |
| `IP_HASH_SALT`                            | Hash IP/UA dans `QuizAttempt.ipHash`/`userAgentHash` (jamais en clair).                                                                                            | pattern image-bank                                                                                                                                            |
| Tokens design Tailwind v4 (`@theme`)      | Charte Editorial Premium Light (terracotta `#c24a1b`, bleu `#1a4dd9`, ivoire `#faf8f3`, mocha `#2a2520`, Manrope/Fraunces/Inconsolata). **Aucune couleur en dur.** | `globals.css` / `@theme`                                                                                                                                      |
| React Email + `email-worker`              | « Résultat disponible » / « quiz à corriger ».                                                                                                                     | `src/server/queue/workers/email-worker.ts`                                                                                                                    |

### NEUF (ce document — `src/components/elearning/quiz/**` + actions apprenant)

Composants `QuizPlayer`, `QuestionRenderer` (switch 12 types) et ses 8 sous-renderers, `QuizTimer`, `QuizResult`, `AttemptGate`, `QuizIntro` ; le hook d'autosave `useQuizAttempt` ; les **server actions apprenant** `startAttempt`/`saveAnswer`/`submitAttempt`/`resumeAttempt` ; les **DTO de transport** (snapshot public sans réponses). Le **scoring/correction reste backend** (`03-DATA-MODEL/03` §6) — rien de neuf ici côté logique de note.

---

## 2. Frontière de sécurité : ce qui transite (DTO)

Le navigateur ne reçoit **jamais** `QuestionChoice.estCorrect`, `matchKey`, `payloadJson.*.bonne/reponses/valeur/zones.correcte`, ni le `feedback`/`rationale` avant l'instant autorisé par `Quiz.feedbackMode`.

### 2.1 `AttemptPublicDTO` (rendu d'une tentative en cours)

Construit côté serveur dans `quiz-runtime.ts` (`startAttempt`/`resumeAttempt`) à partir de `QuizAttempt.questionsSnapshot`. Type partagé : `src/server/elearning/quiz/dto.ts`.

```ts
// src/server/elearning/quiz/dto.ts
export interface AttemptPublicDTO {
  attemptId: string;
  quiz: {
    titre: string;
    consigne: string | null;
    finalite: "entrainement" | "positionnement" | "evaluation" | "final_certificatif";
    feedbackMode: "immediat" | "apres_soumission" | "apres_reussite" | "apres_cloture" | "aucun";
    noteSur: number;
    seuilReussitePct: number; // affichable (objectif), PAS le verdict
    afficherScore: boolean;
    afficherCorrige: boolean;
    afficherBonnesReponses: boolean;
  };
  // Temps : on n'envoie QUE expiresAt (ISO). Le client n'a jamais "tempsRestant"
  // calculé localement comme source de vérité — il l'affiche, le serveur tranche.
  tempsLimiteSec: number | null;
  expiresAt: string | null; // ISO ; null = sans limite
  serverNow: string; // ISO ; ancre l'horloge client au démarrage
  numeroTentative: number;
  maxTentatives: number | null;
  statut: "en_cours"; // un DTO de rendu est forcément en_cours
  // Questions ordonnées + options mélangées, SANS aucune bonne réponse :
  questions: QuestionPublicDTO[];
  // Réponses déjà sauvegardées (reprise auto) : map questionId -> reponseJson brute apprenant.
  reponsesSauvegardees: Record<string, unknown>;
}

export interface QuestionPublicDTO {
  questionId: string;
  ordre: number;
  type: QuestionType; // 12 valeurs (doc 03 §3)
  enonce: string; // markdown léger
  enonceJson: unknown | null; // blocs riches optionnels
  consigne: string | null;
  mediaUrl: string | null; // URL signée R2 résolue côté serveur (jamais la r2Key)
  points: number; // pointsOverride ?? Question.points (info, pas barème caché)
  // Données de RENDU par type, expurgées de toute solution :
  choices?: ChoicePublicDTO[]; // qcm_*, vrai_faux, appariement (sans estCorrect/matchKey révélé)
  payloadPublic?: unknown; // shape épurée (cf. §4 par type)
}

export interface ChoicePublicDTO {
  choiceId: string;
  libelle: string;
  mediaUrl: string | null;
  colonne?: "gauche" | "droite"; // appariement : on garde la colonne, PAS la matchKey
}
```

> **Règle de construction du snapshot public** (serveur) : pour `appariement`, la colonne droite est mélangée et `matchKey` retirée ; pour `texte_a_trous`/`reponse_courte`/`numerique`, `payloadPublic` ne contient que la **structure** (ids de trous, unité, placeholder) — **jamais** `reponses`/`valeur`/`tolerance`/`regex`. Pour `menu_deroulant`, on envoie les `options` de chaque trou (nécessaires au rendu) mais **pas** `bonne`. Pour `zone_cliquable`, on envoie `imageUrl` (signée) **sans** `zones[].correcte`.

### 2.2 `AttemptResultDTO` (écran de résultat — après correction auto)

Renvoyé par `submitAttempt`. Le **détail par question (corrigé)** n'est inclus **que si** `feedbackMode` l'autorise à cet instant (cf. §7).

```ts
export interface AttemptResultDTO {
  attemptId: string;
  statut: "soumis" | "a_corriger" | "expire"; // 'corrige' arrive plus tard (worker)
  // Score : présent seulement si afficherScore ET feedbackMode le permet maintenant.
  score: null | {
    scoreBrut: number;
    scoreMax: number;
    scorePct: number; // arrondi serveur
    noteSur: number; // ex. note ramenée /20 ou /100
    reussite: boolean | null; // null si a_corriger (manuel non noté)
  };
  // Détail corrigé par question (présent selon feedbackMode + afficherCorrige) :
  corrige: null | QuestionCorrigeeDTO[];
  // Tentatives restantes / délai avant re-essai (anti-bruteforce serveur).
  tentativesRestantes: number | null; // null = illimité
  prochaineTentativeAt: string | null; // ISO si délaiEntreTentativesSec actif
  // Gating : ce que cette tentative a déverrouillé (consommé par le player).
  gating: {
    aDeverrouille: boolean;
    moduleSuivantId: string | null;
    lessonSuivanteId: string | null;
    messageReussite: string | null; // "Module 2 déverrouillé"
    messageEchec: string | null; // "Atteignez 70 % pour débloquer le module 2 (votre meilleur score : 55 %)"
  };
  // Si a_corriger : message d'attente correction manuelle (essai/upload).
  attenteCorrectionManuelle: boolean;
}

export interface QuestionCorrigeeDTO {
  questionId: string;
  correcte: boolean | null; // null = en attente correction manuelle
  pointsObtenus: number | null;
  pointsMax: number;
  reponseApprenant: unknown; // ce qu'il a saisi (sa réponse brute)
  // Révélés UNIQUEMENT si afficherBonnesReponses=true ET feedbackMode l'autorise :
  bonneReponse?: unknown; // choiceIds corrects / ordre attendu / valeur / etc.
  feedback?: string | null; // feedbackCorrect/feedbackIncorrect figé (QuizAttemptAnswer.feedbackDonne)
  rationale?: string | null; // explication détaillée
}
```

---

## 3. Architecture des composants (`src/components/elearning/quiz/`)

```
QuizIntro.tsx            (serveur)  écran avant-démarrage : règles, tentatives, durée, bouton "Commencer"
QuizPlayer.tsx           (client)   chef d'orchestre d'une tentative : state machine + autosave + timer + soumission
 ├─ QuizTimer.tsx        (client)   compte à rebours basé serveur (expiresAt) ; aria-live ; auto-submit à 0
 ├─ QuestionNav.tsx      (client)   pagination / liste des questions (état répondu, marquée, non vue)
 ├─ QuestionRenderer.tsx (client)   switch(type) → un sous-renderer ; gère label/aria/erreur de saisie
 │   ├─ ChoiceQuestion.tsx     qcm_mono | qcm_multi | vrai_faux            (radio/checkbox natifs)
 │   ├─ MatchingQuestion.tsx   appariement                                  (select alternatif au drag)
 │   ├─ ClozeQuestion.tsx      texte_a_trous | menu_deroulant               (input / select inline)
 │   ├─ OrderingQuestion.tsx   ordonnancement                               (boutons monter/descendre = alt drag)
 │   ├─ ShortAnswerQuestion.tsx reponse_courte | numerique                  (input texte/number + unité)
 │   ├─ EssayQuestion.tsx      essai                                        (textarea + compteur)
 │   ├─ UploadQuestion.tsx     upload                                       (R2 direct PUT presigné)
 │   └─ HotspotQuestion.tsx    zone_cliquable                               (image + clics + alt clavier)
 ├─ FeedbackInline.tsx   (client)   feedback immédiat (mode immediat) sous la question
 └─ QuizResult.tsx       (client)   écran de résultat : score, jauge, corrigé, gating, actions
AttemptGate.tsx          (serveur)  garde : accès autorisé ? tentatives épuisées ? délai ? verrou amont ?
useQuizAttempt.ts        (hook)     state local + autosave debounced + reconciliation reprise + soumission
```

**`"use client"` minimal (budget Web Vitals).** Seuls `QuizPlayer` et ses enfants interactifs sont client. `QuizIntro` et `AttemptGate` sont **Server Components** (lecture DB derrière auth, `force-dynamic`). Le bundle quiz est **chargé dynamiquement** (`next/dynamic`) par le player de cours **uniquement** quand `lesson.type=quiz` → il ne pèse jamais sur les leçons vidéo/texte. Cible : ce chunk hors budget des 15 pages stratégiques publiques (page derrière auth), mais on vise quand même **INP ≤ 100 ms** sur la saisie et **CLS = 0** (réservation d'espace pour timer/feedback).

---

## 4. Rendu des 12 types (contrat UI + accessibilité par type)

Pour **chaque** type : ce que reçoit le renderer (`QuestionPublicDTO`), comment il rend, la forme de la **réponse brute** émise (qui doit matcher `QuizAttemptAnswer.reponseJson`, doc 03 §8.2), et les exigences WCAG.

> **Invariant transverse :** chaque question est un `<fieldset>` avec `<legend>` = énoncé ; `aria-describedby` pointe `consigne` + `points` ; l'état d'erreur de saisie (champ vide à la soumission, format invalide) est annoncé via `aria-invalid` + message lié `aria-errormessage`. Focus visible (`:focus-visible` token), navigation 100 % clavier, ordre de tabulation logique (2.4.3), cible tactile **≥ 24 px** (2.5.8).

### 4.1 `qcm_mono` / `vrai_faux` — `ChoiceQuestion`

- **Rend :** `<fieldset role="radiogroup">` + `<input type="radio">` natifs (un par `choices[]`), label cliquable, média optionnel. `vrai_faux` = exactement 2 choix (Vrai/Faux) — même renderer.
- **Réponse brute :** `{ choiceIds: ["<choiceId>"] }` (tableau d'un élément pour homogénéité).
- **A11y :** radios natifs = navigation flèches + sélection clavier gratuite. Pas de div-en-radio. `aria-required` sur le groupe.

### 4.2 `qcm_multi` — `ChoiceQuestion` (mode multi)

- **Rend :** `<input type="checkbox">` natifs. `consigne` par défaut « Sélectionnez toutes les bonnes réponses ». Indicateur visuel du nombre sélectionné (sans révéler le nombre attendu).
- **Réponse brute :** `{ choiceIds: ["id1","id3", …] }`.
- **A11y :** group `role="group"` + legend ; chaque checkbox label associé ; `aria-describedby` rappelle qu'il peut y avoir plusieurs réponses.

### 4.3 `appariement` — `MatchingQuestion`

- **Rend :** colonne **gauche** (items fixes) ; pour chaque item gauche, un **`<select>`** listant les libellés de la colonne **droite** (mélangée). **Le `<select>` est l'alternative accessible au glisser-déposer** (WCAG **2.5.7**). Un mode drag&drop **optionnel** peut être superposé pour la souris, mais le `<select>` reste toujours présent et suffisant.
- **Réponse brute :** `{ paires: [{ gaucheId, droiteId }] }`.
- **A11y :** chaque `<select>` a un label « Associer à : <libellé gauche> ». Aucune fonctionnalité accessible **uniquement** au pointeur.

### 4.4 `texte_a_trous` — `ClozeQuestion`

- **Rend :** l'énoncé contient des marqueurs `{{b1}}`, `{{b2}}` ; on parse `enonce` et on remplace chaque marqueur par un `<input type="text">` inline dimensionné, avec `<label class="sr-only">` « Trou b1 ». `payloadPublic` ne donne que `blanks:[{id, placeholder?}]`.
- **Réponse brute :** `{ blanks: { b1: "…", b2: "…" } }`.
- **A11y :** chaque trou a un label nommé ; ordre de tab = ordre de lecture ; `inputmode` adapté.

### 4.5 `menu_deroulant` — `ClozeQuestion` (mode select)

- **Rend :** comme 4.4 mais chaque trou est un `<select>` dont les `options` viennent de `payloadPublic.blanks[i].options` (envoyées **sans** `bonne`).
- **Réponse brute :** `{ blanks: { b1: "<option choisie>" } }`.
- **A11y :** `<select>` natif, label nommé par trou.

### 4.6 `ordonnancement` — `OrderingQuestion`

- **Rend :** liste verticale d'items. **Réordonnancement accessible** par des boutons **« Monter » / « Descendre »** sur chaque item (alternative clavier au drag — **2.5.7**), avec `aria-live="polite"` annonçant « Item déplacé en position N sur M ». Drag&drop souris **optionnel** en surcouche.
- **Réponse brute :** `{ ordre: ["i2","i1","i3"] }` (ids dans l'ordre courant de l'apprenant).
- **A11y :** chaque bouton ≥ 24 px ; focus conservé sur l'item déplacé ; jamais de drag-only.

### 4.7 `reponse_courte` — `ShortAnswerQuestion`

- **Rend :** `<input type="text">` (ou textarea courte) + compteur de caractères doux. Aucune normalisation/validation de justesse côté client (le serveur normalise : casse/accents/Levenshtein, doc 03 §5).
- **Réponse brute :** `{ texte: "…" }`.

### 4.8 `numerique` — `ShortAnswerQuestion` (mode numérique)

- **Rend :** `<input type="number" inputmode="decimal">` + suffixe **unité** (depuis `payloadPublic.unite`, ex. « % »). Pas de validation de tolérance côté client.
- **Réponse brute :** `{ valeur: 42, unite: "%" }`.
- **A11y :** unité dans le label/`aria-describedby` (pas seulement visuelle) ; séparateur décimal localisé FR.

### 4.9 `essai` — `EssayQuestion`

- **Rend :** `<textarea>` auto-grow + compteur mots/caractères + sauvegarde auto (autosave). Bandeau « Cette réponse sera corrigée manuellement par un formateur ». Affiche la **grille indicative** si `payloadPublic.criteres` est fourni (lecture seule).
- **Réponse brute :** `{ texte: "…" }`.
- **Correction :** **manuelle** (worker `elearning-quiz-grading-worker`) → la tentative passe `a_corriger`, pas de gating immédiat (doc 03 §6).

### 4.10 `upload` — `UploadQuestion`

- **Rend :** zone de dépôt + bouton « Choisir un fichier ». Upload **direct navigateur → R2** via `getSignedUploadUrlR2` (PUT presigné, ne transite pas par Next — gros fichiers OK). Affiche progression, nom, taille, mime ; bornes `payloadPublic.consignesFichier.{mimes,tailleMaxMo}` validées **client (UX) + serveur (sécurité)**.
- **Réponse brute :** `{ fichierR2Key, nomOriginal, mime, tailleOctets }` (la clé R2 obtenue après PUT réussi).
- **A11y :** input file natif accessible ; statut d'upload via `aria-live` ; messages d'erreur liés.
- **Correction :** manuelle (preuve « devoir » FOAD, R.6313-3).

### 4.11 `zone_cliquable` — `HotspotQuestion`

- **Rend :** image (URL signée R2) ; clic = pose un marqueur (coordonnées en **% du conteneur**, indépendant du zoom/responsive). **Alternative clavier obligatoire (2.5.7)** : une **grille de zones nommées** navigable au clavier (boutons « Zone A », « Zone B »…) permet de sélectionner sans pointer ; sinon, saisie de coordonnées via champs. `nbClicsAttendus` borne le nombre de marqueurs (sans dire lesquels sont bons).
- **Réponse brute :** `{ clics: [{ x, y }] }` (pourcentages).
- **A11y :** ne jamais dépendre uniquement de la souris ; `alt` descriptif de l'image ; focus visible sur les marqueurs.

### 4.12 Récap correction

- **Auto** (client n'a aucun barème) : 4.1–4.8, 4.11. Feedback possible **immédiat** ou différé.
- **Manuelle** : 4.9 `essai`, 4.10 `upload` → `a_corriger` → notif quand corrigé (worker + email). Le feedback de ces questions **n'apparaît jamais en mode `immediat`** (rien à corriger en direct).

---

## 5. Cycle de vie d'une tentative (state machine client + actions serveur)

### 5.1 Server Actions apprenant (`src/server/elearning/quiz/learner-actions.ts`)

**Auth :** chaque action lit `getPortailToken()` → `verifierToken()` → `traineeId`, puis résout l'`ElearningEnrollment` (statut `actif`) du cours du quiz. **Aucune** dépendance NextAuth (ADR-0001). Toute action est `"use server"`, rate-limitée (`checkRateLimit`, fail-open), et **idempotente** où c'est possible.

| Action                                           | Entrée        | Sort               | Logique serveur (déléguée à `quiz-runtime.ts`, doc 03 §11)                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startAttempt(quizId)`                           | quizId        | `AttemptPublicDTO` | Vérifie droit d'accès + `maxTentatives` + `delaiEntreTentativesSec` + verrou amont. Tire N parmi M (si `tirageAleatoire`), shuffle questions+options, **fige `questionsSnapshot`**, pose `startedAt`/`expiresAt`, hash IP/UA. Si une tentative `en_cours` non expirée existe → la **renvoie** (reprise, pas de doublon).                                  |
| `resumeAttempt(attemptId)`                       | attemptId     | `AttemptPublicDTO` | Recharge le snapshot figé + `reponsesSauvegardees` ; recalcule `serverNow`/`expiresAt`. Refuse si statut ≠ `en_cours` ou expiré.                                                                                                                                                                                                                          |
| `saveAnswer(attemptId, questionId, reponseJson)` | réponse brute | `{ ok, savedAt }`  | **Autosave**. Valide la **shape** (Zod, `question-payloads.ts`) — **pas la justesse**. Upsert `QuizAttemptAnswer.reponseJson`. Refuse si expiré (renvoie `{ expired: true }` → le client soumet).                                                                                                                                                         |
| `submitAttempt(attemptId)`                       | attemptId     | `AttemptResultDTO` | Verrou anti-double-submit (transaction + statut). Lance la **correction auto serveur** (`scoring.ts`), calcule `scorePct`/`reussite`, passe `soumis` ou `a_corriger`, déclenche **gating** (`unlock-engine`) + projection EvaluationAcquis si configuré, émet statements `answered`/`passed`/`failed`. Renvoie le résultat **filtré par `feedbackMode`**. |
| `getResult(attemptId)`                           | attemptId     | `AttemptResultDTO` | Relit un résultat (ex. après correction manuelle) en respectant `feedbackMode` au moment de la lecture.                                                                                                                                                                                                                                                   |

> Le **heartbeat de leçon** (temps passé) reste géré par `progress-actions.ts` (doc 02) ; le quiz n'émet que ses propres statements. Le temps **passé sur le quiz** est mesuré serveur (`startedAt` → `submittedAt`).

### 5.2 State machine `QuizPlayer` (client)

```
            startAttempt / resumeAttempt
   idle ──────────────────────────────────▶ answering
                                              │  saveAnswer (debounced, autosave)
                                              │  navigation entre questions
                                              │  timer (expiresAt) → tick aria-live
                                              ▼
                                          (timer == 0)  ── auto ── submitAttempt
                                              │ clic "Terminer"
                                              ▼
                                          submitting ──▶ result
                                                          │ (a_corriger) → "En attente de correction"
                                                          │ (réussi)     → CTA "Continuer" (gating)
                                                          │ (échec + tentatives) → "Réessayer" (respecte délai)
                                                          └ (échec + 0 tentative) → message + recours/contact tuteur
```

- **`useQuizAttempt`** garde l'état local des réponses, **debounce 800 ms** l'autosave par question, **reconcilie** au montage avec `reponsesSauvegardees` (reprise après refresh/réseau coupé). En cas d'échec réseau d'un `saveAnswer`, retry exponentiel + drapeau « non sauvegardé » (jamais de perte silencieuse).
- **Anti-perte :** `beforeunload` averti si réponses non sauvegardées ; à la soumission on **force un flush** de tous les `saveAnswer` en attente avant `submitAttempt`.
- **Soumission protégée :** bouton désactivé pendant `submitting` ; idempotence serveur (re-submit renvoie le même `AttemptResultDTO`).

---

## 6. Timer serveur (anti-triche léger — l'horloge serveur fait foi)

- **Source de vérité = serveur.** `startAttempt` renvoie `expiresAt` (ISO) + `serverNow` (ISO). Le client calcule l'offset `clientNow − serverNow` au démarrage et affiche `restant = expiresAt − (Date.now() − offset)`. **Le client ne décide jamais** de l'expiration ; il déclenche `submitAttempt` à 0, mais **le serveur re-vérifie** (`expiresAt` dépassé → tentative `expire`, auto-soumission, correction du déjà-répondu).
- **`QuizTimer.tsx` :** `aria-live="polite"` mis à jour à intervalles **espacés** (toutes les 60 s puis toutes les 10 s sous 1 min, puis chaque seconde sous 10 s) pour ne pas spammer les lecteurs d'écran ; `role="timer"`. Avertissements visuels **et** annoncés à T-5 min / T-1 min. **Jamais** de couleur seule pour l'urgence (texte + icône — 1.4.1).
- **Triche par horloge :** modifier l'heure locale n'aide pas (serveur tranche). Modifier le DOM du timer n'aide pas (serveur tranche). Laisser l'onglet ouvert → `expiresAt` atteint → auto-`expire` au prochain `saveAnswer`/`submit` ou par le **cron** `elearning-quiz-grading-worker` (auto-soumission des `en_cours` expirés, doc 03 §11).
- **Sans limite :** `tempsLimiteSec = null` → pas de `QuizTimer`, pas d'`expiresAt`.

---

## 7. Feedback configurable (`FeedbackMode`) — matrice de ce qui s'affiche quand

Mappe l'enum `FeedbackMode` (doc 03 §3) + les flags `afficherScore`/`afficherCorrige`/`afficherBonnesReponses` (`Quiz`). **C'est le serveur qui décide** ce qu'il met dans `AttemptResultDTO` ; le client n'affiche que ce qu'il reçoit.

| `feedbackMode`     | Pendant la saisie                                                                                                                                                | À la soumission (`submitAttempt`)                                                                                                                                  | Plus tard (`getResult`)        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `immediat`         | **Après chaque réponse** : correct/incorrect + `feedback*` + `rationale` (auto-correctibles uniquement ; `FeedbackInline.tsx`). Réservé `finalite=entrainement`. | Score (si `afficherScore`) + corrigé complet                                                                                                                       | idem                           |
| `apres_soumission` | Aucun (saisie neutre)                                                                                                                                            | Score + corrigé (selon `afficher*`)                                                                                                                                | idem                           |
| `apres_reussite`   | Aucun                                                                                                                                                            | Score ; **corrigé seulement si `reussite=true`**. Si échec : score + invitation à réessayer, **sans** dévoiler les bonnes réponses (anti-mémorisation du corrigé). | corrigé révélé une fois réussi |
| `apres_cloture`    | Aucun                                                                                                                                                            | Score éventuel mais **corrigé masqué** jusqu'à la date de clôture / fin de session                                                                                 | corrigé après clôture          |
| `aucun`            | Aucun                                                                                                                                                            | **Ni corrigé ni bonnes réponses** ; au mieux le score (si `afficherScore`). High-stakes / `final_certificatif`.                                                    | rien de plus                   |

- **`rationale` vs `feedback` :** `feedbackCorrect`/`feedbackIncorrect` = message court contextuel ; `rationale` = explication pédagogique détaillée. Tous deux **figés** dans `QuizAttemptAnswer.feedbackDonne` au moment où ils sont montrés (traçabilité de ce que l'apprenant a vu).
- **Distracteurs expliqués :** si `QuestionChoice.feedback` existe, il s'affiche à côté de l'option choisie (best practice).
- **Questions manuelles :** en mode `immediat`, les `essai`/`upload` n'affichent **jamais** de verdict (rien n'est corrigé en direct) — seulement « réponse enregistrée, correction à venir ».

---

## 8. Écran de résultat (`QuizResult.tsx`)

Construit à partir d'`AttemptResultDTO`. Trois branches : **réussi**, **échec (tentatives restantes / épuisées)**, **en attente de correction manuelle**.

### Contenu

1. **Bandeau verdict** : icône + texte (jamais couleur seule — 1.4.1). « Réussi — 82 % » / « Non atteint — 55 % (objectif 70 %) » / « Réponses enregistrées — correction en cours ».
2. **Jauge de score** (`afficherScore`) : barre + valeur chiffrée + `noteSur` (ex. 16,4/20). `role="img"` + `aria-label` chiffré (la jauge n'est pas la seule info).
3. **Corrigé par question** (`afficherCorrige` + `feedbackMode`) : liste des `QuestionCorrigeeDTO` — réponse apprenant, correct/incorrect, `bonneReponse` (si `afficherBonnesReponses`), `feedback`, `rationale`. Accordéon par question (focus management correct).
4. **Tentatives** : « Tentative 2 / 3 » + `tentativesRestantes` ; si `prochaineTentativeAt`, bouton « Réessayer » **désactivé** jusqu'à l'échéance, avec compte à rebours annoncé.
5. **Gating / suite** : si `gating.aDeverrouille`, CTA **« Continuer »** vers `lessonSuivanteId`/`moduleSuivantId` + message « Module 2 déverrouillé ». Sinon, **verrou affiché avec sa raison** (`gating.messageEchec`, ex. « Atteignez 70 % pour débloquer le module 2 — meilleur score : 55 % ») — **jamais un cadenas muet** (best practice 2026, doc 03 §9).
6. **Recours / assistance** (Ind.19) : lien « Poser une question au formateur » (tuteur, doc 04/09) + contact — surtout si tentatives épuisées.

### A11y résultat

- Le bandeau verdict reçoit le **focus** au montage (`tabIndex=-1` + `focus()`) et est annoncé (`role="status"` / `aria-live="assertive"` pour le verdict).
- Aucune information uniquement visuelle (réussi/échec = texte + icône + éventuellement couleur).
- Ordre de lecture : verdict → score → suite (CTA) → corrigé détaillé.

---

## 9. Gating après réussite (réussite → débloque le suivant)

Le **player de cours** (doc 02/04) est l'autorité d'affichage des verrous ; le quiz **déclenche** la réévaluation.

1. À `submitAttempt`, le serveur appelle `unlock-engine.ts` (doc 03 §9) : recalcule `ModuleProgress.estDeverrouille`/`verrouRaison`/`meilleurScorePct` pour les modules/leçons gatés par **ce** quiz (`unlockQuizId`), en **vraie note** (`scorePct ≥ unlockScorePct ?? seuilReussitePct`), pas attempt-only.
2. `AttemptResultDTO.gating` reflète le résultat → `QuizResult` montre le CTA « Continuer » **ou** la raison du verrou.
3. Au retour sur le **player de cours**, l'`AttemptGate`/player relit `ModuleProgress` (cache, 1 read — budget INP) : l'item suivant est désormais ouvert. **Pas de calcul de gating dans le bundle apprenant** (sécurité + perf).
4. **`a_corriger`** (essai/upload) : **ne déverrouille pas** (note non définitive). Le déblocage survient quand `elearning-quiz-grading-worker` finalise la correction (`corrige`) → recalcul gating + **notification** (email + statement) ; le `QuizResult` rechargé via `getResult` montre alors le CTA.
5. **Override admin** (`ModuleProgress.overrideDeverrouille`) : court-circuite le gating (tracé). Le player l'affiche comme déverrouillé sans quiz réussi.

---

## 10. Routes apprenant & intégration au player de cours

Cloisonnement ADR-0007 — extension du portail existant, toutes en **`force-dynamic`** (auth apprenant, jamais SSG → compatible contrat `stub.invalid`).

| Route                                                                   | Type                    | Rôle                                                                                  |
| ----------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `src/app/[locale]/portail/cours/[courseSlug]/page.tsx`                  | Server, `force-dynamic` | Dashboard cours (doc 01/02) ; monte le player.                                        |
| `src/app/[locale]/portail/cours/[courseSlug]/lecon/[lessonId]/page.tsx` | Server, `force-dynamic` | Player de leçon ; si `lesson.type=quiz` → `QuizIntro` puis `QuizPlayer` (lazy).       |
| `src/app/[locale]/portail/cours/[courseSlug]/quiz/[quizId]/page.tsx`    | Server, `force-dynamic` | Accès direct au quiz (gating module). Monte `AttemptGate` → `QuizIntro`/`QuizPlayer`. |

- **Garde serveur (`AttemptGate`)** avant tout rendu : auth portail OK ? `ElearningEnrollment` `actif` ? quiz appartient bien à ce cours/accès ? verrou amont satisfait (sauf si le quiz **est** le déverrouilleur) ? tentatives/délai OK ? Sinon → message explicite (pas un 404 muet) ou redirection portail.
- **Pas de page publique indexable** pour les quiz (derrière auth) — aucun impact SEO/sitemap, aucun pré-rendu.

---

## 11. Accessibilité WCAG 2.2 AA — checklist transverse (obligation légale UE EAA, 28/06/2025)

| Critère                                       | Application moteur quiz                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **2.1.1 Clavier**                             | 100 % des interactions au clavier (radios/checkboxes/select natifs ; ordonnancement par boutons ; hotspot par grille de zones). |
| **2.4.3 Ordre focus**                         | Tab = ordre de lecture (énoncé → réponses → navigation). Focus géré aux transitions (résultat, accordéons).                     |
| **2.4.7 / 2.4.11 Focus visible (non masqué)** | `:focus-visible` token ; le timer/bandeau sticky ne recouvre jamais l'élément focalisé.                                         |
| **2.5.7 Mouvements de glisser**               | Appariement (`<select>`), ordonnancement (boutons), hotspot (zones nommées) : **toujours** une alternative au drag.             |
| **2.5.8 Taille de cible**                     | Toutes les cibles interactives ≥ **24×24 px** (options, boutons monter/descendre, marqueurs).                                   |
| **3.3.1 / 3.3.3 Erreurs**                     | Champs requis non remplis → message lié `aria-errormessage`, suggestion de correction, jamais couleur seule.                    |
| **3.3.8 Authentification accessible**         | L'auth apprenant (magic-link portail) **n'impose pas** de test cognitif ; le quiz n'est jamais une barrière d'auth.             |
| **1.4.1 Couleur**                             | Correct/incorrect/urgence = texte + icône (+ couleur).                                                                          |
| **1.4.3 Contraste**                           | Tokens charte respectant ≥ 4.5:1 (texte) ; vérifié par le check contrast du repo.                                               |
| **4.1.3 Messages d'état**                     | `aria-live` : autosave (« Enregistré »), timer, verdict, upload, déplacement d'item.                                            |
| **Pas d'autoplay**                            | Médias d'énoncé (audio/vidéo) sans lecture auto ; contrôles standard.                                                           |
| **prefers-reduced-motion**                    | Aucune animation essentielle ; transitions désactivables.                                                                       |

---

## 12. Performance (budgets Web Vitals internes)

- **Code-splitting :** `QuizPlayer` et les 8 sous-renderers chargés via `next/dynamic` **uniquement** sur leçon quiz ; les renderers rares (hotspot, appariement) sont eux-mêmes lazy. Les leçons vidéo/texte n'embarquent **rien** du quiz.
- **CLS = 0 :** espace réservé pour timer, jauge de score, zone de feedback (skeleton dimensionné) ; images d'énoncé avec `width`/`height` explicites.
- **INP ≤ 100 ms :** saisie sur composants **natifs** (radio/checkbox/select/input) → coût minimal ; autosave **debounced** hors du chemin de frappe ; pas de recalcul lourd au keypress ; corrigé en accordéon (rendu différé).
- **Pas d'appel DB au SSG :** pages `force-dynamic` derrière auth → stub `stub.invalid` non concerné (aucun pré-rendu).
- **R2 :** médias d'énoncé en URL signée résolue **serveur** (pas d'aller-retour client pour signer) ; upload `upload` en PUT direct (ne sature pas le serveur Next).

---

## 13. États limites & messages (UX robuste)

| Situation                      | Comportement                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Réseau coupé pendant la saisie | Autosave en échec → drapeau « non sauvegardé » + retry ; rien n'est perdu, reprise au retour.                   |
| Refresh / fermeture onglet     | `resumeAttempt` recharge snapshot + réponses sauvegardées ; timer recalé sur `expiresAt`.                       |
| Timer expiré côté serveur      | `saveAnswer`/`submit` renvoie `expired` → soumission auto immédiate du déjà-répondu ; message « Temps écoulé ». |
| Double soumission              | Idempotent : renvoie le même résultat ; bouton désactivé pendant `submitting`.                                  |
| Tentatives épuisées            | Écran résultat sans « Réessayer » + raison du verrou + lien assistance/tuteur (Ind.19).                         |
| Délai entre tentatives actif   | « Réessayer » désactivé jusqu'à `prochaineTentativeAt` (compte à rebours annoncé).                              |
| Quiz à correction manuelle     | « Réponses enregistrées — correction en cours » ; notification quand `corrige` ; gating différé.                |
| Accès révoqué/expiré en cours  | `AttemptGate` refuse l'accès au prochain appel ; message explicite + contact.                                   |

---

## 14. Tests (Vitest + Testing Library + axe)

- **Renderers (12 types) :** rendu, émission de la **réponse brute exacte** (shape `QuizAttemptAnswer.reponseJson`), navigation clavier, `axe` sans violation.
- **DTO de sécurité :** assert qu'**aucun** champ solution (`estCorrect`, `matchKey`, `bonne`, `valeur`, `zones.correcte`, `rationale` prématuré) ne fuit dans `AttemptPublicDTO` selon `feedbackMode`.
- **State machine :** autosave debounce, reprise (`resumeAttempt`), flush avant submit, anti-double-submit, expiration.
- **Feedback matrix :** pour chaque `FeedbackMode`, vérifier le contenu autorisé dans `AttemptResultDTO` (pendant/à la soumission/plus tard).
- **Gating :** réussite → CTA continuer ; échec → verrou avec raison ; `a_corriger` → pas de déblocage.
- **Timer :** mock horloge serveur ; auto-submit à 0 ; annonces `aria-live` espacées.
- **Le scoring** est testé côté serveur (`scoring.ts`, doc 03 §6) — pas dupliqué ici.

---

## 15. EXISTANT vs NEUF (récap)

**Réutilisé :** auth portail (`cookie.ts`/`portail-service.ts`, ADR-0001), `checkRateLimit`, `r2-storage.ts` (énoncés + upload devoir), `IP_HASH_SALT`, tokens Tailwind v4 charte, React Email/`email-worker` (notif correction), modèles & scoring du doc 03 (`Quiz`/`Question`/`QuizAttempt`/`QuizAttemptAnswer`, `scoring.ts`, `unlock-engine.ts`, `projection-evaluation.ts`), progression du doc 02 (`ModuleProgress` pour les verrous).

**Neuf (ce doc) :** composants `src/components/elearning/quiz/**` (`QuizPlayer`, `QuestionRenderer` + 8 sous-renderers, `QuizTimer`, `QuizResult`, `QuizIntro`, `AttemptGate`, `FeedbackInline`, `QuestionNav`), hook `useQuizAttempt`, server actions apprenant `src/server/elearning/quiz/learner-actions.ts`, DTO `src/server/elearning/quiz/dto.ts`, routes `portail/cours/[courseSlug]/{lecon/[lessonId],quiz/[quizId]}`.

---

## Liens

- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — modèles/enums/shapes/scoring/gating (source de vérité de toute la logique de note ; ce doc en est le rendu).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ModuleProgress.verrouRaison`/`estDeverrouille`, statements `answered`/`passed`/`failed`.
- `01-schema-cours-modules-lecons.md` — `ElearningLesson.type=quiz`, `unlockType=score_quiz`.
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — montage du quiz par le player de cours.
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique des verrous (consommée ici).
- `05-FRONTEND-APPRENANT/05-mobile-accessibilite-wcag.md` — checklist WCAG transverse (étendue ici au quiz).
- `05-FRONTEND-APPRENANT/06-certificats-badges.md` — `final_certificatif` réussi → certificat.
- `04-BACKEND/05-authentification-apprenant.md` — auth portail (ADR-0001) protégeant ces routes/actions.
- `04-BACKEND/09-tuteur-rag-assistant.md` — assistance pédagogique (Ind.19) liée depuis l'écran de résultat.
- `06-CONSOLE-ADMIN/06-gestion-banque-quiz.md` — outil auteur (aperçu « as-student » réutilise ces renderers) + correction manuelle.
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001/0007/0008.
