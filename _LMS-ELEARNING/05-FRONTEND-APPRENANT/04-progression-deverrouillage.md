# Progression & déverrouillage (drip + gating)

Spécification produit **et** technique des règles de déverrouillage d'un parcours e-learning : les **3 déclencheurs de drip** (date fixe / offset J+N / complétion), le **gating par score** (vraie note, pas « a-essayé »), les **règles composées AND/OR** (modèle Moodle _restrict access_), le **verrou affiché avec sa raison**, l'**override admin**, et les **anti-pièges** (fuseau horaire, gating attempt-only, horloge client).

Ce document est le **contrat de comportement** consommé par :

- le **lecteur de cours** (`05-FRONTEND-APPRENANT/02-lecteur-cours-player.md`),
- l'**outil auteur** (`06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md`) qui édite ces règles,
- les **services de progression** (`02-schema-progression-tracking.md` §8) qui les évaluent et **matérialisent** le verrou.

> Source de vérité des modèles/champs : `03-DATA-MODEL/01-…` (`ElearningModule`/`ElearningLesson` + enum `ElearningUnlockType`), `03-DATA-MODEL/02-…` (`ModuleProgress.estDeverrouille`/`verrouRaison`/`overrideDeverrouille`, `LessonProgress.estDeverrouille`, `ElearningEnrollment.accordeAt`/`premiereConnexionAt`), `03-DATA-MODEL/03-…` (gating par score `Quiz`/`QuizAttempt`, `unlock-engine.ts`). **Ne rien renommer ici** : ce doc applique ces noms.

---

## 1. Principe & vocabulaire

Deux notions distinctes, souvent confondues :

| Notion                              | Question                                              | Donnée pilote                    |
| ----------------------------------- | ----------------------------------------------------- | -------------------------------- |
| **Drip** (libération progressive)   | _Quand_ un élément devient disponible ?               | déclencheur temps/complétion     |
| **Gating** (barrière de compétence) | _Faut-il avoir réussi quelque chose_ pour continuer ? | **score** d'un quiz (vraie note) |

Un même élément (module **ou** leçon) peut combiner les deux (ex. « disponible le 12/07 **ET** après réussite du quiz du module 2 à ≥ 80 % »). C'est le rôle des **règles composées** (§5).

**Granularités déverrouillables** (best practice 2026 — drip au niveau module _et_ leçon) :

- **Module** : `ElearningModule.unlockType` + `unlock*` (doc 01 §4).
- **Leçon** : `ElearningLesson.unlockType` + `unlock*` (doc 01 §5).

Le **cours** lui-même n'a pas de verrou interne : son accès est piloté par `ElearningEnrollment.statut` (doc 02 §2 — `actif`/`suspendu`/`expire`/`revoque`). Le déverrouillage décrit ici opère **à l'intérieur** d'un enrollment `actif`.

---

## 2. Mapping vers `ElearningUnlockType` (enum doc 01)

L'enum existant (doc 01 §2) fixe les **5 modes mono-condition** du MVP. Chacun se mappe à un déclencheur métier :

| `ElearningUnlockType` | Déclencheur métier                                        | Champs `unlock*` lus                          | Évalué par                          |
| --------------------- | --------------------------------------------------------- | --------------------------------------------- | ----------------------------------- |
| `immediat`            | Ouvert dès l'octroi de l'accès                            | _(aucun)_                                     | trivial                             |
| `apres_precedent`     | **Complétion** de l'élément précédent (sibling `ordre-1`) | _(aucun ; calculé sur l'ordre)_               | `unlock-service.ts`                 |
| `date_fixe`           | **Date** calendaire absolue                               | `unlockDate` (DateTime UTC)                   | `unlock-service.ts`                 |
| `offset_inscription`  | **Offset J+N** après octroi d'accès                       | `unlockOffsetJours` (Int)                     | `unlock-service.ts`                 |
| `score_quiz`          | **Gating par score** : réussite d'un quiz à un seuil      | `unlockQuizId` (text), `unlockScorePct` (Int) | `quiz/unlock-engine.ts` (doc 03 §9) |

Couverture des **3 déclencheurs de drip** demandés :

- **date** → `date_fixe`
- **offset J+N** → `offset_inscription`
- **complétion** → `apres_precedent` (cas courant) **ou** condition `completion` ciblée dans une règle composée (§5, `cibleModuleId`/`cibleLessonId`)

`score_quiz` est le **gating** (barrière de compétence), distinct du drip.

> **MVP** = un seul `unlockType` par élément (mono-condition, colonnes existantes). **V1** = règles **composées AND/OR** via un champ additif nullable (§5.2) — le `unlockType` mono reste le _fast-path_ et le défaut.

---

## 3. Déclencheur « complétion » (`apres_precedent`) — sémantique exacte

C'est le mode par défaut (`@default(apres_precedent)` dans doc 01) et le plus utilisé (parcours linéaire).

**Définition de « précédent » :**

- **Module** `ordre = k` (`apres_precedent`) → déverrouillé ssi le module `ordre = k-1` du même cours est **`termine`** (`ModuleProgress.statut = termine`). Le module `ordre = 0` est traité comme `immediat`.
- **Leçon** `ordre = j` dans un module (`apres_precedent`) → déverrouillée ssi la leçon `ordre = j-1` **obligatoire** du même module est **`termine`** (`LessonProgress.statut = termine`). La leçon `ordre = 0` hérite de l'état de déverrouillage de **son module**.

**Définition de « terminé »** (rappel doc 02 §4/§8, ne pas redéfinir) :

- leçon `video` : `maxPositionSec ≥ 0,95 × videoDureeSec` (anti seek-to-end) ;
- leçon `texte` : checkpoints de scroll atteints ;
- leçon `pdf`/`embed` : statement `experienced` + ouverture effective ;
- leçon `quiz` : tentative `soumis`/`corrige` **réussie** (le quiz d'une leçon `quiz` est complétant **par sa réussite**, cf. §4) ;
- leçon `devoir` : `devoirRenduAt` renseigné (fichier R2 déposé).

Les leçons `obligatoire = false` (doc 01 §5) **ne bloquent pas** la complétion du précédent : elles sont ignorées dans le calcul de « précédent obligatoire terminé ».

---

## 4. Gating par score (`score_quiz`) — la vraie note, jamais attempt-only

⚠️ **Anti-piège central.** Un module/leçon gaté est déverrouillé **uniquement** si une tentative a **atteint le seuil de score**, pas parce qu'une tentative _existe_.

Règle (déléguée à `src/server/elearning/quiz/unlock-engine.ts`, doc 03 §9) :

```
deverrouille(score_quiz) ⇔
   ∃ QuizAttempt a  où  a.quizId = unlockQuizId
                   ET  a.statut ∈ { soumis, corrige }        // PAS en_cours / a_corriger
                   ET  a.scorePct ≥ (unlockScorePct ?? Quiz.seuilReussitePct)
```

Précisions :

- **`a_corriger` ne déverrouille pas** : tant qu'une question manuelle (`essai`/`upload`) n'est pas notée, la note n'est pas définitive → verrou maintenu, raison « En attente de correction ». Le `elearning-quiz-grading-worker` (doc 03 §11) relance l'évaluation à la fin de la correction.
- **Meilleur score** : on retient `MAX(scorePct)` parmi les tentatives `soumis`/`corrige` → l'apprenant qui repasse et améliore débloque. Le « meilleur score actuel » est affiché dans la raison du verrou (§6).
- **Source de la note** : `QuizAttempt.scorePct` calculé serveur (doc 03 §6), jamais une valeur cliente.
- Le résultat est **mis en cache** dans `ModuleProgress.meilleurScorePct` (doc 02 §5) pour éviter de rescanner les tentatives à chaque rendu (budget INP).

> Le quiz d'une **leçon de type `quiz`** est _complétant_ (sa réussite vaut complétion de la leçon, donc débloque le `apres_precedent` suivant) **et** peut en plus servir de **cible de gating** pour un module/leçon ultérieur via `unlockQuizId`. Les deux usages coexistent.

---

## 5. Règles composées AND/OR (modèle Moodle _restrict access_)

### 5.1 Pourquoi

Le besoin réel dépasse la mono-condition : « disponible **le 12/07 ET** après le module 2 », « accessible **si quiz d'entrée ≥ 50 % OU** date dépassée ». C'est exactement le **jeu de restrictions Moodle** (liste de conditions + opérateur global AND/OR, restrictions imbriquables).

### 5.2 Champs additifs (NEUF — additif nullable, ADR-LMS-0008)

Le `unlockType` mono (colonnes existantes) reste le défaut. On **ajoute** un descripteur composé optionnel sur `ElearningModule` **et** `ElearningLesson` :

```prisma
// model ElearningModule { … } ET model ElearningLesson { … }   (additif, nullable)

  /// Opérateur global des conditions composées. null/AND = toutes requises.
  unlockLogic       ElearningUnlockLogic? @map("unlock_logic")
  /// Liste de conditions (modèle Moodle restrict-access). Si non-null, PRIME sur
  /// les colonnes mono (unlockType/unlockDate/…). Validée par Zod (cf. §5.4).
  unlockConditionsJson Json?              @map("unlock_conditions_json")
  /// Comportement visuel quand verrouillé : masqué (grisé+raison) ou caché.
  unlockHiddenWhenLocked Boolean          @default(false) @map("unlock_hidden_when_locked")
```

```prisma
/// NEUF — opérateur des règles de déverrouillage composées.
enum ElearningUnlockLogic {
  AND   // toutes les conditions doivent être vraies
  OR    // au moins une condition vraie suffit
}
```

> **Migration strictement additive** : 3 colonnes nullable + 1 enum, aucun DROP, aucun NOT NULL. Le MVP fonctionne sans toucher `unlockConditionsJson` (reste `null`).

### 5.3 Normalisation mono → composé (un seul évaluateur)

Pour n'avoir **qu'un** moteur d'évaluation, `unlock-service.ts` **normalise** d'abord :

- si `unlockConditionsJson` est `null` → on construit une **liste à 1 condition** depuis `unlockType`/`unlock*` (mono), avec `unlockLogic = AND` ;
- si `unlockConditionsJson` est renseigné → on l'utilise tel quel (il **prime** sur les colonnes mono).

Ainsi le même algorithme (§5.5) traite MVP et V1 sans branche spéciale.

### 5.4 Shape `unlockConditionsJson` (contrat Zod — `src/server/elearning/progress/unlock-conditions.ts`)

```ts
// ElearningUnlockConditions
{
  logic: "AND" | "OR",                  // doublonne unlockLogic (source : la colonne fait foi)
  conditions: [
    // 1) complétion d'un élément ciblé (généralise apres_precedent)
    { type: "completion",
      cibleType: "module" | "lesson",
      cibleId: "<moduleId|lessonId>",   // null ⇒ "élément précédent" (apres_precedent)
      etat: "termine" },                 // "termine" | "en_cours"

    // 2) date fixe (UTC) → mappe date_fixe
    { type: "date", date: "2026-07-12T08:00:00Z", sens: "apres" }, // "apres" | "avant"

    // 3) offset J+N → mappe offset_inscription
    { type: "offset",
      jours: 7,
      base: "accordeAt" | "premiereConnexionAt" }, // défaut accordeAt

    // 4) gating par score → mappe score_quiz
    { type: "score_quiz", quizId: "<quizId>", scorePct: 80 },

    // 5) sous-groupe imbriqué (Moodle : restrictions de restrictions)
    { type: "groupe", logic: "OR", conditions: [ /* … récursif … */ ] }
  ]
}
```

Règles de validation (refusées à l'enregistrement par l'outil auteur) :

- `cibleId` doit appartenir au **même cours** et avoir un `ordre` **strictement antérieur** (anti-cycle / anti-deadlock — voir §8) ;
- `score_quiz.quizId` doit cibler un `Quiz` du cours, `scorePct ∈ [0,100]` ;
- profondeur d'imbrication `groupe` ≤ 3 (lisibilité + perf) ;
- pas d'auto-référence (un élément ne peut se déverrouiller sur sa propre complétion).

### 5.5 Algorithme d'évaluation (pur, déterministe)

`src/server/elearning/progress/unlock-engine-rules.ts` — fonction pure, testable, sans I/O (les états sont pré-chargés) :

```
evaluerConditions(noeud, ctx) -> { ok: boolean, raisons: RaisonVerrou[] }
  resultats = noeud.conditions.map(c => evaluerCondition(c, ctx))
  ok = noeud.logic === "OR" ? resultats.some(r=>r.ok) : resultats.every(r=>r.ok)
  // on collecte les raisons des conditions NON satisfaites (pour l'affichage)
  raisons = resultats.filter(r=>!r.ok).map(r=>r.raison)
  return { ok, raisons }

evaluerCondition(c, ctx):
  completion : lire ctx.moduleProgress[cibleId] / ctx.lessonProgress[cibleId] ; ok = statut===etat
  date       : ok = c.sens==="apres" ? ctx.now >= c.date : ctx.now < c.date     // ctx.now = serveur UTC
  offset     : base = c.base==="premiereConnexionAt" ? enrollment.premiereConnexionAt ?? enrollment.accordeAt
                                                     : enrollment.accordeAt
               seuil = startOfDayParis(base) + c.jours jours ; ok = ctx.now >= seuil   // cf. §7 fuseau
  score_quiz : ok = unlock-engine.scoreAtteint(quizId, scorePct, enrollment)  // doc 03 §9 (vraie note)
  groupe     : récursion evaluerConditions
```

`ctx` (contexte pré-chargé en **une** requête, cf. §8) contient : `now` (UTC serveur), `enrollment` (`accordeAt`/`premiereConnexionAt`), la map `ModuleProgress`/`LessonProgress` de l'enrollment, et la map des meilleurs scores quiz.

---

## 6. Verrou affiché AVEC sa raison (jamais un cadenas muet)

Best practice 2026 : **toujours** dire _pourquoi_ c'est verrouillé et _comment_ débloquer. La raison est **calculée serveur** (i18n FR), **mise en cache** dans `ModuleProgress.verrouRaison` (doc 02 §5, `VarChar(300)`) et exposée à la leçon via le rendu (la `LessonProgress` n'a pas de colonne raison → la raison leçon est portée par le DTO de rendu, recalculée à la volée car peu coûteuse).

**DTO de rendu** (retour de `unlock-service.evaluateForRender`) :

```ts
type VerrouVerdict = {
  deverrouille: boolean;
  logic: "AND" | "OR";
  raison?: string; // phrase principale (la plus actionnable)
  raisons: RaisonVerrou[]; // détail par condition non satisfaite
  prochaineOuvertureAt?: string; // si déblocage temporel connu (date/offset) → compte à rebours
  override?: { actif: boolean; par?: string }; // §9
};

type RaisonVerrou =
  | { type: "completion"; texte: "Terminez « Module 2 — Cadrage »" }
  | { type: "date"; texte: "Disponible le 12 juillet 2026 à 10h00"; date: string }
  | { type: "offset"; texte: "Disponible 7 jours après le début (le 04/07/2026)"; date: string }
  | {
      type: "score_quiz";
      texte: "Réussissez « Quiz module 2 » (≥ 80 %) — meilleur score : 65 %";
      scoreRequis: 80;
      meilleurScore: 65;
    };
```

Règles de formulation :

- **AND** → on liste **toutes** les conditions manquantes (« Il reste à : … »).
- **OR** → on présente l'**option la plus proche** (« Disponible le 12/07, _ou_ dès que vous réussissez le quiz »).
- Conditions **temporelles** → on renvoie `prochaineOuvertureAt` pour un **compte à rebours** côté UI (pas de date brute seule).
- Conditions **score** → on affiche **toujours** `meilleurScore` (motivant + transparent).
- Dates affichées en **fuseau de l'apprenant** (Europe/Paris par défaut, cf. §7), jamais en UTC brut.

---

## 7. Anti-pièges

### 7.1 Fuseau horaire (le piège n°1 du drip)

- **Stockage** : `unlockDate` et toutes les dates de conditions sont en **UTC** (colonne `DateTime`, Postgres `timestamptz`). On ne stocke **jamais** une date « locale naïve ».
- **Comparaison** : faite avec `ctx.now` = **horloge serveur UTC** (`new Date()` côté serveur). **Jamais** l'horloge du navigateur (triche/dérive d'horloge — cf. 7.3).
- **Offset J+N** : pour éviter le classique « ça se débloque à 02h12 du matin » (heure exacte de l'octroi), l'offset est ancré au **début de journée Europe/Paris** de la base (`startOfDayParis(accordeAt) + N jours`). Donc « J+7 » = ouvre à **00h00 (Paris) du 7ᵉ jour**, déterministe et lisible. Implémentation via `date-fns-tz` (ou `Intl` + `Europe/Paris`), **pas** de calcul manuel `+N*86400000` (ignore les changements heure d'été).
- **Affichage** : conversion UTC → `Europe/Paris` à l'affichage uniquement. Le fuseau est une **constante plateforme** (`LMS_DISPLAY_TZ = "Europe/Paris"`), centralisée ; un champ `timezone` par apprenant est prévu V2 (multi-tenant international) mais **non requis** au MVP (audience FR).

### 7.2 Gating attempt-only (le piège n°2)

Déjà traité §4 : on vérifie **`scorePct ≥ seuil`**, pas l'existence d'une tentative. Test de non-régression obligatoire (§10) : une tentative `soumis` à 40 % avec seuil 70 % → **reste verrouillé**.

### 7.3 Horloge client non fiable

Tout verrou temporel/score est **réévalué serveur** à chaque navigation (`force-dynamic`, §8). Le client peut afficher un compte à rebours optimiste, mais **l'autorisation d'ouvrir la leçon est une décision serveur** : l'accès à `…/lecon/[lessonId]` revérifie le verrou avant de servir le contenu/URL signée vidéo (sinon, manipuler l'horloge JS suffirait à tricher).

### 7.4 Deadlock / cycle de conditions

Une règle ne peut cibler qu'un élément d'`ordre` **antérieur** dans le même cours (validation §5.4). Un **détecteur de cycle** (graphe de dépendances) tourne à la **publication** du cours (`06-CONSOLE-ADMIN/03-…`) : un cours dont un élément serait à jamais inatteignable est **refusé à la publication** (garde-fou, comme le check Ind.11 de la doc 03 §12).

### 7.5 Élément verrouillé masqué vs caché

`unlockHiddenWhenLocked` (§5.2) : par défaut `false` → l'élément est **visible mais grisé avec sa raison** (transparence pédagogique, recommandé). `true` → l'élément est **absent** du plan jusqu'au déblocage (usage rare, ex. surprise/examen). Jamais de troisième état « visible mais cliquable alors que verrouillé ».

### 7.6 Régression de progression

`percentVu`/`maxPositionSec` sont **monotones** (doc 02 §4) : un déverrouillage acquis ne se **re-verrouille pas** si l'apprenant rouvre un ancien module (sauf override admin de retrait explicite). Exception légitime : `statut` d'enrollment passe `suspendu`/`expire` → tout est refusé en amont (niveau accès, pas niveau unlock).

---

## 8. Implémentation backend (NEUF — `src/server/elearning/progress/`)

Réutilise l'architecture posée doc 02 §8 (rien de neuf côté tables ; on ajoute la logique de règles).

| Fichier cible                       | Rôle                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `unlock-service.ts`                 | **Orchestrateur** (existe déjà au plan doc 02). Charge le contexte, normalise mono→composé (§5.3), appelle l'évaluateur pur, **écrit** `ModuleProgress.estDeverrouille`/`verrouRaison`/`meilleurScorePct` et `LessonProgress.estDeverrouille`. Respecte l'override (§9). |
| `unlock-engine-rules.ts` (NEUF)     | **Évaluateur pur** AND/OR/groupe (§5.5). Sans I/O. 100 % testable.                                                                                                                                                                                                       |
| `unlock-conditions.ts` (NEUF)       | **Zod** : validation/normalisation de `unlockConditionsJson` (§5.4) + helpers de mapping mono→composé.                                                                                                                                                                   |
| `quiz/unlock-engine.ts` (doc 03 §9) | **Réutilisé** : `scoreAtteint(quizId, seuil, enrollment)` (vraie note). Appelé par l'évaluateur pour les conditions `score_quiz`.                                                                                                                                        |

**Chargement du contexte (1 passe, budget INP)** — `loadUnlockContext(enrollmentId)` :

1. lit `ElearningEnrollment` (`accordeAt`, `premiereConnexionAt`, `statut`) ;
2. lit toutes les `ModuleProgress` + `LessonProgress` de l'enrollment (déjà matérialisées, doc 02) → maps en mémoire ;
3. lit les `MAX(scorePct)` par `quizId` gatant (1 requête agrégée) ;
4. `now = serveur UTC`.

→ L'évaluation d'un plan entier se fait **sans N+1** : agrégats déjà en cache, scores en une requête.

**Quand recalcule-t-on (`unlock-service.recalcAll(enrollmentId)`)** :

- à chaque mutation de progression (`progress-service.recordLessonProgress` → après recalc des agrégats, doc 02 §8) ;
- à la soumission/correction d'un quiz gatant (`elearning-quiz-grading-worker`, doc 03 §11) ;
- à l'octroi de l'accès (`accordeAt` posé → init des `ModuleProgress`/`LessonProgress` + 1er calcul) ;
- à froid par `elearning-progress-rollup-worker` (filet, doc 02 §9) — pour rattraper les conditions **temporelles** qui deviennent vraies _sans_ action apprenant (date atteinte, offset écoulé) ; ce worker tourne en cron (≈ toutes les 15 min) et re-matérialise `estDeverrouille`/`verrouRaison` des éléments à déclencheur `date`/`offset` proches.

> ⚠️ Les conditions **temporelles** sont le seul cas où le verrou change **sans** interaction → c'est pourquoi le cron de rollup est nécessaire (sinon un module « date_fixe » resterait grisé jusqu'à la prochaine action de l'apprenant). Pour l'UX, le rendu page (`force-dynamic`) **réévalue aussi à la volée** (le cache peut être en retard de ≤ 15 min ; le rendu corrige immédiatement).

---

## 9. Override admin (déblocage forcé)

Besoin métier : un formateur/admin doit pouvoir **ouvrir** un module à un apprenant bloqué (problème technique, dérogation, rattrapage).

- **Donnée** : `ModuleProgress.overrideDeverrouille` (Boolean) + `overridePar` (uuid AdminUser) — **existant** doc 02 §5. (Granularité **module** au MVP ; override leçon possible V1 via un champ symétrique sur `LessonProgress` si besoin — additif.)
- **Sémantique** : si `overrideDeverrouille = true`, l'`unlock-service` **court-circuite** l'évaluation et force `estDeverrouille = true`, `verrouRaison = null`, `raison override` tracée dans le DTO (`override.actif = true`).
- **Traçabilité (preuve + RBAC)** : tout override émet un `ElearningXapiStatement` (`verb = launched`/contexte override, doc 02 §7) et est journalisé (qui/quand/pourquoi) — l'override est une **dérogation** qui doit pouvoir être justifiée en audit Qualiopi (ne pas vider le faisceau de preuves : la complétion réelle reste exigée pour le **certificat**, l'override ne fabrique pas de réussite quiz).
- **Action admin** : `src/app/[locale]/(admin)/[adminPrefix]/elearning/apprenants/actions.ts` → `overrideDeverrouillageModule(enrollmentId, moduleId, { raison })`, RBAC `requireAdminWrite` (rôles `super_admin/admin/editor` ; `src/server/actions/knowledge/_guards.ts`). Réversible (`retirerOverride`).
- **Limite** : l'override **ne valide jamais un quiz** (pas de réussite fabriquée) et **n'émet pas** le certificat de réalisation (celui-ci reste conditionné à la complétion + réussite réelles, doc 02 §6 `completion-service.ts`). C'est un déblocage de **parcours**, pas une **preuve d'acquisition**.

---

## 10. Frontend apprenant (NEUF — `src/components/elearning/`)

Routes (extension portail, ADR-LMS-0007 ; **`force-dynamic`**, derrière auth apprenant `PortailAcces`, compatible contrat build `stub.invalid` car rien n'est pré-rendu) :

- `src/app/[locale]/portail/cours/[courseSlug]/page.tsx` — plan du cours (outline) avec verrous.
- `src/app/[locale]/portail/cours/[courseSlug]/lecon/[lessonId]/page.tsx` — **revérifie le verrou serveur** avant de servir le contenu (§7.3). Si verrouillé → écran « contenu verrouillé » avec la raison + CTA (lien vers l'élément à terminer / compte à rebours).

Composants :

- `CourseOutline.tsx` — liste modules/leçons + état (terminé / en cours / verrouillé).
- `ModuleAccordion.tsx` — accordéon par module ; en-tête affiche `LockBadge` si verrouillé.
- `LockBadge.tsx` — cadenas + **résumé** de la raison (tooltip = détail). Cible ≥ 24×24 px (**WCAG 2.2 — 2.5.8**), focusable clavier, `aria-disabled` + texte alternatif décrivant la raison (pas qu'une icône).
- `LockReason.tsx` — bloc explicatif (liste `raisons`, compte à rebours via `prochaineOuvertureAt`).
- `ProgressBar.tsx` — barre de progression cours/module (lit `CourseProgress.percentComplet`/`ModuleProgress.percentComplet`, doc 02).

**Données** : la page lit les agrégats **déjà matérialisés** (`ModuleProgress.estDeverrouille`/`verrouRaison`) → rendu rapide. Pour la **raison fraîche** (compte à rebours, meilleur score à la seconde près), un appel serveur léger `evaluateForRender` peut compléter (chemin chaud → garder ≤ 1 requête, budget **INP ≤ 100 ms**).

**Accessibilité (rappel transversal, détail `05-FRONTEND-APPRENANT/05-…`)** : verrou annoncé (`aria-live` à l'ouverture/déblocage), focus géré, contraste AA sur l'état grisé, **jamais** d'élément verrouillé qui semble cliquable sans feedback. EAA (obligation UE depuis 28/06/2025).

---

## 11. Conformité (FOAD / Qualiopi)

Le déverrouillage **sert** la preuve, il ne la remplace pas :

- Le **gating par score** matérialise les **évaluations qui jalonnent** le parcours → **Ind.11 (majeur)** : un cours certifiant doit avoir au moins un quiz `evaluation`/`final_certificatif` gatant ou final (garde-fou publication, doc 03 §12).
- L'**information sur les activités et la durée** (D.6313-3-1 §2) s'appuie sur `dureeEstimeeMinutes` (doc 01) affichée à côté de chaque élément, verrouillé ou non (transparence : l'apprenant voit _ce qui l'attend_).
- L'**override admin** est une dérogation **tracée** (preuve d'accompagnement / Ind.19), n'altère pas le faisceau de preuves de réalisation (doc 02 §10).
- Les **événements de déverrouillage/complétion** alimentent `ElearningXapiStatement` (`completed`/`passed`/`failed`, doc 02 §7) = logs LMS du faisceau R.6313-3 (relevé de connexion seul insuffisant).

---

## 12. Tests (extrait `09-QUALITE/01-plan-tests.md`)

Cas non-régression obligatoires (`src/server/elearning/progress/__tests__/unlock-engine-rules.spec.ts`) :

1. `apres_precedent` : module k verrouillé tant que module k-1 ≠ `termine` ; déverrouillé dès `termine` ; module 0 = `immediat`.
2. `score_quiz` **attempt-only refusé** : tentative `soumis` 40 % / seuil 70 % → **verrouillé** ; à 70 % → ouvert ; `a_corriger` → verrouillé.
3. **AND** : 2 conditions, ouvre seulement si les deux vraies ; raisons listent les manquantes.
4. **OR** : ouvre dès qu'une vraie ; raison = option la plus proche.
5. **groupe** imbriqué (profondeur 2) AND(OR(...)).
6. **Fuseau** : `date_fixe` à 08:00Z évalué correctement autour du changement d'heure été/hiver ; `offset` J+7 ancré à 00h00 Paris (pas l'heure d'octroi).
7. **Horloge client ignorée** : la décision dépend de `ctx.now` serveur (mock), pas d'un timestamp fourni par le client.
8. **Override** : `overrideDeverrouille=true` ouvre sans satisfaire les conditions, mais **n'émet pas** de réussite quiz ni de certificat.
9. **Anti-cycle** : config ciblant un `ordre` postérieur → rejetée à la validation.
10. **Cron temporel** : `elearning-progress-rollup-worker` débloque un `date_fixe` une fois la date passée **sans** action apprenant.

---

## Liens

- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningModule`/`ElearningLesson` + enum `ElearningUnlockType`, champs `unlock*` (mono-condition).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ModuleProgress.estDeverrouille`/`verrouRaison`/`overrideDeverrouille`/`meilleurScorePct`, `LessonProgress.estDeverrouille`, `ElearningEnrollment.accordeAt`/`premiereConnexionAt`, services `progress-service`/`unlock-service`, worker `elearning-progress-rollup-worker`.
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — gating par score (`Quiz.seuilReussitePct`, `QuizAttempt.scorePct`), `quiz/unlock-engine.ts`, `elearning-quiz-grading-worker`.
- `03-DATA-MODEL/06-strategie-migrations.md` — séquence additive (colonnes `unlock_logic`/`unlock_conditions_json`/`unlock_hidden_when_locked` + enum `ElearningUnlockLogic`).
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — player & heartbeat (consommateur des verrous).
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` — rendu quiz (source des scores de gating).
- `05-FRONTEND-APPRENANT/05-mobile-accessibilite-wcag.md` — WCAG 2.2 AA des verrous/cadenas.
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — édition des règles de déverrouillage (UI conditions AND/OR) + check de cycle à la publication.
- `06-CONSOLE-ADMIN/04-gestion-apprenants.md` — action d'override admin.
- `08-CONFORMITE/01-foad-d6313-3-1.md`, `02-qualiopi-indicateurs-foad.md` — Ind.11 (évaluations jalons), Ind.19 (assistance), R.6313-3 (preuves).
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0007 (cloisonnement `src/server/elearning/**`), ADR-0008 (migrations additives).
