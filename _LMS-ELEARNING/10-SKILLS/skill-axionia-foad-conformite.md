---
name: axionia-foad-conformite
description: >-
  Garde-fou conformité du module LMS / e-learning d'Axion-IA (organisme de
  formation IA, SAS française, NDA DREETS AURA, certifié Qualiopi). À INVOQUER
  AVANT, PENDANT et APRÈS toute modification du code e-learning (cours, modules,
  leçons, progression, quiz, octroi d'accès, player vidéo, certificats, emails,
  workers, migrations, écrans admin/apprenant) pour garantir que la FOAD reste
  FINANÇABLE et conforme. Vérifie : les 3 conditions cumulatives de l'art.
  D.6313-3-1 (assistance technique ET pédagogique avec SLA = Ind.19 ; information
  activités + durée moyenne ; évaluations qui jalonnent ET concluent = Ind.11
  non-conformité MAJEURE) ; les indicateurs Qualiopi V8 FOAD (1, 6, 9, 10, 11★,
  12, 17, 19) ; la preuve libre R.6313-3 (faisceau d'indices, relevé de connexion
  SEUL insuffisant) ; le certificat de réalisation (modèle officiel, heures
  réalisées) ; le verrou CPF/RNCP-RS (EDOF gated, cpf refusé sans certification) ;
  la conservation RGPD différenciée (10 ans comptable, 6 ans fiscal/OPCO, 3-5 ans
  preuves, 6 mois-1 an logs) et l'effacement par anonymisation. Respecte les
  contraintes plateforme : migrations ADDITIVES (ADR-0008), build stub.invalid
  (ADR 0026), cloisonnement src/server/elearning/** (ADR-0007), FR canonique,
  Nodemailer maison, Web Vitals stricts. Déclencheurs : « FOAD », « D.6313-3-1 »,
  « R.6313-3 », « Qualiopi e-learning », « indicateur 11 / 19 », « preuve de
  réalisation », « faisceau de preuves », « certificat de réalisation »,
  « assiduité FOAD », « tutorat / assistance pédagogique », « gating par score »,
  « quiz bloquant », « CPF », « EDOF », « RNCP / RS », « France Compétences »,
  « entrée effective », « service fait », « conservation / rétention e-learning »,
  « RGPD apprenant », « certification-ready », « octroi d'accès e-learning ».
---

# Skill — Conformité FOAD / Qualiopi / CPF-RNCP / RGPD du LMS Axion-IA

> **Rôle.** Ce skill est le **garde-fou conformité** du module e-learning. Il ne
> construit pas le LMS (voir `skill-axionia-lms-core` / `skill-axionia-lms-authoring`) :
> il garantit qu'**aucune modification ne casse l'imputabilité / le financement**
> de la FOAD. C'est un skill de **revue + checklist + blocage**, à appliquer à
> chaque touche du code e-learning.
>
> **Public.** Dev senior + référent Qualiopi. **FR canonique** (EN désactivé).
>
> **Source de vérité.** Les 6 documents `_LMS-ELEARNING/08-CONFORMITE/*` (ce skill
> les opérationnalise, il ne les remplace pas). En cas de doute réglementaire, le
> doc fait foi ; ce skill est la version « checklist exploitable ».
>
> **Notation.** 🟦 EXISTANT (réutilisé / étendu) · 🟩 NEUF (à construire sous
> `src/server/elearning/**`, ADR-LMS-0007).

---

## 0. TL;DR — la conformité en une page

La FOAD (e-learning asynchrone) n'est **finançable** (OPCO, entreprise, vente
directe ; CPF seulement après certification) que si elle respecte
**l'art. D.6313-3-1** du Code du travail = **3 conditions cumulatives** :

| #     | Condition D.6313-3-1                                           | Indicateur Qualiopi                       | Brique LMS                                                     | Preuve produite                                      |
| ----- | -------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| **1** | Assistance technique **ET** pédagogique, **délais formalisés** | **Ind.19** (seule obligation FOAD nommée) | tutorat + SLA + tuteur RAG (V1) 🟩                             | registre d'assistance horodaté + `premiereReponseAt` |
| **2** | **Information** sur les activités **et la durée moyenne**      | Ind.1 / Ind.9                             | `ElearningCourse.dureeEstimeeMinutes` + onboarding acquitté 🟩 | fiche + Modalités FOAD + `onboardingVuAt`            |
| **3** | **Évaluations** qui **jalonnent ET concluent**                 | **Ind.11 ★ (NC MAJEURE si absente)**      | quiz bloquants + finale → `EvaluationAcquis` 🟩+🟦             | `QuizAttempt` + relevé d'évaluations                 |

**Preuve (R.6313-3) = preuve LIBRE mais faisceau d'indices.** Pas d'émargement
obligatoire en FOAD, **MAIS le relevé de connexion SEUL est insuffisant**.
La plateforme constitue automatiquement un faisceau à **5 familles** (logs
d'activité, progression, évaluations+travaux, assistance, certificat) et le rend
exportable (`ElearningPreuveExport` + worker, doc 06).

**Sortie obligatoire :** certificat de réalisation (modèle officiel, **heures
réalisées**, obligatoire depuis 01/06/2020) via `DocumentGenere` 🟦.

> ⚠️ **Ce qui ferme un financement** : (a) pas d'évaluation jalonnante → NC majeure
> Ind.11 ; (b) pas de canal d'assistance avec SLA → NC Ind.19 ; (c) preuve réduite
> au seul relevé de connexion → requalification « action non réalisée » +
> remboursement. **Les 3 sont adressés DÈS LE MVP.** Ne jamais régresser dessus.

---

## 1. Quand ce skill se déclenche (déclencheurs)

Invoque ce skill **dès qu'une tâche touche** l'un de ces périmètres :

**Mots-clés métier :** FOAD, D.6313-3-1, R.6313-3, L.6362-6, Qualiopi e-learning,
indicateur 11 / 19 / 12, preuve de réalisation, faisceau de preuves, certificat de
réalisation, assiduité, entrée effective, service fait, tutorat / assistance
pédagogique, SLA, gating par score, quiz bloquant, déverrouillage / drip, CPF,
EDOF, RNCP, RS, France Compétences, conservation / rétention, RGPD apprenant,
effacement, anonymisation, certification-ready, octroi d'accès e-learning.

**Périmètres de code (chemins) :**

- `src/server/elearning/**` (tout) — en particulier `conformite/`, `quiz/`,
  `progress/`, `tutoring/` (ou `support/`), `edof/`, `access/`, `certificat`.
- `src/server/queue/workers/elearning-*-worker.ts` (certificat, relance,
  agrégat, preuve-export, retention-purge, edof-\*).
- Migrations Prisma ajoutant/modifiant `Elearning*`, `Quiz*`, `Lesson*`,
  `Course*`, `Module*`, `Edof*`, ou **étendant** `EvaluationAcquis`,
  `Questionnaire`, `Trainee`, `DocumentGenere`, `DocumentType`.
- `src/app/[locale]/portail/elearning/**` (apprenant) et
  `src/app/[locale]/(admin)/[adminPrefix]/elearning/**` (admin).
- `src/components/elearning/**` & `src/components/admin/elearning/**` (player,
  quiz, panneau d'aide, verrou affiché avec sa raison).
- Toute modif du **certificat**, des **emails e-learning**, des **durées de
  rétention**, de l'**export RGPD** ou de la **publication d'un cours**.

**Règle d'or :** si tu ajoutes/supprimes une fonctionnalité qui produit (ou
cesse de produire) une **preuve**, ou qui touche une **évaluation**, une
**assistance**, une **durée affichée**, un **certificat** ou une **rétention** →
passe ce skill **avant de coder** (pour concevoir conforme) **et avant de
merger** (checklist DoD).

---

## 2. Les invariants NON NÉGOCIABLES (le contrat)

Ne JAMAIS livrer une modif qui viole l'un de ces invariants sans \*\*STOP & ASK Will

- ADR\*\* :

1. **Ind.11 — évaluation jalonnante + finale.** Un cours `estFoad=true` doit avoir
   des évaluations qui jalonnent (quiz de gating par module) **et** concluent
   (quiz/évaluation finale reliés aux objectifs). Absence = **NC MAJEURE**.
2. **Gating par VRAIE note, jamais attempt-only.** Le déverrouillage de module
   utilise `ElearningModule.unlockType = score_quiz` + `unlockQuizId` +
   `unlockScorePct`. Débloquer « parce qu'il a tenté » ≠ preuve d'acquisition.
3. **Scoring + temps mesurés SERVEUR.** Jamais le client. `QuizAttempt.scorePct`,
   horodatage serveur (`@default(now())`), randomisation questions/réponses.
4. **Ind.19 — assistance technique ET pédagogique avec SLA tenu et mesuré.**
   Canal de tutorat + délai annoncé (`slaHeures`) **affiché = tenu**, première
   réponse mesurée (`premiereReponseAt` / `firstResponseAt`). Le tuteur RAG
   **augmente** mais ne **remplace pas** l'humain (escalade humaine toujours
   possible, sinon NC).
5. **Durée affichée = obligatoire.** `dureeEstimeeMinutes` (leçon + agrégat cours)
   est un **gate de publication** (condition 2 / Ind.1). Pas de durée → pas de
   publication.
6. **Faisceau ≥ relevé de connexion.** Tout dossier de preuve doit croiser
   activité réelle + évaluation + accompagnement. `assertFaisceauComplet` **refuse**
   un dossier réduit au seul log de connexion.
7. **Certificat conditionné à la réussite réelle.** Émis seulement si
   `reussite == true` **ET** progression obligatoire `== 100%` **ET**
   `scorePct ≥ ElearningCourse.seuilReussitePct`. Heures = **réalisées** (jamais
   un certificat « offert »).
8. **CPF refusé sans certification + EDOF.** Financeur `cpf` interdit à l'écriture
   tant que `!isEdofEnabled()` **OU** cours non adossé à une `Formation.cpfEligible`.
   `EDOF_ENABLED=false` par défaut. Activer EDOF/CPF sans RNCP/RS = fraude
   (loi 2022-1587).
9. **Conservation différenciée respectée.** Logs techniques 6 mois–1 an ;
   preuves de réalisation 3–5 ans ; OPCO/fiscal 6 ans ; comptable 10 ans.
   **Jamais** purger une preuve avant sa durée légale ; **jamais** garder un log
   brut au-delà de la sienne.
10. **Effacement RGPD = anonymisation sous contrainte légale.** Jamais de `DELETE`
    physique d'une preuve de réalisation tant que la durée court (art. 17§3-b).
11. **Migrations strictement additives** (ADR-0008). FK ajoutées **nullable**,
    aucun `DROP`, aucune colonne `NOT NULL` sur table existante peuplée.
12. **Stub-awareness** (ADR 0026). Tout service de conformité fait
    `if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return <fallback>`
    avant toute query ; pages/routes derrière auth + `force-dynamic` ; workers
    gated `BULLMQ_DISABLED`.

---

## 3. Arbre de décision — « je touche à X → je vérifie Y »

| Je modifie…                                       | Je dois vérifier (gate)                                                                                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Le moteur de quiz / la correction**             | Scoring serveur, temps serveur, `scorePct`, randomisation, seuil ; le quiz peut servir de **gate** (Ind.11). §5.3                                                                |
| **Le déverrouillage (drip / gating)**             | `unlockType=score_quiz` quand c'est une évaluation ; **verrou affiché AVEC sa raison** (Ind.10 / condition 2) ; override admin tracé (motif). §5.2                               |
| **La progression / le heartbeat / le player**     | Reprise serveur (pas localStorage) ; deltas plafonnés (anti onglet ouvert) ; complétion vidéo `maxPositionSec ≥ 0,95×durée` ; alimente `tempsPasseSec` (heures certificat). §5.4 |
| **L'octroi d'accès / l'import CSV / la commande** | `assertCpfAllowed` (refus `cpf` si !EDOF ou non certifiant) ; consentement traces ; financeur valide. §5.6                                                                       |
| **Le certificat**                                 | Conditions §2.7 ; **heures réalisées** (Option A durée parcours) en centièmes ; modalité « à distance (FOAD) » ; `qrToken`+hash. §5.5                                            |
| **L'assistance / tutorat / emails**               | Deux canaux (technique+pédago), SLA affiché=tenu, `premiereReponseAt`, traces horodatées, escalade humaine ; Nodemailer maison. §5.1                                             |
| **La publication d'un cours (`publishCourse`)**   | **Garde-fou bloquant** : durée OK + ≥1 tuteur + SLA défini + page d'aide active + ≥1 évaluation finale (si `estFoad`). §5.7                                                      |
| **La durée affichée / le programme**              | `dureeEstimeeMinutes` recalculé à la publication ; snapshot capturé dans l'export (pas la version courante). §5 cond.2                                                           |
| **Une migration / le data model**                 | Additive, FK nullable ; étendre `EvaluationAcquis`/`Questionnaire`/`Trainee`/`DocumentType` sans DROP ; rétention attachée. §6                                                   |
| **La rétention / la purge / l'export RGPD**       | Familles A/B/C/D respectées ; agrégat AVANT purge ; anonymisation conserve la preuve ; `resolveRetentionMonths` (policy→env→fallback, garde `<1`). §7                            |
| **EDOF / CPF / RNCP**                             | Tout gated `isEdofEnabled()` ; `cpfEligible` dérivé (jamais saisi) ; rien ne s'active sans certif France Compétences. §8                                                         |
| **Le tracking (xAPI-like)**                       | Horodatage serveur, `ipHash` SHA-256 (jamais IP claire), append-only, purge 6–12 mois ; agrégats figés avant purge. §5.4 / §7                                                    |

---

## 4. Noms canoniques des modèles (lever l'ambiguïté inter-docs)

Les docs `08-CONFORMITE` ont évolué et emploient parfois des noms voisins
(`ElearningTutoring*` ~ `ElearningSupportThread/Message` ~ `ElearningTutorInteraction` ;
`ElearningActivityEvent` ~ `ElearningActivityLog` ~ `ElearningXapiStatement`).

**Règle de résolution :** la **source de vérité des noms** est le data model
(`03-DATA-MODEL/02-schema-progression-tracking.md`, `…/03-schema-quiz-evaluations.md`,
`…/04-schema-comptes-acces-auth.md`). Le doc le plus récent (`06-tracabilite…`)
fixe les noms suivants — **les utiliser** sauf si le data model les a renommés :

| Concept                                   | Nom canonique à utiliser                                                        | Statut      |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ----------- |
| Cours / module / leçon / ressource        | `ElearningCourse` / `ElearningModule` / `ElearningLesson` / `ElearningResource` | 🟩 (doc 01) |
| Inscription / accès apprenant             | `ElearningEnrollment`                                                           | 🟩          |
| Progression                               | `LessonProgress` / `ModuleProgress` / `CourseProgress`                          | 🟩          |
| Log d'activité (verbe/objet, append-only) | `ElearningXapiStatement` (`ipHash`, `occurredAt`)                               | 🟩          |
| Quiz                                      | `Quiz` / `Question` / `QuizAttempt` (+ `QuizAnswer`)                            | 🟩          |
| Travail rendu (devoir)                    | `LessonProgress.devoirR2Key` / `devoirRenduAt`                                  | 🟩          |
| Tutorat / assistance (Ind.19)             | tables d'assistance définies en doc 04/09 (thread + message + SLA)              | 🟩          |
| Synthèse d'éval Qualiopi                  | `EvaluationAcquis` (+ FK nullable `elearningEnrollmentId`)                      | 🟦 étendu   |
| Positionnement / satisfaction             | `Questionnaire` (+ FK nullable `elearningEnrollmentId`)                         | 🟦 étendu   |
| Certificat / docs                         | `DocumentGenere` (+ `DocumentType.certificat_realisation`, `modalites_foad`)    | 🟦 étendu   |
| Export de preuve                          | `ElearningPreuveExport` (+ enums portée/statut)                                 | 🟩          |
| CPF/EDOF                                  | `EdofDossier` / `EdofDeclaration` / `EdofAssiduiteSnapshot`                     | 🟩 gated    |
| Rétention                                 | `ElearningRetentionPolicy` (+ enums famille/mode)                               | 🟩          |

> **Si tu introduis un nouveau nom de modèle, propage-le dans les docs concernés**
> (cohérence inter-docs) plutôt que d'ajouter une 4ᵉ variante. Signale toute
> divergence détectée comme dette à corriger.

---

## 5. Gates de conformité par condition (à dérouler à chaque modif)

### 5.1 Condition 1 — Assistance technique ET pédagogique (Ind.19) 🟩

**Exigence.** Deux assistances distinctes, accessibles, **délais formalisés**, +
**traces** opposables.

**Gate :**

- [ ] Canal de tutorat (thread + messages) avec `categorie ∈ {technique, pedagogique}`.
- [ ] `slaHeures` par catégorie : **la valeur affichée = la valeur tenue** (sinon NC).
- [ ] `premiereReponseAt` / `firstResponseAt` renseigné à la 1ʳᵉ réponse (preuve délai).
- [ ] Panneau « Besoin d'aide ? » persistant dans le player
      (`src/components/elearning/TutoringPanel.tsx`) : 2 canaux + délai engagé + contact.
- [ ] Page d'aide apprenant (`…/portail/elearning/aide`) accessible **en permanence**.
- [ ] Emails via file `email` + `email-worker` 🟦 + templates `elearning-tutoring-*.tsx`
      (mêmes conventions que `qualiopi-*.tsx`). **Pas de service tiers** (Nodemailer maison).
- [ ] Tuteur RAG (V1) **ancré + citations**, journalisé comme trace ; **escalade
      humaine toujours dispo** (le chatbot seul ne satisfait pas Ind.19).
- [ ] Relances anti-décrochage (Ind.12, V1) : worker `elearning-relance-worker.ts`
      sur inactivité (`ElearningEnrollment.dernierAccesAt`).

### 5.2 Condition 2 — Information sur les activités ET la durée (Ind.1/9) 🟩

**Gate :**

- [ ] `ElearningLesson.dureeEstimeeMinutes` (microlearning 2–10 min) + agrégat
      `ElearningCourse.dureeEstimeeMinutes` recalculé à la publication.
- [ ] **Durée = gate de publication** (pas de durée → publication refusée).
- [ ] Écran « Programme & déroulé » : objectifs, prérequis, public visé, liste des
      activités typées, durée par leçon + total, **règles de déverrouillage
      affichées AVEC leur raison** (verrou explicité, jamais muet).
- [ ] Document « Modalités FOAD » par cours via `DocumentGenere`
      (`DocumentType.modalites_foad`) : durée moyenne + activités + assistance/SLA + modalités d'évaluation + accessibilité handicap (réutilise référent handicap 🟦).
- [ ] Onboarding acquitté : `ElearningEnrollment.onboardingVuAt` horodaté + email
      d'octroi (`elearning-acces-octroye.tsx`).

### 5.3 Condition 3 — Évaluations qui jalonnent ET concluent (Ind.11 ★) 🟩+🟦

**C'est le point de chute fatal d'un audit FOAD. NC MAJEURE si absent.**

**Gate :**

- [ ] Moteur de quiz interactif (`Quiz`/`Question`/`QuizAttempt`), ~12 types (QCM
      mono/multi, V/F, appariement, texte à trous, ordonnancement, réponse courte,
      essai+correction manuelle, upload) + barème/pondération + seuil + rationale.
- [ ] **Jalons** : `ElearningModule.unlockType = score_quiz` + `unlockQuizId` +
      `unlockScorePct` (le module suivant reste verrouillé tant que le seuil n'est
      pas atteint) → **gating par score réel, pas attempt-only**.
- [ ] **Conclusion** : quiz/évaluation finale, seuil global
      `ElearningCourse.seuilReussitePct` (défaut 70) → conditionne le certificat.
- [ ] Scoring **serveur** (`soumettreTentative` dans
      `src/server/elearning/quiz/quiz-service.ts`), temps serveur, randomisation.
- [ ] **Pont registre Qualiopi** : à la complétion, `syncEvaluationAcquisFromQuiz`
      matérialise un `EvaluationAcquis` 🟦 (FK nullable `elearningEnrollmentId`
      additive ; invariant « exactement un de enrollment / coaching / elearning »).
- [ ] Devoirs (`ElearningLessonType.devoir`) : upload R2 + correction/notation
      manuelle → travail produit = pièce maîtresse du faisceau R.6313-3.

### 5.4 Faisceau de preuves R.6313-3 (5 familles) 🟩

**Gate :**

- [ ] (1) Logs d'activité `ElearningXapiStatement` : verbe/objet, `occurredAt`
      **serveur**, `ipHash` SHA-256 (salt `IP_HASH_SALT` 🟦), **append-only**.
- [ ] (2) Progression `LessonProgress`/`ModuleProgress`/`CourseProgress` :
      `percentVu` monotone, `tempsPasseSec` **actif réel** (deltas plafonnés),
      `maxPositionSec` (anti seek-to-end), `completedAt`.
- [ ] (3) Évaluations + travaux (cf. 5.3).
- [ ] (4) Traces d'assistance (cf. 5.1).
- [ ] (5) Certificat (cf. 5.5).
- [ ] **`assertFaisceauComplet`** (`src/server/elearning/conformite/faisceau-guard.ts`)
      refuse un dossier réduit au seul relevé de connexion : exige ≥1 évaluation
      **finale** si `statut=termine` (Ind.11), `tempsPasseSec>0` corroborant, et
      certificat présent si `reussite`.
- [ ] Export `ElearningPreuveExport` (worker `elearning-preuve-export-worker.ts`) :
      ZIP scellé (synthèse PDF + CSV + travaux + assistance + certificat +
      `manifest.json` avec SHA-256 par pièce). Immuable (un contrôle = un export daté).

### 5.5 Certificat de réalisation (sortie obligatoire) 🟦 étendu

**Gate :**

- [ ] Réutilise `DocumentGenere` + `qrToken` + `hashSha256` + `suppressionPrevueAt`
      (`schema.prisma:5507`) + template `certificat-realisation.tsx`.
- [ ] **Heures en centièmes** via `formatHeuresCentiemes` (ex. `7 → "7,00 heures"`).
- [ ] **Heures réalisées — Option A (défaut FOAD)** : durée estimée du parcours
      conditionnée à complétion+réussite ; `tempsTotalSec` archivé comme corroborant
      dans `metadata` (`{ dureeCertifiee, tempsActifSec, mode }`). Option B (chrono
      réel) seulement si exigence financeur.
- [ ] Modalité **« à distance (FOAD) »** sur le certificat.
- [ ] Émission par `elearning-certificat-worker.ts` **conditionnée** :
      `reussite && progression obligatoire==100% && scorePct ≥ seuilReussitePct`.
- [ ] Liaison `ElearningEnrollment.certificatDocumentId` + visible portail apprenant
      (`getEspaceStagiaire` étendu, signed URL fraîche).

### 5.6 Octroi d'accès / commande (garde-fou financeur) 🟩

**Gate :**

- [ ] `assertCpfAllowed(course, formation)` dans `grant-access.ts` **et** au check-out
      `Order` : `cpf` refusé si `!isEdofEnabled()` ou `!formation.cpfEligible`.
- [ ] OPCO / direct / france_travail : OK dès le MVP (le faisceau suffit à être payé).
- [ ] Consentement traces d'apprentissage recueilli à la 1ʳᵉ connexion
      (`consentementVersion = "elearning-v1"` 🟦, base légale 6.1.b+6.1.c, pas le
      consentement → distinguer du marketing).

### 5.7 Garde-fou de PUBLICATION (`publishCourse`) — bloquant 🟩

> Miroir des gardes `conformite.ts` Qualiopi existantes (facture/convention bloquées
> si identité OF vide).

Un cours `estFoad=true` ne peut être **publié** que si **TOUT** est vrai :

- [ ] `dureeEstimeeMinutes` renseignée (cond.2).
- [ ] ≥1 tuteur rattaché (Ind.17/19).
- [ ] SLA défini (Ind.19).
- [ ] page d'aide active (Ind.19).
- [ ] ≥1 évaluation **finale** + ≥1 quiz **jalonnant** reliés aux objectifs (Ind.11).

Sinon → throw explicite (`ElearningError`), **pas** de publication.

---

## 6. Data model & migrations (additif — ADR-0008)

À chaque migration touchant le LMS :

- [ ] **Aucun `DROP`**, aucune colonne `NOT NULL` sur table existante peuplée.
- [ ] FK e-learning ajoutées aux modèles 🟦 (`EvaluationAcquis.elearningEnrollmentId`,
      `Questionnaire.elearningEnrollmentId`, `Trainee.passwordHash`,
      relations inverses `Formation`/`Client`/`AdminUser`) = **nullable**.
- [ ] Enums étendus par **ajout** de valeurs (`DocumentType.certificat_realisation`
      si absent, `modalites_foad`, `dossier_preuve_foad`).
- [ ] Tables CPF/EDOF créées **dès le MVP** mais **vides** (gated usage) — pas de
      migration plus tard.
- [ ] Rétention attachée à toute nouvelle table (famille A/B/C/D, §7).
- [ ] Build `stub.invalid` OK après `pnpm prisma:generate` (le SSG ne doit pas
      muter ; toute page DB-dependent = `force-dynamic` derrière auth).
- [ ] Seeds (`prisma/seed-elearning-retention.ts`, etc.) exécutés **au runtime**,
      jamais au build ; `upsert` idempotent.

---

## 7. Conservation & RGPD (différenciée)

**4 familles → durée + mode de purge + inclusion export :**

| Famille                        | Exemples                                                                                  | Durée                                  | Mode                        | Export RGPD             |
| ------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------- | ----------------------- |
| **A — logs techniques**        | `ElearningXapiStatement` (heartbeats), authlog, sessions                                  | **6 mois–1 an**                        | hard delete (après agrégat) | non (IP hashée, art.23) |
| **B — traces pédagogiques**    | `LessonProgress` détail, `QuizAttempt`/`QuizAnswer` détail                                | 3 ans (agrégé avant purge)             | hard delete détail          | oui (agrégé)            |
| **C — preuves de réalisation** | `EvaluationAcquis`, devoirs R2, snapshots assiduité, `ElearningPreuveExport`, certificats | **3–5 ans** (6 si OPCO, 10 si facture) | **anonymisation** seulement | oui                     |
| **D — contractuel/comptable**  | `Invoice`/`Payment`, commandes, consentements                                             | 6 ans fiscal / **10 ans** comptable    | conservation                | oui                     |

**Gate :**

- [ ] **Agrégat AVANT purge** : `elearning-aggregate-worker` (`30 2 * * *`) fige les
      snapshots (A→C) **avant** la purge (`0 3 * * *`). La preuve survit à la purge
      des logs bruts.
- [ ] `resolveRetentionMonths(type)` = policy DB (`ElearningRetentionPolicy`) → env
      (`ELEARNING_RETENTION_*_MONTHS`) → fallback code ; **garde anti-misconfig** :
      toute valeur `< 1` ignorée (jamais purge à 0 mois).
- [ ] **Effacement = anonymisation** : `supprimerStagiaire` 🟦 étendu révoque
      `ElearningSession`, nullify `passwordHash`, anonymise PII péri-preuve **mais
      CONSERVE** `QuizAttempt`/snapshots/certificats tant que la durée court
      (art. 17§3-b). Un certificat reste vérifiable par `qrToken`, le `Trainee`
      affiche `[supprime]`.
- [ ] **Export** `exporterDonneesStagiaire` 🟦 étendu inclut les entités e-learning
      (enrollments, progression agrégée, quiz, devoirs, tutorat, commandes,
      certificats) ; **exclut** la Famille A (logs/sessions).
- [ ] Purge R2 (`deleteFromR2` 🟦) des PDF/devoirs **à terme** de la durée légale.
- [ ] Sous-processeur **Cloudflare Stream (ou Bunny, UE)** ajouté à
      `/sous-processeurs` + registre art.30 ; watermark vidéo = PII (email/ID), pas
      de stockage de l'image watermarkée.
- [ ] Tout service purge/export/policy **stub-aware** (early-exit `stub.invalid`),
      workers gated `BULLMQ_DISABLED`, `captureWorkerError`.

---

## 8. CPF / RNCP-RS / EDOF (gated — le verrou n'est PAS le code)

**Règle dure :** le CPF ne finance que des actions **certifiantes RNCP ou RS**
enregistrées à France Compétences. Un e-learning non certifiant **n'est jamais
éligible CPF**, quelle que soit sa qualité. Le verrou est **réglementaire**
(dossier France Compétences, hors code) — voir `04-dossier-certification-rncp-rs.md`.

**Gate :**

- [ ] `EDOF_ENABLED=false` par défaut (pattern `STRIPE_ENABLED`) ; secrets EDOF
      `.optional()` (build `stub.invalid` non bloqué).
- [ ] `isEdofEnabled()` (`src/server/elearning/edof/edof-config.ts`) = flag ON **ET**
      config minimale présente — seul point de vérité (jamais `env.EDOF_ENABLED` nu).
- [ ] `Formation.cpfEligible` **dérivé** (jamais saisi) : `(codeRncp||codeRs)` valide
      dans sa fenêtre + `edofVerifieAt != null` (helper
      `cpf-eligibility.ts` partagé Qualiopi ↔ e-learning).
- [ ] `assertCpfAllowed` au check-out / octroi (cf. 5.6) — effet MVP : `cpf` toujours
      refusé.
- [ ] Workers EDOF (`elearning-edof-entree`, `…-assiduite`, `…-service-fait`,
      webhook) **no-op immédiat** si `!isEdofEnabled()`.
- [ ] Tables `EdofDossier`/`EdofDeclaration`/`EdofAssiduiteSnapshot` créées mais
      **vides** au MVP ; rien n'écrit dedans flag OFF.
- [ ] Badge admin CPF par cours : gris « non éligible » / orange « prêt — EDOF off »
      / vert « actif ».
- [ ] **Activation jour J** = certif renseignée sur la `Formation` + secrets Coolify + **redeploy** (pas restart) — aucune refonte.

> ⚠️ Ne jamais retirer le garde `assertCpfAllowed` ni le check `isEdofEnabled()`
> « pour tester ». Vendre/financer en CPF sans certif = fraude (loi 2022-1587).

---

## 9. Anti-patterns conformité (à NE JAMAIS faire)

1. **Gating attempt-only** (débloquer après « tentative » sans note) → NC Ind.11.
2. **Scoring / temps côté client** → preuve falsifiable.
3. **Réduire la preuve au relevé de connexion** → insuffisant R.6313-3 →
   requalification + remboursement.
4. **Pas de canal d'assistance / SLA non formalisé / non mesuré** → NC Ind.19.
5. **Chatbot seul comme « assistance pédagogique »** → Ind.19 exige l'humain
   (RAG augmente, n'remplace pas).
6. **Durée non affichée** → NC condition 2 / Ind.1.
7. **Verrou muet** (sans raison affichée) → NC Ind.10 / mauvaise UX.
8. **Certificat sans réussite réelle** (heures « offertes ») → faux en écriture.
9. **Proctoring intrusif par défaut** → disproportion CNIL (proctoring optionnel,
   high-stakes RNCP seulement, avec alternative — critères WCAG 2.2 AA aussi).
10. **Activer EDOF/CPF sans certification RNCP/RS** → fraude.
11. **Purger une preuve avant sa durée légale** ou **garder un log brut** au-delà.
12. **`DELETE` physique d'une preuve** sur demande RGPD (utiliser l'anonymisation).
13. **Migration destructive** (DROP / NOT NULL sur table peuplée) → casse prod.
14. **Muter la DB au SSG** (oubli `force-dynamic` / `stub.invalid` guard) → build fail.
15. **Dupliquer un système de preuve/RGPD/email** au lieu de réutiliser
    `DocumentGenere` / `RgpdDemande` / `email-worker` / R2 existants.

---

## 10. Checklists DoD (Definition of Done conformité)

### MVP — « FOAD finançable OPCO + entreprise + vente directe »

**Condition 1 (Ind.19) :** tutorat 2 canaux, SLA affiché=tenu (`premiereReponseAt`),
panneau aide + page aide, emails Nodemailer.
**Condition 2 (Ind.1/9) :** durée obligatoire (gate publication), écran programme
(verrou avec raison), `modalites_foad`, `onboardingVuAt`.
**Condition 3 (Ind.11★) :** quiz serveur + gating score réel, finale →
`EvaluationAcquis` (FK nullable), devoir upload R2 + note.
**Faisceau (R.6313-3) :** `LessonProgress` + `ElearningXapiStatement` (ipHash,
serveur) + `genererDossierPreuveFoad` / `ElearningPreuveExport` +
`assertFaisceauComplet` + export admin (`requireAdminRead`).
**Sortie :** `elearning-certificat-worker` conditionné + heures réalisées
(centièmes, Option A) + portail apprenant.
**Conservation/RGPD :** familles câblées, agrégat avant purge, anonymisation
conserve les preuves, stub-aware.
**Publication :** `publishCourse` bloque si tuteur/SLA/aide/durée/éval manquants.

### V1 — industrialisation conformité

Tuteur RAG ancré+citations journalisé ; relance anti-décrochage (Ind.12) ; banque
de questions + tirage N parmi M ; reporting conformité exportable (complétion,
scores, délais SLA).

### V2 — certification / CPF (hors MVP, gated)

Garanties RNCP/RS (identité, anti-fraude, absence d'assistance pendant l'épreuve,
alternative au proctoring) ; EDOF derrière `EDOF_ENABLED` (entrée effective,
assiduité, service fait, FranceConnect+).

### Tests (Vitest) attendus à chaque PR conformité

- [ ] `assertFaisceauComplet` refuse un dossier relevé-seul ; exige Ind.11.
- [ ] Gating : module verrouillé tant que `scorePct < unlockScorePct`.
- [ ] Certificat émis **seulement** si réussite+100%+seuil.
- [ ] `assertCpfAllowed` refuse `cpf` flag OFF / cours non certifiant.
- [ ] `resolveRetentionMonths` (policy→env→fallback) + garde `< 1`.
- [ ] Anonymisation conserve `QuizAttempt`/snapshots/certificats sous durée légale.
- [ ] Stub-awareness (mutation `stub.invalid` → throw / lecture → vide).
- [ ] RBAC (`requireAdminRead/Write`) sur les écrans/actions conformité.
- [ ] Intégrité `manifest.json` (hash reproductible) + idempotence export.

---

## 11. Mapping de référence (vue auditeur)

```
D.6313-3-1 §1  Assistance technique+pédagogique → Ind.19  → threads/SLA/emails/RAG     → assistance + email-worker
D.6313-3-1 §2  Info activités + durée moyenne    → Ind.1/9 → programme + Modalités FOAD  → ElearningCourse.duree* + DocumentGenere + onboardingVuAt
D.6313-3-1 §3  Évaluations jalon/conclusion      → Ind.11★ → quiz gating + finale        → QuizAttempt + EvaluationAcquis + devoir
R.6313-3       Preuve libre (faisceau)           → Ind.12  → activité+éval+accompagnement → LessonProgress + ElearningXapiStatement + ElearningPreuveExport
Sortie         Certificat de réalisation         → —       → heures réalisées + QR        → DocumentGenere (worker conditionné)
CPF            Certif RNCP/RS + EDOF             → —       → financeur gated              → isEdofEnabled() + Formation.cpfEligible + assertCpfAllowed
RGPD           Conservation différenciée         → —       → anonymisation sous durée     → ElearningRetentionPolicy + crons + supprimerStagiaire
```

---

## 12. Réutilisation existante (anti-duplication) — rappel rapide

| Besoin conformité                              | Brique 🟦 réutilisée                                                                                   | Emplacement                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Identité + PII chiffrée + consentements        | `Trainee`                                                                                              | `schema.prisma:5274`                      |
| Accès portail token (magic-link)               | `PortailAcces` + `portail-service.ts`                                                                  | `schema.prisma:6236`                      |
| Registre d'évaluation Qualiopi                 | `EvaluationAcquis` (+ FK e-learning nullable)                                                          | `schema.prisma:5653`                      |
| Positionnement / satisfaction                  | `Questionnaire` (+ FK e-learning nullable)                                                             | `schema.prisma:5704`                      |
| Certificat (heures centièmes, QR, hash, 5 ans) | `DocumentGenere` + `certificat-realisation.tsx`                                                        | `schema.prisma:5507`                      |
| Certif RNCP/RS, EDOF vérifié, blocs            | champs déjà sur `Formation`                                                                            | `schema.prisma:~5096-5116`                |
| Financeur                                      | enum `FinancementType` (`direct\|opco\|cpf\|france_travail`)                                           | `schema.prisma:~4951`                     |
| Flag dormant (pattern)                         | `STRIPE_ENABLED` / `isStripeEnabled`                                                                   | `src/env.ts:105,350`                      |
| Stockage preuves PDF/ZIP                       | R2 (`uploadToR2`/`getSignedUrlR2`/`getObjectBufferR2`/`deleteFromR2`)                                  | `src/lib/r2-storage.ts`                   |
| RGPD existant                                  | `RgpdDemande` + `rgpd-service.ts`                                                                      | `schema.prisma:6277`                      |
| Purge / rétention                              | `retention-purge-worker.ts` (cron `0 3 * * *`)                                                         | `src/server/queue/**`                     |
| RBAC admin                                     | `requireAdminRead/Write/Publish/Delete`                                                                | `src/server/actions/knowledge/_guards.ts` |
| Console admin                                  | `AdminPageShell`/`AdminTable`/`AdminBadge`/`StatCard` + `admin-nav.ts` (monté = `AdminSidebarNav.tsx`) | `src/lib/admin-nav.ts`                    |
| Emails                                         | Nodemailer + React Email `qualiopi-*.tsx` + `email-worker`                                             | `src/server/queue/**`                     |
| Espace formateur (accès tuteur)                | `FormateurMagicLink` / espace-formateur                                                                | `src/app/[locale]/.../espace-formateur`   |
| Hash IP                                        | `IP_HASH_SALT` (pattern image-bank)                                                                    | env                                       |

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 (auth hybride), 0003 (CPF/RNCP
  certification-ready), 0004 (Stripe gated), 0005 (vidéo/sous-processeur), 0006
  (tracking xAPI), 0007 (cloisonnement), 0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource`, enums, `dureeEstimeeMinutes`, `unlock*`, `seuilReussitePct`, `estFoad`.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`/`ModuleProgress`/`CourseProgress`, `ElearningXapiStatement` (faisceau).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`/`Question`/`QuizAttempt`, gating par score (Ind.11).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `Trainee.passwordHash`, sessions apprenant, `ElearningAuthLog`.
- `08-CONFORMITE/01-foad-d6313-3-1.md` — les 3 conditions cumulatives (détail + checklist).
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — Ind. 1/6/9/10/11★/12/17/19 + garde `publishCourse`.
- `08-CONFORMITE/03-cpf-edof-readiness.md` — flag `EDOF_ENABLED`, `assertCpfAllowed`, `EdofDossier/Declaration/Snapshot`.
- `08-CONFORMITE/04-dossier-certification-rncp-rs.md` — le vrai verrou (France Compétences, hors code).
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — familles A/B/C/D, `ElearningRetentionPolicy`, crons, anonymisation.
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — faisceau R.6313-3, `ElearningPreuveExport`, `assertFaisceauComplet`, manifest scellé.
- `04-BACKEND/09-tuteur-rag-assistant.md` & `10-emails-notifications.md` — assistance (Ind.19) & relances (Ind.12).
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — verrou affiché **avec sa raison** ; `06-certificats-badges.md` — certificat apprenant.
- `09-QUALITE/04-accessibilite-wcag22.md` — WCAG 2.2 AA (EAA 28/06/2025 : 2.4.11, 2.5.7, 2.5.8, 3.3.8).
- `10-SKILLS/skill-axionia-lms-core.md` & `skill-axionia-lms-authoring.md` — skills de construction (ce skill = garde-fou conformité par-dessus).
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — lot 9 = conformité FOAD transversale ; CPF/EDOF en V2.
- Skill plugin `axionia-qualiopi` — back-office Qualiopi présentiel/distanciel (doctrine faisceau réutilisée).
