# Audit adversarial — UX apprenant & best practices LMS 2026

> **Rôle de ce document.** Audit **adversarial** du dossier de conception LMS face à la barre des leaders e-learning juin 2026 (TalentLMS, Docebo, LearnWorlds, Thinkific, Teachable, Moodle 4.x, 360Learning). Question centrale : **le produit conçu atteint-il le niveau « pro 2026 » sur la reprise auto, le gating par score, le verrou-avec-raison, le microlearning, le mobile, l'accessibilité WCAG 2.2 AA et un outil auteur réellement facile ?** On traque les anti-patterns (autoplay, gating attempt-only, pacing rigide, un-type-par-leçon, sur-DRM) et les **écarts entre l'intention des docs socle et ce qui est réellement spécifié**.
>
> **Méthode.** Lecture des docs socle (`00-INDEX/README.md`, `DECISIONS-ARBITRAGES.md`, `03-DATA-MODEL/01-schema-cours-modules-lecons.md`, `11-ROADMAP/01-phasage-mvp-v1-v2.md`) + lecture du **code réel** (`prisma/schema.prisma` : `Trainee`, `Enrollment`, `EvaluationAcquis`, `Questionnaire`, `PortailAcces` ; `src/server/qualiopi/portail/portail-service.ts` + `cookie.ts` ; `src/app/[locale]/portail/**` ; `src/lib/r2-storage.ts` ; `src/server/queue/workers/**`).
>
> **Légende sévérité.** 🔴 BLOQUANT (rate la barre 2026 ou casse la conformité) · 🟠 MAJEUR (écart notable, à corriger avant V1) · 🟡 MINEUR (polissage) · ✅ CONFORME (déjà au niveau).
>
> **Légende EXISTANT/NEUF.** `[EXISTANT]` = brique réelle réutilisable · `[NEUF]` = à construire · `[À SPÉCIFIER]` = manque dans les docs socle.

Date : 2026-06-27 · Statut : audit initial (avant écriture des docs `05-FRONTEND-APPRENANT/*`).

---

## 0. Verdict synthétique

**Le data model et les ADR posent un socle correct** (gating par score modélisé, microlearning prévu, unlock-avec-raison possible, vidéo externalisée, migrations additives). **Mais ce qui décide de la barre 2026 — la couche UX apprenant — n'est pas encore spécifié** (tout le dossier `05-FRONTEND-APPRENANT/*` est en `🔲 à rédiger`). Plusieurs **pré-conditions de la barre « pro » manquent au niveau data model**, donc elles seront difficiles à rattraper plus tard sans migration : pas de modèle de **reprise auto position vidéo/scroll**, pas de **feedback timing serveur** anti-triche au niveau `QuizAttempt` (le doc 03 n'existe pas encore), pas de **`unlockReason` calculé/exposé**, pas de champ **sous-titres obligatoires** (WCAG), pas de **rythme conseillé vs imposé** explicitement banni.

| Domaine barre 2026                                 | État conception                                                               | Sévérité du plus gros écart            |
| -------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------- |
| Reprise auto persistée serveur                     | Modèle `LessonProgress` annoncé (doc 02 non écrit), pas de schéma de position | 🔴                                     |
| Gating **par score** (vs attempt-only)             | ✅ Modélisé (`ElearningUnlockType.score_quiz` + `unlockScorePct`)             | ✅ / 🟠 sur la sémantique d'évaluation |
| Verrou **affiché avec sa raison**                  | Possible mais **`unlockReason` non spécifié** (calcul + UI)                   | 🟠                                     |
| Microlearning (2-10 min)                           | ✅ Champ `dureeEstimeeMinutes` + intention doc                                | ✅                                     |
| Mobile-first                                       | Non spécifié (frontend à écrire)                                              | 🟠                                     |
| Player vidéo standard (vitesse, ST, clavier)       | ADR-0005 OK, **ST/WCAG non modélisés ni rendus obligatoires**                 | 🔴 (accessibilité légale EAA)          |
| Accessibilité WCAG 2.2 AA                          | Mentionnée, **aucun critère opérationnalisé**                                 | 🔴                                     |
| Outil auteur facile (drag&drop, aperçu as-student) | V1, **aperçu as-student + brouillon→publi non détaillés**                     | 🟠                                     |
| Anti-patterns évités                               | Autoplay/pacing rigide **pas explicitement bannis** dans les specs            | 🟠                                     |
| Quiz ~12 types + banque + tirage                   | Annoncé doc 03 (non écrit) ; MVP « types essentiels » flou                    | 🟠                                     |

**Top 5 à traiter en priorité** (détaillés plus bas) :

1. 🔴 **F-01** Reprise auto : modéliser la position de reprise (vidéo + scroll) côté serveur, dès le MVP — sinon migration plus tard.
2. 🔴 **F-04 / A-01** Sous-titres : rendre les sous-titres une **dépendance bloquante de publication** d'une leçon vidéo (obligation légale EAA depuis 28/06/2025).
3. 🔴 **A-02** Opérationnaliser WCAG 2.2 AA (2.4.11, 2.5.7 alternative au drag, 2.5.8 cible ≥24px, 3.3.8 auth accessible) dans `09-QUALITE/04` + dans le moteur quiz/player.
4. 🟠 **F-02** `unlockReason` : calculer et exposer la **raison du verrou** (objet structuré, pas un texte libre) + override admin tracé.
5. 🟠 **Q-01** Gating « par score réel » : verrouiller la sémantique `QuizAttempt` (meilleure note vs dernière, timing serveur) **avant** d'écrire le doc 03, car le data model en dépend.

---

## 1. Reprise automatique & progression — la pierre angulaire

> Barre 2026 : un apprenant qui ferme l'onglet à 7 min 12 s d'une vidéo doit reprendre **exactement là**, sur n'importe quel appareil, **sans rien faire**. La progression est persistée **serveur** (pas localStorage), avec heartbeat et complétion calculée.

### 🔴 F-01 — La position de reprise n'est pas modélisée

**Constat.** Le doc 01 référence `LessonProgress[]` (relation sur `ElearningLesson`) mais **renvoie au doc `02-schema-progression-tracking.md` qui n'est pas écrit**. Aucun champ de **position** n'existe nulle part. Or c'est précisément ce qui différencie un « lecteur de vidéo » d'un « LMS ». Le risque : implémenter d'abord, modéliser ensuite → migration corrective (ADR-0008 interdit les DROP, mais une colonne mal pensée est une dette).

**Ce qui existe `[EXISTANT]`.** Rien côté progression — `Enrollment.tauxPresencePct` (`schema.prisma:5317`) sert au **présentiel/synchrone** (émargement), pas à la complétion asynchrone. Ne pas réutiliser : sémantique différente (présence ≠ progression FOAD).

**Spec attendue `[NEUF]` (à poser dans `03-DATA-MODEL/02`).** Au minimum :

```prisma
model LessonProgress {
  id              String   @id @default(uuid())
  enrollmentId    String   @map("enrollment_id")          // ElearningEnrollment (doc 02)
  lessonId        String   @map("lesson_id")
  // Reprise auto
  positionSeconds Int      @default(0) @map("position_seconds") // vidéo : reprise exacte
  scrollPct       Int?     @map("scroll_pct")                   // texte/pdf : reprise lecture
  // Complétion (xAPI-like, ADR-0006)
  statut          ElearningProgressStatut @default(non_commence) // non_commence|en_cours|termine
  watchedSeconds  Int      @default(0) @map("watched_seconds")   // cumul réel vu (≠ position, anti-skip)
  completionPct   Int      @default(0) @map("completion_pct")
  premierAccesAt  DateTime? @map("premier_acces_at")
  termineAt       DateTime? @map("termine_at")
  derniereActiviteAt DateTime? @map("derniere_activite_at")     // pour relance Ind.12
  updatedAt       DateTime @updatedAt @map("updated_at")
  @@unique([enrollmentId, lessonId])
  @@index([enrollmentId])
  @@map("elearning_lesson_progress")
}
```

**Points de vigilance non négociables :**

- `watchedSeconds` ≠ `positionSeconds` : la complétion d'une vidéo doit se baser sur le **temps réellement visionné** (anti-fast-forward), pas sur le fait d'avoir glissé le curseur à la fin. Sinon le gating et les **preuves FOAD** (durée moyenne, R.6313-3) sont falsifiables.
- Persistance **serveur** via une **Server Action** `enregistrerProgression()` appelée par **heartbeat** (~15-30 s) + sur `pause`/`beforeunload` (`navigator.sendBeacon`). Pas de localStorage comme source de vérité (changement d'appareil = perte).
- `force-dynamic` sur les routes apprenant (cohérent avec le contrat `stub.invalid` : pages derrière auth, jamais SSG).

**Recommandation.** Écrire `03-DATA-MODEL/02` **avant** tout code lecteur, et y verrouiller `LessonProgress` + `ElearningEnrollment` + `ElearningProgressStatut`.

### 🟠 F-02 — `unlockReason` : le verrou doit dire POURQUOI (et pas en texte libre)

**Constat.** Le data model permet le drip/gating (`ElearningUnlockType`, `unlockDate`, `unlockOffsetJours`, `unlockQuizId`, `unlockScorePct` au niveau module **et** leçon — bon point, granularité fine). Mais **rien ne calcule ni n'expose la raison** d'un verrou. La barre 2026 (et l'UX « parfaite » demandée) exige un cadenas **expliqué** : « Disponible le 12 juillet », « Terminez la leçon précédente », « Obtenez ≥70 % au quiz X (votre meilleur score : 60 %) ». Un cadenas muet est un anti-pattern frustrant.

**Spec attendue `[NEUF]`.** Une fonction serveur pure `computeLessonAccess(enrollment, lesson, progress[])` retournant un **objet structuré** (pas une string) :

```ts
type UnlockState =
  | { unlocked: true }
  | {
      unlocked: false;
      reason:
        | { kind: "date_fixe"; availableAt: Date }
        | { kind: "offset_inscription"; availableAt: Date }
        | { kind: "apres_precedent"; blockingLessonId: string; blockingTitre: string }
        | {
            kind: "score_quiz";
            quizId: string;
            quizTitre: string;
            requis: number;
            meilleurScore: number | null;
          };
    };
```

À mapper en UI vers un libellé i18n côté `src/components/elearning/`. **L'objet structuré** (et pas un message stocké) garantit la cohérence FR-only et l'accessibilité (lecteur d'écran annonce la raison).

**Override admin `[À SPÉCIFIER]`.** La barre 2026 attend un **déverrouillage manuel** par l'admin (cas handicap, litige, rattrapage). À modéliser : `ElearningUnlockOverride { enrollmentId, lessonId/moduleId, grantedByAdminId, raison, createdAt }` (traçabilité = preuve d'**accompagnement** FOAD / Qualiopi Ind.19). Réutiliser le pattern d'audit existant (cf. `FormationTransition` `schema.prisma:5357`, event-sourcing avec `triggeredByAdmin`).

### 🟡 F-03 — Barre de progression & « continuer où j'en étais »

**Constat.** `ElearningCourse.dureeEstimeeMinutes` (cache) et `ElearningLesson.dureeEstimeeMinutes` existent → matière première de la barre OK. Mais le **dashboard apprenant** (`05-FRONTEND-APPRENANT/01`) n'est pas écrit : il faut un bouton **« Reprendre »** qui pointe sur la dernière `LessonProgress.statut=en_cours` la plus récente (`derniereActiviteAt`). Sans ça, l'apprenant doit re-naviguer manuellement = friction.

### 🔴 F-04 — Sous-titres : non modélisés, donc non garantis (voir aussi A-01)

**Constat.** `ElearningResource.type` autorise `sous_titres` (doc 01 §6) — bien. Mais **rien ne rend les sous-titres obligatoires** pour publier une leçon `type=video`. Depuis le **28/06/2025 (European Accessibility Act)**, c'est une **obligation légale**, pas un confort. Voir A-01.

---

## 2. Player vidéo — standard ou gadget ?

> Barre 2026 : HLS adaptatif, contrôle **vitesse** (0.75×–2×), **sous-titres WCAG**, **clavier complet**, **mémoire de préférences**, pas d'autoplay, picture-in-picture optionnel, qualité auto + manuelle.

### ✅ V-01 — Choix d'archi vidéo correct (ADR-0005)

Cloudflare Stream (HLS + signed URLs + watermark), **pas d'auto-hébergement** R2 brut. Cohérent avec `src/lib/r2-storage.ts` qui **ne streame pas** (confirmé : `getSignedUrlR2` sert des objets, pas du HLS adaptatif ; `getObjectBufferR2` charge tout en mémoire — inadapté à la vidéo). `ElearningLesson.videoAssetId` (id Stream) ≠ `pdfKey` (R2) : bonne séparation. ✅

### 🔴 V-02 / A-01 — Autoplay & sous-titres : anti-patterns non bannis explicitement

**Constat.** Aucun doc n'**interdit l'autoplay** ni ne **rend les sous-titres bloquants**. La checklist de la mission cite l'autoplay comme anti-pattern à éviter et les sous-titres comme MUST WCAG. À graver dans `05-FRONTEND-APPRENANT/02` :

- ❌ **Pas d'autoplay** (respect `prefers-reduced-motion`, pas de son auto — WCAG 1.4.2, et bon sens mobile/données).
- ✅ **Sous-titres `.vtt` obligatoires** pour toute leçon `video` → **gate de publication** : un `ElearningCourse` ne peut passer `publie` si une leçon `video` n'a pas de ressource `type=sous_titres`. À implémenter dans le service `publishCourse()` (miroir du garde-fou `conformite.ts` Qualiopi qui bloque déjà la génération de certains PDF si identité OF vide — pattern connu du repo).
- ✅ Contrôles : vitesse, volume, plein écran, ST on/off, **navigables clavier** (focus visible), labels ARIA FR.

### 🟠 V-03 — INP du player : risque budget Web Vitals

**Constat.** `AGENTS.md` impose **INP ≤ 100 ms** (exception `/appel` à 150). Un player riche + heartbeat + quiz interactifs = **risque INP réel** sur les pages apprenant. Or les pages apprenant sont **derrière auth** → **hors des 15 pages stratégiques publiques** gateées par `pnpm lhci`. **Écart de gouvernance** : la barre Web Vitals interne ne couvre pas l'espace apprenant. Recommandation : ajouter des budgets internes spécifiques apprenant dans `09-QUALITE/03` (lazy-load du player, heartbeat via `requestIdleCallback`/Web Worker, débounce des Server Actions) même si non gateé par lhci.

---

## 3. Moteur de quiz & gating — le cœur différenciant

> Barre 2026 : ~12 types (QCM mono/multi, vrai/faux, appariement, texte à trous, ordonnancement, réponse courte, essai+correction manuelle, upload), banque de questions, **tirage N parmi M**, **shuffle questions ET réponses**, tentatives/seuil/pondération, feedback configurable + rationale, **gating par note réelle**, anti-triche léger (randomisation + **timing serveur**).

### 🟠 Q-01 — Le doc 03 manque → sémantique du score à figer maintenant

**Constat.** `03-schema-quiz-evaluations.md` (`Quiz`/`Question`/`QuizAttempt`) **n'est pas écrit**, alors que `ElearningModule.unlockQuizId` + `unlockScorePct` y pointent déjà. **Risque d'incohérence** : le gating « par score » exige de décider **quel** score fait foi. À verrouiller **avant** d'écrire le doc 03 :

- **Meilleur score** des tentatives (recommandé pédagogiquement) vs **dernière tentative** vs **moyenne** → choisir et stocker `meilleurScorePct` dénormalisé sur l'attempt-set pour un gating O(1).
- **Note serveur uniquement** : la correction et le calcul de score se font **côté serveur** (Server Action), jamais en client (sinon triche triviale). Le client n'envoie que les réponses.
- **Timing serveur** : `QuizAttempt.startedAt`/`submittedAt` posés **serveur** ; durée limite vérifiée serveur. Anti-triche léger conforme CNIL (proportionné, pas de proctoring imposé).

### 🔴 Q-02 — Anti-pattern « gating attempt-only » : à interdire explicitement

**Constat.** Le data model permet le bon gating (`score_quiz` + `unlockScorePct`). **Bien.** Mais il faut **interdire noir sur blanc** le gating « a tenté le quiz » (attempt-only) dans la spec, car c'est le piège classique : un dev pressé déverrouille sur « a soumis une tentative » au lieu de « a atteint le seuil ». La checklist mission le cite comme anti-pattern. → Règle dans `05-FRONTEND-APPRENANT/04` + test : un module `unlockType=score_quiz, unlockScorePct=70` reste verrouillé tant que `meilleurScorePct < 70`, **même après N tentatives**.

### 🟠 Q-03 — Couverture des types de questions au MVP

**Constat.** Roadmap MVP dit « types essentiels » (flou) ; les 12 types + banque + tirage sont en V1. **Acceptable** pour un MVP, mais le **modèle `Question` doit être polymorphe dès le départ** (champ `type` enum + `contenuJson` pour les variantes) pour ne pas re-migrer. MVP minimal recommandé : QCM mono, QCM multi, vrai/faux, **réponse courte** (correction auto par normalisation) + **essai** (correction manuelle, nécessaire pour `ElearningLessonType.devoir` = preuve FOAD). Sans le type « essai/devoir corrigé », l'**Indicateur 11 (évaluations qui jalonnent)** est fragilisé pour les parcours non-QCM.

### 🟡 Q-04 — Shuffle & banque : à modéliser même si livré V1

`Question.banqueId` (banque) + `Quiz.tirageN`/`Quiz.shuffleQuestions`/`Quiz.shuffleReponses` à prévoir dans le schéma dès le doc 03 (champs nullable, additifs) pour éviter une migration V1. Le tirage aléatoire **N parmi M** est l'anti-triche le plus efficace et le moins intrusif (CNIL-friendly).

### 🟡 Q-05 — Feedback configurable + rationale

Modéliser `Question.feedbackCorrect`/`feedbackIncorrect`/`rationale` + `Quiz.feedbackMode` (immédiat | fin de quiz | jamais | après échéance). C'est un standard 2026 et un levier pédagogique. Absent = quiz « boîte noire ».

---

## 4. Accessibilité WCAG 2.2 AA — obligation légale, pas option

> **EAA (European Accessibility Act) applicable depuis le 28/06/2025** : une plateforme e-learning commerciale est dans le périmètre. WCAG 2.2 AA est le standard de fait. Les nouveaux critères 2.2 sont précisément ceux qu'un LMS viole le plus.

### 🔴 A-02 — Aucun critère WCAG opérationnalisé

**Constat.** L'accessibilité est **mentionnée** (README, mission) mais `09-QUALITE/04-accessibilite-wcag22.md` est **non écrit** et **aucun critère n'est traduit en exigence d'implémentation**. À spécifier explicitement, avec impact direct sur le code :

| Critère WCAG 2.2                                          | Où ça mord dans le LMS                                                                         | Exigence                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **2.5.7 Dragging movements**                              | **Outil auteur drag&drop** (réorg modules/leçons) ET appariement/ordonnancement côté apprenant | Toujours une **alternative non-drag** (boutons monter/descendre, menu « déplacer vers »)                                                                     |
| **2.5.8 Target size (min 24px)**                          | Contrôles player, boutons quiz, cadenas                                                        | Cibles tactiles ≥ 24×24 px (mobile)                                                                                                                          |
| **2.4.11 Focus not obscured**                             | Modales quiz, sticky TOC/header player                                                         | Le focus ne doit jamais être masqué par un élément sticky                                                                                                    |
| **3.3.8 Accessible authentication**                       | **Auth apprenant** (magic-link OK ✅, mot de passe entreprise)                                 | Pas de test cognitif ; **le magic-link est nativement conforme** (bon choix ADR-0001). Pour le mot de passe : autoriser le **collage** + gestionnaire de mdp |
| **1.2.x Sous-titres/transcription**                       | Vidéos                                                                                         | `.vtt` obligatoires (cf. A-01) + transcription téléchargeable                                                                                                |
| **1.4.3 Contraste / 2.1.1 Clavier / 2.4.7 Focus visible** | Tout                                                                                           | Tokens de la charte Editorial Premium Light déjà définis ; vérifier contraste sur cadenas/états désactivés                                                   |

**Bonne nouvelle (✅).** L'ADR-0001 (magic-link par défaut) **satisfait nativement 3.3.8** — c'est un avantage compétitif accessibilité, à assumer comme tel.

### 🟠 A-03 — États « verrouillé/désactivé » et lecteurs d'écran

Le cadenas (F-02) doit être annoncé : `aria-disabled` + texte de raison lié (`aria-describedby`), jamais un simple `opacity:.5` muet. Lien direct avec F-02 (raison structurée).

---

## 5. Mobile-first & microlearning

### ✅ M-01 — Microlearning modélisé

`ElearningLesson.dureeEstimeeMinutes` + intention « viser 2-10 min » (doc 01 §5/§8) = ✅. À renforcer côté outil auteur par un **avertissement non bloquant** si une leçon dépasse ~12 min (nudge microlearning).

### 🟠 M-02 — Mobile-first non spécifié

**Constat.** Aucune spec mobile (`05-FRONTEND-APPRENANT/05`). La barre 2026 est **mobile-first** (une grande part des apprenants suit sur téléphone, souvent en transport). Risques concrets : player plein écran + ST lisibles, heartbeat résistant aux coupures réseau (file d'attente offline + `sendBeacon`), quiz au pouce (cibles ≥24px = recoupe A-02). À écrire avec des **contraintes testables** (pas « responsive » vague).

### 🟡 M-03 — Anti-pattern « pacing rigide self-paced »

La checklist mission bannit le **pacing rigide**. Le drip est OK **s'il a une raison pédagogique** (cohortes, anti-bachotage) **et reste overridable** (F-02 override admin). Pour un parcours **self-paced individuel** (particulier vente directe), le défaut devrait être `unlockType=apres_precedent` (progression libre au rythme de l'apprenant), **pas** `date_fixe`/`offset_inscription` imposé. → Documenter ce **défaut par mode de diffusion** dans `05-FRONTEND-APPRENANT/04`.

---

## 6. Outil auteur — « facile à remplir » vraiment ?

> Barre 2026 : drag&drop sections→leçons, **blocs mixtes dans une même leçon**, upload média transcodé auto, **aperçu as-student**, **brouillon→publication**, clonage, templates.

### 🟠 AUTH-01 — « Blocs mixtes dans une leçon » vs `ElearningLessonType` mono-type

**Constat / tension de modèle.** `ElearningLessonType` est **mono-type** (`video|texte|pdf|quiz|embed|devoir`) — une leçon EST une vidéo, OU un texte, etc. Mais la best practice 2026 (et la mission) veut **mixer des blocs dans une même leçon** (ex. vidéo + texte + mini-quiz de vérification). L'anti-pattern à éviter est justement « un-type-par-leçon ».

**Analyse.** Ce n'est pas forcément un défaut **si** `contenuJson` (présent sur `ElearningLesson`) porte des **blocs riches mixtes** (Tiptap/JSON) pour les leçons `texte`, et que la granularité « microlearning » fait qu'une leçon courte = un objet pédagogique. **Mais c'est ambigu** : rien ne dit qu'une leçon `video` peut avoir du texte sous la vidéo, ni qu'un quiz de vérification peut s'insérer dans une leçon `texte`. **Décision à acter** dans `06-CONSOLE-ADMIN/03` :

- **Option retenue recommandée** : `type` = type **dominant** (pilote l'icône/le rendu principal) + `contenuJson` = **blocs additionnels** (intro texte, points clés, ressources). Le quiz **bloquant** reste une leçon `quiz` dédiée (pour le gating). Le quiz **non bloquant de vérification** = un bloc dans `contenuJson`.
- Sinon, on retombe dans l'anti-pattern un-type-par-leçon. **À trancher explicitement**, sous peine d'outil auteur perçu rigide.

### 🟠 AUTH-02 — Aperçu as-student & brouillon→publication sous-spécifiés

**Constat.** `ElearningCourseStatut.brouillon|publie|archive` + `version` + `publishedAt` existent (✅ socle). Mais :

- **Aperçu as-student** (voir le cours comme un apprenant, gating simulé) = **non spécifié** et **indispensable** pour un auteur non-dev. Sans lui, l'auteur publie à l'aveugle.
- **Workflow de publication** : la validation (gate sous-titres A-01, gate quiz de gating cohérent, gate durée renseignée pour D.6313-3-1) doit être une **checklist de pré-publication** dans `publishCourse()`. Réutiliser le pattern `conformite.ts` (blocage si conditions non remplies) déjà éprouvé côté Qualiopi.

### 🟡 AUTH-03 — Drag&drop accessible (recoupe A-02 / 2.5.7)

L'outil auteur drag&drop **doit** offrir une alternative clavier/boutons (monter/descendre). À écrire dans `06-CONSOLE-ADMIN/03`. Le `@@unique([courseId, ordre])` / `@@unique([moduleId, ordre])` impose une **réécriture transactionnelle des `ordre`** lors d'un déplacement (déjà noté doc 01 §8 ✅) — attention aux collisions d'unicité en transaction (réordonner en deux passes ou ordres temporaires négatifs).

### 🟡 AUTH-04 — Transcodage auto & feedback d'upload

Upload vidéo → Cloudflare Stream est **asynchrone** (transcodage). L'outil auteur doit montrer l'**état** (`en cours de traitement` / `prêt`) sans bloquer l'auteur. → worker `elearning-video-ingest-worker.ts` `[NEUF]` (convention de nommage confirmée par les workers existants `image-bank-*-worker.ts`, `qualiopi-formation-engine-worker.ts`) + polling/webhook Stream → màj `ElearningLesson.videoDureeSec` + état ressource. Le champ `videoDureeSec` doit aussi **alimenter `dureeEstimeeMinutes`** (microlearning + preuve durée FOAD).

---

## 7. Auth apprenant & octroi d'accès (UX d'entrée)

### ✅ AUTH-05 — Magic-link réutilisé : excellent socle

**Constat `[EXISTANT]`.** `PortailAcces` (`schema.prisma:6236`, token 64 hex, `expiresAt`, `revoked`, `lastUsedAt`) + `portail-service.ts` (`creerAcces`/`verifierToken` **timing-safe** via `timingSafeEqual`, rate-limit 10/60s par IP dans la route `acces/[token]`, cookie `portail_session` **HttpOnly/Secure/SameSite=Lax/90j**) = **base solide et sûre**, déjà stub-aware (contrat build). ✅ Conforme WCAG 3.3.8 (pas de test cognitif).

**Écart `[À SPÉCIFIER]`.** Le cookie actuel `portail_session` donne accès à l'**espace stagiaire Qualiopi** (`getEspaceStagiaire`). L'espace **e-learning** doit-il réutiliser le **même cookie** (un seul espace apprenant unifié) ou un cookie distinct ? **Recommandation : unifier** — un apprenant ne doit pas comprendre la distinction Qualiopi/e-learning. Étendre `getEspaceStagiaire` (ou un nouveau service `elearning/espace-apprenant.ts` qui **compose** avec l'existant) pour ajouter les cours e-learning. Ne **pas** dupliquer l'auth.

### 🟠 AUTH-06 — Mot de passe optionnel (entreprise) : argon2id + non régression NextAuth

ADR-0001 prévoit `Trainee.passwordHash` nullable (argon2id), **système séparé de NextAuth**. **Confirmé** : `Trainee` n'a **pas** de `passwordHash` aujourd'hui (`schema.prisma:5274-5307`) → ajout additif nullable OK. Vigilance : ne **jamais** router l'apprenant via NextAuth (`AdminUser`) — risque de régression admin. Login mot de passe = Server Action dédiée posant le **même cookie `portail_session`** (cohérence) après vérif argon2id + rate-limit. Conformité WCAG 3.3.8 : autoriser le **collage** du mot de passe.

### 🟡 AUTH-07 — Import masse CSV (MVP) : UX d'octroi

`[NEUF]` Octroi en masse = créer `Trainee` (ou réutiliser existants par email `@unique citext`) + `ElearningEnrollment` + envoyer magic-links. Réutiliser `email-worker.ts` + React Email. UX admin : prévisualisation (lignes valides/en erreur), dédoublonnage par email, **idempotence** (re-import ne crée pas de doublons), rapport téléchargeable. Anti-pattern à éviter : import « tout ou rien » sans rapport de lignes rejetées.

---

## 8. Certificats & preuves (UX de fin + conformité)

### ✅ CERT-01 — Réutilisation `DocumentGenere` + QR

`[EXISTANT]` `DocumentGenere` (`schema.prisma:5507`) + `qrToken` + génération PDF (`@react-pdf/renderer`) + archivage R2 (`documents/<year>/<type>/<numero>.pdf`, déjà utilisé par `getEspaceStagiaire`). Le **certificat de réalisation** (modèle officiel, heures réalisées) doit réutiliser ce pipeline. ✅ Bon réflexe socle (roadmap MVP §7).

### 🟠 CERT-02 — « Heures réalisées » = dérivé de la progression réelle

**Constat.** Le certificat de réalisation FOAD exige les **heures réalisées**. La source ne peut pas être déclarative : elle doit dériver de `LessonProgress.watchedSeconds` + temps quiz + devoirs (F-01). **Sans F-01 modélisé correctement, le certificat FOAD n'est pas défendable en contrôle.** → dépendance dure CERT-02 → F-01.

### 🟡 CERT-03 — Badges/gamification : opt-in seulement (anti-pattern classement imposé)

Roadmap V2 cite badges/gamification « opt-in ». ✅ Bien : la checklist mission bannit les **classements imposés**. À graver : pas de leaderboard public par défaut, pas de comparaison sociale forcée.

---

## 9. Anti-patterns — passage en revue explicite

| Anti-pattern (checklist mission)                    | Présent dans la conception ?                                     | Verdict                                          |
| --------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| **Autoplay**                                        | Non banni explicitement                                          | 🟠 V-02 — à interdire dans `05/02`               |
| **Gating attempt-only**                             | Data model fait le bon choix (score) mais pas de garde explicite | 🟠 Q-02 — interdire + test                       |
| **Pacing rigide self-paced**                        | Drip possible sans défaut par mode                               | 🟡 M-03 — défaut `apres_precedent` en self-paced |
| **Un-type-par-leçon**                               | `ElearningLessonType` mono-type, blocs mixtes ambigus            | 🟠 AUTH-01 — trancher                            |
| **Auto-héberger la vidéo**                          | Évité (Cloudflare Stream)                                        | ✅ V-01                                          |
| **Sur-DRM**                                         | ADR-0005 : signed URLs + watermark, DRM lourd écarté             | ✅                                               |
| **Avatars IA maison / wrapper ChatGPT nu**          | Tuteur RAG ancré citations (V1, réutilise knowledge/RAG)         | ✅ intention saine, à tenir                      |
| **localStorage comme source de vérité progression** | Risque si F-01 mal fait                                          | 🔴 F-01 — persistance serveur                    |

---

## 10. Écarts de conformité FOAD touchant l'UX (rappel ciblé)

> Détail complet dans `08-CONFORMITE/*`. Ici, uniquement les points où **l'UX/le data model** conditionnent la conformité.

- 🔴 **Ind.11 (évaluations qui jalonnent/concluent)** dépend du moteur quiz **et** du type `devoir`/`essai` corrigé (Q-03). Sans correction manuelle d'un livrable, les parcours non-QCM ne jalonnent pas.
- 🔴 **R.6313-3 (faisceau de preuves)** dépend de `LessonProgress` réel (F-01) + logs d'accompagnement (override F-02, messages tuteur) + résultats quiz. Le **relevé de connexion seul est insuffisant** : la progression réelle + évaluations sont la preuve.
- 🟠 **D.6313-3-1 §2 (information durée moyenne)** dépend de `dureeEstimeeMinutes` agrégé **affiché à l'apprenant** (pas seulement stocké). → exigence UX dashboard.
- 🟠 **Ind.19 (assistance technique ET pédagogique)** dépend d'un canal d'aide visible dans l'espace apprenant (au MVP : email/contact tuteur avec **délai de réponse formalisé affiché**) ; le tuteur RAG est V1, mais **l'assistance humaine doit exister dès le MVP** (sinon non-conformité). → exigence UX MVP, pas V1.

---

## 11. Synthèse des actions (backlog priorisé)

| ID                                                     | Sévérité | Action                                                                                        | Doc cible                           | Dépendance   |
| ------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------- | ----------------------------------- | ------------ |
| F-01                                                   | 🔴       | Modéliser `LessonProgress` (position + watchedSeconds + completion) + Server Action heartbeat | `03-DATA-MODEL/02`, `04-BACKEND/02` | —            |
| A-01/V-02                                              | 🔴       | Sous-titres `.vtt` obligatoires (gate publication) + interdire autoplay                       | `05/02`, `06/03`                    | —            |
| A-02                                                   | 🔴       | Opérationnaliser WCAG 2.2 AA (2.5.7/2.5.8/2.4.11/3.3.8/1.2.x)                                 | `09-QUALITE/04`                     | —            |
| Q-01                                                   | 🟠       | Figer sémantique score (meilleur score, calcul serveur, timing serveur)                       | `03-DATA-MODEL/03`                  | avant doc 03 |
| Q-02                                                   | 🟠       | Interdire gating attempt-only + test                                                          | `05/04`                             | Q-01         |
| F-02                                                   | 🟠       | `unlockReason` structuré + override admin tracé                                               | `04-BACKEND/01`, `05/04`            | F-01         |
| AUTH-01                                                | 🟠       | Trancher blocs mixtes (type dominant + `contenuJson`)                                         | `06/03`                             | —            |
| AUTH-02                                                | 🟠       | Aperçu as-student + checklist pré-publication                                                 | `06/03`                             | A-01         |
| M-02                                                   | 🟠       | Spec mobile-first testable                                                                    | `05/05`                             | —            |
| Ind.19                                                 | 🟠       | Canal d'assistance humaine + délai affiché dès MVP                                            | `08-CONFORMITE/02`                  | —            |
| F-03/F-04/Q-03/Q-04/Q-05/M-01/M-03/AUTH-03..07/CERT-\* | 🟡       | Voir sections                                                                                 | divers                              | —            |

---

## 12. Ce qui est déjà au niveau (à ne pas casser)

- ✅ **Gating par score modélisé** (`ElearningUnlockType.score_quiz` + `unlockScorePct`) — différenciant clé, déjà présent.
- ✅ **Granularité fine du drip** (unlock au niveau **module ET leçon**).
- ✅ **Microlearning** (`dureeEstimeeMinutes`).
- ✅ **Vidéo externalisée** (Cloudflare Stream, pas d'auto-hébergement, signed URLs + watermark).
- ✅ **Auth apprenant magic-link** réutilisée (`PortailAcces` + cookie HttpOnly + timing-safe + rate-limit) — sûre et **conforme WCAG 3.3.8**.
- ✅ **Certificats** via `DocumentGenere` + QR + R2 (pipeline éprouvé).
- ✅ **Migrations additives** (ADR-0008) — protège la prod.
- ✅ **Cloisonnement code** (`src/server/elearning/**`, workers `elearning-*-worker.ts`) cohérent avec image-bank/qualiopi.

---

## Liens

- `00-INDEX/README.md` — index & structure du dossier
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth), 0002 (multi-tenant), 0005 (vidéo), 0006 (xAPI), 0008 (migrations)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource`, enums (source des noms cités)
- `03-DATA-MODEL/02-schema-progression-tracking.md` 🔲 — **à écrire (F-01)** : `ElearningEnrollment`, `LessonProgress`
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` 🔲 — **à écrire (Q-01)** : `Quiz/Question/QuizAttempt`
- `04-BACKEND/05-authentification-apprenant.md` 🔲 — hybride magic-link + mdp (AUTH-05/06)
- `04-BACKEND/07-pipeline-video-streaming.md` 🔲 — Cloudflare Stream + `elearning-video-ingest-worker.ts` (AUTH-04)
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` 🔲 — player, reprise, autoplay, sous-titres (F-01/V-02/A-01)
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` 🔲 — types, feedback (Q-02..05)
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` 🔲 — `unlockReason`, défaut par mode (F-02/M-03/Q-02)
- `05-FRONTEND-APPRENANT/05-mobile-accessibilite-wcag.md` 🔲 — mobile-first + WCAG (M-02/A-02)
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` 🔲 — blocs mixtes, aperçu as-student, drag accessible (AUTH-01..04)
- `08-CONFORMITE/01-foad-d6313-3-1.md` + `02-qualiopi-indicateurs-foad.md` 🔲 — Ind.11/19, R.6313-3, durée (§10)
- `09-QUALITE/03-web-vitals-performance.md` + `04-accessibilite-wcag22.md` 🔲 — INP player, WCAG (V-03/A-02)
- `99-VERIFICATION/02-coherence-data-model.md` + `06-coherence-existant.md` 🔲 — recoupements
