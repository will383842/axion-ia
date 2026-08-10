# Mapping Qualiopi V8 (indicateurs FOAD) → fonctionnalités & preuves LMS

> **Objet.** Pour chaque indicateur Qualiopi concerné par la formation ouverte et à distance (FOAD / e-learning asynchrone), ce document dit : **(1) l'exigence** du référentiel, **(2) ce que la plateforme produit** comme fonctionnalité/preuve, **(3) où c'est stocké** (modèle Prisma / R2 / fichier), **(4) comment le montrer en audit** (écran admin, export, PDF).
>
> **Référentiel applicable.** Référentiel National Qualité (RNQ), version applicable depuis le **23/11/2023** (Qualiopi « V8 »). Indicateurs spécifiquement mobilisés par la **modalité FOAD** : **1, 6, 9, 10, 11 (non-conformité majeure), 12, 17, 19**. Cette liste est la cible de ce mapping. Les autres indicateurs (2, 3, 4, 5, 7, 8, 13–16, 18, 20–32) restent gérés par le back-office Qualiopi existant (`src/server/qualiopi/**`) et ne sont pas re-spécifiés ici.
>
> **Deux indicateurs structurants à surligner :**
>
> - **Ind. 11 — non-conformité MAJEURE** si les évaluations qui jalonnent/concluent la FOAD sont absentes. C'est le point de chute fatal d'un audit FOAD.
> - **Ind. 19 — seule obligation Qualiopi nommément FOAD** : assistance **technique ET pédagogique** (tutorat) accessible, avec délais formalisés. L'article D.6313-3-1 §1 en fait une **condition cumulative** de l'imputabilité FOAD.
>
> **Statut implémentation.** 🟦 EXISTANT (réutilisé tel quel/étendu) · 🟩 NEUF (à construire sous `src/server/elearning/**`). Voir ADR-LMS-0007 (cloisonnement) et ADR-LMS-0008 (migrations additives).

---

## 0. Tableau de synthèse

| Ind.   | Intitulé (résumé)                                                                       | Fonctionnalité LMS clé                                                       | Modèle(s) preuve                                                            | Criticité                  |
| ------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------- |
| **1**  | Information publique claire (prérequis, objectifs, **durée**, modalités, accessibilité) | Fiche cours publique + champ durée + page modalités FOAD                     | `ElearningCourse` 🟩                                                        | Manquement = NC mineure    |
| **6**  | Veille légale/sectorielle réinvestie dans l'offre                                       | Versionnage de cours + journal de mise à jour                                | `ElearningCourse.version` 🟩 + Formation Engine 🟦                          | NC mineure                 |
| **9**  | Information du bénéficiaire (contenu, **durée moyenne**, modalités d'accompagnement)    | Onboarding apprenant + écran « comment ça marche » + durée affichée          | `ElearningCourse` 🟩 + email d'octroi 🟩                                    | NC mineure                 |
| **10** | Adaptation prestation / accompagnement / suivi                                          | Drip + déverrouillage + reprise auto + adaptations handicap                  | `ElearningEnrollment`, `LessonProgress` 🟩 + `Trainee.situationHandicap` 🟦 | NC mineure                 |
| **11** | **Évaluation de l'atteinte des objectifs** (jalon + bilan)                              | **Moteur de quiz bloquant + gating par score + quiz final**                  | `Quiz`, `QuizAttempt` 🟩 + `EvaluationAcquis` 🟦                            | **NC MAJEURE si absent**   |
| **12** | Engagement/assiduité, prévention de l'abandon                                           | Heartbeat + logs LMS + relances anti-décrochage                              | `LessonProgress`, `ElearningActivityLog` 🟩                                 | NC mineure                 |
| **17** | Moyens techniques/encadrement adaptés (incl. plateforme)                                | Plateforme propriétaire + dispo tuteurs + accessibilité WCAG 2.2 AA          | `ElearningTutor*` 🟩 + infra                                                | NC mineure                 |
| **19** | **Assistance technique ET pédagogique (FOAD)**                                          | **Tutorat : messagerie apprenant↔tuteur + SLA + tuteur RAG + page contacts** | `ElearningSupportThread`, `ElearningSupportMessage` 🟩                      | **Obligation FOAD nommée** |

> Faisceau de preuves (R.6313-3 : preuve libre, émargement non obligatoire en FOAD mais relevé de connexion **seul insuffisant**) : voir `08-CONFORMITE/06-tracabilite-preuves-realisation.md`.

---

## 1. Indicateur 1 — Information du public sur les prestations

**Exigence.** Le prestataire diffuse une information accessible au public, détaillée et vérifiable sur les prestations proposées : **prérequis, objectifs, durée, modalités et délais d'accès, tarifs, méthodes pédagogiques, modalités d'évaluation, accessibilité aux personnes en situation de handicap**. Pour la FOAD, la **durée** et les **modalités techniques** doivent être explicites.

**Ce qu'on produit.**

- 🟩 Fiche cours publique alimentée par `ElearningCourse` : `titre`, `sousTitre`, `description`, `objectifs` (JSON `string[]`), `prerequis` (JSON `string[]`), `publicVise`, `dureeEstimeeMinutes` (agrégé des leçons), `langue`. Voir `03-DATA-MODEL/01-schema-cours-modules-lecons.md`.
- 🟩 Bloc « modalités FOAD » sur la fiche : asynchrone, durée moyenne estimée, équipement requis, modalités d'accompagnement (renvoi Ind. 19), modalités d'évaluation (renvoi Ind. 11).
- 🟦 Réutilisation du composant accessibilité handicap déjà présent sur les fiches formation Qualiopi (référent handicap, contact). Le LMS réutilise le bloc référent handicap existant plutôt que d'en créer un.
- 🟦 SEO/JSON-LD `Course` (V1 — `05-FRONTEND-APPRENANT/07-catalogue-public-seo.md`).

**Où c'est stocké.** Table `elearning_courses` (modèle `ElearningCourse` 🟩). Durée = somme calculée des `ElearningLesson.dureeEstimeeMinutes`, mise en cache dans `ElearningCourse.dureeEstimeeMinutes` à chaque publication.

**Comment le montrer en audit.**

- Ouvrir l'URL publique du cours (`/[locale]/formations-en-ligne/[slug]` 🟩) → l'auditeur voit prérequis/objectifs/durée/modalités/accessibilité.
- Console : `…/elearning/cours/[id]` → onglet « Publication » montre `statut=publie`, `version`, `publishedAt`.

---

## 2. Indicateur 6 — Veille légale, réglementaire et sectorielle

**Exigence.** Le prestataire prouve une veille (légale, réglementaire, métier, pédagogique/technologique pour la FOAD) **réinvestie** dans la conception/actualisation de ses prestations. Pour la FOAD : veille sur les **outils et usages numériques**.

**Ce qu'on produit.**

- 🟩 **Versionnage de cours** : `ElearningCourse.version` (incrément à chaque publication) + `publishedAt`. Chaque republication = trace datée d'actualisation.
- 🟩 **Journal de mise à jour** par cours : table `ElearningCourseRevision` (NEUF) — `{ courseId, version, resume (motif/source de l'actualisation), changedByAdminId, createdAt }`. C'est la preuve directe « veille → réinvestissement ».
- 🟦 Réutilisation de la **veille Qualiopi existante** (back-office `src/server/qualiopi/**`, indicateur 6 déjà outillé pour le présentiel) : le LMS s'y rattache, il ne crée pas un second système de veille. Les entrées de veille existantes peuvent référencer un `courseId` impacté.
- 🟦 Formation Engine IA (`qualiopi-formation-engine-worker.ts`) déjà capable de régénérer/raffiner du contenu : utilisable pour proposer des actualisations de leçons (assist), validées humainement avant republication.

**Où c'est stocké.** `elearning_courses` (`version`, `published_at`) + `elearning_course_revisions` (🟩) + tables de veille Qualiopi existantes.

**Comment le montrer en audit.** Console `…/elearning/cours/[id]` → onglet « Historique des versions » : liste des révisions avec date, motif, auteur. Démontre que le cours évolue suite à la veille.

---

## 3. Indicateur 9 — Information du bénéficiaire sur le déroulé

**Exigence.** Avant l'entrée en formation, le bénéficiaire est informé des **conditions de déroulement** : contenu, **durée moyenne**, rythme, modalités d'accompagnement, moyens techniques requis. Spécifique FOAD : l'apprenant doit savoir comment se déroule l'asynchrone et **comment être accompagné** (renvoi D.6313-3-1 §2 — information sur les activités et leur durée moyenne).

**Ce qu'on produit.**

- 🟩 **Email d'octroi d'accès** (Nodemailer + React Email, template `elearning-acces-octroye.tsx`) envoyé à l'apprenant : lien d'accès (magic-link, cf. ADR-LMS-0001), durée moyenne du parcours, fonctionnement (modules déverrouillables, quiz bloquants), contacts d'assistance (renvoi Ind. 19), délais de réponse. Envoyé via la file existante `email-worker`.
- 🟩 **Écran « Comment ça marche »** au premier login (espace apprenant `/[locale]/portail/elearning` 🟩, extension du portail existant) : explication du parcours + durée + accompagnement, avec **acquittement** persisté (preuve que l'information a été délivrée).
- 🟩 Persistance de l'acquittement : `ElearningEnrollment.onboardingVuAt` (NEUF) — horodatage de la prise de connaissance.
- 🟦 Réutilisation `PortailAcces` (token 64 hex, cookie HttpOnly 90 j) pour le lien d'accès — pas de nouveau mécanisme de lien.

**Où c'est stocké.** `elearning_enrollments.onboarding_vu_at` (🟩). L'email envoyé est tracé dans le système d'emails existant (log d'envoi). Le contenu informatif provient de `ElearningCourse` (durée, modalités).

**Comment le montrer en audit.**

- Montrer le template d'email d'octroi + un envoi réel daté.
- Console fiche apprenant → « Onboarding vu le … » (preuve horodatée que le bénéficiaire a été informé).

---

## 4. Indicateur 10 — Adaptation, accompagnement et suivi

**Exigence.** La prestation, l'accompagnement et le suivi sont **adaptés** aux publics (rythme, modalités, situation de handicap). Pour la FOAD : individualisation du parcours, possibilité de reprendre, suivi de la progression.

**Ce qu'on produit.**

- 🟩 **Reprise automatique** : `LessonProgress` (NEUF — `02-schema-progression-tracking.md`) persiste la position serveur (`lastPositionSec` pour la vidéo, `statut` en cours/terminé). L'apprenant reprend exactement où il s'est arrêté (best practice 2026, reprise persistée **serveur**, pas localStorage).
- 🟩 **Déverrouillage progressif adaptable** : `ElearningModule.unlockType` / `ElearningLesson.unlockType` (enum `ElearningUnlockType` : `immediat`, `apres_precedent`, `date_fixe`, `offset_inscription`, `score_quiz`). Le parcours s'adapte au rythme (drip) et aux acquis (gating par score).
- 🟩 **Override admin** par apprenant : `ElearningEnrollment` peut porter un déverrouillage forcé (adaptation individuelle documentée) — server action `overrideUnlock` (🟩) trace l'acte et son motif.
- 🟦 **Adaptation handicap** : réutilisation de `Trainee.situationHandicap` + `Trainee.handicapDetailsChiffre` (chiffré pii-crypto) + circuit référent handicap existant. L'adaptation du parcours e-learning (temps majoré sur quiz, ressources alternatives) se branche sur ces champs existants — aucune duplication des données handicap.
- 🟩 **Accessibilité WCAG 2.2 AA** du player/quiz (obligation EAA depuis 28/06/2025) : sous-titres, clavier, focus, contraste, cible ≥ 24 px, alternative au drag (critère 2.5.7). Détail `09-QUALITE/04-accessibilite-wcag22.md`.

**Où c'est stocké.** `lesson_progress` (🟩), `elearning_enrollments` (🟩, déverrouillages/override), `trainees` (🟦, handicap). Adaptations présentielles déjà tracées dans `Enrollment.adaptationsRealisees` (🟦) — le pendant FOAD vit côté `ElearningEnrollment`.

**Comment le montrer en audit.** Console `…/elearning/apprenants/[id]` → vue progression (où il en est, dates), déverrouillages appliqués, overrides + motifs, et le cas échéant adaptations handicap (accès référent uniquement).

---

## 5. Indicateur 11 — Évaluation de l'atteinte des objectifs ⚠️ NON-CONFORMITÉ MAJEURE

> **Indicateur le plus critique de la FOAD.** L'absence d'évaluations qui **jalonnent et concluent** la formation est une **non-conformité MAJEURE**. C'est aussi la 3ᵉ condition cumulative de D.6313-3-1 (les évaluations « jalonnent ou concluent » l'action). Sans ce dispositif, la FOAD n'est ni conforme Qualiopi ni imputable.

**Exigence.** Le prestataire **évalue l'atteinte des objectifs** par les bénéficiaires, à des moments adaptés (en cours = jalons, et en fin = bilan). L'évaluation doit être **traçable** et reliée aux objectifs pédagogiques.

**Ce qu'on produit (cœur NEUF).**

- 🟩 **Moteur de quiz interactif** (`Quiz`, `Question`, `QuizAttempt` — `03-schema-quiz-evaluations.md`), ~12 types (QCM mono/multi, vrai-faux, appariement, texte à trous, ordonnancement, réponse courte, essai + correction manuelle, upload). Correction auto + barème/pondération + seuil de réussite + rationale.
- 🟩 **Évaluations qui JALONNENT** : un `Quiz` peut servir de **gate de module** via `ElearningModule.unlockType = score_quiz` + `unlockQuizId` + `unlockScorePct`. Tant que le score n'atteint pas le seuil, le module suivant reste verrouillé → preuve d'évaluation **en cours de parcours**, à chaque jalon.
- 🟩 **Évaluation qui CONCLUT** : quiz final du cours, seuil global `ElearningCourse.seuilReussitePct` (défaut 70). La réussite conditionne le **certificat de réalisation** (Ind. lié + R.6313-3).
- 🟩 **Gating par VRAIE note** (pas attempt-only) : `QuizAttempt.scorePct` comparé à un seuil. Best practice 2026 explicite (gating de compétence, pas de simple « a tenté »).
- 🟩 **Évaluation à froid / acquis durables** : reprise possible d'un quiz à J+N (drip `offset_inscription`).
- 🟦 **Pont vers la preuve Qualiopi existante** : à la complétion du quiz final, on **matérialise un `EvaluationAcquis`** (modèle existant, `type=EvaluationType`, `scoreObtenu/scoreMax/scorePct`, `niveauGlobal`, `reussite`, `competences` reliant note↔objectif). Ainsi la preuve FOAD atterrit dans le **même registre** que les évaluations présentielles → l'auditeur a un point d'entrée unique. Lien posé via une server action `syncEvaluationAcquisFromQuiz` (🟩) appelée par le worker de complétion. `EvaluationAcquis.enrollmentId` reste nullable (déjà rendu nullable pour le 1-to-1 AFEST) ; on ajoute un rattachement e-learning (FK additive vers `ElearningEnrollment`).
- 🟩 **Type devoir** (`ElearningLessonType.devoir`) : travail à rendre (upload R2), corrigé manuellement → preuve d'évaluation complémentaire (essai/projet).

**Où c'est stocké.** `quizzes`, `questions`, `quiz_attempts` (🟩) — note serveur, horodatée, par tentative. Miroir de preuve dans `evaluations_acquis` (🟦). Devoirs rendus → `ElearningResource` / `LessonProgress` + fichier R2.

**Comment le montrer en audit.**

- Console `…/elearning/apprenants/[id]` → onglet « Évaluations » : chaque quiz tenté, score, date, réussite/échec, et le verrou de module qu'il a déclenché.
- Export PDF/CSV « relevé d'évaluations FOAD » (🟩) par apprenant : liste des jalons + bilan final + dates.
- Le registre Qualiopi existant `EvaluationAcquis` contient l'entrée finale, cohérente avec le présentiel.
- **Démonstration live** : l'auditeur peut voir un module rester verrouillé tant que le score < seuil (gating effectif, pas décoratif).

---

## 6. Indicateur 12 — Engagement, assiduité et prévention de l'abandon

**Exigence.** Le prestataire prend en compte les **appréciations** et favorise **l'engagement** des bénéficiaires ; pour la FOAD, **suivre l'assiduité** et **prévenir l'abandon** (relances). C'est la brique « assiduité » du faisceau de preuves (R.6313-3) — le relevé de connexion seul ne suffit pas.

**Ce qu'on produit.**

- 🟩 **Heartbeat de progression** : le player envoie périodiquement la position au serveur (server action `recordProgress` 🟩, throttlée). Persistance dans `LessonProgress` (`lastPositionSec`, `watchedSec`, `updatedAt`).
- 🟩 **Journal d'activité (grammaire xAPI verbe/objet, ADR-LMS-0006)** : table `ElearningActivityLog` (NEUF) — `{ enrollmentId, verbe ('started'|'progressed'|'completed'|'answered'|'passed'|'failed'), objetType, objetId, payload Json, occurredAt }`. C'est le **log LMS** du faisceau de preuves.
- 🟩 **Calcul d'assiduité FOAD** : temps cumulé (`watchedSec`) + complétions + tentatives quiz → taux d'avancement. Sert au **certificat de réalisation** (heures réalisées) et au service fait.
- 🟩 **Relances anti-décrochage** (V1) : worker `elearning-relance-worker.ts` + cron — détecte l'inactivité (X jours sans `ElearningActivityLog`) et envoie un email de relance (Nodemailer). Trace de l'accompagnement actif → preuve Ind. 12 ET Ind. 19.
- 🟦 Réutilisation `Appreciation` (modèle existant, multi-parties) pour le recueil structuré des retours apprenant FOAD.
- 🟦 Réutilisation, le cas échéant, de `PresenceCreneau` / `ReleveConnexionImport` pour la part **synchrone** (classes virtuelles) d'un parcours hybride — mais en FOAD pure, l'assiduité = logs LMS, pas émargement.

**Où c'est stocké.** `lesson_progress` (🟩), `elearning_activity_log` (🟩), `appreciations` (🟦). Logs techniques conservés selon CNIL (6 mois–1 an) ; preuves de réalisation 3–5 ans (cf. `05-rgpd-conservation-preuves.md`).

**Comment le montrer en audit.** Console `…/elearning/apprenants/[id]` → timeline d'activité (dates, durées, complétions) + relances envoyées. Export « relevé d'assiduité FOAD » horodaté.

---

## 7. Indicateur 17 — Moyens techniques et d'encadrement adaptés

**Exigence.** Le prestataire mobilise des **moyens humains et techniques** adaptés et coordonne l'action. Pour la FOAD : la **plateforme** (fiabilité, accessibilité) et l'**encadrement à distance** sont des moyens à part entière.

**Ce qu'on produit.**

- 🟩 **Plateforme LMS propriétaire** : player vidéo HLS adaptatif (Cloudflare Stream, ADR-LMS-0005), URLs signées + watermark, sous-titres, mobile-first, accessibilité WCAG 2.2 AA. Le moyen technique est documenté et démontrable.
- 🟩 **Encadrants identifiés** : table `ElearningTutor` (NEUF) ou réutilisation des formateurs existants — rattachement tuteur ↔ cours (`ElearningCourseTutor` 🟩). Liste des encadrants disponibles = preuve de moyen humain.
- 🟦 Réutilisation de l'espace formateur existant (`FormateurMagicLink`, `src/app/[locale]/.../espace-formateur`) comme socle pour l'accès tuteur — extension plutôt que nouveau monde.
- 🟦 Infrastructure : R2 (`src/lib/r2-storage.ts`) pour PDF/ressources/sous-titres ; Cloudflare Stream pour la vidéo. Pas d'auto-hébergement vidéo (ADR-LMS-0005).
- 🟩 Spécimens de fiabilité : heartbeat + supervision (erreurs player → Sentry existant).

**Où c'est stocké.** `elearning_tutors` / liaison cours-tuteur (🟩) ; médias dans R2 + Cloudflare Stream (`ElearningResource.r2Key`, `ElearningLesson.videoAssetId`). Spécifications plateforme : `04-BACKEND/07-pipeline-video-streaming.md`, `09-QUALITE/*`.

**Comment le montrer en audit.** Console `…/elearning/cours/[id]` → onglet « Encadrement » : tuteurs affectés. Démonstration de la plateforme (player, accessibilité). Documentation technique de l'infra disponible.

---

## 8. Indicateur 19 — Assistance technique ET pédagogique (FOAD) ⭐ OBLIGATION FOAD NOMMÉE

> **Seul indicateur du référentiel explicitement dédié à la FOAD.** Il décline la **1ʳᵉ condition cumulative de D.6313-3-1** : une **assistance technique ET pédagogique** doit être **accessible** au bénéficiaire, avec des **délais formalisés** (tutorat). Sans dispositif d'accompagnement traçable, la FOAD n'est pas imputable.

**Exigence.** Le prestataire informe les bénéficiaires des **modalités d'accompagnement** et met en œuvre une **assistance** :

- **technique** (problème d'accès, lecture vidéo, compte) ;
- **pédagogique** (questions sur le contenu, aide à la progression) ;
- avec des **délais de réponse formalisés** (SLA annoncé) et des **traces** de cet accompagnement.

**Ce qu'on produit (cœur conformité FOAD, NEUF).**

- 🟩 **Messagerie apprenant ↔ tuteur** : modèles `ElearningSupportThread` + `ElearningSupportMessage` (NEUF).
  - `ElearningSupportThread` : `{ id, enrollmentId, courseId, lessonId?, categorie ('technique'|'pedagogique'), statut ('ouvert'|'en_cours'|'resolu'), assignedTutorId?, createdAt, firstResponseAt?, resolvedAt? }`.
  - `ElearningSupportMessage` : `{ id, threadId, auteurType ('apprenant'|'tuteur'), auteurId, corps Text, pieceJointeR2Key?, createdAt }`.
  - `firstResponseAt` permet de **mesurer le respect du SLA** (délai de première réponse) → preuve directe « délais formalisés ».
- 🟩 **SLA affiché et persistant** : délai de réponse annoncé (ex. « réponse sous 1 jour ouvré ») affiché dans l'espace apprenant ET sur la fiche cours (Ind. 1/9). Valeur configurable (SiteSetting ou champ cours).
- 🟩 **Page « Besoin d'aide »** dans l'espace apprenant (`/[locale]/portail/elearning/aide` 🟩) : canal technique + canal pédagogique + contacts + délais. Information **accessible en permanence**.
- 🟩 **Tuteur RAG (assistance pédagogique augmentée, V1)** : assistant ancré (`grounded`) avec **citations**, réutilisant le RAG/knowledge existant (`src/server/knowledge/**`, provider Anthropic). Spécifié `04-BACKEND/09-tuteur-rag-assistant.md`. ⚠️ **Le tuteur IA ne remplace pas l'assistance humaine** exigée par Ind. 19 : il l'augmente. L'escalade vers un tuteur humain reste toujours disponible (sinon NC).
- 🟩 **Relances proactives** (cf. Ind. 12) = forme d'accompagnement actif, tracée.
- 🟦 Notifications par email (Nodemailer + `email-worker`) : nouvelle réponse tuteur, ouverture/clôture de ticket.
- 🟦 Accès tuteur via l'espace formateur existant (`FormateurMagicLink`) étendu d'un onglet « tickets e-learning ».

**Où c'est stocké.** `elearning_support_threads` + `elearning_support_messages` (🟩). Pièces jointes dans R2. SLA dans la config cours / SiteSetting. Échanges du tuteur RAG tracés (citations incluses) pour audit.

**Comment le montrer en audit.**

- Console `…/elearning/assistance` (🟩) : liste des fils, catégorie technique/pédagogique, **délai de première réponse** vs SLA, taux de résolution.
- Ouvrir un fil → l'historique daté prouve l'assistance **effective** (pas seulement annoncée).
- Montrer la page « Besoin d'aide » côté apprenant + le SLA affiché.
- Export « registre d'assistance FOAD » horodaté (preuve d'accompagnement, à conserver 3–5 ans).

> **Garde-fou conformité (à coder).** Un cours `estFoad=true` ne peut être **publié** que si : (a) au moins un tuteur est rattaché (Ind. 17/19), (b) un SLA est défini, (c) la page d'aide est active. Implémenter ce contrôle dans la server action de publication (`publishCourse`), miroir des gardes `conformite.ts` déjà utilisées côté Qualiopi (facture/convention bloquées si identité OF vide).

---

## 9. Articulation D.6313-3-1 (3 conditions cumulatives) ↔ indicateurs

L'imputabilité FOAD (art. D.6313-3-1) repose sur **3 conditions cumulatives**, chacune câblée à un (des) indicateur(s) et à des preuves LMS :

| Condition D.6313-3-1                                                      | Indicateur(s)        | Brique LMS                                                      | Preuve                         |
| ------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------- | ------------------------------ |
| §1 Assistance technique **ET** pédagogique accessible (délais formalisés) | **Ind. 19**          | `ElearningSupportThread/Message` + SLA + tuteur RAG             | Registre d'assistance horodaté |
| §2 Information sur les **activités** et leur **durée moyenne**            | Ind. 1, **Ind. 9**   | `ElearningCourse.dureeEstimeeMinutes` + onboarding acquitté     | Fiche + `onboardingVuAt`       |
| §3 **Évaluations** qui jalonnent/concluent                                | **Ind. 11** (majeur) | `Quiz`/`QuizAttempt` (gating) + quiz final → `EvaluationAcquis` | Relevé d'évaluations           |

**R.6313-3 (preuve libre).** Pas d'émargement obligatoire en FOAD, mais **faisceau de preuves** : évaluations (Ind. 11) + travaux rendus (devoirs) + **logs LMS** (`ElearningActivityLog`, Ind. 12) + **traces d'accompagnement** (Ind. 19). Le **relevé de connexion seul est insuffisant** : la plateforme combine systématiquement plusieurs sources. Détail : `08-CONFORMITE/06-tracabilite-preuves-realisation.md`.

**Certificat de réalisation** (modèle officiel, heures réalisées, obligatoire depuis 01/06/2020) : généré via le `DocumentGenere` existant (🟦, type dédié + `qrToken` + hash SHA-256 + `suppressionPrevueAt`), heures dérivées de l'assiduité LMS. Voir `05-FRONTEND-APPRENANT/06-certificats-badges.md`.

---

## 10. Récapitulatif EXISTANT vs NEUF (par indicateur)

| Ind.   | EXISTANT réutilisé 🟦                                    | NEUF à construire 🟩                                                                     |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1      | Bloc handicap/référent, JSON-LD socle                    | `ElearningCourse` + fiche/modalités FOAD                                                 |
| 6      | Veille Qualiopi, Formation Engine IA                     | `ElearningCourse.version`, `ElearningCourseRevision`                                     |
| 9      | `PortailAcces`, emails Nodemailer/`email-worker`         | Email octroi, écran onboarding, `onboardingVuAt`                                         |
| 10     | `Trainee.situationHandicap` (chiffré), référent handicap | `LessonProgress`, `ElearningUnlockType`, override admin, WCAG                            |
| **11** | `EvaluationAcquis` (registre)                            | **Moteur quiz `Quiz`/`QuizAttempt`, gating score, `devoir`, sync vers EvaluationAcquis** |
| 12     | `Appreciation`, `PresenceCreneau` (part synchrone)       | Heartbeat `recordProgress`, `ElearningActivityLog`, `elearning-relance-worker`           |
| 17     | Espace formateur (`FormateurMagicLink`), R2              | Player HLS, `ElearningTutor`/liaison cours-tuteur                                        |
| **19** | `email-worker`, RAG/knowledge, espace formateur          | **`ElearningSupportThread/Message`, SLA, page aide, tuteur RAG, garde publication**      |

---

## 11. Garde-fous & pièges à ne pas reproduire

- **Ind. 11 = MAJEUR** : ne jamais livrer un cours FOAD sans quiz jalonnant + quiz final reliés aux objectifs. Le gating doit être par **score réel**, pas « a tenté » (best practice + exigence preuve).
- **Ind. 19 ≠ chatbot seul** : le tuteur RAG **augmente** mais ne remplace pas l'assistance humaine ; toujours une voie d'escalade humaine + SLA respecté et mesuré (`firstResponseAt`).
- **Relevé de connexion seul = insuffisant** (R.6313-3) : combiner logs + évaluations + travaux + accompagnement.
- **Migrations additives uniquement** (ADR-LMS-0008) : `EvaluationAcquis` reçoit une FK e-learning **nullable** ; aucun DROP.
- **Conservation** : 10 ans comptable, 6 ans fiscal/OPCO, 3–5 ans preuves de réalisation, 6 mois–1 an logs techniques (CNIL). Aligner `suppressionPrevueAt` / purges crons sur ces durées (cf. `05-rgpd-conservation-preuves.md`).
- **Publication conditionnée** : `publishCourse` bloque si tuteur/SLA/page d'aide manquants pour un cours `estFoad=true`.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 (auth), 0005 (vidéo), 0006 (xAPI), 0007 (cloisonnement), 0008 (migrations)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource`, enums
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, `ElearningActivityLog`
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`, `Question`, `QuizAttempt` (Ind. 11)
- `04-BACKEND/03-workers-bullmq-crons.md` — `elearning-relance-worker`, crons assiduité
- `04-BACKEND/09-tuteur-rag-assistant.md` — tuteur RAG (Ind. 19)
- `04-BACKEND/10-emails-notifications.md` — emails octroi / relance / assistance
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique `unlock*` (Ind. 10)
- `05-FRONTEND-APPRENANT/06-certificats-badges.md` — certificat de réalisation
- `08-CONFORMITE/01-foad-d6313-3-1.md` — les 3 conditions cumulatives (détail)
- `08-CONFORMITE/03-cpf-edof-readiness.md` — CPF/EDOF (hors périmètre indicateurs FOAD)
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — durées de conservation
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — faisceau de preuves (R.6313-3)
- `09-QUALITE/04-accessibilite-wcag22.md` — WCAG 2.2 AA (Ind. 10/17)
